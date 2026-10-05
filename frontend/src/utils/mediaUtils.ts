/**
 * Media URL utilities
 * Handles conversion between relative and absolute URLs for media files
 */

/**
 * Get the base URL for the API (without /api suffix)
 */
export const getApiBaseUrl = (): string => {
  // Try to get base URL directly first
  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  if (baseUrl) {
    return baseUrl;
  }
  
  // Fallback: extract from API URL
  const apiUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
  return apiUrl.replace(/\/api\/?$/, '');
};

/**
 * Convert a relative media URL to a full URL
 * @param url - Relative URL (e.g., /storage/kids-exams/images/xxx.png) or full URL
 * @returns Full URL (e.g., http://example.com/storage/kids-exams/images/xxx.png)
 */
export const getFullMediaUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;

  let cleanUrl = String(url).trim();
  if (!cleanUrl) return null;

  // Upgrade http:// to https:// when on https or for namthuedu.vn to prevent mixed content
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    cleanUrl = cleanUrl.replace(/^http:\/\//i, 'https://');
  } else if (cleanUrl.startsWith('http://namthuedu.vn') || cleanUrl.startsWith('http://www.namthuedu.vn')) {
    cleanUrl = cleanUrl.replace(/^http:\/\//i, 'https://');
  }
  
  // If already a full URL, return as is
  if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
    return cleanUrl;
  }
  
  // Convert relative URL to full URL
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}${cleanUrl.startsWith('/') ? '' : '/'}${cleanUrl}`;
};

/**
 * Check if a URL is a valid media URL
 */
export const isValidMediaUrl = (url: string | null | undefined): boolean => {
  if (!url) return false;
  
  try {
    const fullUrl = getFullMediaUrl(url);
    if (!fullUrl) return false;
    
    new URL(fullUrl);
    return true;
  } catch {
    return false;
  }
};

/**
 * Get media type from URL
 */
export const getMediaTypeFromUrl = (url: string): 'audio' | 'image' | 'unknown' => {
  const audioExtensions = ['.mp3', '.wav', '.m4a', '.mp4', '.ogg', '.webm'];
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  
  const lowerUrl = url.toLowerCase();
  
  if (audioExtensions.some(ext => lowerUrl.endsWith(ext))) {
    return 'audio';
  }
  
  if (imageExtensions.some(ext => lowerUrl.endsWith(ext))) {
    return 'image';
  }
  
  return 'unknown';
};
