/**
 * isExamTakingPath — quyết định layout có tắt chrome hay không.
 *
 * Sai ở đây gây hậu quả hai chiều: bỏ sót route thi thì header vẫn đè lên trang
 * làm bài trên mobile; khớp quá rộng thì học viên mất điều hướng ở trang bình
 * thường.
 */
import { describe, it, expect } from 'vitest';
import { isExamTakingPath } from './examRoutes';

describe('isExamTakingPath', () => {
  it('nhận đúng trang làm bài THPT — route trong ảnh học viên báo lỗi', () => {
    expect(isExamTakingPath('/hoc-vien/lam-bai-thpt/163')).toBe(true);
  });

  it('nhận đúng trang làm bài teens thường', () => {
    expect(isExamTakingPath('/hoc-vien/lam-bai/77')).toBe(true);
  });

  it('nhận đúng VSTEP và IELTS', () => {
    expect(isExamTakingPath('/hoc-vien/lam-bai-vstep/12')).toBe(true);
    expect(isExamTakingPath('/hoc-vien/lam-bai-ielts/12')).toBe(true);
  });

  /** IELTS có route con theo kỹ năng — không được bỏ sót. */
  it('nhận đúng route con theo kỹ năng của IELTS', () => {
    expect(isExamTakingPath('/hoc-vien/lam-bai-ielts/12/listening')).toBe(true);
    expect(isExamTakingPath('/hoc-vien/lam-bai-ielts/12/writing')).toBe(true);
  });

  /**
   * Phòng chờ CỐ Ý không tính là đang làm bài: học viên chưa vào đề, vẫn cần
   * điều hướng để quay ra.
   */
  it('không tính phòng chờ là đang làm bài', () => {
    expect(isExamTakingPath('/hoc-vien/phong-cho/77')).toBe(false);
  });

  it('không tính các trang thường', () => {
    expect(isExamTakingPath('/hoc-vien')).toBe(false);
    expect(isExamTakingPath('/hoc-vien/bai-tap')).toBe(false);
    expect(isExamTakingPath('/hoc-vien/lich-su-thi')).toBe(false);
    expect(isExamTakingPath('/hoc-vien/tien-do')).toBe(false);
  });

  /**
   * Trang kết quả KHÔNG phải trang làm bài — học viên đã nộp xong và cần điều
   * hướng để đi tiếp. Quan trọng vì tên route khá giống nhau.
   */
  it('không tính trang kết quả', () => {
    expect(isExamTakingPath('/hoc-vien/ket-qua/501')).toBe(false);
    expect(isExamTakingPath('/hoc-vien/ket-qua-thpt/501')).toBe(false);
  });

  /**
   * Chặn khớp thừa: một route tương lai bắt đầu bằng cùng chuỗi ký tự nhưng khác
   * đoạn đường dẫn (ví dụ `/lam-bai-tap-nhom`) không được tính là trang thi.
   */
  it('chỉ khớp theo đoạn đường dẫn, không khớp theo chuỗi ký tự', () => {
    expect(isExamTakingPath('/hoc-vien/lam-bai-tap-nhom/1')).toBe(false);
  });

  it('khớp cả đường dẫn trần không có tham số', () => {
    expect(isExamTakingPath('/hoc-vien/lam-bai')).toBe(true);
  });

  it('không lỗi với chuỗi rỗng', () => {
    expect(isExamTakingPath('')).toBe(false);
  });
});
