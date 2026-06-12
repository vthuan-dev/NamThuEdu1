import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { usePageHeader } from "../../../../contexts/TeacherHeaderContext";
import { ToastContainer } from "../../../../components/ui/ToastContainer";
import { useToast } from "../../../../hooks/useToast";
import { usePageTitle, PAGE_TITLES } from "../../../../hooks/usePageTitle";
import { teacherApi } from "../../../../services/teacherApi";
import { getFullMediaUrl } from "../../../../utils/mediaUtils";
import {
  User,
  Bell,
  Shield,
  Palette,
  Globe,
  Mail,
  Phone,
  MapPin,
  Camera,
  Lock,
  Eye,
  EyeOff,
  Save,
  AlertCircle,
  CheckCircle2,
  Moon,
  Sun,
  Monitor,
  Smartphone,
  Laptop,
  LogOut,
  Trash2,
  Scissors,
  FileText,
  ChevronDown,
  BookOpen,
  Loader2,
  Home,
  Pencil,
  X,
} from "lucide-react";
import { PdfCutterTab } from "./PdfCutterTab";
import { LegalContentTab } from "./LegalContentTab";

export function Settings() {
  usePageTitle(PAGE_TITLES.TEACHER_SETTINGS);
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  // Get user info from localStorage as fallback
  const userStr = localStorage.getItem('user');
  const localUser = userStr ? JSON.parse(userStr) : null;
  const userName = userProfile?.name || userProfile?.uName || localUser?.name || localUser?.uName || 'Teacher';
  const userPhone = userProfile?.phone || userProfile?.uPhone || localUser?.phone || localUser?.uPhone || '';
  const userEmail = userProfile?.email || `${userPhone}@namthuedu.com`;

  const activeTab = searchParams.get("tab") || "profile";

  usePageHeader({
    breadcrumb: [t("breadcrumb.dashboard"), t("breadcrumb.settings")],
  });

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Fetch user profile from API
  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await teacherApi.user.getProfile();
      if (response.status === 'success' && response.data) {
        setUserProfile(response.data);
        // Update localStorage with fresh data
        localStorage.setItem('user', JSON.stringify(response.data));
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      toast.error('Không thể tải thông tin người dùng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const tabs = [
    { id: "profile",       label: "Hồ sơ cá nhân", icon: User },
    { id: "account",       label: "Tài khoản",     icon: Shield },
    { id: "notifications", label: "Thông báo",     icon: Bell },
    { id: "pdf-tools",     label: "Cắt trang PDF", icon: Scissors },
    { id: "legal",         label: "Nội dung pháp lý", icon: FileText },
  ];

  const handleTabChange = (tabId: string) => {
    setSearchParams({ tab: tabId });
  };

  // onSave callback — each tab handles its own toast, so no duplicate here
  const handleSave = () => {
    fetchProfile();
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <div className="flex-1 overflow-y-auto bg-[#F9FAFB]">
        <div className="px-6 py-5">
          {/* Header + Tabs */}
          <div className="mb-5">
            <h1 className="text-[15px] font-bold text-slate-900">
              Cài đặt
            </h1>
            <p className="text-[11px] text-slate-500 mt-0.5 mb-3">
              Quản lý thông tin cá nhân và tùy chỉnh hệ thống
            </p>
            <div className="flex gap-1 flex-wrap">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all cursor-pointer ${
                      isActive
                        ? "bg-slate-900 text-white"
                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Content - constrained width, centered */}
          <div className="max-w-5xl mx-auto">
            {activeTab === "profile" && <ProfileTab userName={userName} userEmail={userEmail} userProfile={userProfile} onSave={handleSave} loading={loading} toast={toast} />}
            {activeTab === "account" && <AccountTab userProfile={userProfile} onSave={handleSave} showPassword={showPassword} setShowPassword={setShowPassword} toast={toast} />}
            {activeTab === "notifications" && <NotificationsTab onSave={handleSave} toast={toast} />}
            {activeTab === "pdf-tools" && <PdfCutterTab />}
            {activeTab === "legal" && <LegalContentTab toast={toast} />}
          </div>
        </div>
      </div>
    </div>
  );
}

const getAvatarUrl = (avatar: string | null) => {
  if (!avatar) return '';
  // data: URL (preview ảnh vừa chọn) giữ nguyên
  if (avatar.startsWith('data:')) return avatar;
  return getFullMediaUrl(avatar) || '';
};

const getInitials = (name: string) => {
  if (!name) return 'NT';
  return name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// ─── Vietnam Address API v2 (mô hình 2 cấp sau sáp nhập: Tỉnh → Phường/Xã) ──
// Dùng provinces.open-api.vn API v2 — dữ liệu hành chính mới, không còn cấp
// Quận/Huyện. Gọi trực tiếp từ client.
const ADDRESS_API = 'https://provinces.open-api.vn/api/v2';

interface GeoItem { code: string; name: string; }

async function fetchProvinces(): Promise<GeoItem[]> {
  const res = await fetch(`${ADDRESS_API}/p/`);
  const data = await res.json();
  return (Array.isArray(data) ? data : []).map((p: any) => ({ code: String(p.code), name: p.name }));
}
async function fetchCommunes(provinceCode: string): Promise<GeoItem[]> {
  const res = await fetch(`${ADDRESS_API}/p/${provinceCode}?depth=2`);
  const data = await res.json();
  return (data.wards || []).map((w: any) => ({ code: String(w.code), name: w.name }));
}

// ─── Shared styled select component ─────────────────────────────────────────
function GeoSelect({ label, value, onChange, options, loading, disabled, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  options: GeoItem[]; loading?: boolean; disabled?: boolean; placeholder?: string;
}) {
  return (
    <div className="relative">
      <label className="block text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-1.5">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled || loading}
          className="w-full h-11 pl-4 pr-10 border border-[#E5E7EB] rounded-xl bg-[#F9FAFB] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#EA580C]/30 focus:border-[#EA580C] transition-all appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ fontSize: '14px' }}
        >
          <option value="">{loading ? 'Đang tải...' : (placeholder || `Chọn ${label}`)}</option>
          {options.map(o => (
            <option key={o.code} value={String(o.code)}>{o.name}</option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#9CA3AF]">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>
    </div>
  );
}

// ─── ProfileTab ───────────────────────────────────────────────────────────────
function ProfileTab({ userName, userEmail, userProfile, onSave, loading, toast }: { userName: string; userEmail: string; userProfile: any; onSave: () => void; loading: boolean; toast: any }) {
  const [formData, setFormData] = useState({
    name: userName,
    email: userEmail,
    phone: userProfile?.phone || '',
    address: userProfile?.address || '',
    bio: userProfile?.bio || '',
  });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showMoreInfo, setShowMoreInfo] = useState(false);

  // ── Address state (2 cấp: Tỉnh → Phường/Xã) ──────────────────────────────
  const [editingAddress, setEditingAddress] = useState(false);
  const [provinces, setProvinces] = useState<GeoItem[]>([]);
  const [communes, setCommunes] = useState<GeoItem[]>([]);
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedCommune, setSelectedCommune] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingCommunes, setLoadingCommunes] = useState(false);

  // Load provinces lazily — only the first time user opens edit mode
  const provincesLoaded = useRef(false);
  const openEditAddress = useCallback(() => {
    setEditingAddress(true);
    if (!provincesLoaded.current) {
      provincesLoaded.current = true;
      setLoadingProvinces(true);
      fetchProvinces()
        .then(setProvinces)
        .catch(() => toast.error('Không thể tải danh sách tỉnh/thành phố'))
        .finally(() => setLoadingProvinces(false));
    }
  }, [toast]);

  // Keep a ref to the "last saved" address so Cancel can revert
  const savedAddressRef = useRef(formData.address);
  const cancelEditAddress = useCallback(() => {
    setEditingAddress(false);
    // Revert form address to what was saved
    setFormData(prev => ({ ...prev, address: savedAddressRef.current }));
    // Reset selects
    setSelectedProvince('');
    setSelectedCommune('');
    setStreetAddress(savedAddressRef.current);
    setCommunes([]);
  }, []);

  // Load communes when province changes
  const handleProvinceChange = useCallback(async (code: string) => {
    setSelectedProvince(code);
    setSelectedCommune('');
    setCommunes([]);
    if (!code) return;
    setLoadingCommunes(true);
    try {
      const data = await fetchCommunes(code);
      setCommunes(data);
    } catch { toast.error('Không thể tải danh sách phường/xã'); }
    finally { setLoadingCommunes(false); }
  }, [toast]);

  // Build full address string ONLY while in edit mode
  useEffect(() => {
    if (!editingAddress) return;
    const parts: string[] = [];
    if (streetAddress.trim()) parts.push(streetAddress.trim());
    if (selectedCommune) {
      const c = communes.find(c => String(c.code) === selectedCommune);
      if (c) parts.push(c.name);
    }
    if (selectedProvince) {
      const p = provinces.find(p => String(p.code) === selectedProvince);
      if (p) parts.push(p.name);
    }
    setFormData(prev => ({ ...prev, address: parts.join(', ') }));
  }, [editingAddress, streetAddress, selectedCommune, selectedProvince, communes, provinces]);

  useEffect(() => {
    if (userProfile) {
      const addr = userProfile.address || '';
      setFormData({
        name: userProfile.name || userProfile.uName || userName,
        email: userProfile.email || userEmail,
        phone: userProfile.phone || userProfile.uPhone || '',
        address: addr,
        bio: userProfile.bio || '',
      });
      savedAddressRef.current = addr;
      setStreetAddress(addr);
      if (userProfile.avatar) {
        setAvatarPreview(userProfile.avatar);
      }
    }
  }, [userProfile, userName, userEmail]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn file ảnh'); return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Kích thước ảnh không được vượt quá 20MB'); return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
    try {
      setUploading(true);
      const fd = new FormData();
      fd.append('avatar', file);
      const response = await teacherApi.user.uploadAvatar(fd);
      const avatarUrl = response.data?.avatar_url || (response as any).avatar_url;
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        user.avatar_url = avatarUrl; user.avatar = avatarUrl;
        localStorage.setItem('user', JSON.stringify(user));
      }
      setAvatarPreview(avatarUrl);
      window.dispatchEvent(new Event('avatarUpdated'));
      toast.success('Đã tải ảnh lên thành công!');
    } catch (error) {
      console.error('Failed to upload avatar:', error);
      toast.error('Không thể tải ảnh lên');
      setAvatarPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      setUploading(true);
      await teacherApi.user.removeAvatar();
      toast.success('Đã xóa ảnh đại diện!');
      
      // Wait 2 seconds after toast shows, then switch to default avatar
      setTimeout(() => {
        setAvatarPreview('/images/default-avatar.png');
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          user.avatar_url = '/images/default-avatar.png';
          user.avatar = '/images/default-avatar.png';
          localStorage.setItem('user', JSON.stringify(user));
        }
        // Dispatch custom event to notify Sidebar
        window.dispatchEvent(new Event('avatarUpdated'));
        setUploading(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to remove avatar:', error);
      toast.error('Không thể xóa ảnh đại diện');
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      await teacherApi.user.updateProfile(formData);
      // Persist saved address so Cancel won't revert past this point
      savedAddressRef.current = formData.address;
      setEditingAddress(false);
      toast.success('Đã cập nhật thông tin thành công!');
      onSave();
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast.error('Không thể cập nhật thông tin');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-[#EA580C] border-t-transparent rounded-full animate-spin" style={{ borderWidth: '3px' }} />
          <span className="text-[#6B7280] text-sm">Đang tải thông tin...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Avatar Card ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden shadow-sm">
        {/* Card header bar */}
        <div className="px-6 py-4 border-b border-[#F3F4F6] flex items-center gap-2">
          <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[#EA580C] to-[#C2410C]" />
          <h3 className="text-[#111827] font-bold" style={{ fontSize: '16px' }}>Ảnh đại diện</h3>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-6">
            {/* Avatar ring */}
            <div className="relative flex-shrink-0">
              <div className="w-24 h-24 rounded-full p-[3px]" style={{ background: 'linear-gradient(135deg, #EA580C, #F97316, #C2410C)' }}>
                {avatarPreview ? (
                  <img
                    src={getAvatarUrl(avatarPreview)}
                    alt="Avatar"
                    className="w-full h-full rounded-full object-cover border-2 border-white"
                  />
                ) : (
                  <div
                    className="w-full h-full rounded-full border-2 border-white flex items-center justify-center text-white"
                    style={{ background: 'linear-gradient(135deg, #EA580C 0%, #C2410C 100%)', fontSize: '28px', fontWeight: 700 }}
                  >
                    {getInitials(userName)}
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center text-white border-2 border-white transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #EA580C, #C2410C)' }}
              >
                {uploading ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Info */}
            <div className="flex-1">
              <h4 className="text-[#111827] font-semibold" style={{ fontSize: '17px' }}>{userName}</h4>
              <p className="text-[#EA580C] text-sm font-medium mt-0.5">Giáo viên</p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="h-9 px-4 rounded-xl text-white text-sm font-medium transition-all disabled:opacity-50 hover:opacity-90 shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #EA580C, #C2410C)' }}
                >
                  {uploading ? 'Đang tải...' : '↑ Tải ảnh lên'}
                </button>
                {avatarPreview && (
                  <button
                    onClick={handleRemoveAvatar}
                    disabled={uploading}
                    className="h-9 px-4 rounded-xl bg-[#FEF2F2] text-[#EF4444] text-sm font-medium border border-[#FCA5A5] hover:bg-[#FEE2E2] transition-all disabled:opacity-50"
                  >
                    Xóa ảnh
                  </button>
                )}
              </div>
              <p className="text-[#9CA3AF] mt-2" style={{ fontSize: '12px' }}>JPG, PNG hoặc GIF · Tối đa 20 MB</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Personal Info Card ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[#F3F4F6] flex items-center gap-2">
          <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[#3B82F6] to-[#2563EB]" />
          <h3 className="text-[#111827] font-bold" style={{ fontSize: '16px' }}>Thông tin cá nhân</h3>
        </div>
        <div className="p-6 grid grid-cols-2 gap-5">

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-1.5">
              Họ và tên <span className="text-[#EF4444] normal-case">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full h-11 pl-10 pr-4 border border-[#E5E7EB] rounded-xl bg-[#F9FAFB] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#EA580C]/30 focus:border-[#EA580C] transition-all"
                style={{ fontSize: '14px' }}
                placeholder="Nhập họ và tên"
              />
            </div>
          </div>

          {/* Email — read-only, account identity */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-[#6B7280] uppercase tracking-wide">
                Email <span className="text-[#EF4444] normal-case">*</span>
              </label>
              <span className="flex items-center gap-1 text-[10px] text-[#9CA3AF] bg-[#F3F4F6] px-1.5 py-0.5 rounded-full">
                <Lock className="w-2.5 h-2.5" />
                Không thể thay đổi
              </span>
            </div>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
              <input
                type="email"
                value={formData.email}
                readOnly
                className="w-full h-11 pl-10 pr-4 border border-[#E5E7EB] rounded-xl bg-[#F3F4F6] text-[#6B7280] cursor-not-allowed select-none outline-none"
                style={{ fontSize: '14px' }}
              />
            </div>
          </div>


          {/* Collapsible Section for Phone, Role, and Bio */}
          {showMoreInfo ? (
            <>
              {/* Phone — read-only, account identity */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Số điện thoại</label>
                  <span className="flex items-center gap-1 text-[10px] text-[#9CA3AF] bg-[#F3F4F6] px-1.5 py-0.5 rounded-full">
                    <Lock className="w-2.5 h-2.5" />
                    Không thể thay đổi
                  </span>
                </div>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                  <input
                    type="tel"
                    value={formData.phone}
                    readOnly
                    className="w-full h-11 pl-10 pr-4 border border-[#E5E7EB] rounded-xl bg-[#F3F4F6] text-[#6B7280] cursor-not-allowed select-none outline-none"
                    style={{ fontSize: '14px' }}
                  />
                </div>
              </div>

              {/* Role — read-only, managed by admin */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Chức vụ</label>
                  <span className="flex items-center gap-1 text-[10px] text-[#9CA3AF] bg-[#F3F4F6] px-1.5 py-0.5 rounded-full">
                    <Lock className="w-2.5 h-2.5" />
                    Không thể thay đổi
                  </span>
                </div>
                <div className="relative">
                  <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                  <div
                    className="w-full h-11 pl-10 pr-4 border border-[#E5E7EB] rounded-xl bg-[#F3F4F6] text-[#6B7280] flex items-center cursor-not-allowed select-none"
                    style={{ fontSize: '14px' }}
                  >
                    Giáo viên
                  </div>
                </div>
              </div>

              {/* Bio */}
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-1.5">Giới thiệu bản thân</label>
                <textarea
                  rows={3}
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Viết vài dòng giới thiệu về bản thân, kinh nghiệm giảng dạy..."
                  className="w-full px-4 py-3 border border-[#E5E7EB] rounded-xl bg-[#F9FAFB] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#EA580C]/30 focus:border-[#EA580C] transition-all resize-none"
                  style={{ fontSize: '14px' }}
                />
              </div>
            </>
          ) : null}

          {/* Toggle View More / View Less Button */}
          <div className="col-span-2 flex justify-center pt-2">
            <button
              type="button"
              onClick={() => setShowMoreInfo(!showMoreInfo)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-[#E5E7EB] text-[#4B5563] bg-[#F9FAFB] hover:bg-[#F3F4F6] hover:text-[#111827] transition-all shadow-sm cursor-pointer"
            >
              <span>{showMoreInfo ? 'Thu gọn bớt' : 'Xem thêm thông tin'}</span>
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showMoreInfo ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Address Card ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden shadow-sm">
        {/* Card Header */}
        <div className="px-6 py-4 border-b border-[#F3F4F6] flex items-center gap-2">
          <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[#10B981] to-[#059669]" />
          <h3 className="text-[#111827] font-bold" style={{ fontSize: '16px' }}>Địa chỉ</h3>
          <span className="text-[11px] text-[#9CA3AF] bg-[#F3F4F6] px-2 py-0.5 rounded-full">Đơn vị hành chính mới (2 cấp)</span>
          <div className="ml-auto">
            {editingAddress ? (
              <button
                onClick={cancelEditAddress}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB] transition-all text-sm font-medium"
              >
                <X className="w-3.5 h-3.5" />
                Hủy
              </button>
            ) : (
              <button
                onClick={openEditAddress}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[#10B981] border border-[#10B981]/30 bg-[#F0FDF4] hover:bg-[#DCFCE7] transition-all text-sm font-medium"
              >
                <Pencil className="w-3.5 h-3.5" />
                Chỉnh sửa
              </button>
            )}
          </div>
        </div>

        {/* Read-only view */}
        {!editingAddress && (
          <div className="p-6">
            {formData.address ? (
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#F0FDF4] flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-[#10B981]" />
                </div>
                <div>
                  <p className="text-xs text-[#9CA3AF] font-medium uppercase tracking-wide mb-1">Địa chỉ hiện tại</p>
                  <p className="text-[#111827] leading-relaxed" style={{ fontSize: '14px' }}>{formData.address}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-[#9CA3AF]">
                <div className="w-9 h-9 rounded-xl bg-[#F9FAFB] border border-dashed border-[#D1D5DB] flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#6B7280]">Chưa có địa chỉ</p>
                  <p className="text-xs text-[#9CA3AF] mt-0.5">Nhấn "Chỉnh sửa" để thêm địa chỉ của bạn</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Edit form — animated slide down */}
        {editingAddress && (
          <div className="p-6 space-y-4">
            {/* Row 1: Province + Commune (mô hình 2 cấp, không còn Quận/Huyện) */}
            <div className="grid grid-cols-2 gap-4">
              <GeoSelect
                label="Tỉnh / Thành phố"
                value={selectedProvince}
                onChange={handleProvinceChange}
                options={provinces}
                loading={loadingProvinces}
                placeholder="Chọn tỉnh/thành phố"
              />
              <GeoSelect
                label="Phường / Xã"
                value={selectedCommune}
                onChange={setSelectedCommune}
                options={communes}
                loading={loadingCommunes}
                disabled={!selectedProvince}
                placeholder={selectedProvince ? 'Chọn phường/xã' : 'Chọn tỉnh trước'}
              />
            </div>
            {/* Row 2: Street */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-1.5">Số nhà / Đường</label>
                <div className="relative">
                  <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                  <input
                    type="text"
                    value={streetAddress}
                    onChange={e => setStreetAddress(e.target.value)}
                    placeholder="VD: 123 Nguyễn Huệ"
                    className="w-full h-11 pl-10 pr-4 border border-[#E5E7EB] rounded-xl bg-[#F9FAFB] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#10B981]/30 focus:border-[#10B981] transition-all"
                    style={{ fontSize: '14px' }}
                  />
                </div>
              </div>
            </div>

            {/* Preview full address */}
            {formData.address && (
              <div className="flex items-start gap-2.5 p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl">
                <MapPin className="w-4 h-4 text-[#10B981] mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-xs text-[#059669] font-semibold uppercase tracking-wide">Xem trước địa chỉ</span>
                  <p className="text-[#111827] mt-0.5" style={{ fontSize: '13px' }}>{formData.address}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Save Button ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between bg-white rounded-2xl px-6 py-4 border border-[#E5E7EB] shadow-sm">
        <p className="text-[#9CA3AF] text-sm">Những thay đổi sẽ được lưu ngay lập tức</p>
        <button
          onClick={handleSubmit}
          className="flex items-center gap-2 h-11 px-6 rounded-xl text-white font-medium text-sm transition-all hover:opacity-90 shadow-md"
          style={{ background: 'linear-gradient(135deg, #EA580C 0%, #C2410C 100%)' }}
        >
          <Save className="w-4 h-4" />
          Lưu thay đổi
        </button>
      </div>
    </div>
  );
}

function AccountTab({
  userProfile,
  onSave,
  showPassword,
  setShowPassword,
  toast,
}: {
  userProfile: any;
  onSave: () => void;
  showPassword: boolean;
  setShowPassword: (show: boolean) => void;
  toast: any;
}) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: '',
  });
  const [scheduledDeleteAt, setScheduledDeleteAt] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setScheduledDeleteAt(userProfile.scheduled_delete_at || null);
    }
  }, [userProfile]);

  const handleRequestDelete = async () => {
    try {
      setShowDeleteConfirm(false);
      const res = await teacherApi.user.requestDeleteAccount();
      if (res.status === 'success') {
        toast.success(res.message || 'Yêu cầu xóa tài khoản đã được ghi nhận.');
        setScheduledDeleteAt((res as any).scheduled_delete_at);
        onSave();
      }
    } catch (error) {
      console.error('Failed to request delete account:', error);
      toast.error('Không thể thực hiện yêu cầu xóa tài khoản');
    }
  };

  const handleCancelDelete = async () => {
    try {
      const res = await teacherApi.user.cancelDeleteAccount();
      if (res.status === 'success') {
        toast.success(res.message || 'Đã hủy yêu cầu xóa tài khoản.');
        setScheduledDeleteAt(null);
        onSave();
      }
    } catch (error) {
      console.error('Failed to cancel delete account:', error);
      toast.error('Không thể hủy yêu cầu xóa tài khoản');
    }
  };

  // Password strength
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return null;
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 1) return { label: 'Yếu', color: '#EF4444', width: '25%' };
    if (score === 2) return { label: 'Trung bình', color: '#F59E0B', width: '50%' };
    if (score === 3) return { label: 'Khá', color: '#3B82F6', width: '75%' };
    return { label: 'Mạnh', color: '#10B981', width: '100%' };
  };
  const strength = getPasswordStrength(passwords.new);

  // Fetch sessions from real API
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoadingSessions(true);
        const response = await teacherApi.user.getSessions();
        if (response.status === 'success' && response.data) {
          setSessions(Array.isArray(response.data) ? response.data : []);
        }
      } catch (error) {
        console.error('Failed to fetch sessions:', error);
        // Show empty state instead of mock data
        setSessions([]);
      } finally {
        setLoadingSessions(false);
      }
    };
    fetchSessions();
  }, []);

  const handleChangePassword = async () => {
    if (!passwords.current || !passwords.new || !passwords.confirm) {
      toast.error('Vui lòng điền đầy đủ thông tin'); return;
    }
    if (passwords.new !== passwords.confirm) {
      toast.error('Mật khẩu xác nhận không khớp'); return;
    }
    if (passwords.new.length < 8) {
      toast.error('Mật khẩu phải có ít nhất 8 ký tự'); return;
    }
    try {
      setSubmittingPassword(true);
      await teacherApi.user.changePassword(passwords.current, passwords.new, passwords.confirm);
      toast.success('Đã đổi mật khẩu thành công!');
      setPasswords({ current: '', new: '', confirm: '' });
      onSave();
    } catch (error: any) {
      console.error('Failed to change password:', error);
      const message = error?.response?.data?.message || 'Mật khẩu hiện tại không đúng';
      toast.error(message);
    } finally {
      setSubmittingPassword(false);
    }
  };

  const handleLogoutSession = async (sessionId: string) => {
    try {
      await teacherApi.user.logoutSession(sessionId);
      toast.success('Đã đăng xuất khỏi phiên!');
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    } catch (error) {
      console.error('Failed to logout session:', error);
      toast.error('Không thể đăng xuất khỏi phiên');
    }
  };

  const getDeviceIcon = (device: string = '') => {
    const d = device.toLowerCase();
    if (d.includes('iphone') || d.includes('android') || d.includes('mobile')) return Smartphone;
    if (d.includes('ipad') || d.includes('tablet')) return Monitor;
    return Laptop;
  };

  const formatLastActive = (dateStr: string) => {
    if (!dateStr) return 'Không rõ';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs} giờ trước`;
    const diffDays = Math.floor(diffHrs / 24);
    return `${diffDays} ngày trước`;
  };

  // Input field helper
  const inputClass = "w-full h-11 pl-10 pr-11 border border-[#E5E7EB] rounded-xl bg-[#F9FAFB] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#EA580C]/30 focus:border-[#EA580C] transition-all";

  return (
    <div className="space-y-5">

      {/* ── Change Password Card ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[#F3F4F6] flex items-center gap-2">
          <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[#EA580C] to-[#C2410C]" />
          <h3 className="text-[#111827] font-bold" style={{ fontSize: '16px' }}>Đổi mật khẩu</h3>
        </div>
        <div className="p-6 space-y-4 max-w-lg">

          {/* Current password */}
          <div>
            <label className="block text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-1.5">Mật khẩu hiện tại</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={passwords.current}
                onChange={e => setPasswords(p => ({ ...p, current: e.target.value }))}
                className={inputClass}
                style={{ fontSize: '14px' }}
                placeholder="Nhập mật khẩu hiện tại"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div>
            <label className="block text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-1.5">Mật khẩu mới</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={passwords.new}
                onChange={e => setPasswords(p => ({ ...p, new: e.target.value }))}
                className={inputClass}
                style={{ fontSize: '14px' }}
                placeholder="Nhập mật khẩu mới (tối thiểu 8 ký tự)"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {/* Strength bar */}
            {strength && (
              <div className="mt-2 space-y-1">
                <div className="h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: strength.width, background: strength.color }}
                  />
                </div>
                <p className="text-xs font-medium" style={{ color: strength.color }}>
                  Độ mạnh: {strength.label}
                </p>
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-1.5">Xác nhận mật khẩu mới</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={passwords.confirm}
                onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))}
                className={`${inputClass} ${passwords.confirm && passwords.confirm !== passwords.new ? 'border-[#EF4444] focus:ring-[#EF4444]/30 focus:border-[#EF4444]' : passwords.confirm && passwords.confirm === passwords.new ? 'border-[#10B981] focus:ring-[#10B981]/30 focus:border-[#10B981]' : ''}`}
                style={{ fontSize: '14px' }}
                placeholder="Nhập lại mật khẩu mới"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {passwords.confirm && passwords.confirm !== passwords.new && (
              <p className="mt-1.5 text-xs text-[#EF4444] flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Mật khẩu không khớp
              </p>
            )}
            {passwords.confirm && passwords.confirm === passwords.new && (
              <p className="mt-1.5 text-xs text-[#10B981] flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Mật khẩu khớp
              </p>
            )}
          </div>

          {/* Tip */}
          <div className="flex items-start gap-2.5 p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl">
            <AlertCircle className="w-4 h-4 text-[#F59E0B] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[#92400E] leading-relaxed">
              Mật khẩu nên có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt.
            </p>
          </div>

          <button
            onClick={handleChangePassword}
            disabled={submittingPassword}
            className="flex items-center gap-2 h-10 px-5 rounded-xl text-white text-sm font-medium transition-all hover:opacity-90 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #EA580C 0%, #C2410C 100%)' }}
          >
            {submittingPassword ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Đang xử lý...</>
            ) : (
              <><Lock className="w-4 h-4" />Đổi mật khẩu</>
            )}
          </button>
        </div>
      </div>

      {/* ── Active Sessions Card ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[#F3F4F6] flex items-center gap-2">
          <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[#3B82F6] to-[#2563EB]" />
          <h3 className="text-[#111827] font-bold" style={{ fontSize: '16px' }}>Phiên đăng nhập</h3>
          {!loadingSessions && sessions.length > 0 && (
            <span className="ml-1 text-xs text-[#6B7280] bg-[#F3F4F6] px-2 py-0.5 rounded-full">
              {sessions.length} phiên
            </span>
          )}
        </div>
        <div className="p-6">
          {loadingSessions ? (
            <div className="flex items-center gap-3 text-[#9CA3AF] py-4">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Đang tải phiên đăng nhập...</span>
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex items-center gap-3 py-4">
              <div className="w-10 h-10 rounded-xl bg-[#F9FAFB] border border-dashed border-[#D1D5DB] flex items-center justify-center flex-shrink-0">
                <Monitor className="w-5 h-5 text-[#D1D5DB]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#6B7280]">Không có phiên nào</p>
                <p className="text-xs text-[#9CA3AF] mt-0.5">API chưa hỗ trợ hoặc không có dữ liệu</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {(showAllSessions ? sessions : sessions.slice(0, 5)).map((session, idx) => {
                const DeviceIcon = getDeviceIcon(session.device || session.user_agent || '');
                const isCurrent = session.isCurrent || session.is_current || idx === 0;
                return (
                  <div
                    key={session.id || idx}
                    className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${isCurrent ? 'border-[#BFDBFE] bg-[#EFF6FF]' : 'border-[#E5E7EB] bg-[#F9FAFB] hover:bg-white'}`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isCurrent ? 'bg-[#DBEAFE]' : 'bg-[#F3F4F6]'}`}>
                      <DeviceIcon className={`w-5 h-5 ${isCurrent ? 'text-[#2563EB]' : 'text-[#6B7280]'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h4 className="text-[#111827] font-semibold text-sm truncate">
                          {session.device || session.user_agent || 'Thiết bị không xác định'}
                        </h4>
                        {isCurrent && (
                          <span className="flex-shrink-0 px-2 py-0.5 bg-[#DBEAFE] text-[#1D4ED8] rounded-full text-[10px] font-bold uppercase tracking-wide">
                            Hiện tại
                          </span>
                        )}
                      </div>
                      <p className="text-[#9CA3AF] text-xs">
                        {session.location || session.ip_address || ''}
                        {(session.location || session.ip_address) && ' · '}
                        {formatLastActive(session.lastActive || session.last_active || session.created_at)}
                      </p>
                    </div>
                    {!isCurrent && (
                      <button
                        onClick={() => handleLogoutSession(session.id)}
                        className="flex-shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#FEF2F2] text-[#EF4444] text-xs font-medium border border-[#FCA5A5] hover:bg-[#FEE2E2] transition-all"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Đăng xuất
                      </button>
                    )}
                  </div>
                );
              })}

              {sessions.length > 5 && (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAllSessions(!showAllSessions)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-[#E5E7EB] text-[#4B5563] bg-[#F9FAFB] hover:bg-[#F3F4F6] hover:text-[#111827] transition-all shadow-sm cursor-pointer"
                  >
                    <span>{showAllSessions ? 'Thu gọn bớt' : `Xem thêm ${sessions.length - 5} phiên đăng nhập`}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showAllSessions ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Danger Zone ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-[#FCA5A5] overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[#FEE2E2] flex items-center gap-2">
          <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[#EF4444] to-[#DC2626]" />
          <h3 className="text-[#EF4444] font-bold" style={{ fontSize: '16px' }}>Vùng nguy hiểm</h3>
        </div>
        <div className="p-6">
          {scheduledDeleteAt ? (
            <div className="flex items-start justify-between gap-4 bg-red-50/50 p-4 rounded-xl border border-red-100">
              <div className="flex-1">
                <h4 className="text-red-700 font-bold text-sm mb-1">Yêu cầu xóa tài khoản đang chờ xử lý</h4>
                <p className="text-red-600 text-xs leading-relaxed">
                  Tài khoản của bạn đã được lên lịch xóa tự động vào lúc: <strong>{new Date(scheduledDeleteAt).toLocaleString('vi-VN')}</strong>.
                </p>
                <p className="text-gray-500 text-xs leading-relaxed mt-1">
                  Bạn có thể hủy yêu cầu này bất cứ lúc nào trước thời hạn để tiếp tục sử dụng.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCancelDelete}
                className="flex-shrink-0 flex items-center gap-2 h-9 px-4 rounded-xl bg-white text-[#10B981] text-sm font-semibold border border-[#10B981]/30 hover:bg-[#F0FDF4] transition-all shadow-sm"
              >
                Hủy yêu cầu xóa
              </button>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-[#111827] font-semibold text-sm mb-1">Xóa tài khoản</h4>
                <p className="text-[#6B7280] text-xs leading-relaxed">
                  Xóa vĩnh viễn tài khoản và toàn bộ dữ liệu. Hành động này <strong>không thể hoàn tác</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex-shrink-0 flex items-center gap-2 h-9 px-4 rounded-xl bg-[#FEF2F2] text-[#EF4444] text-sm font-medium border border-[#FCA5A5] hover:bg-[#FEE2E2] transition-all"
              >
                <Trash2 className="w-4 h-4" />
                Xóa tài khoản
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showDeleteConfirm && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-red-100 max-w-md w-full p-6 shadow-2xl mx-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg text-gray-900">Xác nhận xóa tài khoản</h3>
            </div>
            <p className="text-[#4B5563] text-sm leading-relaxed mb-6">
              Bạn có chắc chắn muốn xóa tài khoản này? Tài khoản của bạn sẽ được <strong>lên lịch xóa vĩnh viễn sau 3 ngày</strong>. Trong thời gian này, bạn vẫn có thể đăng nhập để hủy yêu cầu xóa bất kỳ lúc nào.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="h-10 px-4 rounded-xl border border-gray-200 text-gray-700 bg-gray-50 hover:bg-gray-100 font-medium text-sm transition-all"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleRequestDelete}
                className="h-10 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium text-sm transition-all shadow-md"
              >
                Xác nhận xóa (Chờ 3 ngày)
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}




function NotificationsTab({ onSave, toast }: { onSave: () => void; toast: any }) {
  const [settings, setSettings] = useState<any>({
    email: {
      student_registered: true,
      assignment_submitted: true,
      new_message: true,
      weekly_report: true,
    },
    push: {
      class_reminder: true,
      system_notification: true,
      notification_sound: true,
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const res = await teacherApi.user.getNotificationSettings();
        if (res.status === 'success' && res.data) {
          setSettings(res.data);
        }
      } catch (error) {
        console.error('Failed to fetch notification settings:', error);
        toast.error('Không thể tải cấu hình thông báo');
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [toast]);

  const toggleSetting = (type: 'email' | 'push', key: string) => {
    setSettings((prev: any) => ({
      ...prev,
      [type]: {
        ...prev[type],
        [key]: !prev[type][key]
      }
    }));
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      const res = await teacherApi.user.updateNotificationSettings(settings);
      if (res.status === 'success') {
        toast.success(res.message || 'Cấu hình thông báo đã được lưu!');
        onSave();
      }
    } catch (error) {
      console.error('Failed to save notification settings:', error);
      toast.error('Lưu cấu hình thông báo thất bại');
    } finally {
      setSaving(false);
    }
  };

  const emailList = [
    { key: "student_registered", label: "Học viên mới đăng ký", desc: "Nhận thông báo khi có học viên mới" },
    { key: "assignment_submitted", label: "Bài tập được nộp", desc: "Thông báo khi học viên nộp bài tập" },
    { key: "new_message", label: "Tin nhắn mới", desc: "Nhận thông báo tin nhắn từ học viên" },
    { key: "weekly_report", label: "Báo cáo hàng tuần", desc: "Tóm tắt hoạt động trong tuần" },
  ];

  const pushList = [
    { key: "class_reminder", label: "Nhắc nhở lịch dạy", desc: "Nhắc trước 15 phút khi có lớp học" },
    { key: "system_notification", label: "Thông báo hệ thống", desc: "Cập nhật quan trọng từ hệ thống" },
    { key: "notification_sound", label: "Âm thanh thông báo", desc: "Phát âm thanh khi có thông báo mới" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 bg-white rounded-xl border border-[#E5E7EB] shadow-sm gap-3">
        <Loader2 className="h-6 w-6 text-[#EA580C] animate-spin" />
        <span className="text-sm text-[#6B7280]">Đang tải cấu hình thông báo...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Email Notifications */}
      <div className="bg-white rounded-xl p-6 border border-[#E5E7EB]">
        <h3
          className="text-[#111827] mb-6"
          style={{ fontSize: "18px", fontWeight: 700 }}
        >
          Thông báo qua Email
        </h3>
        <div className="space-y-4">
          {emailList.map((item) => {
            const isOn = settings.email?.[item.key];
            return (
              <div key={item.key} className="flex items-center justify-between py-3 border-b border-[#E5E7EB] last:border-0">
                <div>
                  <h4
                    className="text-[#111827] mb-1"
                    style={{ fontSize: "14px", fontWeight: 600 }}
                  >
                    {item.label}
                  </h4>
                  <p className="text-[#6B7280]" style={{ fontSize: "13px" }}>
                    {item.desc}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleSetting('email', item.key)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    isOn ? 'bg-[#EA580C]' : 'bg-[#D1D5DB]'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      isOn ? 'translate-x-[22px]' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Push Notifications */}
      <div className="bg-white rounded-xl p-6 border border-[#E5E7EB]">
        <h3
          className="text-[#111827] mb-6"
          style={{ fontSize: "18px", fontWeight: 700 }}
        >
          Thông báo đẩy
        </h3>
        <div className="space-y-4">
          {pushList.map((item) => {
            const isOn = settings.push?.[item.key];
            return (
              <div key={item.key} className="flex items-center justify-between py-3 border-b border-[#E5E7EB] last:border-0">
                <div>
                  <h4
                    className="text-[#111827] mb-1"
                    style={{ fontSize: "14px", fontWeight: 600 }}
                  >
                    {item.label}
                  </h4>
                  <p className="text-[#6B7280]" style={{ fontSize: "13px" }}>
                    {item.desc}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleSetting('push', item.key)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    isOn ? 'bg-[#EA580C]' : 'bg-[#D1D5DB]'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      isOn ? 'translate-x-[22px]' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-end bg-white rounded-xl p-6 border border-[#E5E7EB]">
        <button
          type="button"
          onClick={handleSaveSettings}
          disabled={saving}
          className="flex items-center gap-2 h-11 px-6 bg-[#EA580C] text-white rounded-lg hover:bg-[#C2410C] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
        >
          {saving ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Save className="w-[18px] h-[18px]" />}
          <span style={{ fontSize: "14px", fontWeight: 500 }}>Lưu thay đổi</span>
        </button>
      </div>
    </div>
  );
}



