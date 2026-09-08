/**
 * examClassify — phân loại đề thi của admin theo nhóm tuổi và loại đề.
 *
 * Dùng cho trang Quản lý đề thi (AdminCoursesPage). Metadata màu/icon đồng bộ
 * với examCatalog.ts của giáo viên để giữ nhất quán toàn hệ thống.
 */
import {
  Award,
  BookOpen,
  FileText,
  Globe,
  GraduationCap,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { AdminExam } from "@/services/adminApi";

export type AgeGroupKey = "kids" | "teens" | "adults" | "other";

export interface AgeGroupMeta {
  key: AgeGroupKey;
  label: string;
  range: string;
  icon: LucideIcon;
  color: string;
  /** nền nhạt cho chip/segment active */
  softBg: string;
}

export const AGE_GROUP_META: Record<AgeGroupKey, AgeGroupMeta> = {
  kids: { key: "kids", label: "Kids", range: "6 - 12 tuổi", icon: Sparkles, color: "#F97316", softBg: "#FFF7ED" },
  teens: { key: "teens", label: "Teens", range: "13 - 17 tuổi", icon: GraduationCap, color: "#2563EB", softBg: "#EFF6FF" },
  adults: { key: "adults", label: "Adults", range: "18+ tuổi", icon: BookOpen, color: "#7C3AED", softBg: "#F5F3FF" },
  other: { key: "other", label: "Khác", range: "Chưa phân loại", icon: FileText, color: "#64748B", softBg: "#F8FAFC" },
};

export interface ExamTypeMeta {
  /** key chuẩn hoá */
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
  softBg: string;
  ageGroup: AgeGroupKey;
}

/**
 * Metadata cho từng loại đề. key đã chuẩn hoá (uppercase, bỏ dấu cách).
 */
export const EXAM_TYPE_META: Record<string, ExamTypeMeta> = {
  VSTEP: { key: "VSTEP", label: "VSTEP", icon: Award, color: "#0F766E", softBg: "#F0FDFA", ageGroup: "adults" },
  IELTS: { key: "IELTS", label: "IELTS", icon: Globe, color: "#0F4C81", softBg: "#EFF6FF", ageGroup: "adults" },
  THPT: { key: "THPT", label: "THPT Quốc Gia", icon: GraduationCap, color: "#2563EB", softBg: "#EFF6FF", ageGroup: "teens" },
  KIDS: { key: "KIDS", label: "Cambridge YLE", icon: Sparkles, color: "#F97316", softBg: "#FFF7ED", ageGroup: "kids" },
  CAMBRIDGE: { key: "CAMBRIDGE", label: "Cambridge", icon: BookOpen, color: "#DC2626", softBg: "#FEF2F2", ageGroup: "adults" },
  GENERAL: { key: "GENERAL", label: "Đề tổng quát", icon: FileText, color: "#64748B", softBg: "#F8FAFC", ageGroup: "other" },
};

const OTHER_TYPE_META: ExamTypeMeta = EXAM_TYPE_META.GENERAL;

/** Lấy giá trị eId/id an toàn */
export function getExamId(exam: AdminExam): number {
  return exam.eId || exam.id || 0;
}

export function getExamTitle(exam: AdminExam): string {
  return exam.eTitle || exam.title || "Không có tiêu đề";
}

export function getExamTeacher(exam: AdminExam): string {
  return exam.teacher?.uName || exam.teacher?.name || "Không rõ";
}

export function getExamTeacherId(exam: AdminExam): number | null {
  const tid = (exam as any).eTeacher_id ?? (exam as any).teacher_id ?? exam.teacher?.uId ?? exam.teacher?.id;
  return typeof tid === "number" ? tid : (tid ? Number(tid) : null);
}

export function getExamSkill(exam: AdminExam): string {
  return exam.eSkill || exam.ielts_skill || "";
}

export function getExamLevel(exam: AdminExam): string {
  return exam.eTarget_level || exam.eDifficulty || exam.difficulty_level || "";
}

export function getExamCreatedAt(exam: AdminExam): string {
  return exam.eCreated_at || exam.created_at || "";
}

export function getExamStatus(exam: AdminExam): string {
  if (exam.eStatus) return exam.eStatus;
  return exam.eIs_private ? "draft" : "published";
}

/** Chuẩn hoá chuỗi loại đề thô về key trong EXAM_TYPE_META */
function normalizeTypeKey(raw: string): string | null {
  const t = raw.trim().toUpperCase();
  if (!t) return null;
  if (t.includes("VSTEP")) return "VSTEP";
  if (t.includes("IELTS")) return "IELTS";
  if (t.includes("THPT")) return "THPT";
  if (t.includes("KID") || t.includes("YLE") || t.includes("STARTER") || t.includes("MOVER") || t.includes("FLYER")) return "KIDS";
  if (t.includes("CAMBRIDGE") || t.includes("KET") || t.includes("PET") || t.includes("FCE") || t.includes("CAE")) return "CAMBRIDGE";
  if (t.includes("GENERAL") || t === "N/A") return "GENERAL";
  return null;
}

/** Trả về metadata loại đề cho 1 exam (luôn có giá trị, fallback GENERAL). */
export function classifyExamType(exam: AdminExam): ExamTypeMeta {
  // Ưu tiên age_group=kids: đề cho trẻ luôn là Cambridge YLE, bất kể eType
  // (nhiều đề kids bị lưu eType='VSTEP' do default DB → phải chặn ở đây).
  const ag = (exam.age_group || "").trim().toLowerCase();
  if (ag === "kids") return EXAM_TYPE_META.KIDS;

  const candidates = [exam.eType, exam.content_type, exam.ielts_test_type].filter(Boolean) as string[];
  for (const c of candidates) {
    const key = normalizeTypeKey(c);
    if (key && EXAM_TYPE_META[key]) return EXAM_TYPE_META[key];
  }
  return OTHER_TYPE_META;
}

/** Xác định nhóm tuổi của 1 exam: ưu tiên age_group, fallback suy từ loại đề. */
export function classifyAgeGroup(exam: AdminExam): AgeGroupKey {
  const ag = (exam.age_group || "").trim().toLowerCase();
  if (ag === "kids" || ag === "teens" || ag === "adults") return ag;
  return classifyExamType(exam).ageGroup;
}

const STATUS_LABEL: Record<string, string> = {
  published: "Đã xuất bản",
  draft: "Nháp",
  pending: "Chờ duyệt",
  archived: "Lưu trữ",
  rejected: "Từ chối",
};

export function statusLabel(status: string): string {
  return STATUS_LABEL[status] || status;
}

/**
 * Chuyển đổi mã kỹ năng (eSkill, ielts_skill) sang nhãn tiếng Việt rõ ràng, dễ hiểu.
 * Ví dụ: 'mixed' -> 'Kỹ năng: Tổng hợp', 'reading' -> 'Kỹ năng: Đọc'
 */
export function formatSkillLabel(rawSkill?: string | null, includePrefix = true): string {
  if (!rawSkill) return "";
  const s = rawSkill.trim().toLowerCase();

  const nameMap: Record<string, string> = {
    mixed: "Tổng hợp",
    full: "Tổng hợp",
    listening: "Nghe",
    reading: "Đọc",
    writing: "Viết",
    speaking: "Nói",
    grammar: "Ngữ pháp",
    vocabulary: "Từ vựng",
  };

  const name = nameMap[s] || rawSkill;
  if (!includePrefix) {
    if (s === "mixed" || s === "full") return "Tổng hợp kỹ năng";
    return name;
  }
  return `Kỹ năng: ${name}`;
}

/**
 * Chuyển đổi độ khó / cấp độ (eDifficulty, eTarget_level) sang nhãn tiếng Việt rõ ràng.
 * Ví dụ: 'medium' -> 'Độ khó: Trung bình', 'easy' -> 'Độ khó: Dễ'
 */
export function formatLevelLabel(rawLevel?: string | null, includePrefix = true): string {
  if (!rawLevel) return "";
  const l = rawLevel.trim().toLowerCase();

  const levelMap: Record<string, string> = {
    easy: "Dễ",
    medium: "Trung bình",
    hard: "Khó",
    beginner: "Cơ bản",
    intermediate: "Trung cấp",
    advanced: "Nâng cao",
  };

  if (levelMap[l]) {
    return includePrefix ? `Độ khó: ${levelMap[l]}` : levelMap[l];
  }

  // Nếu là dạng CEFR (A1, A2, B1, B2, C1, C2)
  if (/^[abc][12]$/i.test(l)) {
    return includePrefix ? `Trình độ: ${rawLevel.toUpperCase()}` : rawLevel.toUpperCase();
  }

  // IELTS band (e.g. 5.5, 6.0, 6.5, 7.0...)
  if (/^\d+(\.\d+)?$/.test(l)) {
    return includePrefix ? `Band: ${rawLevel}` : `Band ${rawLevel}`;
  }

  return includePrefix ? `Cấp độ: ${rawLevel}` : rawLevel;
}

/**
 * Format thời gian tạo đề thi dạng tiếng Việt rõ ràng:
 * "Tạo lúc: 14:30 · 08/09/2026" (nếu có giờ) hoặc "Tạo ngày: 08/09/2026"
 */
export function formatExamDateTime(raw?: string | null, includePrefix = true): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;

  const dateStr = d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const hasTime = raw.includes(":") || raw.includes("T");
  const timeStr = hasTime
    ? d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    : "";

  const full = timeStr ? `${timeStr} · ${dateStr}` : dateStr;
  if (!includePrefix) return full;
  return timeStr ? `Tạo lúc: ${full}` : `Tạo ngày: ${full}`;
}

