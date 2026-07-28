import { useRef, useState } from 'react';
import { X, Upload, FileText, CheckCircle2, Loader2, AlertCircle, Headphones, Mic, Sparkles, HelpCircle } from 'lucide-react';
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
  const [fileSize, setFileSize] = useState<string>('');
  const [parseError, setError] = useState('');
  const [pdfStage, setPdfStage] = useState<'idle' | 'extract' | 'scanned' | 'ai'>('idle');
  const pdfFileRef = useRef<File | null>(null);
  const [aiParsing, setAiParsing] = useState(false);
  const [pdfProgress, setPdfProgress] = useState({ label: '', done: 0, total: 0 });
  const [scannedText, setScannedText] = useState('');
  const [sourceKind, setSourceKind] = useState<'pdf' | 'docx' | 'json' | null>(null);
  const [dragActive, setDragActive] = useState(false);

  if (!open) return null;

  // Dynamic Theme mapping based on current detected skill type
  const detectedSkill = payload?.skill || (skill === 'auto' ? 'auto' : skill);
  const themeAccent = detectedSkill === 'listening' ? '#0EA5E9' : detectedSkill === 'speaking' ? '#EC4899' : '#0D9488';
  const themeBg = detectedSkill === 'listening' ? 'bg-sky-50/40' : detectedSkill === 'speaking' ? 'bg-pink-50/40' : 'bg-teal-50/40';
  const themeBorder = detectedSkill === 'listening' ? 'border-sky-200/60' : detectedSkill === 'speaking' ? 'border-pink-200/60' : 'border-teal-200/60';
  const themeRing = detectedSkill === 'listening' ? 'focus:ring-sky-200' : detectedSkill === 'speaking' ? 'focus:ring-pink-200' : 'focus:ring-teal-200';
  const themeShadow = detectedSkill === 'listening' ? 'shadow-sky-100' : detectedSkill === 'speaking' ? 'shadow-pink-100' : 'shadow-teal-100';
  const SkillIcon = detectedSkill === 'listening' ? Headphones : detectedSkill === 'speaking' ? Mic : Sparkles;

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFile = async (f: File) => {
    setError('');
    setPayload(null);
    setFileName(f.name);
    setFileSize(formatBytes(f.size));

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

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[8px] transition-all duration-300">
      {/* Outer Shell - Nested Doppelrand Bezel */}
      <div className="flex h-[85vh] w-full max-w-4xl flex-col rounded-[2.5rem] bg-slate-100/80 p-2 border border-white/25 shadow-2xl backdrop-blur-md overflow-hidden animate-in fade-in zoom-in-95 duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]">
        {/* Inner Core */}
        <div className="flex flex-1 flex-col rounded-[2.2rem] bg-white border border-slate-200/50 shadow-inner overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-4">
              <div 
                className="w-12 h-12 rounded-[1.2rem] flex items-center justify-center shadow-lg transition-all duration-500 ease-out border border-white/20"
                style={{ backgroundColor: themeAccent, boxShadow: `0 8px 20px ${themeAccent}25` }}
              >
                <SkillIcon className="w-5.5 h-5.5 text-white animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-800 tracking-tight">Import đề Teens bằng AI</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-teal-500/10 text-teal-600 border border-teal-500/20">
                    Active
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Hỗ trợ tệp PDF, DOCX (Word), JSON</p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="w-10 h-10 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-all duration-300 active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-8 space-y-6">
            {/* File Upload Zone */}
            {pdfStage === 'idle' && !payload && (
              <div 
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center border-2 border-dashed rounded-[2rem] p-12 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] relative group ${
                  dragActive 
                    ? 'border-teal-500 bg-teal-50/20 shadow-lg shadow-teal-100/50' 
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/30'
                }`}
              >
                {/* Micro-animations in dropzone */}
                <div 
                  className={`p-5 rounded-2xl bg-white shadow-md border border-slate-100 text-slate-400 group-hover:text-slate-600 transition-all duration-500 ease-out mb-5 ${
                    dragActive ? 'scale-110 rotate-3 text-teal-500 shadow-teal-100' : 'group-hover:-translate-y-1'
                  }`}
                >
                  <Upload className="w-8 h-8" />
                </div>
                <p className="font-semibold text-slate-700 text-sm mb-1 tracking-tight">
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
                  className="cursor-pointer px-6 py-2.5 rounded-xl font-bold text-white shadow-lg active:scale-95 transition-all duration-300 hover:shadow-xl flex items-center gap-2"
                  style={{ 
                    backgroundColor: themeAccent, 
                    boxShadow: `0 6px 16px ${themeAccent}30`,
                  }}
                >
                  <Upload className="w-4 h-4" />
                  Chọn tệp tin
                </label>
              </div>
            )}

            {/* Loading or Extracted Text Stages */}
            {pdfStage !== 'idle' && (
              <div className="space-y-4">
                {/* File Details Card */}
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/50 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-white border border-slate-100 text-slate-500 shadow-sm">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-slate-700 block truncate max-w-lg">{fileName}</span>
                      <span className="text-[11px] text-slate-400 font-medium block mt-0.5">{fileSize}</span>
                    </div>
                  </div>
                  {pdfStage === 'scanned' && (
                    <button 
                      onClick={() => {
                        setPayload(null);
                        setPdfStage('idle');
                        setFileName('');
                      }} 
                      className="text-xs text-slate-500 hover:text-slate-700 font-bold px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-all duration-200"
                    >
                      Thay đổi file
                    </button>
                  )}
                </div>

                {pdfStage === 'extract' && (
                  <div className="flex flex-col items-center py-16 space-y-4">
                    <div className="relative">
                      <Loader2 className="w-12 h-12 animate-spin text-slate-400" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-slate-400" />
                      </div>
                    </div>
                    <p className="text-sm text-slate-500 font-semibold tracking-tight animate-pulse">{pdfProgress.label}</p>
                  </div>
                )}

                {pdfStage === 'scanned' && (
                  <div className="flex flex-col items-center justify-center py-12 space-y-6 text-center rounded-[2rem] border border-slate-100 bg-slate-50/20 p-8 shadow-inner">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center shadow-lg shadow-emerald-500/5">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-base tracking-tight mb-1">Tài liệu đã được tải lên thành công!</h4>
                      <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                        Hệ thống đã đọc cấu trúc văn bản của tệp. Nhấp nút dưới để kích hoạt AI tự động phân tích và đưa vào giao diện soạn thảo.
                      </p>
                    </div>
                    <button
                      onClick={sourceKind === 'pdf' ? handleGeminiParse : handleTextAiParse}
                      className="px-8 py-3.5 rounded-xl font-bold text-white shadow-lg flex items-center gap-2 transition-transform hover:scale-105 active:scale-95 duration-300"
                      style={{ 
                        backgroundColor: themeAccent,
                        boxShadow: `0 8px 24px ${themeAccent}35`
                      }}
                    >
                      <Sparkles className="w-4 h-4 animate-bounce" /> Bắt đầu phân tích bằng AI
                    </button>
                  </div>
                )}

                {pdfStage === 'ai' && (
                  <div className="flex flex-col items-center py-16 space-y-5">
                    <div className="relative flex items-center justify-center">
                      <div className="absolute w-16 h-16 rounded-full border border-teal-100 animate-ping"></div>
                      <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center z-10 shadow-xl">
                        <Loader2 className="w-7 h-7 animate-spin" style={{ color: themeAccent }} />
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-slate-700 tracking-tight">{pdfProgress.label}</p>
                      <p className="text-xs text-slate-400 mt-1">Quá trình này có thể mất tới 30 giây...</p>
                    </div>
                    <div className="w-full max-w-xs bg-slate-100 rounded-full h-2 overflow-hidden shadow-inner">
                      <div 
                        className="h-full rounded-full transition-all duration-500 ease-out" 
                        style={{ width: `${pdfProgress.done}%`, backgroundColor: themeAccent }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Success Payload Preview */}
            {payload && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-100/70 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-emerald-800 text-sm">Phân tích thành công!</h4>
                      <p className="text-xs text-emerald-600 font-medium">
                        Tự động nhận dạng: <b className="uppercase">{payload.skill}</b> · Tìm thấy {payload.skill === 'listening' ? `${payload.groups?.length || 0} nhóm câu hỏi` : `${payload.parts?.length || 0} đề bài nói`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setPayload(null);
                      setPdfStage('idle');
                      setFileName('');
                    }}
                    className="text-xs text-emerald-700 hover:text-emerald-900 font-bold px-3 py-1.5 rounded-lg hover:bg-emerald-100/50 transition-all"
                  >
                    Đổi file khác
                  </button>
                </div>

                {/* Styled JSON preview container */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-2">
                    <span>Cấu trúc đề chi tiết (JSON preview)</span>
                    <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">schema: {payload.skill}</span>
                  </div>
                  <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-950 text-slate-300 p-5 h-64 font-mono text-[11px] leading-relaxed shadow-inner">
                    <pre className="overflow-x-auto selection:bg-teal-500/30 select-all scrollbar-thin scrollbar-thumb-slate-800">{JSON.stringify(payload, null, 2)}</pre>
                  </div>
                </div>
              </div>
            )}

            {parseError && (
              <div className="p-5 rounded-2xl bg-rose-50 border border-rose-100 flex items-start gap-3 animate-in shake duration-300">
                <div className="p-2.5 rounded-xl bg-rose-500 text-white shadow-lg shadow-rose-500/20">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                </div>
                <div>
                  <h5 className="font-bold text-rose-800 text-sm">Đã có lỗi xảy ra</h5>
                  <p className="text-xs text-rose-600 mt-1 leading-relaxed">{parseError}</p>
                  <button 
                    onClick={() => {
                      setError('');
                      setPdfStage('idle');
                      setFileName('');
                    }}
                    className="text-xs font-bold text-rose-700 hover:text-rose-900 underline block mt-2.5"
                  >
                    Thử lại với tệp khác
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-8 py-5 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer text-sm"
            >
              Hủy bỏ
            </button>
            <button
              onClick={handleImportSubmit}
              disabled={!payload}
              className="px-6 py-2.5 rounded-xl font-bold text-white transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-95 shadow-md flex items-center gap-1.5 text-sm cursor-pointer"
              style={{ 
                backgroundColor: themeAccent,
                boxShadow: payload ? `0 6px 16px ${themeAccent}30` : 'none'
              }}
            >
              <CheckCircle2 className="w-4 h-4" />
              Xác nhận Import đề
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
