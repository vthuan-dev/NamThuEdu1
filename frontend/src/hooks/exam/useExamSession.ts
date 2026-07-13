/**
 * useExamSession
 * --------------
 * Hook tổng cho mọi trang test taking — gói gọn auto-save, auto-submit,
 * heartbeat, đếm ngược server-truth, đa tab và unload handling.
 *
 * Vai trò trong defense-in-depth:
 *   - Lớp 1: React state (`answers`)
 *   - Lớp 2: localStorage qua `examDraftStorage` (debounce 200ms)
 *   - Lớp 3: Server draft qua `studentApi.saveDraft` (debounce 1500ms)
 *   - Lớp 4: `studentApi.autoSubmitOnUnload` qua `pagehide`
 *   - Lớp 5: cron BE — không liên quan FE
 *
 * Mỗi trang chỉ cần truyền vào `submissionId`, `examId`, `startedAtServer`,
 * `durationMinutes` và serializer (nếu dạng đề khác MCQ/text). Không cần
 * lo logic save / submit / countdown / multi-tab nữa.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  studentApi,
  type DraftAnswer,
  type AutoSubmitReason,
} from '../../services/studentApi';
import {
  examDraftStorage,
  type ExamDraft,
  type ExamRole,
} from '../../lib/exam/examDraftStorage';
import { parseVNDate } from '../../utils/dateUtils';

const DEFAULT_DRAFT_DEBOUNCE_MS = 1500;
const DEFAULT_HEARTBEAT_MS = 30_000;
const LOCAL_DEBOUNCE_MS = 200;
const TIME_DRIFT_THRESHOLD_SEC = 5;
const TIMER_STORAGE_PREFIX = 'exam_timer_deadline';

function timerStorageKey(role: ExamRole, examType: string, submissionId: number): string {
  return `${TIMER_STORAGE_PREFIX}_${role}_${examType}_${submissionId}`;
}

function readStoredDeadline(key: string): number | null {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && value > Date.now() ? value : null;
  } catch {
    return null;
  }
}

function writeStoredDeadline(key: string, deadlineMs: number): void {
  try {
    localStorage.setItem(key, String(deadlineMs));
  } catch {
    /* storage unavailable */
  }
}

