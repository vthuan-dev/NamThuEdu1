import React, { useState } from 'react';
import { Trash2, X, Plus } from 'lucide-react';
import EditorShell from '../components/EditorShell';
import { FieldLabel, TextField, ImageUpload, AddItemButton } from '../components/editorPrimitives';

interface PictureSentenceWritingEditorProps {
  onSave: (data: any) => void;
  onCancel: () => void;
  initialData?: any;
  examId: string | null;
  questionId: string | null;
}

interface SentenceItem {
  id: string;
  image_url: string;
  prompt: string;
  sample_answers: string[];
}

const PictureSentenceWritingEditor: React.FC<PictureSentenceWritingEditorProps> = ({
  onSave,
  onCancel,
  initialData,
  examId,
}) => {
  const [title, setTitle] = useState(initialData?.title || 'Viết Câu Mô Tả Tranh');
  const [items, setItems] = useState<SentenceItem[]>(
    initialData?.config?.items || [
      { id: '1', image_url: '', prompt: '', sample_answers: [''] },
    ]
  );

  const addItem = () =>
    setItems([
      ...items,
      { id: Date.now().toString(), image_url: '', prompt: '', sample_answers: [''] },
    ]);

  const removeItem = (itemId: string) => {
    if (items.length === 1) return alert('Phải có ít nhất 1 câu!');
    setItems(items.filter((it) => it.id !== itemId));
  };

  const updateItem = (itemId: string, field: keyof SentenceItem, value: any) =>
    setItems(items.map((it) => (it.id === itemId ? { ...it, [field]: value } : it)));

  const addSampleAnswer = (itemId: string) =>
    setItems(
      items.map((it) =>
        it.id === itemId ? { ...it, sample_answers: [...it.sample_answers, ''] } : it
      )
    );

  const updateSampleAnswer = (itemId: string, index: number, value: string) =>
    setItems(
      items.map((it) =>
        it.id === itemId
          ? { ...it, sample_answers: it.sample_answers.map((a, i) => (i === index ? value : a)) }
          : it
      )
    );

  const removeSampleAnswer = (itemId: string, index: number) =>
    setItems(
      items.map((it) =>
        it.id === itemId && it.sample_answers.length > 1
          ? { ...it, sample_answers: it.sample_answers.filter((_, i) => i !== index) }
          : it
      )
    );

  const canSave = items.every(
    (it) => it.image_url && it.prompt.trim() && it.sample_answers.some((a) => a.trim())
  );

  const handleSave = () => {
    if (items.some((it) => !it.image_url)) return alert('Vui lòng tải ảnh cho tất cả các câu!');
    if (items.some((it) => !it.prompt.trim()))
      return alert('Vui lòng nhập câu hỏi gợi ý cho tất cả các câu!');
    if (items.some((it) => !it.sample_answers.some((a) => a.trim())))
      return alert('Vui lòng nhập ít nhất 1 câu trả lời mẫu cho mỗi câu!');

    onSave({
      type: 'picture_sentence_writing',
      title,
      config: {
        items: items.map((it) => ({
          ...it,
          sample_answers: it.sample_answers.filter((a) => a.trim()),
        })),
      },
      points: items.length * 2,
    });
  };

  return (
    <EditorShell
      title="Viết câu mô tả tranh"
      badge="Writing · Picture Sentence"
      instruction="Học sinh nhìn tranh và viết câu mô tả hoàn chỉnh. Mỗi câu có 1 ảnh, 1 câu hỏi gợi ý và nhiều đáp án mẫu để giáo viên chấm linh hoạt."
      onSave={handleSave}
      onCancel={onCancel}
    >
      <div className="space-y-5">
        <div>
          <FieldLabel required>Tiêu đề câu hỏi</FieldLabel>
          <TextField
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="VD: Viết câu mô tả những gì bạn thấy trong tranh"
          />
        </div>

        <div>
          <FieldLabel hint={`${items.length} câu`}>Danh sách câu</FieldLabel>
          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Câu {index + 1}
                  </span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="rounded-md p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                      aria-label="Xóa"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="flex gap-3">
                  <ImageUpload
                    value={item.image_url}
                    onChange={(url) => updateItem(item.id, 'image_url', url)}
                    examId={examId}
                    size="sm"
                  />
                  <div className="flex-1 space-y-2">
                    <TextField
                      value={item.prompt}
                      onChange={(e) => updateItem(item.id, 'prompt', e.target.value)}
                      placeholder="Câu hỏi gợi ý (VD: What is the boy doing?)"
                    />
                    {item.sample_answers.map((answer, ai) => (
                      <div key={ai} className="flex items-center gap-2">
                        <TextField
                          value={answer}
                          onChange={(e) => updateSampleAnswer(item.id, ai, e.target.value)}
                          placeholder={`Đáp án mẫu ${ai + 1}`}
                        />
                        {item.sample_answers.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSampleAnswer(item.id, ai)}
                            className="flex-shrink-0 rounded-md p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                            aria-label="Xóa đáp án"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addSampleAnswer(item.id)}
                      className="flex items-center gap-1 text-xs font-medium text-orange-600 hover:text-orange-700"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Thêm đáp án mẫu
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <AddItemButton onClick={addItem} label="Thêm câu" />
          </div>
        </div>
      </div>
    </EditorShell>
  );
};

export default PictureSentenceWritingEditor;
