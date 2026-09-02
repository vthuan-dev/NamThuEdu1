#!/usr/bin/env bash
#
# Deploy backend Laravel lên VPS.
#
# Script này được GitHub Actions (.github/workflows/deploy-backend.yml) scp lên
# VPS rồi chạy. Cố ý KHÔNG dựa vào file nào có sẵn trên VPS: bản deploy.sh cũ
# chỉ tồn tại trên server, không được version control, và khi nó mất thì deploy
# backend fail im lặng suốt từ 30/08 tới 02/09 (3 lần liên tiếp, lỗi
# "deploy.sh: No such file or directory") trong khi frontend vẫn deploy bình
# thường — production chạy backend cũ mà không ai biết.
#
# Chạy tay khi cần:
#   bash /tmp/deploy-backend-vps.sh
#
set -euo pipefail

APP_DIR="/var/www/namthuedu"
BACKEND_DIR="$APP_DIR/backend"
BRANCH="main"
BACKUP_DIR="/var/backups/namthuedu"
KEEP_BACKUPS=10
HEALTH_URL="https://namthuedu.vn/api/health"

log()  { echo "[$(date '+%H:%M:%S')] $*"; }
fail() { echo "[LỖI] $*" >&2; exit 1; }

# ──────────────────────────────────────────────────────────────────────────
# 1. Kiểm tra tiền đề
# ──────────────────────────────────────────────────────────────────────────
log "==> Kiểm tra môi trường"

[ -d "$APP_DIR/.git" ]  || fail "$APP_DIR không phải git repo."
[ -d "$BACKEND_DIR" ]   || fail "Không thấy $BACKEND_DIR."
[ -f "$BACKEND_DIR/.env" ] || fail "Không thấy $BACKEND_DIR/.env."

command -v git  >/dev/null || fail "Thiếu git."
command -v php  >/dev/null || fail "Thiếu php."

cd "$APP_DIR"

CURRENT_SHA="$(git rev-parse HEAD)"
log "Commit hiện tại trên VPS: $(git log --oneline -1)"

# ──────────────────────────────────────────────────────────────────────────
# 2. Backup database trước khi làm bất cứ việc gì
# ──────────────────────────────────────────────────────────────────────────
# Đọc giá trị từ .env, bỏ dấu nháy và ký tự CR (file có thể có line ending CRLF).
env_get() {
    local key="$1"
    grep -E "^${key}=" "$BACKEND_DIR/.env" 2>/dev/null \
        | tail -1 \
        | cut -d= -f2- \
        | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//" \
        | tr -d '\r' || true
}

DB_DATABASE="$(env_get DB_DATABASE)"
DB_USERNAME="$(env_get DB_USERNAME)"
DB_PASSWORD="$(env_get DB_PASSWORD)"
DB_HOST="$(env_get DB_HOST)"
DB_PORT="$(env_get DB_PORT)"
: "${DB_HOST:=127.0.0.1}"
: "${DB_PORT:=3306}"

BACKUP_FILE=""
if command -v mysqldump >/dev/null && [ -n "$DB_DATABASE" ]; then
    mkdir -p "$BACKUP_DIR"
    BACKUP_FILE="$BACKUP_DIR/${DB_DATABASE}_$(date '+%Y%m%d_%H%M%S').sql.gz"
    log "==> Backup DB '$DB_DATABASE' → $BACKUP_FILE"

    DUMP_OPTS="--single-transaction --quick --routines --triggers --events --no-tablespaces"

    # Thử 2 cách, theo thứ tự ưu tiên:
    #   1) credential trong .env — mật khẩu truyền qua MYSQL_PWD chứ không đưa vào
    #      dòng lệnh, tránh lộ qua `ps aux`.
    #   2) quyền root qua unix socket, không credential. Đây là cách
    #      /usr/local/bin/namthuedu-db-backup.sh (đã chạy ổn định trên máy này)
    #      dùng; user trong .env chỉ có quyền đọc/ghi dữ liệu, không dump được.
    DUMP_OK=false
    if MYSQL_PWD="$DB_PASSWORD" mysqldump \
            --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USERNAME" \
            $DUMP_OPTS "$DB_DATABASE" 2>/tmp/mysqldump.err | gzip > "$BACKUP_FILE"; then
        DUMP_OK=true
    elif mysqldump $DUMP_OPTS "$DB_DATABASE" 2>>/tmp/mysqldump.err | gzip > "$BACKUP_FILE"; then
        DUMP_OK=true
        log "    (dùng quyền root qua socket)"
    fi

    if [ "$DUMP_OK" = true ]; then
        log "    Backup xong ($(du -h "$BACKUP_FILE" | cut -f1))"
    else
        rm -f "$BACKUP_FILE"
        BACKUP_FILE=""
        echo "[CẢNH BÁO] mysqldump thất bại:" >&2
        tail -5 /tmp/mysqldump.err >&2 || true
        # Không có migration đang chờ thì deploy vẫn an toàn khi thiếu backup.
        # Có migration mà không backup được thì dừng, vì migration không rollback được.
        if [ "$(cd "$BACKEND_DIR" && php artisan migrate:status 2>/dev/null | grep -c Pending || true)" -gt 0 ]; then
            fail "Có migration đang chờ nhưng không backup được DB. Dừng để tránh mất dữ liệu."
        fi
        echo "[CẢNH BÁO] Không có migration đang chờ nên vẫn tiếp tục deploy." >&2
    fi

    # Dọn backup cũ, giữ lại $KEEP_BACKUPS bản gần nhất.
    # Bọc trong `|| true`: khi thư mục chưa có file .sql.gz nào thì ls trả mã lỗi,
    # và `set -o pipefail` sẽ làm cả script dừng giữa đường.
    (ls -1t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | tail -n "+$((KEEP_BACKUPS + 1))" \
        | xargs -r rm -f) || true
