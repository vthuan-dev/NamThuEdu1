import { useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import {
import { formatVNDate } from "@/utils/dateUtils";
  ArrowLeft,
  Users,
  Plus,
  Download,
  Search,
  X,
  MoreVertical,
  Eye,
  Edit,
  MessageSquare,
  Trash2,
  CheckCircle2,
  XCircle,
  DollarSign,
  Calendar,
  Clock,
  TrendingUp,
  AlertCircle,
  Mail,
  Phone,
  User,
  ChevronDown,
  FileText,
} from "lucide-react";

interface Student {
  id: string;
  avatar?: string;
  name: string;
  phone: string;
  email: string;
  enrollmentDate: string;
  feePaid: number;
  feeTotal: number;
  status: "enrolled" | "completed" | "dropped";
  paymentStatus: "paid" | "unpaid" | "partial";
  notes?: string;
  attendance?: number;
  avgScore?: number;
}

const mockStudents: Student[] = [
  {
    id: "1",
    name: "Nguyễn Văn An",
    phone: "0901234567",
    email: "nva@email.com",
    enrollmentDate: "2026-03-15",
    feePaid: 1500000,
    feeTotal: 1500000,
    status: "enrolled",
    paymentStatus: "paid",
    attendance: 95,
    avgScore: 8.5,
    notes: "Học sinh xuất sắc",
  },
  {
    id: "2",
    name: "Trần Thị Bình",
    phone: "0902345678",
    email: "ttb@email.com",
    enrollmentDate: "2026-03-16",
    feePaid: 750000,
    feeTotal: 1500000,
    status: "enrolled",
    paymentStatus: "partial",
    attendance: 88,
    avgScore: 7.2,
  },
  {
    id: "3",
    name: "Lê Hoàng Cường",
    phone: "0903456789",
    email: "lhc@email.com",
    enrollmentDate: "2026-03-14",
    feePaid: 0,
    feeTotal: 1500000,
    status: "enrolled",
    paymentStatus: "unpaid",
    attendance: 65,
    avgScore: 6.0,
    notes: "Cần nhắc nhở về học phí",
  },
  {
    id: "4",
    name: "Phạm Minh Đức",
    phone: "0904567890",
    email: "pmd@email.com",
    enrollmentDate: "2026-02-20",
    feePaid: 1500000,
    feeTotal: 1500000,
    status: "completed",
    paymentStatus: "paid",
    attendance: 100,
    avgScore: 9.0,
  },
  {
    id: "5",
    name: "Võ Thị Em",
    phone: "0905678901",
    email: "vte@email.com",
    enrollmentDate: "2026-03-10",
    feePaid: 500000,
    feeTotal: 1500000,
    status: "dropped",
    paymentStatus: "partial",
    notes: "Bỏ học vì lý do cá nhân",
  },
];

const statusColors = {
  enrolled: "bg-green-500",
  completed: "bg-orange-500",
  dropped: "bg-gray-500",
};

const statusLabels = {
  enrolled: "Đang học",
  completed: "Hoàn thành",
  dropped: "Đã ngh��",
};

const paymentStatusColors = {
  paid: "text-green-600 bg-green-100",
  unpaid: "text-orange-600 bg-orange-100",
  partial: "text-yellow-600 bg-yellow-100",
};

const paymentStatusLabels = {
  paid: "Đã thanh toán",
  unpaid: "Chưa thanh toán",
  partial: "Thanh toán 1 phần",
};

export function ManageStudents() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPayment, setFilterPayment] = useState<string>("all");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);

  // Mock course data
  const courseData = {
    name: "VSTEP B1-B2 - Buổi tối",
    category: "VSTEP",
    schedule: "Thứ 2-4-6, 19:00-21:00",
    duration: "2 giờ",
    period: "01/04/2026 - 30/06/2026",
    enrolled: 25,
    maxStudents: 30,
    completed: 3,
    dropped: 2,
  };

  // Filter students
  const filteredStudents = mockStudents.filter((student) => {
    const matchesSearch =
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.phone.includes(searchTerm) ||
      student.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || student.status === filterStatus;
    const matchesPayment = filterPayment === "all" || student.paymentStatus === filterPayment;
    return matchesSearch && matchesStatus && matchesPayment;
  });

  // Toggle student selection
  const toggleStudent = (id: string) => {
    setSelectedStudents((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    );
  };

  // Toggle all students
  const toggleAll = () => {
    if (selectedStudents.length === filteredStudents.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(filteredStudents.map((s) => s.id));
    }
  };

  // Open detail drawer
  const openDetailDrawer = (student: Student) => {
    setSelectedStudent(student);
    setShowDetailDrawer(true);
  };

  // Calculate stats
  const availableSlots = courseData.maxStudents - courseData.enrolled;
  const occupancyPercent = (courseData.enrolled / courseData.maxStudents) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-8 py-6">
          <div className="flex items-center gap-4 mb-6">
            <Link
              to="/giao-vien/khoa-hoc"
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Quản lý học viên - {courseData.name}
              </h1>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Link to="/giao-vien" className="hover:text-orange-600 transition-colors">
                  Dashboard
                </Link>
                <span>/</span>
                <Link to="/giao-vien/khoa-hoc" className="hover:text-orange-600 transition-colors">
                  Khóa học
                </Link>
                <span>/</span>
                <span className="text-gray-900 font-medium">Quản lý học viên</span>
              </div>
            </div>
          </div>

          {/* Course Info Chip */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg font-medium">
              <span className="w-2 h-2 bg-orange-600 rounded-full"></span>
              {courseData.category}
            </div>
            <div className="flex items-center gap-1.5 text-gray-600">
              <Calendar className="w-4 h-4" />
              <span>{courseData.schedule}</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-600">
              <Clock className="w-4 h-4" />
              <span>{courseData.duration} / buổi</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-600">
              <Calendar className="w-4 h-4" />
              <span>{courseData.period}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* Course Summary Card */}
        <div className="bg-gradient-to-br from-orange-600 via-blue-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Course Info */}
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-bold mb-2">{courseData.name}</h2>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-white/20 rounded-lg text-sm font-semibold">
                    {courseData.category}
                  </span>
                </div>
              </div>
              <div className="space-y-2 text-blue-50">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>{courseData.schedule}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>{courseData.duration} mỗi buổi</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>{courseData.period}</span>
                </div>
              </div>
            </div>

            {/* Right: Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <p className="text-blue-100 text-sm mb-1">Đã ghi danh</p>
                <p className="text-3xl font-bold">
                  {courseData.enrolled}/{courseData.maxStudents}
                </p>
                <div className="mt-2 w-full bg-white/20 rounded-full h-2">
                  <div
                    className="bg-white h-full rounded-full transition-all"
                    style={{ width: `${occupancyPercent}%` }}
                  />
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <p className="text-blue-100 text-sm mb-1">Hoàn thành</p>
                <p className="text-3xl font-bold">{courseData.completed}</p>
                <div className="mt-2 flex items-center gap-1 text-sm">
                  <TrendingUp className="w-4 h-4" />
                  <span>Tốt</span>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <p className="text-blue-100 text-sm mb-1">Đã nghỉ</p>
                <p className="text-3xl font-bold">{courseData.dropped}</p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <p className="text-blue-100 text-sm mb-1">Chỗ trống</p>
                <p className="text-3xl font-bold">{availableSlots}</p>
                <p className="text-sm text-blue-100 mt-1">slots</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm học sinh theo tên, SĐT, email..."
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

            {/* Filters */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="appearance-none px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white cursor-pointer"
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="enrolled">Đang học</option>
                  <option value="completed">Hoàn thành</option>
                  <option value="dropped">Đã nghỉ</option>
                </select>
                <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  value={filterPayment}
                  onChange={(e) => setFilterPayment(e.target.value)}
                  className="appearance-none px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white cursor-pointer"
                >
                  <option value="all">Tất cả học phí</option>
                  <option value="paid">Đã thanh toán</option>
                  <option value="partial">Thanh toán 1 phần</option>
                  <option value="unpaid">Chưa thanh toán</option>
                </select>
                <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all flex items-center gap-2 font-medium whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Thêm học sinh
              </button>

              <button className="px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all flex items-center gap-2 font-medium whitespace-nowrap">
                <Download className="w-4 h-4" />
                Xuất danh sách
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedStudents.length > 0 && (
          <div className="bg-orange-600 text-white rounded-xl p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-semibold">{selectedStudents.length} học sinh đã chọn</span>
              </div>
              <div className="flex items-center gap-2">
                <button className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Gửi thông báo
                </button>
                <button className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Đánh dấu hoàn thành
                </button>
                <button className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Xuất đã chọn
                </button>
                <button
                  onClick={() => setSelectedStudents([])}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Students Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left">
                    <input
                      type="checkbox"
                      checked={
                        filteredStudents.length > 0 &&
                        selectedStudents.length === filteredStudents.length
                      }
                      onChange={toggleAll}
                      className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Học sinh
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Liên hệ
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Ngày ghi danh
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Học phí
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Trạng thái
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Ghi chú
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedStudents.includes(student.id)}
                        onChange={() => toggleStudent(student.id)}
                        className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => openDetailDrawer(student)}
                        className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                      >
                        <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-purple-400 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-semibold text-sm">
                            {student.name.charAt(0)}
                          </span>
                        </div>
                        <div className="text-left">
                          <p className="font-semibold text-gray-900">{student.name}</p>
                          {student.attendance !== undefined && (
                            <p className="text-sm text-gray-500">
                              Điểm danh: {student.attendance}%
                            </p>
                          )}
                        </div>
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Phone className="w-4 h-4" />
                          <span>{student.phone}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Mail className="w-4 h-4" />
                          <span>{student.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatVNDate(student.enrollmentDate)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-gray-900">
                          {(student.feePaid / 1000000).toFixed(1)}M /{" "}
                          {(student.feeTotal / 1000000).toFixed(1)}M
                        </div>
                        <span
                          className={`inline-block whitespace-nowrap px-2.5 py-0.5 rounded-md text-xs font-semibold ${paymentStatusColors[student.paymentStatus]}`}
                        >
                          {paymentStatusLabels[student.paymentStatus]}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block whitespace-nowrap ${statusColors[student.status]} text-white px-2.5 py-1 rounded-md text-xs font-semibold`}
                      >
                        {statusLabels[student.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600 line-clamp-1 max-w-xs">
                        {student.notes || "-"}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openDetailDrawer(student)}
                          className="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                          title="Xem chi tiết"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
                          title="Chỉnh sửa"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                          title="Nhắn tin"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedStudent(student);
                            setShowRemoveModal(true);
                          }}
                          className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Xóa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Empty State */}
        {filteredStudents.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="max-w-md mx-auto space-y-4">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                <Users className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Không tìm thấy học sinh</h3>
              <p className="text-gray-600">
                {searchTerm || filterStatus !== "all" || filterPayment !== "all"
                  ? "Không có học sinh nào phù hợp với bộ lọc."
                  : "Chưa có học sinh nào trong khóa học này."}
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all font-medium inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Thêm học sinh đầu tiên
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Thêm học sinh vào khóa học</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Student Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Chọn học sinh <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Tìm và chọn học sinh..."
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Hoặc{" "}
                  <Link to="/giao-vien/students/them-moi" className="text-orange-600 hover:underline">
                    tạo học sinh mới
                  </Link>
                </p>
              </div>

              {/* Fee Paid */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Số tiền đã thanh toán
                </label>
                <div className="relative">
                  <DollarSign className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="VD: 1,500,000"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              {/* Payment Status */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Trạng thái thanh toán
                </label>
                <select className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white">
                  <option value="paid">Đã thanh toán</option>
                  <option value="partial">Thanh toán 1 phần</option>
                  <option value="unpaid">Chưa thanh toán</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Ghi chú</label>
                <textarea
                  rows={3}
                  placeholder="Ghi chú về học sinh..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                />
              </div>

              {/* Enrollment Date */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Ngày ghi danh
                </label>
                <input
                  type="date"
                  defaultValue={new Date().toISOString().split("T")[0]}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-medium"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  alert("Đã thêm học sinh!");
                }}
                className="px-6 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all font-medium"
              >
                Thêm học sinh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Student Modal */}
      {showRemoveModal && selectedStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Xác nhận xóa</h3>
                <p className="text-sm text-gray-600">Hành động này không thể hoàn tác</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-gray-700 mb-2">
                Bạn có chắc muốn xóa <strong>{selectedStudent.name}</strong> khỏi khóa học?
              </p>
              <p className="text-sm text-gray-600">
                Học sinh sẽ chuyển sang trạng thái "Đã nghỉ"
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 text-orange-600 border-gray-300 rounded" />
                <span className="text-sm text-gray-700">Hoàn học phí</span>
              </label>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Lý do (tùy chọn)</label>
                <textarea
                  rows={3}
                  placeholder="Ghi chú lý do nghỉ học..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setShowRemoveModal(false);
                  setSelectedStudent(null);
                }}
                className="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-medium"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  setShowRemoveModal(false);
                  setSelectedStudent(null);
                  alert("Đã xóa học sinh!");
                }}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all font-medium"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {showDetailDrawer && selectedStudent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-end">
          <div
            className="absolute inset-0"
            onClick={() => {
              setShowDetailDrawer(false);
              setSelectedStudent(null);
            }}
          />
          <div className="bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl relative animate-slide-in-right">
            <div className="sticky top-0 bg-gradient-to-r from-orange-600 to-purple-600 text-white p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <span className="text-xl font-bold">{selectedStudent.name.charAt(0)}</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{selectedStudent.name}</h3>
                    <span
                      className={`${statusColors[selectedStudent.status]} text-white px-2 py-0.5 rounded text-xs font-semibold mt-1 inline-block`}
                    >
                      {statusLabels[selectedStudent.status]}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowDetailDrawer(false);
                    setSelectedStudent(null);
                  }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Personal Info */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Thông tin cá nhân</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-900">{selectedStudent.phone}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-900">{selectedStudent.email}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-900">
                      Ghi danh:{" "}
                      {formatVNDate(selectedStudent.enrollmentDate)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">Thông tin thanh toán</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Đã thanh toán:</span>
                    <span className="font-semibold text-gray-900">
                      {(selectedStudent.feePaid / 1000000).toFixed(1)}M VNĐ
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tổng học phí:</span>
                    <span className="font-semibold text-gray-900">
                      {(selectedStudent.feeTotal / 1000000).toFixed(1)}M VNĐ
                    </span>
                  </div>
                  <div className="pt-2 border-t border-gray-200">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-semibold ${paymentStatusColors[selectedStudent.paymentStatus]}`}
                    >
                      {paymentStatusLabels[selectedStudent.paymentStatus]}
                    </span>
                  </div>
                </div>
              </div>

              {/* Performance */}
              {(selectedStudent.attendance !== undefined ||
                selectedStudent.avgScore !== undefined) && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Kết quả học tập</h4>
                  <div className="space-y-3">
                    {selectedStudent.attendance !== undefined && (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Điểm danh</span>
                          <span className="font-semibold text-gray-900">
                            {selectedStudent.attendance}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`${
                              selectedStudent.attendance >= 80
                                ? "bg-green-500"
                                : selectedStudent.attendance >= 50
                                  ? "bg-yellow-500"
                                  : "bg-red-500"
                            } h-full rounded-full`}
                            style={{ width: `${selectedStudent.attendance}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {selectedStudent.avgScore !== undefined && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Điểm trung bình</span>
                        <span className="font-semibold text-gray-900">
                          {selectedStudent.avgScore}/10
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedStudent.notes && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Ghi chú</h4>
                  <p className="text-sm text-gray-600 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    {selectedStudent.notes}
                  </p>
                </div>
              )}

              {/* Quick Actions */}
              <div className="space-y-2 pt-4 border-t border-gray-200">
                <button className="w-full px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all flex items-center justify-center gap-2 font-medium">
                  <Edit className="w-4 h-4" />
                  Chỉnh sửa thông tin
                </button>
                <button className="w-full px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all flex items-center justify-center gap-2 font-medium">
                  <MessageSquare className="w-4 h-4" />
                  Gửi tin nhắn
                </button>
                <Link
                  to={`/students/${selectedStudent.id}`}
                  className="w-full px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all flex items-center justify-center gap-2 font-medium"
                >
                  <Eye className="w-4 h-4" />
                  Xem hồ sơ đầy đủ
                </Link>
                <button
                  onClick={() => {
                    setShowDetailDrawer(false);
                    setShowRemoveModal(true);
                  }}
                  className="w-full px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all flex items-center justify-center gap-2 font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  Xóa khỏi khóa học
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

