import { useState, useEffect } from "react";
import { Mic, Save, Plus, Trash2, Sparkles, MessageCircle } from "lucide-react";
import {
  IELTS_STRUCTURE,
  SPEAKING_CUE_CARD_TEMPLATE,
  type IeltsTestType,
} from "../structure";

interface SpeakingPart {
  partNumber: 1 | 2 | 3;
  /** Part 1 & 3 use questions array. Part 2 uses cueCard. */
  questions?: { id: string; topic?: string; text: string; explanation?: string }[];
  cueCard?: {
    topic: string;
    bullets: string[];
    followUp: string;
    explanation?: string;
  };
}

interface Props {
  examId?: string;
  testType: IeltsTestType;
  initialData?: any;
  onSave: (data: any) => void;
}

const buildEmptyParts = (): SpeakingPart[] => [
  {
    partNumber: 1,
    questions: [
      { id: "p1-t1-q1", topic: "Hometown", text: "Where are you from?", explanation: "" },
      { id: "p1-t1-q2", topic: "Hometown", text: "What do you like about your hometown?", explanation: "" },
      { id: "p1-t1-q3", topic: "Hometown", text: "Has your hometown changed recently?", explanation: "" },
    ],
  },
  {
    partNumber: 2,
    cueCard: {
      topic: SPEAKING_CUE_CARD_TEMPLATE.topic,
      bullets: [...SPEAKING_CUE_CARD_TEMPLATE.bullets],
      followUp: "",
      explanation: "",
    },
  },
  {
    partNumber: 3,
    questions: [
      { id: "p3-q1", text: "", explanation: "" },
      { id: "p3-q2", text: "", explanation: "" },
      { id: "p3-q3", text: "", explanation: "" },
      { id: "p3-q4", text: "", explanation: "" },
    ],
  },
];

