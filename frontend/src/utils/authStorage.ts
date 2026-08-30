/**
 * authStorage — Centralized auth token storage.
 *
 * remember = true  → localStorage  (persists across browser sessions)
 * remember = false → sessionStorage (cleared when tab/browser closes)
 *
 * Khoá được gắn tiền tố vai trò (`teacher_auth_token`, `student_auth_token`,
 * `admin_auth_token`) để mở hai tab với hai vai trò khác nhau mà không đè phiên
 * của nhau. Vai trò được xác định theo thứ tự ưu tiên:
 *
 *   1. Vai trò truyền vào trực tiếp (setAuthData đọc từ `user.role` trả về bởi
 *      server) — đáng tin nhất, không phụ thuộc URL hiện tại.
 *   2. Đường dẫn hiện tại, đối chiếu với ROLE_PATHS.
 *   3. Phiên đang có trong storage, chỉ dùng cho các trang trung tính thật sự
 *      (trang chủ, trang bài viết công khai…).
 *
 * Lưu ý khi sửa: hai trang đăng nhập KHÔNG nằm dưới tiền tố vai trò của mình
 * (`/dang-nhap` là của học viên nhưng không thuộc `/hoc-vien`), nên chúng phải
 * được liệt kê tường minh trong ROLE_PATHS. Bỏ sót là nguyên nhân của lỗi
 * "đăng nhập học viên ở tab thứ hai làm mất phiên giáo viên ở tab thứ nhất".
 */

export type AuthRole = 'student' | 'teacher' | 'admin';

// Define original storage methods for safe internal usage without recursion
const originalGetItem = typeof window !== 'undefined' ? Storage.prototype.getItem : () => null;
const originalSetItem = typeof window !== 'undefined' ? Storage.prototype.setItem : () => {};
const originalRemoveItem = typeof window !== 'undefined' ? Storage.prototype.removeItem : () => {};

/** Các khoá phiên cần tách theo vai trò. */
const SCOPED_KEYS = ['auth_token', 'auth_role', 'user'] as const;

const ALL_ROLES: AuthRole[] = ['admin', 'teacher', 'student'];

/**
 * Tiền tố đường dẫn → vai trò.
 *
 * Xét theo thứ tự, tiền tố cụ thể hơn đặt trước: `/giao-vien/dang-nhap` phải
 * khớp 'teacher' chứ không phải 'student' của `/dang-nhap`.
 */
const ROLE_PATHS: { prefix: string; role: AuthRole }[] = [
  { prefix: '/giao-vien', role: 'teacher' },
  { prefix: '/teacher', role: 'teacher' },
  { prefix: '/admin', role: 'admin' },
  { prefix: '/hoc-vien', role: 'student' },
  { prefix: '/student', role: 'student' },
  { prefix: '/hoc-sinh', role: 'student' }, // đường dẫn cũ, hiện chỉ redirect
  // Hai trang dưới đây là của học viên nhưng nằm ở gốc, không thuộc /hoc-vien.
  { prefix: '/dang-nhap', role: 'student' },
  { prefix: '/dang-ky', role: 'student' },
];

function normalizeRole(value: unknown): AuthRole | null {
  return value === 'student' || value === 'teacher' || value === 'admin' ? value : null;
}

/**
 * Vai trò suy từ đường dẫn. Trả về null nếu đường dẫn không thuộc vai trò nào
 * (trang chủ, blog công khai…) — khi đó bên gọi tự quyết định cách xử lý.
 */
function roleFromPath(): AuthRole | null {
  if (typeof window === 'undefined') return null;
  const path = window.location.pathname;
  for (const { prefix, role } of ROLE_PATHS) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return role;
  }
  return null;
}

/** Vai trò của phiên đang có trong storage, ưu tiên quyền cao hơn. */
function roleFromActiveSession(): AuthRole | null {
  try {
    for (const role of ALL_ROLES) {
      const key = `${role}_auth_token`;
      if (originalGetItem.call(localStorage, key) || originalGetItem.call(sessionStorage, key)) {
        return role;
      }
    }
  } catch {
    /* storage bị vô hiệu — coi như không có phiên nào */
  }
  return null;
}

