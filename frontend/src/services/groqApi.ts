/**
 * Groq AI API Service
 * Sử dụng Groq API để generate gợi ý cho VSTEP Speaking và parse PDF đề thi
 */

export interface ParsedQuestion {
  qContent: string;
  qType: 'multiple_choice' | 'fill_blank' | 'short_answer';
  qPoints: number;
  options: { A?: string; B?: string; C?: string; D?: string };
  correct_answer: string;
}

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_MODEL = import.meta.env.VITE_GROQ_MODEL || 'openai/gpt-oss-120b';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_TRANSCRIBE_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const GROQ_WHISPER_MODEL = 'whisper-large-v3-turbo';

/**
 * Transcribe audio file -> text using Groq Whisper (free tier)
 * Hỗ trợ mp3/wav/m4a/webm/ogg... ≤ 25MB
 */
export const transcribeAudio = async (
  file: File,
  language: string = 'en'
): Promise<string> => {
  if (!GROQ_API_KEY) {
    throw new Error('Missing VITE_GROQ_API_KEY');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('model', GROQ_WHISPER_MODEL);
  formData.append('response_format', 'text');
  if (language) formData.append('language', language);

  const response = await fetch(GROQ_TRANSCRIBE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText);
    throw new Error(`Groq transcribe error: ${errText}`);
  }

  // response_format=text returns plain text
  const text = await response.text();
  return text.trim();
};

interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GroqResponse {
  choices: {
    message: {
      content: string;
      reasoning?: string;
    };
  }[];
}

/**
 * Gọi Groq API
 */
const callGroqAPI = async (messages: GroqMessage[]): Promise<string> => {
  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 2500,
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.statusText}`);
    }

    const data: GroqResponse = await response.json();
    let content = data.choices[0]?.message?.content || '';
    content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    if (!content && data.choices[0]?.message?.reasoning) {
      content = data.choices[0].message.reasoning.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    }
    return content;
  } catch (error) {
    console.error('Groq API error:', error);
    throw error;
  }
};

/**
 * Generate topic suggestions cho Part 1
 */
export const generatePart1Topics = async (): Promise<string[]> => {
  const messages: GroqMessage[] = [
    {
      role: 'system',
      content: 'You are an expert VSTEP Speaking test creator. Generate topic names for Part 1 (Social Interaction) of VSTEP Speaking test.',
    },
    {
      role: 'user',
      content: `Generate 5 diverse topic names for VSTEP Speaking Part 1 (Social Interaction).
      
Topics should be about familiar daily life subjects like:
- Free time activities
- Hobbies
- Career/Work
- Hometown
- Family
- Food & Cooking
- Shopping
- Travel
- Technology
- Health & Exercise

Return ONLY a JSON array of topic names, nothing else. Example format:
["Free time activities", "Travel experiences", "Food and cooking"]`,
    },
  ];

  const response = await callGroqAPI(messages);
  
  try {
    // Parse JSON response
    const topics = JSON.parse(response);
    return Array.isArray(topics) ? topics : [];
  } catch (error) {
    console.error('Failed to parse topics:', error);
    return [];
  }
};

/**
 * Generate questions cho một topic trong Part 1
 */
export const generatePart1Questions = async (topicName: string): Promise<string[]> => {
  const messages: GroqMessage[] = [
    {
      role: 'system',
      content: 'You are an expert VSTEP Speaking test creator. Generate SHORT questions for Part 1 (Social Interaction).',
    },
    {
      role: 'user',
      content: `Generate 3 SHORT questions for VSTEP Speaking Part 1 about: "${topicName}"

Requirements:
- Keep questions VERY SHORT (8-9 words each, max 10 words)
- Use simple, natural language
- Mix question types: Yes/No, Wh-questions
- Easy to understand and answer
- Follow this format style:
  * Question 1: Basic/factual (e.g., "What is your job?", "Do you play games daily?")
  * Question 2: Preference/habit (e.g., "Where do you work?", "What's your favorite game?")
  * Question 3: Opinion/reason (e.g., "Do you like your job?", "Why do you enjoy it?")

Return ONLY a JSON array of 3 questions, nothing else. Example format:
["What is your job?", "Where do you work?", "Do you like your job?"]`,
    },
  ];

  const response = await callGroqAPI(messages);
  
  try {
    const questions = JSON.parse(response);
    return Array.isArray(questions) ? questions.slice(0, 3) : [];
  } catch (error) {
    console.error('Failed to parse questions:', error);
    return [];
  }
};

/**
 * Generate situation + solutions cho Part 2
 */
export const generatePart2Content = async (): Promise<{
  situation: string;
  solutions: string[];
  question: string;
}> => {
  const messages: GroqMessage[] = [
    {
      role: 'system',
      content: 'You are an expert VSTEP Speaking test creator. Generate CONCISE content for Part 2 (Solution Discussion).',
    },
    {
      role: 'user',
      content: `Generate content for VSTEP Speaking Part 2 (Solution Discussion).

Requirements:
- Create a SHORT, realistic situation (2-3 sentences max)
- Situation should INCLUDE the 3 solutions naturally in the description
- Solutions should be brief phrases (3-5 words each)
- Common topics: advertising methods, improving skills, choosing options, solving problems, making decisions

