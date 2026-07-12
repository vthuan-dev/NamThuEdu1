import { useState, useEffect, useRef } from "react";
import { getAuthToken } from '../../../../utils/authStorage';
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import {
  ArrowLeft,
  Camera,
  Save,
  X,
  Eye,
  EyeOff,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
} from "lucide-react";
import { useToast } from "../../../../hooks/useToast";
import { ToastContainer } from "../../../../components/ui";
import { StudentCredentialsModal } from "./StudentCredentialsModal";

/**
 * AddStudent — form tạo học viên mới.
 *
 * Thiết kế tối giản: nền trắng/slate-50, accent cam duy nhất ở CTA chính,
 * không gradient, card border phẳng, padding gọn. Địa chỉ dùng API v2 của
 * provinces.open-api.vn (mô hình 2 cấp Tỉnh → Phường/Xã sau sáp nhập 2025).
 */

// API địa chỉ — gọi trực tiếp từ client, không qua backend.
const ADDRESS_API = 'https://provinces.open-api.vn/api/v2';
type AddrItem = { code: string; name: string };

export function AddStudent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toasts, removeToast, success, error: showError } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [autoPassword, setAutoPassword] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [studentCredentials, setStudentCredentials] = useState<{
    name: string;
    phone: string;
    password: string;
    id?: number;
  } | null>(null);
  const [formData, setFormData] = useState({
    studentName: "",
    studentPhone: "",
    studentEmail: "",
    studentDoB: "",
    gender: "male",
    address: "",
    age_group: "teens" as "kids" | "teens" | "adults",
    studentPassword: "",
    confirmPassword: "",
    sendSMS: false,
    status: "active",
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  type PhoneStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';
  const [phoneStatus, setPhoneStatus] = useState<PhoneStatus>('idle');
  const phoneDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Address (Tỉnh → Phường/Xã, mô hình 2 cấp) ─────────────────────────────
  const [provinces, setProvinces] = useState<AddrItem[]>([]);
  const [communes, setCommunes] = useState<AddrItem[]>([]);
  const [addrProvince, setAddrProvince] = useState<AddrItem | null>(null);
  const [addrCommune, setAddrCommune] = useState<AddrItem | null>(null);
  const [addrStreet, setAddrStreet] = useState('');
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingCommunes, setLoadingCommunes] = useState(false);

  useEffect(() => {
    setLoadingProvinces(true);
    fetch(`${ADDRESS_API}/p/`)
      .then(r => r.json())
      .then((d: any[]) => setProvinces((Array.isArray(d) ? d : []).map(p => ({ code: String(p.code), name: p.name }))))
      .catch(() => {})
      .finally(() => setLoadingProvinces(false));
  }, []);

  useEffect(() => {
    if (!addrProvince) { setCommunes([]); setAddrCommune(null); return; }
    setLoadingCommunes(true);
    setAddrCommune(null);
    fetch(`${ADDRESS_API}/p/${addrProvince.code}?depth=2`)
      .then(r => r.json())
      .then((d: any) => setCommunes((d.wards ?? []).map((w: any) => ({ code: String(w.code), name: w.name }))))
      .catch(() => {})
      .finally(() => setLoadingCommunes(false));
  }, [addrProvince]);

  useEffect(() => {
    const parts = [addrStreet.trim(), addrCommune?.name, addrProvince?.name].filter(Boolean);
    handleInputChange('address', parts.join(', '));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addrStreet, addrCommune, addrProvince]);

  useEffect(() => {
    const phone = formData.studentPhone.trim();
    if (!phone) { setPhoneStatus('idle'); return; }

    const phoneRegex = /^0[0-9]{9,10}$/;
    if (!phoneRegex.test(phone)) { setPhoneStatus('invalid'); return; }

    if (phoneDebounceRef.current) clearTimeout(phoneDebounceRef.current);
    setPhoneStatus('checking');

    phoneDebounceRef.current = setTimeout(async () => {
      try {
        const token = getAuthToken();
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/teacher/student/check-phone?phone=${encodeURIComponent(phone)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        setPhoneStatus(data.available ? 'available' : 'taken');
      } catch {
        setPhoneStatus('idle');
      }
    }, 500);

    return () => { if (phoneDebounceRef.current) clearTimeout(phoneDebounceRef.current); };
  }, [formData.studentPhone]);

  // Age group — config tối giản, không màu mè
  const ageGroups = [
    { value: 'kids' as const,   label: t('teacher.students.addStudent.ageGroups.kids.label'),   ageRange: t('teacher.students.addStudent.ageGroups.kids.ageRange') },
    { value: 'teens' as const,  label: t('teacher.students.addStudent.ageGroups.teens.label'),  ageRange: t('teacher.students.addStudent.ageGroups.teens.ageRange') },
    { value: 'adults' as const, label: t('teacher.students.addStudent.ageGroups.adults.label'), ageRange: t('teacher.students.addStudent.ageGroups.adults.ageRange') },
  ];

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      setError(t('teacher.students.addStudent.avatar.tooLarge'));
      return;
    }
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      setError(t('teacher.students.addStudent.avatar.invalidType'));
      return;
    }
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
    setError(null);
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (phoneStatus === 'taken')   { setError('Số điện thoại này đã được sử dụng.'); return; }
    if (phoneStatus === 'invalid') { setError('Định dạng số điện thoại không hợp lệ.'); return; }
    if (!autoPassword && !formData.studentPassword) {
      setError(t('teacher.students.addStudent.validation.passwordRequired'));
      return;
    }
    if (!autoPassword && formData.studentPassword.trim().length < 6) {
      setError('Mật khẩu phải tối thiểu 6 ký tự');
      return;
    }

    setIsLoading(true);
    try {
      const token = getAuthToken();
      const fd = new FormData();
      fd.append('studentName', formData.studentName);
      fd.append('studentPhone', formData.studentPhone);
      if (formData.studentEmail) fd.append('studentEmail', formData.studentEmail);
      if (formData.studentDoB)   fd.append('studentDoB', formData.studentDoB);
      fd.append('gender', formData.gender);
      if (formData.address) fd.append('address', formData.address);
      fd.append('age_group', formData.age_group);

      // Default password for new students is always "user123" when auto mode is on.
      // Backend also falls back to "user123" if studentPassword is empty.
      const passwordToSend = autoPassword
        ? 'user123'
        : formData.studentPassword;
      fd.append('studentPassword', passwordToSend);
      fd.append('status', formData.status);
      if (avatarFile) fd.append('avatar', avatarFile);

      const response = await fetch(`${import.meta.env.VITE_API_URL}/teacher/student`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || t('teacher.students.addStudent.error'));

      setStudentCredentials({
        name: formData.studentName,
        phone: formData.studentPhone,
        password: data.data?.password || passwordToSend,
        id: data.data?.created_students?.[0]?.id ?? null,
      });
      setShowCredentialsModal(true);

      const newStudentId = data?.data?.created_students?.[0]?.id ?? null;
      const { logTeacherActivity } = await import("../../../../services/teacherActivityLog");
      logTeacherActivity({
        action: "student.add",
        entity_type: "student",
        entity_id: newStudentId,
        detail: `Thêm học viên: ${formData.studentName}`,
        meta: { phone: formData.studentPhone, age_group: formData.age_group },
      });

      success(t('teacher.students.addStudent.toast.success', { name: formData.studentName }));
    } catch (err: any) {
      setError(err.message || t('teacher.students.addStudent.error'));
      showError(err.message || t('teacher.students.addStudent.toast.error'));
    } finally {
      setIsLoading(false);
    }
  };

  // ── Enter chuyển sang ô tiếp theo ─────────────────────────────────────────
  // Nhấn Enter trên input/select sẽ focus ô kế tiếp thay vì submit form.
  // Textarea giữ nguyên hành vi xuống dòng; button (kể cả submit) không bị chặn.
  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== "Enter") return;
    const target = e.target as HTMLElement;
    const tag = target.tagName;
    if (tag === "TEXTAREA" || tag === "BUTTON") return;
    if (tag !== "INPUT" && tag !== "SELECT") return;

    e.preventDefault();
    const form = e.currentTarget;
    const focusable = Array.from(
      form.querySelectorAll<HTMLElement>(
        'input:not([type="hidden"]):not([type="file"]):not([disabled]), select:not([disabled]), textarea:not([disabled])'
      )
    ).filter((el) => el.offsetParent !== null);

    const idx = focusable.indexOf(target);
    if (idx > -1 && idx < focusable.length - 1) {
      const next = focusable[idx + 1] as HTMLInputElement;
      next.focus();
      if (typeof next.select === "function" && ["text", "tel", "email", "password"].includes(next.type)) {
        next.select();
      }
    }
  };

  // ── Reusable styles ───────────────────────────────────────────────────────
  const inputCls = "w-full px-3.5 py-2.5 text-[14px] border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 transition-colors";
  const labelCls = "block text-[12px] font-semibold text-slate-700 mb-1.5";

  return (
    <div className="px-6 py-5 pb-32 bg-slate-50 min-h-screen">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/giao-vien/students"
            className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:border-slate-300 transition-colors"
            aria-label="Quay lại"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-[18px] font-bold text-slate-900 leading-tight">
              {t('teacher.students.addStudent.title')}
            </h1>
            <p className="text-slate-500 text-[12px] mt-0.5">
              {t('teacher.students.addStudent.subtitle')}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="max-w-5xl mx-auto">
        {/* ── Section 1: Thông tin cá nhân ─────────────────────────────── */}
        <section className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
          <header className="flex items-center gap-2 pb-4 mb-4 border-b border-slate-100">
            <span className="w-1 h-4 rounded-full bg-orange-500" />
            <h2 className="text-[14px] font-bold text-slate-900">
              {t('teacher.students.addStudent.personalSection.title')}
            </h2>
            <span className="text-[12px] text-slate-400 ml-auto">
              {t('teacher.students.addStudent.personalSection.subtitle')}
            </span>
          </header>

          {/* Avatar + Name/Phone/Email */}
          <div className="flex items-start gap-6 pb-5 mb-5 border-b border-slate-100">
            <div className="flex flex-col items-center flex-shrink-0">
              <div className="relative">
                <div className="w-24 h-24 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-7 h-7 text-slate-400" />
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/bmp,image/svg+xml"
                    onChange={handleAvatarChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
                {avatarPreview && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-300 transition-colors flex items-center justify-center shadow-sm"
                    aria-label="Xóa ảnh"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-2 text-center leading-snug">
                {t('teacher.students.addStudent.avatar.upload')}
                <br />
                {t('teacher.students.addStudent.avatar.formats')}
              </p>
            </div>

            <div className="flex-1 grid grid-cols-2 gap-3.5">
              <div className="col-span-2">
                <label className={labelCls}>
                  {t('teacher.students.addStudent.fullName')} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.studentName}
                  onChange={(e) => handleInputChange("studentName", e.target.value)}
                  placeholder={t('teacher.students.addStudent.namePlaceholder')}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>
                  <Phone className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5 text-slate-400" />
                  {t('teacher.students.addStudent.phone')} <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    value={formData.studentPhone}
                    onChange={(e) => handleInputChange("studentPhone", e.target.value)}
                    placeholder="0901 234 567"
                    className={`${inputCls} pr-9 ${
                      phoneStatus === 'taken'     ? 'border-rose-300 focus:ring-rose-100 focus:border-rose-400' :
                      phoneStatus === 'available' ? 'border-emerald-300 focus:ring-emerald-100 focus:border-emerald-400' :
                      phoneStatus === 'invalid'   ? 'border-amber-300 focus:ring-amber-100 focus:border-amber-400' :
                      ''
                    }`}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    {phoneStatus === 'checking'  && <Loader2     className="w-4 h-4 animate-spin text-slate-400" />}
                    {phoneStatus === 'available' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                    {phoneStatus === 'taken'     && <XCircle      className="w-4 h-4 text-rose-500" />}
                    {phoneStatus === 'invalid'   && <XCircle      className="w-4 h-4 text-amber-500" />}
                  </div>
                </div>
                {phoneStatus === 'taken'     && <p className="mt-1 text-[11px] text-rose-600">Số điện thoại đã được sử dụng</p>}
                {phoneStatus === 'invalid'   && <p className="mt-1 text-[11px] text-amber-600">Định dạng không hợp lệ (VD: 0901234567)</p>}
              </div>

              <div>
                <label className={labelCls}>
                  <Mail className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5 text-slate-400" />
                  {t('teacher.students.addStudent.emailOptional')}
                </label>
                <input
                  type="email"
                  value={formData.studentEmail}
                  onChange={(e) => handleInputChange("studentEmail", e.target.value)}
                  placeholder="hocsinh@email.com"
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* DoB / Gender / Address / Age group */}
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className={labelCls}>
                <Calendar className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5 text-slate-400" />
                {t('teacher.students.addStudent.dateOfBirth')}
              </label>
              <input
                type="date"
                value={formData.studentDoB}
                onChange={(e) => handleInputChange("studentDoB", e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>{t('teacher.students.addStudent.gender')}</label>
              <div className="flex items-center gap-4 h-[42px]">
                {[
                  { value: "male",   label: t('teacher.students.addStudent.genderOptions.male') },
                  { value: "female", label: t('teacher.students.addStudent.genderOptions.female') },
                  { value: "other",  label: t('teacher.students.addStudent.genderOptions.other') },
                ].map((opt) => (
                  <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="gender"
                      value={opt.value}
                      checked={formData.gender === opt.value}
                      onChange={(e) => handleInputChange("gender", e.target.value)}
                      className="w-4 h-4 text-orange-600 border-slate-300 focus:ring-1 focus:ring-orange-300 cursor-pointer"
                    />
                    <span className="text-[13px] text-slate-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="col-span-2">
              <label className={labelCls}>
                <MapPin className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5 text-slate-400" />
                {t('teacher.students.addStudent.address')}
              </label>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="relative">
                  <select
                    value={addrProvince?.code ?? ''}
                    onChange={e => setAddrProvince(provinces.find(x => x.code === e.target.value) ?? null)}
                    disabled={loadingProvinces}
                    className={`${inputCls} appearance-none cursor-pointer pr-9 disabled:opacity-60`}
                  >
                    <option value="">{loadingProvinces ? 'Đang tải...' : 'Tỉnh / Thành phố'}</option>
                    {provinces.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                <div className="relative">
                  <select
                    value={addrCommune?.code ?? ''}
                    onChange={e => setAddrCommune(communes.find(x => x.code === e.target.value) ?? null)}
                    disabled={!addrProvince || loadingCommunes}
                    className={`${inputCls} appearance-none cursor-pointer pr-9 disabled:opacity-60 disabled:cursor-not-allowed`}
                  >
                    <option value="">
                      {loadingCommunes ? 'Đang tải...' : !addrProvince ? 'Chọn tỉnh trước' : 'Phường / Xã'}
                    </option>
                    {communes.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <input
                type="text"
                value={addrStreet}
                onChange={e => setAddrStreet(e.target.value)}
                placeholder="Số nhà, tên đường..."
                className={inputCls}
              />
              {formData.address && (
                <p className="mt-1.5 text-[11px] text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {formData.address}
                </p>
              )}
            </div>

            <div className="col-span-2">
              <label className={labelCls}>
                {t('teacher.students.addStudent.ageGroupTitle')} <span className="text-rose-500">*</span>
              </label>
              <p className="text-[11px] text-slate-400 mb-2.5">
                {t('teacher.students.addStudent.ageGroupSubtitle')}
              </p>
              <div className="grid grid-cols-3 gap-2.5">
                {ageGroups.map((g) => {
                  const selected = formData.age_group === g.value;
                  return (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, age_group: g.value }))}
                      className={`relative px-3.5 py-3 rounded-lg border text-left transition-all ${
                        selected
                          ? 'border-orange-400 bg-orange-50/60 ring-1 ring-orange-200'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <p className={`text-[13px] font-semibold ${selected ? 'text-orange-700' : 'text-slate-900'}`}>
                        {g.label}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{g.ageRange}</p>
                      {selected && (
                        <CheckCircle2 className="absolute top-2.5 right-2.5 w-4 h-4 text-orange-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 2: Tài khoản ─────────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
          <header className="flex items-center gap-2 pb-4 mb-4 border-b border-slate-100">
            <span className="w-1 h-4 rounded-full bg-amber-500" />
            <h2 className="text-[14px] font-bold text-slate-900">
              {t('teacher.students.addStudent.accountSection.title')}
            </h2>
            <span className="text-[12px] text-slate-400 ml-auto">
              {t('teacher.students.addStudent.accountSection.subtitle')}
            </span>
          </header>

          <div className="space-y-4">
            {/* Auto password toggle */}
            <label className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={autoPassword}
                onChange={(e) => setAutoPassword(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-slate-300 text-orange-600 focus:ring-1 focus:ring-orange-300 cursor-pointer"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-semibold text-slate-900">
                    {t('teacher.students.addStudent.autoPassword.label')}
                  </p>
                  <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-semibold rounded">
                    {t('teacher.students.addStudent.autoPassword.badge')}
                  </span>
                </div>
                <p className="text-[12px] text-slate-500 mt-0.5">
                  Mật khẩu mặc định: <span className="font-semibold text-slate-700">user123</span>
                  {' '}(bỏ chọn để nhập mật khẩu khác)
                </p>
              </div>
            </label>

            {!autoPassword && (
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className={labelCls}>
                    {t('teacher.students.addStudent.passwordLabel')} <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required={!autoPassword}
                      value={formData.studentPassword}
                      onChange={(e) => handleInputChange("studentPassword", e.target.value)}
                      placeholder={t('teacher.students.addStudent.passwordPlaceholder')}
                      className={`${inputCls} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>
                    {t('teacher.students.addStudent.confirmPasswordLabel')} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    required={!autoPassword}
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                    placeholder={t('teacher.students.addStudent.confirmPasswordPlaceholder')}
                    className={inputCls}
                  />
                </div>
              </div>
            )}

            {/* Send SMS */}
            <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={formData.sendSMS}
                onChange={(e) => handleInputChange("sendSMS", e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-1 focus:ring-orange-300 cursor-pointer"
              />
              <Phone className="w-4 h-4 text-slate-400" />
              <span className="text-[13px] text-slate-700">
                {t('teacher.students.addStudent.sendSMS')}
              </span>
            </label>

            {/* Status */}
            <div className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200">
              <div>
                <p className="text-[13px] font-semibold text-slate-900">
                  {t('teacher.students.addStudent.statusLabel')}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {formData.status === "active"
                    ? t('teacher.students.addStudent.statusActiveDesc')
                    : t('teacher.students.addStudent.statusInactiveDesc')}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[12px] font-medium ${formData.status === "active" ? "text-emerald-600" : "text-slate-500"}`}>
                  {formData.status === "active"
                    ? t('teacher.students.addStudent.statusActive')
                    : t('teacher.students.addStudent.statusInactive')}
                </span>
                <button
                  type="button"
                  onClick={() => handleInputChange("status", formData.status === "active" ? "inactive" : "active")}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.status === "active" ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      formData.status === "active" ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Sticky action bar ────────────────────────────────────────── */}
        <div className="sticky bottom-0 -mx-6 px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
          {error ? (
            <p className="flex-1 text-[12px] text-rose-600 flex items-center gap-1.5">
              <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </p>
          ) : <span className="flex-1" />}

          <Link
            to="/giao-vien/students"
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 text-[13px] font-medium transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            {t('teacher.students.addStudent.cancel')}
          </Link>
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-orange-600 text-white hover:bg-orange-700 text-[13px] font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {t('teacher.students.addStudent.submitting')}
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                {t('teacher.students.addStudent.submit')}
              </>
            )}
          </button>
        </div>
      </form>

      {/* Student Credentials Modal */}
      {studentCredentials && (
        <StudentCredentialsModal
          isOpen={showCredentialsModal}
          onClose={() => {
            setShowCredentialsModal(false);
            setTimeout(() => navigate('/giao-vien/students'), 300);
          }}
          studentData={studentCredentials}
          onPasswordReset={(newPassword) => {
            setStudentCredentials(prev => prev ? { ...prev, password: newPassword } : null);
          }}
        />
      )}
    </div>
  );
}
