/**
 * Component hiển thị passage với khả năng highlight text
 * Học viên có thể select text và bôi màu để ghi chú (hỗ trợ cả Mobile & Desktop)
 */
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Highlighter, Palette, Check } from 'lucide-react';
import type { TextHighlight, HighlightColor } from '../../../../hooks/exam/useTextHighlight';
import { normalizePassageText } from '../../../../utils/examUtils';

interface HighlightablePassageProps {
  html: string;
  highlights: TextHighlight[];
  selectedColor: HighlightColor;
  onAddHighlight: (highlight: Omit<TextHighlight, 'id' | 'timestamp'>) => void;
  onRemoveHighlight: (id: string) => void;
  onSelectColor: (color: HighlightColor) => void;
  colors: Record<HighlightColor, string>;
  enabled?: boolean;
}

export function HighlightablePassage({
  html,
  highlights,
  selectedColor,
  onAddHighlight,
  onRemoveHighlight,
  onSelectColor,
  colors,
  enabled = true,
}: HighlightablePassageProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 });
  const [currentSelection, setCurrentSelection] = useState<{
    text: string;
    start: number;
    end: number;
  } | null>(null);

  // Lấy dữ liệu selection an toàn cho cả Mobile và Desktop
  const getActiveSelectionData = useCallback(() => {
    if (!enabled) return null;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      return null;
    }

    const container = contentRef.current;
    if (!container) return null;

    const rawText = selection.toString();
    if (!rawText.trim()) return null;

    try {
      const range = selection.getRangeAt(0);
      if (
        !container.contains(range.commonAncestorContainer) &&
        !container.contains(selection.anchorNode) &&
        !container.contains(selection.focusNode)
      ) {
        return null;
      }

      let rawStartOffset = 0;
      try {
        const beforeRange = document.createRange();
        beforeRange.setStart(container, 0);
        beforeRange.setEnd(range.startContainer, range.startOffset);
        rawStartOffset = beforeRange.toString().length;
      } catch {
        const beforeRange = range.cloneRange();
        beforeRange.selectNodeContents(container);
        beforeRange.setEnd(range.startContainer, range.startOffset);
        rawStartOffset = beforeRange.toString().length;
      }

      const leadingSpaces = rawText.length - rawText.trimStart().length;
      const cleanTextSelected = rawText.trim();
      const startOffset = rawStartOffset + leadingSpaces;
      const endOffset = startOffset + cleanTextSelected.length;

      const rect = range.getBoundingClientRect();
      const top = rect.top < 70 ? Math.max(10, rect.bottom + 8) : Math.max(10, rect.top - 48);
      const left = Math.max(60, Math.min(window.innerWidth - 60, rect.left + rect.width / 2));

      return {
        text: cleanTextSelected,
        start: startOffset,
        end: endOffset,
        top,
        left,
      };
    } catch {
      return null;
    }
  }, [enabled]);

  // Xử lý bắt vùng chọn văn bản (hỗ trợ cả Mouse và Touch/SelectionChange trên Mobile)
  const updateSelection = useCallback(() => {
    const data = getActiveSelectionData();
    if (data) {
      setCurrentSelection({
        text: data.text,
        start: data.start,
        end: data.end,
      });
      setToolbarPosition({ top: data.top, left: data.left });
      setShowToolbar(true);
    }
  }, [getActiveSelectionData]);

  // Lắng nghe selectionchange trên document (hoạt động nhạy trên mobile iOS/Android)
  useEffect(() => {
    if (!enabled) return;

    let timeoutId: any = null;
    const handleSelectionChange = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
          return;
        }
        updateSelection();
      }, 40);
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [enabled, updateSelection]);

  // Đóng toolbar khi click ra ngoài
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('.highlight-toolbar') || target.closest('.highlight-color-picker')) {
        return;
      }
      // Click ra ngoài vùng chọn
      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) {
          setShowToolbar(false);
          setCurrentSelection(null);
        }
      }, 100);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, []);

  // Áp dụng highlight
  const applyHighlightWithColor = useCallback((colorKey: HighlightColor) => {
    const target = currentSelection || getActiveSelectionData();
    if (!target) return;

    onAddHighlight({
      text: target.text,
      startOffset: target.start,
      endOffset: target.end,
      color: colors[colorKey],
    });

    // Xóa selection
    window.getSelection()?.removeAllRanges();
    setShowToolbar(false);
    setCurrentSelection(null);
  }, [currentSelection, getActiveSelectionData, colors, onAddHighlight]);

  const applyHighlight = useCallback(() => {
    applyHighlightWithColor(selectedColor);
  }, [applyHighlightWithColor, selectedColor]);

  // Xóa highlight khi click vào thẻ <mark>
  useEffect(() => {
    const container = contentRef.current;
    if (!container || !enabled) return;

    const handleClick = (e: MouseEvent | TouchEvent) => {
      const target = (e.target as HTMLElement).closest('.highlight-mark') as HTMLElement | null;
      if (target) {
        const id = target.dataset.highlightId;
        if (id && window.confirm('Xóa đánh dấu (highlight) này?')) {
          onRemoveHighlight(id);
        }
      }
    };

    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
  }, [onRemoveHighlight, enabled]);

  // Chuẩn hóa và render highlight trên đoạn văn
  const highlightedHtml = useMemo(() => {
    const cleanText = normalizePassageText(html);

    if (!enabled || highlights.length === 0) {
      return escapeHtml(cleanText);
    }

    // Sắp xếp highlight theo startOffset
    const sorted = [...highlights].sort((a, b) => a.startOffset - b.startOffset);

    // Ghép và lọc tránh trùng lặp đè lên nhau gây nhân đôi chữ
    const ranges: Array<{ start: number; end: number; id: string; color: string }> = [];
    for (const hl of sorted) {
      if (hl.startOffset >= cleanText.length || hl.endOffset <= hl.startOffset) continue;
      const start = Math.max(0, hl.startOffset);
      const end = Math.min(cleanText.length, hl.endOffset);

      if (ranges.length === 0) {
        ranges.push({ start, end, id: hl.id, color: hl.color });
      } else {
        const prev = ranges[ranges.length - 1];
        if (start < prev.end) {
          if (end > prev.end) {
            ranges.push({ start: prev.end, end, id: hl.id, color: hl.color });
          }
        } else {
          ranges.push({ start, end, id: hl.id, color: hl.color });
        }
      }
    }

    if (ranges.length === 0) return escapeHtml(cleanText);

    let result = '';
    let lastIndex = 0;

    ranges.forEach(range => {
      if (range.start > lastIndex) {
        result += escapeHtml(cleanText.substring(lastIndex, range.start));
      }
      result += `<mark class="highlight-mark cursor-pointer transition-opacity hover:opacity-75 select-text" style="background-color: ${range.color}; padding: 2px 1px; border-radius: 3px;" data-highlight-id="${range.id}" title="Chạm/Click để xóa highlight">${escapeHtml(cleanText.substring(range.start, range.end))}</mark>`;
      lastIndex = range.end;
    });

    if (lastIndex < cleanText.length) {
      result += escapeHtml(cleanText.substring(lastIndex));
    }

    return result;
  }, [html, highlights, enabled]);

  return (
    <div className="relative">
      {/* Color picker toolbar — luôn hiển thị ở trên cùng, hỗ trợ cả mobile */}
      {enabled && (
        <div className="mb-3 p-2.5 bg-gradient-to-r from-amber-50/90 via-orange-50/40 to-white border border-amber-200/90 rounded-xl shadow-xs highlight-color-picker">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Bộ chọn màu */}
            <div className="flex items-center gap-2">
              <Highlighter className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span className="text-xs font-bold text-gray-700">Màu highlight:</span>
              <div className="flex items-center gap-1.5">
                {(Object.keys(colors) as HighlightColor[]).map(color => (
                  <button
                    key={color}
                    type="button"
                    onTouchStart={(e) => {
                      e.preventDefault();
                      onSelectColor(color);
                      applyHighlightWithColor(color);
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onSelectColor(color);
                      applyHighlightWithColor(color);
                    }}
                    onClick={() => {
                      onSelectColor(color);
                      applyHighlightWithColor(color);
                    }}
                    className={`w-7 h-7 rounded-lg border-2 transition-all cursor-pointer flex items-center justify-center active:scale-90 ${
                      selectedColor === color
                        ? 'border-gray-900 ring-2 ring-amber-400 scale-110 shadow-sm'
                        : 'border-white hover:scale-105 shadow-xs'
                    }`}
                    style={{ backgroundColor: colors[color] }}
                    title={`Chọn màu ${color}${currentSelection ? ' (Chạm để highlight ngay)' : ''}`}
                    aria-label={`Chọn màu ${color}`}
                  >
                    {selectedColor === color && (
                      <Check className="w-3.5 h-3.5 text-gray-800 stroke-[3]" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Trạng thái / Nút hành động Highlight */}
            <div className="flex items-center gap-2">
              {currentSelection ? (
                <button
                  type="button"
                  onTouchStart={(e) => {
                    e.preventDefault();
                    applyHighlight();
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={applyHighlight}
                  className="highlight-toolbar inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-gray-900 shadow-md transition-all animate-pulse hover:scale-105 cursor-pointer border border-amber-400/80 active:scale-95"
                  style={{ backgroundColor: colors[selectedColor] }}
                >
                  <Palette className="w-3.5 h-3.5" />
                  Highlight ngay ({currentSelection.text.length > 12 ? `${currentSelection.text.slice(0, 12)}…` : currentSelection.text})
                </button>
              ) : (
                <span className="text-[11px] text-gray-500 font-medium">
                  💡 Bôi đen chữ rồi chạm màu để highlight
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Selection toolbar — hiển thị ngay cạnh chữ được bôi đen */}
      {showToolbar && currentSelection && (
        <div
          className="fixed z-50 bg-white shadow-2xl border border-gray-200 rounded-xl p-1.5 flex items-center gap-1.5 animate-in fade-in duration-150 highlight-toolbar"
          style={{
            top: `${toolbarPosition.top}px`,
            left: `${toolbarPosition.left}px`,
            transform: 'translateX(-50%)',
          }}
        >
          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              applyHighlight();
            }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={applyHighlight}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-gray-900 shadow-xs transition-all hover:scale-105 active:scale-95 cursor-pointer border border-black/10"
            style={{ 
              backgroundColor: colors[selectedColor],
            }}
          >
            <Palette className="w-3.5 h-3.5" />
            Highlight
          </button>
          <div className="h-4 w-px bg-gray-200" />
          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              setShowToolbar(false);
              setCurrentSelection(null);
              window.getSelection()?.removeAllRanges();
            }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setShowToolbar(false);
              setCurrentSelection(null);
              window.getSelection()?.removeAllRanges();
            }}
            className="px-2 py-1 text-xs text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded cursor-pointer"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>
      )}

      {/* Đoạn văn bài đọc */}
      <article
        ref={contentRef}
        className="prose prose-sm max-w-none text-slate-800 leading-relaxed whitespace-pre-wrap [&>p]:mb-4 select-text"
        onMouseUp={updateSelection}
        onTouchEnd={updateSelection}
        style={{ userSelect: enabled ? 'text' : 'none' }}
        dangerouslySetInnerHTML={{ __html: highlightedHtml }}
      />
    </div>
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
