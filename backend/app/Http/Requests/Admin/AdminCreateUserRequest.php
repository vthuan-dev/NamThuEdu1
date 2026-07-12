<?php

namespace App\Http\Requests\Admin;

/**
 * Validation cho POST /api/admin/users (UserController::adminCreateUser).
 *
 * Rule giữ nguyên 100% so với inline Validator cũ — chỉ chuyển chỗ ở.
 */
class AdminCreateUserRequest extends AdminFormRequest
{
    protected function unauthorizedMessage(): string
    {
        return 'Chỉ quản trị viên mới có quyền tạo tài khoản.';
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'phone'    => 'required|string|unique:users,uPhone',
            // Optional: if omitted/empty, controller defaults to "user123"
            'password' => 'nullable|string|min:6',
            'name'     => 'required|string|max:150',
            'role'     => 'required|in:student,teacher,admin',
            'status'   => 'nullable|in:active,inactive',
            'dob'      => 'nullable|date',
            'address'  => 'nullable|string',
            'gender'   => 'nullable|boolean',
            'class'    => 'nullable|integer',
            'age_group'=> 'nullable|in:kids,teens,adults',
        ];
    }
}
