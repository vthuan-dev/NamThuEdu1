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
 * - Nếu chưa nhập và `autoDetectEnding` = true → tự động phát hiện đuôi ed/s/es.
 *   (Chỉ dùng cho dạng "Phát âm". Dạng "Trọng âm" phải để giáo viên tự đánh dấu
 *    âm tiết nhấn, KHÔNG tự dò đuôi để tránh in nghiêng nhầm.)
 *
 * @param text - Từ đầy đủ
 * @param underline - Phần cần đánh dấu do giáo viên chỉ định (tùy chọn)
 * @param autoDetectEnding - Tự dò đuôi ed/s/es khi giáo viên chưa nhập (mặc định true)
 * @param startAt - Vị trí bắt đầu của phần đánh dấu trong `text` (tùy chọn). Dùng để
 *   định vị chính xác khi cùng 1 chuỗi con xuất hiện nhiều lần (vd "in" trong "interesting").
 */
export const splitPhoneticWord = (
  text: string,
  underline?: string,
  autoDetectEnding = true,
  startAt?: number,
): { before: string; mark: string; after: string } => {
  const word = text ?? "";
  let target = (underline ?? "").trim();
  if (!target && autoDetectEnding) target = detectPhoneticEnding(word);
  if (!target) return { before: word, mark: "", after: "" };

  // Nếu có vị trí bắt đầu hợp lệ và khớp đúng phần văn bản tại đó → dùng luôn.
  let idx: number;
  if (
    startAt != null &&
    startAt >= 0 &&
    startAt + target.length <= word.length &&
    word.slice(startAt, startAt + target.length).toLowerCase() === target.toLowerCase()
  ) {
    idx = startAt;
  } else {
    idx = word.toLowerCase().lastIndexOf(target.toLowerCase());
  }
  if (idx === -1) return { before: word, mark: "", after: "" };

  return {
    before: word.slice(0, idx),
    mark: word.slice(idx, idx + target.length),
    after: word.slice(idx + target.length),
  };
};

/**
 * Tự động định dạng câu tìm lỗi sai (error_identification):
 * Gạch chân và in đậm các phần phương án nhiễu (A, B, C, D) trực tiếp trong câu.
 *
 * @param sentence - Câu đầy đủ chưa định dạng (vd: "She have been to Paris.")
 * @param segments - Danh sách các phần gạch chân (vd: [{id: 'A', text: 'have'}, {id: 'B', text: 'been'}])
 * @returns Chuỗi HTML chứa các thẻ định dạng <u> và <b>(A)</b>
 */
export const formatErrorSentence = (
  sentence: string,
  segments: { id: string; text: string }[],
): string => {
  if (!sentence) return "";

  // Nếu câu đã chứa sẵn các thẻ định dạng html (như <u>, <span>), coi như đã tự format
  if (/<[a-z][\s\S]*>/i.test(sentence)) {
    return sentence;
  }

  // Lọc và sắp xếp các phần khớp có vị trí xuất hiện tăng dần trong câu
  const matches = segments
    .map((seg) => {
      const text = (seg.text ?? "").trim();
      if (!text) return null;
      // Tìm vị trí xuất hiện của phần text trong câu (không phân biệt hoa thường)
      const index = sentence.toLowerCase().indexOf(text.toLowerCase());
      return { id: seg.id, text, index };
    })
    .filter(
      (m): m is { id: string; text: string; index: number } =>
        m !== null && m.index !== -1,
    )
    .sort((a, b) => a.index - b.index);

  let result = "";
  let lastIndex = 0;

  for (const m of matches) {
    // Để tránh trùng lặp hoặc nhảy lùi lại phía trước
    const idx = sentence.toLowerCase().indexOf(m.text.toLowerCase(), lastIndex);
    if (idx === -1) continue;

    // Ghép đoạn text trước match
    result += sentence.slice(lastIndex, idx);

    // Ghép phần được định dạng gạch chân + mã chữ cái (A/B/C/D)
    const matchedText = sentence.slice(idx, idx + m.text.length);
    result += `<span class="underline underline-offset-4 decoration-2 font-semibold text-slate-800">${matchedText}</span> <strong class="text-xs text-teal-600 font-bold">(${m.id})</strong>`;

    lastIndex = idx + m.text.length;
  }

  // Ghép phần còn lại
  result += sentence.slice(lastIndex);
  return result;
};

