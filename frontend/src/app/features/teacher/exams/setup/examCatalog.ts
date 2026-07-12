/**
 * Catalog of exam types organized by age group.
 *
 * Mỗi entry chứa thông tin đủ để render card + redirect đến creator chuyên dụng.
 *
 * Note V2 (2026-06-08):
 * - Bỏ "teens-general" — Đề tự do cho Teens dẫn về creator legacy không có giá trị
 *   thực; sau khi có THPT chuyên dụng thì dạng này không cần.
 * - Tạm ẩn "adults-cambridge" và "adults-general" vì chưa có creator chuyên dụng,
 *   tránh dẫn user về legacy form rối. Code giữ trong block comment bên dưới để
 *   re-enable khi xây xong creator riêng.
 */
export type AgeGroupKey = 'kids' | 'teens' | 'adults' | 'all';

export type ExamSkillKey = 'mixed' | 'listening' | 'reading' | 'writing' | 'speaking';

export interface ExamSkillOption {
  value: ExamSkillKey;
  label: string;
  description?: string;
}

export interface ExamHighlight {
  /** Lucide icon name */
  iconName: string;
  label: string;
  value: string;
}

export interface ExamTypeOption {
  /** key duy nhất, dùng làm id để chọn */
  value: string;
  /** loại đề kỹ thuật để truyền cho creator (VSTEP/IELTS/Cambridge/THPT/Kids/General) */
  examType: 'VSTEP' | 'IELTS' | 'Cambridge' | 'THPT' | 'Kids' | 'General' | 'TeensAudio';
  name: string;
  /** Câu giới thiệu ngắn cho card chọn loại đề */
  description: string;
  /** Tagline dài hơn dùng cho preview card ở step Confirm */
  tagline?: string;
  duration: string;
  iconName: string;            // tên Lucide icon
  iconColor: string;           // màu icon hex
  /** Theme accent color của examType — dùng cho preview card */
  themeColor: string;
  /** Highlights hiển thị ở preview card (số phần / câu / kỹ năng…) */
  highlights?: ExamHighlight[];
  /** Nếu có skills → radio inline trong card loại đề */
  skills?: ExamSkillOption[];
  /**
   * Nếu chọn loại đề + skill này → redirect thẳng đến creator chuyên dụng.
   * - examType=THPT → /giao-vien/de-thi/thpt/tao-moi
   * - examType=Kids → /giao-vien/de-thi/kids/tao-moi
   * - examType=IELTS → /giao-vien/de-thi/ielts/{skillSlug}/tao-moi
   * - examType=VSTEP + Mixed → /giao-vien/de-thi/vstep/full/tao-moi
   * - examType=VSTEP + skill cụ thể → /giao-vien/de-thi/vstep/{skill}/tao-moi
   */
  needsSkill: boolean;
  badge?: string; // "Mới", "HOT", v.v.
}

export interface AgeGroupCatalog {
  key: AgeGroupKey;
  label: string;
  range: string;
  description: string;
  iconName: string;
  iconColor: string;
  examTypes: ExamTypeOption[];
}

