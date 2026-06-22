import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { teacherApi } from '@/services/teacherApi';

interface Answer {
  aContent: string;
  aIs_correct: boolean;
}

interface Question {
  qContent: string;
  qPoints: number;
  qType: string;
  qDifficulty: string;
  answers: Answer[];
}

interface ExamForm {
  eTitle: string;
  eType: string;
  eSkill: string;
  eDuration_minutes: number;
  eDifficulty: string;
  eDescription: string;
  questions: Question[];
}

// ─── Hướng dẫn từng dạng câu hỏi (hiện trên UI để giáo viên dễ tạo) ──────────────
type QuestionTypeKey = 'multiple_choice' | 'true_false' | 'fill_blank' | 'short_answer' | 'essay';

interface TypeGuide {
  label: string;
  short: string;       // mô tả ngắn cho dropdown / tiêu đề
  note: string;        // hướng dẫn chi tiết
  example: string;     // ví dụ mẫu
  graded: 'auto' | 'manual';
}

const QUESTION_TYPE_GUIDE: Record<QuestionTypeKey, TypeGuide> = {
  multiple_choice: {
    label: 'Trắc nghiệm',
    short: 'Chọn 1 (hoặc nhiều) đáp án đúng',
    note: 'Nhập nội dung câu hỏi, thêm 2–4 đáp án rồi TÍCH vào ô vuông ở (các) đáp án đúng. Có thể tích nhiều ô nếu câu có nhiều đáp án đúng.',
    example: 'Câu: "She ___ to school every day."  →  A. go  ✓B. goes  C. going  D. gone',
    graded: 'auto',
  },
  true_false: {
    label: 'Đúng / Sai',
    short: 'Nhận định đúng hay sai',
    note: 'Câu hỏi là một nhận định. Hệ thống tự tạo sẵn 2 lựa chọn True / False — bạn chỉ cần tích chọn đáp án đúng.',
    example: 'Câu: "He don\'t like coffee." (đúng ngữ pháp?)  →  chọn False',
    graded: 'auto',
  },
  fill_blank: {
    label: 'Điền từ',
    short: 'Học viên gõ từ vào chỗ trống',
    note: 'Dùng dấu ___ (gạch dưới) trong câu hỏi để chỉ chỗ cần điền. Nhập 1 đáp án đúng. Nếu chấp nhận nhiều biến thể, ngăn cách bằng dấu "/". Hệ thống không phân biệt hoa/thường.',
    example: 'Câu: "I have been waiting ___ two hours."  →  Đáp án: for\nBiến thể: "colour/color"',
    graded: 'auto',
  },
  short_answer: {
    label: 'Trả lời ngắn',
    short: 'Học viên gõ câu trả lời ngắn',
    note: 'Học viên tự gõ câu trả lời. Nhập đáp án đúng; nhiều biến thể ngăn cách bằng "/". Không phân biệt hoa/thường, tự bỏ khoảng trắng thừa.',
    example: 'Câu: "Past tense of \'go\'?"  →  Đáp án: went',
    graded: 'auto',
  },
  essay: {
    label: 'Tự luận / Viết đoạn',
    short: 'Học viên viết đoạn văn — giáo viên chấm tay',
    note: 'Học viên viết đoạn văn trả lời. KHÔNG cần nhập đáp án — bài sẽ vào hàng chờ để giáo viên chấm tay sau khi học viên nộp.',
    example: 'Câu: "Write 2–3 sentences about your favourite hobby."',
    graded: 'manual',
  },
};

const TYPE_ORDER: QuestionTypeKey[] = ['multiple_choice', 'true_false', 'fill_blank', 'short_answer', 'essay'];

