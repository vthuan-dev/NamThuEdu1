import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import StepIndicator from './components/StepIndicator';
import Step1ExamType from './steps/Step1ExamType';
import Step2AddQuestions from './steps/Step2AddQuestions';
import Step3Preview from './steps/Step3Preview';
import { createKidsExam, updateKidsExam, getKidsExam } from '../../../../../services/kidsExamApi';
import { getFullMediaUrl } from '../../../../../utils/mediaUtils';

/**
 * Gán id ổn định cho mọi phần tử mảng-object trong config (đệ quy nông).
 * Nhiều đề (seed / dữ liệu cũ) không lưu `id` cho từng item → các editor dùng
 * key={x.id} bị cảnh báo "unique key". Chuẩn hóa 1 chỗ ở đây để mọi editor an toàn.
 */
function ensureItemIds(config: any): any {
  if (!config || typeof config !== 'object') return config;
  const out: any = Array.isArray(config) ? [] : { ...config };
  for (const [key, val] of Object.entries(config)) {
    if (Array.isArray(val)) {
      out[key] = val.map((el: any, idx: number) => {
        if (el && typeof el === 'object' && !Array.isArray(el)) {
          const withId = el.id != null ? el : { ...el, id: `${key}-${idx + 1}` };
          return ensureItemIds(withId);
        }
        return el;
      });
    } else if (val && typeof val === 'object') {
      out[key] = ensureItemIds(val);
    } else {
      out[key] = val;
    }
  }
  return out;
}

interface ExamData {
  examType: string;
  title: string;
  description: string;
  duration: number;
  questions: any[];
  mode?: 'flexible' | 'cambridge';
  scope?: 'full' | 'skill' | 'part';
  scopeSkill?: 'listening' | 'reading_writing' | 'speaking' | null;
  scopePart?: number | null;
}

