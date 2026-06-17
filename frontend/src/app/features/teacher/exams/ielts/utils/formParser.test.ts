import { describe, it, expect } from 'vitest';
import { parseFormText, PARSER_EXAMPLES } from './formParser';

describe('formParser', () => {
  it('should parse form with parentheses numbering', () => {
    const input = `Hostel Booking Form

Surname: (1) ...........
Nationality: (2) ...........
Check-in date: (3) ...........`;

    const result = parseFormText(input);

    expect(result.title).toBe('Hostel Booking Form');
    expect(result.questions).toHaveLength(3);
    expect(result.questions[0]).toEqual({
      questionNumber: 1,
      label: 'Surname:',
      originalLine: 'Surname: (1) ...........',
    });
    expect(result.questions[1]).toEqual({
      questionNumber: 2,
      label: 'Nationality:',
      originalLine: 'Nationality: (2) ...........',
    });
  });

  it('should parse form with dot numbering', () => {
    const input = `1. Full name: ...........
2. Date of birth: ...........
3. Address: ...........`;

    const result = parseFormText(input);

    expect(result.title).toBeUndefined();
    expect(result.questions).toHaveLength(3);
    expect(result.questions[0].questionNumber).toBe(1);
    expect(result.questions[0].label).toBe('Full name:');
  });

  it('should parse form with underscores', () => {
    const input = `Registration Form

(1) First name: _______
(2) Last name: _______
(3) Email: _______`;

    const result = parseFormText(input);

    expect(result.title).toBe('Registration Form');
    expect(result.questions).toHaveLength(3);
  });

  it('should handle simple numbered list without colons', () => {
    const input = `1 Name ...........
2 Age ...........
3 Occupation ...........`;

    const result = parseFormText(input);

    expect(result.questions).toHaveLength(3);
    expect(result.questions[0].label).toBe('Name:');
    expect(result.questions[1].label).toBe('Age:');
    expect(result.questions[2].label).toBe('Occupation:');
  });

  it('should detect non-sequential numbering', () => {
    const input = `1. Name: ...........
3. Age: ...........
5. City: ...........`;

    const result = parseFormText(input);

    expect(result.questions).toHaveLength(3);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('không liên tục');
  });

  it('should return error when no questions found', () => {
    const input = `Just some text
with no numbers
or patterns`;

    const result = parseFormText(input);

    expect(result.questions).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should handle all example cases', () => {
    PARSER_EXAMPLES.forEach((example) => {
      const result = parseFormText(example.input);
      expect(result.questions).toHaveLength(example.expected);
    });
  });
});
