import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { THPT_THEME } from '../sections';

export function QuestionBadge({ n }: { n: number }) {
  return (
    <span
      className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-white text-xs font-bold flex-shrink-0"
      style={{ backgroundColor: THPT_THEME.primary }}
    >
      {n}
    </span>
  );
}

export function DeleteBtn({ onClick, title = 'Xoá' }: { onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-slate-400 hover:text-red-600 transition-colors cursor-pointer p-1.5 rounded-md hover:bg-red-50 flex-shrink-0"
      title={title}
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}

export function AddButton({
  onClick,
  label,
  disabled,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-400 bg-white text-slate-500 hover:text-blue-600 py-3 font-semibold text-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
      + {label}
    </button>
  );
}

/** Section header với title + instructions editable */
export function SectionHeader({
  title,
  instructions,
  hint,
  onTitleChange,
  onInstructionsChange,
}: {
  title: string;
  instructions: string;
  hint?: string;
  onTitleChange: (v: string) => void;
  onInstructionsChange: (v: string) => void;
}) {
  return (
    <div className="rounded-2xl p-5 bg-white border border-slate-200">
      <input
        type="text"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        className="w-full text-lg font-bold text-slate-900 bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-blue-200 rounded-md px-1 -ml-1"
        placeholder="Tiêu đề phần"
      />
      {hint && <p className="text-sm text-slate-500 mt-0.5">{hint}</p>}
      <FormattedTextarea
        value={instructions}
        onChange={onInstructionsChange}
        placeholder="Hướng dẫn cho học viên..."
        rows={2}
        className="mt-3"
      />
    </div>
  );
}

/** A/B/C/D option picker — bấm để chọn đáp án đúng */
export function OptionRow({
  letter,
  text,
  isCorrect,
  onPick,
  onTextChange,
  placeholder,
}: {
  letter: string;
  text: string;
  isCorrect: boolean;
  onPick: () => void;
  onTextChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border p-2 transition-colors ${
        isCorrect ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 bg-slate-50/50'
      }`}
    >
      <button
        type="button"
        onClick={onPick}
        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all cursor-pointer flex-shrink-0 ${
          isCorrect ? 'text-white' : 'bg-white border border-slate-300 text-slate-500 hover:border-blue-400'
        }`}
        style={isCorrect ? { backgroundColor: THPT_THEME.success } : {}}
        title="Chọn làm đáp án đúng"
      >
        {letter}
      </button>
      <input
        type="text"
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder={placeholder ?? `Phương án ${letter}`}
        className="flex-1 min-w-0 text-sm bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-blue-200 rounded-md px-2 py-1"
      />
    </div>
  );
}

interface FormattedTextareaProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

/**
 * Chuyển HTML trong clipboard (copy từ Word / Google Docs / web) sang inline
 * markup mà trình soạn đề dùng: <b>, <i>, <u>.
 *
 * Vì sao cần: textarea chỉ nhận text/plain nên dán từ Word bị MẤT in đậm /
 * in nghiêng / gạch chân. Word đặt định dạng bằng cả thẻ (<b>, <strong>) lẫn
 * style inline (font-weight:700, text-decoration:underline) nên phải xét cả hai.
 */
export function htmlToInlineMarkup(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const isBold = (el: HTMLElement): boolean => {
    const tag = el.tagName.toLowerCase();
    if (tag === 'b' || tag === 'strong') return true;
    const w = el.style?.fontWeight || '';
    if (w === 'bold' || w === 'bolder') return true;
    const num = parseInt(w, 10);
    return Number.isFinite(num) && num >= 600;
  };
  const isItalic = (el: HTMLElement): boolean => {
    const tag = el.tagName.toLowerCase();
    if (tag === 'i' || tag === 'em') return true;
    return (el.style?.fontStyle || '') === 'italic';
  };
  const isUnderline = (el: HTMLElement): boolean => {
    const tag = el.tagName.toLowerCase();
    if (tag === 'u' || tag === 'ins') return true;
    return (el.style?.textDecoration || el.style?.textDecorationLine || '').includes('underline');
  };

  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      // Word chèn nhiều khoảng trắng/newline trang trí — gom lại cho gọn.
      return (node.textContent || '').replace(/\s+/g, ' ');
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === 'style' || tag === 'script') return '';

    let inner = Array.from(el.childNodes).map(walk).join('');
    if (!inner.trim()) return inner.includes(' ') ? ' ' : '';

    if (isBold(el)) inner = `<b>${inner}</b>`;
    if (isItalic(el)) inner = `<i>${inner}</i>`;
    if (isUnderline(el)) inner = `<u>${inner}</u>`;

    // Xuống dòng cho block-level
    if (['p', 'div', 'br', 'li', 'tr'].includes(tag)) inner += '\n';
    return inner;
  };

  return Array.from(doc.body.childNodes)
    .map(walk)
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function smartLineBreaks(html: string): string {
  if (!html) return html;
  let formatted = html;
  // 1. Remove spaces between <br> and a question number
  formatted = formatted.replace(/(<br\/?>|\n)\s*(<b>)?\b(\d+)\./gi, '$1$2$3.');
  // 2. Insert <br> before 2., 3., 4., etc. if not preceded by <br> or \n (allowing optional <b> tags)
  formatted = formatted.replace(/(?<!(?:<br\/?>|\n)\s*(?:<b>)?\s*)\s*(<b>)?\b([2-9]|\d{2,})\.(?!\d)/gi, '<br>$1$2.');
  return formatted;
}

