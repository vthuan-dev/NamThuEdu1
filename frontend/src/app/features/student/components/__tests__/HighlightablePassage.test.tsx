import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HighlightablePassage } from '../HighlightablePassage';

describe('HighlightablePassage Component', () => {
  const mockColors = {
    yellow: '#fef08a',
    green: '#bbf7d0',
    blue: '#bfdbfe',
    pink: '#fbcfe8',
    orange: '#fed7aa',
  };

  it('renders passage and color picker toolbar when enabled', () => {
    render(
      <HighlightablePassage
        html="<p>This is a test passage about reading comprehension.</p>"
        highlights={[]}
        selectedColor="yellow"
        onAddHighlight={vi.fn()}
        onRemoveHighlight={vi.fn()}
        onSelectColor={vi.fn()}
        colors={mockColors}
        enabled={true}
      />
    );

    expect(screen.getByText(/Màu highlight:/i)).toBeInTheDocument();
    expect(screen.getByText(/Bôi đen chữ rồi chạm màu để highlight/i)).toBeInTheDocument();
    expect(screen.getByText(/This is a test passage about reading comprehension./i)).toBeInTheDocument();
  });

  it('renders existing highlights as mark tags with correct color and id', () => {
    const highlights = [
      {
        id: 'hl-1',
        text: 'test passage',
        startOffset: 10,
        endOffset: 22,
        color: '#fef08a',
        timestamp: Date.now(),
      },
    ];

    render(
      <HighlightablePassage
        html="This is a test passage about reading comprehension."
        highlights={highlights}
        selectedColor="yellow"
        onAddHighlight={vi.fn()}
        onRemoveHighlight={vi.fn()}
        onSelectColor={vi.fn()}
        colors={mockColors}
        enabled={true}
      />
    );

    const mark = screen.getByText('test passage');
    expect(mark.tagName.toLowerCase()).toBe('mark');
    expect(mark).toHaveAttribute('data-highlight-id', 'hl-1');
  });

  it('does not duplicate text even if highlights overlap', () => {
    const highlights = [
      {
        id: 'hl-1',
        text: 'test passage',
        startOffset: 10,
        endOffset: 22,
        color: '#fef08a',
        timestamp: Date.now(),
      },
      {
        id: 'hl-2',
        text: 'passage about',
        startOffset: 15,
        endOffset: 28,
        color: '#bbf7d0',
        timestamp: Date.now(),
      },
    ];

    const { container } = render(
      <HighlightablePassage
        html="This is a test passage about reading comprehension."
        highlights={highlights}
        selectedColor="yellow"
        onAddHighlight={vi.fn()}
        onRemoveHighlight={vi.fn()}
        onSelectColor={vi.fn()}
        colors={mockColors}
        enabled={true}
      />
    );

    // Text content should remain exact without duplicated words
    expect(container.querySelector('article')?.textContent).toBe(
      'This is a test passage about reading comprehension.'
    );
  });
});
