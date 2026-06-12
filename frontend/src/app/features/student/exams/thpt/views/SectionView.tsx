import { useMemo } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { ThptAnswers, ThptSection, ViewMode } from '../types';
import { ThptSpeakingRecorder } from '../components/ThptSpeakingRecorder';

const THEME = {
  primary: '#2563EB',
  success: '#10B981',
  error: '#EF4444',
};
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

interface Props {
  section: ThptSection;
  answers: ThptAnswers;
  correctAnswers?: ThptAnswers;
  onAnswerChange: (key: string, value: boolean | string) => void;
  mode: ViewMode;
  submissionId?: number | null;
}

export function SectionView({ section, answers, correctAnswers, onAnswerChange, mode, submissionId }: Props) {
  return (
    <section className="space-y-5">
      <header className="rounded-2xl bg-white border border-slate-200 p-5">
        <h2 className="text-lg font-bold text-slate-900">{section.title}</h2>
        {section.instructions && (
          <p className="text-sm text-slate-600 mt-1 leading-relaxed">{section.instructions}</p>
        )}
      </header>
      <Body section={section} answers={answers} correctAnswers={correctAnswers} onAnswerChange={onAnswerChange} mode={mode} submissionId={submissionId} />
    </section>
  );
}

function Body({ section, answers, correctAnswers, onAnswerChange, mode, submissionId }: Props) {
  const isReview = mode === 'review';

  switch (section.type) {
    case 'phonetics':
      return (
        <>
          {section.items.map((item) => {
            const key = `q${item.question_number}`;
            const userVal = String(answers[key] ?? '');
            const correctVal = String(correctAnswers?.[key] ?? '');
            return (
              <QCard key={key} n={item.question_number}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {item.words.map((w) => (
                    <ChoiceButton
                      key={w.id}
                      letter={w.id}
                      label={w.text}
                      sub={section.variant === 'pronunciation' ? w.underline : undefined}
                      picked={userVal === w.id}
                      correct={isReview && correctVal === w.id}
                      wrong={isReview && userVal === w.id && correctVal !== w.id}
                      disabled={isReview}
                      onClick={() => onAnswerChange(key, w.id)}
                    />
                  ))}
                </div>
              </QCard>
            );
          })}
        </>
      );

    case 'mc_questions':
    case 'error_identification': {
      const isError = section.type === 'error_identification';
      return (
        <>
          {section.items.map((item: any) => {
            const key = `q${item.question_number}`;
            const userVal = String(answers[key] ?? '');
            const correctVal = String(correctAnswers?.[key] ?? '');
            const options = isError ? item.segments : item.options;
            return (
              <QCard key={key} n={item.question_number}>
                {!isError && item.prompt && (
                  <p className="text-sm text-slate-800 leading-relaxed font-medium mb-3">{item.prompt}</p>
                )}
                {isError && item.sentence && (
                  <p className="text-sm text-slate-700 italic mb-3">{item.sentence}</p>
                )}
                <div className={isError ? 'grid grid-cols-2 sm:grid-cols-4 gap-2' : 'space-y-2'}>
                  {options.map((opt: any) => (
                    <ChoiceButton
                      key={opt.id}
                      letter={opt.id}
                      label={opt.text}
                      picked={userVal === opt.id}
                      correct={isReview && correctVal === opt.id}
                      wrong={isReview && userVal === opt.id && correctVal !== opt.id}
                      disabled={isReview}
                      onClick={() => onAnswerChange(key, opt.id)}
                      block={!isError}
                    />
                  ))}
                </div>
              </QCard>
            );
          })}
        </>
      );
    }

    case 'word_form':
      return (
        <>
          {section.items.map((item) => {
            const key = `q${item.question_number}`;
            return (
              <QCard key={key} n={item.question_number}>
                <p className="text-sm text-slate-800 mb-2">
                  {item.sentence}{' '}
                  {item.root_word && (
                    <span className="font-bold text-blue-700">({item.root_word})</span>
                  )}
                </p>
                <TextAnswer
                  value={String(answers[key] ?? '')}
                  correct={correctAnswers?.[key] as string | undefined}
                  isReview={isReview}
                  onChange={(v) => onAnswerChange(key, v)}
                />
              </QCard>
            );
          })}
        </>
      );

    case 'listening': {
      const sec = section as any;
      return (
        <>
          {sec.audio_url && (
            <div className="rounded-2xl bg-white border border-slate-200 p-4">
              <audio controls src={sec.audio_url} className="w-full" />
            </div>
          )}
          {sec.items.map((item: any) => {
            const key = `q${item.question_number}`;
            const userVal = String(answers[key] ?? '');
            const correctVal = String(correctAnswers?.[key] ?? '');
            return (
              <QCard key={key} n={item.question_number}>
                {item.prompt && (
                  <p className="text-sm text-slate-800 leading-relaxed font-medium mb-3">{item.prompt}</p>
                )}
                <div className="space-y-2">
                  {item.options.map((opt: any) => (
                    <ChoiceButton
                      key={opt.id}
                      letter={opt.id}
                      label={opt.text}
                      picked={userVal === opt.id}
                      correct={isReview && correctVal === opt.id}
                      wrong={isReview && userVal === opt.id && correctVal !== opt.id}
                      disabled={isReview}
                      onClick={() => onAnswerChange(key, opt.id)}
                      block
                    />
                  ))}
                </div>
              </QCard>
            );
          })}
        </>
      );
    }

    case 'speaking': {
      const sec = section as any;
      return (
        <>
          {sec.items.map((item: any) => {
            const key = `q${item.question_number}`;
            const recorded = String(answers[key] ?? '').trim() !== '';
            return (
              <ThptSpeakingRecorder
                key={key}
                submissionId={submissionId ?? null}
                questionNumber={item.question_number}
                prompt={item.prompt}
                prepSeconds={Number(item.prep_seconds ?? 30)}
                speakSeconds={Number(item.speak_seconds ?? 120)}
                recorded={recorded || isReview}
                onRecorded={() => onAnswerChange(key, '[recorded]')}
              />
            );
          })}
        </>
      );
    }

    case 'sentence_transformation':
      return (
        <>
          {section.items.map((item) => {
            const key = `q${item.question_number}`;
            return (
              <QCard key={key} n={item.question_number}>
                <p className="text-sm text-slate-800 mb-2">{item.original}</p>
                {(item.lead_in || item.prompt_word) && (
                  <p className="text-xs text-slate-500 mb-2">
                    {item.lead_in && <>➜ <span className="font-semibold">{item.lead_in}</span> </>}
                    {item.prompt_word && <span className="ml-2">(dùng từ: <strong>{item.prompt_word}</strong>)</span>}
                  </p>
                )}
                <TextAnswer
                  value={String(answers[key] ?? '')}
                  correct={correctAnswers?.[key] as string | undefined}
                  isReview={isReview}
                  onChange={(v) => onAnswerChange(key, v)}
                  multiline
                />
              </QCard>
            );
          })}
        </>
      );

    case 'tf_group':
      return (
        <>
          {section.items.map((item) => (
            <QCard key={item.question_number} n={item.question_number}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-blue-700 mb-1">
                    {item.context_style ?? 'Notice'}
                  </div>
                  <pre className="whitespace-pre-wrap text-sm text-slate-800 font-mono leading-relaxed">
                    {item.context}
                  </pre>
                </div>
                <div className="space-y-2">
                  {item.statements.map((s, si) => (
                    <TfStatementRow
                      key={s.id}
                      idx={si}
                      text={s.text}
                      qKey={`q${item.question_number}.s${si + 1}`}
                      answers={answers}
                      correctAnswers={correctAnswers}
                      onAnswerChange={onAnswerChange}
                      isReview={isReview}
                    />
                  ))}
                </div>
              </div>
            </QCard>
          ))}
        </>
      );

    case 'matching':
      return (
        <>
          {section.items.map((item) => (
            <QCard key={item.question_number} n={item.question_number}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  {item.list_1.map((line, i) => {
                    const key = `q${item.question_number}.${i + 1}`;
                    const userVal = String(answers[key] ?? '');
                    const correctVal = String(correctAnswers?.[key] ?? '');
                    const isCorrect = isReview && userVal && userVal === correctVal;
                    const isWrong = isReview && userVal !== correctVal;
                    return (
                      <div
                        key={i}
                        className={`rounded-lg border p-2.5 flex items-start gap-2 ${
                          isCorrect ? 'border-emerald-300 bg-emerald-50/50' : isWrong ? 'border-red-300 bg-red-50/50' : 'border-slate-200'
                        }`}
                      >
                        <span className="text-xs font-bold text-slate-500 w-5 mt-1">{i + 1}.</span>
                        <p className="flex-1 text-sm text-slate-800 leading-snug">{line}</p>
                        <select
                          value={userVal}
                          onChange={(e) => onAnswerChange(key, e.target.value)}
                          disabled={isReview}
                          className="w-14 text-sm font-bold text-center border border-slate-300 rounded-md px-1 py-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-default"
                        >
                          <option value="">—</option>
                          {LETTERS.map((L) => (<option key={L} value={L}>{L}</option>))}
                        </select>
                        {isReview && isWrong && (
                          <span className="text-xs font-bold text-emerald-700 whitespace-nowrap mt-1">➜ {correctVal}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-3 space-y-2">
                  {item.list_2.map((line, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-xs font-bold text-blue-700 w-5 mt-0.5">{LETTERS[i]}.</span>
                      <p className="flex-1 text-sm text-slate-700 leading-snug">{line}</p>
                    </div>
                  ))}
                </div>
              </div>
            </QCard>
          ))}
        </>
      );

    case 'mc_cloze':
      return (
        <>
          <PassageBox text={section.passage} />
          {section.blanks.map((b) => {
            const key = `q${b.question_number}`;
            const userVal = String(answers[key] ?? '');
            const correctVal = String(correctAnswers?.[key] ?? '');
            return (
              <QCard key={key} n={b.question_number}>
                <div className="space-y-2">
                  {b.options.map((opt) => (
                    <ChoiceButton
                      key={opt.id}
                      letter={opt.id}
                      label={opt.text}
                      picked={userVal === opt.id}
                      correct={isReview && correctVal === opt.id}
                      wrong={isReview && userVal === opt.id && correctVal !== opt.id}
                      disabled={isReview}
                      onClick={() => onAnswerChange(key, opt.id)}
                      block
                    />
                  ))}
                </div>
              </QCard>
            );
          })}
        </>
      );

    case 'word_bank_cloze':
      return (
        <>
          {section.word_bank.length > 0 && (
            <div className="rounded-2xl bg-white border border-slate-200 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Ngân hàng từ</p>
              <div className="flex flex-wrap gap-2">
                {section.word_bank.map((w, i) => (
                  <span key={i} className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-semibold">
                    {w}
                  </span>
                ))}
              </div>
            </div>
          )}
          <ClozePassage
            passage={section.passage}
            answers={answers}
            correctAnswers={correctAnswers}
            onAnswerChange={onAnswerChange}
            isReview={isReview}
          />
        </>
      );

    case 'open_cloze':
      return (
        <ClozePassage
          passage={section.passage}
          answers={answers}
          correctAnswers={correctAnswers}
          onAnswerChange={onAnswerChange}
          isReview={isReview}
        />
      );

    case 'reading_mixed':
      return (
        <>
          <PassageBox text={section.passage} markers />
          {section.items.map((item: any) => (
            <QCard key={item.question_number} n={item.question_number}>
              {item.kind === 'tf_group' && (
                <div className="space-y-2">
                  {item.context_paragraph_ref && (
                    <p className="text-xs italic text-slate-500 mb-1">{item.context_paragraph_ref}</p>
                  )}
                  {item.statements.map((s: any, si: number) => (
                    <TfStatementRow
                      key={s.id}
                      idx={si}
                      text={s.text}
                      qKey={`q${item.question_number}.s${si + 1}`}
                      answers={answers}
                      correctAnswers={correctAnswers}
                      onAnswerChange={onAnswerChange}
                      isReview={isReview}
                    />
                  ))}
                </div>
              )}
              {item.kind === 'mc' && (
                <div className="space-y-2">
                  <p className="text-sm text-slate-800 font-medium mb-1">{item.prompt}</p>
                  {item.options.map((opt: any) => {
                    const key = `q${item.question_number}`;
                    const userVal = String(answers[key] ?? '');
                    const correctVal = String(correctAnswers?.[key] ?? '');
                    return (
                      <ChoiceButton
                        key={opt.id}
                        letter={opt.id}
                        label={opt.text}
                        picked={userVal === opt.id}
                        correct={isReview && correctVal === opt.id}
                        wrong={isReview && userVal === opt.id && correctVal !== opt.id}
                        disabled={isReview}
                        onClick={() => onAnswerChange(key, opt.id)}
                        block
                      />
                    );
                  })}
                </div>
              )}
              {item.kind === 'sentence_insertion' && (
                <div className="space-y-2">
                  <p className="text-sm text-slate-800 font-medium">{item.prompt}</p>
                  <blockquote className="border-l-4 border-blue-300 pl-3 py-1 italic text-sm text-slate-700 bg-blue-50/30 rounded-r">
                    {item.sentence_to_insert}
                  </blockquote>
                  <div className="flex items-center gap-2">
                    {['A', 'B', 'C', 'D'].map((m) => {
                      const key = `q${item.question_number}`;
                      const userVal = String(answers[key] ?? '');
                      const correctVal = String(correctAnswers?.[key] ?? '');
                      const picked = userVal === m;
                      const correct = isReview && correctVal === m;
                      const wrong = isReview && picked && correctVal !== m;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => onAnswerChange(key, m)}
                          disabled={isReview}
                          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all cursor-pointer disabled:cursor-default ${
                            correct ? 'text-white' : wrong ? 'text-white' : picked ? 'text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-blue-400'
                          }`}
                          style={correct ? { backgroundColor: THEME.success } : wrong ? { backgroundColor: THEME.error } : picked ? { backgroundColor: THEME.primary } : {}}
                        >
                          [{m}]
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </QCard>
          ))}
        </>
      );

    default:
      return null;
  }
}

// ── Reusable pieces ──────────────────────────────────────────────────────────
function QCard({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <article className="rounded-2xl bg-white border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white text-sm font-bold">
          {n}
        </span>
        <h3 className="text-sm font-bold text-slate-700">Câu {n}</h3>
      </div>
      {children}
    </article>
  );
}

function ChoiceButton({
  letter,
  label,
  sub,
  picked,
  correct,
  wrong,
  disabled,
  onClick,
  block,
}: {
  letter: string;
  label: string;
  sub?: string;
  picked: boolean;
  correct?: boolean;
  wrong?: boolean;
  disabled?: boolean;
  onClick: () => void;
  block?: boolean;
}) {
  const border = correct
    ? 'border-emerald-400 bg-emerald-50'
    : wrong
    ? 'border-red-400 bg-red-50'
    : picked
    ? 'border-blue-400 bg-blue-50'
    : 'border-slate-200 hover:border-blue-300';
  const badge = correct
    ? 'bg-emerald-500 text-white'
    : wrong
    ? 'bg-red-500 text-white'
    : picked
    ? 'bg-blue-500 text-white'
    : 'bg-slate-100 text-slate-500';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-left flex items-center gap-2.5 rounded-lg border p-2.5 transition-colors cursor-pointer disabled:cursor-default ${border} ${block ? 'w-full' : ''}`}
    >
      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${badge}`}>
        {letter}
      </span>
      <span className="flex-1 min-w-0">
        <span className="text-sm text-slate-800">{label || <span className="text-slate-300">…</span>}</span>
        {sub && <span className="block text-[11px] text-slate-500">[{sub}]</span>}
      </span>
      {correct && <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
      {wrong && <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />}
    </button>
  );
}

function TfStatementRow({
  idx,
  text,
  qKey,
  answers,
  correctAnswers,
  onAnswerChange,
  isReview,
}: {
  idx: number;
  text: string;
  qKey: string;
  answers: ThptAnswers;
  correctAnswers?: ThptAnswers;
  onAnswerChange: (key: string, v: boolean) => void;
  isReview: boolean;
}) {
  const userVal = answers[qKey];
  const correctVal = correctAnswers?.[qKey];
  const isCorrect = isReview && userVal !== undefined && userVal === correctVal;
  const isWrong = isReview && userVal !== undefined && userVal !== correctVal;
  return (
    <div
      className={`rounded-lg border p-3 flex items-start gap-3 ${
        isCorrect ? 'border-emerald-300 bg-emerald-50/50' : isWrong ? 'border-red-300 bg-red-50/50' : 'border-slate-200'
      }`}
    >
      <span className="text-xs font-bold text-slate-500 w-5 mt-0.5">{idx + 1}.</span>
      <p className="flex-1 text-sm text-slate-800 leading-relaxed">{text}</p>
      <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-slate-100 flex-shrink-0">
        <button
          type="button"
          onClick={() => onAnswerChange(qKey, true)}
          disabled={isReview}
          className={`px-3 py-1.5 text-xs font-bold rounded transition-all cursor-pointer disabled:cursor-default ${userVal === true ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500'}`}
        >
          T
        </button>
        <button
          type="button"
          onClick={() => onAnswerChange(qKey, false)}
          disabled={isReview}
          className={`px-3 py-1.5 text-xs font-bold rounded transition-all cursor-pointer disabled:cursor-default ${userVal === false ? 'bg-red-500 text-white shadow-sm' : 'text-slate-500'}`}
        >
          F
        </button>
      </div>
      {isReview && (isWrong || userVal === undefined) && (
        <span className="text-[11px] font-bold text-emerald-700 whitespace-nowrap mt-1">
          {correctVal ? 'TRUE' : 'FALSE'}
        </span>
      )}
    </div>
  );
}

function TextAnswer({
  value,
  correct,
  isReview,
  onChange,
  multiline,
}: {
  value: string;
  correct?: string;
  isReview: boolean;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  const isCorrect = isReview && value && correct && value.trim().toLowerCase() === correct.trim().toLowerCase();
  const cls = `w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 ${
    isReview ? (isCorrect ? 'border-emerald-400 bg-emerald-50' : 'border-red-400 bg-red-50') : 'border-slate-300'
  }`;
  return (
    <div>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} disabled={isReview} rows={2} className={cls} placeholder="Câu trả lời của bạn..." />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} disabled={isReview} className={cls} placeholder="Câu trả lời..." />
      )}
      {isReview && !isCorrect && correct && (
        <p className="text-xs text-emerald-700 font-semibold mt-1">Đáp án: {correct}</p>
      )}
    </div>
  );
}

function PassageBox({ text, markers }: { text: string; markers?: boolean }) {
  const segs = useMemo(() => {
    if (!markers) return null;
    const parts: Array<{ kind: 'text' | 'marker'; value: string }> = [];
    const re = /\[([ABCD])\]/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) parts.push({ kind: 'text', value: text.slice(last, m.index) });
      parts.push({ kind: 'marker', value: m[1] });
      last = m.index + m[0].length;
    }
    if (last < text.length) parts.push({ kind: 'text', value: text.slice(last) });
    return parts;
  }, [text, markers]);

  return (
    <article className="rounded-2xl bg-white border border-slate-200 p-6">
      <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
        {segs
          ? segs.map((s, i) =>
              s.kind === 'text' ? (
                <span key={i}>{s.value}</span>
              ) : (
                <span key={i} className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-blue-100 text-blue-700 text-xs font-bold mx-0.5 align-middle">
                  [{s.value}]
                </span>
              )
            )
          : text}
      </div>
    </article>
  );
}

const CLOZE_RE = /\((\d{1,3})\)\s*_+/g;

function ClozePassage({
  passage,
  answers,
  correctAnswers,
  onAnswerChange,
  isReview,
}: {
  passage: string;
  answers: ThptAnswers;
  correctAnswers?: ThptAnswers;
  onAnswerChange: (key: string, v: string) => void;
  isReview: boolean;
}) {
  const tokens = useMemo(() => {
    const out: Array<{ type: 'text' | 'blank'; text?: string; qn?: number }> = [];
    let last = 0;
    const re = new RegExp(CLOZE_RE.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(passage)) !== null) {
      if (m.index > last) out.push({ type: 'text', text: passage.slice(last, m.index) });
      out.push({ type: 'blank', qn: parseInt(m[1]) });
      last = m.index + m[0].length;
    }
    if (last < passage.length) out.push({ type: 'text', text: passage.slice(last) });
    return out;
  }, [passage]);

  return (
    <article className="rounded-2xl bg-white border border-slate-200 p-6">
      <div className="text-base text-slate-800 leading-loose">
        {tokens.map((tok, i) => {
          if (tok.type === 'text') return <span key={i}>{tok.text}</span>;
          const key = `q${tok.qn}`;
          const userVal = String(answers[key] ?? '');
          const correctVal = String(correctAnswers?.[key] ?? '');
          const isCorrect = isReview && userVal && correctVal && userVal.trim().toLowerCase() === correctVal.trim().toLowerCase();
          const isWrong = isReview && userVal && !isCorrect;
          const isMissing = isReview && !userVal;
          return (
            <span key={i} className="inline-flex flex-col items-center align-middle mx-1">
              <span className="inline-flex items-center gap-1">
                <span className="text-xs font-bold text-blue-600 align-super">({tok.qn})</span>
                <input
                  type="text"
                  value={userVal}
                  onChange={(e) => onAnswerChange(key, e.target.value)}
                  disabled={isReview}
                  className={`inline-block min-w-[80px] max-w-[160px] text-center text-sm font-semibold border-b-2 bg-transparent focus:outline-none px-1 py-0.5 ${
                    isCorrect ? 'border-emerald-500 text-emerald-700' : isWrong ? 'border-red-500 text-red-700 line-through' : isMissing ? 'border-amber-400' : 'border-blue-400 focus:border-blue-600'
                  }`}
                  placeholder="..."
                />
              </span>
              {isReview && (isWrong || isMissing) && (
                <span className="text-[11px] mt-0.5 inline-flex items-center gap-1 text-emerald-700 font-bold whitespace-nowrap">
                  <CheckCircle2 className="w-3 h-3" />
                  {correctVal}
                </span>
              )}
            </span>
          );
        })}
      </div>
    </article>
  );
}
