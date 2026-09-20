/**
 * Utility functions for exam calculations
 */
import DOMPurify from "dompurify";

/**
 * Các thẻ inline an toàn được phép giữ lại trong nội dung câu hỏi / phương án.
 * Chỉ cho phép định dạng chữ cơ bản — KHÔNG cho phép thẻ khối, script, style...
 */
export const INLINE_ALLOWED_TAGS = [
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "sup",
  "sub",
  "br",
  "span",
] as const;

/**
 * Phát hiện chuỗi có chứa thẻ HTML hay không (để quyết định render rich text
 * hay plain text). Chỉ cần bắt được dạng `<tag ...>` hoặc `<tag>`.
 *
 * @param str - Chuỗi cần kiểm tra
 * @returns true nếu chuỗi chứa ít nhất một thẻ HTML
 */
export const containsHtml = (str?: string | null): boolean => {
  if (!str) return false;
  return /<\/?[a-z][\s\S]*>/i.test(str);
};

/**
 * Kiểm tra xem chuỗi có chứa thẻ HTML hoặc thực thể HTML (&nbsp;, &amp;, ...) hay không.
 */
export const hasHtmlOrEntities = (str?: string | null): boolean => {
  if (!str) return false;
  return /<\/?[a-z][\s\S]*>|&(?:nbsp|amp|lt|gt|quot|#\d+);/i.test(str);
};

/**
 * Sanitize chuỗi HTML, CHỈ giữ lại các thẻ inline an toàn (đậm/nghiêng/gạch
 * chân/sup/sub). Loại bỏ mọi thẻ khối, script, style, sự kiện on* — an toàn XSS
 * và loại được style rác do Word/PDF chèn vào.
 *
 * @param html - Chuỗi HTML thô
 * @returns Chuỗi HTML đã được làm sạch, an toàn để render với dangerouslySetInnerHTML
 */
export const sanitizeInlineHtml = (html?: string | null): string => {
  if (!html) return "";
  const pre = html
    .replace(/<\/(p|div|h[1-6]|li)>\s*$/gi, "")
    .replace(/<\/(p|div|h[1-6]|li)>/gi, "<br>")
    .replace(/<(p|div|h[1-6]|li)[^>]*>/gi, "")
    .replace(/&nbsp;/gi, " ");
  return DOMPurify.sanitize(pre, {
    ALLOWED_TAGS: [...INLINE_ALLOWED_TAGS],
    // Cho phép class trên <span> để giữ tương thích với formatErrorSentence,
    // nhưng loại bỏ style inline (nguồn gốc style rác từ Word).
    ALLOWED_ATTR: ["class"],
  });
};

/**
 * Sanitize nội dung văn bản có cấu trúc HTML (bài đọc, notice, email, đoạn văn).
 * Giữ lại các thẻ khối và inline an toàn (div, p, br, b, strong, i, em, u, table, lists...)
 * loại bỏ script, thẻ độc hại và sự kiện on*.
 */
export const sanitizeRichContent = (html?: string | null): string => {
  if (!html) return "";
  const pre = html.replace(/&nbsp;/gi, " ");
  return DOMPurify.sanitize(pre, {
    ALLOWED_TAGS: [
      "b", "strong", "i", "em", "u", "s", "sup", "sub", "br", "span",
      "p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote",
      "ul", "ol", "li", "table", "thead", "tbody", "tr", "th", "td",
      "pre", "code", "font", "hr"
    ],
    ALLOWED_ATTR: ["class", "style", "color", "size", "align"],
  });
};

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
/**
 * Strip unwanted text color, background, opacity, and font-family from passage HTML
 * while preserving italics, bold, underline, lists, headers, links, and structure.
 */
export const cleanPassageStyles = (html: string): string => {
  if (!html) return "";

  let cleaned = html
    // 1. Remove font tags (e.g. <font color="#999">...</font>)
    .replace(/<font[^>]*>([\s\S]*?)<\/font>/gi, "$1")
    // 2. Strip color, background, opacity, font-family from style attributes
    .replace(/\s*style\s*=\s*("([^"]*)"|'([^']*)')/gi, (_match, _fullGroup, doubleQuoted, singleQuoted) => {
      const styles = doubleQuoted !== undefined ? doubleQuoted : singleQuoted;
      const filtered = styles
        .split(";")
        .map((s) => s.trim())
        .filter((s) => {
          if (!s) return false;
          const prop = s.split(":")[0].trim().toLowerCase();
          return ![
            "color",
            "background",
            "background-color",
            "background-image",
            "opacity",
            "font-family",
          ].includes(prop);
        })
        .join("; ");
      return filtered ? ` style="${filtered}"` : "";
    });

  // 3. Unwrap empty spans repeatedly (e.g. <span > or <span> or nested <span><span>)
  let prev;
  do {
    prev = cleaned;
    cleaned = cleaned.replace(/<span\s*>([\s\S]*?)<\/span>/gi, "$1");
  } while (cleaned !== prev);

  return cleaned;
};


