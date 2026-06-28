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
  /** Khóa đáp án (vd chỉ số label/gap) — dùng để nối trạng thái chấm với renderer trực quan. */
  key?: string;
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
        const corr = String(d.correct_answer ?? d.correctAnswer ?? d.answer ?? '');
        return {
          label: d.question ?? `Câu ${i + 1}`,
          student: student || '—',
          correct: corr,
          isCorrect: student === corr,
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
        const corr = String(g.correct_answer ?? g.correctAnswer ?? g.answer ?? '');
        return {
          label: `Chỗ trống ${g.gap_id ?? i + 1}`,
          student: student || '—',
          correct: corr,
          isCorrect: eq(student, corr),
        };
      });
      if (taskData?.story_title_question) {
        const student = get('title');
        const corrTitle = String(taskData.story_title_question.correct_answer ?? taskData.story_title_question.correctAnswer ?? taskData.story_title_question.answer ?? '');
        rows.push({
          label: 'Tên câu chuyện',
          student: student || '—',
          correct: corrTitle,
          isCorrect: eq(student, corrTitle),
        });
      }
      return rows;
    }
    case 'open_cloze': {
      const gaps: any[] = taskData?.gaps ?? [];
      return gaps.map((g, i) => {
        const key = String(g.gap_id ?? i + 1);
        const student = get(key);
        const accepts: string[] = g.correct_answers ?? g.correctAnswers ?? [];
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
        const corr = String(s.correct_answer ?? s.correctAnswer ?? s.answer ?? '');
        return {
          label: `Câu ${i + 1}`,
          student: student || '—',
          correct: corr,
          isCorrect: eq(student, corr),
        };
      });
    }
    case 'unscramble_words': {
      const items: any[] = (taskData?.items ?? []).filter((it: any) => !it.isExample);
      return items.map((it, i) => {
        const student = get(String(i));
        const corr = String(it.correct_answer ?? it.correctAnswer ?? it.answer ?? '');
        return {
          label: `Từ ${i + 1}`,
          student: student || '—',
          correct: corr,
          isCorrect: eq(student, corr),
        };
      });
    }
    case 'word_bank_fill': {
      const gaps: any[] = (taskData?.gaps ?? []).filter((g: any) => !g.isExample);
      return gaps.map((g, i) => {
        const key = String(g.gap_number ?? i + 1);
        const student = get(key);
        const corr = String(g.correct_word ?? g.correctWord ?? '');
        return {
          label: `Chỗ trống ${g.gap_number ?? i + 1}`,
          student: student || '—',
          correct: corr,
          isCorrect: eq(student, corr),
        };
      });
    }
    case 'reading_comprehension': {
      const questions: any[] = taskData?.questions ?? [];
      return questions.map((qq, i) => {
        const student = get(String(i));
        const corr = String(qq.correct_answer ?? qq.correctAnswer ?? qq.answer ?? '');
        return {
          label: qq.question ?? `Câu ${i + 1}`,
          student: student || '—',
          correct: corr,
          isCorrect: eq(student, corr),
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
          key: String(i),
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
        const corr = String(q?.correct_answer ?? q?.correctAnswer ?? q?.answer ?? '');
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

/**
 * Tạo answer map chứa đáp án ĐÚNG từ taskData — dùng để render giao diện thật
 * với đáp án đúng hiển thị (mode answer-key).
 */
export function buildCorrectAnswerMap(taskType: string, taskData: any): KidsAnswerMap {
  const out: KidsAnswerMap = {};
  switch (taskType) {
    case 'listen_and_draw_lines': {
      const items: any[] = taskData?.items ?? [];
      items.forEach((it: any, i: number) => {
        if (it?.isExample || it?.is_example) return;
        out[String(i)] = String(i); // label i → hotspot i
      });
      break;
    }
    case 'listen_and_tick': {
      const its: any[] = taskData?.items ?? taskData?.config?.items ?? [];
      its.forEach((it: any, i: number) => {
        if (it?.isExample || it?.is_example) return;
        out[String(i)] = String(it?.correctAnswer ?? it?.correct_answer ?? '');
      });
      break;
    }
    case 'listen_and_write': {
      const list: any[] = (taskData?.questions?.length ? taskData.questions : (taskData?.items ?? [])) ?? [];
      list.forEach((q: any, i: number) => {
        if (q?.isExample || q?.is_example) return;
        out[String(i)] = String(q?.answer ?? q?.correct_answer ?? q?.correctAnswer ?? '');
      });
      break;
    }
    case 'look_and_read': {
      const list: any[] = (taskData?.questions?.length ? taskData.questions : (taskData?.items ?? [])) ?? [];
      list.forEach((q: any, i: number) => {
        if (q?.isExample || q?.is_example) return;
        const corr = String(q?.correctAnswer ?? q?.correct_answer ?? '').toLowerCase();
        const isTrue = corr === 'tick' || corr === 'true' || corr === 'yes' || corr === '1';
        out[String(i)] = isTrue ? 'true' : 'false';
      });
      break;
    }
    case 'look_read_write': {
      const list: any[] = (taskData?.questions?.length ? taskData.questions : (taskData?.items ?? [])) ?? [];
      list.forEach((q: any, i: number) => {
        if (q?.isExample || q?.is_example) return;
        const qType = String(q?.question_type ?? q?.questionType ?? '');
        if (qType === 'free_write') return;
        out[String(i)] = String(q?.correct_answer ?? q?.correctAnswer ?? q?.answer ?? '');
      });
      break;
    }
    case 'word_bank_fill': {
      const gaps: any[] = (taskData?.gaps ?? []).filter((g: any) => !g.isExample);
      gaps.forEach((g: any, i: number) => {
        out[String(g.gap_number ?? i + 1)] = String(g.correct_word ?? g.correctWord ?? '');
      });
      break;
    }
    case 'cloze_test': {
      const gaps: any[] = taskData?.gaps ?? [];
      gaps.forEach((g: any) => {
        out[String(g.gap_id ?? '')] = String(g.correct_answer ?? g.correctAnswer ?? g.answer ?? '');
      });
      if (taskData?.story_title_question) {
        out['title'] = String(taskData.story_title_question.correct_answer ?? taskData.story_title_question.correctAnswer ?? taskData.story_title_question.answer ?? '');
      }
      break;
    }
    case 'open_cloze': {
      const gaps: any[] = taskData?.gaps ?? [];
      gaps.forEach((g: any) => {
        const accepts: string[] = g.correct_answers ?? g.correctAnswers ?? [];
        out[String(g.gap_id ?? '')] = accepts[0] ?? '';
      });
      break;
    }
    case 'unscramble_words': {
      const items: any[] = (taskData?.items ?? []).filter((it: any) => !it.isExample);
      items.forEach((it: any, i: number) => {
        out[String(i)] = String(it.correct_answer ?? it.correctAnswer ?? it.answer ?? '');
      });
      break;
    }
    case 'reading_comprehension': {
      const questions: any[] = taskData?.questions ?? [];
      questions.forEach((qq: any, i: number) => {
        out[String(i)] = String(qq.correct_answer ?? qq.correctAnswer ?? qq.answer ?? '');
      });
      break;
    }
    case 'dialogue_matching': {
      const dialogues: any[] = taskData?.dialogues ?? [];
      dialogues.forEach((d: any, i: number) => {
        out[String(i)] = String(d.correct_answer ?? d.correctAnswer ?? d.answer ?? '');
      });
      break;
    }
    case 'word_definition_matching': {
      const words: any[] = taskData?.words ?? [];
      words.forEach((_w: any, i: number) => {
        out[String(i)] = String.fromCharCode(65 + i);
      });
      break;
    }
    case 'listening_letter_match': {
      const subjects: any[] = (taskData?.subjects ?? []).filter((s: any) => !(s.is_example ?? s.isExample));
      subjects.forEach((s: any, i: number) => {
        out[String(i)] = String(s.correct_letter ?? s.correctLetter ?? '');
      });
      break;
    }
    case 'odd_one_out': {
      out['0'] = String(taskData?.correct_odd_one ?? '');
      break;
    }
    case 'story_completion': {
      const sentences: any[] = taskData?.completion_sentences ?? [];
      sentences.forEach((s: any, i: number) => {
        out[String(i)] = String(s.correct_answer ?? s.correctAnswer ?? s.answer ?? '');
      });
      break;
    }
  }
  return out;
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
