// File: frontend/src/app/features/teacher/exams/teens/components/teensParser.ts
/**
 * Teens Exam Smart Local Parser
 * ─────────────────────────────
 * Parses DOCX HTML or plain text into Teens Listening/Speaking JSON payload.
 * Runs entirely on client-side:
 * - 100% immune to 504 gateway timeouts.
 * - Extracts questions, multiple choice options (including inline A/B/C/D), and blanks.
 * - Identifies correct answers using bold/underline HTML tags or [x]/* markers.
 */

export interface TeensParsedPayload {
  skill: 'listening' | 'speaking';
  groups?: Array<{
    audio_url: string;
    task_image: string;
    questions: Array<{
      qContent: string;
      qType: 'multiple_choice' | 'fill_blank';
      options?: Array<{ content: string; isCorrect: boolean }>;
      correctAnswer?: string;
      qExplanation?: string;
    }>;
  }>;
  parts?: Array<{
    qContent: string;
    prepSeconds: number;
    speakSeconds: number;
    qExplanation?: string;
  }>;
}

/**
 * Clean text: remove zero-width spaces, special characters, and normalize spaces
 */
function cleanText(txt: string): string {
  if (!txt) return '';
  return txt
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // remove zero-width spaces
    .replace(/\s+/g, ' ')                  // normalize whitespace
    .trim();
}

/**
 * Parse Teens content locally
 */
export function parseTeensTextLocally(
  htmlOrText: string,
  targetSkill: 'listening' | 'speaking' | 'auto'
): TeensParsedPayload {
  // 1. Detect skill if auto
  let skill = targetSkill;
  if (skill === 'auto') {
    const textLower = htmlOrText.toLowerCase();
    const hasListening = textLower.includes('listening') || textLower.includes('audio') || textLower.includes('hear');
    const hasSpeaking = textLower.includes('speaking') || textLower.includes('describe') || textLower.includes('speak');
    
    if (hasListening && !hasSpeaking) {
      skill = 'listening';
    } else if (hasSpeaking && !hasListening) {
      skill = 'speaking';
    } else {
      // Default to listening if ambiguous (due to multiple choice options)
      skill = htmlOrText.match(/[A-D][\.\)]/i) ? 'listening' : 'speaking';
    }
  }

  if (skill === 'speaking') {
    return parseSpeaking(htmlOrText);
  } else {
    return parseListening(htmlOrText);
  }
}

/**
 * Parsing logic for SPEAKING skill
 */
function parseSpeaking(htmlOrText: string): TeensParsedPayload {
  // Convert HTML block tags to newlines, then strip other tags
  const text = htmlOrText
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const parts: NonNullable<TeensParsedPayload['parts']> = [];
  
  let currentPrompt = '';
  let explanation = '';

  for (const line of lines) {
    // Detect speaking part/prompt markers (e.g. "Part 1:", "Question 1:", "Describe...")
    const isHeader = /^(part|question|task|câu|đề|topic)\s*\d+/i.test(line);
    
    if (isHeader) {
      if (currentPrompt.trim()) {
        parts.push({
          qContent: cleanText(currentPrompt),
          prepSeconds: 30,
          speakSeconds: 120,
          qExplanation: explanation.trim() ? cleanText(explanation) : undefined
        });
        currentPrompt = '';
        explanation = '';
      }
      
      // Strip header text like "Part 1:" to get only content
      const content = line.replace(/^(part|question|task|câu|đề|topic)\s*\d+[\s\.:\)-]*/i, '');
      currentPrompt = content;
    } else {
      if (line.toLowerCase().startsWith('suggested') || line.toLowerCase().startsWith('gợi ý') || line.toLowerCase().startsWith('hint')) {
        explanation += ' ' + line;
      } else {
        if (!currentPrompt) {
          currentPrompt = line;
        } else {
          currentPrompt += ' ' + line;
        }
      }
    }
  }

  if (currentPrompt.trim()) {
    parts.push({
      qContent: cleanText(currentPrompt),
      prepSeconds: 30,
      speakSeconds: 120,
      qExplanation: explanation.trim() ? cleanText(explanation) : undefined
    });
  }

  // Fallback if empty
  if (parts.length === 0 && text.trim().length > 10) {
    parts.push({
      qContent: cleanText(text),
      prepSeconds: 30,
      speakSeconds: 120
    });
  }

  return { skill: 'speaking', parts };
}

/**
 * Parsing logic for LISTENING skill
 */
