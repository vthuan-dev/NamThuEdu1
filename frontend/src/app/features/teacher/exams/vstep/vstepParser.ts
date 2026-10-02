/**
 * VSTEP Exam Smart Parser
 * ─────────────────────────
 * Parse text trích xuất từ PDF đề thi VSTEP thành ImportPayload
 * KHÔNG dùng AI — chỉ regex + heuristic dựa trên cấu trúc cố định của VSTEP.
 *
 * Cấu trúc VSTEP:
 *   LISTENING (3 parts: 8/3/3 sections)
 *   READING   (4 passages, 10 Q each)
 *   SPEAKING  (skip)
 *   WRITING   (Task 1 + Task 2)
 */

import { formatPassageToHtml } from '../../../../../utils/examUtils';

interface ParsedQ {
  number: number;
  text: string;
  options: { A: string; B: string; C: string; D: string };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
}

export interface VstepParsedPayload {
  listening?: {
    parts: Array<{
      partNumber: number;
      sections: Array<{
        sectionNumber: number;
        sectionName: string;
        transcript: string;
        questions: Array<{
          questionNumber: number; questionText: string;
          options: { A: string; B: string; C: string; D: string };
          correctAnswer: 'A' | 'B' | 'C' | 'D';
        }>;
      }>;
    }>;
  };
  reading?: {
    parts: Array<{
      partNumber: number; partName: string;
      passage: string; wordCount: number;
      questions: Array<{
        questionNumber: number; questionText: string;
        options: { A: string; B: string; C: string; D: string };
        correctAnswer: 'A' | 'B' | 'C' | 'D';
      }>;
    }>;
  };
  writing?: {
    tasks: Array<{
      taskNumber: number; taskName: string; prompt: string;
      wordCount: [number, number]; timeLimit: number;
    }>;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Tìm vị trí bắt đầu mỗi section LISTENING/READING/SPEAKING/WRITING (line riêng) */
const findSections = (text: string): Record<string, string> => {
  const names = ['LISTENING', 'READING', 'SPEAKING', 'WRITING'];
  const positions: Array<{ name: string; pos: number }> = [];
  for (const name of names) {
    // Match line whose content is ONLY the section name (allow surrounding whitespace)
    const re = new RegExp(`^[ \\t]*${name}[ \\t]*$`, 'gm');
    const m = re.exec(text);
    if (m) positions.push({ name, pos: m.index });
  }
  positions.sort((a, b) => a.pos - b.pos);

  const result: Record<string, string> = {};
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].pos;
    const end   = i + 1 < positions.length ? positions[i + 1].pos : text.length;
    result[positions[i].name] = text.slice(start, end);
  }
  return result;
};

/** Dò các dòng "divider" để dừng append trong multi-line mode */
const isBoundaryLine = (line: string): boolean =>
  /^(Conversation|Talk(\/Lecture)?)\s+\d+[\.:]/i.test(line) ||
  /^PART\s+\d+\b/i.test(line) ||
  /^PASSAGE\s+\d+\b/i.test(line) ||
  /^TASK\s+\d+\b/i.test(line) ||
  /^(LISTENING|READING|WRITING|SPEAKING)$/.test(line) ||
  /^Directions?:/i.test(line);

/** Parse list câu hỏi multiple choice từ một block text */
const parseQuestions = (text: string): ParsedQ[] => {
  const lines = text.split('\n');
  const out: ParsedQ[] = [];
  let cur: ParsedQ | null = null;
  let lastOpt: 'A' | 'B' | 'C' | 'D' | null = null;
  let mode: 'q' | 'opt' | 'idle' = 'idle';

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { mode = 'idle'; continue; }

    // Dòng phân cách section/part — đẩy câu hiện tại và reset, KHÔNG append
    if (isBoundaryLine(line)) {
      mode = 'idle';
      continue;
    }

    // Option: cho phép missing space sau dấu chấm ("C.Students" cũng bắt được)
    const optMatch = line.match(/^([A-D])\.\s*(.+)$/);
    // Question: BẮT BUỘC phải có space sau dấu chấm để tránh nhầm với option
    const qMatch   = line.match(/^(\d+)\.\s+(.+)/);

    if (optMatch && cur) {
      const letter = optMatch[1] as 'A' | 'B' | 'C' | 'D';
      cur.options[letter] = optMatch[2].trim();
      lastOpt = letter;
      mode = 'opt';
      continue;
    }

    if (qMatch) {
      if (cur) out.push(cur);
      cur = {
        number: parseInt(qMatch[1], 10),
        text: qMatch[2].trim(),
        options: { A: '', B: '', C: '', D: '' },
        correctAnswer: 'A',
      };
      lastOpt = null;
      mode = 'q';
      continue;
    }

    // Tiếp dòng (multi-line)
    if (cur) {
      if (mode === 'q')   cur.text += ' ' + line;
      if (mode === 'opt' && lastOpt) cur.options[lastOpt] += ' ' + line;
    }
  }
  if (cur) out.push(cur);
  return out;
};

// ─── LISTENING ────────────────────────────────────────────────────────────────

const LISTENING_LAYOUT: Record<number, { sectionCount: number; perSection: number; label: string }> = {
  1: { sectionCount: 1, perSection: 8, label: 'Announcements' },
  2: { sectionCount: 3, perSection: 4, label: 'Conversation' },
  3: { sectionCount: 3, perSection: 5, label: 'Talk' },
};

