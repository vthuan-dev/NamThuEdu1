/**
 * Section registry — metadata + factory cho từng dạng câu hỏi THPT/THCS.
 */
import type {
  SectionType,
  ThptSection,
  ThptConfig,
} from '../../../../../types/thpt';

export const THPT_THEME = {
  primary: '#2563EB',
  secondary: '#3B82F6',
  accent: '#F97316',
  bg: '#F8FAFC',
  surface: '#FFFFFF',
  text: '#1E293B',
  muted: '#64748B',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
} as const;

export interface SectionTypeMeta {
  type: SectionType;
  label: string;
  description: string;
  icon: string; // lucide icon name
  group: 'language' | 'reading' | 'writing' | 'audio';
  autoGrade: boolean;
}

export const SECTION_TYPES: SectionTypeMeta[] = [
  {
    type: 'phonetics',
    label: 'Ngữ âm',
    description: 'Phát âm / trọng âm — chọn từ khác biệt',
    icon: 'Volume2',
    group: 'language',
    autoGrade: true,
  },
  {
    type: 'mc_questions',
    label: 'Trắc nghiệm',
    description: 'Ngữ pháp / từ vựng / đồng-trái nghĩa / giao tiếp',
    icon: 'ListChecks',
    group: 'language',
    autoGrade: true,
  },
  {
    type: 'word_form',
    label: 'Chia dạng từ',
    description: 'Cho từ gốc → điền dạng đúng vào câu',
    icon: 'Type',
    group: 'language',
    autoGrade: true,
  },
  {
    type: 'error_identification',
    label: 'Tìm lỗi sai',
    description: '4 phần gạch chân, chọn phần sai',
    icon: 'AlertTriangle',
    group: 'language',
    autoGrade: true,
  },
  {
    type: 'mc_cloze',
    label: 'Đọc điền trắc nghiệm',
    description: 'Đoạn văn, mỗi chỗ trống chọn A/B/C/D',
    icon: 'FileText',
    group: 'reading',
    autoGrade: true,
  },
  {
    type: 'word_bank_cloze',
    label: 'Điền từ cho sẵn',
    description: 'Đoạn văn + ngân hàng từ để điền',
    icon: 'Boxes',
    group: 'reading',
    autoGrade: true,
  },
  {
    type: 'open_cloze',
    label: 'Điền 1 từ tự do',
    description: 'Đoạn văn, tự điền 1 từ mỗi chỗ trống',
    icon: 'PenLine',
    group: 'reading',
    autoGrade: true,
  },
  {
    type: 'tf_group',
    label: 'Đúng / Sai',
    description: 'Context (notice, ad, email) + statements T/F',
    icon: 'CheckSquare',
    group: 'reading',
    autoGrade: true,
  },
  {
    type: 'reading_mixed',
    label: 'Đọc hiểu hỗn hợp',
    description: 'Passage + TF + MC + Sentence Insertion',
    icon: 'BookOpen',
    group: 'reading',
    autoGrade: true,
  },
  {
    type: 'matching',
    label: 'Nối câu',
    description: 'Nối (1-4) → (A-F)',
    icon: 'ArrowLeftRight',
    group: 'reading',
    autoGrade: true,
  },
  {
    type: 'sentence_transformation',
    label: 'Viết lại câu',
    description: 'Giữ nguyên nghĩa, chấm theo đáp án chấp nhận',
    icon: 'Repeat',
    group: 'writing',
    autoGrade: true,
  },
  {
    type: 'listening',
    label: 'Nghe (Listening)',
    description: 'Tải audio + câu hỏi trắc nghiệm — tự chấm',
    icon: 'Headphones',
    group: 'audio',
    autoGrade: true,
  },
  {
    type: 'speaking',
    label: 'Nói (Speaking)',
    description: 'Đề nói — học viên ghi âm, AI chấm điểm',
    icon: 'Mic',
    group: 'audio',
    autoGrade: false,
  },
];

