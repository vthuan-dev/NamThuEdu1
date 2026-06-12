import { useEffect, useMemo, useRef, useState } from "react";
import {
  X, Search, CalendarClock, CalendarCheck, Bell, Send, Loader2,
  Check, Users, FileText, MessageSquare, RotateCcw, ChevronRight,
  MapPin, Mail, Phone, CalendarDays, GraduationCap, UserRound, Globe,
} from "lucide-react";
import { api } from "../../../../services/api";
import { getAssetUrl } from "../../../../utils/apiConfig";
import { useToastContext } from "../../../../contexts/ToastContext";

/** Đề được chọn để giao (rút gọn từ Ngân hàng đề). */
export interface AssignExam {
  eId: number;
  eTitle: string;
  eType?: string;
  /** Nhóm tuổi đề nhắm tới: kids | teens | adults | all. Quy tắc: chỉ giao
   *  cho học viên cùng nhóm. 'all' = giao cho mọi nhóm. */
  ageGroup?: string;
}

interface StudentItem {
  id: string;
  name: string;
  phone?: string;
  className?: string;
  avatarUrl?: string | null;
  ageGroup?: string | null;
  email?: string | null;
  address?: string | null;
  createdAt?: string | null;
}

/** Lớp mà giáo viên đang quản lý (chủ lớp hoặc đồng quản lý). */
interface ClassItem {
  id: string;
  name: string;
  studentCount: number;
  ageGroup?: string | null;
  isOwner?: boolean;
}

/** Chế độ giao: theo lớp · từng cá nhân · tất cả học viên. */
type AssignMode = "class" | "student" | "all";

interface AssignModalProps {
  open: boolean;
  exams: AssignExam[];
  onClose: () => void;
  onAssigned: () => void;
}

const NOTIFY_PRESETS = [
  { value: 0, label: "Không" },
  { value: 15, label: "15 phút" },
  { value: 30, label: "30 phút" },
  { value: 60, label: "1 giờ" },
  { value: 1440, label: "1 ngày" },
];

const ATTEMPT_PRESETS = [1, 2, 3, 5];

const AGE_GROUP_LABEL: Record<string, string> = {
  kids: "Trẻ em",
  teens: "Thiếu niên",
  adults: "Người lớn",
};

function initials(name: string) {
  const w = name.trim().split(/\s+/);
  return (w.length >= 2 ? w[w.length - 1] : w[0]).substring(0, 2).toUpperCase();
}

/**
 * AssignModal — Giao 1 hoặc nhiều đề cho học viên (không còn khái niệm lớp).
 * Thiết kế trung tính, tối giản: slate/white, 1 accent indigo cho hành động chính.
 * Layout 2 cột: trái = chọn học viên, phải = cấu hình lịch & tuỳ chọn.
 */
