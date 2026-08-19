import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getAuthToken, getAuthUser, setAuthData, clearAuthData } from './authStorage';

describe('authStorage - Role-scoped session isolation', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.stubGlobal('location', { pathname: '/' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should save data to student scoped keys when pathname is a student path', () => {
    vi.stubGlobal('location', { pathname: '/hoc-vien' });
    setAuthData('test_token', { id: 1, role: 'student' }, true);

    expect(localStorage.getItem('student_auth_token')).toBe('test_token');
    expect(localStorage.getItem('auth_token')).toBe('test_token'); // compatibility key
    expect(getAuthToken()).toBe('test_token');
  });

  it('should save data to teacher scoped keys when pathname is a teacher path', () => {
    vi.stubGlobal('location', { pathname: '/giao-vien/exams' });
    setAuthData('teacher_token', { id: 2, role: 'teacher' }, true);

    expect(localStorage.getItem('teacher_auth_token')).toBe('teacher_token');
    expect(localStorage.getItem('auth_token')).toBe('teacher_token');
    expect(getAuthToken()).toBe('teacher_token');
  });

  it('should isolate student and teacher sessions concurrently', () => {
    // 1. Log in as student
    vi.stubGlobal('location', { pathname: '/hoc-vien' });
    setAuthData('student_token', { id: 1, role: 'student' }, true);

    // 2. Log in as teacher
    vi.stubGlobal('location', { pathname: '/giao-vien' });
    setAuthData('teacher_token', { id: 2, role: 'teacher' }, true);

    // Verify localStorage has both scoped values
    expect(localStorage.getItem('student_auth_token')).toBe('student_token');
    expect(localStorage.getItem('teacher_auth_token')).toBe('teacher_token');

    // 3. Requesting token from student path should return student token
    vi.stubGlobal('location', { pathname: '/hoc-vien/dashboard' });
    expect(getAuthToken()).toBe('student_token');

    // 4. Requesting token from teacher path should return teacher token
    vi.stubGlobal('location', { pathname: '/giao-vien/settings' });
    expect(getAuthToken()).toBe('teacher_token');
  });

  it('should fallback correctly on neutral paths based on active sessions', () => {
    // Log in as teacher
    vi.stubGlobal('location', { pathname: '/giao-vien' });
    setAuthData('teacher_token', { id: 2, role: 'teacher' }, true);

    // Navigate to landing page "/"
    vi.stubGlobal('location', { pathname: '/' });
    expect(getAuthToken()).toBe('teacher_token');
  });
});
