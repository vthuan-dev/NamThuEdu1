/**
 * adminRoutes — Tất cả route dành cho admin.
 * Base path: "/admin" — Layout: AdminLayout (sidebar dark slate).
 * Tất cả page đều lazy-loaded để Suspense fallback (AdminPageSkeleton)
 * trong AdminLayout hiển thị khung skeleton khi chuyển trang.
 */
import { lazy } from "react";
import { Navigate } from "react-router";
import AdminLayout from "../layouts/AdminLayout";
import { ProtectedRoute } from "../../components/auth";
import { UnderConstruction } from "../components/shared/UnderConstruction";

// ─── Lazy admin pages ────────────────────────────────────────────────────────
const AdminDashboard               = lazy(() => import("../features/admin/dashboard/AdminDashboard").then(m => ({ default: m.AdminDashboard })));
const AdminUsersPage               = lazy(() => import("../features/admin/users/AdminUsersPage").then(m => ({ default: m.AdminUsersPage })));
const AdminPostsPage               = lazy(() => import("../features/admin/content/AdminPostsPage").then(m => ({ default: m.AdminPostsPage })));

const AdminStudentsReportPage      = lazy(() => import("../features/admin/reports/AdminStudentsReportPage").then(m => ({ default: m.AdminStudentsReportPage })));
const AdminCoursesPage             = lazy(() => import("../features/admin/courses/AdminCoursesPage").then(m => ({ default: m.AdminCoursesPage })));
const AdminRevenueReportPage       = lazy(() => import("../features/admin/reports/AdminRevenueReportPage").then(m => ({ default: m.AdminRevenueReportPage })));
const AdminTeachersReportPage      = lazy(() => import("../features/admin/reports/AdminTeachersReportPage").then(m => ({ default: m.AdminTeachersReportPage })));
const AdminSettingsPage            = lazy(() => import("../features/admin/settings/AdminSettingsPage").then(m => ({ default: m.AdminSettingsPage })));
const AdminHandoverPage            = lazy(() => import("../features/admin/handover/AdminHandoverPage").then(m => ({ default: m.AdminHandoverPage })));
const AdminClassManagementPage     = lazy(() => import("../features/admin/classes/AdminClassManagementPage").then(m => ({ default: m.AdminClassManagementPage })));

function ProtectedAdminLayout() {
  return (
    <ProtectedRoute requiredRole="admin">
      <AdminLayout />
    </ProtectedRoute>
  );
}

export const adminRoutes = {
  path: "/admin",
  Component: ProtectedAdminLayout,
  children: [
    // Tổng quan
    { index: true, Component: AdminDashboard },

    // Người dùng (Học viên & Giáo viên)
    { path: "users", Component: AdminUsersPage },

    // Đề thi (giữ alias /admin/courses cho lịch sử URL — thực chất là quản lý đề thi)
    { path: "courses", Component: AdminCoursesPage },
    // Các route khoá học cũ → redirect về trang đề thi
    { path: "courses/new", Component: () => <Navigate to="/admin/courses" replace /> },
    { path: "courses/categories", Component: () => <Navigate to="/admin/courses" replace /> },

    // Bàn giao lớp
    { path: "ban-giao-lop", Component: AdminHandoverPage },

    // Quản lý lớp (tổng hợp: danh sách lớp + yêu cầu bàn giao/xóa)
    { path: "quan-ly-lop", Component: AdminClassManagementPage },

    // Nội dung
    { path: "content/posts", Component: AdminPostsPage },
    { path: "content/exams", Component: () => <Navigate to="/admin/courses" replace /> },

    // Báo cáo
    { path: "reports/revenue", Component: AdminRevenueReportPage },
    { path: "reports/students", Component: AdminStudentsReportPage },
    { path: "reports/teachers", Component: AdminTeachersReportPage },

    // Hệ thống (Redirect to /admin as these pages are removed)
    { path: "system/activity-logs", Component: () => <Navigate to="/admin" replace /> },
    { path: "system/audit-logs", Component: () => <Navigate to="/admin" replace /> },
    { path: "system/server-health", Component: () => <Navigate to="/admin" replace /> },
    { path: "system/backups", Component: () => <Navigate to="/admin" replace /> },

    // Thông báo & Cài đặt
    { path: "notifications", Component: () => <Navigate to="/admin" replace /> },
    { path: "settings", Component: AdminSettingsPage },
    { path: "profile", Component: () => <Navigate to="/admin/settings?tab=profile" replace /> },

    // Legacy/Redirect routes to unified "Người dùng"
    { path: "teachers", Component: () => <Navigate to="/admin/users?tab=teachers" replace /> },
    { path: "teachers/new", Component: () => <Navigate to="/admin/users?tab=teachers" replace /> },
    { path: "teachers/assignments", Component: () => <Navigate to="/admin/users?tab=teachers" replace /> },
    { path: "students", Component: () => <Navigate to="/admin/users?tab=students" replace /> },
    { path: "students/new-registrations", Component: () => <Navigate to="/admin/users?tab=students" replace /> },
    { path: "giao-vien", Component: () => <Navigate to="/admin/users?tab=teachers" replace /> },
    { path: "giao-vien/them-moi", Component: () => <Navigate to="/admin/users?tab=teachers" replace /> },
    { path: "giao-vien/phan-cong", Component: () => <Navigate to="/admin/users?tab=teachers" replace /> },
    { path: "students/dang-ky", Component: () => <Navigate to="/admin/users?tab=students" replace /> },
    { path: "students/complaints", Component: () => <Navigate to="/admin/users?tab=students" replace /> },
    { path: "students/khieu-nai", Component: () => <Navigate to="/admin/users?tab=students" replace /> },
    { path: "khoa-hoc", Component: () => <Navigate to="/admin/courses" replace /> },
    { path: "khoa-hoc/tao-moi", Component: () => <Navigate to="/admin/courses" replace /> },
    { path: "khoa-hoc/danh-muc", Component: () => <Navigate to="/admin/courses" replace /> },
    { path: "noi-dung/bai-viet", Component: () => <Navigate to="/admin/content/posts" replace /> },
    { path: "noi-dung/de-thi", Component: () => <Navigate to="/admin/courses" replace /> },
    { path: "bao-cao/doanh-thu", Component: () => <Navigate to="/admin/reports/revenue" replace /> },
    { path: "bao-cao/students", Component: () => <Navigate to="/admin/reports/students" replace /> },
    { path: "bao-cao/giao-vien", Component: () => <Navigate to="/admin/reports/teachers" replace /> },
    { path: "he-thong/nhat-ky", Component: () => <Navigate to="/admin" replace /> },
    { path: "he-thong/server", Component: () => <Navigate to="/admin" replace /> },
    { path: "he-thong/backup", Component: () => <Navigate to="/admin" replace /> },
    { path: "thong-bao", Component: () => <Navigate to="/admin" replace /> },
    { path: "cai-dat", Component: () => <Navigate to="/admin/settings" replace /> },

    // Catch-all
    { path: "*", Component: UnderConstruction },
  ],
};
