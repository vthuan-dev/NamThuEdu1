/**
 * Tests for ThptGradingDetail (Teens / THPT teacher grading screen).
 *
 * Covers tasks 9.2–9.7:
 *  - Two-track render + AI-default score (9.2)
 *  - Diff badge + "Dùng điểm AI" reset (9.3)
 *  - Score validation 0–10 blocks publish (9.4)
 *  - AudioPlayer states (9.5)
 *  - Loading / error+retry / ai_pending states (9.6)
 *  - Publish flow + draft durability on failure (9.7)
 *
 * Strategy: mock the API client, the global toast context, router navigation,
 * and getFullMediaUrl so assertions target the real DOM produced by the
 * component (text/labels read directly from ThptGradingDetail.tsx).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { GradingData } from '../../../../../services/thptGradingApi';

// ─── Mock fns (declared before vi.mock; referenced lazily inside factories) ──
const getGrading = vi.fn();
const saveGrading = vi.fn();
const navigateMock = vi.fn();
const toastMock = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
};

vi.mock('../../../../../services/thptGradingApi', () => ({
  thptGradingApi: {
    getGrading: (...args: unknown[]) => getGrading(...args),
    saveGrading: (...args: unknown[]) => saveGrading(...args),
  },
}));

vi.mock('../../../../../contexts/ToastContext', () => ({
  useToastContext: () => toastMock,
}));

vi.mock('../../../../../utils/mediaUtils', () => ({
  // Pass-through: keep relative/absolute URLs as given, null stays null.
  getFullMediaUrl: (u: string | null | undefined) => (u ? u : null),
}));

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return { ...actual, useNavigate: () => navigateMock };
});

import { ThptGradingDetail } from '../ThptGradingDetail';

// ─── Data builders ───────────────────────────────────────────────────────────
function makeData(): GradingData {
  return {
    submission_id: 123,
    exam: { id: 1, title: 'Đề THPT Thử Nghiệm', type: 'THPT' },
    student: { id: 2, name: 'Nguyễn Văn A' },
    submitted_at: '2026-01-01T00:00:00Z',
    status: 'submitted',
    ai_speaking_pending: false,
    objective: { raw_score: 8, raw_score_max: 10, scaled_score: 8, scale_max: 10 },
    overall_teacher_feedback: '',
    current_total: 6.8,
    answers: {},
    correct_answers: {},
    subjective_questions: [],
    sections: [
      {
        section_id: 'sec-obj',
        type: 'mc_questions',
        title: 'Phần Trắc nghiệm',
        instructions: null,
        kind: 'objective',
        score: { correct_count: 1, total_count: 1, raw_score: 1, raw_max: 1 },
        questions: [
          {
            question_number: 1,
            key: 'q1',
            kind: 'mcq',
            prompt: 'What is the capital of Vietnam?',
            options: [
              { id: 'A', text: 'Hanoi' },
              { id: 'B', text: 'Paris' },
            ],
            student_answer: 'A',
            correct_answer: 'A',
            is_correct: true,
          },
        ],
      },
      {
        section_id: 'sec-spk',
        type: 'speaking',
        title: 'Phần Nói',
        instructions: 'Trả lời các câu hỏi sau.',
        kind: 'subjective',
        score: null,
        questions: [
          {
            question_number: 5,
            skill: 'speaking',
            prompt: 'Describe your hometown.',
            audio_url: 'https://cdn.example.com/audio/q5.mp3',
            status: 'ai_graded',
            ai: {
              score: 7,
              criteria: { pronunciation: 6.5, content: 7.5 },
              feedback: 'Phát âm rõ ràng, nội dung tốt.',
              suggestions: ['Nói chậm lại một chút', 'Dùng từ vựng đa dạng hơn'],
              transcript: 'My hometown is Da Nang, a coastal city.',
            },
            teacher: null,
          },
        ],
      },
    ],
  };
}

function makeDataAudioNull(): GradingData {
  const d = makeData();
  (d.sections[1].questions as any)[0].audio_url = null;
  return d;
}

function makeDataPending(): GradingData {
  const d = makeData();
  d.ai_speaking_pending = true;
  const q = (d.sections[1].questions as any)[0];
  q.status = 'ai_pending';
  q.ai = null;
  return d;
}

// Render and wait until the "ready" view is shown.
async function renderReady(data: GradingData) {
  getGrading.mockResolvedValue(data);
  const utils = render(<ThptGradingDetail submissionId={123} />);
  await screen.findByRole('button', { name: /Lưu.*phát hành/ });
  return utils;
}

// The teacher final-score input is the number input whose initial value
// equals the AI score (criteria inputs carry different values).
function getScoreInput(value: string) {
  return screen.getByDisplayValue(value) as HTMLInputElement;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ThptGradingDetail — two-track render & AI default (9.2)', () => {
  it('shows AI score/criteria/feedback/suggestions/transcript and defaults teacher score to ai.score', async () => {
    await renderReady(makeData());

    // AI panel score (formatted to 1 decimal).
    expect(screen.getByText('7.0')).toBeInTheDocument();
    // AI criteria labels (appear in multiple places) + their unique values.
    expect(screen.getAllByText(/Phát âm/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Nội dung/).length).toBeGreaterThan(0);
    expect(screen.getByText('6.5')).toBeInTheDocument();
    expect(screen.getByText('7.5')).toBeInTheDocument();
    // AI feedback + suggestions.
    expect(screen.getByText('Phát âm rõ ràng, nội dung tốt.')).toBeInTheDocument();
    expect(screen.getByText('Nói chậm lại một chút')).toBeInTheDocument();
    expect(screen.getByText('Dùng từ vựng đa dạng hơn')).toBeInTheDocument();
    // Transcript (inside collapsible details, still in the DOM).
    expect(screen.getByText(/My hometown is Da Nang/)).toBeInTheDocument();

    // Teacher final-score input defaults to ai.score (7 → "7").
    const scoreInput = getScoreInput('7');
    expect(scoreInput).toBeInTheDocument();
    expect(scoreInput.value).toBe('7');
  });
});

describe('ThptGradingDetail — diff badge & "Dùng điểm AI" (9.3)', () => {
  it('shows a signed diff badge when teacher score differs, and resets on "Dùng điểm AI"', async () => {
    await renderReady(makeData());

    // No diff badge when teacher score == ai score.
    expect(screen.queryByText(/so với AI/)).not.toBeInTheDocument();

    const scoreInput = getScoreInput('7');
    fireEvent.change(scoreInput, { target: { value: '9' } });

    // Diff badge appears: +2.0 vs AI.
    const badge = await screen.findByText(/so với AI/);
    expect(badge).toHaveTextContent(/\+2\.0/);

    // Click reset.
    fireEvent.click(screen.getByRole('button', { name: /Dùng điểm AI/ }));

    // Back to ai.score and badge gone.
    await waitFor(() => expect(getScoreInput('7').value).toBe('7'));
    expect(screen.queryByText(/so với AI/)).not.toBeInTheDocument();
  });
});

describe('ThptGradingDetail — score validation (9.4)', () => {
  it('shows inline error for out-of-range score and disables publish', async () => {
    await renderReady(makeData());

    const scoreInput = getScoreInput('7');
    fireEvent.change(scoreInput, { target: { value: '12' } });

    expect(await screen.findByText(/Điểm phải trong khoảng/)).toBeInTheDocument();

    const publishBtn = screen.getByRole('button', { name: /Lưu.*phát hành/ });
    expect(publishBtn).toBeDisabled();
  });
});

describe('ThptGradingDetail — AudioPlayer states (9.5)', () => {
  it('renders an <audio> element when audio_url is present', async () => {
    const { container } = await renderReady(makeData());
    const audio = container.querySelector('audio');
    expect(audio).not.toBeNull();
    expect(audio?.getAttribute('src')).toContain('q5.mp3');
  });

  it('shows the "chưa ghi âm" message when audio_url is null', async () => {
    const { container } = await renderReady(makeDataAudioNull());
    expect(screen.getByText(/chưa ghi âm/)).toBeInTheDocument();
    expect(container.querySelector('audio')).toBeNull();
  });
});

describe('ThptGradingDetail — loading / error / pending states (9.6)', () => {
  it('shows a spinner while loading', () => {
    // Never-resolving promise keeps the component in the loading state.
    getGrading.mockReturnValue(new Promise(() => {}));
    const { container } = render(<ThptGradingDetail submissionId={123} />);
    expect(container.querySelector('.animate-spin')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /Lưu.*phát hành/ })).not.toBeInTheDocument();
  });

  it('shows an error view whose retry button re-calls getGrading', async () => {
    getGrading.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(makeData());

    render(<ThptGradingDetail submissionId={123} />);

    const retry = await screen.findByRole('button', { name: /Thử lại/ });
    expect(getGrading).toHaveBeenCalledTimes(1);

    fireEvent.click(retry);

    await screen.findByRole('button', { name: /Lưu.*phát hành/ });
    expect(getGrading).toHaveBeenCalledTimes(2);
  });

  it('shows an "AI đang chấm" badge for ai_pending questions', async () => {
    await renderReady(makeDataPending());
    expect(screen.getAllByText(/AI đang chấm/).length).toBeGreaterThan(0);
  });
});

describe('ThptGradingDetail — publish flow & draft durability (9.7)', () => {
  it('on success shows a confirmation toast and navigates back', async () => {
    saveGrading.mockResolvedValue({});
    await renderReady(makeData());

    fireEvent.click(screen.getByRole('button', { name: /Lưu.*phát hành/ }));

    // Confirmation dialog appears.
    const confirmBtn = await screen.findByRole('button', { name: /Xác nhận phát hành/ });
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(saveGrading).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalled());
    expect(navigateMock).toHaveBeenCalledWith('/giao-vien/cham-diem');
  });

  it('on failure shows an error toast and preserves the entered draft', async () => {
    saveGrading.mockRejectedValue({ response: { data: { message: 'Lỗi máy chủ' } } });
    await renderReady(makeData());

    // Enter a teacher override that must survive the failed save.
    const scoreInput = getScoreInput('7');
    fireEvent.change(scoreInput, { target: { value: '9' } });

    fireEvent.click(screen.getByRole('button', { name: /Lưu.*phát hành/ }));
    const confirmBtn = await screen.findByRole('button', { name: /Xác nhận phát hành/ });
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
    expect(navigateMock).not.toHaveBeenCalled();

    // Draft value preserved.
    expect(getScoreInput('9').value).toBe('9');
  });
});
