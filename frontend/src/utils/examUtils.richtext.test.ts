import { describe, it, expect } from 'vitest';
import { containsHtml, sanitizeInlineHtml, INLINE_ALLOWED_TAGS } from './examUtils';

describe('containsHtml', () => {
  it('returns false for empty / null / plain text', () => {
    expect(containsHtml('')).toBe(false);
    expect(containsHtml(null)).toBe(false);
    expect(containsHtml(undefined)).toBe(false);
    expect(containsHtml('Just plain text, no tags.')).toBe(false);
    // Toán tử so sánh không phải thẻ HTML
    expect(containsHtml('a < b and c > d')).toBe(false);
  });

  it('returns true when an HTML tag is present', () => {
    expect(containsHtml('This is <strong>bold</strong>')).toBe(true);
    expect(containsHtml('x<sup>2</sup>')).toBe(true);
    expect(containsHtml('<em>emphasis</em>')).toBe(true);
    expect(containsHtml('line<br>break')).toBe(true);
  });
});

describe('sanitizeInlineHtml', () => {
  it('returns empty string for falsy input', () => {
    expect(sanitizeInlineHtml('')).toBe('');
    expect(sanitizeInlineHtml(null)).toBe('');
    expect(sanitizeInlineHtml(undefined)).toBe('');
  });

  it('keeps allowed inline formatting tags', () => {
    expect(sanitizeInlineHtml('<strong>a</strong>')).toBe('<strong>a</strong>');
    expect(sanitizeInlineHtml('<em>a</em>')).toBe('<em>a</em>');
    expect(sanitizeInlineHtml('<u>a</u>')).toBe('<u>a</u>');
    expect(sanitizeInlineHtml('H<sub>2</sub>O')).toBe('H<sub>2</sub>O');
    expect(sanitizeInlineHtml('x<sup>2</sup>')).toBe('x<sup>2</sup>');
  });

  it('strips block-level tags but keeps their text content', () => {
    // <p>/<div> không nằm trong danh sách cho phép → gỡ thẻ, giữ nội dung
    expect(sanitizeInlineHtml('<p>hello</p>')).toBe('hello');
    expect(sanitizeInlineHtml('<div>hi <strong>there</strong></div>')).toBe(
      'hi <strong>there</strong>'
    );
  });

  it('removes dangerous script and event handlers (XSS)', () => {
    const dirty = '<img src=x onerror="alert(1)">';
    const clean = sanitizeInlineHtml(dirty);
    expect(clean).not.toContain('onerror');
    expect(clean).not.toContain('<img');

    const scriptClean = sanitizeInlineHtml('<script>alert(1)</script>hi');
    expect(scriptClean).not.toContain('<script');
    expect(scriptClean).toContain('hi');

    // Thẻ được phép nhưng có handler on* → handler bị loại
    const withHandler = sanitizeInlineHtml('<strong onclick="steal()">x</strong>');
    expect(withHandler).not.toContain('onclick');
    expect(withHandler).toContain('<strong>');
  });

  it('strips inline style attributes (Word rác) but keeps class', () => {
    const styled = sanitizeInlineHtml('<span style="color:red" class="hi">x</span>');
    expect(styled).not.toContain('style');
    expect(styled).toContain('class="hi"');
  });

  it('exposes the allow-list for reference', () => {
    expect(INLINE_ALLOWED_TAGS).toContain('strong');
    expect(INLINE_ALLOWED_TAGS).toContain('sup');
    expect(INLINE_ALLOWED_TAGS).not.toContain('script');
  });
});
