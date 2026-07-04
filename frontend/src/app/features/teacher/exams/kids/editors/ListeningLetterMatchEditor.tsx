import React, { useState } from 'react';
import { Save, X, Plus, Trash2, Upload, Volume2 } from 'lucide-react';
import { uploadKidsMedia } from '../../../../../../services/kidsExamApi';
import { useToastContext } from '../../../../../../contexts/ToastContext';
import { getFullMediaUrl } from '../../../../../../utils/mediaUtils';

interface ListeningLetterMatchEditorProps {
  onSave: (data: any) => void;
  onCancel: () => void;
  initialData?: any;
  examId: string | null;
  questionId: string | null;
}

interface Subject {
  label: string;
  correctLetter: string;
  isExample: boolean;
}

interface Option {
  letter: string;
  imageUrl: string;
  description: string;
}

const ListeningLetterMatchEditor: React.FC<ListeningLetterMatchEditorProps> = ({
  onSave,
  onCancel,
  initialData,
  examId,
}) => {
  const toast = useToastContext();
  const [title, setTitle] = useState(initialData?.title || 'Match with Letters (Listening)');
  const [points, setPoints] = useState(initialData?.points || 5);
  const [audioUrl, setAudioUrl] = useState('');
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([
    { label: '', correctLetter: '', isExample: false },
  ]);
  const [options, setOptions] = useState<Option[]>([
    { letter: 'A', imageUrl: '', description: '' },
    { letter: 'B', imageUrl: '', description: '' },
    { letter: 'C', imageUrl: '', description: '' },
    { letter: 'D', imageUrl: '', description: '' },
    { letter: 'E', imageUrl: '', description: '' },
    { letter: 'F', imageUrl: '', description: '' },
    { letter: 'G', imageUrl: '', description: '' },
    { letter: 'H', imageUrl: '', description: '' },
  ]);

  // Load initial data with backward compatibility
  React.useEffect(() => {
    if (!initialData?.config) return;

    const config = initialData.config;
    console.log('📥 Loading ListeningLetterMatch data:', config);

    // Load audio URL (support both formats)
    setAudioUrl(config.audioUrl || config.audio_url || '');

    // NEW FORMAT: subjects + options
    if (config.subjects && config.options) {
      console.log('✅ Loading NEW format (subjects + options)');
      setSubjects(
        config.subjects.map((s: any) => ({
          label: s.label || '',
          correctLetter: s.correctLetter || s.correct_letter || '',
          isExample: s.isExample ?? s.is_example ?? false,
        }))
      );
      setOptions(
        config.options.map((o: any) => ({
          letter: o.letter || '',
          imageUrl: o.imageUrl || o.image_url || '',
          description: o.description || '',
        }))
      );
    }
    // OLD FORMAT: left_items + right_items + correct_matches (backward compatibility)
    else if (config.left_items && config.right_items) {
      console.log('⚠️ Loading OLD format (left_items + right_items) - converting to new format');
      const leftItems = config.left_items || [];
      const rightItems = config.right_items || [];
      const correctMatches = config.correct_matches || [];

      // Convert left_items to subjects
      setSubjects(
        leftItems.map((item: any, index: number) => {
          const match = correctMatches.find((m: any) => m.leftId === item.id || m.left_id === item.id);
          return {
            label: item.name || '',
            correctLetter: match?.rightLetter || match?.right_letter || '',
            isExample: index === 0, // First item is example by default
          };
        })
      );

      // Convert right_items to options
      setOptions(
        rightItems.map((item: any) => ({
          letter: item.letter || '',
          imageUrl: item.imageUrl || item.image_url || '',
          description: '', // Old format doesn't have description
        }))
      );
    }
  }, [initialData]);

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !examId) {
      toast.error('Vui lòng chọn file audio!');
      return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Audio quá lớn! Vui lòng chọn file nhỏ hơn 10MB 😊');
      return;
    }

    setUploadingAudio(true);
    try {
      const response = await uploadKidsMedia(file, 'audio', examId, null);
      const uploadedUrl = response.media?.url || response.url;
      if (uploadedUrl) {
        setAudioUrl(uploadedUrl);
        toast.success('✅ Tải audio thành công!');
      }
    } catch (error: any) {
      console.error('Audio upload failed:', error);
      toast.error(`Không thể tải audio lên: ${error.response?.data?.message || error.message}`);
    } finally {
      setUploadingAudio(false);
    }
  };

  const handleOptionImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, letter: string) => {
    const file = e.target.files?.[0];
    if (!file || !examId) {
      toast.error('Vui lòng chọn file ảnh!');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error('Ảnh quá lớn! Vui lòng chọn ảnh nhỏ hơn 20MB 😊');
      return;
    }

    setUploadingImage(`option-${letter}`);
    try {
      const response = await uploadKidsMedia(file, 'image', examId, null);
      const uploadedUrl = response.media?.url || response.url;
      if (uploadedUrl) {
        handleOptionChange(letter, 'imageUrl', uploadedUrl);
        toast.success('✅ Tải ảnh thành công!');
      }
    } catch (error: any) {
      console.error('Image upload failed:', error);
      toast.error(`Không thể tải ảnh lên: ${error.response?.data?.message || error.message}`);
    } finally {
      setUploadingImage(null);
    }
  };

  const handleOptionPasteImage = async (e: React.ClipboardEvent, letter: string) => {
    const items = e.clipboardData?.items;
    if (!items || !examId) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob) return;

        if (blob.size > 20 * 1024 * 1024) {
          toast.error('Ảnh quá lớn! Vui lòng chọn ảnh nhỏ hơn 20MB 😊');
          return;
        }

        const file = new File([blob], `pasted-image-${Date.now()}.png`, { type: blob.type });
        
        setUploadingImage(`option-${letter}`);
        try {
          const response = await uploadKidsMedia(file, 'image', examId, null);
          const uploadedUrl = response.media?.url || response.url;
          if (uploadedUrl) {
            handleOptionChange(letter, 'imageUrl', uploadedUrl);
            toast.success('✅ Dán ảnh thành công!');
          }
        } catch (error: any) {
          console.error('Paste upload failed:', error);
          toast.error(`Không thể tải ảnh lên: ${error.response?.data?.message || error.message}`);
        } finally {
          setUploadingImage(null);
        }
        break;
      }
    }
  };

  const handleAddSubject = () => {
    const newSubject: Subject = {
      label: '',
      correctLetter: '',
      isExample: false,
    };
    setSubjects([...subjects, newSubject]);
  };

  const handleRemoveSubject = (index: number) => {
    if (subjects.length > 1) {
      setSubjects(subjects.filter((_, i) => i !== index));
    }
  };

  const handleSubjectChange = (index: number, field: keyof Subject, value: string | boolean) => {
    setSubjects(
      subjects.map((subject, i) =>
        i === index ? { ...subject, [field]: value } : subject
      )
    );
  };

  const handleOptionChange = (letter: string, field: keyof Option, value: string) => {
    setOptions(
      options.map((option) =>
        option.letter === letter ? { ...option, [field]: value } : option
      )
    );
  };

  const handleSave = () => {
    // Validate
    if (!audioUrl) {
      toast.error('Vui lòng upload file audio!');
      return;
    }

    const hasEmptySubjects = subjects.some(
      (subject) => !subject.label.trim() || !subject.correctLetter.trim()
    );

    const hasEmptyOptions = options.some(
      (option) => !option.imageUrl.trim() || !option.description.trim()
    );

    if (hasEmptySubjects) {
      toast.error('Vui lòng điền đầy đủ thông tin cho tất cả các chủ thể (label + correct letter)!');
      return;
    }

    if (hasEmptyOptions) {
      toast.error('Vui lòng điền đầy đủ thông tin và upload hình cho tất cả các options (A-H)!');
      return;
    }

    // Check that all subjects have valid correct letters
    const validLetters = options.map(o => o.letter);
    const invalidSubjects = subjects.filter(s => !validLetters.includes(s.correctLetter));
    if (invalidSubjects.length > 0) {
      toast.error('Một số chủ thể có chữ cái không hợp lệ! Vui lòng kiểm tra lại.');
      return;
    }

    const questionData = {
      type: 'listening_letter_match',
      title,
      points,
      config: {
        audio_url: audioUrl,
        subjects: subjects.map((subject) => ({
          label: subject.label.trim(),
          correct_letter: subject.correctLetter,
          is_example: subject.isExample,
        })),
        options: options.map((option) => ({
          letter: option.letter,
          image_url: option.imageUrl.trim(),
          description: option.description.trim(),
        })),
      },
    };

    console.log('💾 Saving ListeningLetterMatch (NEW format):', questionData);
    onSave(questionData);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎧</span>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Match with Letters (Listening)
              </h3>
              <p className="text-sm text-slate-500">
                Nghe và ghép nối bằng chữ cái
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              <X className="h-4 w-4" />
              <span>Hủy</span>
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 rounded-lg bg-orange-500 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600"
            >
              <Save className="h-4 w-4" />
              <span>Lưu câu hỏi</span>
            </button>
          </div>
        </div>
      </div>


      {/* Basic Info */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h4 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900">
          <span className="text-lg">📝</span> Thông tin cơ bản
        </h4>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Tiêu đề câu hỏi
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
              placeholder="VD: Ghép nối tên với hoạt động"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Điểm số
            </label>
            <input
              type="number"
              value={points}
              onChange={(e) => setPoints(parseInt(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
              min="1"
              max="10"
            />
          </div>
        </div>
      </div>

      {/* Audio Upload */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <h4 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900">
          <span className="text-lg">🎵</span> File Audio *
        </h4>
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600">
              <Upload className="h-4 w-4" />
              <span>{uploadingAudio ? 'Đang tải...' : 'Upload Audio'}</span>
              <input
                type="file"
                accept="audio/*"
                onChange={handleAudioUpload}
                className="hidden"
                disabled={uploadingAudio}
              />
            </label>
            {audioUrl && (
              <div className="flex items-center space-x-2">
                <Volume2 className="h-5 w-5 text-slate-500" />
                <audio controls src={getFullMediaUrl(audioUrl)} className="h-10">
                  Your browser does not support the audio element.
                </audio>
                <button
                  onClick={() => setAudioUrl('')}
                  className="rounded-lg bg-red-100 p-2 text-red-600 hover:bg-red-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          <p className="text-sm text-slate-500">
            💡 Upload file audio chứa hướng dẫn ghép nối
          </p>
        </div>
      </div>

      {/* Subjects Section (6 items to match) */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="sticky top-0 z-40 -mx-5 -mt-5 mb-4 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <h4 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <span className="text-lg">🔤</span> Chủ thể cần ghép nối - {subjects.length} mục
          </h4>
          <button
            onClick={handleAddSubject}
            className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600"
          >
            <Plus className="h-4 w-4" />
            <span>Thêm chủ thể</span>
          </button>
        </div>

        <div className="space-y-4">
          {subjects.map((subject, index) => (
            <div
              key={index}
              className="rounded-lg border border-slate-200 bg-slate-50 p-4"
            >
              <div className="mb-2 flex items-center justify-between">
                <h5 className="text-sm font-semibold text-slate-900">Chủ thể #{index + 1}</h5>
                <div className="flex items-center space-x-2">
                  <label className="flex items-center space-x-2 text-sm">
                    <input
                      type="checkbox"
                      checked={subject.isExample}
                      onChange={(e) =>
                        handleSubjectChange(index, 'isExample', e.target.checked)
                      }
                      className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-400"
                    />
                    <span className="text-slate-600 font-medium">Ví dụ mẫu</span>
                  </label>
                  {subjects.length > 1 && (
                    <button
                      onClick={() => handleRemoveSubject(index)}
                      className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Tên chủ thể * (VD: her son, her uncle)
                  </label>
                  <input
                    type="text"
                    value={subject.label}
                    onChange={(e) =>
                      handleSubjectChange(index, 'label', e.target.value)
                    }
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                    placeholder="VD: her son"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Ghép với chữ cái * (A-H)
                  </label>
                  <select
                    value={subject.correctLetter}
                    onChange={(e) =>
                      handleSubjectChange(index, 'correctLetter', e.target.value)
                    }
                    className="w-full rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  >
                    <option value="">-- Chọn chữ cái --</option>
                    {options.map((option) => (
                      <option key={option.letter} value={option.letter}>
                        {option.letter} - {option.description || '(chưa có mô tả)'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Preview */}
              {subject.label && subject.correctLetter && (
                <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs font-medium text-slate-500 mb-1">Xem trước:</p>
                  <div className="flex items-center space-x-3">
                    <span className="font-semibold text-slate-700">{subject.label}</span>
                    <span className="text-2xl text-slate-400">→</span>
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500 text-xl font-bold text-white">
                      {subject.correctLetter}
                    </span>
                    {subject.isExample && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">
                        ✨ Ví dụ mẫu
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Options Section (8 images A-H) */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="sticky top-0 z-40 -mx-5 -mt-5 mb-4 border-b border-slate-200 bg-white px-5 py-4">
          <h4 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <span className="text-lg">🖼️</span> Options (Chữ cái A-H + Hình ảnh) - {options.length} mục
          </h4>
          <div className="text-sm text-slate-600 mt-2 space-y-1 bg-amber-50 border border-amber-200 rounded-lg p-3 text-[12.5px] text-amber-900">
            <p className="font-bold flex items-center gap-1 text-amber-800">💡 Lưu ý về 2 đáp án nhiễu (Distractors) dư ra:</p>
            <p>1. Giáo viên hãy nhập đầy đủ mô tả và tải ảnh cho cả <strong>8 Options (A đến H)</strong>.</p>
            <p>2. Ở phần <strong>🔤 Chủ thể</strong> phía trên, giáo viên chỉ cần chọn chữ cái đúng cho 6 chủ thể. <strong>2 chữ cái còn dư ra</strong> (không được gán cho chủ thể nào) sẽ tự động trở thành đáp án nhiễu để học sinh kéo thả.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {options.map((option) => (
            <div
              key={option.letter}
              className="rounded-lg border border-slate-200 bg-slate-50 p-4"
            >
              <div className="mb-2 flex items-center justify-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500 text-2xl font-bold text-white">
                  {option.letter}
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Mô tả * (VD: swimming, cooking)
                  </label>
                  <input
                    type="text"
                    value={option.description}
                    onChange={(e) =>
                      handleOptionChange(option.letter, 'description', e.target.value)
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                    placeholder="VD: swimming"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Hình ảnh * (Upload hoặc Ctrl+V)
                  </label>
                  {option.imageUrl ? (
                    <div className="relative">
                      <img
                        src={getFullMediaUrl(option.imageUrl)}
                        alt={`Option ${option.letter}`}
                        className="h-32 w-full rounded-lg border border-slate-200 object-cover"
                      />
                      <button
                        onClick={() => handleOptionChange(option.letter, 'imageUrl', '')}
                        className="absolute -top-2 -right-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onPaste={(e) => handleOptionPasteImage(e, option.letter)}
                      className="relative"
                    >
                      <label className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 transition-colors hover:border-orange-400 hover:bg-orange-50/40">
                        <Upload className="mb-1 h-8 w-8 text-slate-400" />
                        <span className="text-xs text-slate-500">Upload</span>
                        <span className="text-xs text-slate-400">hoặc Ctrl+V</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleOptionImageUpload(e, option.letter)}
                          className="hidden"
                          disabled={uploadingImage === `option-${option.letter}`}
                        />
                      </label>
                      <input
                        type="text"
                        onPaste={(e) => handleOptionPasteImage(e, option.letter)}
                        placeholder="Nhấn vào đây và Ctrl+V"
                        className="mt-2 w-full rounded border border-dashed border-slate-300 px-2 py-1 text-xs text-center"
                        readOnly
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Preview */}
              {option.imageUrl && option.description && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2">
                  <p className="text-xs font-medium text-center text-slate-600">
                    {option.letter}: {option.description}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ListeningLetterMatchEditor;
