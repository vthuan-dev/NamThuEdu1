import React, { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import EditorShell from '../components/EditorShell';
import { FieldLabel, TextField, AddItemButton } from '../components/editorPrimitives';

interface DialogueMatchingEditorProps {
  onSave: (data: any) => void;
  onCancel: () => void;
  initialData?: any;
  examId: string | null;
  questionId: string | null;
}

interface DialogueOption {
  id: string;
  text: string;
}

interface Dialogue {
  id: string;
  question: string;
  options: DialogueOption[];
  correct_answer: string;
}

// BUG FIX "Reading Part 2: đáp án chọn là từ A=>H".
// Trước đây giới hạn 5 lựa chọn (A-E) nên không tạo được đề Flyers Part 2
// (7 câu dùng CHUNG 8 lựa chọn A-H). Nay cho tối đa 8 và có chế độ
// "dùng chung một danh sách lựa chọn" đúng như đề Cambridge.
const MAX_OPTIONS = 8;

const letters = (count: number): string[] =>
  Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i));

const emptyOptions = (count: number): DialogueOption[] =>
  letters(count).map((id) => ({ id, text: '' }));

const newDialogue = (options: DialogueOption[]): Dialogue => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  question: '',
  options: options.map((o) => ({ ...o })),
  correct_answer: '',
});

/** Các hội thoại có dùng cùng một bộ lựa chọn hay không (để mở lại đúng chế độ). */
const detectShared = (dialogues: Dialogue[]): boolean => {
  if (dialogues.length <= 1) return true;
  const first = JSON.stringify(dialogues[0].options ?? []);
  return dialogues.every((d) => JSON.stringify(d.options ?? []) === first);
};

