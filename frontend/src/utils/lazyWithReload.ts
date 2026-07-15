import { lazy, type ComponentType } from 'react';

/**
 * Bọc React.lazy để xử lý lỗi "Failed to fetch dynamically imported module".
 *
 * Sau khi deploy build mới, các file chunk có hash mới (tên khác); trình duyệt
 * đang giữ index.html cũ (cache) vẫn trỏ tới chunk cũ đã bị xóa khỏi server →
 * dynamic import trả 404. Đây là lỗi deploy/cache, không phải bug logic.
 *
 * Cách xử lý: khi import lỗi do chunk không tải được, tự reload trang MỘT LẦN
 * để lấy index.html + chunk mới. Dùng sessionStorage làm guard tránh reload lặp
 * vô hạn nếu lỗi do nguyên nhân khác (mất mạng, lỗi runtime trong module...).
 */
export function lazyWithReload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    const KEY = 'chunk-reload-ts';
    try {
      const mod = await factory();
      // Import thành công → xóa guard để lần deploy sau vẫn được reload 1 lần.
      sessionStorage.removeItem(KEY);
      return mod;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isChunkError =
        /Failed to fetch dynamically imported module/i.test(message) ||
        /error loading dynamically imported module/i.test(message) ||
        /Importing a module script failed/i.test(message);

      if (isChunkError) {
        const last = Number(sessionStorage.getItem(KEY) || 0);
        const now = Date.now();
        // Chỉ reload nếu chưa reload trong 10s gần đây (chống lặp vô hạn).
        if (now - last > 10_000) {
          sessionStorage.setItem(KEY, String(now));
          window.location.reload();
          // Trả về Promise không bao giờ resolve để React giữ fallback tới khi trang reload.
          return new Promise<{ default: T }>(() => {});
        }
      }
      // Không phải lỗi chunk, hoặc vừa reload xong mà vẫn lỗi → ném lại cho ErrorBoundary.
      throw err;
    }
  });
}
