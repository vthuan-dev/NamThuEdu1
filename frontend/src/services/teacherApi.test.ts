/**
 * Teacher API Service Tests
 * 
 * Tests for the teacherApi service layer to verify:
 * - Axios instance configuration
 * - Request interceptor (authentication)
 * - Response interceptor (error handling)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import teacherApi from './teacherApi';

describe('teacherApi Configuration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should have correct base configuration', () => {
    expect(teacherApi.client.defaults.baseURL).toBeDefined();
    expect(teacherApi.client.defaults.headers['Content-Type']).toBe('application/json');
    expect(teacherApi.client.defaults.headers['Accept']).toBe('application/json');
    expect(teacherApi.client.defaults.timeout).toBe(30000);
  });

  it('should attach Bearer token from localStorage in request interceptor', async () => {
    const testToken = 'test-token-123';
    localStorage.setItem('auth_token', testToken);

    // Create a mock adapter to intercept the request
    const mockAdapter = vi.fn((config) => {
      expect(config.headers.Authorization).toBe(`Bearer ${testToken}`);
      return Promise.resolve({
        data: { status: 'success' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      });
    });

    teacherApi.client.defaults.adapter = mockAdapter;

    await teacherApi.client.get('/test-endpoint');

    expect(mockAdapter).toHaveBeenCalled();
  });

  it('should not attach Authorization header when token is missing', async () => {
    // Ensure no token in localStorage
    localStorage.clear();

    const mockAdapter = vi.fn((config) => {
      expect(config.headers.Authorization).toBeUndefined();
      return Promise.resolve({
        data: { status: 'success' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      });
    });

    teacherApi.client.defaults.adapter = mockAdapter;

    await teacherApi.client.get('/test-endpoint');

    expect(mockAdapter).toHaveBeenCalled();
  });

  it('should clear token and redirect on 401 error', async () => {
    const testToken = 'test-token-123';
    localStorage.setItem('auth_token', testToken);

    // Mock window.location
    const locationSpy = vi.spyOn(window, 'location', 'get').mockReturnValue({ href: '', pathname: '/hoc-vien/test' } as any);

    const mockAdapter = vi.fn(() => {
      return Promise.reject({
        response: {
          status: 401,
          statusText: 'Unauthorized',
          data: { message: 'Unauthorized' },
        },
        config: {},
      });
    });

    teacherApi.client.defaults.adapter = mockAdapter;

    try {
      await teacherApi.client.get('/test-endpoint');
    } catch (error) {
      // Expected to throw
    }

    // Verify token was cleared
    expect(localStorage.getItem('auth_token')).toBeNull();

    // Verify redirect to login page
    expect(window.location.href).toBe('/dang-nhap');

    locationSpy.mockRestore();
  });

  it('should not redirect on non-401 errors', async () => {
    const testToken = 'test-token-123';
    localStorage.setItem('auth_token', testToken);

    // Mock window.location
    const locationSpy = vi.spyOn(window, 'location', 'get').mockReturnValue({ href: '', pathname: '/hoc-vien/test' } as any);

    const mockAdapter = vi.fn(() => {
      return Promise.reject({
        response: {
          status: 500,
          statusText: 'Internal Server Error',
          data: { message: 'Server error' },
        },
        config: {},
      });
    });

    teacherApi.client.defaults.adapter = mockAdapter;

    try {
      await teacherApi.client.get('/test-endpoint');
    } catch (error) {
      // Expected to throw
    }

    // Verify token was NOT cleared
    expect(localStorage.getItem('auth_token')).toBe(testToken);

    // Verify NO redirect
    expect(window.location.href).toBe('');

    locationSpy.mockRestore();
  });
});

describe('teacherApi Development Mode Logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should log requests in development mode', async () => {
    // Mock console methods
    const consoleGroupSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});

    const mockAdapter = vi.fn((config) => {
      return Promise.resolve({
        data: { status: 'success' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      });
    });

    teacherApi.client.defaults.adapter = mockAdapter;

    await teacherApi.client.get('/test-endpoint');

    // In development mode, console.group should be called
    if (import.meta.env.DEV) {
      expect(consoleGroupSpy).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalled();
      expect(consoleGroupEndSpy).toHaveBeenCalled();
    }

    consoleGroupSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleGroupEndSpy.mockRestore();
  });
});
