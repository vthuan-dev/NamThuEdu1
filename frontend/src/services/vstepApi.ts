import { api } from './api';

export interface VstepPartData {
  partNumber: number;
  partName: string;
  passage: string;
  wordCount: number;
  completedQuestions: number;
  totalQuestions: number;
  questions: {
    questionNumber: number;
    questionText: string;
    options: {
      A: string;
      B: string;
      C: string;
      D: string;
    };
    correctAnswer: 'A' | 'B' | 'C' | 'D';
    explanation?: string;
  }[];
}

export interface VstepExamData {
  title: string;
  parts: {
    partNumber: number;
    partName: string;
    passage: string;
    questions: {
      questionNumber: number;
      questionText: string;
      options: {
        A: string;
        B: string;
        C: string;
        D: string;
      };
      correctAnswer: 'A' | 'B' | 'C' | 'D';
      explanation?: string;
    }[];
  }[];
}

/* ========================================
 * VSTEP READING APIs
 * ======================================== */

/**
 * Lưu một part của đề VSTEP Reading
 */
export const saveVstepPart = async (examId: string, partNumber: number, data: VstepPartData) => {
  const response = await api.post(`/teacher/exams/${examId}/vstep/parts/${partNumber}`, data);
  return response.data;
};

/**
 * Xuất bản đề VSTEP Reading hoàn chỉnh
 */
export const publishVstepExam = async (examId: string, data: VstepExamData) => {
  const response = await api.post(`/teacher/exams/${examId}/vstep/publish`, data);
  return response.data;
};

/**
 * Load đề VSTEP Reading đã lưu
 */
export const loadVstepExam = async (examId: string, admin = false) => {
  const url = admin
    ? `/admin/exams/${examId}/preview/vstep/reading`
    : `/teacher/exams/${examId}/vstep/load`;
  const response = await api.get(url);
  return response.data;
};

/* ========================================
 * VSTEP LISTENING APIs
 * ======================================== */

export interface VstepListeningPartData {
  partNumber: number;
  partName: string;
  audioUrl: string;
  audioDuration: number;
  transcript?: string;
  completedQuestions: number;
  totalQuestions: number;
  questions: {
    questionNumber: number;
    questionText: string;
    options: {
      A: string;
      B: string;
      C: string;
      D: string;
    };
    correctAnswer: 'A' | 'B' | 'C' | 'D';
    explanation?: string;
  }[];
}

export interface VstepListeningQuestionPayload {
  questionNumber: number;
  questionText: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation?: string;
}

/**
 * Payload xuất bản đề Listening.
 *
 * Nội dung audio/câu hỏi đã được ghi qua saveVstepListeningSection, nên payload
 * này chủ yếu mang tiêu đề và ảnh chụp cấu trúc để backend đối chiếu.
 *
 * `audioUrl` optional và có thêm `sections` vì 1 part có thể gồm nhiều audio
 * (Part 2/3 mỗi part 3 section) — gọp về 1 audioUrl duy nhất sẽ mất dữ liệu.
 */
export interface VstepListeningExamData {
  title: string;
  parts: {
    partNumber: number;
    partName: string;
    audioUrl?: string;
    sections?: {
      sectionNumber: number;
      sectionName?: string;
      audioUrl: string;
      questions: VstepListeningQuestionPayload[];
    }[];
    questions?: VstepListeningQuestionPayload[];
  }[];
}

/**
 * Lưu một part của đề VSTEP Listening
 */
export const saveVstepListeningPart = async (
  examId: string, 
  partNumber: number, 
  data: VstepListeningPartData
) => {
  const response = await api.post(
    `/teacher/exams/${examId}/vstep/listening/parts/${partNumber}`, 
    data
  );
  return response.data;
};

/**
 * (Legacy) Lightweight: chỉ lưu audio + transcript của part, không đụng questions.
 */
