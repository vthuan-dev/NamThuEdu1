import React, { useState } from 'react';
import { Save, X, Plus, Trash2 } from 'lucide-react';

interface ClozeTestEditorProps {
  onSave: (data: any) => void;
  onCancel: () => void;
  initialData?: any;
  examId: string | null;
  questionId: string | null;
}

interface Gap {
  gap_id: number;
  options: string[];
  correct_answer: string;
}

const ClozeTestEditor: React.FC<ClozeTestEditorProps> = ({
  onSave,
  onCancel,
  initialData,
}) => {
  const [title, setTitle] = useState(initialData?.title || 'Cloze Test');
  const [points, setPoints] = useState(initialData?.points || 5);
  const [text, setText] = useState(
    initialData?.config?.text || 'Tom likes to play __1__ in the park. He has a __2__ ball.'
  );
  const [gaps, setGaps] = useState<Gap[]>(() => {
    // Hỗ trợ cả `gaps` (editor) lẫn `questions` (seed/dữ liệu cũ) + gap_number→gap_id.
    const raw = initialData?.config?.gaps ?? initialData?.config?.questions;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((g: any, idx: number) => ({
        gap_id: g?.gap_id ?? g?.gap_number ?? idx + 1,
        options: Array.isArray(g?.options) ? g.options : ['', '', ''],
        correct_answer: g?.correct_answer ?? '',
      }));
    }
    return [{ gap_id: 1, options: ['', '', ''], correct_answer: '' }];
  });
  const [isSelectingBlanks, setIsSelectingBlanks] = useState(false);
  
  // Story title question (optional - for Movers/Flyers R&W Part 3)
  const [hasStoryTitle, setHasStoryTitle] = useState(
    !!initialData?.config?.story_title_question
  );
  const [storyTitleOptions, setStoryTitleOptions] = useState<string[]>(
    initialData?.config?.story_title_question?.options || ['', '', '']
  );
  const [storyTitleCorrect, setStoryTitleCorrect] = useState(
    initialData?.config?.story_title_question?.correct_answer || ''
  );

  // Auto-detect blanks from text
  const handleDetectBlanks = () => {
    if (!text.trim()) {
      alert('Vui lòng nhập đoạn văn trước!');
      return;
    }

    // Find all existing gap markers
    const existingGaps = text.match(/__\d+__/g) || [];
    
    if (existingGaps.length > 0) {
      const confirm = window.confirm(
        `Đã phát hiện ${existingGaps.length} chỗ trống. Bạn có muốn tạo cấu hình cho chúng không?`
      );
      
      if (confirm) {
        const gapIds: number[] = existingGaps.map(marker => {
          const match = marker.match(/__(\d+)__/);
          return match ? parseInt(match[1]) : 0;
        }).filter(id => id > 0);

        const uniqueGapIds: number[] = Array.from(new Set<number>(gapIds)).sort((a, b) => a - b);
        
        const newGaps = uniqueGapIds.map(id => ({
          gap_id: id,
          options: ['', '', ''],
          correct_answer: '',
        }));

        setGaps(newGaps);
        alert(`Đã tạo ${newGaps.length} chỗ trống! Vui lòng điền đáp án và lựa chọn.`);
      }
    } else {
      alert('Không tìm thấy chỗ trống nào! Vui lòng đánh dấu chỗ trống bằng __1__, __2__, __3__...');
    }
  };

  const handleAddGap = () => {
    const newGapId = gaps.length > 0 ? Math.max(...gaps.map(g => g.gap_id)) + 1 : 1;
    setGaps([...gaps, { gap_id: newGapId, options: ['', '', ''], correct_answer: '' }]);
  };

  const handleRemoveGap = (gapId: number) => {
    if (gaps.length > 1) {
      setGaps(gaps.filter(g => g.gap_id !== gapId));
    }
  };

  const handleGapChange = (gapId: number, field: 'correct_answer', value: string) => {
    setGaps(gaps.map(g => g.gap_id === gapId ? { ...g, [field]: value } : g));
  };

  const handleOptionChange = (gapId: number, optionIndex: number, value: string) => {
    setGaps(gaps.map(g => {
      if (g.gap_id === gapId) {
        const newOptions = [...g.options];
        newOptions[optionIndex] = value;
        return { ...g, options: newOptions };
      }
      return g;
    }));
  };

  const handleAddOption = (gapId: number) => {
    setGaps(gaps.map(g => {
      if (g.gap_id === gapId && g.options.length < 5) {
        return { ...g, options: [...g.options, ''] };
      }
      return g;
    }));
  };

  const handleRemoveOption = (gapId: number, optionIndex: number) => {
    setGaps(gaps.map(g => {
      if (g.gap_id === gapId && g.options.length > 2) {
        return { ...g, options: g.options.filter((_, i) => i !== optionIndex) };
      }
      return g;
    }));
  };

  const renderTextWithGaps = () => {
    let result = text;
    gaps.forEach(gap => {
      const gapMarker = `__${gap.gap_id}__`;
      result = result.replace(
        gapMarker,
        `<span class="inline-flex items-center rounded-lg bg-yellow-200 px-3 py-1 font-bold text-yellow-800">${gapMarker}</span>`
      );
    });
    return result;
  };

  const handleSave = () => {
    // Validate
    if (!text.trim()) {
      alert('Vui lòng nhập đoạn văn!');
      return;
    }

    const hasEmptyGaps = gaps.some(
      gap => !gap.correct_answer || gap.options.some(opt => !opt.trim())
    );

    if (hasEmptyGaps) {
      alert('Vui lòng điền đầy đủ thông tin cho tất cả các chỗ trống!');
      return;
    }

    // Check if all gaps are in text
    const missingGaps = gaps.filter(gap => !text.includes(`__${gap.gap_id}__`));
    if (missingGaps.length > 0) {
      alert(`Chỗ trống __${missingGaps[0].gap_id}__ không có trong đoạn văn!`);
      return;
    }

    // Validate story title question if enabled
    if (hasStoryTitle) {
      const hasEmptyTitleOptions = storyTitleOptions.some(opt => !opt.trim());
      if (hasEmptyTitleOptions || !storyTitleCorrect.trim()) {
        alert('Vui lòng điền đầy đủ thông tin cho câu hỏi chọn tên câu chuyện!');
        return;
      }
    }

    const config: any = {
      text,
      gaps: gaps.map(gap => ({
        gap_id: gap.gap_id,
        options: gap.options.filter(opt => opt.trim()),
        correct_answer: gap.correct_answer.trim(),
      })),
    };

    // Add story title question if enabled
    if (hasStoryTitle) {
      config.story_title_question = {
        options: storyTitleOptions.filter(opt => opt.trim()),
        correct_answer: storyTitleCorrect.trim(),
      };
    }

    const questionData = {
      type: 'cloze_test',
      title,
      points,
      config,
    };

    onSave(questionData);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📝</span>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Cloze Test
              </h3>
              <p className="text-sm text-slate-500">
                Chọn từ đúng để điền vào chỗ trống
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              <X className="h-4 w-4" />
              <span>Hủy</span>
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
            >
              <Save className="h-4 w-4" />
              <span>Lưu câu hỏi</span>
            </button>
          </div>
        </div>
      </div>

      {/* Basic Info */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h4 className="mb-4 text-base font-semibold text-slate-900">
          📝 Thông tin cơ bản
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
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
              placeholder="VD: Điền từ vào chỗ trống"
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
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
              min="1"
              max="10"
            />
          </div>
        </div>
      </div>

      {/* Text with Gaps */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h4 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900">
          <span className="text-lg">📄</span> Đoạn văn
        </h4>
        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">
                Nhập đoạn văn (dùng __1__, __2__, __3__ để đánh dấu chỗ trống)
              </label>
              <button
                onClick={handleDetectBlanks}
                className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600"
              >
                <span>🔍</span>
                <span>Phát hiện chỗ trống</span>
              </button>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
              rows={6}
              placeholder="VD: Tom likes to play __1__ in the park. He has a __2__ ball. His friend __3__ plays with him."
            />
          </div>

          {/* Preview */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="mb-2 text-sm font-medium text-slate-700">Xem trước:</p>
            <div
              className="text-lg leading-relaxed"
              dangerouslySetInnerHTML={{ __html: renderTextWithGaps() }}
            />
          </div>
        </div>
      </div>

      {/* Gaps Configuration */}
      <div className="space-y-4">
        {/* Sticky header with add button */}
        <div className="sticky top-0 z-40 -mx-6 -mt-6 mb-4 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <h4 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <span className="text-lg">🔢</span> Cấu hình chỗ trống ({gaps.length})
          </h4>
          <button
            onClick={handleAddGap}
            className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600"
          >
            <Plus className="h-4 w-4" />
            <span>Thêm chỗ trống</span>
          </button>
        </div>

        {gaps.map((gap) => (
          <div
            key={gap.gap_id}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <div className="mb-4 flex items-center justify-between">
              <h5 className="text-sm font-semibold text-slate-900">
                Chỗ trống __{gap.gap_id}__
              </h5>
              {gaps.length > 1 && (
                <button
                  onClick={() => handleRemoveGap(gap.gap_id)}
                  className="rounded-lg border border-red-300 p-2 text-red-500 transition-all hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="space-y-4">
              {/* Correct Answer */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Đáp án đúng *
                </label>
                <input
                  type="text"
                  value={gap.correct_answer}
                  onChange={(e) =>
                    handleGapChange(gap.gap_id, 'correct_answer', e.target.value)
                  }
                  className="w-full rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  placeholder="VD: football"
                />
              </div>

              {/* Options */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">
                    Các lựa chọn * (bao gồm đáp án đúng)
                  </label>
                  {gap.options.length < 5 && (
                    <button
                      onClick={() => handleAddOption(gap.gap_id)}
                      className="text-sm text-orange-600 hover:text-orange-700"
                    >
                      + Thêm lựa chọn
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {gap.options.map((option, optIndex) => (
                    <div key={optIndex} className="flex items-center space-x-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 font-bold text-orange-600">
                        {String.fromCharCode(65 + optIndex)}
                      </span>
                      <input
                        type="text"
                        value={option}
                        onChange={(e) =>
                          handleOptionChange(gap.gap_id, optIndex, e.target.value)
                        }
                        className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                        placeholder={`Lựa chọn ${String.fromCharCode(65 + optIndex)}`}
                      />
                      {gap.options.length > 2 && (
                        <button
                          onClick={() => handleRemoveOption(gap.gap_id, optIndex)}
                          className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Story Title Question (Optional - Movers/Flyers R&W Part 3) */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h4 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <span className="text-lg">📖</span> Câu hỏi chọn tên câu chuyện (Tùy chọn)
            </h4>
            <p className="text-sm text-slate-500">
              Movers/Flyers R&W Part 3: "What's the best name for this story?"
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hasStoryTitle}
              onChange={(e) => setHasStoryTitle(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-400"
            />
            <span className="text-sm font-medium text-slate-700">
              Bật câu hỏi này
            </span>
          </label>
        </div>

        {hasStoryTitle && (
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Các lựa chọn tên câu chuyện:
              </label>
              {storyTitleOptions.map((option, index) => (
                <div key={index} className="mb-2 flex items-center gap-2">
                  <span className="font-semibold text-slate-600">
                    {String.fromCharCode(65 + index)}.
                  </span>
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...storyTitleOptions];
                      newOptions[index] = e.target.value;
                      setStoryTitleOptions(newOptions);
                    }}
                    className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                    placeholder={`Tên câu chuyện ${String.fromCharCode(65 + index)}`}
                  />
                  {storyTitleOptions.length > 3 && (
                    <button
                      onClick={() => {
                        setStoryTitleOptions(storyTitleOptions.filter((_, i) => i !== index));
                      }}
                      className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              {storyTitleOptions.length < 5 && (
                <button
                  onClick={() => setStoryTitleOptions([...storyTitleOptions, ''])}
                  className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-orange-400 hover:bg-orange-50/40"
                >
                  <Plus className="h-4 w-4" />
                  <span>Thêm lựa chọn</span>
                </button>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Đáp án đúng:
              </label>
              <select
                value={storyTitleCorrect}
                onChange={(e) => setStoryTitleCorrect(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
              >
                <option value="">-- Chọn đáp án đúng --</option>
                {storyTitleOptions.filter(opt => opt.trim()).map((option, index) => (
                  <option key={index} value={option}>
                    {String.fromCharCode(65 + index)}. {option}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <span>💡</span> Hướng dẫn:
        </h4>
        <ul className="space-y-1 text-sm text-slate-600">
          <li>• Nhập đoạn văn và dùng __1__, __2__, __3__ để đánh dấu chỗ trống</li>
          <li>• Mỗi chỗ trống cần có đáp án đúng và 2-5 lựa chọn</li>
          <li>• Đáp án đúng phải nằm trong danh sách lựa chọn</li>
          <li>• Học viên sẽ chọn từ đúng từ dropdown hoặc radio buttons</li>
          <li>• Phù hợp cho tất cả các level (Starters, Movers, Flyers)</li>
        </ul>
      </div>
    </div>
  );
};

export default ClozeTestEditor;
