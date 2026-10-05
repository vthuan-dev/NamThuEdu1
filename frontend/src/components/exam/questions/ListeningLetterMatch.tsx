import { Volume2, CheckCircle2, Lightbulb } from 'lucide-react';
import { getFullMediaUrl } from '../../../utils/mediaUtils';
import { normalizeAudioUrl } from '../../../utils/examUtils';

interface ListeningLetterMatchProps {
  question: any;
  taskData: any;
  mode?: 'student' | 'preview' | 'review';
  interactiveMode?: boolean;
  userAnswer?: any;
  answer?: any;
  onAnswerChange?: (answer: any) => void;
  onAnswer?: (answer: any) => void;
}

export function ListeningLetterMatch(props: ListeningLetterMatchProps) {
  const { question, taskData } = props;
  const realTaskData = taskData.task_data || taskData;
  const config = taskData.config || realTaskData.config || {};

  const isPreview = props.mode === 'preview';
  const isReview = props.mode === 'review';
  const isTeacherView = isPreview || isReview;
  const interactive = props.mode === 'student' || props.interactiveMode === true;
  const onSave = props.onAnswer ?? props.onAnswerChange;
  const userAns = props.answer ?? props.userAnswer ?? {};

  const instructions =
    realTaskData?.instructions ||
    config?.instructions ||
    taskData?.instructions ||
    question?.qContent ||
    'Nghe và nối chữ cái (A-H) tương ứng với từng người hoặc sự vật.';

  const audioUrl =
    realTaskData?.audioUrl ||
    config?.audioUrl ||
    realTaskData?.audio_url ||
    config?.audio_url ||
    taskData?.audioUrl ||
    taskData?.audio_url ||
    question?.qMedia_url;

  const explanation =
    question?.qExplanation ||
    realTaskData?.explanation ||
    config?.explanation;

  // New Cambridge format: subjects + options (A-H)
  const rawSubjects = realTaskData?.subjects || config?.subjects || taskData?.subjects;
  const rawOptions = realTaskData?.options || config?.options || taskData?.options;

  const subjects: Array<{ label: string; correctLetter: string; isExample: boolean }> =
    Array.isArray(rawSubjects) ? rawSubjects : [];
  const options: Array<{ letter: string; imageUrl: string; description: string }> =
    Array.isArray(rawOptions) ? rawOptions : [];

  // Legacy format: items
  const legacyItems: any[] = realTaskData?.items || config?.items || [];

  const handleSelectLetter = (subjectIdx: number, letter: string) => {
    if (!interactive || !onSave) return;
    onSave({
      ...userAns,
      [subjectIdx]: letter,
    });
  };

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="rounded-2xl bg-blue-50 border-2 border-blue-200 p-4 shadow-xs">
        <p className="text-blue-900 font-bold text-lg flex items-center gap-2">
          <span>🎧</span>
          <span>{instructions}</span>
        </p>
      </div>

      {/* Audio Player */}
      {audioUrl && (
        <div className="flex items-center gap-3 p-4 bg-blue-50/80 rounded-2xl border-2 border-blue-200 shadow-xs">
          <Volume2 className="w-6 h-6 text-blue-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-bold text-blue-900 uppercase tracking-wide">Audio bài nghe</p>
            <audio
              controls
              className="w-full mt-1.5 h-10"
              src={normalizeAudioUrl(getFullMediaUrl(audioUrl) ?? audioUrl)}
            >
              <source src={normalizeAudioUrl(getFullMediaUrl(audioUrl) ?? audioUrl)} type="audio/mpeg" />
              Trình duyệt không hỗ trợ audio.
            </audio>
          </div>
        </div>
      )}

      {/* Cambridge Standard: 8 Picture Cards (A-H) */}
      {options.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
            <span>🖼️</span> Các bức tranh lựa chọn (A - {String.fromCharCode(64 + options.length)}):
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {options.map((opt, optIdx) => {
              const letter = opt.letter || String.fromCharCode(65 + optIdx);
              const imgUrl = getFullMediaUrl(opt.imageUrl);
              return (
                <div
                  key={optIdx}
                  className="rounded-2xl border-2 border-blue-200 overflow-hidden bg-white shadow-xs hover:shadow-md transition-shadow flex flex-col"
                >
                  <div className="bg-blue-600 text-white font-extrabold text-sm px-3 py-1.5 flex items-center justify-between">
                    <span>{letter}</span>
                    {opt.description && (
                      <span className="text-xs font-normal opacity-90 truncate max-w-[120px]">
                        {opt.description}
                      </span>
                    )}
                  </div>
                  <div className="h-28 sm:h-32 p-2 bg-slate-50 flex items-center justify-center overflow-hidden">
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={`Tranh ${letter}`}
                        className="w-full h-full object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-xs text-slate-400">Chưa có ảnh</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cambridge Standard: Subjects List to Match Letters */}
      {subjects.length > 0 ? (
        <div className="space-y-3 pt-1">
          <p className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
            <span>🔤</span> Chọn chữ cái tương ứng cho từng mục:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {subjects.map((subj, sIdx) => {
              const selectedLetter = subj.isExample ? subj.correctLetter : userAns?.[sIdx] ?? '';
              const availableLetters = options.map(
                (o, i) => o.letter || String.fromCharCode(65 + i)
              );

              return (
                <div
                  key={sIdx}
                  className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-between gap-3 ${
                    subj.isExample
                      ? 'border-amber-300 bg-amber-50/60'
                      : isTeacherView
                      ? 'border-blue-200 bg-white'
                      : 'border-slate-200 bg-white hover:border-blue-300 shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs text-white flex-shrink-0 ${
                        subj.isExample ? 'bg-amber-500' : 'bg-blue-600'
                      }`}
                    >
                      {sIdx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 text-sm truncate">{subj.label}</p>
                      {subj.isExample && (
                        <span className="text-xs font-semibold text-amber-700">📌 Ví dụ mẫu</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Chữ cái được chọn hoặc dropdown */}
                    {subj.isExample ? (
                      <span className="w-10 h-10 rounded-xl bg-amber-500 text-white font-extrabold text-base flex items-center justify-center shadow-xs">
                        {subj.correctLetter || 'A'}
                      </span>
                    ) : (
                      <select
                        value={selectedLetter}
                        disabled={!interactive}
                        onChange={(e) => handleSelectLetter(sIdx, e.target.value)}
                        className="w-20 px-2 py-2 rounded-xl border-2 border-blue-300 bg-blue-50/50 text-blue-900 font-extrabold text-base text-center outline-none focus:border-blue-500 focus:bg-white transition-colors disabled:bg-slate-100 disabled:border-slate-200"
                      >
                        <option value="">--</option>
                        {availableLetters.map((ltr) => (
                          <option key={ltr} value={ltr}>
                            {ltr}
                          </option>
                        ))}
                      </select>
                    )}

                    {/* Hiển thị đáp án đúng trong chế độ giáo viên xem trước */}
                    {isTeacherView && !subj.isExample && subj.correctLetter && (
                      <span
                        className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold"
                        title="Đáp án chuẩn"
                      >
                        ✓ {subj.correctLetter}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : legacyItems.length > 0 ? (
        /* Legacy format */
        <div className="space-y-4">
          {legacyItems.map((item: any, idx: number) => {
            const itemImageUrl = item.imageUrl || item.image_url || item.image;
            const letters = item.letters || ['A', 'B', 'C', 'D'];

            return (
              <div
                key={idx}
                className="p-5 bg-white rounded-2xl border-2 border-blue-200 shadow-xs flex items-start gap-4"
              >
                <span className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  {idx + 1}
                </span>
                <div className="flex-1 space-y-3">
                  {itemImageUrl && (
                    <div className="border border-blue-200 rounded-xl overflow-hidden bg-slate-50 p-2 max-w-xs">
                      <img
                        src={getFullMediaUrl(itemImageUrl) || ''}
                        alt={`Item ${idx + 1}`}
                        className="w-full h-auto max-h-[180px] object-contain"
                      />
                    </div>
                  )}
                  {item.text && <p className="font-bold text-slate-800">{item.text}</p>}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-slate-600 font-medium text-sm">Chọn chữ cái:</span>
                    {letters.map((ltr: string, lIdx: number) => (
                      <button
                        key={lIdx}
                        type="button"
                        disabled={!interactive}
                        onClick={() => handleSelectLetter(idx, ltr)}
                        className={`w-10 h-10 rounded-xl border-2 font-extrabold text-base transition-all ${
                          userAns?.[idx] === ltr
                            ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                            : 'bg-white text-blue-900 border-blue-200 hover:bg-blue-50'
                        }`}
                      >
                        {ltr}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-6 bg-amber-50 rounded-2xl border-2 border-amber-300 text-center text-amber-800 font-medium">
          ⚠️ Câu hỏi này chưa có danh sách chủ thể và các bức tranh lựa chọn.
        </div>
      )}

      {/* Hướng dẫn giải thích */}
      {isTeacherView && explanation && (
        <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/80 p-4 space-y-1.5 shadow-xs">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
            <Lightbulb className="w-4 h-4 text-amber-600" />
            <span>Hướng dẫn &amp; Giải thích:</span>
          </div>
          <p className="text-amber-950 text-sm leading-relaxed pl-6 whitespace-pre-line font-medium">
            {explanation}
          </p>
        </div>
      )}
    </div>
  );
}