else
    echo "[CẢNH BÁO] Bỏ qua backup (thiếu mysqldump hoặc DB_DATABASE)." >&2
fi

# ──────────────────────────────────────────────────────────────────────────
# 3. Lấy code mới
# ──────────────────────────────────────────────────────────────────────────
log "==> Lấy code từ origin/$BRANCH"
git fetch origin "$BRANCH"

TARGET_SHA="$(git rev-parse "origin/$BRANCH")"

if [ "$CURRENT_SHA" = "$TARGET_SHA" ]; then
    log "    Đã ở commit mới nhất, không cần pull."
    PULLED=false
else
    # --ff-only: fail rõ ràng nếu VPS đã phân nhánh, thay vì tạo merge commit
    # lạ trên server rồi lần sau không ai hiểu tại sao.
    git merge-base --is-ancestor HEAD "origin/$BRANCH" \
        || fail "VPS đã phân nhánh khỏi origin/$BRANCH. Cần xử lý tay, không tự merge."

    git pull --ff-only origin "$BRANCH"
    PULLED=true
    log "    Đã cập nhật: $(git log --oneline -1)"
fi

# ──────────────────────────────────────────────────────────────────────────
# 4. Dependencies — chỉ chạy khi composer.lock thực sự đổi
# ──────────────────────────────────────────────────────────────────────────
cd "$BACKEND_DIR"

if [ "$PULLED" = true ] \
   && git diff --name-only "$CURRENT_SHA" "$TARGET_SHA" \
      | grep -qE '^backend/composer\.(json|lock)$'; then
    log "==> composer.lock đổi → cài lại dependencies"
    COMPOSER_ALLOW_SUPERUSER=1 composer install \
        --no-dev --optimize-autoloader --no-interaction --prefer-dist
else
    log "==> composer.lock không đổi, bỏ qua composer install"
fi

# ──────────────────────────────────────────────────────────────────────────
# 5. Migration — chỉ chạy khi có migration đang chờ
# ──────────────────────────────────────────────────────────────────────────
PENDING="$(php artisan migrate:status 2>/dev/null | grep -c Pending || true)"
if [ "${PENDING:-0}" -gt 0 ]; then
    log "==> Có $PENDING migration đang chờ → chạy migrate"
    php artisan migrate --force
else
    log "==> Không có migration đang chờ"
fi

# ──────────────────────────────────────────────────────────────────────────
# 6. Cache
# ──────────────────────────────────────────────────────────────────────────
log "==> Dọn và nạp lại cache"
php artisan optimize:clear

php artisan config:cache
php artisan view:cache
# KHÔNG dùng route:cache: routes/api.php có route dạng closure
# (ví dụ Route::get('/health', function () {...})) mà Laravel không serialize
# được, route:cache sẽ throw LogicException và làm deploy fail.
php artisan route:clear

# ──────────────────────────────────────────────────────────────────────────
# 7. Quyền ghi cho web server
# ──────────────────────────────────────────────────────────────────────────
log "==> Đặt lại quyền storage/ và bootstrap/cache/"
chown -R www-data:www-data storage bootstrap/cache
chmod -R ug+rwX storage bootstrap/cache

# ──────────────────────────────────────────────────────────────────────────
# 8. Reload PHP-FPM (reload, không restart: không cắt request đang xử lý)
# ──────────────────────────────────────────────────────────────────────────
if command -v systemctl >/dev/null; then
    FPM_SERVICE="$(systemctl list-units --type=service --all 2>/dev/null \
        | grep -oE 'php[0-9.]+-fpm\.service' | head -1 || true)"
    if [ -n "$FPM_SERVICE" ]; then
        log "==> Reload $FPM_SERVICE"
        systemctl reload "$FPM_SERVICE" || systemctl restart "$FPM_SERVICE"
    else
        echo "[CẢNH BÁO] Không tìm thấy service php-fpm." >&2
    fi
fi

# ──────────────────────────────────────────────────────────────────────────
# 9. Health check — deploy chỉ tính là xong khi API trả lời
# ──────────────────────────────────────────────────────────────────────────
log "==> Health check $HEALTH_URL"
HEALTH_OK=false
for i in 1 2 3 4 5; do
    if curl -fsS --max-time 10 "$HEALTH_URL" | grep -q healthy; then
        HEALTH_OK=true
        break
    fi
    log "    Lần $i chưa được, chờ 3s..."
    sleep 3
done

if [ "$HEALTH_OK" != true ]; then
    echo "" >&2
    echo "[LỖI] API không phản hồi healthy sau khi deploy." >&2
    echo "      Commit trước khi deploy: $CURRENT_SHA" >&2
    echo "      Quay lại bản cũ:" >&2
    echo "        cd $APP_DIR && git reset --hard $CURRENT_SHA" >&2
    echo "        cd $BACKEND_DIR && php artisan optimize:clear && php artisan config:cache" >&2
    echo "        systemctl reload ${FPM_SERVICE:-php8.1-fpm}" >&2
    if [ -n "$BACKUP_FILE" ]; then
        echo "      Backup DB: $BACKUP_FILE" >&2
    fi
    echo "      Log Laravel: tail -50 $BACKEND_DIR/storage/logs/laravel.log" >&2
    exit 1
fi

log "==> Deploy backend xong: $(git -C "$APP_DIR" log --oneline -1)"
