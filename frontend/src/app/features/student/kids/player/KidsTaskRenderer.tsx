/**
 * KidsTaskRenderer — render 24 dạng task cho học viên kids khi làm bài.
 *
 * Mỗi kids task = 1 question, nhưng có thể chứa nhiều ô con. Renderer nhận:
 *  - taskType: mã dạng task (cloze_test, odd_one_out, ...)
 *  - taskData: kids_task_config.task_data (config y hệt editor lưu)
 *  - answer:   KidsAnswerMap đã parse (đáp án hiện tại của học viên)
 *  - onChange: (map) => void — cập nhật đáp án (sẽ được serialize JSON ở parent)
 *
 * Triết lý UI: chữ to, thẻ màu thân thiện, ít chữ, dễ bấm cho trẻ 6-12.
 */
import { useMemo, useState } from 'react';
import { CheckCircle2, Volume2 } from 'lucide-react';
import type { KidsAnswerMap } from './kidsAnswer';

interface RendererProps {
  taskData: any;
  answer: KidsAnswerMap;
  onChange: (map: KidsAnswerMap) => void;
  readOnly?: boolean;
  /** Trang chấm: khóa đáp án → đúng/sai (theo giáo viên chỉnh). Tô màu nhãn trên ảnh. */
  gradeOverrides?: Record<string, boolean>;
}

const TONES = [
  { bg: 'linear-gradient(135deg,#FFF1F2,#FECDD3)', c: '#E11D48' },
  { bg: 'linear-gradient(135deg,#EFF6FF,#BFDBFE)', c: '#2563EB' },
  { bg: 'linear-gradient(135deg,#F0FFF4,#BBF7D0)', c: '#059669' },
  { bg: 'linear-gradient(135deg,#FEFCE8,#FEF08A)', c: '#B45309' },
  { bg: 'linear-gradient(135deg,#F5F3FF,#DDD6FE)', c: '#7C3AED' },
];

// ─── shared atoms ─────────────────────────────────────────────────────────
function SubLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-sm font-bold text-slate-500">{children}</p>;
}

function KidInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? 'Em viết ở đây…'}
      className="w-full rounded-2xl border-2 border-rose-100 px-4 py-3 text-[15px] font-semibold outline-none transition-colors focus:border-rose-300"
    />
  );
}

