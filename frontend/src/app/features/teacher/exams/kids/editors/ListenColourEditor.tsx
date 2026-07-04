import React, { useState, useEffect } from 'react';
import { Upload, Trash2, Save, X, Volume2, Image as ImageIcon } from 'lucide-react';
import { uploadKidsMedia } from '../../../../../../services/kidsExamApi';
import { useToastContext } from '../../../../../../contexts/ToastContext';
import { getFullMediaUrl } from '../../../../../../utils/mediaUtils';

interface ListenColourEditorProps {
  onSave: (data: any) => void;
  onCancel: () => void;
  initialData?: any;
  examId: string | null;
  questionId: string | null;
}

interface ColourInstruction {
  id: string;
  objectName: string;
  colour: string;
  position: string;
  writeText?: string; // NEW: Optional text to write (Movers/Flyers Part 5)
  isExample: boolean;
  hotspot?: { x: number; y: number };
}

const ListenColourEditor: React.FC<ListenColourEditorProps> = ({
  onSave,
  onCancel,
  initialData,
  examId,
  questionId,
}) => {
  const toast = useToastContext();
  
  // DEBUG: Log initialData khi component mount
  console.log('🔍 ListenColourEditor initialData:', initialData);
  
  const [title, setTitle] = useState('');
  const [mainAudioUrl, setMainAudioUrl] = useState('');
  const [mainImageUrl, setMainImageUrl] = useState('');
  const [instructions, setInstructions] = useState<ColourInstruction[]>([]);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedInstForHotspot, setSelectedInstForHotspot] = useState<number | null>(null);
  const [imageRotation, setImageRotation] = useState<number>(0);

  // Load initial data
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setMainAudioUrl(initialData.config?.mainAudioUrl || '');
      setMainImageUrl(initialData.config?.mainImageUrl || '');
      setImageRotation(initialData.config?.imageRotation || 0);
      
      // Map instructions with writeText support and ensure all fields are loaded correctly
      const mappedInstructions = (initialData.config?.instructions || []).map((inst: any, index: number) => ({
        id: inst.id || `inst-${index + 1}`, // Ensure ID exists
        objectName: inst.objectName || inst.object_name || '',
        colour: inst.colour || '',
        position: inst.position || '',
        writeText: inst.writeText || inst.write_text || '',
        isExample: inst.isExample || inst.is_example || false,
        hotspot: inst.hotspot || null
      }));
      setInstructions(mappedInstructions);
      
      console.log('📦 Loaded instructions from DB:', mappedInstructions);
    }
  }, [initialData]);

  // Handle paste for main image
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          e.preventDefault();
          const blob = items[i].getAsFile();
          if (blob) {
            await uploadMainImageFromBlob(blob);
          }
          break;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [examId]);

  const uploadMainImageFromBlob = async (blob: Blob) => {
    if (!examId) {
      toast.error('Vui lòng tạo đề thi trước!');
      return;
    }

    setUploadingImage(true);
    try {
      const file = new File([blob], 'pasted-image.png', { type: 'image/png' });
      const response = await uploadKidsMedia(file, 'image', examId, null);
      
      const imageUrl = response.media?.url || response.url;
      if (imageUrl) {
        setMainImageUrl(imageUrl);
        toast.success('✅ Đã tải ảnh lên!');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('❌ Không thể tải ảnh lên!');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleMainAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !examId) return;

    setUploadingAudio(true);
    try {
      const response = await uploadKidsMedia(file, 'audio', examId, null);
      const audioUrl = response.media?.url || response.url;
      
      if (audioUrl) {
        setMainAudioUrl(audioUrl);
        toast.success('✅ Đã tải audio lên!');
      } else {
        throw new Error('No URL in response');
      }
    } catch (error) {
      console.error('❌ Audio upload error:', error);
      toast.error('❌ Không thể tải audio lên!');
    } finally {
      setUploadingAudio(false);
    }
  };

  const handleMainImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !examId) return;

    setUploadingImage(true);
    try {
      const response = await uploadKidsMedia(file, 'image', examId, null);
      const imageUrl = response.media?.url || response.url;
      
      if (imageUrl) {
        setMainImageUrl(imageUrl);
        toast.success('✅ Đã tải ảnh lên!');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('❌ Không thể tải ảnh lên!');
    } finally {
      setUploadingImage(false);
    }
  };

  const addInstruction = () => {
    const newInstruction: ColourInstruction = {
      id: Date.now().toString(),
      objectName: '',
      colour: '',
      position: '',
      writeText: '', // NEW: Optional write text
      isExample: false,
    };
    setInstructions([...instructions, newInstruction]);
  };

  const addDistractor = () => {
    const newId = Date.now().toString();
    const newInstruction: ColourInstruction = {
      id: newId,
      objectName: 'vật thể nhiễu',
      colour: '',
      position: '',
      writeText: '',
      isExample: false,
    };
    const updated = [...instructions, newInstruction];
    setInstructions(updated);
    
    // Kích hoạt ngay chế độ click gán vị trí trên ảnh cho vật thể nhiễu mới tạo này
    setSelectedInstForHotspot(updated.length - 1);
    toast.info('👉 Hãy click lên vị trí vật thể nhiễu trên bức tranh để gán!');
  };

  const updateInstruction = (id: string, field: keyof ColourInstruction, value: any) => {
    setInstructions(instructions.map(inst => 
      inst.id === id ? { ...inst, [field]: value } : inst
    ));
  };

  const deleteInstruction = (id: string) => {
    setInstructions(instructions.filter(inst => inst.id !== id));
  };

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (selectedInstForHotspot === null) return;
    
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();
    
    const clickX = (e.clientX - rect.left) / rect.width;
    const clickY = (e.clientY - rect.top) / rect.height;
    
    let x = clickX;
    let y = clickY;
    
    if (imageRotation === 90) {
      x = clickY;
      y = 1 - clickX;
    } else if (imageRotation === 180) {
      x = 1 - clickX;
      y = 1 - clickY;
    } else if (imageRotation === 270) {
      x = 1 - clickY;
      y = clickX;
    }
    
    const pctX = x * 100;
    const pctY = y * 100;
    
    // Update instruction at selected index with hotspot
    setInstructions(instructions.map((inst, index) => 
      index === selectedInstForHotspot 
        ? { ...inst, hotspot: { x: pctX, y: pctY } }
        : inst
    ));
    
    setSelectedInstForHotspot(null);
    toast.success('✅ Đã gán vị trí vật thể trên ảnh!');
  };

  const handleSave = () => {
    if (!title.trim()) {
      toast.warning('⚠️ Vui lòng nhập tiêu đề!');
      return;
    }

    // Collect all colour/writeText values from instructions (for draggable badges)
    const allColours = new Set<string>();
    const allTexts = new Set<string>();
    
    instructions.forEach(inst => {
      if (inst.colour) allColours.add(inst.colour);
      if (inst.writeText) allTexts.add(inst.writeText);
    });

    const questionData = {
      type: 'listen_colour_write',
      title,
      points: 5,
      config: {
        mainAudioUrl,
        mainImageUrl,
        imageRotation,
        instructions: instructions.map(inst => ({
          id: inst.id,
          objectName: inst.objectName,
          colour: inst.colour,
          position: inst.position,
          write_text: inst.writeText || null,
          isExample: inst.isExample,
          hotspot: inst.hotspot || null
        })),
        // Add distractor support: collect all unique colours and texts for badge display
        allLabels: {
          colours: Array.from(allColours),
          texts: Array.from(allTexts)
        }
      },
    };

    console.log('💾 Saving question:', questionData);
    toast.success('✅ Đã lưu câu hỏi thành công!');
    onSave(questionData);
  };

  const colours = [
    { value: 'red', label: '🔴 Đỏ', color: '#ef4444' },
    { value: 'blue', label: '🔵 Xanh dương', color: '#3b82f6' },
    { value: 'light_blue', label: '🩵 Xanh da trời (Light blue)', color: '#38bdf8' },
    { value: 'dark_blue', label: '💙 Xanh dương đậm (Dark blue)', color: '#1d4ed8' },
    { value: 'green', label: '🟢 Xanh lá', color: '#22c55e' },
    { value: 'light_green', label: '🥬 Xanh lá nhạt (Light green)', color: '#4ade80' },
    { value: 'yellow', label: '🟡 Vàng', color: '#eab308' },
    { value: 'orange', label: '🟠 Cam', color: '#f97316' },
    { value: 'purple', label: '🟣 Tím', color: '#a855f7' },
    { value: 'pink', label: '🩷 Hồng', color: '#ec4899' },
    { value: 'brown', label: '🟤 Nâu', color: '#92400e' },
    { value: 'black', label: '⚫ Đen', color: '#000000' },
    { value: 'white', label: '⚪ Trắng', color: '#ffffff' },
    { value: 'grey', label: '🩶 Xám', color: '#6b7280' },
  ];

  return (
    <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-slate-200 pb-4">
        <span className="text-2xl">🎨</span>
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Nghe và tô màu
          </h3>
          <p className="text-sm text-slate-500">
            Học viên nghe audio, tô màu theo hướng dẫn, và upload ảnh đã tô
          </p>
        </div>
      </div>

      {/* Question Title */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          Tiêu đề câu hỏi / Hướng dẫn
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="VD: Nghe và tô màu các đồ vật trong tranh"
          className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
        />
        <p className="mt-1 text-xs text-slate-500">
          Hướng dẫn chung cho học viên về cách làm bài
        </p>
      </div>

      {/* Main Audio Upload */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          🎧 Audio hướng dẫn chính
        </label>
        
        {!mainAudioUrl ? (
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 transition-colors hover:border-orange-400 hover:bg-orange-50/40">
            <Volume2 className="mb-2 h-10 w-10 text-slate-400" />
            <span className="mb-1 text-sm font-medium text-slate-700">
              {uploadingAudio ? 'Đang tải lên...' : 'Nhấn để tải audio lên'}
            </span>
            <span className="text-xs text-slate-500">MP3, WAV, M4A (tối đa 20MB)</span>
            <input
              type="file"
              accept="audio/*"
              onChange={handleMainAudioUpload}
              className="hidden"
              disabled={uploadingAudio}
            />
          </label>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <audio controls src={getFullMediaUrl(mainAudioUrl)} className="flex-1">
                Trình duyệt không hỗ trợ audio
              </audio>
              <button
                onClick={() => setMainAudioUrl('')}
                className="ml-4 rounded-lg bg-red-500 p-2 text-white transition-colors hover:bg-red-600"
                title="Xóa audio"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Image Upload */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          🖼️ Tranh cần tô màu (Ctrl+V để paste)
        </label>
        
        {!mainImageUrl ? (
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 transition-colors hover:border-orange-400 hover:bg-orange-50/40">
            <ImageIcon className="mb-2 h-10 w-10 text-slate-400" />
            <span className="mb-1 text-sm font-medium text-slate-700">
              {uploadingImage ? 'Đang tải lên...' : 'Nhấn để tải ảnh hoặc Ctrl+V'}
            </span>
            <span className="text-xs text-slate-500">PNG, JPG, WEBP (tối đa 20MB)</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleMainImageUpload}
              className="hidden"
              disabled={uploadingImage}
            />
          </label>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-4">
              <div 
                className="relative border border-slate-300 rounded-lg overflow-hidden bg-white shadow-sm inline-block"
                style={{ 
                  transform: `rotate(${imageRotation}deg)`, 
                  transformOrigin: 'center',
                  transition: 'transform 0.3s ease-in-out'
                }}
              >
                <img
                  src={getFullMediaUrl(mainImageUrl)}
                  alt="Main"
                  onClick={handleImageClick}
                  className={`max-h-[500px] w-auto object-contain select-none ${
                    selectedInstForHotspot !== null ? 'cursor-crosshair ring-4 ring-orange-500' : ''
                  }`}
                />
                
                {/* Render các điểm neo đã vẽ */}
                {instructions.map((inst, index) => {
                  if (!inst.hotspot) return null;
                  const colorMeta = colours.find(c => c.value === inst.colour);
                  const hex = colorMeta?.color || '#3b82f6';
                  return (
                    <div
                      key={inst.id}
                      className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full border-2 border-white shadow-md font-bold text-xs pointer-events-none select-none transition-all"
                      style={{
                        left: `${inst.hotspot.x}%`,
                        top: `${inst.hotspot.y}%`,
                        backgroundColor: hex,
                        color: inst.colour === 'white' || inst.colour === 'yellow' || inst.colour === 'grey' ? '#1e293b' : '#ffffff',
                        width: '28px',
                        height: '28px',
                      }}
                      title={`${index + 1}. ${inst.objectName || '(chưa đặt tên)'}`}
                    >
                      {index + 1}
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setMainImageUrl('')}
                  className="rounded-lg bg-red-500 p-2 text-white transition-colors hover:bg-red-600 self-start"
                  title="Xóa ảnh"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setImageRotation((prev) => (prev + 90) % 360)}
                  disabled={instructions.some(inst => inst.hotspot)}
                  className={`rounded-lg p-2 transition-colors border flex items-center gap-1.5 text-xs font-bold self-start ${
                    instructions.some(inst => inst.hotspot)
                      ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-white border-orange-200 text-orange-700 hover:bg-orange-50 cursor-pointer'
                  }`}
                  title={instructions.some(inst => inst.hotspot) ? 'Không thể xoay khi đã gán vị trí vật thể' : 'Xoay hình 90°'}
                >
                  <span>🔄</span>
                  <span>Xoay hình 90°</span>
                </button>
                {selectedInstForHotspot !== null && (
                  <div className="max-w-[200px] text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded p-2 animate-bounce">
                    👉 Click lên vị trí vật thể trong tranh để gán vị trí cho câu #{selectedInstForHotspot + 1}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Colouring Instructions */}
      <div>
        {/* Sticky header with add button */}
        <div className="sticky top-0 z-40 -mx-6 mb-4 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <h4 className="text-sm font-semibold text-slate-900">
            🎨 Danh sách hướng dẫn tô màu
          </h4>
          <div className="flex items-center gap-2">
            <button
              onClick={addInstruction}
              className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 cursor-pointer"
            >
              <Upload className="h-4 w-4" />
              <span>Thêm hướng dẫn</span>
            </button>
            <button
              type="button"
              onClick={addDistractor}
              className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 cursor-pointer"
              title="Thêm vật thể nhiễu không có màu/từ viết đúng để đánh lạc hướng học viên"
            >
              <span>➕ ⚠️</span>
              <span>Thêm vật thể nhiễu</span>
            </button>
          </div>
        </div>

        {/* Preview của các label sẽ hiển thị cho học viên */}
        {instructions.length > 0 && (() => {
          const allColours = [...new Set(instructions.map(i => i.colour).filter(Boolean))];
          const allTexts = [...new Set(instructions.map(i => i.writeText).filter(Boolean))];
          const totalLabels = allColours.length + allTexts.length;
          
          if (totalLabels > 0) {
            return (
              <div className="mb-4 rounded-lg border-2 border-blue-200 bg-blue-50/50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-sm font-bold text-blue-800">
                    🏷️ Preview Labels (Học viên sẽ thấy {totalLabels} labels này)
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {allColours.map((colour, idx) => {
                    const colorMeta = colours.find(c => c.value === colour);
                    if (!colorMeta) {
                      // Fallback nếu không tìm thấy metadata - hiển thị cảnh báo
                      return (
                        <div
                          key={`colour-${idx}`}
                          className="flex items-center gap-2 rounded-xl border-2 border-orange-300 bg-orange-50 px-3 py-2"
                        >
                          <span className="w-4 h-4 rounded-full border border-black/20 inline-block bg-gray-400" />
                          <span className="text-xs font-bold text-orange-700">
                            ⚠️ {colour} (chưa định nghĩa)
                          </span>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={`colour-${idx}`}
                        className="flex items-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-3 py-2"
                      >
                        <span 
                          className="w-4 h-4 rounded-full border border-black/10 inline-block shadow-sm"
                          style={{ backgroundColor: colorMeta.color }}
                        />
                        <span className="text-xs font-bold text-slate-700">
                          {colorMeta.label}
                        </span>
                      </div>
                    );
                  })}
                  {allTexts.map((text, idx) => (
                    <div
                      key={`text-${idx}`}
                      className="flex items-center gap-2 rounded-xl border-2 border-blue-300 bg-blue-100 px-3 py-2"
                    >
                      <span className="text-xs font-bold text-blue-700 font-mono">
                        📝 {text}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-blue-600">
                  💡 Bao gồm cả labels từ vật thể nhiễu (nếu có). Học viên có thể kéo bất kỳ label nào vào bất kỳ hotspot nào.
                </p>
              </div>
            );
          }
          return null;
        })()}

        {instructions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <div className="mb-3 text-4xl">🎨</div>
            <p className="text-sm text-slate-500">Chưa có hướng dẫn nào. Nhấn "Thêm hướng dẫn" hoặc "Thêm vật thể nhiễu" để bắt đầu!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {instructions.map((inst, index) => (
              <div
                key={inst.id}
                className={`rounded-xl border p-4 transition-all ${
                  inst.isExample
                    ? 'border-amber-300 bg-amber-50'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-sm font-semibold text-white">
                      {index + 1}
                    </span>
                    {inst.isExample && (
                      <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white">
                        📌 Câu ví dụ
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-3">
                    {mainImageUrl && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedInstForHotspot(index)}
                          className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                            selectedInstForHotspot === index
                              ? 'bg-orange-500 text-white border-orange-600 animate-pulse'
                              : inst.hotspot
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span>📍</span>
                          <span>
                            {selectedInstForHotspot === index
                              ? 'Click lên ảnh...'
                              : inst.hotspot
                              ? 'Đã gán vị trí (Sửa)'
                              : 'Gán vị trí trên ảnh'}
                          </span>
                        </button>
                        {inst.hotspot && (
                          <button
                            type="button"
                            onClick={() => updateInstruction(inst.id, 'hotspot', null)}
                            className="text-xs text-red-500 hover:text-red-700 underline"
                          >
                            Xóa
                          </button>
                        )}
                      </div>
                    )}
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={inst.isExample}
                        onChange={(e) => updateInstruction(inst.id, 'isExample', e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                      />
                      <span className="text-sm font-medium text-slate-700">Đánh dấu là ví dụ</span>
                    </label>
                    <button
                      onClick={() => deleteInstruction(inst.id)}
                      className="rounded-lg bg-red-500 p-2 text-white transition-colors hover:bg-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {/* Object Name */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Đồ vật cần tô
                    </label>
                    <input
                      type="text"
                      value={inst.objectName}
                      onChange={(e) => updateInstruction(inst.id, 'objectName', e.target.value)}
                      placeholder="VD: quả táo"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                    />
                  </div>

                  {/* Colour */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Màu sắc
                    </label>
                    <select
                      value={inst.colour}
                      onChange={(e) => updateInstruction(inst.id, 'colour', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                    >
                      <option value="">Chọn màu...</option>
                      {colours.map(c => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Position */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Vị trí (Tùy chọn)
                    </label>
                    <input
                      type="text"
                      value={inst.position}
                      onChange={(e) => updateInstruction(inst.id, 'position', e.target.value)}
                      placeholder="VD: trên bàn (không bắt buộc)"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                    />
                  </div>

                  {/* Write Text (Optional - Movers/Flyers Part 5) */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      ✍️ Từ cần viết (Tùy chọn - Movers/Flyers Part 5)
                    </label>
                    <input
                      type="text"
                      value={inst.writeText || ''}
                      onChange={(e) => updateInstruction(inst.id, 'writeText', e.target.value)}
                      placeholder="VD: fast (nếu yêu cầu viết thêm 1 từ)"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Movers/Flyers Part 5: Vừa tô màu VỪA viết 1 từ. Để trống nếu chỉ tô màu (Starters Part 4)
                    </p>
                  </div>
                </div>

                 {/* Preview / Warning block */}
                 {inst.objectName && (
                   <div className="mt-3 rounded-lg border p-3 bg-white">
                     {inst.colour ? (
                       <p className="text-sm text-slate-700">
                         <span className="font-semibold">Hướng dẫn:</span> Tô màu{' '}
                         <span className="font-semibold" style={{ color: colours.find(c => c.value === inst.colour)?.color }}>
                           {colours.find(c => c.value === inst.colour)?.label}
                         </span>
                         {' '}cho <span className="font-semibold">{inst.objectName}</span>
                         {inst.position && <span> {inst.position}</span>}
                         {inst.writeText && (
                           <> và viết chữ <span className="font-mono font-bold text-blue-700">"{inst.writeText}"</span></>
                         )}
                       </p>
                     ) : inst.writeText ? (
                       <p className="text-sm text-slate-700">
                         <span className="font-semibold">Hướng dẫn:</span> Viết chữ <span className="font-mono font-bold text-blue-700">"{inst.writeText}"</span> cho <span className="font-semibold">{inst.objectName}</span>
                         {inst.position && <span> {inst.position}</span>}
                       </p>
                     ) : (
                       <p className="text-sm text-amber-700 bg-amber-50/50 p-1.5 rounded border border-dashed border-amber-200 flex items-center gap-1.5">
                         <span>⚠️</span>
                         <span>
                           <strong>Vật thể nhiễu (Distractor):</strong> Đã được gán điểm neo trên hình nhưng không có màu sắc/từ viết đúng. 
                           Điểm neo này sẽ bỏ trống ở trang học viên.
                         </span>
                       </p>
                     )}
                   </div>
                 )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instructions for Students */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h4 className="mb-2 text-sm font-semibold text-slate-900">
          💡 Hướng dẫn cho học viên
        </h4>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>Nghe audio hướng dẫn</li>
          <li>Tô màu vào tranh theo đúng hướng dẫn</li>
          <li>Chụp ảnh hoặc scan tranh đã tô</li>
          <li>Upload ảnh lên hệ thống để nộp bài</li>
        </ol>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
        <button
          onClick={onCancel}
          className="flex items-center gap-2 rounded-lg border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          <X className="h-4 w-4" />
          <span>Hủy</span>
        </button>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600"
        >
          <Save className="h-4 w-4" />
          <span>Lưu câu hỏi</span>
        </button>
      </div>
    </div>
  );
};

export default ListenColourEditor;
