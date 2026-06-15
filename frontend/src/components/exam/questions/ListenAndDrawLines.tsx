import { useState } from 'react';
import { Volume2 } from 'lucide-react';
import { QuestionRendererProps } from '../../../types/exam';
import { extractTaskData } from '../../../utils/examDataExtractor';
import { getFullMediaUrl } from '../../../utils/mediaUtils';

export function ListenAndDrawLines({
  question,
  mode,
  answer = {},
  onAnswer,
}: QuestionRendererProps) {
  const [dragOverHotspot, setDragOverHotspot] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const taskData = extractTaskData(question);
  const { instructions, imageUrl: rawImageUrl, audioUrl: rawAudioUrl, items = [] } = taskData;
  const imageUrl = rawImageUrl ? getFullMediaUrl(rawImageUrl) : '';
  const audioUrl = rawAudioUrl ? getFullMediaUrl(rawAudioUrl) : '';
  const isInteractive = mode === 'student';
  const matchingMode: string =
    (taskData as any).matchingMode ||
    taskData.config?.matchingMode ||
    (items[0]?.hotspot ? 'drag-to-image' : items[0]?.targetLabel ? 'drag-to-list' : 'drag-to-image');

  // ── Helpers ──────────────────────────────────────────────────────────────
  // answer[String(labelIdx)] = String(hotspotIdx)
  const getPlacedLabelAt = (hotspotIdx: number): number | null => {
    const key = Object.keys(answer).find((k) => String(answer[k]) === String(hotspotIdx));
    return key != null ? parseInt(key) : null;
  };

  const placeLabel = (labelIdx: number, hotspotIdx: number) => {
    if (!onAnswer) return;
    const next = { ...answer };
    const prevKey = Object.keys(next).find((k) => parseInt(k) === labelIdx);
    if (prevKey !== undefined) delete next[prevKey];
    const evictKey = Object.keys(next).find((k) => String(next[k]) === String(hotspotIdx));
    if (evictKey !== undefined) delete next[evictKey];
    next[String(labelIdx)] = String(hotspotIdx);
    onAnswer(next);
    setSelected(null);
  };

  const unplaceLabel = (labelIdx: number) => {
    if (!onAnswer) return;
    const next = { ...answer };
    delete next[String(labelIdx)];
    onAnswer(next);
    setSelected(null);
  };

  const handleChipClick = (idx: number) => {
    if (!isInteractive) return;
    setSelected((prev) => (prev === idx ? null : idx));
  };

  const handleHotspotClick = (hotspotIdx: number) => {
    if (!isInteractive) return;
    const item = items[hotspotIdx];
    if (!item || item.isExample || item.is_example) return;
    const placedLabel = getPlacedLabelAt(hotspotIdx);
    if (selected !== null) {
      placeLabel(selected, hotspotIdx);
    } else if (placedLabel !== null) {
      unplaceLabel(placedLabel);
    }
  };

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    e.dataTransfer.setData('ldl-label', String(idx));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, hotspotIdx: number) => {
    const item = items[hotspotIdx];
    if (!item || item.isExample || item.is_example) return;
    e.preventDefault();
    setDragOverHotspot(hotspotIdx);
  };

  const handleDrop = (e: React.DragEvent, hotspotIdx: number) => {
    e.preventDefault();
    setDragOverHotspot(null);
    const item = items[hotspotIdx];
    if (!item || item.isExample || item.is_example) return;
    const labelIdx = parseInt(e.dataTransfer.getData('ldl-label'));
    if (!isNaN(labelIdx)) placeLabel(labelIdx, hotspotIdx);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Instructions */}
      {instructions && (
        <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
          <p className="font-medium text-blue-900">{instructions}</p>
        </div>
      )}

      {/* Audio */}
      {audioUrl && (
        <div className="flex items-center gap-3 rounded-2xl border-2 border-blue-200 bg-blue-50 p-3">
          <Volume2 className="h-5 w-5 flex-shrink-0 text-blue-600" />
          <audio controls className="flex-1" src={audioUrl} />
        </div>
      )}

      {/* ── drag-to-image mode ── */}
      {matchingMode === 'drag-to-image' && items.length > 0 && (
        <>
          {/* Name chip bank */}
          <div className="flex min-h-[52px] flex-wrap items-center gap-2 rounded-2xl border-2 border-indigo-100 bg-indigo-50 px-4 py-3">
            {items.map((item: any, i: number) => {
              if (item.isExample || item.is_example) return null;
              const isPlaced = answer[String(i)] !== undefined;
              const isSel = selected === i;
              return (
                <div
                  key={i}
                  draggable={isInteractive && !isPlaced}
                  onDragStart={isInteractive && !isPlaced ? (e) => handleDragStart(e, i) : undefined}
                  onClick={() => handleChipClick(i)}
                  className={`select-none rounded-full border-2 px-3 py-1 text-[15px] font-bold transition-all ${
                    isPlaced
                      ? 'cursor-default border-dashed border-indigo-200 text-indigo-200'
                      : isSel
                      ? 'scale-105 cursor-pointer border-rose-500 bg-rose-500 text-white shadow-lg'
                      : isInteractive
                      ? 'cursor-grab border-indigo-300 bg-white text-slate-700 shadow hover:border-indigo-500 active:scale-95'
                      : 'border-indigo-300 bg-white text-slate-700'
                  }`}
                >
                  {item.name}
                </div>
              );
            })}
          </div>

          {isInteractive && selected !== null && (
            <p className="animate-pulse text-center text-sm font-bold text-rose-500">
              👆 Nhấn vào ô trên hình để đặt tên &ldquo;{items[selected]?.name}&rdquo;
            </p>
          )}

          {/* Image with hotspot drop zones */}
          {imageUrl ? (
            <div
              className="relative select-none overflow-hidden rounded-2xl border-2 border-slate-200 max-w-[520px] mx-auto"
              onDragLeave={() => setDragOverHotspot(null)}
            >
              <img
                src={imageUrl}
                alt="Scene"
                className="block h-auto w-full pointer-events-none"
                draggable={false}
              />
              {items.map((item: any, i: number) => {
                if (!item.hotspot) return null;
                const isExample = item.isExample || item.is_example;
                const placedLabelIdx = isExample ? i : getPlacedLabelAt(i);
                const placedName = placedLabelIdx !== null ? (items[placedLabelIdx]?.name ?? '') : null;
                const isDragTarget = dragOverHotspot === i;
                return (
                  <div
                    key={i}
                    className="absolute -translate-x-1/2"
                    style={{ left: `${item.hotspot.x}%`, top: `${item.hotspot.y}%` }}
                    onDragOver={isInteractive && !isExample ? (e) => handleDragOver(e, i) : undefined}
                    onDrop={isInteractive && !isExample ? (e) => handleDrop(e, i) : undefined}
                    onClick={() => handleHotspotClick(i)}
                  >
                    {placedName ? (
                      <div
                        className={`whitespace-nowrap rounded-xl border-2 px-3 py-1 text-sm font-bold shadow-md transition-all ${
                          isExample
                            ? 'border-sky-600 bg-sky-500 text-white'
                            : isInteractive
                            ? 'cursor-pointer border-green-600 bg-green-500 text-white hover:border-red-400 hover:bg-red-400'
                            : 'border-green-600 bg-green-500 text-white'
                        }`}
                        title={!isExample && isInteractive ? 'Nhấn để bỏ' : ''}
                      >
                        {placedName}
                      </div>
                    ) : (
                      <div
                        className={`min-w-[52px] whitespace-nowrap rounded-xl border-2 border-dashed px-3 py-1 text-center text-sm font-bold shadow transition-all ${
                          isDragTarget
                            ? 'scale-110 border-rose-500 bg-rose-100 text-rose-600'
                            : selected !== null
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-500'
                            : 'border-slate-600 bg-white/95 text-slate-500'
                        }`}
                      >
                        ?
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-sm italic text-slate-400">Chưa có hình ảnh cho câu này.</p>
          )}
        </>
      )}

      {/* ── drag-to-list mode (fallback) ── */}
      {matchingMode === 'drag-to-list' && items.length > 0 && (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          {items.map((item: any, idx: number) => {
            const sel = answer[String(idx)];
            return (
              <div
                key={idx}
                className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center"
              >
                <div className="flex items-center gap-2 sm:w-1/2">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-indigo-500 text-sm font-bold text-white">
                    {idx + 1}
                  </span>
                  <span className="font-semibold text-slate-800">{item.name}</span>
                </div>
                <div className="sm:w-1/2">
                  <select
                    value={sel ?? ''}
                    disabled={!isInteractive}
                    onChange={(e) => {
                      if (!onAnswer) return;
                      const val = e.target.value;
                      const next = { ...answer };
                      if (val === '') delete next[String(idx)];
                      else next[String(idx)] = val;
                      onAnswer(next);
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-100"
                  >
                    <option value="">— Chọn đáp án —</option>
                    {items.map((opt: any, optIdx: number) => (
                      <option key={optIdx} value={String(optIdx)}>
                        {opt.targetLabel || opt.targetId || `Lựa chọn ${optIdx + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
