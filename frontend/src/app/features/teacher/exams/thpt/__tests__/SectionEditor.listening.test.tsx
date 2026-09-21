import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AcceptedAnswersInput, SectionEditor } from '../editors/SectionEditor';
import { makeListeningFillItem, makeListeningMcItem } from '../sections';
import type { ListeningSection, ThptSection } from '@/types/thpt';

describe('AcceptedAnswersInput', () => {
  function Wrapper({ initialValue = ['12 to 16'] }: { initialValue?: string[] }) {
    const [val, setVal] = useState<string[]>(initialValue);
    return (
      <div>
        <AcceptedAnswersInput value={val} onChange={setVal} placeholder="test placeholder" />
        <div data-testid="current-val">{JSON.stringify(val)}</div>
      </div>
    );
  }

  it('allows typing a comma without erasing it or losing cursor context', async () => {
    const user = userEvent.setup();
    render(<Wrapper initialValue={['12 to 16']} />);

    const input = screen.getByPlaceholderText('test placeholder') as HTMLInputElement;
    expect(input.value).toBe('12 to 16');

    // Type a comma and space
    await user.type(input, ', ');
    expect(input.value).toBe('12 to 16, ');

    // Type the second answer
    await user.type(input, '12-16');
    expect(input.value).toBe('12 to 16, 12-16');

    // Check parent state received both answers
    expect(screen.getByTestId('current-val').textContent).toBe(JSON.stringify(['12 to 16', '12-16']));

    // Check that badge chips appear
    expect(screen.getByText('2 đáp án chấp nhận:')).toBeInTheDocument();
    expect(screen.getByText('12 to 16')).toBeInTheDocument();
    expect(screen.getByText('12-16')).toBeInTheDocument();
  });

  it('formats cleanly on blur', async () => {
    const user = userEvent.setup();
    render(<Wrapper initialValue={[]} />);

    const input = screen.getByPlaceholderText('test placeholder') as HTMLInputElement;
    await user.type(input, '  rock climbing ,   climbing  , ');
    expect(input.value).toBe('  rock climbing ,   climbing  , ');

    // Fire blur
    fireEvent.blur(input);

    // After blur, it should format cleanly to "rock climbing, climbing"
    expect(input.value).toBe('rock climbing, climbing');
    expect(screen.getByTestId('current-val').textContent).toBe(JSON.stringify(['rock climbing', 'climbing']));
  });
});

describe('Listening items factory functions', () => {
  it('makeListeningFillItem initializes with explanation string', () => {
    const item = makeListeningFillItem(1);
    expect(item).toHaveProperty('explanation', '');
    expect(item.kind).toBe('fill_blank');
  });

  it('makeListeningMcItem initializes with explanation string', () => {
    const item = makeListeningMcItem(1);
    expect(item).toHaveProperty('explanation', '');
    expect(item.kind).toBe('mc');
  });
});

describe('SectionEditor — Listening image_block layout', () => {
  it('renders ExplanationField for image_block listening items', () => {
    const onChange = vi.fn();
    const section: ListeningSection = {
      id: 'sec_listen',
      type: 'listening',
      title: 'Nghe hiểu',
      instructions: 'Nghe đoạn ghi âm',
      audio_url: 'https://example.com/audio.mp3',
      layout: 'image_block',
      task_image: 'https://example.com/task.jpg',
      items: [
        {
          question_number: 6,
          kind: 'fill_blank',
          prompt: '',
          accepted_answers: ['12 to 16'],
          case_sensitive: false,
          explanation: '',
        },
      ],
    };

    render(
      <SectionEditor
        section={section}
        allSections={[section as ThptSection]}
        onChange={onChange}
      />
    );

    // Label for ExplanationField should be rendered
    expect(screen.getByText(/Giải thích đáp án/i)).toBeInTheDocument();

    // Textarea placeholder
    const explanationTextarea = screen.getByPlaceholderText(/Đáp án B vì\.\.\. \/ Quy tắc ngữ pháp/i);
    expect(explanationTextarea).toBeInTheDocument();

    // Typing into explanation should call onChange with updated explanation
    fireEvent.change(explanationTextarea, { target: { value: 'Speaker mentions age 12 to 16' } });

    expect(onChange).toHaveBeenCalled();
    const updatedSec = onChange.mock.calls[0][0];
    expect(updatedSec.items[0].explanation).toBe('Speaker mentions age 12 to 16');
  });

  it('detects listening candidate in mc_questions and converts to listening with 1 click', () => {
    const onChange = vi.fn();
    const mcSection: any = {
      id: 'sec_mc_candidate',
      type: 'mc_questions',
      title: 'Nghe hiểu',
      instructions: 'Nghe đoạn hội thoại và chọn câu trả lời đúng.',
      variant: 'general',
      items: [
        {
          question_number: 1,
          prompt: "You will hear two friends talking about a film. Why didn't the boy enjoy it?",
          options: [
            { id: 'A', text: 'It was very frightening.' },
            { id: 'B', text: 'It was too long.' },
            { id: 'C', text: 'The sound was bad.' },
            { id: 'D', text: 'The tickets were expensive.' },
          ],
          correct_id: 'A',
          explanation: 'He was terrified.',
        },
      ],
    };

    render(
      <SectionEditor
        section={mcSection}
        allSections={[mcSection]}
        onChange={onChange}
      />
    );

    // Banner should be visible because title has "Nghe hiểu" and prompt has "hear"
    expect(screen.getByText(/Phần này có nội dung Nghe hiểu/i)).toBeInTheDocument();

    const convertBtn = screen.getByRole('button', { name: /Chuyển sang phần Nghe \(Listening\)/i });
    expect(convertBtn).toBeInTheDocument();

    fireEvent.click(convertBtn);

    expect(onChange).toHaveBeenCalled();
    const converted = onChange.mock.calls[0][0];
    expect(converted.type).toBe('listening');
    expect(converted.title).toBe('Nghe hiểu');
    expect(converted.audio_url).toBe('');
    expect(converted.items).toHaveLength(1);
    expect(converted.items[0].kind).toBe('mc');
    expect(converted.items[0].correct_id).toBe('A');
    expect(converted.items[0].options[0].text).toBe('It was very frightening.');
  });

  it('allows converting listening section back to mc_questions', () => {
    const onChange = vi.fn();
    const listeningSec: any = {
      id: 'sec_listen_to_mc',
      type: 'listening',
      title: 'Nghe hiểu',
      instructions: 'Nghe đoạn ghi âm',
      audio_url: 'https://example.com/audio.mp3',
      layout: 'default',
      items: [
        {
          question_number: 1,
          kind: 'mc',
          prompt: 'Question 1',
          options: [
            { id: 'A', text: 'Opt A' },
            { id: 'B', text: 'Opt B' },
          ],
          correct_id: 'B',
          explanation: 'Exp',
        },
      ],
    };

    render(
      <SectionEditor
        section={listeningSec}
        allSections={[listeningSec]}
        onChange={onChange}
      />
    );

    const convertBackBtn = screen.getByRole('button', { name: /Chuyển sang Trắc nghiệm đọc/i });
    expect(convertBackBtn).toBeInTheDocument();

    fireEvent.click(convertBackBtn);

    expect(onChange).toHaveBeenCalled();
    const converted = onChange.mock.calls[0][0];
    expect(converted.type).toBe('mc_questions');
    expect(converted.items[0].prompt).toBe('Question 1');
    expect(converted.items[0].correct_id).toBe('B');
  });
});

