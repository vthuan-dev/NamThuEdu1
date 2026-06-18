/**
 * IELTS Writing — student view (Task 1 + Task 2 = 60 minutes total).
 *
 * Layout:
 *  • Tab bar: Task 1 (20 min recommended) / Task 2 (40 min recommended)
 *  • Split: prompt + image (chart/letter context) on the left, editor on the right
 *  • Realtime word counter with min-words indicator (red until threshold met)
 *  • Spell-check disabled (matches real test)
 */
import { useMemo, useState } from "react";
import { PenLine, Image as ImageIcon, FileText, CheckCircle2 } from "lucide-react";
import type { IeltsWritingPayload, AnswerMap, IeltsWritingTask } from "../types";

interface IeltsWritingViewProps {
  payload: IeltsWritingPayload;
  answers: AnswerMap;
  onAnswer: (qId: number, value: string) => void;
  onSubmit: () => void;
  reviewMode?: boolean;
}

function countWords(text: string): number {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function IeltsWritingView({
  payload,
  answers,
  onAnswer,
  onSubmit,
  reviewMode = false,
}: IeltsWritingViewProps) {
  const tasks = payload.tasks ?? [];
  const [activeIdx, setActiveIdx] = useState(0);
  const currentTask: IeltsWritingTask | undefined = tasks[activeIdx];

  if (!currentTask) {
    return (
      <div className="p-8 text-center text-gray-500">
        No writing tasks available for this exam.
      </div>
    );
  }

  const currentText = ((answers[currentTask.questionId] as string) ?? "");
  const wordCount = useMemo(() => countWords(currentText), [currentText]);
  const meetMinWords = wordCount >= currentTask.minWords;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#F5F5F5] flex flex-col">
      {/* Task tab bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            {tasks.map((t, idx) => {
              const active = idx === activeIdx;
              const text = ((answers[t.questionId] as string) ?? "");
              const wc = countWords(text);
              const ok = wc >= t.minWords;
              return (
                <button
                  key={t.taskNumber}
                  type="button"
                  onClick={() => setActiveIdx(idx)}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-white text-gray-700 hover:bg-blue-50 border border-gray-200"
                  }`}
                >
                  <PenLine className="w-3.5 h-3.5" />
                  <span>{t.taskName}</span>
                  <span className={`ml-1 px-1.5 rounded text-[10px] tabular-nums font-bold ${
                    active
                      ? "bg-white/20 text-white"
                      : ok
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-gray-100 text-gray-500"
                  }`}>
                    {wc}/{t.minWords}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="hidden sm:flex items-center gap-3 text-xs text-gray-500">
            <span>Recommended: {currentTask.recommendedMinutes} minutes</span>
            <span className="text-gray-300">·</span>
            <span>Min words: {currentTask.minWords}</span>
          </div>
        </div>
      </div>

      {/* 2-col split */}
      <div className="flex-1 px-4 py-4 max-w-7xl w-full mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[440px_1fr] gap-4 h-[calc(100vh-12rem)]">
          {/* Prompt panel */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center gap-2 mb-0.5">
                <FileText className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-bold text-gray-900">{currentTask.taskName}</h2>
              </div>
              {currentTask.tone && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700">
                  {currentTask.tone} letter
                </span>
              )}
              {currentTask.chartType && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700">
                  {currentTask.chartType}
                </span>
              )}
              {currentTask.essayType && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700">
                  {currentTask.essayType}
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {/* Image (if any) */}
              {currentTask.imageUrl && (
                <div className="mb-4 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                  <div className="px-3 py-1.5 border-b border-gray-200 bg-gray-100 text-[10px] font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" />
                    Visual reference
                  </div>
                  <img
                    src={currentTask.imageUrl}
                    alt={`Task ${currentTask.taskNumber} chart`}
                    className="w-full h-auto block"
                  />
                </div>
              )}

              {/* Prompt text */}
              <div
                className="prose prose-sm max-w-none text-gray-800 leading-relaxed [&>p]:mb-3"
                dangerouslySetInnerHTML={{ __html: currentTask.prompt || "<p><em>No prompt</em></p>" }}
              />

              {/* Task requirements box */}
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
                <p className="font-semibold mb-1">Requirements</p>
                <ul className="space-y-1">
                  <li>· Write at least <strong>{currentTask.minWords}</strong> words</li>
                  <li>· Recommended time: <strong>{currentTask.recommendedMinutes} minutes</strong></li>
                  <li>· Write in formal academic English</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Editor panel */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PenLine className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-gray-900">Your answer</h3>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className={`tabular-nums font-semibold ${
                  meetMinWords ? "text-emerald-600" : wordCount > 0 ? "text-amber-600" : "text-gray-400"
                }`}>
                  {wordCount} / {currentTask.minWords} words
                </span>
                {meetMinWords && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              </div>
            </div>

            <textarea
              value={currentText}
              onChange={(e) => onAnswer(currentTask.questionId, e.target.value)}
              placeholder={`Start writing your ${currentTask.taskName.toLowerCase()} here…`}
              readOnly={reviewMode}
              className={`flex-1 px-5 py-4 text-sm text-gray-900 leading-relaxed resize-none focus:outline-none placeholder:text-gray-400 font-serif ${
                reviewMode ? "bg-slate-50" : ""
              }`}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              data-gramm="false"
            />

            {/* Word count progress bar */}
            <div className="border-t border-gray-100 px-5 py-2 bg-gray-50">
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    meetMinWords ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                  style={{ width: `${Math.min(100, (wordCount / currentTask.minWords) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] mt-1">
                <span className="text-gray-500">
                  {meetMinWords
                    ? "Minimum reached. You may continue if you want."
                    : `${currentTask.minWords - wordCount} more words to reach the minimum.`}
                </span>
                <span className="text-gray-400 italic">No spell check (real-test mode)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom action bar */}
      <footer className="sticky bottom-0 bg-white text-[#1a1a1a] border-t border-[#e0e0e0] px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="text-xs text-[#677788]">
            <span className="font-semibold text-[#1a1a1a]">{currentTask.taskName}</span>
            {" · "}
            <span className="tabular-nums">{wordCount} từ đã viết</span>
          </div>
          <div className="flex items-center gap-2">
            {activeIdx < tasks.length - 1 && (
              <button
                type="button"
                onClick={() => setActiveIdx((i) => i + 1)}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-[#FF6B35] bg-[#fff0eb] hover:bg-[#ffe2d6] transition-colors cursor-pointer"
              >
                Sang {tasks[activeIdx + 1]?.taskName}
              </button>
            )}
            {!reviewMode && (
              <button
                type="button"
                onClick={onSubmit}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] hover:opacity-90 transition-opacity cursor-pointer shadow-md shadow-orange-200"
              >
                Nộp bài Writing
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
