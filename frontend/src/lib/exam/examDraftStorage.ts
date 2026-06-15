/**
 * examDraftStorage
 * ----------------
 * Lớp lưu trữ phía client cho trạng thái bài thi đang làm dở.
 *
 * Mục đích:
 *   - Là Lớp 2 trong defense-in-depth (RAM → localStorage → server draft → sendBeacon → cron).
 *   - Khi student reload, mất mạng, crash trình duyệt — answers vẫn nằm ở localStorage.
 *   - Hỗ trợ phát hiện đa tab qua BroadcastChannel để cảnh báo "đang làm bài này ở tab khác".
 *
 * Triết lý:
 *   - Fail soft. Nếu localStorage bị quota / disabled → log warn, không crash app.
 *   - Mọi method đều idempotent và không throw.
 */

const STORAGE_PREFIX = 'exam-draft:';
const INDEX_KEY = 'exam-draft:_index';
const BC_NAME = 'exam-draft';
const SCHEMA_VERSION = 1;

export type ExamRole = 'kids' | 'teens' | 'adults';

export interface ExamDraft {
  submissionId: number;
  examId: number;
  role: ExamRole;
  examType: string;             // VSTEP | IELTS | THPT | KIDS | CAMBRIDGE_YL | …
  startedAtServer: string;      // ISO timestamp BE trả về khi bấm Start
  durationMinutes: number;
  /**
   * Map questionId → giá trị đáp án (dạng tuỳ thuộc dạng đề).
   *
   * Ví dụ:
   *   - MCQ:   { answer_id: 45 }
   *   - Fill:  { answer_text: "Hello" }
   *   - Cloze: { answer_text: '{"0":"a","1":"b"}' }
   */
  answers: Record<string, unknown>;
  /** Thời điểm BE confirm save thành công gần nhất. */
  serverSyncedAt: string | null;
  /** Thời điểm cập nhật cục bộ gần nhất (cho merge khi resume). */
  updatedAt: string;
  version: number;
}

export interface ExamDraftPartial {
  submissionId: number;
  examId?: number;
  role?: ExamRole;
  examType?: string;
  startedAtServer?: string;
  durationMinutes?: number;
  answers?: Record<string, unknown>;
  serverSyncedAt?: string | null;
}

// ───────────────────────────────────────────────────────── helpers

function safeStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    // Một số môi trường (private mode, embedded webview) có thể throw khi truy cập.
    return window.localStorage;
  } catch {
    return null;
  }
}

function key(submissionId: number): string {
  return `${STORAGE_PREFIX}${submissionId}`;
}

function loadIndex(): number[] {
  const ls = safeStorage();
  if (!ls) return [];
  try {
    const raw = ls.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is number => typeof x === 'number') : [];
  } catch {
    return [];
  }
}

function saveIndex(ids: number[]): void {
  const ls = safeStorage();
  if (!ls) return;
  try {
    ls.setItem(INDEX_KEY, JSON.stringify(Array.from(new Set(ids))));
  } catch {
    /* quota or disabled — ignore */
  }
}

function getBroadcastChannel(): BroadcastChannel | null {
  try {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
    return new BroadcastChannel(BC_NAME);
  } catch {
    return null;
  }
}

// ───────────────────────────────────────────────────────── public API

/**
 * Đọc draft theo submissionId. Trả null nếu không có hoặc parse lỗi.
 */
export function load(submissionId: number): ExamDraft | null {
  const ls = safeStorage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(key(submissionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ExamDraft;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.submissionId !== submissionId) return null;
    return parsed;
  } catch (err) {
    console.warn('[examDraftStorage] parse error', err);
    return null;
  }
}

/**
 * Merge + ghi đè draft. Tự cập nhật `updatedAt`. Không throw.
 *
 * Nếu draft chưa có thì các trường meta (examId, role, examType, ...) phải được
 * cung cấp lần đầu — gọi từ trang test taking ngay sau khi nhận response Start.
 */