export function sectionMeta(type: SectionType): SectionTypeMeta {
  return SECTION_TYPES.find((s) => s.type === type) ?? SECTION_TYPES[1];
}

let _seq = 0;
function sid(): string {
  _seq += 1;
  return `sec_${Date.now().toString(36)}_${_seq}`;
}

/**
 * Số thứ tự câu kế tiếp dựa trên toàn bộ sections đã có.
 */
export function nextQuestionNumber(sections: ThptSection[]): number {
  let max = 0;
  for (const s of sections) {
    const nums = collectQuestionNumbers(s);
    for (const n of nums) max = Math.max(max, n);
  }
  return max + 1;
}

export function collectQuestionNumbers(s: ThptSection): number[] {
  switch (s.type) {
    case 'phonetics':
    case 'mc_questions':
    case 'error_identification':
    case 'word_form':
    case 'sentence_transformation':
    case 'tf_group':
    case 'matching':
    case 'reading_mixed':
    case 'listening':
    case 'speaking':
      return (s as any).items.map((i: any) => i.question_number);
    case 'mc_cloze':
    case 'open_cloze':
    case 'word_bank_cloze':
      return (s as any).blanks.map((b: any) => b.question_number);
    default:
      return [];
  }
}

/**
 * Tổng số câu trong 1 section (đếm để hiển thị).
 */
export function countQuestions(s: ThptSection): number {
  if (s.type === 'tf_group') {
    return s.items.reduce((sum, it) => sum + it.statements.length, 0);
  }
  if (s.type === 'reading_mixed') {
    return s.items.reduce(
      (sum, it) => sum + (it.kind === 'tf_group' ? it.statements.length : 1),
      0
    );
  }
  if (s.type === 'matching') {
    return s.items.reduce((sum, it) => sum + Object.keys(it.answers).length, 0);
  }
  if (s.type === 'mc_cloze' || s.type === 'open_cloze' || s.type === 'word_bank_cloze') {
    return (s as any).blanks.length;
  }
  return (s as any).items.length;
}

