import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import {
  ArrowLeft,
  Save,
  Volume2,
  FileText,
  Mic,
  BookOpen,
  Info,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";
import { teacherApi } from "../../../../services/teacherApi";

// VSTEP Structure - 4 Skills, 7 Main Parts
const VSTEP_STRUCTURE = {
  listening: {
    name: "Listening",
    icon: "🎧",
    duration: 40,
    totalQuestions: 35,
    parts: [
      { part: 1, name: "Announcements", questions: 8, description: "Thông báo ngắn" },
      { part: 2, name: "Dialogues", questions: 12, description: "Hội thoại 2-3 người" },
      { part: 3, name: "Lectures", questions: 15, description: "Bài giảng học thuật" },
    ],
  },
  reading: {
    name: "Reading",
    icon: "📖",
    duration: 60,
    totalQuestions: 40,
    parts: [
      {
        part: 1,
        name: "Passage 1",
        questions: 10,
        description: "Văn bản ngắn (400-500 từ)",
        wordCount: [400, 500],
      },
      {
        part: 2,
        name: "Passage 2",
        questions: 10,
        description: "Văn bản mô tả (400-500 từ)",
        wordCount: [400, 500],
      },
      {
        part: 3,
        name: "Passage 3",
        questions: 10,
        description: "Văn bản lập luận (500-600 từ)",
        wordCount: [500, 600],
      },
      {
        part: 4,
        name: "Passage 4",
        questions: 10,
        description: "Văn bản học thuật (600-700 từ)",
        wordCount: [600, 700],
      },
    ],
  },
  writing: {
    name: "Writing",
    icon: "✍️",
    duration: 60,
    totalQuestions: 2,
    parts: [
      {
        part: 1,
        name: "Task 1",
        questions: 1,
        description: "Letter/Email (150 từ)",
        minWords: 150,
      },
      { part: 2, name: "Task 2", questions: 1, description: "Essay (250 từ)", minWords: 250 },
    ],
  },
  speaking: {
    name: "Speaking",
    icon: "🗣️",
    duration: 12,
    totalQuestions: 3,
    parts: [
      {
        part: 1,
        name: "Social Interaction",
        questions: 1,
        description: "3-6 câu hỏi quen thuộc (3 phút)",
      },
      {
        part: 2,
        name: "Solution Discussion",
        questions: 1,
        description: "Chọn giải pháp (4 phút)",
      },
      {
        part: 3,
        name: "Topic Development",
        questions: 1,
        description: "Phát triển chủ đề (5 phút)",
      },
    ],
  },
};

interface Answer {
  id: string;
  content: string;
  isCorrect: boolean;
}

interface Question {
  id: string;
  skill: string;
  part: number;
  questionNumber: number;
  content: string;
  points: number;
  answers: Answer[];
  // Listening specific
  audioUrl?: string;
  transcript?: string;
  listenLimit?: number;
  // Reading specific
  passage?: string;
  // Writing specific
  minWords?: number;
  // Speaking specific
  prepTime?: number;
  speakTime?: number;
}

interface PartProgress {
  skill: string;
  part: number;
  completed: number;
  total: number;
}

export function CreateVSTEPExam() {
  const navigate = useNavigate();
  const [examTitle, setExamTitle] = useState("VSTEP B2 - Practice Test");
  const [examDescription, setExamDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("private");

  const [currentSkill, setCurrentSkill] = useState<
    "listening" | "reading" | "writing" | "speaking"
  >("listening");
  const [currentPart, setCurrentPart] = useState(1);
  const [expandedPart, setExpandedPart] = useState<string | null>("listening-1");

  const [questions, setQuestions] = useState<Question[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize empty questions based on VSTEP structure
  useEffect(() => {
    const initialQuestions: Question[] = [];
    let questionCounter = 1;

    Object.entries(VSTEP_STRUCTURE).forEach(([skill, skillData]) => {
      skillData.parts.forEach((part) => {
        for (let i = 0; i < part.questions; i++) {
          initialQuestions.push({
            id: `${skill}-p${part.part}-q${i + 1}`,
            skill,
            part: part.part,
            questionNumber: questionCounter++,
            content: "",
            points: skill === "writing" || skill === "speaking" ? 10 : 1,
            answers:
              skill === "listening" || skill === "reading"
                ? [
                    { id: "a", content: "", isCorrect: false },
                    { id: "b", content: "", isCorrect: false },
                    { id: "c", content: "", isCorrect: false },
                    { id: "d", content: "", isCorrect: false },
                  ]
                : [],
            listenLimit: skill === "listening" ? 1 : undefined,
            minWords: skill === "writing" ? (part.part === 1 ? 150 : 250) : undefined,
          });
        }
      });
    });

    setQuestions(initialQuestions);
  }, []);

  const getPartProgress = (): PartProgress[] => {
    const progress: PartProgress[] = [];

    Object.entries(VSTEP_STRUCTURE).forEach(([skill, skillData]) => {
      skillData.parts.forEach((part) => {
        const partQuestions = questions.filter((q) => q.skill === skill && q.part === part.part);
        const completed = partQuestions.filter((q) => {
          if (!q.content.trim()) return false;
          if (skill === "listening" || skill === "reading") {
            return q.answers.some((a) => a.isCorrect && a.content.trim());
          }
          return true;
        }).length;

        progress.push({
          skill,
          part: part.part,
          completed,
          total: part.questions,
        });
      });
    });

    return progress;
  };

  const getSkillProgress = (skill: string) => {
    const skillQuestions = questions.filter((q) => q.skill === skill);
    const completed = skillQuestions.filter((q) => {
      if (!q.content.trim()) return false;
      if (skill === "listening" || skill === "reading") {
        return q.answers.some((a) => a.isCorrect && a.content.trim());
      }
      return true;
    }).length;
    return { completed, total: skillQuestions.length };
  };

  const updateQuestion = (questionId: string, updates: Partial<Question>) => {
    setQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, ...updates } : q)));
  };

  const updateAnswer = (questionId: string, answerId: string, content: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id === questionId) {
          return {
            ...q,
            answers: q.answers.map((a) => (a.id === answerId ? { ...a, content } : a)),
          };
        }
        return q;
      })
    );
  };

  const setCorrectAnswer = (questionId: string, answerId: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id === questionId) {
          return {
            ...q,
            answers: q.answers.map((a) => ({ ...a, isCorrect: a.id === answerId })),
          };
        }
        return q;
      })
    );
  };

  const togglePartExpanded = (skill: string, part: number) => {
    const key = `${skill}-${part}`;
    setExpandedPart(expandedPart === key ? null : key);
  };

  const handleSave = async (publish: boolean = false) => {
    try {
      setIsSaving(true);

      // Validate
      const incompleteQuestions = questions.filter((q) => !q.content.trim());
      if (incompleteQuestions.length > 0 && publish) {
        alert(
          `Còn ${incompleteQuestions.length} câu hỏi chưa hoàn thành. Vui lòng điền đầy đủ trước khi xuất bản.`
        );
        return;
      }

      // Create exam
      const createRes = await teacherApi.exams.create({
        eTitle: examTitle.trim(),
        eDescription: examDescription.trim(),
        eType: "VSTEP",
        eSkill: "mixed",
        eScope: "full",
        eDuration_minutes: 172,
        eIs_private: visibility === "private",
        eSource_type: "manual",
      });

      const examId =
        (createRes as any)?.data?.examId ??
        (createRes as any)?.data?.eId ??
        (createRes as any)?.data?.id;

      if (!examId) {
        throw new Error("Không lấy được ID đề thi");
      }

      // Add questions
      const questionPayload = questions
        .filter((q) => q.content.trim())
        .map((q) => ({
          qContent: q.content.trim(),
          qType:
            q.skill === "listening"
              ? "listening_multiple_choice"
              : q.skill === "reading"
                ? "multiple_choice"
                : q.skill === "writing"
                  ? "essay"
                  : "speaking_response",
          qSection: q.skill,
          qPart: `Part ${q.part}`,
          qPoints: q.points,
          qMedia_url: q.audioUrl || null,
          qTranscript: q.transcript || null,
          qListen_limit: q.listenLimit || null,
          qPassage: q.passage || null,
          qConfig: q.minWords
            ? {
                min_words: q.minWords,
                preparation_time: q.prepTime,
                speaking_time: q.speakTime,
              }
            : null,
          answers: q.answers
            .filter((a) => a.content.trim())
            .map((a) => ({
              aContent: a.content.trim(),
              aIs_correct: a.isCorrect,
            })),
        }));

      if (questionPayload.length > 0) {
        await teacherApi.exams.addQuestions(examId, questionPayload);
      }

      if (publish) {
        await teacherApi.exams.publish(examId);
        alert("Đã tạo và xuất bản đề thi VSTEP thành công!");
      } else {
        alert("Đã lưu nháp đề thi VSTEP thành công!");
      }

      navigate("/giao-vien/de-thi");
    } catch (error: any) {
      alert(error?.message || "Không thể lưu đề thi. Vui lòng thử lại.");
    } finally {
      setIsSaving(false);
    }
  };

  const renderQuestionEditor = (question: Question) => {
    const skillData = VSTEP_STRUCTURE[question.skill as keyof typeof VSTEP_STRUCTURE];
    const partData = skillData.parts.find((p) => p.part === question.part);

    return (
      <div key={question.id} className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
        <div className="flex items-start gap-4 mb-4">
          <div className="flex-shrink-0 w-10 h-10 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center font-bold">
            {question.questionNumber}
          </div>
          <div className="flex-1">
            {/* Question Content */}
            <textarea
              value={question.content}
              onChange={(e) => updateQuestion(question.id, { content: e.target.value })}
              placeholder={`Nhập nội dung câu hỏi ${question.questionNumber}...`}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 min-h-[100px]"
            />

            {/* Listening: Audio + Transcript */}
            {question.skill === "listening" && (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Volume2 className="w-4 h-4 inline mr-1" />
                    Link Audio MP3
                  </label>
                  <input
                    type="text"
                    value={question.audioUrl || ""}
                    onChange={(e) => updateQuestion(question.id, { audioUrl: e.target.value })}
                    placeholder="https://example.com/audio.mp3"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <FileText className="w-4 h-4 inline mr-1" />
                    Transcript (chỉ GV xem)
                  </label>
                  <textarea
                    value={question.transcript || ""}
                    onChange={(e) => updateQuestion(question.id, { transcript: e.target.value })}
                    placeholder="Nhập nội dung transcript..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 min-h-[80px]"
                  />
                </div>
              </div>
            )}

            {/* Reading: Passage (only for first question of each part) */}
            {question.skill === "reading" &&
              question.id.includes("-q1") && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <BookOpen className="w-4 h-4 inline mr-1" />
                    Passage {question.part} ({partData?.wordCount?.[0]}-{partData?.wordCount?.[1]}{" "}
                    từ)
                  </label>
                  <textarea
                    value={question.passage || ""}
                    onChange={(e) => {
                      // Update passage for all questions in this part
                      const partQuestions = questions.filter(
                        (q) => q.skill === "reading" && q.part === question.part
                      );
                      partQuestions.forEach((pq) => {
                        updateQuestion(pq.id, { passage: e.target.value });
                      });
                    }}
                    placeholder={`Nhập văn bản đọc cho Part ${question.part}...`}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 min-h-[200px] font-serif"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Văn bản này sẽ áp dụng cho tất cả {partData?.questions} câu hỏi của Part{" "}
                    {question.part}
                  </p>
                </div>
              )}

            {/* Multiple Choice Answers (Listening & Reading) */}
            {(question.skill === "listening" || question.skill === "reading") && (
              <div className="mt-4 space-y-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Đáp án (chọn 1 đáp án đúng):
                </label>
                {question.answers.map((answer, idx) => (
                  <div key={answer.id} className="flex items-center gap-3">
                    <input
                      type="radio"
                      name={`correct-${question.id}`}
                      checked={answer.isCorrect}
                      onChange={() => setCorrectAnswer(question.id, answer.id)}
                      className="w-4 h-4 text-orange-600"
                    />
                    <span className="font-medium text-gray-700 w-8">
                      {String.fromCharCode(65 + idx)}.
                    </span>
                    <input
                      type="text"
                      value={answer.content}
                      onChange={(e) => updateAnswer(question.id, answer.id, e.target.value)}
                      placeholder={`Đáp án ${String.fromCharCode(65 + idx)}`}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Writing: Min words */}
            {question.skill === "writing" && (
              <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-sm text-orange-800">
                  <Info className="w-4 h-4 inline mr-1" />
                  Yêu cầu tối thiểu: <strong>{question.minWords} từ</strong>
                </p>
                <p className="text-xs text-orange-600 mt-1">
                  Học viên sẽ tự viết bài. Giáo viên chấm thủ công sau.
                </p>
              </div>
            )}

            {/* Speaking: Instructions */}
            {question.skill === "speaking" && (
              <div className="mt-4 bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-sm text-purple-800">
                  <Mic className="w-4 h-4 inline mr-1" />
                  Học viên sẽ ghi âm câu trả lời. Giáo viên chấm thủ công sau.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const progress = getPartProgress();

  const [showMenu, setShowMenu] = useState(false);

  const allParts = Object.entries(VSTEP_STRUCTURE).flatMap(([s, sd]) =>
    sd.parts.map((p) => ({ skill: s, part: p.part, name: p.name }))
  );

  const currentPartIndex = allParts.findIndex(
    (p) => p.skill === currentSkill && p.part === currentPart
  );

  const goToNextPart = () => {
    if (currentPartIndex < allParts.length - 1) {
      const next = allParts[currentPartIndex + 1];
      setCurrentSkill(next.skill as any);
      setCurrentPart(next.part);
    }
  };

  const goToPrevPart = () => {
    if (currentPartIndex > 0) {
      const prev = allParts[currentPartIndex - 1];
      setCurrentSkill(prev.skill as any);
      setCurrentPart(prev.part);
    }
  };

  const currentPartData = VSTEP_STRUCTURE[currentSkill as keyof typeof VSTEP_STRUCTURE];
  const currentPartInfo = currentPartData?.parts.find((p) => p.part === currentPart);
  const partQuestions = questions.filter(
    (q) => q.skill === currentSkill && q.part === currentPart
  );

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Top Header */}
      <div className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/giao-vien/de-thi/tat-ca" className="text-orange-600 hover:text-orange-700">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-bold text-gray-900">{examTitle}</h1>
            <p className="text-xs text-gray-500">
              {currentPartData?.name} - Part {currentPart}: {currentPartInfo?.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            Đã trả lời: {progress.reduce((sum, p) => sum + p.completed, 0)}/80
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 pb-24">
        <div className="max-w-5xl mx-auto">
          {/* Part Info Banner */}
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg p-6 mb-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">{currentPartData?.icon}</span>
              <div className="flex-1">
                <h2 className="text-xl font-bold">
                  {currentPartData?.name} - Part {currentPart}
                </h2>
                <p className="text-orange-100">{currentPartInfo?.name}</p>
              </div>
              <div className="bg-white/20 backdrop-blur px-4 py-2 rounded-lg text-center">
                <div className="text-xs opacity-90">Câu hỏi</div>
                <div className="text-lg font-bold">{partQuestions.length}</div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded px-4 py-2 mt-3">
              <p className="text-sm">
                📝 <strong>Hướng dẫn:</strong> {currentPartInfo?.description} -{" "}
                {currentPartInfo?.questions} câu hỏi
              </p>
            </div>
          </div>

          {/* Questions List */}
          <div className="space-y-4">{partQuestions.map(renderQuestionEditor)}</div>
        </div>
      </div>

      {/* Bottom Navigation - VSTEP Style */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50">
        {/* Part Tabs */}
        <div className="flex items-center gap-1 px-4 py-2 overflow-x-auto">
          {Object.entries(VSTEP_STRUCTURE).map(([skill, skillData]) => (
            <div key={skill} className="flex items-center gap-1">
              {skillData.parts.map((part) => {
                const isActive = currentSkill === skill && currentPart === part.part;
                const partProgress = progress.find((p) => p.skill === skill && p.part === part.part);
                const isCompleted = partProgress && partProgress.completed === partProgress.total;

                return (
                  <button
                    key={`${skill}-${part.part}`}
                    onClick={() => {
                      setCurrentSkill(skill as any);
                      setCurrentPart(part.part);
                    }}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-all whitespace-nowrap ${
                      isActive
                        ? "bg-orange-500 text-white shadow-md"
                        : isCompleted
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    Part {part.part}
                  </button>
                );
              })}
              <div className="px-2 py-1 text-xs font-medium text-white rounded bg-orange-600 mx-1">
                {skillData.name} - {skillData.duration}
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between px-6 py-3 border-t bg-gray-50">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2"
          >
            <Menu className="w-4 h-4" />
            {showMenu ? "Đóng menu" : "Ẩn menu"}
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleSave(false)}
              disabled={isSaving}
              className="px-5 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Lưu bài
            </button>
            <button
              onClick={goToNextPart}
              disabled={currentPartIndex >= allParts.length - 1}
              className="px-5 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              Tiếp tục
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Side Menu (when toggled) */}
      {showMenu && (
        <div className="fixed left-0 top-0 bottom-0 w-80 bg-white shadow-2xl z-50 overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">Menu điều hướng</h3>
              <button onClick={() => setShowMenu(false)} className="p-2 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Exam Info */}
            <div className="mb-6 p-4 bg-orange-50 rounded-lg">
              <input
                type="text"
                value={examTitle}
                onChange={(e) => setExamTitle(e.target.value)}
                className="w-full px-3 py-2 border rounded mb-2 font-semibold"
                placeholder="Tên đề thi"
              />
              <textarea
                value={examDescription}
                onChange={(e) => setExamDescription(e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm"
                placeholder="Mô tả đề thi..."
                rows={2}
              />
            </div>

            {/* Skills Navigation */}
            <div className="space-y-4">
              {Object.entries(VSTEP_STRUCTURE).map(([skill, skillData]) => {
                const skillProgress = getSkillProgress(skill);
                return (
                  <div key={skill} className="border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{skillData.icon}</span>
                      <div className="flex-1">
                        <h4 className="font-bold text-sm">{skillData.name}</h4>
                        <p className="text-xs text-gray-500">
                          {skillProgress.completed}/{skillProgress.total} câu
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {skillData.parts.map((part) => {
                        const isActive = currentSkill === skill && currentPart === part.part;
                        const partProgress = progress.find(
                          (p) => p.skill === skill && p.part === part.part
                        );
                        return (
                          <button
                            key={part.part}
                            onClick={() => {
                              setCurrentSkill(skill as any);
                              setCurrentPart(part.part);
                              setShowMenu(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                              isActive
                                ? "bg-orange-600 text-white"
                                : "hover:bg-gray-100 text-gray-700"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span>
                                Part {part.part}: {part.name}
                              </span>
                              <span className="text-xs">
                                {partProgress?.completed}/{partProgress?.total}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            <div className="mt-6 space-y-2">
              <button
                onClick={() => handleSave(false)}
                className="w-full px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200"
              >
                💾 Lưu nháp
              </button>
              <button
                onClick={() => handleSave(true)}
                className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700"
              >
                ✅ Xuất bản đề thi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