/** Vai trò dùng để đọc/ghi khi không được chỉ định tường minh. */
function resolveRole(): AuthRole {
  return roleFromPath() ?? roleFromActiveSession() ?? 'student';
}

/**
 * Đọc một khoá phiên của đúng vai trò chỉ định.
 *
 * Có dự phòng về khoá không tiền tố để không đăng xuất những phiên được tạo
 * trước khi cơ chế tách theo vai trò ra đời — nhưng chỉ nhận khi vai trò của
 * phiên đó khớp. Nếu không kiểm tra, tab học viên sẽ đọc được token giáo viên
 * chỉ vì giáo viên là người ghi khoá không tiền tố sau cùng.
 */
function readScoped(store: Storage, role: AuthRole, key: string): string | null {
  const scoped = originalGetItem.call(store, `${role}_${key}`);
  if (scoped !== null) return scoped;

  const legacy = originalGetItem.call(store, key);
  if (legacy === null) return null;

  const legacyRole = originalGetItem.call(store, 'auth_role');
  return legacyRole === role ? legacy : null;
}

/**
 * Chặn localStorage/sessionStorage toàn cục để tách khoá phiên theo vai trò.
 * Cần thiết vì nhiều nơi trong app đọc/ghi trực tiếp `localStorage.getItem('user')`.
 */
if (typeof window !== 'undefined') {
  Storage.prototype.getItem = function (key: string) {
    if ((SCOPED_KEYS as readonly string[]).includes(key)) {
      return readScoped(this, resolveRole(), key);
    }
    return originalGetItem.call(this, key);
  };

  Storage.prototype.setItem = function (key: string, value: string) {
    if ((SCOPED_KEYS as readonly string[]).includes(key)) {
      originalSetItem.call(this, `${resolveRole()}_${key}`, value);
      return;
    }
    originalSetItem.call(this, key, value);
  };

  Storage.prototype.removeItem = function (key: string) {
    if ((SCOPED_KEYS as readonly string[]).includes(key)) {
      originalRemoveItem.call(this, `${resolveRole()}_${key}`);
      return;
    }
    originalRemoveItem.call(this, key);
  };
}

export function getAuthToken(): string | null {
  const role = resolveRole();
  return readScoped(localStorage, role, 'auth_token') ?? readScoped(sessionStorage, role, 'auth_token');
}

