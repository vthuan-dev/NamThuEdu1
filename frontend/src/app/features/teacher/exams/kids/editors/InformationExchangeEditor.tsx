import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import EditorShell from '../components/EditorShell';
import { FieldLabel, TextField, ImageUpload, AddItemButton } from '../components/editorPrimitives';

interface InformationExchangeEditorProps {
  onSave: (data: any) => void;
  onCancel: () => void;
  initialData?: any;
  examId: string | null;
  questionId: string | null;
}

interface KnownInfo {
  field: string;
  value: string;
}

const InformationExchangeEditor: React.FC<InformationExchangeEditorProps> = ({
  onSave,
  onCancel,
  initialData,
  examId,
}) => {
  const [title, setTitle] = useState(initialData?.title || 'Information Exchange');
  const [imageUrl, setImageUrl] = useState('');
  const [cardTitle, setCardTitle] = useState('');
  const [knownInfo, setKnownInfo] = useState<KnownInfo[]>([{ field: '', value: '' }]);
  const [questionsToAsk, setQuestionsToAsk] = useState<string[]>(['']);

  React.useEffect(() => {
    if (!initialData?.config) return;
    const config = initialData.config;
    setImageUrl(config.imageUrl || config.image_url || '');
    const card = config.candidateCard || config.candidate_card;
    if (card) {
      setCardTitle(card.title || '');
      const info = card.knownInfo || card.known_info;
      if (info) setKnownInfo(info.map((it: any) => ({ field: it.field || '', value: it.value || '' })));
      const qs = card.questionsToAsk || card.questions_to_ask;
      if (qs) setQuestionsToAsk(qs);
    }
  }, [initialData]);

  const addKnownInfo = () => setKnownInfo([...knownInfo, { field: '', value: '' }]);
  const removeKnownInfo = (index: number) =>
    knownInfo.length > 1 && setKnownInfo(knownInfo.filter((_, i) => i !== index));
  const updateKnownInfo = (index: number, field: 'field' | 'value', value: string) =>
    setKnownInfo(knownInfo.map((it, i) => (i === index ? { ...it, [field]: value } : it)));

  const addQuestion = () => setQuestionsToAsk([...questionsToAsk, '']);
  const removeQuestion = (index: number) =>
    questionsToAsk.length > 1 && setQuestionsToAsk(questionsToAsk.filter((_, i) => i !== index));
  const updateQuestion = (index: number, value: string) =>
    setQuestionsToAsk(questionsToAsk.map((q, i) => (i === index ? value : q)));

  const canSave =
    !!imageUrl &&
    !!cardTitle.trim() &&
    knownInfo.every((it) => it.field.trim() && it.value.trim()) &&
    questionsToAsk.every((q) => q.trim());

  const handleSave = () => {
    if (!imageUrl) return alert('Vui lòng tải hình ảnh lên!');
    if (!cardTitle.trim()) return alert('Vui lòng nhập tiêu đề thẻ!');
    if (knownInfo.some((it) => !it.field.trim() || !it.value.trim()))
      return alert('Vui lòng điền đầy đủ thông tin đã biết!');
    if (questionsToAsk.some((q) => !q.trim()))
      return alert('Vui lòng điền đầy đủ các câu hỏi cần hỏi!');

    onSave({
      type: 'information_exchange',
      title,
      points: 10,
      config: {
        image_url: imageUrl,
        candidate_card: {
          title: cardTitle.trim(),
          known_info: knownInfo.map((it) => ({ field: it.field.trim(), value: it.value.trim() })),
          questions_to_ask: questionsToAsk.map((q) => q.trim()),
        },
      },
    });
  };

  return (
    <EditorShell
      title="Trao đổi thông tin"
      badge="Flyers · Speaking · Information Exchange"
      instruction="Học sinh hỏi và trả lời để hoàn thành bảng thông tin. Tải hình minh họa, nhập tiêu đề thẻ, thông tin đã biết (để trả lời) và các câu hỏi cần hỏi."
      onSave={handleSave}
      onCancel={onCancel}
    >
      <div className="space-y-5">
        <div>
          <FieldLabel required>Tiêu đề câu hỏi</FieldLabel>
          <TextField
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="VD: Hỏi về lâu đài"
          />
        </div>

        <div>
          <FieldLabel required>Hình minh họa</FieldLabel>
          <ImageUpload value={imageUrl} onChange={setImageUrl} examId={examId} placeholder="Tải hình minh họa" />
        </div>

        <div>
          <FieldLabel required hint="Chủ đề học sinh sẽ hỏi">Tiêu đề thẻ</FieldLabel>
          <TextField
            value={cardTitle}
            onChange={(e) => setCardTitle(e.target.value)}
            placeholder="VD: George's castle"
          />
        </div>

        <div>
          <FieldLabel hint={`${knownInfo.length} mục`}>Thông tin đã biết (để trả lời)</FieldLabel>
          <div className="space-y-2">
            {knownInfo.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <TextField
                  value={item.field}
                  onChange={(e) => updateKnownInfo(index, 'field', e.target.value)}
                  placeholder="Trường (VD: Where)"
                />
                <TextField
                  value={item.value}
                  onChange={(e) => updateKnownInfo(index, 'value', e.target.value)}
                  placeholder="Giá trị (VD: mountain)"
                />
                {knownInfo.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeKnownInfo(index)}
                    className="flex-shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                    aria-label="Xóa"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <AddItemButton onClick={addKnownInfo} label="Thêm thông tin" />
          </div>
        </div>

        <div>
          <FieldLabel hint={`${questionsToAsk.length} câu`}>Câu hỏi cần hỏi</FieldLabel>
          <div className="space-y-2">
            {questionsToAsk.map((question, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="w-5 flex-shrink-0 text-sm font-semibold text-slate-400">
                  {index + 1}.
                </span>
                <TextField
                  value={question}
                  onChange={(e) => updateQuestion(index, e.target.value)}
                  placeholder="VD: How old / castle?"
                />
                {questionsToAsk.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeQuestion(index)}
                    className="flex-shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                    aria-label="Xóa"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <AddItemButton onClick={addQuestion} label="Thêm câu hỏi" />
          </div>
        </div>
      </div>
    </EditorShell>
  );
};

export default InformationExchangeEditor;
