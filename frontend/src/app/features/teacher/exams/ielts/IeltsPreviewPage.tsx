/**
 * IeltsPreviewPage — Trang xem trước đề IELTS (standalone, không cần editor).
 * Route: /giao-vien/de-thi/ielts/:skill/xem/:examId
 *
 * Fetch draft data từ GET /teacher/exams/:examId/ielts/draft
 * rồi render IeltsExamStudentPreview với read-only mode.
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { api } from "../../../../../services/api";
import { IeltsExamStudentPreview } from "./IeltsExamStudentPreview";
import { IeltsTestPreviewPage } from "./IeltsTestPreviewPage";
import type { IeltsSkill, IeltsTestType } from "./structure";

const DEFAULT_PLAY_MODE = {
  practice_enabled: true,
  full_test_enabled: true,
  // Theo chuẩn IELTS: Listening 40' · Reading 60' · Writing 60' · Speaking 11–14'
  time_limit_options: [null, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60],
};

export function IeltsPreviewPage({ admin = false, backTo }: { admin?: boolean; backTo?: string } = {}) {
  const { examId, skill: skillParam } = useParams<{ examId: string; skill: string }>();
  const navigate = useNavigate();

  const skill = (skillParam || "listening") as IeltsSkill;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [examTitle, setExamTitle] = useState("IELTS Practice");
  const [examDescription, setExamDescription] = useState("");
  const [testType, setTestType] = useState<IeltsTestType>("Academic");
  const [skillData, setSkillData] = useState<any>(null);
  const [playMode, setPlayMode] = useState(DEFAULT_PLAY_MODE);
  // Khi true: render demo làm bài INLINE (không điều hướng route — tránh lỗi iframe).
  const [demoActive, setDemoActive] = useState(false);

  useEffect(() => {
    if (!examId) return;
    setLoading(true);
    const draftUrl = admin
      ? `/admin/exams/${examId}/preview/ielts/draft`
      : `/teacher/exams/${examId}/ielts/draft`;
    api.get(draftUrl)
      .then((res) => {
        const data = res.data?.data;
        if (!data) throw new Error("Không tìm thấy dữ liệu đề thi");
        setExamTitle(data.eTitle || "IELTS Practice");
        setExamDescription(data.eDescription || "");
        if (data.ielts_test_type) setTestType(data.ielts_test_type as IeltsTestType);
        if (data.ielts_data) setSkillData(data.ielts_data);
        const savedModes = data.ielts_config?.play_modes;
        if (savedModes) setPlayMode((p) => ({ ...p, ...savedModes }));
      })
      .catch((err) => {
        setError(err?.response?.data?.message || err.message || "Không thể tải đề thi");
      })
      .finally(() => setLoading(false));
  }, [examId]);

  const goBack = () => (backTo ? navigate(backTo) : navigate(-1));

  const [demoPracticeScope, setDemoPracticeScope] = useState<{
    sections?: number[];
    timeLimitMinutes?: number | null;
  } | null>(null);

  // Demo làm bài render inline (cả admin lẫn giáo viên) — chỉ xem, không điều hướng.
  if (demoActive && examId) {
    return (
      <IeltsTestPreviewPage
        admin={admin}
        examId={examId}
        skill={skill}
        practiceSections={demoPracticeScope?.sections}
        timeLimitMinutes={demoPracticeScope?.timeLimitMinutes}
        onBack={() => {
          setDemoActive(false);
          setDemoPracticeScope(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
        <button
          onClick={goBack}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại
        </button>
        {!loading && (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-gray-300">|</span>
            <span className="text-sm font-semibold text-gray-800 truncate">{examTitle}</span>
            <span className="text-[11px] text-gray-400 bg-gray-100 rounded px-2 py-0.5">
              Xem trước
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6">
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-sm text-gray-500">Đang tải đề thi...</p>
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-900">Không thể tải đề thi</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && (
          <IeltsExamStudentPreview
            skill={skill}
            testType={testType}
            examTitle={examTitle}
            examDescription={examDescription}
            skillData={skillData}
            playMode={playMode}
            examId={examId}
            admin={admin}
            onStartDemo={(selectedIndices, timeLimitMinutes) => {
              setDemoPracticeScope(
                selectedIndices && selectedIndices.length > 0
                  ? {
                      sections: selectedIndices.map((i) => i + 1),
                      timeLimitMinutes,
                    }
                  : null
              );
              setDemoActive(true);
            }}
          />
        )}
      </div>
    </div>
  );
}

export default IeltsPreviewPage;
