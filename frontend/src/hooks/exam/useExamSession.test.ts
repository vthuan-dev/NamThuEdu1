import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useExamSession } from './useExamSession';
import { studentApi } from '../../services/studentApi';
import { examDraftStorage } from '../../lib/exam/examDraftStorage';

vi.mock('../../services/studentApi', () => ({
  studentApi: {
    saveDraft: vi.fn(),
    heartbeat: vi.fn(),
    autoSubmitOnUnload: vi.fn().mockReturnValue(true),
    submitTest: vi.fn(),
  },
}));

describe('useExamSession', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'Date'] });
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const defaultOpts = {
    submissionId: 1,
    examId: 10,
    durationMinutes: 30,
    startedAtServer: new Date(Date.now() - 5 * 60_000).toISOString(),
    examType: 'KIDS',
    role: 'kids' as const,
  };

  it('khởi tạo với answers rỗng và timeRemaining đúng', () => {
    const { result } = renderHook(() => useExamSession(defaultOpts));
    expect(result.current.answers).toEqual({});
    expect(result.current.timeRemaining).toBeGreaterThan(0);
    expect(result.current.saveStatus).toBe('idle');
    expect(result.current.online).toBe(true);
  });

  it('setAnswer cập nhật state ngay lập tức', () => {
    const { result } = renderHook(() => useExamSession(defaultOpts));
    act(() => result.current.setAnswer('101', 'Hello'));
    expect(result.current.answers['101']).toBe('Hello');
  });

  it('debounce server: gọi saveDraft sau ~1.5s', async () => {
    vi.mocked(studentApi.saveDraft).mockResolvedValue({
      data: { status: 'ok', savedCount: 1, serverTime: new Date().toISOString(), timeRemaining: 1500 },
    } as any);

    const { result } = renderHook(() => useExamSession(defaultOpts));
    act(() => result.current.setAnswer('101', 'A'));
    expect(result.current.pendingCount).toBe(1);

    await act(async () => vi.advanceTimersByTimeAsync(2_000));

    expect(studentApi.saveDraft).toHaveBeenCalledTimes(1);
    expect(result.current.saveStatus).toBe('saved');
  });

  it('flushNow ép đẩy queue ngay', async () => {
    vi.mocked(studentApi.saveDraft).mockResolvedValue({
      data: { status: 'ok', savedCount: 1, serverTime: new Date().toISOString(), timeRemaining: 1500 },
    } as any);

    const { result } = renderHook(() => useExamSession(defaultOpts));
    act(() => result.current.setAnswer('101', 'X'));
    await act(async () => { await result.current.flushNow(); });

    expect(studentApi.saveDraft).toHaveBeenCalledTimes(1);
    expect(result.current.saveStatus).toBe('saved');
  });

  it('submit gọi flush + submitTest', async () => {
    vi.mocked(studentApi.saveDraft).mockResolvedValue({ data: { timeRemaining: 100 } } as any);
    vi.mocked(studentApi.submitTest).mockResolvedValue({ data: { data: { submissionId: 1 } } } as any);

    const onSubmitted = vi.fn();
    const { result } = renderHook(() => useExamSession({ ...defaultOpts, onSubmitted }));

    act(() => result.current.setAnswer('101', 'Y'));
    await act(async () => { await result.current.submit(); });

    expect(studentApi.submitTest).toHaveBeenCalledWith(1);
    expect(onSubmitted).toHaveBeenCalled();
  });

  it('hết giờ tự submit', async () => {
    vi.mocked(studentApi.saveDraft).mockResolvedValue({ data: { timeRemaining: 0 } } as any);
    vi.mocked(studentApi.submitTest).mockResolvedValue({ data: { data: { submissionId: 1 } } } as any);

    const onAutoSubmitted = vi.fn();
    const now = Date.now();
    const started = new Date(now - 30 * 60_000).toISOString();
    vi.setSystemTime(now);

    renderHook(() =>
      useExamSession({ ...defaultOpts, startedAtServer: started, onAutoSubmitted }),
    );

    await act(async () => vi.advanceTimersByTimeAsync(3_000));

    expect(studentApi.submitTest).toHaveBeenCalled();
  });

  it('online/offline toggle', () => {
    const { result } = renderHook(() => useExamSession(defaultOpts));
    expect(result.current.online).toBe(true);

    act(() => window.dispatchEvent(new Event('offline')));
    expect(result.current.online).toBe(false);

    act(() => window.dispatchEvent(new Event('online')));
    expect(result.current.online).toBe(true);
  });

  it('resume áp dụng draft', () => {
    const draft = {
      submissionId: 1,
      examId: 10,
      role: 'kids' as const,
      examType: 'KIDS',
      startedAtServer: new Date().toISOString(),
      durationMinutes: 30,
      answers: { '0': 'cat', '1': 'dog' } as Record<string, unknown>,
      serverSyncedAt: null,
      updatedAt: new Date().toISOString(),
      version: 1,
    };
    const { result } = renderHook(() => useExamSession(defaultOpts));
    act(() => result.current.resume(draft));
    expect(result.current.answers).toEqual(expect.objectContaining({ '0': 'cat', '1': 'dog' }));
  });

  it('pendingCount tăng khi có answer chưa flush', () => {
    const { result } = renderHook(() => useExamSession(defaultOpts));
    act(() => result.current.setAnswer('101', 'Z'));
    expect(result.current.pendingCount).toBe(1);
  });
});
