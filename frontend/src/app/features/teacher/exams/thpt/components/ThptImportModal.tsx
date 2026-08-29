import { useRef, useState } from 'react';
import {
  X, Upload, Download, FileText, CheckCircle2, Loader2, AlertCircle,
  BookOpen, Sparkles, Code2, Copy, Check, Bot,
} from 'lucide-react';
import { API_BASE_URL } from '../../../../../../utils/apiConfig';
import { getAuthToken } from '../../../../../../utils/authStorage';
import { PdfPageSelector } from '../../ielts/components/PdfPageSelector';
import { parseTeensTextLocally } from '../../teens/components/teensParser';
import type { ThptSection } from '../../../../../../types/thpt';

interface Props {
  open: boolean;
  onClose: () => void;
  /**
   * Trả `false` để giữ modal mở (vd: dữ liệu import không khớp cấu trúc đề hiện tại
   * và cần giáo viên xác nhận). Bất kỳ giá trị khác đều đóng modal.
   *
   * Trước đây khai báo là `void` trong khi CreateThptExam truyền vào một hàm trả
   * `boolean` — TS coi `shouldClose !== false` là so sánh vô nghĩa, nên modal luôn
   * đóng kể cả khi handler yêu cầu giữ mở.
   */
  onImport: (data: any) => boolean | void;
}

const SAMPLE_THPT = {
  sections: [
    {
      type: 'mc_questions',
      title: 'Trắc nghiệm ngữ pháp',
      instructions: 'Chọn phương án đúng (A, B, C hoặc D).',
      variant: 'grammar',
      items: [
        {
          question_number: 1,
          prompt: 'She is ______ student in her class.',
          options: [
            { id: 'A', text: 'the best' },
            { id: 'B', text: 'better' },
            { id: 'C', text: 'good' },
            { id: 'D', text: 'well' }
          ],
          correct_id: 'A',
          explanation: 'Superlative comparison.'
        }
      ]
    }
  ]
};