function emptyAnswersFor(type: QuestionTypeKey): Answer[] {
  switch (type) {
    case 'true_false':
      return [
        { aContent: 'True', aIs_correct: false },
        { aContent: 'False', aIs_correct: false },
      ];
    case 'fill_blank':
    case 'short_answer':
      return [{ aContent: '', aIs_correct: true }];
    case 'essay':
      return [];
    case 'multiple_choice':
    default:
      return [
        { aContent: '', aIs_correct: false },
        { aContent: '', aIs_correct: false },
        { aContent: '', aIs_correct: false },
        { aContent: '', aIs_correct: false },
      ];
  }
}

export const CreateExamManual: React.FC = () => {
  const navigate = useNavigate();

  const [exam, setExam] = useState<ExamForm>({
    eTitle: '',
    eType: 'GENERAL',
    eSkill: 'reading',
    eDuration_minutes: 60,
    eDifficulty: 'medium',
    eDescription: '',
    questions: [],
  });

  const [currentQuestion, setCurrentQuestion] = useState<Question>({
    qContent: '',
    qPoints: 1,
    qType: 'multiple_choice',
    qDifficulty: 'medium',
    answers: emptyAnswersFor('multiple_choice'),
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeType = (currentQuestion.qType as QuestionTypeKey) || 'multiple_choice';
  const guide = QUESTION_TYPE_GUIDE[activeType] ?? QUESTION_TYPE_GUIDE.multiple_choice;

  // Đổi dạng câu hỏi → reset cấu trúc đáp án cho phù hợp.
  const handleTypeChange = (newType: string) => {
    setCurrentQuestion({
      ...currentQuestion,
      qType: newType,
      answers: emptyAnswersFor(newType as QuestionTypeKey),
    });
    setError(null);
  };

  const resetCurrentQuestion = () => {
    setCurrentQuestion({
      qContent: '',
      qPoints: 1,
      qType: 'multiple_choice',
      qDifficulty: 'medium',
      answers: emptyAnswersFor('multiple_choice'),
    });
  };

  const handleAddQuestion = () => {
    if (!currentQuestion.qContent.trim()) {
      setError('Vui lòng nhập nội dung câu hỏi');
      return;
    }

    // Validation theo từng dạng
    if (activeType === 'essay') {
      // Tự luận: không cần đáp án
      setExam({ ...exam, questions: [...exam.questions, { ...currentQuestion, answers: [] }] });
      resetCurrentQuestion();
      setError(null);
      return;
    }

    if (activeType === 'fill_blank' || activeType === 'short_answer') {
      const correct = currentQuestion.answers[0]?.aContent?.trim();
      if (!correct) {
        setError('Vui lòng nhập đáp án đúng');
        return;
      }
      setExam({
        ...exam,
        questions: [...exam.questions, { ...currentQuestion, answers: [{ aContent: correct, aIs_correct: true }] }],
      });
      resetCurrentQuestion();
      setError(null);
      return;
    }

    // multiple_choice / true_false
    const hasCorrectAnswer = currentQuestion.answers.some((a) => a.aIs_correct && a.aContent.trim());
    if (!hasCorrectAnswer) {
      setError('Vui lòng chọn ít nhất 1 đáp án đúng');
      return;
    }

    const validAnswers = currentQuestion.answers.filter((a) => a.aContent.trim());
    if (validAnswers.length < 2) {
      setError('Cần ít nhất 2 đáp án');
      return;
    }

    setExam({
      ...exam,
      questions: [...exam.questions, { ...currentQuestion, answers: validAnswers }],
    });
    resetCurrentQuestion();
    setError(null);
  };

  const handleRemoveQuestion = (index: number) => {
    setExam({
      ...exam,
      questions: exam.questions.filter((_, i) => i !== index),
    });
  };

  const handleAddOption = () => {
    setCurrentQuestion({
      ...currentQuestion,
      answers: [...currentQuestion.answers, { aContent: '', aIs_correct: false }],
    });
  };

  const handleRemoveOption = (idx: number) => {
    if (currentQuestion.answers.length <= 2) return;
    setCurrentQuestion({
      ...currentQuestion,
      answers: currentQuestion.answers.filter((_, i) => i !== idx),
    });
  };

  const handleSubmit = async () => {
    if (!exam.eTitle.trim()) {
      setError('Vui lòng nhập tên đề thi');
      return;
    }

    if (exam.questions.length === 0) {
      setError('Vui lòng thêm ít nhất 1 câu hỏi');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await teacherApi.exams.importExam(exam);
      navigate(`/giao-vien/de-thi/${response.data.examId}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Lỗi khi tạo đề thi');
    } finally {
      setLoading(false);
    }
  };

  const totalPoints = exam.questions.reduce((sum, q) => sum + q.qPoints, 0);

  return (
    <div className="px-4">
      <div className="bg-white rounded-lg border-2 border-gray-200 p-8">
        <h1 className="text-2xl font-semibold mb-6 text-[#1E293B]">Tạo đề thi thủ công</h1>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Exam Info */}
        <div className="mb-8 p-4 bg-gray-50 rounded-lg">
          <h2 className="text-lg font-semibold mb-1">Thông Tin Đề Thi</h2>
          <div className="mb-4 p-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-600 leading-relaxed">
            <span className="font-semibold text-slate-700">💡 Hướng dẫn: </span>
            Đặt <b>tên đề</b> rõ ràng để học viên dễ nhận biết (VD: "Ngữ pháp — Thì hiện tại đơn").
            Chọn <b>Loại đề</b> và <b>Kỹ năng</b> phù hợp; <b>Thời gian</b> tính bằng phút,
            <b> Tổng điểm</b> tự cộng theo số câu bạn thêm bên dưới.
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Tên đề thi *</label>
              <input
                type="text"
                value={exam.eTitle}
                onChange={(e) => setExam({ ...exam, eTitle: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="VD: Đề thi VSTEP Reading 2024"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Loại đề</label>
              <select
                value={exam.eType}
                onChange={(e) => setExam({ ...exam, eType: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="GENERAL">General</option>
                <option value="VSTEP">VSTEP</option>
                <option value="IELTS">IELTS</option>
                <option value="TOEIC">TOEIC</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Kỹ năng</label>
              <select
                value={exam.eSkill}
                onChange={(e) => setExam({ ...exam, eSkill: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="reading">Reading</option>
                <option value="listening">Listening</option>
                <option value="writing">Writing</option>
                <option value="speaking">Speaking</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Thời gian (phút)</label>
              <input
                type="number"
                value={exam.eDuration_minutes}
                onChange={(e) => setExam({ ...exam, eDuration_minutes: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg"
                min="1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Độ khó</label>
              <select
                value={exam.eDifficulty}
                onChange={(e) => setExam({ ...exam, eDifficulty: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="easy">Dễ</option>
                <option value="medium">Trung bình</option>
                <option value="hard">Khó</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Tổng điểm</label>
              <input
                type="text"
                value={totalPoints}
                disabled
                className="w-full px-3 py-2 border rounded-lg bg-gray-100"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium mb-1">Mô tả</label>
            <textarea
              value={exam.eDescription}
              onChange={(e) => setExam({ ...exam, eDescription: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              rows={2}
              placeholder="Mô tả ngắn về đề thi..."
            />
          </div>
        </div>

        {/* Add Question Form */}
        <div className="mb-8 p-4 border-2 border-orange-200 rounded-lg">
          <h2 className="text-lg font-semibold mb-1">Thêm Câu Hỏi Mới</h2>
          <div className="mb-4 p-3 rounded-lg border border-orange-200 bg-orange-50 text-sm text-orange-800 leading-relaxed">
            <span className="font-semibold">💡 Hướng dẫn: </span>
            Nhập <b>nội dung câu hỏi</b>, đặt <b>điểm</b>, chọn <b>loại câu hỏi</b> rồi nhập đáp án theo
            hướng dẫn của từng loại (xem hộp xanh bên dưới). Bấm <b>"Thêm Câu Hỏi"</b> để đưa vào danh sách;
            lặp lại cho các câu tiếp theo. Bạn có thể trộn nhiều loại câu trong cùng một đề.
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Nội dung câu hỏi *</label>
            <textarea
              value={currentQuestion.qContent}
              onChange={(e) => setCurrentQuestion({ ...currentQuestion, qContent: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
              placeholder={
                activeType === 'fill_blank'
                  ? 'Nhập câu hỏi, dùng ___ cho chỗ trống. VD: I have been waiting ___ two hours.'
                  : 'Nhập nội dung câu hỏi...'
              }
            />
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Điểm</label>
              <input
                type="number"
                value={currentQuestion.qPoints}
                onChange={(e) => setCurrentQuestion({ ...currentQuestion, qPoints: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg"
                min="0.5"
                step="0.5"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Loại câu hỏi</label>
              <select
                value={currentQuestion.qType}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                {TYPE_ORDER.map((t) => (
                  <option key={t} value={t}>
                    {QUESTION_TYPE_GUIDE[t].label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Độ khó</label>
              <select
                value={currentQuestion.qDifficulty}
                onChange={(e) => setCurrentQuestion({ ...currentQuestion, qDifficulty: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="easy">Dễ</option>
                <option value="medium">Trung bình</option>
                <option value="hard">Khó</option>
              </select>
            </div>
          </div>

          {/* ── Note hướng dẫn theo dạng câu hỏi đang chọn ─────────────────────── */}
          <div className="mb-4 p-4 rounded-lg border border-blue-200 bg-blue-50">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-blue-600">💡</span>
              <span className="text-sm font-semibold text-blue-800">
                Hướng dẫn: {guide.label}
              </span>
              <span
                className={`ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  guide.graded === 'auto'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {guide.graded === 'auto' ? 'Chấm tự động' : 'Giáo viên chấm tay'}
              </span>
            </div>
            <p className="text-sm text-blue-900 leading-relaxed">{guide.note}</p>
            <p className="mt-2 text-xs text-blue-700 whitespace-pre-line">
              <span className="font-semibold">Ví dụ: </span>
              {guide.example}
            </p>
          </div>

          {/* ── Phần đáp án — đổi UI theo từng dạng ────────────────────────────── */}
          {activeType === 'essay' ? (
            <div className="mb-4 p-3 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-600">
              Dạng tự luận không cần nhập đáp án. Bài làm của học viên sẽ vào hàng chờ để bạn chấm tay.
            </div>
          ) : activeType === 'fill_blank' || activeType === 'short_answer' ? (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Đáp án đúng *</label>
              <input
                type="text"
                value={currentQuestion.answers[0]?.aContent ?? ''}
                onChange={(e) =>
                  setCurrentQuestion({
                    ...currentQuestion,
                    answers: [{ aContent: e.target.value, aIs_correct: true }],
                  })
                }
                className="w-full px-3 py-2 border rounded-lg"
                placeholder='VD: for   (nhiều biến thể: "colour/color")'
              />
              <p className="text-xs text-gray-500 mt-1">
                Ngăn cách các biến thể chấp nhận bằng dấu "/". Không phân biệt hoa/thường.
              </p>
            </div>
          ) : activeType === 'true_false' ? (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Chọn đáp án đúng *</label>
              <div className="flex gap-3">
                {currentQuestion.answers.map((answer, idx) => (
                  <label
                    key={idx}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 cursor-pointer transition-colors ${
                      answer.aIs_correct
                        ? 'border-green-500 bg-green-50 text-green-700 font-semibold'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="tf-correct"
                      checked={answer.aIs_correct}
                      onChange={() => {
                        const newAnswers = currentQuestion.answers.map((a, i) => ({
                          ...a,
                          aIs_correct: i === idx,
                        }));
                        setCurrentQuestion({ ...currentQuestion, answers: newAnswers });
                      }}
                    />
                    {answer.aContent}
                  </label>
                ))}
              </div>
            </div>
          ) : (
            // multiple_choice
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Đáp án *</label>
              {currentQuestion.answers.map((answer, idx) => (
                <div key={idx} className="flex gap-2 mb-2 items-center">
                  <input
                    type="checkbox"
                    checked={answer.aIs_correct}
                    onChange={(e) => {
                      const newAnswers = [...currentQuestion.answers];
                      newAnswers[idx].aIs_correct = e.target.checked;
                      setCurrentQuestion({ ...currentQuestion, answers: newAnswers });
                    }}
                  />
                  <input
                    type="text"
                    value={answer.aContent}
                    onChange={(e) => {
                      const newAnswers = [...currentQuestion.answers];
                      newAnswers[idx].aContent = e.target.value;
                      setCurrentQuestion({ ...currentQuestion, answers: newAnswers });
                    }}
                    className="flex-1 px-3 py-2 border rounded-lg"
                    placeholder={`Đáp án ${String.fromCharCode(65 + idx)}`}
                  />
                  {currentQuestion.answers.length > 2 && (
                    <button
                      onClick={() => handleRemoveOption(idx)}
                      className="text-gray-400 hover:text-red-500 px-2"
                      title="Xóa đáp án này"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-gray-500">✓ = Đáp án đúng (có thể chọn nhiều)</p>
                <button
                  onClick={handleAddOption}
                  className="text-xs font-semibold text-orange-600 hover:text-orange-700"
                >
                  + Thêm đáp án
                </button>
              </div>
            </div>
          )}

          <button
            onClick={handleAddQuestion}
            className="w-full bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700"
          >
            ➕ Thêm Câu Hỏi
          </button>
        </div>

        {/* Questions List */}
        {exam.questions.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-1">
              Danh Sách Câu Hỏi ({exam.questions.length} câu - {totalPoints} điểm)
            </h2>
            <div className="mb-4 p-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-600 leading-relaxed">
              <span className="font-semibold text-slate-700">💡 Hướng dẫn: </span>
              Kiểm tra lại các câu đã thêm. Đáp án đúng được đánh dấu <span className="text-green-700 font-medium">✓</span>;
              câu tự luận ghi rõ "giáo viên chấm tay". Bấm <b>🗑️ Xóa</b> nếu cần bỏ một câu.
              Khi đã đủ câu, bấm <b>"Tạo Đề Thi"</b> ở dưới để lưu.
            </div>

            <div className="space-y-3">
              {exam.questions.map((q, idx) => {
                const qLabel = QUESTION_TYPE_GUIDE[(q.qType as QuestionTypeKey)]?.label ?? q.qType;
                return (
                  <div key={idx} className="p-4 border rounded-lg bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="font-medium">Câu {idx + 1}: {q.qContent}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          {qLabel} | Điểm: {q.qPoints} | Độ khó: {q.qDifficulty}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveQuestion(idx)}
                        className="text-red-600 hover:text-red-800 ml-4"
                      >
                        🗑️ Xóa
                      </button>
                    </div>

                    {q.answers.length > 0 ? (
                      <div className="mt-2 space-y-1">
                        {q.answers.map((a, aidx) => (
                          <div
                            key={aidx}
                            className={`text-sm ${a.aIs_correct ? 'text-green-700 font-medium' : 'text-gray-700'}`}
                          >
                            {a.aIs_correct ? '✓' : '○'} {String.fromCharCode(65 + aidx)}. {a.aContent}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm italic text-amber-600">Tự luận — giáo viên chấm tay</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-4">
          <button
            onClick={handleSubmit}
            disabled={loading || exam.questions.length === 0}
            className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Đang tạo...' : `✓ Tạo Đề Thi (${exam.questions.length} câu)`}
          </button>

          <button
            onClick={() => navigate('/giao-vien/de-thi')}
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Hủy
          </button>
        </div>
      </div>
    </div>
  );
};