export const saveVstepListeningAudio = async (
  examId: string,
  partNumber: number,
  data: { partName?: string; audioUrl: string; audioDuration: number; transcript?: string }
) => {
  const response = await api.post(
    `/teacher/exams/${examId}/vstep/listening/parts/${partNumber}/audio`,
    data
  );
  return response.data;
};

/**
 * Auto-save audio + transcript của 1 SECTION trong 1 part (không đụng questions).
 * Dùng ngay sau khi upload audio xong.
 */
export const saveVstepListeningSectionAudio = async (
  examId: string,
  partNumber: number,
  sectionNumber: number,
  data: { sectionName?: string; audioUrl: string; audioDuration: number; transcript?: string }
) => {
  const response = await api.post(
    `/teacher/exams/${examId}/vstep/listening/parts/${partNumber}/sections/${sectionNumber}/audio`,
    data
  );
  return response.data;
};

/**
 * Lưu trọn 1 SECTION: audio + transcript + questions.
 */
export const saveVstepListeningSection = async (
  examId: string,
  partNumber: number,
  sectionNumber: number,
  data: {
    sectionName?: string;
    audioUrl: string;
    audioDuration: number;
    transcript?: string;
    questions: Array<{
      questionNumber: number;
      questionText: string;
      options: { A: string; B: string; C: string; D: string };
      correctAnswer: 'A' | 'B' | 'C' | 'D';
      explanation?: string;
    }>;
  }
) => {
  const response = await api.post(
    `/teacher/exams/${examId}/vstep/listening/parts/${partNumber}/sections/${sectionNumber}`,
    data
  );
  return response.data;
};

/**
 * Xoá 1 SECTION khỏi đề (audio + câu hỏi). Dùng khi giáo viên bỏ bớt phần đã thêm,
 * tránh để lại "câu hỏi ma" trong DB.
 */
export const deleteVstepListeningSection = async (
  examId: string,
  partNumber: number,
  sectionNumber: number
) => {
  const response = await api.delete(
    `/teacher/exams/${examId}/vstep/listening/parts/${partNumber}/sections/${sectionNumber}`
  );
  return response.data;
};

/**
 * Xuất bản đề VSTEP Listening hoàn chỉnh
 */
export const publishVstepListeningExam = async (examId: string, data: VstepListeningExamData) => {
  const response = await api.post(`/teacher/exams/${examId}/vstep/listening/publish`, data);
  return response.data;
};

/**
 * Load đề VSTEP Listening đã lưu
 */
export const loadVstepListeningExam = async (examId: string, admin = false) => {
  const url = admin
    ? `/admin/exams/${examId}/preview/vstep/listening`
    : `/teacher/exams/${examId}/vstep/listening/load`;
  const response = await api.get(url);
  return response.data;
};

/* ========================================
 * VSTEP WRITING APIs
 * ======================================== */

export interface VstepWritingTaskData {
  taskNumber: number;
  taskName: string;
  prompt: string;
  wordCount: [number, number];
  timeLimit: number;
  explanation?: string;
}

export interface VstepWritingExamData {
  title: string;
  tasks: {
    taskNumber: number;
    taskName: string;
    prompt: string;
  }[];
}

/**
 * Lưu một task của đề VSTEP Writing
 */
export const saveVstepWritingTask = async (
  examId: string,
  taskNumber: number,
  data: VstepWritingTaskData
) => {
  const response = await api.post(
    `/teacher/exams/${examId}/vstep/writing/tasks/${taskNumber}`,
    data
  );
  return response.data;
};

/**
 * Xuất bản đề VSTEP Writing hoàn chỉnh
 */
export const publishVstepWritingExam = async (examId: string, data: VstepWritingExamData) => {
  const response = await api.post(`/teacher/exams/${examId}/vstep/writing/publish`, data);
  return response.data;
};

/**
 * Load đề VSTEP Writing đã lưu
 */
export const loadVstepWritingExam = async (examId: string, admin = false) => {
  const url = admin
    ? `/admin/exams/${examId}/preview/vstep/writing`
    : `/teacher/exams/${examId}/vstep/writing/load`;
  const response = await api.get(url);
  return response.data;
};

