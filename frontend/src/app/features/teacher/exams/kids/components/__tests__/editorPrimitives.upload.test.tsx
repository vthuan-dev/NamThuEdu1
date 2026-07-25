import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImageUpload } from '../editorPrimitives';
import { uploadKidsMedia } from '@/services/kidsExamApi';

vi.mock('@/services/kidsExamApi', () => ({
  uploadKidsMedia: vi.fn(),
}));

const mockUpload = uploadKidsMedia as unknown as ReturnType<typeof vi.fn>;

/**
 * Regression: "không up ảnh lên được" ở Sắp xếp từ (R&W Part 3) và các khung
 * ảnh nhỏ phần Nói.
 *
 * Backend trả { message, media: { url } } — KHÔNG có `url` top-level. Trước fix
 * hook chỉ đọc `res.url` → undefined → onChange không bao giờ được gọi → bấm
 * tải ảnh mà không có gì xảy ra.
 */
describe('ImageUpload — đọc đúng url từ response upload', () => {
  beforeEach(() => vi.clearAllMocks());

  it('gọi onChange với url lấy từ response.media.url', async () => {
    mockUpload.mockResolvedValue({
      message: 'Media uploaded successfully',
      media: { id: 9, url: 'https://cdn.test/kids-exams/images/cat.png', type: 'image' },
    });

    const onChange = vi.fn();
    render(<ImageUpload value="" onChange={onChange} examId={12} size="sm" />);

    const file = new File(['x'], 'cat.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, file);

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith('https://cdn.test/kids-exams/images/cat.png'),
    );
  });

  it('vẫn hoạt động nếu backend trả url ở top-level (tương thích ngược)', async () => {
    mockUpload.mockResolvedValue({ url: 'https://cdn.test/a.png' });

    const onChange = vi.fn();
    render(<ImageUpload value="" onChange={onChange} examId={12} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, new File(['x'], 'a.png', { type: 'image/png' }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('https://cdn.test/a.png'));
  });

  it('không gọi onChange và cảnh báo khi response thiếu url', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockUpload.mockResolvedValue({ message: 'ok' });

    const onChange = vi.fn();
    render(<ImageUpload value="" onChange={onChange} examId={12} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, new File(['x'], 'a.png', { type: 'image/png' }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(onChange).not.toHaveBeenCalled();

    alertSpy.mockRestore();
    errSpy.mockRestore();
  });

  it('hiện ảnh và nút xóa khi đã có value', () => {
    render(<ImageUpload value="https://cdn.test/a.png" onChange={() => {}} examId={1} />);
    expect(screen.getByRole('button', { name: /Xóa ảnh/i })).toBeInTheDocument();
  });
});
