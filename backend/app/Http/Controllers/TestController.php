<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Storage;
use App\Models\Exam;
use App\Models\User;

class TestController extends Controller
{
    /**
     * @OA\Post(
     *     path="/tests/upload",
     *     tags={"Test Management"},
     *     summary="Upload test file",
     *     description="Upload test file (Excel/CSV) and create exam record",
     *     security={{"bearerAuth":{}}},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\MediaType(
     *             mediaType="multipart/form-data",
     *             @OA\Schema(
     *                 required={"file", "title"},
     *                 @OA\Property(
     *                     property="file",
     *                     type="string",
     *                     format="binary",
     *                     description="Test file (Excel/CSV, max 10MB)"
     *                 ),
     *                 @OA\Property(property="title", type="string", example="VSTEP Sample Test"),
     *                 @OA\Property(property="description", type="string", example="Sample test for VSTEP preparation"),
     *                 @OA\Property(property="type", type="string", enum={"VSTEP", "IELTS"}, example="VSTEP")
     *             )
     *         )
     *     ),
     *     @OA\Response(
     *         response=201,
     *         description="File uploaded successfully"
     *     ),
     *     @OA\Response(
     *         response=400,
     *         description="Validation error"
     *     ),
     *     @OA\Response(
     *         response=403,
     *         description="Unauthorized - teacher role required"
     *     )
     * )
     *
     * POST /api/tests/upload
     * Upload file test (Excel/CSV)
     */
    public function upload(Request $request)
    {
        try {
            // Validation
            $validator = Validator::make($request->all(), [
                'file' => 'required|file|mimes:xlsx,xls,csv|max:10240', // 10MB max
                'title' => 'required|string|max:255',
                'description' => 'nullable|string',
                'type' => 'nullable|string|in:VSTEP,IELTS',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 400);
            }

            // Check authentication
            $user = auth()->user();
            if (!$user || $user->uRole !== 'teacher') {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Unauthorized. Only teachers can upload tests.'
                ], 403);
            }

            // Store file
            $file = $request->file('file');
            $filename = time() . '_' . $file->getClientOriginalName();
            $path = $file->storeAs('uploads/tests', $filename, 'public');

            // Create exam record
            $exam = Exam::create([
                'exam_type_id' => 1, // Default VSTEP
                'exam_code' => 'UPLOAD-' . time(),
                'eTitle' => $request->title,
                'eDescription' => $request->description ?? 'Uploaded from file',
                'eType' => 'VSTEP',
                'eSkill' => 'mixed',
                'eScope' => 'full',
                'eDifficulty_level' => 'intermediate',
                'eDuration' => 120, // Default 2 hours
                'eTotal_score' => 100,
                'eStatus' => 'draft',
                'eVisibility' => 'private',
                'teacher_id' => $user->uId,
                'eTeacher_id' => $user->uId,
            ]);

            return response()->json([
                'status' => 'success',
                'message' => 'File uploaded successfully',
                'data' => [
                    'exam_id' => $exam->eId,
                    'filename' => $filename,
                    'path' => $path,
                    'size' => $file->getSize(),
                    'mime_type' => $file->getMimeType(),
                ]
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Upload failed: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * @OA\Get(
     *     path="/tests",
     *     tags={"Tests"},
     *     summary="Get public tests",
     *     description="Get list of public published tests available to all users",
     *     @OA\Response(
     *         response=200,
     *         description="Tests retrieved successfully"
     *     ),
     *     @OA\Response(
     *         response=500,
     *         description="Server error"
     *     )
     * )
     *
     * GET /api/tests
     * Danh sách test public (chỉ published + public)
     */
    public function index(Request $request)
    {
        try {
            // Public catalog only: never leak private/draft exams unauthenticated
            $exams = Exam::query()
                ->where('eStatus', 'published')
                ->where(function ($query) {
                    $query->where('eVisibility', 'public')
                          ->orWhereNull('eVisibility');
                })
                ->orderBy('eCreated_at', 'desc')
                ->get();

            // Format response to match old backend
            $tests = $exams->map(function ($exam) {
                return [
                    'id' => $exam->eId,
                    'title' => $exam->eTitle,
                    'description' => $exam->eDescription,
                    'type' => $exam->eType ?? 'VSTEP',
                    'skill' => $exam->eSkill ?? 'listening',
                    'duration' => $exam->eDuration ?? 120,
                    'total_score' => $exam->eTotal_score ?? 100,
                    'status' => $exam->eStatus ?? 'published',
                    'visibility' => $exam->eVisibility ?? 'public',
                    'created_at' => $exam->eCreated_at,
                ];
            });

            return response()->json([
                'status' => 'success',
                'data' => $tests,
                'total' => $tests->count()
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Failed to fetch tests'
            ], 500);
        }
    }
}
