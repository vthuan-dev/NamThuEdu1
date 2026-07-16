/**
 * GeneralExamPreview — Xem chi tiết đề GENERAL/objective (trắc nghiệm, đúng/sai,
 * điền từ, trả lời ngắn). Dùng cho đề teens/luyện tập không thuộc VSTEP/IELTS/Kids/THPT.
 *
 * Route: /giao-vien/de-thi/:examId/xem-de
 * Đọc /teacher/exams/{id} (ExamController@show) → render danh sách câu hỏi + đáp án đúng
 * (read-only, dành cho giáo viên xem trước).
 */
import { useParams, useNavigate } from "react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Clock, FileText, CheckCircle2, Pencil } from "lucide-react";
import { api } from "../../../../services/api";
import { useToastContext } from "../../../../contexts/ToastContext";

interface Answer {
  aId: number;
  aContent: string;
  aIs_correct: boolean | number;
}
interface Question {
  qId: number;
  qContent: string;
  qType: string;
  qSection?: string | null;
  qPassage_text?: string | null;
  qPoints?: number;
  answers?: Answer[];
}
interface ExamData {
  eId: number;
  eTitle: string;
  eDescription?: string;
  eType?: string;
  eSkill?: string;
  eDuration_minutes?: number;
  age_group?: string;
  questions?: Question[];
}

const SECTION_LABEL: Record<string, string> = {
  grammar: "Ngữ pháp",
  vocabulary: "Từ vựng",
  reading: "Đọc hiểu",
  listening: "Nghe",
  writing: "Viết",
};

const TYPE_LABEL: Record<string, string> = {
  multiple_choice: "Trắc nghiệm",
  true_false: "Đúng / Sai",
  fill_blank: "Điền từ",
  short_answer: "Trả lời ngắn",
  essay: "Tự luận",
};

export function GeneralExamPreview() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { error } = useToastContext();
  const [loading, setLoading] = useState(true);
  const [exam, setExam] = useState<ExamData | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!examId) return;
      try {
        setLoading(true);
        const res = await api.get(`/teacher/exams/${examId}`);
        const data = res.data?.data ?? res.data;
        if (mounted) setExam(data);
      } catch (err: any) {
        error(err?.response?.data?.message || "Không tải được đề thi");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [examId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="text-5xl mb-3 animate-bounce">📝</div>
          <p className="text-slate-500 font-medium">Đang tải đề thi…</p>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="text-5xl mb-3">😕</div>
          <p className="text-slate-600 mb-4">Không tìm thấy đề thi</p>
          <button
            onClick={() => navigate("/giao-vien/de-thi")}
            className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
          >
            Quay lại danh sách
          </button>
        </div>
      </div>
    );
  }

  const questions = exam.questions ?? [];
  const letter = (i: number) => String.fromCharCode(65 + i);

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Quay lại"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-slate-900 truncate">{exam.eTitle}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-slate-500">
              {exam.eType && (
                <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold">{exam.eType}</span>
              )}
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />{exam.eDuration_minutes ?? 0} phút
              </span>
              <span className="text-slate-300">•</span>
              <span className="inline-flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />{questions.length} câu
              </span>
            </div>
          </div>
          <button
            onClick={() => navigate(`/giao-vien/de-thi/${exam.eId}/chinh-sua`)}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
          >
            <Pencil className="w-4 h-4" /> Chỉnh sửa
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-4">
        {exam.eDescription && (
          <p className="text-sm text-slate-600 bg-white rounded-xl border border-slate-200 p-4">{exam.eDescription}</p>
        )}

        {questions.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center text-amber-800">
            Đề này chưa có câu hỏi nào.
          </div>
        )}

        {questions.map((q, idx) => {
          const answers = q.answers ?? [];
          const correct = answers.filter((a) => a.aIs_correct == true);
          return (
            <div key={q.qId} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {q.qSection && (
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-semibold">
                        {SECTION_LABEL[q.qSection] ?? q.qSection}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[11px] font-semibold">
                      {TYPE_LABEL[q.qType] ?? q.qType}
                    </span>
                  </div>

                  {q.qPassage_text && (
                    <div className="mb-3 rounded-lg bg-slate-50 border border-slate-100 p-3 text-[13px] leading-6 text-slate-700 whitespace-pre-line">
                      {q.qPassage_text}
                    </div>
                  )}

                  <p
                    className="font-semibold text-slate-900 mb-3"
                    dangerouslySetInnerHTML={{ __html: q.qContent }}
                  />

                  {/* MCQ / true_false → options A/B/C/D; fill_blank/short_answer → đáp án text */}
                  {(q.qType === "multiple_choice" || q.qType === "true_false") && answers.length > 0 ? (
                    <div className="space-y-2">
                      {answers.map((a, i) => {
                        const isCorrect = a.aIs_correct == true;
                        return (
                          <div
                            key={a.aId ?? i}
                            className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm ${
                              isCorrect
                                ? "border-emerald-300 bg-emerald-50 text-emerald-800 font-semibold"
                                : "border-slate-200 bg-white text-slate-700"
                            }`}
                          >
                            <span
                              className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold ${
                                isCorrect ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {letter(i)}
                            </span>
                            <span className="flex-1">{a.aContent}</span>
                            {isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  ) : q.qType === "essay" ? (
                    <div className="text-sm text-slate-500 italic">Câu tự luận — giáo viên chấm tay.</div>
                  ) : correct.length > 0 ? (
                    <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="text-slate-500">Đáp án:</span>
                      <span className="font-semibold text-emerald-700">{correct[0].aContent}</span>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-400 italic">Chưa có đáp án.</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default GeneralExamPreview;
