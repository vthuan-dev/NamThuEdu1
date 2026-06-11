import React, { useState } from 'react';
import EditorShell from '../components/EditorShell';
import {
  FieldLabel,
  TextField,
  ImageUpload,
  AddItemButton,
  ItemCard,
} from '../components/editorPrimitives';

interface PictureQuestionsEditorProps {
  onSave: (data: any) => void;
  onCancel: () => void;
  initialData?: any;
  examId: string | null;
  questionId?: string | null;
}

interface QuestionItem {
  id: string;
  imageUrl: string;
  question: string;
  sampleAnswer: string;
}

const PictureQuestionsEditor: React.FC<PictureQuestionsEditorProps> = ({
  onSave,
  onCancel,
  initialData,
  examId,
}) => {
  const [title, setTitle] = useState(initialData?.title || '');
  const [questions, setQuestions] = useState<QuestionItem[]>(
    (initialData?.config?.questions || []).map((q: any, idx: number) => ({
      id: q?.id ?? `q-${idx + 1}`,
      imageUrl: q?.imageUrl ?? q?.image_url ?? initialData?.config?.imageUrl ?? initialData?.config?.image_url ?? '',
      question: q?.question ?? q?.text ?? '',
      sampleAnswer: q?.sampleAnswer ?? q?.sample_answer ?? q?.answer ?? '',
    }))
  );

  const addQuestion = () =>
    setQuestions([
      ...questions,
      { id: `q-${Date.now()}`, imageUrl: '', question: '', sampleAnswer: '' },
    ]);

  const removeQuestion = (id: string) =>
    setQuestions(questions.filter((q) => q.id !== id));

  const updateQuestion = (id: string, field: keyof QuestionItem, value: string) =>
    setQuestions(questions.map((q) => (q.id === id ? { ...q, [field]: value } : q)));

  const canSave =
    !!title.trim() &&
    questions.length > 0 &&
    questions.every((q) => q.imageUrl && q.question && q.sampleAnswer);

  const handleSave = () => {
    if (!title.trim()) return alert('Vui lòng nhập tiêu đề!');
    if (questions.length === 0) return alert('Vui lòng thêm ít nhất 1 câu hỏi!');
    if (questions.some((q) => !q.imageUrl || !q.question || !q.sampleAnswer))
      return alert('Vui lòng điền đầy đủ thông tin cho tất cả câu hỏi!');

    onSave({
      type: 'picture_questions',
      title,
      points: questions.length,
      config: {
        questions: questions.map((q) => ({
          image_url: q.imageUrl,
          question: q.question,
          sample_answer: q.sampleAnswer,
        })),
      },
    });
  };

  return (
    <EditorShell
      title="Trả lời câu hỏi về hình"
      badge="Speaking · Picture Questions"
      instruction="Học sinh nhìn hình và trả lời câu hỏi. Mỗi mục gồm 1 hình, 1 câu hỏi và 1 đáp án mẫu. Gợi ý: What is this? → It's a ball · What colour is it? → It's red."
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
            placeholder="VD: Trả lời câu hỏi về đồ vật trong hình"
          />
        </div>

        <div>
          <FieldLabel hint={`${questions.length} câu`}>Danh sách câu hỏi</FieldLabel>
          <div className="space-y-2">
            {questions.map((q, index) => (
              <ItemCard key={q.id ?? index} index={index} onRemove={() => removeQuestion(q.id)}>
                <div className="flex gap-3">
                  <ImageUpload
                    value={q.imageUrl}
                    onChange={(url) => updateQuestion(q.id, 'imageUrl', url)}
                    examId={examId}
                    size="sm"
                  />
                  <div className="flex-1 space-y-2">
                    <TextField
                      value={q.question}
                      onChange={(e) => updateQuestion(q.id, 'question', e.target.value)}
                      placeholder="Câu hỏi (VD: What is this?)"
                    />
                    <TextField
                      value={q.sampleAnswer}
                      onChange={(e) => updateQuestion(q.id, 'sampleAnswer', e.target.value)}
                      placeholder="Đáp án mẫu (VD: It's a ball)"
                    />
                  </div>
                </div>
              </ItemCard>
            ))}
            <AddItemButton onClick={addQuestion} label="Thêm câu hỏi" />
          </div>
        </div>
      </div>
    </EditorShell>
  );
};

export default PictureQuestionsEditor;
