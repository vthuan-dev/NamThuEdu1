import { describe, it, expect } from 'vitest';
import {
  detectPhoneticEnding,
  isSuffixComparisonGroup,
  splitPhoneticWord,
} from './examUtils';

describe('detectPhoneticEnding', () => {
  it('detects -ed / -es / -s endings', () => {
    expect(detectPhoneticEnding('stopped')).toBe('ed');
    expect(detectPhoneticEnding('boxes')).toBe('es');
    expect(detectPhoneticEnding('cats')).toBe('s');
  });

  it('returns empty for words without a variable ending', () => {
    expect(detectPhoneticEnding('head')).toBe('');
    expect(detectPhoneticEnding('tea')).toBe('');
    expect(detectPhoneticEnding('a')).toBe('');
    expect(detectPhoneticEnding('')).toBe('');
  });
});

describe('isSuffixComparisonGroup', () => {
  it('returns true when EVERY word shares an s/es/ed ending', () => {
    // Dạng so sánh đuôi -ed
    expect(
      isSuffixComparisonGroup([
        { text: 'stopped' },
        { text: 'worked' },
        { text: 'asked' },
        { text: 'wanted' },
      ]),
    ).toBe(true);
    // Dạng so sánh đuôi -s
    expect(
      isSuffixComparisonGroup([
        { text: 'laughs' },
        { text: 'stops' },
        { text: 'sleeps' },
        { text: 'plays' },
      ]),
    ).toBe(true);
  });

  it('returns false for vowel-comparison groups (head/bread/tea/heavy)', () => {
    expect(
      isSuffixComparisonGroup([
        { text: 'head' },
        { text: 'bread' },
        { text: 'tea' },
        { text: 'heavy' },
      ]),
    ).toBe(false);
  });

  it('returns false when only SOME words end in s/es/ed', () => {
    // "book" không có đuôi → không phải dạng so sánh đuôi
    expect(
      isSuffixComparisonGroup([
        { text: 'cats' },
        { text: 'dogs' },
        { text: 'book' },
        { text: 'plays' },
      ]),
    ).toBe(false);
  });

  it('handles empty / invalid input safely', () => {
    expect(isSuffixComparisonGroup([])).toBe(false);
    expect(isSuffixComparisonGroup([{ text: 'cats' }])).toBe(false);
    // Kiểm tra đầu vào không hợp lệ (ép kiểu để mô phỏng dữ liệu lỗi runtime).
    expect(isSuffixComparisonGroup(null as unknown as { text?: string | null }[])).toBe(false);
  });
});

describe('splitPhoneticWord', () => {
  it('uses the teacher-provided underline when present', () => {
    const r = splitPhoneticWord('head', 'ea', false, 1);
    expect(r).toEqual({ before: 'h', mark: 'ea', after: 'd' });
  });

  it('auto-detects the ending only when enabled', () => {
    // autoDetect = true → gạch đuôi
    expect(splitPhoneticWord('stopped', undefined, true)).toEqual({
      before: 'stopp',
      mark: 'ed',
      after: '',
    });
    // autoDetect = false → không gạch gì
    expect(splitPhoneticWord('stopped', undefined, false)).toEqual({
      before: 'stopped',
      mark: '',
      after: '',
    });
  });

  it('does not mark a vowel word when auto-detect is off', () => {
    // head khi autoDetect=false (do không cùng nhóm đuôi) → không gạch
    expect(splitPhoneticWord('head', undefined, false)).toEqual({
      before: 'head',
      mark: '',
      after: '',
    });
  });
});
