/**
 * Component hiển thị passage với khả năng highlight text
 * Học viên có thể select text và bôi màu để ghi chú
 */
import { useEffect, useRef, useState, useMemo } from 'react';
import { Highlighter, Palette } from 'lucide-react';
import type { TextHighlight, HighlightColor } from '../../../../hooks/exam/useTextHighlight';

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

  // Handle text selection
  const handleMouseUp = () => {
    if (!enabled) return;
    
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      setShowToolbar(false);
      return;
    }

    const text = selection.toString().trim();
    if (text.length === 0) {
      setShowToolbar(false);
      return;
    }

    // Get selection position to show toolbar
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    // Calculate offset in full text content
    const container = contentRef.current;
    if (!container) return;

    const textContent = container.textContent || '';
    const beforeRange = range.cloneRange();
    beforeRange.selectNodeContents(container);
    beforeRange.setEnd(range.startContainer, range.startOffset);
    const startOffset = beforeRange.toString().length;
    const endOffset = startOffset + text.length;

    setCurrentSelection({ text, start: startOffset, end: endOffset });
    setToolbarPosition({
      top: rect.top - 60 + window.scrollY,
      left: rect.left + rect.width / 2,
    });
    setShowToolbar(true);
  };

  // Apply highlight
  const applyHighlight = () => {
    if (!currentSelection) return;

    onAddHighlight({
      text: currentSelection.text,
      startOffset: currentSelection.start,
      endOffset: currentSelection.end,
      color: colors[selectedColor],
    });

    // Clear selection
    window.getSelection()?.removeAllRanges();
    setShowToolbar(false);
    setCurrentSelection(null);
  };

  // Handle click on highlighted text to remove
  useEffect(() => {
    const container = contentRef.current;
    if (!container || !enabled) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('highlight-mark')) {
        const id = target.dataset.highlightId;
        if (id && window.confirm('Xóa highlight này?')) {
          onRemoveHighlight(id);
        }
      }
    };

    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
  }, [onRemoveHighlight, enabled]);

  // Apply highlights to HTML content
  const highlightedHtml = useMemo(() => {
    if (!enabled || highlights.length === 0) {
      return html;
    }

    // Create a temporary container to extract text
    const temp = document.createElement('div');
    temp.innerHTML = html;
    const plainText = temp.textContent || '';

    // Sort highlights by start offset
    const sorted = [...highlights].sort((a, b) => a.startOffset - b.startOffset);

    // Build ranges for highlighting
    const ranges: Array<{ start: number; end: number; id: string; color: string }> = [];
    sorted.forEach(hl => {
      if (hl.startOffset < plainText.length && hl.endOffset <= plainText.length) {
        ranges.push({
          start: hl.startOffset,
          end: hl.endOffset,
          id: hl.id,
          color: hl.color,
        });
      }
    });

    if (ranges.length === 0) return html;

    // Build highlighted text
    let result = '';
    let lastIndex = 0;

    ranges.forEach(range => {
      // Text before highlight
      if (range.start > lastIndex) {
        result += escapeHtml(plainText.substring(lastIndex, range.start));
      }
      
      // Highlighted text
      result += `<mark class="highlight-mark cursor-pointer transition-opacity hover:opacity-75" style="background-color: ${range.color}; padding: 2px 0; border-radius: 2px;" data-highlight-id="${range.id}" title="Click để xóa">${escapeHtml(plainText.substring(range.start, range.end))}</mark>`;
      
      lastIndex = range.end;
    });

    // Remaining text
    if (lastIndex < plainText.length) {
      result += escapeHtml(plainText.substring(lastIndex));
    }

    return result;
  }, [html, highlights, enabled]);

  return (
    <div className="relative">
      {/* Color picker toolbar */}
      {enabled && (
        <div className="mb-3 flex items-center gap-2 p-2 bg-gradient-to-r from-amber-50 to-white border border-amber-200 rounded-lg">
          <Highlighter className="w-4 h-4 text-amber-600" />
          <span className="text-xs font-medium text-gray-700">Chọn màu highlight:</span>
          <div className="flex gap-1">
            {(Object.keys(colors) as HighlightColor[]).map(color => (
              <button
                key={color}
                type="button"
                onClick={() => onSelectColor(color)}
                className={`w-6 h-6 rounded-md border-2 transition-all hover:scale-110 ${
                  selectedColor === color
                    ? 'border-gray-800 ring-2 ring-gray-300'
                    : 'border-gray-200'
                }`}
                style={{ backgroundColor: colors[color] }}
                title={color.charAt(0).toUpperCase() + color.slice(1)}
                aria-label={`Chọn màu ${color}`}
              />
            ))}
          </div>
          <span className="text-[10px] text-gray-500 ml-auto">
            Chọn text rồi nhấn "Highlight"
          </span>
        </div>
      )}

      {/* Selection toolbar */}
      {showToolbar && (
        <div
          className="fixed z-50 bg-white shadow-xl border border-gray-200 rounded-lg p-2 flex items-center gap-2 animate-in fade-in duration-150"
          style={{
            top: `${toolbarPosition.top}px`,
            left: `${toolbarPosition.left}px`,
            transform: 'translateX(-50%)',
          }}
        >
          <button
            type="button"
            onClick={applyHighlight}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all hover:scale-105"
            style={{ 
              backgroundColor: colors[selectedColor],
              color: '#1f2937'
            }}
          >
            <Palette className="w-3.5 h-3.5" />
            Highlight
          </button>
          <button
            type="button"
            onClick={() => setShowToolbar(false)}
            className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>
      )}

      {/* Passage content */}
      <article
        ref={contentRef}
        className="prose prose-sm max-w-none text-slate-800 leading-relaxed [&>p]:mb-4 select-text"
        onMouseUp={handleMouseUp}
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
