import { X } from 'lucide-react';
import * as Icons from 'lucide-react';
import type { SectionType } from '../../../../../types/thpt';
import { THPT_THEME } from './sections';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (
    type: SectionType,
    initItemKind?: 'mc' | 'fill_blank',
    initLayout?: 'image_block',
  ) => void;
}

const GROUP_LABELS: Record<string, string> = {
  language: 'Ngôn ngữ (Use of English)',
  reading: 'Đọc hiểu',
  writing: 'Viết',
  listening: 'Nghe (Listening)',
  speaking: 'Nói (Speaking)',
};

interface OptionMeta {
  type: SectionType;
  label: string;
  description: string;
  icon: string;
  group: 'language' | 'reading' | 'writing' | 'listening' | 'speaking';
  initItemKind?: 'mc' | 'fill_blank';
  initLayout?: 'image_block';
  badge?: string;
}

const MODAL_OPTIONS: OptionMeta[] = [
  {
    type: 'phonetics',
    label: 'Ngữ âm',
    description: 'Phát âm / trọng âm — chọn từ khác biệt',
    icon: 'Volume2',
    group: 'language',
  },
  {
    type: 'mc_questions',
    label: 'Trắc nghiệm',
    description: 'Ngữ pháp / từ vựng / đồng-trái nghĩa / giao tiếp',
    icon: 'ListChecks',
    group: 'language',
  },
  {
    type: 'word_form',
    label: 'Chia dạng từ',
    description: 'Cho từ gốc → điền dạng đúng vào câu',
    icon: 'Type',
    group: 'language',
  },
  {
    type: 'error_identification',
    label: 'Tìm lỗi sai',
    description: '4 phần gạch chân, chọn phần sai',
    icon: 'AlertTriangle',
    group: 'language',
  },
  {
    type: 'mc_cloze',
    label: 'Đọc điền trắc nghiệm',
    description: 'Đoạn văn, mỗi chỗ trống chọn A/B/C/D',
    icon: 'FileText',
    group: 'reading',
  },
  {
    type: 'word_bank_cloze',
    label: 'Điền từ cho sẵn',
    description: 'Đoạn văn + ngân hàng từ để điền',
    icon: 'Boxes',
    group: 'reading',
  },
  {
    type: 'open_cloze',
    label: 'Điền 1 từ tự do',
    description: 'Đoạn văn, tự điền 1 từ mỗi chỗ trống',
    icon: 'PenLine',
    group: 'reading',
  },
  {
    type: 'tf_group',
    label: 'Đúng / Sai',
    description: 'Context (notice, ad, email) + statements T/F',
    icon: 'CheckSquare',
    group: 'reading',
  },
  {
    type: 'reading_mixed',
    label: 'Đọc hiểu hỗn hợp',
    description: 'Passage + TF + MC + Sentence Insertion',
    icon: 'BookOpen',
    group: 'reading',
  },
  {
    type: 'matching',
    label: 'Nối câu',
    description: 'Nối (1-4) → (A-F)',
    icon: 'ArrowLeftRight',
    group: 'reading',
  },
  {
    type: 'sentence_transformation',
    label: 'Viết lại câu',
    description: 'Giữ nguyên nghĩa, chấm theo đáp án chấp nhận',
    icon: 'Repeat',
    group: 'writing',
  },
  {
    type: 'writing',
    label: 'Viết đoạn / bài văn',
    description: 'Đề viết đoạn/bài văn — giáo viên chấm tay',
    icon: 'PenLine',
    group: 'writing',
  },
  {
    type: 'listening',
    label: 'Nghe trắc nghiệm',
    description: 'Tải audio + câu hỏi chọn đáp án A/B/C/D',
    icon: 'Headphones',
    group: 'listening',
    initItemKind: 'mc',
  },
  {
    type: 'listening',
    label: 'Nghe điền chỗ trống',
    description: 'Tải audio + câu hỏi tự nhập từ điền vào chỗ trống',
    icon: 'PenLine',
    group: 'listening',
    initItemKind: 'fill_blank',
  },
  {
    type: 'listening',
    label: 'Nghe + ảnh đề (form/note)',
    description: 'Audio + 1 ảnh đề nguyên khối — HS: trái ảnh, phải câu (kiểu IELTS)',
    icon: 'Image',
    group: 'listening',
    initItemKind: 'mc',
    initLayout: 'image_block',
    badge: 'Ảnh đề',
  },
  {
    type: 'speaking',
    label: 'Nói (Speaking)',
    description: 'Đề nói — học viên ghi âm, AI chấm điểm',
    icon: 'Mic',
    group: 'speaking',
  },
];

export function AddSectionModal({ open, onClose, onPick }: Props) {
  if (!open) return null;

  const groups = ['language', 'reading', 'writing', 'listening', 'speaking'] as const;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Thêm phần mới</h2>
            <p className="text-xs text-slate-500">Chọn dạng câu hỏi muốn thêm vào đề</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 text-slate-600" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {groups.map((g) => {
            const types = MODAL_OPTIONS.filter((s) => s.group === g);
            if (!types.length) return null;
            return (
              <div key={g}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  {GROUP_LABELS[g]}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {types.map((meta) => {
                    const Icon = (Icons as any)[meta.icon] ?? Icons.Square;
                    return (
                      <button
                        key={meta.label + meta.type + (meta.initLayout ?? meta.initItemKind ?? '')}
                        type="button"
                        onClick={() => {
                          onPick(meta.type, meta.initItemKind, meta.initLayout);
                          onClose();
                        }}
                        className="text-left rounded-xl border border-slate-200 p-4 hover:border-blue-400 hover:shadow-sm transition-all cursor-pointer group"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                            style={{ backgroundColor: '#EFF6FF' }}
                          >
                            <Icon className="w-5 h-5" style={{ color: THPT_THEME.primary }} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                                {meta.label}
                              </p>
                              {meta.badge && (
                                <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700">
                                  {meta.badge}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                              {meta.description}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
