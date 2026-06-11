import React, { useRef, useState } from 'react';
import {
  Rocket,
  Target,
  Plane,
  ArrowRight,
  BookOpen,
  Check,
  Sparkles,
  Loader2,
  X,
  Clock,
  FileText,
  Layers,
  LayoutGrid,
  SquareStack,
  type LucideIcon,
} from 'lucide-react';
import {
  SKILL_META,
  SKILL_ORDER,
  getSkillParts,
  type SkillKey,
} from '../constants/cambridgeStructure';

interface Step1ExamTypeProps {
  examData: any;
  setExamData: (data: any) => void;
  onNext: () => void;
}

interface ExamTypeOption {
  id: 'starters' | 'movers' | 'flyers';
  name: string;
  icon: LucideIcon;
  ageRange: string;
  level: string;
  vocabulary: string;
  duration: number;
  badge?: string;
}

const examTypes: ExamTypeOption[] = [
  {
    id: 'starters',
    name: 'Starters',
    icon: Rocket,
    ageRange: '6 - 8 tuổi',
    level: 'Pre A1',
    vocabulary: '~350 từ',
    duration: 45,
    badge: 'Phổ biến',
  },
  {
    id: 'movers',
    name: 'Movers',
    icon: Target,
    ageRange: '8 - 11 tuổi',
    level: 'A1',
    vocabulary: '~650 từ',
    duration: 60,
  },
  {
    id: 'flyers',
    name: 'Flyers',
    icon: Plane,
    ageRange: '9 - 12 tuổi',
    level: 'A2',
    vocabulary: '~1000 từ',
    duration: 75,
    badge: 'Nâng cao',
  },
];

const LEVEL_TONES = {
  starters: { accent: '#6366F1', soft: '#EEF2FF' },
  movers: { accent: '#3B82F6', soft: '#EFF6FF' },
  flyers: { accent: '#10B981', soft: '#ECFDF5' },
};

// Lựa chọn phạm vi đề thi (scope)
type ScopeId = 'full' | 'skill' | 'part';
const SCOPE_OPTIONS: { id: ScopeId; name: string; desc: string; icon: LucideIcon }[] = [
  { id: 'full', name: 'Đề đầy đủ', desc: 'Cả 3 kỹ năng, mọi phần', icon: LayoutGrid },
  { id: 'skill', name: 'Theo kỹ năng', desc: 'Chỉ 1 kỹ năng', icon: Layers },
  { id: 'part', name: 'Theo phần', desc: 'Chỉ 1 phần nhỏ', icon: SquareStack },
];

// Metadata từng cấp độ Cambridge YLE để tạo gợi ý tên đề & mô tả ngay trong dự án
const LEVEL_META: Record<
  ExamTypeOption['id'],
  { label: string; cefr: string; ageRange: string }
> = {
  starters: { label: 'Starters', cefr: 'Pre A1', ageRange: '6-8 tuổi' },
  movers: { label: 'Movers', cefr: 'A1', ageRange: '8-11 tuổi' },
  flyers: { label: 'Flyers', cefr: 'A2', ageRange: '9-12 tuổi' },
};

// Chủ đề mặc định khi giáo viên chưa gõ từ khoá nào
const DEFAULT_TOPICS = [
  'Animals',
  'My Family',
  'School Life',
  'Food & Drinks',
  'My Hobbies',
  'The Weather',
  'Around Town',
  'Sports & Games',
];

const toTitleCase = (text: string): string =>
  text
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

// Tạo tên đề & mô tả thông minh (offline) dựa trên cấp độ và chủ đề người dùng nhập
const buildKidsExamMeta = (
  examType: ExamTypeOption['id'],
  rawTopic: string,
): { title: string; description: string } => {
  const meta = LEVEL_META[examType];
  const topicInput = rawTopic.trim();
  const topic = topicInput
    ? toTitleCase(topicInput)
    : DEFAULT_TOPICS[Math.floor(Math.random() * DEFAULT_TOPICS.length)];

  const title = `Cambridge YLE ${meta.label} - ${topic}`;
  const description = `Đề thi Cambridge ${meta.label} (trình độ ${meta.cefr}, ${meta.ageRange}) theo chủ đề "${topic}". Bao gồm các phần Listening, Reading & Writing và Speaking được thiết kế phù hợp với lứa tuổi, giúp học viên luyện tập từ vựng và kỹ năng giao tiếp cơ bản.`;

  return { title, description };
};

