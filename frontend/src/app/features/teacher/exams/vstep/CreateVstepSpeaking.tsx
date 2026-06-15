import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router";
import { ArrowLeft, Save, Plus, Trash2, MessageSquare, Lightbulb, Users, Sparkles, X, Eraser } from "lucide-react";
import { useToast } from "../../../../../hooks/useToast";
import { useTranslation } from "react-i18next";
import { 
  saveVstepSpeakingPart, 
  publishVstepSpeakingExam, 
  loadVstepSpeakingExam,
  Part1Topic,
  Part2Data,
  Part3Data
} from "../../../../../services/vstepApi";
import {
  generatePart1Topics,
  generatePart1Questions,
  enhancePart1Questions,
  generatePart2Content,
  generatePart3FromTopic,
} from "../../../../../services/groqApi";
import { MindMapEditor } from "./components/MindMapEditor";

interface SpeakingPart {
  partNumber: 1 | 2 | 3;
  partName: string;
  timeLimit: number;
  part1Data?: Part1Topic[];
  part2Data?: Part2Data;
  part3Data?: Part3Data;
}

const VSTEP_SPEAKING_PARTS = [
  { part: 1, name: "Part 1 - Social Interaction", description: "vstep.speaking.parts.1.description", timeLimit: 3 },
  { part: 2, name: "Part 2 - Solution Discussion", description: "vstep.speaking.parts.2.description", timeLimit: 4 },
  { part: 3, name: "Part 3 - Topic Development", description: "vstep.speaking.parts.3.description", timeLimit: 5 },
];

// Default data generators
const createDefaultPart1Data = (): Part1Topic[] => [
  {
    id: `topic-${Date.now()}-1`,
    topicName: "",
    questions: ["", "", ""], // 3 empty questions
  },
  {
    id: `topic-${Date.now()}-2`,
    topicName: "",
    questions: ["", "", ""], // 3 empty questions
  },
];

const createDefaultPart2Data = (): Part2Data => ({
  situation: "",
  solutions: ["", "", ""], // 3 empty solutions
  question: "Which solution do you think is the best? Why?",
});

const createDefaultPart3Data = (): Part3Data => ({
  mainTopic: "",
  suggestedIdeas: ["", "", "", ""], // Exactly 4 ideas for mind map (top, right, bottom, left)
  followUpQuestions: ["", ""], // 2 empty questions
});

interface CreateVstepSpeakingProps {
  examId?: string;
  onComplete?: () => void;
  isFullTest?: boolean;
}

