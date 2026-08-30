import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router";
import {
  ArrowLeft, Clock, FileText, BookOpen, Headphones, Book, PenTool, Mic,
  BarChart3, Shuffle, Edit, Target, Calendar, CheckCircle, XCircle,
  Send, Trash2, Eye, ChevronDown, ChevronUp, Loader2, AlertCircle,
  Tag, Hash, Layers,
} from "lucide-react";
import { api } from "@/services/api";
import { formatVNDate } from "@/utils/dateUtils";

/* ─── Types ─── */
type PracticeType = "topic_based" | "template_based" | "random" | "skill_based" | "custom";
type Skill = "listening" | "reading" | "writing" | "speaking";
type Difficulty = "easy" | "medium" | "hard" | "mixed";
type Purpose = "review" | "practice" | "drill" | "mock_test" | "homework";

interface Answer {
  aId: number;
  aContent: string;
  aIs_correct: boolean;
}
interface Question {
  qId: number;
  qContent: string;
  qType: string;
  qPoints: number;
  answers: Answer[];
}
interface Exam {
  eId: number;
  eTitle: string;
  eDuration_minutes: number;
  eCreated_at: string;
  questions?: Question[];
}
interface PracticeSession {
  ps_id: number;
  ps_title: string;
  ps_description?: string;
  ps_type: PracticeType;
  ps_purpose: Purpose;
  ps_target_skill?: Skill;
  ps_topic?: string;
  ps_difficulty: Difficulty;
  ps_duration_minutes: number;
  ps_question_count: number;
  ps_is_active: boolean;
  ps_created_at: string;
  ps_updated_at: string;
  exam?: Exam;
}

/* ─── Config maps ─── */
const TYPE_CONFIG: Record<PracticeType, { label: string; color: string; icon: React.ElementType; bg: string; border: string }> = {
  skill_based:    { label: "Theo kỹ năng",  color: "text-green-700",  icon: BarChart3, bg: "bg-green-50",  border: "border-green-200" },
  topic_based:    { label: "Theo chủ đề",   color: "text-purple-700", icon: BookOpen,  bg: "bg-purple-50", border: "border-purple-200" },
  template_based: { label: "Từ template",   color: "text-blue-700",   icon: Layers,    bg: "bg-blue-50",   border: "border-blue-200" },
  random:         { label: "Ngẫu nhiên",    color: "text-orange-700", icon: Shuffle,   bg: "bg-orange-50", border: "border-orange-200" },
  custom:         { label: "Tùy chỉnh",     color: "text-gray-700",   icon: Edit,      bg: "bg-gray-50",   border: "border-gray-200" },
};
const SKILL_CONFIG: Record<Skill, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  listening: { label: "Listening", icon: Headphones, color: "text-blue-700",  bg: "bg-blue-50",   border: "border-blue-200" },
  reading:   { label: "Reading",   icon: Book,       color: "text-green-700", bg: "bg-green-50",  border: "border-green-200" },
  writing:   { label: "Writing",   icon: PenTool,    color: "text-amber-700", bg: "bg-amber-50",  border: "border-amber-200" },
  speaking:  { label: "Speaking",  icon: Mic,        color: "text-red-700",   bg: "bg-red-50",    border: "border-red-200" },
};
const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; color: string; bg: string }> = {
  easy:   { label: "Dễ",       color: "text-green-700", bg: "bg-green-100" },
  medium: { label: "Trung bình",color: "text-amber-700", bg: "bg-amber-100" },
  hard:   { label: "Khó",      color: "text-red-700",   bg: "bg-red-100" },
  mixed:  { label: "Hỗn hợp",  color: "text-gray-700",  bg: "bg-gray-100" },
};
const PURPOSE_LABELS: Record<Purpose, string> = {
  review: "Ôn tập", practice: "Luyện tập", drill: "Rèn luyện", mock_test: "Thi thử", homework: "Bài tập về nhà",
};

