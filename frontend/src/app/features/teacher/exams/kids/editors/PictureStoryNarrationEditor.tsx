import React, { useState } from 'react';
import { Trash2, AlertCircle } from 'lucide-react';
import EditorShell from '../components/EditorShell';
import { FieldLabel, TextField, ImageUpload, AddItemButton } from '../components/editorPrimitives';

interface PictureStoryNarrationEditorProps {
  onSave: (questionData: any) => void;
  onCancel: () => void;
  initialData?: any;
  examId?: string | null;
  questionId?: number | null;
}

const PictureStoryNarrationEditor: React.FC<PictureStoryNarrationEditorProps> = ({
  onSave,
  onCancel,
  initialData,
  examId,
  questionId,
}) => {
  const [title, setTitle] = useState(initialData?.title || '');
  const [images, setImages] = useState<string[]>(
    (initialData?.config ?? initialData?.question_data)?.images || ['', '', '']
  );
  const [prompts, setPrompts] = useState<string[]>(
    (initialData?.config ?? initialData?.question_data)?.prompts || [
      'What is happening in the first picture?',
      'What happened next?',
      'How did the story end?',
    ]
  );
  const [error, setError] = useState('');

  const updateImage = (index: number, url: string) =>
    setImages(images.map((img, i) => (i === index ? url : img)));
  const updatePrompt = (index: number, value: string) =>
    setPrompts(prompts.map((p, i) => (i === index ? value : p)));

  const addImage = () => {
    if (images.length >= 6) return setError('Tối đa 6 hình');
    setError('');
    setImages([...images, '']);
    setPrompts([...prompts, '']);
  };

  const removeImage = (index: number) => {
    if (images.length <= 3) return setError('Tối thiểu 3 hình');
    setError('');
    setImages(images.filter((_, i) => i !== index));
    setPrompts(prompts.filter((_, i) => i !== index));
  };

  const canSave = !!title.trim() && images.filter((img) => img.trim()).length >= 3;

  const handleSave = () => {
    if (!title.trim()) return setError('Vui lòng nhập tiêu đề câu hỏi');
    const validImages = images.filter((img) => img.trim());
    if (validImages.length < 3) return setError('Vui lòng tải ít nhất 3 hình');

    setError('');
    onSave({
      id: questionId,
      type: 'picture_story_narration',
      title,
      points: 10,
      // `config` là shape Step2AddQuestions gửi lên API; `question_data` giữ
      // tương thích với dữ liệu đã lưu trước đây.
      config: {
        images: validImages,
        prompts: prompts.slice(0, validImages.length),
      },
      question_data: {
        images: validImages,
        prompts: prompts.slice(0, validImages.length),
      },
    });
  };

  return (
    <EditorShell
      title="Kể chuyện theo tranh"
      badge="Speaking · Picture Story"
      instruction="Học sinh nhìn 3-6 tranh theo thứ tự và kể lại câu chuyện. Mỗi tranh kèm 1 câu hỏi gợi ý."
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
            placeholder="VD: Kể câu chuyện về chuyến đi của Tom"
          />
        </div>

        <div>
          <FieldLabel hint={`${images.length} hình (3-6)`}>Tranh câu chuyện</FieldLabel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((imageUrl, index) => (
              <div key={index} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Hình {index + 1}
                  </span>
                  {images.length > 3 && (
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="rounded-md p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                      aria-label="Xóa hình"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <ImageUpload
                  value={imageUrl}
                  onChange={(url) => updateImage(index, url)}
                  examId={examId ?? null}
                  size="lg"
                  placeholder="Tải hình"
                />
                <div className="mt-2">
                  <TextField
                    value={prompts[index] || ''}
                    onChange={(e) => updatePrompt(index, e.target.value)}
                    placeholder={`Câu hỏi gợi ý cho hình ${index + 1}`}
                  />
                </div>
              </div>
            ))}
          </div>
          {images.length < 6 && (
            <div className="mt-2">
              <AddItemButton onClick={addImage} label="Thêm hình" />
            </div>
          )}
        </div>
      </div>
    </EditorShell>
  );
};

export default PictureStoryNarrationEditor;
