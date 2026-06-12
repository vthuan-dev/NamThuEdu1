import { X } from 'lucide-react';
import * as Icons from 'lucide-react';
import type { SectionType } from '../../../../../types/thpt';
import { SECTION_TYPES, THPT_THEME } from './sections';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (type: SectionType) => void;
}

const GROUP_LABELS: Record<string, string> = {
  language: 'Ngôn ngữ (Use of English)',
  reading: 'Đọc hiểu',
  writing: 'Viết',
  audio: 'Nghe & Nói (Listening & Speaking)',
};

export function AddSectionModal({ open, onClose, onPick }: Props) {
  if (!open) return null;

  const groups = ['language', 'reading', 'writing', 'audio'] as const;

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
            const types = SECTION_TYPES.filter((s) => s.group === g);
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
                        key={meta.type}
                        type="button"
                        onClick={() => {
                          onPick(meta.type);
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
                            <p className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                              {meta.label}
                            </p>
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
