/**
 * teacherRoutes — Tất cả route dành cho giáo viên.
 * Base path: "/giao-vien" — Layout: TeacherLayout (sidebar xanh dương).
 * 
 * ✅ Protected by authentication - requires teacher role
 */
import { lazy } from "react";
import { Navigate, useParams } from "react-router";
import { ProtectedRoute } from "../../components/auth";
import { TeacherLayout } from "../layouts/TeacherLayout";
import { Dashboard } from "../features/teacher/dashboard";
import { CourseDetail } from "../features/teacher/courses/CourseDetail";
// Class system deprecated — giữ import comment để dễ revert nếu cần.
// import { ClassList, CreateClass, TransferClass, ClassStats } from "../features/teacher/classes";
import { StudentManagement, AddStudent } from "../features/teacher/students";
import { Settings } from "../features/teacher/settings";
import { UnderConstruction } from "../components/shared";

// Course
import { CourseList } from "../features/teacher/courses/CourseList";
import { CreateCourse } from "../features/teacher/courses/CreateCourse";
import { EditCourse } from "../features/teacher/courses/EditCourse";
import { ManageStudents } from "../features/teacher/courses/ManageStudents";
import { CourseStats } from "../features/teacher/courses/CourseStats";

// Exam
import { AllExams } from "../features/teacher/exams/AllExams";
import CreateExam from "../features/teacher/exams/CreateExam";
import { CreateExamSetup } from "../features/teacher/exams/setup/CreateExamSetup";
import { CreateVSTEPExam } from "../features/teacher/exams/CreateVSTEPExam";
import { ExamDetail } from "../features/teacher/exams/ExamDetail";
import { ExamPreview } from "../features/teacher/exams/ExamPreview";
import { ExamPreviewNew } from "../features/teacher/exams/ExamPreviewNew";
import { VstepExamPreview } from "../features/teacher/exams/VstepExamPreview";
import { EditExam } from "../features/teacher/exams/EditExam";
import { ExamTemplates } from "../features/teacher/exams/ExamTemplates";
// MyExams đã gộp vào AllExams (có sẵn filter Của tôi). Giữ file để khôi phục nếu cần.
// import { MyExams } from "../features/teacher/exams/MyExams";
import CreateKidsExam from "../features/teacher/exams/kids/CreateKidsExam";
import { CreateVstepReading } from "../features/teacher/exams/vstep/CreateVstepReading";
import { CreateVstepListening } from "../features/teacher/exams/vstep/CreateVstepListening";
import { CreateVstepWriting } from "../features/teacher/exams/vstep/CreateVstepWriting";
import { CreateVstepSpeaking } from "../features/teacher/exams/vstep/CreateVstepSpeaking";
import { CreateVstepFull } from "../features/teacher/exams/vstep/CreateVstepFull";
import CreateIeltsExam from "../features/teacher/exams/ielts/CreateIeltsExam";
import { CreateIeltsFullExam } from "../features/teacher/exams/ielts/CreateIeltsFullExam";
import { GeneralExamPreview } from "../features/teacher/exams/GeneralExamPreview";
import { CreateThptExam } from "../features/teacher/exams/thpt/CreateThptExam";
import { IeltsPreviewPage } from "../features/teacher/exams/ielts/IeltsPreviewPage";
import { IeltsTestPreviewPage } from "../features/teacher/exams/ielts/IeltsTestPreviewPage";
import { TestExamPlayer } from "../features/test";

// Assignment — danh sách & thống kê đã gỡ; giao đề thực hiện trên card Ngân hàng đề.
import { AssignmentProgress } from "../features/teacher/assignments/AssignmentProgress";
import { CreateAssignment } from "../features/teacher/assignments/CreateAssignment";

// Practice (Luyện tập GV) — đã gỡ khỏi UI. Files vẫn còn trong codebase nếu cần khôi phục.
// import { PracticeSessionList } from "../features/teacher/practice/PracticeSessionList";
// import { PracticeSessionDetail } from "../features/teacher/practice/PracticeSessionDetail";
// import { PracticeSessionEdit } from "../features/teacher/practice/PracticeSessionEdit";

// Grading
import { StudentVstepExamPage } from "../features/student/exams/StudentVstepExamPage";
import { IeltsExamPreview } from "../features/teacher/exams/IeltsExamPreview";
import { GradingQueue } from "../features/teacher/grading/GradingQueue";
import { GradingDetail } from "../features/teacher/grading/GradingDetail";
import { GradingStats } from "../features/teacher/grading/GradingStats";

// Monitoring
import { LiveMonitoring } from "../features/teacher/monitoring/LiveMonitoring";
import { StudentDetail } from "../features/teacher/monitoring/StudentDetail";
import { RealtimeStats } from "../features/teacher/monitoring/RealtimeStats";

