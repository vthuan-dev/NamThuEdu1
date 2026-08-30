<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Carbon\Carbon;

/**
 * @OA\Tag(
 *     name="Age Group",
 *     description="Age group and theme management endpoints"
 * )
 */
class AgeGroupController extends Controller
{
    /**
     * @OA\Get(
     *     path="/api/user/age-group",
     *     summary="Get user's age group",
     *     tags={"Age Group"},
     *     security={{"sanctum":{}}},
     *     @OA\Response(
     *         response=200,
     *         description="Age group retrieved successfully"
     *     )
     * )
     */
    public function getAgeGroup(Request $request)
    {
        $user = Auth::user();
        
        return response()->json([
            'age_group' => $user->age_group,
            'date_of_birth' => $user->date_of_birth,
            'theme_preference' => $user->theme_preference,
            'calculated_age' => $this->calculateAge($user->date_of_birth),
        ]);
    }

    /**
     * @OA\Post(
     *     path="/api/user/age-group",
     *     summary="Update user's age group",
     *     tags={"Age Group"},
     *     security={{"sanctum":{}}},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             @OA\Property(property="date_of_birth", type="string", format="date", example="2010-05-15"),
     *             @OA\Property(property="age_group", type="string", enum={"kids", "teens", "adults"})
     *         )
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Age group updated successfully"
     *     )
     * )
     */
    public function updateAgeGroup(Request $request)
    {
        $user = Auth::user();
        
        $validated = $request->validate([
            'date_of_birth' => 'nullable|date|before:today',
            'age_group' => 'nullable|in:kids,teens,adults',
        ]);

        // Ngày sinh luôn được lưu nếu gửi lên.
        if (isset($validated['date_of_birth'])) {
            $user->date_of_birth = $validated['date_of_birth'];
        }

        // Ưu tiên age_group tường minh, ngày sinh chỉ dùng để suy ra.
        //
        // Trước đây nhánh date_of_birth đứng trước và dùng if/elseif, nên khi
        // client gửi cả hai thì age_group bị bỏ qua hoàn toàn — cùng họ lỗi với
        // createSingleStudent: người dùng chọn một nhóm tuổi rồi nhận về nhóm
        // khác mà không hiểu tại sao.
        if (isset($validated['age_group'])) {
            $user->age_group = $validated['age_group'];
        } elseif (isset($validated['date_of_birth'])) {
            $user->age_group = $this->calculateAgeGroup($validated['date_of_birth']);
        }


        $user->theme_updated_at = now();
        $user->save();

        return response()->json([
            'message' => 'Age group updated successfully',
            'age_group' => $user->age_group,
            'date_of_birth' => $user->date_of_birth,
        ]);
    }

    /**
     * @OA\Get(
     *     path="/api/user/theme-preference",
     *     summary="Get user's theme preference",
     *     tags={"Age Group"},
     *     security={{"sanctum":{}}},
     *     @OA\Response(
     *         response=200,
     *         description="Theme preference retrieved"
     *     )
     * )
     */
    public function getThemePreference(Request $request)
    {
        $user = Auth::user();
        
        return response()->json([
            'theme_preference' => $user->theme_preference,
            'age_group' => $user->age_group,
            'effective_theme' => $user->theme_preference === 'auto' 
                ? $user->age_group 
                : $user->theme_preference,
        ]);
    }

    /**
     * @OA\Post(
     *     path="/api/user/theme-preference",
     *     summary="Update user's theme preference",
     *     tags={"Age Group"},
     *     security={{"sanctum":{}}},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             @OA\Property(
     *                 property="theme_preference", 
     *                 type="string", 
     *                 enum={"auto", "kids", "teens", "adults"}
     *             )
     *         )
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Theme preference updated"
     *     )
     * )
     */
    public function updateThemePreference(Request $request)
    {
        $user = Auth::user();
        
        $validated = $request->validate([
            'theme_preference' => 'required|in:auto,kids,teens,adults',
        ]);

        $user->theme_preference = $validated['theme_preference'];
        $user->theme_updated_at = now();
        $user->save();

        return response()->json([
            'message' => 'Theme preference updated successfully',
            'theme_preference' => $user->theme_preference,
            'effective_theme' => $user->theme_preference === 'auto' 
                ? $user->age_group 
                : $user->theme_preference,
        ]);
    }

    /**
     * Calculate age from date of birth
     */
    private function calculateAge(?string $dateOfBirth): ?int
    {
        if (!$dateOfBirth) {
            return null;
        }

        return Carbon::parse($dateOfBirth)->age;
    }

    /**
     * Calculate age group from date of birth
     */
    private function calculateAgeGroup(string $dateOfBirth): string
    {
        $age = $this->calculateAge($dateOfBirth);

        if ($age >= 6 && $age <= 12) {
            return 'kids';
        } elseif ($age >= 13 && $age <= 17) {
            return 'teens';
        } else {
            return 'adults';
        }
    }
}
