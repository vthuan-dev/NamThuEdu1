<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class FileUploadController extends Controller
{
    /**
     * Upload audio file for exam questions
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function uploadAudio(Request $request): JsonResponse
    {
        try {
            // Log request info
            \Log::info('Audio upload request received', [
                'has_file' => $request->hasFile('audio'),
                'file_size' => $request->hasFile('audio') ? $request->file('audio')->getSize() : 0,
                'question_id' => $request->input('questionId'),
                'all_files' => $request->allFiles(),
                'content_length' => $request->header('Content-Length')
            ]);
            
            // Validate request
            $validator = Validator::make($request->all(), [
                'audio' => 'required|file|mimes:mp3,wav,m4a,aac,ogg|max:51200', // 50MB max
                'questionId' => 'required|string'
            ]);

            if ($validator->fails()) {
                \Log::error('Audio upload validation failed', [
                    'errors' => $validator->errors()->toArray(),
                    'has_file' => $request->hasFile('audio'),
                    'file_info' => $request->hasFile('audio') ? [
                        'size' => $request->file('audio')->getSize(),
                        'mime' => $request->file('audio')->getMimeType(),
                        'original' => $request->file('audio')->getClientOriginalName()
                    ] : null
                ]);
                
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 400);
            }

            $audioFile = $request->file('audio');
            $questionId = $request->input('questionId');

            // Generate unique filename
            $originalName = $audioFile->getClientOriginalName();
            $extension = $audioFile->getClientOriginalExtension();
            $filename = 'exam_audio_' . $questionId . '_' . time() . '_' . Str::random(8) . '.' . $extension;

            // Store in public/storage/exam_audio directory
            $path = $audioFile->storeAs('exam_audio', $filename, 'public');

            if (!$path) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to store audio file'
                ], 500);
            }

            // Generate public URL - use /files/audio/ instead of /storage/
            $audioUrl = url('files/audio/' . $filename);

            // Log upload info
            \Log::info('Audio uploaded successfully', [
                'question_id' => $questionId,
                'original_name' => $originalName,
                'stored_path' => $path,
                'full_url' => $audioUrl,
                'file_size' => $audioFile->getSize(),
                'mime_type' => $audioFile->getMimeType()
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Audio uploaded successfully',
                'data' => [
                    'audioUrl' => $audioUrl,
                    'filename' => $filename,
                    'originalName' => $originalName,
                    'path' => $path,
                    'size' => $audioFile->getSize(),
                    'mimeType' => $audioFile->getMimeType()
                ]
            ]);

        } catch (\Exception $e) {
            \Log::error('Audio upload error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Internal server error during audio upload',
                'error' => config('app.debug') ? $e->getMessage() : 'Upload failed'
            ], 500);
        }
    }

    /**
     * Upload image file for exam questions
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function uploadImage(Request $request): JsonResponse
    {
        try {
            $validator = Validator::make($request->all(), [
                'image' => 'required|image|mimes:jpeg,jpg,png,gif,svg,webp|max:20480', // 20MB max
                'questionId' => 'required|string'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 400);
            }

            $imageFile = $request->file('image');
            $questionId = $request->input('questionId');

            $originalName = $imageFile->getClientOriginalName();
            $extension = $imageFile->getClientOriginalExtension();
            $filename = 'exam_image_' . $questionId . '_' . time() . '_' . Str::random(8) . '.' . $extension;

            $path = $imageFile->storeAs('exam_images', $filename, 'public');

            if (!$path) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to store image file'
                ], 500);
            }

            $imageUrl = asset('storage/' . $path);

            \Log::info('Image uploaded successfully', [
                'question_id' => $questionId,
                'original_name' => $originalName,
                'stored_path' => $path,
                'file_size' => $imageFile->getSize()
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Image uploaded successfully',
                'data' => [
                    'imageUrl' => $imageUrl,
                    'filename' => $filename,
                    'originalName' => $originalName,
                    'path' => $path,
                    'size' => $imageFile->getSize()
                ]
            ]);

        } catch (\Exception $e) {
            \Log::error('Image upload error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Internal server error during image upload',
                'error' => config('app.debug') ? $e->getMessage() : 'Upload failed'
            ], 500);
        }
    }

    /**
     * Delete uploaded file
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function deleteFile(Request $request): JsonResponse
    {
        try {
            $validator = Validator::make($request->all(), [
                'path' => 'required|string',
                'type' => 'required|in:audio,image'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 400);
            }

            $path = $request->input('path');

            if (Storage::disk('public')->exists($path)) {
                Storage::disk('public')->delete($path);
                
                \Log::info('File deleted successfully', ['path' => $path]);
                
                return response()->json([
                    'success' => true,
                    'message' => 'File deleted successfully'
                ]);
            }

            return response()->json([
                'success' => false,
                'message' => 'File not found'
            ], 404);

        } catch (\Exception $e) {
            \Log::error('File deletion error', [
                'error' => $e->getMessage(),
                'path' => $request->input('path')
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Internal server error during file deletion'
            ], 500);
        }
    }
}