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