/**
 * Xoá 1 task Writing khỏi đề (dùng khi giáo viên bỏ bớt task đã thêm)
 */
export const deleteVstepWritingTask = async (examId: string, taskNumber: number) => {
  const response = await api.delete(
    `/teacher/exams/${examId}/vstep/writing/tasks/${taskNumber}`
  );
  return response.data;
};

/* ========================================
 * VSTEP SPEAKING APIs
 * ======================================== */

// Part 1: Social Interaction - Topics with 3 questions each
export interface Part1Topic {
  id: string;
  topicName: string;
  questions: string[]; // 3 questions per topic
  explanations?: string[]; // 3 explanations per topic
}

// Part 2: Solution Discussion - Situation + 3 Solutions + Question
export interface Part2Data {
  situation: string;
  solutions: string[]; // 3 solutions
  question: string;
  explanation?: string;
}

// Part 3: Topic Development - Main Topic + Suggested Ideas + Follow-up Questions
export interface Part3Data {
  mainTopic: string;
  suggestedIdeas: string[]; // 4-5 ideas
  followUpQuestions: string[]; // 2-3 questions
  explanation?: string;
  followUpExplanations?: string[];
}

export interface VstepSpeakingPartData {
  partNumber: number;
  partName: string;
  timeLimit: number;
  part1Data?: Part1Topic[];
  part2Data?: Part2Data;
  part3Data?: Part3Data;
}

export interface VstepSpeakingExamData {
  title: string;
  parts: {
    partNumber: number;
    partName: string;
    timeLimit: number;
    part1Data?: Part1Topic[];
    part2Data?: Part2Data;
    part3Data?: Part3Data;
  }[];
}

/**
 * Lưu một part của đề VSTEP Speaking
 */
export const saveVstepSpeakingPart = async (
  examId: string,
  partNumber: number,
  data: VstepSpeakingPartData
) => {
  const response = await api.post(
    `/teacher/exams/${examId}/vstep/speaking/parts/${partNumber}`,
    data
  );
  return response.data;
};

/**
 * Xuất bản đề VSTEP Speaking hoàn chỉnh
 */
export const publishVstepSpeakingExam = async (examId: string, data: VstepSpeakingExamData) => {
  const response = await api.post(`/teacher/exams/${examId}/vstep/speaking/publish`, data);
  return response.data;
};

/**
 * Load đề VSTEP Speaking đã lưu
 */
export const loadVstepSpeakingExam = async (examId: string, admin = false) => {
  const url = admin
    ? `/admin/exams/${examId}/preview/vstep/speaking`
    : `/teacher/exams/${examId}/vstep/speaking/load`;
  const response = await api.get(url);
  return response.data;
};

/**
 * Xoá 1 part Speaking khỏi đề (dùng khi giáo viên bỏ bớt part đã thêm)
 */
export const deleteVstepSpeakingPart = async (examId: string, partNumber: number) => {
  const response = await api.delete(
    `/teacher/exams/${examId}/vstep/speaking/parts/${partNumber}`
  );
  return response.data;
};

/* ========================================
 * VSTEP IMPORT — AI PARSE (PDF / Word / text)
 * ======================================== */

/**
 * Gửi TEXT (đã trích xuất ở client từ PDF thuần hoặc file Word) lên backend để
 * Gemini chuyển thành JSON đề VSTEP (Listening/Reading/Writing).
 * Nhẹ & nhanh hơn parseVstepPdf vì không upload file.
 */
export const parseVstepTextWithAi = async (text: string) => {
  const response = await api.post('/teacher/vstep/parse-text', { text }, {
    // Gemini phân tích text→JSON có thể mất 30–90s; nới timeout để không bị
    // axios hủy giữa chừng (mặc định chỉ 30s).
    timeout: 180000,
  });
  return response.data as {
    success: boolean;
    message?: string;
    data?: unknown;
  };
};
