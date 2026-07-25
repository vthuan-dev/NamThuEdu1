import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2, Image as ImageIcon, X } from 'lucide-react';
import { uploadKidsMedia } from '../../../../../../services/kidsExamApi';
import { useToastContext } from '../../../../../../contexts/ToastContext';
import { calculateQuestionPoints, getScorableItemsCount, getExampleItemsCount } from '../../../../../../utils/examUtils';
import { renderFormattedTextWithGaps, insertFormatting } from '../../../../../../utils/textFormatUtils';
import { getFullMediaUrl } from '../../../../../../utils/mediaUtils';

interface WordBankFillEditorProps {
  onSave: (data: any) => void;
  onCancel: () => void;
  initialData?: any;
  examId: string | null;
  questionId: string | null;
}

interface Gap {
  id: string;
  gapNumber: number;
  correctWord: string;
  isExample?: boolean; // Mark as example (not scored)
}

interface WordBankItem {
  word: string;
  imageUrl: string;
}

const WordBankFillEditor: React.FC<WordBankFillEditorProps> = ({
  onSave,
  onCancel,
  initialData,
  examId,
  questionId,
}) => {
  const toast = useToastContext();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [mainImageUrl, setMainImageUrl] = useState('');
  const [hasImagesInBank, setHasImagesInBank] = useState(false); // Toggle for word bank images
  const [wordBank, setWordBank] = useState<WordBankItem[]>([
    { word: '', imageUrl: '' },
    { word: '', imageUrl: '' },
    { word: '', imageUrl: '' },
    { word: '', imageUrl: '' },
    { word: '', imageUrl: '' },
  ]);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [uploadingMainImage, setUploadingMainImage] = useState(false);
  const [uploadingWordImage, setUploadingWordImage] = useState<number | null>(null);
  const [focusedImageArea, setFocusedImageArea] = useState<'main' | number | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Load initial data
  useEffect(() => {
    console.log('🔍 WordBankFillEditor useEffect triggered, initialData:', initialData);
    
    if (initialData) {
      setTitle(initialData.title || 'Điền Từ Từ Ngân Hàng Từ');
      setText(initialData.config?.text || '');
      setMainImageUrl(initialData.config?.mainImageUrl || initialData.config?.main_image_url || '');
      setHasImagesInBank(initialData.config?.hasImagesInBank || initialData.config?.has_images_in_bank || false);
      
      console.log('📦 Raw config data:', {
        word_bank: initialData.config?.word_bank,
        gaps: initialData.config?.gaps,
        text: initialData.config?.text,
        hasImagesInBank: initialData.config?.hasImagesInBank || initialData.config?.has_images_in_bank
      });
      
      // Load word bank with proper mapping
      if (initialData.config?.word_bank && Array.isArray(initialData.config.word_bank)) {
        const mappedWordBank = initialData.config.word_bank.map((w: any) => ({
          word: w.word || '',
          imageUrl: w.imageUrl || w.image_url || ''
        }));
        console.log('✅ Mapped word bank:', mappedWordBank);
        setWordBank(mappedWordBank);
      } else {
        console.warn('⚠️ No word_bank found in config or not an array');
      }
      
      // Load gaps
      if (initialData.config?.gaps && Array.isArray(initialData.config.gaps)) {
        const mappedGaps = initialData.config.gaps.map((g: any, index: number) => {
          const gapNumber = g.gapNumber || g.gap_number;
          const correctWord = g.correctWord || g.correct_word || '';
          console.log(`  Gap ${index + 1}:`, {
            gapNumber,
            correctWord,
            isExample: g.isExample || g.is_example || false,
            rawData: g
          });
          return {
            id: g.id || `gap-${gapNumber}`,
            gapNumber,
            correctWord,
            isExample: g.isExample || g.is_example || false
          };
        });
        console.log('✅ Setting gaps:', mappedGaps);
        setGaps(mappedGaps);
      } else {
        console.warn('⚠️ No gaps found in config or not an array');
      }
      
      console.log('✅ WordBankFillEditor loaded initial data:', {
        title: initialData.title,
        wordBankCount: initialData.config?.word_bank?.length || 0,
        gapsCount: initialData.config?.gaps?.length || 0
      });
    } else {
      console.log('⚠️ No initialData provided');
    }
  }, [initialData]);

  // Handle paste for images
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items || !examId) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          e.preventDefault();
          const blob = items[i].getAsFile();
          if (blob) {
            if (focusedImageArea === 'main') {
              await uploadMainImageFromBlob(blob);
            } else if (typeof focusedImageArea === 'number') {
              await uploadWordImageFromBlob(focusedImageArea, blob);
            }
          }
          break;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [examId, focusedImageArea]);

  const uploadMainImageFromBlob = async (blob: Blob) => {
    if (!examId) {
      toast.error('Vui lòng tạo đề thi trước!');
      return;
    }

    if (blob.size > 20 * 1024 * 1024) {
      toast.error('Ảnh quá lớn! Vui lòng chọn ảnh nhỏ hơn 20MB 😊');
      return;
    }

    const file = new File([blob], `pasted-main-${Date.now()}.png`, { type: blob.type });

    setUploadingMainImage(true);
    try {
      const response = await uploadKidsMedia(file, 'image', examId);
      const imageUrl = response.media?.url || response.url;
      if (imageUrl) {
        setMainImageUrl(imageUrl);
        toast.success('✅ Paste ảnh chính thành công! 💾');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(`❌ Không thể tải ảnh lên: ${error.response?.data?.message || error.message}`);
    } finally {
      setUploadingMainImage(false);
    }
  };

  const uploadWordImageFromBlob = async (index: number, blob: Blob) => {
    if (!examId) {
      toast.error('Vui lòng tạo đề thi trước!');
      return;
    }

    if (blob.size > 20 * 1024 * 1024) {
      toast.error('Ảnh quá lớn! Vui lòng chọn ảnh nhỏ hơn 20MB 😊');
      return;
    }

    const file = new File([blob], `pasted-word-${index}-${Date.now()}.png`, { type: blob.type });

    setUploadingWordImage(index);
    try {
      const response = await uploadKidsMedia(file, 'image', examId);
      const imageUrl = response.media?.url || response.url;
      if (imageUrl) {
        const newWordBank = [...wordBank];
        newWordBank[index].imageUrl = imageUrl;
        setWordBank(newWordBank);
        toast.success('✅ Paste ảnh từ thành công! 💾');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(`❌ Không thể tải ảnh lên: ${error.response?.data?.message || error.message}`);
    } finally {
      setUploadingWordImage(null);
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

    setUploadingMainImage(true);
    try {
      const response = await uploadKidsMedia(file, 'image', examId);
      const imageUrl = response.media?.url || response.url;
      if (imageUrl) {
        setMainImageUrl(imageUrl);
        toast.success('✅ Tải ảnh chính thành công! 💾');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(`❌ Không thể tải ảnh lên: ${error.response?.data?.message || error.message}`);
    } finally {
      setUploadingMainImage(false);
    }
  };

  const handleWordImageUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !examId) {
      toast.error('Vui lòng chọn file ảnh!');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error('Ảnh quá lớn! Vui lòng chọn ảnh nhỏ hơn 20MB 😊');
      return;
    }

    setUploadingWordImage(index);
    try {
      const response = await uploadKidsMedia(file, 'image', examId);
      const imageUrl = response.media?.url || response.url;
      if (imageUrl) {
        const newWordBank = [...wordBank];
        newWordBank[index].imageUrl = imageUrl;
        setWordBank(newWordBank);
        toast.success('✅ Tải ảnh từ thành công! 💾');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(`❌ Không thể tải ảnh lên: ${error.response?.data?.message || error.message}`);
    } finally {
      setUploadingWordImage(null);
    }
  };

  const updateWordBank = (index: number, field: 'word' | 'imageUrl', value: string) => {
    const newWordBank = [...wordBank];
    newWordBank[index][field] = value;
    setWordBank(newWordBank);
  };

  const addWordSlot = () => {
    if (wordBank.length >= 12) {
      toast.warning('⚠️ Tối đa 12 từ!');
      return;
    }
    setWordBank([...wordBank, { word: '', imageUrl: '' }]);
  };

  const removeWordSlot = (index: number) => {
    if (wordBank.length <= 5) {
      toast.warning('⚠️ Phải có ít nhất 5 từ!');
      return;
    }
    setWordBank(wordBank.filter((_, i) => i !== index));
  };

  /**
   * Quét chỗ trống dạng __1__, __2__ trong đoạn văn.
   * Giữ lại đáp án / cờ ví dụ đã nhập cho các chỗ trống cùng số.
   */
  const parseGapsFromText = (source: string, previous: Gap[]): Gap[] => {
    const gapPattern = /__(\d+)__/g;
    const matches = [...source.matchAll(gapPattern)];
    const seen = new Set<number>();
    const result: Gap[] = [];
    matches.forEach((match) => {
      const num = parseInt(match[1], 10);
      if (seen.has(num)) return; // tránh trùng khi cùng số xuất hiện 2 lần
      seen.add(num);
      const existing = previous.find((g) => g.gapNumber === num);
      result.push({
        id: match[1],
        gapNumber: num,
        correctWord: existing?.correctWord || '',
        isExample: existing?.isExample || false,
      });
    });
    return result;
  };

  // BUG FIX: trước đây `gaps` CHỈ được cập nhật khi giáo viên bấm nút "phát hiện
  // chỗ trống". Nếu soạn đoạn văn (hoặc bấm In đậm / Tô màu — các hành động này
  // chỉ setText) rồi bấm Lưu, `gaps` vẫn rỗng → báo sai
  // "⚠️ Vui lòng thêm chỗ trống vào đoạn văn!" dù đoạn văn ĐÃ có __1__, __2__.
  // Nay tự quét lại mỗi khi đoạn văn thay đổi, vẫn giữ đáp án đã nhập.
  useEffect(() => {
    setGaps((prev) => {
      const next = parseGapsFromText(text, prev);
      const same =
        next.length === prev.length &&
        next.every((g, i) =>
          g.gapNumber === prev[i]?.gapNumber &&
          g.correctWord === prev[i]?.correctWord &&
          g.isExample === prev[i]?.isExample,
        );
      return same ? prev : next;
    });
  }, [text]);

  const detectGaps = () => {
    const detectedGaps = parseGapsFromText(text, gaps);
    setGaps(detectedGaps);
    if (detectedGaps.length === 0) {
      toast.warning('⚠️ Chưa thấy chỗ trống nào. Hãy viết __1__, __2__ trong đoạn văn nhé!');
      return;
    }
    toast.success(`✅ Đã phát hiện ${detectedGaps.length} chỗ trống!`);
  };

  const updateGapAnswer = (gapNumber: number, word: string) => {
    setGaps(gaps.map(g =>
      g.gapNumber === gapNumber ? { ...g, correctWord: word } : g
    ));
  };

  const updateGapExample = (gapNumber: number, isExample: boolean) => {
    setGaps(gaps.map(g =>
      g.gapNumber === gapNumber ? { ...g, isExample } : g
    ));
  };

  // Format text functions
  const makeBold = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    const { newText, cursorPos } = insertFormatting(
      text,
      start,
      end,
      '**',
      '**',
      'text in đậm'
    );
    
    setText(newText);
    
    // Set cursor position after insertion
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorPos, cursorPos);
    }, 0);
  };

  const makeHighlight = (color: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    const { newText, cursorPos } = insertFormatting(
      text,
      start,
      end,
      `<mark style="background-color: ${color}">`,
      '</mark>',
      'text tô màu'
    );
    
    setText(newText);
    
    // Set cursor position after insertion
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorPos, cursorPos);
    }, 0);
  };

  const handleSave = () => {
    // Validation
    if (!text.trim()) {
      toast.warning('⚠️ Vui lòng nhập đoạn văn!');
      return;
    }

    if (gaps.length === 0) {
      toast.warning('⚠️ Vui lòng thêm chỗ trống vào đoạn văn! Sử dụng format __1__, __2__, ...');
      return;
    }

    const hasEmptyWords = wordBank.some(w => !w.word.trim());
    if (hasEmptyWords) {
      toast.warning('⚠️ Vui lòng nhập đầy đủ tất cả các từ trong ngân hàng từ!');
      return;
    }

    const hasEmptyAnswers = gaps.some(g => !g.correctWord.trim());
    if (hasEmptyAnswers) {
      toast.warning('⚠️ Vui lòng chọn đáp án đúng cho tất cả các chỗ trống!');
      return;
    }

    // Check if all correct words are in word bank
    const allWordsInBank = gaps.every(g => 
      wordBank.some(w => w.word.trim().toLowerCase() === g.correctWord.trim().toLowerCase())
    );
    if (!allWordsInBank) {
      toast.error('❌ Tất cả đáp án đúng phải có trong ngân hàng từ!');
      return;
    }

    // Calculate points based on non-example gaps
    const config = {
      text: text.trim(),
      mainImageUrl,
      has_images_in_bank: hasImagesInBank, // Add this field
      word_bank: wordBank.filter(w => w.word.trim()).map(w => ({
        word: w.word.trim(),
        imageUrl: w.imageUrl,
      })),
      gaps: gaps.map(g => ({
        gap_number: g.gapNumber,
        correct_word: g.correctWord.trim(),
        isExample: g.isExample || false,
      })),
    };

    // Use gaps as items for scoring calculation
    const scoringConfig = {
      items: gaps.map(g => ({ isExample: g.isExample }))
    };
    const calculatedPoints = calculateQuestionPoints(scoringConfig, 1);

    const questionData = {
      type: 'word_bank_fill',
      title,
      config,
      points: calculatedPoints,
    };

    console.log('💾 Saving question with calculated points:', {
      totalGaps: gaps.length,
      scorableGaps: getScorableItemsCount(gaps),
      exampleGaps: getExampleItemsCount(gaps),
      calculatedPoints,
    });

    onSave(questionData);
  };

  return (
    <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <div className="mb-4 flex items-center gap-3">
          <span className="text-2xl">🏦</span>
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Điền từ từ ngân hàng từ
            </h3>
            <p className="text-sm text-slate-500">
              Học viên chọn 1 từ trong hộp từ cho sẵn để điền vào mỗi chỗ trống. Starters Part 4 ·
              Movers Part 4 · Flyers Part 3 (hộp ~10-12 từ, có từ dư làm nhiễu).
            </p>
          </div>
        </div>

        {/* Title Input */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Tiêu đề câu hỏi
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
            placeholder="VD: Chọn từ đúng để điền vào chỗ trống"
          />
        </div>
      </div>

      {/* Instructions */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h4 className="mb-2 text-sm font-semibold text-slate-700">
          💡 Hướng dẫn:
        </h4>
        <ul className="space-y-1 text-sm text-slate-600">
          <li>• Upload hình ảnh chính (tùy chọn) - Giống đề Cambridge thật</li>
          <li>• Sử dụng <code className="rounded bg-slate-100 px-2 py-1 font-mono">__1__</code>, <code className="rounded bg-slate-100 px-2 py-1 font-mono">__2__</code>, ... để đánh dấu chỗ trống</li>
          <li>• Nhấn "Phát hiện chỗ trống" sau khi nhập đoạn văn</li>
          <li>• Thêm từ + hình ảnh vào ngân hàng từ (bao gồm cả từ đúng và từ nhiễu)</li>
          <li>• Chọn đáp án đúng cho mỗi chỗ trống</li>
          <li>• Đánh dấu câu ví dụ (không tính điểm)</li>
        </ul>
      </div>

      {/* Main Image Upload */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <h4 className="mb-3 text-base font-semibold text-slate-800">
          🖼️ Hình ảnh chính (Tùy chọn)
        </h4>
        <p className="mb-4 text-sm text-slate-500">
          Upload 1 hình ảnh lớn làm context cho cả đoạn văn (giống đề Cambridge thật)
        </p>
        <p className="mb-3 text-xs font-medium text-slate-600 bg-white px-3 py-2 rounded-lg border border-slate-200">
          💡 Mẹo: Bạn có thể <span className="font-semibold">Ctrl+V</span> để paste ảnh trực tiếp!
        </p>

        {!mainImageUrl ? (
          <div
            tabIndex={0}
            onClick={() => {
              if (focusedImageArea !== 'main') {
                setFocusedImageArea('main');
              } else {
                const input = document.getElementById('main-image-input') as HTMLInputElement;
                if (input) input.click();
              }
            }}
            onFocus={() => setFocusedImageArea('main')}
            onBlur={() => setFocusedImageArea(null)}
            className={`cursor-pointer rounded-xl border border-dashed transition-colors ${
              focusedImageArea === 'main'
                ? 'border-orange-400 bg-orange-50'
                : 'border-slate-300 bg-white hover:border-orange-400 hover:bg-orange-50/40'
            }`}
          >
            <div className="flex flex-col items-center justify-center p-8">
              <ImageIcon className="mb-3 h-12 w-12 text-slate-400" />
              <span className="mb-2 text-sm font-medium text-slate-700">
                {uploadingMainImage ? '⏳ Đang tải lên...' : 'Nhấn để tải ảnh hoặc Ctrl+V'}
              </span>
              <span className="text-xs text-slate-400">PNG, JPG (tối đa 20MB)</span>
              {focusedImageArea === 'main' && (
                <p className="mt-3 text-xs font-semibold text-orange-600">
                  💡 Bạn có thể Ctrl+V để dán ảnh từ clipboard
                </p>
              )}
            </div>
            <input
              id="main-image-input"
              type="file"
              accept="image/*"
              onChange={handleMainImageUpload}
              className="hidden"
              disabled={uploadingMainImage}
            />
          </div>
        ) : (
          <div className="relative rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-center">
              <img
                src={getFullMediaUrl(mainImageUrl) ?? mainImageUrl}
                alt="Main context image"
                className="max-h-96 w-auto rounded-lg shadow-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => setMainImageUrl('')}
              className="absolute right-2 top-2 rounded-full bg-red-500 p-2 text-white shadow-lg transition-colors hover:bg-red-600"
              title="Xóa ảnh chính"
            >
              <X className="h-5 w-5" />
            </button>
            <p className="mt-3 text-center text-sm font-bold text-green-600">
              ✅ Hình ảnh chính đã sẵn sàng!
            </p>
          </div>
        )}
      </div>

      {/* Text Input */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <label className="font-medium text-slate-700">
            Đoạn văn: <span className="text-red-500">*</span>
          </label>
          <button
            onClick={detectGaps}
            className="rounded-lg border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-600 transition-colors hover:bg-orange-100"
          >
            🔍 Phát hiện chỗ trống
          </button>
        </div>

        {/* Formatting Toolbar */}
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <span className="text-sm font-semibold text-slate-600">Định dạng:</span>
          
          <button
            type="button"
            onClick={makeBold}
            className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm font-bold transition-colors hover:bg-slate-100"
            title="In đậm (bôi đen text rồi nhấn)"
          >
            <span className="font-bold">B</span>
            <span className="text-xs">In đậm</span>
          </button>

          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-gray-600">Tô màu:</span>
            <button
              type="button"
              onClick={() => makeHighlight('#ffeb3b')}
              className="h-8 w-8 rounded-lg border-2 border-gray-300 transition-all hover:scale-110"
              style={{ backgroundColor: '#ffeb3b' }}
              title="Tô vàng"
            />
            <button
              type="button"
              onClick={() => makeHighlight('#4ade80')}
              className="h-8 w-8 rounded-lg border-2 border-gray-300 transition-all hover:scale-110"
              style={{ backgroundColor: '#4ade80' }}
              title="Tô xanh lá"
            />
            <button
              type="button"
              onClick={() => makeHighlight('#60a5fa')}
              className="h-8 w-8 rounded-lg border-2 border-gray-300 transition-all hover:scale-110"
              style={{ backgroundColor: '#60a5fa' }}
              title="Tô xanh dương"
            />
            <button
              type="button"
              onClick={() => makeHighlight('#f87171')}
              className="h-8 w-8 rounded-lg border-2 border-gray-300 transition-all hover:scale-110"
              style={{ backgroundColor: '#f87171' }}
              title="Tô đỏ"
            />
            <button
              type="button"
              onClick={() => makeHighlight('#c084fc')}
              className="h-8 w-8 rounded-lg border-2 border-gray-300 transition-all hover:scale-110"
              style={{ backgroundColor: '#c084fc' }}
              title="Tô tím"
            />
          </div>

          <div className="ml-auto text-xs text-gray-600">
            💡 Bôi đen text trước khi nhấn nút format
          </div>
        </div>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          className="w-full rounded-lg border border-slate-300 px-4 py-3 leading-relaxed focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
          placeholder="Nhập đoạn văn với chỗ trống...

VD:
Tom likes to __1__ football in the park. He has a **big** __2__ ball. Every day after school, he __3__ with his friends. They are very __4__ when they play together."
        />
        {gaps.length > 0 && (
          <p className="mt-2 text-sm font-medium text-green-600">
            ✓ Đã phát hiện {gaps.length} chỗ trống
          </p>
        )}
        
        {/* Format Guide */}
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="mb-1 text-xs font-semibold text-slate-700">📖 Hướng dẫn format:</p>
          <ul className="space-y-1 text-xs text-slate-600">
            <li>• <code className="rounded bg-slate-100 px-1">**text**</code> = <strong>in đậm</strong></li>
            <li>• <code className="rounded bg-slate-100 px-1">&lt;mark style="background-color: #ffeb3b"&gt;text&lt;/mark&gt;</code> = <mark style={{ backgroundColor: '#ffeb3b' }}>tô màu</mark></li>
            <li>• Hoặc bôi đen text và nhấn nút format ở trên</li>
          </ul>
        </div>
      </div>

      {/* Word Bank */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="text-base font-semibold text-slate-800">
            🏦 Ngân hàng từ ({wordBank.length} từ)
          </h4>
          
          {/* Toggle for images in word bank */}
          <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-slate-300 bg-slate-50 px-4 py-2">
            <input
              type="checkbox"
              checked={hasImagesInBank}
              onChange={(e) => setHasImagesInBank(e.target.checked)}
              className="h-5 w-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
            />
            <span className="text-sm font-medium text-slate-700">
              📸 Có hình ảnh kèm từ
            </span>
          </label>
        </div>
        
        <p className="mb-4 text-sm text-gray-600">
          {hasImagesInBank 
            ? '🎨 Movers R&W Part 3: Mỗi từ có hình ảnh minh họa (cloze story với word bank có hình)'
            : '📝 Starters R&W Part 4: Chỉ có từ, không có hình ảnh (điền từ vào đoạn văn)'
          }
        </p>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {wordBank.map((item, index) => (
            <div key={index} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-600">
                  Từ #{index + 1}
                </span>
                {wordBank.length > 5 && (
                  <button
                    onClick={() => removeWordSlot(index)}
                    className="rounded-lg border-2 border-red-300 bg-red-50 p-1 text-red-600 hover:bg-red-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Word Input */}
              <input
                type="text"
                value={item.word}
                onChange={(e) => updateWordBank(index, 'word', e.target.value)}
                className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 font-medium focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                placeholder={`Nhập từ ${index + 1}`}
              />

              {/* Image Upload - Only show if hasImagesInBank is true */}
              {hasImagesInBank && (
              <div className="mb-2">
                <label className="mb-1 flex items-center justify-between text-xs font-medium text-slate-600">
                  <span>Hình ảnh</span>
                  <span className="text-xs font-normal text-slate-400">💡 Nhấn vào ô rồi Ctrl+V</span>
                </label>
                {!item.imageUrl ? (
                  <div
                    tabIndex={0}
                    onClick={() => {
                      if (focusedImageArea !== index) {
                        setFocusedImageArea(index);
                      } else {
                        const input = document.getElementById(`word-image-${index}`) as HTMLInputElement;
                        if (input) input.click();
                      }
                    }}
                    onFocus={() => setFocusedImageArea(index)}
                    onBlur={() => setFocusedImageArea(null)}
                    className={`cursor-pointer rounded-lg border border-dashed transition-all ${
                      focusedImageArea === index
                        ? 'border-orange-400 bg-orange-50'
                        : 'border-slate-300 bg-white hover:border-orange-400 hover:bg-orange-50/40'
                    }`}
                  >
                    <div className="flex flex-col items-center justify-center p-4">
                      <ImageIcon className={`mb-1 h-8 w-8 ${
                        focusedImageArea === index ? 'text-orange-500' : 'text-slate-400'
                      }`} />
                      <span className={`text-xs font-medium ${
                        focusedImageArea === index ? 'text-orange-600' : 'text-slate-500'
                      }`}>
                        {uploadingWordImage === index ? '⏳ Đang tải...' : 'Click hoặc Ctrl+V'}
                      </span>
                      {focusedImageArea === index && (
                        <div className="mt-2 rounded-lg bg-orange-100 px-3 py-1">
                          <p className="text-xs font-semibold text-orange-700">
                            ⌨️ Sẵn sàng paste!
                          </p>
                        </div>
                      )}
                    </div>
                    <input
                      id={`word-image-${index}`}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleWordImageUpload(index, e)}
                      className="hidden"
                      disabled={uploadingWordImage === index}
                    />
                  </div>
                ) : (
                  <div className="relative">
                    <img
                      src={getFullMediaUrl(item.imageUrl) ?? item.imageUrl}
                      alt={item.word}
                      className="h-24 w-full rounded-lg border border-slate-200 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => updateWordBank(index, 'imageUrl', '')}
                      className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
              )}
            </div>
          ))}
        </div>

        {wordBank.length < 12 && (
          <button
            onClick={addWordSlot}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 py-3 text-sm font-medium text-slate-600 transition-colors hover:border-orange-400 hover:bg-orange-50/40"
          >
            <Plus className="h-4 w-4" />
            <span>Thêm từ</span>
          </button>
        )}
      </div>

      {/* Gaps Answers */}
      {gaps.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <span className="text-lg">✅</span> Đáp án đúng
            </h4>
            <div className="text-sm text-slate-500">
              {getScorableItemsCount(gaps)} câu chấm điểm • {getExampleItemsCount(gaps)} câu ví dụ
            </div>
          </div>
          <div className="space-y-4">
            {gaps.map((gap) => (
              <div key={gap.id} className={`rounded-lg border p-4 ${
                gap.isExample
                  ? 'border-amber-300 bg-amber-50'
                  : 'border-slate-200 bg-slate-50'
              }`}>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900">
                    Chỗ trống {gap.gapNumber}:
                  </span>
                  {gap.isExample && (
                    <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white">
                      📌 Câu ví dụ
                    </span>
                  )}
                </div>
                
                <div className="space-y-3">
                  {/* Example checkbox */}
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={gap.isExample || false}
                      onChange={(e) => updateGapExample(gap.gapNumber, e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                    />
                    <span className="text-sm font-medium text-slate-700">
                      ✨ Đánh dấu là ví dụ (không tính điểm)
                    </span>
                  </label>

                  {/* Answer selection */}
                  <select
                    value={gap.correctWord || ''}
                    onChange={(e) => updateGapAnswer(gap.gapNumber, e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                  >
                    <option value="">-- Chọn đáp án đúng --</option>
                    {wordBank.filter(w => w.word.trim()).map((item, index) => (
                      <option key={index} value={item.word}>
                        {item.word}
                      </option>
                    ))}
                  </select>
                  {/* Debug info */}
                  {gap.correctWord && (
                    <p className="text-xs text-emerald-600 mt-1">
                      ✅ Đã chọn: <span className="font-semibold">{gap.correctWord}</span>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview */}
      {gaps.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <h4 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900">
            <span className="text-lg">👀</span> Xem trước
          </h4>
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            {/* Main Image Preview */}
            {mainImageUrl && (
              <div className="mb-6 flex justify-center">
                <img
                  src={getFullMediaUrl(mainImageUrl) ?? mainImageUrl}
                  alt="Main context"
                  className="max-h-64 rounded-lg border border-slate-200 shadow-sm"
                />
              </div>
            )}

            {/* Text with gaps */}
            <div className="mb-6 leading-relaxed text-lg">
              {renderFormattedTextWithGaps(text, gaps)}
            </div>

            {/* Word Bank Preview */}
            <div className="border-t border-slate-200 pt-4">
              <p className="mb-3 font-semibold text-slate-700">Ngân hàng từ:</p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {wordBank.filter(w => w.word.trim()).map((item, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-slate-200 bg-white p-2 text-center"
                  >
                    {item.imageUrl && (
                      <img
                        src={getFullMediaUrl(item.imageUrl) ?? item.imageUrl}
                        alt={item.word}
                        className="mb-2 h-16 w-full rounded object-cover"
                      />
                    )}
                    <span className="block font-medium text-sm">{item.word}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Scoring Info */}
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-sm font-semibold text-emerald-700">
                📊 Tính điểm: {getScorableItemsCount(gaps)} câu × 1 điểm = {getScorableItemsCount(gaps)} điểm
              </p>
              {getExampleItemsCount(gaps) > 0 && (
                <p className="text-xs text-emerald-600 mt-1">
                  ({getExampleItemsCount(gaps)} câu ví dụ không tính điểm)
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
        <button
          onClick={onCancel}
          className="flex items-center gap-2 rounded-lg border border-slate-300 px-6 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          <X className="h-4 w-4" />
          <span>Hủy</span>
        </button>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 rounded-lg bg-orange-500 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-600"
        >
          <Save className="h-4 w-4" />
          <span>Lưu câu hỏi</span>
        </button>
      </div>
    </div>
  );
};

export default WordBankFillEditor;
