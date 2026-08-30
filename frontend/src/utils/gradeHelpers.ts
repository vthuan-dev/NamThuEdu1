export function getGradeBadge(score: number): string {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'B+';
  if (score >= 80) return 'B';
  if (score >= 75) return 'C+';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

export function getGradeColor(grade: string): { bg: string; text: string; border: string } {
  if (grade.startsWith('A')) return { bg: '#D1FAE5', text: '#065F46', border: '#10B981' };
  if (grade.startsWith('B')) return { bg: '#DBEAFE', text: '#1E40AF', border: '#2563EB' };
  if (grade.startsWith('C')) return { bg: '#FEF3C7', text: '#78350F', border: '#F59E0B' };
  return { bg: '#FEE2E2', text: '#991B1B', border: '#EF4444' };
}

export function getGradeDescription(grade: string, locale: string = 'vi'): string {
  const descriptions: Record<string, { vi: string; en: string }> = {
    'A+': { vi: 'Xuất sắc', en: 'Excellent' },
    'A': { vi: 'Rất tốt', en: 'Very Good' },
    'B+': { vi: 'Tốt', en: 'Good' },
    'B': { vi: 'Khá', en: 'Above Average' },
    'C+': { vi: 'Trung bình khá', en: 'Average+' },
    'C': { vi: 'Trung bình', en: 'Average' },
    'D': { vi: 'Yếu', en: 'Below Average' },
    'F': { vi: 'Kém', en: 'Fail' },
  };
  return descriptions[grade]?.[locale as 'vi' | 'en'] || grade;
}

export function isPassingGrade(score: number, threshold: number = 70): boolean {
  return score >= threshold;
}

export function calculateGradeImprovement(currentScore: number, previousScore: number): {
  difference: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
} {
  const difference = currentScore - previousScore;
  const percentage = previousScore > 0 ? (difference / previousScore) * 100 : 0;
  
  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (difference > 2) trend = 'up';
  else if (difference < -2) trend = 'down';

  return { difference, percentage, trend };
}

// ─── VSTEP shared score helpers ──────────────────────────────────────────────
// Single source-of-truth used by GradingQueue list AND TeacherReviewModal.

export const VSTEP_SKILL_KEYS = ['listening', 'reading', 'writing', 'speaking'] as const;
export type VstepSkillKey = typeof VSTEP_SKILL_KEYS[number];

/** Parse sGemini_feedback JSON and return per-skill scores (null if missing). */
export function parseVstepScores(sGemini_feedback?: string): Record<VstepSkillKey, number | null> {
  try {
    const vs = JSON.parse(sGemini_feedback ?? '{}')?.vstep_scores ?? {};
    return {
      listening: vs.listening !== undefined && vs.listening !== null ? Number(vs.listening) : null,
      reading:   vs.reading   !== undefined && vs.reading   !== null ? Number(vs.reading)   : null,
      writing:   vs.writing   !== undefined && vs.writing   !== null ? Number(vs.writing)   : null,
      speaking:  vs.speaking  !== undefined && vs.speaking  !== null ? Number(vs.speaking)  : null,
    };
  } catch {
    return { listening: null, reading: null, writing: null, speaking: null };
  }
}

/** Average all four VSTEP skills. Returns null if any skill is missing. */
export function calcVstepAvg(vstepScores: Record<VstepSkillKey, number | null>): number | null {
  const vals = VSTEP_SKILL_KEYS.map((k) => vstepScores[k]);
  if (vals.some((v) => v === null)) return null;
  return (vals as number[]).reduce((s, v) => s + v, 0) / vals.length;
}

/** Returns true for VSTEP exam type or title. */
export function isVstepExam(examType?: string, examTitle?: string): boolean {
  return (
    examType?.toUpperCase() === 'VSTEP' ||
    String(examTitle ?? '').toUpperCase().includes('VSTEP')
  );
}

// ─── Thang điểm theo từng loại đề ────────────────────────────────────────────
// `submissions.sScore` KHÔNG có thang thống nhất — mỗi luồng chấm lưu một kiểu:
//
//   THPT    → điểm đã quy đổi sẵn theo `thpt_config.scale_max` (mặc định 10).
//             ThptExamController::gradeThpt() làm round(raw / rawMax * scale_max).
//   VSTEP   → band 0-10 nhân 10 (GradingController L499).
//   IELTS   → band 0-9  nhân 10 (GradingController L608, có ghi chú "for
//             compatibility with reports/sScore-based filters").
//   Còn lại → PHẦN TRĂM 0-100 (StudentTestController L3563).
//
// Vì vậy không thể lấy một `maxScore` chung cho cả bảng. Trước đây UI dùng
// `eTotal_score ?? 100`, mà `eTotal_score` null trên toàn bộ dữ liệu, nên mọi
// dòng đều hiện "/100" — kể cả bài THPT vốn đã là thang 10 (3.40/10 bị hiện
// thành 3.40/100, trông như 3.4%).
//
// Toàn bộ quy tắc quy đổi nằm ở đây để chỉ có MỘT nơi cần sửa.

export interface ScoreScale {
  /** Điểm tối đa của thang hiển thị. */
  max: number;
  /** Chia sScore thô cho số này để ra điểm hiển thị. */
  divisor: number;
  /** Nhãn ngắn hiện cạnh điểm, vì một bảng có thể trộn nhiều thang. */
  label: string;
}

/** Thang mặc định khi đề không khai báo gì: hệ 10. */
export const DEFAULT_SCALE_MAX = 10;

/** Returns true cho đề IELTS (thang band 0-9, khác VSTEP). */
export function isIeltsExam(examType?: string, examTitle?: string): boolean {
  return (
    String(examType ?? '').toUpperCase().startsWith('IELTS') ||
    String(examTitle ?? '').toUpperCase().includes('IELTS')
  );
}

/**
 * Thang điểm của một bài làm.
 *
 * `scaleMax` chỉ áp dụng cho đề THPT — đó là `thpt_config.scale_max`, hệ số
 * giáo viên tự đặt trong trang soạn đề. Đừng truyền `eTotal_score` vào đây:
 * đó là tổng điểm THÔ của đề, không phải thang hiển thị.
 *
 * IELTS và VSTEP giữ thang chuẩn quốc tế (band 9 / band 10) — quy về hệ 10 sẽ
 * biến 7.0 band thành 7.8, vô nghĩa với giáo viên dạy IELTS.
 */
export function resolveScoreScale(opts: {
  examType?: string;
  examTitle?: string;
  scaleMax?: number | null;
}): ScoreScale {
  const { examType, examTitle } = opts;
  const scaleMax = opts.scaleMax && opts.scaleMax > 0 ? opts.scaleMax : null;

  if (isIeltsExam(examType, examTitle)) {
    return { max: 9, divisor: 10, label: 'band IELTS' };
  }
  if (isVstepExam(examType, examTitle)) {
    return { max: 10, divisor: 10, label: 'band VSTEP' };
  }
  if (String(examType ?? '').toUpperCase() === 'THPT') {
    // Backend đã quy đổi sẵn về scale_max nên không chia thêm.
    const max = scaleMax ?? DEFAULT_SCALE_MAX;
    return { max, divisor: 1, label: `hệ ${max}` };
  }
  // GENERAL / Kids / Teens: sScore là phần trăm → luôn quy về hệ 10. Các loại đề
  // này chưa có ô cho giáo viên đặt hệ số, nên không đọc scaleMax ở đây — cứ
  // đọc là sớm hay muộn sẽ nhận phải một giá trị không phải thang hiển thị.
  return { max: DEFAULT_SCALE_MAX, divisor: 100 / DEFAULT_SCALE_MAX, label: `hệ ${DEFAULT_SCALE_MAX}` };
}

/**
 * Canonical display score for any submission.
 * Trả về điểm ĐÃ quy đổi sang thang hiển thị của đề, kèm nhãn thang.
 * Returns null when no score is available.
 */
export function getSubmissionDisplayScore(
  opts: {
    examType?: string;
    examTitle?: string;
    sGemini_feedback?: string;
    score?: number;   // mapped from sScore
    maxScore?: number;
    /** Hệ số quy đổi giáo viên đặt trên đề (THPT: thpt_config.scale_max). */
    scaleMax?: number | null;
  }
): { value: number; max: number; label: string } | null {
  const { examType, examTitle, sGemini_feedback, score } = opts;
  const scale = resolveScoreScale({ examType, examTitle, scaleMax: opts.scaleMax });

  if (score !== undefined && score !== null) {
    return { value: score / scale.divisor, max: scale.max, label: scale.label };
  }

  // VSTEP: chưa có sScore thì lấy trung bình điểm AI 4 kỹ năng (đã là 0-10).
  if (isVstepExam(examType, examTitle)) {
    const avg = calcVstepAvg(parseVstepScores(sGemini_feedback));
    if (avg !== null) return { value: avg, max: scale.max, label: scale.label };
  }
  return null;
}

/**
 * Đảo chiều của `getSubmissionDisplayScore`: điểm giáo viên nhập trên thang
 * hiển thị → giá trị thô để lưu vào `sScore`.
 *
 * Bắt buộc phải dùng khi lưu. Nếu chỉ đổi hiển thị mà không đổi chiều lưu thì
 * giáo viên nhập 8 cho đề GENERAL sẽ ghi sScore = 8, tức 8%, chứ không phải
 * 8/10.
 */
export function toRawScore(
  displayValue: number,
  opts: { examType?: string; examTitle?: string; scaleMax?: number | null }
): number {
  const scale = resolveScoreScale(opts);
  return Math.round(displayValue * scale.divisor * 100) / 100;
}

/** Patch object passed from modal → queue when teacher saves a review. */
export interface SubmissionScoreUpdate {
  id: string;
  /** New raw score saved to DB (= totalOverride * 10 for VSTEP). */
  rawScore?: number;
  sTeacher_feedback?: string;
  /** Updated AI feedback JSON string (unchanged, forwarded for consistency). */
  sGemini_feedback?: string;
  teacher_reviewed_at: string;
}
