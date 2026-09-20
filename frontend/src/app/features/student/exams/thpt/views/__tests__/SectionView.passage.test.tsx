import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SectionView } from '../SectionView';
import type { ThptSection } from '../../types';

describe('SectionView — PassageBox clean rendering', () => {
  const dirtyPassage =
    '&nbsp; &nbsp; &nbsp; &nbsp; &nbsp;Once upon a time in Creativityville, Lily loved DIY.&nbsp;' +
    '<div>&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; Lily was keen to get started. [A] She made bracelets.&nbsp;</div>';

  const sectionWithDirtyPassage = {
    id: 'sec_reading_1',
    type: 'reading_mixed',
    title: 'Đọc hiểu',
    instructions: 'Đọc đoạn văn và trả lời các câu hỏi.',
    passage: dirtyPassage,
    items: [
      {
        kind: 'mc',
        question_number: 1,
        prompt: 'What did Lily love?',
        options: [
          { id: 'A', text: 'DIY' },
          { id: 'B', text: 'Cooking' },
        ],
        correct_id: 'A',
      },
      {
        kind: 'sentence_insertion',
        question_number: 2,
        prompt: 'Where does the sentence fit?',
        sentence_to_insert: 'She used colorful beads.',
        correct_marker: 'A',
      },
    ],
  } as unknown as ThptSection;

  it('renders clean text WITHOUT leaking raw &nbsp; or <div> tags to students', () => {
    const { container } = render(
      <SectionView
        section={sectionWithDirtyPassage}
        answers={{}}
        onAnswerChange={() => {}}
        mode="taking"
        submissionId={123}
      />
    );

    // The rendered DOM should NOT contain literal &nbsp; or <div> text
    expect(container.textContent).not.toContain('&nbsp;');
    expect(container.textContent).not.toContain('<div>');
    expect(container.textContent).not.toContain('</div>');

    // It should contain the actual text
    expect(screen.getByText(/Once upon a time in Creativityville/)).toBeInTheDocument();
    expect(screen.getByText(/Lily was keen to get started/)).toBeInTheDocument();

    // Sentence insertion marker [A] should be rendered as a badge in the passage
    const badges = screen.getAllByText('[A]');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });
});
