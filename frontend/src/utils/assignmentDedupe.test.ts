/**
 * hideSupersededExhausted — ẩn bản giao cũ đã cạn lượt khi đề đó vừa được giao lại.
 *
 * Bối cảnh (đã xác minh bằng ReassignAfterAttemptsExhaustedTest ở backend): pool
 * lượt làm bài đếm theo `assignment_id`, không theo `exam_id`. Nên giao lại một
 * đề đã hết lượt là cách hợp lệ để giáo viên "mở lại" đề — nhưng danh sách gom
 * theo assignment nên học viên thấy hai thẻ trùng tên.
 */
import { describe, it, expect } from 'vitest';
import { hideSupersededExhausted } from './assignmentDedupe';

/** Cấu trúc tối giản của một thẻ đề trên danh sách. */
const exam = (
  examId: number,
  attemptsUsed: number | null,
  attemptsAllowed: number | null,
  label = '',
) => ({ examId, attemptsUsed, attemptsAllowed, label });

describe('hideSupersededExhausted', () => {
  /** Đây chính là tình huống người dùng hỏi. */
  it('ẩn bản cũ hết lượt khi cùng đề có bản mới còn lượt', () => {
    const result = hideSupersededExhausted([
      exam(7, 1, 1, 'cũ'),
      exam(7, 0, 1, 'mới'),
    ]);

    expect(result.map((e) => e.label)).toEqual(['mới']);
  });

  /**
   * Không có bản thay thế thì PHẢI giữ lại — nếu không học viên mất luôn lối vào
   * trang kết quả của bài mình vừa làm.
   */
  it('giữ bản hết lượt khi đó là bản duy nhất của đề', () => {
    const result = hideSupersededExhausted([exam(7, 1, 1, 'duy nhất')]);

    expect(result.map((e) => e.label)).toEqual(['duy nhất']);
  });

  /**
   * Hai bản đều còn lượt (ví dụ hai deadline khác nhau) đều hợp lệ — ẩn đi sẽ
   * lấy mất một lượt hợp pháp của học viên.
   */
  it('không ẩn gì khi cả hai bản đều còn lượt', () => {
    const result = hideSupersededExhausted([
      exam(7, 0, 1, 'a'),
      exam(7, 0, 2, 'b'),
    ]);

    expect(result.map((e) => e.label)).toEqual(['a', 'b']);
  });

  /** Bản mới cũng hết lượt thì không có gì để thay thế → giữ cả hai. */
  it('giữ cả hai khi bản mới cũng đã hết lượt', () => {
    const result = hideSupersededExhausted([
      exam(7, 1, 1, 'cũ'),
      exam(7, 2, 2, 'mới'),
    ]);

    expect(result.map((e) => e.label)).toEqual(['cũ', 'mới']);
  });

  /** Việc ẩn không được lan sang đề khác. */
  it('chỉ tác động trong cùng một đề', () => {
    const result = hideSupersededExhausted([
      exam(7, 1, 1, 'đề 7 cũ'),
      exam(7, 0, 1, 'đề 7 mới'),
      exam(9, 1, 1, 'đề 9 hết lượt'),
    ]);

    expect(result.map((e) => e.label)).toEqual(['đề 7 mới', 'đề 9 hết lượt']);
  });

  /**
   * `attemptsAllowed <= 0` nghĩa là KHÔNG giới hạn, khớp cách backend hiểu
   * `taMax_attempt`. Hiểu sai thành "0 lượt" sẽ ẩn oan những đề không giới hạn.
   */
  it('coi allowed <= 0 là không giới hạn, không bao giờ hết lượt', () => {
    const result = hideSupersededExhausted([
      exam(7, 5, 0, 'không giới hạn'),
      exam(7, 0, 1, 'có hạn'),
    ]);

    expect(result.map((e) => e.label)).toEqual(['không giới hạn', 'có hạn']);
  });

  it('xử lý được giá trị null từ API', () => {
    const result = hideSupersededExhausted([
      exam(7, null, null, 'null'),
      exam(7, 0, 1, 'bình thường'),
    ]);

    expect(result.map((e) => e.label)).toEqual(['null', 'bình thường']);
  });

  /** Hàm chạy sau bước sắp xếp nên không được đảo thứ tự. */
  it('giữ nguyên thứ tự đầu vào', () => {
    const result = hideSupersededExhausted([
      exam(1, 0, 1, 'a'),
      exam(2, 0, 1, 'b'),
      exam(3, 0, 1, 'c'),
    ]);

    expect(result.map((e) => e.label)).toEqual(['a', 'b', 'c']);
  });

  it('không lỗi với danh sách rỗng', () => {
    expect(hideSupersededExhausted([])).toEqual([]);
  });

  /** Ba bản: hai cũ đã cạn, một mới còn lượt → chỉ còn bản mới. */
  it('ẩn được nhiều bản cũ cùng lúc', () => {
    const result = hideSupersededExhausted([
      exam(7, 1, 1, 'cũ 1'),
      exam(7, 1, 1, 'cũ 2'),
      exam(7, 0, 1, 'mới'),
    ]);

    expect(result.map((e) => e.label)).toEqual(['mới']);
  });
});
