import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Save, Camera, ChevronDown, Loader2, MapPin, X } from 'lucide-react';
import { studentApi } from '../../../../services/studentApi';
import { useToastContext } from '../../../../contexts/ToastContext';
import { getFullMediaUrl } from '../../../../utils/mediaUtils';

// ─── Vietnam Address API v2 (mô hình 2 cấp sau sáp nhập 2025: Tỉnh → Phường/Xã) ──
// Dùng provinces.open-api.vn API v2 — dữ liệu hành chính mới, không còn cấp
// Quận/Huyện. Gọi trực tiếp từ client (giống các trang giáo viên).
const ADDRESS_API = 'https://provinces.open-api.vn/api/v2';

type Form = {
  uName: string;
  uGender: 0 | 1;
  uAddress: string;
  uDoB: string;
  bio: string;
};

type ProfileData = {
  uId: number;
  uName: string;
  uPhone: string;
  uGender: 0 | 1 | boolean | null;
  uAddress: string | null;
  uDoB: string | null;
  bio: string | null;
  avatar_url: string | null;
  age_group?: string;
};

type Province = {
  code: string;
  name: string;
};

type Commune = {
  code: string;
  name: string;
  administrativeLevel?: string;
};

const inputBase =
  'w-full px-3.5 py-2.5 rounded-lg border text-sm text-slate-900 ' +
  'placeholder:text-slate-400 transition-colors ' +
  'focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100';

const inputStyle = { borderColor: '#E8E4F9' };

const labelBase = 'block text-xs font-semibold text-slate-700 mb-1.5';

type Props = {
  /** Whether card is expanded by default. Defaults to true. */
  defaultExpanded?: boolean;
};

