import { api } from './api';

export interface KidsExamType {
  id: number;
  code: string;
  name: string;
  level: string;
  age_range: string;
  description: string;
}

export interface KidsTaskType {
  id: number;
  code: string;
  name: string;
  skill_type: string;
  part_number: number;
  description: string;
}

export interface KidsExamData {
  eTitle: string;
  eDescription?: string;
  eDuration: number;
  exam_type_code: string;
  mode?: 'flexible' | 'cambridge'; // Add mode field
  eStatus?: 'draft' | 'published';
  scope?: 'full' | 'skill' | 'part';
  scope_skill?: 'listening' | 'reading_writing' | 'speaking' | null;
  scope_part?: number | null;
}

// Get all exam types (Starters, Movers, Flyers)
export const getKidsExamTypes = async (): Promise<KidsExamType[]> => {
  const response = await api.get('/teacher/kids-exams/types');
  return response.data;
};

// Get all task types (with optional filters)
export const getKidsTaskTypes = async (filters?: { level?: string; skill?: string }): Promise<KidsTaskType[]> => {
  const response = await api.get('/teacher/kids-exams/task-types', { params: filters });
  return response.data;
};

// Get single task type by code
export const getKidsTaskType = async (code: string) => {
  const response = await api.get(`/teacher/kids-exams/task-types/${code}`);
  return response.data;
};

// Create a new kids exam
export const createKidsExam = async (examData: KidsExamData) => {
  const response = await api.post('/teacher/kids-exams', examData);
  return response.data;
};

// Get kids exam by ID
export const getKidsExam = async (examId: number, admin = false) => {
  const url = admin
    ? `/admin/exams/${examId}/preview/kids`
    : `/teacher/kids-exams/${examId}`;
  const response = await api.get(url);
  return response.data;
};

// Update kids exam
export const updateKidsExam = async (examId: number, examData: Partial<KidsExamData>) => {
  const response = await api.put(`/teacher/kids-exams/${examId}`, examData);
  return response.data;
};

// Delete kids exam
export const deleteKidsExam = async (examId: number) => {
  const response = await api.delete(`/teacher/kids-exams/${examId}`);
  return response.data;
};

// Get all kids exams for teacher
export const getTeacherKidsExams = async () => {
  const response = await api.get('/teacher/kids-exams');
  return response.data;
};

// Alias for getTeacherKidsExams
export const getKidsExams = getTeacherKidsExams;

// Upload media (audio/image)
export const uploadKidsMedia = async (
  file: File, 
  mediaType: 'audio' | 'image', 
  examId?: string | number | null, 
  questionId?: string | number | null
) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('media_type', mediaType);
  if (examId) formData.append('exam_id', examId.toString());
  
  // Only send question_id if it's a valid number (not temporary ID like 'q-123')
  if (questionId && !questionId.toString().startsWith('q-')) {
    formData.append('question_id', questionId.toString());
  }

  const response = await api.post('/teacher/kids-exams/media/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

// Add question to exam
export const addKidsQuestion = async (examId: number, questionData: any) => {
  const response = await api.post(`/teacher/kids-exams/${examId}/questions`, questionData);
  return response.data;
};

// Update question
export const updateKidsQuestion = async (examId: number, questionId: number, questionData: any) => {
  const response = await api.put(`/teacher/kids-exams/${examId}/questions/${questionId}`, questionData);
  return response.data;
};

// Get media for exam (without question)
export const getExamMedia = async (examId: string | number) => {
  const response = await api.get(`/teacher/kids-exams/${examId}/media`);
  return response.data;
};

// Delete question
export const deleteKidsQuestion = async (examId: number, questionId: number) => {
  const response = await api.delete(`/teacher/kids-exams/${examId}/questions/${questionId}`);
  return response.data;
};
