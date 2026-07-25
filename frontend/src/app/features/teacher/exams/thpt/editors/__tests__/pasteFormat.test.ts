import { describe, it, expect } from 'vitest';
import { htmlToInlineMarkup } from '../shared';

/**
 * Regression: "Khi copy từ word sang web bị mất form (in đậm gạch chân,...)".
 * Word/Docs đặt định dạng bằng cả thẻ (<b>, <strong>) lẫn style inline
 * (font-weight:700, text-decoration:underline).
 */
describe('htmlToInlineMarkup — giữ định dạng khi dán từ Word', () => {
  it('giữ in đậm từ thẻ <b>/<strong>', () => {
    expect(htmlToInlineMarkup('<p>Choose the <b>best</b> answer</p>')).toContain('<b>best</b>');
    expect(htmlToInlineMarkup('<p><strong>Note</strong></p>')).toContain('<b>Note</b>');
  });

  it('giữ in đậm từ style inline của Word (font-weight:700)', () => {
    const word = '<p><span style="font-weight:700">important</span></p>';
    expect(htmlToInlineMarkup(word)).toContain('<b>important</b>');
  });

  it('giữ gạch chân từ thẻ <u> và style text-decoration', () => {
    expect(htmlToInlineMarkup('<p><u>word</u></p>')).toContain('<u>word</u>');
    const word = '<p><span style="text-decoration:underline">stressed</span></p>';
    expect(htmlToInlineMarkup(word)).toContain('<u>stressed</u>');
  });

  it('giữ in nghiêng', () => {
    expect(htmlToInlineMarkup('<p><em>maybe</em></p>')).toContain('<i>maybe</i>');
    expect(htmlToInlineMarkup('<p><span style="font-style:italic">x</span></p>')).toContain('<i>x</i>');
  });

  it('bỏ thẻ style/script rác của Word', () => {
    const dirty = '<style>p{margin:0}</style><p>Hello <b>you</b></p>';
    const out = htmlToInlineMarkup(dirty);
    expect(out).not.toContain('margin');
    expect(out).toContain('<b>you</b>');
  });

  it('kết hợp nhiều định dạng lồng nhau', () => {
    const out = htmlToInlineMarkup('<p><b><u>both</u></b></p>');
    expect(out).toContain('both');
    expect(out).toContain('<b>');
    expect(out).toContain('<u>');
  });
});