export function ThptImportModal({ open, onClose, onImport }: Props) {
  const [payload, setPayload]     = useState<any>(null);
  const [fileName, setFileName]   = useState('');
  const [fileSize, setFileSize]   = useState('');
  const [parseError, setError]    = useState('');
  const [pdfStage, setPdfStage]   = useState<'idle' | 'trim' | 'extract' | 'scanned' | 'ai'>('idle');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const pdfFileRef  = useRef<File | null>(null);
  const [aiParsing, setAiParsing] = useState(false);
  const [parseMethod, setParseMethod] = useState<'local' | 'ai' | 'json' | null>(null);
  const [pdfProgress, setPdfProgress] = useState({ label: '', done: 0, total: 100 });
  const [scannedText, setScannedText] = useState('');
  const [isScanned, setIsScanned] = useState(false);
  const [sourceKind, setSourceKind] = useState<'pdf' | 'docx' | 'json' | null>(null);
  const [showJson, setShowJson]   = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showFullTextModal, setShowFullTextModal] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  if (!open) return null;

  const handleFile = async (f: File) => {
    setError(''); setPayload(null); setFileName(f.name);
    const sizeMB = (f.size / (1024 * 1024)).toFixed(2);
    setFileSize(`${sizeMB} MB`);

    const isPdf  = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
    const isDocx = /\.docx$/i.test(f.name)
      || f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const isJson = f.type === 'application/json' || /\.json$/i.test(f.name);

    if (isPdf) {
      setSourceKind('pdf'); setPendingFile(f); setPdfStage('trim'); return;
    }
    if (isDocx) {
      setSourceKind('docx'); await extractDocxText(f); return;
    }
    if (isJson) {
      setSourceKind('json');
      try {
        const text = await f.text();
        const data = JSON.parse(text);
        if (!Array.isArray(data.sections)) throw new Error('File JSON phải chứa cấu trúc {"sections": []}');
        setParseMethod('json'); setPayload(data); setPdfStage('idle');
      } catch (err: any) {
        setError(err.message || 'Lỗi đọc file JSON');
      }
      return;
    }
    setError('Chỉ hỗ trợ file .pdf, .docx, .json');
  };

  const extractDocxText = async (file: File) => {
    setError(''); setAiParsing(true); setPdfStage('extract');
    setPdfProgress({ label: 'Đang đọc nội dung file Word...', done: 20, total: 100 });
    try {
      const mammoth = await import('mammoth');
      const arrayBuffer = await file.arrayBuffer();
      setPdfProgress({ label: 'Đang chuyển đổi văn bản...', done: 50, total: 100 });
      const result = await mammoth.extractRawText({ arrayBuffer });
      const text   = result.value || '';
      if (!text.trim()) throw new Error('Không trích xuất được văn bản nào từ file Word.');
      setScannedText(text);
      setIsScanned(false);
      setPdfProgress({ label: 'Trích xuất văn bản thành công', done: 100, total: 100 });
      setPdfStage('scanned');
    } catch (e: any) {
      setError(e.message || 'Lỗi đọc file Word'); setPdfStage('idle');
    } finally { setAiParsing(false); }
  };

  /**
   * Trích xuất text từ PDF.
   *
   * Nhận thẳng `File` vì `PdfPageSelector` ĐÃ cắt đúng khoảng trang giáo viên chọn
   * rồi mới gọi `onConfirm`. Hợp đồng cũ ở đây là `{ start, end }` — lệch với
   * component, nên TS báo lỗi và nếu chạy được thì `options.start/end` là
   * `undefined`, khiến `Math.min(pdf.numPages, undefined)` ra `NaN` và vòng lặp
   * không trích xuất trang nào.
   */
  const extractPdfText = async (selectedFile: File) => {
    const file = selectedFile ?? pendingFile;
    if (!file) return;
    setError(''); setAiParsing(true); setPdfStage('extract');
    setPdfProgress({ label: 'Đang khởi tạo thư viện PDF...', done: 10, total: 100 });

    try {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

      let extracted = '';
      const start = 1;
      const end   = pdf.numPages;
      const totalPages = Math.max(1, end - start + 1);

      for (let i = start; i <= end; i++) {
        setPdfProgress({
          label: `Đang trích xuất trang ${i}/${end}...`,
          done: Math.round(15 + ((i - start) / totalPages) * 75),
          total: 100,
        });
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str || '').join(' ');
        extracted += pageText + '\n\n';
      }

      const cleanText = extracted.trim();
      if (!cleanText) {
        setIsScanned(true); setScannedText('');
      } else {
        setIsScanned(false); setScannedText(cleanText);
      }
      pdfFileRef.current = file;
      setPdfStage('scanned');
    } catch (e: any) {
      setError(e.message || 'Lỗi trích xuất PDF'); setPdfStage('idle');
    } finally { setAiParsing(false); }
  };

  const resetState = () => {
    setPayload(null); setFileName(''); setFileSize(''); setError('');
    setPdfStage('idle'); setPendingFile(null); pdfFileRef.current = null;
    setScannedText(''); setIsScanned(false); setSourceKind(null);
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
      const res  = await fetch(`${API_BASE_URL}/teacher/thpt/parse-pdf`, {
        method: 'POST', signal: controller.signal,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const contentType = res.headers.get('content-type') || '';
      if (!res.ok) {
        let errMsg = 'AI phân tích PDF thất bại.';
        if (contentType.includes('application/json')) {
          const json = await res.json();
          errMsg = json.message || errMsg;
        } else if (res.status === 504) {
          errMsg = 'Máy chủ phản hồi quá lâu (Gateway Time-out 504). Vui lòng thử lại hoặc cắt bớt trang PDF để giảm thời gian xử lý.';
        } else {
          errMsg = `Lỗi hệ thống (${res.status}).`;
        }
        throw new Error(errMsg);
      }

      if (!contentType.includes('application/json')) {
        throw new Error('Phản hồi từ máy chủ không hợp lệ (không phải JSON).');
      }

      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'AI phân tích PDF thất bại.');
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
      const res   = await fetch(`${API_BASE_URL}/teacher/thpt/parse-text`, {
        method: 'POST', signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          text: scannedText
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!res.ok) {
        let errMsg = 'AI phân tích thất bại.';
        if (contentType.includes('application/json')) {
          const json = await res.json();
          errMsg = json.message || errMsg;
        } else if (res.status === 504) {
          errMsg = 'Máy chủ phản hồi quá lâu (Gateway Time-out 504). Vui lòng thử lại hoặc chia nhỏ đề thi làm nhiều phần để import.';
        } else {
          errMsg = `Lỗi hệ thống (${res.status}).`;
        }
        throw new Error(errMsg);
      }

      if (!contentType.includes('application/json')) {
        throw new Error('Phản hồi từ máy chủ không hợp lệ (không phải JSON).');
      }

      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'AI phân tích thất bại.');
      setPdfProgress(p => ({ ...p, label: 'Hoàn tất', done: 100 }));
      setParseMethod('ai'); setPayload(json.data); setPdfStage('idle');
    } catch (e: any) {
      setError(e?.name === 'AbortError'
        ? 'AI xử lý quá lâu (>110 giây). File có thể quá dài — hãy cắt bớt nội dung hoặc thử lại.'
        : e.message || 'Lỗi phân tích văn bản');
      setPdfStage('scanned');
    } finally { clearTimeout(timeoutId); clearInterval(timer); setAiParsing(false); }
  };

  const handleLocalParse = async () => {
    if (!scannedText.trim()) { setError('Không có nội dung văn bản để phân tích.'); return; }
    setError('');
    setAiParsing(true);
    setPdfStage('ai');

    const timer = startFakeProgress('AI đang phân tích và tối ưu câu hỏi...');
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 110_000);

    try {
      // 1. Parse locally using Teens parser format
      const localTeens = parseTeensTextLocally(scannedText, 'listening');

      // 2. Try to refine via Gemini API
      try {
        const token = getAuthToken();
        const res = await fetch(`${API_BASE_URL}/teacher/thpt/parse-text`, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            text: scannedText
          }),
        });

        clearTimeout(timeoutId);
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const json = await res.json();
          if (json.success && json.data) {
            clearInterval(timer);
            setParseMethod('ai');
            setPayload(json.data);
            setPdfStage('idle');
            return;
          }
        }
      } catch (aiErr) {
        console.warn('AI refinement failed, falling back to local parse:', aiErr);
      }

      // 3. Fallback: Convert Teens-style local parsed data into a single Thpt mc_questions section
      const mcSection: ThptSection = {
        id: `s_local_${Date.now()}`,
        type: 'mc_questions',
        title: 'Trắc nghiệm (Local Fallback)',
        instructions: 'Chọn phương án đúng (A, B, C hoặc D).',
        variant: 'grammar',
        items: (localTeens.groups?.[0]?.questions || []).map((q: any, idx: number) => {
          const correctIdx = q.options?.findIndex((o: any) => o.isCorrect) ?? -1;
          const correctId = correctIdx !== -1 ? (['A', 'B', 'C', 'D', 'E', 'F'][correctIdx] || '') : '';
          return {
            question_number: idx + 1,
            prompt: q.qContent || `Câu ${idx + 1}`,
            options: (q.options || []).map((o: any, oi: number) => ({
              id: ['A', 'B', 'C', 'D', 'E', 'F'][oi] || String(oi),
              text: o.content || ''
            })),
            correct_id: correctId,
            explanation: q.qExplanation || ''
          };
        })
      };

      setParseMethod('local');
      setPayload({ sections: [mcSection] });
      setPdfStage('idle');
    } catch (e: any) {
      setError(e.message || 'Lỗi phân tích cú pháp local.');
      setPdfStage('scanned');
    } finally {
      clearTimeout(timeoutId);
      clearInterval(timer);
      setAiParsing(false);
    }
  };

  const handleAiSmart = () => {
    if (sourceKind === 'docx') {
      return handleTextAiParse();
    }
    return isScanned && pdfFileRef.current ? handleGeminiParsePdf() : handleTextAiParse();
  };

  const downloadSample = () => {
    const blob    = new Blob([JSON.stringify(SAMPLE_THPT, null, 2)], { type: 'application/json' });
    const url     = URL.createObjectURL(blob);
    const a       = document.createElement('a');
    a.href = url; a.download = `thpt-exam-template.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleImportSubmit = () => {
    if (!payload) return;
    const shouldClose = onImport(payload);
    if (shouldClose !== false) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[8px] transition-all duration-300"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`flex w-full border border-white/25 shadow-2xl backdrop-blur-md overflow-hidden animate-in fade-in zoom-in-95 duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          pdfStage === 'trim'
            ? 'max-w-5xl h-[85vh] rounded-[2.5rem] p-2 bg-slate-100/80'
            : pdfStage === 'scanned'
              ? 'max-h-[90vh] h-auto max-w-5xl rounded-[2.2rem] p-1.5 bg-slate-100/80'
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
                style={{ backgroundColor: '#0D9488', boxShadow: `0 6px 14px rgba(13,148,136,0.2)` }}
              >
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-800 tracking-tight">Import đề THPT bằng AI</h3>
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
                accentColor="#0D9488"
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
                        style={{ width: `${(pdfProgress.done / pdfProgress.total) * 100}%`, backgroundColor: '#0D9488' }}
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-teal-600">
                      {Math.round((pdfProgress.done / pdfProgress.total) * 100)}%
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Scanned: text preview info */}
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
                  <div className="space-y-2">
                    <div 
                      onClick={() => setShowFullTextModal(true)}
                      className="relative rounded-2xl border border-slate-200 bg-slate-50/50 p-4 h-[120px] overflow-hidden cursor-pointer hover:border-teal-500 hover:bg-slate-50 transition-all duration-300 group shadow-inner"
                      title="Click để phóng to xem đầy đủ văn bản"
                    >
                      <pre className="text-[11px] text-slate-500 whitespace-pre-wrap font-mono leading-relaxed select-none">
                        {scannedText.slice(0, 800)}{scannedText.length > 800 ? '...' : ''}
                      </pre>
                      {/* Gradient overlay to indicate fade */}
                      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-100 to-transparent pointer-events-none flex items-end justify-center pb-2">
                        <span className="text-[10px] text-teal-600 font-bold bg-white px-2.5 py-1 rounded-full shadow-sm border border-teal-100/70 group-hover:scale-105 transition-transform">
                          🔍 Click để xem toàn bộ ({scannedText.length.toLocaleString()} ký tự)
                        </span>
                      </div>
                    </div>
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
                  id="thpt-file-picker"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
                />
                <label
                  htmlFor="thpt-file-picker"
                  className="px-5 h-10 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition-colors flex items-center justify-center shadow-md active:scale-95 cursor-pointer"
                >
                  Chọn file đề thi
                </label>
              </div>
            )}

            {/* Error display */}
            {parseError && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 flex items-start gap-3 text-rose-800 shadow-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div className="flex-1 text-[11px] font-medium leading-relaxed">{parseError}</div>
              </div>
            )}

            {/* Success display */}
            {payload && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="p-4 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-teal-500 text-white rounded-xl shadow-lg shadow-teal-500/20">
                      <CheckCircle2 className="w-5 h-5 animate-bounce" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-teal-900">Phân tích thành công!</p>
                      <p className="text-[10px] text-teal-700 mt-0.5">
                        Nhận dạng được {payload.sections?.length || 0} phần thi (
                        {parseMethod === 'ai' ? 'Bằng AI' : parseMethod === 'local' ? 'Bằng Local' : 'Từ File JSON'}
                        )
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowJson(!showJson)}
                      className="px-3 py-1.5 border border-teal-200 text-teal-700 hover:bg-teal-100/50 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                    >
                      <Code2 className="w-3.5 h-3.5 inline mr-1" /> {showJson ? 'Ẩn JSON' : 'Xem JSON'}
                    </button>
                    <button onClick={resetState} className="text-xs text-teal-700 hover:text-teal-900 font-bold px-2 py-1 hover:bg-teal-100/50 rounded-lg">Đổi file</button>
                  </div>
                </div>

                {showJson && (
                  <div className="relative rounded-2xl border border-slate-100 bg-slate-950 p-4 max-h-[300px] overflow-y-auto">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
                        setJsonCopied(true); setTimeout(() => setJsonCopied(false), 2000);
                      }}
                      className="absolute top-3 right-3 p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors cursor-pointer"
                      title="Copy JSON"
                    >
                      {jsonCopied ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <pre className="text-[11px] text-slate-300 font-mono leading-relaxed">
                      {JSON.stringify(payload, null, 2)}
                    </pre>
                  </div>
                )}
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
                  {aiParsing
                    ? 'Đang phân tích...'
                    : sourceKind === 'docx'
                      ? 'Trích xuất tự động'
                      : isScanned
                        ? 'Phân tích bằng AI (OCR)'
                        : 'Phân tích bằng AI'}
                </button>
              )}
              {payload && (
                <button
                  onClick={handleImportSubmit}
                  className="px-5 py-2.5 rounded-xl font-bold text-white transition-all text-xs cursor-pointer bg-teal-600 hover:bg-teal-700"
                >
                  Import vào đề thi
                </button>
              )}
            </div>
          )}

        </div>
      </div>
      {/* Full text overlay modal */}
      {showFullTextModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-6 backdrop-blur-[6px] transition-all duration-300">
          <div className="bg-white rounded-3xl max-w-4xl w-full h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Toàn bộ văn bản trích xuất từ file</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">{fileName} — {scannedText.length.toLocaleString()} ký tự</p>
              </div>
              <button 
                onClick={() => setShowFullTextModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Scrollable text body */}
            <div className="flex-1 min-h-0 p-6 overflow-y-auto">
              <pre className="text-xs text-slate-600 font-mono whitespace-pre-wrap leading-relaxed select-text p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
                {scannedText}
              </pre>
            </div>
            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                onClick={() => setShowFullTextModal(false)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
