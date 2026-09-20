import { describe, it, expect } from 'vitest';
import { containsHtml, sanitizeInlineHtml, INLINE_ALLOWED_TAGS, normalizePassageText } from './examUtils';

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

describe('normalizePassageText', () => {
  it('returns empty string for empty / null / undefined input', () => {
    expect(normalizePassageText('')).toBe('');
    expect(normalizePassageText(null)).toBe('');
    expect(normalizePassageText(undefined)).toBe('');
  });

  it('converts block tags to newlines and preserves paragraphs', () => {
    const html = '<p>Paragraph 1</p><p>Paragraph 2</p>';
    const result = normalizePassageText(html);
    expect(result).toBe('Paragraph 1\n\nParagraph 2');
  });

  it('decodes &nbsp; to spaces and replaces <div> with newlines (real bug reproduction)', () => {
    const dirty =
      '&nbsp; &nbsp; &nbsp;Once upon a time in Creativityville.&nbsp;<div>&nbsp; &nbsp; &nbsp;Lily was keen to get started.</div>';
    const result = normalizePassageText(dirty);

    expect(result).not.toContain('&nbsp;');
    expect(result).not.toContain('<div>');
    expect(result).not.toContain('</div>');
    expect(result).toContain('     Once upon a time in Creativityville.');
    expect(result).toContain('\n\n     Lily was keen to get started.');
  });

  it('decodes common HTML entities like &amp;, &lt;, &gt;, &quot;, &#39;', () => {
    const text = 'Lily&#39;s craft kit &amp; &quot;origami&quot; &lt;animals&gt;';
    const result = normalizePassageText(text);
    expect(result).toBe('Lily\'s craft kit & "origami" <animals>');
  });

  it('preserves sentence insertion markers [A], [B], [C], [D]', () => {
    const text = 'First part. [A] Second part. [B] <div>Third part. [C]</div>';
    const result = normalizePassageText(text);
    expect(result).toContain('[A]');
    expect(result).toContain('[B]');
    expect(result).toContain('[C]');
    expect(result).toBe('First part. [A] Second part. [B]\n\nThird part. [C]');
  });
});

