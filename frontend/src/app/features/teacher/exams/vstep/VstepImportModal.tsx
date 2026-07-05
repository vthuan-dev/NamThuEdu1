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

export function VstepImportModal({ open, examId, onClose, onSuccess, limitToSkill }: Props) {
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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => !importing && onClose()}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className={`relative bg-white rounded-2xl shadow-2xl w-full ${pdfStage === 'trim' ? 'max-w-5xl' : 'max-w-4xl'} max-h-[92vh] overflow-hidden flex flex-col z-10`}
        style={{ animation: 'vstepImportIn .2s cubic-bezier(0.34,1.56,0.64,1)' }}
        onClick={e => e.stopPropagation()}
      >
        <style>{`@keyframes vstepImportIn{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}`}</style>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-rose-500 rounded-xl flex items-center justify-center">
              <FileJson className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Import đề thi VSTEP {limitToSkill ? (limitToSkill === 'reading' ? 'Reading' : limitToSkill === 'listening' ? 'Listening' : 'Writing') : ''}</h2>
              <p className="text-xs text-gray-500">
                {limitToSkill
                  ? `Chỉ import phần thi ${limitToSkill === 'reading' ? 'Reading' : limitToSkill === 'listening' ? 'Listening' : 'Writing'}`
                  : 'Listening · Reading · Writing (không gồm Speaking)'}
              </p>
            </div>
          </div>
          <button
            onClick={() => !importing && onClose()}
            disabled={importing}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-30"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Sample download */}
          {pdfStage !== 'trim' && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-blue-900">Chưa có file mẫu?</p>
              <p className="text-xs text-blue-700 mt-0.5">
                Tải template JSON với cấu trúc đúng để chỉnh sửa
              </p>
            </div>
            <button
              onClick={downloadSample}
              className="flex items-center gap-2 h-9 px-4 bg-white border border-blue-200 text-blue-700 rounded-lg text-sm font-semibold hover:bg-blue-100 transition-colors flex-shrink-0"
            >
              <Download className="w-4 h-4" /> Tải mẫu
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
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 flex flex-col items-center gap-3">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center">
                {pdfStage === 'extract'
                  ? <FileText className="w-6 h-6 text-orange-500" />
                  : <Sparkles className="w-6 h-6 text-orange-500" />}
              </div>
              <div className="text-center">
                <p className="font-bold text-orange-900">
                  {pdfStage === 'extract'
                    ? (sourceKind === 'docx' ? 'Đang đọc file Word...' : 'Đang đọc PDF...')
                    : 'Đang AI phân tích...'}
                </p>
                <p className="text-xs text-orange-700 mt-1">{pdfProgress.label}</p>
              </div>
              {pdfProgress.total > 0 && (
                <div className="w-64 flex flex-col items-center gap-1.5">
                  <div className="w-full h-2 bg-white rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-orange-500 to-rose-500 transition-all duration-500 ease-out"
                      style={{ width: `${(pdfProgress.done / pdfProgress.total) * 100}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-orange-700">
                    {Math.round((pdfProgress.done / pdfProgress.total) * 100)}%
                  </span>
                </div>
              )}
            </div>
          )}

          {/* PDF/Word scanned: text preview + AI trigger */}
          {pdfStage === 'scanned' && (
            <div className="space-y-3">
              {isScanned ? (
                <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-amber-900 truncate">{fileName}</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      PDF dạng scan/ảnh — không trích được text trực tiếp. Cần dùng AI đọc (OCR) để chuyển sang JSON.
                    </p>
                  </div>
                  <button onClick={resetState} className="p-1.5 rounded-lg hover:bg-white text-amber-700">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-emerald-900 truncate">{fileName}</p>
                    <p className="text-xs text-emerald-700">
                      {sourceKind === 'docx' ? 'Đọc Word xong' : 'Đọc PDF xong'} — {scannedText.length.toLocaleString()} ký tự
                    </p>
                  </div>
                  <button onClick={resetState} className="p-1.5 rounded-lg hover:bg-white text-emerald-700">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              {!isScanned && scannedText && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nội dung trích xuất</span>
                  </div>
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed p-5 overflow-y-auto"
                    style={{ maxHeight: '460px', fontFamily: '"Times New Roman", Times, serif' }}>
                    {scannedText}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* File upload */}
          {pdfStage === 'idle' && !payload ? (
            <label className="block border-2 border-dashed border-gray-300 hover:border-orange-400 hover:bg-orange-50/50 rounded-xl p-8 cursor-pointer transition-all">
              <input
                type="file" accept="application/json,.json,application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
              />
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center">
                  <Upload className="w-7 h-7 text-orange-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Click hoặc kéo thả file</p>
                  <p className="text-xs text-gray-500 mt-1">Hỗ trợ: <span className="font-bold text-orange-600">.pdf</span> · <span className="font-bold text-sky-600">.docx</span> (AI chuyển sang JSON) hoặc <span className="font-bold text-blue-600">.json</span></p>
                </div>
              </div>
            </label>
          ) : pdfStage === 'idle' && payload ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-emerald-900 truncate">{fileName}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="text-xs text-emerald-700">Sẵn sàng import</p>
                    {parseMethod === 'ai' && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200">🤖 Gemini AI</span>
                    )}
                    {parseMethod === 'local' && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">⚡ Local</span>
                    )}
                    {parseMethod === 'json' && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">JSON</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setShowJson(s => !s)}
                  className="flex items-center gap-1.5 h-8 px-3 bg-white border border-emerald-200 text-emerald-700 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition-colors"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  {showJson ? 'Ẩn JSON' : 'Xem JSON'}
                </button>
                {!importing && (
                  <button onClick={resetState} className="p-1.5 rounded-lg hover:bg-white text-emerald-700">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              {/* Skill summary */}
              <div className={`grid ${limitToSkill ? 'grid-cols-1 max-w-xs mx-auto w-full' : 'grid-cols-3'} gap-2`}>
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
                <div className="mt-3 bg-gray-900 rounded-xl overflow-hidden" style={{ animation: 'jsonIn .2s ease' }}>
                  <style>{`@keyframes jsonIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`}</style>
                  <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                    <div className="flex items-center gap-2">
                      <FileJson className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">JSON payload</span>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
                        setJsonCopied(true);
                        setTimeout(() => setJsonCopied(false), 1800);
                      }}
                      className="flex items-center gap-1.5 h-7 px-2.5 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-md text-xs font-medium transition-colors"
                    >
                      {jsonCopied
                        ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Đã copy</>
                        : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                    </button>
                  </div>
                  <pre className="text-xs text-emerald-300 p-4 overflow-auto leading-relaxed"
                    style={{ maxHeight: '420px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }}>
                    {JSON.stringify(payload, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : null}

          {/* Error */}
          {parseError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-900">Lỗi</p>
                <p className="text-xs text-red-700 mt-0.5 break-all">{parseError}</p>
              </div>
            </div>
          )}

          {/* Progress */}
          {importing && progress.total > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-700">{progress.label}</p>
                <p className="text-xs text-gray-500">{progress.current}/{progress.total}</p>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-rose-500 transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          {pdfStage !== 'trim' && (
          <button
            onClick={() => !importing && onClose()}
            disabled={importing}
            className="h-10 px-4 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30"
          >
            Hủy
          </button>
          )}
          {pdfStage === 'scanned' ? (
            <button
              onClick={handleAiSmart}
              disabled={aiParsing}
              className="h-10 px-6 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white rounded-lg text-sm font-semibold hover:from-violet-600 hover:to-fuchsia-600 transition-all flex items-center gap-2 shadow-md disabled:opacity-50"
              title={isScanned
                ? 'PDF scan — AI Gemini đọc ảnh (OCR) rồi chuyển sang JSON'
                : 'Gửi nội dung đã trích xuất lên AI để chuyển sang JSON chuẩn'}
            >
              {aiParsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
              {aiParsing
                ? 'Đang phân tích...'
                : isScanned ? 'Phân tích bằng AI (OCR)' : 'Phân tích bằng AI'}
            </button>
          ) : pdfStage === 'trim' || pdfStage === 'extract' || pdfStage === 'ai' ? null : (
            <button
              onClick={runImport}
              disabled={!payload || importing}
              className="h-10 px-6 bg-gradient-to-r from-orange-500 to-rose-500 text-white rounded-lg text-sm font-semibold hover:from-orange-600 hover:to-rose-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {importing ? 'Đang import...' : 'Import vào đề'}
            </button>
          )}
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
