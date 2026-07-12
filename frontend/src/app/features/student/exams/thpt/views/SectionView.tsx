import { useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, XCircle, Headphones, Mic, Sparkles, Loader2 } from 'lucide-react';
import type { ThptAnswers, ThptSection, ViewMode } from '../types';
import { ThptSpeakingRecorder } from '../components/ThptSpeakingRecorder';
import { splitPhoneticWord, formatErrorSentence } from '../../../../../../utils/examUtils';

const THEME = {
  primary: '#0D9488',
  success: '#10B981',
  error: '#EF4444',
};
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

// Nhãn ngắn theo loại phần thi — hiển thị trên header cho gọn gàng, có chủ đích.
const TYPE_LABEL: Record<string, string> = {
  listening: 'Nghe hiểu',
  speaking: 'Nói',
  writing: 'Viết',
  phonetics: 'Ngữ âm',
  mc_questions: 'Trắc nghiệm',
  word_form: 'Chia dạng từ',
  error_identification: 'Tìm lỗi sai',
  mc_cloze: 'Đọc điền',
  word_bank_cloze: 'Điền từ cho sẵn',
  open_cloze: 'Điền từ',
  tf_group: 'Đúng / Sai',
  reading_mixed: 'Đọc hiểu',
  matching: 'Nối câu',
  sentence_transformation: 'Viết lại câu',
};

interface Props {
  section: ThptSection;
  answers: ThptAnswers;
  correctAnswers?: ThptAnswers;
  onAnswerChange: (key: string, value: boolean | string) => void;
  mode: ViewMode;
  submissionId?: number | null;
  /** Kết quả AI chấm Nói theo câu (review): { q5: {score, feedback, ...}, ... } */
  speakingParts?: Record<string, any>;
  /** URL bản ghi âm Nói theo câu (review): { "5": url, "6": url } */
  speakingAudio?: Record<string, string>;
  /** Kết quả AI chấm Viết theo câu (review): { q2: {score, feedback, ...}, ... } */
  writingParts?: Record<string, any>;
  correctQuestions?: Record<string, boolean>;
  /** Ẩn header section (dùng khi trang ngoài đã có tiêu đề riêng) */
  hideHeader?: boolean;
}

export function SectionView({ section, answers, correctAnswers, onAnswerChange, mode, submissionId, speakingParts, speakingAudio, writingParts, correctQuestions, hideHeader }: Props) {
  const typeLabel = TYPE_LABEL[section.type] ?? 'Phần thi';
  // Chia đôi trái–phải cho dạng có bài đọc DÀI tách biệt khỏi câu hỏi
  // (mc_cloze, reading_mixed). word_bank_cloze/open_cloze KHÔNG chia vì ô
  // điền nằm ngay trong đoạn văn.
  const passageText = (section as any).passage as string | undefined;
  const isSplitReading =
    (section.type === 'mc_cloze' || section.type === 'reading_mixed') &&
    !!passageText && passageText.trim().length > 0;

  const headerEl = !hideHeader ? (
    // Ghim header khi cuộn để học viên luôn thấy dạng đề đang làm.
    // top-[68px] để nằm ngay dưới ThptTopBar (sticky top-0).
    <header className="sticky top-[68px] z-20 relative overflow-hidden rounded-2xl bg-white/95 backdrop-blur border border-slate-200 p-4 pl-6 shadow-sm">
      <span className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: THEME.primary }} />
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-teal-700 mb-1">
        {typeLabel}
      </span>
      <h2 className="text-lg font-bold text-slate-900 tracking-tight leading-snug">{section.title}</h2>
      {section.instructions && (
        <p className="text-sm text-slate-500 mt-1 leading-relaxed max-w-2xl line-clamp-2">{section.instructions}</p>
      )}
    </header>
  ) : null;

  if (isSplitReading) {
    return (
      <section className="space-y-5">
        {headerEl}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:h-[calc(100vh-16rem)]">
          {/* Cột bài đọc — cố định, cuộn riêng trên desktop */}
          <div className="lg:overflow-y-auto lg:pr-1">
            <PassageBox text={passageText!} markers={section.type === 'reading_mixed'} />
          </div>
          {/* Cột câu hỏi — cuộn riêng */}
          <div className="lg:overflow-y-auto lg:pr-1 space-y-5">
            <Body section={section} answers={answers} correctAnswers={correctAnswers} onAnswerChange={onAnswerChange} mode={mode} submissionId={submissionId} speakingParts={speakingParts} speakingAudio={speakingAudio} writingParts={writingParts} correctQuestions={correctQuestions} hidePassage />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      {headerEl}
      <Body section={section} answers={answers} correctAnswers={correctAnswers} onAnswerChange={onAnswerChange} mode={mode} submissionId={submissionId} speakingParts={speakingParts} speakingAudio={speakingAudio} writingParts={writingParts} correctQuestions={correctQuestions} />
    </section>
  );
}