export function FormattedTextarea({ value, onChange, placeholder, rows = 2, className = '' }: FormattedTextareaProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Synchronize value to innerHTML only when it changes from outside
  useEffect(() => {
    if (editorRef.current) {
      let displayValue = value || '';
      // Apply smart line breaks only when not focused (initial load / AI import)
      if (!isFocused) {
        displayValue = smartLineBreaks(displayValue);
        // Propagate the formatted changes back to parent
        if (displayValue !== value) {
          onChange(displayValue);
        }
      }
      if (editorRef.current.innerHTML !== displayValue) {
        editorRef.current.innerHTML = displayValue;
      }
    }
  }, [value, isFocused]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const html = e.currentTarget.innerHTML;
    // Normalize empty tags or standard browser leftovers to empty string
    if (html === '<br>' || html === '<div><br></div>' || html === '<p><br></p>' || html === '<div></div>') {
      onChange('');
    } else {
      onChange(html);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    // For contentEditable, get raw text or html
    const html = e.clipboardData?.getData('text/html');
    if (html) {
      const markup = htmlToInlineMarkup(html);
      if (markup) {
        document.execCommand('insertHTML', false, markup);
        return;
      }
    }
    const text = e.clipboardData?.getData('text/plain');
    if (text) {
      document.execCommand('insertText', false, text);
    }
  };

  const applyFormat = (command: string) => {
    document.execCommand(command, false);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const isEmpty = !value || value === '<br>' || value === '<div><br></div>' || value === '<p><br></p>' || value === '<div></div>';

  return (
    <div className="relative group">
      {/* Format buttons bar in absolute top right */}
      <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded bg-slate-100/90 border border-slate-200/50 p-0.5 shadow-sm opacity-60 group-hover:opacity-100 hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => applyFormat('bold')}
          className="w-5 h-5 flex items-center justify-center text-xs font-bold text-slate-700 hover:bg-slate-200 hover:text-slate-900 rounded cursor-pointer transition-colors"
          title="In đậm (Bold)"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => applyFormat('italic')}
          className="w-5 h-5 flex items-center justify-center text-xs font-semibold italic text-slate-700 hover:bg-slate-200 hover:text-slate-900 rounded cursor-pointer transition-colors"
          title="In nghiêng (Italic)"
        >
          I
        </button>
        <button
          type="button"
          onClick={() => applyFormat('underline')}
          className="w-5 h-5 flex items-center justify-center text-xs font-semibold underline text-slate-700 hover:bg-slate-200 hover:text-slate-900 rounded cursor-pointer transition-colors"
          title="Gạch chân (Underline)"
        >
          U
        </button>
      </div>

      {isEmpty && placeholder && (
        <span className="absolute left-3 top-2.5 text-sm text-slate-400 pointer-events-none select-none">
          {placeholder}
        </span>
      )}

      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={`w-full text-sm border border-slate-200 rounded-lg pl-3 pr-20 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 font-sans leading-relaxed overflow-y-auto outline-none bg-white min-h-[60px] ${className}`}
        style={{ minHeight: `${rows * 26}px` }}
      />
    </div>
  );
}
export function ExplanationField({
  value,
  onChange,
}: {
  value?: string;
  onChange: (v: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.max(60, el.scrollHeight)}px`;
    }
  }, [value]);

  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <label className="block text-xs font-bold text-amber-700 mb-1 flex items-center gap-1.5">
        <span className="text-amber-500">💡</span>
        Giải thích đáp án
        <span className="font-normal text-slate-400">(tuỳ chọn — hiển thị cho học viên sau khi nộp bài)</span>
      </label>
      <textarea
        ref={textareaRef}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder="Vd: Đáp án B vì... / Quy tắc ngữ pháp... / Đây là thành ngữ có nghĩa..."
        className="w-full text-sm border border-amber-200 rounded-lg px-3 py-2 bg-amber-50/30 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 resize-none overflow-hidden"
      />
    </div>
  );
}
