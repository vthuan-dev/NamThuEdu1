import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfirmProvider, useConfirm } from '../ConfirmContext';

/**
 * Nút bấm gọi confirm rồi ghi kết quả ra màn hình, để test đọc được giá trị mà
 * promise trả về — đó là phần dễ sai nhất khi thay window.confirm.
 */
function Harness({ onResult }: { onResult?: (v: boolean) => void }) {
  const confirm = useConfirm();
  return (
    <button
      onClick={async () => {
        const ok = await confirm({
          title: 'Nộp bài thi?',
          message: 'Sau khi nộp sẽ không sửa được.',
          tone: 'submit',
        });
        onResult?.(ok);
      }}
    >
      Mở hộp thoại
    </button>
  );
}

function renderHarness(onResult?: (v: boolean) => void) {
  return render(
    <ConfirmProvider>
      <Harness onResult={onResult} />
    </ConfirmProvider>
  );
}

describe('ConfirmDialog', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  it('không hiển thị gì cho tới khi được gọi', () => {
    renderHarness();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('hiện tiêu đề và nội dung khi được gọi', async () => {
    renderHarness();
    fireEvent.click(screen.getByText('Mở hộp thoại'));

    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Nộp bài thi?')).toBeTruthy();
    expect(screen.getByText('Sau khi nộp sẽ không sửa được.')).toBeTruthy();
  });

  it('trả true khi bấm nút xác nhận', async () => {
    const onResult = vi.fn();
    renderHarness(onResult);
    fireEvent.click(screen.getByText('Mở hộp thoại'));

    // Nhãn mặc định của tone 'submit'.
    fireEvent.click(await screen.findByRole('button', { name: 'Nộp bài' }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
  });

  it('trả false khi bấm huỷ', async () => {
    const onResult = vi.fn();
    renderHarness(onResult);
    fireEvent.click(screen.getByText('Mở hộp thoại'));
    await screen.findByRole('dialog');

    fireEvent.click(screen.getByRole('button', { name: 'Huỷ' }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });

  /**
   * Bấm ra ngoài phải tương đương huỷ, không được để promise treo — nếu treo thì
   * chỗ gọi đứng im mãi và người dùng tưởng hệ thống chết.
   */
  it('bấm lớp nền cũng trả false', async () => {
    const onResult = vi.fn();
    const { container } = renderHarness(onResult);
    fireEvent.click(screen.getByText('Mở hộp thoại'));
    await screen.findByRole('dialog');

    const backdrop = container.querySelector('.absolute.inset-0');
    fireEvent.click(backdrop!);
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });

  it('Escape trả false', async () => {
    const onResult = vi.fn();
    renderHarness(onResult);
    fireEvent.click(screen.getByText('Mở hộp thoại'));
    await screen.findByRole('dialog');

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });

  it('đóng lại sau khi trả lời', async () => {
    renderHarness();
    fireEvent.click(screen.getByText('Mở hộp thoại'));
    await screen.findByRole('dialog');

    fireEvent.click(screen.getByRole('button', { name: 'Huỷ' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  /**
   * window.confirm chặn cuộn trang sẵn. Hộp tự vẽ thì phải tự làm, thiếu thì
   * trên iOS cuộn trong hộp thoại sẽ xuyên xuống trang dưới.
   */
  it('chặn cuộn trang nền khi mở và trả lại khi đóng', async () => {
    renderHarness();
    fireEvent.click(screen.getByText('Mở hộp thoại'));
    await screen.findByRole('dialog');
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.click(screen.getByRole('button', { name: 'Huỷ' }));
    await waitFor(() => expect(document.body.style.overflow).not.toBe('hidden'));
  });

  it('hiện ô nhấn mạnh khi có highlight', async () => {
    function H() {
      const confirm = useConfirm();
      return (
        <button
          onClick={() =>
            confirm({
              title: 'Làm lại từ đầu?',
              tone: 'danger',
              highlight: 'Toàn bộ câu trả lời của phiên này sẽ bị xoá.',
            })
          }
        >
          Mở
        </button>
      );
    }
    render(
      <ConfirmProvider>
        <H />
      </ConfirmProvider>
    );
    fireEvent.click(screen.getByText('Mở'));

    expect(
      await screen.findByText('Toàn bộ câu trả lời của phiên này sẽ bị xoá.')
    ).toBeTruthy();
  });

  it('dùng nhãn nút do chỗ gọi đặt', async () => {
    function H() {
      const confirm = useConfirm();
      return (
        <button
          onClick={() =>
            confirm({
              title: 'Làm lại từ đầu?',
              confirmLabel: 'Huỷ và làm lại',
              cancelLabel: 'Giữ phiên này',
            })
          }
        >
          Mở
        </button>
      );
    }
    render(
      <ConfirmProvider>
        <H />
      </ConfirmProvider>
    );
    fireEvent.click(screen.getByText('Mở'));

    expect(await screen.findByRole('button', { name: 'Huỷ và làm lại' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Giữ phiên này' })).toBeTruthy();
  });

  /**
   * Nếu chỗ khác gọi confirm khi đang có hộp thoại mở, promise cũ phải được giải
   * quyết chứ không treo vĩnh viễn.
   */
  it('giải quyết promise cũ bằng false khi có lời gọi mới', async () => {
    const results: boolean[] = [];
    function H() {
      const confirm = useConfirm();
      return (
        <>
          <button onClick={async () => results.push(await confirm({ title: 'Hộp thứ nhất' }))}>
            Gọi lần một
          </button>
          <button onClick={async () => results.push(await confirm({ title: 'Hộp thứ hai' }))}>
            Gọi lần hai
          </button>
        </>
      );
    }
    render(
      <ConfirmProvider>
        <H />
      </ConfirmProvider>
    );

    fireEvent.click(screen.getByText('Gọi lần một'));
    await screen.findByText('Hộp thứ nhất');
    fireEvent.click(screen.getByText('Gọi lần hai'));

    await waitFor(() => expect(results).toContain(false));
    expect(await screen.findByText('Hộp thứ hai')).toBeTruthy();
  });

  it('useConfirm báo lỗi khi dùng ngoài provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Harness />)).toThrow(/ConfirmProvider/);
    spy.mockRestore();
  });
});