const Step1ExamType: React.FC<Step1ExamTypeProps> = ({
  examData,
  setExamData,
  onNext,
}) => {
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const aiInputRef = useRef<HTMLInputElement>(null);

  const handleSelectType = (typeId: ExamTypeOption['id']) => {
    const selectedType = examTypes.find((t) => t.id === typeId);
    setExamData({
      ...examData,
      examType: typeId,
      duration: selectedType?.duration ?? 60,
    });
  };

  // Chọn phạm vi đề: full | skill | part
  const handleSelectScope = (scope: ScopeId) => {
    if (scope === 'full') {
      setExamData({ ...examData, scope, scopeSkill: null, scopePart: null });
      return;
    }
    // skill / part: mặc định kỹ năng đầu (Nghe) nếu chưa chọn
    const skill = (examData.scopeSkill as SkillKey) || 'listening';
    const firstPart = getSkillParts(examData.examType, skill)[0]?.partNumber ?? 1;
    setExamData({
      ...examData,
      scope,
      scopeSkill: skill,
      scopePart: scope === 'part' ? (examData.scopePart ?? firstPart) : null,
    });
  };

  const handleSelectScopeSkill = (skill: SkillKey) => {
    const firstPart = getSkillParts(examData.examType, skill)[0]?.partNumber ?? 1;
    setExamData({
      ...examData,
      scopeSkill: skill,
      scopePart: examData.scope === 'part' ? firstPart : null,
    });
  };

  const handleSelectScopePart = (partNumber: number) => {
    setExamData({ ...examData, scopePart: partNumber });
  };

  const handleInputChange = (field: string, value: any) => {
    setExamData({ ...examData, [field]: value });
  };

  // Tự điền "Tên đề thi" + "Mô tả" ngay trong dự án (không gọi API).
  // Dùng nội dung đang gõ ở ô tên đề làm gợi ý chủ đề (có thể để trống).
  const runSuggest = () => {
    if (suggesting) return;
    if (!examData.examType) {
      setSuggestError('Hãy chọn cấp độ Cambridge trước khi tạo gợi ý.');
      return;
    }
    setSuggesting(true);
    setSuggestError(null);

    const meta = buildKidsExamMeta(
      examData.examType as ExamTypeOption['id'],
      (examData.title || '').trim(),
    );

    setExamData({
      ...examData,
      title: meta.title,
      description: meta.description,
    });

    // hiệu ứng nhẹ cho nút, không cần delay thực sự
    window.setTimeout(() => setSuggesting(false), 250);
  };

  // Bấm nút gợi ý bên trong ô tên đề
  const handleSuggestFromTitle = () => {
    runSuggest();
  };

  // Nhấn Enter ngay trên ô "Tên đề thi" để tự điền tên đề & mô tả
  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    runSuggest();
  };

  const scope: ScopeId = (examData.scope as ScopeId) || 'full';
  const scopeSkill = (examData.scopeSkill as SkillKey) || 'listening';
  const skillParts = examData.examType ? getSkillParts(examData.examType, scopeSkill) : [];

  const canProceed =
    examData.examType &&
    examData.title &&
    (scope !== 'part' || (examData.scopeSkill && examData.scopePart));

  // Màu nhấn theo cấp độ đang chọn (mặc định cam khi chưa chọn)
  const activeTone = examData.examType
    ? LEVEL_TONES[examData.examType as keyof typeof LEVEL_TONES]
    : { accent: '#F97316', soft: '#FFF7ED' };

  return (
    <div className="space-y-8">
      {/* ── 1. Cấp độ Cambridge ──────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2.5 mb-4">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
            1
          </span>
          <h2 className="text-[15px] font-semibold text-slate-900">
            Chọn cấp độ Cambridge
            <span className="ml-1 text-red-500">*</span>
          </h2>
          <span className="ml-auto text-xs text-slate-400">Chọn 1 trong 3</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {examTypes.map((type) => {
            const Icon = type.icon;
            const isSelected = examData.examType === type.id;
            const tone = LEVEL_TONES[type.id];
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => handleSelectType(type.id)}
                aria-pressed={isSelected}
                className={`group relative overflow-hidden text-left rounded-xl border bg-white transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'border-transparent shadow-md ring-2'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                }`}
                style={
                  isSelected
                    ? ({ '--tw-ring-color': tone.accent } as React.CSSProperties)
                    : undefined
                }
              >
                {/* Dải màu trên đầu thẻ */}
                <div
                  className="h-1 w-full transition-opacity duration-200"
                  style={{
                    backgroundColor: tone.accent,
                    opacity: isSelected ? 1 : 0.35,
                  }}
                />

                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl transition-colors duration-200"
                      style={{
                        backgroundColor: isSelected ? tone.accent : tone.soft,
                        color: isSelected ? '#fff' : tone.accent,
                      }}
                    >
                      <Icon className="h-[22px] w-[22px]" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[15px] font-bold text-slate-900">
                          {type.name}
                        </h3>
                        {type.badge && (
                          <span
                            className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                            style={{ backgroundColor: tone.soft, color: tone.accent }}
                          >
                            {type.badge}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">{type.ageRange}</p>
                    </div>

                    {/* Ô chọn */}
                    <div
                      className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200"
                      style={{
                        borderColor: isSelected ? tone.accent : '#CBD5E1',
                        backgroundColor: isSelected ? tone.accent : 'transparent',
                      }}
                    >
                      {isSelected && (
                        <Check className="h-3 w-3 text-white" strokeWidth={3} />
                      )}
                    </div>
                  </div>

                  {/* Thông số: trình độ & từ vựng */}
                  <div className="mt-4 flex items-stretch rounded-lg bg-slate-50 text-center">
                    <div className="flex-1 px-2 py-2">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                        Trình độ
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-700">
                        {type.level}
                      </p>
                    </div>
                    <div className="w-px bg-slate-200" />
                    <div className="flex-1 px-2 py-2">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                        Từ vựng
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-700">
                        {type.vocabulary}
                      </p>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── 2. Phạm vi đề thi ────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2.5 mb-4">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
            2
          </span>
          <h2 className="text-[15px] font-semibold text-slate-900">
            Phạm vi đề thi
          </h2>
          <span className="ml-auto text-xs text-slate-400">
            Cho học viên làm trọn đề hay chỉ một phần nhỏ
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {SCOPE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = scope === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelectScope(opt.id)}
                aria-pressed={isSelected}
                className={`group flex items-start gap-3 rounded-xl border bg-white p-4 text-left transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'border-orange-300 bg-orange-50/50 ring-2 ring-orange-200'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                <div
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg transition-colors ${
                    isSelected ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-bold text-slate-900">{opt.name}</h3>
                    {opt.id === 'full' && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                        Mặc định
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{opt.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Chi tiết khi chọn theo kỹ năng / theo phần */}
        {scope !== 'full' && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
            {!examData.examType ? (
              <p className="text-xs text-slate-400">
                Hãy chọn cấp độ Cambridge ở trên trước để chọn kỹ năng/phần.
              </p>
            ) : (
              <>
                {/* Chọn kỹ năng */}
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Chọn kỹ năng
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {SKILL_ORDER.map((sk) => {
                      const meta = SKILL_META[sk];
                      const active = scopeSkill === sk;
                      return (
                        <button
                          key={sk}
                          type="button"
                          onClick={() => handleSelectScopeSkill(sk)}
                          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${
                            active
                              ? 'border-orange-300 bg-white text-orange-700 ring-1 ring-orange-200'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <span className="text-base">{meta.icon}</span>
                          {meta.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Chọn phần (chỉ khi scope = part) */}
                {scope === 'part' && (
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Chọn phần
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {skillParts.map((p) => {
                        const active = examData.scopePart === p.partNumber;
                        return (
                          <button
                            key={p.partNumber}
                            type="button"
                            onClick={() => handleSelectScopePart(p.partNumber)}
                            className={`rounded-lg border px-3 py-2 text-left transition-all ${
                              active
                                ? 'border-orange-300 bg-white ring-1 ring-orange-200'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <span
                              className={`block text-xs font-bold ${
                                active ? 'text-orange-700' : 'text-slate-700'
                              }`}
                            >
                              {p.name}
                            </span>
                            <span className="block text-[10px] font-medium text-slate-400">
                              {p.description}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </section>

      {/* ── 3. Thông tin đề thi ──────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2.5 mb-4">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
            3
          </span>
          <h2 className="text-[15px] font-semibold text-slate-900">
            Thông tin đề thi
          </h2>

          {/* Badge gợi ý nhanh bằng AI */}
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-600">
            <Sparkles className="h-3 w-3" />
            Gõ chủ đề rồi nhấn Enter để AI điền giúp
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-5">
            {/* Title - 2 cols (tích hợp AI) */}
            <div className="md:col-span-2">
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1.5">
                <BookOpen className="h-3.5 w-3.5 text-slate-400" />
                Tên đề thi <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  ref={aiInputRef}
                  type="text"
                  value={examData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  onKeyDown={handleTitleKeyDown}
                  disabled={suggesting}
                  placeholder='VD: "động vật" rồi nhấn Enter, hoặc tự nhập tên đề'
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 pr-11 text-sm transition-colors focus:outline-none focus:ring-2 disabled:bg-slate-50"
                  style={
                    {
                      '--tw-ring-color': `${activeTone.accent}33`,
                    } as React.CSSProperties
                  }
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = activeTone.accent)
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = '#E2E8F0')
                  }
                />
                {/* Nút AI bên trong ô input */}
                <button
                  type="button"
                  onClick={handleSuggestFromTitle}
                  disabled={suggesting}
                  title="Để AI gợi ý tên đề & mô tả"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md text-violet-600 transition-colors hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                >
                  {suggesting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">
                Nhập từ khoá chủ đề rồi nhấn{' '}
                <kbd className="rounded bg-slate-100 border border-slate-200 px-1 py-0.5 font-mono text-[10px] text-slate-500">
                  Enter
                </kbd>{' '}
                — AI sẽ tự điền tên đề và mô tả thông minh.
              </p>
            </div>

            {/* Duration - 1 col */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1.5">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                Thời gian
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={examData.duration}
                  onChange={(e) =>
                    handleInputChange('duration', parseInt(e.target.value) || 0)
                  }
                  min={15}
                  max={180}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 pr-14 text-sm transition-colors focus:outline-none focus:ring-2"
                  style={
                    {
                      '--tw-ring-color': `${activeTone.accent}33`,
                    } as React.CSSProperties
                  }
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = activeTone.accent)
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = '#E2E8F0')
                  }
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
                  phút
                </span>
              </div>
            </div>

            {/* Description - full width */}
            <div className="md:col-span-3">
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1.5">
                <FileText className="h-3.5 w-3.5 text-slate-400" />
                Mô tả
              </label>
              <textarea
                value={examData.description}
                onChange={(e) =>
                  handleInputChange('description', e.target.value)
                }
                placeholder="Mô tả ngắn về đề thi này (AI có thể tự điền giúp)..."
                rows={2}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 resize-none"
                style={
                  {
                    '--tw-ring-color': `${activeTone.accent}33`,
                  } as React.CSSProperties
                }
                onFocus={(e) =>
                  (e.currentTarget.style.borderColor = activeTone.accent)
                }
                onBlur={(e) => (e.currentTarget.style.borderColor = '#E2E8F0')}
              />
            </div>
          </div>

          {/* Thông báo lỗi AI (nếu có) */}
          {suggestError && (
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-red-600">
              <X className="h-3.5 w-3.5" />
              {suggestError}
            </p>
          )}
        </div>
      </section>

      {/* ── Action ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
        {!canProceed && (
          <span className="text-xs text-slate-400">
            Chọn cấp độ và nhập tên đề để tiếp tục
          </span>
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={!canProceed}
          className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold transition-all ${
            canProceed
              ? 'bg-orange-500 text-white shadow-sm hover:bg-orange-600 cursor-pointer'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          Tiếp theo
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Step1ExamType;
