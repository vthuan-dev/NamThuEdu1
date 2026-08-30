import { useCallback, useEffect, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';
import type { ThptConfig, ThptAnswers, ThptSection } from '../types';

interface Props {
  config: ThptConfig;
  answers: ThptAnswers;
  activeIdx: number;
  onSectionChange: (idx: number) => void;
  /** Báo cho cha biết panel đang nổi (đã kéo ra khỏi vị trí mặc định) để cha thu gọn cột giữ chỗ. */
  onFloatingChange?: (floating: boolean) => void;
  /**
   * `sidebar` (mặc định, desktop): cột bên, kéo-thả được.
   * `sheet` (mobile): nội dung trần để nhúng trong bottom sheet — KHÔNG kéo-thả
   * (chỉ có handler chuột nên trên điện thoại vô dụng), và lưới câu giảm số cột
   * để từng ô đủ to cho ngón tay.
   */
  mode?: 'sidebar' | 'sheet';
}

interface QItem {
  qn: number;
  answered: boolean;
}

/**
 * Guard danh sách trong config đề. Panel Tiến độ nằm NGOÀI SectionErrorBoundary,
 * nên nếu một section thiếu `items`/`blanks`/`statements` thì `.map` trên
 * undefined sẽ sập CẢ trang làm bài (mất luôn nút Nộp bài). Luôn dùng asArray.
 */
function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * Index (0-based) của những dòng giáo viên thực sự nhập.
 *
 * Phải khứp `usedRows()` trong SectionView, vì panel này đếm số câu cần trả
 * lời còn SectionView quyết định học viên thấy gì. Lệch nhau là tiến độ không
 * bao giờ đầy — học viên tưỏng còn sót câu và tìm mãi không thấy.
 */
function usedIdx<T>(list: unknown, getText: (row: T) => unknown): number[] {
  const all = asArray<T>(list);
  const filled = all
    .map((row, i) => ({ row, i }))
    .filter(({ row }) => String(getText(row) ?? '').trim() !== '')
    .map(({ i }) => i);
  return filled.length > 0 ? filled : all.map((_, i) => i);
}

function sectionQuestions(s: ThptSection, answers: ThptAnswers): QItem[] {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(answers, k);
  const filled = (k: string) => !!String(answers[k] ?? '').trim();
  const items = asArray<any>((s as any).items);
  const blanks = asArray<any>((s as any).blanks);

  switch (s.type) {
    case 'phonetics':
    case 'mc_questions':
    case 'listening':
    case 'speaking':
    case 'error_identification':
      return items.map((it: any) => ({ qn: it.question_number, answered: has(`q${it.question_number}`) }));
    case 'word_form':
    case 'sentence_transformation':
      return items.map((it: any) => ({ qn: it.question_number, answered: filled(`q${it.question_number}`) }));
    case 'tf_group':
      return items.map((it: any) => ({
        qn: it.question_number,
        answered: usedIdx<any>(it.statements, (s) => s?.text).every((i) =>
          has(`q${it.question_number}.s${i + 1}`),
        ),
      }));
    case 'matching':
      return items.map((it: any) => ({
        qn: it.question_number,
        // Trước đây hardcode [1,2,3,4] nên bài chỉ dùng 2 dòng KHÔNG BAO GIỜ
        // được tính là xong → tiến độ kịt vĩnh viễn.
        answered: usedIdx<any>(it.list_1, (l) => l).every((i) =>
          has(`q${it.question_number}.${i + 1}`),
        ),
      }));
    case 'reading_mixed':
      return items.map((it: any) => ({
        qn: it.question_number,
        answered: it.kind === 'tf_group'
          ? usedIdx<any>(it.statements, (s) => s?.text).every((i) =>
              has(`q${it.question_number}.s${i + 1}`),
            )
          : has(`q${it.question_number}`),
      }));
    case 'mc_cloze':
      return blanks.map((b: any) => ({ qn: b.question_number, answered: has(`q${b.question_number}`) }));
    case 'word_bank_cloze':
    case 'open_cloze':
      return blanks.map((b: any) => ({ qn: b.question_number, answered: filled(`q${b.question_number}`) }));
    default:
      return [];
  }
}

/**
 * Tổng số câu và số câu đã trả lời của cả đề.
 *
 * Xuất ra ngoài để thanh dưới (`ThptBottomNav`) hiển thị "12/40 câu" bằng CHÍNH
 * phép đếm mà bảng Tiến độ dùng. Nếu mỗi chỗ tự đếm một kiểu thì hai con số sẽ
 * lệch nhau và học viên không biết tin số nào — đúng loại lỗi đã từng xảy ra khi
 * panel này hardcode [1,2,3,4] cho bài matching.
 */
export function countThptProgress(
  config: ThptConfig,
  answers: ThptAnswers,
): { answered: number; total: number } {
  const sections = asArray<ThptSection>(config?.sections);
  const perSection = sections.map((s) => sectionQuestions(s, answers));
  return {
    total: perSection.reduce((sum, arr) => sum + arr.length, 0),
    answered: perSection.reduce((sum, arr) => sum + arr.filter((x) => x.answered).length, 0),
  };
}

export function ThptPartNavigator({ config, answers, activeIdx, onSectionChange, onFloatingChange, mode = 'sidebar' }: Props) {
  const isSheet = mode === 'sheet';
  const sections = asArray<ThptSection>(config?.sections);
  const perSection = sections.map((s) => sectionQuestions(s, answers));
  const total = perSection.reduce((sum, arr) => sum + arr.length, 0);
  const answered = perSection.reduce((sum, arr) => sum + arr.filter((x) => x.answered).length, 0);

  // ─── Kéo-thả di chuyển panel (giống VSTEP) ────────────────────────────────
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    const panel = (e.currentTarget as HTMLElement).closest('[data-thpt-nav]') as HTMLElement | null;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    setDragging(true);
    e.preventDefault();
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const w = 300, h = 200;
      const x = Math.min(Math.max(8, e.clientX - dragRef.current.dx), window.innerWidth - w);
      const y = Math.min(Math.max(72, e.clientY - dragRef.current.dy), window.innerHeight - h);
      setPos({ x, y });
    };
    const onUp = () => { setDragging(false); dragRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging]);

  // Báo trạng thái floating cho cha để thu gọn cột giữ chỗ (tránh khoảng trắng thừa).
  useEffect(() => {
    onFloatingChange?.(pos !== null);
  }, [pos, onFloatingChange]);

  return (
    <aside
      data-thpt-nav
      className={
        isSheet
          ? 'rounded-none bg-white p-0'
          : `rounded-2xl bg-white border border-slate-200 p-4 ${pos ? 'fixed z-50 w-[280px]' : 'sticky top-24 self-start max-h-[calc(100vh-7rem)] overflow-y-auto'}`
      }
      style={!isSheet && pos ? { left: pos.x, top: pos.y, boxShadow: '0 12px 40px rgba(15,23,42,0.18)' } : undefined}
    >
      {/* Trong sheet, tiêu đề và nút đóng do sheet ở trang cha lo; ở đây chỉ cần
          dòng đếm tiến độ, và tuyệt đối không được có tay kéo. */}
      <div
        onMouseDown={isSheet ? undefined : onDragStart}
        className={
          isSheet
            ? 'flex items-center justify-between mb-3'
            : `flex items-center justify-between mb-3 -mx-1 px-1 select-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`
        }
        title={isSheet ? undefined : 'Kéo để di chuyển bảng'}
      >
        <div className="flex items-center gap-1.5">
          {!isSheet && <GripVertical className="w-4 h-4 text-slate-300" />}
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Tiến độ</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700">{answered}/{total}</span>
          {!isSheet && pos && (
            <button
              onClick={() => setPos(null)}
              className="text-[11px] font-semibold text-slate-400 hover:text-teal-600 transition-colors"
              title="Về vị trí mặc định"
            >
              Ghim lại
            </button>
          )}
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mb-4">
        <div className="h-full bg-teal-500 transition-all duration-300" style={{ width: `${total ? (answered / total) * 100 : 0}%` }} />
      </div>

      {/* Trong sheet, chiều cao do sheet cha giới hạn nên không đặt max-h riêng
          (hai lần cuộn lồng nhau rất khó dùng trên điện thoại). */}
      <div className={isSheet ? 'space-y-3' : 'space-y-2 max-h-[calc(100vh-14rem)] overflow-y-auto pr-1'}>
        {sections.map((s, idx) => {
          const items = perSection[idx];
          const cnt = items.filter((x) => x.answered).length;
          const done = cnt === items.length && items.length > 0;
          const isActive = activeIdx === idx;
          return (
            <div key={s.id}>
              <button
                type="button"
                onClick={() => onSectionChange(idx)}
                className={`w-full text-left px-2 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                  isActive ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{s.title}</span>
                  <span
                    className={`text-[10px] font-semibold flex-shrink-0 ${
                      done ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  >
                    {cnt}/{items.length}
                  </span>
                </div>
              </button>
              <div className={`grid gap-1 mt-1 px-1 ${isSheet ? 'grid-cols-6 gap-2' : 'grid-cols-8'}`}>
                {items.map((it) => (
                  <button
                    key={it.qn}
                    type="button"
                    onClick={() => onSectionChange(idx)}
                    className={`text-[10px] font-bold rounded transition-all cursor-pointer ${
                      isSheet ? 'min-h-10 text-xs' : 'aspect-square'
                    } ${
                      it.answered ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                    title={`Câu ${it.qn}`}
                  >
                    {it.qn}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-[11px] text-slate-500">
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-100 inline-block" /> Đã trả lời</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-100 inline-block" /> Chưa trả lời</div>
      </div>
    </aside>
  );
}
