/**
 * NotificationDropdown — chuông thông báo dùng chung cho cả ba layout học viên.
 *
 * Bộ test này khoá lại các lỗi khiến học viên dùng điện thoại không xem được
 * thông báo: chuông bị ẩn dưới breakpoint, và không có đường nào tới trang
 * thông báo đầy đủ khi có hơn 10 tin.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NotificationDropdown } from '../NotificationDropdown';

const getNotifications = vi.fn();

vi.mock('../../../../services/studentApi', () => ({
  studentApi: {
    getNotifications: (...args: any[]) => getNotifications(...args),
    markNotificationRead: vi.fn().mockResolvedValue({}),
    markAllNotificationsRead: vi.fn().mockResolvedValue({}),
    deleteNotification: vi.fn().mockResolvedValue({}),
  },
}));

// Popup chi tiết lịch thi không liên quan tới test này và kéo theo nhiều phụ thuộc.
vi.mock('../ExamScheduleDetailPopup', () => ({
  ExamScheduleDetailPopup: () => null,
}));

function makeResponse(notifications: any[], unreadCount = 0) {
  return { data: { data: { notifications, unread_count: unreadCount } } };
}

function renderDropdown() {
  // retry: false — nếu không, query thất bại sẽ thử lại và test treo.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <NotificationDropdown />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  // jsdom không hiện thực HTMLMediaElement.play(), nó trả về undefined nên
  // `a.play().catch(...)` trong component ném TypeError. Stub để trả promise.
  // Đây là thiếu sót của môi trường test, không phải lỗi của sản phẩm.
  vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);

  getNotifications.mockReset();
  getNotifications.mockResolvedValue(makeResponse([]));
});

describe('NotificationDropdown — nút chuông', () => {
  it('luôn render nút chuông', async () => {
    renderDropdown();

    expect(
      await screen.findByRole('button', { name: 'Thông báo' })
    ).toBeInTheDocument();
  });

  /**
   * Nút chuông không được có class ẩn theo breakpoint.
   *
   * Đây chính là lỗi trong TeensLayout: chuông bọc trong `hidden sm:block` nên
   * mất trên mọi điện thoại. jsdom không áp dụng breakpoint Tailwind nên không
   * thể kiểm bằng cách xem nó có hiện hay không — phải kiểm chuỗi class.
   */
  it('nút chuông không bị ẩn bằng class breakpoint', async () => {
    renderDropdown();

    const bell = await screen.findByRole('button', { name: 'Thông báo' });
    expect(bell.className).not.toMatch(/\bhidden\b/);
  });

  it('đạt kích thước bấm tối thiểu', async () => {
    renderDropdown();

    const bell = await screen.findByRole('button', { name: 'Thông báo' });
    // p-2 quanh icon w-5 h-5 => 20 + 16 = 36px. Chấp nhận vì icon còn nằm trong
    // hàng header cao 64px, nhưng phải có padding chứ không được sát viền.
    expect(bell.className).toMatch(/p-2/);
  });
});

describe('NotificationDropdown — badge số chưa đọc', () => {
  it('hiện số khi có tin chưa đọc', async () => {
    getNotifications.mockResolvedValue(makeResponse([], 5));

    renderDropdown();

    expect(await screen.findByText('5')).toBeInTheDocument();
  });

  it('không hiện badge khi đã đọc hết', async () => {
    getNotifications.mockResolvedValue(makeResponse([], 0));

    renderDropdown();
    await screen.findByRole('button', { name: 'Thông báo' });

    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('rút gọn thành 99+ khi quá lớn', async () => {
    getNotifications.mockResolvedValue(makeResponse([], 150));

    renderDropdown();

    expect(await screen.findByText('99+')).toBeInTheDocument();
  });
});

describe('NotificationDropdown — đường tới trang thông báo đầy đủ', () => {
  /**
   * Dropdown chỉ nạp `limit: 10`. Không có link này thì tin thứ 11 trở đi không
   * có cách nào xem được, ở cả ba nhóm tuổi.
   */
  it('có link "Xem tất cả" trỏ đúng trang thông báo', async () => {
    renderDropdown();

    const bell = await screen.findByRole('button', { name: 'Thông báo' });
    fireEvent.click(bell);

    const link = await screen.findByRole('link', { name: /Xem tất cả thông báo/ });
    expect(link).toHaveAttribute('href', '/hoc-vien/thong-bao');
  });

  it('vẫn có link khi danh sách rỗng', async () => {
    getNotifications.mockResolvedValue(makeResponse([]));

    renderDropdown();
    const bell = await screen.findByRole('button', { name: 'Thông báo' });
    fireEvent.click(bell);

    // Người dùng mở chuông thấy trống vẫn cần đường vào trang đầy đủ để lọc
    // theo loại hoặc kiểm lại tin cũ đã đọc.
    expect(
      await screen.findByRole('link', { name: /Xem tất cả thông báo/ })
    ).toBeInTheDocument();
  });
});

describe('NotificationDropdown — chỉ nạp 10 tin', () => {
  it('gọi API với limit 10', async () => {
    renderDropdown();
    await screen.findByRole('button', { name: 'Thông báo' });

    expect(getNotifications).toHaveBeenCalledWith({ limit: 10 });
  });
});

describe('NotificationDropdown — danh sách', () => {
  it('hiện tiêu đề của các thông báo', async () => {
    getNotifications.mockResolvedValue(
      makeResponse(
        [
          {
            id: 1,
            type: 'exam_graded',
            title: 'Đã có điểm bài thi',
            message: 'Giáo viên vừa chấm xong.',
            is_read: false,
            created_at: new Date().toISOString(),
          },
        ],
        1
      )
    );

    renderDropdown();
    const bell = await screen.findByRole('button', { name: 'Thông báo' });
    fireEvent.click(bell);

    expect(await screen.findByText('Đã có điểm bài thi')).toBeInTheDocument();
  });
});
