/**
 * Chuẩn hoá datetime từ backend.
 *
 * Backend Laravel config timezone = UTC:
 * - ISO có Z / offset → parse đúng timezone đó
 * - MySQL "YYYY-MM-DD HH:mm:ss" (naive) → coi là UTC
 */
export function parseVNDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const raw = String(dateStr).trim();
  if (!raw) return null;

  // ISO đã có timezone (Z / ±HH:mm)
  if (/[zZ]$/.test(raw) || /[+-]\d{2}:\d{2}$/.test(raw)) {
    // Một số chỗ từng nối nhầm "+07:00" sau chữ Z → cắt phần thừa
    const cleaned = raw.replace(/([zZ])[+-]\d{2}:\d{2}$/, "$1");
    const d = new Date(cleaned);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // MySQL naive datetime → UTC (khớp app.php timezone)
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  // Bỏ microseconds thừa nếu > 3 chữ số để JS parse ổn định
  const noExtraFrac = normalized.replace(/\.(\d{3})\d+/, ".$1");
  const d = new Date(`${noExtraFrac}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Format date only: 13/07/2026 (theo giờ máy local, thường là VN). */
export function formatVNDate(dateStr: string | null | undefined): string {
  const d = parseVNDate(dateStr);
  if (!d) return "";
  return d.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

/** Format date + time: 13/07/2026 15:42 (giờ VN). */
export function formatVNDateTime(dateStr: string | null | undefined): string {
  const d = parseVNDate(dateStr);
  if (!d) return "";
  return d.toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Timestamp for sorting. */
export function getVNTimestamp(dateStr: string | null | undefined): number {
  const d = parseVNDate(dateStr);
  return d ? d.getTime() : 0;
}

/**
 * Đề tạo trong N ngày gần đây?
 * - Cho phép lệch timezone tối đa ~14h về phía "tương lai"
 *   (tránh mất badge khi datetime bị tag sai UTC/VN).
 */
export function isRecentlyCreated(
  dateStr: string | null | undefined,
  withinDays = 2,
): boolean {
  const d = parseVNDate(dateStr);
  if (!d) return false;

  const now = Date.now();
  const t = d.getTime();
  const maxFutureSkewMs = 14 * 60 * 60 * 1000; // 14h
  if (t > now + maxFutureSkewMs) return false;

  // Nếu hơi "tương lai" do lệch TZ → coi như vừa tạo
  const effective = Math.min(t, now);
  const ms = withinDays * 24 * 60 * 60 * 1000;
  return now - effective <= ms;
}

/**
 * Thời điểm có trong N giờ gần đây không?
 * Dùng cho badge "Mới giao" (1h) trên bài tập học viên.
 */
export function isWithinLastHours(
  dateStr: string | null | undefined,
  withinHours = 1,
): boolean {
  const d = parseVNDate(dateStr);
  if (!d) return false;
  const now = Date.now();
  const t = d.getTime();
  // Cho phép lệch TZ tối đa 2h về phía tương lai
  if (t > now + 2 * 60 * 60 * 1000) return false;
  const effective = Math.min(t, now);
  return now - effective <= withinHours * 60 * 60 * 1000;
}

