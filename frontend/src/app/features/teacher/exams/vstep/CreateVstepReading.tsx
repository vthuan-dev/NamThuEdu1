import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router";
import { ArrowLeft, Save, BookOpen, FileText, CheckCircle2, Sparkles } from "lucide-react";
import { useToast } from "../../../../../hooks/useToast";
import { useTranslation } from "react-i18next";
import { QuillEditor } from "../../../../../components/ui/QuillEditor";
import { saveVstepPart, publishVstepExam, loadVstepExam } from "../../../../../services/vstepApi";
import { VstepImportModal } from "./VstepImportModal";
import "react-quill-new/dist/quill.snow.css";

interface Question {
  id: string;
  questionNumber: number;
  questionText: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: "A" | "B" | "C" | "D";
}

interface ReadingPart {
  partNumber: 1 | 2 | 3 | 4;
  partName: string;
  passage: string;
  wordCount: [number, number];
  questions: Question[];
}

const VSTEP_READING_PARTS = [
  { part: 1, name: "Passage 1 - Short Text", description: "vstep.reading.parts.1.description", wordCount: [400, 500] as [number, number] },
  { part: 2, name: "Passage 2 - Descriptive", description: "vstep.reading.parts.2.description", wordCount: [400, 500] as [number, number] },
  { part: 3, name: "Passage 3 - Argumentative", description: "vstep.reading.parts.3.description", wordCount: [500, 600] as [number, number] },
  { part: 4, name: "Passage 4 - Academic", description: "vstep.reading.parts.4.description", wordCount: [600, 700] as [number, number] },
];

interface CreateVstepReadingProps {
  examId?: string;
  onComplete?: () => void;
  isFullTest?: boolean;
}