export function save(partial: ExamDraftPartial): ExamDraft | null {
  const ls = safeStorage();
  if (!ls) return null;

  const existing = load(partial.submissionId);
  const merged: ExamDraft = {
    submissionId: partial.submissionId,
    examId: partial.examId ?? existing?.examId ?? 0,
    role: partial.role ?? existing?.role ?? 'kids',
    examType: partial.examType ?? existing?.examType ?? 'UNKNOWN',
    startedAtServer:
      partial.startedAtServer ?? existing?.startedAtServer ?? new Date().toISOString(),
    durationMinutes: partial.durationMinutes ?? existing?.durationMinutes ?? 0,
    answers: { ...(existing?.answers ?? {}), ...(partial.answers ?? {}) },
    serverSyncedAt: partial.serverSyncedAt ?? existing?.serverSyncedAt ?? null,
    updatedAt: new Date().toISOString(),
    version: SCHEMA_VERSION,
  };

  try {
    ls.setItem(key(partial.submissionId), JSON.stringify(merged));
    const idx = loadIndex();
    if (!idx.includes(partial.submissionId)) {
      saveIndex([...idx, partial.submissionId]);
    }
    return merged;
  } catch (err) {
    // Quota exceeded hoặc disabled — không crash, chỉ log để dev biết.
    console.warn('[examDraftStorage] write failed', err);
    return null;
  }
}

/**
 * Cập nhật riêng phần answers. Tiện cho hot path khi user gõ liên tục.
 */
export function patchAnswers(
  submissionId: number,
  patch: Record<string, unknown>,
): ExamDraft | null {
  return save({ submissionId, answers: patch });
}

/**
 * Đánh dấu đã đồng bộ thành công với server tại thời điểm hiện tại.
 */
export function markSynced(submissionId: number): ExamDraft | null {
  return save({ submissionId, serverSyncedAt: new Date().toISOString() });
}

/**
 * Xoá draft. Gọi sau khi nộp bài thành công hoặc khi user chủ động huỷ.
 */
export function clear(submissionId: number): void {
  const ls = safeStorage();
  if (!ls) return;
  try {
    ls.removeItem(key(submissionId));
    saveIndex(loadIndex().filter((id) => id !== submissionId));
  } catch {
    /* ignore */
  }
}

/**
 * Liệt kê tất cả draft còn lại (cho dashboard "bài đang làm dở").
 * Tự dọn các id mồ côi (trong index nhưng entry đã mất).
 */
export function listInProgress(): ExamDraft[] {
  const ls = safeStorage();
  if (!ls) return [];
  const ids = loadIndex();
  const drafts: ExamDraft[] = [];
  const survivors: number[] = [];
  for (const id of ids) {
    const draft = load(id);
    if (draft) {
      drafts.push(draft);
      survivors.push(id);
    }
  }
  if (survivors.length !== ids.length) saveIndex(survivors);
  return drafts;
}

// ───────────────────────────────────────────────────────── multi-tab

export type ExamDraftBroadcastEvent =
  | { type: 'claim'; submissionId: number; tabId: string; at: number }
  | { type: 'release'; submissionId: number; tabId: string; at: number }
  | { type: 'updated'; submissionId: number; tabId: string; at: number };

/**
 * Phát thông điệp tới các tab khác. Trả false nếu môi trường không hỗ trợ.
 */
export function broadcast(event: ExamDraftBroadcastEvent): boolean {
  const bc = getBroadcastChannel();
  if (!bc) return false;
  try {
    bc.postMessage(event);
    return true;
  } catch {
    return false;
  } finally {
    try {
      bc.close();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Lắng nghe broadcast. Trả unsubscribe function.
 *
 * Lưu ý: callback có thể được gọi từ tab khác hoặc chính tab hiện tại — ở phía
 * caller nên so sánh `tabId` để bỏ qua sự kiện do chính mình phát.
 */
export function subscribe(
  handler: (event: ExamDraftBroadcastEvent) => void,
): () => void {
  const bc = getBroadcastChannel();
  if (!bc) return () => undefined;
  const onMessage = (e: MessageEvent) => {
    if (e?.data && typeof e.data === 'object') {
      handler(e.data as ExamDraftBroadcastEvent);
    }
  };
  bc.addEventListener('message', onMessage);
  return () => {
    try {
      bc.removeEventListener('message', onMessage);
      bc.close();
    } catch {
      /* ignore */
    }
  };
}

/**
 * Sinh tabId duy nhất cho session hiện tại — dùng để phân biệt phát/nhận.
 */
export function generateTabId(): string {
  // Không cần crypto-strong, chỉ cần unique trong cùng một browser profile.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export const examDraftStorage = {
  load,
  save,
  patchAnswers,
  markSynced,
  clear,
  listInProgress,
  broadcast,
  subscribe,
  generateTabId,
  SCHEMA_VERSION,
};

export default examDraftStorage;
