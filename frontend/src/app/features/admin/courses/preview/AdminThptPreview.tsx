/**
 * AdminThptPreview — Admin xem trước đề THPT đúng UI học viên sẽ thấy khi thi.
 * Khác trang học viên (StudentThptExamPage): KHÔNG tạo submission, KHÔNG đếm giờ
 * thực, chỉ render nội dung đề read-friendly để kiểm duyệt.
 *
 * Fetch: GET /admin/exams/:examId/preview/thpt/draft
 * Render lại bằng SectionView + ThptTopBar + ThptPartNavigator có sẵn.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Loader2, AlertCircle } from "lucide-react";
import { api } from "../../../../../services/api";
import type { ThptAnswers, ThptConfig } from "../../../student/exams/thpt/types";
import { ThptTopBar } from "../../../student/exams/thpt/components/ThptTopBar";
import { ThptPartNavigator } from "../../../student/exams/thpt/components/ThptPartNavigator";
import { ThptBottomNav } from "../../../student/exams/thpt/components/ThptBottomNav";
import { SectionView } from "../../../student/exams/thpt/views/SectionView";

const BACK_TO = "/admin/courses";

export function AdminThptPreview() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();

  const [examTitle, setExamTitle] = useState("Đề thi THPT");
  const [config, setConfig] = useState<ThptConfig | null>(null);
  const [answers, setAnswers] = useState<ThptAnswers>({});
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!examId) return;
      try {
        const res = await api.get(`/admin/exams/${examId}/preview/thpt/draft`);
        const data = res.data?.data;
        if (!mounted) return;
        if (!data?.thpt_config) {
          setError("Không tải được nội dung đề thi.");
          setLoading(false);
          return;
        }
        setExamTitle(data.eTitle || "Đề thi THPT");
        setConfig(data.thpt_config as ThptConfig);
        setLoading(false);
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.response?.data?.message || "Không tải được đề thi.");
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [examId]);

  const onAnswerChange = (key: string, value: boolean | string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-sm text-slate-600">Đang tải đề thi...</p>
        </div>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full rounded-2xl bg-white border border-red-200 p-6 text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-900 mb-1">Có lỗi xảy ra</h2>
          <p className="text-sm text-slate-600 mb-4">{error ?? "Không có dữ liệu đề thi."}</p>
          <button
            type="button"
            onClick={() => navigate(BACK_TO)}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors cursor-pointer"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  const activeSection = config.sections[activeIdx];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <ThptTopBar
        examTitle={`[Xem trước] ${examTitle}`}
        totalSeconds={0}
        totalDurationSec={0}
        hideTimer
        onBack={() => navigate(BACK_TO)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 pt-6 pb-24 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        <div className="min-w-0">
          {activeSection && (
            <SectionView
              key={activeSection.id}
              section={activeSection}
              answers={answers}
              onAnswerChange={onAnswerChange}
              mode="taking"
            />
          )}
        </div>

        <ThptPartNavigator
          config={config}
          answers={answers}
          activeIdx={activeIdx}
          onSectionChange={setActiveIdx}
        />
      </main>

      <ThptBottomNav
        activePart={activeIdx}
        totalParts={config.sections.length}
        canPrev={activeIdx > 0}
        canNext={activeIdx < config.sections.length - 1}
        onPrev={() => setActiveIdx((i) => Math.max(0, i - 1))}
        onNext={() => setActiveIdx((i) => Math.min(config.sections.length - 1, i + 1))}
        onSubmit={() => navigate(BACK_TO)}
        isSubmitting={false}
      />
    </div>
  );
}
