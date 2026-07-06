import { createElement, type ElementType } from "react";
import { containsHtml, sanitizeInlineHtml } from "../../utils/examUtils";

interface RichTextProps {
  /** Nội dung có thể là plain text hoặc HTML inline (b/i/u/sup/sub). */
  text?: string | null;
  /** Thẻ bọc ngoài (mặc định span). Dùng "p"/"div" khi cần. */
  as?: ElementType;
  className?: string;
}

/**
 * Render an toàn nội dung câu hỏi / phương án.
 *
 * - Nếu chuỗi chứa thẻ HTML → sanitize (chỉ giữ tag inline an toàn) rồi render
 *   bằng dangerouslySetInnerHTML để hiển thị đúng in đậm/nghiêng/gạch chân.
 * - Nếu là plain text → render text thuần như cũ (không regression).
 *
 * Dùng chung cho VSTEP + IELTS, cả trang làm bài học viên lẫn preview giáo viên.
 */
export function RichText({ text, as = "span", className }: RichTextProps) {
  const value = text ?? "";

  if (containsHtml(value)) {
    return createElement(as, {
      className,
      dangerouslySetInnerHTML: { __html: sanitizeInlineHtml(value) },
    });
  }

  return createElement(as, { className }, value);
}