export const AGE_GROUP_CATALOG: AgeGroupCatalog[] = [
  {
    key: 'kids',
    label: 'Kids',
    range: '6 - 12 tuổi',
    description: 'Cambridge YLE (Starters, Movers, Flyers) cho học viên nhỏ',
    iconName: 'Sparkles',
    iconColor: '#F97316',
    examTypes: [
      {
        value: 'kids-cambridge',
        examType: 'Kids',
        name: 'Cambridge YLE',
        description: 'Starters · Movers · Flyers',
        tagline: 'Đề chuẩn Cambridge cho trẻ tiểu học, có audio và hình minh họa',
        duration: '60 phút',
        iconName: 'Sparkles',
        iconColor: '#F97316',
        themeColor: '#F97316',
        highlights: [
          { iconName: 'Layers', label: 'Cấp độ', value: 'Starters / Movers / Flyers' },
          { iconName: 'ListChecks', label: 'Kỹ năng', value: 'Listening · Reading · Writing' },
          { iconName: 'Image', label: 'Đặc điểm', value: 'Có hình ảnh & audio' },
        ],
        needsSkill: false,
      },
    ],
  },
  {
    key: 'teens',
    label: 'Teens',
    range: '13 - 17 tuổi',
    description: 'Đề thi THCS, THPT, đầu vào đại học cho học viên cấp 2 và cấp 3',
    iconName: 'GraduationCap',
    iconColor: '#0D9488',
    examTypes: [
      {
        value: 'teens-thpt',
        examType: 'THPT',
        name: 'Đề tổng hợp Teens',
        description: 'Tự chọn dạng câu hỏi: ngữ pháp, từ vựng, đọc hiểu, nghe… — linh hoạt theo ý bạn',
        tagline: 'Đề đa dạng cho học viên cấp 2–3: trộn nhiều dạng câu hỏi + phần Nghe trong một đề',
        duration: '60 phút',
        iconName: 'GraduationCap',
        iconColor: '#2563EB',
        themeColor: '#2563EB',
        highlights: [
          { iconName: 'Layers', label: 'Cấu trúc', value: 'Linh hoạt 1-6 phần, tự chọn' },
          { iconName: 'ListChecks', label: 'Dạng câu', value: 'Ngữ pháp · Đọc hiểu · Nghe · …' },
          { iconName: 'Users', label: 'Đối tượng', value: 'Lớp 6 → 12, ĐGNL' },
        ],
        needsSkill: false,
        badge: 'Mới',
      },
      {
        value: 'teens-listening',
        examType: 'TeensAudio',
        name: 'Listening Teens',
        description: 'Audio + ảnh đề nguyên khối + MCQ / điền từ (giống IELTS)',
        tagline: 'Upload 1 ảnh form/note cho cả phần — HS thấy trái ảnh, phải câu trả lời',
        duration: '30 phút',
        iconName: 'Headphones',
        iconColor: '#0EA5E9',
        themeColor: '#0EA5E9',
        highlights: [
          { iconName: 'Image', label: 'Layout', value: 'Ảnh đề + đáp án 2 cột' },
          { iconName: 'ListChecks', label: 'Dạng câu', value: 'MCQ · Điền từ' },
          { iconName: 'Volume2', label: 'Audio', value: '1 file / phần' },
        ],
        needsSkill: true,
        skills: [
          { value: 'listening', label: 'Listening', description: 'Audio + ảnh đề + câu hỏi' },
        ],
        badge: 'Ảnh đề',
      },
      {
        value: 'teens-speaking',
        examType: 'TeensAudio',
        name: 'Speaking Teens',
        description: 'Đề nói — học viên ghi âm, AI chấm điểm',
        tagline: 'Tạo part speaking riêng hoặc nguyên skill cho học viên teens',
        duration: '15 phút',
        iconName: 'Mic',
        iconColor: '#EC4899',
        themeColor: '#EC4899',
        highlights: [
          { iconName: 'Mic', label: 'Hình thức', value: 'Ghi âm + AI chấm' },
          { iconName: 'Layers', label: 'Cấu trúc', value: '1 hoặc nhiều part' },
          { iconName: 'Users', label: 'Đối tượng', value: 'Teens 13–17' },
        ],
        needsSkill: true,
        skills: [
          { value: 'speaking', label: 'Speaking', description: 'Ghi âm · AI chấm' },
        ],
      },
    ],
  },
  {
    key: 'adults',
    label: 'Adults',
    range: '18+ tuổi',
    description: 'Đề thi chuẩn quốc tế: VSTEP, IELTS cho người lớn và sinh viên',
    iconName: 'BookOpen',
    iconColor: '#7C3AED',
    examTypes: [
      {
        value: 'adults-vstep',
        examType: 'VSTEP',
        name: 'VSTEP',
        description: 'Chuẩn Việt Nam B1 / B2 / C1',
        tagline: 'Bài thi tiếng Anh chuẩn Bộ GD-ĐT, dùng xét tốt nghiệp và tuyển dụng',
        duration: '145 - 195 phút',
        iconName: 'Award',
        iconColor: '#0F766E',
        themeColor: '#0F766E',
        highlights: [
          { iconName: 'Layers', label: 'Cấp độ', value: 'B1 · B2 · C1' },
          { iconName: 'ListChecks', label: 'Kỹ năng', value: '4 kỹ năng đầy đủ' },
          { iconName: 'Users', label: 'Đối tượng', value: 'SV, người đi làm' },
        ],
        needsSkill: true,
        skills: [
          { value: 'mixed', label: 'Full 4 kỹ năng', description: 'Listening · Reading · Writing · Speaking' },
          { value: 'listening', label: 'Listening', description: '40 phút' },
          { value: 'reading', label: 'Reading', description: '60 phút' },
          { value: 'writing', label: 'Writing', description: '60 phút' },
          { value: 'speaking', label: 'Speaking', description: '12 phút' },
        ],
      },
      {
        value: 'adults-ielts',
        examType: 'IELTS',
        name: 'IELTS',
        description: 'Academic / General Training',
        tagline: 'Chuẩn quốc tế Cambridge — du học, định cư, học bổng',
        duration: '165 phút',
        iconName: 'Globe',
        iconColor: '#2563EB',
        themeColor: '#0F4C81',
        highlights: [
          { iconName: 'Layers', label: 'Phiên bản', value: 'Academic & General' },
          { iconName: 'ListChecks', label: 'Kỹ năng', value: '4 kỹ năng + band 0-9' },
          { iconName: 'Users', label: 'Đối tượng', value: 'Du học, định cư' },
        ],
        needsSkill: true,
        skills: [
          { value: 'mixed', label: 'Full Test', description: '4 sections (~165 phút)' },
          { value: 'listening', label: 'Listening', description: '30 phút' },
          { value: 'reading', label: 'Reading', description: '60 phút' },
          { value: 'writing', label: 'Writing', description: '60 phút' },
          { value: 'speaking', label: 'Speaking', description: '11-14 phút' },
        ],
      },
      /* ─── DISABLED: chưa có creator chuyên dụng — dẫn về legacy form rối ───
      {
        value: 'adults-cambridge',
        examType: 'Cambridge',
        name: 'Cambridge',
        description: 'KET, PET, FCE, CAE, CPE',
        duration: '110 - 235 phút',
        iconName: 'BookOpen',
        iconColor: '#DC2626',
        themeColor: '#DC2626',
        needsSkill: true,
        skills: [
          { value: 'mixed', label: 'Full Test' },
          { value: 'reading', label: 'Reading' },
          { value: 'listening', label: 'Listening' },
          { value: 'writing', label: 'Writing' },
        ],
      },
      {
        value: 'adults-general',
        examType: 'General',
        name: 'Đề tự do',
        description: 'Đề tiếng Anh tổng quát',
        duration: 'Tùy chọn',
        iconName: 'FileText',
        iconColor: '#64748B',
        themeColor: '#64748B',
        needsSkill: true,
        skills: [
          { value: 'mixed', label: 'Tổng hợp' },
          { value: 'reading', label: 'Reading' },
          { value: 'listening', label: 'Listening' },
          { value: 'writing', label: 'Writing' },
        ],
      },
      ─── /DISABLED ───────────────────────────────────────────────────────── */
    ],
  },
];

