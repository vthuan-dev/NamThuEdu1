import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowLeft, Upload, FileText, Sparkles, CheckCircle2,
  AlertCircle, X, ChevronDown, ChevronUp, BookOpen, RotateCcw,
} from 'lucide-react';
import { parsePdfQA, type ParsedQuestion } from '@/services/groqApi';
import { teacherApi } from '@/services/teacherApi';

// ── Types ─────────────────────────────────────────────────────────────────────
type Step = 'upload' | 'scanned' | 'processing' | 'preview' | 'success';
type ProcessStage = 'extract' | 'parse';

interface QItem extends ParsedQuestion {
  _id: string;
  enabled: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────────────
const EXAM_TYPES = ['GENERAL', 'VSTEP', 'IELTS', 'Cambridge'];
const SKILLS = [
  { value: 'reading', label: 'Reading' },
  { value: 'listening', label: 'Listening' },
  { value: 'writing', label: 'Writing' },
  { value: 'speaking', label: 'Speaking' },
  { value: 'mixed', label: 'Mixed (4 kỹ năng)' },
];
const OPT_BASE: Record<string, string> = {
  A: 'bg-blue-50 text-blue-700 border-blue-200',
  B: 'bg-violet-50 text-violet-700 border-violet-200',
  C: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  D: 'bg-orange-50 text-orange-700 border-orange-200',
};
const OPT_CORRECT: Record<string, string> = {
  A: 'bg-blue-500 text-white border-blue-500',
  B: 'bg-violet-500 text-white border-violet-500',
  C: 'bg-emerald-500 text-white border-emerald-500',
  D: 'bg-orange-500 text-white border-orange-500',
};
const STEPS_META = [
  { key: 'upload',     label: 'Upload & Cấu hình' },
  { key: 'scanned',   label: 'Scan PDF' },
  { key: 'processing', label: 'AI Phân tích' },
  { key: 'preview',   label: 'Xem trước' },
  { key: 'success',   label: 'Hoàn thành' },
] as const;
const STEP_ORDER: Step[] = ['upload', 'scanned', 'processing', 'preview', 'success'];

// ── Component ──────────────────────────────────────────────────────────────────
export const ImportExam: React.FC = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [title, setTitle]         = useState('');
  const [examType, setExamType]   = useState('GENERAL');
  const [skill, setSkill]         = useState('reading');
  const [duration, setDuration]   = useState(60);

  const [processStage, setProcessStage] = useState<ProcessStage>('extract');
  const [scanCurrent, setScanCurrent]   = useState(0);
  const [scanTotal, setScanTotal]       = useState(0);
  const [parseChunk, setParseChunk]     = useState({ current: 0, total: 0 });
  const [scannedText, setScannedText]   = useState('');

  const [questions, setQuestions]   = useState<QItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [error, setError]             = useState('');
  const [importing, setImporting]     = useState(false);
  const [createdExamId, setCreatedExamId] = useState<string | null>(null);

  // ── File handling ──────────────────────────────────────────────────────────
  const handleFile = useCallback((f: File) => {
    if (f.type !== 'application/pdf') { setError('Chỉ chấp nhận file PDF'); return; }
    setFile(f);
    setError('');
    if (!title) setTitle(f.name.replace(/\.pdf$/i, ''));
  }, [title]);

