import { useState, useCallback } from 'react';
import {
  Upload, FileText, Download, X, CheckSquare, Square, Scissors,
} from 'lucide-react';

interface PageThumb { pageNum: number; dataUrl: string }

export function PdfCutterTab() {
  const [file, setFile]             = useState<File | null>(null);
  const [numPages, setNumPages]     = useState(0);
  const [thumbs, setThumbs]         = useState<PageThumb[]>([]);
  const [selected, setSelected]     = useState<Set<number>>(new Set());
  const [cutFrom, setCutFrom] = useState<number | ''>('');
  const [cutTo, setCutTo]     = useState<number | ''>('');
  const [loading, setLoading]       = useState(false);
  const [progress, setProgress]     = useState({ current: 0, total: 0 });
  const [generating, setGenerating] = useState(false);
  const [dragOver, setDragOver]     = useState(false);

  const handleFile = useCallback(async (f: File) => {
    if (f.type !== 'application/pdf') return;
    setFile(f);
    setLoading(true);
    setThumbs([]);
    setProgress({ current: 0, total: 0 });

    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc =
      `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    const buf = await f.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: buf }).promise;
    const total = pdf.numPages;
    setNumPages(total);
    setProgress({ current: 0, total });
    setSelected(new Set(Array.from({ length: total }, (_, i) => i + 1)));

    for (let i = 1; i <= total; i++) {
      const page     = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 0.35 });
      const canvas   = document.createElement('canvas');
      canvas.width   = viewport.width;
      canvas.height  = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d')!, viewport } as Parameters<typeof page.render>[0]).promise;
      setThumbs(prev => [...prev, { pageNum: i, dataUrl: canvas.toDataURL() }]);
      setProgress({ current: i, total });
    }
    setLoading(false);
  }, []);

  const applyExclude = () => {
    if (cutFrom === '' || cutTo === '') return;
    const from = Math.max(1, Number(cutFrom));
    const to   = Math.min(numPages, Number(cutTo));
    setSelected(prev => {
      const s = new Set(prev);
      for (let i = from; i <= to; i++) s.delete(i);
      return s;
    });
  };

  const togglePage = (n: number) =>
    setSelected(prev => { const s = new Set(prev); s.has(n) ? s.delete(n) : s.add(n); return s; });

  const handleDownload = async () => {
    if (!file || selected.size === 0) return;
    setGenerating(true);
    try {
      const { PDFDocument } = await import('pdf-lib');
      const src    = await PDFDocument.load(await file.arrayBuffer());
      const dst    = await PDFDocument.create();
      const sorted = Array.from(selected).sort((a, b) => a - b);
      const copied = await dst.copyPages(src, sorted.map(p => p - 1));
      copied.forEach(p => dst.addPage(p));
      const out  = await dst.save();
      const blob = new Blob([out as unknown as BlobPart], { type: 'application/pdf' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      const first = sorted[0];
      const last  = sorted[sorted.length - 1];
      a.download = `${file.name.replace(/\.pdf$/i, '')}_trang${first}-${last}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setGenerating(false);
    }
  };

  const reset = () => { setFile(null); setThumbs([]); setSelected(new Set()); setNumPages(0); };

  const sortedSelected = Array.from(selected).sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 border border-[#E5E7EB]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
            <Scissors className="w-5 h-5 text-[#EA580C]" />
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700 }} className="text-[#111827]">
              Cắt trang PDF
            </h3>
            <p style={{ fontSize: '13px' }} className="text-[#6B7280]">
              Chọn những trang muốn giữ lại và tải xuống thành file PDF mới
            </p>
          </div>
        </div>
      </div>

      {/* Upload zone */}
      {!file && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onClick={() => document.getElementById('pdf-cutter-input')?.click()}
            className="border-2 border-dashed rounded-2xl p-14 flex flex-col items-center gap-4 cursor-pointer transition-all"
            style={{ borderColor: dragOver ? '#EA580C' : '#D1D5DB', background: dragOver ? '#FFF7ED' : '#F9FAFB' }}
          >
            <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center">
              <Upload className="w-8 h-8 text-[#EA580C]" />
            </div>
            <div className="text-center">
              <p style={{ fontSize: '16px', fontWeight: 600 }} className="text-[#111827] mb-1">
                Kéo thả hoặc click để chọn file PDF
              </p>
              <p style={{ fontSize: '13px' }} className="text-[#6B7280]">Chỉ hỗ trợ file .pdf</p>
            </div>
            <input id="pdf-cutter-input" type="file" accept="application/pdf" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
          </div>
        </div>
      )}

      {/* File loaded */}
      {file && (
        <>
          {/* File info + controls */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-[#EA580C]" />
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: '14px', fontWeight: 600 }} className="text-[#111827] truncate">{file.name}</p>
                <p style={{ fontSize: '12px' }} className="text-[#6B7280]">
                  {numPages || '...'} trang · {(file.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
              <button onClick={reset} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Cut range: 2 boxes */}
            <div className="space-y-2">
              <p style={{ fontSize: '12px', fontWeight: 600 }} className="text-[#6B7280] uppercase tracking-wide">
                Cắt bỏ trang
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 bg-gray-50 border border-[#D1D5DB] rounded-lg px-3 h-10">
                  <span style={{ fontSize: '13px', fontWeight: 600 }} className="text-[#374151] whitespace-nowrap">Từ trang</span>
                  <input
                    type="number" min={1} max={numPages}
                    value={cutFrom}
                    onChange={e => setCutFrom(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="1"
                    style={{ fontSize: '14px', fontWeight: 600, width: '52px' }}
                    className="bg-transparent text-[#111827] text-center focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 bg-gray-50 border border-[#D1D5DB] rounded-lg px-3 h-10">
                  <span style={{ fontSize: '13px', fontWeight: 600 }} className="text-[#374151] whitespace-nowrap">Đến trang</span>
                  <input
                    type="number" min={1} max={numPages}
                    value={cutTo}
                    onChange={e => setCutTo(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder={String(numPages)}
                    style={{ fontSize: '14px', fontWeight: 600, width: '52px' }}
                    className="bg-transparent text-[#111827] text-center focus:outline-none"
                  />
                </div>
                <button
                  onClick={applyExclude}
                  disabled={cutFrom === '' || cutTo === ''}
                  className="h-10 px-5 bg-[#EA580C] text-white rounded-lg text-sm font-semibold hover:bg-[#C2410C] transition-colors disabled:opacity-40"
                >
                  Cắt bỏ
                </button>
                <div className="w-px h-6 bg-gray-200 mx-1" />
                <button
                  onClick={() => setSelected(new Set(Array.from({ length: numPages }, (_, i) => i + 1)))}
                  className="h-10 px-4 border border-[#D1D5DB] rounded-lg text-sm text-[#374151] hover:bg-gray-50 transition-colors"
                >
                  Chọn tất cả
                </button>
                <button
                  onClick={() => setSelected(new Set())}
                  className="h-10 px-4 border border-[#D1D5DB] rounded-lg text-sm text-[#374151] hover:bg-gray-50 transition-colors"
                >
                  Bỏ chọn
                </button>
              </div>
            </div>
          </div>

          {/* Loading skeleton */}
          {loading && thumbs.length === 0 && (
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-[3px] border-[#EA580C] border-t-transparent rounded-full animate-spin" />
              <p style={{ fontSize: '14px' }} className="text-[#6B7280]">
                Đang tải trang {progress.current}/{progress.total}...
              </p>
            </div>
          )}

          {/* Thumbnail grid */}
          {thumbs.length > 0 && (
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
              <div className="flex items-center justify-between mb-4">
                <p style={{ fontSize: '14px', fontWeight: 600 }} className="text-[#111827]">
                  Chọn trang
                  <span style={{ fontSize: '13px', fontWeight: 400 }} className="text-[#6B7280] ml-2">
                    ({selected.size}/{numPages} trang được chọn)
                  </span>
                </p>
                {loading && (
                  <p style={{ fontSize: '12px' }} className="text-[#6B7280] flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 border-2 border-[#EA580C] border-t-transparent rounded-full animate-spin" />
                    Đang tải {progress.current}/{progress.total}
                  </p>
                )}
              </div>

              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))' }}>
                {thumbs.map(t => {
                  const isSel = selected.has(t.pageNum);
                  return (
                    <button
                      key={t.pageNum}
                      onClick={() => togglePage(t.pageNum)}
                      className="relative rounded-xl overflow-hidden border-2 transition-all duration-150 group hover:scale-[1.03]"
                      style={{ borderColor: isSel ? '#EA580C' : '#E5E7EB', background: isSel ? '#FFF7ED' : '#F9FAFB' }}
                    >
                      <img src={t.dataUrl} alt={`Trang ${t.pageNum}`} className="w-full object-contain" />

                      {/* Hover overlay */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: 'rgba(0,0,0,0.18)' }}>
                        {isSel
                          ? <CheckSquare className="w-7 h-7 text-white drop-shadow" />
                          : <Square className="w-7 h-7 text-white drop-shadow" />}
                      </div>

                      {/* Badge */}
                      <div className="absolute top-1.5 right-1.5">
                        {isSel
                          ? <div className="w-5 h-5 rounded-full bg-[#EA580C] flex items-center justify-center shadow">
                              <CheckSquare className="w-3 h-3 text-white" />
                            </div>
                          : <div className="w-5 h-5 rounded-full bg-white/80 border border-[#D1D5DB]" />}
                      </div>

                      <div className="py-1.5 text-center"
                        style={{ fontSize: '11px', fontWeight: 600, color: isSel ? '#EA580C' : '#9CA3AF' }}>
                        {t.pageNum}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Download bar */}
          {thumbs.length > 0 && (
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: '14px', fontWeight: 600 }} className="text-[#111827]">
                  {selected.size} trang được chọn
                </p>
                <p style={{ fontSize: '12px' }} className="text-[#6B7280] truncate">
                  {sortedSelected.length > 0 ? `Trang: ${sortedSelected.join(', ')}` : 'Chưa chọn trang nào'}
                </p>
              </div>
              <button
                onClick={handleDownload}
                disabled={selected.size === 0 || generating}
                className="flex items-center gap-2 h-11 px-6 bg-[#EA580C] text-white rounded-lg hover:bg-[#C2410C] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
              >
                <Download className="w-4 h-4" />
                <span style={{ fontSize: '14px', fontWeight: 500 }}>
                  {generating ? 'Đang tạo...' : `Tải xuống PDF (${selected.size} trang)`}
                </span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
