import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getAuthToken, getAuthUser, setAuthData, clearAuthData, getRememberedPhone } from './authStorage';

/**
 * Tái hiện lỗi lẫn phiên khi mở hai tab với hai vai trò khác nhau.
 *
 * Bối cảnh: authStorage gắn tiền tố vai trò vào khoá (`teacher_auth_token`,
 * `student_auth_token`) để hai tab dùng được hai phiên song song. Vai trò được
 * suy ra từ `location.pathname`.
 *
 * Vấn đề: trang đăng nhập học viên là `/dang-nhap` — KHÔNG nằm dưới `/hoc-vien`.
 * Với đường dẫn không thuộc vai trò nào, hàm suy luận rơi vào nhánh dự phòng
 * "đã có phiên nào thì lấy phiên đó", nên khi đang có phiên giáo viên nó trả về
 * 'teacher'. Học viên đăng nhập ở tab thứ hai sẽ ghi/xoá đúng vào ô của giáo viên.
 */
describe('authStorage — lẫn phiên giữa hai tab', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.stubGlobal('location', { pathname: '/' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('học viên đăng nhập ở /dang-nhap không được xoá phiên giáo viên', () => {
    // Tab A: giáo viên đăng nhập (đường dẫn /giao-vien/dang-nhap → suy ra đúng 'teacher')
    vi.stubGlobal('location', { pathname: '/giao-vien/dang-nhap' });
    setAuthData('TEACHER_TOKEN', { id: 2, role: 'teacher' }, true);
    expect(localStorage.getItem('teacher_auth_token')).toBe('TEACHER_TOKEN');

    // Tab B: học viên đăng nhập tại /dang-nhap (đường dẫn trung tính)
    vi.stubGlobal('location', { pathname: '/dang-nhap' });
    setAuthData('STUDENT_TOKEN', { id: 1, role: 'student' }, true);

    // Phiên giáo viên phải còn nguyên
    expect(localStorage.getItem('teacher_auth_token')).toBe('TEACHER_TOKEN');
    // và phiên học viên phải nằm đúng ô của mình
    expect(localStorage.getItem('student_auth_token')).toBe('STUDENT_TOKEN');
  });

  it('tab giáo viên sau khi học viên đăng nhập vẫn đọc ra token giáo viên', () => {
    vi.stubGlobal('location', { pathname: '/giao-vien/dang-nhap' });
    setAuthData('TEACHER_TOKEN', { id: 2, role: 'teacher' }, true);

    vi.stubGlobal('location', { pathname: '/dang-nhap' });
    setAuthData('STUDENT_TOKEN', { id: 1, role: 'student' }, true);

    // Tab giáo viên F5 → đọc lại từ storage
    vi.stubGlobal('location', { pathname: '/giao-vien/de-thi' });
    expect(getAuthToken()).toBe('TEACHER_TOKEN');
    expect(getAuthUser()?.role).toBe('teacher');
  });

  it('tab học viên vẫn đọc ra token học viên', () => {
    vi.stubGlobal('location', { pathname: '/giao-vien/dang-nhap' });
    setAuthData('TEACHER_TOKEN', { id: 2, role: 'teacher' }, true);

    vi.stubGlobal('location', { pathname: '/dang-nhap' });
    setAuthData('STUDENT_TOKEN', { id: 1, role: 'student' }, true);

    vi.stubGlobal('location', { pathname: '/hoc-vien/de-thi' });
    expect(getAuthToken()).toBe('STUDENT_TOKEN');
    expect(getAuthUser()?.role).toBe('student');
  });

  it('đăng xuất ở tab học viên không được làm mất phiên giáo viên', () => {
    vi.stubGlobal('location', { pathname: '/giao-vien/dang-nhap' });
    setAuthData('TEACHER_TOKEN', { id: 2, role: 'teacher' }, true);

    vi.stubGlobal('location', { pathname: '/hoc-vien' });
    setAuthData('STUDENT_TOKEN', { id: 1, role: 'student' }, true);

    // Học viên đăng xuất
    vi.stubGlobal('location', { pathname: '/hoc-vien' });
    clearAuthData();

    // Tab giáo viên phải không bị ảnh hưởng
    vi.stubGlobal('location', { pathname: '/giao-vien' });
    expect(getAuthToken()).toBe('TEACHER_TOKEN');
    expect(getAuthUser()?.role).toBe('teacher');
  });

  it('không được đọc chéo token khi vai trò hiện tại chưa có phiên', () => {
    // Chỉ có phiên giáo viên
    vi.stubGlobal('location', { pathname: '/giao-vien/dang-nhap' });
    setAuthData('TEACHER_TOKEN', { id: 2, role: 'teacher' }, true);

    // Mở đường dẫn học viên khi chưa đăng nhập học viên → phải coi là chưa đăng nhập,
    // KHÔNG được mượn token của giáo viên.
    vi.stubGlobal('location', { pathname: '/hoc-vien' });
    expect(getAuthToken()).toBeNull();
    expect(getAuthUser()).toBeNull();
  });

  it('mỗi vai trò đọc đúng user của mình, không lẫn thông tin', () => {
    vi.stubGlobal('location', { pathname: '/giao-vien/dang-nhap' });
    setAuthData('TEACHER_TOKEN', { id: 2, role: 'teacher', name: 'Giáo viên A' }, true);

    vi.stubGlobal('location', { pathname: '/dang-nhap' });
    setAuthData('STUDENT_TOKEN', { id: 1, role: 'student', name: 'Học viên B' }, true);

    vi.stubGlobal('location', { pathname: '/giao-vien' });
    expect(getAuthUser()?.name).toBe('Giáo viên A');

    vi.stubGlobal('location', { pathname: '/hoc-vien' });
    expect(getAuthUser()?.name).toBe('Học viên B');
  });

  it('phiên admin độc lập với hai vai trò còn lại', () => {
    vi.stubGlobal('location', { pathname: '/admin/login' });
    setAuthData('ADMIN_TOKEN', { id: 3, role: 'admin' }, true);

    vi.stubGlobal('location', { pathname: '/giao-vien/dang-nhap' });
    setAuthData('TEACHER_TOKEN', { id: 2, role: 'teacher' }, true);

    vi.stubGlobal('location', { pathname: '/dang-nhap' });
    setAuthData('STUDENT_TOKEN', { id: 1, role: 'student' }, true);

    vi.stubGlobal('location', { pathname: '/admin/users' });
    expect(getAuthToken()).toBe('ADMIN_TOKEN');

    vi.stubGlobal('location', { pathname: '/giao-vien' });
    expect(getAuthToken()).toBe('TEACHER_TOKEN');

    vi.stubGlobal('location', { pathname: '/hoc-vien' });
    expect(getAuthToken()).toBe('STUDENT_TOKEN');
  });

  it('trang đăng ký /dang-ky cũng được coi là của học viên', () => {
    vi.stubGlobal('location', { pathname: '/giao-vien/dang-nhap' });
    setAuthData('TEACHER_TOKEN', { id: 2, role: 'teacher' }, true);

    vi.stubGlobal('location', { pathname: '/dang-ky' });
    setAuthData('STUDENT_TOKEN', { id: 1, role: 'student' }, true);

    expect(localStorage.getItem('teacher_auth_token')).toBe('TEACHER_TOKEN');
    expect(localStorage.getItem('student_auth_token')).toBe('STUDENT_TOKEN');
  });

  it('số điện thoại ghi nhớ tách riêng theo vai trò', () => {
    vi.stubGlobal('location', { pathname: '/giao-vien/dang-nhap' });
    setAuthData('TEACHER_TOKEN', { id: 2, role: 'teacher', phone: '0900000002' }, true);

    vi.stubGlobal('location', { pathname: '/dang-nhap' });
    setAuthData('STUDENT_TOKEN', { id: 1, role: 'student', phone: '0900000001' }, true);

    // Trang đăng nhập giáo viên phải vẫn điền sẵn số của giáo viên,
    // không bị lần đăng nhập học viên sau đó ghi đè.
    expect(getRememberedPhone('teacher')).toBe('0900000002');
    expect(getRememberedPhone('student')).toBe('0900000001');
    expect(getRememberedPhone('admin')).toBe('');
  });

  it('không ghi nhớ số khi remember = false', () => {
    vi.stubGlobal('location', { pathname: '/giao-vien/dang-nhap' });
    setAuthData('TEACHER_TOKEN', { id: 2, role: 'teacher', phone: '0900000002' }, false);

    expect(getRememberedPhone('teacher')).toBe('');
    // remember = false → token nằm ở sessionStorage
    expect(sessionStorage.getItem('teacher_auth_token')).toBe('TEACHER_TOKEN');
    expect(localStorage.getItem('teacher_auth_token')).toBeNull();
  });

  // Không test được ở đây: nhánh dự phòng đọc khoá KHÔNG tiền tố trong readScoped.
  // Muốn dựng bối cảnh đó phải ghi thẳng `auth_token` thô, nhưng authStorage đã
  // thay Storage.prototype.setItem nên mọi lệnh ghi trong test đều tự động được
  // gắn tiền tố — test sẽ đo sai thứ. Nhánh đó chỉ phục vụ phiên tạo bởi script
  // chạy trước khi app khởi động (xem e2e/utils/helpers.ts) và được kiểm ở tầng E2E.
});



