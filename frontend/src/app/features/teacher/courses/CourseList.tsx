import { useState, useEffect } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { usePageTitle, PAGE_TITLES } from "../../../../hooks/usePageTitle";
import { usePageHeader } from "../../../../contexts/TeacherHeaderContext";
import {
import { formatVNDate } from "@/utils/dateUtils";
  BookOpen,
  Users,
  TrendingUp,
  GraduationCap,
  Plus,
  BarChart3,
  Grid3x3,
  List,
  Search,
  Filter,
  Calendar,
  Clock,
  MapPin,
  MoreVertical,
  Eye,
  Edit,
  Copy,
  Archive,
  Trash2,
  X,
  ChevronDown,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface Course {
  id: string;
  cName: string;
  cCategory: "VSTEP" | "IELTS" | "Cambridge";
  cNumberOfStudent: number;
  cMaxStudents: number;
  cTime: string;
  cSchedule: string;
  cStartDate: string;
  cEndDate: string;
  cStatus: "draft" | "active" | "completed" | "archived";
  cDescription: string;
  cRevenue?: number;
  cImage?: string;
}

const mockCourses: Course[] = [
  {
    id: "1",
    cName: "VSTEP B1-B2 - Buổi tối",
    cCategory: "VSTEP",
    cNumberOfStudent: 25,
    cMaxStudents: 30,
    cTime: "2 giờ",
    cSchedule: "Thứ 2-4-6, 19:00-21:00",
    cStartDate: "2026-04-01",
    cEndDate: "2026-06-30",
    cStatus: "active",
    cDescription: "Khóa học VSTEP B1-B2 dành cho người đi làm, học buổi tối 3 buổi/tuần",
    cRevenue: 37500000,
  },
  {
    id: "2",
    cName: "IELTS 6.5-7.0 - Intensive",
    cCategory: "IELTS",
    cNumberOfStudent: 30,
    cMaxStudents: 30,
    cTime: "3 giờ",
    cSchedule: "Thứ 2-3-5, 18:30-21:30",
    cStartDate: "2026-03-15",
    cEndDate: "2026-07-15",
    cStatus: "active",
    cDescription: "Khóa học IELTS intensive cho target 6.5-7.0",
    cRevenue: 60000000,
  },
  {
    id: "3",
    cName: "Cambridge FCE - Weekend",
    cCategory: "Cambridge",
    cNumberOfStudent: 18,
    cMaxStudents: 25,
    cTime: "4 giờ",
    cSchedule: "Thứ 7-CN, 8:00-12:00",
    cStartDate: "2026-04-10",
    cEndDate: "2026-08-20",
    cStatus: "active",
    cDescription: "Lớp FCE cuối tuần cho học sinh, sinh viên",
    cRevenue: 27000000,
  },
  {
    id: "4",
    cName: "VSTEP C1 - Advanced",
    cCategory: "VSTEP",
    cNumberOfStudent: 8,
    cMaxStudents: 15,
    cTime: "2.5 giờ",
    cSchedule: "Thứ 3-5-7, 19:30-22:00",
    cStartDate: "2026-05-01",
    cEndDate: "2026-08-31",
    cStatus: "draft",
    cDescription: "Khóa VSTEP C1 cho học viên nâng cao",
  },
  {
    id: "5",
    cName: "IELTS 5.0-6.0 - Foundation",
    cCategory: "IELTS",
    cNumberOfStudent: 22,
    cMaxStudents: 25,
    cTime: "2 giờ",
    cSchedule: "Thứ 2-4-6, 17:00-19:00",
    cStartDate: "2026-02-01",
    cEndDate: "2026-05-30",
    cStatus: "completed",
    cDescription: "Khóa nền tảng IELTS cho người mới bắt đầu",
    cRevenue: 33000000,
  },
  {
    id: "6",
    cName: "Cambridge KET - Kids",
    cCategory: "Cambridge",
    cNumberOfStudent: 20,
    cMaxStudents: 20,
    cTime: "1.5 giờ",
    cSchedule: "Thứ 3-5, 16:00-17:30",
    cStartDate: "2026-03-20",
    cEndDate: "2026-06-15",
    cStatus: "active",
    cDescription: "Lớp KET cho học sinh tiểu học",
    cRevenue: 20000000,
  },
];

const categoryColors = {
  VSTEP: "bg-blue-500",
  IELTS: "bg-purple-500",
  Cambridge: "bg-green-500",
};

const statusColors = {
  draft: "bg-gray-500",
  active: "bg-green-500",
  completed: "bg-blue-500",
  archived: "bg-gray-400",
};

const statusLabels = {
  draft: "Nháp",
  active: "Đang diễn ra",
  completed: "Hoàn thành",
  archived: "Đã lưu trữ",
};

export function CourseList() {
  usePageTitle(PAGE_TITLES.TEACHER_COURSES);
  const { t } = useTranslation();
  usePageHeader({ breadcrumb: [t("breadcrumb.dashboard"), t("breadcrumb.courses")] });
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  // Calculate stats
  const totalCourses = mockCourses.length;
  const activeCourses = mockCourses.filter((c) => c.cStatus === "active").length;
  const totalStudents = mockCourses.reduce((sum, c) => sum + c.cNumberOfStudent, 0);
  const avgOccupancy =
    mockCourses.reduce((sum, c) => sum + (c.cNumberOfStudent / c.cMaxStudents) * 100, 0) /
    mockCourses.length;

  // Filter courses
  const filteredCourses = mockCourses.filter((course) => {
    const matchesSearch = course.cName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === "all" || course.cCategory === filterCategory;
    const matchesStatus = filterStatus === "all" || course.cStatus === filterStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const getOccupancyColor = (percentage: number) => {
    if (percentage >= 100) return "text-red-500";
    if (percentage >= 80) return "text-orange-500";
    return "text-green-500";
  };

  const getOccupancyBgColor = (percentage: number) => {
    if (percentage >= 100) return "bg-red-500";
    if (percentage >= 80) return "bg-orange-500";
    return "bg-green-500";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Danh sách khóa học</h1>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Link to="/giao-vien" className="hover:text-orange-600 transition-colors">
                  Dashboard
                </Link>
                <span>/</span>
                <span>Khóa học</span>
                <span>/</span>
                <span className="text-gray-900 font-medium">Danh sách</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/giao-vien/khoa-hoc/thong-ke"
                className="px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all flex items-center gap-2 font-medium"
              >
                <BarChart3 className="w-4 h-4" />
                Thống kê
              </Link>
              <Link
                to="/giao-vien/khoa-hoc/tao-moi"
                className="px-4 py-2.5 bg-gradient-to-r from-orange-600 to-orange-500 text-white rounded-lg hover:from-orange-700 hover:to-orange-600 transition-all flex items-center gap-2 font-medium shadow-lg shadow-orange-500/30"
              >
                <Plus className="w-4 h-4" />
                Tạo khóa học
              </Link>
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 rounded transition-all ${
                    viewMode === "grid"
                      ? "bg-white text-orange-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Grid3x3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2 rounded transition-all ${
                    viewMode === "list"
                      ? "bg-white text-orange-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Courses */}
          <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-all group">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg shadow-orange-500/30 group-hover:scale-110 transition-transform">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div className="flex items-center gap-1 text-green-600 text-sm font-medium">
                <TrendingUp className="w-4 h-4" />
                <span>+12%</span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-gray-600 text-sm font-medium">Tổng khóa học</p>
              <p className="text-3xl font-bold text-gray-900">{totalCourses}</p>
            </div>
          </div>

          {/* Active Courses */}
          <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-all group">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg shadow-green-500/30 group-hover:scale-110 transition-transform">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div className="flex items-center gap-1 text-green-600 text-sm font-medium">
                <TrendingUp className="w-4 h-4" />
                <span>+8%</span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-gray-600 text-sm font-medium">Đang diễn ra</p>
              <p className="text-3xl font-bold text-gray-900">{activeCourses}</p>
            </div>
          </div>

          {/* Total Students */}
          <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-all group">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div className="flex items-center gap-1 text-green-600 text-sm font-medium">
                <TrendingUp className="w-4 h-4" />
                <span>+15%</span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-gray-600 text-sm font-medium">Tổng học viên</p>
              <p className="text-3xl font-bold text-gray-900">{totalStudents}</p>
            </div>
          </div>

          {/* Average Occupancy */}
          <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-all group">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg shadow-orange-500/30 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div className="flex items-center gap-1 text-green-600 text-sm font-medium">
                <TrendingUp className="w-4 h-4" />
                <span>+5%</span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-gray-600 text-sm font-medium">Tỷ lệ lấp đầy TB</p>
              <p className="text-3xl font-bold text-gray-900">{avgOccupancy.toFixed(1)}%</p>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm theo tên khóa học..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Category Filter */}
            <div className="relative">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="appearance-none px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white cursor-pointer"
              >
                <option value="all">{t('teacher.courses.allCategories')}</option>
                <option value="VSTEP">VSTEP</option>
                <option value="IELTS">IELTS</option>
                <option value="Cambridge">Cambridge</option>
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="appearance-none px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white cursor-pointer"
              >
                <option value="all">{t('teacher.courses.allStatuses')}</option>
                <option value="draft">{t('teacher.courses.status.draft')}</option>
                <option value="active">{t('teacher.courses.status.active')}</option>
                <option value="completed">{t('teacher.courses.status.completed')}</option>
                <option value="archived">{t('teacher.courses.status.archived')}</option>
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Clear Filters */}
            {(searchTerm || filterCategory !== "all" || filterStatus !== "all") && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setFilterCategory("all");
                  setFilterStatus("all");
                }}
                className="px-4 py-2.5 text-gray-600 hover:text-gray-800 font-medium transition-colors"
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
        </div>

        {/* Course Grid/List */}
        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredCourses.map((course) => {
              const occupancyPercent = (course.cNumberOfStudent / course.cMaxStudents) * 100;
              return (
                <div
                  key={course.id}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-xl transition-all group"
                >
                  {/* Course Image */}
                  <div className="relative h-48 bg-gradient-to-br from-orange-400 via-orange-300 to-amber-300 overflow-hidden">
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-all" />
                    <div className="absolute top-4 right-4">
                      <span
                        className={`${categoryColors[course.cCategory]} text-white px-3 py-1 rounded-full text-xs font-semibold shadow-lg`}
                      >
                        {course.cCategory}
                      </span>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <BookOpen className="w-16 h-16 text-white/30" />
                    </div>
                  </div>

                  {/* Course Content */}
                  <div className="p-6 space-y-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-1 group-hover:text-orange-600 transition-colors">
                        {course.cName}
                      </h3>
                      <p className="text-sm text-gray-600 line-clamp-2">{course.cDescription}</p>
                    </div>

                    {/* Course Info */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span>{course.cSchedule}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span>{course.cTime} / buổi</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <span>
                          {formatVNDate(course.cStartDate)} -{" "}
                          {formatVNDate(course.cEndDate)}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-gray-600 font-medium">Sĩ số</span>
                        <span className={`font-bold ${getOccupancyColor(occupancyPercent)}`}>
                          {course.cNumberOfStudent}/{course.cMaxStudents} ({occupancyPercent.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className={`${getOccupancyBgColor(occupancyPercent)} h-full rounded-full transition-all`}
                          style={{ width: `${Math.min(occupancyPercent, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Stats Row */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                      <div className="flex items-center gap-2">
                        <span
                          className={`${statusColors[course.cStatus]} text-white px-2.5 py-1 rounded-md text-xs font-semibold`}
                        >
                          {statusLabels[course.cStatus]}
                        </span>
                      </div>
                      {course.cRevenue && (
                        <div className="text-sm font-semibold text-green-600">
                          {(course.cRevenue / 1000000).toFixed(1)}M VND
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-2">
                      <Link
                        to={`/khoa-hoc/${course.id}`}
                        className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all text-center text-sm font-medium"
                      >
                        {t('teacher.common.viewDetail')}
                      </Link>
                      <Link
                        to={`/khoa-hoc/chinh-sua/${course.id}`}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all text-sm font-medium"
                      >
                        <Edit className="w-4 h-4" />
                      </Link>
                      <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List View */
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Tên khóa học
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Danh mục
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Lịch học
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Thời gian
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Sĩ số
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Tỷ lệ
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Trạng thái
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Ngày bắt đầu
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredCourses.map((course) => {
                    const occupancyPercent = (course.cNumberOfStudent / course.cMaxStudents) * 100;
                    return (
                      <tr key={course.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center flex-shrink-0">
                              <BookOpen className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{course.cName}</p>
                              <p className="text-sm text-gray-500 line-clamp-1">
                                {course.cDescription}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`${categoryColors[course.cCategory]} text-white px-2.5 py-1 rounded-md text-xs font-semibold`}
                          >
                            {course.cCategory}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{course.cSchedule}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{course.cTime}</td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-gray-900">
                            {course.cNumberOfStudent}/{course.cMaxStudents}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div
                                className={`${getOccupancyBgColor(occupancyPercent)} h-full rounded-full`}
                                style={{ width: `${Math.min(occupancyPercent, 100)}%` }}
                              />
                            </div>
                            <span
                              className={`text-sm font-semibold ${getOccupancyColor(occupancyPercent)}`}
                            >
                              {occupancyPercent.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`${statusColors[course.cStatus]} text-white px-2.5 py-1 rounded-md text-xs font-semibold`}
                          >
                            {statusLabels[course.cStatus]}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {formatVNDate(course.cStartDate)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              to={`/khoa-hoc/${course.id}`}
                              className="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                              title={t('teacher.common.viewDetail')}
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                            <Link
                              to={`/khoa-hoc/chinh-sua/${course.id}`}
                              className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
                              title={t('teacher.common.edit')}
                            >
                              <Edit className="w-4 h-4" />
                            </Link>
                            <button
                              className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                              title="Nhân bản"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title={t('teacher.common.delete')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredCourses.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="max-w-md mx-auto space-y-4">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                <BookOpen className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Không tìm thấy khóa học</h3>
              <p className="text-gray-600">
                Không có khóa học nào phù hợp với bộ lọc của bạn. Thử thay đổi tiêu chí tìm kiếm.
              </p>
              <button
                onClick={() => {
                  setSearchTerm("");
                  setFilterCategory("all");
                  setFilterStatus("all");
                }}
                className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all font-medium inline-flex items-center gap-2"
              >
                Xóa bộ lọc
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

