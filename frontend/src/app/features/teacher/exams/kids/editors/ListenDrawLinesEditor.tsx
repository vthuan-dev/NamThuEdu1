import React, { useState, useEffect } from 'react';
import { Upload, Image as ImageIcon, Plus, Trash2, Volume2, X } from 'lucide-react';
import { uploadKidsMedia, getExamMedia } from '../../../../../../services/kidsExamApi';
import { getFullMediaUrl } from '../../../../../../utils/mediaUtils';
import { useToastContext } from '../../../../../../contexts/ToastContext';

interface ListenDrawLinesEditorProps {
  onSave: (questionData: any) => void;
  onCancel: () => void;
  initialData?: any;
  examId?: string | null;
  questionId?: string | number | null;
}

interface MatchItem {
  name: string;
  targetId?: string;
  targetLabel?: string;
  hotspot?: { x: number; y: number }; // Hotspot position on image (percentage)
  labelPosition?: { x: number; y: number }; // Draggable label position around image (percentage)
  isExample?: boolean; // Mark as example question
}

type MatchingMode = 'drag-to-image' | 'drag-to-list';

const ListenDrawLinesEditor: React.FC<ListenDrawLinesEditorProps> = ({
  onSave,
  onCancel,
  initialData,
  examId,
  questionId,
}) => {
  const toast = useToastContext();
  const [matchingMode, setMatchingMode] = useState<MatchingMode>(
    initialData?.config?.matchingMode || 'drag-to-image'
  );
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [items, setItems] = useState<MatchItem[]>(
    initialData?.config?.items || [{ name: '' }]
  );
  const [points, setPoints] = useState(initialData?.points || 5);
  const [selectedItemForHotspot, setSelectedItemForHotspot] = useState<number | null>(null);
  const [draggedLabel, setDraggedLabel] = useState<number | null>(null);
  const [showLabelPositioning, setShowLabelPositioning] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(initialData?.config?.audioUrl || null);
  const [imageUrl, setImageUrl] = useState<string | null>(initialData?.config?.imageUrl || null);
  const [questionTitle, setQuestionTitle] = useState<string>(
    initialData?.title || 'Nghe và nối. Có một ví dụ.'
  );
  const imageRef = React.useRef<HTMLImageElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Load initial data
  useEffect(() => {
    if (initialData?.config) {
      setMatchingMode(initialData.config.matchingMode || 'drag-to-image');
      setItems(initialData.config.items || [{ name: '' }]);
      setPoints(initialData.points || 5);
      if (initialData.config.audioUrl) {
        setAudioUrl(initialData.config.audioUrl);
        setAudioPreview(initialData.config.audioUrl);
      }
      if (initialData.config.imageUrl) {
        setImageUrl(initialData.config.imageUrl);
        setImagePreview(initialData.config.imageUrl);
      }
    }
  }, [initialData]);

  // Load media from server when examId exists but no initialData
  useEffect(() => {
    if (examId && !initialData) {
      loadExamMedia();
    }
  }, [examId, initialData]);

  const loadExamMedia = async () => {
    if (!examId) return;
    
    try {
      const response = await getExamMedia(examId);
      const media = response.media || [];
      
      // Find latest audio and image
      const audioMedia = media.filter((m: any) => m.media_type === 'audio').pop();
      const imageMedia = media.filter((m: any) => m.media_type === 'image').pop();
      
      if (audioMedia) {
        // Ensure full URL using environment variable
        const fullUrl = getFullMediaUrl(audioMedia.file_url);
        if (fullUrl) {
          setAudioUrl(fullUrl);
          setAudioPreview(fullUrl);
        }
      }
      
      if (imageMedia) {
        // Ensure full URL using environment variable
        const fullUrl = getFullMediaUrl(imageMedia.file_url);
        if (fullUrl) {
          setImageUrl(fullUrl);
          setImagePreview(fullUrl);
        }
      }
    } catch (error) {
      console.error('❌ Failed to load exam media:', error);
    }
  };

  const handleAddItem = () => {
    setItems([...items, { name: '' }]);
  };

  const handlePasteImage = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob || !examId) {
          toast.error('Vui lòng chọn file ảnh!');
          return;
        }

        // Check file size (max 20MB)
        if (blob.size > 20 * 1024 * 1024) {
          toast.error('Ảnh quá lớn! Vui lòng chọn ảnh nhỏ hơn 20MB 😊');
          return;
        }

        // Create File object from blob
        const file = new File([blob], `pasted-image-${Date.now()}.png`, { type: blob.type });
        setImageFile(file);

        // Convert to base64 for preview
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          setImagePreview(base64);
        };
        reader.readAsDataURL(blob);

        // Upload to server if examId exists
        setIsUploadingImage(true);
        try {
          const response = await uploadKidsMedia(file, 'image', examId, questionId);
          
          const uploadedUrl = response.media?.url || response.url;
          if (uploadedUrl) {
            setImageUrl(uploadedUrl);
            toast.success('✅ Tải ảnh thành công! Nhớ bấm "Lưu" để lưu câu hỏi nhé! 💾');
          } else {
            throw new Error('No URL in response');
          }
        } catch (error: any) {
          console.error('❌ Failed to upload pasted image:', error);
          console.error('❌ Error details:', error.response?.data);
          toast.error(`Không thể tải ảnh lên: ${error.response?.data?.message || error.message}`);
        } finally {
          setIsUploadingImage(false);
        }

        break;
      }
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !examId) {
      toast.error('Vui lòng chọn file ảnh!');
      return;
    }

    // Check file size (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Ảnh quá lớn! Vui lòng chọn ảnh nhỏ hơn 20MB 😊');
      return;
    }

    setImageFile(file);
    // Convert to base64 for preview
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setImagePreview(base64);
    };
    reader.readAsDataURL(file);

    // Upload to server if examId exists
    setIsUploadingImage(true);
    try {
      const response = await uploadKidsMedia(file, 'image', examId, questionId);
      
      const uploadedUrl = response.media?.url || response.url;
      if (uploadedUrl) {
        setImageUrl(uploadedUrl);
        toast.success('✅ Tải ảnh thành công! Nhớ bấm "Lưu" để lưu câu hỏi nhé! 💾');
      } else {
        throw new Error('No URL in response');
      }
    } catch (error: any) {
      console.error('❌ Failed to upload image:', error);
      console.error('❌ Error details:', error.response?.data);
      toast.error(`Không thể tải ảnh lên: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !examId) {
      toast.error('Vui lòng chọn file audio!');
      return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File audio quá lớn! Vui lòng chọn file nhỏ hơn 10MB 😊');
      return;
    }

    setAudioFile(file);
    // Create URL for audio preview
    const audioUrl = URL.createObjectURL(file);
    setAudioPreview(audioUrl);

    // Upload to server if examId exists
    setIsUploadingAudio(true);
    try {
      // Don't send questionId if it's null or starts with 'q-' (temporary ID)
      const validQuestionId = questionId && !questionId.toString().startsWith('q-') ? questionId : null;
      
      const response = await uploadKidsMedia(file, 'audio', examId, validQuestionId);
      
      const uploadedUrl = response.media?.url || response.url;
      if (uploadedUrl) {
        setAudioUrl(uploadedUrl);
        toast.success('✅ Tải audio thành công! Nhớ bấm "Lưu" để lưu câu hỏi nhé! 💾');
      } else {
        throw new Error('No URL in response');
      }
    } catch (error: any) {
      console.error('❌ Failed to upload audio:', error);
      console.error('❌ Error details:', error.response?.data);
      toast.error(`Không thể tải audio lên: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsUploadingAudio(false);
    }
  };

  const handleRemoveAudio = () => {
    if (audioPreview) {
      URL.revokeObjectURL(audioPreview);
    }
    setAudioFile(null);
    setAudioPreview(null);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (
    index: number,
    field: 'name' | 'targetId' | 'targetLabel',
    value: string
  ) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (matchingMode !== 'drag-to-image' || selectedItemForHotspot === null) return;
    
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();
    
    // Calculate position as percentage
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    // Update item with hotspot
    const newItems = [...items];
    newItems[selectedItemForHotspot].hotspot = { x, y };
    
    // Auto-create label position if not exists (default position)
    if (!newItems[selectedItemForHotspot].labelPosition) {
      // Position labels around the edges based on index
      const positions = [
        { x: 10, y: 10 },   // Top-left
        { x: 90, y: 10 },   // Top-right
        { x: 10, y: 90 },   // Bottom-left
        { x: 90, y: 90 },   // Bottom-right
        { x: 50, y: 5 },    // Top-center
        { x: 50, y: 95 },   // Bottom-center
        { x: 5, y: 50 },    // Middle-left
        { x: 95, y: 50 },   // Middle-right
      ];
      const position = positions[selectedItemForHotspot % positions.length];
      newItems[selectedItemForHotspot].labelPosition = position;
    }
    
    setItems(newItems);
    setSelectedItemForHotspot(null);
  };

  const handleSelectItemForHotspot = (index: number) => {
    setSelectedItemForHotspot(index);
  };

  const handleRemoveHotspot = (index: number) => {
    const newItems = [...items];
    delete newItems[index].hotspot;
    delete newItems[index].labelPosition; // Also remove label position
    setItems(newItems);
  };

  const handleLabelDragStart = (index: number) => {
    setDraggedLabel(index);
  };

  const handleLabelDrag = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
  };

  const handleLabelDragEnd = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    
    // Calculate position as percentage relative to container
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    // Clamp to container bounds
    const clampedX = Math.max(0, Math.min(100, x));
    const clampedY = Math.max(0, Math.min(100, y));
    
    const newItems = [...items];
    newItems[index].labelPosition = { x: clampedX, y: clampedY };
    setItems(newItems);
    setDraggedLabel(null);
  };

  const handleAutoPositionLabels = () => {
    // Auto-position labels around the image
    const newItems = items.map((item, index) => {
      if (!item.hotspot) return item; // Only position if hotspot exists
      
      // Position labels in a grid around the image
      const positions = [
        { x: 10, y: 10 },   // Top-left
        { x: 90, y: 10 },   // Top-right
        { x: 10, y: 50 },   // Middle-left
        { x: 90, y: 50 },   // Middle-right
        { x: 10, y: 90 },   // Bottom-left
        { x: 90, y: 90 },   // Bottom-right
        { x: 50, y: 5 },    // Top-center
        { x: 50, y: 95 },   // Bottom-center
      ];
      
      const position = positions[index % positions.length];
      
      return {
        ...item,
        labelPosition: position
      };
    });
    setItems(newItems);
  };

  const handleSave = () => {
    const questionData = {
      type: 'listen_and_draw_lines', // Match database task_type_code
      title: questionTitle,
      points,
      config: {
        matchingMode,
        audioUrl: audioUrl || audioFile?.name,
        imageUrl: imageUrl || imageFile?.name,
        items,
      },
    };
    onSave(questionData);
  };

  const canSave = 
    (audioUrl || audioFile) && 
    (imageUrl || imageFile) && 
    items.every((item) => {
      if (matchingMode === 'drag-to-image') {
        // For drag-to-image, name, hotspot, and labelPosition are required
        return item.name.trim() !== '' && item.hotspot !== undefined && item.labelPosition !== undefined;
      } else {
        // For drag-to-list, both name and targetLabel are required
        return item.name.trim() !== '' && item.targetLabel && item.targetLabel.trim() !== '';
      }
    });

  return (
    <div className="min-h-[600px] rounded-xl border border-slate-200 bg-white p-6">
      <h3 className="mb-4 flex items-center text-base font-semibold text-slate-900">
        <Volume2 className="mr-2 h-5 w-5 text-orange-600" />
        Nghe và Nối
      </h3>

      {/* Instructions */}
      <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm text-slate-600">
          🎧 Học sinh sẽ nghe audio và nối tên với đúng người/vật trong tranh
        </p>
      </div>

      {/* Question Title */}
      <div className="mb-6">
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Tiêu đề câu hỏi / Hướng dẫn <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={questionTitle}
          onChange={(e) => setQuestionTitle(e.target.value)}
          placeholder="Ví dụ: Nghe và nối. Có một ví dụ."
          className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
        />
        <p className="mt-1 text-xs text-slate-500">
          Hướng dẫn này sẽ hiển thị cho học sinh biết phải làm gì
        </p>
      </div>

      {/* Matching Mode Selection */}
      <div className="mb-6">
        <label className="mb-3 block text-sm font-medium text-slate-700">
          Chọn kiểu nối đáp án <span className="text-red-500">*</span>
        </label>
        <div className="space-y-3">
          <label className={`flex cursor-pointer items-start space-x-3 rounded-lg border p-4 transition-all ${
            matchingMode === 'drag-to-image'
              ? 'border-orange-400 bg-orange-50 ring-1 ring-orange-400'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}>
            <input
              type="radio"
              name="matchingMode"
              value="drag-to-image"
              checked={matchingMode === 'drag-to-image'}
              onChange={(e) => setMatchingMode(e.target.value as MatchingMode)}
              className="mt-1 h-5 w-5 text-orange-600"
            />
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="text-xl">🖼️</span>
                <span className="font-semibold text-slate-800">Kéo thả vào ảnh</span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Học sinh kéo tên và thả vào vị trí trên ảnh (vị trí target sẽ được đánh dấu trên ảnh)
              </p>
              <p className="mt-1 text-xs text-slate-400">
                💡 Ví dụ: Kéo "Tom" vào người đang chơi tennis trên ảnh
              </p>
            </div>
          </label>

          <label className={`flex cursor-pointer items-start space-x-3 rounded-lg border p-4 transition-all ${
            matchingMode === 'drag-to-list'
              ? 'border-orange-400 bg-orange-50 ring-1 ring-orange-400'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}>
            <input
              type="radio"
              name="matchingMode"
              value="drag-to-list"
              checked={matchingMode === 'drag-to-list'}
              onChange={(e) => setMatchingMode(e.target.value as MatchingMode)}
              className="mt-1 h-5 w-5 text-orange-600"
            />
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="text-xl">📋</span>
                <span className="font-semibold text-slate-800">Kéo thả vào danh sách bên phải</span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Học sinh nối 2 cột: Tên (trái) ↔ Mô tả/Đặc điểm (phải)
              </p>
              <p className="mt-1 text-xs text-slate-400">
                💡 Ví dụ: Nối "Tom" với "Đang chơi tennis"
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Audio Upload with Player */}
      <div className="mb-6">
        <label className="mb-2 block text-sm font-medium text-slate-700">
          File Audio <span className="text-red-500">*</span>
        </label>
        
        {!audioPreview ? (
          <div className="flex items-center space-x-4">
            <label className="flex cursor-pointer items-center space-x-2 rounded-lg border border-dashed border-slate-300 px-6 py-3 transition-colors hover:border-orange-400 hover:bg-orange-50/40">
              <Upload className="h-5 w-5 text-slate-500" />
              <span className="text-slate-700">
                {isUploadingAudio ? 'Đang tải lên...' : 'Tải Audio Lên'}
              </span>
              <input
                type="file"
                accept="audio/mpeg,audio/mp3,audio/wav,audio/m4a,audio/mp4,audio/ogg"
                className="hidden"
                onChange={handleAudioUpload}
                disabled={isUploadingAudio}
              />
            </label>
            <span className="text-sm text-slate-500">MP3, WAV (max 10MB)</span>
            {isUploadingAudio && <span className="text-sm text-orange-600">⏳ Uploading...</span>}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center space-x-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <Volume2 className="h-6 w-6 text-orange-600" />
              <div className="flex-1">
                <p className="font-medium text-slate-800">{audioFile?.name}</p>
                <audio 
                  controls 
                  className="mt-2 w-full"
                  src={audioPreview}
                >
                  Your browser does not support the audio element.
                </audio>
              </div>
              <button
                type="button"
                onClick={handleRemoveAudio}
                className="rounded-full bg-red-500 p-2 text-white transition-colors hover:bg-red-600"
                title="Xóa audio"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Image Upload with Paste Support */}
      <div className="mb-6">
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Hình ảnh nền (Scene) <span className="text-red-500">*</span>
        </label>
        
        {!imagePreview ? (
          <div 
            className="flex items-center justify-center w-full"
            onPaste={handlePasteImage}
            tabIndex={0}
          >
            <label className="flex flex-col items-center justify-center w-full h-40 border border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-orange-50/40 hover:border-orange-400 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <ImageIcon className="w-10 h-10 mb-3 text-slate-400" />
                <p className="mb-2 text-sm text-slate-500">
                  <span className="font-semibold">Nhấn để tải lên</span> hoặc kéo thả
                </p>
                <p className="text-xs text-slate-400">PNG, JPG (tối đa 20MB)</p>
                <p className="text-xs text-orange-600 font-semibold mt-2">
                  💡 Hoặc Ctrl+V để dán ảnh từ clipboard
                </p>
              </div>
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleImageUpload}
              />
            </label>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Preview Toggle Button */}
            {matchingMode === 'drag-to-image' && items.some(item => item.hotspot && item.labelPosition) && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className={`flex items-center space-x-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    showPreview
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-orange-600 text-white hover:bg-orange-700'
                  }`}
                >
                  <span>{showPreview ? '✓ Đang xem đáp án' : '👁️ Xem đáp án đúng'}</span>
                </button>
              </div>
            )}
            
            <div 
              ref={containerRef}
              className="relative rounded-lg border border-slate-200 bg-slate-50 p-16"
              style={{ minHeight: '600px' }}
            >
              {/* Image wrapper */}
              <div className="relative inline-block">
                <img 
                  ref={imageRef}
                  src={imagePreview} 
                  alt="Base scene" 
                  className={`block ${matchingMode === 'drag-to-image' && selectedItemForHotspot !== null ? 'cursor-crosshair' : ''}`}
                  onClick={handleImageClick}
                />
                
                {/* Delete button inside image */}
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 hover:bg-red-600 transition-colors shadow-lg z-20"
                  title="Xóa ảnh"
                >
                  <X className="w-5 h-5" />
                </button>
            
                {/* Render hotspot markers - inside image */}
                {matchingMode === 'drag-to-image' && items.map((item, index) => 
                  item.hotspot && (
                    <div
                      key={`hotspot-${index}`}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                      style={{
                        left: `${item.hotspot.x}%`,
                        top: `${item.hotspot.y}%`,
                      }}
                    >
                      <div className="w-8 h-8 bg-red-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center animate-pulse">
                        <span className="text-white font-bold text-sm">{index + 1}</span>
                      </div>
                    </div>
                  )
                )}
                
                {/* Show instruction when selecting hotspot */}
                {matchingMode === 'drag-to-image' && selectedItemForHotspot !== null && (
                  <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-orange-600 text-white px-4 py-2 rounded-lg shadow-lg z-10">
                    👆 Click vào ảnh để đánh dấu vị trí cho "{items[selectedItemForHotspot]?.name}"
                  </div>
                )}
              </div>
              
              {/* Render draggable name labels - OUTSIDE image, in container */}
              {matchingMode === 'drag-to-image' && items.map((item, index) => 
                item.labelPosition && (
                  <div
                    key={`label-${index}`}
                    draggable
                    onDragStart={() => handleLabelDragStart(index)}
                    onDrag={(e) => handleLabelDrag(e, index)}
                    onDragEnd={(e) => handleLabelDragEnd(e, index)}
                    className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-move ${
                      draggedLabel === index ? 'opacity-50' : ''
                    }`}
                    style={{
                      left: `${item.labelPosition.x}%`,
                      top: `${item.labelPosition.y}%`,
                    }}
                  >
                    <div className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 shadow-md hover:shadow-lg transition-shadow">
                      <div className="flex items-center space-x-1.5">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-white font-bold text-xs">
                          {index + 1}
                        </span>
                        <span className="font-semibold text-slate-800 text-sm whitespace-nowrap">{item.name}</span>
                      </div>
                    </div>
                  </div>
                )
              )}
              
              {/* SVG Lines - Show correct answer connections when preview is enabled */}
              {showPreview && matchingMode === 'drag-to-image' && containerRef.current && imageRef.current && (
                <svg
                  className="absolute top-0 left-0 w-full h-full pointer-events-none"
                  style={{ zIndex: 5 }}
                >
                  <defs>
                    <marker
                      id="arrowhead"
                      markerWidth="10"
                      markerHeight="10"
                      refX="9"
                      refY="3"
                      orient="auto"
                    >
                      <polygon points="0 0, 10 3, 0 6" fill="#22c55e" />
                    </marker>
                  </defs>
                  {items.map((item, index) => {
                    if (!item.hotspot || !item.labelPosition) return null;
                    
                    const containerRect = containerRef.current?.getBoundingClientRect();
                    const imageRect = imageRef.current?.getBoundingClientRect();
                    if (!containerRect || !imageRect) return null;
                    
                    // Calculate label position relative to container
                    const labelX = (item.labelPosition.x / 100) * containerRect.width;
                    const labelY = (item.labelPosition.y / 100) * containerRect.height;
                    
                    // Calculate hotspot position relative to IMAGE, then offset by image position in container
                    const imageOffsetX = imageRect.left - containerRect.left;
                    const imageOffsetY = imageRect.top - containerRect.top;
                    const hotspotX = imageOffsetX + (item.hotspot.x / 100) * imageRect.width;
                    const hotspotY = imageOffsetY + (item.hotspot.y / 100) * imageRect.height;
                    
                    // Calculate midpoint for label
                    const midX = (labelX + hotspotX) / 2;
                    const midY = (labelY + hotspotY) / 2;
                    
                    return (
                      <g key={`line-${index}`}>
                        {/* Outer glow line */}
                        <line
                          x1={labelX}
                          y1={labelY}
                          x2={hotspotX}
                          y2={hotspotY}
                          stroke="#86efac"
                          strokeWidth="8"
                          opacity="0.4"
                        />
                        {/* Main line */}
                        <line
                          x1={labelX}
                          y1={labelY}
                          x2={hotspotX}
                          y2={hotspotY}
                          stroke="#22c55e"
                          strokeWidth="4"
                          markerEnd="url(#arrowhead)"
                        />
                        {/* Checkmark badge at midpoint */}
                        <circle
                          cx={midX}
                          cy={midY}
                          r="12"
                          fill="#22c55e"
                          stroke="white"
                          strokeWidth="2"
                        />
                        <text
                          x={midX}
                          y={midY}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="white"
                          fontSize="14"
                          fontWeight="bold"
                        >
                          ✓
                        </text>
                      </g>
                    );
                  })}
                </svg>
              )}
              
              {/* Image info card */}
              <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-orange-50">
                    <ImageIcon className="h-3.5 w-3.5 text-orange-600" />
                  </div>
                  <div className="flex min-w-0 items-baseline gap-1.5">
                    <span className="flex-shrink-0 text-[11px] font-medium text-slate-400">Hình ảnh nền</span>
                    <span className="truncate text-xs font-semibold text-slate-700" title={imageFile?.name}>
                      {imageFile?.name}
                    </span>
                  </div>
                </div>
                {imageRef.current && (
                  <span className="flex-shrink-0 text-[11px] font-semibold text-orange-600">
                    {imageRef.current.naturalWidth} × {imageRef.current.naturalHeight}px
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Items to Match */}
      <div className="mb-6">
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Danh sách câu hỏi cần nối <span className="text-red-500">*</span>
        </label>
        
        {matchingMode === 'drag-to-image' && (
          <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm text-slate-600">
              💡 <strong>Bước 1:</strong> Nhập tên → <strong>Bước 2:</strong> Click "📍 Đánh dấu" và click vào ảnh (tạo hotspot cố định) → <strong>Bước 3:</strong> Kéo thả tên xung quanh ảnh
            </p>
          </div>
        )}
        
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={index}
              className={`flex items-center space-x-3 rounded-lg border p-3 ${
                item.isExample 
                  ? 'border-amber-300 bg-amber-50' 
                  : 'border-slate-200 bg-white'
              }`}
            >
              <span className={`flex h-8 w-8 items-center justify-center rounded-full font-bold ${
                item.isExample
                  ? 'bg-amber-200 text-amber-700'
                  : 'bg-slate-100 text-slate-600'
              }`}>
                {item.isExample ? '📌' : index + 1}
              </span>
              <div className="flex-1 space-y-2">
                <div className="flex items-center space-x-3">
                  <input
                    type="text"
                    placeholder="Tên (ví dụ: Tom)"
                    value={item.name}
                    onChange={(e) =>
                      handleItemChange(index, 'name', e.target.value)
                    }
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                  />
                  
                  {matchingMode === 'drag-to-list' && (
                    <input
                      type="text"
                      placeholder="Mô tả đích (ví dụ: Đang chơi tennis)"
                      value={item.targetLabel || ''}
                      onChange={(e) =>
                        handleItemChange(index, 'targetLabel', e.target.value)
                      }
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                    />
                  )}
                </div>
                
                {/* Example checkbox */}
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.isExample || false}
                    onChange={(e) => {
                      const newItems = [...items];
                      newItems[index] = { ...newItems[index], isExample: e.target.checked };
                      setItems(newItems);
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-sm font-medium text-slate-600">
                    ✨ Đây là câu ví dụ (không tính điểm, hiển thị sẵn đáp án)
                  </span>
                </label>
              </div>
              
              {matchingMode === 'drag-to-image' && (
                <div className="flex items-center space-x-2">
                  {item.hotspot ? (
                    <>
                      <span className="text-sm text-green-600 font-medium flex items-center space-x-1">
                        <span>✓ Vị trí</span>
                      </span>
                      {item.labelPosition ? (
                        <span className="text-sm text-green-600 font-medium flex items-center space-x-1">
                          <span>✓ Label</span>
                        </span>
                      ) : (
                        <span className="text-sm text-orange-600 font-medium">
                          ⚠ Chưa bố trí label
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveHotspot(index)}
                        className="rounded border border-orange-300 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-600 transition-colors hover:bg-orange-100"
                      >
                        Đổi vị trí
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSelectItemForHotspot(index)}
                      disabled={!imagePreview}
                      className={`rounded px-3 py-2 text-sm font-medium transition-colors ${
                        selectedItemForHotspot === index
                          ? 'bg-orange-600 text-white'
                          : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                      } ${!imagePreview ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {selectedItemForHotspot === index ? '👆 Click vào ảnh' : '📍 Đánh dấu'}
                    </button>
                  )}
                </div>
              )}
              
              {items.length > 1 && (
                <button
                  onClick={() => handleRemoveItem(index)}
                  className="rounded p-2 text-red-500 transition-colors hover:bg-red-50"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={handleAddItem}
          className="mt-3 flex items-center space-x-2 text-orange-600 transition-colors hover:text-orange-700"
        >
          <Plus className="h-5 w-5" />
          <span>Thêm câu hỏi</span>
        </button>
      </div>

      {/* Points */}
      <div className="mb-6 -mt-2">
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Điểm cho câu hỏi này
        </label>
        <input
          type="number"
          value={points}
          onChange={(e) => setPoints(parseInt(e.target.value))}
          min="1"
          max="20"
          className="w-32 rounded-lg border border-slate-300 px-3 py-2 focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
        />
      </div>

      {/* Actions - Sticky at top when scrolling */}
      <div className="sticky top-0 z-50 -mx-6 -mt-6 mb-6 border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-6 py-2 text-slate-700 transition-colors hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            className="rounded-lg bg-orange-600 px-6 py-2 font-medium text-white transition-all hover:bg-orange-700"
          >
            💾 Lưu câu hỏi
          </button>
        </div>
      </div>
    </div>
  );
};

export default ListenDrawLinesEditor;
