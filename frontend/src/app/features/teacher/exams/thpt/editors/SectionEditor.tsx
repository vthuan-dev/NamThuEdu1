import type { ThptSection } from '../../../../../../types/thpt';
import { useState } from 'react';
import { Upload, Loader2, Volume2, Trash2 } from 'lucide-react';
import { api } from '../../../../../../services/api';
import {
  makeMcItem,
  makePhoneticsItem,
  makeWordFormItem,
  makeErrorItem,
  makeTfItem,
  makeMatchingItem,
  makeTransformItem,
  makeSpeakingItem,
  nextQuestionNumber,
  sectionMeta,
} from '../sections';
import { SectionHeader, QuestionBadge, DeleteBtn, AddButton, OptionRow } from './shared';
import { THPT_THEME, LETTERS } from '../sections';

interface Props {
  section: ThptSection;
  allSections: ThptSection[];
  onChange: (next: ThptSection) => void;
}

/**
 * Hướng dẫn nhập liệu chi tiết cho từng dạng câu hỏi.
 *  - short: tóm tắt 1 dòng (hiện khi thu gọn)
 *  - grading: nhãn cách chấm
 *  - steps: các bước nhập liệu
 *  - example: ví dụ layout minh họa (hiển thị dạng khối preview)
 */
interface GuideContent {
  short: string;
  grading: 'auto' | 'ai' | 'manual';
  steps: string[];
  example: string;
}

const SECTION_GUIDE: Record<string, GuideContent> = {
  phonetics: {
    short: 'Chọn từ có phần phát âm / trọng âm KHÁC với các từ còn lại.',
    grading: 'auto',
    steps: [
      'Chọn dạng: "Phát âm" hoặc "Trọng âm".',
      'Nhập 4 từ vào ô A, B, C, D.',
      'Với "Phát âm": điền thêm phần gạch chân của mỗi từ (vd: ea).',
      'Bấm nút chữ cái ở từ KHÁC BIỆT để đánh dấu đáp án đúng.',
    ],
    example:
      'A. h(ea)d   B. br(ea)d   C. t(ea)   D. h(ea)vy\n→ Đáp án đúng: C (đọc /iː/, khác /e/)',
  },
  mc_questions: {
    short: 'Câu hỏi 4 phương án A–D, chọn 1 đáp án đúng.',
    grading: 'auto',
    steps: [
      'Chọn dạng câu (Ngữ pháp / Từ vựng / Đồng nghĩa / Trái nghĩa / Giao tiếp).',
      'Nhập nội dung câu hỏi (dùng ____ cho chỗ trống nếu cần).',
      'Điền 4 phương án vào A, B, C, D.',
      'Bấm chữ cái ở phương án đúng.',
    ],
    example:
      'She ____ to school every day.\nA. go   B. goes ✓   C. going   D. gone',
  },
  word_form: {
    short: 'Cho từ gốc → học viên điền dạng đúng vào câu.',
    grading: 'auto',
    steps: [
      'Nhập câu có chỗ trống ____.',
      'Nhập TỪ GỐC viết hoa (vd: BEAUTY).',
      'Ghi (các) đáp án đúng, cách nhau bằng dấu phẩy.',
    ],
    example:
      'Câu: She has a ____ smile.   Từ gốc: BEAUTY\n→ Đáp án: beautiful  (không phân biệt hoa/thường)',
  },
  error_identification: {
    short: '4 phần gạch chân A–D, chọn phần SAI cần sửa.',
    grading: 'auto',
    steps: [
      'Nhập câu đầy đủ (tùy chọn — để hiển thị).',
      'Điền 4 phần gạch chân vào A, B, C, D.',
      'Bấm chữ cái ở phần SAI.',
    ],
    example:
      'She (A)have (B)been (C)to (D)Paris.\n→ Phần sai: A (phải là "has")',
  },
  mc_cloze: {
    short: 'Đoạn văn nhiều chỗ trống, mỗi chỗ chọn A/B/C/D.',
    grading: 'auto',
    steps: [
      'Dán đoạn văn, đánh dấu chỗ trống bằng "(1) ____", "(2) ____"…',
      'Bấm "Tự sinh chỗ trống".',
      'Mỗi chỗ trống: điền 4 phương án và chọn đáp án đúng.',
    ],
    example:
      'My family (1) ____ in Hanoi. We (2) ____ happy.\n(1) A. live ✓  B. lives  C. living  D. lived',
  },
  word_bank_cloze: {
    short: 'Đoạn văn + ngân hàng từ cho sẵn để điền.',
    grading: 'auto',
    steps: [
      'Nhập ngân hàng từ (cách nhau bằng dấu phẩy).',
      'Dán đoạn văn với chỗ trống "(1) ____"…',
      'Bấm "Tự sinh chỗ trống", ghi từ đúng cho mỗi chỗ.',
    ],
    example:
      'Ngân hàng: however, because, although\nIt was cold, (1) ____ we went out.\n→ (1) although',
  },
  open_cloze: {
    short: 'Đoạn văn, học viên tự điền 1 từ mỗi chỗ trống.',
    grading: 'auto',
    steps: [
      'Dán đoạn văn với chỗ trống "(1) ____"…',
      'Bấm "Tự sinh chỗ trống".',
      'Ghi (các) đáp án chấp nhận cho mỗi chỗ, cách nhau bằng dấu phẩy.',
    ],
    example:
      'I have lived here (1) ____ 2010.\n→ Đáp án: since',
  },
  tf_group: {
    short: 'Ngữ cảnh + các nhận định Đúng/Sai.',
    grading: 'auto',
    steps: [
      'Nhập ngữ cảnh (thông báo / quảng cáo / email…).',
      'Viết các nhận định.',
      'Tích True hoặc False cho mỗi nhận định.',
    ],
    example:
      'Ngữ cảnh: "Library opens 8AM–9PM daily."\n• The library opens at 8AM. → TRUE\n• It closes on Sunday. → FALSE',
  },
  reading_mixed: {
    short: 'Một đoạn đọc + nhiều dạng câu hỏi dùng chung.',
    grading: 'auto',
    steps: [
      'Dán đoạn đọc.',
      'Thêm câu hỏi: Đúng/Sai, trắc nghiệm, hoặc điền câu.',
      'Tất cả câu hỏi dùng chung đoạn đọc này.',
    ],
    example:
      'Passage: "Tom plays football after school…"\nQ1 (MC): What does Tom do? → plays football\nQ2 (T/F): Tom likes sports. → TRUE',
  },
  matching: {
    short: 'Nối mỗi số (1–4) với một chữ cái (A–F).',
    grading: 'auto',
    steps: [
      'Nhập danh sách bên trái (1–4).',
      'Nhập danh sách bên phải (A–F) — thường dư 1–2 lựa chọn.',
      'Chọn cặp nối đúng cho mỗi số.',
    ],
    example:
      '1. Hello      A. Goodbye\n2. Thanks     B. You\'re welcome\n→ 1-?, 2-B …',
  },
  sentence_transformation: {
    short: 'Viết lại câu giữ nguyên nghĩa.',
    grading: 'auto',
    steps: [
      'Nhập câu gốc.',
      'Nhập từ gợi ý / đầu câu (nếu có).',
      'Ghi các cách viết lại được chấp nhận, cách nhau bằng dấu phẩy.',
    ],
    example:
      'Gốc: "He is too young to drive."\nĐầu câu: "He isn\'t…"\n→ He isn\'t old enough to drive.',
  },
  listening: {
    short: 'Tải audio + câu hỏi trắc nghiệm.',
    grading: 'auto',
    steps: [
      'Tải file audio (mp3 / m4a / wav…).',
      'Thêm transcript nếu muốn (ẩn với học viên).',
      'Mỗi câu: nhập 4 phương án và chọn đáp án đúng.',
    ],
    example:
      '[Audio] → "What time is the meeting?"\nA. 9AM   B. 10AM ✓   C. 11AM   D. 12PM',
  },
  speaking: {
    short: 'Đề nói — học viên ghi âm, AI chấm.',
    grading: 'ai',
    steps: [
      'Nhập đề nói rõ ràng.',
      'Đặt thời gian chuẩn bị (giây) và thời gian nói (giây).',
      'Học viên ghi âm khi làm; AI chấm phát âm + nội dung.',
    ],
    example:
      'Describe your favourite hobby.\n• Chuẩn bị: 30s   • Nói: 120s',
  },
};

