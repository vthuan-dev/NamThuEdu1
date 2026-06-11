import React, { useState, useEffect } from 'react';
import { X, Upload, Play, Pause, Plus, Trash2, Volume2, Image as ImageIcon } from 'lucide-react';
import { uploadKidsMedia } from '../../../../../../services/kidsExamApi';
import { useToastContext } from '../../../../../../contexts/ToastContext';

interface ListenTickEditorProps {
  onSave: (data: any) => void;
  onCancel: () => void;
  initialData?: any;
  examId: string | null;
  questionId?: string | null;
}

interface TickOption {
  imageUrl: string;
  label: string;
}

interface TickItem {
  id: string;
  questionText: string;
  optionA: TickOption;
  optionB: TickOption;
  optionC: TickOption;
  correctAnswer: 'A' | 'B' | 'C';
  audioUrl?: string;
  isExample?: boolean;
}

// Chuẩn hóa items khi nạp từ DB/seed: hỗ trợ cả shape cũ `options:[{id,imageUrl}]`
// lẫn shape editor `optionA/optionB/optionC`. Luôn đảm bảo optionA/B/C tồn tại để
// tránh crash khi render (item.optionX.imageUrl).
function normalizeTickItems(raw: any): TickItem[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [{
      id: '1',
      questionText: 'Where is Lucy now?',
      optionA: { imageUrl: '', label: 'A' },
      optionB: { imageUrl: '', label: 'B' },
      optionC: { imageUrl: '', label: 'C' },
      correctAnswer: 'A',
      isExample: true,
    }];
  }
  return raw.map((it: any, idx: number) => {
    const opts: any[] = Array.isArray(it?.options) ? it.options : [];
    const indexByLetter: Record<string, number> = { A: 0, B: 1, C: 2 };
    const buildOpt = (letter: 'A' | 'B' | 'C'): TickOption => {
      const existing = it?.[`option${letter}`];
      if (existing && typeof existing === 'object') {
        return { imageUrl: existing.imageUrl ?? existing.image_url ?? '', label: letter };
      }
      const fromArr = opts.find((o) => (o?.id ?? o?.label) === letter) ?? opts[indexByLetter[letter]];
      return { imageUrl: fromArr?.imageUrl ?? fromArr?.image_url ?? '', label: letter };
    };
    return {
      id: String(it?.id ?? idx + 1),
      questionText: it?.questionText ?? it?.question ?? '',
      optionA: buildOpt('A'),
      optionB: buildOpt('B'),
      optionC: buildOpt('C'),
      correctAnswer: (it?.correctAnswer ?? 'A') as 'A' | 'B' | 'C',
      audioUrl: it?.audioUrl,
      isExample: it?.isExample ?? false,
    };
  });
}

