import React, { useState } from 'react';
import EditorShell from '../components/EditorShell';
import {
  FieldLabel,
  TextField,
  ImageUpload,
  AddItemButton,
  ItemCard,
} from '../components/editorPrimitives';

interface ObjectPlacementEditorProps {
  onSave: (data: any) => void;
  onCancel: () => void;
  initialData?: any;
  examId: string | null;
  questionId?: string | null;
}

interface PlacementItem {
  id: string;
  name: string;
  cardImageUrl: string;
  correctX: number;
  correctY: number;
}

const ObjectPlacementEditor: React.FC<ObjectPlacementEditorProps> = ({
  onSave,
  onCancel,
  initialData,
  examId,
}) => {
  const [title, setTitle] = useState(initialData?.title || '');
  const [baseImageUrl, setBaseImageUrl] = useState(
    initialData?.config?.base_image_url || initialData?.config?.imageUrl || initialData?.config?.image_url || ''
  );
  // Luôn có sẵn 1 thẻ khi tạo mới để giáo viên tải được ảnh thẻ ngay.
  const [items, setItems] = useState<PlacementItem[]>(() => {
    const saved = (initialData?.config?.items || []).map((it: any, idx: number) => ({
      id: it?.id ?? `item-${idx + 1}`,
      name: it?.name ?? it?.label ?? it?.object ?? '',
      cardImageUrl: it?.cardImageUrl ?? it?.card_image_url ?? it?.image_url ?? it?.imageUrl ?? '',
      correctX: it?.correctX ?? it?.correct_position?.x ?? 50,
      correctY: it?.correctY ?? it?.correct_position?.y ?? 50,
    }));
    return saved.length > 0
      ? saved
      : [{ id: 'item-1', name: '', cardImageUrl: '', correctX: 50, correctY: 50 }];
  });

  const addItem = () => {
    setItems([
      ...items,
      { id: `item-${Date.now()}`, name: '', cardImageUrl: '', correctX: 50, correctY: 50 },
    ]);
  };

  const removeItem = (id: string) => setItems(items.filter((it) => it.id !== id));

  const updateItem = (id: string, field: keyof PlacementItem, value: any) =>
    setItems(items.map((it) => (it.id === id ? { ...it, [field]: value } : it)));

  const canSave = !!title.trim() && !!baseImageUrl && items.length > 0;

  const handleSave = () => {
    if (!title.trim()) return alert('Vui lòng nhập tiêu đề!');
    if (!baseImageUrl) return alert('Vui lòng tải tranh lớn lên!');
    if (items.length === 0) return alert('Vui lòng thêm ít nhất 1 thẻ hình!');
    if (items.some((it) => !it.name || !it.cardImageUrl))
      return alert('Vui lòng điền đầy đủ thông tin cho tất cả thẻ hình!');

    onSave({
      type: 'object_placement',
      title,
      points: items.length,
      config: {
        base_image_url: baseImageUrl,
        items: items.map((it) => ({
          name: it.name,
          card_image_url: it.cardImageUrl,
          correct_position: { x: it.correctX, y: it.correctY },
        })),
      },
    });
  };

  return (
    <EditorShell
      title="Đặt thẻ hình vào tranh"
      badge="Starters · Speaking · Part 1"
      instruction="Học sinh đặt các thẻ hình nhỏ vào đúng vị trí trên tranh lớn. Tải tranh nền, sau đó thêm các thẻ và chỉnh vị trí đúng cho mỗi thẻ."
      saveDisabled={!canSave}
      onSave={handleSave}
      onCancel={onCancel}
    >
      <div className="space-y-5">
        {/* Tiêu đề */}
        <div>
          <FieldLabel required>Tiêu đề câu hỏi / Hướng dẫn</FieldLabel>
          <TextField
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="VD: Đặt các đồ vật vào đúng vị trí trong phòng"
          />
        </div>

        {/* Tranh lớn */}
        <div>
          <FieldLabel required hint="Tranh nền có nhiều vị trí để đặt thẻ">
            Tranh lớn (nền)
          </FieldLabel>
          <ImageUpload
            value={baseImageUrl}
            onChange={setBaseImageUrl}
            examId={examId}
            size="lg"
            placeholder="Tải tranh lớn lên"
          />
        </div>

        {/* Thẻ hình */}
        <div>
          <FieldLabel hint={`${items.length} thẻ`}>Thẻ hình nhỏ</FieldLabel>
          <div className="space-y-2">
            {items.map((item, index) => (
              <ItemCard key={item.id ?? index} index={index} onRemove={() => removeItem(item.id)}>
                <div className="flex gap-3">
                  <ImageUpload
                    value={item.cardImageUrl}
                    onChange={(url) => updateItem(item.id, 'cardImageUrl', url)}
                    examId={examId}
                    size="sm"
                  />
                  <div className="flex-1 space-y-2">
                    <TextField
                      value={item.name}
                      onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                      placeholder="Tên đồ vật (VD: shell, tree, ball)"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="w-8 flex-shrink-0">X: {item.correctX}%</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={item.correctX}
                          onChange={(e) => updateItem(item.id, 'correctX', parseInt(e.target.value))}
                          className="flex-1 accent-orange-500"
                        />
                      </label>
                      <label className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="w-8 flex-shrink-0">Y: {item.correctY}%</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={item.correctY}
                          onChange={(e) => updateItem(item.id, 'correctY', parseInt(e.target.value))}
                          className="flex-1 accent-orange-500"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </ItemCard>
            ))}
            <AddItemButton onClick={addItem} label="Thêm thẻ hình" />
          </div>
        </div>
      </div>
    </EditorShell>
  );
};

export default ObjectPlacementEditor;