Format style (like official VSTEP):
"You are thinking about ways to advertise your chain cafeteria. There are 3 options: using the Internet, TV ads, and brochures. Which is the best option and why?"

Return ONLY a JSON object with this exact format:
{
  "situation": "Complete situation description that includes all 3 options naturally (2-3 sentences)",
  "solutions": ["Option 1 (brief)", "Option 2 (brief)", "Option 3 (brief)"],
  "question": "Which is the best option and why?"
}

IMPORTANT: The situation should be ONE cohesive paragraph that mentions all 3 solutions, not separate pieces.`,
    },
  ];

  const response = await callGroqAPI(messages);
  
  try {
    const content = JSON.parse(response);
    return {
      situation: content.situation || '',
      solutions: Array.isArray(content.solutions) ? content.solutions.slice(0, 3) : ['', '', ''],
      question: content.question || 'Which is the best option and why?',
    };
  } catch (error) {
    console.error('Failed to parse Part 2 content:', error);
    return {
      situation: '',
      solutions: ['', '', ''],
      question: 'Which is the best option and why?',
    };
  }
};

/**
 * Generate main topic cho Part 3
 */
export const generatePart3MainTopic = async (): Promise<string> => {
  const messages: GroqMessage[] = [
    {
      role: 'system',
      content: 'You are an expert VSTEP Speaking test creator. Generate DIVERSE main topics for Part 3 (Topic Development) of VSTEP Speaking test.',
    },
    {
      role: 'user',
      content: `Generate 1 main topic for VSTEP Speaking Part 3 (Topic Development).

The topic should:
- Be broad enough for a 2-minute talk
- Be relatable to students
- Allow for personal experiences and opinions
- MUST be DIVERSE - avoid topics about "English" or "learning English"

DIVERSE topic categories (choose randomly):
- Daily life: hobbies, free time, routines, habits
- People: family, friends, role models, neighbors
- Places: hometown, favorite places, travel destinations
- Activities: sports, cooking, shopping, entertainment
- Technology: social media, smartphones, internet, apps
- Education: school life, studying methods, favorite subjects (NOT English learning)
- Work: jobs, careers, workplace, future plans
- Health: exercise, diet, wellness, lifestyle
- Environment: nature, pollution, recycling, climate
- Culture: festivals, traditions, customs, celebrations
- Food: cooking, restaurants, favorite dishes, eating habits
- Transportation: commuting, vehicles, public transport

Return ONLY the topic text (2-4 words), nothing else. Examples:
"Cooking at home"
"Your hometown"
"Social media use"
"Weekend activities"`,
    },
  ];

  const response = await callGroqAPI(messages);
  return response.trim().replace(/^["']|["']$/g, ''); // Remove quotes if any
};

/**
 * Generate suggested ideas cho Part 3
 */
export const generatePart3Ideas = async (mainTopic: string): Promise<string[]> => {
  const messages: GroqMessage[] = [
    {
      role: 'system',
      content: 'You are an expert VSTEP Speaking test creator. Generate suggested ideas for Part 3 (Topic Development) of VSTEP Speaking test.',
    },
    {
      role: 'user',
      content: `Generate 4-5 suggested ideas for VSTEP Speaking Part 3 about: "${mainTopic}"

These ideas should:
- Help students structure their 2-minute talk
- Cover different aspects (who, what, when, where, why, how)
- Be brief bullet points

Return ONLY a JSON array of 4-5 ideas, nothing else. Example format:
["Where you went", "When you went there", "Who you went with", "What you did there", "Why it was memorable"]`,
    },
  ];

  const response = await callGroqAPI(messages);
  
  try {
    const ideas = JSON.parse(response);
    return Array.isArray(ideas) ? ideas.slice(0, 5) : [];
  } catch (error) {
    console.error('Failed to parse ideas:', error);
    return [];
  }
};

/**
 * Generate follow-up questions cho Part 3
 */
export const generatePart3Questions = async (mainTopic: string): Promise<string[]> => {
  const messages: GroqMessage[] = [
    {
      role: 'system',
      content: 'You are an expert VSTEP Speaking test creator. Generate follow-up questions for Part 3 (Topic Development) of VSTEP Speaking test.',
    },
    {
      role: 'user',
      content: `Generate 2-3 follow-up questions for VSTEP Speaking Part 3 about: "${mainTopic}"

These questions should:
- Be deeper than the main topic
- Require analysis, comparison, or evaluation
- Be open-ended
- Relate to the main topic but expand beyond personal experience

Return ONLY a JSON array of 2-3 questions, nothing else. Example format:
["Do you think traveling is important for young people? Why?", "How has tourism changed in your country in recent years?"]`,
    },
  ];

  const response = await callGroqAPI(messages);
  
  try {
    const questions = JSON.parse(response);
    return Array.isArray(questions) ? questions.slice(0, 3) : [];
  } catch (error) {
    console.error('Failed to parse follow-up questions:', error);
    return [];
  }
};

/**
 * Generate ideas + questions based on existing main topic
 * Used when teacher already has a main topic and wants AI to suggest ideas + questions
 */
export const generatePart3FromTopic = async (mainTopic: string): Promise<{
  suggestedIdeas: string[];
  followUpQuestions: string[];
}> => {
  const messages: GroqMessage[] = [
    {
      role: 'system',
      content: 'You are an expert VSTEP Speaking test creator. Generate ideas and questions for Part 3 based on a given main topic.',
    },
    {
      role: 'user',
      content: `Generate ideas and questions for VSTEP Speaking Part 3 based on this main topic: "${mainTopic}"

