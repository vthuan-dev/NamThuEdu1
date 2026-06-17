import { useState, useEffect } from 'react';
import { X, FileText, Sparkles, AlertCircle, Check } from 'lucide-react';
import {
  parseFormText,
  generatePreviewText,
  type FormParseResult,
  type ParsedFormQuestion,
} from '../utils/formParser';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (questions: ParsedFormQuestion[], title?: string) => void;
  sectionNumber: number;
  /** Starting question number (e.g., 1 for Section 1, 11 for Section 2) */
  startQuestionNumber: number;
}

export function FormPasteModal({
  isOpen,
  onClose,
  onConfirm,
  sectionNumber,
  startQuestionNumber,
}: Props) {
  const [pastedText, setPastedText] = useState('');
  const [parseResult, setParseResult] = useState<FormParseResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      setPastedText('');
      setParseResult(null);
      setShowPreview(false);
    }
  }, [isOpen]);

  const handleParse = () => {
    if (!pastedText.trim()) return;

    const result = parseFormText(pastedText);
    
    // Adjust question numbers to match section
    if (result.questions.length > 0) {
      const offset = startQuestionNumber - result.questions[0].questionNumber;
      result.questions = result.questions.map(q => ({
        ...q,
        questionNumber: q.questionNumber + offset,
      }));
    }

    setParseResult(result);
    setShowPreview(true);
  };

  const handleConfirm = () => {
    if (!parseResult || parseResult.questions.length === 0) return;
    
    onConfirm(parseResult.questions, parseResult.title);
    onClose();
  };

  const handleBack = () => {
    setShowPreview(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                Dán Form Tự Động
              </h3>
              <p className="text-xs text-gray-500">
                Section {sectionNumber} • Câu {startQuestionNumber}–{startQuestionNumber + 9}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {!showPreview ? (
            // Step 1: Paste form
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 text-sm">
                    <p className="font-semibold text-blue-900 mb-2">
                      Hướng dẫn sử dụng:
                    </p>
                    <ol className="space-y-1.5 text-blue-800 list-decimal list-inside">
                      <li>Copy toàn bộ form từ đề thi IELTS gốc (PDF/Word)</li>
                      <li>Paste vào ô bên dưới</li>
                      <li>Hệ thống tự động phát hiện số câu hỏi: <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs font-mono">(1)</code>, <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs font-mono">1.</code>, hoặc <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs font-mono">1)</code></li>
                      <li>Hệ thống tự động phát hiện chỗ trống: <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs font-mono">...........</code> hoặc <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs font-mono">_______</code></li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* Example */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                  Ví dụ định dạng:
                </p>
                <pre className="text-xs text-gray-700 font-mono leading-relaxed whitespace-pre-wrap">
{`Hostel Booking Form

Surname: (1) ...........
Nationality: (2) ...........
Check-in date: (3) ...........
Number of nights: (4) ...........`}
                </pre>
              </div>

              {/* Textarea */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Dán nội dung form tại đây:
                </label>
                <textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Paste form text here..."
                  rows={12}
                  className="w-full px-4 py-3 text-sm border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono resize-none"
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  {pastedText.trim().split('\n').filter(l => l.trim()).length} dòng •{' '}
                  {pastedText.trim().split(/\s+/).filter(w => w).length} từ
                </p>
              </div>
            </div>
          ) : (
            // Step 2: Preview parsed result
            <div className="space-y-4">
              {parseResult && parseResult.errors.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-900 mb-1">
                        Cảnh báo:
                      </p>
                      <ul className="text-sm text-amber-800 space-y-1">
                        {parseResult.errors.map((err, i) => (
                          <li key={i}>• {err}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {parseResult && parseResult.title && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-1">
                    Tiêu đề form:
                  </p>
                  <p className="text-lg font-bold text-blue-900">
                    {parseResult.title}
                  </p>
                </div>
              )}

              {parseResult && parseResult.questions.length > 0 && (
                <div className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-gray-700">
                        Danh sách câu hỏi
                      </p>
                      <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2.5 py-1 rounded-full">
                        {parseResult.questions.length} câu
                      </span>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {parseResult.questions.map((q, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center flex-shrink-0">
                          {q.questionNumber}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {q.label}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 font-mono">
                            {q.originalLine}
                          </p>
                        </div>
                        <Check className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {parseResult && parseResult.questions.length === 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                  <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-red-900 mb-1">
                    Không tìm thấy câu hỏi nào
                  </p>
                  <p className="text-xs text-red-700">
                    Vui lòng kiểm tra lại định dạng và thử lại
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          {!showPreview ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleParse}
                disabled={!pastedText.trim()}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Phân tích tự động
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleBack}
                className="px-4 py-2 text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors"
              >
                ← Quay lại
              </button>
              <button
                onClick={handleConfirm}
                disabled={!parseResult || parseResult.questions.length === 0}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Xác nhận tạo {parseResult?.questions.length || 0} câu
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
