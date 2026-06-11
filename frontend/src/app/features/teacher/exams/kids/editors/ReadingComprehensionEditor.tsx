import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import EditorShell from '../components/EditorShell';
import { FieldLabel, TextField, TextArea, AddItemButton } from '../components/editorPrimitives';

interface ReadingComprehensionEditorProps {
  onSave: (data: any) => void;
  onCancel: () => void;
  initialData?: any;
  examId: string | null;
  questionId: string | null;
}

interface Question {
  id: string;
  question: string;
  answer: string;
}

const countWords = (text: string): number =>
  text.trim().split(/\s+/).filter((w) => w.length > 0).length;

const ReadingComprehensionEditor: React.FC<ReadingComprehensionEditorProps> = ({
  onSave,
  onCancel,
  initialData,
}) => {
  const [title, setTitle] = useState(initialData?.title || 'Đọc Hiểu Và Trả Lời Câu Hỏi');
  const [passage, setPassage] = useState(initialData?.config?.passage || '');
  const [questions, setQuestions] = useState<Question[]>(
    (initialData?.config?.questions && initialData.config.questions.length > 0
      ? initialData.config.questions.map((q: any, idx: number) => ({
          id: q?.id ?? `q-${idx + 1}`,
          question: q?.question ?? q?.text ?? '',
          answer: q?.answer ?? q?.correct_answer ?? '',
        }))
      : [
          { id: '1', question: '', answer: '' },
          { id: '2', question: '', answer: '' },
          { id: '3', question: '', answer: '' },
        ])
  );

  const addQuestion = () => {
    if (questions.length >= 10) return alert('Tối đa 10 câu hỏi!');
    setQuestions([...questions, { id: Date.now().toString(), question: '', answer: '' }]);
  };

  const removeQuestion = (id: string) => {
    if (questions.length <= 3) return alert('Phải có ít nhất 3 câu hỏi!');
    setQuestions(questions.filter((q) => q.id !== id));
  };

  const updateQuestion = (id: string, field: 'question' | 'answer', value: string) =>
    setQuestions(questions.map((q) => (q.id === id ? { ...q, [field]: value } : q)));

  const wordCount = countWords(passage);
  const canSave =
    wordCount >= 50 && questions.every((q) => q.question.trim() && q.answer.trim());

  const handleSave = () => {
    if (!passage.trim()) return alert('Vui lòng nhập đoạn văn!');
    if (wordCount < 50) return alert('Đoạn văn phải có ít nhất 50 từ!');
    if (questions.some((q) => !q.question.trim()))
      return alert('Vui lòng nhập đầy đủ tất cả các câu hỏi!');
    if (questions.some((q) => !q.answer.trim()))
      return alert('Vui lòng nhập đầy đủ tất cả các câu trả lời!');

    onSave({
      type: 'reading_comprehension',
      title,
      config: {
        passage: passage.trim(),
        questions: questions.map((q) => ({ question: q.question.trim(), answer: q.answer.trim() })),
      },
      points: questions.length,
    });
  };

  return (
    <EditorShell
      title="Đọc hiểu và trả lời câu hỏi"
      badge="Flyers · Reading Comprehension"
      instruction="Học sinh đọc đoạn văn (tối thiểu 50 từ) rồi trả lời 3-10 câu hỏi. Dùng câu hỏi WH, Yes/No, chi tiết và suy luận."
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
            placeholder="VD: Đọc đoạn văn và trả lời câu hỏi"
          />
        </div>

        <div>
          <FieldLabel
            required
            hint={wordCount >= 50 ? `${wordCount} từ ✓` : `${wordCount} từ (cần ≥ 50)`}
          >
            Đoạn văn
          </FieldLabel>
          <TextArea
            value={passage}
            onChange={(e) => setPassage(e.target.value)}
            rows={8}
            placeholder="Nhập đoạn văn tiếng Anh (tối thiểu 50 từ), nội dung phù hợp với trẻ em..."
          />
        </div>

        <div>
          <FieldLabel hint={`${questions.length} câu (3-10)`}>Câu hỏi & đáp án</FieldLabel>
          <div className="space-y-2">
            {questions.map((question, index) => (
              <div key={question.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Câu {index + 1}
                  </span>
                  {questions.length > 3 && (
                    <button
                      type="button"
                      onClick={() => removeQuestion(question.id)}
                      className="rounded-md p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                      aria-label="Xóa"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  <TextField
                    value={question.question}
                    onChange={(e) => updateQuestion(question.id, 'question', e.target.value)}
                    placeholder="Câu hỏi (VD: Where did Tom go last summer?)"
                  />
                  <TextField
                    value={question.answer}
                    onChange={(e) => updateQuestion(question.id, 'answer', e.target.value)}
                    placeholder="Đáp án (VD: He went to the beach)"
                  />
                </div>
              </div>
            ))}
            {questions.length < 10 && <AddItemButton onClick={addQuestion} label="Thêm câu hỏi" />}
          </div>
        </div>
      </div>
    </EditorShell>
  );
};

export default ReadingComprehensionEditor;