Requirements:
- 4 suggested ideas: SHORT phrases (2-4 words each) that relate to the main topic
  * These will be displayed in a mind map around the center
  * Keep them brief, clear, and diverse
  * Cover different aspects: benefits, challenges, personal experience, opinions
  * Examples: "Saves time", "More convenient", "Expensive", "Popular choice"
- 2 follow-up questions: Deeper analytical questions (10-15 words each)
  * Should expand beyond personal experience
  * Require comparison, evaluation, or analysis
  * Related to the main topic but broader perspective

Return ONLY a JSON object:
{
  "suggestedIdeas": ["Idea 1 (2-4 words)", "Idea 2", "Idea 3", "Idea 4"],
  "followUpQuestions": ["Question 1 (10-15 words)", "Question 2 (10-15 words)"]
}`,
    },
  ];

  const response = await callGroqAPI(messages);
  
  try {
    const content = JSON.parse(response);
    return {
      suggestedIdeas: Array.isArray(content.suggestedIdeas) ? content.suggestedIdeas.slice(0, 4) : ['', '', '', ''],
      followUpQuestions: Array.isArray(content.followUpQuestions) ? content.followUpQuestions.slice(0, 3) : ['', ''],
    };
  } catch (error) {
    console.error('Failed to generate ideas from topic:', error);
    return {
      suggestedIdeas: ['', '', '', ''],
      followUpQuestions: ['', ''],
    };
  }
};

/**
 * Enhance/rewrite existing Part 1 questions để đa dạng và tự nhiên hơn
 * Nhận vào topic + câu hỏi hiện có, trả về phiên bản cải thiện
 */
export const enhancePart1Questions = async (
  topicName: string,
  existingQuestions: string[]
): Promise<string[]> => {
  // Lọc câu hỏi có nội dung
  const filledQuestions = existingQuestions.filter(q => q.trim());

  const messages: GroqMessage[] = [
    {
      role: 'system',
      content: `You are an expert VSTEP Speaking test designer. Rewrite questions to be VERY SHORT and NATURAL.

Guidelines:
- Keep questions VERY SHORT (8-9 words, max 10 words)
- Use simple, conversational language
- Mix question types: Yes/No, Wh-questions
- Questions should feel natural and easy
- Appropriate for B1-B2 level
- Follow progression: Basic → Preference → Opinion`,
    },
    {
      role: 'user',
      content: `Topic: "${topicName}"

${filledQuestions.length > 0
  ? `Current questions (make them SHORTER - only 8-9 words each):
${filledQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
  : `Generate 3 VERY SHORT questions (8-9 words each).`}

Requirements:
- Return exactly 3 questions
- Each question 8-9 words (max 10 words)
- Follow this progression:
  * Question 1: Basic/factual (e.g., "What is your job?")
  * Question 2: Preference/habit (e.g., "Where do you work?")
  * Question 3: Opinion/reason (e.g., "Do you like your job?")
- Keep them conversational and easy
- Suitable for VSTEP Speaking Part 1

Return ONLY a JSON array of exactly 3 strings, no explanation:
["Question 1", "Question 2", "Question 3"]`,
    },
  ];

  const response = await callGroqAPI(messages);

  try {
    // Try to extract JSON array from response
    const match = response.match(/\[[\s\S]*\]/);
    if (match) {
      const questions = JSON.parse(match[0]);
      if (Array.isArray(questions) && questions.length >= 3) {
        return questions.slice(0, 3);
      }
    }
    // Fallback: parse full response
    const questions = JSON.parse(response);
    return Array.isArray(questions) ? questions.slice(0, 3) : existingQuestions;
  } catch (err) {
    console.error('Failed to parse enhanced questions:', err);
    return existingQuestions;
  }
};

/**
 * Parse câu hỏi và đáp án từ text PDF đề thi
 * Sử dụng max_tokens cao hơn để xử lý nhiều câu hỏi
 */
