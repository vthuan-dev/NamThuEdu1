/**
 * IeltsTestPreviewPage — Demo UI làm bài cho teacher.
 *
 * Mục đích: cho giáo viên xem trước layout học viên sẽ thấy khi làm bài
 * IELTS. Trang này KHÔNG tạo session, KHÔNG lưu đáp án, KHÔNG có timer
 * countdown, KHÔNG có nút nộp bài. Chỉ load nội dung qua endpoint teacher
 * và render lại các view của student.
 *
 * Route: /giao-vien/de-thi/ielts/:skill/thu/:examId
 */
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, Loader2, AlertCircle, Eye } from "lucide-react";
import { api } from "../../../../../services/api";
import { usePageTitle } from "../../../../../hooks/usePageTitle";

import { IeltsListeningView } from "../../../student/exams/ielts/views/IeltsListeningView";
import { IeltsReadingView } from "../../../student/exams/ielts/views/IeltsReadingView";
import { IeltsWritingView } from "../../../student/exams/ielts/views/IeltsWritingView";
import { IeltsSpeakingView } from "../../../student/exams/ielts/views/IeltsSpeakingView";

import type {
  IeltsSkill,
  AnswerMap,
  IeltsListeningPayload,
  IeltsReadingPayload,
  IeltsWritingPayload,
  IeltsSpeakingPayload,
} from "../../../student/exams/ielts/types";

const SKILL_LABELS: Record<IeltsSkill, string> = {
  listening: "Listening",
  reading: "Reading",
  writing: "Writing",
  speaking: "Speaking",
};

export function IeltsTestPreviewPage({
  admin = false,
  examId: examIdProp,
  skill: skillProp,
  onBack,
}: {
  admin?: boolean;
  examId?: number | string;
  skill?: string;
  onBack?: () => void;
} = {}) {
  const params = useParams<{
    examId: string;
    skill: string;
  }>();
  const navigate = useNavigate();
  const examId = Number(examIdProp ?? params.examId);
  const skill = ((skillProp ?? params.skill) || "listening") as IeltsSkill;
  const goBack = () => (onBack ? onBack() : navigate(-1));
  usePageTitle(`Xem thử IELTS ${SKILL_LABELS[skill] ?? "Test"}`);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<any>(null);

  // Answers chỉ giữ ở local state — không gọi API
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [flagged, setFlagged] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!examId || !skill) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const loadUrl = admin
      ? `/admin/exams/${examId}/preview/ielts/${skill}`
      : `/teacher/exams/${examId}/ielts/${skill}`;
    api
      .get(loadUrl)
      .then((res) => {
        if (cancelled) return;
        setPayload(res.data?.data ?? null);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setError(
          err?.response?.data?.message ??
            err?.message ??
            "Không thể tải dữ liệu đề thi."
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [examId, skill]);

  // No-op handlers — chỉ cập nhật local state để UI phản hồi
  const handleAnswer = (qId: number, value: any) => {
    setAnswers((prev) => ({ ...prev, [qId]: value }));
  };

  const handleToggleFlag = (qId: number) => {
    setFlagged((prev) => ({ ...prev, [qId]: !prev[qId] }));
  };

  const handleNoopSubmit = () => {
    // Trang demo: không submit, không hỏi gì cả
  };

  const skillTitle = useMemo(() => SKILL_LABELS[skill] ?? skill, [skill]);

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col">
      {/* Top notice bar — luôn hiển thị để teacher biết đây là demo */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center gap-3">
        <button
          onClick={goBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại
        </button>

        <span className="text-gray-300">|</span>

        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-100">
            <Eye className="w-3 h-3" />
            Chế độ xem thử
          </span>
          <span className="text-sm font-semibold text-gray-800 truncate">
            IELTS {skillTitle}
          </span>
        </div>

        <p className="hidden md:block text-xs text-gray-500">
          Đáp án không được lưu · Chỉ hiển thị giao diện học viên
        </p>
      </div>

      {/* Body */}
      {loading && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-24">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-sm text-gray-500">Đang tải đề thi...</p>
        </div>
      )}

      {!loading && error && (
        <div className="max-w-xl mx-auto w-full px-4 py-10">
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-900">Không thể tải đề thi</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && payload && (() => {
        // Đề chưa có dữ liệu (sections/passages/tasks/parts đều rỗng)
        const isEmpty =
          (skill === "listening" && (!payload.sections?.length || payload.sections.every((s: any) => !s.questions?.length))) ||
          (skill === "reading" && (!payload.passages?.length || payload.passages.every((p: any) => !p.questions?.length))) ||
          (skill === "writing" && !payload.tasks?.length) ||
          (skill === "speaking" && !payload.parts?.length);

        if (isEmpty) {
          return (
            <div className="max-w-xl mx-auto w-full px-4 py-10">
              <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-50 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-amber-600" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">
                  Đề thi chưa có nội dung
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed mb-5">
                  Đề "{payload.title || "IELTS"}" hiện chưa có câu hỏi nào. Vui lòng quay
                  lại trang soạn thảo để thêm câu hỏi trước khi xem thử giao diện làm bài.
                </p>
                <button
                  onClick={goBack}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Quay lại
                </button>
              </div>
            </div>
          );
        }

        return (
          <div className="flex-1">
            {skill === "listening" && (
              <IeltsListeningView
                payload={payload as IeltsListeningPayload}
                answers={answers}
                flagged={flagged}
                onAnswer={handleAnswer}
                onToggleFlag={handleToggleFlag}
                onSubmit={handleNoopSubmit}
                showTimer={false}
                draggableNavigator
                previewMode
                hideSubmit
              />
            )}
            {skill === "reading" && (
              <IeltsReadingView
                payload={payload as IeltsReadingPayload}
                answers={answers}
                flagged={flagged}
                onAnswer={handleAnswer}
                onToggleFlag={handleToggleFlag}
                onSubmit={handleNoopSubmit}
                showTimer={false}
                draggableNavigator
                hideSubmit
              />
            )}
            {skill === "writing" && (
              <IeltsWritingView
                payload={payload as IeltsWritingPayload}
                answers={answers}
                onAnswer={handleAnswer}
                onSubmit={handleNoopSubmit}
                hideSubmit
              />
            )}
            {skill === "speaking" && (
              <IeltsSpeakingView
                payload={payload as IeltsSpeakingPayload}
                submissionId={null}
                onSubmit={handleNoopSubmit}
                hideSubmit
              />
            )}
          </div>
        );
      })()}
    </div>
  );
}

export default IeltsTestPreviewPage;