export function IeltsSpeakingEditor({ initialData, onSave }: Props) {
  const [parts, setParts] = useState<SpeakingPart[]>(
    () => initialData?.parts || buildEmptyParts()
  );
  const [activePart, setActivePart] = useState<1 | 2 | 3>(1);

  const current = parts.find((p) => p.partNumber === activePart)!;
  const partInfo = IELTS_STRUCTURE.speaking.parts[activePart - 1];

  const updatePart = (n: 1 | 2 | 3, patch: Partial<SpeakingPart>) => {
    setParts((prev) => prev.map((p) => (p.partNumber === n ? { ...p, ...patch } : p)));
  };

  useEffect(() => {
    onSave({ parts });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts]);

  return (
    <div className="space-y-5">
      {/* Part tabs */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-gray-100">
          {parts.map((p) => {
            const isActive = p.partNumber === activePart;
            const filled =
              p.partNumber === 2
                ? !!p.cueCard?.topic && p.cueCard.topic.length > 10
                : (p.questions || []).filter((q) => q.text.trim()).length > 0;
            return (
              <button
                key={p.partNumber}
                type="button"
                onClick={() => setActivePart(p.partNumber)}
                className="px-4 py-3 text-left transition-all cursor-pointer"
                style={{
                  background: isActive ? "#FAF5FF" : "#FFFFFF",
                  borderBottom: isActive ? "3px solid #A855F7" : "3px solid transparent",
                }}
              >
                <p
                  className="text-sm font-bold"
                  style={{ color: isActive ? "#7E22CE" : "#374151" }}
                >
                  Part {p.partNumber}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  {p.partNumber === 1 && "Interview"}
                  {p.partNumber === 2 && "Long turn"}
                  {p.partNumber === 3 && "Discussion"}
                  {filled && <span className="text-emerald-600 ml-1">✓</span>}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Editor */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Mic className="w-4 h-4 text-purple-600" />
              {partInfo.name}
            </h3>
            <p className="text-xs text-gray-500 mt-1">{partInfo.description}</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-bold">
            ~{partInfo.recommendedMinutes} phút
          </span>
        </div>

        {/* Part 1 & 3: question list */}
        {(activePart === 1 || activePart === 3) && current.questions && (
          <Part1Or3Editor
            partNumber={activePart}
            questions={current.questions}
            onChange={(qs) => updatePart(activePart, { questions: qs })}
          />
        )}

        {/* Part 2: cue card */}
        {activePart === 2 && current.cueCard && (
          <CueCardEditor
            cueCard={current.cueCard}
            onChange={(c) => updatePart(2, { cueCard: c })}
          />
        )}
      </div>

      {/* Assessment criteria reminder */}
      <div className="bg-purple-50/50 border border-purple-200 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <h4 className="text-sm font-bold text-purple-900">
            4 tiêu chí chấm điểm IELTS Speaking
          </h4>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {IELTS_STRUCTURE.speaking.assessmentCriteria?.map((c) => (
            <div
              key={c}
              className="px-3 py-2 bg-white rounded-md border border-purple-200 text-purple-800 font-medium"
            >
              {c}
            </div>
          ))}
        </div>
      </div>

      {/* Save bar */}
      <div className="flex items-center justify-end bg-white rounded-2xl border border-gray-200 p-4 sticky bottom-0">
        <button
          type="button"
          onClick={() => onSave({ parts })}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-all cursor-pointer"
        >
          <Save className="w-4 h-4" />
          Lưu Speaking
        </button>
      </div>
    </div>
  );
}

function Part1Or3Editor({
  partNumber,
  questions,
  onChange,
}: {
  partNumber: 1 | 3;
  questions: { id: string; topic?: string; text: string; explanation?: string }[];
  onChange: (qs: { id: string; topic?: string; text: string; explanation?: string }[]) => void;
}) {
  const updateQ = (idx: number, patch: Partial<{ topic: string; text: string; explanation: string }>) => {
    const next = [...questions];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const addQ = () => {
    onChange([
      ...questions,
      { id: `p${partNumber}-q${Date.now()}`, topic: "", text: "", explanation: "" },
    ]);
  };

  const removeQ = (idx: number) => {
    onChange(questions.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <div className="space-y-3">
        {questions.map((q, idx) => (
          <div
            key={q.id}
            className="rounded-xl border border-gray-200 p-3 hover:border-purple-300 transition-all"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                {partNumber === 1 && (
                  <input
                    type="text"
                    value={q.topic || ""}
                    onChange={(e) => updateQ(idx, { topic: e.target.value } as any)}
                    placeholder="Chủ đề (vd: Hometown, Hobbies, Work, Study)..."
                    className="w-full px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 bg-purple-50/30"
                  />
                )}
                <textarea
                  value={q.text}
                  onChange={(e) => updateQ(idx, { text: e.target.value } as any)}
                  placeholder={
                    partNumber === 1
                      ? "VD: What do you do for a living?"
                      : "VD: Why do people prefer working in big cities?"
                  }
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                />
                <input
                  type="text"
                  value={q.explanation || ""}
                  onChange={(e) => updateQ(idx, { explanation: e.target.value } as any)}
                  placeholder="Gợi ý trả lời / Từ vựng nên dùng (Giải thích) - Tuỳ chọn"
                  className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 bg-emerald-50/20 placeholder:text-gray-400"
                />
              </div>
              <button
                type="button"
                onClick={() => removeQ(idx)}
                className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addQ}
        className="mt-3 w-full py-2.5 rounded-lg border-2 border-dashed border-gray-300 text-gray-500 hover:border-purple-400 hover:text-purple-600 transition-all flex items-center justify-center gap-2 text-sm font-semibold cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        Thêm câu hỏi
      </button>
    </div>
  );
}

// ─── Cue card editor (Part 2) ──────────────────────────────────────────────
function CueCardEditor({
  cueCard,
  onChange,
}: {
  cueCard: { topic: string; bullets: string[]; followUp: string; explanation?: string };
  onChange: (c: { topic: string; bullets: string[]; followUp: string; explanation?: string }) => void;
}) {
  const updateBullet = (idx: number, val: string) => {
    const next = [...cueCard.bullets];
    next[idx] = val;
    onChange({ ...cueCard, bullets: next });
  };

  const addBullet = () => {
    onChange({ ...cueCard, bullets: [...cueCard.bullets, ""] });
  };

  const removeBullet = (idx: number) => {
    onChange({ ...cueCard, bullets: cueCard.bullets.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-4">
      {/* Cue card preview */}
      <div className="rounded-2xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 p-5">
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle className="w-4 h-4 text-purple-600" />
          <span className="text-xs font-bold text-purple-700 uppercase tracking-wide">
            Cue Card
          </span>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm">
          <input
            type="text"
            value={cueCard.topic}
            onChange={(e) => onChange({ ...cueCard, topic: e.target.value })}
            placeholder="Describe a [person/place/object/event]..."
            className="w-full text-base font-bold text-gray-900 border-0 outline-none focus:bg-purple-50/50 focus:px-2 rounded transition-all"
          />

          <p className="text-xs text-gray-500 mt-3 mb-2 font-semibold">You should say:</p>
          <div className="space-y-2">
            {cueCard.bullets.map((b, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-purple-400 font-bold">•</span>
                <input
                  type="text"
                  value={b}
                  onChange={(e) => updateBullet(idx, e.target.value)}
                  placeholder={`Bullet ${idx + 1}`}
                  className="flex-1 px-2 py-1 text-sm text-gray-700 border-0 outline-none focus:bg-purple-50/50 rounded transition-all"
                />
                {cueCard.bullets.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeBullet(idx)}
                    className="p-1 text-gray-300 hover:text-red-500 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addBullet}
            className="mt-3 text-xs text-purple-600 hover:text-purple-700 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            Thêm bullet
          </button>
        </div>
      </div>

      {/* Follow-up question */}
      <div>
        <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
          Câu hỏi follow-up (sau khi thí sinh nói xong)
        </label>
        <input
          type="text"
          value={cueCard.followUp}
          onChange={(e) => onChange({ ...cueCard, followUp: e.target.value })}
          placeholder="VD: Do you think you will visit there again?"
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
        />
      </div>

      {/* Explanation */}
      <div>
        <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
          Gợi ý trả lời / Từ vựng (Giải thích) - Tuỳ chọn
        </label>
        <textarea
          value={cueCard.explanation || ""}
          onChange={(e) => onChange({ ...cueCard, explanation: e.target.value })}
          placeholder="VD: Nên sử dụng các tính từ miêu tả cảm xúc, chia thì quá khứ đơn, nói về các chi tiết..."
          rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
        />
      </div>
    </div>
  );
}

export default IeltsSpeakingEditor;
