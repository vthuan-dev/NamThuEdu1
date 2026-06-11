import React, { useState, useEffect } from 'react';
import { Trash2, Save, X, Image as ImageIcon, Plus } from 'lucide-react';
import { uploadKidsMedia } from '../../../../../../services/kidsExamApi';
import { useToastContext } from '../../../../../../contexts/ToastContext';
import { calculateQuestionPoints, getScorableItemsCount, getExampleItemsCount } from '../../../../../../utils/examUtils';

interface LookReadEditorProps {
  onSave: (data: any) => void;
  onCancel: () => void;
  initialData?: any;
  examId: string | null;
  questionId: string | null;
}

interface Statement {
  id: string;
  imageUrl: string;  // Mỗi câu có ảnh riêng
  statement: string;
  correctAnswer: 'tick' | 'cross';
  isExample: boolean;
}

const LookReadEditor: React.FC<LookReadEditorProps> = ({
  onSave,
  onCancel,
  initialData,
  examId,
  questionId,
}) => {
  const toast = useToastContext();
  const [title, setTitle] = useState('');
  const [answerFormat, setAnswerFormat] = useState<'tick_cross' | 'yes_no'>('tick_cross'); // Part 1 vs Part 2
  const [sharedImageUrl, setSharedImageUrl] = useState(''); // Hình ảnh chung cho tất cả câu
  const [statements, setStatements] = useState<Statement[]>([]);
  const [uploadingImages, setUploadingImages] = useState<{ [key: string]: boolean }>({});
  const [uploadingSharedImage, setUploadingSharedImage] = useState(false);
  const [focusedStatement, setFocusedStatement] = useState<string | null>(null);
  const [focusedSharedImage, setFocusedSharedImage] = useState(false);

  // Load initial data
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setAnswerFormat(initialData.config?.answerFormat || initialData.config?.answer_format || 'tick_cross');
      setSharedImageUrl(initialData.config?.sharedImageUrl || initialData.config?.shared_image_url || '');
      // Chuẩn hóa items: đảm bảo mỗi câu có id (tránh key trùng/undefined) + map field cũ.
      const rawItems: any[] = initialData.config?.items || [];
      setStatements(rawItems.map((it: any, idx: number) => ({
        id: it?.id ?? `stmt-${idx + 1}`,
        imageUrl: it?.imageUrl ?? it?.image_url ?? '',
        statement: it?.statement ?? it?.text ?? '',
        correctAnswer: (it?.correctAnswer ?? it?.correct_answer ?? 'tick') as 'tick' | 'cross',
        isExample: it?.isExample ?? it?.is_example ?? false,
      })));
    }
  }, [initialData]);

  // Handle paste for statement images
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items || !examId) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          e.preventDefault();
          const blob = items[i].getAsFile();
          if (blob) {
            // If focused on shared image area, upload to shared
            if (focusedSharedImage) {
              await uploadSharedImageFromBlob(blob);
            }
            // If focused on a statement, upload to that statement
            else if (focusedStatement) {
              await uploadStatementImageFromBlob(focusedStatement, blob);
            }
          }
          break;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [examId, focusedStatement, focusedSharedImage]);

  const uploadSharedImageFromBlob = async (blob: Blob) => {
    if (!examId) {
      toast.error('Vui lòng tạo đề thi trước!');
      return;
    }

    if (blob.size > 20 * 1024 * 1024) {
      toast.error('Ảnh quá lớn! Vui lòng chọn ảnh nhỏ hơn 20MB 😊');
      return;
    }

    const file = new File([blob], `pasted-shared-${Date.now()}.png`, { type: blob.type });

    setUploadingSharedImage(true);
    try {
      const response = await uploadKidsMedia(file, 'image', examId);
      const imageUrl = response.media?.url || response.url;
      if (imageUrl) {
        setSharedImageUrl(imageUrl);
        toast.success('✅ Paste ảnh chung thành công! 💾');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(`❌ Không thể tải ảnh lên: ${error.response?.data?.message || error.message}`);
    } finally {
      setUploadingSharedImage(false);
    }
  };

  const uploadStatementImageFromBlob = async (statementId: string, blob: Blob) => {
    if (!examId) {
      toast.error('Vui lòng tạo đề thi trước!');
      return;
    }

    if (blob.size > 20 * 1024 * 1024) {
      toast.error('Ảnh quá lớn! Vui lòng chọn ảnh nhỏ hơn 20MB 😊');
      return;
    }

    const file = new File([blob], `pasted-statement-${statementId}-${Date.now()}.png`, { type: blob.type });

    setUploadingImages(prev => ({ ...prev, [statementId]: true }));
    try {
      const response = await uploadKidsMedia(file, 'image', examId);
      const imageUrl = response.media?.url || response.url;
      if (imageUrl) {
        setStatements(statements.map(stmt => 
          stmt.id === statementId ? { ...stmt, imageUrl } : stmt
        ));
        toast.success('✅ Paste ảnh thành công! 💾');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(`❌ Không thể tải ảnh lên: ${error.response?.data?.message || error.message}`);
    } finally {
      setUploadingImages(prev => ({ ...prev, [statementId]: false }));
    }
  };

  const handleSharedImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !examId) {
      toast.error('Vui lòng chọn file ảnh!');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error('Ảnh quá lớn! Vui lòng chọn ảnh nhỏ hơn 20MB 😊');
      return;
    }

    setUploadingSharedImage(true);
    try {
      const response = await uploadKidsMedia(file, 'image', examId);
      const imageUrl = response.media?.url || response.url;
      if (imageUrl) {
        setSharedImageUrl(imageUrl);
        toast.success('✅ Tải ảnh chung thành công! 💾');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(`❌ Không thể tải ảnh lên: ${error.response?.data?.message || error.message}`);
    } finally {
      setUploadingSharedImage(false);
    }
  };

  const handleStatementImageUpload = async (statementId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !examId) {
      toast.error('Vui lòng chọn file ảnh!');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error('Ảnh quá lớn! Vui lòng chọn ảnh nhỏ hơn 20MB 😊');
      return;
    }

    setUploadingImages(prev => ({ ...prev, [statementId]: true }));
    try {
      const response = await uploadKidsMedia(file, 'image', examId);
      const imageUrl = response.media?.url || response.url;
      if (imageUrl) {
        setStatements(statements.map(stmt => 
          stmt.id === statementId ? { ...stmt, imageUrl } : stmt
        ));
        toast.success('✅ Tải ảnh thành công! 💾');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(`❌ Không thể tải ảnh lên: ${error.response?.data?.message || error.message}`);
    } finally {
      setUploadingImages(prev => ({ ...prev, [statementId]: false }));
    }
  };

  const addStatement = () => {
    const newStatement: Statement = {
      id: Date.now().toString(),
      imageUrl: '',
      statement: '',
      correctAnswer: 'tick',
      isExample: false,
    };
    setStatements([...statements, newStatement]);
  };

  const updateStatement = (id: string, field: keyof Statement, value: any) => {
    setStatements(statements.map(stmt => 
      stmt.id === id ? { ...stmt, [field]: value } : stmt
    ));
  };

  const deleteStatement = (id: string) => {
    setStatements(statements.filter(stmt => stmt.id !== id));
  };

  const handleSave = () => {
    if (!title.trim()) {
      toast.warning('⚠️ Vui lòng nhập tiêu đề!');
      return;
    }

    if (statements.length === 0) {
      toast.warning('⚠️ Vui lòng thêm ít nhất 1 câu văn!');
      return;
    }

    // Validate: Check if using shared image or individual images
    if (!sharedImageUrl) {
      const hasEmptyImages = statements.some(stmt => !stmt.imageUrl);
      if (hasEmptyImages) {
        toast.warning('⚠️ Vui lòng tải ảnh cho tất cả câu văn hoặc tải 1 ảnh chung!');
        return;
      }
    }

    const hasEmptyStatements = statements.some(stmt => !stmt.statement.trim());
    if (hasEmptyStatements) {
      toast.warning('⚠️ Vui lòng nhập nội dung cho tất cả câu văn!');
      return;
    }

    // Calculate points based on non-example items only
    const config = {
      answer_format: answerFormat, // Add this field
      sharedImageUrl,
      items: statements,
    };
    
    const calculatedPoints = calculateQuestionPoints(config, 1); // 1 point per item

    const questionData = {
      type: 'look_and_read',
      title,
      points: calculatedPoints, // Use calculated points
      config,
    };

    toast.success('✅ Đã lưu câu hỏi thành công!');
    onSave(questionData);
  };

  return (
    <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">👀</span>
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Phần 1: Nhìn và Đọc (Đọc)
            </h3>
            <p className="text-sm text-slate-500">
              Học viên nhìn ảnh, đọc câu văn và đánh dấu ✓ (đúng) hoặc ✗ (sai)
            </p>
          </div>
        </div>
      </div>

      {/* Question Title */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          📝 Tiêu đề câu hỏi / Hướng dẫn
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="VD: Nhìn tranh và đọc câu. Đánh dấu ✓ hoặc ✗"
          className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
        />
        <p className="mt-1 text-sm text-slate-500">
          Hướng dẫn chung cho học viên về cách làm bài
        </p>
      </div>

      {/* Answer Format Selector */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <label className="mb-3 block text-sm font-semibold text-slate-700">
          📋 Định dạng câu trả lời:
        </label>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setAnswerFormat('tick_cross')}
            className={`rounded-lg border p-4 text-left transition-all ${
              answerFormat === 'tick_cross'
                ? 'border-orange-400 bg-orange-50 ring-1 ring-orange-400'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xl">✓✗</span>
              <span className="font-semibold text-slate-800">Tick / Cross</span>
            </div>
            <p className="text-sm text-slate-500">
              Starters R&W Part 1: Mỗi câu có ảnh riêng, đánh dấu ✓ hoặc ✗
            </p>
          </button>

          <button
            type="button"
            onClick={() => setAnswerFormat('yes_no')}
            className={`rounded-lg border p-4 text-left transition-all ${
              answerFormat === 'yes_no'
                ? 'border-orange-400 bg-orange-50 ring-1 ring-orange-400'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xl">📝</span>
              <span className="font-semibold text-slate-800">Yes / No</span>
            </div>
            <p className="text-sm text-slate-500">
              Starters R&W Part 2: Nhìn 1 ảnh lớn chung, viết yes/no
            </p>
          </button>
        </div>
      </div>

      {/* Shared Image Upload - NEW FEATURE */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 flex items-center space-x-2">
          <span className="text-xl">🖼️</span>
          <h4 className="text-base font-semibold text-slate-800">
            Hình ảnh chung cho tất cả câu (Tùy chọn)
          </h4>
        </div>
        <p className="mb-3 text-sm text-slate-500">
          💡 Giống đề Cambridge thật: Upload 1 hình lớn, tất cả câu hỏi đều dựa vào hình này. 
          Nếu không upload, mỗi câu sẽ có hình riêng.
        </p>

        {!sharedImageUrl ? (
          <div
            tabIndex={0}
            onClick={() => {
              if (!focusedSharedImage) {
                setFocusedSharedImage(true);
              } else {
                const input = document.getElementById('shared-image-input') as HTMLInputElement;
                if (input) input.click();
              }
            }}
            onFocus={() => setFocusedSharedImage(true)}
            onBlur={() => setFocusedSharedImage(false)}
            className={`cursor-pointer rounded-lg border border-dashed transition-colors ${
              focusedSharedImage
                ? 'border-orange-400 bg-orange-50'
                : 'border-slate-300 bg-white hover:border-orange-400 hover:bg-orange-50/40'
            }`}
          >
            <div className="flex flex-col items-center justify-center p-6">
              <ImageIcon className="mb-2 h-12 w-12 text-slate-400" />
              <span className="mb-1 text-sm font-medium text-slate-700">
                {uploadingSharedImage ? '⏳ Đang tải lên...' : 'Nhấn để tải ảnh chung hoặc Ctrl+V'}
              </span>
              <span className="text-xs text-slate-400">PNG, JPG (tối đa 20MB)</span>
              {focusedSharedImage && (
                <p className="mt-2 text-xs font-semibold text-orange-600">
                  💡 Bạn có thể Ctrl+V để dán ảnh từ clipboard
                </p>
              )}
            </div>
            <input
              id="shared-image-input"
              type="file"
              accept="image/*"
              onChange={handleSharedImageUpload}
              className="hidden"
              disabled={uploadingSharedImage}
            />
          </div>
        ) : (
          <div className="relative rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-center">
              <img
                src={sharedImageUrl}
                alt="Shared image"
                className="max-h-64 w-auto rounded-lg shadow-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => setSharedImageUrl('')}
              className="absolute right-2 top-2 rounded-full bg-red-500 p-2 text-white shadow-lg transition-colors hover:bg-red-600"
              title="Xóa ảnh chung"
            >
              <X className="h-5 w-5" />
            </button>
            <p className="mt-2 text-center text-sm font-medium text-green-600">
              ✅ Tất cả câu hỏi sẽ dùng chung hình này!
            </p>
          </div>
        )}
      </div>

      {/* Statements List */}
      <div>
        {/* Sticky header with add button */}
        <div className="sticky top-0 z-40 -mx-6 -mt-6 mb-4 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h4 className="text-base font-semibold text-slate-800">
              📋 Danh Sách Câu Văn
            </h4>
            <p className="text-sm text-slate-500">
              {getScorableItemsCount(statements)} câu chấm điểm • {getExampleItemsCount(statements)} câu ví dụ
            </p>
          </div>
          <button
            onClick={addStatement}
            className="flex items-center space-x-2 rounded-lg bg-orange-600 px-4 py-2 text-white transition-colors hover:bg-orange-700"
          >
            <Plus className="h-5 w-5" />
            <span>Thêm câu văn</span>
          </button>
        </div>

        {statements.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <div className="mb-3 text-4xl">📝</div>
            <p className="text-slate-500">Chưa có câu văn nào. Nhấn "Thêm câu văn" để bắt đầu!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {statements.map((stmt, index) => (
              <div
                key={stmt.id ?? index}
                className={`rounded-xl border p-4 transition-all ${
                  stmt.isExample
                    ? 'border-amber-300 bg-amber-50'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-600 font-bold text-white">
                      {index + 1}
                    </span>
                    {stmt.isExample && (
                      <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white">
                        📌 Câu ví dụ
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <label className="flex cursor-pointer items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={stmt.isExample}
                        onChange={(e) => updateStatement(stmt.id, 'isExample', e.target.checked)}
                        className="h-5 w-5 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                      />
                      <span className="text-sm font-medium text-slate-600">Đánh dấu là ví dụ</span>
                    </label>
                    <button
                      onClick={() => deleteStatement(stmt.id)}
                      className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 transition-colors hover:bg-red-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Statement Image Upload - Only show if no shared image */}
                  {!sharedImageUrl && (
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        🖼️ Hình ảnh cho câu này (Ctrl+V để paste)
                      </label>
                      
                      {!stmt.imageUrl ? (
                        <div
                          tabIndex={0}
                          onClick={() => {
                            // Click lần 1: Focus vào ô này
                            if (focusedStatement !== stmt.id) {
                              setFocusedStatement(stmt.id);
                            } else {
                              // Click lần 2 (đã focus rồi): Mở file dialog
                              const input = document.getElementById(`file-input-${stmt.id}`) as HTMLInputElement;
                              if (input) input.click();
                            }
                          }}
                          onFocus={() => setFocusedStatement(stmt.id)}
                          onBlur={() => setFocusedStatement(null)}
                          className={`cursor-pointer rounded-lg border border-dashed transition-colors ${
                            focusedStatement === stmt.id
                              ? 'border-orange-400 bg-orange-50'
                              : 'border-slate-300 bg-white hover:border-orange-400 hover:bg-orange-50/40'
                          }`}
                        >
                          <div className="flex flex-col items-center justify-center p-6">
                            <ImageIcon className="mb-2 h-10 w-10 text-slate-400" />
                            <span className="mb-1 text-sm font-medium text-slate-700">
                              {uploadingImages[stmt.id] ? '⏳ Đang tải lên...' : 'Nhấn để tải ảnh hoặc Ctrl+V'}
                            </span>
                            <span className="text-xs text-slate-400">PNG, JPG (tối đa 20MB)</span>
                            {focusedStatement === stmt.id && (
                              <p className="mt-2 text-xs font-semibold text-orange-600">
                                💡 Bạn có thể Ctrl+V để dán ảnh từ clipboard
                              </p>
                            )}
                          </div>
                          <input
                            id={`file-input-${stmt.id}`}
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleStatementImageUpload(stmt.id, e)}
                            className="hidden"
                            disabled={uploadingImages[stmt.id]}
                          />
                        </div>
                      ) : (
                        <div className="relative rounded-lg border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-center justify-center">
                            <img
                              src={stmt.imageUrl}
                              alt={`Statement ${index + 1}`}
                              className="max-h-48 w-auto rounded-lg"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => updateStatement(stmt.id, 'imageUrl', '')}
                            className="absolute right-2 top-2 rounded-full bg-red-500 p-2 text-white shadow-lg transition-colors hover:bg-red-600"
                            title="Xóa ảnh"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Show info if using shared image */}
                  {sharedImageUrl && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-sm font-medium text-slate-600">
                        ℹ️ Câu này sử dụng hình ảnh chung ở trên
                      </p>
                    </div>
                  )}

                  {/* Statement Text */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Câu văn mô tả
                    </label>
                    <input
                      type="text"
                      value={stmt.statement}
                      onChange={(e) => updateStatement(stmt.id, 'statement', e.target.value)}
                      placeholder="VD: This is a bus."
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                    />
                  </div>

                  {/* Correct Answer */}
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Đáp án đúng
                    </label>
                    <div className="flex space-x-4">
                      <label className={`flex cursor-pointer items-center space-x-2 rounded-lg border px-4 py-2 transition-all ${
                        stmt.correctAnswer === 'tick'
                          ? 'border-green-500 bg-green-50'
                          : 'border-slate-300 hover:border-green-400 hover:bg-green-50/50'
                      }`}>
                        <input
                          type="radio"
                          name={`answer-${stmt.id}`}
                          checked={stmt.correctAnswer === 'tick'}
                          onChange={() => updateStatement(stmt.id, 'correctAnswer', 'tick')}
                          className="h-5 w-5 text-green-600"
                        />
                        <span className="text-xl">✓</span>
                        <span className="text-sm font-medium text-slate-700">Đúng (Tick)</span>
                      </label>
                      <label className={`flex cursor-pointer items-center space-x-2 rounded-lg border px-4 py-2 transition-all ${
                        stmt.correctAnswer === 'cross'
                          ? 'border-red-500 bg-red-50'
                          : 'border-slate-300 hover:border-red-400 hover:bg-red-50/50'
                      }`}>
                        <input
                          type="radio"
                          name={`answer-${stmt.id}`}
                          checked={stmt.correctAnswer === 'cross'}
                          onChange={() => updateStatement(stmt.id, 'correctAnswer', 'cross')}
                          className="h-5 w-5 text-red-600"
                        />
                        <span className="text-xl">✗</span>
                        <span className="text-sm font-medium text-slate-700">Sai (Cross)</span>
                      </label>
                    </div>
                  </div>

                  {/* Preview */}
                  {stmt.statement && stmt.imageUrl && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-sm text-slate-600">
                        <span className="font-semibold">Preview:</span> {stmt.statement}{' '}
                        <span className="text-xl">
                          {stmt.correctAnswer === 'tick' ? '✓' : '✗'}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instructions for Students */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h4 className="mb-2 text-sm font-semibold text-slate-700">
          💡 Hướng dẫn cho học viên:
        </h4>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>Nhìn kỹ ảnh của từng câu</li>
          <li>Đọc câu văn mô tả</li>
          <li>Đánh dấu ✓ nếu câu đúng với ảnh</li>
          <li>Đánh dấu ✗ nếu câu sai với ảnh</li>
        </ol>
      </div>

      {/* Action Buttons - Moved to bottom */}
      <div className="flex justify-end space-x-3 border-t border-slate-200 pt-4">
        <button
          onClick={onCancel}
          className="flex items-center space-x-2 rounded-lg border border-slate-300 px-6 py-2.5 text-slate-700 transition-colors hover:bg-slate-50"
        >
          <X className="h-5 w-5" />
          <span>Hủy</span>
        </button>
        <button
          onClick={handleSave}
          className="flex items-center space-x-2 rounded-lg bg-orange-600 px-6 py-2.5 text-white transition-colors hover:bg-orange-700"
        >
          <Save className="h-5 w-5" />
          <span>Lưu câu hỏi</span>
        </button>
      </div>
    </div>
  );
};

export default LookReadEditor;
