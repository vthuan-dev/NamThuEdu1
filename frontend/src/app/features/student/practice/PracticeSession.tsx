import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ChevronLeft, ChevronRight, CheckCircle2, Clock, Send } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { studentApi } from "../../../../services/studentApi";

const PRIMARY = "#7C3AED";
const STUDENT_BASE_PATH = "/hoc-vien";

type Q = { id: number; question: string; options: string[]; correct: number };

export function PracticeSession() {
  const { id } = useParams<{ id: string }>();
  const topicId = Number(id ?? 0);
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["student", "practice", "questions", topicId],
    queryFn: () => studentApi.getPracticeQuestions({ topic_id: topicId, count: 10 }),
    enabled: topicId > 0,
  });

  const questions: Q[] = useMemo(() => {
    const raw = (data as any)?.data?.data?.questions;
    if (!Array.isArray(raw) || raw.length === 0) return [];
    return raw.slice(0, 10).map((q: any, idx: number) => ({
      id: Number(q?.id ?? q?.qId ?? idx + 1),
      question: String(q?.content ?? q?.qContent ?? `Question #${idx + 1}`),
      options: Array.isArray(q?.options) && q.options.length > 0
        ? q.options.map((o: any) => String(o?.content ?? o?.aContent ?? o?.label ?? "Option"))
        : ["A", "B", "C", "D"],
      correct: 0,
    }));
  }, [data]);

  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});

  const current = questions[idx];

  const completeMutation = useMutation({
    mutationFn: async () => {
      const session = await studentApi.createPracticeSession({ topic_id: topicId || undefined, question_count: questions.length });
      const sessionId = Number((session as any)?.data?.data?.session_id ?? (session as any)?.data?.data?.id ?? 0);
      if (sessionId) {
        const tasks = Object.entries(answers).map(([qid, ans]) =>
          studentApi.savePracticeAnswer(sessionId, { question_id: Number(qid), answer_id: ans + 1 }),
        );
        await Promise.all(tasks);
        await studentApi.completePracticeSession(sessionId);
      }
      return sessionId;
    },
    onSuccess: () => {
      navigate(`${STUDENT_BASE_PATH}/luyen-tap`);
    },
    onError: () => {
      navigate(`${STUDENT_BASE_PATH}/luyen-tap`);
    },
  });

  const answeredCount = Object.keys(answers).length;

  if (questions.length === 0) {
    return (
      <div className="py-6 max-w-3xl mx-auto space-y-5">
        <button
          onClick={() => navigate(`${STUDENT_BASE_PATH}/luyen-tap`)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-800"
        >
          <ChevronLeft className="w-4 h-4" /> Quay lại luyện tập
        </button>
        <div className="rounded-3xl p-10 text-center" style={{ background: "#F5F3FF", border: "1.5px solid #E9D5FF" }}>
          <p className="text-lg font-bold text-slate-700">Chưa có câu hỏi cho chủ đề này.</p>
          <p className="text-sm text-slate-500 mt-2">Vui lòng chọn chủ đề khác hoặc thử lại sau.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-4 sm:py-6 max-w-3xl mx-auto space-y-4 sm:space-y-5">
      <button
        onClick={() => navigate(`${STUDENT_BASE_PATH}/luyen-tap`)}
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-800"
      >
        <ChevronLeft className="w-4 h-4" /> Quay lại luyện tập
      </button>

      <div
        className="rounded-3xl p-6"
        style={{ background: "linear-gradient(135deg,#F5F3FF 0%,#FAF5FF 100%)", border: "1.5px solid #E9D5FF" }}
      >
        <h1 className="text-2xl font-extrabold text-slate-800">Phiên luyện tập nhanh</h1>
        <p className="text-sm text-slate-500 mt-1">Hoàn thành câu hỏi để củng cố kiến thức ngay trong ngày.</p>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs font-semibold px-2 py-1 rounded-md bg-white text-slate-600">
            Câu {idx + 1}/{questions.length}
          </span>
          <span className="text-xs font-semibold px-2 py-1 rounded-md bg-white text-slate-600 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Đã trả lời {answeredCount}/{questions.length}
          </span>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5" style={{ border: "1.5px solid #F1F5F9" }}>
        <p className="text-lg font-bold text-slate-800">{current?.question}</p>
        <div className="mt-4 space-y-2.5">
          {current?.options.map((opt, optIdx) => {
            const active = answers[current.id] === optIdx;
            return (
              <button
                key={`${current.id}-${optIdx}`}
                onClick={() => setAnswers((prev) => ({ ...prev, [current.id]: optIdx }))}
                // min-h-11 = 44px: đáp án một chữ ("A. Yes") chỉ cao ~40px với
                // p-3, sát ngưỡng touch target.
                className="w-full text-left rounded-xl p-3 min-h-11 transition-all"
                style={{
                  border: `1.5px solid ${active ? PRIMARY : "#E2E8F0"}`,
                  background: active ? "#F5F3FF" : "#FFFFFF",
                  color: active ? "#5B21B6" : "#334155",
                }}
              >
                {String.fromCharCode(65 + optIdx)}. {opt}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <button
          onClick={() => setIdx((n) => Math.max(0, n - 1))}
          disabled={idx === 0}
          className="inline-flex items-center justify-center min-h-11 px-3 sm:px-4 rounded-xl border text-sm font-semibold disabled:opacity-50 flex-shrink-0"
          style={{ borderColor: "#CBD5E1", color: "#475569" }}
        >
          <ChevronLeft className="w-4 h-4 inline sm:mr-1" /> <span className="hidden sm:inline">Câu trước</span>
        </button>

        {idx < questions.length - 1 ? (
          <button
            onClick={() => setIdx((n) => Math.min(questions.length - 1, n + 1))}
            className="inline-flex items-center justify-center min-h-11 px-4 rounded-xl text-sm font-semibold text-white flex-shrink-0"
            style={{ background: PRIMARY }}
          >
            Câu tiếp <ChevronRight className="w-4 h-4 inline ml-1" />
          </button>
        ) : (
          /* Nhãn "Hoàn thành luyện tập" quá dài cho màn 375px khi đứng cạnh nút
             Câu trước — rút gọn còn "Hoàn thành" ở màn hẹp. */
          <button
            onClick={() => completeMutation.mutate()}
            disabled={completeMutation.isPending}
            className="inline-flex items-center justify-center min-h-11 px-3 sm:px-4 rounded-xl text-sm font-semibold text-white disabled:opacity-60 flex-shrink-0"
            style={{ background: "#16A34A" }}
          >
            {completeMutation.isPending ? "Đang nộp..." : (
              <>
                <Send className="w-4 h-4 inline mr-1" /> Hoàn thành<span className="hidden sm:inline">&nbsp;luyện tập</span>
              </>
            )}
          </button>
        )}
      </div>

      {answeredCount === questions.length && (
        <div className="rounded-xl p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold">
          <CheckCircle2 className="w-4 h-4 inline mr-1" /> Bạn đã trả lời đủ toàn bộ câu hỏi.
        </div>
      )}
    </div>
  );
}