/**
 * Đường dẫn "Xem trước đề" (UI học viên) cho admin, route theo loại đề.
 * Tương ứng adminPreviewRoutes (/admin/de-thi/xem/*).
 */
export function getAdminPreviewUrl(exam: AdminExam): string {
  const id = getExamId(exam);
  const typeKey = classifyExamType(exam).key;

  if (typeKey === "IELTS") {
    const raw = (exam.ielts_skill || exam.eSkill || "").toLowerCase();
    const valid = ["listening", "reading", "writing", "speaking"];
    const skill = valid.includes(raw) ? raw : "listening";
    return `/admin/de-thi/xem/ielts/${skill}/${id}`;
  }
  if (typeKey === "VSTEP") return `/admin/de-thi/xem/vstep/${id}`;
  if (typeKey === "THPT") return `/admin/de-thi/xem/thpt/${id}`;
  // KIDS / Cambridge YLE và phần còn lại dùng trang preview kids
  return `/admin/de-thi/xem/kids/${id}`;
}

/**
 * Đếm số câu hỏi chính xác cho mọi loại đề thi:
 * - THPT: đếm từ thpt_config hoặc thpt_draft_config (sections hoặc parts)
 * - IELTS: đếm từ ielts_config (draft_data hoặc sections/passages/tasks/parts) nếu questions_count = 0
 * - VSTEP / Cambridge YLE / Kids / Teens: questions_count hoặc questions.length
 */
