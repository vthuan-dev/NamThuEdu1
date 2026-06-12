/**
 * API Configuration
 * Centralized API URL management from environment variables
 */

// API Base URL from environment
export const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;

// Backend URL (without /api suffix) for asset URLs.
// LƯU Ý: phải dùng regex neo cuối chuỗi (\/api\/?$), KHÔNG dùng .replace('/api','')
// vì chuỗi "https://api.namthuedu.vn/api" có "/api" xuất hiện sớm trong "//api..."
// → .replace('/api','') sẽ cắt nhầm thành "https:/.namthuedu.vn/api" làm hỏng URL ảnh.
export const BACKEND_URL = (API_BASE_URL || '').replace(/\/api\/?$/, '');

// API Timeout
export const API_TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT) || 30000;

/**
 * Helper function to get full asset URL
 * @param path - Relative path to asset (e.g., 'storage/avatars/image.jpg')
 * @returns Full URL to asset
 */
export function getAssetUrl(path: string): string {
  if (!path) return '';
  
  // If path already starts with http/https, return as is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  return `${BACKEND_URL}/${cleanPath}`;
}

/**
 * Helper function to get API endpoint URL
 * @param endpoint - API endpoint (e.g., 'teacher/students')
 * @returns Full API URL
 */
export function getApiUrl(endpoint: string): string {
  // Remove leading slash if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  
  return `${API_BASE_URL}/${cleanEndpoint}`;
}
