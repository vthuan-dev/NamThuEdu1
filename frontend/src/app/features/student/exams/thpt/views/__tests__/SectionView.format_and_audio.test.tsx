import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SectionView } from '../SectionView';
import type { ThptSection } from '../../types';

function renderSection(section: unknown) {
  return render(
    <SectionView
      section={section as ThptSection}
      answers={{}}
      onAnswerChange={() => {}}
      mode="taking"
      submissionId={1}
    />,
  );
}

describe('SectionView — Rich Text Formatting & Audio Player', () => {
  it('renders rich text bold and underline in mc_questions prompt without forcing full container bold', () => {
    const { container } = renderSection({
      id: 'mc1',
      type: 'mc_questions',
      title: 'Tìm lỗi sai',
      items: [
        {
          question_number: 61,
          prompt: 'We (<b>A</b>) <b>have lived</b> in this neighbourhood (<b>B</b>) <b>since</b> ten years, and we (<b>C</b>) <b>know</b> almost everyone (<b>D</b>) <b>here</b>.',
          options: [
            { id: 'A', text: 'A' },
            { id: 'B', text: 'B' },
            { id: 'C', text: 'C' },
            { id: 'D', text: 'D' },
          ],
          correct_id: 'B',
        },
      ],
    });

    // Check that <b> tag is present and rendered
    const boldNodes = container.querySelectorAll('b');
    expect(boldNodes.length).toBeGreaterThan(0);
    expect(boldNodes[1].textContent).toBe('have lived');

    // Ensure the container does not have `[&_*]:!font-bold`
    const promptContainers = container.querySelectorAll('[class*="!font-bold"]');
    expect(promptContainers.length).toBe(0);
  });

  it('renders audio player with normalized https URL for listening section', () => {
    const { container } = renderSection({
      id: 'ls1',
      type: 'listening',
      title: 'Nghe hiểu trắc nghiệm',
      audio_url: 'http://namthuedu.vn/files/audio/test.mp3',
      items: [
        {
          question_number: 1,
          kind: 'mc',
          prompt: 'What is the speaker main purpose in the talk?',
          options: [
            { id: 'A', text: 'To complain' },
            { id: 'B', text: 'To describe' },
          ],
          correct_id: 'B',
        },
      ],
    });

    const audioEl = container.querySelector('audio');
    expect(audioEl).toBeInTheDocument();
    expect(audioEl?.getAttribute('src')).toBe('https://namthuedu.vn/files/audio/test.mp3');
  });

  it('renders audio player even if section type is mc_questions when audio_url exists', () => {
    const { container } = renderSection({
      id: 'mc_audio',
      type: 'mc_questions',
      title: 'Nghe hiểu trắc nghiệm',
      audio_url: 'http://namthuedu.vn/files/audio/test2.mp3',
      items: [
        {
          question_number: 1,
          prompt: 'Question 1',
          options: [
            { id: 'A', text: 'Option A' },
            { id: 'B', text: 'Option B' },
          ],
          correct_id: 'A',
        },
      ],
    });

    const audioEl = container.querySelector('audio');
    expect(audioEl).toBeInTheDocument();
    expect(audioEl?.getAttribute('src')).toBe('https://namthuedu.vn/files/audio/test2.mp3');
  });

  it('renders rich text HTML in choice options', () => {
    const { container } = renderSection({
      id: 'mc_rich_opts',
      type: 'mc_questions',
      title: 'Trắc nghiệm từ vựng',
      items: [
        {
          question_number: 1,
          prompt: 'Choose the correct word',
          options: [
            { id: 'A', text: '<b>strongly</b> recommend' },
            { id: 'B', text: '<u>hardly</u> recommend' },
          ],
          correct_id: 'A',
        },
      ],
    });

    const bTag = container.querySelector('button b');
    expect(bTag).toBeInTheDocument();
    expect(bTag?.textContent).toBe('strongly');

    const uTag = container.querySelector('button u');
    expect(uTag).toBeInTheDocument();
    expect(uTag?.textContent).toBe('hardly');
  });
});