/** Lưới các lựa chọn dạng chip (chọn 1). */
function ChoiceChips({
  options,
  selected,
  onSelect,
}: {
  options: { key: string; label: string }[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt, i) => {
        const tone = TONES[i % TONES.length];
        const active = selected === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onSelect(opt.key)}
            className="rounded-2xl px-4 py-2.5 text-[15px] font-bold transition-all active:scale-95"
            style={{
              background: active ? tone.bg : '#fff',
              border: active ? `2.5px solid ${tone.c}` : '2px solid #F1F5F9',
              color: active ? tone.c : '#334155',
              boxShadow: active ? `0 6px 16px ${tone.c}30` : '0 2px 8px rgba(0,0,0,0.04)',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── A. Odd-one-out (chọn 1 hình khác loại) ─────────────────────────────────
function OddOneOutTask({ taskData, answer, onChange }: RendererProps) {
  const images: any[] = taskData?.images ?? [];
  const selected = answer['0'] ?? '';
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {images.map((img, i) => {
        const key = String(img.id ?? i + 1);
        const active = selected === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange({ '0': key })}
            className="relative overflow-hidden rounded-2xl transition-all active:scale-95"
            style={{
              border: active ? '3px solid #E11D48' : '2px solid #F1F5F9',
              boxShadow: active ? '0 8px 20px rgba(225,29,72,0.25)' : '0 2px 8px rgba(0,0,0,0.05)',
            }}
          >
            <img src={img.url} alt="" className="aspect-square w-full bg-slate-50 object-cover" />
            {active && (
              <span className="absolute right-1.5 top-1.5 rounded-full bg-white p-0.5">
                <CheckCircle2 className="h-5 w-5 text-rose-500" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── B1. Word ↔ Definition matching ─────────────────────────────────────────
function WordDefinitionTask({ taskData, answer, onChange, readOnly }: RendererProps) {
  const words: any[] = taskData?.words ?? [];
  // Mỗi từ chọn 1 định nghĩa (theo nhãn A,B,C…). Định nghĩa hiển thị xáo trộn.
  // Khi readOnly (trang chấm): giữ thứ tự gốc để nhãn A/B/C khớp đáp án đã lưu.
  const shuffledDefs = useMemo(() => {
    const defs = words.map((w, i) => ({ key: String.fromCharCode(65 + i), text: w.definition }));
    return readOnly ? defs : [...defs].sort(() => Math.random() - 0.5);
  }, [words.length, readOnly]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-slate-50 p-4">
        <SubLabel>Các định nghĩa:</SubLabel>
        <ul className="space-y-1.5">
          {shuffledDefs.map((d) => (
            <li key={d.key} className="text-[15px] text-slate-700">
              <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-violet-100 text-sm font-bold text-violet-700">
                {d.key}
              </span>
              {d.text}
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-2">
        {words.map((w, i) => (
          <div key={i} className="rounded-2xl border-2 border-slate-100 bg-white p-3">
            <p className="mb-2 text-[15px] font-extrabold text-slate-800">{w.word}</p>
            <ChoiceChips
              options={shuffledDefs.map((d) => ({ key: d.key, label: d.key }))}
              selected={answer[String(i)] ?? ''}
              onSelect={(key) => onChange({ ...answer, [String(i)]: key })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── B2. Dialogue matching (mỗi hội thoại chọn 1 đáp án) ─────────────────────
function DialogueMatchingTask({ taskData, answer, onChange }: RendererProps) {
  const dialogues: any[] = taskData?.dialogues ?? [];
  return (
    <div className="space-y-3">
      {dialogues.map((d, i) => (
        <div key={i} className="rounded-2xl border-2 border-slate-100 bg-white p-4">
          <p className="mb-3 text-[15px] font-bold text-slate-800">
            <span className="mr-2 text-rose-400">{i + 1}.</span>
            {d.question}
          </p>
          <div className="space-y-2">
            {(d.options ?? []).map((opt: any, oi: number) => {
              const tone = TONES[oi % TONES.length];
              const active = (answer[String(i)] ?? '') === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChange({ ...answer, [String(i)]: opt.id })}
                  className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-all active:scale-[0.98]"
                  style={{
                    background: active ? tone.bg : '#fff',
                    border: active ? `2.5px solid ${tone.c}` : '2px solid #F1F5F9',
                  }}
                >
                  <span
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg font-bold text-white"
                    style={{ background: tone.c }}
                  >
                    {opt.id}
                  </span>
                  <span className="text-[15px] font-semibold" style={{ color: active ? tone.c : '#334155' }}>
                    {opt.text}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── C1. Cloze test (mỗi gap chọn từ options) ───────────────────────────────
function ClozeTestTask({ taskData, answer, onChange }: RendererProps) {
  const gaps: any[] = taskData?.gaps ?? [];
  const titleQ = taskData?.story_title_question;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-slate-50 p-4 text-[15px] leading-7 text-slate-700 whitespace-pre-wrap">
        {taskData?.text}
      </div>
      <div className="space-y-2">
        {gaps.map((gap, i) => {
          const key = String(gap.gap_id ?? i + 1);
          return (
            <div key={key} className="rounded-2xl border-2 border-slate-100 bg-white p-3">
              <SubLabel>Chỗ trống __{gap.gap_id ?? i + 1}__</SubLabel>
              <ChoiceChips
                options={(gap.options ?? []).map((o: string) => ({ key: o, label: o }))}
                selected={answer[key] ?? ''}
                onSelect={(v) => onChange({ ...answer, [key]: v })}
              />
            </div>
          );
        })}
        {titleQ && (
          <div className="rounded-2xl border-2 border-amber-100 bg-amber-50/50 p-3">
            <SubLabel>Chọn tên cho câu chuyện:</SubLabel>
            <ChoiceChips
              options={(titleQ.options ?? []).map((o: string) => ({ key: o, label: o }))}
              selected={answer['title'] ?? ''}
              onSelect={(v) => onChange({ ...answer, title: v })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── C2. Open cloze (mỗi gap tự gõ) ─────────────────────────────────────────
function OpenClozeTask({ taskData, answer, onChange }: RendererProps) {
  const gaps: any[] = taskData?.gaps ?? [];
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-slate-50 p-4 text-[15px] leading-7 text-slate-700 whitespace-pre-wrap">
        {taskData?.text}
      </div>
      <div className="space-y-2">
        {gaps.map((gap, i) => {
          const key = String(gap.gap_id ?? i + 1);
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-rose-100 text-sm font-bold text-rose-600">
                {gap.gap_id ?? i + 1}
              </span>
              <KidInput
                value={answer[key] ?? ''}
                onChange={(v) => onChange({ ...answer, [key]: v })}
                placeholder="Điền 1 từ…"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── C3. Story completion (mỗi câu tự gõ) ───────────────────────────────────
function StoryCompletionTask({ taskData, answer, onChange }: RendererProps) {
  const sentences: any[] = taskData?.completion_sentences ?? [];
  return (
    <div className="space-y-4">
      {taskData?.story_text && (
        <div className="rounded-2xl bg-slate-50 p-4 text-[15px] leading-7 text-slate-700 whitespace-pre-wrap">
          {taskData.story_text}
        </div>
      )}
      <div className="space-y-3">
        {sentences.map((s, i) => (
          <div key={i} className="rounded-2xl border-2 border-slate-100 bg-white p-3">
            <p className="mb-2 text-[15px] font-semibold text-slate-700">{s.text}</p>
            <KidInput
              value={answer[String(i)] ?? ''}
              onChange={(v) => onChange({ ...answer, [String(i)]: v })}
              placeholder={`Tối đa ${s.max_words ?? 5} từ`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── C4. Unscramble words (xếp chữ thành từ) ────────────────────────────────
function UnscrambleTask({ taskData, answer, onChange }: RendererProps) {
  const items: any[] = (taskData?.items ?? []).filter((it: any) => !it.isExample);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((it, i) => (
        <div key={i} className="rounded-2xl border-2 border-slate-100 bg-white p-3">
          {it.image_url && (
            <img src={it.image_url} alt="" className="mb-2 h-28 w-full rounded-xl bg-slate-50 object-contain" />
          )}
          <div className="mb-2 flex flex-wrap gap-1.5">
            {String(it.scrambled_word ?? '')
              .split('')
              .map((ch: string, ci: number) => (
                <span
                  key={ci}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-base font-extrabold uppercase text-indigo-700"
                >
                  {ch}
                </span>
              ))}
          </div>
          <KidInput
            value={answer[String(i)] ?? ''}
            onChange={(v) => onChange({ ...answer, [String(i)]: v })}
            placeholder="Viết từ đúng…"
          />
        </div>
      ))}
    </div>
  );
}

// ─── C5. Word bank fill (chọn từ trong ngân hàng từ) ────────────────────────
function WordBankFillTask({ taskData, answer, onChange }: RendererProps) {
  const gaps: any[] = (taskData?.gaps ?? []).filter((g: any) => !g.isExample);
  const bank: any[] = taskData?.word_bank ?? [];
  return (
    <div className="space-y-4">
      {taskData?.mainImageUrl && (
        <img src={taskData.mainImageUrl} alt="" className="max-h-60 w-full rounded-2xl bg-slate-50 object-contain" />
      )}
      {taskData?.text && (
        <div className="rounded-2xl bg-slate-50 p-4 text-[15px] leading-7 text-slate-700 whitespace-pre-wrap">
          {taskData.text}
        </div>
      )}
      <div className="rounded-2xl bg-violet-50/60 p-3">
        <SubLabel>Ngân hàng từ:</SubLabel>
        <div className="flex flex-wrap gap-2">
          {bank.map((w, i) => (
            <span key={i} className="rounded-xl bg-white px-3 py-1.5 text-[15px] font-bold text-violet-700 shadow-sm">
              {w.word}
            </span>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {gaps.map((gap, i) => {
          const key = String(gap.gap_number ?? i + 1);
          return (
            <div key={key} className="rounded-2xl border-2 border-slate-100 bg-white p-3">
              <SubLabel>Chỗ trống {gap.gap_number ?? i + 1}</SubLabel>
              <ChoiceChips
                options={bank.map((w) => ({ key: w.word, label: w.word }))}
                selected={answer[key] ?? ''}
                onSelect={(v) => onChange({ ...answer, [key]: v })}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── D1. Reading comprehension (đọc đoạn → trả lời) ─────────────────────────
function ReadingComprehensionTask({ taskData, answer, onChange }: RendererProps) {
  const questions: any[] = taskData?.questions ?? [];
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-slate-50 p-4 text-[15px] leading-7 text-slate-700 whitespace-pre-wrap">
        {taskData?.passage}
      </div>
      <div className="space-y-3">
        {questions.map((q, i) => (
          <div key={i} className="rounded-2xl border-2 border-slate-100 bg-white p-3">
            <p className="mb-2 text-[15px] font-semibold text-slate-700">
              <span className="mr-1.5 text-rose-400">{i + 1}.</span>
              {q.question}
            </p>
            <KidInput
              value={answer[String(i)] ?? ''}
              onChange={(v) => onChange({ ...answer, [String(i)]: v })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── D2. Picture sentence writing (mỗi tranh viết 1 câu) ────────────────────
function PictureSentenceTask({ taskData, answer, onChange }: RendererProps) {
  const items: any[] = taskData?.items ?? [];
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={i} className="rounded-2xl border-2 border-slate-100 bg-white p-3">
          {it.image_url && (
            <img src={it.image_url} alt="" className="mb-2 max-h-48 w-full rounded-xl bg-slate-50 object-contain" />
          )}
          {it.prompt && <p className="mb-2 text-[15px] font-semibold text-slate-700">{it.prompt}</p>}
          <KidInput
            value={answer[String(i)] ?? ''}
            onChange={(v) => onChange({ ...answer, [String(i)]: v })}
            placeholder="Viết một câu…"
          />
        </div>
      ))}
    </div>
  );
}

// ─── D3. Picture story writing (nhìn các tranh viết đoạn) ───────────────────
function PictureStoryTask({ taskData, answer, onChange }: RendererProps) {
  const images: string[] = taskData?.images ?? [];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {images.map((url, i) => (
          <img key={i} src={url} alt="" className="aspect-square w-full rounded-xl bg-slate-50 object-cover" />
        ))}
      </div>
      <textarea
        value={answer['0'] ?? ''}
        onChange={(e) => onChange({ '0': e.target.value })}
        placeholder={`Viết câu chuyện của em (tối thiểu ${taskData?.min_words ?? 20} từ)…`}
        className="min-h-[160px] w-full rounded-2xl border-2 border-rose-100 p-4 text-[15px] outline-none transition-colors focus:border-rose-300"
      />
    </div>
  );
}

// ─── E. Listening letter match (nghe → ghép chủ thể với chữ cái hình) ────────
function ListeningLetterMatchTask({ taskData, answer, onChange }: RendererProps) {
  const audioUrl: string = taskData?.audio_url ?? taskData?.audioUrl ?? '';
  const options: any[] = taskData?.options ?? [];
  const subjects: any[] = (taskData?.subjects ?? []).filter(
    (s: any) => !(s.is_example ?? s.isExample)
  );
  return (
    <div className="space-y-4">
      {audioUrl && (
        <audio controls src={audioUrl} className="w-full">
          Trình duyệt không hỗ trợ audio.
        </audio>
      )}
      {/* Ngân hàng hình theo chữ cái */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {options.map((o, i) => {
          const letter = o.letter ?? String.fromCharCode(65 + i);
          return (
            <div key={letter} className="rounded-2xl border-2 border-slate-100 bg-white p-2">
              <div className="mb-1 flex items-center justify-center">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-pink-500 text-sm font-bold text-white">
                  {letter}
                </span>
              </div>
              {(o.image_url ?? o.imageUrl) && (
                <img
                  src={o.image_url ?? o.imageUrl}
                  alt={letter}
                  className="h-20 w-full rounded-xl bg-slate-50 object-cover"
                />
              )}
              {o.description && (
                <p className="mt-1 text-center text-xs font-semibold text-slate-500">{o.description}</p>
              )}
            </div>
          );
        })}
      </div>
      {/* Mỗi chủ thể chọn 1 chữ cái */}
      <div className="space-y-2">
        {subjects.map((s, i) => (
          <div key={i} className="rounded-2xl border-2 border-slate-100 bg-white p-3">
            <p className="mb-2 text-[15px] font-bold text-slate-800">{s.label}</p>
            <ChoiceChips
              options={options.map((o, oi) => {
                const letter = o.letter ?? String.fromCharCode(65 + oi);
                return { key: letter, label: letter };
              })}
              selected={answer[String(i)] ?? ''}
              onSelect={(v) => onChange({ ...answer, [String(i)]: v })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── G. Listen and draw lines (kéo tên vào đúng vị trí trên hình — kiểu Flyer) ──────
function ListenAndDrawLinesTask({ taskData, answer, onChange, gradeOverrides }: RendererProps) {
  const [dragOverHotspot, setDragOverHotspot] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const audioUrl: string = taskData?.audioUrl ?? taskData?.audio_url ?? '';
  const imageUrl: string = taskData?.imageUrl ?? taskData?.image_url ?? '';
  const items: any[] = taskData?.items ?? [];

  // answer[String(labelIdx)] = String(hotspotIdx)
  const getPlacedLabelAt = (hotspotIdx: number): number | null => {
    const key = Object.keys(answer).find((k) => answer[k] === String(hotspotIdx));
    return key != null ? parseInt(key) : null;
  };

  const placeLabel = (labelIdx: number, hotspotIdx: number) => {
    const next = { ...answer };
    const prevKey = Object.keys(next).find((k) => parseInt(k) === labelIdx);
    if (prevKey !== undefined) delete next[prevKey];
    const evictKey = Object.keys(next).find((k) => next[k] === String(hotspotIdx));
    if (evictKey !== undefined) delete next[evictKey];
    next[String(labelIdx)] = String(hotspotIdx);
    onChange(next);
    setSelected(null);
  };

  const unplaceLabel = (labelIdx: number) => {
    const next = { ...answer };
    delete next[String(labelIdx)];
    onChange(next);
    setSelected(null);
  };

  const handleChipClick = (idx: number) =>
    setSelected((prev) => (prev === idx ? null : idx));

  const handleHotspotClick = (hotspotIdx: number) => {
    const item = items[hotspotIdx];
    if (!item || item.isExample || item.is_example) return;
    const placedLabel = getPlacedLabelAt(hotspotIdx);
    if (selected !== null) {
      placeLabel(selected, hotspotIdx);
    } else if (placedLabel !== null) {
      unplaceLabel(placedLabel);
    }
  };

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    e.dataTransfer.setData('ldl-label', String(idx));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, hotspotIdx: number) => {
    const item = items[hotspotIdx];
    if (!item || item.isExample || item.is_example) return;
    e.preventDefault();
    setDragOverHotspot(hotspotIdx);
  };

  const handleDrop = (e: React.DragEvent, hotspotIdx: number) => {
    e.preventDefault();
    setDragOverHotspot(null);
    const item = items[hotspotIdx];
    if (!item || item.isExample || item.is_example) return;
    const labelIdx = parseInt(e.dataTransfer.getData('ldl-label'));
    if (!isNaN(labelIdx)) placeLabel(labelIdx, hotspotIdx);
  };

  return (
    <div className="space-y-4">
      {/* Audio */}
      {audioUrl && (
        <div className="flex items-center gap-3 rounded-2xl border-2 border-blue-200 bg-blue-50 p-3">
          <Volume2 className="h-5 w-5 flex-shrink-0 text-blue-600" />
          <audio controls className="flex-1" src={audioUrl} />
        </div>
      )}

      {/* Name chip bank */}
      <div className="flex min-h-[52px] flex-wrap items-center gap-2 rounded-2xl border-2 border-indigo-100 bg-indigo-50 px-4 py-3">
        {items.map((item, i) => {
          if (item.isExample || item.is_example) return null;
          const isPlaced = answer[String(i)] !== undefined;
          const isSel = selected === i;
          return (
            <div
              key={i}
              draggable={!isPlaced}
              onDragStart={!isPlaced ? (e) => handleDragStart(e, i) : undefined}
              onClick={!isPlaced ? () => handleChipClick(i) : undefined}
              className={`select-none rounded-full border-2 px-3 py-1 text-[15px] font-bold transition-all ${
                isPlaced
                  ? 'cursor-default border-dashed border-indigo-200 text-indigo-200'
                  : isSel
                  ? 'scale-105 cursor-pointer border-rose-500 bg-rose-500 text-white shadow-lg'
                  : 'cursor-grab border-indigo-300 bg-white text-slate-700 shadow hover:border-indigo-500 active:scale-95'
              }`}
            >
              {item.name}
            </div>
          );
        })}
      </div>

      {selected !== null && (
        <p className="animate-pulse text-center text-sm font-bold text-rose-500">
          👆 Nhấn vào ô trên hình để đặt tên &ldquo;{items[selected]?.name}&rdquo;
        </p>
      )}

      {/* Image with hotspot drop zones */}
      {imageUrl ? (
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <div
            className="relative select-none overflow-hidden rounded-2xl border-2 border-slate-200 min-w-[500px] sm:min-w-0"
            onDragLeave={() => setDragOverHotspot(null)}
          >
            <img
              src={imageUrl}
              alt="Scene"
              className="block h-auto w-full pointer-events-none"
              draggable={false}
            />
            {items.map((item, i) => {
              if (!item.hotspot) return null;
              const isExample = item.isExample || item.is_example;
              const placedLabelIdx = isExample ? i : getPlacedLabelAt(i);
              const placedName = placedLabelIdx !== null ? (items[placedLabelIdx]?.name ?? '') : null;
              const isDragTarget = dragOverHotspot === i;
              return (
                <div
                  key={i}
                  className="absolute -translate-x-1/2"
                  style={{ left: `${item.hotspot.x}%`, top: `${item.hotspot.y}%` }}
                  onDragOver={!isExample ? (e) => handleDragOver(e, i) : undefined}
                  onDrop={!isExample ? (e) => handleDrop(e, i) : undefined}
                  onClick={() => handleHotspotClick(i)}
                >
                  {placedName ? (
                    (() => {
                      // Trang chấm: tô màu theo giáo viên chỉnh (gradeOverrides theo chỉ số label).
                      // Nhãn ở hotspot này thuộc label placedLabelIdx → tra trạng thái chấm của label đó.
                      const graded =
                        !isExample && gradeOverrides
                          ? gradeOverrides[String(placedLabelIdx)]
                          : undefined;
                      const tone = isExample
                        ? 'border-sky-600 bg-sky-500 text-white'
                        : graded === false
                        ? 'border-rose-600 bg-rose-500 text-white'
                        : graded === true
                        ? 'border-green-600 bg-green-500 text-white'
                        : 'cursor-pointer border-green-600 bg-green-500 text-white hover:border-red-400 hover:bg-red-400';
                      return (
                        <div
                          className={`whitespace-nowrap rounded-xl border-2 px-3 py-1 text-sm font-bold shadow-md transition-all ${tone}`}
                          title={isExample ? '' : 'Nhấn để bỏ'}
                        >
                          {placedName}
                        </div>
                      );
                    })()
                  ) : (
                    <div
                      className={`min-w-[52px] whitespace-nowrap rounded-xl border-2 border-dashed px-3 py-1 text-center text-sm font-bold shadow transition-all ${
                        isDragTarget
                          ? 'scale-110 border-rose-500 bg-rose-100 text-rose-500'
                          : selected !== null
                          ? 'border-indigo-400 bg-white/90 text-indigo-300'
                          : 'border-slate-400 bg-white/70 text-slate-300'
                      }`}
                    >
                      ?
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-center text-sm italic text-slate-400">Chưa có hình ảnh cho câu này.</p>
      )}
    </div>
  );
}

// ─── F. Speaking / interactive (chấm trực tiếp — ghi chú thân thiện) ─────────
function SpeakingTask({ taskData }: RendererProps) {
  const items: any[] = taskData?.questions ?? taskData?.cards ?? [];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-2xl bg-violet-50 p-4 text-violet-700">
        <Volume2 className="h-5 w-5 flex-shrink-0" />
        <p className="text-sm font-bold">Phần này em nói trực tiếp với thầy/cô nhé. Cô sẽ chấm điểm cho em.</p>
      </div>
      {items.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {items.map((it, i) => (
            <div key={i} className="rounded-2xl border-2 border-slate-100 bg-white p-3">
              {it.image_url && (
                <img src={it.image_url} alt="" className="mb-2 h-32 w-full rounded-xl bg-slate-50 object-contain" />
              )}
              {it.question && <p className="text-[15px] font-semibold text-slate-700">{it.question}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Fallback ───────────────────────────────────────────────────────────────
function GenericWritingFallback({ answer, onChange }: RendererProps) {
  return (
    <textarea
      value={answer['0'] ?? ''}
      onChange={(e) => onChange({ '0': e.target.value })}
      placeholder="Em viết câu trả lời ở đây nhé…"
      className="min-h-[140px] w-full rounded-2xl border-2 border-rose-100 p-4 text-[15px] outline-none transition-colors focus:border-rose-300"
    />
  );
}

// ─── Switcher ─────────────────────────────────────────────────────────────
const RENDERERS: Record<string, React.FC<RendererProps>> = {
  listen_and_draw_lines: ListenAndDrawLinesTask,
  odd_one_out: OddOneOutTask,
  word_definition_matching: WordDefinitionTask,
  dialogue_matching: DialogueMatchingTask,
  listening_letter_match: ListeningLetterMatchTask,
  cloze_test: ClozeTestTask,
  open_cloze: OpenClozeTask,
  story_completion: StoryCompletionTask,
  unscramble_words: UnscrambleTask,
  word_bank_fill: WordBankFillTask,
  reading_comprehension: ReadingComprehensionTask,
  picture_sentence_writing: PictureSentenceTask,
  picture_story_writing: PictureStoryTask,
  picture_questions: SpeakingTask,
  picture_card_questions: SpeakingTask,
  object_placement: SpeakingTask,
  find_differences: SpeakingTask,
  picture_story_narration: SpeakingTask,
  information_exchange: SpeakingTask,
};

export function KidsTaskRenderer({
  taskType,
  taskData,
  answer,
  onChange,
  readOnly = false,
  gradeOverrides,
}: {
  taskType: string;
  taskData: any;
  answer: KidsAnswerMap;
  onChange: (map: KidsAnswerMap) => void;
  readOnly?: boolean;
  gradeOverrides?: Record<string, boolean>;
}) {
  const Comp = RENDERERS[taskType] ?? GenericWritingFallback;
  const inner = (
    <Comp
      taskData={taskData}
      answer={answer}
      onChange={onChange}
      readOnly={readOnly}
      gradeOverrides={gradeOverrides}
    />
  );
  if (!readOnly) return inner;
  // Chế độ chỉ đọc: khóa mọi tương tác (kéo-thả, bấm chọn) nhưng vẫn cho phép
  // điều khiển audio. Lớp ngoài chặn pointer-events; lớp audio mở lại bằng CSS.
  return (
    <div className="kids-readonly" style={{ pointerEvents: 'none', userSelect: 'none' }}>
      <style>{`.kids-readonly audio{pointer-events:auto}`}</style>
      {inner}
    </div>
  );
}

export default KidsTaskRenderer;