export const parsePdfQA = async (pdfText: string): Promise<ParsedQuestion[]> => {
  if (!GROQ_API_KEY) throw new Error('Missing VITE_GROQ_API_KEY');

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      max_tokens: 1200,
      messages: [
        {
          role: 'system',
          content: `You are an expert exam parser for English language tests (VSTEP, IELTS, TOEIC, General).
Extract ALL multiple choice questions from the provided exam text.

Return ONLY a valid JSON array in this exact format:
[
  {
    "qContent": "Complete question text (include question number if present)",
    "qType": "multiple_choice",
    "qPoints": 1,
    "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
    "correct_answer": "A"
  }
]

STRICT RULES:
- Extract EVERY question — do not skip any
- correct_answer MUST be exactly one of: "A", "B", "C", "D"
- If answer key is not shown in the text, default to "A"
- SKIP: instructions, headings, reading passages, audio transcripts, blank boxes
- KEEP: the full question stem and all 4 options
- Return ONLY the JSON array — no markdown, no explanation`,
        },
        {
          role: 'user',
          content: `Extract all questions from this exam text:\n\n${pdfText}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => response.statusText);
    throw new Error(`Groq API error: ${err}`);
  }

  const data: GroqResponse = await response.json();
  const content = data.choices[0].message.content;

  try {
    const match = content.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.error('parsePdfQA: failed to parse Groq JSON response');
    return [];
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
 * VSTEP exam PDF → ImportPayload
 * ───────────────────────────────────────────────────────────────────────────── */

export interface VstepImportPayload {
  listening?: { parts: Array<{ partNumber: number; sections: Array<any> }> };
  reading?:   { parts: Array<{ partNumber: number; passage: string; questions: Array<any> }> };
  writing?:   { tasks: Array<{ taskNumber: number; prompt: string; wordCount?: [number, number]; timeLimit?: number }> };
}

const callGroqJson = async (system: string, user: string, maxTokens = 2500): Promise<any> => {
  if (!GROQ_API_KEY) throw new Error('Missing VITE_GROQ_API_KEY');
  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Groq error: ${await res.text().catch(() => res.statusText)}`);
  const data = await res.json();
  const content = data.choices[0].message.content as string;
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Parse VSTEP exam text into the ImportPayload structure.
 * Calls Groq 3 times (one per skill) to keep each request small.
 * onProgress: ({ skill, done, total })
 */
export const parseVstepFromText = async (
  fullText: string,
  onProgress?: (info: { skill: 'listening' | 'reading' | 'writing'; done: number; total: number }) => void,
): Promise<VstepImportPayload> => {
  const text = fullText.slice(0, 18_000); // safety cap
  const out: VstepImportPayload = {};

  // ─── LISTENING ─────────────────────────────────────────────────────────────
  onProgress?.({ skill: 'listening', done: 0, total: 3 });
  const listeningPrompt = `You are a VSTEP exam parser. Extract the LISTENING section.

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "parts": [
    {
      "partNumber": 1,
      "sections": [
        {
          "sectionNumber": 1,
          "sectionName": "Announcement 1",
          "transcript": "...full transcript text...",
          "questions": [
            { "questionNumber": 1, "questionText": "...", "options": { "A": "...", "B": "...", "C": "...", "D": "..." }, "correctAnswer": "A" }
          ]
        }
      ]
    }
  ]
}

VSTEP Listening structure:
- Part 1: 8 short Announcements (Q1-8) — 1 question each
- Part 2: 3 Conversations (Q9-20) — 4 questions each
- Part 3: 3 Talks/Lectures (Q21-35) — 5 questions each

RULES:
- Group questions by their numbers into the correct part/section
- Include transcript if present in text, otherwise empty string
- correctAnswer MUST be "A", "B", "C", or "D" — default "A" if no answer key
- Only output parts/sections that exist in the text`;

  try {
    const lis = await callGroqJson(listeningPrompt, `Extract VSTEP Listening from:\n\n${text}`, 3000);
    if (lis?.parts?.length) out.listening = lis;
  } catch (e) { console.warn('Listening parse failed:', e); }
  onProgress?.({ skill: 'listening', done: 1, total: 3 });

  await sleep(2000); // rate-limit safety

  // ─── READING ───────────────────────────────────────────────────────────────
  const readingPrompt = `You are a VSTEP exam parser. Extract the READING section.

Return ONLY valid JSON in this exact format:
{
  "parts": [
    {
      "partNumber": 1,
      "passage": "...full passage text...",
      "questions": [
        { "questionNumber": 1, "questionText": "...", "options": { "A": "...", "B": "...", "C": "...", "D": "..." }, "correctAnswer": "A" }
      ]
    }
  ]
}

VSTEP Reading: 4 parts × 10 questions each (Q1-10, 11-20, 21-30, 31-40 in reading numbering, may be Q36-75 overall).

RULES:
- Group questions by their numbers into 4 parts of 10
- Include the full passage text for each part
- correctAnswer MUST be "A", "B", "C", or "D" — default "A" if no answer key`;

  try {
    const rd = await callGroqJson(readingPrompt, `Extract VSTEP Reading from:\n\n${text}`, 3500);
    if (rd?.parts?.length) out.reading = rd;
  } catch (e) { console.warn('Reading parse failed:', e); }
  onProgress?.({ skill: 'reading', done: 2, total: 3 });

  await sleep(2000);

  // ─── WRITING ───────────────────────────────────────────────────────────────
  const writingPrompt = `You are a VSTEP exam parser. Extract the WRITING section.

Return ONLY valid JSON in this exact format:
{
  "tasks": [
    { "taskNumber": 1, "prompt": "...full prompt text...", "wordCount": [80, 120], "timeLimit": 20 },
    { "taskNumber": 2, "prompt": "...full prompt text...", "wordCount": [200, 250], "timeLimit": 40 }
  ]
}

VSTEP Writing:
- Task 1: Informal letter/email — 80-120 words — 20 minutes
- Task 2: Argumentative essay — 200-250 words — 40 minutes

RULES:
- Extract the FULL prompt including any instructions
- Use defaults [80,120]/20 and [200,250]/40 if word count/time not stated`;

  try {
    const wr = await callGroqJson(writingPrompt, `Extract VSTEP Writing from:\n\n${text}`, 1500);
    if (wr?.tasks?.length) out.writing = wr;
  } catch (e) { console.warn('Writing parse failed:', e); }
  onProgress?.({ skill: 'writing', done: 3, total: 3 });

  return out;
};


/* ─────────────────────────────────────────────────────────────────────────────
 * IELTS exam PDF → IELTS skill data
 * Mỗi skill có schema khác nhau (sections / passages / tasks / parts)
 * Hỗ trợ cả Academic và General Training.
 * ───────────────────────────────────────────────────────────────────────────── */

export type IeltsImportSkill = 'listening' | 'reading' | 'writing' | 'speaking';
export type IeltsImportTestType = 'Academic' | 'General Training';

export interface IeltsListeningImport {
  sections: Array<{
    sectionNumber: 1 | 2 | 3 | 4;
    /** Optional topic/context title for the section (e.g. "Restaurant recommendations") */
    sectionTitle?: string;
    sectionName?: string;
    /** Main instruction of the section copied verbatim (e.g. "Complete the notes below...") */
    sectionInstruction?: string;
    transcript?: string;
    audioUrl?: string;
    questions: Array<{
      questionNumber: number;
      questionType: string;       // multiple-choice | form-completion | note-completion | ...
      questionText: string;
      /** Optional shared task title (e.g. "Loneliness and mental health") */
      taskTitle?: string;
      /** Optional shared task instruction (e.g. "Choose the correct letter, A, B or C.") */
      taskInstruction?: string;
      options?: { A?: string; B?: string; C?: string; D?: string };
      correctAnswer: string;
    }>;
  }>;
}

export interface IeltsReadingImport {
  passages: Array<{
    passageNumber: 1 | 2 | 3;
    title?: string;
    body: string;
    wordCount?: number;
    questions: Array<{
      questionNumber: number;
      questionType: string;
      questionText: string;
      options?: { A?: string; B?: string; C?: string; D?: string };
      correctAnswer: string;
    }>;
  }>;
}

export interface IeltsWritingImport {
  tasks: Array<{
    taskNumber: 1 | 2;
    prompt: string;
    chartType?: 'bar' | 'line' | 'pie' | 'table' | 'process' | 'map';
    tone?: 'formal' | 'semi-formal' | 'informal';
    essayType?: 'opinion' | 'discuss' | 'problem-solution' | 'advantages-disadvantages';
    modelAnswer?: string;
  }>;
}

export interface IeltsSpeakingImport {
  parts: Array<
    | {
        partNumber: 1 | 3;
        questions: Array<{ topic?: string; text: string }>;
      }
    | {
        partNumber: 2;
        cueCard: {
          topic: string;
          bullets: string[];
          followUp?: string;
        };
      }
  >;
}

export type IeltsSkillImport =
  | IeltsListeningImport
  | IeltsReadingImport
  | IeltsWritingImport
  | IeltsSpeakingImport;

/* ───── Skill-specific prompts ───────────────────────────────────────────── */

const IELTS_LISTENING_PROMPT = (testType: IeltsImportTestType) => `You are an IELTS ${testType} exam parser. Extract the LISTENING section.

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "sections": [
    {
      "sectionNumber": 1,
      "sectionTitle": "Hotel booking",
      "sectionInstruction": "Complete the form below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.",
      "transcript": "...optional transcript...",
      "questions": [
        {
          "questionNumber": 1,
          "questionType": "form-completion",
          "taskTitle": "Hotel Booking Form",
          "taskInstruction": "Complete the form below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.",
          "questionText": "Full name: Sarah ___1___",
          "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
          "correctAnswer": "Thompson"
        }
      ]
    }
  ]
}

IELTS Listening structure:
- 4 sections × 10 questions = 40 total
- Section 1: everyday social context (form/note completion)
- Section 2: monologue everyday (note/map)
- Section 3: educational discussion (MCQ)
- Section 4: academic lecture (note completion)

questionType MUST be one of:
"multiple-choice", "form-completion", "note-completion", "table-completion",
"flow-chart-completion", "summary-completion", "sentence-completion",
"short-answer", "matching", "plan-map-diagram"

RULES:
- For fill-blank style questions, use "___N___" pattern in questionText where N = question number
- For multiple-choice, fill options A/B/C/D and correctAnswer = letter
- For other types, options can be omitted; correctAnswer = expected word/phrase or letter
- Default correctAnswer = "" if not in source
- Only return sections present in the text

TASK GROUPING (IMPORTANT for student UX):
- "sectionTitle": REQUIRED per section. Short topic/context phrase of the whole part, inferred from content (e.g. "Restaurant recommendations", "Pottery class", "Reclaiming urban rivers"). Never use generic "Section 1". Empty "" only if undeterminable.
- "sectionInstruction": REQUIRED per section. The MAIN instruction line(s) of that part, copied VERBATIM from the source (e.g. "Complete the notes below. Write ONE WORD ONLY for each answer."). Do NOT invent or paraphrase — copy exactly as written. Combine the "Complete..." line and the "Write..." line into one string. Empty "" only if no instruction present.
- "taskTitle": If multiple questions share a topic title in the source PDF (e.g. "Loneliness and mental health" above Q27–30), repeat the SAME taskTitle for every question in that group. Leave empty string "" when no title.
- "taskInstruction": The shared instruction for a SUB-GROUP of questions when it differs from the section instruction (e.g. a section where Q21–22 are "Choose TWO letters, A–E." but Q23–30 are "Choose the correct letter, A, B or C."). Copy verbatim. Repeat the SAME instruction for every question in the same sub-group. Leave "" if it equals the section instruction.
- For grouped MCQ where multiple questions share the same stem (e.g. "Which TWO things..." answered by Q21 AND Q22), put the SAME questionText for each question in the group — frontend will merge them.

MATCHING questions (questionType = "matching") — CRITICAL for student comprehension:
- The source shows a shared QUESTION/heading (e.g. "Where does the speaker decide to put items in?"), a LEGEND box of lettered choices (A, B, C...), and a list of ITEMS (e.g. "kettle", "alarm clock") each to be matched to a letter.
- "questionText": put ONLY the item being matched (e.g. "kettle"). Do NOT put the letter here.
- "taskInstruction": put the shared question + the "Write the correct letter..." line, copied verbatim (e.g. "Where does the speaker decide to put items in? Write the correct letter, A, B or C, next to questions 7-10."). Repeat the SAME taskInstruction for EVERY matching question in the group.
- "options": put the LEGEND meanings, e.g. { "A": "in emergency pack", "B": "in personal package", "C": "in storage with the furniture" }. Repeat the SAME options object for EVERY matching question in the group.
- "correctAnswer": the matching LETTER only (e.g. "C").
EXAMPLE matching question:
  { "questionNumber": 8, "questionType": "matching", "questionText": "kettle", "taskTitle": "Items", "taskInstruction": "Where does the speaker decide to put items in? Write the correct letter, A, B or C.", "options": { "A": "in emergency pack", "B": "in personal package", "C": "in storage with the furniture" }, "correctAnswer": "C" }`;

const IELTS_READING_PROMPT = (testType: IeltsImportTestType) => `You are an IELTS ${testType} exam parser. Extract the READING section.

Return ONLY valid JSON in this exact format:
{
  "passages": [
    {
      "passageNumber": 1,
      "title": "Passage title",
      "body": "...full passage text...",
      "wordCount": 850,
      "questions": [
        {
          "questionNumber": 1,
          "questionType": "true-false-not-given",
          "questionText": "Statement to verify",
          "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
          "correctAnswer": "TRUE"
        }
      ]
    }
  ]
}

IELTS Reading (${testType}):
- 3 passages × ~13/13/14 questions = 40 total
${testType === 'Academic'
  ? '- All 3 passages are long academic texts (700–1100 words each)'
  : '- Section 1: short everyday texts. Section 2: workplace texts. Section 3: longer general-interest text.'}

questionType MUST be one of:
"multiple-choice", "true-false-not-given", "yes-no-not-given",
"matching-headings", "matching-information", "matching-features",
"matching-sentence-endings", "sentence-completion", "summary-completion",
"short-answer", "diagram-labelling"

RULES:
- For T/F/NG: correctAnswer = "TRUE"/"FALSE"/"NOT GIVEN"
- For Y/N/NG: correctAnswer = "YES"/"NO"/"NOT GIVEN"
- For MCQ: options A-D + correctAnswer letter
- For other: options can be omitted; correctAnswer = expected word/phrase
- Include the full passage body and an estimated wordCount`;

/**
 * Prompt parse CHÍNH XÁC 1 passage (body + toàn bộ câu hỏi của passage đó).
 * Tách riêng từng passage giúp: tránh truncation token + ép AI bóc câu hỏi ra
 * khỏi body (vấn đề lớn nhất khi parse cả 3 passage một lần).
 */
const IELTS_READING_PASSAGE_PROMPT = (
  testType: IeltsImportTestType,
  passageNumber: number,
) => `You are an IELTS ${testType} exam parser. Extract EXACTLY ONE reading passage (Passage ${passageNumber}) together with ALL of its questions.

Return ONLY valid JSON in this exact format:
{
  "passageNumber": ${passageNumber},
  "title": "passage title",
  "body": "...reading passage text ONLY...",
  "wordCount": 0,
  "questions": [
    {
      "questionNumber": 1,
      "questionType": "true-false-not-given",
      "questionText": "Statement / question text",
      "options": { "A": "...", "B": "...", "C": "..." },
      "correctAnswer": "TRUE"
    }
  ]
}

CRITICAL RULES:
- "title" = the passage's REAL heading (e.g. "MAKING TIME FOR SCIENCE").
  NEVER use the line "You should spend about N minutes on Questions ..." as the
  title — that is just an instruction. Ignore it completely.
- "body" = ONLY the reading passage prose. You MUST REMOVE from the body:
  • every "Questions N–M" section and all question text / answer options
  • all instructions (e.g. "Choose the correct letter", "Do the following statements ...")
  • page footers / copyright lines (e.g. "© The British Council 2012 ...") and page numbers
- "questions" = extract EVERY numbered question as its own object. This array
  MUST NOT be empty. Never leave question text inside the body.
- Keep the ORIGINAL question numbers from the source.

questionType MUST be one of:
"multiple-choice", "true-false-not-given", "yes-no-not-given",
"matching-headings", "matching-information", "matching-features",
"matching-sentence-endings", "sentence-completion", "summary-completion",
"short-answer", "diagram-labelling"

PER-TYPE RULES:
- true-false-not-given: correctAnswer ∈ {"TRUE","FALSE","NOT GIVEN"}; omit options.
- yes-no-not-given: correctAnswer ∈ {"YES","NO","NOT GIVEN"}; omit options.
- multiple-choice: options A–D (or A–C) + correctAnswer = the letter.
- matching-features / matching-information / matching-headings: put the shared
  list of choices (A, B, C, ...) in EACH question's "options"; questionText = the
  item being classified; correctAnswer = the letter.
- sentence-completion / summary-completion / short-answer: omit options;
  correctAnswer = the expected word(s) from the passage.`;

/**
 * Tách full text thành các đoạn theo từng passage, dựa vào marker
 * "You should spend about N minutes on Questions ...".
 * Trả về [] nếu không tìm thấy ≥2 marker (để caller fallback sang parse 1 lần).
 */
function splitReadingIntoPassages(text: string): string[] {
  const marker = /You should spend about\s+\d+\s+minutes\s+on\s+Questions/gi;
  const indices: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = marker.exec(text)) !== null) indices.push(m.index);
  if (indices.length < 2) return [];
  const chunks: string[] = [];
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i];
    const end = i + 1 < indices.length ? indices[i + 1] : text.length;
    chunks.push(text.slice(start, end).trim());
  }
  return chunks;
}