export function totalQuestions(config: ThptConfig): number {
  return config.sections.reduce((sum, s) => sum + countQuestions(s), 0);
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/**
 * Tạo section trống theo type.
 */
export function createSection(type: SectionType, startNum: number): ThptSection {
  const base = { id: sid(), points_per_question: 1 };
  switch (type) {
    case 'phonetics':
      return {
        ...base,
        type: 'phonetics',
        variant: 'pronunciation',
        title: 'Ngữ âm',
        instructions: 'Chọn từ có phần gạch chân được phát âm khác với những từ còn lại.',
        items: [makePhoneticsItem(startNum)],
      };
    case 'mc_questions':
      return {
        ...base,
        type: 'mc_questions',
        variant: 'grammar',
        title: 'Trắc nghiệm',
        instructions: 'Chọn phương án đúng (A, B, C hoặc D).',
        items: [makeMcItem(startNum)],
      };
    case 'word_form':
      return {
        ...base,
        type: 'word_form',
        title: 'Chia dạng từ',
        instructions: 'Cho dạng đúng của từ trong ngoặc.',
        items: [makeWordFormItem(startNum)],
      };
    case 'error_identification':
      return {
        ...base,
        type: 'error_identification',
        title: 'Tìm lỗi sai',
        instructions: 'Chọn phần gạch chân (A, B, C hoặc D) cần sửa cho đúng.',
        items: [makeErrorItem(startNum)],
      };
    case 'mc_cloze':
      return {
        ...base,
        type: 'mc_cloze',
        title: 'Đọc điền trắc nghiệm',
        instructions: 'Đọc đoạn văn và chọn phương án đúng cho mỗi chỗ trống.',
        passage: '',
        blanks: [],
      };
    case 'word_bank_cloze':
      return {
        ...base,
        type: 'word_bank_cloze',
        title: 'Điền từ cho sẵn',
        instructions: 'Điền vào chỗ trống bằng từ phù hợp trong ngân hàng từ.',
        passage: '',
        word_bank: [],
        blanks: [],
      };
    case 'open_cloze':
      return {
        ...base,
        type: 'open_cloze',
        title: 'Điền 1 từ',
        instructions: 'Điền MỘT từ thích hợp vào mỗi chỗ trống.',
        passage: '',
        blanks: [],
      };
    case 'tf_group':
      return {
        ...base,
        type: 'tf_group',
        title: 'Đúng / Sai',
        instructions:
          'Đọc thông tin và quyết định các câu sau là TRUE hay FALSE.',
        items: [makeTfItem(startNum)],
      };
    case 'reading_mixed':
      return {
        ...base,
        type: 'reading_mixed',
        title: 'Đọc hiểu',
        instructions: 'Đọc đoạn văn và trả lời các câu hỏi.',
        passage: '',
        items: [],
      };
    case 'matching':
      return {
        ...base,
        type: 'matching',
        title: 'Nối câu',
        instructions: 'Nối mỗi số (1-4) với một chữ cái (A-F) phù hợp.',
        items: [makeMatchingItem(startNum)],
      };
    case 'sentence_transformation':
      return {
        ...base,
        type: 'sentence_transformation',
        title: 'Viết lại câu',
        instructions: 'Viết lại câu sao cho nghĩa không đổi.',
        items: [makeTransformItem(startNum)],
      };
    case 'listening':
      return {
        ...base,
        type: 'listening',
        title: 'Nghe',
        instructions: 'Nghe đoạn ghi âm và chọn phương án đúng cho mỗi câu.',
        audio_url: '',
        items: [makeMcItem(startNum)],
      };
    case 'speaking':
      return {
        ...base,
        type: 'speaking',
        title: 'Nói',
        instructions: 'Nghe đề, chuẩn bị rồi ghi âm câu trả lời của bạn.',
        items: [makeSpeakingItem(startNum)],
      };
  }
}

// ── Item factories ──────────────────────────────────────────────────────────
export function makePhoneticsItem(qn: number) {
  return {
    question_number: qn,
    words: ['A', 'B', 'C', 'D'].map((id) => ({ id, text: '', underline: '' })),
    correct_id: '',
  };
}

export function makeMcItem(qn: number) {
  return {
    question_number: qn,
    prompt: '',
    options: ['A', 'B', 'C', 'D'].map((id) => ({ id, text: '' })),
    correct_id: '',
  };
}

export function makeWordFormItem(qn: number) {
  return {
    question_number: qn,
    sentence: '',
    root_word: '',
    accepted_answers: [''],
    case_sensitive: false,
  };
}

export function makeErrorItem(qn: number) {
  return {
    question_number: qn,
    sentence: '',
    segments: ['A', 'B', 'C', 'D'].map((id) => ({ id, text: '' })),
    correct_id: '',
  };
}

export function makeTfItem(qn: number) {
  return {
    question_number: qn,
    context: '',
    context_style: 'notice' as const,
    statements: Array.from({ length: 4 }).map((_, i) => ({
      id: `${qn}-${i + 1}`,
      text: '',
      correct: false,
    })),
  };
}

export function makeMatchingItem(qn: number) {
  return {
    question_number: qn,
    list_1: ['', '', '', ''],
    list_2: ['', '', '', '', '', ''],
    answers: { '1': '', '2': '', '3': '', '4': '' } as Record<string, string>,
  };
}

export function makeTransformItem(qn: number) {
  return {
    question_number: qn,
    original: '',
    lead_in: '',
    prompt_word: '',
    accepted_answers: [''],
  };
}

export function makeSpeakingItem(qn: number) {
  return {
    question_number: qn,
    prompt: '',
    prep_seconds: 5,
    speak_seconds: 120,
  };
}

export function blankConfig(): ThptConfig {
  return {
    version: '2.0',
    level: 'THPT',
    total_duration_minutes: 60,
    scale_max: 10,
    sections: [],
  };
}

export { LETTERS };