const CreateKidsExam: React.FC = () => {
  const navigate = useNavigate();
  const { examId } = useParams<{ examId: string }>();
  const [currentExamId, setCurrentExamId] = useState<string | null>(examId || null);
  const [currentStep, setCurrentStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [examData, setExamData] = useState<ExamData>({
    examType: '',
    title: '',
    description: '',
    duration: 60,
    questions: [],
    mode: 'flexible', // Default to flexible mode
    scope: 'full', // Phạm vi đề: full | skill | part
    scopeSkill: null,
    scopePart: null,
  });

  // Load existing exam if examId exists
  useEffect(() => {
    if (examId) {
      loadExam(examId);
      // If exam exists, start at step 2 (adding questions)
      setCurrentStep(2);
    }
  }, [examId]);

  const loadExam = async (id: string) => {
    try {
      const exam = await getKidsExam(parseInt(id));
      if (exam) {
        const examTypeCode = exam.kids_exam_config?.exam_type || '';
        const examType = examTypeCode === 'yle_starters' ? 'starters'
          : examTypeCode === 'yle_movers' ? 'movers'
          : 'flyers';

        // Transform questions from database format to UI format
        const transformedQuestions = (exam.questions || []).map((q: any) => {
          // Extract media URLs from q.media array
          const audioMedia = q.media?.find((m: any) => m.media_type === 'audio');
          const imageMedia = q.media?.find((m: any) => m.media_type === 'image');
          
          // Get base config
          const baseConfig = q.kids_task_config?.task_data || {};
          
          // DEBUG: Log raw config from database
          if (q.kids_task_config?.task_type === 'listen_colour_write') {
            console.log('🔍 RAW baseConfig from DB:', JSON.stringify(baseConfig, null, 2));
            console.log('🔍 Instructions count:', baseConfig.instructions?.length);
          }
          
          // Convert relative URLs to full URLs
          const audioUrl = audioMedia ? getFullMediaUrl(audioMedia.file_url) : null;
          const imageUrl = imageMedia ? getFullMediaUrl(imageMedia.file_url) : null;
          
          // Add media URLs to config if they exist
          const configWithMedia = ensureItemIds({
            ...baseConfig,
            ...(audioUrl && { audioUrl }),
            ...(imageUrl && { imageUrl }),
          });
          
          // DEBUG: Log after ensureItemIds
          if (q.kids_task_config?.task_type === 'listen_colour_write') {
            console.log('🔍 After ensureItemIds:', JSON.stringify(configWithMedia, null, 2));
            console.log('🔍 Instructions count after:', configWithMedia.instructions?.length);
          }

          return {
            qId: q.qId,
            id: `q-${q.qId}`,
            type: q.kids_task_config?.task_type || q.qType,
            title: q.kids_task_config?.task_name || q.qContent || 'Untitled',
            points: q.qPoints || 5,
            config: configWithMedia,
            part: q.qPart || 1, // Load part from qPart field
            subPart: q.qSubPart || null, // Load subPart from qSubPart field (Cambridge mode)
          };
        });

        setExamData({
          examType: examType,
          title: exam.eTitle || '',
          description: exam.eDescription || '',
          duration: exam.eDuration || 60,
          questions: transformedQuestions,
          mode: exam.kids_exam_config?.mode || 'flexible', // Load mode from database
          scope: exam.kids_exam_config?.scope || 'full',
          scopeSkill: exam.kids_exam_config?.scope_skill || null,
          scopePart: exam.kids_exam_config?.scope_part ?? null,
        });
        setCurrentExamId(id);
        
        console.log('📦 Loaded exam:', {
          examType,
          mode: exam.kids_exam_config?.mode || 'flexible',
          questionsCount: transformedQuestions.length,
          questions: transformedQuestions.map(q => ({
            type: q.type,
            part: q.part,
            subPart: q.subPart,
            hasAudio: !!q.config.audioUrl,
            hasImage: !!q.config.imageUrl,
          }))
        });
      }
    } catch (error) {
      console.error('Failed to load exam:', error);
    }
  };

  const createDraftExam = async () => {
    if (currentExamId) return currentExamId; // Already has ID

    setIsSaving(true);
    try {
      const examTypeCode = examData.examType === 'starters' ? 'yle_starters' 
        : examData.examType === 'movers' ? 'yle_movers' 
        : 'yle_flyers';

      const response = await createKidsExam({
        eTitle: examData.title || `Đề thi ${examData.examType} - ${new Date().toLocaleString('vi-VN')}`,
        eDescription: examData.description || 'Đang tạo...',
        eDuration: examData.duration,
        exam_type_code: examTypeCode,
        mode: examData.mode || 'flexible', // Send mode to server
        scope: examData.scope || 'full',
        scope_skill: examData.scopeSkill ?? null,
        scope_part: examData.scopePart ?? null,
      });

      if (response.exam?.eId) {
        const newExamId = response.exam.eId.toString();
        setCurrentExamId(newExamId);
        // Update URL with exam ID
        navigate(`/giao-vien/de-thi/kids/tao-moi/${newExamId}`, { replace: true });
        return newExamId;
      }
    } catch (error) {
      console.error('Failed to create draft exam:', error);
      alert('Không thể tạo đề thi. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
    return null;
  };

  const autoSaveExam = async () => {
    if (!currentExamId) return;

    try {
      await updateKidsExam(parseInt(currentExamId), {
        eTitle: examData.title,
        eDescription: examData.description,
        eDuration: examData.duration,
        mode: examData.mode, // Save mode when auto-saving
      });
      console.log('✅ Auto-saved');
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  };

  // Auto-save when questions change
  useEffect(() => {
    if (currentExamId && examData.questions.length > 0) {
      const timer = setTimeout(() => {
        autoSaveExam();
      }, 1000); // Debounce 1 second

      return () => clearTimeout(timer);
    }
  }, [examData.questions, currentExamId]);

  const handleNext = async () => {
    if (currentStep === 1 && !currentExamId) {
      // Create draft exam when moving from Step 1 to Step 2
      const newExamId = await createDraftExam();
      if (!newExamId) return; // Failed to create
    }
    
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSave = async (status: 'draft' | 'published') => {
    if (!currentExamId) {
      await createDraftExam();
      return;
    }

    setIsSaving(true);
    try {
      await updateKidsExam(parseInt(currentExamId), {
        eTitle: examData.title,
        eDescription: examData.description,
        eDuration: examData.duration,
        mode: examData.mode, // Save mode when publishing
        eStatus: status, // Persist draft/published status to backend
      });

      if (status === 'published') {
        // Log activity (best-effort)
        import("../../../../../services/teacherActivityLog").then(({ logTeacherActivity }) => {
          logTeacherActivity({
            action: "exam.create",
            entity_type: "exam",
            entity_id: Number(currentExamId),
            detail: `Xuất bản đề Kids: ${examData.title || "Đề Kids"}`,
            meta: { type: "Kids", exam_type: examData.examType },
          });
        });
        alert('Đã xuất bản đề thi thành công! 🎉');
        navigate('/giao-vien/de-thi');
      } else {
        alert('Đã lưu nháp thành công! ✅');
      }
    } catch (error) {
      console.error('Failed to save exam:', error);
      alert('Không thể lưu đề thi. Vui lòng thử lại. 😊');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="kids-builder flex h-screen flex-col bg-[#F8FAFC]">
        {/* Header - Premium Flat Design */}
        <div className="border-b border-slate-200 bg-white shadow-sm z-10">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate('/giao-vien/de-thi')}
                  className="group flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors duration-200 text-sm font-medium"
                >
                  <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                  <span>Quay lại</span>
                </button>
                <div className="h-4 w-px bg-slate-200"></div>
                <div className="flex items-center gap-3">
                  <h1 className="text-lg font-bold text-slate-800 tracking-tight">
                    {examId ? 'Chỉnh sửa đề thi Kids' : 'Thiết kế đề thi Kids'}
                  </h1>
                  {isSaving ? (
                    <span className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                      Đang tự động lưu...
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Đã tự động lưu
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleSave('draft')}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 active:bg-slate-100 transition-all duration-200 text-sm font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="h-4 w-4 text-slate-500" />
                  <span>Lưu nháp</span>
                </button>
                {currentStep === 3 && (
                  <button
                    onClick={() => handleSave('published')}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-95 text-white rounded-lg transition-all duration-200 text-sm font-semibold shadow-md shadow-orange-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>Xuất bản đề thi</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className={`flex-1 flex flex-col ${currentStep === 2 ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          <div className={`mx-auto w-full flex-1 flex flex-col ${
            currentStep === 2 
              ? 'max-w-7xl px-4 py-4 overflow-hidden h-full' 
              : 'max-w-5xl px-4 py-6'
          }`}>
            {/* Step Indicator */}
            <div className="mb-6">
              <StepIndicator currentStep={currentStep} />
            </div>

            {/* Step Content - Clean Card */}
            <div className={`bg-white shadow-sm flex flex-col ${
              currentStep === 2 
                ? 'flex-1 h-full overflow-hidden p-0 border border-slate-200 rounded-xl' 
                : 'rounded-xl border border-slate-200 p-6 md:p-8'
            }`}>
              {currentStep === 1 && (
                <Step1ExamType
                  examData={examData}
                  setExamData={setExamData}
                  onNext={handleNext}
                />
              )}
              {currentStep === 2 && (
                <Step2AddQuestions
                  examData={examData}
                  setExamData={setExamData}
                  onNext={handleNext}
                  onBack={handleBack}
                  examId={currentExamId}
                />
              )}
              {currentStep === 3 && (
                <Step3Preview
                  examData={examData}
                  onBack={handleBack}
                  onPublish={() => handleSave('published')}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CreateKidsExam;
