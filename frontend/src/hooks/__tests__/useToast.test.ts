/**
 * useToast — ngăn xếp toast dùng chung cho cả ba role.
 *
 * Bối cảnh: trước đây ngăn xếp không có giới hạn và không chống trùng, nên gọi
 * toast trong vòng lặp (giao nhiều đề, lưu nhiều mục) sẽ đẩy các thẻ tràn khỏi
 * màn hình. Bộ test này khoá lại hai hành vi đó.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast } from '../useToast';

describe('useToast — giới hạn số toast', () => {
  it('bắt đầu với ngăn xếp rỗng', () => {
    const { result } = renderHook(() => useToast());

    expect(result.current.toasts).toHaveLength(0);
  });

  it('giữ tối đa 3 toast cùng lúc', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.success('một');
      result.current.success('hai');
      result.current.success('ba');
      result.current.success('bốn');
      result.current.success('năm');
    });

    expect(result.current.toasts).toHaveLength(3);
  });

  /** Cái mới nhất phải còn — nó thường là cái người dùng đang chờ. */
  it('giữ 3 cái MỚI NHẤT, bỏ cái cũ nhất', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.info('một');
      result.current.info('hai');
      result.current.info('ba');
      result.current.info('bốn');
    });

    const messages = result.current.toasts.map((t) => t.message);
    expect(messages).toEqual(['hai', 'ba', 'bốn']);
    expect(messages).not.toContain('một');
  });
});

describe('useToast — chống trùng', () => {
  it('bỏ qua tin nhắn trùng cùng loại', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.error('Không tải được dữ liệu.');
      result.current.error('Không tải được dữ liệu.');
      result.current.error('Không tải được dữ liệu.');
    });

    expect(result.current.toasts).toHaveLength(1);
  });

  /** Cùng chữ nhưng khác loại là hai thông tin khác nhau — không gộp. */
  it('vẫn hiện khi trùng chữ nhưng khác loại', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.success('Đã lưu');
      result.current.warning('Đã lưu');
    });

    expect(result.current.toasts).toHaveLength(2);
  });

  it('cho hiện lại sau khi cái cũ đã được đóng', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.error('Lỗi mạng');
    });
    const firstId = result.current.toasts[0].id;

    act(() => {
      result.current.removeToast(firstId);
    });
    expect(result.current.toasts).toHaveLength(0);

    act(() => {
      result.current.error('Lỗi mạng');
    });
    expect(result.current.toasts).toHaveLength(1);
  });
});

describe('useToast — bốn loại toast', () => {
  it('gán đúng type cho từng hàm', () => {
    const { result } = renderHook(() => useToast());

    // Chữ khác nhau để không bị chống trùng gộp lại.
    act(() => {
      result.current.success('a');
      result.current.error('b');
      result.current.warning('c');
    });

    // Chỉ 3 cái được giữ, nên kiểm 3 loại một lượt.
    expect(result.current.toasts.map((t) => t.type)).toEqual([
      'success',
      'error',
      'warning',
    ]);
  });

  it('truyền duration khi được chỉ định', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.success('có duration', 8000);
    });

    expect(result.current.toasts[0].duration).toBe(8000);
  });

  /** Mặc định phải khớp với `Toast` component, nếu không thanh tiến trình lệch. */
  it('mặc định duration 3000ms', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.info('không duration');
    });

    expect(result.current.toasts[0].duration).toBe(3000);
  });
});

describe('useToast — removeToast', () => {
  it('chỉ xoá đúng toast theo id', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.success('giữ lại');
      result.current.error('xoá đi');
    });

    const target = result.current.toasts.find((t) => t.message === 'xoá đi')!;
    act(() => {
      result.current.removeToast(target.id);
    });

    expect(result.current.toasts.map((t) => t.message)).toEqual(['giữ lại']);
  });
});
