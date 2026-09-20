import axios, { AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { getAuthToken, clearAuthData } from '../utils/authStorage';

const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
const API_TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT) || 30000;

console.log('🔧 API Base URL:', API_BASE_URL);

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: true,
});

// ─── Request Interceptor ────────────────────────────────────────────────────
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Attach authentication token
    const token = getAuthToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Khi gửi FormData, xoá Content-Type để browser/Axios tự sinh header kèm boundary
    if (config.data instanceof FormData && config.headers) {
      delete config.headers['Content-Type'];
    }

    // Development mode logging
    if (import.meta.env.DEV) {
      console.group('🚀 API Request');
      console.log('Endpoint:', config.url);
      console.log('Method:', config.method?.toUpperCase());
      console.log('Params:', config.params);
      console.log('Data:', config.data);
      console.groupEnd();
    }

    return config;
  },
  (error: AxiosError) => {
    if (import.meta.env.DEV) {
      console.error('❌ Request Error:', error);
    }
    return Promise.reject(error);
  }
);

// ─── Response Interceptor ───────────────────────────────────────────────────
api.interceptors.response.use(
  (response: AxiosResponse) => {
    // Development mode logging
    if (import.meta.env.DEV) {
      console.group('✅ API Response');
      console.log('Endpoint:', response.config.url);
      console.log('Status:', response.status);
      console.log('Data:', response.data);
      console.groupEnd();
    }

    return response;
  },
  (error: AxiosError) => {
    // Development mode logging
    if (import.meta.env.DEV) {
      console.group('❌ API Error');
      console.error('Endpoint:', error.config?.url);
      console.error('Method:', error.config?.method?.toUpperCase());
      console.error('Status:', error.response?.status);
      console.error('Data:', error.response?.data);
      console.error('Message:', error.message);
      console.groupEnd();
    }

    // Handle 503 Maintenance Mode — force logout and redirect (skip admin)
    if (error.response?.status === 503) {
      const currentPath = window.location.pathname;

      // Admin bypasses maintenance — don't redirect them
      if (currentPath.includes('/admin')) {
        return Promise.reject(error);
      }

      clearAuthData();
      const msg = encodeURIComponent('Hệ thống đang bảo trì. Vui lòng quay lại sau.');

      if (currentPath.includes('/giao-vien')) {
        window.location.href = '/giao-vien/dang-nhap?maintenance=1&message=' + msg;
      } else {
        window.location.href = '/dang-nhap?maintenance=1&message=' + msg;
      }
      return Promise.reject(error);
    }

    // Handle 401 Unauthorized — smart redirect based on current path
    if (error.response?.status === 401) {
      clearAuthData();

      const currentPath = window.location.pathname;

      // Don't redirect if already on login page
      if (currentPath.includes('/dang-nhap') || currentPath.includes('/login')) {
        return Promise.reject(error);
      }

      // Redirect based on role context
      if (currentPath.includes('/giao-vien')) {
        window.location.href = '/giao-vien/dang-nhap';
      } else if (currentPath.includes('/admin')) {
        window.location.href = '/admin/login';
      } else if (currentPath.includes('/hoc-vien')) {
        window.location.href = '/dang-nhap';
      } else {
        window.location.href = '/';
      }
    }

    return Promise.reject(error);
  }
);
