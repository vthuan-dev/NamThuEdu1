<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Carbon\Carbon;

/**
 * AdminAccountSeeder
 *
 * Tạo/cập nhật tài khoản admin đăng nhập bằng "admin" / "admin123".
 * Đăng nhập bằng SĐT; AuthController map "admin" -> 0900000000, nên tài khoản
 * này đặt ở uPhone 0900000000.
 *
 * Idempotent: updateOrCreate theo uPhone → chạy lại an toàn.
 */
class AdminAccountSeeder extends Seeder
{
    public function run(): void
    {
        User::updateOrCreate(
            ['uPhone' => '0900000000'],
            [
                'uName'     => 'admin',
                'uEmail'    => 'admin@namthuedu.vn',
                'uPassword' => Hash::make('admin123'),
                'uRole'     => 'admin',
                'uStatus'   => 'active',
                'uGender'   => true,
                'uDoB'      => Carbon::now()->subYears(30)->startOfYear(),
                'age_group' => 'adults',
            ]
        );

        $this->command->info('Admin seeded: login "admin" / "admin123" (phone 0900000000)');
    }
}