export function getExamQuestionCount(exam: any): number {
  if (!exam) return 0;

  // 1. THPT: ưu tiên đếm từ thpt_config hoặc thpt_draft_config
  const thpt = exam.thpt_config || exam.thpt_draft_config;
  const sections = thpt?.sections || thpt?.parts;
  if (Array.isArray(sections) && sections.length > 0) {
    let total = 0;
    for (const sec of sections) {
      const type = sec?.type || "";
      if (type === "mc_cloze" || type === "word_bank_cloze" || type === "open_cloze") {
        total += sec?.blanks?.length || 0;
      } else if (type === "tf_group") {
        for (const it of sec?.items || []) {
          total += it?.statements?.length || 1;
        }
      } else if (type === "reading_mixed") {
        for (const it of sec?.items || []) {
          if (it?.kind === "tf_group") {
            total += it?.statements?.length || 1;
          } else {
            total += 1;
          }
        }
      } else if (type === "matching") {
        for (const it of sec?.items || []) {
          total += it?.answers?.length || it?.pairs?.length || 1;
        }
      } else if (sec?.items && Array.isArray(sec.items)) {
        total += sec.items.length;
      } else if (sec?.blanks && Array.isArray(sec.blanks)) {
        total += sec.blanks.length;
      }
    }
    if (total > 0) return total;
  }

  // 2. IELTS: nếu questions_count = 0 hoặc thiếu, kiểm tra ielts_config hoặc ielts_data
  const ielts = exam.ielts_config?.draft_data || exam.ielts_config || exam.ielts_data;
  if (ielts && typeof ielts === "object") {
    let ieltsCount = 0;
    // listening
    const listeningSections = ielts.listening?.sections || ielts.sections;
    if (Array.isArray(listeningSections)) {
      for (const sec of listeningSections) {
        ieltsCount += sec?.questions?.length || 0;
      }
    }
    // reading
    const readingPassages = ielts.reading?.passages || ielts.passages;
    if (Array.isArray(readingPassages)) {
      for (const pass of readingPassages) {
        ieltsCount += pass?.questions?.length || 0;
      }
    }
    // writing
    const writingTasks = ielts.writing?.tasks || ielts.tasks;
    if (Array.isArray(writingTasks)) {
      ieltsCount += writingTasks.length;
    }
    // speaking
    const speakingParts = ielts.speaking?.parts || ielts.parts;
    if (Array.isArray(speakingParts)) {
      ieltsCount += speakingParts.length;
    }
    if (ieltsCount > 0 && (!exam.questions_count || exam.questions_count === 0)) {
      return ieltsCount;
    }
  }

  // 3. Fallback: questions_count hoặc questions.length
  const qc = exam.questions_count ?? exam.questionsCount;
  if (typeof qc === "number" && qc > 0) return qc;
  if (Array.isArray(exam.questions) && exam.questions.length > 0) return exam.questions.length;

  return typeof qc === "number" ? qc : 0;
}

