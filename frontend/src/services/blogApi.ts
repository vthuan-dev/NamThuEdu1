import { api } from './api';
import type { ApiResponse } from '../types/index';

// Types
export interface CreateBlogDto {
  blogName: string;
  blogContent: string;
  blogType: 'grammar' | 'tips' | 'vocabulary' | 'teaching' | 'news';
  blogCategory: number;
  blogUrl?: string;
  blogThumbnail?: string;
  blogStatus: 'draft' | 'pending'; // Teacher: draft hoặc pending
}

export interface UpdateBlogDto extends Partial<CreateBlogDto> {}

export interface BlogFilters {
  status?: 'draft' | 'pending' | 'active' | 'inactive';
  type?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface Blog {
  pId: number;
  pTitle: string;
  pContent: string;
  pType: string;
  pCategory: number;
  pUrl: string;
  pThumbnail: string;
  pAuthor_id: number;
  pStatus: string;
  pView: number;
  pLike: number;
  pApproved_by?: number;
  pApproved_at?: string;
  pRejected_by?: number;
  pRejected_at?: string;
  pReject_reason?: string;
  pCreated_at: string;
  author?: {
    uId: number;
    uName: string;
    uRole: string;
  };
  category?: {
    caId: number;
    caName: string;
  };
}

// Teacher Blog APIs
export const teacherBlogApi = {
  getMyBlogs: (params?: BlogFilters) => api.get('/teacher/blogs', { params }),
  getStatistics: (period: string = '30') => api.get(`/teacher/blogs/statistics?period=${period}`),
  createBlog: (data: CreateBlogDto) => api.post('/teacher/blogs', data),
  getBlogDetail: (id: number) => api.get(`/teacher/blogs/${id}`),
  updateBlog: (id: number, data: UpdateBlogDto) => api.put(`/teacher/blogs/${id}`, data),
  deleteBlog: (id: number) => api.delete(`/teacher/blogs/${id}`),
  submitForReview: (id: number) => api.put(`/teacher/blogs/${id}`, { blogStatus: 'pending' }),
};

// Category APIs (nếu cần)
export const categoryApi = {
  getCategories: () => api.get('/categories'), // Giả sử có API này
};

// Blog Types APIs
export interface BlogType {
  id: number;
  type_value: string;
  type_label: string;
  type_icon: string;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateBlogTypeDto {
  type_value: string;
  type_label: string;
  type_icon?: string;
}

export const blogTypeApi = {
  getBlogTypes: () => api.get<ApiResponse<BlogType[]>>('/teacher/blog-types'),
  createBlogType: (data: CreateBlogTypeDto) => api.post<ApiResponse<BlogType>>('/teacher/blog-types', data),
};

// Public Blog (no auth required)
export interface PublicPostFilters {
  type?: string;
  category?: number;
  search?: string;
  page?: number;
  per_page?: number;
}

/* ── In-memory cache (TTL = 5 min) ──────────────────────────────── */
const CACHE_TTL = 5 * 60 * 1000;
const _cache = new Map<string, { data: unknown; ts: number }>();

function cacheKey(url: string, params?: unknown): string {
  return url + (params ? JSON.stringify(params) : "");
}

async function cachedGet<T = unknown>(url: string, params?: unknown): Promise<T> {
  const key = cacheKey(url, params);
  const hit = _cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) {
    return hit.data as T;
  }
  const res = await api.get<ApiResponse<T>>(url, params ? { params } : undefined);
  const payload = res.data.data;
  _cache.set(key, { data: payload, ts: Date.now() });
  return payload;
}

/** Call this after a mutation so the next read is always fresh */
export function invalidatePublicBlogCache(): void {
  _cache.clear();
}

export const publicBlogApi = {
  getPosts: (params?: PublicPostFilters) => cachedGet('/public/posts', params),
  getPost:  (slug: string)               => cachedGet(`/public/posts/${slug}`),
  likePost: (id: number) => {
    invalidatePublicBlogCache();
    return api.post<ApiResponse<{ likes: number }>>(`/public/posts/${id}/like`);
  },
};