/**
 * Parse READING bằng cách tách từng passage rồi gọi AI riêng cho mỗi passage
 * (song song, tối đa 3). Gộp lại thành { passages: [...] } với số passage
 * được đánh lại 1/2/3 theo thứ tự.
 */
async function parseReadingMultiPass(
  fullText: string,
  testType: IeltsImportTestType,
): Promise<IeltsReadingImport | null> {
  const chunks = splitReadingIntoPassages(fullText);

  // Fallback: không tách được → parse 1 lần với token lớn + prompt gốc.
  if (chunks.length < 2) {
    const text = fullText.slice(0, 18_000);
    const result = await callGroqJson(
      IELTS_READING_PROMPT(testType),
      `Extract IELTS ${testType} reading from:\n\n${text}`,
      8000,
    );
    if (result && Array.isArray(result.passages)) return result as IeltsReadingImport;
    return null;
  }

  // Parse song song từng passage; lỗi 1 passage không làm hỏng cả đề.
  const results = await Promise.all(
    chunks.map(async (chunk, i) => {
      const passageNumber = i + 1;
      try {
        const res = await callGroqJson(
          IELTS_READING_PASSAGE_PROMPT(testType, passageNumber),
          `Extract Passage ${passageNumber} from:\n\n${chunk.slice(0, 9_000)}`,
          4500,
        );
        if (res && Array.isArray(res.questions)) {
          return { ...res, passageNumber } as IeltsReadingImport['passages'][number];
        }
      } catch {
        /* bỏ qua passage lỗi */
      }
      return null;
    }),
  );

  const passages = results.filter(
    (p): p is IeltsReadingImport['passages'][number] => p !== null,
  );
  if (passages.length === 0) return null;
  return { passages };
}

