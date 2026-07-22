import { useState } from "react";
import { Link } from "react-router";
import {
  ChevronRight,
  Plus,
  Search,
  Edit2,
  Trash2,
  FileText,
  Eye,
  TrendingUp,
  Grid3x3,
  List,
  X,
  FolderOpen,
  Hash,
  Type,
  Palette,
  BookOpen,
  GraduationCap,
  Languages,
  Lightbulb,
  Newspaper,
  BookMarked,
  MessageSquare,
  Globe,
  Award,
  Target,
} from "lucide-react";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  color: string;
  icon: string; // Icon name from lucide-react
  postsCount: number;
  totalViews: number;
  status: "active" | "inactive";
  createdAt: string;
}

// Icon mapping
const iconMap: Record<string, React.ElementType> = {
  BookOpen,
  GraduationCap,
  Languages,
  Lightbulb,
  Newspaper,
  BookMarked,
  MessageSquare,
  Globe,
  Award,
  Target,
  FileText,
  Type,
  Palette,
};

// Helper component to render icon
const CategoryIcon = ({ iconName, className, style }: { iconName: string; className?: string; style?: React.CSSProperties }) => {
  const IconComponent = iconMap[iconName] || BookOpen;
  return <IconComponent className={className} style={style} />;
};

export function Categories() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Mock data
  const [categories, setCategories] = useState<Category[]>([
    {
      id: "1",
      name: "IELTS",
      slug: "ielts",
      description: "Tài liệu và kinh nghiệm luyện thi IELTS",
      color: "#2563EB",
      icon: "Award",
      postsCount: 45,
      totalViews: 12500,
      status: "active",
      createdAt: "2024-01-15",
    },
    {
      id: "2",
      name: "TOEFL",
      slug: "toefl",
      description: "Hướng dẫn chinh phục TOEFL",
      color: "#10B981",
      icon: "Target",
      postsCount: 32,
      totalViews: 8900,
      status: "active",
      createdAt: "2024-01-20",
    },
    {
      id: "3",
      name: "Grammar",
      slug: "grammar",
      description: "Ngữ pháp tiếng Anh từ cơ bản đến nâng cao",
      color: "#8B5CF6",
      icon: "Type",
      postsCount: 68,
      totalViews: 18700,
      status: "active",
      createdAt: "2024-01-10",
    },
    {
      id: "4",
      name: "Vocabulary",
      slug: "vocabulary",
      description: "Từ vựng theo chủ đề và cấp độ",
      color: "#F59E0B",
      icon: "BookMarked",
      postsCount: 54,
      totalViews: 15200,
      status: "active",
      createdAt: "2024-01-25",
    },
    {
      id: "5",
      name: "Cambridge",
      slug: "cambridge",
      description: "Luyện thi Cambridge (KET, PET, FCE...)",
      color: "#EF4444",
      icon: "GraduationCap",
      postsCount: 28,
      totalViews: 6800,
      status: "active",
      createdAt: "2024-02-01",
    },
    {
      id: "6",
      name: "Tips & Tricks",
      slug: "tips-tricks",
      description: "Mẹo học tiếng Anh hiệu quả",
      color: "#06B6D4",
      icon: "Lightbulb",
      postsCount: 41,
      totalViews: 11300,
      status: "active",
      createdAt: "2024-02-05",
    },
  ]);

  const filteredCategories = categories.filter((cat) =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPosts = categories.reduce((sum, cat) => sum + cat.postsCount, 0);
  const totalViews = categories.reduce((sum, cat) => sum + cat.totalViews, 0);
  const activeCategories = categories.filter((cat) => cat.status === "active").length;

  const handleDeleteCategory = (id: string) => {
    setCategories(categories.filter((cat) => cat.id !== id));
    setShowDeleteConfirm(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-6">
      {/* Breadcrumb */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm mb-4">
          <Link to="/giao-vien/bai-viet" className="text-blue-600 hover:text-blue-700 font-semibold">
            Bài viết
          </Link>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <span className="text-gray-900 font-semibold">Danh mục</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Quản lý Danh mục 📂</h1>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Tổng danh mục</p>
              <p className="text-3xl font-bold text-gray-900">{categories.length}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-xl">
              <FolderOpen className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Đang hoạt động</p>
              <p className="text-3xl font-bold text-green-600">{activeCategories}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-xl">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Tổng bài viết</p>
              <p className="text-3xl font-bold text-purple-600">{totalPosts}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-xl">
              <FileText className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Tổng lượt xem</p>
              <p className="text-3xl font-bold text-orange-600">{totalViews.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-xl">
              <Eye className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm danh mục..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-lg transition-all ${
                  viewMode === "grid"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Grid3x3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded-lg transition-all ${
                  viewMode === "list"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Create Button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg shadow-blue-500/30 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Tạo danh mục
            </button>
          </div>
        </div>
      </div>

      {/* Categories Grid/List */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCategories.map((category) => (
            <div
              key={category.id}
              className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200 p-6 hover:shadow-xl transition-all duration-300 group"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: category.color + "20" }}
                  >
                    <CategoryIcon iconName={category.icon} className="w-6 h-6" style={{ color: category.color }} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{category.name}</h3>
                    <p className="text-sm text-gray-500">/{category.slug}</p>
                  </div>
                </div>
                <span
                  className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                    category.status === "active"
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {category.status === "active" ? "Hoạt động" : "Tắt"}
                </span>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-600 mb-4 line-clamp-2">{category.description}</p>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-4 h-4 text-gray-500" />
                    <span className="text-xs text-gray-600">Bài viết</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900">{category.postsCount}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Eye className="w-4 h-4 text-gray-500" />
                    <span className="text-xs text-gray-600">Lượt xem</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900">
                    {category.totalViews.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingCategory(category)}
                  className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 font-semibold rounded-lg hover:bg-blue-100 transition-all flex items-center justify-center gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  Sửa
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(category.id)}
                  className="px-3 py-2 bg-red-50 text-red-600 font-semibold rounded-lg hover:bg-red-100 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                  Danh mục
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                  Mô tả
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">
                  Bài viết
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">
                  Lượt xem
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">
                  Trạng thái
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredCategories.map((category) => (
                <tr key={category.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: category.color + "20" }}
                      >
                        <CategoryIcon iconName={category.icon} className="w-5 h-5" style={{ color: category.color }} />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{category.name}</p>
                        <p className="text-sm text-gray-500">/{category.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-600 line-clamp-2">{category.description}</p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-lg">
                      <FileText className="w-4 h-4 text-gray-600" />
                      <span className="font-semibold text-gray-900">{category.postsCount}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-lg">
                      <Eye className="w-4 h-4 text-gray-600" />
                      <span className="font-semibold text-gray-900">
                        {category.totalViews.toLocaleString()}
                      </span>
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`inline-block px-3 py-1 rounded-lg text-xs font-semibold ${
                        category.status === "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {category.status === "active" ? "Hoạt động" : "Tắt"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setEditingCategory(category)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(category.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
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
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingCategory) && (
        <CategoryModal
          category={editingCategory}
          onClose={() => {
            setShowCreateModal(false);
            setEditingCategory(null);
          }}
          onSave={(category) => {
            if (editingCategory) {
              setCategories(
                categories.map((cat) => (cat.id === category.id ? category : cat))
              );
            } else {
              setCategories([...categories, { ...category, id: Date.now().toString() }]);
            }
            setShowCreateModal(false);
            setEditingCategory(null);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 rounded-xl">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Xác nhận xóa</h3>
                <p className="text-sm text-gray-600">Bạn có chắc chắn muốn xóa danh mục này?</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-all"
              >
                Hủy
              </button>
              <button
                onClick={() => handleDeleteCategory(showDeleteConfirm)}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-all"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Category Modal Component
interface CategoryModalProps {
  category: Category | null;
  onClose: () => void;
  onSave: (category: Category) => void;
}

function CategoryModal({ category, onClose, onSave }: CategoryModalProps) {
  const [formData, setFormData] = useState<Partial<Category>>(
    category || {
      name: "",
      slug: "",
      description: "",
      color: "#2563EB",
      icon: "📁",
      status: "active",
      postsCount: 0,
      totalViews: 0,
      createdAt: new Date().toISOString().split("T")[0],
    }
  );

  const handleNameChange = (name: string) => {
    setFormData({
      ...formData,
      name,
      slug: name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as Category);
  };

  const colorPresets = [
    "#2563EB", // Blue
    "#10B981", // Green
    "#8B5CF6", // Purple
    "#F59E0B", // Orange
    "#EF4444", // Red
    "#06B6D4", // Cyan
    "#EC4899", // Pink
    "#14B8A6", // Teal
  ];

  const iconPresets = ["📁", "📘", "📗", "📝", "📚", "🎓", "💡", "🌟", "🎯", "🚀", "💼", "🎨"];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {category ? "Chỉnh sửa danh mục" : "Tạo danh mục mới"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-all"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
              <Type className="w-4 h-4" />
              Tên danh mục
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="VD: IELTS, Grammar, Vocabulary..."
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Slug */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
              <Hash className="w-4 h-4" />
              URL Slug
            </label>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              placeholder="url-slug"
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">URL: /blog/category/{formData.slug || "slug"}</p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Mô tả</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Mô tả ngắn về danh mục..."
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
              required
            />
          </div>

          {/* Icon Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Icon</label>
            <div className="grid grid-cols-6 gap-2">
              {iconPresets.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setFormData({ ...formData, icon })}
                  className={`p-3 rounded-xl text-2xl hover:bg-gray-100 transition-all ${
                    formData.icon === icon ? "bg-blue-100 ring-2 ring-blue-500" : "bg-gray-50"
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* Color Selection */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
              <Palette className="w-4 h-4" />
              Màu sắc
            </label>
            <div className="grid grid-cols-8 gap-2">
              {colorPresets.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, color })}
                  className={`w-10 h-10 rounded-xl transition-all ${
                    formData.color === color ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : ""
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Trạng thái</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="active"
                  checked={formData.status === "active"}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as "active" | "inactive" })}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">Hoạt động</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="inactive"
                  checked={formData.status === "inactive"}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as "active" | "inactive" })}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">Không hoạt động</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-all"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg shadow-blue-500/30"
            >
              {category ? "Cập nhật" : "Tạo mới"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}