function parseListening(html: string): TeensParsedPayload {
  // Convert block tags to clean boundaries, keeping strong/underline tags to detect correct answers
  let parsedHtml = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const lines = parsedHtml.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const groups: NonNullable<TeensParsedPayload['groups']> = [];
  
  let currentQuestions: any[] = [];
  let currentQ: any = null;

  const pushCurrentQuestion = () => {
    if (currentQ) {
      // Validate correct answer for MCQ
      if (currentQ.qType === 'multiple_choice' && currentQ.options.length > 0) {
        // If no option is marked correct, default to first option
        const hasCorrect = currentQ.options.some((o: any) => o.isCorrect);
        if (!hasCorrect) {
          currentQ.options[0].isCorrect = true;
        }
      }
      currentQuestions.push(currentQ);
      currentQ = null;
    }
  };

  for (const line of lines) {
    // 1. Detect inline options: e.g. "A. red  B. blue  C. green  D. yellow"
    const inlineOptRegex = /A[\.\)]\s*(.*?)\s+B[\.\)]\s*(.*?)\s+C[\.\)]\s*(.*?)\s+D[\.\)]\s*(.*)/i;
    const inlineMatch = line.match(inlineOptRegex);
    
    if (inlineMatch && currentQ) {
      currentQ.qType = 'multiple_choice';
      currentQ.options = [
        { content: cleanHtmlText(inlineMatch[1]), isCorrect: isMarkedCorrect(inlineMatch[1]) },
        { content: cleanHtmlText(inlineMatch[2]), isCorrect: isMarkedCorrect(inlineMatch[2]) },
        { content: cleanHtmlText(inlineMatch[3]), isCorrect: isMarkedCorrect(inlineMatch[3]) },
        { content: cleanHtmlText(inlineMatch[4]), isCorrect: isMarkedCorrect(inlineMatch[4]) }
      ];
      pushCurrentQuestion();
      continue;
    }

    // 2. Detect single option line: e.g. "A. apple"
    const singleOptRegex = /^([A-D])[\.\)]\s*(.*)$/i;
    const optMatch = line.match(singleOptRegex);
    
    if (optMatch && currentQ) {
      currentQ.qType = 'multiple_choice';
      if (!currentQ.options) currentQ.options = [];
      
      const letter = optMatch[1].toUpperCase();
      const text = optMatch[2];
      currentQ.options.push({
        content: cleanHtmlText(text),
        isCorrect: isMarkedCorrect(text) || isMarkedCorrect(line)
      });
      
      if (currentQ.options.length >= 4 || letter === 'D') {
        pushCurrentQuestion();
      }
      continue;
    }

    // 3. Detect new question line: e.g. "1. What did he do?" or "Question 1:"
    const qRegex = /^(Question|Câu|Q)?\s*(\d+)\s*[\.:\)-]\s*(.*)$/i;
    const qMatch = line.match(qRegex);
    
    if (qMatch) {
      pushCurrentQuestion(); // push previous question
      
      const qContent = cleanHtmlText(qMatch[3]);
      const isFillBlank = qContent.includes('___') || qContent.includes('...') || qContent.includes('___');
      
      currentQ = {
        qContent: qContent,
        qType: isFillBlank ? 'fill_blank' : 'multiple_choice',
        options: [],
        correctAnswer: isFillBlank ? 'answer' : undefined
      };
      
      // Look for correct answer within blank if present
      if (isFillBlank) {
        // Try to extract answer from parenthesis if exists, e.g. "___ (apple)"
        const answerMatch = qContent.match(/\(\s*([^\)]+)\s*\)/);
        if (answerMatch) {
          currentQ.correctAnswer = cleanText(answerMatch[1]);
          currentQ.qContent = qContent.replace(/\s*\([^\)]+\)/g, ''); // strip the answer from content
        }
      }
      continue;
    }

    // 4. Detect group boundaries (to create multiple audio files if needed)
    const isGroupDivider = /^(questions?\s*\d+|part|section|audio)\s*\d+/i.test(line);
    if (isGroupDivider && currentQuestions.length > 0) {
      pushCurrentQuestion();
      groups.push({
        audio_url: '',
        task_image: '',
        questions: [...currentQuestions]
      });
      currentQuestions = [];
      continue;
    }

    // 5. Append trailing content to current question or correct answer
    if (currentQ) {
      const plainLine = cleanHtmlText(line);
      if (plainLine.toLowerCase().startsWith('key:') || plainLine.toLowerCase().startsWith('answer:')) {
        const ans = plainLine.replace(/^(key|answer|đáp án)\s*[\.:-]\s*/i, '');
        if (currentQ.qType === 'fill_blank') {
          currentQ.correctAnswer = ans;
        } else {
          // MCQ: mark correct option
          const letter = ans.trim().toUpperCase();
          if (['A', 'B', 'C', 'D'].includes(letter)) {
            const idx = letter.charCodeAt(0) - 65; // A=0, B=1...
            if (currentQ.options && currentQ.options[idx]) {
              currentQ.options.forEach((o: any) => o.isCorrect = false);
              currentQ.options[idx].isCorrect = true;
            }
          }
        }
        pushCurrentQuestion();
      } else if (plainLine.toLowerCase().startsWith('explanation:') || plainLine.toLowerCase().startsWith('giải thích:')) {
        currentQ.qExplanation = plainLine.replace(/^(explanation|giải thích)\s*[\.:-]\s*/i, '');
      } else {
        // Append text to question content
        currentQ.qContent += ' ' + plainLine;
      }
    }
  }

  pushCurrentQuestion();
  
  if (currentQuestions.length > 0) {
    groups.push({
      audio_url: '',
      task_image: '',
      questions: currentQuestions
    });
  }

  // Fallback group if empty
  if (groups.length === 0) {
    groups.push({
      audio_url: '',
      task_image: '',
      questions: [
        {
          qContent: 'Question 1: ...',
          qType: 'multiple_choice',
          options: [
            { content: 'Option A', isCorrect: true },
            { content: 'Option B', isCorrect: false }
          ]
        }
      ]
    });
  }

  return { skill: 'listening', groups };
}

/**
 * Check if the text has markers indicating it is the correct answer
 */
function isMarkedCorrect(html: string): boolean {
  // Check for bold, underline tags, asterisk or bracket markers
  return /<u>|<strong>|<b>|<span[^>]*text-decoration[^>]*underline/i.test(html) || 
         html.trim().startsWith('*') || 
         html.trim().endsWith('*') || 
         /\[x\]|\[v\]/i.test(html);
}

/**
 * Clean up HTML tags and entities to return pure cleaned text
 */
function cleanHtmlText(html: string): string {
  if (!html) return '';
  const text = html
    .replace(/<[^>]*>/g, '') // remove all tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
  return cleanText(text);
}
