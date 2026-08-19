/**
 * authStorage — Centralized auth token storage.
 *
 * remember = true  → localStorage  (persists across browser sessions)
 * remember = false → sessionStorage (cleared when tab/browser closes)
 *
 * Scopes keys based on role to allow concurrent multi-role logins in different tabs.
 */

// Define original storage methods for safe internal usage without recursion
const originalGetItem = typeof window !== 'undefined' ? Storage.prototype.getItem : () => null;
const originalSetItem = typeof window !== 'undefined' ? Storage.prototype.setItem : () => {};
const originalRemoveItem = typeof window !== 'undefined' ? Storage.prototype.removeItem : () => {};

// Auto-detect role based on location or active tokens
function inferRoleFromPath(): 'student' | 'teacher' | 'admin' {
  if (typeof window === 'undefined') return 'student';
  const path = window.location.pathname;
  if (path.startsWith('/giao-vien') || path.startsWith('/teacher')) return 'teacher';
  if (path.startsWith('/admin')) return 'admin';
  if (path.startsWith('/hoc-vien') || path.startsWith('/student')) return 'student';

  // Neutral paths (landing, public log-in, etc.): infer based on active sessions
  try {
    const hasAdmin = originalGetItem.call(localStorage, 'admin_auth_token') 
      || originalGetItem.call(sessionStorage, 'admin_auth_token');
    if (hasAdmin) return 'admin';

    const hasTeacher = originalGetItem.call(localStorage, 'teacher_auth_token')
      || originalGetItem.call(sessionStorage, 'teacher_auth_token');
    if (hasTeacher) return 'teacher';
  } catch (e) {
    // Fail-safe
  }
  return 'student';
}

// Intercept LocalStorage/SessionStorage globally to separate session keys by role
if (typeof window !== 'undefined') {
  const targetKeys = ['auth_token', 'auth_role', 'user'];

  Storage.prototype.getItem = function (key: string) {
    if (targetKeys.includes(key)) {
      const role = inferRoleFromPath();
      const scopedKey = `${role}_${key}`;
      const val = originalGetItem.call(this, scopedKey);
      if (val !== null) return val;
    }
    return originalGetItem.call(this, key);
  };

  Storage.prototype.setItem = function (key: string, value: string) {
    if (targetKeys.includes(key)) {
      const role = inferRoleFromPath();
      const scopedKey = `${role}_${key}`;
      originalSetItem.call(this, scopedKey, value);
    }
    originalSetItem.call(this, key, value);
  };

  Storage.prototype.removeItem = function (key: string) {
    if (targetKeys.includes(key)) {
      const role = inferRoleFromPath();
      const scopedKey = `${role}_${key}`;
      originalRemoveItem.call(this, scopedKey);
    }
    originalRemoveItem.call(this, key);
  };
}

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
  // Clear old data for current role first
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

export function getRememberedPhone(role: 'student' | 'teacher' | 'admin'): string {
  const remembered = localStorage.getItem('remember_role');
  if (remembered !== role) return '';
  return localStorage.getItem('remember_phone') ?? '';
}

/**
 * Sync user from server to override storage cache
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

    const store = localStorage.getItem('auth_token') ? localStorage : sessionStorage;
    store.setItem('user', JSON.stringify(merged));
    if ((data as any).role) store.setItem('auth_role', String((data as any).role));

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
