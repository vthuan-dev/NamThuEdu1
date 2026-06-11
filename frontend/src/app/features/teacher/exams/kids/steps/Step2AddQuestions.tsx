import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronRight, MousePointerClick } from 'lucide-react';
import { CAMBRIDGE_PARTS_STRUCTURE } from '../constants/cambridgeStructure';
import ListenDrawLinesEditor from '../editors/ListenDrawLinesEditor';
import ListenWriteEditor from '../editors/ListenWriteEditor';
import ListenTickEditor from '../editors/ListenTickEditor';
import ListenColourEditor from '../editors/ListenColourEditor';
import LookReadEditor from '../editors/LookReadEditor';
import LookReadWriteEditor from '../editors/LookReadWriteEditor';
import UnscrambleWordsEditor from '../editors/UnscrambleWordsEditor';
import ClozeTestEditor from '../editors/ClozeTestEditor';
import DialogueMatchingEditor from '../editors/DialogueMatchingEditor';
import StoryCompletionEditor from '../editors/StoryCompletionEditor';
import OpenClozeEditor from '../editors/OpenClozeEditor';
import PictureSentenceWritingEditor from '../editors/PictureSentenceWritingEditor';
import PictureStoryWritingEditor from '../editors/PictureStoryWritingEditor';
import WordDefinitionMatchingEditor from '../editors/WordDefinitionMatchingEditor';
import ReadingComprehensionEditor from '../editors/ReadingComprehensionEditor';
import WordBankFillEditor from '../editors/WordBankFillEditor';
import FindDifferencesEditor from '../editors/FindDifferencesEditor';
import PictureStoryNarrationEditor from '../editors/PictureStoryNarrationEditor';
import OddOneOutEditor from '../editors/OddOneOutEditor';
import InformationExchangeEditor from '../editors/InformationExchangeEditor';
import ObjectPlacementEditor from '../editors/ObjectPlacementEditor';
import PictureQuestionsEditor from '../editors/PictureQuestionsEditor';
import PictureCardQuestionsEditor from '../editors/PictureCardQuestionsEditor';
import ListeningLetterMatchEditor from '../editors/ListeningLetterMatchEditor';
import TaskTypeSelectorModal from '../components/TaskTypeSelectorModal';
import { addKidsQuestion, updateKidsQuestion } from '../../../../../../services/kidsExamApi';

interface Step2AddQuestionsProps {
  examData: any;
  setExamData: (data: any) => void;
  onNext: () => void;
  onBack: () => void;
  examId: string | null;
}

// Map mỗi taskType → component editor tương ứng (đủ 24 dạng bài)
const EDITOR_MAP: Record<string, React.ComponentType<any>> = {
  listen_and_draw_lines: ListenDrawLinesEditor,
  listen_and_write: ListenWriteEditor,
  listen_and_tick: ListenTickEditor,
  listen_colour: ListenColourEditor,
  listen_colour_write: ListenColourEditor,
  look_and_read: LookReadEditor,
  look_read_write: LookReadWriteEditor,
  unscramble_words: UnscrambleWordsEditor,
  cloze_test: ClozeTestEditor,
  dialogue_matching: DialogueMatchingEditor,
  story_completion: StoryCompletionEditor,
  open_cloze: OpenClozeEditor,
  picture_sentence_writing: PictureSentenceWritingEditor,
  picture_story_writing: PictureStoryWritingEditor,
  word_definition_matching: WordDefinitionMatchingEditor,
  reading_comprehension: ReadingComprehensionEditor,
  word_bank_fill: WordBankFillEditor,
  find_differences: FindDifferencesEditor,
  picture_story_narration: PictureStoryNarrationEditor,
  odd_one_out: OddOneOutEditor,
  information_exchange: InformationExchangeEditor,
  object_placement: ObjectPlacementEditor,
  picture_questions: PictureQuestionsEditor,
  picture_card_questions: PictureCardQuestionsEditor,
  listening_letter_match: ListeningLetterMatchEditor,
};

