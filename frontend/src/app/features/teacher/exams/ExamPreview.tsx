import { useParams, useNavigate } from "react-router";
import { ArrowLeft, Clock, Volume2, Undo2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { getKidsExam } from "../../../../services/kidsExamApi";
import { useToast } from "../../../../hooks/useToast";
import { ToastContainer } from "../../../../components/ui/ToastContainer";
import { getFullMediaUrl } from "../../../../utils/mediaUtils";
import { 
  ObjectPlacement, 
  PictureQuestions,
  InformationExchange,
  PictureCardQuestions,
  ListeningLetterMatch,
  FindDifferences,
  UnscrambleWords,
  OddOneOut,
  PictureStoryNarration,
  ClozeTest,
  DialogueMatching,
  WordDefinitionMatching,
  ListenColourWrite,
  WordBankFill,
  OpenCloze,
  ReadingComprehension,
  StoryCompletion,
  PictureStoryWriting,
  PictureSentenceWriting,
  ListenAndDrawLines,
  ListenAndTick,
  ListenAndWrite,
  LookAndRead,
  LookReadWrite
} from "../../../../components/exam/questions";

interface Question {
  qId: number;
  qContent: string;
  qType: string;
  qPoints: number;
  qPart: number;
  qSubPart: number | null;
  kids_task_config: any;
}

interface ExamData {
  eId: number;
  eTitle: string;
  eDescription: string;
  eDuration: number;
  questions: Question[];
}

export function ExamPreview({ admin = false, backTo, hideSubmit = false }: { admin?: boolean; backTo?: string; hideSubmit?: boolean } = {}) {
  const { examId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [examData, setExamData] = useState<ExamData | null>(null);
  const [interactiveMode, setInteractiveMode] = useState(false);
  const [currentPartIndex, setCurrentPartIndex] = useState(0);
  
  // State for interactive answers
  const [userAnswers, setUserAnswers] = useState<{ [questionId: number]: any }>({});
  
  // State for uploaded images
  const [uploadedImages, setUploadedImages] = useState<{ [key: string]: File }>({});
  
  // State for submit confirmation modal
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  
  // State for interactive mode confirmation modal
  const [showInteractiveModeModal, setShowInteractiveModeModal] = useState(false);
  
  // State for image refs (for drawing lines - use image as coordinate reference)
  const [imageRefs, setImageRefs] = useState<{ [questionId: number]: HTMLImageElement | null }>({});
  
  // State for label refs (to get actual label positions)
  const [labelRefs, setLabelRefs] = useState<{ [key: string]: HTMLDivElement | null }>({});

  // Timer state
  const [timeRemaining, setTimeRemaining] = useState<number>(0); // in seconds
  const [timerActive, setTimerActive] = useState(false);
  const [tenMinuteWarningShown, setTenMinuteWarningShown] = useState(false);

  useEffect(() => {
    loadExamData();
  }, [examId]);

  // Initialize timer when exam data loads
  useEffect(() => {
    if (examData && interactiveMode) {
      setTimeRemaining(examData.eDuration * 60); // Convert minutes to seconds
      setTimerActive(true);
      setTenMinuteWarningShown(false); // Reset warning flag
    } else {
      setTimerActive(false);
    }
  }, [examData, interactiveMode]);

  // Countdown timer
  useEffect(() => {
    if (!timerActive || timeRemaining <= 0) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setTimerActive(false);
          toast.warning('⏰ Hết giờ làm bài!');
          return 0;
        }
        
        // Show 10-minute warning once
        if (prev === 600 && !tenMinuteWarningShown) {
          setTenMinuteWarningShown(true);
          toast.warning('⏰ Còn 10 phút nữa là hết giờ!');
        }
        
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timerActive, timeRemaining, tenMinuteWarningShown]);

  // Auto-advance to next part when current part is completed
  useEffect(() => {
    if (!interactiveMode || !examData) return;

    // Need to define getPartStatus here or move it up
    // For now, we'll check in the render section and trigger from answer updates
  }, [userAnswers, currentPartIndex, interactiveMode, examData]);

  const loadExamData = async () => {
    if (!examId) return;

    try {
      setLoading(true);
      const response = await getKidsExam(parseInt(examId), admin);
      console.log('📥 Loaded exam for preview:', response);
      // API returns exam directly, not wrapped in { exam: ... }
      setExamData(response);
    } catch (error: any) {
      console.error('❌ Failed to load exam:', error);
      toast.error('Không thể tải đề thi!');
    } finally {
      setLoading(false);
    }
  };

  const getPartName = (partNumber: number) => {
    const partNames: { [key: number]: { name: string; icon: string; color: string } } = {
      1: { name: 'LISTENING', icon: '🎧', color: 'bg-blue-500' },
      2: { name: 'READING & WRITING', icon: '📖', color: 'bg-purple-500' },
      3: { name: 'SPEAKING', icon: '🗣️', color: 'bg-orange-500' },
    };
    return partNames[partNumber] || { name: `PART ${partNumber}`, icon: '📝', color: 'bg-gray-500' };
  };

  const getTaskTypeName = (taskType: string) => {
    const taskTypeNames: { [key: string]: string } = {
      'listen_and_draw_lines': 'Listen and Draw Lines',
      'listen_and_write': 'Listen and Write',
      'listen_and_tick': 'Listen and Tick',
      'listen_colour_write': 'Listen, Colour and Write',
      'look_and_read': 'Look and Read',
      'look_read_write': 'Look, Read and Write',
      'unscramble_words': 'Unscramble Words',
      'cloze_test': 'Cloze Test',
      'dialogue_matching': 'Dialogue Matching',
      'word_definition_matching': 'Word Definition Matching',
      'word_bank_fill': 'Word Bank Fill',
      'find_differences': 'Find Differences',
      'picture_story_narration': 'Picture Story Narration',
      'odd_one_out': 'Odd One Out',
      'information_exchange': 'Information Exchange',
      'object_placement': 'Object Placement',
      'picture_questions': 'Picture Questions',
      'picture_card_questions': 'Picture Card Questions',
      'listening_letter_match': 'Listening Letter Match',
    };
    return taskTypeNames[taskType] || taskType;
  };

  // Interactive handlers for drag and drop
  const handleDragStart = (e: React.DragEvent, questionId: number, itemIndex: number) => {
    console.log('🎯 Drag started:', { questionId, itemIndex });
    e.dataTransfer.setData('questionId', questionId.toString());
    e.dataTransfer.setData('itemIndex', itemIndex.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, questionId: number, targetIndex: number) => {
    e.preventDefault();
    const draggedQuestionId = parseInt(e.dataTransfer.getData('questionId'));
    const draggedItemIndex = parseInt(e.dataTransfer.getData('itemIndex'));
    
    console.log('🎯 Drop event:', { draggedQuestionId, draggedItemIndex, targetIndex, questionId });
    
    if (draggedQuestionId === questionId) {
      const newAnswers = {
        ...userAnswers,
        [questionId]: {
          ...userAnswers[questionId],
          [draggedItemIndex]: targetIndex
        }
      };
      
      setUserAnswers(newAnswers);
      toast.success('Đã nối!');
      
      // Check if part is completed after this answer
      setTimeout(() => checkAndAdvancePart(newAnswers), 500);
    }
  };

  const handleResetQuestion = (questionId: number) => {
    setUserAnswers(prev => ({
      ...prev,
      [questionId]: {}
    }));
    toast.info('🔄 Đã reset câu hỏi');
  };

  const handleResetAll = () => {
    setUserAnswers({});
    toast.info('🔄 Đã reset tất cả câu trả lời');
  };

  // Handle click on hotspot to undo connection
  const handleHotspotClick = (questionId: number, hotspotIndex: number) => {
    if (!interactiveMode) return;
    
    const questionAnswers = userAnswers[questionId] || {};
    
    // Find which label is connected to this hotspot
    const labelIndex = Object.keys(questionAnswers).find(
      key => questionAnswers[parseInt(key)] === hotspotIndex
    );
    
    if (labelIndex) {
      // Remove the connection
      const newAnswers = { ...questionAnswers };
      delete newAnswers[parseInt(labelIndex)];
      
      setUserAnswers(prev => ({
        ...prev,
        [questionId]: newAnswers
      }));
      
      toast.info('🔄 Đã khôi phục câu trả lời!');
    }
  };

  // Handle submit exam
  const handleSubmitExam = () => {
    // Count answered questions
    const answeredCount = Object.keys(userAnswers).length;
    const totalQuestions = examData?.questions.length || 0;
    
    if (answeredCount === 0) {
      toast.error('Bạn chưa trả lời câu hỏi nào!');
      return;
    }
    
    setShowSubmitModal(true);
  };

  const confirmSubmit = () => {
    // Prepare submission data
    const submissionData = {
      examId: examData?.eId,
      answers: userAnswers,
      uploadedImages: Object.keys(uploadedImages).length,
      submittedAt: new Date().toISOString()
    };
    
    console.log('📤 Submitting exam:', submissionData);
    
    // TODO: Call API to submit exam
    toast.success('🎉 Xuất sắc! Bạn đã nộp bài thành công! 🌟');
    setShowSubmitModal(false);
    
    // Reset interactive mode after submit
    setTimeout(() => {
      setInteractiveMode(false);
      setUserAnswers({});
      setUploadedImages({});
    }, 1500);
  };

  const handleToggleInteractiveMode = () => {
    if (!interactiveMode) {
      // Entering interactive mode - show confirmation
      setShowInteractiveModeModal(true);
    } else {
      // Exiting interactive mode - just toggle
      setInteractiveMode(false);
      setUserAnswers({});
      setUploadedImages({});
      toast.info('👁️ Đã chuyển sang chế độ xem');
    }
  };

  const confirmInteractiveMode = () => {
    setShowInteractiveModeModal(false);
    setInteractiveMode(true);
    toast.success('🎮 Chế độ tương tác đã bật! Hãy thử làm bài nhé!');
  };

  // Check if current part is completed and auto-advance to next part
  const checkAndAdvancePart = (answers: { [questionId: number]: any }) => {
    if (!examData || !interactiveMode) return;

    // Build allParts structure (same as in render)
    const allParts: Array<{
      part: number;
      subPart: number | null;
      questions: Question[];
    }> = [];

    examData.questions.forEach((question) => {
      const existingPart = allParts.find(
        (p) => p.part === question.qPart && p.subPart === question.qSubPart
      );

      if (!existingPart) {
        allParts.push({
          part: question.qPart,
          subPart: question.qSubPart,
          questions: [question],
        });
      } else {
        existingPart.questions.push(question);
      }
    });

    allParts.sort((a, b) => {
      if (a.part !== b.part) return a.part - b.part;
      return (a.subPart || 0) - (b.subPart || 0);
    });

    // Check if current part is completed
    const currentPart = allParts[currentPartIndex];
    if (!currentPart) return;

    const isPartCompleted = currentPart.questions.every((question) => {
      const answer = answers[question.qId];
      if (answer === undefined) return false;

      // Get task data
      const taskData = question.kids_task_config || {};
      const realTaskData = taskData.task_data || taskData;
      const config = taskData.config || realTaskData.config || {};
      const actualTaskType = question.qType === 'kids_task'
        ? (taskData.task_type || realTaskData.task_type || config.task_type || question.qType)
        : question.qType;

      // Check completion based on task type
      if (actualTaskType === 'listen_and_draw_lines') {
        const items = realTaskData?.items || config?.items || [];
        const hotspotsCount = items.filter((item: any) => item.hotspot).length;
        const answeredCount = typeof answer === 'object' && !Array.isArray(answer)
          ? Object.keys(answer).length
          : 0;
        return answeredCount === hotspotsCount && hotspotsCount > 0;
      }

      if (actualTaskType === 'listen_and_tick') {
        const items = realTaskData?.items || config?.items || [];
        const answeredCount = typeof answer === 'object' && !Array.isArray(answer)
          ? Object.keys(answer).length
          : 0;
        return answeredCount === items.length && items.length > 0;
      }

      if (actualTaskType === 'listen_and_write') {
        const items = realTaskData?.items || config?.items || realTaskData?.questions || config?.questions || [];
        const answeredCount = typeof answer === 'object' && !Array.isArray(answer)
          ? Object.keys(answer).length
          : 0;
        return answeredCount === items.length && items.length > 0;
      }

      if (actualTaskType === 'look_and_read' || actualTaskType === 'look_read_write') {
        const questions = realTaskData?.questions || config?.questions || realTaskData?.items || config?.items || [];
        const answeredCount = typeof answer === 'object' && !Array.isArray(answer)
          ? Object.keys(answer).length
          : 0;
        return answeredCount === questions.length && questions.length > 0;
      }

      if (actualTaskType === 'word_bank_fill' || actualTaskType === 'cloze_test') {
        const questions = realTaskData?.questions || config?.questions || realTaskData?.items || config?.items || [];
        const answeredCount = typeof answer === 'object' && !Array.isArray(answer)
          ? Object.keys(answer).length
          : 0;
        return answeredCount === questions.length && questions.length > 0;
      }

      // For other types
      if (typeof answer === 'object' && !Array.isArray(answer)) {
        return Object.keys(answer).length > 0;
      }

      return true;
    });

    // If part is completed and not the last part, advance to next
    if (isPartCompleted && currentPartIndex < allParts.length - 1) {
      toast.success(`🎉 Hoàn thành Part ${currentPart.part}.${currentPart.subPart || ''}! Chuyển sang phần tiếp theo...`);
      setTimeout(() => {
        setCurrentPartIndex(currentPartIndex + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 1000);
    }
  };

  const renderQuestionContent = (question: Question) => {
    const taskData = question.kids_task_config || {};
    
    // Extract real data from task_data if it exists
    const realTaskData = taskData.task_data || taskData;
    const config = taskData.config || realTaskData.config || {};
    const instructions = taskData.instructions || realTaskData.instructions || config.instructions;
    
    // Try multiple possible image URL field names - check all levels
    const imageUrl = realTaskData?.imageUrl || 
                     realTaskData?.image_url || 
                     realTaskData?.mainImage ||
                     realTaskData?.mainImageUrl ||  // Added this
                     realTaskData?.sharedImageUrl ||
                     realTaskData?.shared_image_url ||
                     config?.imageUrl ||
                     config?.image_url ||
                     config?.mainImage ||
                     config?.mainImageUrl ||
                     config?.sharedImageUrl ||
                     config?.shared_image_url;
    
    const audioUrl = realTaskData?.audioUrl || 
                     realTaskData?.audio_url || 
                     realTaskData?.mainAudioUrl ||  // Added this
                     config?.audioUrl || 
                     config?.audio_url ||
                     config?.mainAudioUrl;
    
    // Get the actual task type from config if qType is 'kids_task'
    const actualTaskType = question.qType === 'kids_task' 
      ? (taskData.task_type || realTaskData.task_type || config.task_type || question.qType)
      : question.qType;
    
    // Debug log - show full structure
    console.log('🔍 Question', question.qId, '- Full structure:', {
      qType: question.qType,
      actualTaskType: actualTaskType,
      taskData_keys: Object.keys(taskData),
      realTaskData_keys: Object.keys(realTaskData),
      config_keys: Object.keys(config),
      imageUrl: imageUrl,
      audioUrl: audioUrl,
      hasItems: !!realTaskData?.items || !!config?.items,
      itemsCount: (realTaskData?.items || config?.items || []).length
    });
    
    // Get items from either realTaskData or config
    const items = realTaskData?.items || config?.items || [];
    
    // Initialize user answers for this question if in interactive mode
    if (interactiveMode && !userAnswers[question.qId]) {
      setUserAnswers(prev => ({
        ...prev,
        [question.qId]: {}
      }));
    }
    
    // Render based on task type
    switch (actualTaskType) {
      case 'listen_and_draw_lines':
        return (
          <ListenAndDrawLines
            question={question}
            mode={interactiveMode ? 'student' : 'preview'}
            answer={userAnswers[question.qId] || {}}
            onAnswer={(answer) => {
              setUserAnswers(prev => ({ ...prev, [question.qId]: answer }));
            }}
            imageRefs={imageRefs}
            labelRefs={labelRefs}
            onSetImageRef={(qId, ref) => {
              setImageRefs(prev => ({ ...prev, [qId]: ref }));
            }}
            onSetLabelRef={(key, ref) => {
              setLabelRefs(prev => ({ ...prev, [key]: ref }));
            }}
            onResetQuestion={(qId) => {
              setUserAnswers(prev => {
                const newAnswers = { ...prev };
                delete newAnswers[qId];
                return newAnswers;
              });
            }}
          />
        );
      
      case 'listen_and_tick':
        return (
          <ListenAndTick
            question={question}
            mode={interactiveMode ? 'student' : 'preview'}
            answer={userAnswers[question.qId] || {}}
            onAnswer={(answer) => {
              setUserAnswers(prev => ({ ...prev, [question.qId]: answer }));
            }}
          />
        );
      
      case 'listen_and_write':
        return (
          <ListenAndWrite
            question={question}
            mode={interactiveMode ? 'student' : 'preview'}
            answer={userAnswers[question.qId] || {}}
            onAnswer={(answer) => {
              setUserAnswers(prev => ({ ...prev, [question.qId]: answer }));
            }}
          />
        );
      
      case 'listen_colour_write':
        return (
          <ListenColourWrite
            question={question}
            taskData={taskData}
            interactiveMode={interactiveMode}
            userAnswer={userAnswers[question.qId]}
            onAnswerChange={(answer) => {
              setUserAnswers(prev => ({ ...prev, [question.qId]: answer }));
            }}
          />
        );
      case 'look_and_read':
        return (
          <LookAndRead
            question={question}
            mode={interactiveMode ? 'student' : 'preview'}
            answer={userAnswers[question.qId] || {}}
            onAnswer={(answer) => {
              setUserAnswers(prev => ({ ...prev, [question.qId]: answer }));
            }}
          />
        );
      
      case 'look_read_write':
        return (
          <LookReadWrite
            question={question}
            mode={interactiveMode ? 'student' : 'preview'}
            answer={userAnswers[question.qId] || {}}
            onAnswer={(answer) => {
              setUserAnswers(prev => ({ ...prev, [question.qId]: answer }));
            }}
          />
        );

      case 'word_bank_fill':
        return (
          <WordBankFill
            question={question}
            mode={interactiveMode ? 'student' : 'preview'}
            answer={userAnswers[question.qId] || {}}
            onAnswer={(answer) => {
              setUserAnswers(prev => ({ ...prev, [question.qId]: answer }));
            }}
          />
        );

      case 'cloze_test':
        return (
          <ClozeTest
            question={question}
            taskData={taskData}
            interactiveMode={interactiveMode}
            userAnswer={userAnswers[question.qId]}
            onAnswerChange={(answer) => {
              setUserAnswers(prev => ({ ...prev, [question.qId]: answer }));
            }}
          />
        );

      case 'dialogue_matching':
        return (
          <DialogueMatching
            question={question}
            taskData={taskData}
            interactiveMode={interactiveMode}
            userAnswer={userAnswers[question.qId]}
            onAnswerChange={(answer) => {
              setUserAnswers(prev => ({ ...prev, [question.qId]: answer }));
            }}
          />
        );

      case 'word_definition_matching':
        return (
          <WordDefinitionMatching
            question={question}
            taskData={taskData}
            interactiveMode={interactiveMode}
            userAnswer={userAnswers[question.qId]}
            onAnswerChange={(answer) => {
              setUserAnswers(prev => ({ ...prev, [question.qId]: answer }));
            }}
          />
        );

      case 'find_differences':
        return (
          <FindDifferences
            question={question}
            taskData={taskData}
            interactiveMode={interactiveMode}
            userAnswer={userAnswers[question.qId]}
            onAnswerChange={(answer) => {
              setUserAnswers(prev => ({ ...prev, [question.qId]: answer }));
            }}
          />
        );

      case 'picture_story_narration':
        return (
          <PictureStoryNarration
            question={question}
            taskData={taskData}
            interactiveMode={interactiveMode}
            userAnswer={userAnswers[question.qId]}
            onAnswerChange={(answer) => {
              setUserAnswers(prev => ({ ...prev, [question.qId]: answer }));
            }}
          />
        );

      case 'odd_one_out':
        return (
          <OddOneOut
            question={question}
            taskData={taskData}
            interactiveMode={interactiveMode}
            userAnswer={userAnswers[question.qId]}
            onAnswerChange={(answer) => {
              setUserAnswers(prev => ({ ...prev, [question.qId]: answer }));
            }}
          />
        );

      case 'unscramble_words':
        return (
          <UnscrambleWords
            question={question}
            taskData={taskData}
            interactiveMode={interactiveMode}
            userAnswer={userAnswers[question.qId]}
            onAnswerChange={(answer) => {
              setUserAnswers(prev => ({ ...prev, [question.qId]: answer }));
            }}
          />
        );

      case 'object_placement':
        return (
          <ObjectPlacement
            question={question}
            taskData={taskData}
            interactiveMode={interactiveMode}
            userAnswer={userAnswers[question.qId]}
            onAnswerChange={(answer) => {
              setUserAnswers(prev => ({ ...prev, [question.qId]: answer }));
            }}
          />
        );

      case 'picture_questions':
        return (
          <PictureQuestions
            question={question}
            taskData={taskData}
            interactiveMode={interactiveMode}
            userAnswer={userAnswers[question.qId]}
            onAnswerChange={(answer) => {
              setUserAnswers(prev => ({ ...prev, [question.qId]: answer }));
            }}
          />
        );

      case 'picture_card_questions':
        return (
          <PictureCardQuestions
            question={question}
            taskData={taskData}
            interactiveMode={interactiveMode}
            userAnswer={userAnswers[question.qId]}
            onAnswerChange={(answer) => {
              setUserAnswers(prev => ({ ...prev, [question.qId]: answer }));
            }}
          />
        );

      case 'listening_letter_match':
        return (
          <ListeningLetterMatch
            question={question}
            taskData={taskData}
            interactiveMode={interactiveMode}
            userAnswer={userAnswers[question.qId]}
            onAnswerChange={(answer) => {
              setUserAnswers(prev => ({ ...prev, [question.qId]: answer }));
            }}
          />
        );

      case 'information_exchange':
        return (
          <InformationExchange
            question={question}
            taskData={taskData}
            interactiveMode={interactiveMode}
            userAnswer={userAnswers[question.qId]}
            onAnswerChange={(answer) => {
              setUserAnswers(prev => ({ ...prev, [question.qId]: answer }));
            }}
          />
        );

      case 'open_cloze':
        return (
          <OpenCloze
            question={question}
            taskData={taskData}
            interactiveMode={interactiveMode}
            userAnswer={userAnswers[question.qId]}
            onAnswerChange={(answer) => {
              setUserAnswers(prev => ({ ...prev, [question.qId]: answer }));
            }}
          />
        );

      case 'reading_comprehension':
        return (
          <ReadingComprehension
            question={question}
            taskData={taskData}
            interactiveMode={interactiveMode}
            userAnswer={userAnswers[question.qId]}
            onAnswerChange={(answer) => {
              setUserAnswers(prev => ({ ...prev, [question.qId]: answer }));
            }}
          />
        );

      case 'story_completion':
        return (
          <StoryCompletion
            question={question}
            taskData={taskData}
            interactiveMode={interactiveMode}
            userAnswer={userAnswers[question.qId]}
            onAnswerChange={(answer) => {
              setUserAnswers(prev => ({ ...prev, [question.qId]: answer }));
            }}
          />
        );

      case 'picture_story_writing':
        return (
          <PictureStoryWriting
            question={question}
            taskData={taskData}
            interactiveMode={interactiveMode}
            userAnswer={userAnswers[question.qId]}
            onAnswerChange={(answer) => {
              setUserAnswers(prev => ({ ...prev, [question.qId]: answer }));
            }}
          />
        );

      case 'picture_sentence_writing':
        return (
          <PictureSentenceWriting
            question={question}
            taskData={taskData}
            interactiveMode={interactiveMode}
            userAnswer={userAnswers[question.qId]}
            onAnswerChange={(answer) => {
              setUserAnswers(prev => ({ ...prev, [question.qId]: answer }));
            }}
          />
        );

      default:
        return (
          <div className="space-y-4">
            {/* Question Content */}
            {question.qContent && question.qContent !== 'kids_task' && (
              <div className="p-4 bg-white rounded-lg border-2 border-gray-200">
                <div className="text-gray-700 prose max-w-none text-lg leading-relaxed" dangerouslySetInnerHTML={{ __html: question.qContent }} />
              </div>
            )}
            
            {/* Show image if available */}
            {imageUrl && (
              <div className="border-2 border-gray-200 rounded-lg overflow-hidden">
                <img 
                  src={getFullMediaUrl(imageUrl)} 
                  alt="Question" 
                  className="w-full h-auto"
                />
              </div>
            )}
            
            {/* Show audio if available */}
            {audioUrl && (
              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                <Volume2 className="w-6 h-6 text-blue-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900">🎧 Audio Instructions</p>
                  <audio controls className="w-full mt-2">
                    <source src={getFullMediaUrl(audioUrl)} type="audio/mpeg" />
                  </audio>
                </div>
              </div>
            )}
            
            {/* Show task config if available */}
            {taskData && Object.keys(taskData).length > 0 ? (
              <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                <p className="text-sm font-bold text-blue-700 mb-3">🔧 Task Configuration:</p>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {Object.entries(taskData).slice(0, 10).map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <span className="font-medium text-blue-900 min-w-32">{key}:</span>
                      <span className="text-blue-700 break-all">
                        {typeof value === 'object' ? JSON.stringify(value).substring(0, 200) : String(value)}
                      </span>
                    </div>
                  ))}
                  {Object.keys(taskData).length > 10 && (
                    <p className="text-xs text-blue-600 italic">... và {Object.keys(taskData).length - 10} trường khác</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-6 bg-yellow-50 rounded-lg border-2 border-yellow-300 text-center">
                <p className="text-yellow-800 font-medium">⚠️ No task configuration data available</p>
                <p className="text-sm text-yellow-700 mt-2">This question may need to be edited to add content</p>
              </div>
            )}
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">📚</div>
          <p className="text-xl text-gray-600 font-medium">Loading exam...</p>
        </div>
      </div>
    );
  }

  if (!examData || !examData.questions || examData.questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-pink-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          {/* Animated Icon */}
          <div className="text-center mb-6">
            <div className="inline-block animate-bounce">
              <div className="w-24 h-24 bg-gradient-to-br from-orange-400 to-pink-500 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-5xl">📝</span>
              </div>
            </div>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center border-2 border-orange-100">
            {/* Title */}
            <h2 className="text-2xl font-bold text-gray-800 mb-3">
              Chưa Có Câu Hỏi
            </h2>
            
            {/* Description */}
            <p className="text-gray-600 mb-6 leading-relaxed">
              Đề thi này chưa có câu hỏi nào. Vui lòng thêm câu hỏi để học viên có thể làm bài.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                <div className="text-2xl mb-1">🎧</div>
                <div className="text-xs text-gray-600">Listening</div>
                <div className="text-sm font-bold text-gray-800">0</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                <div className="text-2xl mb-1">📖</div>
                <div className="text-xs text-gray-600">Reading</div>
                <div className="text-sm font-bold text-gray-800">0</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-3 border border-orange-100">
                <div className="text-2xl mb-1">🗣️</div>
                <div className="text-xs text-gray-600">Speaking</div>
                <div className="text-sm font-bold text-gray-800">0</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
                className="w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-xl hover:from-orange-600 hover:to-pink-600 transition-all inline-flex items-center justify-center gap-2 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <ArrowLeft className="w-5 h-5" />
                Quay Lại
              </button>
              
              <button
                onClick={() => navigate(`/giao-vien/de-thi/${examId}/chinh-sua`)}
                className="w-full px-6 py-3 bg-white text-orange-600 rounded-xl hover:bg-orange-50 transition-all inline-flex items-center justify-center gap-2 font-medium border-2 border-orange-200 hover:border-orange-300"
              >
                <span className="text-xl">➕</span>
                Thêm Câu Hỏi
              </button>
            </div>
          </div>

          {/* Help Text */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              💡 Mẹo: Bạn có thể thêm câu hỏi từ thư viện hoặc tạo mới
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Group questions by part (skill)
  const listeningQuestions = examData.questions.filter(q => q.qPart === 1).sort((a, b) => (a.qSubPart || 0) - (b.qSubPart || 0));
  const readingQuestions = examData.questions.filter(q => q.qPart === 2).sort((a, b) => (a.qSubPart || 0) - (b.qSubPart || 0));
  const speakingQuestions = examData.questions.filter(q => q.qPart === 3).sort((a, b) => (a.qSubPart || 0) - (b.qSubPart || 0));

  // Group questions by part and subpart for sidebar navigation
  const allParts: Array<{
    part: number;
    subPart: number | null;
    questions: Question[];
    skillName: string;
    skillIcon: string;
    skillColor: string;
  }> = [];

  examData.questions.forEach((question) => {
    const existingPart = allParts.find(
      (p) => p.part === question.qPart && p.subPart === question.qSubPart
    );

    if (!existingPart) {
      let skillName = '';
      let skillIcon = '';
      let skillColor = '';

      if (question.qPart === 1) {
        skillName = 'Listening';
        skillIcon = '🎧';
        skillColor = 'bg-gradient-to-r from-orange-500 to-orange-600';
      } else if (question.qPart === 2) {
        skillName = 'Reading';
        skillIcon = '📖';
        skillColor = 'bg-gradient-to-r from-blue-500 to-blue-600';
      } else if (question.qPart === 3) {
        skillName = 'Speaking';
        skillIcon = '🗣️';
        skillColor = 'bg-gradient-to-r from-purple-500 to-purple-600';
      }

      allParts.push({
        part: question.qPart,
        subPart: question.qSubPart,
        questions: [question],
        skillName,
        skillIcon,
        skillColor,
      });
    } else {
      existingPart.questions.push(question);
    }
  });

  // Sort parts by part number and subpart
  allParts.sort((a, b) => {
    if (a.part !== b.part) return a.part - b.part;
    return (a.subPart || 0) - (b.subPart || 0);
  });

  const currentPart = allParts[currentPartIndex];

  const handleNextPart = () => {
    if (currentPartIndex < allParts.length - 1) {
      setCurrentPartIndex(currentPartIndex + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePreviousPart = () => {
    if (currentPartIndex > 0) {
      setCurrentPartIndex(currentPartIndex - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleJumpToPart = (index: number) => {
    setCurrentPartIndex(index);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getPartStatus = (partIndex: number) => {
    const part = allParts[partIndex];
    const partQuestions = part.questions;
    
    // Count questions that are fully completed
    const completedQuestions = partQuestions.filter((question) => {
      const answer = userAnswers[question.qId];
      if (answer === undefined) return false;
      
      // Get task data to check how many items this question has
      const taskData = question.kids_task_config || {};
      const realTaskData = taskData.task_data || taskData;
      const config = taskData.config || realTaskData.config || {};
      const actualTaskType = question.qType === 'kids_task' 
        ? (taskData.task_type || realTaskData.task_type || config.task_type || question.qType)
        : question.qType;
      
      // For tasks with multiple items, check if ALL items are answered
      if (actualTaskType === 'listen_and_draw_lines') {
        const items = realTaskData?.items || config?.items || [];
        if (items.length > 0) {
          // Count how many items have hotspots (need to be connected)
          const hotspotsCount = items.filter((item: any) => item.hotspot).length;
          // Check if answer object has entries for all hotspots
          const answeredCount = typeof answer === 'object' && !Array.isArray(answer) 
            ? Object.keys(answer).length 
            : 0;
          return answeredCount === hotspotsCount && hotspotsCount > 0;
        }
      }
      
      // For listen_and_tick, check if all questions are answered
      if (actualTaskType === 'listen_and_tick') {
        const items = realTaskData?.items || config?.items || [];
        if (items.length > 0) {
          const answeredCount = typeof answer === 'object' && !Array.isArray(answer) 
            ? Object.keys(answer).length 
            : 0;
          return answeredCount === items.length && items.length > 0;
        }
      }
      
      // For listen_and_write, check if all items/questions are answered
      if (actualTaskType === 'listen_and_write') {
        const items = realTaskData?.items || config?.items || realTaskData?.questions || config?.questions || [];
        if (items.length > 0) {
          const answeredCount = typeof answer === 'object' && !Array.isArray(answer) 
            ? Object.keys(answer).length 
            : 0;
          return answeredCount === items.length && items.length > 0;
        }
      }
      
      // For look_and_read and look_read_write, check if all questions are answered
      if (actualTaskType === 'look_and_read' || actualTaskType === 'look_read_write') {
        const questions = realTaskData?.questions || config?.questions || realTaskData?.items || config?.items || [];
        if (questions.length > 0) {
          const answeredCount = typeof answer === 'object' && !Array.isArray(answer) 
            ? Object.keys(answer).length 
            : 0;
          return answeredCount === questions.length && questions.length > 0;
        }
      }
      
      // For word_bank_fill and cloze_test, check if all questions/gaps are filled
      if (actualTaskType === 'word_bank_fill' || actualTaskType === 'cloze_test') {
        const questions = realTaskData?.questions || config?.questions || realTaskData?.items || config?.items || [];
        if (questions.length > 0) {
          const answeredCount = typeof answer === 'object' && !Array.isArray(answer) 
            ? Object.keys(answer).length 
            : 0;
          return answeredCount === questions.length && questions.length > 0;
        }
      }
      
      // For other task types, check if answer exists and is not empty
      if (typeof answer === 'object' && !Array.isArray(answer)) {
        return Object.keys(answer).length > 0;
      }
      
      // For non-object answers (strings, numbers, etc.)
      return true;
    }).length;

    const totalQuestions = partQuestions.length;
    const hasAnswers = partQuestions.some((q) => {
      const answer = userAnswers[q.qId];
      if (answer === undefined) return false;
      if (typeof answer === 'object' && !Array.isArray(answer)) {
        return Object.keys(answer).length > 0;
      }
      return true;
    });

    // Debug log
    console.log(`Part ${part.part}.${part.subPart || ''} - Total: ${totalQuestions}, Completed: ${completedQuestions}`, {
      questions: partQuestions.map(q => ({ 
        qId: q.qId, 
        answer: userAnswers[q.qId],
        taskType: q.qType
      }))
    });

    if (completedQuestions === totalQuestions && totalQuestions > 0) return 'completed';
    if (partIndex === currentPartIndex) return 'current';
    if (hasAnswers) return 'in-progress';
    return 'not-started';
  };

  // Check if all parts are completed
  const areAllPartsCompleted = () => {
    return allParts.every((part, index) => getPartStatus(index) === 'completed');
  };

  const renderSkillSection = (questions: Question[], skillName: string, skillIcon: string, skillColor: string) => {
    if (questions.length === 0) return null;

    return (
      <div className="mb-8">
        {/* Skill Header */}
        <div className={`${skillColor} text-white p-4 rounded-t-2xl`}>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            {skillIcon} {skillName}
          </h2>
        </div>

        {/* Questions */}
        <div className="bg-white rounded-b-2xl shadow-xl border-4 border-gray-200 overflow-hidden">
          {questions.map((question, idx) => {
            const partInfo = getPartName(question.qPart);
            
            // Extract actual task type (same logic as in renderQuestionContent)
            const taskData = question.kids_task_config || {};
            const realTaskData = taskData.task_data || taskData;
            const config = taskData.config || realTaskData.config || {};
            const actualTaskType = question.qType === 'kids_task' 
              ? (taskData.task_type || realTaskData.task_type || config.task_type || question.qType)
              : question.qType;
            
            return (
              <div key={question.qId} className={idx > 0 ? 'border-t-4 border-gray-200' : ''}>
                {/* Question Header */}
                <div className="bg-gray-50 p-4 border-b-2 border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 font-medium">
                        {question.qSubPart ? `Part ${question.qPart}.${question.qSubPart}` : `Part ${question.qPart}`}
                      </p>
                      <h3 className="text-lg font-bold text-gray-800 mt-1">
                        {getTaskTypeName(actualTaskType)}
                      </h3>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-600">Points</p>
                      <p className="text-2xl font-bold text-orange-600">{question.qPoints}</p>
                    </div>
                  </div>
                </div>

                {/* Question Content */}
                <div className="p-6">
                  {renderQuestionContent(question)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-pink-50 font-baloo">
        {/* Timer Bar - Fixed Top */}
        <div className="bg-white border-b-4 border-orange-400 shadow-lg sticky top-0 z-50">
          <div className="w-full px-4 py-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  if (interactiveMode) {
                    toast.warning('⚠️ Không thể thoát khi đang làm bài!');
                  } else {
                    if (backTo) { navigate(backTo); } else { navigate(-1); }
                  }
                }}
                disabled={interactiveMode}
                className={`p-2 rounded-lg transition-colors ${
                  interactiveMode 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50' 
                    : 'hover:bg-gray-100 text-gray-600'
                }`}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              
              <div className="flex-1 mx-6">
                <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <span className="text-2xl">📝</span>
                  {examData.eTitle}
                </h1>
                <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                  {/* Timer Display */}
                  {interactiveMode && timerActive ? (
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full font-bold ${
                      timeRemaining < 300 
                        ? 'bg-red-100 text-red-700 animate-pulse' 
                        : timeRemaining < 600
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      <Clock className="w-4 h-4" />
                      <span className="text-lg">
                        {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
                      </span>
                    </div>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {examData.eDuration} phút
                    </span>
                  )}
                  <span className="text-gray-500">
                    Part {currentPart.subPart ? `${currentPart.part}.${currentPart.subPart}` : currentPart.part} / {allParts.length}
                  </span>
                  
                  {/* Exit Interactive Mode Button - Only show when in interactive mode */}
                  {interactiveMode && (
                    <button
                      onClick={() => {
                        setInteractiveMode(false);
                        setUserAnswers({});
                        setUploadedImages({});
                        toast.info('👁️ Đã thoát chế độ làm bài');
                      }}
                      className="ml-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium flex items-center gap-2 shadow-md"
                    >
                      <span className="text-lg">🚪</span>
                      Thoát chế độ làm bài
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Layout: Content LEFT + Sidebar RIGHT */}
        <div className="w-full px-4 py-8 flex gap-6">
          {/* Main Content Area - LEFT (Scrollable) */}
          <div className="flex-1 min-w-0">
            {/* Current Part Content */}
            <div className="mb-8">
              {/* Skill Header */}
              <div className={`${currentPart.skillColor} text-white p-4 rounded-t-2xl`}>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  {currentPart.skillIcon} {currentPart.skillName}
                </h2>
              </div>

              {/* Questions */}
              <div className="bg-white rounded-b-2xl shadow-xl border-4 border-gray-200 overflow-hidden">
                {currentPart.questions.map((question, idx) => {
                  const taskData = question.kids_task_config || {};
                  const realTaskData = taskData.task_data || taskData;
                  const config = taskData.config || realTaskData.config || {};
                  const actualTaskType = question.qType === 'kids_task' 
                    ? (taskData.task_type || realTaskData.task_type || config.task_type || question.qType)
                    : question.qType;
                  
                  return (
                    <div key={question.qId} className={idx > 0 ? 'border-t-4 border-gray-200' : ''}>
                      {/* Question Header */}
                      <div className="bg-gray-50 p-4 border-b-2 border-gray-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-600 font-medium">
                              {question.qSubPart ? `Part ${question.qPart}.${question.qSubPart}` : `Part ${question.qPart}`}
                            </p>
                            <h3 className="text-lg font-bold text-gray-800 mt-1">
                              {getTaskTypeName(actualTaskType)}
                            </h3>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-600">Points</p>
                            <p className="text-2xl font-bold text-orange-600">{question.qPoints}</p>
                          </div>
                        </div>
                      </div>

                      {/* Question Content */}
                      <div className="p-6">
                        {renderQuestionContent(question)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between gap-4 mt-6">
              <button
                onClick={handlePreviousPart}
                disabled={currentPartIndex === 0}
                className={`px-6 py-3 rounded-lg font-bold text-lg transition-all flex items-center gap-2 ${
                  currentPartIndex === 0
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-500 text-white hover:bg-blue-600 hover:scale-105'
                }`}
              >
                <ArrowLeft className="w-5 h-5" />
                Previous Part
              </button>

              {currentPartIndex === allParts.length - 1 ? (
                interactiveMode && !admin && !hideSubmit && (
                  <button
                    onClick={handleSubmitExam}
                    disabled={!areAllPartsCompleted()}
                    className={`px-8 py-3 rounded-lg font-bold text-lg transition-all flex items-center gap-2 shadow-lg ${
                      areAllPartsCompleted()
                        ? 'bg-gradient-to-r from-green-400 to-green-600 text-white hover:scale-105 cursor-pointer'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <span className="text-2xl">🚀</span>
                    Submit Exam
                  </button>
                )
              ) : (
                <button
                  onClick={handleNextPart}
                  className="px-6 py-3 rounded-lg font-bold text-lg transition-all flex items-center gap-2 bg-blue-500 text-white hover:bg-blue-600 hover:scale-105"
                >
                  Next Part
                  <ArrowLeft className="w-5 h-5 rotate-180" />
                </button>
              )}
            </div>
          </div>

          {/* Sidebar Navigation - RIGHT (Fixed) */}
          <div className="w-80 flex-shrink-0">
            <div className="sticky top-24 bg-white rounded-2xl shadow-xl border-4 border-gray-200 overflow-hidden">
              {/* Sidebar Header - Minimal & Clean */}
              <div className="bg-white border-b-2 border-gray-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Danh sách phần thi
                </h3>
              </div>

              {/* Parts List - GRID LAYOUT */}
              <div className="max-h-[calc(100vh-200px)] overflow-y-auto p-4">
                <div className="grid grid-cols-3 gap-3">
                  {allParts.map((part, index) => {
                    const status = getPartStatus(index);
                    const isCurrent = index === currentPartIndex;
                    
                    return (
                      <button
                        key={index}
                        onClick={() => {
                          handleJumpToPart(index);
                        }}
                        className={`relative aspect-square rounded-xl transition-all flex flex-col items-center justify-center p-3 ${
                          isCurrent
                            ? 'bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-lg scale-105'
                            : status === 'completed'
                            ? 'bg-gradient-to-br from-green-300 to-green-500 text-white hover:scale-105 shadow-md ring-2 ring-green-400'
                            : status === 'in-progress'
                            ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white hover:scale-105'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:scale-105'
                        }`}
                      >
                        {/* Status Badge - Top Right */}
                        <div className="absolute top-2 right-2">
                          {status === 'completed' && (
                            <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center">
                              <span className="text-green-600 text-xs font-bold">✓</span>
                            </div>
                          )}
                          {isCurrent && status !== 'completed' && (
                            <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center">
                              <span className="text-blue-600 text-xs font-bold">●</span>
                            </div>
                          )}
                          {status === 'in-progress' && !isCurrent && (
                            <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center">
                              <span className="text-yellow-600 text-xs font-bold">◐</span>
                            </div>
                          )}
                        </div>

                        {/* Skill Icon */}
                        <span className="text-3xl mb-2">{part.skillIcon}</span>
                        
                        {/* Part Number */}
                        <span className="font-bold text-base">
                          {part.subPart ? `${part.part}.${part.subPart}` : `Part ${part.part}`}
                        </span>
                        
                        {/* Question Count */}
                        <span className="text-xs mt-1 opacity-90">
                          {part.questions.length} câu
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Submit Button in Sidebar */}
              {interactiveMode && !admin && !hideSubmit && (
                <div className="p-4 border-t-4 border-gray-200">
                  <button
                    onClick={handleSubmitExam}
                    disabled={!areAllPartsCompleted()}
                    className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-lg ${
                      areAllPartsCompleted()
                        ? 'bg-gradient-to-r from-green-400 to-green-600 text-white hover:scale-105 cursor-pointer'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <span className="text-2xl">🚀</span>
                    Nộp bài
                  </button>
                  
                  {/* Warning if not all completed */}
                  {!areAllPartsCompleted() && (
                    <p className="text-xs text-orange-600 text-center mt-2 font-medium">
                      ⚠️ Hoàn thành tất cả các phần để nộp bài
                    </p>
                  )}
                  
                  {/* Progress */}
                  <div className="mt-4 text-center">
                    <p className="text-sm text-gray-600 mb-2">
                      {Object.keys(userAnswers).length} / {examData.questions.length} câu
                    </p>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-green-400 to-blue-500 transition-all duration-500"
                        style={{ width: `${(Object.keys(userAnswers).length / examData.questions.length) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Submit Confirmation Modal - KIDS STYLE */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-yellow-100 via-pink-100 to-blue-100 rounded-3xl p-8 max-w-lg w-full mx-4 shadow-2xl border-4 border-yellow-400 animate-bounce-in">
            <div className="text-center">
              {/* Large emoji */}
              <div className="text-8xl mb-4 animate-bounce">📋</div>
              
              {/* Title */}
              <h3 className="text-4xl font-bold text-purple-600 mb-6">
                Xác nhận nộp bài? 🤔
              </h3>
              
              {/* Stats card */}
              <div className="bg-white rounded-2xl p-6 mb-6 border-4 border-purple-300 shadow-lg">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-3xl">📝</span>
                      <span className="text-xl font-bold text-gray-700">Tổng số câu:</span>
                    </div>
                    <span className="text-3xl font-bold text-gray-900">{examData?.questions.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-3xl">✅</span>
                      <span className="text-xl font-bold text-gray-700">Đã trả lời:</span>
                    </div>
                    <span className="text-3xl font-bold text-green-600">{Object.keys(userAnswers).length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-3xl">📸</span>
                      <span className="text-xl font-bold text-gray-700">Ảnh đã tải:</span>
                    </div>
                    <span className="text-3xl font-bold text-blue-600">{Object.keys(uploadedImages).length}</span>
                  </div>
                </div>
              </div>

              {/* Warning message */}
              <div className="bg-orange-100 border-4 border-orange-400 rounded-2xl p-4 mb-6">
                <p className="text-xl font-bold text-orange-800 flex items-center justify-center gap-2">
                  <span className="text-3xl">⚠️</span>
                  Sau khi nộp bạn sẽ không thể chỉnh sửa!
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex gap-4">
                <button
                  onClick={() => setShowSubmitModal(false)}
                  className="
                    flex-1 
                    min-h-[70px]
                    px-6 py-4 
                    bg-gray-300 
                    text-gray-800 
                    rounded-2xl 
                    font-bold 
                    text-xl
                    hover:bg-gray-400 
                    hover:scale-105
                    active:scale-95
                    transition-all
                    border-4 border-gray-400
                    shadow-lg
                  "
                >
                  <span className="text-2xl mr-2">❌</span>
                  Hủy
                </button>
                <button
                  onClick={confirmSubmit}
                  className="
                    flex-1 
                    min-h-[70px]
                    px-6 py-4 
                    bg-gradient-to-r from-green-400 to-green-600
                    text-white 
                    rounded-2xl 
                    font-bold 
                    text-xl
                    hover:from-green-500 hover:to-green-700
                    hover:scale-105
                    active:scale-95
                    transition-all
                    border-4 border-green-300
                    shadow-lg
                  "
                >
                  <span className="text-2xl mr-2">✅</span>
                  Nộp bài!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Mode Confirmation Modal - KIDS STYLE */}
      {showInteractiveModeModal && (
        <>
          {/* Backdrop with blur - covers everything including header */}
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] animate-fade-in" />
          
          {/* Modal */}
          <div className="fixed top-0 left-0 right-0 flex justify-center z-[70] p-4 pt-8 pointer-events-none">
            <div className="bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 rounded-2xl p-5 max-w-md w-full mx-4 shadow-2xl border-4 border-blue-400 animate-slide-down pointer-events-auto">
              <div className="text-center">
              {/* Large emoji */}
              <div className="text-5xl mb-3 animate-bounce">🎮</div>
              
              {/* Title */}
              <h3 className="text-2xl font-bold text-purple-600 mb-3">
                Chế độ tương tác! 🎯
              </h3>
              
              {/* Warning message */}
              <div className="bg-white rounded-xl p-3 mb-3 border-2 border-purple-300 shadow-lg">
                <p className="text-sm font-bold text-gray-800 leading-snug">
                  Bạn đang chuẩn bị chuyển sang giao diện thi cho học viên. 
                  Mọi thao tác sẽ tương tự như khi học viên làm bài thật! 
                </p>
              </div>

              {/* Features list */}
              <div className="bg-gradient-to-r from-yellow-100 to-orange-100 border-2 border-yellow-400 rounded-xl p-3 mb-3">
                <div className="space-y-2 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">✅</span>
                    <span className="text-sm font-bold text-gray-800">Trả lời câu hỏi</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">⏱️</span>
                    <span className="text-sm font-bold text-gray-800">Đếm ngược thời gian</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🎨</span>
                    <span className="text-sm font-bold text-gray-800">Vẽ, kéo thả tương tác</span>
                  </div>
                  {!admin && !hideSubmit && (
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🚀</span>
                      <span className="text-sm font-bold text-gray-800">Nộp bài khi hoàn thành</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Confirmation question */}
              <p className="text-lg font-bold text-purple-600 mb-3">
                Bạn có chắc không? 🤔
              </p>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowInteractiveModeModal(false)}
                  className="
                    flex-1 
                    px-4 py-3 
                    bg-gray-300 
                    text-gray-800 
                    rounded-xl 
                    font-bold 
                    text-base
                    hover:bg-gray-400 
                    hover:scale-105
                    active:scale-95
                    transition-all
                    border-2 border-gray-400
                    shadow-lg
                  "
                >
                  <span className="text-lg mr-1">🚫</span>
                  Không, để sau
                </button>
                <button
                  onClick={confirmInteractiveMode}
                  className="
                    flex-1 
                    px-4 py-3 
                    bg-gradient-to-r from-blue-400 to-purple-600
                    text-white 
                    rounded-xl 
                    font-bold 
                    text-base
                    hover:from-blue-500 hover:to-purple-700
                    hover:scale-105
                    active:scale-95
                    transition-all
                    border-2 border-blue-300
                    shadow-lg
                  "
                >
                  <span className="text-lg mr-1">🎉</span>
                  Có, tôi muốn thử!
                </button>
              </div>
            </div>
          </div>
          </div>
        </>
      )}
    </>
  );
}
