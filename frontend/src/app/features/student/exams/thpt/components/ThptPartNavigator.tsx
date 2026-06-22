import { useCallback, useEffect, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';
import type { ThptConfig, ThptAnswers, ThptSection } from '../types';

interface Props {
  config: ThptConfig;
  answers: ThptAnswers;
  activeIdx: number;
  onSectionChange: (idx: number) => void;
}

interface QItem {
  qn: number;
  answered: boolean;
}

function sectionQuestions(s: ThptSection, answers: ThptAnswers): QItem[] {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(answers, k);
  const filled = (k: string) => !!String(answers[k] ?? '').trim();

  switch (s.type) {
    case 'phonetics':
    case 'mc_questions':
    case 'listening':
    case 'speaking':
    case 'error_identification':
      return s.items.map((it: any) => ({ qn: it.question_number, answered: has(`q${it.question_number}`) }));
    case 'word_form':
    case 'sentence_transformation':
      return s.items.map((it: any) => ({ qn: it.question_number, answered: filled(`q${it.question_number}`) }));
    case 'tf_group':
      return s.items.map((it) => ({
        qn: it.question_number,
        answered: it.statements.every((_, i) => has(`q${it.question_number}.s${i + 1}`)),
      }));
    case 'matching':
      return s.items.map((it) => ({
        qn: it.question_number,
        answered: [1, 2, 3, 4].every((i) => has(`q${it.question_number}.${i}`)),
      }));
    case 'reading_mixed':
      return s.items.map((it: any) => ({
        qn: it.question_number,
        answered: it.kind === 'tf_group'
          ? it.statements.every((_: any, i: number) => has(`q${it.question_number}.s${i + 1}`))
          : has(`q${it.question_number}`),
      }));
    case 'mc_cloze':
      return s.blanks.map((b) => ({ qn: b.question_number, answered: has(`q${b.question_number}`) }));
    case 'word_bank_cloze':
    case 'open_cloze':
      return s.blanks.map((b) => ({ qn: b.question_number, answered: filled(`q${b.question_number}`) }));
    default:
      return [];
  }
}

export function ThptPartNavigator({ config, answers, activeIdx, onSectionChange }: Props) {
  const perSection = config.sections.map((s) => sectionQuestions(s, answers));
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

  return (
    <aside
      data-thpt-nav
      className={`rounded-2xl bg-white border border-slate-200 p-4 ${pos ? 'fixed z-50 w-[280px]' : 'sticky top-24 self-start max-h-[calc(100vh-7rem)] overflow-y-auto'}`}
      style={pos ? { left: pos.x, top: pos.y, boxShadow: '0 12px 40px rgba(15,23,42,0.18)' } : undefined}
    >
      <div
        onMouseDown={onDragStart}
        className={`flex items-center justify-between mb-3 -mx-1 px-1 select-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        title="Kéo để di chuyển bảng"
      >
        <div className="flex items-center gap-1.5">
          <GripVertical className="w-4 h-4 text-slate-300" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Tiến độ</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700">{answered}/{total}</span>
          {pos && (
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

      <div className="space-y-2 max-h-[calc(100vh-14rem)] overflow-y-auto pr-1">
        {config.sections.map((s, idx) => {
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
              <div className="grid grid-cols-8 gap-1 mt-1 px-1">
                {items.map((it) => (
                  <button
                    key={it.qn}
                    type="button"
                    onClick={() => onSectionChange(idx)}
                    className={`aspect-square text-[10px] font-bold rounded transition-all cursor-pointer ${
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
