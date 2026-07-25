import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import EditorShell from '../components/EditorShell';
import { FieldLabel, TextField, ImageUpload } from '../components/editorPrimitives';

interface ImageItem {
  id: number;
  url: string;
  category: string;
}

interface OddOneOutEditorProps {
  onSave: (questionData: any) => void;
  onCancel: () => void;
  initialData?: any;
  examId?: string | null;
  questionId?: number | null;
}

const OddOneOutEditor: React.FC<OddOneOutEditorProps> = ({
  onSave,
  onCancel,
  initialData,
  examId,
  questionId,
}) => {
  const [title, setTitle] = useState(initialData?.title || '');
  const [images, setImages] = useState<ImageItem[]>(
    (initialData?.config ?? initialData?.question_data)?.images || [
      { id: 1, url: '', category: '' },
      { id: 2, url: '', category: '' },
      { id: 3, url: '', category: '' },
      { id: 4, url: '', category: '' },
    ]
  );
  const [correctOddOne, setCorrectOddOne] = useState<number>(
    (initialData?.config ?? initialData?.question_data)?.correct_odd_one || 0
  );
  const [error, setError] = useState('');

  const updateImage = (index: number, field: keyof ImageItem, value: any) => {
    const updated = [...images];
    (updated[index] as any)[field] = value;
    setImages(updated);
  };

  const canSave =
    !!title.trim() &&
    images.every((img) => img.url.trim() && img.category.trim()) &&
    correctOddOne >= 1 &&
    correctOddOne <= 4;

  const handleSave = () => {
    if (!title.trim()) return setError('Vui lòng nhập tiêu đề câu hỏi');
    if (images.some((img) => !img.url.trim() || !img.category.trim()))
      return setError('Vui lòng tải đủ 4 hình và điền loại (category)');
    if (!correctOddOne || correctOddOne < 1 || correctOddOne > 4)
      return setError('Vui lòng chọn hình khác loại');

    setError('');
    onSave({
      id: questionId,
      type: 'odd_one_out',
      title,
      points: 10,
      // `config` là shape Step2AddQuestions gửi lên API; giữ `question_data`
      // để tương thích dữ liệu cũ.
      config: { images, correct_odd_one: correctOddOne },
      question_data: { images, correct_odd_one: correctOddOne },
    });
  };

  return (
    <EditorShell
      title="Tìm hình khác loại"
      badge="Speaking · Odd-one-out"
      instruction="Tải 4 hình: 3 hình cùng loại + 1 hình khác loại. Đánh dấu hình khác loại bằng nút chọn. VD: cat, dog, bird (động vật) + car (phương tiện) → car là đáp án."
      saveDisabled={!canSave}
      onSave={handleSave}
      onCancel={onCancel}
    >
      <div className="space-y-5">
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div>
          <FieldLabel required>Tiêu đề câu hỏi</FieldLabel>
          <TextField
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="VD: Tìm hình khác loại và giải thích"
          />
        </div>

        <div>
          <FieldLabel hint="Chọn 1 hình khác loại">4 hình</FieldLabel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {images.map((image, index) => (
              <div
                key={image.id}
                className={`rounded-lg border p-3 transition-colors ${
                  correctOddOne === image.id
                    ? 'border-orange-400 bg-orange-50'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Hình {image.id}
                  </span>
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600">
                    <input
                      type="radio"
                      name="oddOne"
                      checked={correctOddOne === image.id}
                      onChange={() => setCorrectOddOne(image.id)}
                      className="h-4 w-4 accent-orange-500"
                    />
                    Khác loại
                  </label>
                </div>
                <ImageUpload
                  value={image.url}
                  onChange={(url) => updateImage(index, 'url', url)}
                  examId={examId ?? null}
                  size="lg"
                  placeholder={`Tải hình ${image.id}`}
                />
                <div className="mt-2">
                  <TextField
                    value={image.category}
                    onChange={(e) => updateImage(index, 'category', e.target.value)}
                    placeholder="Loại (VD: animal, fruit, vehicle)"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </EditorShell>
  );
};

export default OddOneOutEditor;
