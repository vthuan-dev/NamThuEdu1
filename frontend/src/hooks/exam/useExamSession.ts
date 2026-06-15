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

const DEFAULT_DRAFT_DEBOUNCE_MS = 1500;
const DEFAULT_HEARTBEAT_MS = 30_000;
const LOCAL_DEBOUNCE_MS = 200;
const TIME_DRIFT_THRESHOLD_SEC = 5;

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

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
  const [timeRemaining, setTimeRemaining] = useState<number>(durationMinutes * 60);
  const [hasOtherTab, setHasOtherTab] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

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
  const submittedRef = useRef(false);
  const onlineRef = useRef(online);
  onlineRef.current = online;

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
    // Cập nhật reference time mỗi khi submissionId / startedAtServer đổi
    const parsed = new Date(startedAtServer).getTime();
    startedAtMsRef.current = Number.isFinite(parsed) ? parsed : Date.now();
    totalDurationSecRef.current = durationMinutes * 60;
    submittedRef.current = false;
    setTimeRemaining(durationMinutes * 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId, startedAtServer, durationMinutes]);

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
      const data = (res as { data?: { timeRemaining?: number } }).data;
      if (data && typeof data.timeRemaining === 'number') {
        // Server-truth time → reconcile drift
        const localRemaining = Math.max(
          0,
          totalDurationSecRef.current - (Date.now() - startedAtMsRef.current) / 1000,
        );
        if (Math.abs(localRemaining - data.timeRemaining) > TIME_DRIFT_THRESHOLD_SEC) {
          totalDurationSecRef.current = data.timeRemaining;
          startedAtMsRef.current = Date.now();
          setTimeRemaining(Math.floor(data.timeRemaining));
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
      try {
        await flushNow();
      } catch {
        /* dù flush fail vẫn cho phép submit — BE sẽ chấm theo gì đã có */
      }
      try {
        const res = customSubmit
          ? await customSubmit(submissionId)
          : await studentApi.submitTest(submissionId);
        examDraftStorage.clear(submissionId);
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
    [submissionId, flushNow, onAutoSubmitted, onSubmitted],
  );

  const submit = useCallback(() => doSubmit('manual'), [doSubmit]);

  // ─── Resume
  const resume = useCallback((draft: ExamDraft) => {
    setAnswers((prev) => ({ ...prev, ...draft.answers }));
  }, []);

  // ─── Time tick (mỗi giây, server-derived)
  useEffect(() => {
    if (!submissionId) return;
    const tick = () => {
      const elapsed = (Date.now() - startedAtMsRef.current) / 1000;
      const remaining = Math.max(0, Math.floor(totalDurationSecRef.current - elapsed));
      setTimeRemaining(remaining);
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
        const data = (res as { data?: { timeRemaining?: number } }).data;
        if (data && typeof data.timeRemaining === 'number') {
          const local = Math.max(
            0,
            totalDurationSecRef.current - (Date.now() - startedAtMsRef.current) / 1000,
          );
          if (Math.abs(local - data.timeRemaining) > TIME_DRIFT_THRESHOLD_SEC) {
            totalDurationSecRef.current = data.timeRemaining;
            startedAtMsRef.current = Date.now();
            setTimeRemaining(Math.floor(data.timeRemaining));
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
  };
}

export default useExamSession;
