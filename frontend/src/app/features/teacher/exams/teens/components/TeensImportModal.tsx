import { useRef, useState } from 'react';
import { X, Upload, FileText, CheckCircle2, Loader2, AlertCircle, Headphones, Mic, Sparkles } from 'lucide-react';
import { API_BASE_URL } from '../../../../../../utils/apiConfig';
import { getAuthToken } from '../../../../../../utils/authStorage';

interface Props {
  open: boolean;
  skill?: 'listening' | 'speaking' | 'auto';
  onClose: () => void;
  onImport: (data: any) => void;
}

export function TeensImportModal({ open, skill = 'auto', onClose, onImport }: Props) {
  const [payload, setPayload] = useState<any>(null);
  const [fileName, setFileName] = useState('');
  const [parseError, setError] = useState('');
  const [pdfStage, setPdfStage] = useState<'idle' | 'extract' | 'scanned' | 'ai'>('idle');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const pdfFileRef = useRef<File | null>(null);
  const [aiParsing, setAiParsing] = useState(false);
  const [pdfProgress, setPdfProgress] = useState({ label: '', done: 0, total: 0 });
  const [scannedText, setScannedText] = useState('');
  const [sourceKind, setSourceKind] = useState<'pdf' | 'docx' | 'json' | null>(null);

  if (!open) return null;

  const isListening = skill === 'listening';
  const accentColor = isListening ? '#0EA5E9' : skill === 'speaking' ? '#EC4899' : '#0D9488';
  const SkillIcon = isListening ? Headphones : skill === 'speaking' ? Mic : Sparkles;

  const handleFile = async (f: File) => {
    setError('');
    setPayload(null);
    setFileName(f.name);

    const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
    const isDocx = /\.docx$/i.test(f.name) || f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const isJson = f.type === 'application/json' || /\.json$/i.test(f.name);

    if (isPdf) {
      setSourceKind('pdf');
      pdfFileRef.current = f;
      await extractPdfText(f);
      return;
    }

    if (isDocx) {
      setSourceKind('docx');
      await extractDocxText(f);
      return;
    }

    if (isJson) {
      try {
        const text = await f.text();
        const parsed = JSON.parse(text);
        const detectedSkill = parsed.skill || (parsed.groups ? 'listening' : parsed.parts ? 'speaking' : null);
        if (!detectedSkill) {
          throw new Error('File JSON import không hợp lệ (phải chứa key "groups" hoặc "parts")');
        }
        if (skill !== 'auto' && skill !== detectedSkill) {
          throw new Error(`Dữ liệu JSON không khớp kỹ năng đang yêu cầu (${skill})`);
        }
        setSourceKind('json');
        setPayload({ ...parsed, skill: detectedSkill });
      } catch (e: any) {
        setError(e.message || 'JSON không hợp lệ');
      }
      return;
    }

    setError('Chỉ hỗ trợ file .pdf, .docx hoặc .json');
  };

  const extractDocxText = async (f: File) => {
    setError('');
    setPayload(null);
    setFileName(f.name);
    setPendingFile(null);
    pdfFileRef.current = null;
    try {
      setPdfStage('extract');
      setPdfProgress({ label: 'Đang đọc file Word...', done: 0, total: 0 });
      const mammoth = await import('mammoth');
      const buf = await f.arrayBuffer();
      const { value } = await mammoth.convertToHtml({ arrayBuffer: buf });
      const htmlText = (value || '').trim();
      if (htmlText.length < 30) {
        throw new Error('File Word không có đủ ký tự văn bản.');
      }
      setScannedText(htmlText);
      setPdfStage('scanned');
    } catch (e: any) {
      setError(e.message || 'Lỗi đọc file Word');
      setPdfStage('idle');
    }
  };

  const extractPdfText = async (f: File) => {
    setError('');
    setPayload(null);
    setFileName(f.name);
    setPendingFile(null);
    pdfFileRef.current = f;

    try {
      setPdfStage('extract');
      setPdfProgress({ label: 'Đang mở file PDF...', done: 0, total: 0 });
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
      const buf = await f.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: buf }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        setPdfProgress({ label: `Trang ${i}/${pdf.numPages}`, done: i, total: pdf.numPages });
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        let lastY: number | null = null;
        let pageText = '';
        for (const item of content.items as any[]) {
          if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) pageText += '\n';
          pageText += item.str;
          lastY = item.transform[5];
        }
        fullText += `\n=== Page ${i} ===\n${pageText.trim()}\n`;
      }

      setScannedText(fullText);
      setPdfStage('scanned');
    } catch (e: any) {
      setError(e.message || 'Lỗi đọc PDF');
      setPdfStage('idle');
    }
  };

  const startFakeProgress = (label: string) => {
    setPdfProgress({ label, done: 5, total: 100 });
    return window.setInterval(() => {
      setPdfProgress(p =>
        p.total === 100 && p.done < 95
          ? { ...p, done: p.done + Math.max(1, Math.round((95 - p.done) * 0.1)) }
          : p
      );
    }, 600);
  };

  const handleGeminiParse = async () => {
    const file = pdfFileRef.current;
    if (!file) {
      setError('Không tìm thấy file để phân tích.');
      return;
    }
    setError('');
    setAiParsing(true);
    setPdfStage('ai');
    const timer = startFakeProgress('Gemini đang phân tích nội dung PDF...');
    try {
      const token = getAuthToken();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('skill', skill);

      const res = await fetch(`${API_BASE_URL}/teacher/teens/parse-pdf`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || `Lỗi AI: ${res.status}`);
      }

      setPayload(json.data);
      setPdfStage('idle');
    } catch (e: any) {
      setError(e.message || 'Lỗi phân tích tệp bằng AI');
      setPdfStage('scanned');
    } finally {
      clearInterval(timer);
      setAiParsing(false);
    }
  };

  const handleTextAiParse = async () => {
    if (!scannedText.trim()) {
      setError('Không có nội dung văn bản để phân tích.');
      return;
    }
    setError('');
    setAiParsing(true);
    setPdfStage('ai');
    const timer = startFakeProgress('AI đang phân tích văn bản...');
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE_URL}/teacher/teens/parse-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text: scannedText, skill }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'AI phân tích văn bản thất bại.');
      }

      setPayload(json.data);
      setPdfStage('idle');
    } catch (e: any) {
      setError(e.message || 'Lỗi phân tích văn bản');
      setPdfStage('scanned');
    } finally {
      clearInterval(timer);
      setAiParsing(false);
    }
  };

  const handleImportSubmit = () => {
    if (!payload) return;
    const finalSkill = payload.skill || skill;
    onImport({ ...payload, skill: finalSkill });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex h-[90vh] w-full max-w-4xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl text-white flex items-center justify-center shadow-md shadow-teal-500/10" style={{ backgroundColor: accentColor }}>
              <SkillIcon className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Import đề Teens bằng AI</h3>
              <p className="text-xs text-slate-400">Hỗ trợ tệp PDF, DOCX (Word), JSON</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* File Upload Zone */}
          {pdfStage === 'idle' && !payload && (
            <div
              className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-slate-300 rounded-3xl p-10 bg-slate-50/30 transition-all group"
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={e => {
                e.preventDefault();
                e.stopPropagation();
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
            >
              <div className="p-4 rounded-full bg-slate-100 text-slate-400 group-hover:bg-slate-200/50 group-hover:text-slate-500 transition-all mb-4">
                <Upload className="w-8 h-8" />
              </div>
              <p className="font-semibold text-slate-700 text-sm mb-1">
                Kéo thả file đề của bạn vào đây
              </p>
              <p className="text-xs text-slate-400 mb-6">hoặc click để chọn file từ máy tính</p>
              <input
                type="file"
                accept=".pdf,.docx,.json"
                className="hidden"
                id="teens-file-picker"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <label
                htmlFor="teens-file-picker"
                className="cursor-pointer px-5 py-2.5 rounded-xl font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
                style={{ backgroundColor: accentColor }}
              >
                Chọn tệp tin
              </label>
            </div>
          )}


          {/* Loading or Extracted Text Stages */}
          {pdfStage !== 'idle' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3">
                <FileText className="w-5 h-5 text-slate-400" />
                <span className="text-sm font-semibold text-slate-700 truncate">{fileName}</span>
              </div>

              {pdfStage === 'extract' && (
                <div className="flex flex-col items-center py-12 space-y-4">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                  <p className="text-sm text-slate-500">{pdfProgress.label}</p>
                </div>
              )}

              {pdfStage === 'scanned' && (
                <div className="flex flex-col items-center justify-center py-8 space-y-6 text-center">
                  <div className="p-4 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 animate-bounce" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 mb-1">Tài liệu đã được tải lên thành công!</h4>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      Hệ thống đã đọc cấu trúc văn bản của tệp. Nhấp nút dưới để kích hoạt AI phân tích và đưa vào giao diện chỉnh sửa.
                    </p>
                  </div>
                  <button
                    onClick={sourceKind === 'pdf' ? handleGeminiParse : handleTextAiParse}
                    className="px-6 py-3 rounded-xl font-bold text-white shadow-lg flex items-center gap-2 transition-transform hover:scale-105"
                    style={{ backgroundColor: accentColor }}
                  >
                    <Sparkles className="w-4 h-4" /> Bắt đầu phân tích bằng AI
                  </button>
                </div>
              )}

              {pdfStage === 'ai' && (
                <div className="flex flex-col items-center py-12 space-y-4">
                  <Loader2 className="w-10 h-10 animate-spin" style={{ color: accentColor }} />
                  <p className="text-sm font-semibold text-slate-700">{pdfProgress.label}</p>
                  <div className="w-full max-w-xs bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pdfProgress.done}%`, backgroundColor: accentColor }}></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Success Payload Preview */}
          {payload && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <div>
                    <h4 className="font-bold text-emerald-800 text-sm">Phân tích thành công!</h4>
                    <p className="text-xs text-emerald-600">
                      Tìm thấy {payload.skill === 'listening' ? `${payload.groups?.length || 0} nhóm câu hỏi` : `${payload.parts?.length || 0} đề bài nói`} ({payload.skill === 'listening' ? 'Listening' : 'Speaking'})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setPayload(null);
                    setPdfStage('idle');
                    setFileName('');
                  }}
                  className="text-xs text-slate-400 hover:text-slate-600 font-semibold"
                >
                  Chọn file khác
                </button>
              </div>

              {/* JSON preview container */}
              <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-900 text-slate-100 p-4 h-64 font-mono text-xs overflow-y-auto">
                <pre>{JSON.stringify(payload, null, 2)}</pre>
              </div>
            </div>
          )}

          {parseError && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <h5 className="font-bold text-rose-800 text-sm">Đã có lỗi xảy ra</h5>
                <p className="text-xs text-rose-600">{parseError}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
          >
            Hủy bỏ
          </button>
          <button
            onClick={handleImportSubmit}
            disabled={!payload}
            className="px-6 py-2.5 rounded-xl font-bold text-white transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50"
            style={{ backgroundColor: accentColor }}
          >
            Xác nhận Import đề
          </button>
        </div>
      </div>
    </div>
  );
}
