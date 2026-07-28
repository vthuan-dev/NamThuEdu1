import { useRef, useState } from 'react';
import { X, Upload, Download, FileJson, FileText, CheckCircle2, Loader2, AlertCircle, Headphones, BookOpen, PenTool, Sparkles, Code2, Copy, Check, Bot } from 'lucide-react';
import {
  saveVstepListeningSection,
  saveVstepPart,
  saveVstepWritingTask,
  parseVstepTextWithAi,
} from '../../../../../services/vstepApi';
import { PdfPageSelector } from '../ielts/components/PdfPageSelector';
import { API_BASE_URL } from '../../../../../utils/apiConfig';

interface ImportPayload {
  listening?: {
    parts: Array<{
      partNumber: number;
      sections: Array<{
        sectionNumber: number;
        sectionName?: string;
        transcript?: string;
        audioUrl?: string;
        audioDuration?: number;
        questions: Array<{
          questionNumber: number;
          questionText: string;
          options: { A: string; B: string; C: string; D: string };
          correctAnswer: 'A' | 'B' | 'C' | 'D';
        }>;
      }>;
    }>;
  };
  reading?: {
    parts: Array<{
      partNumber: number;
      partName?: string;
      passage: string;
      wordCount?: number;
      questions: Array<{
        questionNumber: number;
        questionText: string;
        options: { A: string; B: string; C: string; D: string };
        correctAnswer: 'A' | 'B' | 'C' | 'D';
      }>;
    }>;
  };
  writing?: {
    tasks: Array<{
      taskNumber: number;
      taskName?: string;
      prompt: string;
      wordCount?: [number, number];
      timeLimit?: number;
    }>;
  };
}

interface Props {
  open: boolean;
  examId: string;
  onClose: () => void;
  onSuccess: () => void;
  limitToSkill?: 'listening' | 'reading' | 'writing';
  /** Called when examId is a temp ID — should create the exam in DB and return the real numeric ID */
  onEnsureExam?: () => Promise<string>;
}

const SAMPLE: ImportPayload = {
  listening: {
    parts: [
      {
        partNumber: 1,
        sections: [
          {
            sectionNumber: 1,
            sectionName: 'Announcement 1',
            transcript: 'Attention please, the train to Hanoi will depart at 9:30 AM from platform 3.',
            questions: [
              {
                questionNumber: 1,
                questionText: 'What time does the train depart?',
                options: { A: '9:00', B: '9:30', C: '10:00', D: '10:30' },
                correctAnswer: 'B',
              },
            ],
          },
        ],
      },
    ],
  },
  reading: {
    parts: [
      {
        partNumber: 1,
        passage: 'Once upon a time...',
        questions: [
          {
            questionNumber: 1,
            questionText: 'What is the main idea?',
            options: { A: 'A summary', B: 'A story', C: 'A poem', D: 'An essay' },
            correctAnswer: 'B',
          },
        ],
      },
    ],
  },
  writing: {
    tasks: [
      {
        taskNumber: 1,
        prompt: 'Write a letter to your friend about your last vacation. Use 80–120 words.',
        wordCount: [80, 120],
        timeLimit: 20,
      },
      {
        taskNumber: 2,
        prompt: 'Some people think that schools should teach more art subjects. Discuss. Use 200–250 words.',
        wordCount: [200, 250],
        timeLimit: 40,
      },
    ],
  },
};

type SkillStatus = 'idle' | 'running' | 'done' | 'error';

