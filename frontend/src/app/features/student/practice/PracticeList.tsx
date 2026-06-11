import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Zap,
  Target,
  Shuffle,
  AlertCircle,
  TrendingUp,
  BookOpen,
  Play,
  CheckCircle2,
  Lock,
  Headphones,
  PenSquare,
  Mic,
} from "lucide-react";
import { studentApi } from "../../../../services/studentApi";
import { getAuthUser } from "../../../../utils/authStorage";
import { getSkillColor, getSkillIcon, getSkillName } from "../../../../utils/skillHelpers";

type SkillFilter = 'all' | 'listening' | 'reading' | 'writing' | 'speaking';
type DifficultyFilter = 'all' | 'easy' | 'medium' | 'hard';

const STUDENT_BASE_PATH = "/hoc-vien";
const THEME_KIDS    = { PRIMARY: '#F43F5E', PRIMARY_LIGHT: '#FFE4E6' };
const THEME_DEFAULT = { PRIMARY: '#7C3AED', PRIMARY_LIGHT: '#EDE9FE' };

export function PracticeList() {
  const [skill, setSkill] = useState<SkillFilter>('all');
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('all');

  // Hide VSTEP content for kids (Cambridge YL audience).
  // Dùng getAuthUser() để đọc từ CẢ localStorage lẫn sessionStorage (login không "ghi nhớ").
  const authUser = getAuthUser();
  const ageGroup = (authUser?.age_group ?? authUser?.ageGroup ?? '') as string;
  const isKids = ageGroup === 'kids';

  // Theme palette switches based on age group (rose for kids, purple for others)
  const { PRIMARY: PURPLE, PRIMARY_LIGHT: PURPLE_LIGHT } = isKids ? THEME_KIDS : THEME_DEFAULT;

  // URL base — kids dùng chung namespace /hoc-vien như các nhóm khác
  const BASE = STUDENT_BASE_PATH;

  const { data, isLoading } = useQuery({
    queryKey: ['student', 'practice', 'topics'],
    queryFn: () => studentApi.getPracticeTopics(),
  });

  const topics = (data as any)?.data?.data?.topics || [];

  const filteredTopics = topics.filter((topic: any) => {
    if (skill !== 'all' && topic.skill !== skill) return false;
    if (difficulty !== 'all' && topic.difficulty !== difficulty) return false;
    return true;
  });

  const quickActions = [
    { icon: Shuffle, title: "Luyện ngẫu nhiên", desc: "10 câu hỏi tổng hợp", color: "#8B5CF6", path: `${BASE}/luyen-tap/random?count=10`, bg: "#F5F3FF" },
    { icon: AlertCircle, title: "Ôn lại lỗi sai", desc: "Các câu hay sai gần đây", color: "#EF4444", path: `${BASE}/luyen-tap/mistakes`, bg: "#FEF2F2" },
    { icon: BookOpen, title: "Khám phá mới", desc: "Các chủ đề chưa học", color: "#10B981", path: `${BASE}/luyen-tap/new`, bg: "#F0FDF4" },
    { icon: Target, title: "Tạo bộ đề riêng", desc: "Tuỳ biến cấp độ và số lượng", color: "#F59E0B", path: `${BASE}/luyen-tap/custom`, bg: "#FFFBEB" },
  ];

  const skillTabs = [
    { key: 'all', label: "Tất cả kỹ năng" },
    { key: 'listening', label: "Nghe (Listening)" },
    { key: 'reading', label: "Đọc (Reading)" },
    { key: 'writing', label: "Viết (Writing)" },
    { key: 'speaking', label: "Nói (Speaking)" },
  ];

  const getDifficultyColor = (diff: string) => {
    if (diff === 'easy') return { text: '#10B981', bg: '#D1FAE5' };
    if (diff === 'medium') return { text: '#2563EB', bg: '#DBEAFE' };
    if (diff === 'hard') return { text: '#EF4444', bg: '#FEE2E2' };
    return { text: '#6B7280', bg: '#F3F4F6' };
  };

  return (
    <div className="min-h-screen" style={{ background: "#F8F7FF" }}>

      {/* ══ Hero ═════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1E0B4B 0%, #3B1B8F 45%, #1D4ED8 100%)" }}>
        {/* Orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full opacity-20"
            style={{ background: "radial-gradient(circle, #A78BFA, transparent)", transform: "translateY(-50%)" }} />
          <div className="absolute bottom-0 right-1/3 w-64 h-64 rounded-full opacity-15"
            style={{ background: "radial-gradient(circle, #60A5FA, transparent)", transform: "translateY(40%)" }} />
        </div>
        <div className="relative z-10 px-8 lg:px-16 py-10 max-w-[1600px] mx-auto">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg"
                style={{ background: "linear-gradient(135deg, #7C3AED, #8B5CF6)" }}>
                <Zap className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-purple-300 text-sm font-semibold tracking-widest uppercase mb-1">Khu vực học tập</p>
                <h1 className="text-3xl font-extrabold text-white tracking-tight leading-tight">Luyện tập</h1>
                <p className="text-purple-200 text-sm mt-1 font-medium">Tự do rèn luyện thông qua kho đề khổng lồ trên hệ thống</p>
              </div>
            </div>
          </div>
          {/* Stat chips */}
          <div className="flex items-center gap-3 flex-wrap">
            {[
              { label: "Chủ đề", value: isLoading ? "—" : topics.length, color: "#C4B5FD" },
              { label: "Luyện nhanh", value: "4", color: "#FCD34D" },
              { label: "Kỹ năng", value: "4", color: "#86EFAC" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)" }}>
                <span className="text-xl font-extrabold" style={{ color: s.color }}>{s.value}</span>
                <span className="text-xs font-semibold text-purple-200">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ Content ══════════════════════════════════════════════════════════ */}
      <div className="px-8 lg:px-16 py-8 max-w-[1600px] mx-auto space-y-8">

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickActions.map((action) => (
          <Link key={action.title} to={action.path}
                className="group p-5 rounded-3xl transition-all duration-300 hover:-translate-y-1"
                style={{ background: "#fff", border: "1.5px solid #F0F0F8", boxShadow: "0 4px 20px rgba(124,58,237,0.05)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = `0 12px 30px rgba(124,58,237,0.12)`;
                  e.currentTarget.style.borderColor = `rgba(124,58,237,0.25)`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "0 4px 20px rgba(124,58,237,0.05)";
                  e.currentTarget.style.borderColor = "#F0F0F8";
                }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110" style={{ background: action.bg }}>
               <action.icon className="w-6 h-6" style={{ color: action.color }} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "#1A1040", marginBottom: 4 }}>{action.title}</h3>
            <p style={{ fontSize: 13, color: "#6B7280" }}>{action.desc}</p>
          </Link>
        ))}
      </div>

      {/* VSTEP Full Test (hidden for kids) */}
      {!isKids && (
      <div
        className="relative rounded-3xl overflow-hidden p-6 lg:p-7"
        style={{
          background: "linear-gradient(135deg, #1E0B4B 0%, #4C1D95 50%, #1D4ED8 100%)",
          boxShadow: "0 8px 32px rgba(124,58,237,0.25)",
        }}
      >
        {/* Decorative orb */}
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-20 pointer-events-none"
          style={{ background: "radial-gradient(circle, #A78BFA, transparent)" }} />
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="mb-2 inline-flex items-center rounded-full px-3 py-1 text-xs font-bold text-purple-200"
              style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)" }}>
              VSTEP Mock Test
            </p>
            <h2 className="text-white" style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em" }}>
              Bài thi VSTEP Full 4 kỹ năng
            </h2>
            <p className="text-purple-200" style={{ fontSize: 14, marginTop: 6 }}>
              1 bài hoàn chỉnh gồm Nghe - Đọc - Viết - Nói, mô phỏng theo đề thi thật.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {[{Icon: Headphones, label: "Listening"}, {Icon: BookOpen, label: "Reading"}, {Icon: PenSquare, label: "Writing"}, {Icon: Mic, label: "Speaking"}].map(({Icon, label}) => (
                <span key={label} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                  style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)" }}>
                  <Icon className="h-3.5 w-3.5" /> {label}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <div className="rounded-xl px-4 py-2 text-sm font-semibold text-purple-200"
              style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}>
              Thời lượng: <span className="text-yellow-300 font-bold">~180 phút</span>
            </div>
            <Link
              to={`${STUDENT_BASE_PATH}/luyen-tap/custom?mode=vstep-full-4-skills`}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white transition hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #7C3AED, #8B5CF6)", boxShadow: "0 4px 16px rgba(124,58,237,0.4)" }}
            >
              <Play className="h-4 w-4 fill-current" />
              Bắt đầu bài thi VSTEP
            </Link>
          </div>
        </div>
      </div>
      )}

      {/* Topics Grid Section */}
      <div className="bg-white rounded-3xl p-6 lg:p-8" style={{ border: "1.5px solid #F0F0F8", boxShadow: "0 8px 32px rgba(124,58,237,0.06)" }}>
         <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-4 mb-8">
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#1F1344" }}>Chủ đề luyện tập</h2>
            
            <div className="flex items-center gap-2 overflow-x-auto pb-2 xl:pb-0 scrollbar-hide">
              {skillTabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setSkill(tab.key as SkillFilter)}
                  className="px-4 py-2 rounded-xl whitespace-nowrap transition-all"
                  style={{
                    background: skill === tab.key ? PURPLE : "#F3F4F6",
                    color: skill === tab.key ? "#fff" : "#6B7280",
                    fontWeight: skill === tab.key ? 700 : 600,
                    fontSize: 14,
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
         </div>

         {/* Topics Grid */}
         {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
               {[1,2,3,4].map(i => <div key={i} className="h-40 rounded-2xl bg-gray-100 animate-pulse" />)}
            </div>
         ) : filteredTopics.length === 0 ? (
            <div className="text-center py-20">
               <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-20" />
               <p className="font-bold text-gray-500 text-lg">Không tìm thấy chủ đề phù hợp</p>
            </div>
         ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
               {filteredTopics.map((topic: any) => {
                  const Icon = getSkillIcon(topic.skill);
                  const color = getSkillColor(topic.skill);
                  const diffColor = getDifficultyColor(topic.difficulty);
                  const progress = topic.total_questions > 0 ? (topic.completed_questions / topic.total_questions) * 100 : 0;
                  const isLocked = topic.is_locked;

                  return (
                    <div key={topic.id} className="group flex flex-col justify-between p-5 rounded-3xl transition-all"
                         style={{
                           background: isLocked ? "#F9FAFB" : "#fff",
                           border: "1.5px solid",
                           borderColor: isLocked ? "#F3F4F6" : "#F0EEFF",
                           opacity: isLocked ? 0.7 : 1
                         }}>
                       <div>
                          <div className="flex justify-between items-start mb-4">
                             <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
                                {isLocked ? <Lock className="w-5 h-5 text-gray-400" /> : <Icon className="w-5 h-5" style={{ color }} />}
                             </div>
                             <span className="px-2.5 py-1 rounded-lg text-xs font-bold" style={{ background: diffColor.bg, color: diffColor.text }}>
                                {topic.difficulty}
                             </span>
                          </div>
                          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1F1344", marginBottom: 8 }} className="line-clamp-2 h-12">
                             {topic.name}
                          </h3>

                          {/* Progress */}
                          <div className="mb-6">
                            <div className="flex justify-between text-xs mb-2">
                               <span className="text-gray-500 font-semibold">{topic.completed_questions}/{topic.total_questions} câu</span>
                               <span style={{ color: color, fontWeight: 800 }}>{Math.round(progress)}%</span>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden bg-gray-100">
                               <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: color }} />
                            </div>
                          </div>
                       </div>

                       {/* Footer Action */}
                       <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                          <span className="text-xs font-semibold text-gray-400">
                             ~{topic.estimated_time} phút
                          </span>
                          {!isLocked && (
                             <Link to={`${BASE}/luyen-tap/${topic.id}`}
                                    className="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                                    style={{ background: `${color}15`, color: color }}>
                                <Play className="w-4 h-4 fill-current ml-0.5" />
                             </Link>
                          )}
                       </div>
                    </div>
                  );
               })}
            </div>
         )}
      </div>
      </div>
    </div>
  );
}