export const CreateVstepReading = ({ examId: propExamId, onComplete, isFullTest = false }: CreateVstepReadingProps = {}) => {
  const navigate = useNavigate();
  const { success, error } = useToast();
  const { t } = useTranslation();
  const quillRef = useRef<any>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useParams();
  const urlExamId = params.examId || searchParams.get('id');
  const isEditMode = !!params.examId;

  // Initialize examId from props or URL
  const initialExamId = propExamId || urlExamId || `vstep-reading-${Date.now()}`;
  const [examId, setExamId] = useState<string>(initialExamId);
  const [examTitle, setExamTitle] = useState<string>(t('vstep.reading.title'));
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savingPart, setSavingPart] = useState<number | null>(null);
  const [currentPart, setCurrentPart] = useState<1 | 2 | 3 | 4>(1);
  const [showTip, setShowTip] = useState(true);
  const [savedParts, setSavedParts] = useState<Set<number>>(new Set());
  const [showImportModal, setShowImportModal] = useState(false);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [parts, setParts] = useState<ReadingPart[]>(
    VSTEP_READING_PARTS.map((p) => ({
      partNumber: p.part as 1 | 2 | 3 | 4,
      partName: p.name,
      passage: "",
      wordCount: p.wordCount,
      questions: Array.from({ length: 10 }, (_, i) => ({
        id: `part${p.part}-q${i + 1}`,
        questionNumber: i + 1,
        questionText: "",
        options: { A: "", B: "", C: "", D: "" },
        correctAnswer: "A" as "A" | "B" | "C" | "D",
      })),
    }))
  );

  const currentPartData = parts.find((p) => p.partNumber === currentPart)!;

  // Initialize or load exam
  useEffect(() => {
    // Priority: propExamId (from Full Test) > URL param > generate new
    const effectiveExamId = propExamId || urlExamId;
    
    if (effectiveExamId) {
      // Update examId state if different
      if (effectiveExamId !== examId) {
        setExamId(effectiveExamId);
      }
      
      // Update URL if not in Full Test mode and URL doesn't have ID (skip if on /sua/:examId route)
      if (!isFullTest && !params.examId && !searchParams.get('id')) {
        setSearchParams({ id: effectiveExamId }, { replace: true });
      }
      
      // Load exam data from API
      console.log("Loading existing exam:", effectiveExamId, "isFullTest:", isFullTest);
      setIsLoading(true);
      loadVstepExam(effectiveExamId)
        .then((response) => {
          console.log("📥 API Response:", response);
          if (response.status === 'success' && response.data) {
            const examData = response.data;
            console.log("📦 Exam Data:", examData);
            console.log("📋 Raw parts from API:", JSON.stringify(examData.parts, null, 2));
            setExamTitle(examData.title);
            
            // Map loaded parts to state
            const loadedParts = examData.parts.map((part: any) => {
              // If no questions in DB, use default 10 empty questions for CREATE mode
              const hasQuestions = part.questions && part.questions.length > 0;
              const questions = hasQuestions 
                ? part.questions.map((q: any, index: number) => ({
                    id: `part${part.partNumber}-q${index + 1}`,
                    questionNumber: q.questionNumber,
                    questionText: q.questionText,
                    options: q.options,
                    correctAnswer: q.correctAnswer,
                  }))
                : Array.from({ length: 10 }, (_, i) => ({
                    id: `part${part.partNumber}-q${i + 1}`,
                    questionNumber: i + 1,
                    questionText: "",
                    options: { A: "", B: "", C: "", D: "" },
                    correctAnswer: "A" as "A" | "B" | "C" | "D",
                  }));
              
              return {
                partNumber: part.partNumber as 1 | 2 | 3 | 4,
                partName: part.partName,
                passage: part.passage,
                wordCount: VSTEP_READING_PARTS[part.partNumber - 1].wordCount,
                questions,
              };
            });
            
            console.log("✅ Loaded parts:", loadedParts);
            console.log("📊 Questions per part:", loadedParts.map((p: any) => `Part ${p.partNumber}: ${p.questions.length} questions`));
            
            // Merge with default parts (in case some parts are not saved yet)
            setParts((prev) => {
              const merged = prev.map((p) => {
                const loaded = loadedParts.find((lp: any) => lp.partNumber === p.partNumber);
                return loaded || p;
              });
              console.log("🔄 Merged parts:", merged);
              console.log("🔍 Current part questions:", merged.find(p => p.partNumber === 1)?.questions.length);
              return merged;
            });

            // Mark parts already saved (have passage + at least 1 question)
            const newSaved = new Set<number>();
            examData.parts.forEach((part: any) => {
              if (part.passage?.trim() && part.questions?.length > 0) {
                newSaved.add(part.partNumber);
              }
            });
            setSavedParts(newSaved);
            
            console.log('✅ Loaded parts:', loadedParts.length);
            success(t('vstep.reading.toast.loadSuccess'));
          } else {
            console.warn("⚠️ No data in response:", response);
          }
        })
        .catch((err) => {
          console.error('❌ Load error:', err);
          console.log('Exam not found or error loading, starting fresh:', err);
          // Not an error - just means it's a new exam
        })
        .finally(() => setIsLoading(false));
    } else if (!isFullTest && !params.examId) {
      // No ID anywhere and not in Full Test, add generated ID to URL
      console.log('Adding exam ID to URL:', examId);
      setSearchParams({ id: examId }, { replace: true });
    }
  }, [propExamId, reloadTrigger]); // Re-run when propExamId or reloadTrigger changes

  // Auto-hide tip after 10 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTip(false);
    }, 10000);

    return () => clearTimeout(timer);
  }, []);

  const updatePassage = (content: string) => {
    setParts((prev) =>
      prev.map((p) =>
        p.partNumber === currentPart ? { ...p, passage: content } : p
      )
    );
  };

  const updateQuestion = (questionId: string, field: string, value: any) => {
    setParts((prev) =>
      prev.map((p) =>
        p.partNumber === currentPart
          ? {
              ...p,
              questions: p.questions.map((q) =>
                q.id === questionId ? { ...q, [field]: value } : q
              ),
            }
          : p
      )
    );
  };

  const updateOption = (questionId: string, option: "A" | "B" | "C" | "D", value: string) => {
    setParts((prev) =>
      prev.map((p) =>
        p.partNumber === currentPart
          ? {
              ...p,
              questions: p.questions.map((q) =>
                q.id === questionId
                  ? { ...q, options: { ...q.options, [option]: value } }
                  : q
              ),
            }
          : p
      )
    );
  };

  const handleQuestionPaste = (
    event: React.ClipboardEvent<HTMLInputElement>,
    questionId: string
  ) => {
    const value = event.clipboardData.getData('text');
    const firstOption = value.match(/\b([A-D])\.\s+/i);
    const optionCount = ['A', 'B', 'C', 'D'].filter((letter) =>
      new RegExp(`\\b${letter}\\.\\s+`, 'i').test(value)
    ).length;
    if (!firstOption || optionCount < 2) return;

    const options: Partial<Record<'A' | 'B' | 'C' | 'D', string>> = {};
    const firstIndex = firstOption.index!;
    const tokens = value.substring(firstIndex).split(/\b([A-D])\.\s+/i).filter((token) => token.trim());
    for (let index = 0; index < tokens.length - 1; index += 2) {
      const letter = tokens[index].toUpperCase() as 'A' | 'B' | 'C' | 'D';
      const optionText = tokens[index + 1].trim();
      if (optionText) options[letter] = optionText;
    }

    event.preventDefault();
    setParts((previous) => previous.map((part) =>
      part.partNumber === currentPart
        ? {
            ...part,
            questions: part.questions.map((question) =>
              question.id === questionId
                ? {
                    ...question,
                    questionText: value.substring(0, firstIndex).replace(/^\s*\d+\s*[.)]\s*/, '').trim(),
                    options: { ...question.options, ...options },
                  }
                : question
            ),
          }
        : part
    ));
  };

  const handleOptionsPaste = (
    event: React.ClipboardEvent<HTMLInputElement>,
    questionId: string
  ) => {
    const value = event.clipboardData.getData('text');
    const matches = [...value.matchAll(/(?:^|\s)([A-D])\.\s*(.*?)(?=(?:\s+[A-D]\.\s)|$)/gis)];
    if (matches.length < 2) return;

    const options: Partial<Record<'A' | 'B' | 'C' | 'D', string>> = {};
    matches.forEach((match) => {
      options[match[1].toUpperCase() as 'A' | 'B' | 'C' | 'D'] = match[2].trim();
    });
    event.preventDefault();
    setParts((previous) => previous.map((part) =>
      part.partNumber === currentPart
        ? {
            ...part,
            questions: part.questions.map((question) =>
              question.id === questionId
                ? { ...question, options: { ...question.options, ...options } }
                : question
            ),
          }
        : part
    ));
  };

  const countWords = (text: string) => {
    const plainText = text.replace(/<[^>]*>/g, " ").trim();
    return plainText.split(/\s+/).filter((word) => word.length > 0).length;
  };

  const wordCount = countWords(currentPartData.passage);
  const [minWords, maxWords] = currentPartData.wordCount;
  const isWordCountValid = wordCount >= minWords && wordCount <= maxWords;

  const handleSavePart = async (partNumber: 1 | 2 | 3 | 4) => {
    console.log('=== START handleSavePart ===');
    console.log('partNumber:', partNumber);
    console.log('examId:', examId);

    const part = parts.find(p => p.partNumber === partNumber);
    if (!part) {
      console.error('❌ Part not found:', partNumber);
      return;
    }
    console.log('✅ Part found:', part.partName);

    // Check if at least one question is complete
    const completedQuestions = part.questions.filter(q => 
      q.questionText.trim() && q.options.A && q.options.B && q.options.C && q.options.D
    );
    console.log('Completed questions:', completedQuestions.length, '/', part.questions.length);

    if (completedQuestions.length === 0) {
      console.error('❌ No completed questions');
      error(t('vstep.reading.toast.noQuestion', { part: partNumber }));
      return;
    }
    console.log('✅ Has completed questions');

    // Check passage word count (WARNING ONLY - không chặn)
    const wc = countWords(part.passage);
    console.log('Passage word count:', wc, '(recommended:', part.wordCount[0], '-', part.wordCount[1], ')');
    
    let wordCountWarning = '';
    if (part.passage.trim()) {
      if (wc < part.wordCount[0]) {
        wordCountWarning = t('vstep.reading.toast.wordCountLow', { count: part.wordCount[0] - wc, current: wc, min: part.wordCount[0], max: part.wordCount[1] });
        console.log('⚠️ Word count below minimum');
      } else if (wc > part.wordCount[1]) {
        wordCountWarning = t('vstep.reading.toast.wordCountHigh', { count: wc - part.wordCount[1], current: wc, min: part.wordCount[0], max: part.wordCount[1] });
        console.log('⚠️ Word count above maximum');
      } else {
        console.log('✅ Word count valid');
      }
    } else {
      wordCountWarning = t('vstep.reading.toast.noPassage');
      console.log('⚠️ No passage');
    }

    console.log('✅ All validations passed, starting save...');
    setSavingPart(partNumber);
    
    try {
      const partData = {
        partNumber: part.partNumber,
        partName: part.partName,
        passage: part.passage,
        wordCount: wc,
        completedQuestions: completedQuestions.length,
        totalQuestions: part.questions.length,
        questions: completedQuestions.map(q => ({
          questionNumber: q.questionNumber,
          questionText: q.questionText,
          options: q.options,
          correctAnswer: q.correctAnswer,
        })),
      };

      console.log('📦 Part data prepared:', {
        examId: examId,
        partNumber: partData.partNumber,
        wordCount: partData.wordCount,
        completedQuestions: partData.completedQuestions,
        totalQuestions: partData.totalQuestions,
      });

      // Call real API
      const response = await saveVstepPart(examId, partNumber, partData);
      
      console.log('✅ API response:', response);

      // Success message with warning if needed
      success(t('vstep.reading.toast.savePartSuccess', { part: partNumber, count: completedQuestions.length, warning: wordCountWarning }));
      console.log('=== END handleSavePart SUCCESS ===');

      // Mark part as saved
      setSavedParts((prev) => {
        const next = new Set(prev);
        next.add(partNumber);
        return next;
      });

      // Notify Full Test parent khi lưu thành công
      if (isFullTest && onComplete) {
        onComplete();
      }
    } catch (err: any) {
      console.error('❌ Save error:', err);
      error(err.response?.data?.message || t('vstep.reading.toast.savePartError', { part: partNumber }));
    } finally {
      setSavingPart(null);
      console.log('=== END handleSavePart ===');
    }
  };

  const handleSave = async () => {
    console.log('handleSave called - examId:', examId);

    // Validate parts (in edit mode, skip empty parts with no content)
    for (const part of parts) {
      const wc = countWords(part.passage);
      const hasAnyQuestion = part.questions.some(q => q.questionText.trim());
      const hasContent = part.passage.trim() || hasAnyQuestion;

      // In edit mode, skip completely empty parts
      if (isEditMode && !hasContent) continue;

      if (wc < part.wordCount[0] || wc > part.wordCount[1]) {
        error(t('vstep.reading.toast.invalidWordCount', { part: part.partNumber, current: wc, min: part.wordCount[0], max: part.wordCount[1] }));
        return;
      }
      
      for (const q of part.questions) {
        if (!q.questionText.trim()) {
          error(t('vstep.reading.toast.missingQuestion', { part: part.partNumber, num: q.questionNumber }));
          return;
        }
        if (!q.options.A || !q.options.B || !q.options.C || !q.options.D) {
          error(t('vstep.reading.toast.missingOptions', { part: part.partNumber, num: q.questionNumber }));
          return;
        }
      }
    }

    setIsSaving(true);
    try {
      // Prepare exam data
      const examData = {
        title: examTitle,
        parts: parts.map(part => ({
          partNumber: part.partNumber,
          partName: part.partName,
          passage: part.passage,
          questions: part.questions.map(q => ({
            questionNumber: q.questionNumber,
            questionText: q.questionText,
            options: q.options,
            correctAnswer: q.correctAnswer,
          })),
        })),
      };

      console.log('Publishing exam:', examData);
      
      // Call real API
      const response = await publishVstepExam(examId, examData);
      
      console.log('✅ Publish response:', response);
      
      success(isEditMode ? 'Cập nhật thành công!' : t('vstep.reading.toast.publishSuccess'));
      
      // In edit mode go back, otherwise navigate to practice list
      setTimeout(() => {
        isEditMode ? navigate(-1) : navigate('/giao-vien/luyen-tap');
      }, 1500);
    } catch (err: any) {
      console.error('Publish error:', err);
      error(err.response?.data?.message || t('vstep.reading.toast.publishError'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`bg-gray-50 flex flex-col ${isFullTest ? 'h-full' : 'h-screen overflow-hidden'}`}>
      {/* Header - Hidden when in Full Test mode */}
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
                    placeholder={t('vstep.reading.title')}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    {t('vstep.reading.subtitle')}
                    <span className="ml-2 text-xs text-green-600 font-medium">• {t('vstep.reading.examIdLabel')}: {examId}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowImportModal(true)}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-lg hover:from-violet-700 hover:to-fuchsia-700 transition-all disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  Nhập từ PDF / Word
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || isLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? (isEditMode ? 'Đang cập nhật...' : t('vstep.reading.actions.publishing')) : (isEditMode ? 'Xuất bản lại' : t('vstep.reading.actions.publish'))}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Part Tabs */}
      <div className="bg-white border-b border-gray-200 flex-shrink-0">
        <div className="max-w-[1800px] mx-auto px-6">
          <div className="flex gap-2 overflow-x-auto">
            {VSTEP_READING_PARTS.map((part) => {
              const partData = parts.find((p) => p.partNumber === part.part)!;
              const wc = countWords(partData.passage);
              const isValid = wc >= part.wordCount[0] && wc <= part.wordCount[1];
              const hasAllQuestions = partData.questions.every(
                (q) => q.questionText.trim() && q.options.A && q.options.B && q.options.C && q.options.D
              );

              const isSaved = savedParts.has(part.part);
              return (
                <button
                  key={part.part}
                  onClick={() => setCurrentPart(part.part as 1 | 2 | 3 | 4)}
                  className={`flex items-center gap-3 px-6 py-4 border-b-2 transition-colors whitespace-nowrap ${
                    currentPart === part.part
                      ? "border-blue-600 text-blue-600 bg-blue-50"
                      : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  <BookOpen className="w-5 h-5" />
                  <div className="text-left">
                    <div className="font-semibold">Part {part.part} - {t(part.description)}</div>
                    <div className="text-xs text-gray-500">
                      {part.wordCount[0]}-{part.wordCount[1]} {t('vstep.reading.partTab.words')} • 10 {t('vstep.reading.partTab.questions')}
                    </div>
                  </div>
                  {isSaved ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : isValid && hasAllQuestions ? (
                    <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content - 2 Columns */}
      <div className="flex-1 overflow-hidden min-h-0">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">{t('vstep.reading.loading')}</p>
            </div>
          </div>
        ) : (
          <div className="max-w-[1800px] mx-auto px-6 py-6 h-full overflow-hidden">
            <div className="grid grid-cols-[40%_60%] gap-6 h-full">
            {/* Left Column - Passage */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col overflow-hidden h-full">
              <div className="p-4 border-b border-gray-200 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <h2 className="text-lg font-semibold text-gray-900">Part {currentPart} - {t('vstep.reading.passage.title')}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-medium ${
                        isWordCountValid ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {wordCount} {t('vstep.reading.passage.wordCount')}
                    </span>
                    <span className="text-sm text-gray-500">
                      ({minWords}-{maxWords} {t('vstep.reading.passage.wordCount')})
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {t(VSTEP_READING_PARTS[currentPart - 1].description)}
                </p>
              </div>
              
              <div className="flex-1 p-4 overflow-hidden">
                <div className="h-full vstep-reading-editor">
                  <QuillEditor
                    ref={quillRef}
                    value={currentPartData.passage}
                    onChange={updatePassage}
                    theme="snow"
                    placeholder={t('vstep.reading.passage.placeholder')}
                    modules={{
                      toolbar: [
                        [{ header: [1, 2, 3, false] }],
                        ["bold", "italic", "underline"],
                        [{ list: "ordered" }, { list: "bullet" }],
                        ["link"],
                        ["clean"],
                      ],
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Right Column - Questions */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col overflow-hidden h-full">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-green-600" />
                  <h2 className="text-lg font-semibold text-gray-900">
                    Part {currentPart} - {t('vstep.reading.questions.title')}
                  </h2>
                  <span className="text-sm text-gray-500">
                    {(() => {
                      const completed = currentPartData.questions.filter(q => 
                        q.questionText.trim() && q.options.A && q.options.B && q.options.C && q.options.D
                      ).length;
                      console.log(`🎯 Rendering Part ${currentPart}: ${completed}/${currentPartData.questions.length} questions`);
                      return t('vstep.reading.questions.count', { completed });
                    })()}
                  </span>
                </div>
                
                <button
                  onClick={() => handleSavePart(currentPart)}
                  disabled={
                    savingPart === currentPart || 
                    currentPartData.questions.filter(q => 
                      q.questionText.trim() && q.options.A && q.options.B && q.options.C && q.options.D
                    ).length === 0
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={
                    currentPartData.questions.filter(q => 
                      q.questionText.trim() && q.options.A && q.options.B && q.options.C && q.options.D
                    ).length === 0 
                      ? t('vstep.reading.actions.needQuestion')
                      : ''
                  }
                >
                  <Save className="w-3.5 h-3.5" />
                  {savingPart === currentPart ? (isEditMode ? 'Đang lưu...' : t('vstep.reading.actions.saving')) : (isEditMode ? `Cập nhật Part ${currentPart}` : t('vstep.reading.actions.savePart'))}
                </button>
              </div>
              
              <div className="flex items-center justify-between">
                {/* Question Navigation - Left side */}
                <div className="flex items-center gap-2">
                  {currentPartData.questions.map((q) => {
                    const isComplete = q.questionText.trim() && q.options.A && q.options.B && q.options.C && q.options.D;
                    return (
                      <button
                        key={q.id}
                        onClick={() => {
                          const element = document.getElementById(`question-${q.id}`);
                          element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}
                        className={`w-7 h-7 rounded-full border text-xs font-medium transition-colors flex items-center justify-center ${
                          isComplete
                            ? 'border-green-500 bg-green-500 text-white hover:bg-green-600'
                            : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600'
                        }`}
                      >
                        {q.questionNumber}
                      </button>
                    );
                  })}
                </div>
                
                {/* Tip message - Right side */}
                {showTip && (
                  <p className="text-sm text-blue-600 flex items-center gap-1 animate-fade-in">
                    <span className="font-medium">{t('vstep.reading.questions.tip')}</span>
                    <span>{t('vstep.reading.questions.tipText')}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pt-2 px-4 pb-6 space-y-4">
              {currentPartData.questions.map((question) => (
                <div key={question.id} id={`question-${question.id}`} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">
                      {question.questionNumber}
                    </div>
                    <div className="flex-1 space-y-3">
                      {/* Question Text */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('vstep.reading.questions.label')}
                        </label>
                        <input
                          type="text"
                          value={question.questionText}
                          onChange={(e) =>
                            updateQuestion(question.id, "questionText", e.target.value)
                          }
                          onPaste={(event) => handleQuestionPaste(event, question.id)}
                          placeholder={t('vstep.reading.questions.placeholder')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      {/* Options */}
                      <div className="space-y-2">
                        {(["A", "B", "C", "D"] as const).map((option) => (
                          <div key={option} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`correct-${question.id}`}
                              checked={question.correctAnswer === option}
                              onChange={() =>
                                updateQuestion(question.id, "correctAnswer", option)
                              }
                              className="w-4 h-4 text-green-600 focus:ring-green-500 accent-green-600"
                            />
                            <div className="flex-shrink-0 w-6 h-6 bg-gray-100 rounded flex items-center justify-center text-sm font-medium">
                              {option}
                            </div>
                            <input
                              type="text"
                              value={question.options[option]}
                              onChange={(e) =>
                                updateOption(question.id, option, e.target.value)
                              }
                              onPaste={(event) => handleOptionsPaste(event, question.id)}
                              onDoubleClick={() =>
                                updateQuestion(question.id, "correctAnswer", option)
                              }
                              placeholder={t('vstep.reading.questions.answerPlaceholder', { option })}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-text"
                              title={t('vstep.reading.questions.doubleClickTitle')}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          </div>
        </div>
        )}
      </div>

      <VstepImportModal
        open={showImportModal}
        examId={examId}
        limitToSkill="reading"
        onClose={() => setShowImportModal(false)}
        onSuccess={() => {
          success('Import đề thành công!');
          setReloadTrigger(prev => prev + 1);
        }}
      />
    </div>
  );
};
