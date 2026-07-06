import { useEffect, useRef } from "react";
import { Bold, Italic, Underline, Superscript, Subscript } from "lucide-react";
import { sanitizeInlineHtml } from "../../utils/examUtils";

interface RichTextInputProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  /** Ẩn thanh công cụ (nếu muốn dùng phím tắt thôi). Mặc định hiện. */
  hideToolbar?: boolean;
  /** ID cho input (accessibility / test). */
  id?: string;
  /**
   * Hook dán tuỳ chỉnh. Nếu callback gọi `e.preventDefault()` (đã tự xử lý),
   * RichTextInput sẽ BỎ QUA xử lý dán mặc định. Dùng cho các editor cần tự
   * tách nội dung dán (vd auto-split A./B./C./D. thành các phương án).
   */
  onPaste?: (e: React.ClipboardEvent<HTMLDivElement>) => void;
}

type Cmd = "bold" | "italic" | "underline" | "superscript" | "subscript";

const TOOLBAR: Array<{ cmd: Cmd; icon: typeof Bold; label: string }> = [
  { cmd: "bold", icon: Bold, label: "Đậm (Ctrl+B)" },
  { cmd: "italic", icon: Italic, label: "Nghiêng (Ctrl+I)" },
  { cmd: "underline", icon: Underline, label: "Gạch chân (Ctrl+U)" },
  { cmd: "superscript", icon: Superscript, label: "Chỉ số trên (x²)" },
  { cmd: "subscript", icon: Subscript, label: "Chỉ số dưới (x₂)" },
];

/**
 * Ô nhập rich text nhẹ dựa trên contentEditable, có thanh công cụ B / I / U /
 * sup / sub. Emit ra chuỗi HTML đã sanitize (chỉ tag inline an toàn), nên dữ
 * liệu lưu xuống backend luôn sạch. Dán nội dung từ Word cũng được sanitize.
 *
 * Thiết kế responsive, dùng được trên cả mobile và PC.
 */
export function RichTextInput({
  value,
  onChange,
  placeholder,
  className,
  hideToolbar = false,
  id,
  onPaste,
}: RichTextInputProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  // Đồng bộ value từ ngoài vào (chỉ khi khác) để tránh nhảy con trỏ khi gõ.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const incoming = value ?? "";
    if (el.innerHTML !== incoming) {
      el.innerHTML = incoming;
    }
  }, [value]);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    onChange(sanitizeInlineHtml(el.innerHTML));
  };

  const exec = (cmd: Cmd) => {
    ref.current?.focus();
    // execCommand vẫn là cách đơn giản & tương thích rộng nhất cho contentEditable.
    document.execCommand(cmd, false);
    emit();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    // Cho phép caller tự xử lý dán (vd auto-split A./B./C./D.). Nếu caller đã
    // gọi preventDefault → coi như xong, không chạy dán mặc định.
    if (onPaste) {
      onPaste(e);
      if (e.defaultPrevented) {
        // Đồng bộ lại sau khi caller cập nhật state ngoài.
        setTimeout(emit, 0);
        return;
      }
    }
    // Chặn dán mặc định (kéo theo style rác), tự chèn phiên bản đã sanitize.
    e.preventDefault();
    const html = e.clipboardData.getData("text/html");
    const plain = e.clipboardData.getData("text/plain");
    const clean = html ? sanitizeInlineHtml(html) : plain;
    document.execCommand("insertHTML", false, clean);
    emit();
  };

  return (
    <div className={className}>
      {!hideToolbar && (
        <div className="flex items-center gap-0.5 mb-1 rounded-md border border-gray-200 bg-gray-50 px-1 py-0.5 w-fit">
          {TOOLBAR.map(({ cmd, icon: Icon, label }) => (
            <button
              key={cmd}
              type="button"
              title={label}
              aria-label={label}
              onMouseDown={(e) => {
                // Ngăn mất selection khi bấm nút toolbar.
                e.preventDefault();
                exec(cmd);
              }}
              className="w-7 h-7 flex items-center justify-center rounded text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-colors cursor-pointer"
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>
      )}
      <div
        id={id}
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={emit}
        onPaste={handlePaste}
        onKeyDown={(e) => {
          // Phím tắt chuẩn — execCommand tự xử lý, chỉ cần emit sau đó.
          if ((e.ctrlKey || e.metaKey) && ["b", "i", "u"].includes(e.key.toLowerCase())) {
            // để mặc định thực thi rồi đồng bộ
            setTimeout(emit, 0);
          }
        }}
        className="rich-text-input w-full min-h-[42px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none text-sm leading-relaxed"
      />
    </div>
  );
}