const IELTS_WRITING_PROMPT = (testType: IeltsImportTestType) => `You are an IELTS ${testType} exam parser. Extract the WRITING section.

Return ONLY valid JSON in this exact format:
{
  "tasks": [
    {
      "taskNumber": 1,
      "prompt": "...full prompt...",
      ${testType === 'Academic' ? '"chartType": "bar"' : '"tone": "semi-formal"'},
      "modelAnswer": ""
    },
    {
      "taskNumber": 2,
      "prompt": "...full prompt...",
      "essayType": "opinion",
      "modelAnswer": ""
    }
  ]
}

IELTS Writing (${testType}):
- Task 1 (≥150 words, 20 min): ${testType === 'Academic'
  ? 'Describe a chart/graph/diagram. chartType ∈ {bar, line, pie, table, process, map}'
  : 'Write a letter. tone ∈ {formal, semi-formal, informal}'}
- Task 2 (≥250 words, 40 min): essay. essayType ∈ {opinion, discuss, problem-solution, advantages-disadvantages}

RULES:
- Extract FULL prompt text including all sub-bullets
- modelAnswer = "" unless explicitly provided in source`;

const IELTS_SPEAKING_PROMPT = `You are an IELTS exam parser. Extract the SPEAKING section.

Return ONLY valid JSON in this exact format:
{
  "parts": [
    {
      "partNumber": 1,
      "questions": [
        { "topic": "Hometown", "text": "Where are you from?" }
      ]
    },
    {
      "partNumber": 2,
      "cueCard": {
        "topic": "Describe a memorable journey",
        "bullets": ["Where", "When", "Who with", "Why memorable"],
        "followUp": "Will you go again?"
      }
    },
    {
      "partNumber": 3,
      "questions": [
        { "text": "How has travel changed in recent years?" }
      ]
    }
  ]
}

IELTS Speaking structure:
- Part 1 (4-5 min): Interview, 2-3 topics × 3-4 questions
- Part 2 (3-4 min): Long turn with cue card (topic + 4 bullets + follow-up)
- Part 3 (4-5 min): Discussion, 3-5 follow-up questions related to Part 2 theme

RULES:
- Part 1 & 3: extract every question with optional topic label
- Part 2: extract topic, all bullet points, and the final follow-up question
- Only include parts present in the text`;

