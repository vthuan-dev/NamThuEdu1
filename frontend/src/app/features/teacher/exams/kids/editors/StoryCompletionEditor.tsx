import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import EditorShell from '../components/EditorShell';
import { FieldLabel, TextField, TextArea, AddItemButton } from '../components/editorPrimitives';

interface StoryCompletionEditorProps {
  onSave: (data: any) => void;
  onCancel: () => void;
  initialData?: any;
  examId: string | null;
  questionId: string | null;
}

interface CompletionSentence {
  id: string;
  text: string;
  correct_answer: string;
  max_words: number;
}

const countWords = (text: string): number =>
  text.trim().split(/\s+/).filter((w) => w.length > 0).length;

const StoryCompletionEditor: React.FC<StoryCompletionEditorProps> = ({
  onSave,
  onCancel,
  initialData,
}) => {
  const [title, setTitle] = useState(initialData?.title || 'Story Completion');
  const [storyText, setStoryText] = useState(initialData?.config?.story_text || '');
  const [sentences, setSentences] = useState<CompletionSentence[]>(
    initialData?.config?.completion_sentences || [
      { id: '1', text: '', correct_answer: '', max_words: 3 },
    ]
  );

  const addSentence = () =>
    setSentences([
      ...sentences,
      { id: Date.now().toString(), text: '', correct_answer: '', max_words: 3 },
    ]);

  const removeSentence = (id: string) =>
    sentences.length > 1 && setSentences(sentences.filter((s) => s.id !== id));

  const updateSentence = (id: string, field: keyof CompletionSentence, value: string | number) =>
    setSentences(sentences.map((s) => (s.id === id ? { ...s, [field]: value } : s)));

  const canSave =
    !!storyText.trim() &&
    sentences.every(
      (s) => s.text.trim() && s.correct_answer.trim() && countWords(s.correct_answer) <= s.max_words
    );

  const handleSave = () => {
    if (!storyText.trim()) return alert('Vui lòng nhập câu chuyện!');
    if (sentences.some((s) => !s.text.trim() || !s.correct_answer.trim()))
      return alert('Vui lòng điền đầy đủ thông tin cho tất cả các câu!');
    const invalid = sentences.find((s) => countWords(s.correct_answer) > s.max_words);
    if (invalid)
      return alert(`Đáp án của câu ${sentences.indexOf(invalid) + 1} vượt quá số từ cho phép!`);

    onSave({
      type: 'story_completion',
      title,
      points: sentences.length,
      config: {
        story_text: storyText.trim(),
        completion_sentences: sentences.map((s) => ({
          text: s.text.trim(),
          correct_answer: s.correct_answer.trim(),
          max_words: s.max_words,
        })),
      },
    });
  };

  return (
    <EditorShell
      title="Hoàn thành câu chuyện"
      badge="Reading & Writing · Story Completion"
      instruction="Học sinh đọc câu chuyện (Flyers Part 5: truyện dài, không kèm tranh) rồi tự viết 1-5 từ vào chỗ trống của mỗi câu tóm tắt. Dùng ___ để đánh dấu chỗ trống."
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
            placeholder="VD: Đọc và hoàn thành câu"
          />
        </div>

        <div>
          <FieldLabel required hint={`${countWords(storyText)} từ`}>Câu chuyện</FieldLabel>
          <TextArea
            value={storyText}
            onChange={(e) => setStoryText(e.target.value)}
            rows={6}
            placeholder="VD: Tom went to the park yesterday. He saw his friend Mary there..."
          />
        </div>

        <div>
          <FieldLabel hint={`${sentences.length} câu`}>Câu cần hoàn thành</FieldLabel>
          <div className="space-y-2">
            {sentences.map((sentence, index) => (
              <div key={sentence.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Câu {index + 1}
                  </span>
                  {sentences.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSentence(sentence.id)}
                      className="rounded-md p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                      aria-label="Xóa"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  <TextField
                    value={sentence.text}
                    onChange={(e) => updateSentence(sentence.id, 'text', e.target.value)}
                    placeholder="Câu có chỗ trống (VD: Tom played with his ___)"
                  />
                  <div className="flex items-center gap-2">
                    <TextField
                      value={sentence.correct_answer}
                      onChange={(e) => updateSentence(sentence.id, 'correct_answer', e.target.value)}
                      placeholder="Đáp án (VD: friends)"
                    />
                    <label className="flex flex-shrink-0 items-center gap-1.5 text-xs font-medium text-slate-600">
                      Tối đa
                      <select
                        value={sentence.max_words}
                        onChange={(e) =>
                          updateSentence(sentence.id, 'max_words', parseInt(e.target.value))
                        }
                        className="rounded-md border border-slate-200 px-2 py-1 text-sm focus:border-orange-400 focus:outline-none"
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {n} từ
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <p
                    className={`text-xs ${
                      countWords(sentence.correct_answer) > sentence.max_words
                        ? 'text-red-500'
                        : 'text-slate-400'
                    }`}
                  >
                    {countWords(sentence.correct_answer)} / {sentence.max_words} từ
                  </p>
                </div>
              </div>
            ))}
            <AddItemButton onClick={addSentence} label="Thêm câu" />
          </div>
        </div>
      </div>
    </EditorShell>
  );
};

export default StoryCompletionEditor;
