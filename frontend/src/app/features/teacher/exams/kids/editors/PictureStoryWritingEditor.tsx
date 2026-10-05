import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import EditorShell from '../components/EditorShell';
import { FieldLabel, TextField, ImageUpload, AddItemButton } from '../components/editorPrimitives';

interface PictureStoryWritingEditorProps {
  onSave: (data: any) => void;
  onCancel: () => void;
  initialData?: any;
  examId: string | null;
  questionId: string | null;
}

const PictureStoryWritingEditor: React.FC<PictureStoryWritingEditorProps> = ({
  onSave,
  onCancel,
  initialData,
  examId,
}) => {
  const [title, setTitle] = useState(initialData?.title || 'Viết Câu Chuyện Theo Tranh');
  const [images, setImages] = useState<string[]>(initialData?.config?.images || ['', '', '']);
  const [minWords, setMinWords] = useState(initialData?.config?.min_words || 20);

  const updateImage = (index: number, url: string) =>
    setImages(images.map((img, i) => (i === index ? url : img)));

  const addImageSlot = () => {
    if (images.length >= 6) return alert('Tối đa 6 tranh!');
    setImages([...images, '']);
  };

  const removeImageSlot = (index: number) => {
    if (images.length <= 3) return alert('Phải có ít nhất 3 tranh!');
    setImages(images.filter((_, i) => i !== index));
  };

  const canSave = images.every((img) => img) && minWords >= 20;

  const handleSave = () => {
    if (images.some((img) => !img)) return alert('Vui lòng tải đầy đủ tất cả các tranh!');
    if (minWords < 20) return alert('Số từ tối thiểu phải từ 20 trở lên!');

    onSave({
      type: 'picture_story_writing',
      title,
      config: {
        images,
        min_words: minWords,
        scoring_criteria: { content: 3, language: 3, organization: 2 },
      },
      points: 8,
    });
  };

  return (
    <EditorShell
      title="Viết câu chuyện theo tranh"
      badge="Flyers · Writing · Picture Story"
      instruction="Học sinh nhìn 3-6 tranh theo thứ tự và viết câu chuyện (tối thiểu 20 từ). Chấm theo nội dung (3đ) + ngôn ngữ (3đ) + tổ chức (2đ) = 8 điểm."
      onSave={handleSave}
      onCancel={onCancel}
    >
      <div className="space-y-5">
        <div>
          <FieldLabel required>Tiêu đề câu hỏi</FieldLabel>
          <TextField
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="VD: Nhìn tranh và viết câu chuyện"
          />
        </div>

        <div className="max-w-[200px]">
          <FieldLabel required hint="≥ 20">Số từ tối thiểu</FieldLabel>
          <TextField
            type="number"
            min={20}
            max={100}
            value={minWords}
            onChange={(e) => setMinWords(parseInt(e.target.value) || 20)}
          />
        </div>

        <div>
          <FieldLabel hint={`${images.length} tranh (3-6)`}>Tranh minh họa</FieldLabel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((image, index) => (
              <div key={index} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Tranh {index + 1}
                  </span>
                  {images.length > 3 && (
                    <button
                      type="button"
                      onClick={() => removeImageSlot(index)}
                      className="rounded-md p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                      aria-label="Xóa tranh"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <ImageUpload
                  value={image}
                  onChange={(url) => updateImage(index, url)}
                  examId={examId}
                  size="lg"
                  placeholder="Tải tranh"
                />
              </div>
            ))}
          </div>
          {images.length < 6 && (
            <div className="mt-2">
              <AddItemButton onClick={addImageSlot} label="Thêm tranh" />
            </div>
          )}
        </div>
      </div>
    </EditorShell>
  );
};

export default PictureStoryWritingEditor;