const GRADING_LABEL: Record<GuideContent['grading'], { text: string; cls: string }> = {
  auto: { text: 'Chấm tự động', cls: 'bg-emerald-100 text-emerald-700' },
  ai: { text: 'AI chấm', cls: 'bg-violet-100 text-violet-700' },
  manual: { text: 'Giáo viên chấm tay', cls: 'bg-amber-100 text-amber-700' },
};

const GUIDE_PREF_KEY = 'thpt_guide_expanded';

function SectionGuide({ type, label }: { type: string; label: string }) {
  const g = SECTION_GUIDE[type];
  const [open, setOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(GUIDE_PREF_KEY) === '1';
    } catch {
      return false;
    }
  });

  if (!g) return null;
  const grade = GRADING_LABEL[g.grading];

  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(GUIDE_PREF_KEY, next ? '1' : '0');
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/70 overflow-hidden">
      {/* Thanh tiêu đề — luôn hiện, bấm để mở/đóng */}
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-blue-100/60 transition-colors cursor-pointer"
      >
        <span className="flex-shrink-0">💡</span>
        <span className="text-xs font-semibold text-blue-800 flex-shrink-0">
          Hướng dẫn nhập {label}
        </span>
        {!open && (
          <span className="text-xs text-blue-700/80 truncate hidden sm:block">— {g.short}</span>
        )}
        <span className={`ml-auto flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${grade.cls}`}>
          {grade.text}
        </span>
        <span className="flex-shrink-0 text-blue-500 text-xs font-bold w-5 text-center">
          {open ? '▲' : '▼'}
        </span>
      </button>

      {/* Nội dung chi tiết — chỉ hiện khi mở */}
      {open && (
        <div className="px-4 pb-4 pt-1 grid gap-3 sm:grid-cols-2">
          {/* Các bước */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600 mb-1.5">
              Các bước
            </p>
            <ol className="space-y-1">
              {g.steps.map((s, i) => (
                <li key={i} className="flex gap-2 text-xs text-blue-900 leading-relaxed">
                  <span className="flex-shrink-0 w-4 h-4 rounded-full bg-blue-200 text-blue-800 text-[10px] font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </div>
          {/* Ví dụ minh họa */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600 mb-1.5">
              Ví dụ
            </p>
            <pre className="text-[11px] leading-relaxed text-slate-700 bg-white border border-blue-100 rounded-lg p-3 whitespace-pre-wrap font-mono">
              {g.example}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Dispatcher: render đúng editor theo section.type.
 */
export function SectionEditor({ section, allSections, onChange }: Props) {
  const common = (
    <>
      <SectionHeader
        title={section.title}
        instructions={section.instructions}
        onTitleChange={(v) => onChange({ ...section, title: v } as ThptSection)}
        onInstructionsChange={(v) => onChange({ ...section, instructions: v } as ThptSection)}
      />
      <SectionGuide type={section.type} label={sectionMeta(section.type).label} />
    </>
  );

  switch (section.type) {
    case 'phonetics':
      return <>{common}<PhoneticsEditor section={section} all={allSections} onChange={onChange} /></>;
    case 'mc_questions':
      return <>{common}<McQuestionsEditor section={section} all={allSections} onChange={onChange} /></>;
    case 'word_form':
      return <>{common}<WordFormEditor section={section} all={allSections} onChange={onChange} /></>;
    case 'error_identification':
      return <>{common}<ErrorIdEditor section={section} all={allSections} onChange={onChange} /></>;
    case 'mc_cloze':
      return <>{common}<McClozeEditor section={section} onChange={onChange} /></>;
    case 'word_bank_cloze':
      return <>{common}<WordBankClozeEditor section={section} onChange={onChange} /></>;
    case 'open_cloze':
      return <>{common}<OpenClozeEditor section={section} onChange={onChange} /></>;
    case 'tf_group':
      return <>{common}<TfGroupEditor section={section} all={allSections} onChange={onChange} /></>;
    case 'reading_mixed':
      return <>{common}<ReadingMixedEditor section={section} all={allSections} onChange={onChange} /></>;
    case 'matching':
      return <>{common}<MatchingEditor section={section} all={allSections} onChange={onChange} /></>;
    case 'sentence_transformation':
      return <>{common}<TransformationEditor section={section} all={allSections} onChange={onChange} /></>;
    case 'listening':
      return <>{common}<ListeningEditor section={section} all={allSections} onChange={onChange} /></>;
    case 'speaking':
      return <>{common}<SpeakingEditor section={section} all={allSections} onChange={onChange} /></>;
    default:
      return common;
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────
function ItemCard({ n, onRemove, children }: { n: number; onRemove: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5 bg-white border border-slate-200">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <QuestionBadge n={n} />
          <h3 className="text-sm font-bold text-slate-900">Câu {n}</h3>
        </div>
        <DeleteBtn onClick={onRemove} />
      </div>
      {children}
    </div>
  );
}

function AcceptedAnswersInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value.join(', ')}
      onChange={(e) =>
        onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))
      }
      placeholder={placeholder ?? 'đáp án 1, đáp án 2 (cách bằng dấu phẩy)'}
      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
    />
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 1. PHONETICS
// ════════════════════════════════════════════════════════════════════════════
function PhoneticsEditor({ section, all, onChange }: { section: Extract<ThptSection, { type: 'phonetics' }>; all: ThptSection[]; onChange: (s: ThptSection) => void }) {
  const update = (items: typeof section.items) => onChange({ ...section, items });
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white border border-slate-200 p-3 flex items-center gap-3">
        <span className="text-xs font-bold text-slate-500">Dạng:</span>
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-100">
          {(['pronunciation', 'stress'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onChange({ ...section, variant: v })}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                section.variant === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              {v === 'pronunciation' ? 'Phát âm' : 'Trọng âm'}
            </button>
          ))}
        </div>
      </div>

      {section.items.map((item, idx) => (
        <ItemCard key={idx} n={item.question_number} onRemove={() => update(section.items.filter((_, i) => i !== idx))}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {item.words.map((w, wi) => {
              const isCorrect = item.correct_id === w.id;
              return (
                <div
                  key={w.id}
                  className={`rounded-lg border p-2 transition-colors ${
                    isCorrect ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      const items = [...section.items];
                      items[idx] = { ...item, correct_id: w.id };
                      update(items);
                    }}
                    className={`w-6 h-6 rounded-full text-xs font-bold mb-1.5 transition-all cursor-pointer ${
                      isCorrect ? 'text-white' : 'bg-white border border-slate-300 text-slate-500'
                    }`}
                    style={isCorrect ? { backgroundColor: THPT_THEME.success } : {}}
                    title="Đáp án khác biệt"
                  >
                    {w.id}
                  </button>
                  <input
                    type="text"
                    value={w.text}
                    onChange={(e) => {
                      const items = [...section.items];
                      const words = [...item.words];
                      words[wi] = { ...w, text: e.target.value };
                      items[idx] = { ...item, words };
                      update(items);
                    }}
                    placeholder="từ"
                    className="w-full text-sm border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  {section.variant === 'pronunciation' && (
                    <input
                      type="text"
                      value={w.underline ?? ''}
                      onChange={(e) => {
                        const items = [...section.items];
                        const words = [...item.words];
                        words[wi] = { ...w, underline: e.target.value };
                        items[idx] = { ...item, words };
                        update(items);
                      }}
                      placeholder="phần gạch chân"
                      className="w-full text-[11px] mt-1 border border-slate-200 rounded-md px-2 py-1 text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </ItemCard>
      ))}
      <AddButton label="Thêm câu" onClick={() => update([...section.items, makePhoneticsItem(nextQuestionNumber(all))])} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 2. MC QUESTIONS
// ════════════════════════════════════════════════════════════════════════════
function McQuestionsEditor({ section, all, onChange }: { section: Extract<ThptSection, { type: 'mc_questions' }>; all: ThptSection[]; onChange: (s: ThptSection) => void }) {
  const update = (items: typeof section.items) => onChange({ ...section, items });
  const VARIANTS = [
    { v: 'grammar', l: 'Ngữ pháp' },
    { v: 'vocabulary', l: 'Từ vựng' },
    { v: 'synonym', l: 'Đồng nghĩa' },
    { v: 'antonym', l: 'Trái nghĩa' },
    { v: 'communication', l: 'Giao tiếp' },
    { v: 'general', l: 'Tổng hợp' },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white border border-slate-200 p-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-500">Dạng:</span>
        {VARIANTS.map(({ v, l }) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange({ ...section, variant: v })}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              section.variant === v ? 'text-white' : 'bg-slate-100 text-slate-500'
            }`}
            style={section.variant === v ? { backgroundColor: THPT_THEME.primary } : {}}
          >
            {l}
          </button>
        ))}
      </div>

      {section.items.map((item, idx) => (
        <ItemCard key={idx} n={item.question_number} onRemove={() => update(section.items.filter((_, i) => i !== idx))}>
          <textarea
            value={item.prompt}
            onChange={(e) => {
              const items = [...section.items];
              items[idx] = { ...item, prompt: e.target.value };
              update(items);
            }}
            rows={2}
            placeholder="Nội dung câu hỏi (dùng ____ cho chỗ trống nếu cần)"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <div className="space-y-2">
            {item.options.map((opt, oi) => (
              <OptionRow
                key={opt.id}
                letter={opt.id}
                text={opt.text}
                isCorrect={item.correct_id === opt.id}
                onPick={() => {
                  const items = [...section.items];
                  items[idx] = { ...item, correct_id: opt.id };
                  update(items);
                }}
                onTextChange={(v) => {
                  const items = [...section.items];
                  const options = [...item.options];
                  options[oi] = { ...opt, text: v };
                  items[idx] = { ...item, options };
                  update(items);
                }}
              />
            ))}
          </div>
        </ItemCard>
      ))}
      <AddButton label="Thêm câu" onClick={() => update([...section.items, makeMcItem(nextQuestionNumber(all))])} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 2b. LISTENING (audio + trắc nghiệm)
// ════════════════════════════════════════════════════════════════════════════
function ListeningEditor({ section, all, onChange }: { section: Extract<ThptSection, { type: 'listening' }>; all: ThptSection[]; onChange: (s: ThptSection) => void }) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const update = (items: typeof section.items) => onChange({ ...section, items });

  const uploadAudio = async (file: File) => {
    setUploading(true); setErr('');
    try {
      const fd = new FormData();
      fd.append('audio', file, file.name);
      fd.append('questionId', `thpt-listening-${section.id}`);
      const token = localStorage.getItem('auth_token');
      const endpoint = token ? '/teacher/upload/audio' : '/test/upload/audio';
      const { data: result } = await api.post(endpoint, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (result.success && result.data?.audioUrl) {
        onChange({ ...section, audio_url: result.data.audioUrl });
      } else {
        throw new Error(result.message || 'Upload thất bại');
      }
    } catch (e: any) {
      setErr(e?.message || 'Lỗi tải audio');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Audio uploader */}
      <div className="rounded-xl bg-white border border-slate-200 p-4">
        <p className="text-xs font-bold text-slate-500 mb-2">Audio cho phần Nghe</p>
        {section.audio_url ? (
          <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
            <Volume2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <audio controls src={section.audio_url} className="h-8 flex-1 min-w-0" />
            <button type="button" onClick={() => onChange({ ...section, audio_url: '' })} className="text-slate-400 hover:text-rose-500 flex-shrink-0">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <label className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 px-4 py-3 cursor-pointer hover:border-blue-300 transition-colors text-sm font-medium text-slate-500">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? 'Đang tải lên…' : 'Chọn file audio (mp3, m4a, wav…)'}
            <input type="file" accept="audio/*" className="hidden" disabled={uploading}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAudio(f); e.currentTarget.value = ''; }} />
          </label>
        )}
        {err && <p className="text-xs text-rose-500 mt-2">{err}</p>}
        <input
          type="text"
          value={section.transcript ?? ''}
          onChange={(e) => onChange({ ...section, transcript: e.target.value })}
          placeholder="Transcript (tuỳ chọn — không hiển thị cho học viên khi thi)"
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-3 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>

      {section.items.map((item, idx) => (
        <ItemCard key={idx} n={item.question_number} onRemove={() => update(section.items.filter((_, i) => i !== idx))}>
          <textarea
            value={item.prompt}
            onChange={(e) => {
              const items = [...section.items];
              items[idx] = { ...item, prompt: e.target.value };
              update(items);
            }}
            rows={2}
            placeholder="Nội dung câu hỏi nghe"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <div className="space-y-2">
            {item.options.map((opt, oi) => (
              <OptionRow
                key={opt.id}
                letter={opt.id}
                text={opt.text}
                isCorrect={item.correct_id === opt.id}
                onPick={() => {
                  const items = [...section.items];
                  items[idx] = { ...item, correct_id: opt.id };
                  update(items);
                }}
                onTextChange={(v) => {
                  const items = [...section.items];
                  const options = [...item.options];
                  options[oi] = { ...opt, text: v };
                  items[idx] = { ...item, options };
                  update(items);
                }}
              />
            ))}
          </div>
        </ItemCard>
      ))}
      <AddButton label="Thêm câu" onClick={() => update([...section.items, makeMcItem(nextQuestionNumber(all))])} />
    </div>
  );
}
// ════════════════════════════════════════════════════════════════════════════
// 2c. SPEAKING (đề nói — ghi âm, AI chấm)
// ════════════════════════════════════════════════════════════════════════════
function SpeakingEditor({ section, all, onChange }: { section: Extract<ThptSection, { type: 'speaking' }>; all: ThptSection[]; onChange: (s: ThptSection) => void }) {
  const update = (items: typeof section.items) => onChange({ ...section, items });
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
        <span>🎙️ Học viên sẽ ghi âm trả lời. Phần Nói được <b>AI chấm tự động</b> (phát âm + nội dung) sau khi nộp; giáo viên có thể xem lại và điều chỉnh.</span>
      </div>
      {section.items.map((item, idx) => (
        <ItemCard key={idx} n={item.question_number} onRemove={() => update(section.items.filter((_, i) => i !== idx))}>
          <textarea
            value={item.prompt}
            onChange={(e) => {
              const items = [...section.items];
              items[idx] = { ...item, prompt: e.target.value };
              update(items);
            }}
            rows={3}
            placeholder="Đề nói (VD: Describe your favourite hobby. You should say what it is, when you do it, and why you enjoy it.)"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-slate-500">
              Chuẩn bị (giây)
              <input
                type="number" min={0} max={600}
                value={item.prep_seconds ?? 5}
                onChange={(e) => {
                  const items = [...section.items];
                  items[idx] = { ...item, prep_seconds: Math.max(0, Number(e.target.value) || 0) };
                  update(items);
                }}
                className="mt-1 w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Thời gian nói (giây)
              <input
                type="number" min={10} max={1200}
                value={item.speak_seconds ?? 120}
                onChange={(e) => {
                  const items = [...section.items];
                  items[idx] = { ...item, speak_seconds: Math.max(10, Number(e.target.value) || 10) };
                  update(items);
                }}
                className="mt-1 w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </label>
          </div>
        </ItemCard>
      ))}
      <AddButton label="Thêm đề nói" onClick={() => update([...section.items, makeSpeakingItem(nextQuestionNumber(all))])} />
    </div>
  );
}
// ════════════════════════════════════════════════════════════════════════════
function WordFormEditor({ section, all, onChange }: { section: Extract<ThptSection, { type: 'word_form' }>; all: ThptSection[]; onChange: (s: ThptSection) => void }) {
  const update = (items: typeof section.items) => onChange({ ...section, items });
  return (
    <div className="space-y-4">
      {section.items.map((item, idx) => (
        <ItemCard key={idx} n={item.question_number} onRemove={() => update(section.items.filter((_, i) => i !== idx))}>
          <div className="space-y-2">
            <input
              type="text"
              value={item.sentence}
              onChange={(e) => {
                const items = [...section.items];
                items[idx] = { ...item, sentence: e.target.value };
                update(items);
              }}
              placeholder="Câu có chỗ trống ____ (vd: She is very ____. )"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={item.root_word}
                onChange={(e) => {
                  const items = [...section.items];
                  items[idx] = { ...item, root_word: e.target.value };
                  update(items);
                }}
                placeholder="Từ gốc (BEAUTY)"
                className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 font-semibold"
              />
              <AcceptedAnswersInput
                value={item.accepted_answers}
                onChange={(v) => {
                  const items = [...section.items];
                  items[idx] = { ...item, accepted_answers: v };
                  update(items);
                }}
                placeholder="đáp án đúng (beautiful)"
              />
            </div>
          </div>
        </ItemCard>
      ))}
      <AddButton label="Thêm câu" onClick={() => update([...section.items, makeWordFormItem(nextQuestionNumber(all))])} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 4. ERROR IDENTIFICATION
// ════════════════════════════════════════════════════════════════════════════
function ErrorIdEditor({ section, all, onChange }: { section: Extract<ThptSection, { type: 'error_identification' }>; all: ThptSection[]; onChange: (s: ThptSection) => void }) {
  const update = (items: typeof section.items) => onChange({ ...section, items });
  return (
    <div className="space-y-4">
      {section.items.map((item, idx) => (
        <ItemCard key={idx} n={item.question_number} onRemove={() => update(section.items.filter((_, i) => i !== idx))}>
          <input
            type="text"
            value={item.sentence ?? ''}
            onChange={(e) => {
              const items = [...section.items];
              items[idx] = { ...item, sentence: e.target.value };
              update(items);
            }}
            placeholder="Câu đầy đủ (optional, để hiển thị)"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            4 phần gạch chân (chọn phần SAI)
          </p>
          <div className="space-y-2">
            {item.segments.map((seg, si) => (
              <OptionRow
                key={seg.id}
                letter={seg.id}
                text={seg.text}
                isCorrect={item.correct_id === seg.id}
                onPick={() => {
                  const items = [...section.items];
                  items[idx] = { ...item, correct_id: seg.id };
                  update(items);
                }}
                onTextChange={(v) => {
                  const items = [...section.items];
                  const segments = [...item.segments];
                  segments[si] = { ...seg, text: v };
                  items[idx] = { ...item, segments };
                  update(items);
                }}
                placeholder={`Phần ${seg.id} (gạch chân)`}
              />
            ))}
          </div>
        </ItemCard>
      ))}
      <AddButton label="Thêm câu" onClick={() => update([...section.items, makeErrorItem(nextQuestionNumber(all))])} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 5. MC CLOZE
// ════════════════════════════════════════════════════════════════════════════
const PLACEHOLDER_RE = /\((\d{1,3})\)\s*_+/g;

function detectNumbers(passage: string): number[] {
  const set = new Set<number>();
  const re = new RegExp(PLACEHOLDER_RE.source, 'g');
  let m;
  while ((m = re.exec(passage)) !== null) set.add(parseInt(m[1]));
  return Array.from(set).sort((a, b) => a - b);
}

function McClozeEditor({ section, onChange }: { section: Extract<ThptSection, { type: 'mc_cloze' }>; onChange: (s: ThptSection) => void }) {
  const detected = detectNumbers(section.passage);
  const sync = () => {
    const existing = new Map(section.blanks.map((b) => [b.question_number, b]));
    const blanks = detected.map(
      (n) => existing.get(n) ?? { question_number: n, options: ['A', 'B', 'C', 'D'].map((id) => ({ id, text: '' })), correct_id: '' }
    );
    onChange({ ...section, blanks });
  };
  return (
    <div className="space-y-4">
      <PassageEditor
        passage={section.passage}
        onChange={(v) => onChange({ ...section, passage: v })}
        detected={detected}
        onSync={sync}
        hint='Dùng "(1) ____" cho mỗi chỗ trống.'
      />
      <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-3">
        <h3 className="text-sm font-bold text-slate-900">Phương án cho mỗi chỗ trống</h3>
        {section.blanks.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Paste đoạn văn rồi bấm "Tự sinh chỗ trống".</p>
        ) : (
          section.blanks.map((b, idx) => (
            <div key={idx} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center gap-2 mb-2">
                <QuestionBadge n={b.question_number} />
                <span className="text-xs font-bold text-slate-600">Chỗ trống {b.question_number}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {b.options.map((opt, oi) => (
                  <OptionRow
                    key={opt.id}
                    letter={opt.id}
                    text={opt.text}
                    isCorrect={b.correct_id === opt.id}
                    onPick={() => {
                      const blanks = [...section.blanks];
                      blanks[idx] = { ...b, correct_id: opt.id };
                      onChange({ ...section, blanks });
                    }}
                    onTextChange={(v) => {
                      const blanks = [...section.blanks];
                      const options = [...b.options];
                      options[oi] = { ...opt, text: v };
                      blanks[idx] = { ...b, options };
                      onChange({ ...section, blanks });
                    }}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 6. WORD BANK CLOZE
// ════════════════════════════════════════════════════════════════════════════
function WordBankClozeEditor({ section, onChange }: { section: Extract<ThptSection, { type: 'word_bank_cloze' }>; onChange: (s: ThptSection) => void }) {
  const detected = detectNumbers(section.passage);
  const sync = () => {
    const existing = new Map(section.blanks.map((b) => [b.question_number, b]));
    const blanks = detected.map(
      (n) => existing.get(n) ?? { question_number: n, accepted_answers: [''], case_sensitive: false }
    );
    onChange({ ...section, blanks });
  };
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white border border-slate-200 p-5">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 block">
          Ngân hàng từ (cách bằng dấu phẩy)
        </label>
        <input
          type="text"
          value={section.word_bank.join(', ')}
          onChange={(e) =>
            onChange({ ...section, word_bank: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })
          }
          placeholder="however, although, because, despite, ..."
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>
      <PassageEditor
        passage={section.passage}
        onChange={(v) => onChange({ ...section, passage: v })}
        detected={detected}
        onSync={sync}
        hint='Dùng "(1) ____" cho mỗi chỗ trống.'
      />
      <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-2">
        <h3 className="text-sm font-bold text-slate-900 mb-2">Đáp án</h3>
        {section.blanks.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Paste đoạn văn rồi bấm "Tự sinh chỗ trống".</p>
        ) : (
          section.blanks.map((b, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <QuestionBadge n={b.question_number} />
              <AcceptedAnswersInput
                value={b.accepted_answers}
                onChange={(v) => {
                  const blanks = [...section.blanks];
                  blanks[idx] = { ...b, accepted_answers: v };
                  onChange({ ...section, blanks });
                }}
                placeholder="từ đúng từ ngân hàng"
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 7. OPEN CLOZE
// ════════════════════════════════════════════════════════════════════════════
function OpenClozeEditor({ section, onChange }: { section: Extract<ThptSection, { type: 'open_cloze' }>; onChange: (s: ThptSection) => void }) {
  const detected = detectNumbers(section.passage);
  const sync = () => {
    const existing = new Map(section.blanks.map((b) => [b.question_number, b]));
    const blanks = detected.map(
      (n) => existing.get(n) ?? { question_number: n, accepted_answers: [''], case_sensitive: false }
    );
    onChange({ ...section, blanks });
  };
  return (
    <div className="space-y-4">
      <PassageEditor
        passage={section.passage}
        onChange={(v) => onChange({ ...section, passage: v })}
        detected={detected}
        onSync={sync}
        hint='Dùng "(21) ____" cho mỗi chỗ trống.'
      />
      <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-2">
        <h3 className="text-sm font-bold text-slate-900 mb-2">Đáp án</h3>
        {section.blanks.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Paste đoạn văn rồi bấm "Tự sinh chỗ trống".</p>
        ) : (
          section.blanks.map((b, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <QuestionBadge n={b.question_number} />
              <AcceptedAnswersInput
                value={b.accepted_answers}
                onChange={(v) => {
                  const blanks = [...section.blanks];
                  blanks[idx] = { ...b, accepted_answers: v };
                  onChange({ ...section, blanks });
                }}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function PassageEditor({
  passage,
  onChange,
  detected,
  onSync,
  hint,
}: {
  passage: string;
  onChange: (v: string) => void;
  detected: number[];
  onSync: () => void;
  hint: string;
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Đoạn văn</label>
        {detected.length > 0 && (
          <button
            type="button"
            onClick={onSync}
            className="text-xs font-semibold px-2.5 py-1 rounded-md transition-colors cursor-pointer"
            style={{ color: THPT_THEME.primary, backgroundColor: '#EFF6FF' }}
          >
            Tự sinh chỗ trống ({detected.length})
          </button>
        )}
      </div>
      <textarea
        value={passage}
        onChange={(e) => onChange(e.target.value)}
        rows={8}
        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 font-mono leading-relaxed"
      />
      <p className="mt-1.5 text-[11px] text-slate-500">💡 {hint}</p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 8. TF GROUP
// ════════════════════════════════════════════════════════════════════════════
function TfGroupEditor({ section, all, onChange }: { section: Extract<ThptSection, { type: 'tf_group' }>; all: ThptSection[]; onChange: (s: ThptSection) => void }) {
  const update = (items: typeof section.items) => onChange({ ...section, items });
  return (
    <div className="space-y-4">
      {section.items.map((item, idx) => (
        <ItemCard key={idx} n={item.question_number} onRemove={() => update(section.items.filter((_, i) => i !== idx))}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <textarea
              value={item.context}
              onChange={(e) => {
                const items = [...section.items];
                items[idx] = { ...item, context: e.target.value };
                update(items);
              }}
              rows={6}
              placeholder="Context (notice / ad / email...)"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 font-mono"
            />
            <div className="space-y-2">
              {item.statements.map((s, si) => (
                <div key={s.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 bg-slate-50/50">
                  <span className="text-xs font-bold text-slate-500 w-5">{si + 1}.</span>
                  <input
                    type="text"
                    value={s.text}
                    onChange={(e) => {
                      const items = [...section.items];
                      const statements = [...item.statements];
                      statements[si] = { ...s, text: e.target.value };
                      items[idx] = { ...item, statements };
                      update(items);
                    }}
                    placeholder="Statement"
                    className="flex-1 min-w-0 text-sm bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-blue-200 rounded-md px-2 py-1"
                  />
                  <TFToggle
                    value={s.correct}
                    onChange={(v) => {
                      const items = [...section.items];
                      const statements = [...item.statements];
                      statements[si] = { ...s, correct: v };
                      items[idx] = { ...item, statements };
                      update(items);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </ItemCard>
      ))}
      <AddButton label="Thêm câu" onClick={() => update([...section.items, makeTfItem(nextQuestionNumber(all))])} />
    </div>
  );
}

function TFToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-white border border-slate-200 flex-shrink-0">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`px-2.5 py-1 text-xs font-bold rounded transition-all cursor-pointer ${value ? 'text-white' : 'text-slate-500'}`}
        style={value ? { backgroundColor: THPT_THEME.success } : {}}
      >
        T
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`px-2.5 py-1 text-xs font-bold rounded transition-all cursor-pointer ${!value ? 'text-white' : 'text-slate-500'}`}
        style={!value ? { backgroundColor: THPT_THEME.error } : {}}
      >
        F
      </button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 9. READING MIXED
// ════════════════════════════════════════════════════════════════════════════
function ReadingMixedEditor({ section, all, onChange }: { section: Extract<ThptSection, { type: 'reading_mixed' }>; all: ThptSection[]; onChange: (s: ThptSection) => void }) {
  const MARKERS = ['A', 'B', 'C', 'D'] as const;
  const update = (items: typeof section.items) => onChange({ ...section, items });

  const addItem = (kind: 'tf_group' | 'mc' | 'sentence_insertion') => {
    const qn = nextQuestionNumber(all);
    let item: any;
    if (kind === 'tf_group') {
      item = { kind, question_number: qn, context_paragraph_ref: '', statements: Array.from({ length: 4 }).map((_, i) => ({ id: `${qn}-${i + 1}`, text: '', correct: false })) };
    } else if (kind === 'mc') {
      item = { kind, question_number: qn, prompt: '', options: MARKERS.map((id) => ({ id, text: '' })), correct_id: '' };
    } else {
      item = { kind, question_number: qn, prompt: 'In which space (A, B, C, or D) will the following sentence fit?', sentence_to_insert: '', correct_marker: 'A' };
    }
    update([...section.items, item]);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white border border-slate-200 p-5">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">Đoạn văn</label>
        <textarea
          value={section.passage}
          onChange={(e) => onChange({ ...section, passage: e.target.value })}
          rows={10}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 font-mono leading-relaxed"
        />
        <p className="mt-1.5 text-[11px] text-slate-500">💡 Đặt markers [A][B][C][D] cho dạng Sentence Insertion.</p>
      </div>

      {section.items.map((item, idx) => (
        <div key={idx} className="rounded-2xl p-5 bg-white border border-slate-200">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <QuestionBadge n={item.question_number} />
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold">
                {item.kind === 'tf_group' ? 'TF Group' : item.kind === 'mc' ? 'MC' : 'Sentence Insertion'}
              </span>
            </div>
            <DeleteBtn onClick={() => update(section.items.filter((_, i) => i !== idx))} />
          </div>

          {item.kind === 'tf_group' && (
            <div className="space-y-2">
              <input
                type="text"
                value={item.context_paragraph_ref ?? ''}
                onChange={(e) => {
                  const items = [...section.items];
                  items[idx] = { ...item, context_paragraph_ref: e.target.value };
                  update(items);
                }}
                placeholder='Context (vd "Based on paragraph 1")'
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              {item.statements.map((s, si) => (
                <div key={s.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 bg-slate-50/50">
                  <span className="text-xs font-bold text-slate-500 w-5">{si + 1}.</span>
                  <input
                    type="text"
                    value={s.text}
                    onChange={(e) => {
                      const items = [...section.items];
                      const statements = [...item.statements];
                      statements[si] = { ...s, text: e.target.value };
                      items[idx] = { ...item, statements };
                      update(items);
                    }}
                    className="flex-1 min-w-0 text-sm bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-blue-200 rounded-md px-2 py-1"
                  />
                  <TFToggle
                    value={s.correct}
                    onChange={(v) => {
                      const items = [...section.items];
                      const statements = [...item.statements];
                      statements[si] = { ...s, correct: v };
                      items[idx] = { ...item, statements };
                      update(items);
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {item.kind === 'mc' && (
            <div className="space-y-2">
              <textarea
                value={item.prompt}
                onChange={(e) => {
                  const items = [...section.items];
                  items[idx] = { ...item, prompt: e.target.value };
                  update(items);
                }}
                rows={2}
                placeholder="Câu hỏi"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              {item.options.map((opt, oi) => (
                <OptionRow
                  key={opt.id}
                  letter={opt.id}
                  text={opt.text}
                  isCorrect={item.correct_id === opt.id}
                  onPick={() => {
                    const items = [...section.items];
                    items[idx] = { ...item, correct_id: opt.id };
                    update(items);
                  }}
                  onTextChange={(v) => {
                    const items = [...section.items];
                    const options = [...item.options];
                    options[oi] = { ...opt, text: v };
                    items[idx] = { ...item, options };
                    update(items);
                  }}
                />
              ))}
            </div>
          )}

          {item.kind === 'sentence_insertion' && (
            <div className="space-y-2">
              <textarea
                value={item.sentence_to_insert}
                onChange={(e) => {
                  const items = [...section.items];
                  items[idx] = { ...item, sentence_to_insert: e.target.value };
                  update(items);
                }}
                rows={2}
                placeholder="Câu cần chèn"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 italic"
              />
              <div className="flex items-center gap-2">
                {MARKERS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      const items = [...section.items];
                      items[idx] = { ...item, correct_marker: m };
                      update(items);
                    }}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all cursor-pointer ${
                      item.correct_marker === m ? 'text-white' : 'bg-white border border-slate-200 text-slate-500'
                    }`}
                    style={item.correct_marker === m ? { backgroundColor: THPT_THEME.success } : {}}
                  >
                    [{m}]
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <AddButton label="TF Group" onClick={() => addItem('tf_group')} />
        <AddButton label="Trắc nghiệm" onClick={() => addItem('mc')} />
        <AddButton label="Sentence Insertion" onClick={() => addItem('sentence_insertion')} />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 10. MATCHING
// ════════════════════════════════════════════════════════════════════════════
function MatchingEditor({ section, all, onChange }: { section: Extract<ThptSection, { type: 'matching' }>; all: ThptSection[]; onChange: (s: ThptSection) => void }) {
  const update = (items: typeof section.items) => onChange({ ...section, items });
  return (
    <div className="space-y-4">
      {section.items.map((item, idx) => (
        <ItemCard key={idx} n={item.question_number} onRemove={() => update(section.items.filter((_, i) => i !== idx))}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Cột trái (1-4) + đáp án</p>
              {item.list_1.map((line, i) => {
                const key = String(i + 1);
                return (
                  <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 bg-slate-50/50">
                    <span className="text-xs font-bold text-slate-500 w-5">{i + 1}.</span>
                    <input
                      type="text"
                      value={line}
                      onChange={(e) => {
                        const items = [...section.items];
                        const list_1 = [...item.list_1];
                        list_1[i] = e.target.value;
                        items[idx] = { ...item, list_1 };
                        update(items);
                      }}
                      className="flex-1 min-w-0 text-sm bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-blue-200 rounded-md px-2 py-1"
                    />
                    <select
                      value={item.answers[key] ?? ''}
                      onChange={(e) => {
                        const items = [...section.items];
                        items[idx] = { ...item, answers: { ...item.answers, [key]: e.target.value } };
                        update(items);
                      }}
                      className="w-14 text-xs font-bold text-center border border-slate-200 rounded-md px-1 py-1 bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="">—</option>
                      {LETTERS.map((L) => (<option key={L} value={L}>{L}</option>))}
                    </select>
                  </div>
                );
              })}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Cột phải (A-F)</p>
              {item.list_2.map((line, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 bg-slate-50/50">
                  <span className="text-xs font-bold w-5 text-center" style={{ color: THPT_THEME.primary }}>{LETTERS[i]}.</span>
                  <input
                    type="text"
                    value={line}
                    onChange={(e) => {
                      const items = [...section.items];
                      const list_2 = [...item.list_2];
                      list_2[i] = e.target.value;
                      items[idx] = { ...item, list_2 };
                      update(items);
                    }}
                    className="flex-1 min-w-0 text-sm bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-blue-200 rounded-md px-2 py-1"
                  />
                </div>
              ))}
            </div>
          </div>
        </ItemCard>
      ))}
      <AddButton label="Thêm bảng" onClick={() => update([...section.items, makeMatchingItem(nextQuestionNumber(all))])} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 11. SENTENCE TRANSFORMATION
// ════════════════════════════════════════════════════════════════════════════
function TransformationEditor({ section, all, onChange }: { section: Extract<ThptSection, { type: 'sentence_transformation' }>; all: ThptSection[]; onChange: (s: ThptSection) => void }) {
  const update = (items: typeof section.items) => onChange({ ...section, items });
  return (
    <div className="space-y-4">
      {section.items.map((item, idx) => (
        <ItemCard key={idx} n={item.question_number} onRemove={() => update(section.items.filter((_, i) => i !== idx))}>
          <div className="space-y-2">
            <input
              type="text"
              value={item.original}
              onChange={(e) => {
                const items = [...section.items];
                items[idx] = { ...item, original: e.target.value };
                update(items);
              }}
              placeholder="Câu gốc"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={item.lead_in ?? ''}
                onChange={(e) => {
                  const items = [...section.items];
                  items[idx] = { ...item, lead_in: e.target.value };
                  update(items);
                }}
                placeholder="Phần mở đầu cho sẵn (vd: It is...)"
                className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <input
                type="text"
                value={item.prompt_word ?? ''}
                onChange={(e) => {
                  const items = [...section.items];
                  items[idx] = { ...item, prompt_word: e.target.value };
                  update(items);
                }}
                placeholder="Từ bắt buộc (optional)"
                className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Đáp án chấp nhận (cách bằng dấu phẩy)</label>
              <AcceptedAnswersInput
                value={item.accepted_answers}
                onChange={(v) => {
                  const items = [...section.items];
                  items[idx] = { ...item, accepted_answers: v };
                  update(items);
                }}
                placeholder="It is said that..., People say that..."
              />
            </div>
          </div>
        </ItemCard>
      ))}
      <AddButton label="Thêm câu" onClick={() => update([...section.items, makeTransformItem(nextQuestionNumber(all))])} />
    </div>
  );
}
