import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import EditorShell from '../components/EditorShell';
import { FieldLabel, TextField, ImageUpload, AddItemButton } from '../components/editorPrimitives';
import {
  calculateQuestionPoints,
  getScorableItemsCount,
  getExampleItemsCount,
} from '../../../../../../utils/examUtils';

interface UnscrambleWordsEditorProps {
  onSave: (data: any) => void;
  onCancel: () => void;
  initialData?: any;
  examId: string | null;
  questionId: string | null;
}

interface WordItem {
  id: string;
  image_url: string;
  scrambled_word: string;
  correct_answer: string;
  isExample?: boolean;
}

const UnscrambleWordsEditor: React.FC<UnscrambleWordsEditorProps> = ({
  onSave,
  onCancel,
  initialData,
  examId,
}) => {
  const [title, setTitle] = useState(initialData?.title || 'Unscramble Words');
  const [items, setItems] = useState<WordItem[]>(
    initialData?.config?.items || [
      { id: '1', image_url: '', scrambled_word: '', correct_answer: '' },
    ]
  );

  const addItem = () =>
    setItems([
      ...items,
      { id: Date.now().toString(), image_url: '', scrambled_word: '', correct_answer: '', isExample: false },
    ]);

  const removeItem = (index: number) =>
    items.length > 1 && setItems(items.filter((_, i) => i !== index));

  const updateItem = (index: number, field: keyof WordItem, value: string | boolean) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    // Auto-scramble when correct answer changes
    if (field === 'correct_answer' && typeof value === 'string' && value) {
      newItems[index].scrambled_word = value.split('').sort(() => Math.random() - 0.5).join('');
    }
    setItems(newItems);
  };

  const canSave = items.every((it) => it.image_url && it.correct_answer && it.scrambled_word);

  const handleSave = () => {
    if (!canSave) return alert('Vui lòng điền đầy đủ thông tin cho tất cả các từ!');

    const config = {
      items: items.map((it) => ({
        image_url: it.image_url,
        scrambled_word: it.scrambled_word,
        correct_answer: it.correct_answer.toLowerCase().trim(),
        isExample: it.isExample || false,
      })),
    };

    onSave({
      type: 'unscramble_words',
      title,
      points: calculateQuestionPoints(config, 1),
      config,
    });
  };

  return (
    <EditorShell
      title="Sắp xếp chữ thành từ"
      badge="Reading & Writing · Unscramble"
      instruction="Học sinh nhìn hình và sắp xếp chữ cái lộn xộn thành từ đúng. Nhập từ đúng, hệ thống tự xáo trộn chữ cái (có thể chỉnh tay)."
      onSave={handleSave}
      onCancel={onCancel}
    >
      <div className="space-y-5">
        <div>
          <FieldLabel required>Tiêu đề câu hỏi</FieldLabel>
          <TextField
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="VD: Sắp xếp chữ cái thành từ đúng"
          />
        </div>

        <div>
          <FieldLabel
            hint={`${getScorableItemsCount(items)} câu chấm · ${getExampleItemsCount(items)} ví dụ`}
          >
            Danh sách từ
          </FieldLabel>
          <div className="space-y-2">
            {items.map((item, index) => (
              <div
                key={item.id}
                className={`rounded-lg border p-3 ${
                  item.isExample ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Từ {index + 1}
                  </span>
                  <div className="flex items-center gap-3">
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600">
                      <input
                        type="checkbox"
                        checked={item.isExample || false}
                        onChange={(e) => updateItem(index, 'isExample', e.target.checked)}
                        className="h-4 w-4 rounded accent-orange-500"
                      />
                      Câu ví dụ
                    </label>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="rounded-md p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                        aria-label="Xóa"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex gap-3">
                  <ImageUpload
                    value={item.image_url}
                    onChange={(url) => updateItem(index, 'image_url', url)}
                    examId={examId}
                    size="sm"
                  />
                  <div className="flex-1 space-y-2">
                    <TextField
                      value={item.correct_answer}
                      onChange={(e) => updateItem(index, 'correct_answer', e.target.value)}
                      placeholder="Từ đúng (VD: cat)"
                    />
                    <TextField
                      value={item.scrambled_word}
                      onChange={(e) => updateItem(index, 'scrambled_word', e.target.value)}
                      placeholder="Chữ xáo trộn (VD: tac)"
                    />
                  </div>
                </div>
              </div>
            ))}
            <AddItemButton onClick={addItem} label="Thêm từ" />
          </div>
        </div>
      </div>
    </EditorShell>
  );
};

export default UnscrambleWordsEditor;
