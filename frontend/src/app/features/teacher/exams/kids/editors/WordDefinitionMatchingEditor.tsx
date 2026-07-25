import React, { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import EditorShell from '../components/EditorShell';
import { FieldLabel, TextField, AddItemButton } from '../components/editorPrimitives';

interface WordDefinitionMatchingEditorProps {
  onSave: (data: any) => void;
  onCancel: () => void;
  initialData?: any;
  examId: string | null;
  questionId: string | null;
}

interface WordItem {
  id: string;
  word: string;
  definition: string;
}

const WordDefinitionMatchingEditor: React.FC<WordDefinitionMatchingEditorProps> = ({
  onSave,
  onCancel,
  initialData,
}) => {
  const [title, setTitle] = useState(initialData?.title || 'Ghép Từ Với Định Nghĩa');
  const [words, setWords] = useState<WordItem[]>(
    initialData?.config?.words || [
      { id: '1', word: '', definition: '' },
      { id: '2', word: '', definition: '' },
      { id: '3', word: '', definition: '' },
      { id: '4', word: '', definition: '' },
      { id: '5', word: '', definition: '' },
    ]
  );
  // BUG FIX "Reading Part 1: số từ nhiều hơn số câu => chưa làm được".
  // Flyers Part 1 cho 15 từ nhưng chỉ có 10 định nghĩa: 5 từ dư là từ nhiễu.
  // Trước đây mọi từ BẮT BUỘC phải có định nghĩa nên không tạo được từ nhiễu.
  const [distractors, setDistractors] = useState<string[]>(
    initialData?.config?.distractor_words ?? initialData?.config?.distractorWords ?? []
  );

  const addWord = () => {
    if (words.length >= 15) return alert('Tối đa 15 định nghĩa!');
    setWords([...words, { id: Date.now().toString(), word: '', definition: '' }]);
  };

  const removeWord = (wordId: string) => {
    if (words.length <= 5) return alert('Phải có ít nhất 5 từ!');
    setWords(words.filter((w) => w.id !== wordId));
  };

  const updateWord = (wordId: string, field: 'word' | 'definition', value: string) =>
    setWords(words.map((w) => (w.id === wordId ? { ...w, [field]: value } : w)));

  const addDistractor = () => {
    if (words.length + distractors.length >= 20) return alert('Tối đa 20 từ trong hộp từ!');
    setDistractors([...distractors, '']);
  };
  const updateDistractor = (index: number, value: string) =>
    setDistractors(distractors.map((d, i) => (i === index ? value : d)));
  const removeDistractor = (index: number) =>
    setDistractors(distractors.filter((_, i) => i !== index));

  const cleanDistractors = distractors.map((d) => d.trim()).filter(Boolean);
  const canSave = words.every((w) => w.word.trim() && w.definition.trim()) && words.length >= 5;

  const handleSave = () => {
    if (words.some((w) => !w.word.trim())) return alert('Vui lòng nhập đầy đủ tất cả các từ!');
    if (words.some((w) => !w.definition.trim()))
      return alert('Vui lòng nhập đầy đủ tất cả các định nghĩa!');
    if (words.length < 5) return alert('Phải có ít nhất 5 từ!');

    const answerWords = words.map((w) => w.word.trim().toLowerCase());
    const dupDistractor = cleanDistractors.find((d) => answerWords.includes(d.toLowerCase()));
    if (dupDistractor)
      return alert(`Từ nhiễu "${dupDistractor}" đang trùng với một đáp án. Vui lòng đổi từ khác!`);

    onSave({
      type: 'word_definition_matching',
      title,
      config: {
        words: words.map((w) => ({ word: w.word.trim(), definition: w.definition.trim() })),
        // Từ nhiễu: chỉ xuất hiện trong hộp từ, không gắn với định nghĩa nào.
        distractor_words: cleanDistractors,
      },
      points: words.length,
    });
  };

  return (
    <EditorShell
      title="Ghép định nghĩa với từ"
      badge="Reading & Writing · Matching"
      instruction="Học sinh đọc từng định nghĩa rồi chọn từ đúng trong hộp từ. Movers: 5-8 từ · Flyers Part 1: 10 định nghĩa + 15 từ (5 từ nhiễu). Thêm từ nhiễu ở mục dưới cùng."
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
            placeholder="VD: Đọc định nghĩa và chọn từ đúng"
          />
        </div>

        <div>
          <FieldLabel hint={`${words.length} câu tính điểm (5-15)`}>
            Định nghĩa & từ đáp án
          </FieldLabel>
          <div className="space-y-2">
            {words.map((word, index) => (
              <div key={word.id} className="flex items-center gap-2">
                <span className="w-5 flex-shrink-0 text-sm font-semibold text-slate-400">
                  {index + 1}.
                </span>
                <TextField
                  value={word.definition}
                  onChange={(e) => updateWord(word.id, 'definition', e.target.value)}
                  placeholder="Định nghĩa (VD: A big animal with a long nose)"
                />
                <TextField
                  value={word.word}
                  onChange={(e) => updateWord(word.id, 'word', e.target.value)}
                  placeholder="Từ đáp án (VD: elephant)"
                />
                {words.length > 5 && (
                  <button
                    type="button"
                    onClick={() => removeWord(word.id)}
                    className="flex-shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                    aria-label="Xóa"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            {words.length < 15 && <AddItemButton onClick={addWord} label="Thêm định nghĩa" />}
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
          <FieldLabel
            hint={`Hộp từ sẽ có ${words.length + cleanDistractors.length} từ / ${words.length} câu`}
          >
            Từ nhiễu (không có định nghĩa)
          </FieldLabel>
          <p className="mb-2 text-xs text-amber-800">
            Các từ này chỉ nằm trong hộp từ để gây nhiễu, không phải đáp án của câu nào. Bỏ trống nếu
            số từ đúng bằng số câu.
          </p>
          <div className="space-y-2">
            {distractors.map((d, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="w-5 flex-shrink-0 text-sm font-semibold text-amber-500">+</span>
                <TextField
                  value={d}
                  onChange={(e) => updateDistractor(index, e.target.value)}
                  placeholder="Từ nhiễu (VD: bicycle)"
                />
                <button
                  type="button"
                  onClick={() => removeDistractor(index)}
                  className="flex-shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                  aria-label="Xóa từ nhiễu"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <AddItemButton onClick={addDistractor} label="Thêm từ nhiễu" />
          </div>
        </div>
      </div>
    </EditorShell>
  );
};

export default WordDefinitionMatchingEditor;
