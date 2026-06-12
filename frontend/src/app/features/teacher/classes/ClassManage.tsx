import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Plus, Users, School, Loader2, AlertCircle, Trash2, Pencil, ArrowRightLeft, X } from "lucide-react";
import { classMgmtApi, ClassItem } from "../../../../services/classMgmtApi";
import { useToastContext } from "../../../../contexts/ToastContext";

const AGE_LABEL: Record<string, string> = { kids: "Kids", teens: "Teens", adults: "Adults" };
const AGE_COLOR: Record<string, string> = { kids: "#F59E0B", teens: "#0D9488", adults: "#7C3AED" };

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

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await classMgmtApi.list();
      setClasses(res.data || []);
    } catch (e: any) {
      setError("Không thể tải danh sách lớp. Vui lòng thử lại.");
    } finally {
      setLoading(false);
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
      if (form.cId) {
        await classMgmtApi.update(form.cId, {
          name: form.name, age_group: form.age_group, max_students: form.max_students, description: form.description,
        });
        toast.success("Đã cập nhật lớp.");
      } else {
        await classMgmtApi.create({
          name: form.name, age_group: form.age_group, max_students: form.max_students, description: form.description,
        });
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

  if (loading) {
    return (
      <div className="p-8 min-h-screen flex items-center justify-center bg-[#F9FAFB]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-[#0D9488] animate-spin mx-auto mb-3" />
          <p className="text-gray-600">Đang tải lớp học...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 min-h-screen flex items-center justify-center bg-[#F9FAFB]">
        <div className="text-center bg-white rounded-2xl p-8 border border-red-200">
          <AlertCircle className="w-10 h-10 text-red-600 mx-auto mb-3" />
          <p className="text-red-600 font-semibold mb-4">{error}</p>
          <button onClick={load} className="px-6 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700">Thử lại</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 min-h-screen bg-[#F9FAFB]">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#111827]">Lớp học của tôi</h1>
          <p className="text-[#6B7280] text-sm mt-1">Quản lý lớp, học viên, giao đề, thông báo và mục tiêu</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-5 py-3 bg-[#0D9488] text-white rounded-xl hover:bg-[#0F766E] font-bold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0D9488]"
        >
          <Plus className="w-5 h-5" /> Tạo lớp mới
        </button>
      </div>

      {classes.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
            <School className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Bạn chưa có lớp học nào.</h3>
          <p className="text-gray-600 mb-6">Tạo lớp đầu tiên để bắt đầu tổ chức học viên.</p>
          <button onClick={openCreate} className="inline-flex items-center gap-2 px-6 py-3 bg-[#0D9488] text-white font-semibold rounded-xl hover:bg-[#0F766E]">
            <Plus className="w-5 h-5" /> Tạo lớp đầu tiên
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {classes.map((c) => (
            <div key={c.cId} className="bg-white rounded-2xl p-6 border border-[#E5E7EB] hover:shadow-lg transition-all">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-bold text-[#111827]">{c.cName}</h3>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: AGE_COLOR[c.age_group] }}>
                  {AGE_LABEL[c.age_group] || c.age_group}
                </span>
              </div>
              {c.has_pending_handover && (
                <span className="inline-flex items-center gap-1 mb-3 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                  <ArrowRightLeft className="w-3 h-3" /> Chờ bàn giao
                </span>
              )}
              {c.cDescription && <p className="text-sm text-[#6B7280] mb-3 line-clamp-2">{c.cDescription}</p>}
              <div className="flex items-center gap-2 text-sm text-[#374151] mb-4">
                <Users className="w-4 h-4 text-[#0D9488]" />
                <span className="font-semibold">{c.current_student_count}/{c.max_students}</span> học viên
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-[#E5E7EB]">
                <button
                  onClick={() => navigate(`/giao-vien/lop-hoc/${c.cId}`)}
                  className="px-4 py-2 bg-[#0D9488] text-white rounded-lg text-sm font-semibold hover:bg-[#0F766E]"
                >
                  Quản lý
                </button>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(c)} aria-label="Sửa lớp" className="p-2 hover:bg-gray-100 rounded-lg">
                    <Pencil className="w-4 h-4 text-[#6B7280]" />
                  </button>
                  <button onClick={() => remove(c)} aria-label="Xóa lớp" className="p-2 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onKeyDown={(e) => e.key === "Escape" && setModalOpen(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#111827]">{form.cId ? "Sửa lớp" : "Tạo lớp mới"}</h2>
              <button onClick={() => setModalOpen(false)} aria-label="Đóng" className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">Tên lớp *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D9488]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">Độ tuổi</label>
                <select value={form.age_group} onChange={(e) => setForm({ ...form, age_group: e.target.value })}
                  className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D9488]">
                  <option value="kids">Kids</option>
                  <option value="teens">Teens</option>
                  <option value="adults">Adults</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">Sĩ số tối đa</label>
                <input type="number" min={1} max={100} value={form.max_students}
                  onChange={(e) => setForm({ ...form, max_students: Number(e.target.value) })}
                  className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D9488]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">Mô tả</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3} className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D9488]" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2.5 border border-[#E5E7EB] rounded-xl font-semibold hover:bg-gray-50">Hủy</button>
              <button onClick={save} disabled={saving} className="flex-1 px-4 py-2.5 bg-[#0D9488] text-white rounded-xl font-semibold hover:bg-[#0F766E] disabled:opacity-60 flex items-center justify-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Lưu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClassManage;