export const CreateVstepSpeaking = ({ examId: propExamId, onComplete, isFullTest = false }: CreateVstepSpeakingProps = {}) => {
  const navigate = useNavigate();
  const { success, error } = useToast();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useParams();
  const urlExamId = params.examId || searchParams.get("id");

  const initialExamId = propExamId || urlExamId || `vstep-speaking-${Date.now()}`;
  const [examId, setExamId] = useState<string>(initialExamId);
  const [examTitle, setExamTitle] = useState<string>(t('vstep.speaking.title'));
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savingPart, setSavingPart] = useState<number | null>(null);
  const [currentPart, setCurrentPart] = useState<1 | 2 | 3>(1);
  const [isGenerating, setIsGenerating] = useState(false);
  // Track các part đã lưu thành công
  const [savedParts, setSavedParts] = useState<Set<number>>(new Set());
  
  const [parts, setParts] = useState<SpeakingPart[]>([
    {
      partNumber: 1,
      partName: "Part 1 - Social Interaction",
      timeLimit: 3,
      part1Data: createDefaultPart1Data(),
    },
    {
      partNumber: 2,
      partName: "Part 2 - Solution Discussion",
      timeLimit: 4,
      part2Data: createDefaultPart2Data(),
    },
    {
      partNumber: 3,
      partName: "Part 3 - Topic Development",
      timeLimit: 5,
      part3Data: createDefaultPart3Data(),
    },
  ]);

  const currentPartData = parts.find((p) => p.partNumber === currentPart)!;

  useEffect(() => {
    // Priority: propExamId (from Full Test) > URL param > generate new
    const effectiveExamId = propExamId || urlExamId;
    
    if (effectiveExamId) {
      // Update examId state if different
      if (effectiveExamId !== examId) {
        setExamId(effectiveExamId);
      }
      
      // Update URL if not in Full Test mode and URL doesn't have ID (skip if on /sua/:examId route)
      if (!isFullTest && !params.examId && !searchParams.get("id")) {
        setSearchParams({ id: effectiveExamId }, { replace: true });
      }
      
      // Load exam data from API
      console.log("Loading existing exam:", effectiveExamId, "isFullTest:", isFullTest);
      setIsLoading(true);
      loadVstepSpeakingExam(effectiveExamId)
        .then((response) => {
          if (response.status === "success" && response.data) {
            const examData = response.data;
            setExamTitle(examData.title);
            
            // Load parts with new structure
            const loadedParts = examData.parts.map((part: any) => {
              const basePart = {
                partNumber: part.partNumber as 1 | 2 | 3,
                partName: part.partName,
                timeLimit: part.timeLimit,
              };

              // Only load data if it exists in DB, don't create default data
              if (part.partNumber === 1) {
                return {
                  ...basePart,
                  part1Data: part.part1Data || createDefaultPart1Data(),
                };
              } else if (part.partNumber === 2) {
                return {
                  ...basePart,
                  part2Data: part.part2Data || createDefaultPart2Data(),
                };
              } else {
                return {
                  ...basePart,
                  part3Data: part.part3Data || createDefaultPart3Data(),
                };
              }
            });
            
            setParts((prev) =>
              prev.map((p) => {
                const loaded = loadedParts.find((lp: any) => lp.partNumber === p.partNumber);
                return loaded || p;
              })
            );
            
            console.log("✅ Loaded parts:", loadedParts.length);
            success(t('vstep.speaking.toast.loadSuccess'));
          }
        })
        .catch((err) => {
          console.log("Exam not found or error loading, starting fresh:", err);
        })
        .finally(() => setIsLoading(false));
    } else if (!isFullTest) {
      // No ID anywhere and not in Full Test, add generated ID to URL
      setSearchParams({ id: examId }, { replace: true });
    }
  }, [propExamId]); // Re-run when propExamId changes (important for Full Test)

  // Part 1: Topic management
  const addTopic = () => {
    setParts((prev) =>
      prev.map((p) =>
        p.partNumber === 1
          ? {
              ...p,
              part1Data: [
                ...(p.part1Data || []),
                {
                  id: `topic-${Date.now()}`,
                  topicName: "",
                  questions: ["", "", ""],
                },
              ],
            }
          : p
      )
    );
  };

  const removeTopic = (topicId: string) => {
    setParts((prev) =>
      prev.map((p) =>
        p.partNumber === 1
          ? {
              ...p,
              part1Data: (p.part1Data || []).filter((t) => t.id !== topicId),
            }
          : p
      )
    );
  };

  const updateTopicName = (topicId: string, name: string) => {
    setParts((prev) =>
      prev.map((p) =>
        p.partNumber === 1
          ? {
              ...p,
              part1Data: (p.part1Data || []).map((t) =>
                t.id === topicId ? { ...t, topicName: name } : t
              ),
            }
          : p
      )
    );
  };

  const updateTopicQuestion = (topicId: string, questionIndex: number, value: string) => {
    setParts((prev) =>
      prev.map((p) =>
        p.partNumber === 1
          ? {
              ...p,
              part1Data: (p.part1Data || []).map((t) =>
                t.id === topicId
                  ? {
                      ...t,
                      questions: t.questions.map((q, i) => (i === questionIndex ? value : q)),
                    }
                  : t
              ),
            }
          : p
      )
    );
  };

  // Part 2: Solution Discussion management
  const updatePart2Field = (field: keyof Part2Data, value: string) => {
    setParts((prev) =>
      prev.map((p) =>
        p.partNumber === 2
          ? {
              ...p,
              part2Data: {
                ...(p.part2Data || createDefaultPart2Data()),
                [field]: value,
              },
            }
          : p
      )
    );
  };

  const updatePart2Solution = (index: number, value: string) => {
    setParts((prev) =>
      prev.map((p) =>
        p.partNumber === 2
          ? {
              ...p,
              part2Data: {
                ...(p.part2Data || createDefaultPart2Data()),
                solutions: (p.part2Data?.solutions || ["", "", ""]).map((s, i) =>
                  i === index ? value : s
                ),
              },
            }
          : p
      )
    );
  };

  // Part 3: Topic Development management
  const updatePart3Field = (field: keyof Part3Data, value: string) => {
    setParts((prev) =>
      prev.map((p) =>
        p.partNumber === 3
          ? {
              ...p,
              part3Data: {
                ...(p.part3Data || createDefaultPart3Data()),
                [field]: value,
              },
            }
          : p
      )
    );
  };

  const updatePart3Idea = (index: number, value: string) => {
    setParts((prev) =>
      prev.map((p) =>
        p.partNumber === 3
          ? {
              ...p,
              part3Data: {
                ...(p.part3Data || createDefaultPart3Data()),
                suggestedIdeas: (p.part3Data?.suggestedIdeas || []).map((idea, i) =>
                  i === index ? value : idea
                ),
              },
            }
          : p
      )
    );
  };

  // Part 3 now has exactly 4 ideas (top, right, bottom, left) - no add/remove needed

  const clearPart3All = () => {
    setParts((prev) =>
      prev.map((p) =>
        p.partNumber === 3
          ? {
              ...p,
              part3Data: createDefaultPart3Data(),
            }
          : p
      )
    );
  };

  const updatePart3Question = (index: number, value: string) => {
    setParts((prev) =>
      prev.map((p) =>
        p.partNumber === 3
          ? {
              ...p,
              part3Data: {
                ...(p.part3Data || createDefaultPart3Data()),
                followUpQuestions: (p.part3Data?.followUpQuestions || []).map((q, i) =>
                  i === index ? value : q
                ),
              },
            }
          : p
      )
    );
  };

  const addPart3Question = () => {
    setParts((prev) =>
      prev.map((p) =>
        p.partNumber === 3
          ? {
              ...p,
              part3Data: {
                ...(p.part3Data || createDefaultPart3Data()),
                followUpQuestions: [...(p.part3Data?.followUpQuestions || []), ""],
              },
            }
          : p
      )
    );
  };

  const removePart3Question = (index: number) => {
    setParts((prev) =>
      prev.map((p) =>
        p.partNumber === 3
          ? {
              ...p,
              part3Data: {
                ...(p.part3Data || createDefaultPart3Data()),
                followUpQuestions: (p.part3Data?.followUpQuestions || []).filter((_, i) => i !== index),
              },
            }
          : p
      )
    );
  };

  // AI Generation Functions
  const handleGeneratePart1Topic = async () => {
    setIsGenerating(true);
    try {
      const topics = await generatePart1Topics();
      if (topics.length > 0) {
        // Add first suggested topic
        const newTopic: Part1Topic = {
          id: `topic-${Date.now()}`,
          topicName: topics[0],
          questions: ["", "", ""],
        };
        
        setParts((prev) =>
          prev.map((p) =>
            p.partNumber === 1
              ? {
                  ...p,
                  part1Data: [...(p.part1Data || []), newTopic],
                }
              : p
          )
        );
        
        success("✨ AI đã tạo topic thành công!");
      }
    } catch (err) {
      error("Không thể tạo topic. Vui lòng thử lại.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGeneratePart1Questions = async (topicId: string, topicName: string) => {
    if (!topicName.trim()) {
      error("Vui lòng nhập tên topic trước");
      return;
    }

    setIsGenerating(true);
    try {
      // Lấy câu hỏi hiện có của topic này
      const currentTopic = parts
        .find(p => p.partNumber === 1)
        ?.part1Data?.find(t => t.id === topicId);
      const existingQuestions = currentTopic?.questions || [];
      const hasExisting = existingQuestions.some(q => q.trim());

      // Nếu đã có câu hỏi → enhance/rewrite, chưa có → generate mới
      const questions = hasExisting
        ? await enhancePart1Questions(topicName, existingQuestions)
        : await generatePart1Questions(topicName);

      if (questions.length > 0) {
        setParts((prev) =>
          prev.map((p) =>
            p.partNumber === 1
              ? {
                  ...p,
                  part1Data: (p.part1Data || []).map((t) =>
                    t.id === topicId ? { ...t, questions: questions.slice(0, 3) } : t
                  ),
                }
              : p
          )
        );

        success(
          hasExisting
            ? "✨ AI đã cải thiện câu hỏi thành công!"
            : "✨ AI đã tạo câu hỏi thành công!"
        );
      }
    } catch (err) {
      error("Không thể tạo câu hỏi. Vui lòng thử lại.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGeneratePart2Content = async () => {
    setIsGenerating(true);
    try {
      const content = await generatePart2Content();
      if (content.situation) {
        setParts((prev) =>
          prev.map((p) =>
            p.partNumber === 2
              ? {
                  ...p,
                  part2Data: content,
                }
              : p
          )
        );
        
        success("✨ AI đã tạo nội dung Part 2 thành công!");
      }
    } catch (err) {
      error("Không thể tạo nội dung. Vui lòng thử lại.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate ideas + questions based on existing main topic
  const handleGeneratePart3FromTopic = async () => {
    console.log('🚀 handleGeneratePart3FromTopic called');
    const data = parts.find(p => p.partNumber === 3)?.part3Data;
    const mainTopic = data?.mainTopic?.trim();

    console.log('📝 Main topic:', mainTopic);

    if (!mainTopic) {
      error("Vui lòng nhập Main Topic trước");
      return;
    }

    setIsGenerating(true);
    try {
      console.log('📡 Calling generatePart3FromTopic with:', mainTopic);
      const content = await generatePart3FromTopic(mainTopic);
      console.log('✅ Generated content:', content);
      if (content.suggestedIdeas.length > 0) {
        setParts((prev) =>
          prev.map((p) =>
            p.partNumber === 3
              ? {
                  ...p,
                  part3Data: {
                    ...(p.part3Data || createDefaultPart3Data()),
                    mainTopic: mainTopic, // Keep existing main topic
                    suggestedIdeas: content.suggestedIdeas,
                    followUpQuestions: content.followUpQuestions,
                  },
                }
              : p
          )
        );
        
        success("✨ AI đã tạo ideas và questions thành công!");
      } else {
        console.warn('⚠️ No ideas generated');
        error("AI không tạo được ideas. Vui lòng thử lại.");
      }
    } catch (err) {
      console.error('❌ Error generating from topic:', err);
      error(`Không thể tạo nội dung: ${err.message || 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
      console.log('✅ Generation complete, isGenerating set to false');
    }
  };

  const handleSavePart = async (partNumber: 1 | 2 | 3) => {
    const part = parts.find(p => p.partNumber === partNumber);
    if (!part) return;

    // Validation based on part type
    let isValid = false;
    let partData: any = {};

    if (partNumber === 1) {
      const topics = part.part1Data || [];
      const validTopics = topics.filter(
        (t) => t.topicName.trim() && t.questions.some((q) => q.trim())
      );
      
      if (validTopics.length === 0) {
        error("Part 1: Please add at least one topic with questions");
        return;
      }

      isValid = true;
      partData = {
        partName: part.partName,
        timeLimit: part.timeLimit,
        part1Data: validTopics,
      };
    } else if (partNumber === 2) {
      const data = part.part2Data || createDefaultPart2Data();
      
      if (!data.situation.trim()) {
        error("Part 2: Please provide a situation");
        return;
      }

      const validSolutions = data.solutions.filter((s) => s.trim());
      if (validSolutions.length < 3) {
        error("Part 2: Please provide all 3 solutions");
        return;
      }

      isValid = true;
      partData = {
        partNumber: part.partNumber,
        partName: part.partName,
        timeLimit: part.timeLimit,
        part2Data: data,
      };
    } else if (partNumber === 3) {
      const data = part.part3Data || createDefaultPart3Data();
      
      if (!data.mainTopic.trim()) {
        error("Part 3: Please provide a main topic");
        return;
      }

      const validIdeas = data.suggestedIdeas.filter((i) => i.trim());
      if (validIdeas.length < 4) {
        error("Part 3: Please provide all 4 suggested ideas");
        return;
      }

      const validQuestions = data.followUpQuestions.filter((q) => q.trim());
      if (validQuestions.length < 2) {
        error("Part 3: Please provide at least 2 follow-up questions");
        return;
      }

      isValid = true;
      partData = {
        partNumber: part.partNumber,
        partName: part.partName,
        timeLimit: part.timeLimit,
        part3Data: {
          ...data,
          suggestedIdeas: validIdeas,
          followUpQuestions: validQuestions,
        },
      };
    }

    if (!isValid) return;

    setSavingPart(partNumber);
    
    console.log('💾 Saving Part', partNumber, 'with data:', partData);
    
    try {
      const response = await saveVstepSpeakingPart(examId, partNumber, partData);
      console.log('✅ Save response:', response);
      success(`Part ${partNumber} saved successfully!`);

      // Track part đã lưu và tự động gọi onComplete khi đủ 3 part
      if (isFullTest && onComplete) {
        const newSaved = new Set([...savedParts, partNumber]);
        setSavedParts(newSaved);
        if (newSaved.size === 3) {
          // Đủ cả 3 part → báo hoàn thành Speaking
          setTimeout(() => {
            onComplete();
          }, 300);
        }
      }
    } catch (err: any) {
      console.error('❌ Save error:', err);
      
      // Extract detailed error message
      const errorMessage = err.response?.data?.message || err.message || `Failed to save Part ${partNumber}`;
      const errorDetails = err.response?.data?.errors ? 
        '\n' + Object.values(err.response.data.errors).flat().join('\n') : '';
      
      error(errorMessage + errorDetails);
    } finally {
      setSavingPart(null);
    }
  };

  const handleSave = async () => {
    // Validate all parts
    for (const part of parts) {
      if (part.partNumber === 1) {
        const topics = part.part1Data || [];
        const validTopics = topics.filter(
          (t) => t.topicName.trim() && t.questions.some((q) => q.trim())
        );
        if (validTopics.length === 0) {
          error("Part 1: Please add at least one topic with questions");
          return;
        }
      } else if (part.partNumber === 2) {
        const data = part.part2Data || createDefaultPart2Data();
        if (!data.situation.trim() || data.solutions.filter((s) => s.trim()).length < 3) {
          error("Part 2: Please complete situation and all 3 solutions");
          return;
        }
      } else if (part.partNumber === 3) {
        const data = part.part3Data || createDefaultPart3Data();
        if (
          !data.mainTopic.trim() ||
          data.suggestedIdeas.filter((i) => i.trim()).length < 4 ||
          data.followUpQuestions.filter((q) => q.trim()).length < 2
        ) {
          error("Part 3: Please complete main topic, all 4 ideas, and follow-up questions");
          return;
        }
      }
    }

    setIsSaving(true);
    try {
      const examData = {
        title: examTitle,
        parts: parts.map((part) => {
          const basePart = {
            partNumber: part.partNumber,
            partName: part.partName,
            timeLimit: part.timeLimit,
          };

          if (part.partNumber === 1) {
            return {
              ...basePart,
              part1Data: part.part1Data,
            };
          } else if (part.partNumber === 2) {
            return {
              ...basePart,
              part2Data: part.part2Data,
            };
          } else {
            return {
              ...basePart,
              part3Data: part.part3Data,
            };
          }
        }),
      };

      await publishVstepSpeakingExam(examId, examData);
      success(t('vstep.speaking.toast.publishSuccess'));
      
      if (!isFullTest) {
        setTimeout(() => {
          navigate("/giao-vien/luyen-tap");
        }, 1500);
      } else if (onComplete) {
        onComplete();
      }
    } catch (err: any) {
      error(err.response?.data?.message || t('vstep.speaking.toast.publishError'));
    } finally {
      setIsSaving(false);
    }
  };

  // Helper to check if part has data
  const hasPartData = (partNumber: 1 | 2 | 3): boolean => {
    const part = parts.find((p) => p.partNumber === partNumber);
    if (!part) return false;

    if (partNumber === 1) {
      const topics = part.part1Data || [];
      return topics.some((t) => t.topicName.trim() || t.questions.some((q) => q.trim()));
    } else if (partNumber === 2) {
      const data = part.part2Data;
      return !!(
        data &&
        (data.situation.trim() || data.solutions.some((s) => s.trim()) || data.question.trim())
      );
    } else {
      const data = part.part3Data;
      return !!(
        data &&
        (data.mainTopic.trim() ||
          data.suggestedIdeas.some((i) => i.trim()) ||
          data.followUpQuestions.some((q) => q.trim()))
      );
    }
  };

  // Render Part 1: Social Interaction
  const renderPart1 = () => {
    const topics = currentPartData.part1Data || [];
    if (topics.length === 0) return null;

    return (
      <div className="space-y-6">
        {/* Info Banner */}
        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <MessageSquare className="w-5 h-5 text-blue-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-800 mb-2">Part 1: Social Interaction</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Warm-up conversation với 2 topics, mỗi topic có 3 câu hỏi. Học viên trả lời tự nhiên về các chủ đề quen thuộc.
              </p>
              <div className="flex items-center gap-5 mt-4 text-xs text-gray-500">
                <span className="flex items-center gap-2">
                  <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                  Time: 3 minutes
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                  Format: 2 Topics × 3 Questions
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Topic cards */}
        {topics.map((topic, topicIndex) => (
          <div key={topic.id} className="border border-gray-200 rounded-xl p-7 bg-white space-y-6">
            {/* Topic header */}
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700">
                <span className="w-7 h-7 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center text-sm font-bold">
                  {topicIndex + 1}
                </span>
                Topic {topicIndex + 1}
              </span>
              {topics.length > 1 && (
                <button
                  onClick={() => removeTopic(topic.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Xoá topic này"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Topic Name */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Topic Name</label>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={topic.topicName}
                  onChange={(e) => updateTopicName(topic.id, e.target.value)}
                  placeholder="Let's talk about... (e.g., your hobbies, your hometown, your daily routine)"
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 text-gray-900 placeholder:text-gray-400 transition-all"
                />
                <button
                  onClick={() => handleGeneratePart1Questions(topic.id, topic.topicName)}
                  disabled={isGenerating || !topic.topicName.trim()}
                  className="flex items-center gap-2 px-4 py-3 text-sm bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm whitespace-nowrap"
                  title={topic.questions.some(q => q.trim()) ? "AI cải thiện câu hỏi" : "AI tạo câu hỏi"}
                >
                  <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                  {isGenerating ? "Đang tạo..." : topic.questions.some(q => q.trim()) ? "Cải thiện" : "AI Generate"}
                </button>
              </div>
            </div>

            {/* Questions */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Questions</label>
              <div className="space-y-3">
                {topic.questions.map((question, qIndex) => (
                  <div key={qIndex} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-7 h-7 bg-gray-50 text-gray-500 rounded-lg flex items-center justify-center font-medium text-sm mt-1">
                      {qIndex + 1}
                    </span>
                    <input
                      type="text"
                      value={question}
                      onChange={(e) => updateTopicQuestion(topic.id, qIndex, e.target.value)}
                      placeholder={
                        qIndex === 0 ? "Question 1: e.g., What do you usually do in your free time?" :
                        qIndex === 1 ? "Question 2: e.g., How often do you do this activity?" :
                        "Question 3: e.g., Why do you enjoy it?"
                      }
                      className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 text-gray-900 placeholder:text-gray-400 transition-all"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        {/* Add topic button */}
        <button
          onClick={addTopic}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-blue-200 text-blue-500 rounded-xl hover:border-blue-400 hover:bg-blue-50/50 transition-all text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Thêm Topic
        </button>
      </div>
    );
  };

  // Render Part 2: Solution Discussion
  const renderPart2 = () => {
    const data = currentPartData.part2Data || createDefaultPart2Data();

    return (
      <div className="space-y-6">
        <div className="bg-amber-50/30 border border-amber-100 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <Lightbulb className="w-5 h-5 text-amber-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-800 mb-2">Part 2: Solution Discussion</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Provide a situation with 3 possible solutions. Students will analyze and choose the best solution.
              </p>
              <div className="flex items-center gap-5 mt-4 text-xs text-gray-500">
                <span className="flex items-center gap-2">
                  <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                  Time: 4 minutes
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                  Format: Situation + 3 Solutions + Question
                </span>
              </div>
            </div>
            <button
              onClick={handleGeneratePart2Content}
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2.5 text-sm bg-gradient-to-r from-amber-400 to-orange-400 text-white rounded-xl hover:from-amber-500 hover:to-orange-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              title="AI Generate All Content"
            >
              <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
              {isGenerating ? "Đang tạo..." : "AI Generate"}
            </button>
          </div>
        </div>

        <div className="border border-gray-200 rounded-xl p-7 bg-white space-y-7">
          {/* Situation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              <span className="inline-flex items-center gap-2">
                <span className="w-7 h-7 bg-gray-100 text-gray-600 rounded-lg flex items-center justify-center text-sm font-medium">
                  1
                </span>
                Situation
              </span>
            </label>
            <textarea
              value={data.situation}
              onChange={(e) => updatePart2Field("situation", e.target.value)}
              rows={4}
              placeholder="Describe the situation or problem. Example: You want to improve your English speaking skills but you have a limited budget..."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 text-gray-900 placeholder:text-gray-400 transition-all"
            />
          </div>

          {/* Solutions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-4">
              <span className="inline-flex items-center gap-2">
                <span className="w-7 h-7 bg-gray-100 text-gray-600 rounded-lg flex items-center justify-center text-sm font-medium">
                  2
                </span>
                Suggested Solutions
              </span>
            </label>
            <div className="space-y-3">
              {data.solutions.map((solution, index) => (
                <div key={index} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 bg-gray-50 text-gray-500 rounded-lg flex items-center justify-center font-medium text-sm">
                    {index + 1}
                  </span>
                  <input
                    type="text"
                    value={solution}
                    onChange={(e) => updatePart2Solution(index, e.target.value)}
                    placeholder={`Solution ${index + 1}: e.g., ${
                      index === 0
                        ? "Join an online speaking course ($50/month)"
                        : index === 1
                        ? "Take a speaking course at a language center ($200/month)"
                        : "Find a native English speaker for language exchange (free)"
                    }`}
                    className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 text-gray-900 placeholder:text-gray-400 transition-all"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Question */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              <span className="inline-flex items-center gap-2">
                <span className="w-7 h-7 bg-gray-100 text-gray-600 rounded-lg flex items-center justify-center text-sm font-medium">
                  3
                </span>
                Main Question
              </span>
            </label>
            <input
              type="text"
              value={data.question}
              onChange={(e) => updatePart2Field("question", e.target.value)}
              placeholder="Which solution do you think is the best? Why?"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 text-gray-900 placeholder:text-gray-400 transition-all"
            />
          </div>
        </div>
      </div>
    );
  };

  // Render Part 3: Topic Development with Mind Map
  const renderPart3 = () => {
    const data = currentPartData.part3Data || createDefaultPart3Data();
    
    // Ensure we have exactly 4 ideas [top, right, bottom, left]
    const ideas: [string, string, string, string] = [
      data.suggestedIdeas[0] || "",
      data.suggestedIdeas[1] || "",
      data.suggestedIdeas[2] || "",
      data.suggestedIdeas[3] || "",
    ];

    return (
      <div className="space-y-6">
        {/* Info Banner */}
        <div className="bg-purple-50/30 border border-purple-100 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <Users className="w-5 h-5 text-purple-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-800 mb-2">Part 3: Topic Development</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Provide a main topic with 4 suggested ideas. Students will speak for 2 minutes, then answer follow-up questions.
              </p>
              <div className="flex items-center gap-5 mt-4 text-xs text-gray-500">
                <span className="flex items-center gap-2">
                  <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                  Time: 5 minutes (1 min prep + 2 min talk + 2 min Q&A)
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                  Format: Topic + 4 Ideas + Questions
                </span>
              </div>
            </div>
            <button
              onClick={clearPart3All}
              className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
              title="Clear all Part 3 content"
            >
              <Eraser className="w-4 h-4" />
              Clear All
            </button>
          </div>
        </div>

        {/* Mind Map Editor */}
        <div className="border border-gray-200 rounded-xl p-7 bg-white">
          <MindMapEditor
            mainTopic={data.mainTopic}
            ideas={ideas}
            onMainTopicChange={(value) => updatePart3Field("mainTopic", value)}
            onIdeaChange={(index, value) => updatePart3Idea(index, value)}
            onGenerateFromTopic={handleGeneratePart3FromTopic}
            isGenerating={isGenerating}
          />
        </div>

        {/* Follow-up Questions */}
        <div className="border border-gray-200 rounded-xl p-7 bg-white space-y-5">
          <label className="block text-sm font-medium text-gray-700">
            <span className="inline-flex items-center gap-2">
              <span className="w-7 h-7 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center text-sm font-medium">
                Q
              </span>
              Follow-up Questions
            </span>
          </label>
          <div className="space-y-4">
            {data.followUpQuestions.map((question, index) => (
              <div key={index} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 bg-purple-50 text-purple-500 rounded-lg flex items-center justify-center font-medium text-sm mt-1">
                  {index + 1}
                </span>
                <div className="flex-1 relative">
                  <textarea
                    value={question}
                    onChange={(e) => updatePart3Question(index, e.target.value)}
                    rows={2}
                    placeholder={`Question ${index + 1}: e.g., ${
                      index === 0
                        ? "Do you think traveling is important for young people? Why?"
                        : "How has tourism changed in your country in recent years?"
                    }`}
                    className="w-full px-4 py-3 pr-10 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400 text-gray-900 placeholder:text-gray-400 transition-all resize-none"
                  />
                  {question && (
                    <button
                      onClick={() => updatePart3Question(index, "")}
                      className="absolute right-2 top-2 p-1 text-purple-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                      title="Clear text"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {data.followUpQuestions.length > 2 && (
                  <button
                    onClick={() => removePart3Question(index)}
                    className="flex-shrink-0 p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={addPart3Question}
            className="mt-4 flex items-center gap-2 px-4 py-2.5 text-sm text-purple-500 hover:bg-purple-50 rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Question
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={`bg-gray-50 flex flex-col ${isFullTest ? 'h-full' : 'h-screen overflow-hidden'}`}>
      {!isFullTest && (
        <div className="bg-white border-b border-gray-200 flex-shrink-0 z-10">
          <div className="max-w-[1800px] mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate("/giao-vien/de-thi")}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <input
                    type="text"
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                    className="text-2xl font-bold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 -ml-2"
                    placeholder={t('vstep.speaking.title')}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    {t('vstep.speaking.subtitle')}
                    <span className="ml-2 text-xs text-green-600 font-medium">• {t('vstep.speaking.examIdLabel')}: {examId}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSave}
                  disabled={isSaving || isLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? t('vstep.speaking.actions.publishing') : t('vstep.speaking.actions.publish')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border-b border-gray-100 flex-shrink-0">
        <div className="max-w-[1800px] mx-auto px-6">
          <div className="flex gap-1 overflow-x-auto">
            {VSTEP_SPEAKING_PARTS.map((part) => {
              const hasData = hasPartData(part.part as 1 | 2 | 3);
              const Icon = part.part === 1 ? MessageSquare : part.part === 2 ? Lightbulb : Users;
              const colorClass = part.part === 1 ? 'text-blue-500' : part.part === 2 ? 'text-amber-500' : 'text-purple-500';
              const activeColorClass = part.part === 1 ? 'border-blue-500' : part.part === 2 ? 'border-amber-500' : 'border-purple-500';

              return (
                <button
                  key={part.part}
                  onClick={() => setCurrentPart(part.part as 1 | 2 | 3)}
                  className={`flex items-center gap-3 px-6 py-4 border-b-2 transition-all whitespace-nowrap ${
                    currentPart === part.part
                      ? `${activeColorClass} text-gray-900 bg-gray-50/50`
                      : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50/30"
                  }`}
                >
                  <Icon className={`w-5 h-5 ${currentPart === part.part ? colorClass : ''}`} />
                  <div className="text-left">
                    <div className="font-semibold text-sm">{part.name}</div>
                    <div className="text-xs text-gray-400">
                      {part.timeLimit} {t('vstep.speaking.partTab.minutes')}
                    </div>
                  </div>
                  {hasData && (
                    <div className={`w-1.5 h-1.5 rounded-full ${currentPart === part.part ? colorClass.replace('text-', 'bg-') : 'bg-emerald-400'}`}></div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">{t('vstep.speaking.loading')}</p>
            </div>
          </div>
        ) : (
          <div className="max-w-[1200px] mx-auto px-6 py-8 min-h-full">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden min-h-[600px]">
              <div className="px-6 py-4 border-b border-gray-100 flex-shrink-0 bg-gradient-to-r from-gray-50/50 to-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                      {currentPart === 1 ? (
                        <MessageSquare className="w-5 h-5 text-blue-500" />
                      ) : currentPart === 2 ? (
                        <Lightbulb className="w-5 h-5 text-amber-500" />
                      ) : (
                        <Users className="w-5 h-5 text-purple-500" />
                      )}
                    </div>
                    <h2 className="text-base font-semibold text-gray-800">
                      {currentPartData.partName}
                    </h2>
                  </div>
                  
                  <button
                    onClick={() => handleSavePart(currentPart)}
                    disabled={savingPart === currentPart}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm text-white bg-gradient-to-r from-gray-700 to-gray-800 rounded-xl hover:from-gray-800 hover:to-gray-900 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                  >
                    <Save className="w-4 h-4" />
                    {savingPart === currentPart ? t('vstep.speaking.actions.saving') : t('vstep.speaking.actions.savePart')}
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                {currentPart === 1 && renderPart1()}
                {currentPart === 2 && renderPart2()}
                {currentPart === 3 && renderPart3()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
