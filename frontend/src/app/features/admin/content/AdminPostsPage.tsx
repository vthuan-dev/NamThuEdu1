import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Search, Trash2, XCircle, Eye, X, Calendar, User, Tag, AlertCircle } from "lucide-react";
import { adminApi, AdminPost } from "@/services/adminApi";
import { RejectReasonModal } from "../components/RejectReasonModal";
import { AdminTableSkeleton } from "../components/AdminPageSkeleton";
import { sanitizeHtml } from "@/utils/sanitizeHtml";

function postId(post: AdminPost) {
  return post.pId || post.id || 0;
}
function postTitle(post: AdminPost) {
  return post.pTitle || post.title || "Không có tiêu đề";
}
function postStatus(post: AdminPost) {
  return post.pStatus || post.status || "draft";
}
function authorName(post: AdminPost) {
  return post.author?.uName || post.author?.name || "N/A";
}

export function AdminPostsPage() {
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdminPost | null>(null);
  const [previewPost, setPreviewPost] = useState<AdminPost | null>(null);
  const [actionMsg, setActionMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);

  const loadPosts = async () => {
    try {
      setLoading(true);
      setError(null);
      const allPosts = await adminApi.getPosts();
      setPosts(allPosts);
    } catch {
      setError("Không tải được danh sách bài viết.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  useEffect(() => {
    if (!actionMsg) return;
    const t = setTimeout(() => setActionMsg(null), 3000);
    return () => clearTimeout(t);
  }, [actionMsg]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts.filter((p) => {
      const matchQ =
        !q ||
        postTitle(p).toLowerCase().includes(q) ||
        authorName(p).toLowerCase().includes(q) ||
        (p.pType || "").toLowerCase().includes(q);
      const status = postStatus(p);
      const matchStatus = statusFilter === "all" || status === statusFilter;
      return matchQ && matchStatus;
    });
  }, [posts, search, statusFilter]);

  const stats = useMemo(() => {
    const total = posts.length;
    const pending = posts.filter((p) => postStatus(p) === "pending").length;
    const approved = posts.filter((p) => postStatus(p) === "active").length;
    const rejected = posts.filter((p) => postStatus(p) === "inactive").length;
    const draft = posts.filter((p) => postStatus(p) === "draft").length;
    return { total, pending, approved, rejected, draft };
  }, [posts]);

  const handleApprove = async (id: number) => {
    try {
      setBusyId(id);
      await adminApi.approvePost(id);
      setActionMsg({ text: "Đã duyệt bài viết thành công.", type: "ok" });
      if (previewPost && postId(previewPost) === id) {
        setPreviewPost((prev) => (prev ? { ...prev, pStatus: "active" } : null));
      }
      await loadPosts();
    } catch (e: any) {
      setActionMsg({ text: e?.response?.data?.message || "Duyệt bài viết thất bại.", type: "err" });
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (id: number) => {
    const target = posts.find((p) => postId(p) === id);
    if (target) setRejectTarget(target);
  };

  const submitReject = async (reason: string) => {
    if (!rejectTarget) return;
    const id = postId(rejectTarget);
    try {
      setBusyId(id);
      await adminApi.rejectPost(id, reason);
      setRejectTarget(null);
      if (previewPost && postId(previewPost) === id) {
        setPreviewPost((prev) => (prev ? { ...prev, pStatus: "inactive", pReject_reason: reason } : null));
      }
      setActionMsg({ text: "Đã từ chối bài viết.", type: "ok" });
      await loadPosts();
    } catch (e: any) {
      setActionMsg({ text: e?.response?.data?.message || "Từ chối bài viết thất bại.", type: "err" });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa bài viết này?")) return;
    try {
      setBusyId(id);
      await adminApi.deletePost(id);
      if (previewPost && postId(previewPost) === id) {
        setPreviewPost(null);
      }
      setActionMsg({ text: "Đã xóa bài viết.", type: "ok" });
      await loadPosts();
    } catch (e: any) {
      setActionMsg({ text: e?.response?.data?.message || "Xóa bài viết thất bại.", type: "err" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen p-6" style={{ background: "#F8FAFC" }}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Kiểm duyệt bài viết</h1>
          <p className="text-sm text-slate-500">Xem trước nội dung, duyệt hoặc từ chối bài viết của giáo viên</p>
        </div>
        <button
          onClick={loadPosts}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
        >
          Tải lại
        </button>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-5">
        <div
          onClick={() => setStatusFilter("all")}
          className={`cursor-pointer rounded-2xl border p-4 transition-all ${
            statusFilter === "all" ? "border-blue-500 bg-blue-50/50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"
          }`}
        >
          <p className="text-xs text-slate-500">Tất cả</p>
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
        </div>
        <div
          onClick={() => setStatusFilter("pending")}
          className={`cursor-pointer rounded-2xl border p-4 transition-all ${
            statusFilter === "pending" ? "border-amber-500 bg-amber-100/60 shadow-sm" : "border-amber-200 bg-amber-50 hover:border-amber-300"
          }`}
        >
          <p className="text-xs text-amber-700 font-medium">Chờ duyệt</p>
          <p className="text-2xl font-bold text-amber-700">{stats.pending}</p>
        </div>
        <div
          onClick={() => setStatusFilter("active")}
          className={`cursor-pointer rounded-2xl border p-4 transition-all ${
            statusFilter === "active" ? "border-emerald-500 bg-emerald-100/60 shadow-sm" : "border-emerald-200 bg-emerald-50 hover:border-emerald-300"
          }`}
        >
          <p className="text-xs text-emerald-700 font-medium">Đã xuất bản</p>
          <p className="text-2xl font-bold text-emerald-700">{stats.approved}</p>
        </div>
        <div
          onClick={() => setStatusFilter("inactive")}
          className={`cursor-pointer rounded-2xl border p-4 transition-all ${
            statusFilter === "inactive" ? "border-rose-500 bg-rose-100/60 shadow-sm" : "border-rose-200 bg-rose-50 hover:border-rose-300"
          }`}
        >
          <p className="text-xs text-rose-700 font-medium">Bị từ chối</p>
          <p className="text-2xl font-bold text-rose-700">{stats.rejected}</p>
        </div>
        <div
          onClick={() => setStatusFilter("draft")}
          className={`cursor-pointer rounded-2xl border p-4 transition-all ${
            statusFilter === "draft" ? "border-slate-500 bg-slate-100 shadow-sm" : "border-slate-200 bg-slate-50 hover:border-slate-300"
          }`}
        >
          <p className="text-xs text-slate-600 font-medium">Bản nháp</p>
          <p className="text-2xl font-bold text-slate-700">{stats.draft}</p>
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tiêu đề, tác giả, loại bài..."
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 outline-none focus:border-blue-500 text-sm"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        {loading ? (
          <AdminTableSkeleton rows={7} cols={6} />
        ) : error ? (
          <div className="p-8 text-center text-red-600">{error}</div>
        ) : (
          <table className="w-full min-w-[1020px]">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Tiêu đề</th>
                <th className="px-4 py-3">Tác giả</th>
                <th className="px-4 py-3">Loại bài</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                    Không tìm thấy bài viết nào phù hợp.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const id = postId(p);
                  const status = postStatus(p);
                  return (
                    <tr key={id} className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 text-sm font-mono text-slate-500">#{id}</td>
                      <td className="px-4 py-3 font-medium text-slate-900 max-w-xs truncate" title={postTitle(p)}>
                        {postTitle(p)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{authorName(p)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
                          {p.pType || "N/A"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            status === "active"
                              ? "bg-emerald-100 text-emerald-700"
                              : status === "inactive"
                              ? "bg-rose-100 text-rose-700"
                              : status === "pending"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {status === "active"
                            ? "Đã duyệt"
                            : status === "inactive"
                            ? "Từ chối"
                            : status === "pending"
                            ? "Chờ duyệt"
                            : "Bản nháp"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Nút Xem chi tiết nội dung */}
                          <button
                            onClick={() => setPreviewPost(p)}
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 cursor-pointer transition-colors"
                            title="Xem chi tiết nội dung bài viết"
                          >
                            <Eye className="h-3.5 w-3.5" /> Xem
                          </button>

                          {/* Chỉ cho phép duyệt nếu là pending hoặc inactive (tái duyệt), KHÔNG duyệt bản nháp */}
                          {status === "pending" && (
                            <button
                              onClick={() => handleApprove(id)}
                              disabled={busyId === id}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-200 disabled:opacity-60 cursor-pointer transition-colors"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Duyệt
                            </button>
                          )}

                          {status === "active" && (
                            <button
                              onClick={() => handleReject(id)}
                              disabled={busyId === id}
                              className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-200 disabled:opacity-60 cursor-pointer transition-colors"
                            >
                              <XCircle className="h-3.5 w-3.5" /> Gỡ xuống
                            </button>
                          )}

                          {status === "pending" && (
                            <button
                              onClick={() => handleReject(id)}
                              disabled={busyId === id}
                              className="inline-flex items-center gap-1 rounded-lg bg-rose-100 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-200 disabled:opacity-60 cursor-pointer transition-colors"
                            >
                              <XCircle className="h-3.5 w-3.5" /> Từ chối
                            </button>
                          )}

                          {status === "draft" && (
                            <span className="text-xs text-slate-400 italic px-2 py-1">Chưa nộp</span>
                          )}

                          <button
                            onClick={() => handleDelete(id)}
                            disabled={busyId === id}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60 cursor-pointer transition-colors"
                            title="Xóa bài viết"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Xem chi tiết bài viết (Preview Modal) */}
      {previewPost && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setPreviewPost(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    postStatus(previewPost) === "active"
                      ? "bg-emerald-100 text-emerald-700"
                      : postStatus(previewPost) === "inactive"
                      ? "bg-rose-100 text-rose-700"
                      : postStatus(previewPost) === "pending"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {postStatus(previewPost) === "active"
                    ? "Đã duyệt"
                    : postStatus(previewPost) === "inactive"
                    ? "Từ chối"
                    : postStatus(previewPost) === "pending"
                    ? "Chờ duyệt"
                    : "Bản nháp"}
                </span>
                <span className="text-xs text-slate-500 font-mono">ID: #{postId(previewPost)}</span>
              </div>
              <button
                onClick={() => setPreviewPost(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
              {/* Meta information */}
              <div>
                <h2 className="text-2xl font-bold text-slate-900 leading-tight mb-3">
                  {postTitle(previewPost)}
                </h2>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pb-4 border-b border-slate-100">
                  <span className="inline-flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    Tác giả: <strong className="text-slate-700 font-semibold">{authorName(previewPost)}</strong>
                  </span>
                  {previewPost.pCreated_at && (
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Ngày tạo: {new Date(previewPost.pCreated_at).toLocaleDateString("vi-VN")}
                    </span>
                  )}
                  {previewPost.pType && (
                    <span className="inline-flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-slate-400" />
                      Thể loại: <span className="font-medium text-blue-600">{previewPost.pType}</span>
                    </span>
                  )}
                  {previewPost.category?.caName && (
                    <span className="inline-flex items-center gap-1.5">
                      Danh mục: <span className="font-medium text-slate-700">{previewPost.category.caName}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Reject reason alert if exists */}
              {postStatus(previewPost) === "inactive" && previewPost.pReject_reason && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
                  <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-semibold block mb-0.5">Lý do từ chối:</strong>
                    <p className="text-rose-700">{previewPost.pReject_reason}</p>
                  </div>
                </div>
              )}

              {/* Thumbnail */}
              {previewPost.pThumbnail && (
                <div className="rounded-xl overflow-hidden border border-slate-100 max-h-72 w-full bg-slate-50">
                  <img
                    src={previewPost.pThumbnail}
                    alt={postTitle(previewPost)}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Content Body */}
              <div
                className="prose prose-slate max-w-none text-slate-800 leading-relaxed text-sm sm:text-base"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewPost.pContent) || "<p class='italic text-slate-400'>Không có nội dung.</p>" }}
              />
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => setPreviewPost(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Đóng
              </button>
              <div className="flex items-center gap-2">
                {postStatus(previewPost) !== "inactive" && (
                  <button
                    onClick={() => handleReject(postId(previewPost))}
                    disabled={busyId === postId(previewPost)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-rose-700 bg-rose-100 rounded-xl hover:bg-rose-200 transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <XCircle className="w-4 h-4" />
                    {postStatus(previewPost) === "active" ? "Gỡ bài xuống" : "Từ chối bài"}
                  </button>
                )}
                {postStatus(previewPost) === "pending" && (
                  <button
                    onClick={() => handleApprove(postId(previewPost))}
                    disabled={busyId === postId(previewPost)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors cursor-pointer shadow-sm disabled:opacity-60"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Phê duyệt bài viết
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nhập lý do từ chối */}
      <RejectReasonModal
        open={!!rejectTarget}
        title="Từ chối bài viết"
        subject={rejectTarget ? postTitle(rejectTarget) : ""}
        busy={busyId === (rejectTarget ? postId(rejectTarget) : 0)}
        onCancel={() => setRejectTarget(null)}
        onConfirm={submitReject}
      />

      {/* Toast thông báo */}
      {actionMsg && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg transition-all ${
            actionMsg.type === "ok"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {actionMsg.text}
        </div>
      )}
    </div>
  );
}


