import React, { useState } from 'react';
import EditorShell from '../components/EditorShell';
import {
  FieldLabel,
  TextField,
  ImageUpload,
  AddItemButton,
  ItemCard,
} from '../components/editorPrimitives';

interface PictureCardQuestionsEditorProps {
  onSave: (data: any) => void;
  onCancel: () => void;
  initialData?: any;
  examId: string | null;
  questionId?: string | null;
}

interface CardItem {
  id: string;
  imageUrl: string;
  question: string;
  sampleAnswer: string;
}

const PictureCardQuestionsEditor: React.FC<PictureCardQuestionsEditorProps> = ({
  onSave,
  onCancel,
  initialData,
  examId,
}) => {
  const [title, setTitle] = useState(initialData?.title || '');
  // Luôn có sẵn 1 thẻ khi tạo mới — trước đây mảng rỗng nên editor mở ra
  // không có ô tải ảnh nào.
  const [cards, setCards] = useState<CardItem[]>(() => {
    const saved = (initialData?.config?.cards || []).map((c: any, idx: number) => ({
      id: c?.id ?? `card-${idx + 1}`,
      imageUrl: c?.imageUrl ?? c?.image_url ?? '',
      question: c?.question ?? c?.text ?? '',
      sampleAnswer: c?.sampleAnswer ?? c?.sample_answer ?? '',
    }));
    return saved.length > 0
      ? saved
      : [{ id: 'card-1', imageUrl: '', question: '', sampleAnswer: '' }];
  });

  const addCard = () =>
    setCards([
      ...cards,
      { id: `card-${Date.now()}`, imageUrl: '', question: '', sampleAnswer: '' },
    ]);

  const removeCard = (id: string) => setCards(cards.filter((c) => c.id !== id));

  const updateCard = (id: string, field: keyof CardItem, value: string) =>
    setCards(cards.map((c) => (c.id === id ? { ...c, [field]: value } : c)));

  const canSave =
    !!title.trim() &&
    cards.length > 0 &&
    cards.every((c) => c.imageUrl && c.question && c.sampleAnswer);

  const handleSave = () => {
    if (!title.trim()) return alert('Vui lòng nhập tiêu đề!');
    if (cards.length === 0) return alert('Vui lòng thêm ít nhất 1 thẻ hình!');
    if (cards.some((c) => !c.imageUrl || !c.question || !c.sampleAnswer))
      return alert('Vui lòng điền đầy đủ thông tin cho tất cả thẻ hình!');

    onSave({
      type: 'picture_card_questions',
      title,
      points: cards.length,
      config: {
        cards: cards.map((c) => ({
          image_url: c.imageUrl,
          question: c.question,
          sample_answer: c.sampleAnswer,
        })),
      },
    });
  };

  return (
    <EditorShell
      title="Hỏi-đáp về thẻ hình"
      badge="Speaking · Picture Cards"
      instruction="Học sinh nhìn thẻ hình và trả lời câu hỏi. Gợi ý: What is this? → It's a cat · Have you got a cat? → Yes, I have / No, I haven't."
      saveDisabled={!canSave}
      onSave={handleSave}
      onCancel={onCancel}
    >
      <div className="space-y-5">
        <div>
          <FieldLabel required>Tiêu đề câu hỏi</FieldLabel>
          <TextField
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="VD: Trả lời câu hỏi về thẻ hình"
          />
        </div>

        <div>
          <FieldLabel hint={`${cards.length} thẻ`}>Danh sách thẻ hình</FieldLabel>
          <div className="space-y-2">
            {cards.map((card, index) => (
              <ItemCard key={card.id ?? index} index={index} onRemove={() => removeCard(card.id)}>
                <div className="flex gap-3">
                  <ImageUpload
                    value={card.imageUrl}
                    onChange={(url) => updateCard(card.id, 'imageUrl', url)}
                    examId={examId}
                    size="sm"
                  />
                  <div className="flex-1 space-y-2">
                    <TextField
                      value={card.question}
                      onChange={(e) => updateCard(card.id, 'question', e.target.value)}
                      placeholder="Câu hỏi (VD: What is this?)"
                    />
                    <TextField
                      value={card.sampleAnswer}
                      onChange={(e) => updateCard(card.id, 'sampleAnswer', e.target.value)}
                      placeholder="Đáp án mẫu (VD: It's a cat)"
                    />
                  </div>
                </div>
              </ItemCard>
            ))}
            <AddItemButton onClick={addCard} label="Thêm thẻ hình" />
          </div>
        </div>
      </div>
    </EditorShell>
  );
};

export default PictureCardQuestionsEditor;
