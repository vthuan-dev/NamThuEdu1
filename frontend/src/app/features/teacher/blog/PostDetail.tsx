import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Edit3,
  Trash2,
  Send,
  Calendar,
  Eye as EyeIcon,
  Heart,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  BookOpen,
  Lightbulb,
  BookMarked,
  GraduationCap,
  Newspaper,
  Loader2,
  ChevronRight,
  User,
} from "lucide-react";
import { teacherBlogApi, Blog } from "../../../../services/blogApi";
import { useToast } from "../../../../hooks/useToast";

const typeConfig: Record<
  string,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  grammar: { label: "Grammar", icon: BookOpen, color: "text-blue-700", bg: "bg-blue-50" },
  tips: { label: "Tips", icon: Lightbulb, color: "text-amber-700", bg: "bg-amber-50" },
  vocabulary: { label: "Vocabulary", icon: BookMarked, color: "text-violet-700", bg: "bg-violet-50" },
  teaching: { label: "Teaching", icon: GraduationCap, color: "text-emerald-700", bg: "bg-emerald-50" },
  news: { label: "News", icon: Newspaper, color: "text-orange-700", bg: "bg-orange-50" },
};

const statusConfig: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ElementType }
> = {
  draft: { label: "Nhap", color: "text-slate-600", bg: "bg-slate-100", icon: FileText },
  pending: { label: "Cho duyet", color: "text-amber-700", bg: "bg-amber-50", icon: Clock },
  active: { label: "Da xuat ban", color: "text-emerald-700", bg: "bg-emerald-50", icon: CheckCircle2 },
  inactive: { label: "Tu choi", color: "text-rose-700", bg: "bg-rose-50", icon: XCircle },
};

