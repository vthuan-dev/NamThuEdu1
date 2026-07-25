import React, { useState } from 'react';
import { Trash2, AlertCircle } from 'lucide-react';
import EditorShell from '../components/EditorShell';
import { FieldLabel, TextField, ImageUpload, AddItemButton } from '../components/editorPrimitives';

interface FindDifferencesEditorProps {
  onSave: (questionData: any) => void;
  onCancel: () => void;
  initialData?: any;
  examId?: string | null;
  questionId?: number | null;
}

const FindDifferencesEditor: React.FC<FindDifferencesEditorProps> = ({
  onSave,
  onCancel,
  initialData,
  examId,
  questionId,
}) => {
  // Dữ liệu đã lưu có thể nằm ở `config` (chuẩn hiện tại) hoặc `question_data`
  // (shape cũ của riêng editor này) — đọc cả hai để mở lại không mất ảnh.
  const saved = initialData?.config ?? initialData?.question_data ?? {};
  const [title, setTitle] = useState(initialData?.title || '');
  const [imageAUrl, setImageAUrl] = useState(saved.image_a_url || '');
  const [imageBUrl, setImageBUrl] = useState(saved.image_b_url || '');
  const [differences, setDifferences] = useState<string[]>(
    Array.isArray(saved.differences) && saved.differences.length > 0 ? saved.differences : ['']
  );
  const [error, setError] = useState('');

  const addDifference = () => setDifferences([...differences, '']);
  const updateDifference = (index: number, value: string) =>
    setDifferences(differences.map((d, i) => (i === index ? value : d)));
  const removeDifference = (index: number) =>
    setDifferences(differences.filter((_, i) => i !== index));

  const canSave =
    !!title.trim() &&
    !!imageAUrl &&
    !!imageBUrl &&
    differences.some((d) => d.trim());

  const handleSave = () => {
    if (!title.trim()) return setError('Vui lòng nhập tiêu đề câu hỏi');
    if (!imageAUrl || !imageBUrl) return setError('Vui lòng tải cả 2 hình');
    const valid = differences.filter((d) => d.trim());
    if (valid.length === 0) return setError('Vui lòng thêm ít nhất 1 điểm khác biệt');

    setError('');
    const payload = {
      image_a_url: imageAUrl,
      image_b_url: imageBUrl,
      differences: valid,
    };
    onSave({
      id: questionId,
      type: 'find_differences',
      title,
      points: 10,
      // `config` là shape chuẩn mà Step2AddQuestions gửi lên API.
      config: payload,
      question_data: payload, // giữ tương thích ngược
    });
  };

  return (
    <EditorShell
      title="Tìm điểm khác biệt"
      badge="Speaking · Find the Differences"
      instruction="Học sinh so sánh 2 bức tranh và nói ra điểm khác biệt. Tải 2 hình rồi liệt kê các điểm khác biệt để giáo viên dễ chấm."
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
            placeholder="VD: Tìm 5 điểm khác biệt giữa 2 bức tranh"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel required>Hình A</FieldLabel>
            <ImageUpload value={imageAUrl} onChange={setImageAUrl} examId={examId ?? null} placeholder="Tải hình A" />
          </div>
          <div>
            <FieldLabel required>Hình B</FieldLabel>
            <ImageUpload value={imageBUrl} onChange={setImageBUrl} examId={examId ?? null} placeholder="Tải hình B" />
          </div>
        </div>

        <div>
          <FieldLabel hint="Dùng để chấm bài nói">Danh sách điểm khác biệt</FieldLabel>
          <div className="space-y-2">
            {differences.map((diff, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="w-5 flex-shrink-0 text-sm font-semibold text-slate-400">
                  {index + 1}.
                </span>
                <TextField
                  value={diff}
                  onChange={(e) => updateDifference(index, e.target.value)}
                  placeholder="VD: Hình A có 3 quả táo, hình B có 2 quả táo"
                />
                {differences.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeDifference(index)}
                    className="flex-shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                    aria-label="Xóa"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <AddItemButton onClick={addDifference} label="Thêm điểm khác biệt" />
          </div>
        </div>
      </div>
    </EditorShell>
  );
};

export default FindDifferencesEditor;
