import { useMemo, useState, useEffect, useRef, type ReactNode } from 'react';
import { CheckCircle2, XCircle, Headphones, Mic, Sparkles, Loader2, FileText, PenLine, Highlighter } from 'lucide-react';
import type { ThptAnswers, ThptSection, ViewMode } from '../types';
import { ThptSpeakingRecorder } from '../components/ThptSpeakingRecorder';
import { splitPhoneticWord, formatErrorSentence, isSuffixComparisonGroup } from '../../../../../../utils/examUtils';
import { useTextHighlight } from '../../../../../../hooks/exam/useTextHighlight';

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
  /** Hiển thị giải thích (khi học viên xem lại bài). Mặc định true ngoại trừ khi cờ show_explanation trong config bằng false */
  showExplanation?: boolean;
}

export function SectionView({ section, answers, correctAnswers, onAnswerChange, mode, submissionId, speakingParts, speakingAudio, writingParts, correctQuestions, hideHeader, showExplanation }: Props) {
  const typeLabel = TYPE_LABEL[section.type] ?? 'Phần thi';
  // Chia đôi trái–phải cho dạng có bài đọc DÀI tách biệt khỏi câu hỏi
  // (mc_cloze, reading_mixed). word_bank_cloze/open_cloze KHÔNG chia vì ô
  // điền nằm ngay trong đoạn văn.
  const passageText = (section as any).passage as string | undefined;
  const isSplitReading =
    (section.type === 'mc_cloze' || section.type === 'reading_mixed') &&
    !!passageText && passageText.trim().length > 0;

  // Listening image-block (IELTS-style): trái = ảnh đề, phải = câu hỏi
  // layout === 'default' => không chia 2 cột dù vẫn còn task_image (GV tắt layout)
  const taskImage = String((section as any).task_image || '').trim();
  const layoutMode = String((section as any).layout || (taskImage ? 'image_block' : 'default'));
  const isListeningImageBlock =
    section.type === 'listening' && taskImage.length > 0 && layoutMode === 'image_block';

  const headerEl = !hideHeader ? (
    // Nhánh đọc chia đôi: section đã khóa chiều cao & không cuộn → header đứng
    // yên (flex-none), KHÔNG sticky để tránh offset top-[68px] làm lệch/bị
    // ThptTopBar che. Các nhánh còn lại vẫn cuộn theo trang nên giữ sticky.
    <header className={`${isSplitReading ? 'flex-none' : 'sticky top-[68px]'} z-20 relative overflow-hidden rounded-2xl bg-white/95 backdrop-blur border border-slate-200 py-2.5 px-4 pl-5 shadow-sm`}>
      <span className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: THEME.primary }} />
      <div className="flex items-baseline flex-wrap gap-x-2 gap-y-0.5">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-teal-700">
          {typeLabel}
        </span>
        <h2 className="text-base font-bold text-slate-900 tracking-tight leading-tight">{section.title}</h2>
      </div>
      {section.instructions && (
        <p className="text-xs text-slate-500 mt-0.5 leading-snug max-w-2xl line-clamp-1">{section.instructions}</p>
      )}
    </header>
  ) : null;

  if (isSplitReading) {
    return (
      // Khóa chiều cao đúng viewport (trừ topbar 68 + pt-6 24 + pb-24 96 = 188px)
      // => trang KHÔNG cuộn nữa; header đứng yên (flex-none); chỉ 2 cột cuộn nội bộ.
      <section className="flex flex-col gap-3 lg:h-[calc(100vh-188px)] lg:overflow-hidden">
        {headerEl}
        <ResizableSplit
          storageKey="thpt-reading-split"
          left={<PassageBox text={passageText!} markers={section.type === 'reading_mixed'} submissionId={submissionId} sectionId={section.id} enabled={mode !== 'review'} />}
          right={
            <div className="space-y-5">
              <Body section={section} answers={answers} correctAnswers={correctAnswers} onAnswerChange={onAnswerChange} mode={mode} submissionId={submissionId} speakingParts={speakingParts} speakingAudio={speakingAudio} writingParts={writingParts} correctQuestions={correctQuestions} showExplanation={showExplanation} hidePassage />
            </div>
          }
        />
      </section>
    );
  }

  if (isListeningImageBlock) {
    return (
      <section className="space-y-5">
        {headerEl}
        {/* Audio sticky full-width trên ảnh + câu */}
        {(section as any).audio_url && (
          <div className="rounded-xl border border-slate-200 bg-white p-3 flex items-center gap-3 sticky top-[68px] z-10">
            <Headphones className="w-4 h-4 text-teal-600 flex-shrink-0" />
            <audio controls src={(section as any).audio_url} className="w-full h-10" />
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {/* Cột ảnh: sticky — chuột trên ảnh vẫn cuộn trang được */}
          <div className="lg:sticky lg:top-[88px] lg:self-start">
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-2 px-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700">Ảnh đề</span>
                <a href={taskImage} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-teal-700 hover:underline">
                  Phóng to
                </a>
              </div>
              <a href={taskImage} target="_blank" rel="noreferrer" className="block group relative">
                <img
                  src={taskImage}
                  alt="Ảnh đề"
                  className="w-full object-contain object-top rounded-xl border border-slate-100 bg-slate-50 max-h-[calc(100vh-14rem)] scale-[1.03] origin-top"
                />
                <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-black/50 text-white text-[11px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                  Phóng to
                </span>
              </a>
            </div>
          </div>
          {/* Cột câu hỏi: cuộn theo trang (không nested scroll) */}
          <div className="space-y-5">
            <Body
              section={section}
              answers={answers}
              correctAnswers={correctAnswers}
              onAnswerChange={onAnswerChange}
              mode={mode}
              submissionId={submissionId}
              speakingParts={speakingParts}
              speakingAudio={speakingAudio}
              writingParts={writingParts}
              correctQuestions={correctQuestions}
              showExplanation={showExplanation}
              hidePassage
            />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      {headerEl}
      <Body section={section} answers={answers} correctAnswers={correctAnswers} onAnswerChange={onAnswerChange} mode={mode} submissionId={submissionId} speakingParts={speakingParts} speakingAudio={speakingAudio} writingParts={writingParts} correctQuestions={correctQuestions} showExplanation={showExplanation} />
    </section>
  );
}

function Body({ section, answers, correctAnswers, onAnswerChange, mode, submissionId, speakingParts, speakingAudio, writingParts, correctQuestions, hidePassage, showExplanation }: Props & { hidePassage?: boolean }) {
  const isReview = mode === 'review';
  const showExp = isReview && showExplanation !== false;
  // Đề Nói: mỗi lần chỉ cho ghi âm 1 đề. activeSpeakingQ = số câu đang ghi (hoặc null).
  const [activeSpeakingQ, setActiveSpeakingQ] = useState<number | null>(null);

  switch (section.type) {
    case 'phonetics':
      return (
        <>
          {section.items.map((item) => {
            const key = `q${item.question_number}`;
            const userVal = String(answers[key] ?? '').trim().toUpperCase();
            const correctVal = String(correctAnswers?.[key] ?? '').trim().toUpperCase();
            // Chỉ tự dò đuôi s/es/ed khi:
            //  - Dạng "Phát âm" (không phải "Trọng âm"), VÀ
            //  - Cả nhóm 4 phương án đều cùng có đuôi biến đổi (dạng so sánh đuôi).
            // Dạng so sánh nguyên âm (head/bread/tea/heavy) không cùng đuôi → không auto-dò,
            // tránh gạch chân/in nghiêng nhầm chữ cuối.
            const isStress = section.variant === 'stress';
            const autoDetect = !isStress && isSuffixComparisonGroup(item.words);
            return (
              <QCard key={key} n={item.question_number}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {item.words.map((w) => {
                    const { before, mark, after } = splitPhoneticWord(w.text, w.underline, autoDetect, w.underlineStart);
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
                {showExp && item.explanation && (
                  <div className="mt-3 p-3 rounded-lg bg-emerald-50/50 border border-emerald-200">
                    <p className="text-xs font-bold text-emerald-700 mb-1 flex items-center gap-1.5">
                      <span>💡</span> Giải thích đáp án:
                    </p>
                    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{item.explanation}</p>
                  </div>
                )}
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
            const userVal = String(answers[key] ?? '').trim().toUpperCase();
            const correctVal = String(correctAnswers?.[key] ?? '').trim().toUpperCase();
            const options = isError ? item.segments : item.options;
            return (
              <QCard key={key} n={item.question_number}>
                {!isError && item.prompt && (
                  <div className="text-sm text-slate-900 leading-relaxed font-bold mb-3 space-y-1 [&_*]:!text-slate-900 [&_*]:!font-bold">
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
                {showExp && item.explanation && (
                  <div className="mt-3 p-3 rounded-lg bg-emerald-50/50 border border-emerald-200">
                    <p className="text-xs font-bold text-emerald-700 mb-1 flex items-center gap-1.5">
                      <span>💡</span> Giải thích đáp án:
                    </p>
                    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{item.explanation}</p>
                  </div>
                )}
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
                <p className="text-sm text-slate-900 font-bold mb-2">
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
                {showExp && item.explanation && (
                  <div className="mt-3 p-3 rounded-lg bg-emerald-50/50 border border-emerald-200">
                    <p className="text-xs font-bold text-emerald-700 mb-1 flex items-center gap-1.5">
                      <span>💡</span> Giải thích đáp án:
                    </p>
                    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{item.explanation}</p>
                  </div>
                )}
              </QCard>
            );
          })}
        </>
      );

    case 'listening': {
      const hideAudio = !!hidePassage; // image-block parent đã render audio sticky
      const isReviewMode = mode === 'review';
      const showExpMode = isReviewMode && showExplanation !== false;
      const isAnswerSheet = !!hidePassage; // image_block: câu hỏi nằm trên ảnh

      // ── Image-block: bảng đáp án label → value (câu hỏi đã nằm trên ảnh) ──
      if (isAnswerSheet) {
        return (
          <div className="space-y-3">
            <div className="rounded-xl border border-teal-200 bg-teal-50/70 px-3.5 py-2.5 text-xs text-teal-900 leading-relaxed">
              <b>Hướng dẫn:</b> Câu hỏi nằm trên <b>ảnh đề</b> bên trái. Chỉ điền / chọn đáp án theo đúng <b>số câu</b> trên ảnh (label → value).
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Bảng đáp án
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  {(section.items as any[]).length} câu
                </span>
              </div>
              {/* Header row: Label | Value */}
              <div className="hidden sm:grid grid-cols-[3.5rem_1fr] gap-3 px-4 py-2 border-b border-slate-100 bg-white">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Câu</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Đáp án</span>
              </div>
              <div className="divide-y divide-slate-100">
                {(section.items as any[]).map((item) => {
                  const key = `q${item.question_number}`;
                  const kind = item.kind === 'fill_blank' ? 'fill_blank' : 'mc';
                  // Prompt chỉ hiện nếu GV cố tình nhập (thường để trống khi đã có ảnh)
                  const prompt = String(item.prompt || '').trim();

                  if (kind === 'fill_blank') {
                    return (
                      <div key={key} className="px-4 py-2.5 grid grid-cols-[3.5rem_1fr] gap-3 items-center">
                        <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-teal-600 text-white text-sm font-bold tabular-nums">
                          {item.question_number}
                        </span>
                        <div className="min-w-0 space-y-1">
                          {prompt ? (
                            <p className="text-xs text-slate-500 leading-snug">{prompt}</p>
                          ) : null}
                          <TextAnswer
                            value={String(answers[key] ?? '')}
                            onChange={(v) => onAnswerChange?.(key, v)}
                            isReview={isReviewMode}
                            correct={correctAnswers ? String(correctAnswers[key] ?? '') : undefined}
                            isCorrectMap={correctQuestions?.[key]}
                          />
                          {showExpMode && item.explanation && (
                            <div className="mt-2 p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-200">
                              <p className="text-[11px] font-bold text-emerald-700 mb-0.5 flex items-center gap-1.5">
                                <span>💡</span> Giải thích đáp án:
                              </p>
                              <p className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-wrap">{item.explanation}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  const options = item.options ?? [];
                  const userVal = String(answers[key] ?? '').trim().toUpperCase();
                  const correctVal = String(correctAnswers?.[key] ?? '').trim().toUpperCase();
                  // Option text trống (đã in trên ảnh) → chỉ hiện A/B/C/D
                  const labelsOnly = options.length === 0 || options.every((o: any) => !String(o.text || '').trim());
                  const opts = options.length > 0 ? options : [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }];

                  return (
                    <div key={key} className="px-4 py-2.5 grid grid-cols-[3.5rem_1fr] gap-3 items-center">
                      <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-teal-600 text-white text-sm font-bold tabular-nums">
                        {item.question_number}
                      </span>
                      <div className="min-w-0 space-y-1.5">
                        {prompt ? (
                          <p className="text-xs text-slate-500 leading-snug">{prompt}</p>
                        ) : null}
                        {labelsOnly ? (
                          <div className="flex flex-wrap gap-2">
                            {opts.map((opt: any) => (
                              <ChoiceButton
                                key={opt.id}
                                letter={opt.id}
                                label=""
                                letterOnly
                                picked={userVal === opt.id}
                                correct={isReviewMode && correctVal === opt.id}
                                wrong={isReviewMode && userVal === opt.id && correctVal !== opt.id}
                                onClick={() => onAnswerChange?.(key, opt.id)}
                                disabled={isReviewMode}
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {options.map((opt: any) => (
                              <ChoiceButton
                                key={opt.id}
                                letter={opt.id}
                                label={opt.text}
                                picked={userVal === opt.id}
                                correct={isReviewMode && correctVal === opt.id}
                                wrong={isReviewMode && userVal === opt.id && correctVal !== opt.id}
                                onClick={() => onAnswerChange?.(key, opt.id)}
                                disabled={isReviewMode}
                                block
                              />
                            ))}
                          </div>
                        )}
                        {showExpMode && item.explanation && (
                          <div className="mt-2 p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-200">
                            <p className="text-[11px] font-bold text-emerald-700 mb-0.5 flex items-center gap-1.5">
                              <span>💡</span> Giải thích đáp án:
                            </p>
                            <p className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-wrap">{item.explanation}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      }

      // ── Layout mặc định: full card + prompt ──
      return (
        <div className="space-y-4">
          {!hideAudio && section.audio_url && (
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
                    <p className="text-sm text-slate-900 font-bold mb-3 whitespace-pre-wrap">{item.prompt}</p>
                  )}
                  <TextAnswer
                    value={String(answers[key] ?? '')}
                    onChange={(v) => onAnswerChange?.(key, v)}
                    isReview={isReviewMode}
                    correct={correctAnswers ? String(correctAnswers[key] ?? '') : undefined}
                    isCorrectMap={correctQuestions?.[key]}
                  />
                  {showExpMode && item.explanation && (
                    <div className="mt-3 p-3 rounded-lg bg-emerald-50/50 border border-emerald-200">
                      <p className="text-xs font-bold text-emerald-700 mb-1 flex items-center gap-1.5">
                        <span>💡</span> Giải thích đáp án:
                      </p>
                      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{item.explanation}</p>
                    </div>
                  )}
                </QCard>
              );
            }
            const options = item.options ?? [];
            const userVal = String(answers[key] ?? '');
            const correctVal = String(correctAnswers?.[key] ?? '');
            return (
              <QCard key={key} n={item.question_number}>
                {item.prompt && (
                  <p className="text-sm text-slate-900 font-bold mb-3 whitespace-pre-wrap">{item.prompt}</p>
                )}
                <div className="space-y-2">
                  {options.map((opt: any) => (
                    <ChoiceButton
                      key={opt.id}
                      letter={opt.id}
                      label={opt.text}
                      picked={userVal === opt.id}
                      correct={isReviewMode && correctVal === opt.id}
                      wrong={isReviewMode && userVal === opt.id && correctVal !== opt.id}
                      onClick={() => onAnswerChange?.(key, opt.id)}
                      disabled={isReviewMode}
                      block
                    />
                  ))}
                </div>
                {showExpMode && item.explanation && (
                  <div className="mt-3 p-3 rounded-lg bg-emerald-50/50 border border-emerald-200">
                    <p className="text-xs font-bold text-emerald-700 mb-1 flex items-center gap-1.5">
                      <span>💡</span> Giải thích đáp án:
                    </p>
                    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{item.explanation}</p>
                  </div>
                )}
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
            const underMin = typeof minW === 'number' && words > 0 && words < minW;
            const overMax = typeof maxW === 'number' && words > maxW;

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
              <QCard key={key} n={item.question_number} label="Viết">
                {item.prompt && <PromptBox text={item.prompt} />}

                <div className="mt-4 rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-slate-100 bg-slate-50/80">
                    <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <PenLine className="w-3.5 h-3.5 text-teal-600" />
                      Bài làm của bạn
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      {(minW || maxW) && (
                        <span className="text-slate-400 font-medium">
                          {minW ? `≥ ${minW}` : ''}
                          {minW && maxW ? ' · ' : ''}
                          {maxW ? `≤ ${maxW}` : ''} từ
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md font-bold tabular-nums ${
                          underMin || overMax
                            ? 'bg-amber-100 text-amber-800'
                            : words > 0
                            ? 'bg-teal-100 text-teal-800'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {words} từ
                      </span>
                    </div>
                  </div>
                  <textarea
                    value={val}
                    onChange={(e) => onAnswerChange?.(key, e.target.value)}
                    disabled={isReview}
                    rows={12}
                    placeholder="Viết bài của bạn tại đây…"
                    className="w-full text-sm text-slate-800 border-0 px-3.5 py-3.5 focus:outline-none focus:ring-0 resize-y min-h-[220px] disabled:bg-slate-50 disabled:text-slate-600 leading-relaxed"
                  />
                </div>
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
                <p className="text-sm text-slate-900 font-bold mb-2" dangerouslySetInnerHTML={{ __html: item.original }} />
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
                {isReview && item.explanation && (
                  <div className="mt-3 p-3 rounded-lg bg-emerald-50/50 border border-emerald-200">
                    <p className="text-xs font-bold text-emerald-700 mb-1 flex items-center gap-1.5">
                      <span>💡</span> Giải thích đáp án:
                    </p>
                    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{item.explanation}</p>
                  </div>
                )}
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
                      explanation={s.explanation}
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
              {isReview && item.explanation && (
                <div className="mt-3 p-3 rounded-lg bg-emerald-50/50 border border-emerald-200">
                  <p className="text-xs font-bold text-emerald-700 mb-1 flex items-center gap-1.5">
                    <span>💡</span> Giải thích đáp án:
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{item.explanation}</p>
                </div>
              )}
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
            const userVal = String(answers[key] ?? '').trim().toUpperCase();
            const correctVal = String(correctAnswers?.[key] ?? '').trim().toUpperCase();
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
                {showExp && b.explanation && (
                  <div className="mt-3 p-3 rounded-lg bg-emerald-50/50 border border-emerald-200">
                    <p className="text-xs font-bold text-emerald-700 mb-1 flex items-center gap-1.5">
                      <span>💡</span> Giải thích đáp án:
                    </p>
                    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{b.explanation}</p>
                  </div>
                )}
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
          {isReview && section.blanks.some(b => b.explanation) && (
            <div className="mt-4 rounded-2xl bg-white border border-slate-200 p-5 space-y-3">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <span>💡</span> Giải thích đáp án các chỗ trống
              </h4>
              <div className="space-y-2.5">
                {section.blanks.map(b => b.explanation && (
                  <div key={b.question_number} className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="font-bold text-teal-700 mr-2">Chỗ trống ({b.question_number}):</span>
                    {b.explanation}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      );

    case 'open_cloze':
      return (
        <>
          <ClozePassage
            passage={section.passage}
            answers={answers}
            correctAnswers={correctAnswers}
            correctQuestions={correctQuestions}
            onAnswerChange={onAnswerChange}
            isReview={isReview}
          />
          {showExp && section.blanks.some(b => b.explanation) && (
            <div className="mt-4 rounded-2xl bg-white border border-slate-200 p-5 space-y-3">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <span>💡</span> Giải thích đáp án các chỗ trống
              </h4>
              <div className="space-y-2.5">
                {section.blanks.map(b => b.explanation && (
                  <div key={b.question_number} className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="font-bold text-teal-700 mr-2">Chỗ trống ({b.question_number}):</span>
                    {b.explanation}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
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
                      explanation={showExp ? s.explanation : undefined}
                    />
                  ))}
                </div>
              )}
              {item.kind === 'mc' && (
                <>
                  <div className="space-y-2">
                    <div className="text-sm text-slate-900 font-bold mb-1 space-y-1 [&_*]:!text-slate-900 [&_*]:!font-bold">
                      {item.prompt.split(/\s+(?=[a-e]\.\s)/i).map((part: string, i: number) => (
                        <p key={i} className="leading-relaxed" dangerouslySetInnerHTML={{ __html: part.trim() }} />
                      ))}
                    </div>
                    {item.options.map((opt: any) => {
                      const key = `q${item.question_number}`;
                      const userVal = String(answers[key] ?? '').trim().toUpperCase();
                      const correctVal = String(correctAnswers?.[key] ?? '').trim().toUpperCase();
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
                  {isReview && item.explanation && (
                    <div className="mt-3 p-3 rounded-lg bg-emerald-50/50 border border-emerald-200">
                      <p className="text-xs font-bold text-emerald-700 mb-1 flex items-center gap-1.5">
                        <span>💡</span> Giải thích đáp án:
                      </p>
                      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{item.explanation}</p>
                    </div>
                  )}
                </>
              )}
              {item.kind === 'sentence_insertion' && (
                <>
                  <div className="space-y-2">
                    <p className="text-sm text-slate-900 font-bold">{item.prompt}</p>
                    <blockquote className="border-l-4 border-teal-300 pl-3 py-1 italic text-sm text-slate-700 bg-teal-50/40 rounded-r">
                      {item.sentence_to_insert}
                    </blockquote>
                    <div className="flex items-center gap-2">
                      {['A', 'B', 'C', 'D'].map((m) => {
                        const key = `q${item.question_number}`;
                        const userVal = String(answers[key] ?? '').trim().toUpperCase();
                        const correctVal = String(correctAnswers?.[key] ?? '').trim().toUpperCase();
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
                  {isReview && item.explanation && (
                    <div className="mt-3 p-3 rounded-lg bg-emerald-50/50 border border-emerald-200">
                      <p className="text-xs font-bold text-emerald-700 mb-1 flex items-center gap-1.5">
                        <span>💡</span> Giải thích đáp án:
                      </p>
                      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{item.explanation}</p>
                    </div>
                  )}
                </>
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
          <p className="text-[15px] font-bold text-slate-900 leading-relaxed">{prompt}</p>
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

function QCard({ n, children, label }: { n: number; children: React.ReactNode; label?: string }) {
  return (
    <article id={`qcard-${n}`} className="rounded-2xl bg-white border border-slate-200 p-5 transition-colors hover:border-slate-300 scroll-mt-20">
      <div className="flex items-center gap-2.5 mb-3.5">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-teal-600 text-white text-[13px] font-bold tabular-nums">
          {n}
        </span>
        <h3 className="text-[13px] font-semibold uppercase tracking-wider text-slate-400">
          Câu {n}{label ? ` · ${label}` : ''}
        </h3>
      </div>
      {children}
    </article>
  );
}

/** Khung đề bài — tách rõ nội dung câu hỏi / yêu cầu khỏi vùng trả lời. */
function PromptBox({ text, title = 'Đề bài' }: { text: string; title?: string }) {
  return (
    <div className="relative rounded-xl border border-teal-200/80 bg-gradient-to-br from-teal-50/90 via-white to-slate-50 px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
      <span className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-teal-500" />
      <div className="flex items-center gap-1.5 mb-2 pl-1">
        <FileText className="w-3.5 h-3.5 text-teal-600" />
        <p className="text-[11px] font-bold uppercase tracking-wider text-teal-700">{title}</p>
      </div>
      <div className="pl-1 text-[15px] text-slate-900 whitespace-pre-wrap leading-relaxed font-bold">
        {text}
      </div>
    </div>
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
  letterOnly,
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
  /** Chỉ hiện chữ cái A/B/C/D — dùng khi nội dung đã in trên ảnh đề */
  letterOnly?: boolean;
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

  // Chế độ chỉ chữ cái (label/value sheet khi câu hỏi đã nằm trên ảnh)
  if (letterOnly) {
    const letterCls = correct
      ? 'border-emerald-400 bg-emerald-500 text-white'
      : wrong
      ? 'border-red-400 bg-red-500 text-white'
      : picked
      ? 'border-teal-500 bg-teal-600 text-white'
      : 'border-slate-200 bg-white text-slate-700 hover:border-teal-300 hover:bg-teal-50';
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={`Chọn ${letter}`}
        className={`inline-flex items-center justify-center w-10 h-10 rounded-xl border text-sm font-bold transition-all duration-150 cursor-pointer active:scale-[0.97] disabled:cursor-default disabled:active:scale-100 ${letterCls}`}
      >
        {letter}
      </button>
    );
  }

  const hasLabel = !(label === '' || label == null);
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
      {hasLabel && (
        <span className="flex-1 min-w-0">
          <span className="text-sm text-slate-800">{label}</span>
          {sub && <span className="block text-[11px] text-slate-500">[{sub}]</span>}
        </span>
      )}
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
  explanation,
}: {
  idx: number;
  text: string;
  qKey: string;
  answers: ThptAnswers;
  correctAnswers?: ThptAnswers;
  onAnswerChange: (key: string, v: boolean) => void;
  isReview: boolean;
  explanation?: string;
}) {
  const userVal = answers[qKey];
  const correctVal = correctAnswers?.[qKey];
  const isCorrect = isReview && userVal !== undefined && userVal === correctVal;
  const isWrong = isReview && userVal !== undefined && userVal !== correctVal;
  return (
    <div
      className={`rounded-lg border p-3 flex flex-col gap-2 ${
        isCorrect ? 'border-emerald-300 bg-emerald-50/50' : isWrong ? 'border-red-300 bg-red-50/50' : 'border-slate-200'
      }`}
    >
      <div className="flex items-start gap-3 w-full">
        <span className="text-xs font-bold text-slate-500 w-5 mt-0.5">{idx + 1}.</span>
        <p className="flex-1 text-sm text-slate-900 font-bold leading-relaxed">{text}</p>
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
      {isReview && explanation && (
        <div className="text-xs text-slate-600 bg-emerald-50/40 p-2 rounded border border-emerald-100/50 pl-8">
          💡 <strong>Giải thích:</strong> {explanation}
        </div>
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

// ─── Chia đôi có thể kéo chỉnh tỉ lệ: cột bài đọc (trái) ↔ câu hỏi (phải).
// Chỉ bật thanh gạt ở màn lg+; mobile xếp dọc như cũ. Lưu tỉ lệ vào localStorage.
function ResizableSplit({
  left,
  right,
  storageKey = 'thpt-reading-split',
}: {
  left: ReactNode;
  right: ReactNode;
  storageKey?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftPct, setLeftPct] = useState<number>(() => {
    const saved = Number(localStorage.getItem(storageKey));
    return saved >= 30 && saved <= 70 ? saved : 50;
  });
  const [dragging, setDragging] = useState(false);
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftPct(Math.min(70, Math.max(30, pct)));
    };
    const onUp = () => {
      setDragging(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging]);

  useEffect(() => {
    localStorage.setItem(storageKey, String(Math.round(leftPct)));
  }, [leftPct, storageKey]);

  return (
    <div
      ref={containerRef}
      className="flex flex-col lg:flex-row gap-5 items-stretch lg:flex-1 lg:min-h-0"
    >
      {/* Cột bài đọc — cuộn độc lập trên desktop, không lan sang trang/câu hỏi */}
      <div
        className="w-full min-w-0 lg:h-full lg:overflow-y-auto lg:overscroll-contain lg:pr-2 [scrollbar-width:thin]"
        style={isDesktop ? { flex: `0 0 ${leftPct}%`, maxWidth: `${leftPct}%` } : undefined}
      >
        {left}
      </div>

      {/* Thanh gạt — chỉ hiện ở lg+, cao hết chiều cao cột */}
      {isDesktop && (
        <div
          onMouseDown={() => {
            setDragging(true);
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'col-resize';
          }}
          className="hidden lg:flex flex-none items-center justify-center w-3 lg:h-full cursor-col-resize group"
          title="Kéo để chỉnh độ rộng bài đọc"
        >
          <div
            className={`w-1 h-16 rounded-full transition-colors ${
              dragging ? 'bg-teal-500' : 'bg-slate-200 group-hover:bg-teal-400'
            }`}
          />
        </div>
      )}

      {/* Cột câu hỏi — cuộn độc lập trên desktop */}
      <div className="w-full min-w-0 lg:flex-1 lg:h-full lg:overflow-y-auto lg:overscroll-contain lg:pr-1 [scrollbar-width:thin]">
        {right}
      </div>
    </div>
  );
}

// Hash chuỗi id section → số nguyên ổn định, dùng làm passageId cho khóa localStorage.
function hashId(s: string | number): number {
  const str = String(s);
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const MARKER_RE = /\[([ABCD])\]/g;

// Bài đọc có thể bôi đen (highlight) để học viên ghi chú — tái dùng hook
// useTextHighlight (lưu localStorage, tự khôi phục qua F5) giống IELTS Reading.
// Vẫn giữ marker [A][B] cho dạng reading_mixed; text render dạng plain (escape)
// nên không hỗ trợ HTML trong passage — đổi lấy tính chính xác của offset highlight.
function PassageBox({
  text,
  markers,
  submissionId,
  sectionId,
  enabled = true,
}: {
  text: string;
  markers?: boolean;
  submissionId?: number | null;
  sectionId?: string | number;
  enabled?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hl = useTextHighlight({
    submissionId: submissionId || 0,
    passageId: hashId(sectionId ?? 0),
    enabled,
  });

  const [toolbar, setToolbar] = useState<
    { top: number; left: number; text: string; start: number; end: number } | null
  >(null);

  // Bắt vùng chọn → tính offset theo textContent của container (khớp lúc render).
  const handleMouseUp = () => {
    if (!enabled) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) { setToolbar(null); return; }
    const selText = sel.toString();
    if (!selText.trim()) { setToolbar(null); return; }
    const container = containerRef.current;
    if (!container) return;
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const before = range.cloneRange();
    before.selectNodeContents(container);
    before.setEnd(range.startContainer, range.startOffset);
    const start = before.toString().length;
    const end = start + selText.length;
    setToolbar({ top: rect.top - 52 + window.scrollY, left: rect.left + rect.width / 2, text: selText, start, end });
  };

  const applyHighlight = () => {
    if (!toolbar) return;
    hl.addHighlight({
      text: toolbar.text,
      startOffset: toolbar.start,
      endOffset: toolbar.end,
      color: hl.colors[hl.selectedColor],
    });
    window.getSelection()?.removeAllRanges();
    setToolbar(null);
  };

  // Render text: chèn xen kẽ các đoạn highlight + marker [A].
  const content = useMemo(() => {
    const ranges = [...hl.highlights]
      .filter((h) => h.startOffset < text.length && h.endOffset <= text.length && h.startOffset < h.endOffset)
      .sort((a, b) => a.startOffset - b.startOffset);

    type Seg = { text: string; hlId?: string; color?: string };
    const segs: Seg[] = [];
    let last = 0;
    for (const r of ranges) {
      if (r.startOffset > last) segs.push({ text: text.slice(last, r.startOffset) });
      segs.push({ text: text.slice(r.startOffset, r.endOffset), hlId: r.id, color: r.color });
      last = r.endOffset;
    }
    if (last < text.length) segs.push({ text: text.slice(last) });

    const renderPlain = (str: string, keyBase: string): ReactNode[] => {
      if (!markers) return [<span key={keyBase} className="whitespace-pre-wrap">{str}</span>];
      const nodes: ReactNode[] = [];
      const re = new RegExp(MARKER_RE.source, 'g');
      let li = 0;
      let idx = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(str)) !== null) {
        if (m.index > li) nodes.push(<span key={`${keyBase}-t${idx}`} className="whitespace-pre-wrap">{str.slice(li, m.index)}</span>);
        nodes.push(
          <span key={`${keyBase}-m${idx}`} className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-teal-100 text-teal-700 text-xs font-bold mx-0.5 align-middle">
            [{m[1]}]
          </span>
        );
        li = m.index + m[0].length;
        idx++;
      }
      if (li < str.length) nodes.push(<span key={`${keyBase}-t${idx}`} className="whitespace-pre-wrap">{str.slice(li)}</span>);
      return nodes;
    };

    return segs.map((s, i) =>
      s.hlId ? (
        <mark
          key={`h${i}`}
          data-hid={s.hlId}
          onClick={() => { if (enabled && window.confirm('Xóa highlight này?')) hl.removeHighlight(s.hlId!); }}
          style={{ backgroundColor: s.color, borderRadius: 3, padding: '1px 0', cursor: enabled ? 'pointer' : 'default' }}
          title={enabled ? 'Click để xóa highlight' : undefined}
        >
          {renderPlain(s.text, `h${i}`)}
        </mark>
      ) : (
        <span key={`s${i}`}>{renderPlain(s.text, `s${i}`)}</span>
      )
    );
  }, [text, markers, hl.highlights, enabled, hl]);

  return (
    <article className="rounded-2xl bg-white border border-slate-200 p-6">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-1 h-4 rounded-full bg-teal-500" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-teal-700">Bài đọc</span>
        </div>
        {enabled && (
          <div className="flex items-center gap-1.5" title="Chọn màu rồi bôi đen đoạn văn để ghi chú">
            <Highlighter className="w-3.5 h-3.5 text-slate-400" />
            {(Object.keys(hl.colors) as (keyof typeof hl.colors)[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => hl.setSelectedColor(c)}
                className={`w-4 h-4 rounded-full border transition-transform hover:scale-110 cursor-pointer ${hl.selectedColor === c ? 'border-slate-700 ring-1 ring-slate-300' : 'border-slate-200'}`}
                style={{ backgroundColor: hl.colors[c] }}
                aria-label={`Chọn màu ${c}`}
              />
            ))}
          </div>
        )}
      </div>
      <div
        ref={containerRef}
        onMouseUp={handleMouseUp}
        className="text-[15px] text-slate-900 font-semibold leading-7 select-text"
        style={{ userSelect: enabled ? 'text' : 'none' }}
      >
        {content}
      </div>

      {toolbar && (
        <div
          className="fixed z-50 -translate-x-1/2 flex items-center gap-1.5 rounded-lg bg-white shadow-xl border border-slate-200 px-2 py-1.5"
          style={{ top: toolbar.top, left: toolbar.left }}
        >
          <button
            type="button"
            onClick={applyHighlight}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold text-slate-800 cursor-pointer"
            style={{ backgroundColor: hl.colors[hl.selectedColor] }}
          >
            <Highlighter className="w-3.5 h-3.5" /> Bôi màu
          </button>
          <button type="button" onClick={() => setToolbar(null)} className="px-1.5 py-1 text-xs text-slate-400 hover:text-slate-600 cursor-pointer">✕</button>
        </div>
      )}
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

