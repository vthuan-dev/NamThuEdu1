import { useRef, useState } from 'react';
import {
  X, Upload, Download, FileText, CheckCircle2, Loader2, AlertCircle,
  Headphones, Mic, Sparkles, Code2, Copy, Check, Bot,
} from 'lucide-react';
import { API_BASE_URL } from '../../../../../../utils/apiConfig';
import { getAuthToken } from '../../../../../../utils/authStorage';
import { PdfPageSelector } from '../../ielts/components/PdfPageSelector';

interface Props {
  open: boolean;
  skill?: 'listening' | 'speaking' | 'auto';
  onClose: () => void;
  onImport: (data: any) => void;
}

// ── JSON mẫu để giáo viên tải về tham khảo ─────────────────────────────────
const SAMPLE_LISTENING = {
  skill: 'listening',
  groups: [
    {
      audio_url: '',
      task_image: '',
      questions: [
        {
          qContent: 'What time does the event start?',
          qType: 'multiple_choice',
          options: [
            { content: '7:00 PM', isCorrect: false },
            { content: '8:00 PM', isCorrect: true },
            { content: '9:00 PM', isCorrect: false },
            { content: '10:00 PM', isCorrect: false },
          ],
        },
        {
          qContent: 'The event is held at the ___.',
          qType: 'fill_blank',
          correctAnswer: 'city hall',
        },
      ],
    },
  ],
};

const SAMPLE_SPEAKING = {
  skill: 'speaking',
  parts: [
    {
      qContent: 'Describe your favourite hobby and explain why you enjoy it.',
      prepSeconds: 30,
      speakSeconds: 120,
    },
  ],
};