/**
 * Parse 1 skill từ PDF text. Trả về `null` nếu fail / Groq không trả về JSON hợp lệ.
 */
export const parseIeltsSkillFromText = async (
  fullText: string,
  skill: IeltsImportSkill,
  testType: IeltsImportTestType = 'Academic',
): Promise<IeltsSkillImport | null> => {
  if (!GROQ_API_KEY) throw new Error('Missing VITE_GROQ_API_KEY');

  // READING: parse từng passage riêng (tránh truncation + ép bóc câu hỏi).
  if (skill === 'reading') {
    return await parseReadingMultiPass(fullText, testType);
  }

  const text = fullText.slice(0, 18_000); // safety cap để tránh vượt token
  let prompt: string;
  let maxTokens = 3000;
  switch (skill) {
    case 'listening':
      prompt = IELTS_LISTENING_PROMPT(testType);
      maxTokens = 3500;
      break;
    case 'writing':
      prompt = IELTS_WRITING_PROMPT(testType);
      maxTokens = 1500;
      break;
    case 'speaking':
      prompt = IELTS_SPEAKING_PROMPT;
      maxTokens = 2000;
      break;
  }

  const result = await callGroqJson(
    prompt,
    `Extract IELTS ${testType} ${skill} from:\n\n${text}`,
    maxTokens,
  );

  if (!result || typeof result !== 'object') return null;

  // Validate shape per skill
  if (skill === 'listening' && Array.isArray(result.sections)) return result as IeltsListeningImport;
  if (skill === 'writing' && Array.isArray(result.tasks)) return result as IeltsWritingImport;
  if (skill === 'speaking' && Array.isArray(result.parts)) return result as IeltsSpeakingImport;
  return null;
};


