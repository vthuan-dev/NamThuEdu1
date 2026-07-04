import React, { useState, useMemo } from 'react';
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
  // Lấy danh sách câu hỏi: đảm bảo phải là Array (tránh trùng tên với instructions text dạng string)
  const items = (Array.isArray(taskData.task_data?.instructions) ? taskData.task_data.instructions : null) ||
                (Array.isArray(taskData.instructions) ? taskData.instructions : null) || 
                (Array.isArray(taskData.items) ? taskData.items : null) || 
                (Array.isArray(taskData.config?.instructions) ? taskData.config.instructions : null) || 
                [];
                
  const instructionsText = question?.title || 
                           taskData.title || 
                           (typeof taskData.instructions === 'string' ? taskData.instructions : null) || 
                           taskData.instructionsText || 
                           'Listen, colour and write. There is one example.';
                           
  const audioUrl = taskData.audioUrl || 
                   taskData.audio_url || 
                   taskData.task_data?.mainAudioUrl || 
                   taskData.config?.mainAudioUrl;
                   
  const imageUrl = taskData.imageUrl || 
                   taskData.image_url || 
                   taskData.task_data?.mainImageUrl || 
                   taskData.config?.mainImageUrl;
                   
  const imageRotation = taskData.imageRotation || 
                        taskData.task_data?.imageRotation || 
                        taskData.config?.imageRotation || 
                        0;
  
  // State lưu nhãn màu/từ đang được chọn (dành cho click-to-color trên mobile/tablet)
  const [selectedBadge, setSelectedBadge] = useState<any>(null);

  const colours = [
    { value: 'red', label: 'Đỏ', hex: '#ef4444' },
    { value: 'blue', label: 'Xanh dương', hex: '#3b82f6' },
    { value: 'light_blue', label: 'Xanh da trời (Light blue)', hex: '#38bdf8' },
    { value: 'dark_blue', label: 'Xanh dương đậm (Dark blue)', hex: '#1d4ed8' },
    { value: 'green', label: 'Xanh lá', hex: '#22c55e' },
    { value: 'light_green', label: 'Xanh lá nhạt (Light green)', hex: '#4ade80' },
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

  // Tạo danh sách các nhãn kéo thả bên ngoài (chỉ lấy các câu hỏi thực tế, không lấy câu ví dụ)
  // Các nhãn này tương ứng với đáp án đúng để học viên chọn kéo vào (số hotspot trên hình > số nhãn kéo thả)
  const draggableBadges = useMemo(() => {
    // Check if teacher provided explicit distractor labels
    const allLabels = taskData.config?.allLabels || taskData.task_data?.allLabels || taskData.allLabels;
    
    if (allLabels && (allLabels.colours || allLabels.texts)) {
      // New format: use explicit labels (includes distractors)
      const badges = [];
      
      // Add colour badges
      if (Array.isArray(allLabels.colours)) {
        allLabels.colours.forEach((colour: string, idx: number) => {
          badges.push({
            id: `colour_${idx}`,
            originalIndex: -1, // Not tied to specific item
            type: 'color',
            value: colour,
            label: colours.find(c => c.value === colour)?.label || colour,
          });
        });
      }
      
      // Add text badges
      if (Array.isArray(allLabels.texts)) {
        allLabels.texts.forEach((text: string, idx: number) => {
          badges.push({
            id: `text_${idx}`,
            originalIndex: -1,
            type: 'text',
            value: text,
            label: text,
          });
        });
      }
      
      // Shuffle deterministically
      return [...badges].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    }
    
    // Old format: extract from items (backward compatibility)
    const badges = items
      .filter((item: any) => {
        const isExample = item.isExample || item.is_example;
        const hasAnswer = item.colour || item.writeText || item.write_text;
        return !isExample && hasAnswer && item.hotspot;
      })
      .map((item: any) => {
        const originalIndex = items.findIndex((x: any) => x.id === item.id);
        const val = item.colour || item.writeText || item.write_text;
        const isWrite = !!(item.writeText || item.write_text);
        return {
          id: item.id,
          originalIndex,
          type: isWrite ? 'text' : 'color',
          value: val,
          label: isWrite ? val : (colours.find(c => c.value === val)?.label || val),
        };
      });

    // Sắp xếp trộn đều (deterministic shuffle theo ID để không bị re-render đổi thứ tự liên tục)
    return [...badges].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }, [items]);

  // Xử lý kéo nhãn
  const handleDragStart = (e: React.DragEvent, badge: any) => {
    e.dataTransfer.setData('application/json', JSON.stringify(badge));
  };

  // Thả nhãn vào hotspot
  const handleHotspotDrop = (e: React.DragEvent, originalIndex: number) => {
    e.preventDefault();
    if (!interactiveMode) return;
    try {
      const jsonStr = e.dataTransfer.getData('application/json');
      if (jsonStr) {
        const badge = JSON.parse(jsonStr);
        onAnswerChange?.({
          ...userAnswer,
          [originalIndex]: badge.value
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Click vào hotspot (dành cho click-to-assign)
  const handleHotspotClick = (originalIndex: number) => {
    if (!interactiveMode) return;
    if (selectedBadge) {
      onAnswerChange?.({
        ...userAnswer,
        [originalIndex]: selectedBadge.value
      });
      setSelectedBadge(null); // Reset sau khi gán
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
          <div 
            className="relative border border-slate-300 rounded-xl overflow-hidden bg-white shadow-md inline-block max-w-full"
            style={{ 
              transform: `rotate(${imageRotation}deg)`,
              transformOrigin: 'center',
              transition: 'transform 0.3s ease-in-out'
            }}
          >
            <img 
              src={getFullMediaUrl(imageUrl)} 
              alt="Listen and Colour" 
              className="max-h-[500px] w-auto object-contain select-none"
            />
            
            {/* Vẽ các điểm neo (Hotspots) trên ảnh */}
            {itemsWithHotspot.map((item: any) => {
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
                    onClick={() => handleHotspotClick(originalIndex)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleHotspotDrop(e, originalIndex)}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full border-2 shadow-md transition-all select-none w-8 h-8 ${
                      interactiveMode && !isExample
                        ? 'cursor-pointer hover:scale-125 hover:shadow-lg active:scale-95'
                        : 'pointer-events-none'
                    } ${
                      currentAnswer
                        ? 'border-white'
                        : isExample
                        ? 'border-amber-400 bg-amber-100'
                        : 'border-slate-400 bg-slate-100/90'
                    }`}
                    style={{
                      left: `${item.hotspot.x}%`,
                      top: `${item.hotspot.y}%`,
                      backgroundColor: !isWrite && hexColor ? hexColor : undefined,
                    }}
                    title={isExample ? 'Ví dụ mẫu' : `Chủ thể #${originalIndex + 1}`}
                  >
                    {isWrite && currentAnswer ? (
                      <span className="text-[10px] font-extrabold text-blue-700 truncate max-w-full px-0.5">
                        {currentAnswer}
                      </span>
                    ) : isWrite ? (
                      <Edit2 className="w-3.5 h-3.5 text-slate-500" />
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

                    {/* Nút xóa lựa chọn nhanh ở góc trên bên phải điểm neo */}
                    {currentAnswer && interactiveMode && !isExample && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const updatedAnswers = { ...userAnswer };
                          delete updatedAnswers[originalIndex];
                          onAnswerChange?.(updatedAnswers);
                        }}
                        className="absolute -top-2.5 -right-2.5 bg-red-500 hover:bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] border border-white shadow-sm cursor-pointer"
                        title="Xóa lựa chọn"
                      >
                        ✕
                      </button>
                    )}

                    {/* Hiển thị check đúng/sai khi xem kết quả */}
                    {!interactiveMode && !isExample && (
                      <div className="absolute -top-3 -right-3 bg-white rounded-full shadow-sm">
                        {currentAnswer === (item.colour || item.writeText || item.write_text) ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-white" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500 fill-white" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Danh sách các nhãn kéo thả (Draggable Badges) */}
      {interactiveMode && draggableBadges.length > 0 && (
        <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Palette className="w-5 h-5 text-orange-500" />
            <span>🎨 Danh sách nhãn kéo thả (Kéo nhãn thả vào vòng tròn trên ảnh):</span>
          </div>
          
          <div className="flex flex-wrap gap-2.5">
            {draggableBadges.map((badge) => {
              const isSelected = selectedBadge?.id === badge.id;
              const colorHex = badge.type === 'color' ? colours.find(c => c.value === badge.value)?.hex : null;

              return (
                <button
                  key={badge.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, badge)}
                  onClick={() => setSelectedBadge(isSelected ? null : badge)}
                  className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all cursor-grab active:cursor-grabbing ${
                    isSelected
                      ? 'border-orange-500 bg-orange-50 scale-105 shadow-sm ring-2 ring-orange-400'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                  title="Kéo thả nhãn này lên tranh hoặc click chọn rồi click vào điểm neo trên ảnh"
                >
                  {badge.type === 'color' ? (
                    <>
                      <span 
                        className="w-4 h-4 rounded-full border border-black/10 inline-block shadow-sm"
                        style={{ backgroundColor: colorHex || undefined }}
                      />
                      <span className="text-slate-700">{badge.label}</span>
                    </>
                  ) : (
                    <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-mono">
                      📝 {badge.value}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {selectedBadge && (
            <p className="text-xs text-orange-600 bg-orange-50/50 border border-orange-200 rounded-lg p-2 animate-pulse inline-block">
              👉 Đang chọn nhãn: <strong>{selectedBadge.label}</strong>. Hãy click vào vị trí vòng tròn trên bức tranh để gán!
            </p>
          )}
        </div>
      )}
      
      {/* Review mode: Hiển thị đáp án chi tiết - KIDS FRIENDLY 🎨 */}
      {!interactiveMode && itemsWithHotspot.length > 0 && (
        <div className="p-6 bg-gradient-to-br from-yellow-50 via-orange-50 to-pink-50 rounded-3xl border-4 border-yellow-400 space-y-4 shadow-lg">
          <div className="flex items-center gap-3 text-2xl font-black text-orange-600">
            <span className="text-4xl">📊</span>
            <span>Xem kết quả của bạn!</span>
          </div>
          
          <div className="space-y-3">
            {itemsWithHotspot.map((item: any) => {
              const originalIndex = items.findIndex((x: any) => x.id === item.id);
              const isExample = item.isExample || item.is_example;
              if (isExample) return null; // Bỏ qua câu ví dụ
              
              const correctAnswer = item.colour || item.writeText || item.write_text || '';
              const studentAnswer = userAnswer?.[originalIndex] || '';
              const isCorrect = correctAnswer === studentAnswer;
              
              const correctColorMeta = colours.find(c => c.value === correctAnswer);
              const studentColorMeta = colours.find(c => c.value === studentAnswer);
              
              return (
                <div 
                  key={item.id} 
                  className={`p-5 rounded-2xl border-4 shadow-md transition-all ${
                    isCorrect 
                      ? 'bg-gradient-to-r from-green-100 to-emerald-100 border-green-400' 
                      : 'bg-gradient-to-r from-red-100 to-pink-100 border-red-400'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Big emoji feedback */}
                    <div className="text-6xl flex-shrink-0">
                      {isCorrect ? '🎉' : '😅'}
                    </div>
                    
                    <div className="flex-1 space-y-3">
                      {/* Question title */}
                      <p className="font-black text-xl text-slate-800">
                        Câu #{originalIndex + 1}: {item.objectName || item.object || '(chưa đặt tên)'}
                      </p>
                      
                      {/* Correct answer */}
                      <div className="flex items-center gap-3 p-3 bg-white rounded-xl border-2 border-green-300">
                        <span className="text-xl">✅</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-green-700">Đáp án đúng:</span>
                          {correctColorMeta ? (
                            <div className="flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-full border-2 border-green-300">
                              <span 
                                className="w-6 h-6 rounded-full border-2 border-white shadow-sm inline-block"
                                style={{ backgroundColor: correctColorMeta.hex }}
                              />
                              <span className="font-black text-base text-green-800">{correctColorMeta.label}</span>
                            </div>
                          ) : (
                            <span className="font-black text-base text-green-800 font-mono bg-green-50 px-3 py-1.5 rounded-full border-2 border-green-300">
                              📝 {correctAnswer}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Student answer */}
                      <div className={`flex items-center gap-3 p-3 rounded-xl border-2 ${
                        isCorrect 
                          ? 'bg-white border-green-300' 
                          : 'bg-white border-red-300'
                      }`}>
                        <span className="text-xl">{isCorrect ? '😊' : '❌'}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-700">Bạn chọn:</span>
                          {studentAnswer ? (
                            studentColorMeta ? (
                              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border-2 ${
                                isCorrect 
                                  ? 'bg-green-50 border-green-300' 
                                  : 'bg-red-50 border-red-300'
                              }`}>
                                <span 
                                  className="w-6 h-6 rounded-full border-2 border-white shadow-sm inline-block"
                                  style={{ backgroundColor: studentColorMeta.hex }}
                                />
                                <span className={`font-black text-base ${
                                  isCorrect ? 'text-green-800' : 'text-red-800'
                                }`}>
                                  {studentColorMeta.label}
                                </span>
                              </div>
                            ) : (
                              <span className={`font-black text-base font-mono px-3 py-1.5 rounded-full border-2 ${
                                isCorrect 
                                  ? 'bg-green-50 border-green-300 text-green-800' 
                                  : 'bg-red-50 border-red-300 text-red-800'
                              }`}>
                                📝 {studentAnswer}
                              </span>
                            )
                          ) : (
                            <span className="text-gray-500 italic text-sm bg-gray-100 px-3 py-1.5 rounded-full border-2 border-gray-300">
                              Chưa trả lời 😢
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Encouragement message */}
                      {isCorrect ? (
                        <p className="text-base font-bold text-green-700 bg-green-50 px-4 py-2 rounded-xl border-2 border-green-300 text-center">
                          Tuyệt vời! Bạn làm đúng rồi! 🌟
                        </p>
                      ) : (
                        <p className="text-base font-bold text-orange-700 bg-orange-50 px-4 py-2 rounded-xl border-2 border-orange-300 text-center">
                          Lần sau cẩn thận hơn nhé! Bạn làm được mà! 💪
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Overall encouragement */}
          <div className="text-center p-4 bg-gradient-to-r from-purple-100 to-pink-100 rounded-2xl border-4 border-purple-400">
            <p className="text-xl font-black text-purple-700">
              Bạn đã cố gắng rất tốt! Tiếp tục phát huy nhé! 🚀✨
            </p>
          </div>
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