export function getAuthUser(): Record<string, unknown> | null {
  try {
    const role = resolveRole();
    const raw = readScoped(localStorage, role, 'user') ?? readScoped(sessionStorage, role, 'user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAuthData(token: string, user: Record<string, unknown>, remember: boolean): void {
  // Vai trò lấy từ user do server trả về, không suy từ URL: trang đăng nhập học
  // viên nằm ở `/dang-nhap` nên suy theo URL từng ghi nhầm sang ô của giáo viên.
  const role = normalizeRole(user.role) ?? resolveRole();

  // Chỉ dọn phiên của đúng vai trò này — các tab vai trò khác phải còn nguyên.
  clearAuthData(role);

  const keep = remember ? localStorage : sessionStorage;

  originalSetItem.call(keep, `${role}_auth_token`, token);
  originalSetItem.call(keep, `${role}_auth_role`, String(user.role ?? ''));
  originalSetItem.call(keep, `${role}_user`, JSON.stringify(user));

  if (remember) {
    // Gắn tiền tố vai trò: trước đây dùng chung một cặp remember_phone/remember_role
    // nên đăng nhập vai trò sau ghi đè lên vai trò trước, và trang đăng nhập của
    // vai trò trước mất số đã ghi nhại.
    originalSetItem.call(localStorage, `${role}_remember_phone`, String(user.phone ?? ''));
  }
}

export function getRememberedPhone(role: AuthRole): string {
  const scoped = originalGetItem.call(localStorage, `${role}_remember_phone`);
  if (scoped !== null) return scoped;

  // Phiên cũ: cặp không tiền tố, chỉ nhận khi đúng vai trò.
  const legacyRole = originalGetItem.call(localStorage, 'remember_role');
  if (legacyRole !== role) return '';
  return originalGetItem.call(localStorage, 'remember_phone') ?? '';
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

    const role = normalizeRole((data as any).role) ?? resolveRole();
    const store = originalGetItem.call(localStorage, `${role}_auth_token`) ? localStorage : sessionStorage;
    originalSetItem.call(store, `${role}_user`, JSON.stringify(merged));
    if ((data as any).role) originalSetItem.call(store, `${role}_auth_role`, String((data as any).role));

    window.dispatchEvent(new Event('user-profile-updated'));
    return merged;
  } catch {
    return getAuthUser();
  }
}

/**
 * Xoá toàn bộ cache phiên thi cục bộ của trình duyệt.
 *
 * Vì sao cần: bài thi lưu draft/timer theo `submissionId` ở localStorage
 * (examDraftStorage `exam-draft:*`, sticky deadline `thpt_deadline_*` /
 * `exam_timer_deadline_*`, cờ `thpt_fresh_start_*` ở sessionStorage). Các key
 * này KHÔNG gắn với user nào cả. Nếu không dọn khi đăng xuất/đăng nhập, học
 * viên B dùng chung trình duyệt với A sẽ thấy modal "Bạn đang có một phiên làm
 * bài chưa nộp" và nút "Làm tiếp" dù chưa thi lần nào — đúng hiện tượng đã báo.
 *
 * Chỉ xoá dữ liệu phiên thi cục bộ; đáp án đã autosave vẫn nằm ở server.
 */
export function clearExamLocalCache(): void {
  const prefixes = [
    'exam-draft:',            // examDraftStorage (kèm exam-draft:_index)
    'thpt_deadline_',         // sticky deadline THPT
    'exam_timer_deadline_',   // sticky deadline engine chung
    'thpt_fresh_start_',      // cờ bỏ qua modal sau khi restart
  ];

  const purge = (store: Storage) => {
    try {
      const doomed: string[] = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k && prefixes.some((p) => k.startsWith(p))) doomed.push(k);
      }
      // Xoá sau khi liệt kê xong — removeItem trong lúc duyệt sẽ lệch index.
      doomed.forEach((k) => originalRemoveItem.call(store, k));
    } catch {
      /* storage disabled / quota — bỏ qua, không được làm vỡ luồng logout */
    }
  };

  if (typeof window === 'undefined') return;
  purge(localStorage);
  purge(sessionStorage);
}

/**
 * Xoá phiên của MỘT vai trò.
 *
 * `role` bỏ trống thì lấy theo đường dẫn hiện tại, nên khi học viên bấm đăng
 * xuất thì chỉ phiên học viên bị xoá; tab giáo viên đang mở song song không bị
 * kéo theo. Trước đây hàm này xoá cả khoá không tiền tố nên mọi vai trò đều mất
 * phiên cùng lúc.
 *
 * Cache bài thi cục bộ chỉ dọn khi vai trò bị xoá là học viên — dữ liệu đó là
 * của người làm bài, giáo viên đăng xuất không có lý do gì để xoá.
 */
export function clearAuthData(role?: AuthRole): void {
  const target = role ?? resolveRole();

  SCOPED_KEYS.forEach((k) => {
    originalRemoveItem.call(localStorage, `${target}_${k}`);
    originalRemoveItem.call(sessionStorage, `${target}_${k}`);
  });

  // Dọn khoá không tiền tố còn lại từ các phiên tạo trước khi tách theo vai trò,
  // nhưng chỉ khi nó thuộc đúng vai trò này — nếu không sẽ xoá phiên của tab khác.
  [localStorage, sessionStorage].forEach((store) => {
    if (originalGetItem.call(store, 'auth_role') === target) {
      SCOPED_KEYS.forEach((k) => originalRemoveItem.call(store, k));
    }
  });

  originalRemoveItem.call(localStorage, 'remember_me');

  if (target === 'student') {
    clearExamLocalCache();
  }
}