/* ─────────────────────────────────────────────────────────────────────────────
 * Kids Cambridge YLE — Exam metadata suggestion (title + description)
 * ───────────────────────────────────────────────────────────────────────────── */

export interface KidsExamMetaSuggestion {
  title: string;
  description: string;
}

/**
 * Sinh gợi ý tên đề + mô tả ngắn cho Cambridge YLE Kids exam.
 *
 * @param level   'starters' | 'movers' | 'flyers'
 * @param topic   Mô tả ngắn chủ đề/ý tưởng giáo viên muốn (vd: "động vật trong rừng",
 *                "đồ ăn yêu thích"). Có thể để trống — AI tự gợi ý ngẫu nhiên.
 */
export const generateKidsExamMeta = async (
  level: 'starters' | 'movers' | 'flyers',
  topic = ''
): Promise<KidsExamMetaSuggestion> => {
  const levelLabel = {
    starters: 'Cambridge YLE Starters (Pre-A1, 6-8 tuổi)',
    movers: 'Cambridge YLE Movers (A1, 8-11 tuổi)',
    flyers: 'Cambridge YLE Flyers (A2, 9-12 tuổi)',
  }[level];

  const messages: GroqMessage[] = [
    {
      role: 'system',
      content:
        'Bạn là chuyên gia thiết kế đề thi tiếng Anh cho trẻ em theo chuẩn Cambridge YLE. ' +
        'Trả lời ngắn gọn, tự nhiên bằng tiếng Việt, không thêm câu mở đầu hay giải thích.',
    },
    {
      role: 'user',
      content: `Hãy gợi ý tên đề thi và mô tả ngắn cho một đề ${levelLabel}.
${topic ? `Chủ đề/ý tưởng giáo viên muốn: "${topic}".` : 'Hãy chọn một chủ đề phù hợp lứa tuổi (ví dụ: động vật, gia đình, đồ ăn, lớp học, sở thích…).'}

Yêu cầu output ĐÚNG JSON, không markdown:
{
  "title": "Tên đề ngắn gọn 6-12 từ tiếng Việt, có thể chèn 1 từ tiếng Anh chủ đề",
  "description": "Mô tả 1-2 câu ngắn về nội dung đề và đối tượng phù hợp"
}`,
    },
  ];

  const raw = await callGroqAPI(messages);
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : JSON.parse(raw);
    return {
      title: typeof parsed.title === 'string' ? parsed.title.trim() : '',
      description: typeof parsed.description === 'string' ? parsed.description.trim() : '',
    };
  } catch (err) {
    console.error('generateKidsExamMeta parse failed:', err);
    return { title: '', description: '' };
  }
};
