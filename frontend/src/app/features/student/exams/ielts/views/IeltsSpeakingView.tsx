/**
 * IELTS Speaking — student view (3 parts, ~14 min total).
 *
 * Flow:
 *  • Part 1 — Introduction & Interview: examiner asks general questions
 *    Student records 1 answer per question (~30s each)
 *  • Part 2 — Long Turn (Cue Card): 1-min prep + 1-2 min monologue
 *  • Part 3 — Discussion: follow-up Qs related to Part 2 topic
 */
import { useEffect, useState } from "react";
import { Mic, ArrowRight, CheckCircle2 } from "lucide-react";
import type { IeltsSpeakingPayload, IeltsSpeakingPart } from "../types";
import { IeltsSpeakingRecorder } from "../components/IeltsSpeakingRecorder";
import { studentApi } from "../../../../../../services/studentApi";

interface IeltsSpeakingViewProps {
  payload: IeltsSpeakingPayload;
  /** Current submission ID (for uploading audio) */
  submissionId: number | null;
  onSubmit: () => void;
}

/**
 * Thông báo giọng nói NGẮN GỌN khi vào mỗi part: chỉ báo Part mấy + thời gian.
 * KHÔNG đọc lại câu hỏi / cue card (đã hiển thị trên màn hình) để tiết kiệm thời gian.
 */
function buildIeltsSpeakingAnnounce(part: IeltsSpeakingPart): string {
  const name = part.partName?.trim() || `Part ${part.partNumber}`;
  if (part.partNumber === 2) {
    const prep = part.prepSeconds ?? 60;
    const speak = part.speakSeconds ?? 120;
    const prepText = prep >= 60 ? `${Math.round(prep / 60)} minute` : `${prep} seconds`;
    const speakMin = Math.max(1, Math.round(speak / 60));
    return `${name}. You have ${prepText} to prepare and up to ${speakMin} minute${speakMin > 1 ? "s" : ""} to speak. Please read the cue card on the screen, then start speaking.`;
  }
  const mins = part.recommendedMinutes;
  return `${name}.${mins ? ` You have about ${mins} minutes.` : ""} Please read the question on the screen, then start speaking.`;
}

export function IeltsSpeakingView({ payload, submissionId, onSubmit }: IeltsSpeakingViewProps) {
  const parts = payload.parts ?? [];
  const [activePartIdx, setActivePartIdx] = useState(0);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [completedParts, setCompletedParts] = useState<Set<number>>(new Set());
  const [uploadingPart, setUploadingPart] = useState<number | null>(null);

  const currentPart: IeltsSpeakingPart | undefined = parts[activePartIdx];

  // Phát thông báo giọng nói ngắn (Part + thời gian) mỗi khi chuyển part.
  useEffect(() => {
    if (!currentPart) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const text = buildIeltsSpeakingAnnounce(currentPart);
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = "en-US";
    utt.rate = 0.95;
    window.speechSynthesis.speak(utt);
    return () => window.speechSynthesis.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePartIdx]);

  if (!currentPart) {
    return <div className="p-8 text-center text-gray-500">No speaking parts available.</div>;
  }

  const handleRecorded = async (blob: Blob, durationSec: number) => {
    if (!submissionId) {
      // No submission to upload to — store locally maybe; for now just mark complete.
      setCompletedParts((prev) => new Set(prev).add(currentPart.partNumber));
      return;
    }

    try {
      setUploadingPart(currentPart.partNumber);
      await studentApi.uploadSpeakingAudio(submissionId, currentPart.partNumber, blob);
      setCompletedParts((prev) => new Set(prev).add(currentPart.partNumber));
    } catch (e) {
      // Surface error in UI (best-effort)
      console.error("Speaking upload failed", e);
      alert("Failed to upload your recording. Please try again.");
    } finally {
      setUploadingPart(null);
    }
  };

  const goToNextPart = () => {
    if (activePartIdx < parts.length - 1) {
      setActivePartIdx((i) => i + 1);
      setActiveQuestionIdx(0);
    }
  };

  const goToNextQuestion = () => {
    if (currentPart.questions && activeQuestionIdx < currentPart.questions.length - 1) {
      setActiveQuestionIdx((i) => i + 1);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#F5F5F5] flex flex-col">
      {/* Part stepper */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {parts.map((p, idx) => {
              const active = idx === activePartIdx;
              const done = completedParts.has(p.partNumber);
              return (
                <div key={p.partNumber} className="flex items-center gap-2">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold ${
                    active
                      ? "bg-pink-600 text-white"
                      : done
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-gray-100 text-gray-500"
                  }`}>
                    {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    <span>{p.partName}</span>
                  </div>
                  {idx < parts.length - 1 && (
                    <ArrowRight className="w-3.5 h-3.5 text-gray-300" />
                  )}
                </div>
              );
            })}
          </div>
          <div className="text-xs text-gray-500">
            ~{currentPart.recommendedMinutes} min
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 max-w-3xl w-full mx-auto">
        {/* Part 2: Cue Card */}
        {currentPart.partNumber === 2 && currentPart.cueCard ? (
          <IeltsSpeakingRecorder
            key={`p2`}
            partNumber={2}
            prompt={currentPart.cueCard.topic}
            bullets={[
              ...(currentPart.cueCard.bullets ?? []),
              "And explain why it is important to you.",
            ].filter(Boolean)}
            prepSeconds={currentPart.prepSeconds ?? 60}
            speakSeconds={currentPart.speakSeconds ?? 120}
            onRecorded={handleRecorded}
          />
        ) : currentPart.questions && currentPart.questions[activeQuestionIdx] ? (
          <div className="space-y-4">
            <div className="text-xs text-gray-500">
              Question {activeQuestionIdx + 1} of {currentPart.questions.length}
            </div>

            <IeltsSpeakingRecorder
              key={`p${currentPart.partNumber}-q${currentPart.questions[activeQuestionIdx].qId}`}
              partNumber={currentPart.partNumber}
              prompt={currentPart.questions[activeQuestionIdx].text}
              speakSeconds={45}
              onRecorded={(blob, dur) => {
                handleRecorded(blob, dur);
                // Advance to next question after recording
                setTimeout(() => {
                  if (activeQuestionIdx < (currentPart.questions?.length ?? 0) - 1) {
                    setActiveQuestionIdx((i) => i + 1);
                  }
                }, 1000);
              }}
            />

            {currentPart.questions.length > 1 && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={goToNextQuestion}
                  disabled={activeQuestionIdx >= currentPart.questions.length - 1}
                  className="text-xs text-gray-600 hover:text-gray-900 disabled:opacity-40 cursor-pointer"
                >
                  Skip to next question →
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-12">
            No questions configured for this part.
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <footer className="sticky bottom-0 bg-white text-[#1a1a1a] border-t border-[#e0e0e0] px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="text-xs text-[#677788]">
            {uploadingPart ? "Đang tải lên…" : `${completedParts.size} / ${parts.length} phần hoàn thành`}
          </div>
          <div className="flex items-center gap-2">
            {activePartIdx < parts.length - 1 && completedParts.has(currentPart.partNumber) && (
              <button
                type="button"
                onClick={goToNextPart}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-[#FF6B35] bg-[#fff0eb] hover:bg-[#ffe2d6] transition-colors cursor-pointer"
              >
                Tiếp: {parts[activePartIdx + 1]?.partName} →
              </button>
            )}
            {activePartIdx === parts.length - 1 && completedParts.size === parts.length && (
              <button
                type="button"
                onClick={onSubmit}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] hover:opacity-90 transition-opacity cursor-pointer shadow-md shadow-orange-200"
              >
                Nộp bài Speaking
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
