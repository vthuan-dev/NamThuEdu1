/**
 * authStorage — Centralized auth token storage.
 *
 * remember = true  → localStorage  (persists across browser sessions)
 * remember = false → sessionStorage (cleared when tab/browser closes)
 *
 * Both ProtectedRoute and AuthGuard check BOTH storages so either path works.
 */

export function getAuthToken(): string | null {
  return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
}

export function getAuthUser(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem('user') || sessionStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAuthData(token: string, user: Record<string, unknown>, remember: boolean): void {
  // CRITICAL: Clear ALL auth data from BOTH storages first to prevent old user data leaking
  clearAuthData();
  
  const keep = remember ? localStorage : sessionStorage;

  keep.setItem('auth_token', token);
  keep.setItem('auth_role', String(user.role ?? ''));
  keep.setItem('user', JSON.stringify(user));

  if (remember) {
    localStorage.setItem('remember_phone', String(user.phone ?? ''));
    localStorage.setItem('remember_role', String(user.role ?? ''));
  }
}

export function getRememberedPhone(role: 'student' | 'teacher'): string {
  const remembered = localStorage.getItem('remember_role');
  if (remembered !== role) return '';
  return localStorage.getItem('remember_phone') ?? '';
}

/**
 * Đồng bộ user từ SERVER (nguồn thật) → ghi đè cache trong storage đang giữ token.
 *
 * Lý do: localStorage/sessionStorage chỉ là cache, có thể cũ/sai (vd: giáo viên
 * đổi age_group, hoặc dữ liệu lưu từ phiên cũ). Các quyết định quan trọng
 * (age_group, role) nên lấy từ DB qua /user/profile thay vì tin cache.
 *
 * An toàn: nếu gọi lỗi/không có token → giữ nguyên cache hiện tại, không xoá.
 */
export async function refreshAuthUserFromServer(): Promise<Record<string, unknown> | null> {
  const token = getAuthToken();
  if (!token) return null;
  try {
    const { API_BASE_URL } = await import('./apiConfig');
    const res = await fetch(`${API_BASE_URL}/user/profile`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!res.ok) return getAuthUser();
    const json = await res.json();
    const data = json?.data;
    if (!data || typeof data !== 'object') return getAuthUser();

    const current = getAuthUser() ?? {};
    const merged = { ...current, ...data };

    // Ghi lại vào đúng storage đang giữ token (local nếu "ghi nhớ", còn lại session).
    const store = localStorage.getItem('auth_token') ? localStorage : sessionStorage;
    store.setItem('user', JSON.stringify(merged));
    if ((data as any).role) store.setItem('auth_role', String((data as any).role));

    // Báo cho các component đang lắng nghe (vd avatar/age_group) cập nhật.
    window.dispatchEvent(new Event('user-profile-updated'));
    return merged;
  } catch {
    return getAuthUser();
  }
}

export function clearAuthData(): void {
  ['auth_token', 'auth_role', 'user'].forEach((k) => {
    localStorage.removeItem(k);
    sessionStorage.removeItem(k);
  });
  localStorage.removeItem('remember_me');
}
