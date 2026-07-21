/**
 * Unit tests cho vstepApi (Writing + Speaking).
 * Mock module './api' (axios instance) và xác nhận mỗi hàm gọi đúng
 * endpoint + HTTP method, đồng thời unwrap `.data` từ response.
 *
 * Trọng tâm: 2 hàm xoá mới (deleteVstepWritingTask / deleteVstepSpeakingPart)
 * phục vụ tính năng "tạo đề từng phần" (optional task/part).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();
const del = vi.fn();

vi.mock('./api', () => ({
  api: {
    get: (...a: any[]) => get(...a),
    post: (...a: any[]) => post(...a),
    put: (...a: any[]) => put(...a),
    delete: (...a: any[]) => del(...a),
  },
}));

import {
  saveVstepWritingTask,
  publishVstepWritingExam,
  loadVstepWritingExam,
  deleteVstepWritingTask,
  saveVstepSpeakingPart,
  publishVstepSpeakingExam,
  loadVstepSpeakingExam,
  deleteVstepSpeakingPart,
} from './vstepApi';

const ok = (data: any) => Promise.resolve({ data });

beforeEach(() => {
  vi.clearAllMocks();
  get.mockReturnValue(ok({ status: 'success', data: {} }));
  post.mockReturnValue(ok({ status: 'success' }));
  put.mockReturnValue(ok({ status: 'success' }));
  del.mockReturnValue(ok({ status: 'success' }));
});

describe('vstepApi - Writing', () => {
  it('saveVstepWritingTask gọi POST đúng path kèm payload', async () => {
    const payload = {
      taskNumber: 1,
      taskName: 'Task 1',
      prompt: 'Write an email.',
    } as any;
    await saveVstepWritingTask('exam-1', 1, payload);
    expect(post).toHaveBeenCalledWith(
      '/teacher/exams/exam-1/vstep/writing/tasks/1',
      payload
    );
  });

  it('publishVstepWritingExam gọi POST /publish', async () => {
    const payload = { title: 'Đề 1', tasks: [] } as any;
    await publishVstepWritingExam('exam-1', payload);
    expect(post).toHaveBeenCalledWith(
      '/teacher/exams/exam-1/vstep/writing/publish',
      payload
    );
  });

  it('loadVstepWritingExam (teacher) gọi GET /load', async () => {
    await loadVstepWritingExam('exam-1');
    expect(get).toHaveBeenCalledWith('/teacher/exams/exam-1/vstep/writing/load');
  });

  it('loadVstepWritingExam (admin) gọi GET preview', async () => {
    await loadVstepWritingExam('exam-1', true);
    expect(get).toHaveBeenCalledWith(
      '/admin/exams/exam-1/preview/vstep/writing'
    );
  });

  it('deleteVstepWritingTask gọi DELETE đúng path và unwrap data', async () => {
    del.mockReturnValue(
      ok({ status: 'success', data: { remaining_writing_questions: 1 } })
    );
    const res = await deleteVstepWritingTask('exam-1', 2);
    expect(del).toHaveBeenCalledWith(
      '/teacher/exams/exam-1/vstep/writing/tasks/2'
    );
    expect(res.data.remaining_writing_questions).toBe(1);
  });
});

describe('vstepApi - Speaking', () => {
  it('saveVstepSpeakingPart gọi POST đúng path kèm payload', async () => {
    const payload = { partName: 'Part 1', timeLimit: 3 } as any;
    await saveVstepSpeakingPart('exam-2', 1, payload);
    expect(post).toHaveBeenCalledWith(
      '/teacher/exams/exam-2/vstep/speaking/parts/1',
      payload
    );
  });

  it('publishVstepSpeakingExam gọi POST /publish', async () => {
    const payload = { title: 'Đề nói', parts: [] } as any;
    await publishVstepSpeakingExam('exam-2', payload);
    expect(post).toHaveBeenCalledWith(
      '/teacher/exams/exam-2/vstep/speaking/publish',
      payload
    );
  });

  it('loadVstepSpeakingExam (teacher) gọi GET /load', async () => {
    await loadVstepSpeakingExam('exam-2');
    expect(get).toHaveBeenCalledWith(
      '/teacher/exams/exam-2/vstep/speaking/load'
    );
  });

  it('loadVstepSpeakingExam (admin) gọi GET preview', async () => {
    await loadVstepSpeakingExam('exam-2', true);
    expect(get).toHaveBeenCalledWith(
      '/admin/exams/exam-2/preview/vstep/speaking'
    );
  });

  it('deleteVstepSpeakingPart gọi DELETE đúng path và unwrap data', async () => {
    del.mockReturnValue(
      ok({ status: 'success', data: { remaining_speaking_questions: 2 } })
    );
    const res = await deleteVstepSpeakingPart('exam-2', 3);
    expect(del).toHaveBeenCalledWith(
      '/teacher/exams/exam-2/vstep/speaking/parts/3'
    );
    expect(res.data.remaining_speaking_questions).toBe(2);
  });
});