export function PostDetail() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { success: showSuccess, error: showError } = useToast();

  const [blog, setBlog] = useState<Blog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const fetchBlog = async () => {
      if (!postId) return;
      setLoading(true);
      setError(null);
      try {
        const response = await teacherBlogApi.getBlogDetail(parseInt(postId));
        setBlog(response.data.data);
      } catch (err: any) {
        setError(err.response?.data?.message || "Khong the tai bai viet");
      } finally {
        setLoading(false);
      }
    };
    fetchBlog();
  }, [postId]);

  const handleDelete = async () => {
    if (!blog) return;
    try {
      await teacherBlogApi.deleteBlog(blog.pId);
      showSuccess(t("blog.detail.toastDeleted"));
      navigate("/giao-vien/bai-viet");
    } catch (err: any) {
      showError(err.response?.data?.message || t("blog.detail.toastDeleteError"));
    }
  };

  const handleSubmitForReview = async () => {
    if (!blog) return;
    try {
      await teacherBlogApi.submitForReview(blog.pId);
      showSuccess(t("blog.detail.toastSubmitted"));
      setBlog({ ...blog, pStatus: "pending" });
    } catch (err: any) {
      showError(err.response?.data?.message || t("blog.detail.toastSubmitError"));
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const wordCount = blog
    ? blog.pContent
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .split(/\s+/)
        .filter((w) => w.length > 0).length
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F5F5F7' }}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">{t("blog.detail.loading")}</p>
        </div>
      </div>
    );
  }

  if (error || !blog) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F5F5F7' }}>
        <div className="text-center bg-white rounded-2xl p-12" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <XCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <p className="text-base font-bold text-rose-800 mb-2">{t("blog.detail.notFound")}</p>
          <p className="text-sm text-rose-600 mb-6">{error}</p>
          <Link
            to="/giao-vien/bai-viet"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("blog.detail.btnBack")}
          </Link>
        </div>
      </div>
    );
  }

  const typeInfo = typeConfig[blog.pType] || typeConfig.teaching;
  const statusInfo = statusConfig[blog.pStatus] || statusConfig.draft;
  const TypeIcon = typeInfo.icon;
  const StatusIcon = statusInfo.icon;

  return (
    <div className="min-h-screen" style={{ background: '#F5F5F7' }}>
      {/* Breadcrumb - Full width */}
      <div className="w-full px-6 pt-6 pb-3">
        <div className="flex items-center gap-4">
          <Link
            to="/giao-vien/bai-viet"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-white rounded-2xl hover:bg-orange-50 hover:text-orange-600 transition-colors cursor-pointer"
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
          >
            <ArrowLeft className="w-4 h-4" />
            {t("blog.detail.btnBack")}
          </Link>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Link
              to="/giao-vien/bai-viet"
              className="hover:text-blue-600 transition-colors cursor-pointer font-medium"
            >
              {t("blog.detail.breadcrumb")}
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-slate-900 font-semibold truncate max-w-md">
              {blog.pTitle}
            </span>
          </div>
        </div>
      </div>

      {/* Header Actions - Full width */}
      <div className="w-full px-6 pb-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${statusInfo.bg} ${statusInfo.color}`}
            >
              <StatusIcon className="w-4 h-4" />
              {t(`blog.status.${blog.pStatus}`)}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium ${typeInfo.bg} ${typeInfo.color}`}
            >
              <TypeIcon className="w-4 h-4" />
              {t(`blog.type.${blog.pType}`)}
            </span>
          </div>
          <div className="flex items-center gap-2.5 flex-shrink-0">
            {blog.pStatus === "draft" && (
              <button
                onClick={handleSubmitForReview}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-blue-700 bg-blue-50 rounded-2xl hover:bg-blue-100 transition-colors cursor-pointer"
              >
                <Send className="w-4 h-4" />
                {t("blog.detail.btnSubmit")}
              </button>
            )}
            <Link
              to={`/giao-vien/bai-viet/${blog.pId}/chinh-sua`}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
            >
              <Edit3 className="w-4 h-4" />
              {t("blog.detail.btnEdit")}
            </Link>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-rose-600 bg-rose-50 rounded-2xl hover:bg-rose-100 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              {t("blog.detail.btnDelete")}
            </button>
          </div>
        </div>
      </div>

      {/* Article Card - Centered with max-width */}
      <div className="max-w-5xl mx-auto px-6 pb-6">
        <article className="bg-white rounded-3xl overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          {/* Featured Image */}
          {blog.pThumbnail && (
            <div className="w-full h-80 sm:h-96 overflow-hidden bg-gradient-to-br from-slate-100 to-slate-50">
              <img
                src={blog.pThumbnail}
                alt={blog.pTitle}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Article Content */}
          <div className="p-8 sm:p-12">
            {/* Meta */}
            <div className="flex flex-wrap items-center gap-5 mb-6 text-sm text-slate-500">
              <span className="inline-flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {formatDate(blog.pCreated_at)}
              </span>
              <span className="inline-flex items-center gap-2">
                <User className="w-4 h-4" />
                {blog.author?.uName || t("blog.detail.author")}
              </span>
              <span className="inline-flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {wordCount} {t("blog.detail.words")}
              </span>
              <span className="inline-flex items-center gap-2">
                <EyeIcon className="w-4 h-4" />
                {blog.pView || 0} {t("blog.detail.views")}
              </span>
              <span className="inline-flex items-center gap-2">
                <Heart className="w-4 h-4" />
                {blog.pLike || 0} {t("blog.detail.likes")}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-8 leading-tight">
              {blog.pTitle}
            </h1>

            {/* Content */}
            <div
              className="prose prose-lg prose-slate max-w-none prose-headings:text-slate-900 prose-headings:font-bold prose-p:text-slate-700 prose-p:leading-relaxed prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-strong:text-slate-900 prose-strong:font-semibold"
              dangerouslySetInnerHTML={{ __html: blog.pContent }}
            />

            {/* Reject Reason */}
            {blog.pStatus === "inactive" && blog.pReject_reason && (
              <div className="mt-8 p-5 bg-rose-50 rounded-2xl" style={{ border: '1px solid rgba(244,63,94,0.2)' }}>
                <p className="text-sm font-bold text-rose-800 mb-2">
                  {t("blog.detail.rejectReason")}
                </p>
                <p className="text-sm text-rose-700 leading-relaxed">{blog.pReject_reason}</p>
              </div>
            )}
          </div>
        </article>
      </div>

      {/* Delete Confirmation Modal — Bento style */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-sm w-full p-7"
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 bg-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Trash2 className="w-7 h-7 text-rose-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 text-center mb-2">
              {t("blog.detail.deleteTitle")}
            </h3>
            <p className="text-sm text-slate-500 text-center mb-6 leading-relaxed">
              {t("blog.detail.deleteMessage")}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-3 text-sm font-semibold text-slate-700 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-colors cursor-pointer"
              >
                {t("blog.detail.btnCancel")}
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-3 text-sm font-semibold text-white rounded-2xl hover:scale-[1.02] transition-transform cursor-pointer"
                style={{ background: '#EC4899', boxShadow: '0 4px 12px rgba(236,72,153,0.3)' }}
              >
                {t("blog.detail.btnConfirmDelete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