export function PracticeSessionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedQ, setExpandedQ] = useState<number | null>(null);
  const [showAllQuestions, setShowAllQuestions] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/teacher/practice-sessions/${id}`);
        if (res.data.status === "success") setSession(res.data.data);
        else throw new Error(res.data.message);
      } catch (e: any) {
        setError(e.response?.data?.message || e.message || "Không thể tải dữ liệu");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      <div className="text-center"><Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-3" /><p className="text-gray-600">Đang tải...</p></div>
    </div>
  );

  if (error || !session) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      <div className="text-center bg-white rounded-2xl p-10 border border-red-100 shadow-sm max-w-sm">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-gray-800 font-semibold mb-4">{error || "Không tìm thấy bài ôn tập"}</p>
        <button onClick={() => navigate(-1)} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium transition-colors">Quay lại</button>
      </div>
    </div>
  );

  const typeConf = TYPE_CONFIG[session.ps_type];
  const TypeIcon = typeConf.icon;
  const skillConf = session.ps_target_skill ? SKILL_CONFIG[session.ps_target_skill] : null;
  const SkillIcon = skillConf?.icon;
  const diffConf = DIFFICULTY_CONFIG[session.ps_difficulty];
  const questions = session.exam?.questions || [];
  const visibleQuestions = showAllQuestions ? questions : questions.slice(0, 5);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-6 md:p-8">
      <div className="w-full space-y-6">

        {/* ── Back + Header ── */}
        <div>
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Quay lại danh sách
          </button>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex-1">
                {/* Badges */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg border ${typeConf.bg} ${typeConf.color} ${typeConf.border}`}>
                    <TypeIcon className="w-3.5 h-3.5" /> {typeConf.label}
                  </span>
                  {skillConf && SkillIcon && (
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg border ${skillConf.bg} ${skillConf.color} ${skillConf.border}`}>
                      <SkillIcon className="w-3.5 h-3.5" /> {skillConf.label}
                    </span>
                  )}
                  <span className={`px-3 py-1 text-xs font-semibold rounded-lg ${diffConf.bg} ${diffConf.color}`}>
                    {diffConf.label}
                  </span>
                  <span className={`px-3 py-1 text-xs font-semibold rounded-lg ${session.ps_is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                    {session.ps_is_active ? "Đang hoạt động" : "Không hoạt động"}
                  </span>
                </div>

                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{session.ps_title}</h1>
                {session.ps_description && <p className="text-gray-500 leading-relaxed">{session.ps_description}</p>}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 shrink-0">
                <button className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
                  <Send className="w-4 h-4" /> Giao bài
                </button>
                <button onClick={() => navigate(`/giao-vien/luyen-tap/${session.ps_id}/chinh-sua`)} className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-semibold rounded-xl transition-colors border border-blue-200">
                  <Edit className="w-4 h-4" /> Chỉnh sửa
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold rounded-xl transition-colors border border-red-200">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Clock,    label: "Thời gian",    value: `${session.ps_duration_minutes} phút`, color: "text-blue-600",   bg: "bg-blue-50",   border: "border-blue-100" },
            { icon: FileText, label: "Số câu hỏi",   value: `${questions.length || session.ps_question_count} câu`, color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-100" },
            { icon: Target,   label: "Mục đích",     value: PURPOSE_LABELS[session.ps_purpose] || session.ps_purpose, color: "text-amber-600",  bg: "bg-amber-50",  border: "border-amber-100" },
            { icon: Calendar, label: "Ngày tạo",     value: formatVNDate(session.ps_created_at), color: "text-gray-600",   bg: "bg-gray-50",   border: "border-gray-100" },
          ].map(({ icon: Icon, label, value, color, bg, border }) => (
            <div key={label} className={`bg-white rounded-2xl border ${border} p-5 shadow-sm`}>
              <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <p className="text-xs text-gray-500 mb-0.5">{label}</p>
              <p className="text-base font-bold text-gray-900">{value}</p>
            </div>
          ))}
        </div>

        {/* ── Main content: 2 cols ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* ── Left: Exam info ── */}
          <div className="md:col-span-1 space-y-4">

            {/* Linked exam */}
            {session.exam && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-500" /> Đề thi liên kết
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-500">Tên đề thi</p>
                    <p className="font-semibold text-gray-900 text-sm">{session.exam.eTitle}</p>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Thời lượng</span>
                    <span className="font-medium">{session.exam.eDuration_minutes} phút</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Số câu</span>
                    <span className="font-medium">{questions.length} câu</span>
                  </div>
                  <Link
                    to={`/giao-vien/de-thi/${session.exam.eId}`}
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium mt-2"
                  >
                    <Eye className="w-3.5 h-3.5" /> Xem đề thi
                  </Link>
                </div>
              </div>
            )}

            {/* Extra info */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                <Hash className="w-4 h-4 text-gray-400" /> Thông tin thêm
              </h3>
              <div className="space-y-2 text-sm">
                {session.ps_topic && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 flex items-center gap-1"><Tag className="w-3.5 h-3.5" /> Chủ đề</span>
                    <span className="font-medium text-gray-800">{session.ps_topic}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Cập nhật</span>
                  <span className="text-gray-600 text-xs">{new Date(session.ps_updated_at).toLocaleString("vi-VN")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">ID</span>
                  <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">#{session.ps_id}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right: Questions ── */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-500" /> Danh sách câu hỏi
                  <span className="ml-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">{questions.length}</span>
                </h3>
              </div>

              {questions.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Chưa có câu hỏi</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleQuestions.map((q, idx) => (
                    <div key={q.qId} className="border border-gray-100 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setExpandedQ(expandedQ === q.qId ? null : q.qId)}
                        className="w-full flex items-start gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
                      >
                        <span className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <p className="flex-1 text-sm text-gray-800 font-medium line-clamp-2">
                          {q.qContent ? q.qContent.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&#39;/gi, "'").replace(/&quot;/gi, '"').replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim() : ""}
                        </p>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-gray-400">{q.qPoints} điểm</span>
                          {expandedQ === q.qId ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </div>
                      </button>

                      {expandedQ === q.qId && q.answers.length > 0 && (
                        <div className="px-4 pb-4 pt-0 border-t border-gray-100 bg-gray-50 space-y-2">
                          {q.answers.map((a) => (
                            <div key={a.aId} className={`flex items-start gap-2 px-3 py-2 rounded-lg text-sm ${a.aIs_correct ? "bg-emerald-50 border border-emerald-200" : "bg-white border border-gray-100"}`}>
                              {a.aIs_correct
                                ? <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                : <XCircle className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" />}
                              <span className={a.aIs_correct ? "text-emerald-700 font-medium" : "text-gray-600"}>
                                {a.aContent ? a.aContent.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&#39;/gi, "'").replace(/&quot;/gi, '"').replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim() : ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {questions.length > 5 && (
                    <button
                      onClick={() => setShowAllQuestions(!showAllQuestions)}
                      className="w-full py-3 text-sm text-blue-600 hover:text-blue-700 font-medium border border-dashed border-blue-200 rounded-xl hover:bg-blue-50 transition-colors"
                    >
                      {showAllQuestions ? `Ẩn bớt` : `Xem thêm ${questions.length - 5} câu hỏi`}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