  // ── STEP 1: Scan PDF only (no AI) ──────────────────────────────────────────
  const handleScan = async () => {
    if (!file || !title.trim()) { setError('Vui lòng nhập tên đề thi'); return; }
    setError('');
    setStep('processing');
    setProcessStage('extract');
    try {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc =
        `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
      const buf = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: buf }).promise;
      setScanTotal(pdf.numPages);
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        setScanCurrent(i);
        const page    = await pdf.getPage(i);
        const content = await page.getTextContent();
        let pageText  = '';
        let lastY: number | null = null;
        for (const item of content.items as any[]) {
          if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) pageText += '\n';
          pageText += item.str;
          lastY = item.transform[5];
        }
        fullText += `\n=== Page ${i} ===\n${pageText.trim()}\n`;
      }
      setScannedText(fullText);
      setStep('scanned');
    } catch (err: any) {
      setError(err.message || 'Lỗi khi đọc PDF');
      setStep('upload');
    }
  };

  // ── STEP 2: AI Parse (separate, user-triggered) ────────────────────────
  const handleParse = async () => {
    if (!scannedText) return;
    setError('');
    setStep('processing');
    setProcessStage('parse');
    try {
      const CHUNK = 4500;
      const chunks: string[] = [];
      for (let i = 0; i < scannedText.length; i += CHUNK) {
        chunks.push(scannedText.slice(i, i + CHUNK));
        if (chunks.length >= 5) break;
      }
      setParseChunk({ current: 0, total: chunks.length });
      let allParsed: ParsedQuestion[] = [];
      for (let c = 0; c < chunks.length; c++) {
        setParseChunk({ current: c + 1, total: chunks.length });
        const result = await parsePdfQA(chunks[c]);
        allParsed = [...allParsed, ...result];
        if (c < chunks.length - 1) await new Promise(r => setTimeout(r, 1500));
      }
      setQuestions(allParsed.map((q, i) => ({ ...q, _id: `q-${i}`, enabled: true })));
      setStep('preview');
    } catch (err: any) {
      setError(err.message || 'Lỗi AI phân tích');
      setStep('scanned');
    }
  };

  // ── Import to DB ───────────────────────────────────────────────────────────
  const handleImport = async () => {
    const active = questions.filter(q => q.enabled);
    if (!active.length) return;
    setImporting(true);
    setError('');
    try {
      const res = await teacherApi.exams.create({
        eTitle: title,
        eDescription: `Imported from PDF: ${file?.name}`,
        eType: examType,
        eSkill: skill as any,
        eDuration_minutes: duration,
        eIs_private: false,
        eSource_type: 'imported',
      });
      const examId = (res as any)?.data?.eId ?? (res as any)?.data?.examId ?? (res as any)?.data?.id;
      if (!examId) throw new Error('Không lấy được ID đề thi');
      const payload = active.map(q => ({
        qContent: q.qContent,
        qType: 'multiple_choice' as any,
        qPoints: q.qPoints || 1,
        answers: (['A', 'B', 'C', 'D'] as const)
          .filter(o => q.options?.[o])
          .map(o => ({ aContent: q.options[o]!, aIs_correct: q.correct_answer === o })),
      }));
      await teacherApi.exams.addQuestions(examId, payload);
      setCreatedExamId(String(examId));
      setStep('success');
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Lỗi khi import');
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setStep('upload'); setFile(null); setTitle('');
    setQuestions([]); setCreatedExamId(null); setError('');
    setScanCurrent(0); setScanTotal(0); setScannedText('');
  };

  const activeCount  = questions.filter(q => q.enabled).length;
  const totalPoints  = questions.filter(q => q.enabled).reduce((s, q) => s + (q.qPoints || 1), 0);
  const currentIdx   = STEP_ORDER.indexOf(step);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="w-full px-8 py-8">

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => navigate('/giao-vien/de-thi')}
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Import đề thi từ PDF</h1>
          <p className="text-sm text-gray-400 mt-0.5">Upload PDF → AI phân tích câu hỏi → Import vào hệ thống</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center mb-8">
        {STEPS_META.map((s, idx) => {
          const done   = idx < currentIdx;
          const active = s.key === step;
          return (
            <React.Fragment key={s.key}>
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  done ? 'bg-green-500 text-white' : active ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                  {done ? '✓' : idx + 1}
                </div>
                <span className={`text-xs font-semibold hidden sm:block ${active ? 'text-indigo-600' : done ? 'text-green-600' : 'text-gray-400'}`}>
                  {s.label}
                </span>
              </div>
              {idx < STEPS_META.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 rounded-full ${done ? 'bg-green-400' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <p className="text-sm flex-1">{error}</p>
          <button onClick={() => setError('')} className="p-1 hover:bg-red-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── STEP 1: Upload ── */}
      {step === 'upload' && (
        <div className="space-y-6">
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onClick={() => document.getElementById('pdf-inp')?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
              dragOver ? 'border-indigo-400 bg-indigo-50' :
              file     ? 'border-green-400 bg-green-50' :
              'border-gray-300 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50/40'}`}>
            <input id="pdf-inp" type="file" accept=".pdf" className="hidden"
              onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
            {file ? (
              <>
                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-green-600" />
                </div>
                <p className="font-semibold text-gray-800">{file.name}</p>
                <p className="text-sm text-gray-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB · Click để đổi file</p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-8 h-8 text-indigo-600" />
                </div>
                <p className="font-semibold text-gray-700">Kéo thả file PDF vào đây</p>
                <p className="text-sm text-gray-400 mt-1">hoặc click để chọn · Chỉ hỗ trợ .pdf</p>
              </>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-500" /> Thông tin đề thi
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tên đề thi <span className="text-red-500">*</span></label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                placeholder="VD: VSTEP B2 – Đề thi thử 2024"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Loại đề</label>
                <select value={examType} onChange={e => setExamType(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  {EXAM_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Kỹ năng</label>
                <select value={skill} onChange={e => setSkill(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  {SKILLS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Thời gian làm bài (phút)</label>
              <input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} min={5} max={300}
                className="w-32 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
          </div>

          <button onClick={handleScan} disabled={!file || !title.trim()}
            className="w-full py-4 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}>
            <FileText className="w-5 h-5" /> Scan PDF
          </button>
        </div>
      )}

      {/* ── STEP scanned: 2-col layout ── */}
      {step === 'scanned' && (
        <div
          className="flex gap-4 items-start"
          style={{ animation: 'previewSlideIn 0.35s cubic-bezier(0.22,1,0.36,1) both' }}
        >
          <style>{`@keyframes previewSlideIn{from{opacity:0;transform:translateX(-20px)}to{opacity:1;transform:translateX(0)}}`}</style>

          {/* LEFT: scrollable text preview */}
          <div className="flex-1 min-w-0 bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
              <FileText className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nội dung đề thi</span>
              <span className="ml-auto text-xs text-gray-400">{scannedText.length.toLocaleString()} ký tự</span>
            </div>
            <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed p-4 overflow-y-auto"
              style={{ maxHeight: '420px', fontFamily: '"Times New Roman", Times, serif' }}>
              {scannedText}
            </pre>
          </div>

          {/* RIGHT: action panel */}
          <div className="w-56 flex-shrink-0 flex flex-col gap-3">
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="font-bold text-green-800 text-sm">Scan xong!</span>
              </div>
              <p className="text-xs text-green-600 leading-relaxed">{file?.name}</p>
            </div>

            <button onClick={handleParse}
              className="w-full py-3.5 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-200"
              style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}>
              <Sparkles className="w-4 h-4" /> AI Phân tích
            </button>

            <button onClick={() => setStep('upload')}
              className="w-full py-2.5 rounded-2xl font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 transition-all text-xs">
              ← Chọn file khác
            </button>
          </div>
        </div>
      )}

      {/* ── STEP processing ── */}
      {step === 'processing' && (
        <div className="flex flex-col items-center py-24 space-y-6">
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 rounded-full border-4 border-indigo-100" />
            <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center text-3xl">
              {processStage === 'extract' ? '📄' : '🤖'}
            </div>
          </div>
          {processStage === 'extract' ? (
            <div className="text-center">
              <p className="text-lg font-bold text-gray-800">Đang đọc PDF...</p>
              <p className="text-sm text-gray-500 mt-1">Trang {scanCurrent} / {scanTotal}</p>
              {scanTotal > 0 && (
                <div className="w-64 h-2 bg-gray-200 rounded-full mt-4 overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                    style={{ width: `${(scanCurrent / scanTotal) * 100}%` }} />
                </div>
              )}
            </div>
          ) : (
            <div className="text-center">
              <p className="text-lg font-bold text-gray-800">AI đang phân tích câu hỏi...</p>
              {parseChunk.total > 0 ? (
                <>
                  <p className="text-sm text-gray-500 mt-1">
                    Phần <span className="font-bold text-indigo-600">{parseChunk.current}</span> / {parseChunk.total}
                  </p>
                  <div className="w-64 h-2 bg-gray-200 rounded-full mt-4 mx-auto overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${(parseChunk.current / parseChunk.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Đang xử lý từng phần nhỏ để tránh giới hạn API</p>
                </>
              ) : (
                <p className="text-sm text-gray-500 mt-1">Groq đang tìm và cấu trúc Q&A từ nội dung PDF</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3: Preview ── */}
      {step === 'preview' && (
        <div
          className="space-y-4"
          style={{ animation: 'previewSlideIn 0.4s cubic-bezier(0.22,1,0.36,1) both' }}
        >
          <style>{`
            @keyframes previewSlideIn {
              from { opacity: 0; transform: translateX(-24px); }
              to   { opacity: 1; transform: translateX(0); }
            }
            @keyframes qCardIn {
              from { opacity: 0; transform: translateY(10px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          {/* Stats + CTA */}
          <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-2xl px-5 py-4">
            <div className="flex gap-6">
              <div>
                <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wide">Tìm thấy</p>
                <p className="text-2xl font-bold text-indigo-700">{questions.length} câu</p>
              </div>
              <div>
                <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wide">Sẽ import</p>
                <p className="text-2xl font-bold text-green-600">{activeCount} câu</p>
              </div>
              <div>
                <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wide">Tổng điểm</p>
                <p className="text-2xl font-bold text-gray-700">{totalPoints}</p>
              </div>
            </div>
            <button onClick={handleImport} disabled={importing || activeCount === 0}
              className="px-5 py-2.5 rounded-xl font-bold text-white text-sm flex items-center gap-2 disabled:opacity-40 transition-all"
              style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}>
              {importing
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Đang lưu...</>
                : <><CheckCircle2 className="w-4 h-4" /> Import {activeCount} câu</>}
            </button>
          </div>

          <p className="text-xs text-gray-400 px-1">Bỏ tick để loại câu hỏi · Click để xem đáp án chi tiết</p>

          {/* Question cards */}
          <div className="space-y-2">
            {questions.map((q, idx) => {
              const expanded = expandedId === q._id;
              return (
                <div key={q._id}
                  style={{
                    animation: 'qCardIn 0.35s ease both',
                    animationDelay: `${Math.min(idx * 40, 800)}ms`,
                  }}
                  className={`border rounded-xl overflow-hidden transition-all ${q.enabled ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-50'}`}>
                  <div className="flex items-start gap-3 p-4">
                    <input type="checkbox" checked={q.enabled}
                      onChange={() => setQuestions(prev => prev.map(x => x._id === q._id ? { ...x, enabled: !x.enabled } : x))}
                      className="mt-1 w-4 h-4 accent-indigo-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => setExpandedId(expanded ? null : q._id)}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-gray-800 line-clamp-2">
                          <span className="text-indigo-600 font-bold mr-1">#{idx + 1}</span>
                          {q.qContent ? q.qContent.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&#39;/gi, "'").replace(/&quot;/gi, '"').replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim() : ""}
                        </p>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {q.correct_answer && (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${OPT_CORRECT[q.correct_answer] || 'bg-gray-500 text-white border-gray-500'}`}>
                              {q.correct_answer}
                            </span>
                          )}
                          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </div>
                      </div>
                    </div>
                  </div>
                  {expanded && q.options && (
                    <div className="px-4 pb-4 ml-7 grid gap-2">
                      {(['A', 'B', 'C', 'D'] as const).filter(o => q.options[o]).map(o => (
                        <div key={o}
                          className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-sm ${q.correct_answer === o ? OPT_CORRECT[o] : OPT_BASE[o]}`}>
                          <span className="font-bold flex-shrink-0">{o}.</span>
                          <span className="flex-1">{q.options[o]}</span>
                          {q.correct_answer === o && <span className="text-xs opacity-75 flex-shrink-0">✓ Đúng</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom CTA */}
          <button onClick={handleImport} disabled={importing || activeCount === 0}
            className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40 transition-all"
            style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}>
            {importing
              ? <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Đang import {activeCount} câu...</>
              : <><CheckCircle2 className="w-5 h-5" /> Import {activeCount} câu hỏi vào hệ thống</>}
          </button>
        </div>
      )}

      {/* ── STEP 4: Success ── */}
      {step === 'success' && (
        <div className="flex flex-col items-center py-20 text-center space-y-4">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Import thành công!</h2>
          <p className="text-gray-500">Đã import <strong>{activeCount} câu hỏi</strong> vào đề thi <strong>{title}</strong></p>
          <div className="flex gap-3 pt-2">
            <button onClick={() => navigate(`/giao-vien/de-thi/${createdExamId}`)}
              className="px-6 py-3 rounded-xl font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}>
              Xem đề thi
            </button>
            <button onClick={handleReset}
              className="px-6 py-3 rounded-xl font-bold text-gray-700 border border-gray-200 hover:bg-gray-50 flex items-center gap-2">
              <RotateCcw className="w-4 h-4" /> Import đề khác
            </button>
          </div>
        </div>
      )}
    </div>
  );
};



