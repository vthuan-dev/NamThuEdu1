import React, { useState } from 'react';
import { Trash2, X, Plus } from 'lucide-react';
import EditorShell from '../components/EditorShell';
import { FieldLabel, TextField, TextArea, AddItemButton } from '../components/editorPrimitives';

interface OpenClozeEditorProps {
  onSave: (data: any) => void;
  onCancel: () => void;
  initialData?: any;
  examId: string | null;
  questionId: string | null;
}

interface Gap {
  gap_id: number;
  correct_answers: string[];
}

const OpenClozeEditor: React.FC<OpenClozeEditorProps> = ({ onSave, onCancel, initialData }) => {
  const [title, setTitle] = useState(initialData?.title || 'Open Cloze');
  const [text, setText] = useState(
    initialData?.config?.text || 'I __1__ to school every day. My school __2__ very big.'
  );
  const [gaps, setGaps] = useState<Gap[]>(
    (initialData?.config?.gaps && initialData.config.gaps.length > 0
      ? initialData.config.gaps.map((g: any, idx: number) => ({
          gap_id: g?.gap_id ?? g?.gap_number ?? idx + 1,
          correct_answers: Array.isArray(g?.correct_answers)
            ? g.correct_answers
            : g?.correct_answer != null
              ? [String(g.correct_answer)]
              : [''],
        }))
      : [{ gap_id: 1, correct_answers: [''] }])
  );

  const addGap = () => {
    const nextId = gaps.length > 0 ? Math.max(...gaps.map((g) => g.gap_id)) + 1 : 1;
    setGaps([...gaps, { gap_id: nextId, correct_answers: [''] }]);
  };
  const removeGap = (gapId: number) =>
    gaps.length > 1 && setGaps(gaps.filter((g) => g.gap_id !== gapId));

  const updateAnswer = (gapId: number, index: number, value: string) =>
    setGaps(
      gaps.map((g) =>
        g.gap_id === gapId
          ? { ...g, correct_answers: g.correct_answers.map((a, i) => (i === index ? value : a)) }
          : g
      )
    );
  const addAnswer = (gapId: number) =>
    setGaps(
      gaps.map((g) =>
        g.gap_id === gapId && g.correct_answers.length < 5
          ? { ...g, correct_answers: [...g.correct_answers, ''] }
          : g
      )
    );
  const removeAnswer = (gapId: number, index: number) =>
    setGaps(
      gaps.map((g) =>
        g.gap_id === gapId && g.correct_answers.length > 1
          ? { ...g, correct_answers: g.correct_answers.filter((_, i) => i !== index) }
          : g
      )
    );

  const canSave =
    !!text.trim() &&
    gaps.every((g) => g.correct_answers.some((a) => a.trim()) && text.includes(`__${g.gap_id}__`));

  const handleSave = () => {
    if (!text.trim()) return alert('Vui lòng nhập đoạn văn!');
    if (gaps.some((g) => g.correct_answers.every((a) => !a.trim())))
      return alert('Vui lòng nhập ít nhất 1 đáp án đúng cho mỗi chỗ trống!');
    const missing = gaps.find((g) => !text.includes(`__${g.gap_id}__`));
    if (missing) return alert(`Chỗ trống __${missing.gap_id}__ không có trong đoạn văn!`);

    onSave({
      type: 'open_cloze',
      title,
      points: gaps.length,
      config: {
        text,
        gaps: gaps.map((g) => ({
          gap_id: g.gap_id,
          correct_answers: g.correct_answers
            .filter((a) => a.trim())
            .map((a) => a.trim().toLowerCase()),
        })),
      },
    });
  };

  return (
    <EditorShell
      title="Điền từ tự do (Open Cloze)"
      badge="Flyers · Reading & Writing"
      instruction="Học sinh tự nghĩ và điền 1 từ vào mỗi chỗ trống (không có lựa chọn). Dùng __1__, __2__... trong đoạn văn. Mỗi chỗ trống có thể nhận nhiều đáp án đúng (không phân biệt hoa thường)."
      saveDisabled={!canSave}
      onSave={handleSave}
      onCancel={onCancel}
    >
      <div className="space-y-5">
        <div>
          <FieldLabel required>Tiêu đề câu hỏi</FieldLabel>
          <TextField
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="VD: Điền từ vào chỗ trống"
          />
        </div>

        <div>
          <FieldLabel required hint="Dùng __1__, __2__...">Đoạn văn</FieldLabel>
          <TextArea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="VD: I __1__ to school every day. My school __2__ very big."
          />
        </div>

        <div>
          <FieldLabel hint={`${gaps.length} chỗ trống`}>Cấu hình chỗ trống</FieldLabel>
          <div className="space-y-2">
            {gaps.map((gap) => (
              <div key={gap.gap_id} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${
                      text.includes(`__${gap.gap_id}__`)
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-red-100 text-red-600'
                    }`}
                  >
                    __{gap.gap_id}__
                  </span>
                  {gaps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeGap(gap.gap_id)}
                      className="rounded-md p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                      aria-label="Xóa"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {gap.correct_answers.map((answer, ai) => (
                    <div key={ai} className="flex items-center gap-2">
                      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-500">
                        {ai + 1}
                      </span>
                      <TextField
                        value={answer}
                        onChange={(e) => updateAnswer(gap.gap_id, ai, e.target.value)}
                        placeholder={`Đáp án ${ai + 1}`}
                      />
                      {gap.correct_answers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeAnswer(gap.gap_id, ai)}
                          className="flex-shrink-0 rounded-md p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                          aria-label="Xóa đáp án"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {gap.correct_answers.length < 5 && (
                    <button
                      type="button"
                      onClick={() => addAnswer(gap.gap_id)}
                      className="flex items-center gap-1 text-xs font-medium text-orange-600 hover:text-orange-700"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Thêm đáp án
                    </button>
                  )}
                </div>
              </div>
            ))}
            <AddItemButton onClick={addGap} label="Thêm chỗ trống" />
          </div>
        </div>
      </div>
    </EditorShell>
  );
};

export default OpenClozeEditor;
