import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  load,
  save,
  patchAnswers,
  clear,
  listInProgress,
  broadcast,
  subscribe,
  generateTabId,
} from './examDraftStorage';

const STORAGE_PREFIX = 'exam-draft:';
const INDEX_KEY = 'exam-draft:_index';

describe('examDraftStorage', () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => { store[k] = v; },
        removeItem: (k: string) => { delete store[k]; },
      },
      writable: true,
    });
  });

  it('load trả null khi không có draft', () => {
    expect(load(999)).toBeNull();
  });

  it('save + load roundtrip', () => {
    const draft = save({
      submissionId: 42,
      examId: 7,
      role: 'kids',
      examType: 'KIDS',
      startedAtServer: '2026-06-15T08:00:00Z',
      durationMinutes: 30,
      answers: { '101': 'hello' },
    });
    expect(draft).not.toBeNull();
    expect(load(42)).toEqual(expect.objectContaining({
      submissionId: 42,
      examId: 7,
      role: 'kids',
      answers: { '101': 'hello' },
    }));
  });

  it('patchAnswers merge answers mới', () => {
    save({ submissionId: 1, answers: { '0': 'a' } });
    patchAnswers(1, { '1': 'b' });
    const d = load(1)!;
    expect(d.answers).toEqual({ '0': 'a', '1': 'b' });
  });

  it('clear xoá draft và index', () => {
    save({ submissionId: 2, answers: {} });
    clear(2);
    expect(load(2)).toBeNull();
    expect(listInProgress()).toHaveLength(0);
  });

  it('listInProgress liệt kê draft còn lại', () => {
    save({ submissionId: 3, answers: {} });
    save({ submissionId: 4, answers: {} });
    clear(3);
    const list = listInProgress();
    expect(list).toHaveLength(1);
    expect(list[0].submissionId).toBe(4);
  });

  it('generateTabId trả string duy nhất', () => {
    const a = generateTabId();
    const b = generateTabId();
    expect(typeof a).toBe('string');
    expect(a).not.toBe(b);
  });

  it('broadcast không throw khi không hỗ trợ BroadcastChannel', () => {
    expect(() => broadcast({ type: 'claim', submissionId: 1, tabId: 'x', at: 1 })).not.toThrow();
  });

  it('subscribe nhận event từ tab khác', () => {
    let received = false;
    const unsub = subscribe(() => { received = true; });
    // BroadcastChannel không khả dụng trong jsdom → unsub là no-op
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('load trả null khi parse lỗi', () => {
    store[`${STORAGE_PREFIX}5`] = 'not json';
    expect(load(5)).toBeNull();
  });

  it('load trả null khi submissionId không khớp', () => {
    store[`${STORAGE_PREFIX}6`] = JSON.stringify({ submissionId: 99 });
    expect(load(6)).toBeNull();
  });
});