export const sanitizePassageHtml = (html: string): string => {
  if (!html) return "";

  const preCleaned = cleanPassageStyles(html);

  return (
    preCleaned
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
 * Chuẩn hóa nội dung bài đọc từ HTML / contentEditable sang văn bản thuần sạch:
 * - Chuyển các thẻ khối (</p>, </div>, <br>, </li>, </h1-6>) thành xuống dòng (\n hoặc \n\n) để giữ cấu trúc đoạn văn.
 * - Loại bỏ toàn bộ các thẻ HTML còn lại (<...>) để tránh rò rỉ mã HTML (&nbsp;, <div>) ra màn hình học viên.
 * - Giải mã các thực thể HTML (&nbsp;, &amp;, &lt;, &gt;, &quot;, &#39;, &#160;...).
 * - Chuyển non-breaking spaces (\u00A0...) thành khoảng trắng thông thường.
 * - Chuẩn hóa dấu xuống dòng, tránh khoảng trống thừa liên tiếp.
 *
 * Đảm bảo:
 * 1. Học viên không thấy các ký tự rác như &nbsp;, <div>, </div> khi làm bài.
 * 2. Cấu trúc các đoạn văn (\n\n) và thụt đầu dòng được bảo toàn nguyên vẹn với whitespace-pre-wrap.
 * 3. Độ dài chuỗi hiển thị khớp 1:1 với chỉ số offset của tính năng highlight ghi chú.
 */
export const normalizePassageText = (raw?: string | null): string => {
  if (!raw) return "";

  // 1. Chuyển đổi cả thẻ mở và thẻ đóng của các phần tử khối thành ký tự newline
  // Trình duyệt (contentEditable) tạo dòng mới bằng <div>Line 2</div> (thẻ mở <div> nằm ở đầu dòng mới)
  let s = raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<p[^>]*>/gi, "\n\n")
    .replace(/<\/div\s*>/gi, "\n\n")
    .replace(/<div[^>]*>/gi, "\n\n")
    .replace(/<\/li\s*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n")
    .replace(/<\/h[1-6]\s*>/gi, "\n\n")
    .replace(/<h[1-6][^>]*>/gi, "\n\n");

  // 2. Bóc toàn bộ các thẻ HTML còn lại
  s = s.replace(/<[^>]*>/g, "");

  // 3. Giải mã các thực thể HTML phổ biến
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;|&#xA0;/gi, " ")
    .replace(/[\u00A0\u202F\u2007]/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");

  // Giải mã các thực thể khác nếu có trong môi trường trình duyệt
  if (typeof document !== "undefined" && /&[#a-z0-9]+;/i.test(s)) {
    try {
      const ta = document.createElement("textarea");
      ta.innerHTML = s;
      s = ta.value;
    } catch {
      // fallback giữ nguyên nếu có lỗi DOM
    }
  }

  // 4. Chuẩn hóa khoảng trắng và ngắt dòng:
  // - Chuẩn hóa CRLF về LF
  // - Bỏ khoảng trắng thừa ở cuối mỗi dòng (trước dấu ngắt dòng)
  // - Gom các dòng trống liên tiếp (>2 newlines) thành \n\n (1 dòng trống ngăn cách đoạn)
  // - Xóa các dòng trống ở đầu và cuối nhưng bảo toàn khoảng trắng thụt đầu dòng
  return s
    .replace(/\u00a0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^[\r\n]+|[\r\n\s]+$/g, "");
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
 * Xác định 1 NHÓM từ (4 phương án của 1 câu ngữ âm) có phải dạng "so sánh đuôi"
 * hay không. Dạng so sánh đuôi là khi TẤT CẢ các từ đều kết thúc bằng s/es/ed
 * (ví dụ: stopped / worked / asked / wanted, hoặc laughs / stops / sleeps / plays).
 *
 * Chỉ nhóm như vậy mới được tự động dò & gạch chân phần đuôi. Dạng so sánh nguyên
 * âm (head / bread / tea / heavy → phần "ea") KHÔNG cùng đuôi nên sẽ trả về false,
 * tránh việc tự gạch nhầm chữ cuối. Câu trắc nghiệm thường (không phải ngữ âm) cũng
 * hiếm khi có toàn bộ phương án cùng đuôi s/es/ed nên cũng được loại trừ.
 *
 * @param words - Danh sách các từ trong câu (mỗi phần tử có `text`).
 * @returns true nếu nên bật auto-dò đuôi cho cả nhóm.
 */
export const isSuffixComparisonGroup = (
  words: { text?: string | null }[],
): boolean => {
  if (!Array.isArray(words)) return false;
  const texts = words
    .map((w) => (w?.text ?? "").trim())
    .filter((t) => t.length >= 2);
  // Cần tối thiểu 2 từ để coi là 1 nhóm so sánh có nghĩa.
  if (texts.length < 2) return false;
  // Mọi từ đều phải có đuôi biến đổi s/es/ed thì mới coi là dạng so sánh đuôi.
  return texts.every((t) => detectPhoneticEnding(t) !== "");
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

/**
 * Chuẩn hoá URL file audio: tự động nâng cấp http:// sang https://
 * để tránh bị trình duyệt chặn Mixed Content trên trang HTTPS.
 */
export const normalizeAudioUrl = (url?: string | null): string => {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^http:\/\/namthuedu\.vn/i.test(trimmed)) {
    return trimmed.replace(/^http:\/\/namthuedu\.vn/i, "https://namthuedu.vn");
  }
  if (/^http:\/\/www\.namthuedu\.vn/i.test(trimmed)) {
    return trimmed.replace(/^http:\/\/www\.namthuedu\.vn/i, "https://www.namthuedu.vn");
  }
  if (typeof window !== "undefined" && window.location.protocol === "https:" && /^http:\/\//i.test(trimmed) && !trimmed.includes("localhost") && !trimmed.includes("127.0.0.1")) {
    return trimmed.replace(/^http:\/\//i, "https://");
  }
  return trimmed;
};

