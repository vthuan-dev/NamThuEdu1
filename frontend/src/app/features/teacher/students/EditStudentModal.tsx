import { useState, useEffect, useRef } from "react";
import { getAuthToken } from '../../../../utils/authStorage';
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  X,
  Loader2,
  ChevronDown,
  Check,
  Baby,
  GraduationCap,
  Briefcase,
  CircleDot,
  CircleSlash,
} from "lucide-react";
import { getApiUrl, getAssetUrl } from "../../../../utils/apiConfig";
import { useToast } from "../../../../hooks/useToast";

// ─── Custom Select (listbox) — tinh tế hơn native, dùng lucide icon ─────────
type SelectOption = {
  value: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

function FieldSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const SelectedIcon = selected?.icon;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-2 px-3.5 py-2.5 text-[14px] border rounded-lg bg-white text-left transition-colors ${
          open
            ? 'border-orange-300 ring-2 ring-orange-200 outline-none'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        {SelectedIcon && <SelectedIcon className="w-4 h-4 text-slate-500 flex-shrink-0" />}
        <span className="flex-1 truncate text-slate-900">
          {selected?.label ?? <span className="text-slate-400">{placeholder ?? 'Chọn...'}</span>}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute z-20 mt-1.5 w-full bg-white rounded-lg border border-slate-200 shadow-lg shadow-slate-200/60 overflow-hidden py-1"
          >
            {options.map((o) => {
              const Icon = o.icon;
              const isActive = o.value === value;
              return (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className={`flex items-center gap-2.5 px-3 py-2 text-[13px] cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-orange-50 text-orange-700'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-orange-500' : 'text-slate-400'}`} />
                  <span className="flex-1">{o.label}</span>
                  {isActive && <Check className="w-3.5 h-3.5 text-orange-500" />}
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

interface EditStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: any;
  onSave: (updatedStudent: any) => void;
  toast?: {
    success: (message: string) => void;
    error: (message: string) => void;
    warning: (message: string) => void;
  };
}

/**
 * EditStudentModal — modal chỉnh sửa học viên.
 *
 * Thiết kế tối giản: header có accent line nhỏ, input gọn (h-9, font 13px),
 * focus ring orange-200 nhẹ, footer phẳng. Đồng bộ với AddStudent form.
 */
export function EditStudentModal({ isOpen, onClose, student, onSave, toast: toastProp }: EditStudentModalProps) {
  const { t } = useTranslation();
  const localToast = useToast();
  const toast = toastProp || {
    success: localToast.success,
    error: localToast.error,
    warning: localToast.warning,
  };

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    dateOfBirth: "",
    ageGroup: "teens",
    status: "active",
  });

  const [originalData, setOriginalData] = useState(formData);
  const [loading, setLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");

  const formatDateToInput = (dateString: string): string => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "";
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return "";
    }
  };

  useEffect(() => {
    if (!student) return;

    let dobFormatted = "";
    if (student.dateOfBirth) dobFormatted = formatDateToInput(student.dateOfBirth);
    else if (student.uDoB)   dobFormatted = formatDateToInput(student.uDoB);
    else if (student.createdAt) {
      const parts = student.createdAt.split("/");
      if (parts.length === 3) dobFormatted = formatDateToInput(`${parts[2]}-${parts[1]}-${parts[0]}`);
    }

    const initial = {
      name: student.name || "",
      phone: student.phone || "",
      email: student.email === "Chưa có" ? "" : (student.email || ""),
      dateOfBirth: dobFormatted,
      ageGroup: student.ageGroup || "teens",
      status: student.status || "active",
    };
    setFormData(initial);
    setOriginalData(initial);
    setAvatarPreview(student.avatarUrl ? getAssetUrl(student.avatarUrl) : "");
    setAvatarFile(null);
  }, [student]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      toast.error(t('teacher.students.editStudent.toast.invalidImage'));
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error(t('teacher.students.editStudent.toast.imageTooLarge'));
      return;
    }
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const hasAnyChange =
      formData.name !== originalData.name ||
      formData.phone !== originalData.phone ||
      formData.email !== originalData.email ||
      formData.dateOfBirth !== originalData.dateOfBirth ||
      formData.ageGroup !== originalData.ageGroup ||
      formData.status !== originalData.status ||
      avatarFile !== null;

    if (!hasAnyChange) {
      toast.warning(t('teacher.students.editStudent.toast.noChange', { name: student.name }));
      onClose();
      return;
    }

    setLoading(true);
    try {
      const token = getAuthToken();
      if (!token) {
        toast.error(t('teacher.students.editStudent.toast.loginRequired'));
        setLoading(false);
        return;
      }

      const fd = new FormData();
      fd.append('_method', 'PUT');
      fd.append('uName', formData.name);
      fd.append('uPhone', formData.phone);
      fd.append('uEmail', formData.email || '');
      fd.append('uDoB', formData.dateOfBirth);
      fd.append('age_group', formData.ageGroup);
      fd.append('uStatus', formData.status);
      if (avatarFile) fd.append('avatar', avatarFile);

      const response = await fetch(getApiUrl(`teacher/student/${student.id}`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      if (response.ok) {
        const result = await response.json();
        onSave(result.data);
        const { logTeacherActivity } = await import("../../../../services/teacherActivityLog");
        logTeacherActivity({
          action: "student.update",
          entity_type: "student",
          entity_id: student?.id ?? null,
          detail: `Cập nhật học viên: ${formData.name}`,
          meta: { age_group: formData.ageGroup, status: formData.status },
        });
        onClose();
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || t('teacher.students.editStudent.toast.updateError'));
      }
    } catch {
      toast.error(t('teacher.students.editStudent.toast.updateError'));
    } finally {
      setLoading(false);
    }
  };

  // ── Reusable styles (đồng bộ với AddStudent) ─────────────────────────────
  const inputCls = "w-full px-3.5 py-2.5 text-[14px] border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 transition-colors";
  const labelCls = "block text-[12px] font-semibold text-slate-700 mb-1.5";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            className="relative bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 4 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-4 flex-shrink-0">
              <div className="flex items-start gap-2.5 min-w-0">
                <span className="w-1 h-5 rounded-full bg-orange-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <h2 className="text-[15px] font-bold text-slate-900 leading-tight">
                    {t('teacher.students.editStudent.title')}
                  </h2>
                  <p className="text-[12px] text-slate-500 mt-0.5">
                    {t('teacher.students.editStudent.subtitle')}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
              <div className="p-5 space-y-4">
                {/* Avatar */}
                <div>
                  <label className={labelCls}>
                    {t('teacher.students.editStudent.avatar')}
                  </label>
                  <div className="flex items-center gap-3.5">
                    <div className="relative flex-shrink-0">
                      {avatarPreview ? (
                        <img
                          src={avatarPreview}
                          alt=""
                          className="w-16 h-16 rounded-full object-cover ring-1 ring-slate-200"
                        />
                      ) : (
                        <div
                          className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center ring-1 ring-slate-200 text-slate-500 font-semibold"
                          style={{ fontSize: 22, letterSpacing: '-0.02em' }}
                        >
                          {(formData.name || student?.name || '?')
                            .trim()
                            .charAt(0)
                            .toUpperCase() || '?'}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <label
                        htmlFor="avatar-upload"
                        className="inline-flex items-center h-8 px-3 rounded-md border border-slate-200 bg-white text-[12px] font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer"
                      >
                        {t('teacher.students.editStudent.chooseNewPhoto')}
                      </label>
                      <input
                        id="avatar-upload"
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/bmp,image/svg+xml"
                        onChange={handleAvatarChange}
                        className="hidden"
                      />
                      <p className="text-[11px] text-slate-400 mt-1.5">
                        JPG, PNG, GIF, WEBP · tối đa 20 MB
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100" />

                {/* Name */}
                <div>
                  <label htmlFor="name" className={labelCls}>
                    {t('teacher.students.editStudent.name')} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={inputCls}
                    placeholder={t('teacher.students.editStudent.name')}
                    required
                  />
                </div>

                {/* Phone & Email */}
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label htmlFor="phone" className={labelCls}>
                      {t('teacher.students.editStudent.phone')} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className={inputCls}
                      placeholder="0901 234 567"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className={labelCls}>Email</label>
                    <input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className={inputCls}
                      placeholder="email@example.com"
                    />
                  </div>
                </div>

                {/* Date of Birth */}
                <div>
                  <label htmlFor="dob" className={labelCls}>
                    {t('teacher.students.editStudent.dob')} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="dob"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    className={inputCls}
                    required
                  />
                </div>

                {/* Age Group & Status */}
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className={labelCls}>
                      {t('teacher.students.editStudent.ageGroup')}
                    </label>
                    <FieldSelect
                      value={formData.ageGroup}
                      onChange={(v) => setFormData({ ...formData, ageGroup: v })}
                      options={[
                        { value: 'kids',   label: t('teacher.students.editStudent.ageGroupOptions.kids'),   icon: Baby },
                        { value: 'teens',  label: t('teacher.students.editStudent.ageGroupOptions.teens'),  icon: GraduationCap },
                        { value: 'adults', label: t('teacher.students.editStudent.ageGroupOptions.adults'), icon: Briefcase },
                      ]}
                    />
                  </div>

                  <div>
                    <label className={labelCls}>
                      {t('teacher.students.editStudent.statusLabel')}
                    </label>
                    <FieldSelect
                      value={formData.status}
                      onChange={(v) => setFormData({ ...formData, status: v })}
                      options={[
                        { value: 'active',   label: t('teacher.students.editStudent.statusOptions.active'),   icon: CircleDot },
                        { value: 'inactive', label: t('teacher.students.editStudent.statusOptions.inactive'), icon: CircleSlash },
                      ]}
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center justify-center h-9 px-4 rounded-lg border border-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                >
                  {t('teacher.students.editStudent.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg bg-orange-600 text-white text-[13px] font-medium hover:bg-orange-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      {t('teacher.students.editStudent.saving')}
                    </>
                  ) : (
                    t('teacher.students.editStudent.save')
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
