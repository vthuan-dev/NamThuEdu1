/**
 * Chuẩn hoá datetime từ backend (MySQL "YYYY-MM-DD HH:mm:ss" hoặc ISO).
 * Trả về Date hợp lệ hoặc null.
 */
export function parseVNDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const raw = String(dateStr).trim();
  if (!raw) return null;

  // ISO đã có timezone (Z / +07:00 / -05:00) → parse trực tiếp
  if (/[zZ]$/.test(raw) || /[+-]\d{2}:\d{2}$/.test(raw)) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // MySQL datetime không timezone → coi là giờ VN (+07:00)
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const d = new Date(`${normalized}+07:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Format date only: 13/07/2026
 */
export function formatVNDate(dateStr: string | null | undefined): string {
  const d = parseVNDate(dateStr);
  if (!d) return "";
  return d.toLocaleDateString("vi-VN");
}

/**
 * Format date + time: 13/07/2026 15:42
 */
export function formatVNDateTime(dateStr: string | null | undefined): string {
  const d = parseVNDate(dateStr);
  if (!d) return "";
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Timestamp for sorting.
 */
export function getVNTimestamp(dateStr: string | null | undefined): number {
  const d = parseVNDate(dateStr);
  return d ? d.getTime() : 0;
}

/**
 * Đề tạo trong N ngày gần đây?
 */
export function isRecentlyCreated(
  dateStr: string | null | undefined,
  withinDays = 2,
): boolean {
  const d = parseVNDate(dateStr);
  if (!d) return false;
  const ms = withinDays * 24 * 60 * 60 * 1000;
  const delta = Date.now() - d.getTime();
  return delta <= ms && delta >= -60_000;
}
