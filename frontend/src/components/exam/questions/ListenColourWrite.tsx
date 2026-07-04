import React, { useState } from 'react';
import { Volume2, Palette, Edit2, CheckCircle2, XCircle } from 'lucide-react';
import { getFullMediaUrl } from '../../../utils/mediaUtils';

interface ListenColourWriteProps {
  question: any;
  taskData: any;
  interactiveMode: boolean;
  userAnswer?: any;
  onAnswerChange?: (answer: any) => void;
}

export function ListenColourWrite({
  question,
  taskData,
  interactiveMode,
  userAnswer,
  onAnswerChange
}: ListenColourWriteProps) {
  const realTaskData = taskData.task_data || taskData;
  const config = taskData.config || realTaskData.config || {};
  
  // Hỗ trợ cả config.instructions và config.items làm danh sách câu hỏi
  const items = config?.instructions || config?.items || realTaskData?.items || [];
  const instructionsText = question?.title || realTaskData?.title || config?.instructionsText || 'Listen, colour and write. There is one example.';
  const audioUrl = realTaskData?.audioUrl || config?.audioUrl || realTaskData?.audio_url || config?.audio_url;
  const imageUrl = realTaskData?.imageUrl || config?.imageUrl || realTaskData?.image_url || config?.image_url;
  
  const [activeColor, setActiveColor] = useState<string | null>(null);

  const colours = [
    { value: 'red', label: 'Đỏ', hex: '#ef4444' },
    { value: 'blue', label: 'Xanh dương', hex: '#3b82f6' },
    { value: 'green', label: 'Xanh lá', hex: '#22c55e' },
    { value: 'yellow', label: 'Vàng', hex: '#eab308' },
    { value: 'orange', label: 'Cam', hex: '#f97316' },
    { value: 'purple', label: 'Tím', hex: '#a855f7' },
    { value: 'pink', label: 'Hồng', hex: '#ec4899' },
    { value: 'brown', label: 'Nâu', hex: '#92400e' },
    { value: 'black', label: 'Đen', hex: '#000000' },
    { value: 'white', label: 'Trắng', hex: '#ffffff' },
    { value: 'grey', label: 'Xám', hex: '#6b7280' },
  ];

  // Phân loại các câu hỏi có hotspot và không có hotspot (hỗ trợ dữ liệu cũ)
  const itemsWithHotspot = items.filter((item: any) => item.hotspot);
  const itemsWithoutHotspot = items.filter((item: any) => !item.hotspot);

  // Xử lý sự kiện kéo bắt đầu từ bảng màu
  const handleDragStart = (e: React.DragEvent, color: string) => {
    e.dataTransfer.setData('text/plain', `color:${color}`);
  };

  // Thả màu vào hotspot
  const handleHotspotDrop = (e: React.DragEvent, itemIdx: number, isWrite: boolean) => {
    e.preventDefault();
    if (!interactiveMode || isWrite) return;
    const data = e.dataTransfer.getData('text/plain');
    if (data.startsWith('color:')) {
      const color = data.split(':')[1];
      onAnswerChange?.({
        ...userAnswer,
        [itemIdx]: color
      });
    }
  };

  // Click vào hotspot (cho chế độ click để tô màu trên thiết bị di động/máy tính)
  const handleHotspotClick = (itemIdx: number, isWrite: boolean) => {
    if (!interactiveMode || isWrite) return;
    if (activeColor) {
      onAnswerChange?.({
        ...userAnswer,
        [itemIdx]: activeColor
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Tiêu đề / Hướng dẫn đề bài */}
      {instructionsText && (
        <div className="p-4 bg-orange-50 rounded-xl border border-orange-200">
          <p className="text-orange-950 font-bold text-lg flex items-center gap-2">
            <span>🎨</span> {instructionsText}
          </p>
        </div>
      )}
      
      {/* Trình phát Audio */}
      {audioUrl && (
        <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <Volume2 className="w-6 h-6 text-orange-500 animate-pulse" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-slate-500">🎵 Nghe audio hướng dẫn:</p>
            <audio controls className="w-full mt-1.5 h-10">
              <source src={getFullMediaUrl(audioUrl)} type="audio/mpeg" />
              Trình duyệt không hỗ trợ nghe audio.
            </audio>
          </div>
        </div>
      )}
      
      {/* Khu vực Bức tranh tương tác */}
      {imageUrl && (
        <div className="flex flex-col items-center justify-center p-4 border border-slate-200 bg-slate-50 rounded-2xl shadow-inner">
          <div className="relative border border-slate-300 rounded-xl overflow-hidden bg-white shadow-md inline-block max-w-full">
            <img 
              src={getFullMediaUrl(imageUrl)} 
              alt="Listen and Colour" 
              className="max-h-[500px] w-auto object-contain select-none"
            />
            
            {/* Vẽ các điểm neo (Hotspots) trên ảnh */}
            {itemsWithHotspot.map((item: any, idx: number) => {
              // Tìm chỉ số gốc trong mảng items để map với userAnswer
              const originalIndex = items.findIndex((x: any) => x.id === item.id);
              const isExample = item.isExample || item.is_example;
              const isWrite = !!(item.writeText || item.write_text);
              
              // Đáp án hiển thị (ưu tiên userAnswer, nếu là ví dụ thì lấy đáp án đúng mặc định)
              const currentAnswer = isExample 
                ? (item.colour || item.writeText || item.write_text) 
                : userAnswer?.[originalIndex];
              
              const colorMeta = colours.find(c => c.value === currentAnswer);
              const hexColor = colorMeta?.hex;

              return (
                <div key={item.id}>
                  {/* Điểm neo hình tròn */}
                  <div
                    onClick={() => handleHotspotClick(originalIndex, isWrite)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleHotspotDrop(e, originalIndex, isWrite)}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full border-2 shadow-md transition-all select-none ${
                      isWrite ? 'bg-white border-blue-500' : 'bg-slate-200/90 border-white'
                    } ${
                      interactiveMode && !isExample
                        ? 'cursor-pointer hover:scale-125 hover:shadow-lg active:scale-95'
                        : 'pointer-events-none'
                    }`}
                    style={{
                      left: `${item.hotspot.x}%`,
                      top: `${item.hotspot.y}%`,
                      width: '32px',
                      height: '32px',
                      backgroundColor: !isWrite && hexColor ? hexColor : undefined,
                    }}
                    title={isExample ? 'Ví dụ mẫu' : `Câu ${originalIndex + 1}`}
                  >
                    {isWrite ? (
                      <Edit2 className="w-4 h-4 text-blue-600" />
                    ) : (
                      <span 
                        className={`text-xs font-bold ${
                          currentAnswer && currentAnswer !== 'white' && currentAnswer !== 'yellow'
                            ? 'text-white'
                            : 'text-slate-700'
                        }`}
                      >
                        {originalIndex + 1}
                      </span>
                    )}

                    {/* Hiển thị check đúng/sai khi xem kết quả */}
                    {!interactiveMode && !isExample && (
                      <div className="absolute -top-3 -right-3 bg-white rounded-full">
                        {currentAnswer === (item.colour || item.writeText || item.write_text) ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-white" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500 fill-white" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Input nhập chữ nếu là dạng viết (isWrite) */}
                  {isWrite && (
                    <div 
                      className="absolute -translate-x-1/2 mt-5 pointer-events-auto"
                      style={{
                        left: `${item.hotspot.x}%`,
                        top: `${item.hotspot.y}%`,
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Nhập từ..."
                        value={currentAnswer || ''}
                        disabled={!interactiveMode || isExample}
                        onChange={(e) => {
                          onAnswerChange?.({
                            ...userAnswer,
                            [originalIndex]: e.target.value
                          });
                        }}
                        className={`w-24 text-center px-1.5 py-0.5 text-xs border rounded shadow-md font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white/95 text-slate-800 ${
                          isExample ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-slate-300'
                        }`}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bảng màu sắc & Bút vẽ cho học viên */}
      {interactiveMode && (
        <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Palette className="w-5 h-5 text-orange-500" />
            <span>🎨 Hộp bút màu (Chọn màu để tô hoặc kéo thả vào chấm số trên tranh):</span>
          </div>
          
          <div className="flex flex-wrap gap-2.5">
            {colours.map((color) => (
              <button
                key={color.value}
                draggable
                onDragStart={(e) => handleDragStart(e, color.value)}
                onClick={() => setActiveColor(activeColor === color.value ? null : color.value)}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all cursor-pointer ${
                  activeColor === color.value
                    ? 'border-orange-500 bg-orange-50 scale-105 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
                title="Kéo thả màu này lên tranh hoặc click chọn rồi click vào điểm neo"
              >
                <span 
                  className="w-4 h-4 rounded-full border border-black/10 inline-block shadow-sm"
                  style={{ backgroundColor: color.hex }}
                />
                <span className="text-slate-700">{color.label}</span>
              </button>
            ))}
          </div>

          {activeColor && (
            <p className="text-xs text-orange-600 bg-orange-50/50 border border-orange-200 rounded-lg p-2 animate-pulse inline-block">
              👉 Đang chọn màu: <strong>{colours.find(c => c.value === activeColor)?.label}</strong>. Hãy click vào điểm số trên bức tranh để tô màu!
            </p>
          )}
        </div>
      )}

      {/* Hiển thị danh sách câu hỏi cũ làm phương án dự phòng (Fallback) nếu không có hotspot */}
      {itemsWithoutHotspot.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-700">✍️ Trả lời các câu hỏi sau:</p>
          <div className="grid gap-3 md:grid-cols-2">
            {itemsWithoutHotspot.map((item: any, idx: number) => {
              const originalIndex = items.findIndex((x: any) => x.id === item.id);
              const isExample = item.isExample || item.is_example;
              const isWrite = !!(item.writeText || item.write_text);
              const objectName = item.objectName || item.object || item.name || `Đối tượng #${idx + 1}`;
              const currentAnswer = isExample 
                ? (item.colour || item.writeText || item.write_text) 
                : userAnswer?.[originalIndex];

              return (
                <div key={item.id} className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-800">
                      Câu {originalIndex + 1}: {objectName}
                      {isExample && <span className="ml-1 text-xs text-amber-600 font-bold">(Ví dụ)</span>}
                    </span>
                  </div>

                  {isWrite ? (
                    <input
                      type="text"
                      placeholder="Nhập từ..."
                      value={currentAnswer || ''}
                      disabled={!interactiveMode || isExample}
                      onChange={(e) => {
                        onAnswerChange?.({
                          ...userAnswer,
                          [originalIndex]: e.target.value
                        });
                      }}
                      className="w-full text-sm px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {colours.map((color) => (
                        <button
                          key={color.value}
                          disabled={!interactiveMode || isExample}
                          onClick={() => {
                            onAnswerChange?.({
                              ...userAnswer,
                              [originalIndex]: color.value
                            });
                          }}
                          className={`w-7 h-7 rounded-full border transition-all ${
                            currentAnswer === color.value
                              ? 'border-slate-900 ring-2 ring-orange-400 scale-110'
                              : 'border-slate-200 hover:scale-105'
                          }`}
                          style={{ backgroundColor: color.hex }}
                          title={color.label}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
