import { useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Target,
  Calendar,
  Download,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";
import {
import { formatVNDate } from "@/utils/dateUtils";
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// Mock data
const enrollmentTrendData = [
  { month: "T1", enrolled: 5, dropped: 0, net: 5 },
  { month: "T2", enrolled: 12, dropped: 1, net: 11 },
  { month: "T3", enrolled: 18, dropped: 1, net: 17 },
  { month: "T4", enrolled: 25, dropped: 2, net: 23 },
  { month: "T5", enrolled: 28, dropped: 2, net: 26 },
  { month: "T6", enrolled: 30, dropped: 2, net: 28 },
];

const revenueMonthlyData = [
  { month: "T1", revenue: 7.5 },
  { month: "T2", revenue: 10.5 },
  { month: "T3", revenue: 9.0 },
  { month: "T4", revenue: 10.5 },
  { month: "T5", revenue: 4.5 },
  { month: "T6", revenue: 0 },
];

const statusDistributionData = [
  { name: "Đang học", value: 25, color: "#10B981" },
  { name: "Hoàn thành", value: 3, color: "#3B82F6" },
  { name: "Đã nghỉ", value: 2, color: "#6B7280" },
];

const enrollmentSourceData = [
  { name: "Ghi danh trực tiếp", value: 60, color: "#8B5CF6" },
  { name: "Chuyển lớp", value: 20, color: "#EC4899" },
  { name: "Tự ghi danh", value: 15, color: "#F59E0B" },
  { name: "Khác", value: 5, color: "#6B7280" },
];

const monthlyEnrollmentData = [
  { month: "T1", students: 5 },
  { month: "T2", students: 7 },
  { month: "T3", students: 6 },
  { month: "T4", students: 7 },
  { month: "T5", students: 3 },
  { month: "T6", students: 2 },
];

const topStudents = [
  { id: 1, name: "Phạm Minh Đức", score: 9.0, attendance: 100 },
  { id: 2, name: "Nguyễn Văn An", score: 8.5, attendance: 95 },
  { id: 3, name: "Trần Thị Bình", score: 7.2, attendance: 88 },
  { id: 4, name: "Lê Hoàng Cường", score: 6.0, attendance: 65 },
  { id: 5, name: "Võ Thị Em", score: 5.5, attendance: 60 },
];

const COLORS = ["#8B5CF6", "#EC4899", "#F59E0B", "#6B7280"];

export function CourseStats() {
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState("course"); // 'course' | 'custom'
  const [comparisonMode, setComparisonMode] = useState(false);

  // Mock course data
  const courseData = {
    name: "VSTEP B1-B2 - Buổi tối",
    category: "VSTEP",
    status: "active",
    enrolled: 25,
    maxStudents: 30,
    completionRate: 88.5,
    avgAttendance: 85.2,
    totalRevenue: 37500000,
    startDate: "2026-04-01",
    endDate: "2026-06-30",
  };

  // Calculate stats
  const occupancyPercent = (courseData.enrolled / courseData.maxStudents) * 100;
  const avgFeePerStudent = courseData.totalRevenue / courseData.enrolled;

  // Calculate progress
  const totalDays = Math.ceil(
    (new Date(courseData.endDate).getTime() - new Date(courseData.startDate).getTime()) /
      (1000 * 60 * 60 * 24)
  );
  const daysElapsed = Math.ceil(
    (new Date().getTime() - new Date(courseData.startDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  const daysRemaining = totalDays - daysElapsed;
  const progressPercent = (daysElapsed / totalDays) * 100;

  // Custom Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="font-semibold text-gray-900 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-600">{entry.name}:</span>
              <span className="font-semibold text-gray-900">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Link to="/giao-vien/khoa-hoc" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Thống kê - {courseData.name}
                </h1>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Link to="/" className="hover:text-orange-600 transition-colors">
                    Dashboard
                  </Link>
                  <span>/</span>
                  <Link to="/giao-vien/khoa-hoc" className="hover:text-orange-600 transition-colors">
                    Khóa học
                  </Link>
                  <span>/</span>
                  <span className="text-gray-900 font-medium">Thống kê</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white text-sm"
              >
                <option value="course">Toàn bộ khóa học</option>
                <option value="month">Tháng này</option>
                <option value="week">Tuần này</option>
                <option value="custom">Tùy chỉnh</option>
              </select>
              <button className="px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all flex items-center gap-2 font-medium">
                <Download className="w-4 h-4" />
                Xuất báo cáo
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* Course Overview Card */}
        <div className="bg-gradient-to-br from-orange-600 via-purple-600 to-pink-600 rounded-xl p-8 text-white shadow-lg">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">{courseData.name}</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-white/20 backdrop-blur rounded-lg text-sm font-semibold">
                  {courseData.category}
                </span>
                <span className="px-3 py-1 bg-green-500/80 backdrop-blur rounded-lg text-sm font-semibold">
                  Đang diễn ra
                </span>
              </div>
            </div>
            <button
              onClick={() => setComparisonMode(!comparisonMode)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                comparisonMode
                  ? "bg-white text-orange-600"
                  : "bg-white/20 hover:bg-white/30 backdrop-blur"
              }`}
            >
              {comparisonMode ? "Tắt so sánh" : "So sánh"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Enrolled */}
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-5 h-5 text-white/80" />
                <div className="flex items-center gap-1 text-sm">
                  <TrendingUp className="w-4 h-4" />
                  <span>+12%</span>
                </div>
              </div>
              <p className="text-white/80 text-sm mb-1">Tổng ghi danh</p>
              <p className="text-3xl font-bold">{courseData.enrolled}</p>
              <p className="text-sm text-white/70 mt-1">/ {courseData.maxStudents} slots</p>
            </div>

            {/* Completion Rate */}
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <Target className="w-5 h-5 text-white/80" />
                <div className="flex items-center gap-1 text-sm">
                  <TrendingUp className="w-4 h-4" />
                  <span>+8%</span>
                </div>
              </div>
              <p className="text-white/80 text-sm mb-1">Tỷ lệ hoàn thành</p>
              <p className="text-3xl font-bold">{courseData.completionRate}%</p>
              <div className="mt-2 w-full bg-white/20 rounded-full h-1.5">
                <div
                  className="bg-white h-full rounded-full"
                  style={{ width: `${courseData.completionRate}%` }}
                />
              </div>
            </div>

            {/* Avg Attendance */}
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <CheckCircle2 className="w-5 h-5 text-white/80" />
                <div className="flex items-center gap-1 text-sm">
                  <TrendingUp className="w-4 h-4" />
                  <span>+5%</span>
                </div>
              </div>
              <p className="text-white/80 text-sm mb-1">Điểm danh TB</p>
              <p className="text-3xl font-bold">{courseData.avgAttendance}%</p>
            </div>

            {/* Total Revenue */}
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-5 h-5 text-white/80" />
                <div className="flex items-center gap-1 text-sm">
                  <TrendingUp className="w-4 h-4" />
                  <span>+15%</span>
                </div>
              </div>
              <p className="text-white/80 text-sm mb-1">Tổng doanh thu</p>
              <p className="text-3xl font-bold">{(courseData.totalRevenue / 1000000).toFixed(1)}M</p>
              <p className="text-sm text-white/70 mt-1">VNĐ</p>
            </div>
          </div>
        </div>

        {/* Row 1: Enrollment Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status Distribution */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Phân bố trạng thái</h3>
                <p className="text-sm text-gray-600 mt-1">Tình trạng học viên hiện tại</p>
              </div>
              <div className="p-2 bg-purple-100 rounded-lg">
                <PieChartIcon className="w-5 h-5 text-purple-600" />
              </div>
            </div>
            <div className="h-64" style={{ minWidth: 0, minHeight: 256 }}>
              <ResponsiveContainer width="100%" height={256}>
                <PieChart>
                  <Pie
                    data={statusDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusDistributionData.map((entry, index) => (
                      <Cell key={`status-cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              {statusDistributionData.map((item, index) => (
                <div key={index} className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-sm font-medium text-gray-700">{item.name}</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{item.value}</p>
                  <p className="text-xs text-gray-500">
                    {((item.value / courseData.enrolled) * 100).toFixed(1)}%
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Occupancy & Capacity */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Tỷ lệ lấp đầy</h3>
                <p className="text-sm text-gray-600 mt-1">Sĩ số so với tối đa</p>
              </div>
              <div className="p-2 bg-orange-100 rounded-lg">
                <Target className="w-5 h-5 text-orange-600" />
              </div>
            </div>
            <div className="flex items-center justify-center h-64">
              <div className="relative">
                <svg className="w-48 h-48 transform -rotate-90">
                  <circle
                    cx="96"
                    cy="96"
                    r="80"
                    stroke="#E5E7EB"
                    strokeWidth="16"
                    fill="none"
                  />
                  <circle
                    cx="96"
                    cy="96"
                    r="80"
                    stroke={
                      occupancyPercent >= 80 ? "#10B981" : occupancyPercent >= 60 ? "#F59E0B" : "#EF4444"
                    }
                    strokeWidth="16"
                    fill="none"
                    strokeDasharray={`${(occupancyPercent / 100) * 502.4} 502.4`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-4xl font-bold text-gray-900">{occupancyPercent.toFixed(0)}%</p>
                    <p className="text-sm text-gray-600 mt-1">Lấp đầy</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Hiện tại</p>
                <p className="text-xl font-bold text-orange-600">{courseData.enrolled}</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Tối đa</p>
                <p className="text-xl font-bold text-gray-900">{courseData.maxStudents}</p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Còn trống</p>
                <p className="text-xl font-bold text-green-600">
                  {courseData.maxStudents - courseData.enrolled}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Enrollment Trends */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Xu hướng ghi danh</h3>
              <p className="text-sm text-gray-600 mt-1">Số lượng học viên theo thời gian</p>
            </div>
            <div className="p-2 bg-green-100 rounded-lg">
              <Activity className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <div className="h-80" style={{ minWidth: 0, minHeight: 320 }}>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={enrollmentTrendData}>
                <defs>
                  <linearGradient id="colorEnrolled" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorDropped" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="month" stroke="#6B7280" />
                <YAxis stroke="#6B7280" />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="enrolled"
                  stroke="#3B82F6"
                  fillOpacity={1}
                  fill="url(#colorEnrolled)"
                  name="Ghi danh"
                />
                <Area
                  type="monotone"
                  dataKey="dropped"
                  stroke="#EF4444"
                  fillOpacity={1}
                  fill="url(#colorDropped)"
                  name="Nghỉ học"
                />
                <Area
                  type="monotone"
                  dataKey="net"
                  stroke="#10B981"
                  fillOpacity={1}
                  fill="url(#colorNet)"
                  name="Tổng hiện tại"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Row 3: Revenue Statistics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue Cards */}
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <DollarSign className="w-8 h-8 text-white/80" />
              <div className="flex items-center gap-1 text-sm">
                <TrendingUp className="w-4 h-4" />
                <span>+15%</span>
              </div>
            </div>
            <p className="text-white/80 text-sm mb-1">Tổng doanh thu</p>
            <p className="text-4xl font-bold mb-2">{(courseData.totalRevenue / 1000000).toFixed(1)}M</p>
            <p className="text-sm text-white/70">VNĐ</p>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <Users className="w-8 h-8 text-white/80" />
              <div className="flex items-center gap-1 text-sm">
                <TrendingUp className="w-4 h-4" />
                <span>+8%</span>
              </div>
            </div>
            <p className="text-white/80 text-sm mb-1">TB / học viên</p>
            <p className="text-4xl font-bold mb-2">{(avgFeePerStudent / 1000000).toFixed(1)}M</p>
            <p className="text-sm text-white/70">VNĐ / người</p>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <CheckCircle2 className="w-8 h-8 text-white/80" />
              <div className="flex items-center gap-1 text-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>100%</span>
              </div>
            </div>
            <p className="text-white/80 text-sm mb-1">Đã thanh toán</p>
            <p className="text-4xl font-bold mb-2">25/25</p>
            <p className="text-sm text-white/70">100% hoàn thành</p>
          </div>
        </div>

        {/* Revenue Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Doanh thu theo tháng</h3>
              <p className="text-sm text-gray-600 mt-1">Theo dõi dòng tiền vào</p>
            </div>
            <div className="p-2 bg-green-100 rounded-lg">
              <BarChart3 className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <div className="h-64" style={{ minWidth: 0, minHeight: 256 }}>
            <ResponsiveContainer width="100%" height={256}>
              <BarChart data={revenueMonthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="month" stroke="#6B7280" />
                <YAxis stroke="#6B7280" />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="revenue" fill="#10B981" radius={[8, 8, 0, 0]} name="Doanh thu (M VNĐ)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Row 4: Course Progress Timeline */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Timeline khóa học</h3>
              <p className="text-sm text-gray-600 mt-1">Tiến độ thực hiện</p>
            </div>
            <div className="p-2 bg-orange-100 rounded-lg">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Tiến độ</span>
              <span className="text-sm font-bold text-gray-900">{progressPercent.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-orange-500 to-purple-500 h-full rounded-full transition-all"
                style={{ width: `${Math.min(progressPercent, 100)}%` }}
              />
            </div>
          </div>

          {/* Timeline Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-orange-50 rounded-lg p-4">
              <Calendar className="w-5 h-5 text-orange-600 mb-2" />
              <p className="text-sm text-gray-600 mb-1">Ngày bắt đầu</p>
              <p className="font-bold text-gray-900">
                {formatVNDate(courseData.startDate)}
              </p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <Calendar className="w-5 h-5 text-purple-600 mb-2" />
              <p className="text-sm text-gray-600 mb-1">Ngày kết thúc</p>
              <p className="font-bold text-gray-900">
                {formatVNDate(courseData.endDate)}
              </p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <Clock className="w-5 h-5 text-green-600 mb-2" />
              <p className="text-sm text-gray-600 mb-1">Đã trôi qua</p>
              <p className="font-bold text-gray-900">{daysElapsed} ngày</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <Clock className="w-5 h-5 text-orange-600 mb-2" />
              <p className="text-sm text-gray-600 mb-1">Còn lại</p>
              <p className="font-bold text-gray-900">{daysRemaining} ngày</p>
            </div>
          </div>
        </div>

        {/* Row 5: Student Demographics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Enrollment Source */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Nguồn ghi danh</h3>
                <p className="text-sm text-gray-600 mt-1">Học viên đến từ đâu</p>
              </div>
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
            </div>
            <div className="h-64" style={{ minWidth: 0, minHeight: 256 }}>
              <ResponsiveContainer width="100%" height={256}>
                <PieChart>
                  <Pie
                    data={enrollmentSourceData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {enrollmentSourceData.map((entry, index) => (
                      <Cell key={`source-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly Enrollment */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Ghi danh theo tháng</h3>
                <p className="text-sm text-gray-600 mt-1">Phân bố thời gian</p>
              </div>
              <div className="p-2 bg-orange-100 rounded-lg">
                <BarChart3 className="w-5 h-5 text-orange-600" />
              </div>
            </div>
            <div className="h-64" style={{ minWidth: 0, minHeight: 256 }}>
              <ResponsiveContainer width="100%" height={256}>
                <BarChart data={monthlyEnrollmentData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="month" stroke="#6B7280" />
                  <YAxis stroke="#6B7280" />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="students" fill="#3B82F6" radius={[8, 8, 0, 0]} name="Học viên" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Top Students */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Học viên xuất sắc</h3>
              <p className="text-sm text-gray-600 mt-1">Top 5 theo điểm & điểm danh</p>
            </div>
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Sparkles className="w-5 h-5 text-yellow-600" />
            </div>
          </div>
          <div className="space-y-3">
            {topStudents.map((student, index) => (
              <div
                key={student.id}
                className="flex items-center gap-4 p-4 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                    index === 0
                      ? "bg-gradient-to-br from-yellow-400 to-yellow-500"
                      : index === 1
                        ? "bg-gradient-to-br from-gray-300 to-gray-400"
                        : index === 2
                          ? "bg-gradient-to-br from-orange-400 to-orange-500"
                          : "bg-gradient-to-br from-orange-400 to-orange-500"
                  }`}
                >
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{student.name}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                    <span>Điểm TB: {student.score}</span>
                    <span>Điểm danh: {student.attendance}%</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-full rounded-full"
                      style={{ width: `${student.attendance}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{student.score}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Insights Panel */}
        <div className="bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 rounded-xl p-6 text-white">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-white/20 backdrop-blur rounded-lg">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold">AI Insights & Recommendations</h3>
              <p className="text-white/80 text-sm">Phân tích thông minh từ dữ liệu</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="flex items-start gap-3">
                <TrendingUp className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold mb-1">Tăng trưởng tốt</p>
                  <p className="text-sm text-white/80">
                    Tỷ lệ ghi danh tăng 20% so với khóa trước
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold mb-1">Cần chú ý</p>
                  <p className="text-sm text-white/80">3 học sinh có nguy cơ bỏ học (điểm danh {"<"}50%)</p>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold mb-1">Gợi ý</p>
                  <p className="text-sm text-white/80">
                    Khóa học sắp đầy, cân nhắc mở lớp mới
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