export function VstepImportModal({ open, examId, onClose, onSuccess, limitToSkill, onEnsureExam }: Props) {
  const [payload, setPayload]   = useState<ImportPayload | null>(null);
  const [fileName, setFileName] = useState('');
  const [parseError, setError]  = useState('');
  const [importing, setImporting] = useState(false);
  const [pdfStage, setPdfStage]   = useState<'idle' | 'trim' | 'extract' | 'scanned' | 'ai'>('idle');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const pdfFileRef = useRef<File | null>(null);
  const [aiParsing, setAiParsing] = useState(false);
  const [parseMethod, setParseMethod] = useState<'local' | 'ai' | 'json' | null>(null);
  const [pdfProgress, setPdfProgress] = useState({ label: '', done: 0, total: 0 });
  const [scannedText, setScannedText] = useState('');
  const [isScanned, setIsScanned] = useState(false);
  const [sourceKind, setSourceKind] = useState<'pdf' | 'docx' | 'json' | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);
  const [progress, setProgress]   = useState({ current: 0, total: 0, label: '' });
  const [status, setStatus] = useState<{ listening: SkillStatus; reading: SkillStatus; writing: SkillStatus }>({
    listening: 'idle', reading: 'idle', writing: 'idle',
  });
  const [dragActive, setDragActive] = useState(false);

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

  if (!open) return null;

  const handleFile = async (f: File) => {
    setError('');
    setPayload(null);
    setFileName(f.name);

    const isPdf  = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
    const isDocx = /\.docx$/i.test(f.name)
      || f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const isJson = f.type === 'application/json' || /\.json$/i.test(f.name);

    if (isPdf) {
      // PDF → hiện bước chọn/cắt trang trước khi trích xuất.
      setSourceKind('pdf');
      setPendingFile(f);
      setPdfStage('trim');
      return;
    }

    if (isDocx) {
      // Word → trích xuất text trực tiếp (không cần AI), rồi gửi text lên AI lấy JSON.
      setSourceKind('docx');
      await extractDocxText(f);
      return;
    }

    if (isJson) {
      try {
        const text   = await f.text();
        const parsed = JSON.parse(text) as ImportPayload;
        if (!parsed.listening && !parsed.reading && !parsed.writing) {
          throw new Error('JSON phải có ít nhất 1 trong 3 key: listening, reading, writing');
        }
        if (limitToSkill && !parsed[limitToSkill]) {
          const skillLabel = limitToSkill === 'reading' ? 'Reading' : limitToSkill === 'listening' ? 'Listening' : 'Writing';
          throw new Error(`File JSON không chứa dữ liệu phần thi ${skillLabel}`);
        }
        setSourceKind('json');
        setParseMethod('json');
        setPayload(parsed);
      } catch (e: any) {
        setError(e.message || 'JSON không hợp lệ');
      }
      return;
    }

    setError('Chỉ hỗ trợ file .pdf, .docx hoặc .json');
  };

  /** Trích xuất text từ file Word (.docx) dưới dạng HTML bằng mammoth → dùng cho AI text→JSON. */
  const extractDocxText = async (f: File) => {
    setError('');
    setPayload(null);
    setFileName(f.name);
    setPendingFile(null);
    pdfFileRef.current = null; // không có file PDF cho path vision
    try {
      setPdfStage('extract');
      setPdfProgress({ label: 'Đang đọc và chuyển đổi cấu trúc file Word...', done: 0, total: 0 });
      const mammoth = await import('mammoth');
      const buf = await f.arrayBuffer();
      // convertToHtml thay vì extractRawText để giữ lại thẻ <p>, <table>, <ul> giúp AI phân tách chính xác đoạn văn và câu hỏi
      const { value } = await mammoth.convertToHtml({ arrayBuffer: buf });
      const htmlText = (value || '').trim();
      if (htmlText.length < 30) {
        throw new Error('File Word không có nội dung văn bản để trích xuất.');
      }
      setScannedText(htmlText);
      setIsScanned(false); // Word luôn là text cấu trúc → dùng AI text→JSON
      setPdfStage('scanned');
    } catch (e: any) {
      setError(e.message || 'Lỗi đọc file Word');
      setPdfStage('idle');
    }
  };

  /** Trích xuất text từ PDF (đã cắt trang nếu cần) để dùng cho parser local. */
  const extractPdfText = async (f: File) => {
    setError('');
    setPayload(null);
    setFileName(f.name);
    setPendingFile(null);
    pdfFileRef.current = f; // giữ file (đã cắt) để gửi Gemini (path vision cho PDF scan)

    try {
      setPdfStage('extract');
      setPdfProgress({ label: 'Trang 0/0', done: 0, total: 0 });
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc =
        `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
      const buf = await f.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: buf }).promise;
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

      // Phát hiện PDF scan: text trích ra quá ít so với số trang ⇒ PDF là ảnh/scan,
      // pdf.js không lấy được chữ → buộc phải dùng AI vision (OCR) để đọc.
      const meaningful = fullText.replace(/=== Page \d+ ===/g, '').replace(/\s+/g, '').length;
      const scanned = meaningful < Math.max(120, pdf.numPages * 40);

      setScannedText(fullText);
      setIsScanned(scanned);
      setPdfStage('scanned');
    } catch (e: any) {
      setError(e.message || 'Lỗi đọc PDF');
      setPdfStage('idle');
    }
  };

  /**
   * Thanh tiến độ giả lập cho lời gọi AI (Gemini): không biết % thật nên cho
   * chạy tăng dần tới ~92% trong lúc chờ, rồi handler tự set 100% khi xong.
   * Trả về id của interval để clear ở finally.
   */
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

  /** Gọi Gemini (backend) parse PDF → JSON đề VSTEP. */
  const handleGeminiParse = async () => {
    const file = pdfFileRef.current;
    if (!file) { setError('Không tìm thấy file PDF để phân tích.'); return; }
    setError('');
    setAiParsing(true);
    setPdfStage('ai');
    const timer = startFakeProgress('Gemini đang đọc & phân tích PDF...');
    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE_URL}/teacher/vstep/parse-pdf`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || `Lỗi server: ${res.status}`);
      }
      const data = json.data as ImportPayload;
      if (!data.listening && !data.reading && !data.writing) {
        throw new Error('Gemini không nhận dạng được nội dung VSTEP trong PDF này.');
      }
      if (limitToSkill && !data[limitToSkill]) {
        const skillLabel = limitToSkill === 'reading' ? 'Reading' : limitToSkill === 'listening' ? 'Listening' : 'Writing';
        throw new Error(`File PDF không chứa dữ liệu phần thi ${skillLabel}`);
      }
      setPdfProgress(p => ({ ...p, label: 'Hoàn tất', done: 100 }));
      setParseMethod('ai');
      setPayload(data);
      setPdfStage('idle');
    } catch (e: any) {
      setError(e.message || 'Lỗi phân tích bằng AI');
      setPdfStage('scanned');
    } finally {
      clearInterval(timer);
      setAiParsing(false);
    }
  };

  /** Gửi TEXT đã trích xuất (PDF thuần / Word) lên AI → JSON đề VSTEP. */
  const handleTextAiParse = async () => {
    if (!scannedText.trim()) { setError('Không có nội dung text để phân tích.'); return; }
    setError('');
    setAiParsing(true);
    setPdfStage('ai');
    const timer = startFakeProgress('AI đang phân tích nội dung...');
    try {
      const json = await parseVstepTextWithAi(scannedText);
      if (!json.success) {
        throw new Error(json.message || 'AI phân tích thất bại.');
      }
      const data = json.data as ImportPayload;
      if (!data?.listening && !data?.reading && !data?.writing) {
        throw new Error('AI không nhận dạng được nội dung VSTEP trong file này.');
      }
      if (limitToSkill && !data[limitToSkill]) {
        const skillLabel = limitToSkill === 'reading' ? 'Reading' : limitToSkill === 'listening' ? 'Listening' : 'Writing';
        throw new Error(`Tài liệu không chứa dữ liệu phần thi ${skillLabel}`);
      }
      setPdfProgress(p => ({ ...p, label: 'Hoàn tất', done: 100 }));
      setParseMethod('ai');
      setPayload(data);
      setPdfStage('idle');
    } catch (e: any) {
      const apiMsg = e?.response?.data?.message;
      setError(apiMsg || e.message || 'Lỗi phân tích bằng AI');
      setPdfStage('scanned');
    } finally {
      clearInterval(timer);
      setAiParsing(false);
    }
  };

  /**
   * Dispatcher AI: PDF scan (không trích được text) → đọc PDF bằng AI vision;
   * còn lại (PDF thuần / Word) → gửi text đã trích lên AI để chuyển JSON.
   */
  const handleAiSmart = () => {
    if (isScanned && pdfFileRef.current) {
      return handleGeminiParse();
    }
    return handleTextAiParse();
  };

  const downloadSample = () => {
    const blob = new Blob([JSON.stringify(SAMPLE, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'vstep-import-template.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const runImport = async () => {
    if (!payload || !examId) return;
    setImporting(true);

    // If this is a temp ID (not yet persisted in DB), create the exam first
    let effectiveExamId = examId;
    if (examId.startsWith('vstep-') && onEnsureExam) {
      try {
        setProgress({ current: 0, total: 1, label: 'Đang tạo đề thi...' });
        effectiveExamId = await onEnsureExam();
      } catch (err: any) {
        setError('Không thể tạo đề thi. Vui lòng thử lại.');
        setImporting(false);
        return;
      }
    }

    const totalCalls =
      (!limitToSkill || limitToSkill === 'listening' ? (payload.listening?.parts.reduce((s, p) => s + p.sections.length, 0) || 0) : 0) +
      (!limitToSkill || limitToSkill === 'reading'   ? (payload.reading?.parts.length   || 0) : 0) +
      (!limitToSkill || limitToSkill === 'writing'   ? (payload.writing?.tasks.length   || 0) : 0);
    let done = 0;
    setProgress({ current: 0, total: totalCalls, label: 'Bắt đầu...' });

    try {
      // ─ Listening ─
      if ((!limitToSkill || limitToSkill === 'listening') && payload.listening?.parts.length) {
        setStatus(p => ({ ...p, listening: 'running' }));
        for (const part of payload.listening.parts) {
          for (const sec of part.sections) {
            setProgress({
              current: ++done, total: totalCalls,
              label: `Listening Part ${part.partNumber} • Section ${sec.sectionNumber}`,
            });
            await saveVstepListeningSection(effectiveExamId, part.partNumber, sec.sectionNumber, {
              sectionName: sec.sectionName,
              audioUrl:    sec.audioUrl   ?? '',
              audioDuration: sec.audioDuration ?? 0,
              transcript:  sec.transcript ?? '',
              questions:   sec.questions,
            });
          }
        }
        setStatus(p => ({ ...p, listening: 'done' }));
      }

      // ─ Reading ─
      if ((!limitToSkill || limitToSkill === 'reading') && payload.reading?.parts.length) {
        setStatus(p => ({ ...p, reading: 'running' }));
        for (const part of payload.reading.parts) {
          setProgress({
            current: ++done, total: totalCalls,
            label: `Reading Part ${part.partNumber}`,
          });
          await saveVstepPart(effectiveExamId, part.partNumber, {
            partNumber:   part.partNumber,
            partName:     part.partName ?? `Part ${part.partNumber}`,
            passage:      part.passage,
            wordCount:    part.wordCount ?? 0,
            completedQuestions: part.questions.length,
            totalQuestions:     part.questions.length,
            questions:    part.questions,
          });
        }
        setStatus(p => ({ ...p, reading: 'done' }));
      }

      // ─ Writing ─
      if ((!limitToSkill || limitToSkill === 'writing') && payload.writing?.tasks.length) {
        setStatus(p => ({ ...p, writing: 'running' }));
        for (const task of payload.writing.tasks) {
          setProgress({
            current: ++done, total: totalCalls,
            label: `Writing Task ${task.taskNumber}`,
          });
          await saveVstepWritingTask(effectiveExamId, task.taskNumber, {
            taskNumber: task.taskNumber,
            taskName:   task.taskName ?? `Task ${task.taskNumber}`,
            prompt:     task.prompt,
            wordCount:  task.wordCount ?? [80, 120],
            timeLimit:  task.timeLimit ?? 20,
          });
        }
        setStatus(p => ({ ...p, writing: 'done' }));
      }

      onSuccess();
      setTimeout(() => { onClose(); resetState(); }, 1500);
    } catch (err: any) {
      const apiMsg    = err?.response?.data?.message;
      const apiErrors = err?.response?.data?.errors;
      const detail    = apiErrors
        ? Object.entries(apiErrors).map(([k, v]) => `${k}: ${(v as any[]).join(', ')}`).join(' | ')
        : '';
      const url       = err?.config?.url ? ` [${err.config.url}]` : '';
      setError(`${apiMsg || err.message || 'Lỗi khi import'}${detail ? ` — ${detail}` : ''}${url}`);
      console.error('[VstepImport] failed:', err?.response?.data || err);
      setStatus(p => ({
        ...p,
        listening: p.listening === 'running' ? 'error' : p.listening,
        reading:   p.reading   === 'running' ? 'error' : p.reading,
        writing:   p.writing   === 'running' ? 'error' : p.writing,
      }));
    } finally {
      setImporting(false);
    }
  };

  const resetState = () => {
    setPayload(null); setFileName(''); setError(''); setImporting(false);
    setProgress({ current: 0, total: 0, label: '' });
    setStatus({ listening: 'idle', reading: 'idle', writing: 'idle' });
    setScannedText(''); setPdfStage('idle');
    setIsScanned(false); setSourceKind(null);
    setPendingFile(null); pdfFileRef.current = null;
    setAiParsing(false); setParseMethod(null);
  };

  const summary = payload && {
    listening: payload.listening?.parts.reduce(
      (s, p) => s + p.sections.reduce((ss, sec) => ss + (sec.questions?.length || 0), 0),
      0,
    ) || 0,
    reading:   payload.reading?.parts.length   || 0,
    writing:   payload.writing?.tasks.length   || 0,
  };

  const StatusIcon = ({ s }: { s: SkillStatus }) =>
      s === 'running' ? <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
    : s === 'done'    ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
    : s === 'error'   ? <AlertCircle className="w-4 h-4 text-red-500" />
    : <div className="w-4 h-4 rounded-full border-2 border-gray-300" />;

  const themeAccent = '#F97316';
  const themeBg = 'bg-orange-50/40';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-[8px] transition-all duration-300 bg-slate-900/50" onClick={() => !importing && onClose()}>
      {/* Outer Shell - Nested Doppelrand Bezel */}
      <div 
        className={`flex w-full border border-white/25 shadow-2xl backdrop-blur-md overflow-hidden animate-in fade-in zoom-in-95 duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] z-10 ${
          pdfStage === 'trim' 
            ? 'max-w-5xl h-[85vh] rounded-[2.5rem] p-2 bg-slate-100/80' 
            : 'max-h-[82vh] h-auto max-w-2xl rounded-[2.2rem] p-1.5 bg-slate-100/80'
        }`}
        onClick={e => e.stopPropagation()}
      >
        {/* Inner Core */}
        <div className={`flex flex-1 flex-col bg-white border border-slate-200/50 shadow-inner overflow-hidden ${
          pdfStage === 'trim' ? 'rounded-[2.2rem]' : 'rounded-[1.9rem]'
        }`}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center shadow-lg border border-white/20"
                style={{ boxShadow: `0 6px 14px rgba(249, 115, 22, 0.2)` }}
              >
                <FileJson className="w-5 h-5 text-white animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-800 tracking-tight">
                    Import đề VSTEP {limitToSkill ? (limitToSkill === 'reading' ? 'Reading' : limitToSkill === 'listening' ? 'Listening' : 'Writing') : ''} bằng AI
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase bg-orange-500/10 text-orange-600 border border-orange-500/20">
                    Active
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {limitToSkill
                    ? `Chỉ import phần thi ${limitToSkill === 'reading' ? 'Reading' : limitToSkill === 'listening' ? 'Listening' : 'Writing'}`
                    : 'Listening · Reading · Writing (không gồm Speaking)'}
                </p>
              </div>
            </div>
            <button 
              onClick={() => !importing && onClose()}
              disabled={importing}
              className="w-9 h-9 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-all duration-300 active:scale-95 disabled:opacity-30"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Sample download */}
            {pdfStage !== 'trim' && !payload && (
              <div className="bg-orange-50/50 border border-orange-100 rounded-2xl p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-orange-950">Chưa có file mẫu?</p>
                  <p className="text-[10px] text-orange-700 mt-0.5">
                    Tải template JSON với cấu trúc đúng để chỉnh sửa
                  </p>
                </div>
                <button
                  onClick={downloadSample}
                  className="flex items-center gap-1.5 h-8 px-3.5 bg-white border border-orange-200 text-orange-700 rounded-lg text-[11px] font-bold hover:bg-orange-50 transition-colors flex-shrink-0 cursor-pointer shadow-sm active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" /> Tải mẫu
                </button>
              </div>
            )}

            {/* PDF: chọn / cắt trang trước khi xử lý */}
            {pdfStage === 'trim' && pendingFile && (
              <PdfPageSelector
                file={pendingFile}
                accentColor="#F97316"
                onConfirm={(result) => extractPdfText(result)}
                onCancel={resetState}
              />
            )}

            {/* PDF processing state (extract / ai) */}
            {(pdfStage === 'extract' || pdfStage === 'ai') && (
              <div className="flex flex-col items-center py-12 space-y-4 rounded-3xl border border-slate-100 bg-slate-50/20 p-8 shadow-inner">
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-16 h-16 rounded-full border border-orange-100 animate-ping"></div>
                  <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center z-10 shadow-xl">
                    {pdfStage === 'extract'
                      ? <FileText className="w-6 h-6 text-orange-500 animate-pulse" />
                      : <Sparkles className="w-6 h-6 text-orange-500 animate-bounce" />}
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
                        className="h-full bg-gradient-to-r from-orange-500 to-rose-500 transition-all duration-500 ease-out"
                        style={{ width: `${(pdfProgress.done / pdfProgress.total) * 100}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-orange-600">
                      {Math.round((pdfProgress.done / pdfProgress.total) * 100)}%
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* PDF/Word scanned: text preview + AI trigger */}
            {pdfStage === 'scanned' && (
              <div className="space-y-4 animate-in fade-in duration-300">
                {isScanned ? (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100/70 flex items-start justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-500 text-white rounded-xl shadow-lg shadow-amber-500/20">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-amber-900 truncate max-w-md">{fileName}</p>
                        <p className="text-[10px] text-amber-700 mt-0.5 leading-relaxed">
                          PDF dạng scan/ảnh — không trích được text trực tiếp. Cần dùng AI đọc (OCR) để chuyển sang JSON.
                        </p>
                      </div>
                    </div>
                    <button onClick={resetState} className="text-xs text-amber-700 hover:text-amber-900 font-bold px-2 py-1 hover:bg-amber-100/50 rounded-lg">
                      Đổi file
                    </button>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100/70 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20">
                        <CheckCircle2 className="w-5 h-5 shrink-0" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-emerald-900 truncate max-w-md">{fileName}</p>
                        <p className="text-[10px] text-emerald-700 mt-0.5">
                          {sourceKind === 'docx' ? 'Đọc Word xong' : 'Đọc PDF xong'} — {scannedText.length.toLocaleString()} ký tự
                        </p>
                      </div>
                    </div>
                    <button onClick={resetState} className="text-xs text-emerald-700 hover:text-emerald-900 font-bold px-2 py-1 hover:bg-emerald-100/50 rounded-lg">
                      Đổi file
                    </button>
                  </div>
                )}
                {!isScanned && scannedText && (
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-inner">
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-400" />
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Nội dung trích xuất</span>
                    </div>
                    <pre className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed p-4 overflow-y-auto"
                      style={{ maxHeight: '220px', fontFamily: '"Times New Roman", Times, serif' }}>
                      {scannedText}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* File upload */}
            {pdfStage === 'idle' && !payload ? (
              <div 
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center border-2 border-dashed rounded-[1.8rem] p-8 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] relative group ${
                  dragActive 
                    ? 'border-orange-500 bg-orange-50/20 shadow-lg shadow-orange-100/50' 
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/30'
                }`}
              >
                {/* Micro-animations in dropzone */}
                <div 
                  className={`p-4 rounded-xl bg-white shadow-md border border-slate-100 text-slate-400 group-hover:text-slate-600 transition-all duration-500 ease-out mb-4 ${
                    dragActive ? 'scale-110 rotate-3 text-orange-500 shadow-orange-100' : 'group-hover:-translate-y-1'
                  }`}
                >
                  <Upload className="w-6 h-6" />
                </div>
                <p className="font-semibold text-slate-700 text-xs mb-0.5 tracking-tight">
                  Kéo thả file đề VSTEP vào đây
                </p>
                <p className="text-[10px] text-slate-400 mb-4">hoặc click để chọn file từ máy tính</p>
                
                <input
                  type="file" 
                  accept="application/json,.json,application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
                  className="hidden"
                  id="vstep-file-picker"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
                />
                
                <label
                  htmlFor="vstep-file-picker"
                  className="cursor-pointer px-5 py-2 rounded-lg font-bold text-white text-xs shadow-md active:scale-95 transition-all duration-300 hover:shadow-lg flex items-center gap-1.5"
                  style={{ 
                    backgroundColor: themeAccent, 
                    boxShadow: `0 4px 12px ${themeAccent}20`,
                  }}
                >
                  <Upload className="w-3.5 h-3.5" />
                  Chọn tệp tin
                </label>
              </div>
            ) : pdfStage === 'idle' && payload ? (
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
                        {parseMethod === 'ai' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200">🤖 Gemini AI</span>
                        )}
                        {parseMethod === 'local' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">⚡ Local</span>
                        )}
                        {parseMethod === 'json' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">JSON</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowJson(s => !s)}
                      className="flex items-center gap-1 h-7 px-2.5 bg-white border border-emerald-200 text-emerald-700 rounded-lg text-[10px] font-bold hover:bg-emerald-100/50 transition-colors"
                    >
                      <Code2 className="w-3 h-3" />
                      {showJson ? 'Ẩn JSON' : 'Xem JSON'}
                    </button>
                    {!importing && (
                      <button onClick={resetState} className="text-xs text-emerald-700 hover:text-emerald-900 font-bold px-2 py-1.5 rounded-lg hover:bg-emerald-100/50">
                        Đổi file
                      </button>
                    )}
                  </div>
                </div>

                {/* Skill summary */}
                <div className={`grid ${limitToSkill ? 'grid-cols-1 max-w-xs mx-auto w-full' : 'grid-cols-3'} gap-3`}>
                  {(!limitToSkill || limitToSkill === 'listening') && (
                    <SkillCard icon={Headphones} color="purple" label="Listening" count={summary?.listening || 0} unit="câu hỏi" status={status.listening} />
                  )}
                  {(!limitToSkill || limitToSkill === 'reading') && (
                    <SkillCard icon={BookOpen} color="blue" label="Reading" count={summary?.reading || 0} unit="parts" status={status.reading} />
                  )}
                  {(!limitToSkill || limitToSkill === 'writing') && (
                    <SkillCard icon={PenTool} color="emerald" label="Writing" count={summary?.writing || 0} unit="tasks" status={status.writing} />
                  )}
                </div>

                {/* JSON viewer */}
                {showJson && (
                  <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-950 text-slate-300 p-4 h-40 font-mono text-[10px] leading-relaxed shadow-inner">
                    <div className="flex items-center justify-between text-xs text-slate-400 font-semibold pb-2 border-b border-slate-900 mb-2">
                      <span>Cấu trúc đề chi tiết (JSON preview)</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
                          setJsonCopied(true);
                          setTimeout(() => setJsonCopied(false), 1800);
                        }}
                        className="flex items-center gap-1 h-6 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[9px] font-medium transition-colors"
                      >
                        {jsonCopied
                          ? <><Check className="w-3 text-emerald-400" /> Đã copy</>
                          : <><Copy className="w-3" /> Copy</>}
                      </button>
                    </div>
                    <pre className="overflow-x-auto selection:bg-teal-500/30 select-all scrollbar-thin scrollbar-thumb-slate-800">{JSON.stringify(payload, null, 2)}</pre>
                  </div>
                )}
              </div>
            ) : null}

            {/* Error */}
            {parseError && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 flex items-start gap-3 animate-in shake duration-300">
                <div className="p-2 bg-rose-500 text-white rounded-lg shadow-lg shadow-rose-500/20">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                </div>
                <div>
                  <h5 className="font-bold text-rose-800 text-xs">Đã có lỗi xảy ra</h5>
                  <p className="text-[10px] text-rose-600 mt-1 leading-relaxed break-all">{parseError}</p>
                </div>
              </div>
            )}

            {/* Progress */}
            {importing && progress.total > 0 && (
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 shadow-inner">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-slate-700">{progress.label}</p>
                  <p className="text-xs text-slate-400 font-semibold">{progress.current}/{progress.total}</p>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 to-rose-500 transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
            {pdfStage !== 'trim' && (
              <button
                onClick={() => !importing && onClose()}
                disabled={importing}
                className="px-4 py-2 rounded-xl font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer text-xs"
              >
                Hủy bỏ
              </button>
            )}
            {pdfStage === 'scanned' ? (
              <button
                onClick={handleAiSmart}
                disabled={aiParsing}
                className="px-5 py-2.5 rounded-xl font-bold text-white shadow-lg flex items-center gap-1.5 transition-transform hover:scale-105 active:scale-95 duration-300 text-xs cursor-pointer bg-gradient-to-r from-violet-500 to-fuchsia-500"
                style={{ boxShadow: `0 6px 16px rgba(139, 92, 246, 0.3)` }}
              >
                {aiParsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
                {aiParsing
                  ? 'Đang phân tích...'
                  : isScanned ? 'Phân tích bằng AI (OCR)' : 'Phân tích bằng AI'}
              </button>
            ) : pdfStage === 'trim' || pdfStage === 'extract' || pdfStage === 'ai' ? null : (
              <button
                onClick={runImport}
                disabled={!payload || importing}
                className="px-5 py-2.5 rounded-xl font-bold text-white transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-95 shadow-md flex items-center gap-1.5 text-xs cursor-pointer"
                style={{ 
                  backgroundColor: themeAccent,
                  boxShadow: payload ? `0 6px 16px ${themeAccent}30` : 'none'
                }}
              >
                {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {importing ? 'Đang import...' : 'Import vào đề'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SkillCard({
  icon: Icon, color, label, count, unit, status,
}: {
  icon: any; color: 'purple'|'blue'|'emerald'; label: string; count: number; unit: string; status: SkillStatus;
}) {
  const colorMap = {
    purple:  { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200' },
    blue:    { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  }[color];
  return (
    <div className={`${colorMap.bg} ${colorMap.border} border rounded-lg p-3`}>
      <div className="flex items-center justify-between mb-1.5">
        <Icon className={`w-4 h-4 ${colorMap.text}`} />
        {status === 'running' && <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />}
        {status === 'done'    && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
        {status === 'error'   && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
      </div>
      <p className={`text-[11px] font-semibold ${colorMap.text}`}>{label}</p>
      <p className="text-lg font-bold text-gray-900 leading-tight">{count}</p>
      <p className="text-[10px] text-gray-500">{unit}</p>
    </div>
  );
}