const DialogueMatchingEditor: React.FC<DialogueMatchingEditorProps> = ({
  onSave,
  onCancel,
  initialData,
}) => {
  const [title, setTitle] = useState(initialData?.title || 'Dialogue Matching');
  const initialDialogues: Dialogue[] = (initialData?.config?.dialogues || []).map(
    (d: any, i: number) => ({
      id: d.id ?? `d-${i}`,
      question: d.question ?? '',
      options: Array.isArray(d.options) && d.options.length > 0 ? d.options : emptyOptions(3),
      correct_answer: d.correct_answer ?? d.correctAnswer ?? '',
    })
  );
  const [shared, setShared] = useState<boolean>(
    initialDialogues.length > 0 ? detectShared(initialDialogues) : true
  );
  const [sharedOptions, setSharedOptions] = useState<DialogueOption[]>(
    initialDialogues[0]?.options?.length ? initialDialogues[0].options : emptyOptions(MAX_OPTIONS)
  );
  const [dialogues, setDialogues] = useState<Dialogue[]>(
    initialDialogues.length > 0 ? initialDialogues : [newDialogue(emptyOptions(MAX_OPTIONS))]
  );

  /** Bộ lựa chọn hiệu lực của 1 hội thoại (dùng chung hay riêng). */
  const optionsOf = (d: Dialogue) => (shared ? sharedOptions : d.options);

  const addDialogue = () =>
    setDialogues([...dialogues, newDialogue(shared ? sharedOptions : emptyOptions(3))]);
  const removeDialogue = (id: string) =>
    dialogues.length > 1 && setDialogues(dialogues.filter((d) => d.id !== id));

  const updateDialogue = (id: string, field: 'question' | 'correct_answer', value: string) =>
    setDialogues(dialogues.map((d) => (d.id === id ? { ...d, [field]: value } : d)));

  const updateOption = (dialogueId: string, optionId: string, value: string) => {
    if (shared) {
      setSharedOptions(sharedOptions.map((o) => (o.id === optionId ? { ...o, text: value } : o)));
      return;
    }
    setDialogues(
      dialogues.map((d) =>
        d.id === dialogueId
          ? { ...d, options: d.options.map((o) => (o.id === optionId ? { ...o, text: value } : o)) }
          : d
      )
    );
  };

  const addOption = (dialogueId: string) => {
    if (shared) {
      if (sharedOptions.length >= MAX_OPTIONS) return;
      setSharedOptions([
        ...sharedOptions,
        { id: String.fromCharCode(65 + sharedOptions.length), text: '' },
      ]);
      return;
    }
    setDialogues(
      dialogues.map((d) =>
        d.id === dialogueId && d.options.length < MAX_OPTIONS
          ? {
              ...d,
              options: [...d.options, { id: String.fromCharCode(65 + d.options.length), text: '' }],
            }
          : d
      )
    );
  };

  const removeOption = (dialogueId: string, optionId: string) => {
    const relabel = (list: DialogueOption[]) =>
      list
        .filter((o) => o.id !== optionId)
        .map((o, i) => ({ ...o, id: String.fromCharCode(65 + i) }));

    if (shared) {
      if (sharedOptions.length <= 2) return;
      setSharedOptions(relabel(sharedOptions));
      return;
    }
    setDialogues(
      dialogues.map((d) =>
        d.id === dialogueId && d.options.length > 2 ? { ...d, options: relabel(d.options) } : d
      )
    );
  };

  const canSave = dialogues.every((d) => {
    const opts = optionsOf(d);
    return (
      d.question.trim() &&
      d.correct_answer &&
      opts.every((o) => o.text.trim()) &&
      opts.some((o) => o.id === d.correct_answer)
    );
  });

  const handleSave = () => {
    const invalid = dialogues.find((d) => {
      const opts = optionsOf(d);
      return !d.question.trim() || !d.correct_answer || opts.some((o) => !o.text.trim());
    });
    if (invalid) return alert('Vui lòng điền đầy đủ thông tin cho tất cả các hội thoại!');
    if (dialogues.some((d) => !optionsOf(d).some((o) => o.id === d.correct_answer)))
      return alert('Đáp án đúng phải là một trong các lựa chọn!');

    onSave({
      type: 'dialogue_matching',
      title,
      points: dialogues.length,
      config: {
        shared_options: shared,
        dialogues: dialogues.map((d) => ({
          question: d.question.trim(),
          options: optionsOf(d).map((o) => ({ id: o.id, text: o.text.trim() })),
          correct_answer: d.correct_answer,
        })),
      },
    });
  };

  const renderOptionRow = (dialogueId: string, option: DialogueOption, canRemove: boolean) => (
    <div key={option.id} className="flex items-center gap-2">
      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-500">
        {option.id}
      </span>
      <TextField
        value={option.text}
        onChange={(e) => updateOption(dialogueId, option.id, e.target.value)}
        placeholder={`Câu trả lời ${option.id}`}
      />
      {canRemove && (
        <button
          type="button"
          onClick={() => removeOption(dialogueId, option.id)}
          className="flex-shrink-0 rounded-md p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
          aria-label="Xóa lựa chọn"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  return (
    <EditorShell
      title="Ghép hội thoại"
      badge="Reading & Writing · Dialogue"
      instruction="Học sinh chọn câu trả lời phù hợp cho mỗi câu nói. Flyers Part 2: 7 câu dùng CHUNG 8 lựa chọn A-H (có lựa chọn dư làm nhiễu). Movers Part 3: dùng ít lựa chọn hơn."
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
            placeholder="VD: Chọn câu trả lời phù hợp"
          />
        </div>

        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-orange-200 bg-orange-50/60 p-3">
          <input
            type="checkbox"
            checked={shared}
            onChange={(e) => setShared(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-400"
          />
          <span className="text-xs text-slate-700">
            <span className="font-semibold text-orange-800">
              Dùng chung một danh sách lựa chọn (A-H) cho mọi hội thoại
            </span>
            <br />
            Đúng chuẩn Cambridge: soạn danh sách câu trả lời một lần, mỗi câu hỏi chỉ cần chọn chữ
            cái đáp án. Bỏ tick nếu muốn mỗi hội thoại có lựa chọn riêng.
          </span>
        </label>

        {shared && (
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <FieldLabel hint={`${sharedOptions.length}/${MAX_OPTIONS} lựa chọn`}>
              Danh sách câu trả lời dùng chung
            </FieldLabel>
            <div className="space-y-2">
              {sharedOptions.map((o) => renderOptionRow('shared', o, sharedOptions.length > 2))}
              {sharedOptions.length < MAX_OPTIONS && (
                <button
                  type="button"
                  onClick={() => addOption('shared')}
                  className="text-xs font-medium text-orange-600 hover:text-orange-700"
                >
                  + Thêm lựa chọn
                </button>
              )}
            </div>
          </div>
        )}

        <div>
          <FieldLabel hint={`${dialogues.length} hội thoại`}>Danh sách hội thoại</FieldLabel>
          <div className="space-y-2">
            {dialogues.map((dialogue, index) => {
              const opts = optionsOf(dialogue);
              return (
                <div key={dialogue.id} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Hội thoại {index + 1}
                    </span>
                    {dialogues.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDialogue(dialogue.id)}
                        className="rounded-md p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                        aria-label="Xóa"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <TextField
                      value={dialogue.question}
                      onChange={(e) => updateDialogue(dialogue.id, 'question', e.target.value)}
                      placeholder="Câu hỏi / câu nói (VD: What's your name?)"
                    />

                    {!shared &&
                      opts.map((option) =>
                        renderOptionRow(dialogue.id, option, opts.length > 2)
                      )}

                    <div className="flex items-center justify-between gap-3">
                      {!shared && opts.length < MAX_OPTIONS ? (
                        <button
                          type="button"
                          onClick={() => addOption(dialogue.id)}
                          className="text-xs font-medium text-orange-600 hover:text-orange-700"
                        >
                          + Thêm lựa chọn
                        </button>
                      ) : (
                        <span />
                      )}
                      <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                        Đáp án đúng:
                        <select
                          value={dialogue.correct_answer}
                          onChange={(e) =>
                            updateDialogue(dialogue.id, 'correct_answer', e.target.value)
                          }
                          className="rounded-md border border-slate-200 px-2 py-1 text-sm focus:border-orange-400 focus:outline-none"
                        >
                          <option value="">--</option>
                          {opts.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.id}
                              {o.text.trim() ? ` — ${o.text.trim().slice(0, 30)}` : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}
            <AddItemButton onClick={addDialogue} label="Thêm hội thoại" />
          </div>
        </div>
      </div>
    </EditorShell>
  );
};

export default DialogueMatchingEditor;
