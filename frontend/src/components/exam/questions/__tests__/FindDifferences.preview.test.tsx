import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FindDifferences } from '../FindDifferences';

describe('FindDifferences — preview mode rendering', () => {
  const sampleQuestion338 = {
    qId: 4134,
    exam_id: 338,
    qContent: 'Find the differences (Tìm điểm khác biệt)',
    qType: 'kids_task',
    qExplanation: 'Học sinh quan sát 2 bức tranh A và B để chỉ ra ít nhất 4-5 điểm khác biệt...',
    kids_task_config: {
      skill: 'speaking',
      task_name: 'Tìm Điểm Khác Biệt',
      task_type: 'find_differences',
      instructions: 'So sánh 2 bức tranh và mô tả sự khác biệt',
      task_data: {
        image_a_url: 'http://namthuedu.vn/storage/kids-exams/images/picA.png',
        image_b_url: 'http://namthuedu.vn/storage/kids-exams/images/picB.png',
        differences: [
          "The girl's fruit: In Picture A, the girl is eating a red apple, but in Picture B, she is eating a yellow banana.",
          "The white cat: In Picture A, there is a small white cat sitting under the bench, but in Picture B, there is no cat.",
        ],
      },
    },
  };

  it('renders both Hình A and Hình B with https upgraded URLs', () => {
    render(
      <FindDifferences
        question={sampleQuestion338}
        mode="preview"
        answer={{}}
        onAnswer={() => {}}
      />
    );

    // Should render badges/labels for both images
    expect(screen.getByText('Hình A')).toBeDefined();
    expect(screen.getByText('Hình B')).toBeDefined();

    // Check images
    const images = screen.getAllByRole('img');
    expect(images.length).toBe(2);
    // Should have upgraded http to https
    expect(images[0].getAttribute('src')).toBe('https://namthuedu.vn/storage/kids-exams/images/picA.png');
    expect(images[1].getAttribute('src')).toBe('https://namthuedu.vn/storage/kids-exams/images/picB.png');
  });

  it('renders configured model differences list in preview mode', () => {
    render(
      <FindDifferences
        question={sampleQuestion338}
        mode="preview"
        answer={{}}
        onAnswer={() => {}}
      />
    );

    expect(screen.getByText(/Danh sách điểm khác biệt/)).toBeDefined();
    expect(screen.getByText(/In Picture A, the girl is eating a red apple/)).toBeDefined();
    expect(screen.getByText(/In Picture A, there is a small white cat sitting under the bench/)).toBeDefined();
  });

  it('renders teacher explanation in preview mode', () => {
    render(
      <FindDifferences
        question={sampleQuestion338}
        mode="preview"
        answer={{}}
        onAnswer={() => {}}
      />
    );

    expect(screen.getByText(/Hướng dẫn chấm bài & Giải thích/)).toBeDefined();
    expect(screen.getByText(/Học sinh quan sát 2 bức tranh A và B/)).toBeDefined();
  });

  it('does NOT expose model differences in student mode', () => {
    render(
      <FindDifferences
        question={sampleQuestion338}
        mode="student"
        answer={{}}
        onAnswer={() => {}}
      />
    );

    expect(screen.queryByText(/Danh sách điểm khác biệt/)).toBeNull();
    expect(screen.queryByText(/In Picture A, the girl is eating a red apple/)).toBeNull();
  });
});