// Nhãn ngắn cho từng phần (breadcrumb + badge)
const PART_LABELS: Record<number, { icon: string; label: string }> = {
  1: { icon: '🎧', label: 'Nghe' },
  2: { icon: '📖', label: 'Đọc & Viết' },
  3: { icon: '🗣️', label: 'Nói' },
};

const Step2AddQuestions: React.FC<Step2AddQuestionsProps> = ({
  examData,
  setExamData,
  onNext,
  onBack,
  examId,
}) => {
  const [selectedTaskType, setSelectedTaskType] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showTaskTypeSelector, setShowTaskTypeSelector] = useState(false);
  const [selectedPart, setSelectedPart] = useState<number | null>(null);
  const [selectedSubPart, setSelectedSubPart] = useState<number | null>(null);
  const [expandedParts, setExpandedParts] = useState<number[]>([]);

  // 3 phần cố định (dùng khi không có blueprint Cambridge)
  const EXAM_PARTS = [
    { id: 1, name: 'NGHE', icon: '🎧', skill: 'listening' },
    { id: 2, name: 'ĐỌC VÀ VIẾT', icon: '📖', skill: 'reading_writing' },
    { id: 3, name: 'NÓI', icon: '🗣️', skill: 'speaking' },
  ];

  // Lấy cấu trúc Cambridge theo cấp độ đang chọn
  const getCambridgeStructure = () => {
    const examType = examData.examType?.toLowerCase();
    if (!examType || !CAMBRIDGE_PARTS_STRUCTURE[examType as keyof typeof CAMBRIDGE_PARTS_STRUCTURE]) {
      return null;
    }
    return CAMBRIDGE_PARTS_STRUCTURE[examType as keyof typeof CAMBRIDGE_PARTS_STRUCTURE];
  };

  const cambridgeStructure = getCambridgeStructure();
  const hasCambridgeStructure = !!cambridgeStructure;
  const showSubParts = hasCambridgeStructure;

  // ── Phạm vi đề (scope): full | skill | part ──────────────────────────
  const scope: 'full' | 'skill' | 'part' = examData.scope || 'full';
  const scopeSkill: string | null = examData.scopeSkill ?? null;
  const scopePart: number | null = examData.scopePart ?? null;

  // Các section gốc theo cấu trúc Cambridge
  const baseSections = cambridgeStructure
    ? [
        { partId: 1, skill: 'listening', label: 'Nghe', data: cambridgeStructure.listening },
        { partId: 2, skill: 'reading_writing', label: 'Đọc & Viết', data: cambridgeStructure.reading_writing },
        { partId: 3, skill: 'speaking', label: 'Nói', data: cambridgeStructure.speaking },
      ]
    : [];

  // Lọc theo phạm vi đã chọn
  const scopedSections = baseSections
    .filter((s) => (scope === 'full' ? true : s.skill === scopeSkill))
    .map((s) => {
      if (scope === 'part' && scopePart != null) {
        return { ...s, data: { ...s.data, parts: s.data.parts.filter((p: any) => p.partNumber === scopePart) } };
      }
      return s;
    });

  // Tiến độ: số sub-part đã có câu hỏi / tổng sub-part TRONG PHẠM VI
  const allSubParts = scopedSections.flatMap((s) =>
    s.data.parts.map((p: any) => ({ part: s.partId, sub: p.partNumber }))
  );
  const totalSubParts = allSubParts.length;
  const filledSubParts = allSubParts.filter((sp) =>
    examData.questions.some((q: any) => q.part === sp.part && q.subPart === sp.sub)
  ).length;
  const progressPct = totalSubParts > 0 ? Math.round((filledSubParts / totalSubParts) * 100) : 0;

  // Mở sẵn các phần trong phạm vi khi có blueprint
  React.useEffect(() => {
    if (showSubParts) {
      setExpandedParts(scopedSections.map((s) => s.partId));
    }
  }, [showSubParts, scope, scopeSkill, scopePart]);

  const togglePart = (partId: number) => {
    setExpandedParts((prev) =>
      prev.includes(partId) ? prev.filter((id) => id !== partId) : [...prev, partId]
    );
  };

  const handleCambridgeSubPartClick = (partId: number, subPart: any) => {
    setSelectedPart(partId);
    setSelectedSubPart(subPart.partNumber);

    const existingQuestion = examData.questions.find(
      (q: any) => q.part === partId && q.subPart === subPart.partNumber
    );

    if (existingQuestion) {
      // Đã có câu hỏi → mở editor trực tiếp
      setSelectedTaskType(existingQuestion.type);
      setShowTaskTypeSelector(false);
      setShowEditor(true);
    } else if (subPart.taskType) {
      // Sub-part trống nhưng có blueprint → vào thẳng editor chuẩn
      setSelectedTaskType(subPart.taskType);
      setShowTaskTypeSelector(false);
      setShowEditor(true);
    } else {
      // Không có blueprint → hiện bảng chọn dạng
      setShowEditor(false);
      setShowTaskTypeSelector(true);
    }
  };

  const getSkillByPart = (partId: number): string | string[] => {
    if (partId === 1) return 'listening';
    if (partId === 2) return ['reading', 'writing'];
    if (partId === 3) return 'speaking';
    return '';
  };

  const getSubPartQuestionCount = (partId: number, subPartNumber: number) =>
    examData.questions.filter(
      (q: any) => q.part === partId && q.subPart === subPartNumber
    ).length;

  const handlePartClick = (partId: number) => {
    setSelectedPart(partId);
    setSelectedSubPart(null);

    const partQuestions = examData.questions.filter((q: any) => q.part === partId);

    if (partQuestions.length > 0) {
      setSelectedTaskType(partQuestions[0].type);
      setShowTaskTypeSelector(false);
      setShowEditor(true);
    } else {
      setShowEditor(false);
      setShowTaskTypeSelector(true);
    }
  };

  const handleTaskTypeSelected = (taskType: any) => {
    setSelectedTaskType(taskType.code);
    setShowTaskTypeSelector(false);
    setShowEditor(true);
  };

  // Tìm câu hỏi khớp với task type / part / subPart đang chọn
  const getCurrentQuestion = () => {
    if (!selectedTaskType) return null;

    return examData.questions.find((q: any) => {
      const typeMatch = q.type === selectedTaskType;
      const partMatch = q.part === selectedPart;
      if (hasCambridgeStructure && selectedSubPart !== null) {
        return typeMatch && partMatch && q.subPart === selectedSubPart;
      }
      return typeMatch && partMatch;
    });
  };

  const handleSaveQuestion = async (questionData: any) => {
    if (!examId) {
      alert('Vui lòng tạo đề thi trước khi thêm câu hỏi!');
      return;
    }

    try {
      const questionWithPart = {
        ...questionData,
        part: selectedPart,
        subPart: selectedSubPart,
      };

      const apiQuestionData = {
        task_type_code: questionWithPart.type,
        task_data: questionWithPart.config || {},
        qContent: questionWithPart.title || '',
        qPoints: questionWithPart.points || 5,
        part: selectedPart,
        subPart: selectedSubPart,
      };

      if (!apiQuestionData.task_data || Object.keys(apiQuestionData.task_data).length === 0) {
        alert('Vui lòng nhập đầy đủ thông tin câu hỏi!');
        return;
      }

      const existingQuestionIndex = examData.questions.findIndex((q: any) => {
        if (hasCambridgeStructure && selectedSubPart !== null) {
          return (
            q.type === questionWithPart.type &&
            q.part === selectedPart &&
            q.subPart === selectedSubPart
          );
        }
        return q.type === questionWithPart.type && q.part === selectedPart;
      });

      if (existingQuestionIndex !== -1) {
        const existingQuestion = examData.questions[existingQuestionIndex];

        if (existingQuestion.qId) {
          await updateKidsQuestion(parseInt(examId), existingQuestion.qId, apiQuestionData);
        }

        const updatedQuestions = [...examData.questions];
        updatedQuestions[existingQuestionIndex] = {
          ...existingQuestion,
          ...questionWithPart,
        };
        setExamData({ ...examData, questions: updatedQuestions });
      } else {
        const response = await addKidsQuestion(parseInt(examId), apiQuestionData);
        const newQuestion = {
          ...questionWithPart,
          qId: response.question?.qId,
          id: `q-${Date.now()}`,
        };
        setExamData({
          ...examData,
          questions: [...examData.questions, newQuestion],
        });
      }

      setShowEditor(false);
    } catch (error: any) {
      console.error('Failed to save question:', error);
      alert('Không thể lưu câu hỏi. Vui lòng thử lại!');
    }
  };

  const handleCancelEditor = () => {
    setShowEditor(false);
  };

  // Component editor tương ứng với dạng bài đang chọn
  const ActiveEditor = selectedTaskType ? EDITOR_MAP[selectedTaskType] : null;

  return (
    <div className="flex h-full w-full overflow-hidden bg-white">
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className="flex h-full w-64 flex-shrink-0 flex-col border-r border-slate-200 bg-slate-50/60">
        {/* Header tiến độ */}
        <div className="border-b border-slate-200 px-4 py-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Cấu trúc đề
            </span>
            {showSubParts && (
              <span className="text-xs font-bold text-orange-600">
                {filledSubParts}/{totalSubParts}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm font-semibold text-slate-800">
            {showSubParts
              ? `${examData.examType?.toUpperCase() || 'Cambridge'} · ${
                  scope === 'full'
                    ? '3 kỹ năng'
                    : scope === 'skill'
                    ? scopedSections[0]?.label || '1 kỹ năng'
                    : `${scopedSections[0]?.label || ''} · Part ${scopePart}`
                }`
              : '3 phần cố định'}
          </p>
          {showSubParts && (
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-orange-500 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}
        </div>

        {/* Danh sách part */}
        <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
          {/* Chế độ linh hoạt (không sub-part) */}
          {!showSubParts &&
            EXAM_PARTS.map((part) => {
              const partQuestions = examData.questions.filter((q: any) => q.part === part.id);
              const hasQuestions = partQuestions.length > 0;
              const isActive = selectedPart === part.id && showEditor;
              return (
                <button
                  key={part.id}
                  onClick={() => handlePartClick(part.id)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all ${
                    isActive
                      ? 'border-orange-300 bg-orange-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <span className="text-lg">{part.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-800">Phần {part.id}</div>
                    <div className="truncate text-[11px] font-medium text-slate-500">
                      {part.name}
                    </div>
                  </div>
                  {hasQuestions && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500">
                      <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}

          {/* Chế độ Cambridge (có sub-part) */}
          {showSubParts &&
            scopedSections.map((section) => {
              const expanded = expandedParts.includes(section.partId);
              const doneCount = section.data.parts.filter(
                (p: any) => getSubPartQuestionCount(section.partId, p.partNumber) > 0
              ).length;
              return (
                <div key={section.partId}>
                  <button
                    onClick={() => togglePart(section.partId)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-slate-100"
                  >
                    <ChevronRight
                      className={`h-3.5 w-3.5 flex-shrink-0 text-slate-400 transition-transform ${
                        expanded ? 'rotate-90' : ''
                      }`}
                    />
                    <span className="text-base">{section.data.icon}</span>
                    <span className="flex-1 text-xs font-bold text-slate-700">
                      {section.label}
                    </span>
                    <span
                      className={`text-[10px] font-bold ${
                        doneCount === section.data.parts.length
                          ? 'text-emerald-600'
                          : 'text-slate-400'
                      }`}
                    >
                      {doneCount}/{section.data.parts.length}
                    </span>
                  </button>

                  {expanded && (
                    <div className="mb-1 ml-3 space-y-0.5 border-l border-slate-200 pl-2 pt-0.5">
                      {section.data.parts.map((subPart: any) => {
                        const done =
                          getSubPartQuestionCount(section.partId, subPart.partNumber) > 0;
                        const isSelected =
                          selectedPart === section.partId &&
                          selectedSubPart === subPart.partNumber;
                        return (
                          <button
                            key={subPart.partNumber}
                            onClick={() => handleCambridgeSubPartClick(section.partId, subPart)}
                            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
                              isSelected
                                ? 'bg-orange-50 ring-1 ring-orange-200'
                                : 'hover:bg-slate-100'
                            }`}
                          >
                            <span
                              className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full transition-colors ${
                                done
                                  ? 'bg-emerald-500'
                                  : isSelected
                                  ? 'bg-orange-500'
                                  : 'border border-slate-300 bg-white'
                              }`}
                            >
                              {done && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div
                                className={`text-[11px] font-semibold ${
                                  isSelected ? 'text-orange-700' : 'text-slate-700'
                                }`}
                              >
                                {subPart.name}
                              </div>
                              <div className="truncate text-[10px] font-medium text-slate-400">
                                {subPart.description}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </aside>

      {/* ── Workspace ────────────────────────────────────────────────────── */}
      <div className="flex h-full flex-1 flex-col overflow-hidden bg-white">
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {/* Breadcrumb ngữ cảnh (chỉ hiện khi đang soạn) */}
          {showEditor && selectedPart && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <span className="font-semibold text-slate-700">
                  {PART_LABELS[selectedPart]?.icon} {PART_LABELS[selectedPart]?.label}
                </span>
                {selectedSubPart && (
                  <>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
                    <span>Part {selectedSubPart}</span>
                  </>
                )}
              </div>
              {showSubParts && selectedSubPart && (
                <button
                  onClick={() => setShowTaskTypeSelector(true)}
                  className="text-xs font-semibold text-orange-600 transition-colors hover:text-orange-700"
                >
                  Đổi dạng bài
                </button>
              )}
            </div>
          )}

          {/* Bảng chọn dạng bài */}
          {showTaskTypeSelector && selectedPart && (
            <TaskTypeSelectorModal
              isOpen={showTaskTypeSelector}
              onClose={() => setShowTaskTypeSelector(false)}
              onSelect={handleTaskTypeSelected}
              filterBySkill={getSkillByPart(selectedPart)}
            />
          )}

          {/* Trạng thái trống */}
          {!showEditor && !showTaskTypeSelector && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-orange-50 ring-1 ring-orange-100">
                <MousePointerClick className="h-5 w-5 text-orange-500" />
              </div>
              <p className="text-sm font-semibold text-slate-700">
                Chọn một phần ở danh sách bên trái để soạn câu hỏi
              </p>
            </div>
          )}

          {/* Editor dạng bài */}
          {showEditor && selectedTaskType && (
            ActiveEditor ? (
              <ActiveEditor
                onSave={handleSaveQuestion}
                onCancel={handleCancelEditor}
                initialData={getCurrentQuestion()}
                examId={examId}
                questionId={getCurrentQuestion()?.id || null}
              />
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-8 text-center">
                <div className="mb-3 text-4xl">🚧</div>
                <h3 className="mb-1 text-sm font-bold text-slate-800">Đang hoàn thiện</h3>
                <p className="text-xs font-medium text-slate-400">
                  Dạng bài <span className="font-bold text-orange-600">{selectedTaskType}</span> chưa
                  có giao diện soạn thảo.
                </p>
                <button
                  onClick={handleCancelEditor}
                  className="mt-5 rounded-lg border border-slate-200 bg-white px-5 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Đóng lại
                </button>
              </div>
            )
          )}
        </div>

        {/* Footer điều hướng */}
        <div className="mt-auto flex justify-between border-t border-slate-200 bg-white px-6 py-3.5">
          <button
            onClick={onBack}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại</span>
          </button>
          <button
            onClick={onNext}
            disabled={examData.questions.length === 0}
            className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-xs font-bold shadow-sm transition-all ${
              examData.questions.length > 0
                ? 'bg-orange-500 text-white hover:bg-orange-600'
                : 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400 shadow-none'
            }`}
          >
            <span>Tiếp theo: Xem trước</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Step2AddQuestions;