export function AccountInfoCard({ defaultExpanded = true }: Props = {}) {
  const queryClient = useQueryClient();
  const toast = useToastContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [form, setForm] = useState<Form>({
    uName: '',
    uGender: 1,
    uAddress: '',
    uDoB: '',
    bio: '',
  });

  const [isEditingAddress, setIsEditingAddress] = useState<boolean>(false);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [selectedProvinceCode, setSelectedProvinceCode] = useState<string>('');
  const [selectedCommuneCode, setSelectedCommuneCode] = useState<string>('');
  const [detailedAddress, setDetailedAddress] = useState<string>('');
  const [isLoadingProvinces, setIsLoadingProvinces] = useState<boolean>(false);
  const [isLoadingCommunes, setIsLoadingCommunes] = useState<boolean>(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);

  const { data, isLoading } = useQuery({
    queryKey: ['student', 'profile'],
    queryFn: () => studentApi.getProfile(),
  });

  const profile: ProfileData | undefined =
    (data as any)?.data?.data ?? (data as any)?.data;

  // Sync form with fetched profile (useQuery v5 has no onSuccess)
  useEffect(() => {
    if (!profile) return;
    
    // Format date of birth to yyyy-MM-dd format for HTML5 date input
    // API might return "2000-01-15 00:00:00" or "2000-01-15"
    let formattedDoB = '';
    if (profile.uDoB) {
      // Extract only the date part (yyyy-MM-dd)
      const datePart = profile.uDoB.split(' ')[0]; // "2000-01-15 00:00:00" -> "2000-01-15"
      formattedDoB = datePart;
    }
    
    setForm({
      uName: profile.uName ?? '',
      uGender: (profile.uGender ? 1 : 0) as 0 | 1,
      uAddress: profile.uAddress ?? '',
      uDoB: formattedDoB,
      bio: profile.bio ?? '',
    });
    setIsEditingAddress(!profile.uAddress);
  }, [profile]);

  // Fetch provinces when editing address
  useEffect(() => {
    if (!isEditingAddress || provinces.length > 0) return;

    const fetchProvinces = async () => {
      setIsLoadingProvinces(true);
      try {
        const res = await fetch(`${ADDRESS_API}/p/`);
        if (!res.ok) throw new Error('Failed to fetch provinces');
        const data = await res.json();
        setProvinces(
          (Array.isArray(data) ? data : []).map((p: any) => ({
            code: String(p.code),
            name: p.name,
          }))
        );
      } catch (err) {
        console.error(err);
        toast.error('Không thể tải danh sách Tỉnh/Thành phố');
      } finally {
        setIsLoadingProvinces(false);
      }
    };

    fetchProvinces();
  }, [isEditingAddress, provinces.length, toast]);

  // Auto-parse existing address when provinces are loaded and we're in edit mode
  useEffect(() => {
    if (!isEditingAddress || provinces.length === 0 || !profile?.uAddress) return;
    if (selectedProvinceCode) return; // Already parsed
    
    // Parse address format: "Số nhà, Phường/Xã, Tỉnh/Thành"
    const parts = profile.uAddress.split(', ').map(p => p.trim());
    
    if (parts.length >= 2) {
      // Get province name (last part)
      const provinceName = parts[parts.length - 1];
      const foundProvince = provinces.find(p => p.name === provinceName);
      
      if (foundProvince) {
        setSelectedProvinceCode(foundProvince.code);
        
        // Get detailed address (everything before commune and province)
        if (parts.length >= 3) {
          const detailedParts = parts.slice(0, -2);
          setDetailedAddress(detailedParts.join(', '));
        } else if (parts.length === 2) {
          // Only province, no commune - first part is detailed address
          setDetailedAddress(parts[0]);
        }
      }
    }
  }, [isEditingAddress, provinces, profile?.uAddress, selectedProvinceCode]);

  // Fetch communes when province is selected
  useEffect(() => {
    if (!selectedProvinceCode) {
      setCommunes([]);
      return;
    }

    const fetchCommunes = async () => {
      setIsLoadingCommunes(true);
      try {
        const res = await fetch(`${ADDRESS_API}/p/${selectedProvinceCode}?depth=2`);
        if (!res.ok) throw new Error('Failed to fetch communes');
        const data = await res.json();
        const fetchedCommunes: Commune[] = (data.wards || []).map((w: any) => ({
          code: String(w.code),
          name: w.name,
        }));
        setCommunes(fetchedCommunes);
        
        // Auto-select commune if we're parsing existing address
        if (profile?.uAddress && !selectedCommuneCode) {
          const parts = profile.uAddress.split(', ').map(p => p.trim());
          if (parts.length >= 3) {
            const communeName = parts[parts.length - 2];
            const foundCommune = fetchedCommunes.find((c: Commune) => c.name === communeName);
            if (foundCommune) {
              setSelectedCommuneCode(foundCommune.code);
            }
          }
        }
      } catch (err) {
        console.error(err);
        toast.error('Không thể tải danh sách Phường/Xã');
      } finally {
        setIsLoadingCommunes(false);
      }
    };

    fetchCommunes();
  }, [selectedProvinceCode, toast, profile?.uAddress, selectedCommuneCode]);

  // Parse existing address when user clicks "Thay đổi" to edit
  // (This function is no longer needed - parsing now happens automatically in useEffect)
  
  const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    setSelectedProvinceCode(code);
    setSelectedCommuneCode('');
    setDetailedAddress('');
    setForm((f) => ({ ...f, uAddress: '' }));
  };

  const handleCommuneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    setSelectedCommuneCode(code);
    
    const pName = provinces.find((p) => p.code === selectedProvinceCode)?.name || '';
    const cName = communes.find((c) => c.code === code)?.name || '';
    
    const fullAddress = [detailedAddress, cName, pName].filter(Boolean).join(', ');
    setForm((f) => ({ ...f, uAddress: fullAddress }));
  };

  const handleDetailedAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDetailedAddress(value);
    
    const pName = provinces.find((p) => p.code === selectedProvinceCode)?.name || '';
    const cName = communes.find((c) => c.code === selectedCommuneCode)?.name || '';
    
    const fullAddress = [value, cName, pName].filter(Boolean).join(', ');
    setForm((f) => ({ ...f, uAddress: fullAddress }));
  };

  const updateMutation = useMutation({
    mutationFn: () =>
      studentApi.updateProfile({
        uName: form.uName,
        uGender: !!form.uGender,
        uAddress: form.uAddress || null,
        uDoB: form.uDoB || null,
        bio: form.bio || null,
      }),
    onSuccess: () => {
      toast.success('Đã lưu thay đổi');
      queryClient.invalidateQueries({ queryKey: ['student', 'profile'] });
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Có lỗi xảy ra. Vui lòng thử lại.';
      toast.error(msg);
    },
  });

  // Real avatar upload
  const avatarMutation = useMutation({
    mutationFn: (file: File) => studentApi.uploadAvatar(file),
    onSuccess: (res: any) => {
      toast.success('Đã cập nhật ảnh đại diện');
      queryClient.invalidateQueries({ queryKey: ['student', 'profile'] });
      // Update localStorage so sidebar/header pick up the new avatar immediately
      try {
        const raw = localStorage.getItem('user');
        if (raw) {
          const u = JSON.parse(raw);
          const rawUrl = res?.data?.data?.avatar_url || res?.data?.avatar_url;
          const newUrl = getFullMediaUrl(rawUrl);
          if (newUrl) {
            u.avatar_url = newUrl;
            u.avatar = newUrl;
            localStorage.setItem('user', JSON.stringify(u));
            window.dispatchEvent(new Event('user-profile-updated'));
          }
        }
      } catch { /* non-critical */ }
    },
    onError: (err: any) => {
      const errors = err?.response?.data?.errors;
      const firstError = errors ? Object.values(errors).flat()[0] : null;
      toast.error(
        String(firstError || err?.response?.data?.message || 'Không thể tải ảnh lên.')
      );
    },
  });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Ảnh không được vượt quá 2MB.');
      return;
    }
    avatarMutation.mutate(file);
    e.target.value = '';
  };

  const initials = (form.uName || profile?.uName || 'B')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // Avatar lưu dưới dạng path tương đối (/storage/avatars/…) → resolve thành full URL backend.
  const avatarSrc = getFullMediaUrl(profile?.avatar_url);

  return (
    <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header — clickable for collapse/expand */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 p-4 sm:p-6 hover:bg-slate-50/50 transition-colors text-left"
        aria-expanded={expanded}
        aria-controls="account-info-body"
      >
        <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
          <User className="w-5 h-5 text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">Thông tin tài khoản</h2>
          <p className="text-xs sm:text-sm text-slate-500 truncate">
            Cập nhật thông tin cá nhân của bạn
          </p>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Body */}
      {expanded && (
        <div id="account-info-body" className="px-4 sm:px-6 pb-5 sm:pb-6 -mt-2">
          {/* Avatar Lightbox Preview Modal */}
          {isPreviewOpen && avatarSrc && (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-zoom-out"
              onClick={() => setIsPreviewOpen(false)}
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="absolute top-4 right-4 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Đóng xem trước"
              >
                <X className="w-6 h-6" />
              </button>

              {/* Image Container */}
              <div
                className="relative max-w-[95vw] max-h-[90vh] md:max-w-[80vw] md:max-h-[85vh] cursor-default"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={avatarSrc}
                  alt={profile?.uName}
                  className="w-full h-full object-contain rounded-2xl shadow-2xl border border-white/10"
                />
              </div>
            </div>
          )}

      {/* Avatar + Phone (readonly) */}
      <div className="flex items-center gap-4 pb-5 mb-5 border-b border-slate-100">
        <div className="relative">
          <div
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-500
                       text-white flex items-center justify-center text-xl sm:text-2xl font-bold shadow-md shadow-violet-200/60"
          >
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt={profile?.uName}
                className="w-full h-full rounded-2xl object-cover cursor-zoom-in hover:opacity-90 transition-opacity"
                onClick={() => setIsPreviewOpen(true)}
                title="Bấm để xem ảnh phóng to"
              />
            ) : (
              initials
            )}
            {avatarMutation.isPending && (
              <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-white" />
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/jpg,image/gif"
            className="hidden"
            onChange={handleAvatarChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarMutation.isPending}
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white border border-slate-200
                       text-slate-600 hover:text-violet-600 hover:border-violet-300 flex items-center justify-center
                       transition-colors shadow-sm disabled:opacity-50"
            title="Đổi ảnh đại diện"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">
            {form.uName || profile?.uName || 'Học viên'}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            <span className="font-medium">SĐT:</span> {profile?.uPhone || '—'}
            <span className="ml-1 text-slate-400">(không thể đổi)</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">JPG/PNG/GIF, tối đa 2MB</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-9 bg-slate-100 rounded-lg" />
          <div className="h-9 bg-slate-100 rounded-lg" />
          <div className="h-9 bg-slate-100 rounded-lg" />
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            updateMutation.mutate();
          }}
        >
          {/* Name */}
          <div>
            <label htmlFor="uName" className={labelBase}>Họ và tên</label>
            <input
              id="uName"
              type="text"
              className={inputBase}
              style={inputStyle}
              placeholder="Nhập họ và tên"
              value={form.uName}
              onChange={(e) => setForm((f) => ({ ...f, uName: e.target.value }))}
              maxLength={150}
              required
            />
          </div>

          {/* Gender + DoB */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="uGender" className={labelBase}>Giới tính</label>
              <select
                id="uGender"
                className={inputBase}
                style={inputStyle}
                value={form.uGender}
                onChange={(e) => setForm((f) => ({ ...f, uGender: Number(e.target.value) as 0 | 1 }))}
              >
                <option value={1}>Nam</option>
                <option value={0}>Nữ</option>
              </select>
            </div>
            <div>
              <label htmlFor="uDoB" className={labelBase}>Ngày sinh</label>
              <input
                id="uDoB"
                type="date"
                className={inputBase}
                style={inputStyle}
                value={form.uDoB}
                onChange={(e) => setForm((f) => ({ ...f, uDoB: e.target.value }))}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className={labelBase}>Địa chỉ</label>
            
            {!isEditingAddress ? (
              <div className="flex items-start justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex gap-2.5 min-w-0">
                  <MapPin className="w-5 h-5 text-violet-500 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-slate-800 font-medium leading-relaxed break-words">
                      {form.uAddress || 'Chưa thiết lập địa chỉ'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingAddress(true)}
                  className="text-xs font-semibold text-violet-600 hover:text-violet-700 flex items-center gap-1 flex-shrink-0 ml-3 transition-colors"
                >
                  Thay đổi
                </button>
              </div>
            ) : (
              <div className="space-y-3.5 p-4 bg-slate-50/50 rounded-xl border border-violet-100 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-violet-700 flex items-center gap-1.5 uppercase tracking-wider">
                    <MapPin className="w-3.5 h-3.5" /> Chọn địa chỉ
                  </span>
                  {profile?.uAddress && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingAddress(false);
                        setForm((f) => ({ ...f, uAddress: profile.uAddress ?? '' }));
                        setSelectedProvinceCode('');
                        setSelectedCommuneCode('');
                        setDetailedAddress('');
                      }}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      Hủy bỏ
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Province Select */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Tỉnh / Thành phố
                    </label>
                    <div className="relative">
                      <select
                        value={selectedProvinceCode}
                        onChange={handleProvinceChange}
                        className={`${inputBase} appearance-none pr-10`}
                        style={inputStyle}
                        disabled={isLoadingProvinces}
                      >
                        <option value="">-- Chọn Tỉnh / Thành phố --</option>
                        {provinces.map((p) => (
                          <option key={p.code} value={p.code}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      {isLoadingProvinces ? (
                        <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin text-slate-400" />
                      ) : (
                        <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                      )}
                    </div>
                  </div>

                  {/* Commune Select */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Phường / Xã / Thị trấn
                    </label>
                    <div className="relative">
                      <select
                        value={selectedCommuneCode}
                        onChange={handleCommuneChange}
                        className={`${inputBase} appearance-none pr-10`}
                        style={inputStyle}
                        disabled={!selectedProvinceCode || isLoadingCommunes}
                      >
                        <option value="">
                          {!selectedProvinceCode
                            ? 'Vui lòng chọn Tỉnh/Thành trước'
                            : '-- Chọn Phường / Xã / Thị trấn --'}
                        </option>
                        {communes.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      {isLoadingCommunes ? (
                        <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin text-slate-400" />
                      ) : (
                        <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Detailed Address */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Địa chỉ cụ thể (Số nhà, tên đường...)
                  </label>
                  <input
                    type="text"
                    placeholder="Nhập số nhà, tên đường..."
                    className={inputBase}
                    style={inputStyle}
                    value={detailedAddress}
                    onChange={handleDetailedAddressChange}
                    disabled={!selectedCommuneCode}
                  />
                </div>

                {/* Live Preview */}
                {selectedCommuneCode && (
                  <div className="p-3 bg-violet-50/50 rounded-lg border border-violet-100 text-xs">
                    <span className="font-semibold text-violet-700">Xem trước địa chỉ: </span>
                    <span className="text-slate-700">
                      {[
                        detailedAddress,
                        communes.find((c) => c.code === selectedCommuneCode)?.name,
                        provinces.find((p) => p.code === selectedProvinceCode)?.name,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bio */}
          <div>
            <label htmlFor="bio" className={labelBase}>
              Giới thiệu bản thân
              <span className="ml-1 text-slate-400 font-normal">(tối đa 500 ký tự)</span>
            </label>
            <textarea
              id="bio"
              className={`${inputBase} resize-none`}
              style={inputStyle}
              placeholder="Vài dòng về bạn..."
              rows={3}
              maxLength={500}
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            />
            <p className="text-[11px] text-slate-400 mt-1 text-right">{form.bio.length}/500</p>
          </div>

          {/* Submit */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold
                         bg-violet-600 text-white transition-all duration-200 ease-out
                         hover:bg-violet-700 hover:shadow-lg hover:shadow-violet-200 hover:-translate-y-0.5
                         active:scale-[0.98] active:shadow-md
                         disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
            >
              <Save className="w-4 h-4 transition-transform duration-200 group-hover:rotate-12 group-hover:scale-110" />
              {updateMutation.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      )}
        </div>
      )}
    </section>
  );
}
