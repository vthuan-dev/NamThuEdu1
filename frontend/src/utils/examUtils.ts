/**
 * Utility functions for exam calculations
 */

/**
 * Sanitize imported passage HTML (from docx/PDF paste) so text wraps by whole
 * words instead of breaking mid-character.
 *
 * Root cause of the "chữ bị cắt" bug: the stored HTML carries inline styles on
 * child elements such as `style="word-break:break-all"` (sometimes with
 * `!important`) plus invisible break characters and `<wbr>` tags. An inline
 * `!important` declaration beats any stylesheet rule, so our CSS fix in
 * index.css (`.vstep-passage * { word-break: normal !important }`) cannot win.
 * The only reliable fix is to strip the offending markup from the HTML string
 * itself before rendering.
 *
 * @param html - Raw passage HTML
 * @returns Cleaned HTML safe to render with dangerouslySetInnerHTML
 */
export const sanitizePassageHtml = (html: string): string => {
  if (!html) return "";

  return (
    html
      // Remove invisible break characters (soft hyphen, zero-width spaces, BOM)
      .replace(/[\u00AD\u200B\u200C\u200D\u2060\uFEFF]/g, "")
      // Convert non-breaking spaces (&nbsp;, &#160;, U+00A0, narrow/figure NBSP)
      // to normal spaces. This is the primary cause of mid-word breaking:
      // with `white-space: pre-wrap`, the browser refuses to wrap at a NBSP, so
      // whole phrases become one unbreakable token and get broken mid-character.
      .replace(/&nbsp;/gi, " ")
      .replace(/&#160;|&#xA0;/gi, " ")
      .replace(/[\u00A0\u202F\u2007]/g, " ")
      // Remove <wbr> word-break opportunity tags
      .replace(/<wbr\s*\/?>/gi, "")
      // Neutralize inline declarations that force mid-word breaks.
      // Matches e.g. `word-break:break-all;`, `overflow-wrap: anywhere !important;`,
      // `hyphens:auto;` inside any style="..." attribute.
      .replace(
        /(word-break|word-wrap|overflow-wrap|-webkit-hyphens|hyphens|line-break)\s*:\s*[^;"']*(\s*!important)?\s*;?/gi,
        ""
      )
  );
};

/**
 * Calculate total points for a question, excluding example items
 * @param config - Question config containing items array
 * @param basePoints - Base points per item (default: 1)
 * @returns Total points for the question
 */
export const calculateQuestionPoints = (config: any, basePoints: number = 1): number => {
  if (!config || !config.items || !Array.isArray(config.items)) {
    return 0;
  }

  // Count only non-example items
  const scorableItems = config.items.filter((item: any) => !item.isExample);
  return scorableItems.length * basePoints;
};

/**
 * Calculate total exam points from all questions
 * @param questions - Array of questions
 * @returns Total points for the exam
 */
export const calculateExamTotalPoints = (questions: any[]): number => {
  if (!questions || !Array.isArray(questions)) {
    return 0;
  }

  return questions.reduce((total, question) => {
    // If question has items with isExample flag, calculate based on non-example items
    if (question.config?.items && Array.isArray(question.config.items)) {
      const scorableItems = question.config.items.filter((item: any) => !item.isExample);
      return total + (scorableItems.length * (question.points || 1));
    }
    
    // Otherwise use the question's points directly
    return total + (question.points || 0);
  }, 0);
};

/**
 * Get count of scorable items (excluding examples)
 * @param items - Array of items
 * @returns Count of non-example items
 */
export const getScorableItemsCount = (items: any[]): number => {
  if (!items || !Array.isArray(items)) {
    return 0;
  }
  
  return items.filter((item: any) => !item.isExample).length;
};

/**
 * Get count of example items
 * @param items - Array of items
 * @returns Count of example items
 */
export const getExampleItemsCount = (items: any[]): number => {
  if (!items || !Array.isArray(items)) {
    return 0;
  }
  
  return items.filter((item: any) => item.isExample).length;
};

/**
 * Ngữ âm (phonetics): tự động phát hiện đuôi biến đổi của từ để nhấn mạnh.
 * Ưu tiên các đuôi phổ biến trong đề THPT: -ed, -es, -s.
 *
 * @param word - Từ cần phân tích (ví dụ "walked", "boxes", "cats")
 * @returns Phần đuôi cần gạch chân (ví dụ "ed", "es", "s"). Rỗng nếu không có.
 */
export const detectPhoneticEnding = (word: string): string => {
  const w = (word ?? "").trim();
  const lower = w.toLowerCase();
  if (lower.length < 2) return "";
  if (lower.endsWith("ed")) return w.slice(-2);
  if (lower.endsWith("es")) return w.slice(-2);
  if (lower.endsWith("s")) return w.slice(-1);
  return "";
};

/**
 * Tách 1 từ thành 3 phần [before, mark, after] để render phần "mark"
 * (phần phát âm khác biệt) với gạch chân + in nghiêng.
 *
 * - Nếu giáo viên đã nhập `underline` → dùng đúng phần đó (khớp cuối từ trước).
 * - Nếu chưa nhập → tự động phát hiện đuôi ed/s/es.
 *
 * @param text - Từ đầy đủ
 * @param underline - Phần gạch chân do giáo viên chỉ định (tùy chọn)
 */
export const splitPhoneticWord = (
  text: string,
  underline?: string,
): { before: string; mark: string; after: string } => {
  const word = text ?? "";
  let target = (underline ?? "").trim();
  if (!target) target = detectPhoneticEnding(word);
  if (!target) return { before: word, mark: "", after: "" };

  const idx = word.toLowerCase().lastIndexOf(target.toLowerCase());
  if (idx === -1) return { before: word, mark: "", after: "" };

  return {
    before: word.slice(0, idx),
    mark: word.slice(idx, idx + target.length),
    after: word.slice(idx + target.length),
  };
};
