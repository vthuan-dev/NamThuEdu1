/**
 * Auto-parser for IELTS form-completion questions.
 * Allows teachers to paste entire forms from PDFs and auto-detect blank spaces.
 * 
 * Patterns detected:
 * - Question numbers: (1), (2), 1., 2., etc.
 * - Blank markers: ........., _______, or just the number
 * - Labels: "Name:", "Surname:", etc.
 */

export interface ParsedFormQuestion {
  questionNumber: number;
  label: string;
  originalLine: string;
}

export interface FormParseResult {
  questions: ParsedFormQuestion[];
  title?: string;
  errors: string[];
}

/**
 * Parse pasted form text and extract questions with their labels.
 * 
 * Example input:
 * ```
 * Hostel Booking Form
 * 
 * Surname: (1) ...........
 * Nationality: (2) ...........
 * Check-in date: (3) ...........
 * ```
 * 
 * Output:
 * ```
 * {
 *   title: "Hostel Booking Form",
 *   questions: [
 *     { questionNumber: 1, label: "Surname:", originalLine: "Surname: (1) ..........." },
 *     { questionNumber: 2, label: "Nationality:", originalLine: "Nationality: (2) ..........." },
 *     ...
 *   ]
 * }
 * ```
 */
export function parseFormText(text: string): FormParseResult {
  const errors: string[] = [];
  const questions: ParsedFormQuestion[] = [];
  let title: string | undefined;

  // Split into lines and clean up
  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (lines.length === 0) {
    errors.push('Không có nội dung để phân tích');
    return { questions, errors };
  }

  // First non-empty line without a number pattern might be the title
  const firstLine = lines[0];
  if (!hasQuestionNumber(firstLine)) {
    title = firstLine;
    lines.shift(); // Remove title from processing
  }

  // Process each line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Try to extract question number
    const questionNumber = extractQuestionNumber(line);
    
    if (questionNumber === null) {
      // Not a question line, skip
      continue;
    }

    // Extract label (text before the number or dots/underscores)
    const label = extractLabel(line, questionNumber);
    
    if (!label) {
      errors.push(`Dòng ${i + 1}: Không tìm thấy nhãn cho câu ${questionNumber}`);
      continue;
    }

    questions.push({
      questionNumber,
      label: label.trim(),
      originalLine: line,
    });
  }

  // Sort by question number
  questions.sort((a, b) => a.questionNumber - b.questionNumber);

  // Validate sequential numbering
  if (questions.length > 0) {
    const firstNum = questions[0].questionNumber;
    const expectedNums = Array.from(
      { length: questions.length },
      (_, i) => firstNum + i
    );
    const actualNums = questions.map(q => q.questionNumber);
    
    if (JSON.stringify(expectedNums) !== JSON.stringify(actualNums)) {
      errors.push(
        `Cảnh báo: Số thứ tự câu hỏi không liên tục. Tìm thấy: ${actualNums.join(', ')}`
      );
    }
  }

  if (questions.length === 0 && errors.length === 0) {
    errors.push('Không tìm thấy câu hỏi nào. Vui lòng kiểm tra định dạng.');
  }

  return { questions, title, errors };
}

/**
 * Check if a line contains a question number pattern.
 */
function hasQuestionNumber(line: string): boolean {
  // Patterns: (1), (2), 1., 2., 1), 2)
  const patterns = [
    /\(\d+\)/,           // (1), (2)
    /\d+\./,             // 1., 2.
    /\d+\)/,             // 1), 2)
    /^\d+\s/,            // 1 ..., 2 ...
  ];
  
  return patterns.some(pattern => pattern.test(line));
}

/**
 * Extract question number from a line.
 * Returns null if no number found.
 */
function extractQuestionNumber(line: string): number | null {
  // Try different patterns in order of specificity
  
  // Pattern 1: (1), (2), etc.
  const parenMatch = line.match(/\((\d+)\)/);
  if (parenMatch) {
    return parseInt(parenMatch[1], 10);
  }
  
  // Pattern 2: 1., 2., etc.
  const dotMatch = line.match(/(\d+)\./);
  if (dotMatch) {
    return parseInt(dotMatch[1], 10);
  }
  
  // Pattern 3: 1), 2), etc.
  const closeParenMatch = line.match(/(\d+)\)/);
  if (closeParenMatch) {
    return parseInt(closeParenMatch[1], 10);
  }
  
  // Pattern 4: Just a number at the start
  const startMatch = line.match(/^(\d+)\s/);
  if (startMatch) {
    return parseInt(startMatch[1], 10);
  }
  
  return null;
}

/**
 * Extract label text from a line (everything before the number/blanks).
 */
function extractLabel(line: string, questionNumber: number): string {
  // Remove the question number and blank markers
  let cleaned = line;
  
  // Remove number patterns
  cleaned = cleaned.replace(/\(\d+\)/, '');
  cleaned = cleaned.replace(/\d+\./, '');
  cleaned = cleaned.replace(/\d+\)/, '');
  cleaned = cleaned.replace(/^\d+\s/, '');
  
  // Remove blank markers (dots and underscores)
  cleaned = cleaned.replace(/\.{3,}/g, ''); // 3 or more dots
  cleaned = cleaned.replace(/_{3,}/g, '');  // 3 or more underscores
  
  // Clean up extra whitespace
  cleaned = cleaned.trim();
  
  // If nothing left, return empty
  if (!cleaned) {
    return '';
  }
  
  // If label doesn't end with colon, add it
  if (!cleaned.endsWith(':')) {
    cleaned += ':';
  }
  
  return cleaned;
}

/**
 * Generate preview text showing what will be created.
 */
export function generatePreviewText(result: FormParseResult): string {
  const lines: string[] = [];
  
  if (result.title) {
    lines.push(`📋 ${result.title}`);
    lines.push('');
  }
  
  if (result.questions.length > 0) {
    lines.push(`✅ Tìm thấy ${result.questions.length} câu hỏi:`);
    lines.push('');
    
    result.questions.forEach(q => {
      lines.push(`   ${q.questionNumber}. ${q.label}`);
    });
  }
  
  if (result.errors.length > 0) {
    lines.push('');
    lines.push('⚠️ Cảnh báo:');
    result.errors.forEach(err => {
      lines.push(`   • ${err}`);
    });
  }
  
  return lines.join('\n');
}

/**
 * Example usage and test cases for development.
 */
export const PARSER_EXAMPLES = [
  {
    name: 'Hostel Booking (parentheses)',
    input: `Hostel Booking Form

Surname: (1) ...........
Nationality: (2) ...........
Check-in date: (3) ...........
Number of nights: (4) ...........`,
    expected: 4,
  },
  {
    name: 'Library Card (dots)',
    input: `1. Full name: ...........
2. Date of birth: ...........
3. Address: ...........
4. Phone number: ...........`,
    expected: 4,
  },
  {
    name: 'Conference Registration (underscores)',
    input: `Registration Form

(1) First name: _______
(2) Last name: _______
(3) Email: _______`,
    expected: 3,
  },
  {
    name: 'Simple numbered list',
    input: `1 Name ...........
2 Age ...........
3 Occupation ...........`,
    expected: 3,
  },
];