const parseListening = (text: string): VstepParsedPayload['listening'] => {
  const partRe = /^[ \t]*PART[ \t]+(\d+)[ \t]*$/gm;
  const positions: Array<{ num: number; pos: number }> = [];
  let m;
  while ((m = partRe.exec(text)) !== null) positions.push({ num: parseInt(m[1], 10), pos: m.index });
  if (positions.length === 0) return undefined;

  const parts: NonNullable<VstepParsedPayload['listening']>['parts'] = [];

  for (let i = 0; i < positions.length; i++) {
    const partNum = positions[i].num;
    if (partNum < 1 || partNum > 3) continue;
    const startPos = positions[i].pos;
    const endPos   = i + 1 < positions.length ? positions[i + 1].pos : text.length;
    const partText = text.slice(startPos, endPos);

    const allQ = parseQuestions(partText);
    const layout = LISTENING_LAYOUT[partNum];
    const sections: NonNullable<VstepParsedPayload['listening']>['parts'][number]['sections'] = [];

    let qIdx = 0;
    for (let s = 1; s <= layout.sectionCount; s++) {
      const slice = allQ.slice(qIdx, qIdx + layout.perSection);
      qIdx += layout.perSection;
      if (slice.length === 0) break;
      sections.push({
        sectionNumber: s,
        sectionName:   `${layout.label} ${s}`,
        transcript:    '',
        questions: slice.map(q => ({
          questionNumber: q.number,
          questionText:   q.text,
          options:        q.options,
          correctAnswer:  q.correctAnswer,
        })),
      });
    }

    if (sections.length > 0) parts.push({ partNumber: partNum, sections });
  }

  return parts.length ? { parts } : undefined;
};

// ─── READING ──────────────────────────────────────────────────────────────────

const parseReading = (text: string): VstepParsedPayload['reading'] => {
  const passageRe = /^[ \t]*(?:PASSAGE|PART|ĐOẠN|BÀI\s+ĐỌC)[ \t]+(\d+)[ \t.:-]*$/gmi;
  const positions: Array<{ num: number; pos: number }> = [];
  let m;
  while ((m = passageRe.exec(text)) !== null) positions.push({ num: parseInt(m[1], 10), pos: m.index });
  if (positions.length === 0) return undefined;

  const parts: NonNullable<VstepParsedPayload['reading']>['parts'] = [];

  for (let i = 0; i < positions.length; i++) {
    const num      = positions[i].num;
    const startPos = positions[i].pos;
    const endPos   = i + 1 < positions.length ? positions[i + 1].pos : text.length;
    const block    = text.slice(startPos, endPos);

    const lines = block.split('\n');
    // Tìm dòng câu hỏi đầu tiên: "N. " mà trong vòng 6 dòng tiếp theo có dòng bắt đầu "A. "
    let firstQ = -1;
    for (let j = 1; j < lines.length; j++) {
      if (!/^\d+\.\s+/.test(lines[j].trim())) continue;
      for (let k = j + 1; k < Math.min(j + 8, lines.length); k++) {
        if (/^A\.\s+/.test(lines[k].trim())) { firstQ = j; break; }
      }
      if (firstQ !== -1) break;
    }

    let passage = '';
    let qs: ParsedQ[] = [];
    if (firstQ === -1) {
      passage = lines.slice(1).join('\n').trim();
    } else {
      passage = lines.slice(1, firstQ).join('\n').trim();
      qs      = parseQuestions(lines.slice(firstQ).join('\n'));
    }

    parts.push({
      partNumber: num,
      partName:   `Part ${num}`,
      passage:    formatPassageToHtml(passage),
      wordCount:  passage ? passage.split(/\s+/).length : 0,
      questions:  qs.map(q => ({
        questionNumber: q.number,
        questionText:   q.text,
        options:        q.options,
        correctAnswer:  q.correctAnswer,
      })),
    });
  }

  return parts.length ? { parts } : undefined;
};

// ─── WRITING ──────────────────────────────────────────────────────────────────

const parseWriting = (text: string): VstepParsedPayload['writing'] => {
  const taskRe = /^[ \t]*TASK[ \t]+(\d+)[ \t]*$/gm;
  const positions: Array<{ num: number; pos: number }> = [];
  let m;
  while ((m = taskRe.exec(text)) !== null) positions.push({ num: parseInt(m[1], 10), pos: m.index });
  if (positions.length === 0) return undefined;

  const tasks: NonNullable<VstepParsedPayload['writing']>['tasks'] = [];

  for (let i = 0; i < positions.length; i++) {
    const num      = positions[i].num;
    const startPos = positions[i].pos;
    const endPos   = i + 1 < positions.length ? positions[i + 1].pos : text.length;
    const lines    = text.slice(startPos, endPos).split('\n');
    // Bỏ dòng đầu (TASK N), phần còn lại là prompt
    const prompt   = lines.slice(1).join('\n').trim();

    tasks.push({
      taskNumber: num,
      taskName:   `Task ${num}`,
      prompt,
      wordCount:  num === 1 ? [80, 120] : [200, 250],
      timeLimit:  num === 1 ? 20 : 40,
    });
  }

  return tasks.length ? { tasks } : undefined;
};

// ─── Main entry ───────────────────────────────────────────────────────────────

/**
 * Parse text trích xuất từ PDF đề thi VSTEP thành ImportPayload.
 * Chạy ngay trên frontend, không gọi API.
 */
export const parseVstepExamSmart = (rawText: string): VstepParsedPayload => {
  // Loại bỏ marker "=== Page N ===" để tránh nhiễu
  const text = rawText.replace(/=== Page \d+ ===/g, '\n');

  const sections = findSections(text);
  const out: VstepParsedPayload = {};

  if (sections.LISTENING) {
    const lis = parseListening(sections.LISTENING);
    if (lis) out.listening = lis;
  }
  if (sections.READING) {
    const rd = parseReading(sections.READING);
    if (rd) out.reading = rd;
  }
  if (sections.WRITING) {
    const wr = parseWriting(sections.WRITING);
    if (wr) out.writing = wr;
  }

  return out;
};
