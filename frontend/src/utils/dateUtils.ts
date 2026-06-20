/**
 * Format a MySQL datetime string ("2026-06-20 18:57:13") to vi-VN locale date.
 * Appends +07:00 (Asia/Ho_Chi_Minh) to ensure correct date regardless of browser timezone.
 */
export function formatVNDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const normalized = dateStr.replace(" ", "T") + "+07:00";
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("vi-VN");
}

/**
 * Same as formatVNDate but returns the timestamp for sorting.
 */
export function getVNTimestamp(dateStr: string | null | undefined): number {
  if (!dateStr) return 0;
  const normalized = dateStr.replace(" ", "T") + "+07:00";
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}
