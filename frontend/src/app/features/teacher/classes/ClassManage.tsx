import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  Plus, Users, School, AlertCircle, Trash2, Pencil, ArrowRightLeft,
  Loader2, GraduationCap, Layers, UserCog, Check, X,
} from "lucide-react";
import { classMgmtApi, ClassItem, CoTeacherInvitation } from "../../../../services/classMgmtApi";
import { useToastContext } from "../../../../contexts/ToastContext";
import {
  ageMeta, CapacityBar, Modal, Field, CardSkeleton,
  inputClass, btnPrimary, btnGhost,
} from "./classMgmtUi";

interface FormState {
  cId?: number;
  name: string;
  age_group: string;
  max_students: number;
  description: string;
}

const EMPTY_FORM: FormState = { name: "", age_group: "teens", max_students: 30, description: "" };

export function ClassManage() {
  const navigate = useNavigate();
  const toast = useToastContext();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [invites, setInvites] = useState<CoTeacherInvitation[]>([]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, invRes] = await Promise.all([
        classMgmtApi.list(),
        classMgmtApi.myCoTeacherInvitations().catch(() => ({ data: [] })),
      ]);
      setClasses(res.data || []);
      setInvites(invRes?.data || []);
    } catch {
      setError("Không thể tải danh sách lớp. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const respondInvite = async (inv: CoTeacherInvitation, action: "accept" | "decline") => {
    try {
      await classMgmtApi.respondCoTeacherInvitation(inv.id, action);
      toast.success(action === "accept" ? "Đã nhận cùng quản lý lớp." : "Đã từ chối lời mời.");
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Không thực hiện được.");
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(EMPTY_FORM); setModalOpen(true); };
  const openEdit = (c: ClassItem) => {
    setForm({ cId: c.cId, name: c.cName, age_group: c.age_group, max_students: c.max_students, description: c.cDescription || "" });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Vui lòng nhập tên lớp."); return; }
    setSaving(true);
    try {
      const payload = { name: form.name, age_group: form.age_group, max_students: form.max_students, description: form.description };
      if (form.cId) {
        await classMgmtApi.update(form.cId, payload);
        toast.success("Đã cập nhật lớp.");
      } else {
        await classMgmtApi.create(payload);
        toast.success("Đã tạo lớp.");
      }
      setModalOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Thao tác thất bại.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: ClassItem) => {
    const hasStudents = c.current_student_count > 0;
    const msg = hasStudents
      ? `Lớp "${c.cName}" còn ${c.current_student_count} học viên. Xóa lớp sẽ gỡ tất cả học viên khỏi lớp. Tiếp tục?`
      : `Xóa lớp "${c.cName}"?`;
    if (!window.confirm(msg)) return;
    try {
      await classMgmtApi.remove(c.cId, hasStudents);
      toast.success("Đã xóa lớp.");
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Không thể xóa lớp.");
    }
  };

  // ── Header (shared across states) ───────────────────────────
  const Header = (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#111827] tracking-tight">Lớp học của tôi</h1>
        <p className="text-[#6B7280] text-sm mt-1">Quản lý lớp, học viên, giao đề, thông báo và mục tiêu</p>
      </div>
      <button onClick={openCreate} className={`${btnPrimary} px-5 py-3`}>
        <Plus className="w-5 h-5" /> Tạo lớp mới
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className="p-6 sm:p-8 min-h-screen bg-[#F9FAFB]">
        {Header}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 min-h-screen flex items-center justify-center bg-[#F9FAFB]">
        <div className="text-center bg-white rounded-2xl p-8 border border-red-100 shadow-sm cm-rise">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="text-red-600 font-semibold mb-4">{error}</p>
          <button onClick={load} className={`${btnPrimary} mx-auto`}>Thử lại</button>
        </div>
      </div>
    );
  }

  const totalStudents = classes.reduce((s, c) => s + (c.current_student_count || 0), 0);
  const pendingHandover = classes.filter((c) => c.has_pending_handover).length;

  return (
    <div className="p-6 sm:p-8 min-h-screen bg-[#F9FAFB]">
      {Header}

      {invites.length > 0 && (
        <div className="mb-6 space-y-3">
          {invites.map((inv) => {
            const m = ageMeta(inv.class.age_group || "");
            return (
              <div key={inv.id} className="bg-white rounded-2xl border border-teal-200 ring-1 ring-teal-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cm-rise">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 ring-1 ring-teal-100 flex items-center justify-center shrink-0">
                    <UserCog className="w-5 h-5 text-[#0D9488]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-[#374151]">
                      <span className="font-semibold text-[#111827]">{inv.invited_by || "Một giáo viên"}</span> mời bạn cùng quản lý lớp{" "}
                      <span className="font-semibold text-[#111827]">{inv.class.cName}</span>
                      <span className={`ml-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${m.pill}`}>{m.label}</span>
                    </p>
                    {inv.message && <p className="text-xs text-[#6B7280] mt-1 italic">"{inv.message}"</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => respondInvite(inv, "decline")} className={`${btnGhost} px-3 py-2`}>
                    <X className="w-4 h-4" /> Từ chối
                  </button>
                  <button onClick={() => respondInvite(inv, "accept")} className={`${btnPrimary} px-3 py-2`}>
                    <Check className="w-4 h-4" /> Chấp nhận
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {classes.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-200 cm-rise">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-50 rounded-full mb-4 ring-1 ring-teal-100">
            <School className="w-8 h-8 text-[#0D9488]" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Bạn chưa có lớp học nào</h3>
          <p className="text-gray-600 mb-6 max-w-sm mx-auto">Tạo lớp đầu tiên để bắt đầu tổ chức học viên, giao đề và theo dõi mục tiêu.</p>
          <button onClick={openCreate} className={`${btnPrimary} mx-auto px-6 py-3`}>
            <Plus className="w-5 h-5" /> Tạo lớp đầu tiên
          </button>
        </div>
      ) : (
        <>
          {/* Quiet stat strip */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-7">
            <StatTile icon={Layers} label="Lớp đang dạy" value={classes.length} />
            <StatTile icon={GraduationCap} label="Tổng học viên" value={totalStudents} />
            <StatTile
              icon={ArrowRightLeft}
              label="Chờ bàn giao"
              value={pendingHandover}
              accent={pendingHandover > 0 ? "amber" : "neutral"}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {classes.map((c, i) => {
              const meta = ageMeta(c.age_group);
              return (
                <div
                  key={c.cId}
                  className="group bg-white rounded-2xl p-6 border border-[#E5E7EB] hover:border-teal-200 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-300 cm-rise"
                  style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="text-lg font-bold text-[#111827] leading-snug">{c.cName}</h3>
                    <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${meta.pill}`}>
                      {meta.label}
                    </span>
                  </div>

                  {c.has_pending_handover && (
                    <span className="inline-flex items-center gap-1.5 mb-3 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 cm-dot-pulse" /> Chờ bàn giao
                    </span>
                  )}
                  {c.is_owner === false && (
                    <span className="inline-flex items-center gap-1.5 mb-3 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-[#0F766E] ring-1 ring-teal-200">
                      <UserCog className="w-3 h-3" /> Đồng quản lý
                    </span>
                  )}

                  {c.cDescription && <p className="text-sm text-[#6B7280] mb-4 line-clamp-2">{c.cDescription}</p>}

                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="inline-flex items-center gap-1.5 text-[#374151]">
                        <Users className="w-4 h-4 text-[#0D9488]" /> Sĩ số
                      </span>
                      <span className="font-semibold text-[#111827] tabular-nums">
                        {c.current_student_count}<span className="text-gray-400 font-normal">/{c.max_students}</span>
                      </span>
                    </div>
                    <CapacityBar current={c.current_student_count} max={c.max_students} />
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <button
                      onClick={() => navigate(`/giao-vien/lop-hoc/${c.cId}`)}
                      className="px-4 py-2 bg-[#0D9488] text-white rounded-lg text-sm font-semibold hover:bg-[#0F766E] active:scale-[0.98] transition-all"
                    >
                      Quản lý lớp
                    </button>
                    <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      {c.is_owner !== false ? (
                        <>
                          <button onClick={() => openEdit(c)} aria-label="Sửa lớp" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                            <Pencil className="w-4 h-4 text-[#6B7280]" />
                          </button>
                          <button onClick={() => remove(c)} aria-label="Xóa lớp" className="p-2 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-[#9CA3AF]">
                          <UserCog className="w-3.5 h-3.5" /> Cộng sự
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.cId ? "Sửa lớp" : "Tạo lớp mới"}
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className={`${btnGhost} flex-1`}>Hủy</button>
            <button onClick={save} disabled={saving} className={`${btnPrimary} flex-1`}>
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Lưu
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Tên lớp *">
            <input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="VD: Lớp VSTEP B2 - Tối T2,4,6" className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Độ tuổi">
              <select value={form.age_group} onChange={(e) => setForm({ ...form, age_group: e.target.value })} className={inputClass}>
                <option value="kids">Kids</option>
                <option value="teens">Teens</option>
                <option value="adults">Adults</option>
              </select>
            </Field>
            <Field label="Sĩ số tối đa">
              <input type="number" min={1} max={100} value={form.max_students}
                onChange={(e) => setForm({ ...form, max_students: Number(e.target.value) })} className={inputClass} />
            </Field>
          </div>
          <Field label="Mô tả" hint="Không bắt buộc — ghi chú lịch học, mục tiêu chung của lớp.">
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3} className={`${inputClass} resize-none`} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, accent = "neutral" }: { icon: any; label: string; value: number; accent?: "neutral" | "amber" }) {
  const tint = accent === "amber"
    ? "bg-amber-50 text-amber-600 ring-amber-100"
    : "bg-teal-50 text-[#0D9488] ring-teal-100";
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 flex items-center gap-3 cm-rise">
      <div className={`hidden sm:flex w-10 h-10 rounded-xl items-center justify-center ring-1 ${tint}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-[#111827] leading-none tabular-nums">{value}</p>
        <p className="text-xs text-[#6B7280] mt-1">{label}</p>
      </div>
    </div>
  );
}

export default ClassManage;
