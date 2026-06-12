/**
 * KidsAnswerReview — hiển thị bài làm của học viên cho 1 câu hỏi dạng Kids task
 * trên TRANG CHẤM ĐIỂM của giáo viên (teacher-facing, thiết kế gọn, chuyên nghiệp).
 *
 * Thay vì hiện JSON thô ({"0":"a","1":"a"...}) -> render bảng rõ ràng:
 *   Nội dung / câu hỏi  |  Đáp án học viên  |  Đáp án đúng  |  Đúng/Sai
 *
 * Dùng lại logic so khớp ở student/kids/player/kidsAnswerKey để không lệch.
 */
import { CheckCircle2, XCircle, ListChecks, FileText } from 'lucide-react';
import {
  buildReviewRows,
  MANUAL_REVIEW_TYPES,
} from '../../student/kids/player/kidsAnswerKey';

interface Props {
  taskType: string;
  taskName?: string;
  taskData: any;
  /** Câu trả lời thô từ DB (saAnswer_text) — có thể là JSON string hoặc object */
  studentAnswerRaw: any;
  instructions?: string;
}

function parseAnswerMap(raw: any): Record<string, string> {
  if (!raw) return {};
  if (typeof raw === 'object') {
    // đã là object
    const out: Record<string, string> = {};
    for (const k of Object.keys(raw)) out[k] = String(raw[k] ?? '');
    return out;
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return {};
    try {
      const parsed = JSON.parse(s);
      if (parsed && typeof parsed === 'object') {
        const out: Record<string, string> = {};
        for (const k of Object.keys(parsed)) out[k] = String(parsed[k] ?? '');
        return out;
      }
    } catch {
      /* không phải JSON -> coi như 1 câu trả lời tự do */
    }
    return { '0': s };
  }
  return {};
}

export function KidsAnswerReview({
  taskType,
  taskName,
  taskData,
  studentAnswerRaw,
  instructions,
}: Props) {
  const answerMap = parseAnswerMap(studentAnswerRaw);
  const isManual = MANUAL_REVIEW_TYPES.has(taskType);

  // Dạng tự luận / nói / vẽ -> không có đáp án máy, chỉ hiển thị bài làm
  if (isManual) {
    const freeText =
      typeof studentAnswerRaw === 'string' && !studentAnswerRaw.trim().startsWith('{')
        ? studentAnswerRaw
        : Object.values(answerMap).filter(Boolean).join('\n');
    return (
      <div className="space-y-3">
        {instructions && (
          <p className="text-xs text-slate-500">{instructions}</p>
        )}
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Bài làm của học viên
          </p>
          {freeText ? (
            <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
              {freeText}
            </div>
          ) : (
            <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700">
              Học viên chưa trả lời hoặc bài làm cần giáo viên chấm trực tiếp.
            </div>
          )}
        </div>
        <p className="text-[11px] text-violet-500 font-medium">
          Dạng này cần giáo viên tự chấm và cho điểm bên dưới.
        </p>
      </div>
    );
  }

  let rows: ReturnType<typeof buildReviewRows> = [];
  try {
    rows = buildReviewRows(taskType, taskData, answerMap as any);
  } catch {
    rows = [];
  }

  if (rows.length === 0) {
    // fallback: hiển thị từng cặp key->value của câu trả lời cho dễ đọc
    const entries = Object.entries(answerMap);
    return (
      <div>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
          Bài làm của học viên
        </p>
        {entries.length > 0 ? (
          <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
            {entries.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="text-slate-500">Ô {Number(k) + 1 || k}</span>
                <span className="font-semibold text-slate-800">{v || '—'}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700">
            Học viên chưa trả lời.
          </div>
        )}
      </div>
    );
  }

  const correctCount = rows.filter((r) => r.isCorrect).length;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <ListChecks className="w-3.5 h-3.5" /> Chi tiết bài làm
        </p>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
          Đúng {correctCount}/{rows.length}
        </span>
      </div>

      <div className="rounded-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_auto_auto_28px] gap-2 px-4 py-2 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          <span>Nội dung</span>
          <span className="text-right">Học viên</span>
          <span className="text-right">Đáp án</span>
          <span />
        </div>
        <div className="divide-y divide-slate-100">
          {rows.map((r, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_auto_auto_28px] gap-2 items-center px-4 py-2.5 text-sm"
            >
              <span className="text-slate-700 truncate" title={r.label}>{r.label}</span>
              <span
                className={`text-right font-semibold ${r.isCorrect ? 'text-emerald-600' : 'text-rose-600'}`}
              >
                {r.student}
              </span>
              <span className="text-right font-semibold text-slate-500">{r.correct}</span>
              <span className="flex justify-end">
                {r.isCorrect ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400" />
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {taskName && (
        <p className="text-[11px] text-slate-400">Dạng bài: {taskName}</p>
      )}
    </div>
  );
}

export default KidsAnswerReview;
