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
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const lines = parsedHtml.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const groups: NonNullable<TeensParsedPayload['groups']> = [];
  
  let currentQuestions: any[] = [];
  let currentQ: any = null;

  const pushCurrentQuestion = () => {
    if (currentQ) {
      if (currentQ.qType === 'multiple_choice' && currentQ.options.length > 0) {
        const hasCorrect = currentQ.options.some((o: any) => o.isCorrect);
        if (!hasCorrect) {
          currentQ.options[0].isCorrect = true;
        }
      }
      currentQuestions.push(currentQ);
      currentQ = null;
    }
  };

  let lineIdx = 0;
  for (const line of lines) {
    lineIdx++;
    const formattedLine = stripTagsExceptFormatting(line);
    const cleanLine = cleanHtmlText(line);
    if (!cleanLine) continue;

    // 1. Detect inline options (e.g. A. grips B. gift C. grasp D. grabs)
    const inlineOptRegex = /A[\.\)]\s*(.*?)\s+B[\.\)]\s*(.*?)\s+C[\.\)]\s*(.*?)\s+D[\.\)]\s*(.*)/;
    const inlineMatch = formattedLine.match(inlineOptRegex);
    
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

    // 1.5. Detect inline AB options (e.g. A. option1 B. option2)
    const abMatch = formattedLine.match(/A[\.\)]\s*(.*?)\s+B[\.\)]\s*(.*)/);
    if (abMatch && !formattedLine.match(/C[\.\)]/)) {
      if (currentQ) {
        currentQ.qType = 'multiple_choice';
        if (!currentQ.options) currentQ.options = [];
        currentQ.options.push(
          { content: cleanHtmlText(abMatch[1]), isCorrect: isMarkedCorrect(abMatch[1]) },
          { content: cleanHtmlText(abMatch[2]), isCorrect: isMarkedCorrect(abMatch[2]) }
        );
        continue;
      }
    }

    // 1.6. Detect inline CD options (e.g. C. option3 D. option4)
    const cdMatch = formattedLine.match(/C[\.\)]\s*(.*?)\s+D[\.\)]\s*(.*)/);
    if (cdMatch) {
      if (currentQ) {
        currentQ.qType = 'multiple_choice';
        if (!currentQ.options) currentQ.options = [];
        currentQ.options.push(
          { content: cleanHtmlText(cdMatch[1]), isCorrect: isMarkedCorrect(cdMatch[1]) },
          { content: cleanHtmlText(cdMatch[2]), isCorrect: isMarkedCorrect(cdMatch[2]) }
        );
        pushCurrentQuestion();
        continue;
      }
    }

    // 2. Detect single option line
    const singleOptRegex = /^([A-D])[\.\)]\s*(.*)$/;
    const optMatch = cleanLine.match(singleOptRegex);
    
    if (optMatch) {
      if (currentQ) {
        currentQ.qType = 'multiple_choice';
        if (!currentQ.options) currentQ.options = [];
        
        const letter = optMatch[1].toUpperCase();
        const text = optMatch[2];
        currentQ.options.push({
          content: cleanText(text),
          isCorrect: isMarkedCorrect(formattedLine)
        });
        
        if (currentQ.options.length >= 4 || letter === 'D') {
          pushCurrentQuestion();
        }
      }
      continue;
    }

    // 2.5. Detect key/answer lines to prevent them from overriding questions and extract answers
    const keyMatch = cleanLine.match(/^(Question|Câu|Q)?\s*(\d+)\s*[\.:\)-]\s*(?:chọn|key|answer|đáp án)\s*([A-D])\b/i) || 
                     cleanLine.match(/^(Question|Câu|Q)?\s*(\d+)\s*[\.:\)-]\s*([A-D])$/i);
    if (keyMatch) {
      const qNum = parseInt(keyMatch[2], 10);
      const letter = keyMatch[3].toUpperCase();
      
      // Find the question in currentQuestions or all previously pushed groups
      let targetQ = currentQuestions.find(q => q.qNum === qNum) || (currentQ && currentQ.qNum === qNum ? currentQ : null);
      if (!targetQ) {
        for (const g of groups) {
          const found = g.questions.find((q: any) => q.qNum === qNum);
          if (found) {
            targetQ = found;
            break;
          }
        }
      }

      if (targetQ && targetQ.options) {
        const idx = letter.charCodeAt(0) - 65;
        if (targetQ.options[idx]) {
          targetQ.options.forEach((o: any) => o.isCorrect = false);
          targetQ.options[idx].isCorrect = true;
        }
      }
      continue;
    }

    // 3. Detect new question line
    const qRegex = /^(Question|Câu|Q)?\s*(\d+)\s*[\.:\)-]\s*(.*)$/i;
    const qMatch = cleanLine.match(qRegex);
    
    if (qMatch) {
      pushCurrentQuestion();
      
      let qContent = cleanText(qMatch[3]);
      const isFillBlank = qContent.includes('___') || qContent.includes('...') || qContent.includes('___');
      const qNum = parseInt(qMatch[2], 10);
      
      currentQ = {
        qNum: qNum,
        qContent: qContent,
        qType: isFillBlank ? 'fill_blank' : 'multiple_choice',
        options: [],
        correctAnswer: isFillBlank ? 'answer' : undefined
      };

      // Check if inline options exist on this same question line
      const inlineMatchSame = formattedLine.match(inlineOptRegex);
      if (inlineMatchSame) {
        const optStartIdx = qContent.search(/A[\.\)]/);
        if (optStartIdx !== -1) {
          currentQ.qContent = cleanText(qContent.substring(0, optStartIdx));
        }
        currentQ.options = [
          { content: cleanHtmlText(inlineMatchSame[1]), isCorrect: isMarkedCorrect(inlineMatchSame[1]) },
          { content: cleanHtmlText(inlineMatchSame[2]), isCorrect: isMarkedCorrect(inlineMatchSame[2]) },
          { content: cleanHtmlText(inlineMatchSame[3]), isCorrect: isMarkedCorrect(inlineMatchSame[3]) },
          { content: cleanHtmlText(inlineMatchSame[4]), isCorrect: isMarkedCorrect(inlineMatchSame[4]) }
        ];
        pushCurrentQuestion();
      }
      continue;
    }

    // 4. Detect group boundaries
    const isGroupDivider = /^(questions?\s*\d+|part|section|audio)\s*\d+/i.test(cleanLine);
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

    // 5. Append trailing content
    if (currentQ) {
      if (cleanLine.toLowerCase().startsWith('key:') || cleanLine.toLowerCase().startsWith('answer:')) {
        const ans = cleanLine.replace(/^(key|answer|đáp án)\s*[\.:-]\s*/i, '');
        if (currentQ.qType === 'fill_blank') {
          currentQ.correctAnswer = ans;
        } else {
          const letter = ans.trim().toUpperCase();
          if (['A', 'B', 'C', 'D'].includes(letter)) {
            const idx = letter.charCodeAt(0) - 65;
            if (currentQ.options && currentQ.options[idx]) {
              currentQ.options.forEach((o: any) => o.isCorrect = false);
              currentQ.options[idx].isCorrect = true;
            }
          }
        }
        pushCurrentQuestion();
      } else if (cleanLine.toLowerCase().startsWith('explanation:') || cleanLine.toLowerCase().startsWith('giải thích:')) {
        currentQ.qExplanation = cleanLine.replace(/^(explanation|giải thích)\s*[\.:-]\s*/i, '');
      } else {
        currentQ.qContent += ' ' + cleanLine;
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

  // Clean up helper tracking fields (like qNum) from the final response
  groups.forEach(g => {
    if (g.questions) {
      g.questions.forEach((q: any) => {
        delete q.qNum;
      });
    }
  });

  return { skill: 'listening', groups };
}

function stripFormattingFromOptionLetters(html: string): string {
  if (!html) return '';
  return html
    .replace(/<strong[^>]*>\s*([A-D])\s*[\.\)]\s*<\/strong>/gi, ' $1. ')
    .replace(/<b[^>]*>\s*([A-D])\s*[\.\)]\s*<\/b>/gi, ' $1. ')
    .replace(/<u[^>]*>\s*([A-D])\s*[\.\)]\s*<\/u>/gi, ' $1. ')
    .replace(/<span[^>]*>\s*([A-D])\s*[\.\)]\s*<\/span>/gi, ' $1. ')
    .replace(/<strong[^>]*>\s*([A-D])\s*<\/strong>\s*[\.\)]/gi, ' $1. ')
    .replace(/<b[^>]*>\s*([A-D])\s*<\/b>\s*[\.\)]/gi, ' $1. ')
    .replace(/<u[^>]*>\s*([A-D])\s*<\/u>\s*[\.\)]/gi, ' $1. ')
    .replace(/<span[^>]*>\s*([A-D])\s*<\/span>\s*[\.\)]/gi, ' $1. ');
}

function stripTagsExceptFormatting(html: string): string {
  if (!html) return '';
  // Convert underlined spans to <u>
  let normalized = html.replace(/<span[^>]*text-decoration[^>]*underline[^>]*>(.*?)<\/span>/gi, '<u>$1</u>');
  normalized = stripFormattingFromOptionLetters(normalized);
  return normalized
    .replace(/&nbsp;/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/<(?!strong|b|u|\/strong|\/b|\/u)[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if the text has markers indicating it is the correct answer
 */
function isMarkedCorrect(html: string): boolean {
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
