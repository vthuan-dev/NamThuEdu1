/**
 * kidsAnswerKey — trích đáp án đúng + so khớp cho từng dạng kids task,
 * dùng riêng cho trang xem lại bài (review). Chỉ phục vụ HIỂN THỊ;
 * điểm thật do backend chấm.
 *
 * Trả về danh sách dòng review: nhãn ô con, đáp án học viên, đáp án đúng, đúng/sai.
 */
import { normalize } from './kidsAnswer';
import type { KidsAnswerMap } from './kidsAnswer';

export interface ReviewRow {
  label: string;
  student: string;
  correct: string;
  isCorrect: boolean;
}

const eq = (a: string, b: string) => {
  const na = normalize(a);
  return na !== '' && na === normalize(b);
};

export function buildReviewRows(
  taskType: string,
  taskData: any,
  answer: KidsAnswerMap
): ReviewRow[] {
  const get = (k: string) => answer[k] ?? '';

  switch (taskType) {
    case 'odd_one_out': {
      const correct = String(taskData?.correct_odd_one ?? '');
      const student = get('0');
      return [
        {
          label: 'Hình khác loại',
          student: student ? `Hình ${student}` : '—',
          correct: `Hình ${correct}`,
          isCorrect: student !== '' && student === correct,
        },
      ];
    }
    case 'word_definition_matching': {
      const words: any[] = taskData?.words ?? [];
      return words.map((w, i) => {
        const expected = String.fromCharCode(65 + i);
        const student = get(String(i));
        return {
          label: w.word ?? `Từ ${i + 1}`,
          student: student || '—',
          correct: expected,
          isCorrect: student === expected,
        };
      });
    }
    case 'dialogue_matching': {
      const dialogues: any[] = taskData?.dialogues ?? [];
      return dialogues.map((d, i) => {
        const student = get(String(i));
        return {
          label: d.question ?? `Câu ${i + 1}`,
          student: student || '—',
          correct: String(d.correct_answer ?? ''),
          isCorrect: student === String(d.correct_answer ?? ''),
        };
      });
    }
    case 'listening_letter_match': {
      const subjects: any[] = (taskData?.subjects ?? []).filter(
        (s: any) => !(s.is_example ?? s.isExample)
      );
      return subjects.map((s, i) => {
        const expected = String(s.correct_letter ?? s.correctLetter ?? '');
        const student = get(String(i));
        return {
          label: s.label ?? `Mục ${i + 1}`,
          student: student || '—',
          correct: expected,
          isCorrect: student !== '' && student === expected,
        };
      });
    }
    case 'cloze_test': {
      const gaps: any[] = taskData?.gaps ?? [];
      const rows: ReviewRow[] = gaps.map((g, i) => {
        const key = String(g.gap_id ?? i + 1);
        const student = get(key);
        return {
          label: `Chỗ trống ${g.gap_id ?? i + 1}`,
          student: student || '—',
          correct: String(g.correct_answer ?? ''),
          isCorrect: eq(student, g.correct_answer ?? ''),
        };
      });
      if (taskData?.story_title_question) {
        const student = get('title');
        rows.push({
          label: 'Tên câu chuyện',
          student: student || '—',
          correct: String(taskData.story_title_question.correct_answer ?? ''),
          isCorrect: eq(student, taskData.story_title_question.correct_answer ?? ''),
        });
      }
      return rows;
    }
    case 'open_cloze': {
      const gaps: any[] = taskData?.gaps ?? [];
      return gaps.map((g, i) => {
        const key = String(g.gap_id ?? i + 1);
        const student = get(key);
        const accepts: string[] = g.correct_answers ?? [];
        return {
          label: `Chỗ trống ${g.gap_id ?? i + 1}`,
          student: student || '—',
          correct: accepts.join(' / '),
          isCorrect: accepts.some((a) => eq(student, a)),
        };
      });
    }
    case 'story_completion': {
      const sentences: any[] = taskData?.completion_sentences ?? [];
      return sentences.map((s, i) => {
        const student = get(String(i));
        return {
          label: `Câu ${i + 1}`,
          student: student || '—',
          correct: String(s.correct_answer ?? ''),
          isCorrect: eq(student, s.correct_answer ?? ''),
        };
      });
    }
    case 'unscramble_words': {
      const items: any[] = (taskData?.items ?? []).filter((it: any) => !it.isExample);
      return items.map((it, i) => {
        const student = get(String(i));
        return {
          label: `Từ ${i + 1}`,
          student: student || '—',
          correct: String(it.correct_answer ?? ''),
          isCorrect: eq(student, it.correct_answer ?? ''),
        };
      });
    }
    case 'word_bank_fill': {
      const gaps: any[] = (taskData?.gaps ?? []).filter((g: any) => !g.isExample);
      return gaps.map((g, i) => {
        const key = String(g.gap_number ?? i + 1);
        const student = get(key);
        return {
          label: `Chỗ trống ${g.gap_number ?? i + 1}`,
          student: student || '—',
          correct: String(g.correct_word ?? ''),
          isCorrect: eq(student, g.correct_word ?? ''),
        };
      });
    }
    case 'reading_comprehension': {
      const questions: any[] = taskData?.questions ?? [];
      return questions.map((qq, i) => {
        const student = get(String(i));
        return {
          label: qq.question ?? `Câu ${i + 1}`,
          student: student || '—',
          correct: String(qq.answer ?? ''),
          isCorrect: eq(student, qq.answer ?? ''),
        };
      });
    }
    case 'listen_and_draw_lines': {
      // Nối tên (label) vào đúng người/vật (hotspot) trên tranh.
      // Đáp án lưu { [labelIndex]: hotspotIndex }. Đúng khi tên i nối vào hotspot i.
      // Giữ index gốc để khớp với map đáp án (chỉ bỏ HIỂN THỊ item ví dụ).
      const allItems: any[] = taskData?.items ?? [];
      const rows: ReviewRow[] = [];
      allItems.forEach((it: any, i: number) => {
        if (it?.isExample || it?.is_example) return; // ví dụ — không chấm
        const raw = get(String(i));
        const matchedIdx = raw === '' ? -1 : parseInt(raw, 10);
        const matchedName =
          matchedIdx >= 0 && allItems[matchedIdx] ? String(allItems[matchedIdx].name ?? '') : '';
        rows.push({
          label: String(it?.name ?? `Mục ${i + 1}`),
          student: matchedName || '—',
          correct: String(it?.name ?? ''),
          isCorrect: matchedIdx === i,
        });
      });
      return rows;
    }
    case 'listen_and_tick': {
      const its: any[] = taskData?.items ?? taskData?.config?.items ?? [];
      const rows: ReviewRow[] = [];
      its.forEach((it: any, i: number) => {
        if (it?.isExample || it?.is_example) return;
        const corr = String(it?.correctAnswer ?? it?.correct_answer ?? '').toUpperCase();
        const student = String(get(String(i))).toUpperCase();
        rows.push({
          label: String(it?.questionText ?? it?.text ?? it?.question ?? `Câu ${i + 1}`),
          student: student || '—',
          correct: corr,
          isCorrect: student !== '' && student === corr,
        });
      });
      return rows;
    }
    case 'listen_and_write': {
      const list: any[] = (taskData?.questions?.length ? taskData.questions : (taskData?.items ?? [])) ?? [];
      const rows: ReviewRow[] = [];
      list.forEach((q: any, i: number) => {
        if (q?.isExample || q?.is_example) return;
        const corr = String(q?.answer ?? q?.correct_answer ?? q?.correctAnswer ?? '');
        const student = get(String(i));
        rows.push({
          label: String(q?.text ?? q?.question ?? q?.questionText ?? `Câu ${i + 1}`),
          student: student || '—',
          correct: corr,
          isCorrect: eq(student, corr),
        });
      });
      return rows;
    }
    case 'look_and_read': {
      const list: any[] = (taskData?.questions?.length ? taskData.questions : (taskData?.items ?? [])) ?? [];
      const fmt = String(taskData?.answer_format ?? taskData?.answerFormat ?? taskData?.config?.answer_format ?? 'tick_cross');
      const isYesNo = fmt === 'yes_no';
      const tLabel = isYesNo ? 'Yes' : 'Đúng';
      const fLabel = isYesNo ? 'No' : 'Sai';
      const rows: ReviewRow[] = [];
      list.forEach((q: any, i: number) => {
        if (q?.isExample || q?.is_example) return;
        const corrRaw = String(q?.correctAnswer ?? q?.correct_answer ?? '').toLowerCase();
        const corrTrue = corrRaw === 'tick' || corrRaw === 'true' || corrRaw === 'yes' || corrRaw === '1';
        const raw = String(get(String(i))).toLowerCase();
        const answered = raw !== '';
        const studentTrue = raw === 'true' || raw === 'tick' || raw === 'yes' || raw === '1';
        rows.push({
          label: String(q?.statement ?? q?.text ?? q?.question ?? `Câu ${i + 1}`),
          student: !answered ? '—' : (studentTrue ? tLabel : fLabel),
          correct: corrTrue ? tLabel : fLabel,
          isCorrect: answered && studentTrue === corrTrue,
        });
      });
      return rows;
    }
    case 'look_read_write': {
      const list: any[] = (taskData?.questions?.length ? taskData.questions : (taskData?.items ?? [])) ?? [];
      const rows: ReviewRow[] = [];
      list.forEach((q: any, i: number) => {
        if (q?.isExample || q?.is_example) return;
        const qType = String(q?.question_type ?? q?.questionType ?? '');
        if (qType === 'free_write') return; // tự luận → giáo viên chấm
        const corr = String(q?.correct_answer ?? q?.correctAnswer ?? '');
        const student = get(String(i));
        rows.push({
          label: String(q?.question ?? q?.text ?? q?.questionText ?? `Câu ${i + 1}`),
          student: student || '—',
          correct: corr,
          isCorrect: eq(student, corr),
        });
      });
      return rows;
    }
    default:
      return [];
  }
}

/** Dạng nói / viết tự do → review chỉ hiển thị bài làm, không có đáp án máy. */
export const MANUAL_REVIEW_TYPES = new Set([
  'picture_questions',
  'picture_card_questions',
  'object_placement',
  'find_differences',
  'picture_story_narration',
  'information_exchange',
  'picture_sentence_writing',
  'picture_story_writing',
  'listen_colour_write',
  'listen_colour',
]);
