/**
 * useRealtimeAssignedTests — đề vừa giao phải tự hiện, không cần F5.
 *
 * Bài toán gốc: chuông thông báo poll 10s nên học viên NHẬN được "Bài thi mới
 * được giao" gần như ngay, còn danh sách đề thì đứng im vì useQuery không có
 * refetchInterval. Test ở đây khoá ba đường cập nhật và các cạnh dễ vỡ:
 * listener phải được gỡ khi unmount, và lần render đầu KHÔNG được broadcast.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useRealtimeAssignedTests,
  broadcastAssignmentsChanged,
  assignedTestsQueryOptions,
  ASSIGNED_TESTS_POLL_MS,
} from '../useRealtimeAssignedTests';

const invalidateQueries = vi.fn();

// QueryClient thật do react-query cung cấp là MỘT instance ổn định suốt vòng đời
// app. Mock phải giữ đúng tính chất đó: nếu trả object literal mới mỗi lần gọi
// thì deps của useEffect đổi theo từng render, và test "không gắn lại listener"
// sẽ thất bại vì lỗi của mock chứ không phải của hook.
const fakeQueryClient = { invalidateQueries };

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => fakeQueryClient,
}));

/** Bắt các listener mà hook gắn vào serviceWorker để phát message giả. */
type Listener = (e: MessageEvent) => void;
let swListeners: Listener[] = [];
let swRemoved: Listener[] = [];

/** BroadcastChannel giả: chia sẻ listener theo tên channel giữa các instance. */
const channelListeners = new Map<string, Set<Listener>>();
let closedChannels = 0;

class FakeBroadcastChannel {
  private listeners: Set<Listener>;
  constructor(public name: string) {
    if (!channelListeners.has(name)) channelListeners.set(name, new Set());
    this.listeners = channelListeners.get(name)!;
  }
  addEventListener(_: string, fn: Listener) { this.listeners.add(fn); }
  removeEventListener(_: string, fn: Listener) { this.listeners.delete(fn); }
  postMessage(data: unknown) {
    this.listeners.forEach((fn) => fn({ data } as MessageEvent));
  }
  close() { closedChannels++; }
}

beforeEach(() => {
  invalidateQueries.mockClear();
  swListeners = [];
  swRemoved = [];
  channelListeners.clear();
  closedChannels = 0;

  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      addEventListener: (_: string, fn: Listener) => { swListeners.push(fn); },
      removeEventListener: (_: string, fn: Listener) => { swRemoved.push(fn); },
    },
  });

  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const KEY = ['student', 'tests', 'teens-assigned'];

function emitPush(type: string) {
  act(() => {
    swListeners.forEach((fn) => fn({ data: { type } } as MessageEvent));
  });
}

function emitChannel(type: string) {
  act(() => {
    channelListeners.get('student-assignments')?.forEach((fn) =>
      fn({ data: { type } } as MessageEvent));
  });
}

describe('useRealtimeAssignedTests', () => {
  it('push notification làm mới danh sách ngay', () => {
    renderHook(() => useRealtimeAssignedTests(KEY));
    emitPush('NEW_NOTIFICATION');

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: KEY });
  });

  it('bỏ qua push không liên quan', () => {
    renderHook(() => useRealtimeAssignedTests(KEY));
    emitPush('SOMETHING_ELSE');

    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it('tab khác báo assignments_changed thì làm mới', () => {
    renderHook(() => useRealtimeAssignedTests(KEY));
    emitChannel('assignments_changed');

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: KEY });
  });

  it('bỏ qua message lạ trên channel', () => {
    renderHook(() => useRealtimeAssignedTests(KEY));
    emitChannel('comment_changed');

    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  /**
   * Rời trang xong mà listener còn sống thì mỗi lần điều hướng lại tích thêm
   * một listener — rò rỉ, và invalidate cho query đã không còn dùng.
   */
  it('gỡ listener khi unmount', () => {
    const { unmount } = renderHook(() => useRealtimeAssignedTests(KEY));
    unmount();

    expect(swRemoved).toHaveLength(swListeners.length);
    expect(closedChannels).toBeGreaterThan(0);
  });

  /**
   * queryKey là mảng mới mỗi lần render. Nếu đưa thẳng vào deps của useEffect
   * thì listener bị gỡ/gắn liên tục — hook phải so sánh theo giá trị.
   */
  it('không gắn lại listener khi re-render với key cùng giá trị', () => {
    const { rerender } = renderHook(() =>
      useRealtimeAssignedTests(['student', 'tests', 'teens-assigned']));
    const countAfterMount = swListeners.length;

    rerender();
    rerender();

    expect(swListeners).toHaveLength(countAfterMount);
  });

  it('dùng key mới nhất sau khi key đổi', () => {
    const { rerender } = renderHook(
      ({ k }: { k: string[] }) => useRealtimeAssignedTests(k),
      { initialProps: { k: ['student', 'tests', 'all'] } },
    );

    rerender({ k: ['student', 'tests', 'pending'] });
    emitPush('NEW_NOTIFICATION');

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['student', 'tests', 'pending'],
    });
  });
});

describe('broadcastAssignmentsChanged', () => {
  it('gửi được cho tab đang lắng nghe', () => {
    const received: unknown[] = [];
    const ch = new FakeBroadcastChannel('student-assignments');
    ch.addEventListener('message', (e) => received.push(e.data));

    broadcastAssignmentsChanged();

    expect(received).toEqual([{ type: 'assignments_changed' }]);
  });

  /**
   * Một số trình duyệt ở chế độ riêng tư chặn BroadcastChannel. Khi đó lớp poll
   * vẫn phải hoạt động, nên hàm này tuyệt đối không được ném lỗi.
   */
  it('không ném lỗi khi trình duyệt không hỗ trợ', () => {
    vi.stubGlobal('BroadcastChannel', undefined);

    expect(() => broadcastAssignmentsChanged()).not.toThrow();
  });
});

describe('assignedTestsQueryOptions', () => {
  it('có poll định kỳ — đây là lưới an toàn khi không có push', () => {
    expect(assignedTestsQueryOptions.refetchInterval).toBe(ASSIGNED_TESTS_POLL_MS);
    expect(ASSIGNED_TESTS_POLL_MS).toBeGreaterThan(0);
  });

  /** Tab nền không được tiêu tốn request. */
  it('không poll khi tab ở nền', () => {
    expect(assignedTestsQueryOptions.refetchIntervalInBackground).toBe(false);
  });

  it('làm mới khi học viên quay lại tab hoặc có lại mạng', () => {
    expect(assignedTestsQueryOptions.refetchOnWindowFocus).toBe(true);
    expect(assignedTestsQueryOptions.refetchOnReconnect).toBe(true);
  });
});