const ListenTickEditor: React.FC<ListenTickEditorProps> = ({
  onSave,
  onCancel,
  initialData,
  examId,
  questionId,
}) => {
  console.log('🎯 ListenTickEditor loaded with initialData:', initialData);
  console.log('🎯 examId:', examId, 'questionId:', questionId);
  
  const toast = useToastContext();
  const [title, setTitle] = useState(initialData?.title || 'Nghe và đánh dấu (✓) vào ô. Có một ví dụ.');
  const [points, setPoints] = useState(initialData?.points || 5);
  const [items, setItems] = useState<TickItem[]>(
    normalizeTickItems(initialData?.config?.items)
  );
  const [mainAudioUrl, setMainAudioUrl] = useState(initialData?.config?.mainAudioUrl || '');
  const [mainImageUrl, setMainImageUrl] = useState(initialData?.config?.mainImageUrl || '');
  const [audioPreview, setAudioPreview] = useState<string | null>(initialData?.config?.mainAudioUrl || null);
  const [isUploading, setIsUploading] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [uploadingOption, setUploadingOption] = useState<string | null>(null);
  const [focusedOption, setFocusedOption] = useState<{ itemId: string; option: 'A' | 'B' | 'C' } | null>(null);

  // Handle paste event for main image
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items || !examId) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          e.preventDefault();
          const blob = items[i].getAsFile();
          if (blob) {
            // Check if we're pasting into an option field
            if (focusedOption) {
              await uploadOptionImageFromBlob(focusedOption.itemId, focusedOption.option, blob);
            } else {
              // Otherwise paste into main image
              await uploadMainImageFromBlob(blob);
            }
          }
          break;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [examId, focusedOption]);

  const uploadMainImageFromBlob = async (blob: Blob) => {
    if (!examId) {
      toast.error('Vui lòng tạo đề thi trước!');
      return;
    }

    if (blob.size > 20 * 1024 * 1024) {
      toast.error('Ảnh quá lớn! Vui lòng chọn ảnh nhỏ hơn 20MB 😊');
      return;
    }

    const file = new File([blob], `pasted-image-${Date.now()}.png`, { type: blob.type });

    setIsUploading(true);
    try {
      const response = await uploadKidsMedia(file, 'image', examId);
      const imageUrl = response.media?.url || response.url;
      if (imageUrl) {
        setMainImageUrl(imageUrl);
        toast.success('✅ Paste ảnh thành công! Nhớ nhấn "Lưu câu hỏi" 💾');
      }
    } catch (error: any) {
      toast.error(`Không thể tải ảnh lên: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const uploadOptionImageFromBlob = async (itemId: string, option: 'A' | 'B' | 'C', blob: Blob) => {
    if (!examId) {
      toast.error('Vui lòng tạo đề thi trước!');
      return;
    }

    if (blob.size > 20 * 1024 * 1024) {
      toast.error('Ảnh quá lớn! Vui lòng chọn ảnh nhỏ hơn 20MB 😊');
      return;
    }

    const file = new File([blob], `pasted-option-${option}-${Date.now()}.png`, { type: blob.type });

    setUploadingItemId(itemId);
    setUploadingOption(option);
    try {
      const response = await uploadKidsMedia(file, 'image', examId);
      const imageUrl = response.media?.url || response.url;
      if (imageUrl) {
        setItems(items.map(item => {
          if (item.id === itemId) {
            return {
              ...item,
              [`option${option}`]: { ...item[`option${option}` as keyof TickItem] as TickOption, imageUrl }
            };
          }
          return item;
        }));
        toast.success(`✅ Paste ảnh lựa chọn ${option} thành công! 💾`);
      }
    } catch (error: any) {
      toast.error(`Không thể tải ảnh lên: ${error.response?.data?.message || error.message}`);
    } finally {
      setUploadingItemId(null);
      setUploadingOption(null);
    }
  };

  const handleMainAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !examId) {
      toast.error('Vui lòng chọn file audio!');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setAudioPreview(previewUrl);
    
    setIsUploading(true);
    try {
      const response = await uploadKidsMedia(file, 'audio', examId);
      const audioUrl = response.media?.url || response.url;
      if (audioUrl) {
        setMainAudioUrl(audioUrl);
        toast.success('✅ Tải audio thành công! Nhớ nhấn "Lưu câu hỏi" 💾');
      }
    } catch (error: any) {
      toast.error(`Không thể tải audio lên: ${error.response?.data?.message || error.message}`);
      setAudioPreview(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleMainImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !examId) {
      toast.error('Vui lòng chọn file ảnh!');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error('Ảnh quá lớn! Vui lòng chọn ảnh nhỏ hơn 20MB 😊');
      return;
    }

    setIsUploading(true);
    try {
      const response = await uploadKidsMedia(file, 'image', examId);
      const imageUrl = response.media?.url || response.url;
      if (imageUrl) {
        setMainImageUrl(imageUrl);
        toast.success('✅ Tải ảnh thành công! Nhớ nhấn "Lưu câu hỏi" 💾');
      }
    } catch (error: any) {
      toast.error(`Không thể tải ảnh lên: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleOptionImageUpload = async (itemId: string, option: 'A' | 'B' | 'C', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !examId) {
      toast.error('Vui lòng chọn file ảnh!');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error('Ảnh quá lớn! Vui lòng chọn ảnh nhỏ hơn 20MB 😊');
      return;
    }

    setUploadingItemId(itemId);
    setUploadingOption(option);
    try {
      const response = await uploadKidsMedia(file, 'image', examId);
      const imageUrl = response.media?.url || response.url;
      if (imageUrl) {
        setItems(items.map(item => {
          if (item.id === itemId) {
            return {
              ...item,
              [`option${option}`]: { ...item[`option${option}` as keyof TickItem] as TickOption, imageUrl }
            };
          }
          return item;
        }));
        toast.success(`✅ Tải ảnh option ${option} thành công!`);
      }
    } catch (error: any) {
      toast.error(`Không thể tải ảnh lên: ${error.response?.data?.message || error.message}`);
    } finally {
      setUploadingItemId(null);
      setUploadingOption(null);
    }
  };

  const handleAddItem = () => {
    const newItem: TickItem = {
      id: Date.now().toString(),
      questionText: `Question ${items.length + 1}`,
      optionA: { imageUrl: '', label: 'A' },
      optionB: { imageUrl: '', label: 'B' },
      optionC: { imageUrl: '', label: 'C' },
      correctAnswer: 'A',
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const handleItemChange = (id: string, field: keyof TickItem, value: any) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const toggleAudio = (audioUrl: string) => {
    if (playingAudio === audioUrl) {
      setPlayingAudio(null);
    } else {
      setPlayingAudio(audioUrl);
    }
  };

  const handleSave = () => {
    const questionData = {
      type: 'listen_and_tick',
      title,
      points,
      config: {
        mainAudioUrl,
        mainImageUrl,
        items: items.map(item => ({
          id: item.id,
          questionText: item.questionText,
          optionA: item.optionA,
          optionB: item.optionB,
          optionC: item.optionC,
          correctAnswer: item.correctAnswer,
          audioUrl: item.audioUrl,
          isExample: item.isExample,
        })),
      },
    };

    console.log('💾 ListenTickEditor saving:', questionData);
    onSave(questionData);
  };

  return (
    <div className="min-h-[600px] rounded-xl border-2 border-indigo-200 bg-white p-6 shadow-lg">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-4xl">☑️</span>
          <div>
            <h3 className="font-baloo text-2xl font-bold text-indigo-600">
              Nghe và Đánh Dấu
            </h3>
            <p className="text-sm text-gray-500">Part 3 - Nghe và tick vào ô đúng</p>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="rounded-full p-2 transition-colors hover:bg-gray-100"
        >
          <X className="h-6 w-6 text-gray-500" />
        </button>
      </div>

      {/* Settings */}
      <div className="mb-6 grid grid-cols-2 gap-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Tiêu đề câu hỏi / Hướng dẫn <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none"
            placeholder="Ví dụ: Nghe và đánh dấu (✓) vào ô. Có một ví dụ."
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Điểm
          </label>
          <input
            type="number"
            value={points}
            onChange={(e) => setPoints(parseInt(e.target.value))}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none"
            min="1"
          />
        </div>
      </div>

      {/* Main Image */}
      <div className="mb-6">
        <label className="mb-2 block font-medium text-gray-700">
          Hình ảnh chính (tùy chọn)
        </label>
        <p className="mb-3 text-xs text-indigo-600 font-bold">
          💡 Mẹo: Bạn có thể <span className="font-bold">Ctrl+V</span> để paste ảnh trực tiếp!
        </p>
        
        {!mainImageUrl ? (
          <div className="flex items-center justify-center w-full">
            <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <ImageIcon className="w-10 h-10 mb-3 text-gray-400" />
                <p className="mb-2 text-sm text-gray-500">
                  <span className="font-semibold">{isUploading ? '⏳ Đang tải lên...' : 'Nhấn để tải hình ảnh lên'}</span>
                </p>
                <p className="text-xs text-gray-500">PNG, JPG (tối đa 20MB)</p>
                <p className="text-xs text-indigo-600 font-bold mt-2 animate-pulse">
                  💡 Hoặc Ctrl+V để dán ảnh từ clipboard
                </p>
              </div>
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleMainImageUpload}
                disabled={isUploading}
              />
            </label>
          </div>
        ) : (
          <div className="relative rounded-lg border-2 border-indigo-200 bg-gray-50 p-4">
            <div className="flex items-center justify-center">
              <img
                src={mainImageUrl}
                alt="Main image"
                className="max-h-96 w-auto rounded-lg"
              />
            </div>
            <button
              type="button"
              onClick={() => setMainImageUrl('')}
              className="absolute right-2 top-2 rounded-full bg-red-500 p-2 text-white shadow-lg transition-colors hover:bg-red-600"
              title="Xóa ảnh"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      {/* Main Audio */}
      <div className="mb-6">
        <label className="mb-2 block font-medium text-gray-700">
          File Audio <span className="text-red-500">*</span>
        </label>
        
        {!audioPreview ? (
          <div className="flex items-center space-x-4">
            <label className="flex cursor-pointer items-center space-x-2 rounded-lg border-2 border-dashed border-gray-300 px-6 py-3 transition-colors hover:border-indigo-500">
              <Upload className="h-5 w-5 text-gray-500" />
              <span className="text-gray-700">
                {isUploading ? 'Đang tải lên...' : 'Tải Audio Lên'}
              </span>
              <input
                type="file"
                accept="audio/mpeg,audio/mp3,audio/wav,audio/m4a,audio/mp4,audio/ogg"
                className="hidden"
                onChange={handleMainAudioUpload}
                disabled={isUploading}
              />
            </label>
            <span className="text-sm text-gray-500">MP3, WAV (tối đa 10MB)</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center space-x-3 rounded-lg border-2 border-indigo-200 bg-indigo-50 p-4">
              <Volume2 className="h-6 w-6 text-indigo-600" />
              <div className="flex-1">
                <p className="font-medium text-gray-900">Audio chính</p>
                <audio 
                  controls 
                  className="mt-2 w-full"
                  src={audioPreview}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setMainAudioUrl('');
                  setAudioPreview(null);
                }}
                className="rounded-full bg-red-500 p-2 text-white transition-colors hover:bg-red-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="mb-6 space-y-4">
        {/* Sticky header with add button */}
        <div className="sticky top-0 z-40 -mx-6 -mt-6 mb-4 flex items-center justify-between bg-white px-6 py-4 shadow-md">
          <h4 className="font-baloo text-lg font-bold text-gray-800">
            Danh sách câu hỏi ({items.length})
          </h4>
          <button
            onClick={handleAddItem}
            className="flex items-center space-x-2 rounded-lg bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700"
          >
            <Plus className="h-4 w-4" />
            <span>Thêm câu</span>
          </button>
        </div>

        {items.map((item, index) => (
          <div
            key={item.id}
            className={`rounded-lg border-2 p-4 ${
              item.isExample
                ? 'border-amber-400 bg-amber-50'
                : 'border-gray-200 bg-gray-50'
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className={`font-bold ${
                  item.isExample ? 'text-amber-700' : 'text-indigo-600'
                }`}>
                  {item.isExample ? '📌 Câu ví dụ' : `Câu ${index + 1}`}
                </span>
              </div>
              {items.length > 1 && (
                <button
                  onClick={() => handleRemoveItem(item.id)}
                  className="rounded p-1 text-red-600 transition-colors hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="space-y-3">
              {/* Example checkbox */}
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={item.isExample || false}
                  onChange={(e) => handleItemChange(item.id, 'isExample', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  ✨ Đây là câu ví dụ (hiển thị sẵn đáp án)
                </span>
              </label>
              
              {/* Question Text */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Câu hỏi <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={item.questionText}
                  onChange={(e) => handleItemChange(item.id, 'questionText', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
                  placeholder="Ví dụ: Where is Lucy now?"
                />
              </div>

              {/* Options A, B, C */}
              <div className="grid grid-cols-3 gap-4">
                {(['A', 'B', 'C'] as const).map((option) => (
                  <div key={option} className="space-y-2">
                    <label className="block text-sm font-bold text-gray-700">
                      Lựa chọn {option}
                    </label>
                    <p className="text-xs text-indigo-600 font-medium">
                      💡 Nhấn vào ô và Ctrl+V
                    </p>
                    {item[`option${option}`]?.imageUrl ? (
                      <div className="relative">
                        <img
                          src={item[`option${option}`].imageUrl}
                          alt={`Lựa chọn ${option}`}
                          className="h-32 w-full rounded-lg object-cover border-2 border-gray-300"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setItems(items.map(i => {
                              if (i.id === item.id) {
                                return {
                                  ...i,
                                  [`option${option}`]: { ...i[`option${option}` as keyof TickItem] as TickOption, imageUrl: '' }
                                };
                              }
                              return i;
                            }));
                          }}
                          className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div
                        tabIndex={0}
                        onClick={() => {
                          // Click lần 1: Focus vào ô này
                          if (focusedOption?.itemId !== item.id || focusedOption?.option !== option) {
                            setFocusedOption({ itemId: item.id, option });
                          } else {
                            // Click lần 2 (đã focus rồi): Mở file dialog
                            const input = document.getElementById(`file-input-${item.id}-${option}`) as HTMLInputElement;
                            if (input) input.click();
                          }
                        }}
                        onFocus={() => setFocusedOption({ itemId: item.id, option })}
                        onBlur={() => setFocusedOption(null)}
                        className={`cursor-pointer rounded-lg border-2 border-dashed transition-colors ${
                          focusedOption?.itemId === item.id && focusedOption?.option === option
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-gray-300 bg-white'
                        }`}
                      >
                        <div className="flex flex-col items-center justify-center p-4">
                          <ImageIcon className="h-8 w-8 text-gray-400" />
                          <span className="mt-1 text-xs text-gray-500">
                            {uploadingItemId === item.id && uploadingOption === option ? 'Đang tải...' : 'Tải lên'}
                          </span>
                        </div>
                        <input
                          id={`file-input-${item.id}-${option}`}
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleOptionImageUpload(item.id, option, e)}
                          className="hidden"
                          disabled={uploadingItemId === item.id && uploadingOption === option}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Correct Answer */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Đáp án đúng <span className="text-red-500">*</span>
                </label>
                <div className="flex space-x-4">
                  {(['A', 'B', 'C'] as const).map((option) => (
                    <label key={option} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name={`correct-${item.id}`}
                        checked={item.correctAnswer === option}
                        onChange={() => handleItemChange(item.id, 'correctAnswer', option)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Lựa chọn {option}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-3">
        <button
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-6 py-2 transition-colors hover:bg-gray-50"
        >
          Hủy
        </button>
        <button
          onClick={handleSave}
          className="rounded-lg bg-indigo-600 px-6 py-2 text-white transition-colors hover:bg-indigo-700"
        >
          💾 Lưu câu hỏi
        </button>
      </div>

      {/* Hidden Audio Player */}
      {playingAudio && (
        <audio
          src={playingAudio}
          autoPlay
          onEnded={() => setPlayingAudio(null)}
          className="hidden"
        />
      )}
    </div>
  );
};

export default ListenTickEditor;
