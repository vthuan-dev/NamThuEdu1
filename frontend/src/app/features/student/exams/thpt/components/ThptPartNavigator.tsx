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

  return (
    <aside className="rounded-2xl bg-white border border-slate-200 p-4 sticky top-24">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Tiến độ</h3>
        <span className="text-xs font-bold text-slate-700">{answered}/{total}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mb-4">
        <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${total ? (answered / total) * 100 : 0}%` }} />
      </div>

      <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
        {config.sections.map((s, idx) => {
          const items = perSection[idx];
          const cnt = items.filter((x) => x.answered).length;
          const isActive = activeIdx === idx;
          return (
            <div key={s.id}>
              <button
                type="button"
                onClick={() => onSectionChange(idx)}
                className={`w-full text-left px-2 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{s.title}</span>
                  <span className="text-[10px] font-semibold text-slate-400 flex-shrink-0">{cnt}/{items.length}</span>
                </div>
              </button>
              <div className="grid grid-cols-7 gap-1 mt-1.5 px-1">
                {items.map((it) => (
                  <button
                    key={it.qn}
                    type="button"
                    onClick={() => onSectionChange(idx)}
                    className={`aspect-square text-[11px] font-bold rounded-md transition-all cursor-pointer ${
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
