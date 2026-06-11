<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use App\Models\Post;
use App\Models\User;

class BlogController extends Controller
{
    /**
     * Lưu thumbnail: nếu là chuỗi base64 (data URI) thì decode, ghi ra file
     * trong public/uploads/blog và trả về đường dẫn tương đối để lưu DB.
     * Nếu đã là URL/đường dẫn thì giữ nguyên.
     */
    private function saveBase64Thumbnail(?string $value): string
    {
        if (empty($value)) {
            return '';
        }

        // Không phải base64 data URI -> coi như đã là URL/đường dẫn, giữ nguyên
        if (!preg_match('/^data:image\/([a-zA-Z0-9.+\-]+);base64,/', $value, $matches)) {
            return $value;
        }

        $extension = strtolower($matches[1]);
        if ($extension === 'svg+xml') {
            $extension = 'svg';
        }
        if (!in_array($extension, ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'])) {
            $extension = 'png';
        }

        $data = base64_decode(substr($value, strpos($value, ',') + 1), true);
        if ($data === false) {
            return '';
        }

        $dir = public_path('uploads/blog');
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }

        $fileName = time() . '_' . uniqid() . '.' . $extension;
        file_put_contents($dir . DIRECTORY_SEPARATOR . $fileName, $data);

        // Trả về URL tuyệt đối (theo APP_URL) để hiển thị trực tiếp ở mọi nơi
        return asset('uploads/blog/' . $fileName);
    }

    /**
     * @OA\Get(
     *     path="/teacher/blogs",
     *     tags={"Blog Management"},
     *     summary="Get teacher blogs",
     *     description="Get list of blogs created by authenticated teacher",
     *     security={{"bearerAuth":{}}},
     *     @OA\Response(
     *         response=200,
     *         description="Blogs retrieved successfully"
     *     ),
     *     @OA\Response(
     *         response=401,
     *         description="Unauthorized"
     *     )
     * )
     * 
     * GET /api/teacher/blogs
     * Lấy danh sách bài viết của teacher
     */
    public function index(Request $request)
    {
        $user = $request->user();

        // Note: Trong code cũ có comment check role, tôi sẽ giữ logic đó
        // if (!$user || $user->uRole !== 'teacher') {
        //     return response()->json([
        //         'status' => 'error',
        //         'message' => 'Bạn không có quyền truy cập.'
        //     ], 401);
        // }

        $blogs = Post::with(['author', 'category'])
                    ->byAuthor($user->uId)
                    ->whereNull('pDeleted_at')
                    ->orderBy('pCreated_at', 'desc')
                    ->get();

        return response()->json([
            'status' => 'success',
            'data' => $blogs
        ]);
    }

    /**
     * @OA\Post(
     *     path="/teacher/blogs",
     *     tags={"Blog Management"},
     *     summary="Create new blog",
     *     description="Create a new blog post (teacher only)",
     *     security={{"bearerAuth":{}}},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"blogName", "blogContent", "blogType", "blogCategory"},
     *             @OA\Property(property="blogName", type="string", example="Grammar Tips for VSTEP"),
     *             @OA\Property(property="blogContent", type="string", example="Detailed content about grammar..."),
     *             @OA\Property(property="blogType", type="string", enum={"grammar", "tips", "vocabulary"}, example="grammar"),
     *             @OA\Property(property="blogCategory", type="integer", example=1),
     *             @OA\Property(property="blogUrl", type="string", example="grammar-tips-vstep"),
     *             @OA\Property(property="blogThumbnail", type="string", example="thumbnail.jpg")
     *         )
     *     ),
     *     @OA\Response(
     *         response=201,
     *         description="Blog created successfully"
     *     ),
     *     @OA\Response(
     *         response=400,
     *         description="Validation error"
     *     ),
     *     @OA\Response(
     *         response=401,
     *         description="Unauthorized"
     *     )
     * )
     * 
     * POST /api/teacher/blogs
     * Tạo bài viết mới
     */
    public function store(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $validator = Validator::make($request->all(), [
            'blogName' => 'required|string|max:255',
            'blogContent' => 'required|string',
            'blogType' => 'nullable|string|exists:blog_types,type_value',
            'blogCategory' => 'nullable|integer', // Removed exists validation temporarily
            'blogUrl' => 'nullable|string',
            'blogThumbnail' => 'nullable|string',
            'blogStatus' => 'nullable|in:draft,pending,published',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Dữ liệu không đầy đủ.',
                'errors' => $validator->errors()
            ], 400);
        }