function Body({ section, answers, correctAnswers, onAnswerChange, mode, submissionId, speakingParts, speakingAudio, writingParts, correctQuestions, hidePassage }: Props & { hidePassage?: boolean }) {
  const isReview = mode === 'review';
  // Đề Nói: mỗi lần chỉ cho ghi âm 1 đề. activeSpeakingQ = số câu đang ghi (hoặc null).
  const [activeSpeakingQ, setActiveSpeakingQ] = useState<number | null>(null);

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
                  {item.words.map((w) => {
                    // Phát âm: tự dò đuôi ed/s/es. Trọng âm: chỉ nhấn khi giáo viên đã đánh dấu.
                    const isStress = section.variant === 'stress';
                    const { before, mark, after } = splitPhoneticWord(w.text, w.underline, !isStress, w.underlineStart);
                    const wordLabel = mark ? (
                      <span>
                        {before}
                        <span className="italic underline underline-offset-2 decoration-2 font-semibold text-teal-700">{mark}</span>
                        {after}
                      </span>
                    ) : (
                      w.text
                    );
                    return (
                      <ChoiceButton
                        key={w.id}
                        letter={w.id}
                        label={wordLabel}
                        picked={userVal === w.id}
                        correct={isReview && correctVal === w.id}
                        wrong={isReview && userVal === w.id && correctVal !== w.id}
                        disabled={isReview}
                        onClick={() => onAnswerChange(key, w.id)}
                      />
                    );
                  })}
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
                  <div className="text-sm text-slate-800 leading-relaxed font-medium mb-3 space-y-1">
                    {item.prompt.split(/\s+(?=[a-e]\.\s)/i).map((part: string, i: number) => (
                      <p key={i} className="leading-relaxed" dangerouslySetInnerHTML={{ __html: part.trim() }} />
                    ))}
                  </div>
                )}
                {isError && item.sentence && (
                  <p className="text-sm text-slate-700 italic mb-3" dangerouslySetInnerHTML={{ __html: formatErrorSentence(item.sentence, item.segments) }} />
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
                  <span dangerouslySetInnerHTML={{ __html: item.sentence }} />{' '}
                  {item.root_word && (
                    <span className="font-bold text-teal-700">({item.root_word})</span>
                  )}
                </p>
                <TextAnswer
                  value={String(answers[key] ?? '')}
                  correct={correctAnswers?.[key] as string | undefined}
                  isCorrectMap={correctQuestions?.[key]}
                  isReview={isReview}
                  onChange={(v) => onAnswerChange(key, v)}
                />
              </QCard>
            );
          })}
        </>
      );

    case 'listening': {
      return (
        <div className="space-y-4">
          {section.audio_url && (
            <div className="rounded-xl border border-slate-200 bg-white p-3 flex items-center gap-3">
              <audio controls src={section.audio_url} className="w-full h-10" />
            </div>
          )}
          {(section.items as any[]).map((item) => {
            const key = `q${item.question_number}`;
            const kind = item.kind === 'fill_blank' ? 'fill_blank' : 'mc';
            if (kind === 'fill_blank') {
              return (
                <QCard key={key} n={item.question_number}>
                  {item.prompt && (
                    <p className="text-sm text-slate-800 mb-3 whitespace-pre-wrap">{item.prompt}</p>
                  )}
                  <TextAnswer
                    value={String(answers[key] ?? '')}
                    onChange={(v) => onAnswerChange?.(key, v)}
                    isReview={mode === 'review'}
                    correct={correctAnswers ? String(correctAnswers[key] ?? '') : undefined}
                    isCorrectMap={correctQuestions?.[key]}
                  />
                </QCard>
              );
            }
            const options = item.options ?? [];
            return (
              <QCard key={key} n={item.question_number}>
                {item.prompt && (
                  <p className="text-sm text-slate-800 mb-3 whitespace-pre-wrap">{item.prompt}</p>
                )}
                <div className="space-y-2">
                  {options.map((opt: any) => (
                    <ChoiceButton
                      key={opt.id}
                      letter={opt.id}
                      text={opt.text}
                      selected={answers[key] === opt.id}
                      correct={
                        mode === 'review' && correctAnswers
                          ? String(correctAnswers[key]) === String(opt.id)
                          : undefined
                      }
                      onClick={() => onAnswerChange?.(key, opt.id)}
                      disabled={mode === 'review'}
                    />
                  ))}
                </div>
              </QCard>
            );
          })}
        </div>
      );
    }

    case 'speaking': {
      const sec = section as any;
      return (
        <>
          {sec.items.map((item: any) => {
            const key = `q${item.question_number}`;
            const recorded = String(answers[key] ?? '').trim() !== '';
            const lockedByOther = activeSpeakingQ !== null && activeSpeakingQ !== item.question_number;
            // Review: hiển thị điểm AI + transcript + nghe lại; chưa chấm thì báo đang chấm.
            if (isReview) {
              return (
                <SpeakingResultCard
                  key={key}
                  n={item.question_number}
                  prompt={item.prompt}
                  result={speakingParts?.[key]}
                  audioUrl={speakingAudio?.[String(item.question_number)]}
                />
              );
            }
            return (
              <ThptSpeakingRecorder
                key={key}
                submissionId={submissionId ?? null}
                questionNumber={item.question_number}
                prompt={item.prompt}
                prepSeconds={Number(item.prep_seconds ?? 5)}
                speakSeconds={Number(item.speak_seconds ?? 120)}
                recorded={recorded}
                disabled={lockedByOther}
                onActiveChange={(busy) => setActiveSpeakingQ(busy ? item.question_number : null)}
                onRecorded={() => onAnswerChange(key, '[recorded]')}
              />
            );
          })}
        </>
      );
    }

    case 'writing': {
      return (
        <div className="space-y-4">
          {!isReview && (
            <div className="rounded-xl border border-teal-200 bg-teal-50/70 px-3.5 py-2.5 text-xs text-teal-900">
              Phần viết được AI chấm sau khi nộp; giáo viên có thể chấm lại. Hãy viết đầy đủ theo yêu cầu đề bài.
            </div>
          )}
          {(section.items as any[]).map((item) => {
            const key = `q${item.question_number}`;
            const val = String(answers[key] ?? '');
            const words = val.trim() ? val.trim().split(/\s+/).length : 0;
            const minW = item.min_words as number | undefined;
            const maxW = item.max_words as number | undefined;
            const ai = writingParts?.[key];

            if (isReview) {
              return (
                <WritingResultCard
                  key={key}
                  n={item.question_number}
                  prompt={item.prompt}
                  essay={val}
                  wordCount={words}
                  result={ai}
                />
              );
            }

            return (
              <QCard key={key} n={item.question_number}>
                {item.prompt && (
                  <div className="text-sm text-slate-800 mb-3 whitespace-pre-wrap leading-relaxed">
                    {item.prompt}
                  </div>
                )}
                {(minW || maxW) && (
                  <p className="text-xs text-slate-500 mb-2">
                    Gợi ý số từ:{' '}
                    {minW ? `tối thiểu ${minW}` : ''}
                    {minW && maxW ? ' · ' : ''}
                    {maxW ? `tối đa ${maxW}` : ''}
                    <span className="ml-2 font-semibold text-slate-700">({words} từ)</span>
                  </p>
                )}
                <textarea
                  value={val}
                  onChange={(e) => onAnswerChange?.(key, e.target.value)}
                  disabled={mode === 'review'}
                  rows={10}
                  placeholder="Viết bài của bạn tại đây…"
                  className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-3 focus:outline-none focus:ring-2 focus:ring-blue-200 resize-y disabled:bg-slate-50 disabled:text-slate-600"
                />
              </QCard>
            );
          })}
        </div>
      );
    }

    case 'sentence_transformation':
      return (
        <>
          {section.items.map((item) => {
            const key = `q${item.question_number}`;
            return (
              <QCard key={key} n={item.question_number}>
                <p className="text-sm text-slate-800 mb-2" dangerouslySetInnerHTML={{ __html: item.original }} />
                {(item.lead_in || item.prompt_word) && (
                  <p className="text-xs text-slate-500 mb-2">
                    {item.lead_in && <>➜ <span className="font-semibold">{item.lead_in}</span> </>}
                    {item.prompt_word && <span className="ml-2">(dùng từ: <strong>{item.prompt_word}</strong>)</span>}
                  </p>
                )}
                <TextAnswer
                  value={String(answers[key] ?? '')}
                  correct={correctAnswers?.[key] as string | undefined}
                  isCorrectMap={correctQuestions?.[key]}
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
                <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-4 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-teal-700">
                    {item.context_style ?? 'Notice'}
                  </div>
                  {item.context.split(/\n\s*\n/).filter(Boolean).map((p: string, i: number) => (
                    <pre key={i} className="whitespace-pre-wrap text-sm text-slate-800 font-mono leading-relaxed">
                      {p}
                    </pre>
                  ))}
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
                          className="w-14 text-sm font-bold text-center border border-slate-300 rounded-md px-1 py-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-200 disabled:cursor-default"
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
                <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-3 space-y-2">
                  {item.list_2.map((line, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-xs font-bold text-teal-700 w-5 mt-0.5">{LETTERS[i]}.</span>
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
          {!hidePassage && <PassageBox text={section.passage} />}
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
                  <span key={i} className="px-3 py-1 rounded-full bg-teal-50 text-teal-700 text-sm font-semibold">
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
          correctQuestions={correctQuestions}
          onAnswerChange={onAnswerChange}
          isReview={isReview}
        />
      );

    case 'reading_mixed':
      return (
        <>
          {!hidePassage && <PassageBox text={section.passage} markers />}
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
                  <div className="text-sm text-slate-800 font-medium mb-1 space-y-1">
                    {item.prompt.split(/\s+(?=[a-e]\.\s)/i).map((part: string, i: number) => (
                      <p key={i} className="leading-relaxed" dangerouslySetInnerHTML={{ __html: part.trim() }} />
                    ))}
                  </div>
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
                  <blockquote className="border-l-4 border-teal-300 pl-3 py-1 italic text-sm text-slate-700 bg-teal-50/40 rounded-r">
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
                            correct ? 'text-white' : wrong ? 'text-white' : picked ? 'text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-teal-400'
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
function SpeakingResultCard({ n, prompt, result, audioUrl }: { n: number; prompt: string; result?: any; audioUrl?: string }) {
  const graded = result && typeof result.score === 'number';
  const score = graded ? Number(result.score) : 0;
  const scoreColor = score >= 8 ? '#10B981' : score >= 6.5 ? '#0D9488' : score >= 5 ? '#F59E0B' : '#EF4444';
  const pron = result?.pronunciation_score;
  const content = result?.content_score;
  const suggestions: string[] = Array.isArray(result?.suggestions) ? result.suggestions : [];

  return (
    <article className="rounded-2xl bg-white border border-slate-200 p-5">
      <div className="flex items-center gap-2.5 mb-3.5">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-teal-600 text-white text-[13px] font-bold tabular-nums">{n}</span>
        <h3 className="text-[13px] font-semibold uppercase tracking-wider text-slate-400">Câu {n} · Nói</h3>
      </div>

      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-teal-50 text-teal-700 ring-1 ring-teal-100 flex-shrink-0">
          <Mic className="w-[18px] h-[18px]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-medium text-slate-800 leading-relaxed">{prompt}</p>
          {audioUrl && <audio controls src={audioUrl} className="w-full h-9 mt-2.5" />}
        </div>
      </div>

      {!graded ? (
        !audioUrl ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <XCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <p className="text-sm font-medium text-slate-500">Bạn chưa ghi âm câu này.</p>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <Loader2 className="w-4 h-4 animate-spin text-amber-600 flex-shrink-0" />
            <p className="text-sm font-medium text-amber-800">AI đang chấm phần Nói — quay lại sau ít phút để xem điểm &amp; nhận xét nhé.</p>
          </div>
        )
      ) : (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-4 p-4 bg-gradient-to-br from-teal-50/60 to-white border-b border-slate-100">
            <div className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 text-white" style={{ background: scoreColor }}>
              <span className="text-xl font-extrabold leading-none tabular-nums">{score.toFixed(1)}</span>
              <span className="text-[9px] font-bold opacity-85 mt-0.5">/ 10</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-teal-700 mb-1.5">
                <Sparkles className="w-3.5 h-3.5" /> AI chấm điểm
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {typeof pron === 'number' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600">Phát âm <b className="text-slate-800 tabular-nums">{Number(pron).toFixed(1)}</b></span>
                )}
                {typeof content === 'number' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600">Nội dung <b className="text-slate-800 tabular-nums">{Number(content).toFixed(1)}</b></span>
                )}
              </div>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {result?.feedback && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Nhận xét</p>
                <p className="text-sm text-slate-700 leading-relaxed">{result.feedback}</p>
              </div>
            )}
            {suggestions.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Gợi ý cải thiện</p>
                <ul className="space-y-1.5">
                  {suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0" />
                      <span className="leading-relaxed">{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result?.transcript && (
              <details className="group">
                <summary className="text-[11px] font-bold uppercase tracking-wider text-slate-400 cursor-pointer select-none hover:text-teal-700 transition-colors">Lời bạn đã nói (AI nghe được)</summary>
                <p className="mt-1.5 text-sm text-slate-600 italic leading-relaxed bg-slate-50 rounded-lg p-3 border border-slate-100">“{result.transcript}”</p>
              </details>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function QCard({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <article className="rounded-2xl bg-white border border-slate-200 p-5 transition-colors hover:border-slate-300">
      <div className="flex items-center gap-2.5 mb-3.5">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-teal-600 text-white text-[13px] font-bold tabular-nums">
          {n}
        </span>
        <h3 className="text-[13px] font-semibold uppercase tracking-wider text-slate-400">Câu {n}</h3>
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
  label: ReactNode;
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
    ? 'border-teal-500 bg-teal-50'
    : 'border-slate-200 hover:border-teal-300 hover:bg-teal-50/40';
  const badge = correct
    ? 'bg-emerald-500 text-white'
    : wrong
    ? 'bg-red-500 text-white'
    : picked
    ? 'bg-teal-600 text-white'
    : 'bg-slate-100 text-slate-500';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-left flex items-center gap-3 rounded-xl border p-3 transition-all duration-150 cursor-pointer active:scale-[0.99] disabled:cursor-default disabled:active:scale-100 ${border} ${block ? 'w-full' : ''}`}
    >
      <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${badge}`}>
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
  isCorrectMap,
  isReview,
  onChange,
  multiline,
}: {
  value: string;
  correct?: string;
  isCorrectMap?: boolean;
  isReview: boolean;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  const isCorrect = isReview && (isCorrectMap !== undefined ? isCorrectMap : !!(value && correct && value.trim().toLowerCase() === correct.trim().toLowerCase()));
  const cls = `w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-200 ${
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
  const paragraphs = useMemo(() => text.split(/\n\s*\n/).filter(Boolean), [text]);

  const renderParagraph = (para: string) => {
    const parts: Array<{ kind: 'text' | 'marker'; value: string }> = [];
    const re = /\[([ABCD])\]/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(para)) !== null) {
      if (m.index > last) parts.push({ kind: 'text', value: para.slice(last, m.index) });
      parts.push({ kind: 'marker', value: m[1] });
      last = m.index + m[0].length;
    }
    if (last < para.length) parts.push({ kind: 'text', value: para.slice(last) });
    return parts;
  };

  return (
    <article className="rounded-2xl bg-white border border-slate-200 p-6">
      <div className="text-sm text-slate-800 leading-relaxed space-y-3">
        {paragraphs.map((para, i) => (
          <p key={i} className="whitespace-pre-wrap">
            {markers
              ? renderParagraph(para).map((s, j) =>
                  s.kind === 'text' ? (
                    <span key={j} dangerouslySetInnerHTML={{ __html: s.value }} />
                  ) : (
                    <span key={j} className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-teal-100 text-teal-700 text-xs font-bold mx-0.5 align-middle">
                      [{s.value}]
                    </span>
                  )
                )
              : <span dangerouslySetInnerHTML={{ __html: para }} />}
          </p>
        ))}
      </div>
    </article>
  );
}

const CLOZE_RE = /\((\d{1,3})\)\s*_+/g;

function ClozePassage({
  passage,
  answers,
  correctAnswers,
  correctQuestions,
  onAnswerChange,
  isReview,
}: {
  passage: string;
  answers: ThptAnswers;
  correctAnswers?: ThptAnswers;
  correctQuestions?: Record<string, boolean>;
  onAnswerChange: (key: string, v: string) => void;
  isReview: boolean;
}) {
  const paragraphs = useMemo(() => passage.split(/\n\s*\n/).filter(Boolean), [passage]);

  const tokenize = (text: string) => {
    const out: Array<{ type: 'text' | 'blank'; text?: string; qn?: number }> = [];
    let last = 0;
    const re = new RegExp(CLOZE_RE.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) out.push({ type: 'text', text: text.slice(last, m.index) });
      out.push({ type: 'blank', qn: parseInt(m[1]) });
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ type: 'text', text: text.slice(last) });
    return out;
  };

  return (
    <article className="rounded-2xl bg-white border border-slate-200 p-6">
      <div className="text-base text-slate-800 leading-loose space-y-4">
        {paragraphs.map((para, pi) => {
          const tokens = tokenize(para);
          return (
            <p key={pi} className="whitespace-pre-wrap">
              {tokens.map((tok, i) => {
                if (tok.type === 'text') return <span key={i} dangerouslySetInnerHTML={{ __html: tok.text ?? '' }} />;
                const key = `q${tok.qn}`;
                const userVal = String(answers[key] ?? '');
                const correctVal = String(correctAnswers?.[key] ?? '');
                const isCorrect = isReview && (correctQuestions !== undefined ? !!correctQuestions[key] : !!(userVal && correctVal && userVal.trim().toLowerCase() === correctVal.trim().toLowerCase()));
                const isWrong = isReview && userVal && !isCorrect;
                const isMissing = isReview && !userVal;
                return (
                  <span key={i} className="inline-flex flex-col items-center align-middle mx-1">
                    <span className="inline-flex items-center gap-1">
                      <span className="text-xs font-bold text-teal-600 align-super">({tok.qn})</span>
                      <input
                        type="text"
                        value={userVal}
                        onChange={(e) => onAnswerChange(key, e.target.value)}
                        disabled={isReview}
                        className={`inline-block min-w-[80px] max-w-[160px] text-center text-sm font-semibold border-b-2 bg-transparent focus:outline-none px-1 py-0.5 ${
                          isCorrect ? 'border-emerald-500 text-emerald-700' : isWrong ? 'border-red-500 text-red-700 line-through' : isMissing ? 'border-amber-400' : 'border-teal-400 focus:border-teal-600'
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
            </p>
          );
        })}
      </div>
    </article>
  );
}


function WritingResultCard({
  n,
  prompt,
  essay,
  wordCount,
  result,
}: {
  n: number;
  prompt?: string;
  essay: string;
  wordCount: number;
  result?: any;
}) {
  const graded = !!result && typeof result.score === 'number';
  const score = graded ? Number(result.score) : 0;
  const scoreColor = score >= 8 ? '#10B981' : score >= 6.5 ? '#0D9488' : score >= 5 ? '#F59E0B' : '#EF4444';
  const scoreLabel = score >= 8 ? 'Xuất sắc' : score >= 6.5 ? 'Khá tốt' : score >= 5 ? 'Trung bình' : 'Cần luyện thêm';
  const suggestions: string[] = Array.isArray(result?.suggestions) ? result.suggestions : [];
  const criteria = result?.criteria_detail && typeof result.criteria_detail === 'object'
    ? Object.entries(result.criteria_detail as Record<string, unknown>)
    : [];
  const gradedBy = result?.graded_by === 'teacher' ? 'Giáo viên' : result?.graded_by === 'ai' ? 'AI' : result?.graded_by;

  const criteriaLabel = (raw: string) => {
    const key = raw.toLowerCase();
    if (key.includes('task') || key.includes('content') || key.includes('idea')) return 'Nội dung';
    if (key.includes('organ') || key.includes('coher') || key.includes('struct')) return 'Bố cục';
    if (key.includes('vocab') || key.includes('lexical') || key.includes('range')) return 'Từ vựng';
    if (key.includes('grammar') || key.includes('accur') || key.includes('lang')) return 'Ngữ pháp';
    if (key.includes('mechan') || key.includes('spell') || key.includes('punct')) return 'Chính tả';
    return raw.replace(/_/g, ' ');
  };

  return (
    <article className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-[0_1px_8px_rgba(15,23,42,0.04)]">
      {/* Header */}
      <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-600 text-white text-[13px] font-bold tabular-nums">
            {n}
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold uppercase tracking-wider text-slate-400">Câu {n} · Viết</p>
            <p className="text-xs text-slate-500 tabular-nums">{wordCount} từ · bài làm của bạn</p>
          </div>
        </div>
        {graded ? (
          <span
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black text-white shrink-0"
            style={{ background: scoreColor }}
          >
            <Sparkles className="w-3 h-3" />
            {score.toFixed(1)}/10
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full shrink-0">
            <Loader2 className="w-3 h-3 animate-spin" /> Đang chấm
          </span>
        )}
      </div>

      {/* 2 columns: left essay content · right AI review */}
      <div className="grid grid-cols-1 lg:grid-cols-2 lg:min-h-[360px]">
        {/* LEFT — đề + bài viết */}
        <div className="p-4 sm:p-5 border-b lg:border-b-0 lg:border-r border-slate-100 flex flex-col gap-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Nội dung bài viết</p>
            <span className="text-[11px] font-semibold text-slate-400 tabular-nums">{wordCount} từ</span>
          </div>

          {prompt && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Đề bài</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{prompt}</p>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 flex-1 min-h-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Bài làm của bạn</p>
            <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed lg:max-h-[420px] lg:overflow-y-auto pr-1">
              {essay || <span className="text-slate-400 italic">Không có bài viết.</span>}
            </div>
          </div>
        </div>

        {/* RIGHT — đánh giá AI */}
        <div className="p-4 sm:p-5 bg-gradient-to-b from-emerald-50/40 to-white flex flex-col gap-3.5 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Đánh giá từ AI
          </p>

          {!graded ? (
            essay.trim() ? (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <Loader2 className="w-4 h-4 animate-spin text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-900">AI đang chấm bài viết</p>
                  <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                    Điểm và nhận xét sẽ hiện ở cột này khi xong — trang tự cập nhật.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <XCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <p className="text-sm font-medium text-slate-500">Bạn chưa viết bài cho câu này.</p>
              </div>
            )
          ) : (
            <>
              {/* Score hero */}
              <div className="rounded-xl border border-emerald-100 bg-white p-4 flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 text-white shadow-sm"
                  style={{ background: scoreColor }}
                >
                  <span className="text-xl font-extrabold leading-none tabular-nums">{score.toFixed(1)}</span>
                  <span className="text-[9px] font-bold opacity-85 mt-0.5">/ 10</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 mb-0.5">
                    {gradedBy === 'Giáo viên' ? 'Giáo viên chấm' : 'AI chấm điểm'}
                  </p>
                  <p className="text-sm font-bold text-slate-800">{scoreLabel}</p>
                  {criteria.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      {criteria.map(([k, v]) => (
                        <span
                          key={k}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-slate-50 border border-slate-200 text-slate-600"
                        >
                          {criteriaLabel(k)}
                          <b className="text-slate-800 tabular-nums">{String(v)}</b>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {result?.feedback && (
                <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Nhận xét</p>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{result.feedback}</p>
                </div>
              )}

              {suggestions.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Gợi ý cải thiện</p>
                  <ul className="space-y-1.5">
                    {suggestions.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                        <span className="leading-relaxed">{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  );
}