export function AssignModal({ open, exams, onClose, onAssigned }: AssignModalProps) {
  const toast = useToastContext();

  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Chế độ giao + danh sách lớp giáo viên quản lý
  const [mode, setMode] = useState<AssignMode>("class");
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [selectedClasses, setSelectedClasses] = useState<Set<string>>(new Set());

  const [startTime, setStartTime] = useState("");
  const [deadline, setDeadline] = useState("");
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [notifyBefore, setNotifyBefore] = useState(30);
  const [instructions, setInstructions] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Hover card kiểu Facebook: hiển thị thông tin học viên khi rê vào avatar.
  const [hovered, setHovered] = useState<{ student: StudentItem; x: number; y: number } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showCard = (student: StudentItem, el: HTMLElement) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      const r = el.getBoundingClientRect();
      // Đặt thẻ bên TRÁI avatar (card rộng ~256px).
      setHovered({ student, x: r.left - 256 - 12, y: r.top });
    }, 220);
  };
  const hideCard = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setHovered(null);
  };

  useEffect(() => {
    if (!open) return;
    setLoadingStudents(true);
    api.get("/teacher/students?paginate=false")
      .then((res: any) => {
        const raw = res?.data?.data;
        const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
        setStudents(arr.map((s: any) => ({
          id: String(s.uId ?? s.id),
          name: s.uName ?? s.name ?? "—",
          phone: s.uPhone ?? s.phone,
          className: s.class_name ?? s.className,
          avatarUrl: s.avatar_url ?? s.avatarUrl ?? null,
          ageGroup: s.age_group ?? s.ageGroup ?? null,
          email: s.uEmail ?? s.email ?? null,
          address: s.uAddress ?? s.address ?? null,
          createdAt: s.uCreated_at ?? s.createdAt ?? null,
        })));
      })
      .catch(() => setStudents([]))
      .finally(() => setLoadingStudents(false));
  }, [open]);

  // Lấy danh sách lớp giáo viên đang quản lý (chủ lớp + đồng quản lý)
  useEffect(() => {
    if (!open) return;
    setLoadingClasses(true);
    api.get("/teacher/classes")
      .then((res: any) => {
        const raw = res?.data?.data ?? res?.data ?? [];
        const arr = Array.isArray(raw) ? raw : [];
        setClasses(arr.map((c: any) => ({
          id: String(c.cId ?? c.id),
          name: c.cName ?? c.name ?? "Lớp",
          studentCount: c.current_student_count ?? c.student_count ?? 0,
          ageGroup: c.age_group ?? null,
          isOwner: c.is_owner ?? true,
        })));
      })
      .catch(() => setClasses([]))
      .finally(() => setLoadingClasses(false));
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSelected(new Set());
      setSelectedClasses(new Set());
      setMode("class");
      setSearch("");
      setStartTime("");
      setDeadline("");
      setMaxAttempts(1);
      setNotifyBefore(30);
      setInstructions("");
    }
  }, [open]);

  // Nhóm tuổi bắt buộc theo đề được giao. Nếu mọi đề cùng 1 nhóm cụ thể
  // (kids/teens/adults) → chỉ học viên nhóm đó. Nếu đề 'all' hoặc trộn nhiều
  // nhóm khác nhau → không ép (giao cho mọi học viên).
  const requiredAgeGroup = useMemo(() => {
    const groups = new Set(
      exams
        .map((e) => e.ageGroup)
        .filter((g): g is string => !!g && g !== "all"),
    );
    return groups.size === 1 ? [...groups][0] : null;
  }, [exams]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return students.filter((s) => {
      const matchSearch =
        s.name.toLowerCase().includes(q) || (s.phone ?? "").includes(q);
      // Quy tắc nhóm tuổi: học viên có age_group khác nhóm đề → ẩn.
      // Học viên chưa set age_group (null) vẫn cho hiện (linh hoạt, không chặn cứng).
      const matchGroup =
        !requiredAgeGroup || !s.ageGroup || s.ageGroup === requiredAgeGroup;
      return matchSearch && matchGroup;
    });
  }, [students, search, requiredAgeGroup]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((s) => selected.has(s.id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filtered.forEach((s) => next.delete(s.id));
      else filtered.forEach((s) => next.add(s.id));
      return next;
    });

  // ── Lớp: lọc theo nhóm tuổi đề + toggle chọn ──
  const filteredClasses = useMemo(() => {
    const q = search.toLowerCase();
    return classes.filter((c) => {
      if ((c.studentCount || 0) <= 0) return false; // ẩn lớp chưa có học viên
      const matchSearch = c.name.toLowerCase().includes(q);
      const matchGroup = !requiredAgeGroup || !c.ageGroup || c.ageGroup === requiredAgeGroup;
      return matchSearch && matchGroup;
    });
  }, [classes, search, requiredAgeGroup]);

  const allClassesSelected = filteredClasses.length > 0 && filteredClasses.every((c) => selectedClasses.has(c.id));

  const toggleClass = (id: string) =>
    setSelectedClasses((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAllClasses = () =>
    setSelectedClasses((prev) => {
      const next = new Set(prev);
      if (allClassesSelected) filteredClasses.forEach((c) => next.delete(c.id));
      else filteredClasses.forEach((c) => next.add(c.id));
      return next;
    });

  // Số học viên ước tính theo chế độ (hiển thị ở footer)
  const targetSummary = useMemo(() => {
    if (mode === "class") {
      const count = filteredClasses
        .filter((c) => selectedClasses.has(c.id))
        .reduce((s, c) => s + (c.studentCount || 0), 0);
      return { units: selectedClasses.size, students: count };
    }
    if (mode === "all") {
      return { units: filtered.length, students: filtered.length };
    }
    return { units: selected.size, students: selected.size };
  }, [mode, filteredClasses, selectedClasses, filtered, selected]);

  const hasTarget =
    mode === "class" ? selectedClasses.size > 0
      : mode === "all" ? filtered.length > 0
      : selected.size > 0;
  const canSubmit = exams.length > 0 && hasTarget && !!deadline && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);

    // Xác định targets theo chế độ giao
    let targets: { type: "class" | "student"; id: number }[] = [];
    if (mode === "class") {
      targets = Array.from(selectedClasses).map((id) => ({ type: "class" as const, id: Number(id) }));
    } else if (mode === "all") {
      targets = filtered.map((s) => ({ type: "student" as const, id: Number(s.id) }));
    } else {
      targets = Array.from(selected).map((id) => ({ type: "student" as const, id: Number(id) }));
    }

    const payload: Record<string, unknown> = {
      targets,
      taDeadline: deadline,
      taStart_time: startTime || null,
      taNotify_before_minutes: notifyBefore || null,
      taInstructions: instructions || null,
      taMax_attempt: maxAttempts,
    };

    let ok = 0;
    let fail = 0;
    for (const exam of exams) {
      try {
        await api.post("/teacher/assignments/bulk", { ...payload, exam_id: exam.eId });
        ok++;
      } catch {
        fail++;
      }
    }

    setSubmitting(false);
    if (ok > 0) {
      const targetLabel =
        mode === "class" ? `${selectedClasses.size} lớp`
          : `${targetSummary.students} học viên`;
      toast.success(
        `Đã giao ${ok} đề cho ${targetLabel}` + (fail ? ` (${fail} đề lỗi)` : ""),
      );
      onAssigned();
      onClose();
    } else {
      toast.error("Giao bài thất bại. Vui lòng thử lại.");
    }
  };

  if (!open) return null;

  const labelCls = "text-[13px] font-medium text-slate-700";
  const inputCls =
    "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300 transition-colors";

  const fmtJoined = (d?: string | null) => {
    if (!d) return null;
    const date = new Date(d);
    if (isNaN(date.getTime())) return null;
    return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "long", year: "numeric" });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-[2px] animate-fadeIn"
      onMouseDown={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl ring-1 ring-slate-200 w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col animate-slideUp"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header — nền indigo dịu, là điểm nhấn chính */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-indigo-100 bg-gradient-to-r from-indigo-50 to-slate-50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0 shadow-sm shadow-indigo-200 transition-transform duration-200 hover:scale-105">
              <Send className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-slate-900 leading-tight">Giao bài cho học viên</h2>
              <p className="text-xs text-slate-500 truncate">
                {exams.length === 1 ? exams[0].eTitle : `${exams.length} đề được chọn`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-white hover:text-slate-700 hover:rotate-90 transition-all duration-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body — 2 cột */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2">
          {/* Cột trái: chọn học viên — nền xám rất nhạt để tách khỏi cột cấu hình */}
          <div className="border-b md:border-b-0 md:border-r border-slate-200 flex flex-col min-h-[320px] bg-slate-50/50">
            <div className="px-5 pt-4 pb-3 space-y-3">
              {exams.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {exams.map((e) => (
                    <span key={e.eId} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[11px] font-medium ring-1 ring-indigo-100">
                      <FileText className="w-3 h-3" />{e.eTitle}
                    </span>
                  ))}
                </div>
              )}

              {/* Tabs chọn chế độ giao */}
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
                {([
                  { key: "class", label: "Lớp học", icon: GraduationCap },
                  { key: "student", label: "Cá nhân", icon: UserRound },
                  { key: "all", label: "Tất cả", icon: Globe },
                ] as const).map((t) => {
                  const active = mode === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setMode(t.key)}
                      className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[12.5px] font-medium transition-all duration-150 ${
                        active ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      <t.icon className="w-3.5 h-3.5" /> {t.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between">
                <span className={labelCls}>
                  {mode === "class" ? "Lớp học của tôi" : mode === "all" ? "Tất cả học viên" : "Học viên"}
                  {mode === "class" && selectedClasses.size > 0 && (
                    <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[11px] font-semibold">
                      {selectedClasses.size}
                    </span>
                  )}
                  {mode === "student" && selected.size > 0 && (
                    <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[11px] font-semibold">
                      {selected.size}
                    </span>
                  )}
                </span>
                {mode === "class" && filteredClasses.length > 0 && (
                  <button onClick={toggleAllClasses} className="text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline transition-colors">
                    {allClassesSelected ? "Bỏ chọn" : "Chọn tất cả"}
                  </button>
                )}
                {mode === "student" && filtered.length > 0 && (
                  <button onClick={toggleAll} className="text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline transition-colors">
                    {allFilteredSelected ? "Bỏ chọn" : "Chọn tất cả"}
                  </button>
                )}
              </div>

              {requiredAgeGroup && (
                <p className="text-[11px] text-slate-500 bg-amber-50 border border-amber-100 rounded-md px-2 py-1.5">
                  Chỉ hiển thị {mode === "class" ? "lớp" : "học viên"} nhóm{" "}
                  <span className="font-semibold text-amber-700">{AGE_GROUP_LABEL[requiredAgeGroup] ?? requiredAgeGroup}</span>{" "}
                  — đúng nhóm tuổi của đề.
                </p>
              )}

              {mode !== "all" && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder={mode === "class" ? "Tìm lớp..." : "Tìm theo tên hoặc SĐT..."}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={`${inputCls} pl-9`}
                  />
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-2">
              {/* ── Chế độ LỚP HỌC: chọn lớp mình quản lý ── */}
              {mode === "class" && (
                loadingClasses ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
                  </div>
                ) : filteredClasses.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                    <GraduationCap className="w-8 h-8 text-slate-200 mb-2" />
                    <p className="text-sm text-slate-400">
                      Chưa có lớp nào{requiredAgeGroup ? " phù hợp nhóm tuổi của đề" : ""}.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {filteredClasses.map((c) => {
                      const sel = selectedClasses.has(c.id);
                      return (
                        <button
                          key={c.id}
                          onClick={() => toggleClass(c.id)}
                          className={`group w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all duration-200 ${sel ? "bg-white ring-1 ring-indigo-200 shadow-sm" : "hover:bg-white hover:shadow-sm"}`}
                        >
                          <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${sel ? "bg-indigo-600 border-indigo-600" : "border-slate-300 bg-white group-hover:border-indigo-400"}`}>
                            <Check className={`w-3 h-3 text-white transition-opacity ${sel ? "opacity-100" : "opacity-0"}`} strokeWidth={3} />
                          </span>
                          <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                            <GraduationCap className="w-4 h-4" />
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className={`block text-sm font-medium truncate ${sel ? "text-indigo-700" : "text-slate-800"}`}>{c.name}</span>
                            <span className="block text-xs text-slate-400">
                              {c.studentCount} học viên{!c.isOwner ? " · Đồng quản lý" : ""}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )
              )}

              {/* ── Chế độ TẤT CẢ: giao cho toàn bộ học viên phù hợp ── */}
              {mode === "all" && (
                loadingStudents ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
                  </div>
                ) : (
                  <div className="px-3 py-4">
                    <div className="rounded-xl bg-white ring-1 ring-indigo-100 p-4 flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <Globe className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800">Giao cho tất cả học viên</p>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                          <span className="font-semibold text-indigo-600">{filtered.length}</span> học viên
                          {requiredAgeGroup ? ` thuộc nhóm ${AGE_GROUP_LABEL[requiredAgeGroup] ?? requiredAgeGroup}` : ""} sẽ nhận đề này.
                        </p>
                      </div>
                    </div>
                  </div>
                )
              )}

              {/* ── Chế độ CÁ NHÂN: chọn từng học viên ── */}
              {mode === "student" && (loadingStudents ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="w-8 h-8 text-slate-200 mb-2" />
                  <p className="text-sm text-slate-400">Không tìm thấy học viên</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {filtered.map((s) => {
                    const sel = selected.has(s.id);
                    return (
                      <button
                        key={s.id}
                        onClick={() => toggle(s.id)}
                        className={`group w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all duration-200 ease-out hover:translate-x-0.5 active:scale-[0.99] ${
                          sel
                            ? "bg-white ring-1 ring-indigo-200 shadow-sm"
                            : "hover:bg-white hover:shadow-sm"
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all duration-200 ${
                            sel
                              ? "bg-indigo-600 border-indigo-600 scale-110"
                              : "border-slate-300 bg-white group-hover:border-indigo-400"
                          }`}
                        >
                          <Check
                            className={`w-3 h-3 text-white transition-all duration-200 ${
                              sel ? "scale-100 opacity-100" : "scale-50 opacity-0 group-hover:text-indigo-300 group-hover:opacity-40 group-hover:scale-100"
                            }`}
                            strokeWidth={3}
                          />
                        </span>
                        <span
                          onMouseEnter={(e) => showCard(s, e.currentTarget)}
                          onMouseLeave={hideCard}
                          className={`w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-[10px] font-semibold shrink-0 transition-all duration-200 group-hover:scale-105 ${
                          sel ? "bg-indigo-100 text-indigo-700 ring-2 ring-indigo-300" : "bg-slate-200 text-slate-600 group-hover:ring-2 group-hover:ring-slate-200"
                        }`}>
                          {s.avatarUrl ? (
                            <img
                              src={getAssetUrl(s.avatarUrl)}
                              alt={s.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = "none";
                                const sib = e.currentTarget.nextElementSibling as HTMLElement | null;
                                if (sib) sib.style.display = "flex";
                              }}
                            />
                          ) : null}
                          <span
                            className="w-full h-full items-center justify-center"
                            style={{ display: s.avatarUrl ? "none" : "flex" }}
                          >
                            {initials(s.name)}
                          </span>
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className={`block text-sm font-medium truncate transition-colors duration-200 ${sel ? "text-indigo-700" : "text-slate-800 group-hover:text-indigo-600"}`}>
                            {s.name}
                          </span>
                          {(s.phone || s.className) && (
                            <span className="block text-xs text-slate-400 truncate">
                              {[s.phone, s.className].filter(Boolean).join(" · ")}
                            </span>
                          )}
                        </span>
                        <ChevronRight
                          className={`w-4 h-4 shrink-0 text-slate-300 transition-all duration-200 ${
                            sel ? "opacity-0 -translate-x-1" : "opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-indigo-400"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Cột phải: cấu hình */}
          <div className="px-5 py-4 space-y-4">
            {/* Lịch — card nền xám nhạt. Đây là KHOẢNG thời gian học viên được làm đề:
                mở từ lúc nào (tuỳ chọn) → hạn chót phải hoàn thành. */}
            <div className="rounded-lg bg-slate-50 ring-1 ring-slate-100 p-3.5 space-y-3">
              <div className="space-y-1.5">
                <label className={`${labelCls} flex items-center gap-1.5`}>
                  <CalendarClock className="w-3.5 h-3.5 text-indigo-500" /> Mở làm bài
                  <span className="text-slate-400 font-normal">· tuỳ chọn</span>
                </label>
                <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
                <p className="text-[11px] text-slate-400">Để trống = học viên làm được ngay.</p>
              </div>
              <div className="space-y-1.5">
                <label className={`${labelCls} flex items-center gap-1.5`}>
                  <CalendarCheck className="w-3.5 h-3.5 text-indigo-500" /> Hạn chót
                  <span className="text-rose-500 font-normal">*</span>
                </label>
                <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputCls} />
                <p className="text-[11px] text-slate-400">Sau thời điểm này, học viên không làm được đề nữa.</p>
              </div>
            </div>

            {/* Báo trước */}
            <div className="space-y-2">
              <label className={`${labelCls} flex items-center gap-1.5`}>
                <Bell className="w-3.5 h-3.5 text-indigo-500" /> Báo cho học viên trước
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {NOTIFY_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setNotifyBefore(p.value)}
                    className={`py-1.5 text-xs font-medium rounded-md border transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 ${
                      notifyBefore === p.value
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200"
                        : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-400">
                Theo mốc {startTime ? "mở làm bài" : "hạn chót"}. Gửi thông báo + push tự động.
              </p>
            </div>

            {/* Số lượt */}
            <div className="space-y-2">
              <label className={`${labelCls} flex items-center gap-1.5`}>
                <RotateCcw className="w-3.5 h-3.5 text-indigo-500" /> Số lượt làm tối đa
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {ATTEMPT_PRESETS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setMaxAttempts(n)}
                    className={`py-1.5 text-xs font-medium rounded-md border transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 ${
                      maxAttempts === n
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200"
                        : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
                    }`}
                  >
                    {n} lần
                  </button>
                ))}
              </div>
            </div>

            {/* Lời nhắn */}
            <div className="space-y-1.5">
              <label className={`${labelCls} flex items-center gap-1.5`}>
                <MessageSquare className="w-3.5 h-3.5 text-indigo-500" /> Lời nhắn
                <span className="text-slate-400 font-normal">· tuỳ chọn</span>
              </label>
              <textarea
                rows={2}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="VD: Làm nghiêm túc, không dùng tài liệu"
                className={`${inputCls} resize-none`}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          <p className="text-xs text-slate-500">
            <span className="font-semibold text-indigo-600">{exams.length}</span> đề ·{" "}
            {mode === "class" ? (
              <>
                <span className="font-semibold text-indigo-600">{targetSummary.units}</span> lớp
                {targetSummary.students > 0 && <span className="text-slate-400"> (~{targetSummary.students} học viên)</span>}
              </>
            ) : (
              <><span className="font-semibold text-indigo-600">{targetSummary.students}</span> học viên</>
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 rounded-lg hover:bg-slate-200/70 transition-colors"
            >
              Huỷ
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 hover:shadow-md hover:shadow-indigo-200 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0 flex items-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Giao bài
            </button>
          </div>
        </div>
      </div>

      {/* Hover card — thông tin học viên, tối giản, nằm bên trái avatar */}
      {hovered && (
        <div
          className="fixed z-[60] w-64 animate-fadeIn"
          style={{ left: Math.max(8, hovered.x), top: Math.min(hovered.y, window.innerHeight - 210) }}
          onMouseEnter={() => {
            if (hoverTimer.current) clearTimeout(hoverTimer.current);
          }}
          onMouseLeave={hideCard}
        >
          <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgba(15,23,42,0.12)] ring-1 ring-slate-100 p-4">
            {/* Header: avatar + tên */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center text-slate-500 font-semibold shrink-0 ring-1 ring-slate-200">
                {hovered.student.avatarUrl ? (
                  <img src={getAssetUrl(hovered.student.avatarUrl)} alt={hovered.student.name} className="w-full h-full object-cover" />
                ) : (
                  initials(hovered.student.name)
                )}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-900 leading-snug truncate">{hovered.student.name}</h3>
                {hovered.student.ageGroup && (
                  <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium">
                    {AGE_GROUP_LABEL[hovered.student.ageGroup] ?? hovered.student.ageGroup}
                  </span>
                )}
              </div>
            </div>

            {/* Thông tin */}
            <div className="mt-3 pt-3 border-t border-slate-100 space-y-2 text-[13px]">
              {hovered.student.phone && (
                <p className="flex items-center gap-2.5 text-slate-600">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {hovered.student.phone}
                </p>
              )}
              {hovered.student.email && (
                <p className="flex items-center gap-2.5 text-slate-600">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{hovered.student.email}</span>
                </p>
              )}
              {hovered.student.address && (
                <p className="flex items-center gap-2.5 text-slate-600">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{hovered.student.address}</span>
                </p>
              )}
              {fmtJoined(hovered.student.createdAt) && (
                <p className="flex items-center gap-2.5 text-slate-400">
                  <CalendarDays className="w-3.5 h-3.5 text-slate-400 shrink-0" /> Tham gia {fmtJoined(hovered.student.createdAt)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
