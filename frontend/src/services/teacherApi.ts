import { api } from './api';
import {
  ApiResponse,
  PaginatedResponse,
  TestStatistics,
  ActiveSession,
  ConnectionLog,
  SendMessageRequest,
  Course,
  CreateCourseRequest,
  UpdateCourseRequest,
  EnrollStudentRequest,
  CourseStatistics,
  Class,
  CreateClassRequest,
  UpdateClassRequest,
  EnrollStudentsRequest,
  TransferStudentsRequest,
  ClassTransferHistory,
  ClassStatistics,
  Student,
  CreateStudentRequest,
  UpdateStudentRequest,
  BulkImportResult,
  StudentStatistics,
  Exam,
  CreateExamRequest,
  UpdateExamRequest,
  CreateQuestionRequest,
  UpdateQuestionRequest,
  ExamSection,
  TestAssignment,
  AssignmentProgress,
  AssignmentStatistics,
  Submission,
  ClassReport,
  GradingStatistics,
} from '../types/teacher';
import { cacheManager, generateCacheKey, withCache } from '../utils/cacheManager';

/**
 * Teacher API Service
 * Organized by modules: dashboard, courses, classes, students, exams, assignments, grading, monitoring
 */
export const teacherApi = {
  // Core API client for direct access if needed
  client: api,

  /**
   * Dashboard & Monitoring Module
   */
  dashboard: {
    /**
     * Get test statistics for a specific exam
     * @param examId - Exam ID
     * @returns Test statistics
     */
    async getTestStatistics(examId: number): Promise<ApiResponse<TestStatistics>> {
      const cacheKey = generateCacheKey(`/teacher/dashboard/test-statistics/${examId}`);
      
      return withCache(cacheKey, async () => {
        const response = await api.get<ApiResponse<TestStatistics>>(
          `/teacher/dashboard/test-statistics/${examId}`
        );
        return response.data;
      });
    },

    /**
     * Get all active test sessions
     * @returns List of active sessions
     */
    async getActiveSessions(): Promise<ApiResponse<ActiveSession[]>> {
      const cacheKey = generateCacheKey('/teacher/dashboard/active-sessions');
      
      return withCache(cacheKey, async () => {
        const response = await api.get<ApiResponse<ActiveSession[]>>(
          '/teacher/dashboard/active-sessions'
        );
        return response.data;
      });
    },

    /**
     * Send message to a student during test
     * @param submissionId - Submission ID
     * @param message - Message content
     * @returns Success response
     */
    async sendMessage(submissionId: number, message: string): Promise<ApiResponse<void>> {
      const response = await api.post<ApiResponse<void>>(
        `/teacher/dashboard/send-message`,
        { submission_id: submissionId, message }
      );
      return response.data;
    },

    /**
     * Get connection logs for a submission
     * @param submissionId - Submission ID
     * @returns List of connection logs
     */
    async getConnectionLogs(submissionId: number): Promise<ApiResponse<ConnectionLog[]>> {
      const cacheKey = generateCacheKey(`/teacher/dashboard/connection-logs/${submissionId}`);
      
      return withCache(cacheKey, async () => {
        const response = await api.get<ApiResponse<ConnectionLog[]>>(
          `/teacher/dashboard/connection-logs/${submissionId}`
        );
        return response.data;
      });
    },

    /**
     * Get dashboard overview statistics
     * @returns Comprehensive dashboard statistics
     */
    async getOverview(): Promise<ApiResponse<any>> {
      const cacheKey = generateCacheKey('/teacher/dashboard/overview');
      
      return withCache(cacheKey, async () => {
        const response = await api.get<ApiResponse<any>>(
          '/teacher/dashboard/overview'
        );
        return response.data;
      });
    },

    /**
     * Get weekly performance data
     * @returns Performance data for last 6 weeks
     */
    async getPerformanceData(): Promise<ApiResponse<any[]>> {
      const cacheKey = generateCacheKey('/teacher/dashboard/performance-data');
      
      return withCache(cacheKey, async () => {
        const response = await api.get<ApiResponse<any[]>>(
          '/teacher/dashboard/performance-data'
        );
        return response.data;
      });
    },

    /**
     * Get recent activities
     * @returns Recent teacher activities
     */
    async getRecentActivities(): Promise<ApiResponse<any[]>> {
      const cacheKey = generateCacheKey('/teacher/dashboard/recent-activities');
      
      return withCache(cacheKey, async () => {
        const response = await api.get<ApiResponse<any[]>>(
          '/teacher/dashboard/recent-activities'
        );
        return response.data;
      });
    },
  },

  // Module placeholders - will be implemented in subsequent tasks
  courses: {
    /**
     * Get all courses with optional pagination and filters
     * @param params - Query parameters (page, per_page, search, etc.)
     * @returns Paginated list of courses
     */
    async getAll(params?: {
      page?: number;
      per_page?: number;
      search?: string;
      category?: string;
      status?: string;
    }): Promise<ApiResponse<PaginatedResponse<Course>>> {
      const cacheKey = generateCacheKey('/teacher/courses', params);
      
      return withCache(cacheKey, async () => {
        const response = await api.get<ApiResponse<PaginatedResponse<Course>>>(
          '/teacher/courses',
          { params }
        );
        return response.data;
      });
    },

    /**
     * Get course by ID
     * @param id - Course ID
     * @returns Course details with enrollment stats
     */
    async getById(id: number): Promise<ApiResponse<Course>> {
      const cacheKey = generateCacheKey(`/teacher/courses/${id}`);
      
      return withCache(cacheKey, async () => {
        const response = await api.get<ApiResponse<Course>>(
          `/teacher/courses/${id}`
        );
        return response.data;
      });
    },

    /**
     * Create a new course
     * @param data - Course data
     * @returns Created course
     */
    async create(data: CreateCourseRequest): Promise<ApiResponse<Course>> {
      const response = await api.post<ApiResponse<Course>>(
        '/teacher/courses',
        data
      );
      
      // Invalidate courses cache
      cacheManager.invalidate('/teacher/courses');
      
      return response.data;
    },

    /**
     * Update an existing course
     * @param id - Course ID
     * @param data - Updated course data
     * @returns Updated course
     */
    async update(id: number, data: UpdateCourseRequest): Promise<ApiResponse<Course>> {
      const response = await api.put<ApiResponse<Course>>(
        `/teacher/courses/${id}`,
        data
      );
      
      // Invalidate courses cache
      cacheManager.invalidate('/teacher/courses');
      
      return response.data;
    },

    /**
     * Delete a course
     * @param id - Course ID
     * @returns Success response
     */
    async delete(id: number): Promise<ApiResponse<void>> {
      const response = await api.delete<ApiResponse<void>>(
        `/teacher/courses/${id}`
      );
      
      // Invalidate courses cache
      cacheManager.invalidate('/teacher/courses');
      
      return response.data;
    },

    /**
     * Get students enrolled in a course
     * @param id - Course ID
     * @returns List of enrolled students
     */
    async getStudents(id: number): Promise<ApiResponse<any[]>> {
      const cacheKey = generateCacheKey(`/teacher/courses/${id}/students`);
      
      return withCache(cacheKey, async () => {
        const response = await api.get<ApiResponse<any[]>>(
          `/teacher/courses/${id}/students`
        );
        return response.data;
      });
    },

    /**
     * Enroll a student in a course
     * @param id - Course ID
     * @param data - Enrollment data (student_id, fee_paid, etc.)
     * @returns Success response
     */
    async enrollStudent(id: number, data: EnrollStudentRequest): Promise<ApiResponse<void>> {
      const response = await api.post<ApiResponse<void>>(
        `/teacher/courses/${id}/enroll`,
        data
      );
      
      // Invalidate courses and students cache
      cacheManager.invalidate('/teacher/courses');
      cacheManager.invalidate('/teacher/students');
      
      return response.data;
    },

    /**
     * Remove a student from a course
     * @param courseId - Course ID
     * @param studentId - Student ID
     * @returns Success response
     */
    async removeStudent(courseId: number, studentId: number): Promise<ApiResponse<void>> {
      const response = await api.delete<ApiResponse<void>>(
        `/teacher/courses/${courseId}/students/${studentId}`
      );
      
      // Invalidate courses and students cache
      cacheManager.invalidate('/teacher/courses');
      cacheManager.invalidate('/teacher/students');
      
      return response.data;
    },

    /**
     * Get course statistics
     * @param id - Course ID
     * @returns Course statistics
     */
    async getStatistics(id: number): Promise<ApiResponse<CourseStatistics>> {
      const cacheKey = generateCacheKey(`/teacher/courses/${id}/statistics`);
      
      return withCache(cacheKey, async () => {
        const response = await api.get<ApiResponse<CourseStatistics>>(
          `/teacher/courses/${id}/statistics`
        );
        return response.data;
      });
    },
  },
  classes: {
    /**
     * Get all classes
     * @returns List of classes with enrollment stats
     */
    async getAll(): Promise<ApiResponse<Class[]>> {
      const cacheKey = generateCacheKey('/teacher/classes');
      
      return withCache(cacheKey, async () => {
        const response = await api.get<ApiResponse<Class[]>>(
          '/teacher/classes'
        );
        return response.data;
      });
    },

    /**
     * Get class by ID
     * @param id - Class ID
     * @returns Class details
     */
    async getById(id: number): Promise<ApiResponse<Class>> {
      const cacheKey = generateCacheKey(`/teacher/classes/${id}`);
      
      return withCache(cacheKey, async () => {
        const response = await api.get<ApiResponse<Class>>(
          `/teacher/classes/${id}`
        );
        return response.data;
      });
    },

    /**
     * Create a new class
     * @param data - Class data
     * @returns Created class
     */
    async create(data: CreateClassRequest): Promise<ApiResponse<Class>> {
      const response = await api.post<ApiResponse<Class>>(
        '/teacher/classes',
        data
      );
      
      // Invalidate classes cache
      cacheManager.invalidate('/teacher/classes');
      
      return response.data;
    },

    /**
     * Update an existing class
     * @param id - Class ID
     * @param data - Updated class data
     * @returns Updated class
     */
    async update(id: number, data: UpdateClassRequest): Promise<ApiResponse<Class>> {
      const response = await api.put<ApiResponse<Class>>(
        `/teacher/classes/${id}`,
        data
      );
      
      // Invalidate classes cache
      cacheManager.invalidate('/teacher/classes');
      
      return response.data;
    },

    /**
     * Delete a class
     * @param id - Class ID
     * @returns Success response
     */
    async delete(id: number): Promise<ApiResponse<void>> {
      const response = await api.delete<ApiResponse<void>>(
        `/teacher/classes/${id}`
      );
      
      // Invalidate classes cache
      cacheManager.invalidate('/teacher/classes');
      
      return response.data;
    },

    /**
     * Enroll students in a class (bulk enrollment)
     * @param id - Class ID
     * @param studentIds - Array of student IDs
     * @returns Success response
     */
    async enrollStudents(id: number, studentIds: number[]): Promise<ApiResponse<void>> {
      const response = await api.post<ApiResponse<void>>(
        `/teacher/classes/${id}/enroll`,
        { student_ids: studentIds }
      );
      
      // Invalidate classes and students cache
      cacheManager.invalidate('/teacher/classes');
      cacheManager.invalidate('/teacher/students');
      
      return response.data;
    },

    /**
     * Transfer students from one class to another
     * @param fromId - Source class ID
     * @param toId - Destination class ID
     * @param studentIds - Array of student IDs to transfer
     * @param reason - Transfer reason
     * @param notes - Additional notes
     * @returns Success response
     */
    async transferStudents(
      fromId: number,
      toId: number,
      studentIds: number[],
      reason: string,
      notes?: string
    ): Promise<ApiResponse<void>> {
      const response = await api.post<ApiResponse<void>>(
        `/teacher/classes/${fromId}/transfer/${toId}`,
        {
          student_ids: studentIds,
          reason,
          notes,
        }
      );
      
      // Invalidate classes cache
      cacheManager.invalidate('/teacher/classes');
      
      return response.data;
    },

    /**
     * Get transfer history for a class
     * @param id - Class ID
     * @param days - Number of days to look back (default: 30)
     * @returns Transfer history
     */
    async getTransferHistory(id: number, days: number = 30): Promise<ApiResponse<ClassTransferHistory[]>> {
      const cacheKey = generateCacheKey(`/teacher/classes/${id}/transfer-history`, { days });
      
      return withCache(cacheKey, async () => {
        const response = await api.get<ApiResponse<ClassTransferHistory[]>>(
          `/teacher/classes/${id}/transfer-history`,
          { params: { days } }
        );
        return response.data;
      });
    },

    /**
     * Remove a student from a class
     * @param id - Class ID
     * @param studentId - Student ID
     * @returns Success response
     */
    async removeStudent(id: number, studentId: number): Promise<ApiResponse<void>> {
      const response = await api.delete<ApiResponse<void>>(
        `/teacher/classes/${id}/students/${studentId}`
      );
      
      // Invalidate classes and students cache
      cacheManager.invalidate('/teacher/classes');
      cacheManager.invalidate('/teacher/students');
      
      return response.data;
    },

    /**
     * Get class statistics
     * @returns Class statistics
     */
    async getStatistics(): Promise<ApiResponse<ClassStatistics>> {
      const cacheKey = generateCacheKey('/teacher/classes/statistics');
      
      return withCache(cacheKey, async () => {
        const response = await api.get<ApiResponse<ClassStatistics>>(
          '/teacher/classes/statistics'
        );
        return response.data;
      });
    },
  },
  students: {
    /**
     * Get all students with pagination, search, and filters
     * @param params - Query parameters
     * @returns Paginated list of students
     */
    async getAll(params?: {
      page?: number;
      per_page?: number;
      search?: string;
      status?: string;
      class_id?: number;
      gender?: string;
      sort_by?: string;
      sort_order?: 'asc' | 'desc';
    }): Promise<ApiResponse<PaginatedResponse<Student>>> {
      const cacheKey = generateCacheKey('/teacher/students', params);
      
      return withCache(cacheKey, async () => {
        const response = await api.get<ApiResponse<PaginatedResponse<Student>>>(
          '/teacher/students',
          { params }
        );
        return response.data;
      });
    },

    /**
     * Get student by ID
     * @param id - Student ID
     * @returns Student details
     */
    async getById(id: number): Promise<ApiResponse<Student>> {
      const cacheKey = generateCacheKey(`/teacher/students/${id}`);
      
      return withCache(cacheKey, async () => {
        const response = await api.get<ApiResponse<Student>>(
          `/teacher/students/${id}`
        );
        return response.data;
      });
    },

    /**
     * Create a new student (single or bulk)
     * @param data - Student data or array of students
     * @returns Created student(s) or bulk import result
     */
    async create(data: CreateStudentRequest | CreateStudentRequest[]): Promise<ApiResponse<Student | BulkImportResult>> {
      const response = await api.post<ApiResponse<Student | BulkImportResult>>(
        '/teacher/students',
        Array.isArray(data) ? { students: data } : data
      );
      
      // Invalidate students cache
      cacheManager.invalidate('/teacher/students');
      
      return response.data;
    },

    /**
     * Update an existing student
     * @param id - Student ID
     * @param data - Updated student data
     * @returns Updated student
     */
    async update(id: number, data: UpdateStudentRequest): Promise<ApiResponse<Student>> {
      const response = await api.put<ApiResponse<Student>>(
        `/teacher/students/${id}`,
        data
      );
      
      // Invalidate students cache
      cacheManager.invalidate('/teacher/students');
      
      return response.data;
    },

    /**
     * Delete a student
     * @param id - Student ID
     * @returns Success response
     */
    async delete(id: number): Promise<ApiResponse<void>> {
      const response = await api.delete<ApiResponse<void>>(
        `/teacher/students/${id}`
      );
      
      // Invalidate students cache
      cacheManager.invalidate('/teacher/students');
      
      return response.data;
    },

    /**
     * Get student statistics
     * @returns Student statistics
     */
    async getStatistics(): Promise<ApiResponse<StudentStatistics>> {
      const cacheKey = generateCacheKey('/teacher/students/statistics');
      
      return withCache(cacheKey, async () => {
        const response = await api.get<ApiResponse<StudentStatistics>>(
          '/teacher/students/statistics'
        );
        return response.data;
      });
    },

    /**
     * Export students to CSV or JSON
     * @param format - Export format (csv or json)
     * @returns File blob
     */
    async exportStudents(format: 'csv' | 'json'): Promise<Blob> {
      const response = await api.get(
        '/teacher/students/export',
        {
          params: { format },
          responseType: 'blob',
        }
      );
      
      return response.data;
    },
  },

  exams: {
    /**
     * Get all exams
     * @returns List of exams
     */
    async getAll(): Promise<ApiResponse<Exam[]>> {
      const cacheKey = generateCacheKey('/teacher/exams');
      
      return withCache(cacheKey, async () => {
        const response = await api.get<ApiResponse<Exam[]>>(
          '/teacher/exams'
        );
        return response.data;
      });
    },

    /**
     * Get exam by ID
     * @param id - Exam ID
     * @returns Exam details with questions
     */
    async getById(id: number): Promise<ApiResponse<Exam>> {
      const cacheKey = generateCacheKey(`/teacher/exams/${id}`);
      
      return withCache(cacheKey, async () => {
        const response = await api.get<ApiResponse<Exam>>(
          `/teacher/exams/${id}`
        );
        return response.data;
      });
    },

    /**
     * Create a new exam
     * @param data - Exam data
     * @returns Created exam
     */
    async create(data: CreateExamRequest): Promise<ApiResponse<Exam>> {
      const response = await api.post<ApiResponse<Exam>>(
        '/teacher/exams',
        data
      );
      
      // Invalidate exams cache
      cacheManager.invalidate('/teacher/exams');
      
      return response.data;
    },

    /**
     * Update an existing exam
     * @param id - Exam ID
     * @param data - Updated exam data
     * @returns Updated exam
     */
    async update(id: number, data: UpdateExamRequest): Promise<ApiResponse<Exam>> {
      const response = await api.put<ApiResponse<Exam>>(
        `/teacher/exams/${id}`,
        data
      );
      
      // Invalidate exams cache
      cacheManager.invalidate('/teacher/exams');
      
      return response.data;
    },

    /**
     * Delete an exam
     * @param id - Exam ID
     * @returns Success response
     */
    async delete(id: number): Promise<ApiResponse<void>> {
      const response = await api.delete<ApiResponse<void>>(
        `/teacher/exams/${id}`
      );
      
      // Invalidate exams cache
      cacheManager.invalidate('/teacher/exams');
      
      return response.data;
    },

    /**
     * Add questions to an exam
     * @param id - Exam ID
     * @param questions - Array of questions
     * @returns Success response
     */
    async addQuestions(id: number, questions: CreateQuestionRequest[]): Promise<ApiResponse<void>> {
      const response = await api.post<ApiResponse<void>>(
        `/teacher/exams/${id}/questions`,
        { questions }
      );
      
      // Invalidate exams cache
      cacheManager.invalidate('/teacher/exams');
      
      return response.data;
    },

    /**
     * Update a question in an exam
     * @param examId - Exam ID
     * @param questionId - Question ID
     * @param data - Updated question data
     * @returns Success response
     */
    async updateQuestion(examId: number, questionId: number, data: UpdateQuestionRequest): Promise<ApiResponse<void>> {
      const response = await api.put<ApiResponse<void>>(
        `/teacher/exams/${examId}/questions/${questionId}`,
        data
      );
      
      // Invalidate exams cache
      cacheManager.invalidate('/teacher/exams');
      
      return response.data;
    },

    /**
     * Delete a question from an exam
     * @param examId - Exam ID
     * @param questionId - Question ID
     * @returns Success response
     */
    async deleteQuestion(examId: number, questionId: number): Promise<ApiResponse<void>> {
      const response = await api.delete<ApiResponse<void>>(
        `/teacher/exams/${examId}/questions/${questionId}`
      );
      
      // Invalidate exams cache
      cacheManager.invalidate('/teacher/exams');
      
      return response.data;
    },

    /**
     * Get exam sections organized by skill
     * @param id - Exam ID
     * @returns Exam sections
     */
    async getSections(id: number): Promise<ApiResponse<ExamSection[]>> {
      const cacheKey = generateCacheKey(`/teacher/exams/${id}/sections`);
      
      return withCache(cacheKey, async () => {
        const response = await api.get<ApiResponse<ExamSection[]>>(
          `/teacher/exams/${id}/sections`
        );
        return response.data;
      });
    },

    /**
     * Clone an exam
     * @param id - Exam ID
     * @param title - New exam title
     * @param description - New exam description
     * @returns Cloned exam
     */
    async clone(id: number, title: string, description?: string): Promise<ApiResponse<Exam>> {
      const response = await api.post<ApiResponse<Exam>>(
        `/teacher/exams/${id}/clone`,
        { title, description }
      );
      
      // Invalidate exams cache
      cacheManager.invalidate('/teacher/exams');
      
      return response.data;
    },

    /**
     * Preview an exam (correct answers hidden)
     * @param id - Exam ID
     * @returns Exam preview
     */
    async preview(id: number): Promise<ApiResponse<Exam>> {
      const cacheKey = generateCacheKey(`/teacher/exams/${id}/preview`);
      
      return withCache(cacheKey, async () => {
        const response = await api.get<ApiResponse<Exam>>(
          `/teacher/exams/${id}/preview`
        );
        return response.data;
      });
    },

    /**
     * Publish an exam
     * @param id - Exam ID
     * @returns Success response
     */
    async publish(id: number): Promise<ApiResponse<void>> {
      const response = await api.post<ApiResponse<void>>(
        `/teacher/exams/${id}/publish`
      );
      
      // Invalidate exams cache
      cacheManager.invalidate('/teacher/exams');
      
      return response.data;
    },

    /**
     * Import exam from JSON (Gemini AI format)
     * @param data - Exam JSON data
     * @returns Import result with exam ID
     */
    async importExam(data: any): Promise<ApiResponse<{ examId: number; title: string; questions_count: number; total_points: number }>> {
      const response = await api.post<ApiResponse<{ examId: number; title: string; questions_count: number; total_points: number }>>(
        '/teacher/exams/import',
        data
      );
      
      // Invalidate exams cache
      cacheManager.invalidate('/teacher/exams');
      
      return response.data;
    },

    /**
     * Validate exam JSON before import
     * @param data - Exam JSON data
     * @returns Validation result
     */
    async validateExamImport(data: any): Promise<ApiResponse<{
      valid: boolean;
      total_questions: number;
      total_points: number;
      issues: string[];
      warnings: string[];
      exam_info: {
        title: string;
        type: string;
        skill: string;
        duration: number;
      };
    }>> {
      const response = await api.post(
        '/teacher/exams/import/validate',
        data
      );
      
      return response.data;
    },
  },
  examTemplates: {},
  assignments: {
    /**
     * Get all test assignments with filters
     * @param params - Query parameters
     * @returns List of assignments
     */
    async getAll(params?: {
      exam_id?: number;
      target_type?: 'class' | 'student';
      target_id?: number;
    }): Promise<ApiResponse<TestAssignment[]>> {
      const cacheKey = generateCacheKey('/teacher/assignments', params);
      
      return withCache(cacheKey, async () => {
        const response = await api.get<ApiResponse<TestAssignment[]>>(
          '/teacher/assignments',
          { params }
        );
        return response.data;
      });
    },

    /**
     * Alias for getAll
     */
    async getAssignments(params?: {
      exam_id?: number;
      target_type?: 'class' | 'student';
      target_id?: number;
    }): Promise<ApiResponse<TestAssignment[]>> {
      return this.getAll(params);
    },

    /**
     * Assign an exam to a target (class or student)
     * @param examId - Exam ID
     * @param targetType - Target type (class or student)
     * @param targetId - Target ID
     * @param deadline - Assignment deadline
     * @param maxAttempt - Maximum attempts allowed
     * @param isPublic - Whether assignment is public
     * @returns Created assignment
     */
    async assign(
      examId: number,
      targetType: 'class' | 'student',
      targetId: number,
      deadline: string,
      maxAttempt: number,
      isPublic: boolean
    ): Promise<ApiResponse<TestAssignment>> {
      const response = await api.post<ApiResponse<TestAssignment>>(
        `/teacher/exams/${examId}/assign`,
        {
          target_type: targetType,
          target_id: targetId,
          deadline,
          max_attempt: maxAttempt,
          is_public: isPublic,
        }
      );
      
      // Invalidate assignments cache
      cacheManager.invalidate('/teacher/assignments');
      
      return response.data;
    },

    /**
     * Bulk assign an exam to multiple targets
     * @param examId - Exam ID
     * @param targets - Array of targets
     * @param deadline - Assignment deadline
     * @param maxAttempt - Maximum attempts allowed
     * @param isPublic - Whether assignment is public
     * @returns Success response
     */
    async bulkAssign(
      examId: number,
      targets: Array<{ type: 'class' | 'student'; id: number }>,
      deadline: string,
      maxAttempt: number,
      isPublic: boolean
    ): Promise<ApiResponse<void>> {
      const response = await api.post<ApiResponse<void>>(
        `/teacher/exams/${examId}/bulk-assign`,
        {
          targets,
          deadline,
          max_attempt: maxAttempt,
          is_public: isPublic,
        }
      );
      
      // Invalidate assignments cache
      cacheManager.invalidate('/teacher/assignments');
      
      return response.data;
    },

    /**
     * Get assignment progress
     * @param id - Assignment ID
     * @returns Assignment progress
     */
    async getProgress(id: number): Promise<ApiResponse<AssignmentProgress>> {
      const cacheKey = generateCacheKey(`/teacher/assignments/${id}/progress`);
      
      return withCache(cacheKey, async () => {
        const response = await api.get<ApiResponse<AssignmentProgress>>(
          `/teacher/assignments/${id}/progress`
        );
        return response.data;
      });
    },

    /**
     * Send reminders to students who haven't completed assignment
     * @param id - Assignment ID
     * @param payload - Optional { student_id?: number, message?: string }
     * @returns Success response
     */
    async sendReminders(id: number, payload?: { student_id?: number; message?: string }): Promise<ApiResponse<any>> {
      const response = await api.post<ApiResponse<any>>(
        `/teacher/assignments/${id}/reminders`,
        payload || {}
      );
      
      return response.data;
    },

    /**
     * Delete an assignment
     * @param id - Assignment ID
     * @returns Success response
     */
    async delete(id: number): Promise<ApiResponse<void>> {
      const response = await api.delete<ApiResponse<void>>(
        `/teacher/assignments/${id}`
      );
      
      // Invalidate assignments cache
      cacheManager.invalidate('/teacher/assignments');
      
      return response.data;
    },

    /**
     * Get assignment statistics
     * @returns Assignment statistics
     */
    async getStatistics(): Promise<ApiResponse<AssignmentStatistics>> {
      const cacheKey = generateCacheKey('/teacher/assignments/statistics');
      
      return withCache(cacheKey, async () => {
        const response = await api.get<ApiResponse<AssignmentStatistics>>(
          '/teacher/assignments/statistics'
        );
        return response.data;
      });
    },
  },

  grading: {
    /**
     * Get submissions with filters
     * @param params - Query parameters
     * @returns List of submissions
     */
    async getSubmissions(params?: {
      exam_id?: number;
      student_id?: number;
      status?: 'submitted' | 'graded' | 'partially_graded' | 'in_progress';
    }): Promise<ApiResponse<Submission[]>> {
      const cacheKey = generateCacheKey('/teacher/submissions', params);
      
      return withCache(cacheKey, async () => {
        const response = await api.get<ApiResponse<Submission[]>>(
          '/teacher/submissions',
          { params }
        );
        return response.data;
      });
    },

    /**
     * Get submission by ID
     * @param id - Submission ID
     * @returns Submission details with answers
     */
    async getSubmissionById(id: number): Promise<ApiResponse<Submission>> {
      const cacheKey = generateCacheKey(`/teacher/submissions/${id}`);
      
      return withCache(cacheKey, async () => {
        const response = await api.get<ApiResponse<Submission>>(
          `/teacher/submissions/${id}`
        );
        return response.data;
      });
    },

    /**
     * Grade a submission (manual grading)
     * @param id - Submission ID
     * @param score - Total score
     * @param feedback - Overall feedback
     * @param teacherFeedback - Teacher's feedback
     * @param questionScores - Scores for each question
     * @returns Success response
     */
    async gradeSubmission(
      id: number,
      score?: number,
      feedback?: string,
      teacherFeedback?: string,
      questionScores?: Array<{ question_id: number; saPoints_awarded: number }>
    ): Promise<ApiResponse<void>> {
      const response = await api.post<ApiResponse<void>>(
        `/teacher/submissions/${id}/grade`,
        {
          score,
          feedback,
          sTeacher_feedback: teacherFeedback,
          questionScores,
        }
      );
      
      // Invalidate grading cache
      cacheManager.invalidate('/teacher/submissions');
      
      return response.data;
    },

    /**
     * Auto-grade a submission
     * @param id - Submission ID
     * @returns Success response
     */
    async autoGrade(id: number): Promise<ApiResponse<void>> {
      const response = await api.post<ApiResponse<void>>(
        `/teacher/submissions/${id}/auto-grade`
      );
      
      // Invalidate grading cache
      cacheManager.invalidate('/teacher/submissions');
      
      return response.data;
    },

    /**
     * Detailed grading with per-question feedback
     * @param id - Submission ID
     * @param questionGrades - Grades for each question
     * @param overallFeedback - Overall feedback
     * @param strengths - Student's strengths
     * @param improvements - Areas for improvement
     * @returns Success response
     */
    async detailedGrade(
      id: number,
      questionGrades: Array<{ question_id: number; points_awarded: number; feedback?: string; is_correct?: boolean }>,
      overallFeedback: string,
      strengths?: string[],
      improvements?: string[]
    ): Promise<ApiResponse<void>> {
      const response = await api.post<ApiResponse<void>>(
        `/teacher/submissions/${id}/detailed-grade`,
        {
          question_grades: questionGrades,
          overall_feedback: overallFeedback,
          strengths,
          improvements,
        }
      );
      
      // Invalidate grading cache
      cacheManager.invalidate('/teacher/submissions');
      
      return response.data;
    },

    /**
     * Get class report
     * @param classId - Class ID
     * @param examId - Exam ID (optional)
     * @returns Class report
     */
    async getClassReport(classId: number, examId?: number): Promise<ApiResponse<ClassReport>> {
      const cacheKey = generateCacheKey(`/teacher/classes/${classId}/report`, { exam_id: examId });
      
      return withCache(cacheKey, async () => {
        const response = await api.get<ApiResponse<ClassReport>>(
          `/teacher/classes/${classId}/report`,
          { params: { exam_id: examId } }
        );
        return response.data;
      });
    },

    /**
     * Get grading statistics
     * @returns Grading statistics
     */
    async getStatistics(): Promise<ApiResponse<GradingStatistics>> {
      const cacheKey = generateCacheKey('/teacher/grading/statistics');
      
      return withCache(cacheKey, async () => {
        const response = await api.get<ApiResponse<GradingStatistics>>(
          '/teacher/grading/statistics'
        );
        return response.data;
      });
    },
  },

  monitoring: {
    async getActiveSessions(): Promise<ApiResponse<ActiveSession[]>> {
      const response = await api.get<ApiResponse<ActiveSession[]>>(
        '/teacher/dashboard/active-sessions'
      );
      return response.data;
    },

    async getConnectionLogs(submissionId: number): Promise<ApiResponse<ConnectionLog[]>> {
      const response = await api.get<ApiResponse<ConnectionLog[]>>(
        `/teacher/dashboard/connection-logs/${submissionId}`
      );
      return response.data;
    },

    async sendMessage(submissionId: number, message: string): Promise<ApiResponse<void>> {
      const response = await api.post<ApiResponse<void>>(
        '/teacher/dashboard/send-message',
        { submission_id: submissionId, message }
      );
      return response.data;
    },
  },

  practiceSessions: {
    async getAll(params?: { type?: string; skill?: string; purpose?: string }): Promise<ApiResponse<any[]>> {
      const response = await api.get<ApiResponse<any[]>>('/teacher/practice-sessions', { params });
      return response.data;
    },

    async getStatistics(): Promise<ApiResponse<any>> {
      const response = await api.get<ApiResponse<any>>('/teacher/practice-sessions/statistics');
      return response.data;
    },

    async getById(id: number): Promise<ApiResponse<any>> {
      const response = await api.get<ApiResponse<any>>(`/teacher/practice-sessions/${id}`);
      return response.data;
    },

    async createTopicBased(data: any): Promise<ApiResponse<any>> {
      const response = await api.post<ApiResponse<any>>('/teacher/practice-sessions/topic-based', data);
      cacheManager.invalidate('/teacher/practice-sessions');
      return response.data;
    },

    async createTemplateBased(data: any): Promise<ApiResponse<any>> {
      const response = await api.post<ApiResponse<any>>('/teacher/practice-sessions/template-based', data);
      cacheManager.invalidate('/teacher/practice-sessions');
      return response.data;
    },

    async createRandom(data: any): Promise<ApiResponse<any>> {
      const response = await api.post<ApiResponse<any>>('/teacher/practice-sessions/random', data);
      cacheManager.invalidate('/teacher/practice-sessions');
      return response.data;
    },

    async update(id: number, data: any): Promise<ApiResponse<any>> {
      const response = await api.put<ApiResponse<any>>(`/teacher/practice-sessions/${id}`, data);
      cacheManager.invalidate('/teacher/practice-sessions');
      return response.data;
    },

    async delete(id: number): Promise<ApiResponse<void>> {
      const response = await api.delete<ApiResponse<void>>(`/teacher/practice-sessions/${id}`);
      cacheManager.invalidate('/teacher/practice-sessions');
      return response.data;
    },

    async getTemplates(): Promise<ApiResponse<any[]>> {
      const response = await api.get<ApiResponse<any[]>>('/teacher/templates');
      return response.data;
    },
  },

  blogs: {
    async getAll(): Promise<ApiResponse<any[]>> {
      const response = await api.get<ApiResponse<any[]>>('/teacher/blogs');
      return response.data;
    },

    async getById(id: number): Promise<ApiResponse<any>> {
      const response = await api.get<ApiResponse<any>>(`/teacher/blogs/${id}`);
      return response.data;
    },

    async create(data: any): Promise<ApiResponse<any>> {
      const response = await api.post<ApiResponse<any>>('/teacher/blogs', data);
      cacheManager.invalidate('/teacher/blogs');
      return response.data;
    },

    async update(id: number, data: any): Promise<ApiResponse<any>> {
      const response = await api.put<ApiResponse<any>>(`/teacher/blogs/${id}`, data);
      cacheManager.invalidate('/teacher/blogs');
      return response.data;
    },

    async delete(id: number): Promise<ApiResponse<void>> {
      const response = await api.delete<ApiResponse<void>>(`/teacher/blogs/${id}`);
      cacheManager.invalidate('/teacher/blogs');
      return response.data;
    },

    async getBlogTypes(): Promise<ApiResponse<any[]>> {
      const response = await api.get<ApiResponse<any[]>>('/teacher/blog-types');
      return response.data;
    },
  },

  categories: {
    async getAll(): Promise<ApiResponse<any[]>> {
      const response = await api.get<ApiResponse<any[]>>('/teacher/categories');
      return response.data;
    },
  },

  reports: {
    /**
     * Get students progress across all classes
     * @param params - Query parameters for filtering and sorting
     * @returns Students progress data with summary statistics
     */
    async getStudentsProgress(params?: {
      class_id?: number;
      search?: string;
      sort_by?: 'name' | 'score' | 'progress' | 'attendance';
      sort_order?: 'asc' | 'desc';
    }): Promise<ApiResponse<{
      summary: {
        totalStudents: number;
        avgScore: number;
        completionRate: number;
        avgAttendance: number;
        changes: {
          students: number;
          score: number;
          completion: number;
          attendance: number;
        };
      };
      students: Array<{
        uId: number;
        uName: string;
        uEmail: string;
        uPhone: string;
        uAvatar: string | null;
        uClass_id: number;
        className: string;
        testsCompleted: number;
        totalTests: number;
        avgScore: number;
        attendanceRate: number;
        lastActivity: string;
        lastActivityDate: string | null;
        scoreTrend: 'up' | 'down' | 'stable';
        scoreTrendValue: number;
      }>;
    }>> {
      const response = await api.get('/teacher/students/progress', {
        params
      });
      return response.data;
    },
  },
  
  /**
   * User Profile Module
   */
  user: {
    /**
     * Get current user profile
     * @returns User profile data
     */
    async getProfile(): Promise<ApiResponse<any>> {
      const response = await api.get<ApiResponse<any>>('/user/profile');
      return response.data;
    },

    /**
     * Update user profile
     * @param data - Profile data to update
     * @returns Updated profile
     */
    async updateProfile(data: any): Promise<ApiResponse<any>> {
      const response = await api.put<ApiResponse<any>>('/user/profile', data);
      return response.data;
    },

    /**
     * Upload avatar image
     * @param formData - FormData containing avatar file
     * @returns Success response with avatar URL
     */
    async uploadAvatar(formData: FormData): Promise<ApiResponse<any>> {
      const response = await api.post<ApiResponse<any>>('/user/avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },

    /**
     * Remove avatar image
     * @returns Success response
     */
    async removeAvatar(): Promise<ApiResponse<any>> {
      const response = await api.delete<ApiResponse<any>>('/user/avatar');
      return response.data;
    },

    /**
     * Change password
     * @param currentPassword - Current password
     * @param newPassword - New password
     * @param confirmPassword - Confirm new password
     * @returns Success response
     */
    async changePassword(currentPassword: string, newPassword: string, confirmPassword: string): Promise<ApiResponse<any>> {
      const response = await api.post<ApiResponse<any>>('/user/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
        new_password_confirmation: confirmPassword,
      });
      return response.data;
    },

    /**
     * Get active sessions
     * @returns List of active sessions
     */
    async getSessions(): Promise<ApiResponse<any>> {
      const response = await api.get<ApiResponse<any>>('/user/sessions');
      return response.data;
    },

    /**
     * Logout from a specific session
     * @param sessionId - Session ID to logout
     * @returns Success response
     */
    async logoutSession(sessionId: string): Promise<ApiResponse<any>> {
      const response = await api.delete<ApiResponse<any>>(`/user/sessions/${sessionId}`);
      return response.data;
    },

    /**
     * Request account deletion (scheduled in 3 days)
     */
    async requestDeleteAccount(): Promise<ApiResponse<any>> {
      const response = await api.post<ApiResponse<any>>('/user/request-delete');
      return response.data;
    },

    /**
     * Cancel account deletion request
     */
    async cancelDeleteAccount(): Promise<ApiResponse<any>> {
      const response = await api.post<ApiResponse<any>>('/user/cancel-delete');
      return response.data;
    },

    /**
     * Get user notification settings
     */
    async getNotificationSettings(): Promise<ApiResponse<any>> {
      const response = await api.get<ApiResponse<any>>('/user/notification-settings');
      return response.data;
    },

    /**
     * Update user notification settings
     */
    async updateNotificationSettings(settings: any): Promise<ApiResponse<any>> {
      const response = await api.put<ApiResponse<any>>('/user/notification-settings', settings);
      return response.data;
    },
  },
};

export default teacherApi;