export function TeensImportModal({ open, skill = 'auto', onClose, onImport }: Props) {
  const [payload, setPayload]     = useState<any>(null);
  const [fileName, setFileName]   = useState('');
  const [fileSize, setFileSize]   = useState('');
  const [parseError, setError]    = useState('');
  const [pdfStage, setPdfStage]   = useState<'idle' | 'trim' | 'extract' | 'scanned' | 'ai'>('idle');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const pdfFileRef  = useRef<File | null>(null);
  const [aiParsing, setAiParsing] = useState(false);
  const [parseMethod, setParseMethod] = useState<'ai' | 'json' | null>(null);
  const [pdfProgress, setPdfProgress] = useState({ label: '', done: 0, total: 0 });
  const [scannedText, setScannedText] = useState('');
  const [isScanned, setIsScanned] = useState(false);
  const [sourceKind, setSourceKind] = useState<'pdf' | 'docx' | 'json' | null>(null);
  const [showJson, setShowJson]   = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const resetState = () => {
    setPayload(null); setFileName(''); setFileSize(''); setError('');
    setPdfStage('idle'); setPendingFile(null); pdfFileRef.current = null;
    setScannedText(''); setIsScanned(false); setSourceKind(null);
    setAiParsing(false); setParseMethod(null);
  };

  if (!open) return null;

  const detectedSkill = payload?.skill || (skill === 'auto' ? 'auto' : skill);
  const themeAccent   = detectedSkill === 'listening' ? '#0EA5E9' : detectedSkill === 'speaking' ? '#EC4899' : '#0D9488';
  const SkillIcon     = detectedSkill === 'listening' ? Headphones : detectedSkill === 'speaking' ? Mic : Sparkles;

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 Bytes';
    const k = 1024, sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / k ** i).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleFile = async (f: File) => {
    setError(''); setPayload(null);
    setFileName(f.name); setFileSize(formatBytes(f.size));

    const isPdf  = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
    const isDocx = /\.docx$/i.test(f.name) || f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const isJson = f.type === 'application/json' || /\.json$/i.test(f.name);

    if (isPdf) { setSourceKind('pdf'); setPendingFile(f); setPdfStage('trim'); return; }
    if (isDocx) { setSourceKind('docx'); await extractDocxText(f); return; }
    if (isJson) {
      try {
        const text   = await f.text();
        const parsed = JSON.parse(text);
        const ds     = parsed.skill || (parsed.groups ? 'listening' : parsed.parts ? 'speaking' : null);
        if (!ds) throw new Error('JSON không hợp lệ — phải có key "groups" (listening) hoặc "parts" (speaking).');
        if (skill !== 'auto' && skill !== ds) throw new Error(`Dữ liệu JSON không khớp kỹ năng (${skill}).`);
        setSourceKind('json'); setParseMethod('json');
        setPayload({ ...parsed, skill: ds });
      } catch (e: any) { setError(e.message || 'JSON không hợp lệ'); }
      return;
    }
    setError('Chỉ hỗ trợ file .pdf, .docx hoặc .json');
  };

  const extractDocxText = async (f: File) => {
    setError(''); setPayload(null); pdfFileRef.current = null;
    try {
      setPdfStage('extract');
      setPdfProgress({ label: 'Đang đọc và chuyển đổi file Word...', done: 0, total: 0 });
      const mammoth   = await import('mammoth');
      const buf       = await f.arrayBuffer();
      const { value } = await mammoth.convertToHtml({ arrayBuffer: buf });
      const htmlText  = (value || '').trim();
      if (htmlText.length < 30) throw new Error('File Word không có nội dung văn bản.');
      setScannedText(htmlText); setIsScanned(false); setPdfStage('scanned');
    } catch (e: any) { setError(e.message || 'Lỗi đọc file Word'); setPdfStage('idle'); }
  };

  const extractPdfText = async (f: File) => {
    setError(''); setPayload(null); setPendingFile(null);
    pdfFileRef.current = f;
    try {
      setPdfStage('extract');
      setPdfProgress({ label: 'Trang 0/0', done: 0, total: 0 });
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
      const buf   = await f.arrayBuffer();
      const pdf   = await pdfjs.getDocument({ data: buf }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        setPdfProgress({ label: `Trang ${i}/${pdf.numPages}`, done: i, total: pdf.numPages });
        const page    = await pdf.getPage(i);
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
      const meaningful = fullText.replace(/=== Page \d+ ===/g, '').replace(/\s+/g, '').length;
      const scanned    = meaningful < Math.max(120, pdf.numPages * 40);
      setScannedText(fullText); setIsScanned(scanned); setPdfStage('scanned');
    } catch (e: any) { setError(e.message || 'Lỗi đọc PDF'); setPdfStage('idle'); }
  };

  const startFakeProgress = (label: string) => {
    setPdfProgress({ label, done: 8, total: 100 });
    return window.setInterval(() => {
      setPdfProgress(p =>
        p.total === 100 && p.done < 92
          ? { ...p, done: p.done + Math.max(1, Math.round((92 - p.done) * 0.08)) }
          : p,
      );
    }, 700);
  };

  const handleGeminiParsePdf = async () => {
    const file = pdfFileRef.current;
    if (!file) { setError('Không tìm thấy file PDF.'); return; }
    setError(''); setAiParsing(true); setPdfStage('ai');
    const timer = startFakeProgress('Gemini đang đọc & phân tích PDF...');
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 110_000);
    try {
      const token    = getAuthToken();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('skill', skill);
      const res  = await fetch(`${API_BASE_URL}/teacher/teens/parse-pdf`, {
        method: 'POST', signal: controller.signal,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || `Lỗi AI: ${res.status}`);
      setPdfProgress(p => ({ ...p, label: 'Hoàn tất', done: 100 }));
      setParseMethod('ai'); setPayload(json.data); setPdfStage('idle');
    } catch (e: any) {
      setError(e?.name === 'AbortError'
        ? 'AI xử lý quá lâu (>110 giây). File có thể quá dài — hãy cắt bớt trang hoặc thử lại.'
        : e.message || 'Lỗi phân tích PDF bằng AI');
      setPdfStage('scanned');
    } finally { clearTimeout(timeoutId); clearInterval(timer); setAiParsing(false); }
  };

  const handleTextAiParse = async () => {
    if (!scannedText.trim()) { setError('Không có nội dung text để phân tích.'); return; }
    setError(''); setAiParsing(true); setPdfStage('ai');
    const timer      = startFakeProgress('AI đang phân tích văn bản...');
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 110_000);
    try {
      const token = getAuthToken();
      const res   = await fetch(`${API_BASE_URL}/teacher/teens/parse-text`, {
        method: 'POST', signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text: scannedText, skill }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'AI phân tích thất bại.');
      setPdfProgress(p => ({ ...p, label: 'Hoàn tất', done: 100 }));
      setParseMethod('ai'); setPayload(json.data); setPdfStage('idle');
    } catch (e: any) {
      setError(e?.name === 'AbortError'
        ? 'AI xử lý quá lâu (>110 giây). File có thể quá dài — hãy cắt bớt nội dung hoặc thử lại.'
        : e.message || 'Lỗi phân tích văn bản');
      setPdfStage('scanned');
    } finally { clearTimeout(timeoutId); clearInterval(timer); setAiParsing(false); }
  };

  const handleAiSmart = () =>
    isScanned && pdfFileRef.current ? handleGeminiParsePdf() : handleTextAiParse();

  const downloadSample = () => {
    const sample  = skill === 'speaking' ? SAMPLE_SPEAKING : SAMPLE_LISTENING;
    const blob    = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
    const url     = URL.createObjectURL(blob);
    const a       = document.createElement('a');
    a.href = url; a.download = `teens-${skill === 'speaking' ? 'speaking' : 'listening'}-template.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  const summary = payload && {
    groups   : payload.groups?.length || 0,
    parts    : payload.parts?.length  || 0,
    questions: payload.skill === 'listening'
      ? (payload.groups?.reduce((s: number, g: any) => s + (g.questions?.length || 0), 0) || 0)
      : 0,
  };

  const handleImportSubmit = () => {
    if (!payload) return;
    onImport({ ...payload, skill: payload.skill || skill });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[8px] transition-all duration-300"
      onClick={onClose}
    >
      <div
        className={`flex w-full border border-white/25 shadow-2xl backdrop-blur-md overflow-hidden animate-in fade-in zoom-in-95 duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          pdfStage === 'trim'
            ? 'max-w-5xl h-[85vh] rounded-[2.5rem] p-2 bg-slate-100/80'
            : 'max-h-[82vh] h-auto max-w-2xl rounded-[2.2rem] p-1.5 bg-slate-100/80'
        }`}
        onClick={e => e.stopPropagation()}
      >
        <div className={`flex flex-1 flex-col bg-white border border-slate-200/50 shadow-inner overflow-hidden ${
          pdfStage === 'trim' ? 'rounded-[2.2rem]' : 'rounded-[1.9rem]'
        }`}>

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg border border-white/20"
                style={{ backgroundColor: themeAccent, boxShadow: `0 6px 14px ${themeAccent}30` }}
              >
                <SkillIcon className="w-5 h-5 text-white animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-800 tracking-tight">Import đề Teens bằng AI</h3>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase bg-teal-500/10 text-teal-600 border border-teal-500/20">Active</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">Hỗ trợ tệp PDF, DOCX (Word), JSON</p>
              </div>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-all active:scale-95">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">

            {/* Template download banner */}
            {pdfStage !== 'trim' && !payload && (
              <div className="bg-sky-50/50 border border-sky-100 rounded-2xl p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-sky-900">Chưa có file mẫu?</p>
                  <p className="text-[10px] text-sky-700 mt-0.5">Tải template JSON với cấu trúc đúng để chỉnh sửa và import</p>
                </div>
                <button
                  onClick={downloadSample}
                  className="flex items-center gap-1.5 h-8 px-3.5 bg-white border border-sky-200 text-sky-700 rounded-lg text-[11px] font-bold hover:bg-sky-50 transition-colors flex-shrink-0 cursor-pointer shadow-sm active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" /> Tải mẫu
                </button>
              </div>
            )}

            {/* PDF page selector */}
            {pdfStage === 'trim' && pendingFile && (
              <PdfPageSelector
                file={pendingFile}
                accentColor={themeAccent}
                onConfirm={(result) => extractPdfText(result)}
                onCancel={resetState}
              />
            )}

            {/* Spinner: extract / ai */}
            {(pdfStage === 'extract' || pdfStage === 'ai') && (
              <div className="flex flex-col items-center py-12 space-y-4 rounded-3xl border border-slate-100 bg-slate-50/20 p-8 shadow-inner">
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-16 h-16 rounded-full border border-teal-100 animate-ping" />
                  <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center z-10 shadow-xl">
                    {pdfStage === 'extract'
                      ? <FileText className="w-6 h-6 text-teal-400 animate-pulse" />
                      : <Sparkles className="w-6 h-6 text-teal-400 animate-bounce" />}
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-700 tracking-tight">
                    {pdfStage === 'extract'
                      ? (sourceKind === 'docx' ? 'Đang đọc file Word...' : 'Đang đọc PDF...')
                      : 'Đang AI phân tích...'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">{pdfProgress.label}</p>
                </div>
                {pdfProgress.total > 0 && (
                  <div className="w-64 flex flex-col items-center gap-1.5">
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                      <div
                        className="h-full rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${(pdfProgress.done / pdfProgress.total) * 100}%`, backgroundColor: themeAccent }}
                      />
                    </div>
                    <span className="text-[11px] font-semibold" style={{ color: themeAccent }}>
                      {Math.round((pdfProgress.done / pdfProgress.total) * 100)}%
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Scanned: text preview + banner */}
            {pdfStage === 'scanned' && (
              <div className="space-y-4 animate-in fade-in duration-300">
                {isScanned ? (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100/70 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-500 text-white rounded-xl shadow-lg shadow-amber-500/20">
                        <AlertCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-amber-900 truncate max-w-sm">{fileName}</p>
                        <p className="text-[10px] text-amber-700 mt-0.5 leading-relaxed">PDF scan/ảnh — không trích được text. Cần AI OCR để chuyển JSON.</p>
                      </div>
                    </div>
                    <button onClick={resetState} className="text-xs text-amber-700 hover:text-amber-900 font-bold px-2 py-1 hover:bg-amber-100/50 rounded-lg">Đổi file</button>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100/70 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-emerald-900 truncate max-w-sm">{fileName}</p>
                        <p className="text-[10px] text-emerald-700 mt-0.5">
                          {sourceKind === 'docx' ? 'Đọc Word xong' : 'Đọc PDF xong'} — {scannedText.length.toLocaleString()} ký tự trích xuất
                        </p>
                      </div>
                    </div>
                    <button onClick={resetState} className="text-xs text-emerald-700 hover:text-emerald-900 font-bold px-2 py-1 hover:bg-emerald-100/50 rounded-lg">Đổi file</button>
                  </div>
                )}
                {!isScanned && scannedText && (
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-inner">
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-400" />
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Nội dung trích xuất</span>
                    </div>
                    <pre
                      className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed p-4 overflow-y-auto"
                      style={{ maxHeight: '200px', fontFamily: '"Times New Roman", Times, serif' }}
                    >
                      {scannedText}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Upload zone */}
            {pdfStage === 'idle' && !payload && (
              <div
                onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop}
                className={`flex flex-col items-center justify-center border-2 border-dashed rounded-[1.8rem] p-8 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] relative group ${
                  dragActive ? 'border-teal-500 bg-teal-50/20 shadow-lg shadow-teal-100/50' : 'border-slate-200 hover:border-slate-300 bg-slate-50/30'
                }`}
              >
                <div className={`p-4 rounded-xl bg-white shadow-md border border-slate-100 text-slate-400 group-hover:text-slate-600 transition-all duration-500 ease-out mb-4 ${
                  dragActive ? 'scale-110 rotate-3 text-teal-500 shadow-teal-100' : 'group-hover:-translate-y-1'
                }`}>
                  <Upload className="w-6 h-6" />
                </div>
                <p className="font-semibold text-slate-700 text-xs mb-0.5 tracking-tight">Kéo thả file đề của bạn vào đây</p>
                <p className="text-[10px] text-slate-400 mb-4">hoặc click để chọn file từ máy tính</p>
                <input
                  type="file"
                  accept=".pdf,.docx,.json,application/pdf,application/json,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  id="teens-file-picker"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
                />
                <label
                  htmlFor="teens-file-picker"
                  className="cursor-pointer px-5 py-2 rounded-lg font-bold text-white text-xs shadow-md active:scale-95 transition-all duration-300 hover:shadow-lg flex items-center gap-1.5"
                  style={{ backgroundColor: themeAccent, boxShadow: `0 4px 12px ${themeAccent}20` }}
                >
                  <Upload className="w-3.5 h-3.5" /> Chọn tệp tin
                </label>
              </div>
            )}

            {/* Payload ready */}
            {pdfStage === 'idle' && payload && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100/70 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-emerald-900 truncate max-w-sm">{fileName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-[10px] text-emerald-700 font-medium">Sẵn sàng import</p>
                        {parseMethod === 'ai' && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200">🤖 Gemini AI</span>}
                        {parseMethod === 'json' && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">JSON</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowJson(s => !s)}
                      className="flex items-center gap-1 h-7 px-2.5 bg-white border border-emerald-200 text-emerald-700 rounded-lg text-[10px] font-bold hover:bg-emerald-100/50 transition-colors"
                    >
                      <Code2 className="w-3 h-3" />{showJson ? 'Ẩn JSON' : 'Xem JSON'}
                    </button>
                    <button onClick={resetState} className="text-xs text-emerald-700 hover:text-emerald-900 font-bold px-2 py-1.5 rounded-lg hover:bg-emerald-100/50">Đổi file</button>
                  </div>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-2 gap-3">
                  {payload.skill === 'listening' ? (
                    <>
                      <SummaryCard icon={Headphones} color="sky" label="Nhóm câu hỏi" count={summary?.groups || 0} unit="nhóm (mỗi nhóm 1 audio)" />
                      <SummaryCard icon={CheckCircle2} color="emerald" label="Tổng câu hỏi" count={summary?.questions || 0} unit="câu (MCQ + điền từ)" />
                    </>
                  ) : (
                    <div className="col-span-2">
                      <SummaryCard icon={Mic} color="pink" label="Đề nói (Speaking)" count={summary?.parts || 0} unit="phần / part" />
                    </div>
                  )}
                </div>

                {/* JSON viewer */}
                {showJson && (
                  <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-950 text-slate-300 p-4 h-44 font-mono text-[10px] leading-relaxed shadow-inner">
                    <div className="flex items-center justify-between text-xs text-slate-400 font-semibold pb-2 border-b border-slate-800 mb-2">
                      <span>Cấu trúc đề chi tiết (JSON preview)</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
                          setJsonCopied(true);
                          setTimeout(() => setJsonCopied(false), 1800);
                        }}
                        className="flex items-center gap-1 h-6 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[9px] font-medium transition-colors"
                      >
                        {jsonCopied ? <><Check className="w-3 text-emerald-400" /> Đã copy</> : <><Copy className="w-3" /> Copy</>}
                      </button>
                    </div>
                    <pre className="overflow-x-auto selection:bg-teal-500/30 select-all scrollbar-thin scrollbar-thumb-slate-800">
                      {JSON.stringify(payload, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {parseError && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 flex items-start gap-3 animate-in shake duration-300">
                <div className="p-2 bg-rose-500 text-white rounded-lg shadow-lg shadow-rose-500/20">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                </div>
                <div>
                  <h5 className="font-bold text-rose-800 text-xs">Đã có lỗi xảy ra</h5>
                  <p className="text-[10px] text-rose-600 mt-1 leading-relaxed break-all">{parseError}</p>
                  <button
                    onClick={() => { setError(''); setPdfStage('idle'); setFileName(''); }}
                    className="text-xs font-bold text-rose-700 hover:text-rose-900 underline block mt-2"
                  >
                    Thử lại với tệp khác
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {pdfStage !== 'trim' && (
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
              <button onClick={onClose} className="px-4 py-2 rounded-xl font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer text-xs">
                Hủy bỏ
              </button>
              {pdfStage === 'scanned' && (
                <button
                  onClick={handleAiSmart}
                  disabled={aiParsing}
                  className="px-5 py-2.5 rounded-xl font-bold text-white shadow-lg flex items-center gap-1.5 transition-transform hover:scale-105 active:scale-95 duration-300 text-xs cursor-pointer bg-gradient-to-r from-violet-500 to-fuchsia-500 disabled:opacity-60"
                  style={{ boxShadow: '0 6px 16px rgba(139, 92, 246, 0.3)' }}
                >
                  {aiParsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
                  {aiParsing ? 'Đang phân tích...' : isScanned ? 'Phân tích bằng AI (OCR)' : 'Phân tích bằng AI'}
                </button>
              )}
              {pdfStage === 'idle' && (
                <button
                  onClick={handleImportSubmit}
                  disabled={!payload}
                  className="px-5 py-2.5 rounded-xl font-bold text-white transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-95 shadow-md flex items-center gap-1.5 text-xs cursor-pointer"
                  style={{ backgroundColor: themeAccent, boxShadow: payload ? `0 6px 16px ${themeAccent}30` : 'none' }}
                >
                  <CheckCircle2 className="w-4 h-4" /> Xác nhận Import đề
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon, color, label, count, unit,
}: {
  icon: any; color: 'sky' | 'emerald' | 'pink'; label: string; count: number; unit: string;
}) {
  const colorMap = {
    sky     : { bg: 'bg-sky-50',     text: 'text-sky-700',     border: 'border-sky-200' },
    emerald : { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    pink    : { bg: 'bg-pink-50',    text: 'text-pink-700',    border: 'border-pink-200' },
  }[color];
  return (
    <div className={`${colorMap.bg} ${colorMap.border} border rounded-xl p-3`}>
      <div className="flex items-center justify-between mb-1.5">
        <Icon className={`w-4 h-4 ${colorMap.text}`} />
      </div>
      <p className={`text-[11px] font-semibold ${colorMap.text}`}>{label}</p>
      <p className="text-2xl font-bold text-gray-900 leading-tight">{count}</p>
      <p className="text-[10px] text-gray-500">{unit}</p>
    </div>
  );
}
