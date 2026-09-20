import { useState, useCallback } from "react";
import { teacherBlogApi, Blog, CreateBlogDto, BlogFilters } from "../services/blogApi";

interface UseBlogReturn {
  blogs: Blog[];
  loading: boolean;
  error: string | null;
  fetchBlogs: (filters?: BlogFilters) => Promise<void>;
  createBlog: (data: CreateBlogDto) => Promise<Blog>;
  updateBlog: (id: number, data: Partial<CreateBlogDto>) => Promise<Blog>;
  deleteBlog: (id: number) => Promise<void>;
  submitForReview: (id: number) => Promise<Blog>;
}

export function useBlog(): UseBlogReturn {
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBlogs = useCallback(async (filters?: BlogFilters) => {
    setLoading(true);
    setError(null);
    try {
      const response = await teacherBlogApi.getMyBlogs(filters);
      // API trả về { status: 'success', data: [...] }
      const data = response.data?.data ?? response.data ?? [];
      setBlogs(Array.isArray(data) ? data : []);
    } catch (err: any) {
      const msg = err.response?.data?.message || "Không thể tải danh sách bài viết";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const createBlog = useCallback(async (data: CreateBlogDto): Promise<Blog> => {
    const response = await teacherBlogApi.createBlog(data);
    const newBlog = response.data?.data ?? response.data;
    const message = response.data?.message;
    const result: Blog = { ...newBlog, message };
    setBlogs((prev) => [result, ...prev]);
    return result;
  }, []);

  const updateBlog = useCallback(async (id: number, data: Partial<CreateBlogDto>): Promise<Blog> => {
    const response = await teacherBlogApi.updateBlog(id, data);
    const updated = response.data?.data ?? response.data;
    const message = response.data?.message;
    const result: Blog = { ...updated, message };
    setBlogs((prev) => prev.map((b) => (b.pId === id ? result : b)));
    return result;
  }, []);

  const deleteBlog = useCallback(async (id: number): Promise<void> => {
    await teacherBlogApi.deleteBlog(id);
    setBlogs((prev) => prev.filter((b) => b.pId !== id));
  }, []);

  const submitForReview = useCallback(async (id: number): Promise<Blog> => {
    const response = await teacherBlogApi.submitForReview(id);
    const updated = response.data?.data ?? response.data;
    const message = response.data?.message;
    const result: Blog = { ...updated, message };
    setBlogs((prev) =>
      prev.map((b) => (b.pId === id ? { ...b, ...result } : b))
    );
    return result;
  }, []);

  return { blogs, loading, error, fetchBlogs, createBlog, updateBlog, deleteBlog, submitForReview };
}
