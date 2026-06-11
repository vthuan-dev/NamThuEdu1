import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import {
  Plus, Search, Eye, Edit3, Trash2, Send, FileText, Clock,
  CheckCircle2, XCircle, MoreHorizontal, Calendar, Heart,
  PenLine, BarChart3, Tag, Loader2, BookOpen, Lightbulb,
  GraduationCap, Newspaper, BookMarked, SlidersHorizontal,
  Grid3X3, List,
} from "lucide-react";
import { useBlog } from "../../../../hooks/useBlog";
import { useToast } from "../../../../hooks/useToast";
import { usePageHeader } from "../../../../contexts/TeacherHeaderContext";

export function BlogList() {
  const { t } = useTranslation();
  usePageHeader({ breadcrumb: [t("breadcrumb.dashboard"), t("breadcrumb.blog")] });
  const navigate = useNavigate();
  const { blogs, loading, error, fetchBlogs, deleteBlog, submitForReview } = useBlog();
  const { success: showSuccess, error: showError } = useToast();

  const [search, setSearch]           = useState("");
  const [statusFilter, setStatus]     = useState("all");
  const [typeFilter, setType]         = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode]       = useState<"grid" | "list">("grid");
  const [menuOpen, setMenuOpen]       = useState<number | null>(null);
  const [deleteId, setDeleteId]       = useState<number | null>(null);

  useEffect(() => { fetchBlogs(); }, []);

  const filtered = blogs.filter((b) => {
    const q = search.toLowerCase();
    const matchQ = b.pTitle.toLowerCase().includes(q) || b.pContent.toLowerCase().includes(q);
    const matchS = statusFilter === "all" || b.pStatus === statusFilter;
    const matchT = typeFilter   === "all" || b.pType   === typeFilter;
    return matchQ && matchS && matchT;
  });

  const stats = {
    total:    blogs.length,
    draft:    blogs.filter((b) => b.pStatus === "draft").length,
    pending:  blogs.filter((b) => b.pStatus === "pending").length,
    active:   blogs.filter((b) => b.pStatus === "active").length,
    inactive: blogs.filter((b) => b.pStatus === "inactive").length,
  };

  const handleDelete = useCallback(async (id: number) => {
    try {
      await deleteBlog(id);
      showSuccess(t("blog.list.toastDeleted"));
      setDeleteId(null);
    } catch (e: any) {
      showError(e.response?.data?.message || t("blog.list.toastDeleteError"));
    }
  }, [deleteBlog, showSuccess, showError, t]);

  const handleSubmit = useCallback(async (id: number) => {
    try {
      await submitForReview(id);
      showSuccess(t("blog.list.toastSubmitted"));
      setMenuOpen(null);
    } catch (e: any) {
      showError(e.response?.data?.message || t("blog.list.toastSubmitError"));
    }
  }, [submitForReview, showSuccess, showError, t]);

  // ── Config maps ──────────────────────────────────────────────────────────
  const statusCfg: Record<string, { color: string; bg: string; border: string; icon: React.ElementType }> = {
    draft:    { color: "text-slate-600",   bg: "bg-slate-100",   border: "border-slate-200",   icon: FileText     },
    pending:  { color: "text-amber-700",   bg: "bg-amber-50",    border: "border-amber-200",   icon: Clock        },
    active:   { color: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200", icon: CheckCircle2 },
    inactive: { color: "text-rose-700",    bg: "bg-rose-50",     border: "border-rose-200",    icon: XCircle      },
  };

  const typeCfg: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
    grammar:    { color: "text-blue-700",   bg: "bg-blue-50",   icon: BookOpen      },
    tips:       { color: "text-amber-700",  bg: "bg-amber-50",  icon: Lightbulb     },
    vocabulary: { color: "text-violet-700", bg: "bg-violet-50", icon: BookMarked    },
    teaching:   { color: "text-emerald-700",bg: "bg-emerald-50",icon: GraduationCap },
    news:       { color: "text-orange-700", bg: "bg-orange-50", icon: Newspaper     },
  };

  const statCards = [
    { key: "total",    value: stats.total,    icon: FileText     },
    { key: "draft",    value: stats.draft,    icon: PenLine      },
    { key: "pending",  value: stats.pending,  icon: Clock        },
    { key: "active",   value: stats.active,   icon: CheckCircle2 },
    { key: "inactive", value: stats.inactive, icon: XCircle      },
  ];

  const StatusBadge = ({ status }: { status: string }) => {
    const cfg = statusCfg[status] ?? statusCfg.draft;
    const Icon = cfg.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
        <Icon className="w-3 h-3" />
        {t(`blog.status.${status}`, t("blog.status.draft"))}
      </span>
    );
  };

  const TypeBadge = ({ type }: { type: string }) => {
    const cfg = typeCfg[type] ?? typeCfg.teaching;
    const Icon = cfg.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${cfg.bg} ${cfg.color}`}>
        <Icon className="w-3 h-3" />
        {t(`blog.type.${type}`, type)}
      </span>
    );
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("vi-VN", { day: "numeric", month: "short", year: "numeric" });

  const stripHtml = (html: string, max = 100) => {
    const clean = html.replace(/<[^>]*>/g, "");
    return clean.length > max ? clean.slice(0, max) + "…" : clean;
  };

  return (
    <div className="min-h-screen" style={{ background: '#F5F5F7' }}>
      <div className="w-full px-6 py-6 space-y-4">

        {/* Header — Clean, minimal */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t("blog.list.title")}</h1>
            <p className="text-sm text-slate-500 mt-1">{t("blog.list.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2.5">
            <Link to="/giao-vien/bai-viet/thong-ke"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white rounded-2xl hover:scale-[1.02] transition-transform duration-200 shadow-sm cursor-pointer"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <BarChart3 className="w-4 h-4" />{t("blog.list.btnStats")}
            </Link>
            <Link to="/giao-vien/bai-viet/danh-muc"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white rounded-2xl hover:scale-[1.02] transition-transform duration-200 shadow-sm cursor-pointer"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <Tag className="w-4 h-4" />{t("blog.list.btnCategories")}
            </Link>
            <Link to="/giao-vien/bai-viet/tao-moi"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white rounded-2xl hover:scale-[1.02] transition-transform duration-200 shadow-md cursor-pointer"
              style={{ background: '#EC4899', boxShadow: '0 4px 12px rgba(236,72,153,0.25)' }}>
              <Plus className="w-4 h-4" />{t("blog.list.btnCreate")}
            </Link>
          </div>
        </div>

        {/* Stats — compact, trung tính */}
        <div className="grid grid-cols-5 gap-3">
          {statCards.map((c) => (
            <div key={c.key}
              className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-slate-100"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                <c.icon className="w-[18px] h-[18px] text-slate-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold text-slate-900 leading-none tabular-nums">{c.value}</p>
                <p className="text-[11px] font-medium text-slate-500 mt-1 truncate">{t(`blog.stats.${c.key}`)}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Search + Filter — Bento style */}
        <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
              <input type="text" placeholder={t("blog.list.searchPlaceholder")} value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50/50 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all"
                style={{ border: '1px solid rgba(0,0,0,0.06)' }} />
            </div>
            <button onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-1.5 px-4 py-3 text-sm font-medium rounded-xl transition-all cursor-pointer ${showFilters ? "bg-blue-50 text-blue-700" : "bg-slate-50/50 text-slate-600 hover:bg-slate-100"}`}
              style={{ border: showFilters ? '1px solid #3B82F6' : '1px solid rgba(0,0,0,0.06)' }}>
              <SlidersHorizontal className="w-4 h-4" />{t("blog.list.btnFilter")}
            </button>
            <div className="flex items-center bg-slate-50/50 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
              <button onClick={() => setViewMode("grid")}
                className={`p-2.5 transition-colors cursor-pointer ${viewMode === "grid" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode("list")}
                className={`p-2.5 transition-colors cursor-pointer ${viewMode === "list" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
          {showFilters && (
            <div className="mt-4 pt-4 grid grid-cols-2 gap-3" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">{t("blog.list.filterStatus")}</label>
                <select value={statusFilter} onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50/50 rounded-xl text-sm text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all"
                  style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
                  <option value="all">{t("blog.filter.all")}</option>
                  <option value="draft">{t("blog.filter.draft")}</option>
                  <option value="pending">{t("blog.filter.pending")}</option>
                  <option value="active">{t("blog.filter.active")}</option>
                  <option value="inactive">{t("blog.filter.inactive")}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">{t("blog.list.filterType")}</label>
                <select value={typeFilter} onChange={(e) => setType(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50/50 rounded-xl text-sm text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all"
                  style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
                  <option value="all">{t("blog.type.all")}</option>
                  <option value="grammar">{t("blog.type.grammar")}</option>
                  <option value="tips">{t("blog.type.tips")}</option>
                  <option value="vocabulary">{t("blog.type.vocabulary")}</option>
                  <option value="teaching">{t("blog.type.teaching")}</option>
                  <option value="news">{t("blog.type.news")}</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin mr-2.5" />
            <span className="text-sm text-slate-500">{t("blog.list.loading")}</span>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="bg-white rounded-xl border border-rose-200 p-8 text-center">
            <XCircle className="w-9 h-9 text-rose-500 mx-auto mb-3" />
            <p className="text-sm font-semibold text-rose-800 mb-1">{t("blog.list.errorTitle")}</p>
            <p className="text-xs text-rose-600 mb-4">{error}</p>
            <button onClick={() => fetchBlogs()}
              className="px-4 py-2 text-sm font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors cursor-pointer">
              {t("blog.list.btnRetry")}
            </button>
          </div>
        )}

        {/* Empty — Bento style */}
        {!loading && !error && blogs.length === 0 && (
          <div className="bg-white rounded-2xl p-16 text-center" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div className="w-16 h-16 mx-auto mb-5 bg-gradient-to-br from-slate-100 to-slate-50 rounded-2xl flex items-center justify-center">
              <FileText className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">{t("blog.list.emptyTitle")}</h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">{t("blog.list.emptySubtitle")}</p>
            <Link to="/giao-vien/bai-viet/tao-moi"
              className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white rounded-2xl hover:scale-[1.02] transition-transform cursor-pointer"
              style={{ background: '#EC4899', boxShadow: '0 4px 12px rgba(236,72,153,0.25)' }}>
              <Plus className="w-4.5 h-4.5" />{t("blog.list.btnCreateFirst")}
            </Link>
          </div>
        )}

        {/* No results — Bento style */}
        {!loading && !error && filtered.length === 0 && blogs.length > 0 && (
          <div className="bg-white rounded-2xl p-12 text-center" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div className="w-14 h-14 mx-auto mb-4 bg-gradient-to-br from-slate-100 to-slate-50 rounded-2xl flex items-center justify-center">
              <Search className="w-7 h-7 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">{t("blog.list.noResultTitle")}</h3>
            <p className="text-sm text-slate-500 mb-5 leading-relaxed">{t("blog.list.noResultSubtitle")}</p>
            <button onClick={() => { setSearch(""); setStatus("all"); setType("all"); }}
              className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-colors cursor-pointer">
              {t("blog.list.btnClearFilter")}
            </button>
          </div>
        )}

        {/* Grid View — Bento style */}
        {!loading && !error && filtered.length > 0 && viewMode === "grid" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((blog) => (
              <div
                key={blog.pId}
                className="group relative bg-white rounded-2xl overflow-hidden hover:scale-[1.02] transition-transform duration-200 cursor-pointer"
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
                onClick={() => navigate(`/giao-vien/bai-viet/${blog.pId}`)}>
                {/* Thumbnail */}
                <div className="relative h-44 bg-gradient-to-br from-slate-100 to-slate-50 overflow-hidden">
                  {blog.pThumbnail ? (
                    <img src={blog.pThumbnail} alt={blog.pTitle}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FileText className="w-10 h-10 text-slate-300" />
                    </div>
                  )}
                  <div className="absolute top-3 left-3"><StatusBadge status={blog.pStatus} /></div>
                  <div className="absolute top-3 right-3"><TypeBadge type={blog.pType} /></div>
                </div>
                {/* Body */}
                <div className="p-5">
                  <h3 className="text-base font-semibold text-slate-900 line-clamp-2 group-hover:text-blue-700 transition-colors mb-2">
                    {blog.pTitle}
                  </h3>
                  <p className="text-sm text-slate-500 line-clamp-2 mb-4">{stripHtml(blog.pContent)}</p>
                  {/* Meta */}
                  <div className="flex items-center gap-4 text-xs text-slate-400 pb-4 mb-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                    <span className="inline-flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{fmtDate(blog.pCreated_at)}</span>
                    <span className="inline-flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" />{blog.pView || 0}</span>
                    <span className="inline-flex items-center gap-1.5"><Heart className="w-3.5 h-3.5" />{blog.pLike || 0}</span>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Link to={`/giao-vien/bai-viet/${blog.pId}`} onClick={(e) => e.stopPropagation()}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors cursor-pointer">
                      <Eye className="w-4 h-4" />{t("blog.list.btnView")}
                    </Link>
                    <Link to={`/giao-vien/bai-viet/${blog.pId}/chinh-sua`} onClick={(e) => e.stopPropagation()}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer">
                      <Edit3 className="w-4 h-4" />{t("blog.list.btnEdit")}
                    </Link>
                    <button onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === blog.pId ? null : blog.pId); }}
                      className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer">
                      <MoreHorizontal className="w-4.5 h-4.5" />
                    </button>
                  </div>
                  {/* Dropdown */}
                  {menuOpen === blog.pId && (
                    <div className="absolute right-4 bottom-16 w-44 bg-white rounded-xl py-1.5 z-20"
                      style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}
                      onClick={(e) => e.stopPropagation()}>
                      {blog.pStatus === "draft" && (
                        <button onClick={() => handleSubmit(blog.pId)}
                          className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 transition-colors cursor-pointer">
                          <Send className="w-4 h-4" />{t("blog.list.btnSubmit")}
                        </button>
                      )}
                      <button onClick={() => { setDeleteId(blog.pId); setMenuOpen(null); }}
                        className="w-full px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer">
                        <Trash2 className="w-4 h-4" />{t("blog.list.btnDelete")}
                      </button>
                    </div>
                  )}
                  {/* Reject reason */}
                  {blog.pStatus === "inactive" && blog.pReject_reason && (
                    <div className="mt-3 p-3 bg-rose-50 rounded-xl" style={{ border: '1px solid rgba(244,63,94,0.2)' }}>
                      <p className="text-xs font-semibold text-rose-700 mb-1">{t("blog.list.rejectReason")}</p>
                      <p className="text-xs text-rose-600">{blog.pReject_reason}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* List View — Bento style */}
        {!loading && !error && filtered.length > 0 && viewMode === "list" && (
          <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div className="divide-y" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              {filtered.map((blog) => (
                <div key={blog.pId}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/60 transition-colors cursor-pointer group"
                  onClick={() => navigate(`/giao-vien/bai-viet/${blog.pId}`)}>
                  <div className="w-20 h-14 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 overflow-hidden flex-shrink-0">
                    {blog.pThumbnail ? (
                      <img src={blog.pThumbnail} alt={blog.pTitle} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileText className="w-5 h-5 text-slate-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-slate-900 truncate group-hover:text-blue-700 transition-colors">
                        {blog.pTitle}
                      </h3>
                      <StatusBadge status={blog.pStatus} />
                      <TypeBadge type={blog.pType} />
                    </div>
                    <p className="text-xs text-slate-500 truncate">{stripHtml(blog.pContent, 80)}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-5 text-xs text-slate-400 flex-shrink-0">
                    <span className="inline-flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{fmtDate(blog.pCreated_at)}</span>
                    <span className="inline-flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" />{blog.pView || 0}</span>
                    <span className="inline-flex items-center gap-1.5"><Heart className="w-3.5 h-3.5" />{blog.pLike || 0}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Link to={`/giao-vien/bai-viet/${blog.pId}`}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer">
                      <Eye className="w-4 h-4" />
                    </Link>
                    <Link to={`/giao-vien/bai-viet/${blog.pId}/chinh-sua`}
                      className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer">
                      <Edit3 className="w-4 h-4" />
                    </Link>
                    {blog.pStatus === "draft" && (
                      <button onClick={() => handleSubmit(blog.pId)}
                        className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors cursor-pointer">
                        <Send className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => setDeleteId(blog.pId)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Delete Modal — Bento style */}
      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={() => setDeleteId(null)}>
          <div className="bg-white rounded-3xl max-w-sm w-full p-7" 
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 bg-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Trash2 className="w-7 h-7 text-rose-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 text-center mb-2">{t("blog.list.deleteTitle")}</h3>
            <p className="text-sm text-slate-500 text-center mb-6 leading-relaxed">{t("blog.list.deleteMessage")}</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 px-4 py-3 text-sm font-semibold text-slate-700 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-colors cursor-pointer">
                {t("blog.list.btnCancel")}
              </button>
              <button onClick={() => handleDelete(deleteId)}
                className="flex-1 px-4 py-3 text-sm font-semibold text-white rounded-2xl hover:scale-[1.02] transition-transform cursor-pointer"
                style={{ background: '#EC4899', boxShadow: '0 4px 12px rgba(236,72,153,0.3)' }}>
                {t("blog.list.btnConfirmDelete")}
              </button>
            </div>
          </div>
        </div>
      )}

      {menuOpen !== null && (
        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
      )}
    </div>
  );
}