export function findAgeGroup(key: AgeGroupKey): AgeGroupCatalog | undefined {
  return AGE_GROUP_CATALOG.find((g) => g.key === key);
}

export function findExamType(ageGroup: AgeGroupKey, value: string): ExamTypeOption | undefined {
  return findAgeGroup(ageGroup)?.examTypes.find((t) => t.value === value);
}

/**
 * Tính URL redirect sau khi đã chọn xong age group + type + skill (nếu cần).
 */
export function buildCreatorUrl(opts: {
  ageGroup: AgeGroupKey;
  examType: ExamTypeOption;
  skill?: ExamSkillKey;
}): string {
  const { examType, skill } = opts;

  switch (examType.examType) {
    case 'Kids':
      return '/giao-vien/de-thi/kids/tao-moi';

    case 'THPT':
      return '/giao-vien/de-thi/thpt/tao-moi';

    case 'TeensAudio': {
      const slug = skill === 'speaking' ? 'speaking' : 'listening';
      return `/giao-vien/de-thi/teens/${slug}/tao-moi`;
    }

    case 'IELTS': {
      const slug = !skill || skill === 'mixed' ? 'full' : skill;
      return `/giao-vien/de-thi/ielts/${slug}/tao-moi`;
    }

    case 'VSTEP': {
      if (!skill || skill === 'mixed') return '/giao-vien/de-thi/vstep/full/tao-moi';
      return `/giao-vien/de-thi/vstep/${skill}/tao-moi`;
    }

    case 'Cambridge':
    case 'General':
    default: {
      // Fallback về creator legacy với query params để pre-fill
      const params = new URLSearchParams({
        type: examType.examType,
        skill: skill ?? 'mixed',
        age_group: opts.ageGroup,
      });
      return `/giao-vien/de-thi/tao-moi?${params.toString()}`;
    }
  }
}