function clearStoredDeadline(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
export type TimeWarningLevel = null | '5min' | '1min' | '10sec';

export interface UseExamSessionOptions {
  submissionId: number | null;
  examId: number;
  durationMinutes: number;
  /** ISO string BE trả về tại thời điểm Start — nguồn thời gian thật. */
  startedAtServer: string;
  initialAnswers?: Record<string, unknown>;
  examType: string;
  role: ExamRole;
  /** Debounce gửi lên server (mặc định 1500ms). Writing essay nên đặt 5000ms. */
  draftDebounceMs?: number;
  /** Khoảng heartbeat (mặc định 30s). */
  heartbeatMs?: number;
  /** Có gửi sendBeacon /auto-submit khi pagehide không (mặc định true). */
  enableAutoSubmitOnUnload?: boolean;
  /**
   * Hàm chuyển answer (raw) → DraftAnswer cho BE. Nếu không truyền, dùng
   * default serializer xử lý MCQ (number → answer_id), string → answer_text,
   * object có sẵn answer_id / answer_text → giữ nguyên, còn lại JSON.stringify
   * vào answer_text.
   */
  serializeAnswerForServer?: (qid: string | number, value: unknown) => DraftAnswer | null;
  /** Gọi khi BE auto-submit do hết giờ (FE redirect / hiển thị kết quả). */
  onAutoSubmitted?: (reason: AutoSubmitReason) => void;
  /** Gọi sau khi nộp thủ công thành công. */
  onSubmitted?: (response: unknown) => void;
  /** Tùy chỉnh API call thay vì dùng studentApi mặc định (dùng cho THPT v.v.). */
  customSaveDraft?: (submissionId: number, answers: DraftAnswer[]) => Promise<unknown>;
  customHeartbeat?: (submissionId: number) => Promise<unknown>;
  customSubmit?: (submissionId: number) => Promise<unknown>;
}

export interface UseExamSessionReturn {
  answers: Record<string, unknown>;
  /** Cập nhật một câu — tự ghi RAM + localStorage + server (debounce). */
  setAnswer: (qid: string | number, value: unknown) => void;
  /** Ép đẩy queue lên server ngay lập tức (await được). */
  flushNow: () => Promise<void>;
  /** Nộp bài thủ công (final flush + submitTest). */
  submit: () => Promise<unknown>;
  /** Số giây còn lại (server-derived). */
  timeRemaining: number;
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  online: boolean;
  /** Áp dụng draft từ localStorage (gọi sau khi user xác nhận resume). */
  resume: (draft: ExamDraft) => void;
  /** True khi BroadcastChannel báo có tab khác đang làm cùng submission. */
  hasOtherTab: boolean;
  /** Số câu đang chờ flush lên server. */
  pendingCount: number;
  /** Mức cảnh báo thời gian còn lại: 5min → dismissable, 1min/10sec → bắt buộc. */
  warningLevel: TimeWarningLevel;
  /** Tắt cảnh báo 5min (1min/10sec không cho tắt). */
  dismissWarning: () => void;
}

// ─────────────────────────────────────────── default serializer

function defaultSerialize(qid: string | number, value: unknown): DraftAnswer | null {
  const baseQid = typeof qid === 'string' ? Number(qid) : qid;
  if (!Number.isFinite(baseQid)) return null;
  if (value == null) return null;

  if (typeof value === 'number') {
    return { question_id: baseQid as number, answer_id: value };
  }
  if (typeof value === 'string') {
    return { question_id: baseQid as number, answer_text: value };
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const draft: DraftAnswer = { question_id: baseQid as number };
    if (obj.answer_id != null) {
      const num = Number(obj.answer_id);
      draft.answer_id = Number.isFinite(num) ? num : null;
    }
    if (typeof obj.answer_text === 'string') draft.answer_text = obj.answer_text;
    if (typeof obj.saAnswer_text === 'string') draft.saAnswer_text = obj.saAnswer_text as string;
    if (
      draft.answer_id == null &&
      draft.answer_text == null &&
      draft.saAnswer_text == null
    ) {
      // Object phức tạp (cloze, drag-drop, listen-color, …) → JSON.stringify
      try {
        draft.answer_text = JSON.stringify(obj);
      } catch {
        return null;
      }
    }
    return draft;
  }
  return { question_id: baseQid as number, answer_text: String(value) };
}

// ─────────────────────────────────────────── hook

export function useExamSession(options: UseExamSessionOptions): UseExamSessionReturn {
  const {
    submissionId,
    examId,
    durationMinutes,
    startedAtServer,
    initialAnswers,
    examType,
    role,
    draftDebounceMs = DEFAULT_DRAFT_DEBOUNCE_MS,
    heartbeatMs = DEFAULT_HEARTBEAT_MS,
    enableAutoSubmitOnUnload = true,
    serializeAnswerForServer,
    onAutoSubmitted,
    onSubmitted,
    customSaveDraft,
    customHeartbeat,
    customSubmit,
  } = options;

  // ─── State (visible in UI)
  const [answers, setAnswers] = useState<Record<string, unknown>>(() => ({
    ...(initialAnswers ?? {}),
  }));
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  // Initial: full duration; effect sẽ sync đúng deadline sticky ngay sau mount
  const [timeRemaining, setTimeRemaining] = useState<number>(() =>
    Math.max(0, Math.floor(durationMinutes * 60)),
  );
  const [hasOtherTab, setHasOtherTab] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [warningLevel, setWarningLevel] = useState<TimeWarningLevel>(null);

  // ─── Refs (không trigger re-render)
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const pendingQueueRef = useRef<Map<number, DraftAnswer>>(new Map());
  const serverTimerRef = useRef<number | null>(null);
  const localTimerRef = useRef<number | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);
  const tickTimerRef = useRef<number | null>(null);
  const tabIdRef = useRef<string>(examDraftStorage.generateTabId());
  const startedAtMsRef = useRef<number>(new Date(startedAtServer).getTime() || Date.now());
  const totalDurationSecRef = useRef<number>(durationMinutes * 60);
  const deadlineMsRef = useRef<number | null>(null);
  const timerStorageKeyRef = useRef<string | null>(null);
  const submittedRef = useRef(false);
  const onlineRef = useRef(online);
  onlineRef.current = online;
  const warningLevelRef = useRef<TimeWarningLevel>(null);
  const dismissed5minRef = useRef(false);

  // Cập nhật pendingCount mỗi khi queue đổi (utility nhỏ)
  const syncPendingCount = useCallback(() => {
    setPendingCount(pendingQueueRef.current.size);
  }, []);

  // ─── Serializer: prefer custom; default for common shapes
  const serialize = useCallback(
    (qid: string | number, value: unknown): DraftAnswer | null => {
      if (serializeAnswerForServer) return serializeAnswerForServer(qid, value);
      return defaultSerialize(qid, value);
    },
    [serializeAnswerForServer],
  );

  // ─── Khởi tạo localStorage entry khi vào trang
  useEffect(() => {
    if (!submissionId) return;
    examDraftStorage.save({
      submissionId,
      examId,
      role,
      examType,
      startedAtServer,
      durationMinutes,
      answers: { ...(initialAnswers ?? {}) },
    });
    // Deadline tuyệt đối sticky theo submissionId.
    // Ưu tiên localStorage; chỉ fallback sang startedAt khi CHƯA có mốc.
    // KHÔNG BAO GIỜ ghi đè mốc cũ bằng mốc muộn hơn (tránh đếm lại từ đầu).
    const durationSec = Math.max(1, durationMinutes) * 60;
    const key = timerStorageKey(role, examType, submissionId);
    timerStorageKeyRef.current = key;
    const now = Date.now();
    const storedDeadline = readStoredDeadline(key);
    const parsed = parseVNDate(startedAtServer)?.getTime()
      ?? (startedAtServer ? new Date(startedAtServer).getTime() : NaN);
    const fromStart = Number.isFinite(parsed) ? parsed + durationSec * 1000 : null;

    let deadlineMs: number;
    if (storedDeadline != null && fromStart != null) {
      // Lấy mốc sớm hơn → remaining không nhảy full
      deadlineMs = Math.min(storedDeadline, fromStart);
    } else if (storedDeadline != null) {
      deadlineMs = storedDeadline;
    } else if (fromStart != null) {
      deadlineMs = fromStart;
    } else {
      deadlineMs = now + durationSec * 1000;
    }
    // Không vượt full duration tính từ bây giờ
    deadlineMs = Math.min(deadlineMs, now + durationSec * 1000);

    deadlineMsRef.current = deadlineMs;
    startedAtMsRef.current = deadlineMs - durationSec * 1000;
    totalDurationSecRef.current = durationSec;
    writeStoredDeadline(key, deadlineMs);
    submittedRef.current = false;
    warningLevelRef.current = null;
    dismissed5minRef.current = false;
    setWarningLevel(null);
    setTimeRemaining(Math.max(0, Math.floor((deadlineMs - now) / 1000)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId, startedAtServer, durationMinutes, role, examType]);

  // ─── Flush queue → BE (idempotent)
  const flushQueue = useCallback(async (): Promise<void> => {
    if (!submissionId) return;
    if (pendingQueueRef.current.size === 0) {
      setSaveStatus((prev) => (prev === 'saving' ? 'saved' : prev));
      return;
    }
    if (!onlineRef.current) {
      // Offline → giữ queue, đợi event 'online' tự re-flush
      setSaveStatus('error');
      return;
    }
    const pending = Array.from(pendingQueueRef.current.values());
    pendingQueueRef.current.clear();
    syncPendingCount();
    setSaveStatus('saving');
    try {
      const res = customSaveDraft
        ? await customSaveDraft(submissionId, pending)
        : await studentApi.saveDraft(submissionId, pending);
      const data = (res as { data?: { timeRemaining?: number; time_remaining_seconds?: number } }).data;
      const serverRemaining = data?.timeRemaining ?? data?.time_remaining_seconds;
      if (data && typeof serverRemaining === 'number') {
        // Server-truth time → reconcile drift
        const localRemaining = Math.max(
          0,
          totalDurationSecRef.current - (Date.now() - startedAtMsRef.current) / 1000,
        );
        if (serverRemaining < localRemaining - TIME_DRIFT_THRESHOLD_SEC) {
          const nextDeadline = Date.now() + serverRemaining * 1000;
          totalDurationSecRef.current = serverRemaining;
          startedAtMsRef.current = Date.now();
          deadlineMsRef.current = nextDeadline;
          if (timerStorageKeyRef.current) writeStoredDeadline(timerStorageKeyRef.current, nextDeadline);
          setTimeRemaining(Math.floor(serverRemaining));
        }
      }
      examDraftStorage.markSynced(submissionId);
      setSaveStatus('saved');
      setLastSavedAt(new Date());
      examDraftStorage.broadcast({
        type: 'updated',
        submissionId,
        tabId: tabIdRef.current,
        at: Date.now(),
      });
    } catch (err) {
      // Khôi phục queue để retry
      for (const a of pending) {
        if (!pendingQueueRef.current.has(a.question_id)) {
          pendingQueueRef.current.set(a.question_id, a);
        }
      }
      syncPendingCount();
      setSaveStatus('error');
      console.warn('[useExamSession] saveDraft failed', err);
    }
  }, [submissionId, syncPendingCount]);

  const flushNow = useCallback(async () => {
    if (serverTimerRef.current != null) {
      window.clearTimeout(serverTimerRef.current);
      serverTimerRef.current = null;
    }
    await flushQueue();
  }, [flushQueue]);

  // ─── setAnswer
  const setAnswer = useCallback(
    (qid: string | number, value: unknown) => {
      setAnswers((prev) => ({ ...prev, [qid]: value }));

      // Local debounce → localStorage
      if (localTimerRef.current != null) window.clearTimeout(localTimerRef.current);
      localTimerRef.current = window.setTimeout(() => {
        if (submissionId) {
          examDraftStorage.save({
            submissionId,
            examId,
            role,
            examType,
            startedAtServer,
            durationMinutes,
            answers: { ...answersRef.current, [qid]: value },
          });
        }
      }, LOCAL_DEBOUNCE_MS);

      // Server queue
      const draft = serialize(qid, value);
      if (draft) {
        pendingQueueRef.current.set(draft.question_id, draft);
        syncPendingCount();
      }

      // Server debounce
      if (serverTimerRef.current != null) window.clearTimeout(serverTimerRef.current);
      serverTimerRef.current = window.setTimeout(() => {
        void flushQueue();
      }, draftDebounceMs);
    },
    [
      submissionId,
      examId,
      role,
      examType,
      startedAtServer,
      durationMinutes,
      serialize,
      flushQueue,
      draftDebounceMs,
      syncPendingCount,
    ],
  );

  // ─── Submit (manual hoặc do timer)
  const doSubmit = useCallback(
    async (reason: 'manual' | 'timeout'): Promise<unknown> => {
      if (!submissionId) return null;
      submittedRef.current = true;

      // ── FORCE-FLUSH ALL local answers before submit ────────────────────
      // Kể cả khi queue đã empty (đã debounce save xong), ta vẫn re-push
      // toàn bộ answers từ state để chống mất dữ liệu nếu có save trước
      // đó thất bại âm thầm hoặc bị drop khỏi queue.
      let flushFailedChunks = 0;
      let flushTotalChunks = 0;
      try {
        const allDrafts: DraftAnswer[] = [];
        for (const [qid, value] of Object.entries(answersRef.current)) {
          const draft = serialize(qid, value);
          if (draft) allDrafts.push(draft);
        }
        if (allDrafts.length > 0) {
          // Chunk theo max 200 (giới hạn validator của /draft endpoint)
          const CHUNK_SIZE = 200;
          for (let i = 0; i < allDrafts.length; i += CHUNK_SIZE) {
            const chunk = allDrafts.slice(i, i + CHUNK_SIZE);
            flushTotalChunks++;
            // ⚠️ Retry mỗi chunk tối đa 3 lần với backoff trước khi bỏ cuộc.
            let chunkOk = false;
            let lastErr: any = null;
            for (let attempt = 0; attempt < 3 && !chunkOk; attempt++) {
              try {
                if (customSaveDraft) {
                  await customSaveDraft(submissionId, chunk);
                } else {
                  await studentApi.saveDraft(submissionId, chunk);
                }
                chunkOk = true;
              } catch (err) {
                lastErr = err;
                await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
              }
            }

            // ⚠️ Fallback: nếu /draft fail toàn bộ → thử /answers/bulk endpoint
            // khác (khác URL, khác controller). Nếu cái nào hoạt động thì save ok.
            if (!chunkOk) {
              try {
                const bulkPayload = chunk.map((d) => ({
                  question_id: d.question_id,
                  saAnswer_text: d.saAnswer_text ?? d.answer_text ?? '',
                }));
                await studentApi.bulkSaveAnswers(submissionId, bulkPayload);
                chunkOk = true;
                console.info(
                  '[useExamSession] /draft failed but /answers/bulk fallback succeeded',
                  { reason, chunkSize: chunk.length },
                );
              } catch (bulkErr) {
                lastErr = bulkErr;
              }
            }

            if (!chunkOk) {
              flushFailedChunks++;
              console.warn(
                '[useExamSession] final force-flush chunk failed sau 3 retry + bulk fallback',
                { reason, chunkSize: chunk.length, error: lastErr },
              );
            }
          }
          pendingQueueRef.current.clear();
          syncPendingCount();
        } else {
          // Không có answer nào → vẫn cố gắng flush queue (no-op nếu rỗng)
          await flushNow();
        }
      } catch (err) {
        /* dù force-flush fail vẫn cho phép submit — BE sẽ chấm theo gì đã có */
        console.warn('[useExamSession] submit force-flush error', err);
      }

      // Nếu reason='manual' và CÓ chunk fail → confirm với user trước khi submit.
      // (Timeout submit không thể hỏi vì user đã rời/hết giờ — vẫn cố submit.)
      if (reason === 'manual' && flushFailedChunks > 0) {
        const ok = window.confirm(
          `Có ${flushFailedChunks}/${flushTotalChunks} nhóm câu trả lời chưa lưu được lên server (mạng yếu).\n\n` +
          `• Bấm OK để vẫn nộp bài (server sẽ chấm theo gì đã lưu được).\n` +
          `• Bấm Cancel để dừng và kiểm tra mạng rồi nộp lại.`,
        );
        if (!ok) {
          submittedRef.current = false;
          throw new Error('Người dùng huỷ nộp bài do save thất bại.');
        }
      }

      try {
        const res = customSubmit
          ? await customSubmit(submissionId)
          : await studentApi.submitTest(submissionId);
        examDraftStorage.clear(submissionId);
        if (timerStorageKeyRef.current) clearStoredDeadline(timerStorageKeyRef.current);
        examDraftStorage.broadcast({
          type: 'release',
          submissionId,
          tabId: tabIdRef.current,
          at: Date.now(),
        });
        if (reason === 'timeout' && onAutoSubmitted) onAutoSubmitted('timeout');
        if (onSubmitted) onSubmitted(res);
        return res;
      } catch (err) {
        submittedRef.current = false;
        throw err;
      }
    },
    [submissionId, flushNow, onAutoSubmitted, onSubmitted, serialize, customSaveDraft, customSubmit, syncPendingCount],
  );

  const submit = useCallback(() => doSubmit('manual'), [doSubmit]);

  // ─── Resume
  const resume = useCallback((draft: ExamDraft) => {
    setAnswers((prev) => ({ ...prev, ...draft.answers }));
  }, []);

  // ─── Dismiss warning (chỉ 5min cho dismiss; 1min/10sec bắt buộc)
  const dismissWarning = useCallback(() => {
    if (warningLevelRef.current === '5min') {
      dismissed5minRef.current = true;
      warningLevelRef.current = null;
      setWarningLevel(null);
    }
  }, []);

  // ─── Time tick (mỗi giây, server-derived) + warning thresholds
  useEffect(() => {
    if (!submissionId) return;
    const tick = () => {
      const remaining = deadlineMsRef.current != null
        ? Math.max(0, Math.floor((deadlineMsRef.current - Date.now()) / 1000))
        : Math.max(0, Math.floor(totalDurationSecRef.current - (Date.now() - startedAtMsRef.current) / 1000));
      setTimeRemaining(remaining);

      // Warning thresholds — chỉ escalate, không downgrade
      if (remaining <= 10 && warningLevelRef.current !== '10sec') {
        warningLevelRef.current = '10sec';
        setWarningLevel('10sec');
      } else if (remaining <= 60 && !warningLevelRef.current) {
        warningLevelRef.current = '1min';
        setWarningLevel('1min');
      } else if (remaining <= 300 && !warningLevelRef.current && !dismissed5minRef.current) {
        warningLevelRef.current = '5min';
        setWarningLevel('5min');
      }

      if (remaining <= 0 && !submittedRef.current) {
        submittedRef.current = true;
        void doSubmit('timeout');
      }
    };
    tick();
    tickTimerRef.current = window.setInterval(tick, 1000);
    return () => {
      if (tickTimerRef.current != null) window.clearInterval(tickTimerRef.current);
    };
  }, [submissionId, doSubmit]);

  // ─── Heartbeat
  useEffect(() => {
    if (!submissionId) return;
    const tick = async () => {
      if (!onlineRef.current || submittedRef.current) return;
      try {
        const res = customHeartbeat
          ? await customHeartbeat(submissionId)
          : await studentApi.heartbeat(submissionId);
        const data = (res as { data?: { timeRemaining?: number; time_remaining_seconds?: number } }).data;
        const serverRemaining = data?.timeRemaining ?? data?.time_remaining_seconds;
        if (data && typeof serverRemaining === 'number') {
          const local = Math.max(
            0,
            totalDurationSecRef.current - (Date.now() - startedAtMsRef.current) / 1000,
          );
          if (serverRemaining < local - TIME_DRIFT_THRESHOLD_SEC) {
            const nextDeadline = Date.now() + serverRemaining * 1000;
            totalDurationSecRef.current = serverRemaining;
            startedAtMsRef.current = Date.now();
            deadlineMsRef.current = nextDeadline;
            if (timerStorageKeyRef.current) writeStoredDeadline(timerStorageKeyRef.current, nextDeadline);
            setTimeRemaining(Math.floor(serverRemaining));
          }
        }
      } catch {
        /* network jitter — bỏ qua */
      }
    };
    heartbeatTimerRef.current = window.setInterval(tick, heartbeatMs);
    return () => {
      if (heartbeatTimerRef.current != null) window.clearInterval(heartbeatTimerRef.current);
    };
  }, [submissionId, heartbeatMs]);

  // ─── Online / offline
  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      onlineRef.current = true;
      if (pendingQueueRef.current.size > 0) void flushQueue();
    };
    const onOffline = () => {
      setOnline(false);
      onlineRef.current = false;
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [flushQueue]);

  // ─── Pagehide (auto-submit) + visibilitychange (best-effort flush)
  useEffect(() => {
    if (!submissionId) return;
    const onPagehide = () => {
      if (submittedRef.current) return;
      const pending = Array.from(pendingQueueRef.current.values());
      if (enableAutoSubmitOnUnload) {
        studentApi.autoSubmitOnUnload(submissionId, {
          reason: 'unload',
          answers: pending.length ? pending : undefined,
        });
      } else if (pending.length) {
        studentApi.saveDraftOnUnload(submissionId, pending);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState !== 'hidden') return;
      // Tab ẩn — chỉ flush draft, không submit. Người dùng có thể switch tab tạm.
      if (pendingQueueRef.current.size > 0) void flushQueue();
    };
    window.addEventListener('pagehide', onPagehide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onPagehide);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [submissionId, enableAutoSubmitOnUnload, flushQueue]);

  // ─── Multi-tab via BroadcastChannel
  useEffect(() => {
    if (!submissionId) return;
    examDraftStorage.broadcast({
      type: 'claim',
      submissionId,
      tabId: tabIdRef.current,
      at: Date.now(),
    });
    const unsub = examDraftStorage.subscribe((event) => {
      if (event.tabId === tabIdRef.current) return;
      if (event.submissionId !== submissionId) return;
      if (event.type === 'claim') setHasOtherTab(true);
      if (event.type === 'release') setHasOtherTab(false);
    });
    return () => {
      examDraftStorage.broadcast({
        type: 'release',
        submissionId,
        tabId: tabIdRef.current,
        at: Date.now(),
      });
      unsub();
    };
  }, [submissionId]);

  // ─── beforeunload confirm (giống Google Forms / trang luyện thi)
  useEffect(() => {
    if (!submissionId) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (submittedRef.current) return;
      const hasAnswers = Object.keys(answersRef.current).length > 0;
      const hasPending = pendingQueueRef.current.size > 0;
      if (hasAnswers || hasPending) {
        e.preventDefault();
        // Modern browsers ignore custom message; just need non-empty returnValue
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [submissionId]);

  // ─── Cleanup chung
  useEffect(() => {
    return () => {
      if (serverTimerRef.current != null) window.clearTimeout(serverTimerRef.current);
      if (localTimerRef.current != null) window.clearTimeout(localTimerRef.current);
    };
  }, []);

  return {
    answers,
    setAnswer,
    flushNow,
    submit,
    timeRemaining,
    saveStatus,
    lastSavedAt,
    online,
    resume,
    hasOtherTab,
    pendingCount,
    warningLevel,
    dismissWarning,
  };
}

export default useExamSession;
