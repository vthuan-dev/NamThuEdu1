/**
 * useRealtimeAssignedTests — giữ danh sách đề được giao luôn tươi.
 *
 * Vấn đề nó giải quyết: chuông thông báo poll 10 giây nên học viên NHẬN được
 * "Bài thi mới được giao" gần như tức thì, nhưng trang Bài tập lại dùng useQuery
 * không có refetchInterval — danh sách đứng im cho tới khi F5. Kết quả là thông
 * báo nói có đề mới trong khi khung bên dưới vẫn trống, một nghịch lý khó chịu
 * hơn cả việc không có thông báo.
 *
 * Ba lớp cập nhật, xếp từ nhanh nhất tới chậm nhất:
 *
 *  1. Push notification: service worker phát `NEW_NOTIFICATION` khi có push tới.
 *     Đây là đường nhanh nhất — gần như tức thì, cùng cơ chế mà
 *     NotificationDropdown đang dùng để cập nhật badge.
 *  2. BroadcastChannel: một tab khác cùng origin vừa refetch và thấy đề mới thì
 *     báo sang các tab còn lại, tránh mỗi tab tự chờ hết chu kỳ poll.
 *  3. Poll định kỳ: lưới an toàn cho trường hợp học viên chưa cấp quyền push
 *     (rất phổ biến trên iOS Safari). `refetchIntervalInBackground: false` nên
 *     tab nền không tốn request.
 *
 * Cố ý KHÔNG dùng WebSocket: `TestWebSocketService.php` có trong repo nhưng
 * không được nối vào luồng giao đề, nên thêm vào đây sẽ là hạ tầng chết.
 */
import { useEffect, useRef } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';

/** Tên channel dùng chung giữa các tab. */
const CHANNEL = 'student-assignments';

/**
 * Chu kỳ poll (ms). Chọn 20 giây: nhanh hơn nhiều so với việc chờ học viên F5,
 * nhưng không dồn dập như chuông (10 giây) — danh sách đề nặng hơn payload
 * thông báo, và trễ 20 giây là hoàn toàn chấp nhận được với việc giao đề.
 */
export const ASSIGNED_TESTS_POLL_MS = 20_000;

/** Query options dùng chung cho mọi trang danh sách đề được giao. */
export const assignedTestsQueryOptions = {
  refetchInterval: ASSIGNED_TESTS_POLL_MS,
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  staleTime: 0,
} as const;

/**
 * Lắng nghe push + BroadcastChannel để invalidate `queryKey` ngay khi có đề mới.
 *
 * @param queryKey Query cần làm mới (ví dụ `['student','tests','teens-assigned']`).
 */
export function useRealtimeAssignedTests(queryKey: QueryKey): void {
  const queryClient = useQueryClient();

  // queryKey là mảng mới mỗi lần render nên không thể đưa trực tiếp vào deps —
  // sẽ gỡ/gắn listener liên tục. Serialise để so sánh theo giá trị.
  const keyRef = useRef(queryKey);
  keyRef.current = queryKey;
  const keyId = JSON.stringify(queryKey);

  useEffect(() => {
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: keyRef.current });
    };

    // ── 1. Push từ service worker ──────────────────────────────────────────
    const onSwMessage = (e: MessageEvent) => {
      if (e.data?.type === 'NEW_NOTIFICATION') invalidate();
    };
    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', onSwMessage);
    }

    // ── 2. Tab khác báo sang ───────────────────────────────────────────────
    let channel: BroadcastChannel | null = null;
    const onChannelMessage = (e: MessageEvent) => {
      if (e.data?.type === 'assignments_changed') invalidate();
    };
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(CHANNEL);
      channel.addEventListener('message', onChannelMessage);
    }

    return () => {
      if (navigator.serviceWorker) {
        navigator.serviceWorker.removeEventListener('message', onSwMessage);
      }
      if (channel) {
        channel.removeEventListener('message', onChannelMessage);
        channel.close();
      }
    };
  }, [queryClient, keyId]);
}

/**
 * Báo cho các tab khác rằng danh sách đề vừa đổi.
 *
 * Gọi khi tab hiện tại phát hiện đề mới, để tab đang mở ở nền không phải chờ
 * hết chu kỳ poll của chính nó.
 */
export function broadcastAssignmentsChanged(): void {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    const ch = new BroadcastChannel(CHANNEL);
    ch.postMessage({ type: 'assignments_changed' });
    ch.close();
  } catch {
    // Trình duyệt chặn BroadcastChannel (chế độ riêng tư ở một số bản) —
    // bỏ qua, lớp poll vẫn hoạt động.
  }
}
