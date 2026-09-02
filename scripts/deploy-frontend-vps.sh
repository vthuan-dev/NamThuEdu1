#!/usr/bin/env bash
#
# Giải nén bundle frontend (đã scp lên) vào web root, swap nguyên tử, reload nginx.
#
# Script này được GitHub Actions (.github/workflows/deploy-frontend.yml) scp lên
# VPS rồi chạy. Trước đây workflow gọi /var/www/namthuedu-fe/deploy-fe.sh — một
# file chỉ tồn tại trên VPS, không version control. Backend từng có đúng lỗ hổng
# đó: file mất ngày 30/08 và deploy backend fail im lặng 3 ngày. Đưa script vào
# repo để frontend không lặp lại.
#
set -euo pipefail

FE_DIR="/var/www/namthuedu-fe"
SITE_URL="https://namthuedu.vn/"

log()  { echo "[$(date '+%H:%M:%S')] $*"; }
fail() { echo "[LỖI] $*" >&2; exit 1; }

cd "$FE_DIR" || fail "Không thấy $FE_DIR."

[ -f dist.tar.gz ] || fail "Không thấy dist.tar.gz trong $FE_DIR. Bước scp có chạy chưa?"

# ──────────────────────────────────────────────────────────────────────────
# 1. Giải nén ra thư mục tạm, kiểm tra trước khi swap
# ──────────────────────────────────────────────────────────────────────────
log "==> Giải nén bundle"
rm -rf dist_new
mkdir -p dist_new
tar -xzf dist.tar.gz -C dist_new

# Bundle thiếu index.html là hỏng — phát hiện TRƯỚC khi swap, để web root cũ
# vẫn còn nguyên thay vì thay bằng thư mục rỗng rồi site trắng trang.
[ -f dist_new/index.html ] || fail "Bundle không có index.html. Huỷ deploy, giữ bản cũ."

ASSET_COUNT="$(find dist_new -type f | wc -l)"
[ "$ASSET_COUNT" -gt 1 ] || fail "Bundle chỉ có $ASSET_COUNT file. Nghi giải nén lỗi, huỷ deploy."
log "    $ASSET_COUNT file, có index.html"

# ──────────────────────────────────────────────────────────────────────────
# 2. Swap nguyên tử
# ──────────────────────────────────────────────────────────────────────────
log "==> Swap web root"
rm -rf dist_old
if [ -d dist ]; then
    mv dist dist_old
fi
mv dist_new dist

chown -R www-data:www-data dist
rm -f dist.tar.gz

# ──────────────────────────────────────────────────────────────────────────
# 3. Reload nginx (chỉ khi config còn hợp lệ)
# ──────────────────────────────────────────────────────────────────────────
log "==> Kiểm tra config nginx và reload"
nginx -t
systemctl reload nginx

# ──────────────────────────────────────────────────────────────────────────
# 4. Health check — tự rollback nếu site không lên
# ──────────────────────────────────────────────────────────────────────────
log "==> Health check $SITE_URL"
OK=false
for i in 1 2 3 4 5; do
    CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$SITE_URL" || echo 000)"
    if [ "$CODE" = "200" ]; then
        OK=true
        break
    fi
    log "    Lần $i: HTTP $CODE, chờ 3s..."
    sleep 3
done

if [ "$OK" != true ]; then
    echo "[LỖI] Site không trả HTTP 200 sau khi deploy." >&2
    if [ -d dist_old ]; then
        echo "      Đang tự động quay lại bản cũ..." >&2
        rm -rf dist_broken
        mv dist dist_broken
        mv dist_old dist
        chown -R www-data:www-data dist
        systemctl reload nginx
        echo "      Đã rollback. Bundle lỗi giữ ở $FE_DIR/dist_broken để xem lại." >&2
    else
        echo "      Không có dist_old để rollback." >&2
    fi
    exit 1
fi

log "==> Frontend deploy xong"