// Blog
import { BlogList } from "../features/teacher/blog/BlogList";
import { CreatePost } from "../features/teacher/blog/CreatePost";
import { PostDetail } from "../features/teacher/blog/PostDetail";
import { ContentStats } from "../features/teacher/blog/ContentStats";
import { Categories } from "../features/teacher/blog/Categories";

// Reports
import { ReportsOverview } from "../features/teacher/reports/ReportsOverview";

// Protected Teacher Layout
function ProtectedTeacherLayout() {
  return (
    <ProtectedRoute requiredRole="teacher">
      <TeacherLayout />
    </ProtectedRoute>
  );
}

export const teacherRoutes = {
  path: "/giao-vien",
  Component: ProtectedTeacherLayout,
  children: [
    // Dashboard
    { index: true, Component: Dashboard },

    // Học viên
    { path: "students", Component: StudentManagement },
    { path: "students/them-moi", Component: AddStudent },

    // ─── Lớp học (DEPRECATED) ────────────────────────────────────────
    // Class system đã gỡ khỏi UI flow. Routes bị disable. Files
    // ClassList/CreateClass/TransferClass/ClassStats vẫn còn trong
    // codebase phòng cần lookup data class cũ.
    // { path: "lop-hoc", Component: ClassList },
    // { path: "lop-hoc/danh-sach", Component: ClassList },
    // { path: "lop-hoc/tao-moi", Component: CreateClass },
    // { path: "lop-hoc/chuyen-lop", Component: TransferClass },
    // { path: "lop-hoc/thong-ke", Component: ClassStats },

    // Khóa học
    { path: "khoa-hoc", Component: CourseList },
    { path: "khoa-hoc/tao-moi", Component: CreateCourse },
    { path: "khoa-hoc/quan-ly-students", Component: ManageStudents },
    { path: "khoa-hoc/thong-ke", Component: CourseStats },
    { path: "khoa-hoc/:courseId", Component: CourseDetail },
    { path: "khoa-hoc/:courseId/chinh-sua", Component: EditCourse },

    // Ngân hàng đề
    { path: "de-thi", Component: AllExams },
    { path: "de-thi/tat-ca", Component: AllExams },
    { path: "de-thi/tao-moi", Component: CreateExamSetup },
    { path: "de-thi/tao-moi/legacy", Component: CreateExam },
    { path: "de-thi/tao-moi/:examId", Component: CreateExam }, // With exam ID
    { path: "de-thi/tao-thu-cong", Component: lazy(() => import("@/app/features/teacher/exams/CreateExamManual").then(m => ({ default: m.CreateExamManual }))) },
    { path: "de-thi/import", Component: lazy(() => import("@/app/features/teacher/exams/ImportExam").then(m => ({ default: m.ImportExam }))) },
    { path: "de-thi/kids/tao-moi", Component: CreateKidsExam },
    { path: "de-thi/kids/tao-moi/:examId", Component: CreateKidsExam },
    { path: "de-thi/vstep/reading/tao-moi", Component: CreateVstepReading },
    { path: "de-thi/vstep/reading/sua/:examId", Component: CreateVstepReading },
    { path: "de-thi/vstep/listening/tao-moi", Component: CreateVstepListening },
    { path: "de-thi/vstep/listening/sua/:examId", Component: CreateVstepListening },
    { path: "de-thi/vstep/writing/tao-moi", Component: CreateVstepWriting },
    { path: "de-thi/vstep/writing/sua/:examId", Component: CreateVstepWriting },
    { path: "de-thi/vstep/speaking/tao-moi", Component: CreateVstepSpeaking },
    { path: "de-thi/vstep/speaking/sua/:examId", Component: CreateVstepSpeaking },
    { path: "de-thi/vstep/full/tao-moi", Component: CreateVstepFull },
    { path: "de-thi/vstep/full/sua/:examId", Component: CreateVstepFull },

    // ── IELTS routes ────────────────────────────────────────────────────
    // Full test (4 kỹ năng) — tạo 4 đề con liên kết bằng full_group_id.
    { path: "de-thi/ielts/full/tao-moi", Component: CreateIeltsFullExam },
    // Single-skill (1 đề = 1 kỹ năng).
    { path: "de-thi/ielts/listening/tao-moi", Component: () => <CreateIeltsExam initialSkill="listening" /> },
    { path: "de-thi/ielts/listening/edit/:examId", Component: () => <CreateIeltsExam initialSkill="listening" /> },
    { path: "de-thi/ielts/reading/tao-moi", Component: () => <CreateIeltsExam initialSkill="reading" /> },
    { path: "de-thi/ielts/reading/edit/:examId", Component: () => <CreateIeltsExam initialSkill="reading" /> },
    { path: "de-thi/ielts/writing/tao-moi", Component: () => <CreateIeltsExam initialSkill="writing" /> },
    { path: "de-thi/ielts/writing/edit/:examId", Component: () => <CreateIeltsExam initialSkill="writing" /> },
    { path: "de-thi/ielts/speaking/tao-moi", Component: () => <CreateIeltsExam initialSkill="speaking" /> },
    { path: "de-thi/ielts/speaking/edit/:examId", Component: () => <CreateIeltsExam initialSkill="speaking" /> },
    // Legacy /sua/ → /edit/ redirect (backward compat for bookmarks / old links)
    { path: "de-thi/ielts/listening/sua/:examId", Component: () => { const { examId } = useParams(); return <Navigate to={`/giao-vien/de-thi/ielts/listening/edit/${examId}`} replace />; } },
    { path: "de-thi/ielts/reading/sua/:examId", Component: () => { const { examId } = useParams(); return <Navigate to={`/giao-vien/de-thi/ielts/reading/edit/${examId}`} replace />; } },
    { path: "de-thi/ielts/writing/sua/:examId", Component: () => { const { examId } = useParams(); return <Navigate to={`/giao-vien/de-thi/ielts/writing/edit/${examId}`} replace />; } },
    { path: "de-thi/ielts/speaking/sua/:examId", Component: () => { const { examId } = useParams(); return <Navigate to={`/giao-vien/de-thi/ielts/speaking/edit/${examId}`} replace />; } },
    // IELTS preview (read-only): /giao-vien/de-thi/ielts/:skill/xem/:examId
    { path: "de-thi/ielts/:skill/xem/:examId", Component: IeltsPreviewPage },
    // IELTS test preview (demo UI làm bài, không lưu): /giao-vien/de-thi/ielts/:skill/thu/:examId
    { path: "de-thi/ielts/:skill/thu/:examId", Component: IeltsTestPreviewPage },

    // ── THPT routes (Vietnamese university entrance) ────────────────────
    { path: "de-thi/thpt/tao-moi", Component: CreateThptExam },
    { path: "de-thi/thpt/:examId/sua", Component: CreateThptExam },

    { path: "de-thi/mau-de", Component: ExamTemplates },
    // /de-thi/cua-toi đã gộp vào /de-thi (AllExams có sẵn filter "Của tôi")
    { path: "de-thi/cua-toi", Component: () => <Navigate to="/giao-vien/de-thi" replace /> },
    { path: "de-thi/:examId", Component: ExamDetail },
    { path: "de-thi/:examId/vstep", Component: VstepExamPreview }, // VSTEP exam preview
    { path: "de-thi/:examId/xem", Component: ExamPreview },
    { path: "de-thi/:examId/xem-de", Component: GeneralExamPreview }, // GENERAL/objective preview
    { path: "de-thi/:examId/xem-moi", Component: ExamPreviewNew }, // NEW: Test shared component
    { path: "de-thi/:examId/chinh-sua", Component: EditExam },
    { path: "test-exam/:examId", Component: TestExamPlayer }, // TEST: Drag & drop testing

    // Giao bài thi — đã gỡ trang danh sách & thống kê riêng.
    // Giao đề giờ thực hiện ngay trên card ở Ngân hàng đề (AssignModal).
    // Giữ lại 2 route deep-link: tiến độ + tạo (vào từ Luyện tập / thông báo).
    { path: "bai-tap", Component: () => <Navigate to="/giao-vien/de-thi" replace /> },
    { path: "bai-tap/:assignmentId/tien-do", Component: AssignmentProgress },
    { path: "bai-tap/giao-moi", Component: CreateAssignment },

    // Luyện tập (GV) — đã gỡ. Redirect mọi link cũ về Ngân hàng đề.
    { path: "luyen-tap", Component: () => <Navigate to="/giao-vien/de-thi" replace /> },
    { path: "luyen-tap/*", Component: () => <Navigate to="/giao-vien/de-thi" replace /> },

    // Chấm bài
    { path: "cham-diem", Component: GradingQueue },
    { path: "cham-diem/:submissionId", Component: GradingDetail },
    { path: "xem-vstep/:examId", Component: StudentVstepExamPage },
    { path: "xem-ielts/:examId", Component: IeltsExamPreview },
    { path: "cham-diem/thong-ke", Component: GradingStats },

    // Giám sát trực tiếp
    { path: "giam-sat-truc-tiep", Component: LiveMonitoring },
    { path: "giam-sat-truc-tiep/:studentId", Component: StudentDetail },
    { path: "giam-sat-truc-tiep/thong-ke", Component: RealtimeStats },

    // Blog & Bài viết
    { path: "bai-viet", Component: BlogList },
    { path: "bai-viet/tao-moi", Component: CreatePost },
    { path: "bai-viet/danh-muc", Component: Categories },
    { path: "bai-viet/thong-ke", Component: ContentStats },
    { path: "bai-viet/:postId", Component: PostDetail },
    { path: "bai-viet/:postId/chinh-sua", Component: CreatePost },

    // Báo cáo
    { path: "bao-cao", Component: ReportsOverview },

    // Cài đặt
    { path: "cai-dat", Component: Settings },

    // Catch-all
    { path: "*", Component: UnderConstruction },
  ],
};