        $blog = Post::create([
            'pTitle' => $request->blogName,
            'pContent' => $request->blogContent,
            'pType' => $request->blogType ?? 'teaching',
            'pCategory' => $request->blogCategory ?? 1,
            'pUrl' => $request->blogUrl ?? '',
            'pThumbnail' => $this->saveBase64Thumbnail($request->blogThumbnail),
            'pAuthor_id' => $user->uId,
            'pStatus' => $request->blogStatus ?? 'draft',
            'pView' => 0,
            'pLike' => 0,
        ]);

        return response()->json([
            'status' => 'success',
            'data' => $blog,
            'message' => 'Tạo blog thành công.'
        ]);
    }

    /**
     * @OA\Get(
     *     path="/teacher/blogs/{id}",
     *     tags={"Blog Management"},
     *     summary="Get blog details",
     *     description="Get detailed information about a specific blog",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer"),
     *         example=1
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Blog details retrieved successfully"
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Blog not found"
     *     ),
     *     @OA\Response(
     *         response=401,
     *         description="Unauthorized"
     *     )
     * )
     * 
     * GET /api/teacher/blogs/{id}
     * Lấy chi tiết bài viết
     */
    public function show(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $blog = Post::with(['author', 'category'])
                   ->where('pId', $id)
                   ->where('pAuthor_id', $user->uId)
                   ->whereNull('pDeleted_at')
                   ->first();

        if (!$blog) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy bài viết.'
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'data' => $blog
        ]);
    }

    /**
     * @OA\Put(
     *     path="/teacher/blogs/{id}",
     *     tags={"Blog Management"},
     *     summary="Update blog",
     *     description="Update blog information",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             @OA\Property(property="blogName", type="string"),
     *             @OA\Property(property="blogContent", type="string"),
     *             @OA\Property(property="blogType", type="string", enum={"grammar", "tips", "vocabulary"}),
     *             @OA\Property(property="blogCategory", type="integer"),
     *             @OA\Property(property="blogUrl", type="string"),
     *             @OA\Property(property="blogThumbnail", type="string"),
     *             @OA\Property(property="pStatus", type="string", enum={"active", "inactive", "draft"})
     *         )
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Blog updated successfully"
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Blog not found"
     *     ),
     *     @OA\Response(
     *         response=401,
     *         description="Unauthorized"
     *     )
     * )
     * 
     * PUT /api/teacher/blogs/{id}
     * Cập nhật bài viết
     */
    public function update(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Không có quyền.'
            ], 401);
        }

        $blog = Post::where('pId', $id)
                   ->where('pAuthor_id', $user->uId)
                   ->whereNull('pDeleted_at')
                   ->first();

        if (!$blog) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy bài viết.'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'blogName' => 'sometimes|required|string|max:255',
            'blogContent' => 'sometimes|required|string',
            'blogType' => 'sometimes|required|string|exists:blog_types,type_value',
            'blogCategory' => 'sometimes|required|integer', // Removed exists validation temporarily
            'blogUrl' => 'nullable|string',
            'blogThumbnail' => 'nullable|string',
            'blogStatus' => 'sometimes|required|in:draft,pending,published',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Dữ liệu không hợp lệ.',
                'errors' => $validator->errors()
            ], 400);
        }

        $updateData = [];
        if ($request->has('blogName')) $updateData['pTitle'] = $request->blogName;
        if ($request->has('blogContent')) $updateData['pContent'] = $request->blogContent;
        if ($request->has('blogType')) $updateData['pType'] = $request->blogType;
        if ($request->has('blogCategory')) $updateData['pCategory'] = $request->blogCategory;
        if ($request->has('blogUrl')) $updateData['pUrl'] = $request->blogUrl;
        if ($request->has('blogThumbnail')) $updateData['pThumbnail'] = $this->saveBase64Thumbnail($request->blogThumbnail);
        if ($request->has('blogStatus')) $updateData['pStatus'] = $request->blogStatus;

        $blog->update($updateData);

        return response()->json([
            'status' => 'success',
            'data' => $blog,
            'message' => 'Cập nhật bài viết thành công.'
        ]);
    }

    /**
     * @OA\Delete(
     *     path="/teacher/blogs/{id}",
     *     tags={"Blog Management"},
     *     summary="Delete blog",
     *     description="Delete a blog (soft delete)",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Blog deleted successfully"
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Blog not found"
     *     ),
     *     @OA\Response(
     *         response=401,
     *         description="Unauthorized"
     *     )
     * )
     * 
     * DELETE /api/teacher/blogs/{id}
     * Xóa bài viết (soft delete)
     */
    public function destroy(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Không có quyền.'
            ], 401);
        }

        $blog = Post::where('pId', $id)
                   ->where('pAuthor_id', $user->uId)
                   ->whereNull('pDeleted_at')
                   ->first();

        if (!$blog) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy bài viết.'
            ], 404);
        }

        $blog->update(['pDeleted_at' => now()]);

        return response()->json([
            'status' => 'success',
            'data' => [
                'DELETE_BLOG_SUCCESS',
                'Xóa bài viết thành công',
                null,
                200
            ]
        ]);
    }

    /* ========================================
     * ADMIN METHODS - Content Moderation
     * ======================================== */

    /**
     * @OA\Get(
     *     path="/admin/posts",
     *     tags={"Admin - Content Management"},
     *     summary="Get all posts for moderation (Admin only)",
     *     description="Get list of all posts with filtering for content moderation",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="status",
     *         in="query",
     *         required=false,
     *         @OA\Schema(type="string", enum={"draft", "pending", "approved", "rejected"})
     *     ),
     *     @OA\Parameter(
     *         name="author_id",
     *         in="query",
     *         required=false,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Parameter(
     *         name="search",
     *         in="query",
     *         required=false,
     *         @OA\Schema(type="string")
     *     ),
     *     @OA\Response(response=200, description="Posts retrieved successfully"),
     *     @OA\Response(response=403, description="Admin access required")
     * )
     * 
     * GET /api/admin/posts
     * Duyệt bài viết của giáo viên (Admin only)
     */
    public function adminPosts(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'admin') {
            return response()->json([
                'status' => 'error',
                'message' => 'Chỉ quản trị viên mới có quyền truy cập.'
            ], 403);
        }

        $query = Post::with(['author', 'category'])
                    ->whereNull('pDeleted_at');

        // Filter by status
        if ($request->has('status')) {
            $query->where('pStatus', $request->status);
        }

        // Filter by author
        if ($request->has('author_id')) {
            $query->where('pAuthor_id', $request->author_id);
        }

        // Filter by type
        if ($request->has('type')) {
            $query->where('pType', $request->type);
        }

        // Filter by category
        if ($request->has('category')) {
            $query->where('pCategory', $request->category);
        }

        // Search
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('pTitle', 'LIKE', "%{$search}%")
                  ->orWhere('pContent', 'LIKE', "%{$search}%");
            });
        }

        // Sort
        $sortBy = $request->get('sort_by', 'pCreated_at');
        $sortOrder = $request->get('sort_order', 'desc');
        $query->orderBy($sortBy, $sortOrder);

        $paginate = $request->get('paginate') === 'true';
        $posts = $paginate
            ? $query->paginate((int) $request->get('per_page', 20))
            : $query->get();

        return response()->json([
            'status' => 'success',
            'data' => $posts
        ]);
    }

    /**
     * @OA\Get(
     *     path="/admin/posts/{id}",
     *     tags={"Admin - Content Management"},
     *     summary="Get post details for moderation (Admin only)",
     *     description="Get detailed information about a specific post for moderation",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(response=200, description="Post details retrieved successfully"),
     *     @OA\Response(response=404, description="Post not found"),
     *     @OA\Response(response=403, description="Admin access required")
     * )
     * 
     * GET /api/admin/posts/{id}
     * Xem chi tiết bài viết (Admin)
     */
    public function adminPostDetail(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'admin') {
            return response()->json([
                'status' => 'error',
                'message' => 'Chỉ quản trị viên mới có quyền truy cập.'
            ], 403);
        }

        $post = Post::with(['author', 'category'])
                   ->where('pId', $id)
                   ->first();

        if (!$post) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy bài viết.'
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'data' => $post
        ]);
    }

    /**
     * @OA\Post(
     *     path="/admin/posts/{id}/approve",
     *     tags={"Admin - Content Management"},
     *     summary="Approve post (Admin only)",
     *     description="Approve a pending post for publication",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(response=200, description="Post approved successfully"),
     *     @OA\Response(response=404, description="Post not found"),
     *     @OA\Response(response=400, description="Post already approved"),
     *     @OA\Response(response=403, description="Admin access required")
     * )
     * 
     * POST /api/admin/posts/{id}/approve
     * Duyệt bài viết
     */
    public function approvePost(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'admin') {
            return response()->json([
                'status' => 'error',
                'message' => 'Chỉ quản trị viên mới có quyền duyệt bài viết.'
            ], 403);
        }

        $post = Post::where('pId', $id)->first();

        if (!$post) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy bài viết.'
            ], 404);
        }

        if ($post->pStatus === 'active') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bài viết đã được duyệt rồi.'
            ], 400);
        }

        $post->update([
            'pStatus' => 'active',
            'pApproved_by' => $user->uId,
            'pApproved_at' => now()
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Post approved successfully',
            'data' => [
                'post_id' => $post->pId,
                'post_title' => $post->pTitle,
                'approved_by' => $user->uName,
                'approved_at' => now()->toISOString()
            ]
        ]);
    }

    /**
     * @OA\Post(
     *     path="/admin/posts/{id}/reject",
     *     tags={"Admin - Content Management"},
     *     summary="Reject post (Admin only)",
     *     description="Reject a pending post with optional reason",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\RequestBody(
     *         required=false,
     *         @OA\JsonContent(
     *             @OA\Property(property="reason", type="string", example="Content does not meet guidelines")
     *         )
     *     ),
     *     @OA\Response(response=200, description="Post rejected successfully"),
     *     @OA\Response(response=404, description="Post not found"),
     *     @OA\Response(response=403, description="Admin access required")
     * )
     * 
     * POST /api/admin/posts/{id}/reject
     * Từ chối bài viết
     */
    public function rejectPost(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'admin') {
            return response()->json([
                'status' => 'error',
                'message' => 'Chỉ quản trị viên mới có quyền từ chối bài viết.'
            ], 403);
        }

        $post = Post::where('pId', $id)->first();

        if (!$post) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy bài viết.'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'reason' => 'required|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Vui lòng nhập lý do từ chối.',
                'errors' => $validator->errors()
            ], 400);
        }

        $post->update([
            'pStatus' => 'inactive',
            'pRejected_by' => $user->uId,
            'pRejected_at' => now(),
            'pReject_reason' => $request->reason
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Post rejected successfully',
            'data' => [
                'post_id' => $post->pId,
                'post_title' => $post->pTitle,
                'reason' => $request->reason,
                'rejected_by' => $user->uName,
                'rejected_at' => now()->toISOString()
            ]
        ]);
    }

    /**
     * @OA\Delete(
     *     path="/admin/posts/{id}",
     *     tags={"Admin - Content Management"},
     *     summary="Delete post (Admin only)",
     *     description="Permanently delete a post",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(response=200, description="Post deleted successfully"),
     *     @OA\Response(response=404, description="Post not found"),
     *     @OA\Response(response=403, description="Admin access required")
     * )
     * 
     * DELETE /api/admin/posts/{id}
     * Xóa bài viết (Admin)
     */
    public function adminDeletePost(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'admin') {
            return response()->json([
                'status' => 'error',
                'message' => 'Chỉ quản trị viên mới có quyền xóa bài viết.'
            ], 403);
        }

        $post = Post::where('pId', $id)->first();

        if (!$post) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy bài viết.'
            ], 404);
        }

        $post->update(['pDeleted_at' => now()]);

        return response()->json([
            'status' => 'success',
            'message' => 'Post deleted successfully'
        ]);
    }

    /**
     * @OA\Get(
     *     path="/admin/posts/pending",
     *     tags={"Admin - Content Management"},
     *     summary="Get pending posts (Admin only)",
     *     description="Get list of posts waiting for approval",
     *     security={{"bearerAuth":{}}},
     *     @OA\Response(response=200, description="Pending posts retrieved successfully"),
     *     @OA\Response(response=403, description="Admin access required")
     * )
     * 
     * GET /api/admin/posts/pending
     * Danh sách bài viết chờ duyệt
     */
    public function pendingPosts(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'admin') {
            return response()->json([
                'status' => 'error',
                'message' => 'Chỉ quản trị viên mới có quyền truy cập.'
            ], 403);
        }

        $pendingPosts = Post::with(['author', 'category'])
                           ->where('pStatus', 'pending')
                           ->whereNull('pDeleted_at')
                           ->orderBy('pCreated_at', 'desc')
                           ->get();

        return response()->json([
            'status' => 'success',
            'data' => $pendingPosts
        ]);
    }

    /**
     * @OA\Get(
     *     path="/admin/content/statistics",
     *     tags={"Admin - Content Management"},
     *     summary="Get content statistics (Admin only)",
     *     description="Get comprehensive content management statistics",
     *     security={{"bearerAuth":{}}},
     *     @OA\Response(response=200, description="Content statistics retrieved successfully"),
     *     @OA\Response(response=403, description="Admin access required")
     * )
     * 
     * GET /api/admin/content/statistics
     * Thống kê nội dung
     */
    public function contentStatistics(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'admin') {
            return response()->json([
                'status' => 'error',
                'message' => 'Chỉ quản trị viên mới có quyền truy cập.'
            ], 403);
        }

        // Posts statistics
        $totalPosts = Post::whereNull('pDeleted_at')->count();
        $activePosts = Post::where('pStatus', 'active')->whereNull('pDeleted_at')->count();
        $draftPosts = Post::where('pStatus', 'draft')->whereNull('pDeleted_at')->count();
        $inactivePosts = Post::where('pStatus', 'inactive')->whereNull('pDeleted_at')->count();

        // Posts by type
        $postsByType = Post::whereNull('pDeleted_at')
                          ->selectRaw('pType, COUNT(*) as count')
                          ->groupBy('pType')
                          ->pluck('count', 'pType');

        // Posts by author (top 5)
        $postsByAuthor = Post::with('author')
                            ->whereNull('pDeleted_at')
                            ->selectRaw('pAuthor_id, COUNT(*) as count')
                            ->groupBy('pAuthor_id')
                            ->orderByDesc('count')
                            ->limit(5)
                            ->get()
                            ->map(function($item) {
                                return [
                                    'author_name' => $item->author->uName ?? 'Unknown',
                                    'post_count' => $item->count
                                ];
                            });

        // Recent activity
        $recentPosts = Post::where('pCreated_at', '>=', now()->subDays(7))
                          ->whereNull('pDeleted_at')
                          ->count();

        return response()->json([
            'status' => 'success',
            'data' => [
                'total_posts' => $totalPosts,
                'approved_posts' => $activePosts,
                'pending_posts' => $draftPosts,
                'rejected_posts' => $inactivePosts,
                'by_type' => $postsByType,
                'by_author' => $postsByAuthor,
                'recent_posts' => $recentPosts,
            ]
        ]);
    }

    /**
     * GET /api/teacher/blog-types
     * Lấy danh sách loại bài viết
     */
    public function getBlogTypes(Request $request)
    {
        $blogTypes = \App\Models\BlogType::orderBy('sort_order')->get();

        return response()->json([
            'status' => 'success',
            'data' => $blogTypes
        ]);
    }

    /**
     * POST /api/teacher/blog-types
     * Tạo loại bài viết mới
     */
    public function createBlogType(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'type_value' => 'required|string|max:50|unique:blog_types,type_value',
            'type_label' => 'required|string|max:100',
            'type_icon' => 'nullable|string|max:50',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Get the highest sort_order and add 1
        $maxSortOrder = \App\Models\BlogType::max('sort_order') ?? 0;

        $blogType = \App\Models\BlogType::create([
            'type_value' => strtolower($request->type_value),
            'type_label' => $request->type_label,
            'type_icon' => $request->type_icon ?? 'FileText',
            'is_default' => false,
            'sort_order' => $maxSortOrder + 1,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Blog type created successfully',
            'data' => $blogType
        ], 201);
    }

    /**
     * @OA\Get(
     *     path="/teacher/blogs/statistics",
     *     tags={"Blog Management"},
     *     summary="Get blog statistics",
     *     description="Get comprehensive blog statistics for the authenticated teacher",
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(
     *         name="period",
     *         in="query",
     *         required=false,
     *         @OA\Schema(type="string", enum={"7", "30", "90", "365", "all"}, default="30")
     *     ),
     *     @OA\Response(response=200, description="Statistics retrieved successfully"),
     *     @OA\Response(response=401, description="Unauthorized")
     * )
     * 
     * GET /api/teacher/blogs/statistics
     * Lấy thống kê blog của teacher
     */
    public function statistics(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->uRole !== 'teacher') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền truy cập.'
            ], 401);
        }

        $period = $request->get('period', '30');
        
        // Calculate date range
        $dateFrom = null;
        if ($period !== 'all') {
            $dateFrom = now()->subDays((int)$period);
        }

        // Base query for teacher's posts
        $baseQuery = Post::where('pAuthor_id', $user->uId)
                        ->whereNull('pDeleted_at');

        // Overview statistics
        $totalPosts = (clone $baseQuery)->count();
        $totalViews = (clone $baseQuery)->sum('pView') ?? 0;
        $totalLikes = (clone $baseQuery)->sum('pLike') ?? 0;
        $totalComments = 0; // TODO: Add comments table later

        // Previous period for comparison
        $prevDateFrom = null;
        $prevDateTo = null;
        if ($period !== 'all') {
            $prevDateTo = now()->subDays((int)$period);
            $prevDateFrom = now()->subDays((int)$period * 2);
        }

        // Calculate changes
        $prevPosts = Post::where('pAuthor_id', $user->uId)
                        ->whereNull('pDeleted_at')
                        ->when($prevDateFrom, fn($q) => $q->whereBetween('pCreated_at', [$prevDateFrom, $prevDateTo]))
                        ->count();
        
        $prevViews = Post::where('pAuthor_id', $user->uId)
                        ->whereNull('pDeleted_at')
                        ->when($prevDateFrom, fn($q) => $q->whereBetween('pCreated_at', [$prevDateFrom, $prevDateTo]))
                        ->sum('pView') ?? 0;

        $prevLikes = Post::where('pAuthor_id', $user->uId)
                        ->whereNull('pDeleted_at')
                        ->when($prevDateFrom, fn($q) => $q->whereBetween('pCreated_at', [$prevDateFrom, $prevDateTo]))
                        ->sum('pLike') ?? 0;

        // Calculate percentage changes
        $postsChange = $prevPosts > 0 ? round((($totalPosts - $prevPosts) / $prevPosts) * 100) : 0;
        $viewsChange = $prevViews > 0 ? round((($totalViews - $prevViews) / $prevViews) * 100) : 0;
        $likesChange = $prevLikes > 0 ? round((($totalLikes - $prevLikes) / $prevLikes) * 100) : 0;

        // Views over time (last 10 data points)
        $viewsOverTime = [];
        $days = $period === 'all' ? 30 : min((int)$period, 30);
        for ($i = $days - 1; $i >= 0; $i--) {
            $date = now()->subDays($i);
            $views = Post::where('pAuthor_id', $user->uId)
                        ->whereNull('pDeleted_at')
                        ->whereDate('pCreated_at', '<=', $date)
                        ->sum('pView') ?? 0;
            
            $viewsOverTime[] = [
                'date' => $date->format('d/m'),
                'views' => $views
            ];
        }

        // Posts by category
        $postsByCategory = Post::where('pAuthor_id', $user->uId)
                              ->whereNull('pDeleted_at')
                              ->selectRaw('pType, COUNT(*) as count')
                              ->groupBy('pType')
                              ->get()
                              ->map(function($item) {
                                  $colors = [
                                      'grammar' => '#8B5CF6',
                                      'tips' => '#06B6D4',
                                      'vocabulary' => '#F59E0B',
                                      'teaching' => '#10B981',
                                      'news' => '#EF4444',
                                  ];
                                  return [
                                      'category' => ucfirst($item->pType),
                                      'count' => $item->count,
                                      'color' => $colors[$item->pType] ?? '#64748B'
                                  ];
                              });

        // Top performing posts
        $topPosts = Post::where('pAuthor_id', $user->uId)
                       ->whereNull('pDeleted_at')
                       ->orderByDesc('pView')
                       ->limit(5)
                       ->get()
                       ->map(function($post) {
                           return [
                               'id' => $post->pId,
                               'title' => $post->pTitle,
                               'views' => $post->pView ?? 0,
                               'likes' => $post->pLike ?? 0,
                               'comments' => 0, // TODO: Add comments
                               'status' => $post->pStatus
                           ];
                       });

        // Category performance
        $categoryPerformance = Post::where('pAuthor_id', $user->uId)
                                  ->whereNull('pDeleted_at')
                                  ->selectRaw('pType, COUNT(*) as posts, SUM(pView) as views, SUM(pLike) as likes')
                                  ->groupBy('pType')
                                  ->get()
                                  ->map(function($item) {
                                      $icons = [
                                          'grammar' => 'Type',
                                          'tips' => 'Lightbulb',
                                          'vocabulary' => 'BookMarked',
                                          'teaching' => 'GraduationCap',
                                          'news' => 'Newspaper',
                                      ];
                                      $colors = [
                                          'grammar' => '#8B5CF6',
                                          'tips' => '#06B6D4',
                                          'vocabulary' => '#F59E0B',
                                          'teaching' => '#10B981',
                                          'news' => '#EF4444',
                                      ];
                                      $engagement = $item->views > 0 
                                          ? round((($item->likes) / $item->views) * 100, 1)
                                          : 0;
                                      
                                      return [
                                          'category' => ucfirst($item->pType),
                                          'icon' => $icons[$item->pType] ?? 'BookOpen',
                                          'color' => $colors[$item->pType] ?? '#64748B',
                                          'posts' => $item->posts,
                                          'views' => $item->views ?? 0,
                                          'engagement' => $engagement
                                      ];
                                  });

        // Engagement metrics
        $avgViews = $totalPosts > 0 ? round($totalViews / $totalPosts) : 0;
        $engagementRate = $totalViews > 0 ? round((($totalLikes) / $totalViews) * 100, 1) : 0;
        $activeCount = Post::where('pAuthor_id', $user->uId)
                          ->where('pStatus', 'active')
                          ->whereNull('pDeleted_at')
                          ->count();
        $publishRate = $totalPosts > 0 ? round(($activeCount / $totalPosts) * 100) : 0;

        return response()->json([
            'status' => 'success',
            'data' => [
                'overview' => [
                    'totalPosts' => $totalPosts,
                    'totalViews' => $totalViews,
                    'totalLikes' => $totalLikes,
                    'totalComments' => $totalComments,
                    'changes' => [
                        'posts' => $postsChange,
                        'views' => $viewsChange,
                        'likes' => $likesChange,
                        'comments' => 0
                    ]
                ],
                'viewsOverTime' => $viewsOverTime,
                'postsByCategory' => $postsByCategory,
                'topPosts' => $topPosts,
                'categoryPerformance' => $categoryPerformance,
                'engagement' => [
                    'avgViews' => $avgViews,
                    'engagementRate' => $engagementRate,
                    'publishRate' => $publishRate
                ]
            ]
        ]);
    }

    /**
     * GET /api/public/posts
     * Danh sách bài viết đã duyệt (không cần auth)
     */
    public function publicIndex(Request $request)
    {
        $query = Post::with(['author:uId,uName', 'category:caId,caName'])
            ->whereIn('pStatus', ['active', 'published'])
            ->whereNull('pDeleted_at');

        if ($request->filled('type')) {
            $query->where('pType', $request->type);
        }

        if ($request->filled('category')) {
            $query->where('pCategory', $request->category);
        }

        if ($request->filled('search')) {
            $query->where('pTitle', 'LIKE', '%' . $request->search . '%');
        }

        $perPage = min((int) $request->get('per_page', 12), 50);
        $posts = $query->orderBy('pCreated_at', 'desc')->paginate($perPage);

        return response()->json([
            'status' => 'success',
            'data'   => $posts,
        ]);
    }

    /**
     * GET /api/public/posts/{slug}
     * Chi tiết bài viết (slug hoặc pId), tăng view count
     */
    public function publicShow($slug)
    {
        $post = Post::with(['author:uId,uName', 'category:caId,caName'])
            ->whereIn('pStatus', ['active', 'published'])
            ->whereNull('pDeleted_at')
            ->where(function ($q) use ($slug) {
                $q->where('pUrl', $slug)
                  ->orWhere('pId', is_numeric($slug) ? (int) $slug : 0);
            })
            ->first();

        if (!$post) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Không tìm thấy bài viết.',
            ], 404);
        }

        $post->increment('pView');

        return response()->json([
            'status' => 'success',
            'data'   => $post,
        ]);
    }
}
