<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Carbon\Carbon;

/**
 * Seed tài khoản mẫu cho 5 vai trò:
 *  - admin
 *  - teacher (giáo viên)
 *  - student kids   (6-12 tuổi)
 *  - student teens  (13-17 tuổi)
 *  - student adults (18+)
 *
 * Idempotent: dùng updateOrCreate theo uPhone nên chạy lại không tạo trùng.
 * Đăng nhập bằng SĐT + mật khẩu. Riêng admin có thể gõ "admin" (map -> 0900000000).
 */
class DeployTestAccountsSeeder extends Seeder
{
    public function run(): void
    {
        $accounts = [
            [
                'uName' => 'Quản trị viên',
                'uPhone' => '0900000000',
                'uEmail' => 'admin@namthuedu.vn',
                'uRole' => 'admin',
                'password' => 'Admin@123',
                'age_group' => 'adults',
                'age' => 30,
            ],
            [
                'uName' => 'Giáo viên Demo',
                'uPhone' => '0901000001',
                'uEmail' => 'teacher@namthuedu.vn',
                'uRole' => 'teacher',
                'password' => 'Teacher@123',
                'age_group' => 'adults',
                'age' => 28,
            ],
            [
                'uName' => 'Học viên Nhí (Kids)',
                'uPhone' => '0902000002',
                'uEmail' => 'kids@namthuedu.vn',
                'uRole' => 'student',
                'password' => 'Student@123',
                'age_group' => 'kids',
                'age' => 9,
            ],
            [
                'uName' => 'Học viên Thiếu niên (Teens)',
                'uPhone' => '0903000003',
                'uEmail' => 'teens@namthuedu.vn',
                'uRole' => 'student',
                'password' => 'Student@123',
                'age_group' => 'teens',
                'age' => 15,
            ],
            [
                'uName' => 'Học viên Người lớn (Adults)',
                'uPhone' => '0904000004',
                'uEmail' => 'adults@namthuedu.vn',
                'uRole' => 'student',
                'password' => 'Student@123',
                'age_group' => 'adults',
                'age' => 25,
            ],
        ];

        foreach ($accounts as $acc) {
            $dob = Carbon::now()->subYears($acc['age'])->startOfYear();

            User::updateOrCreate(
                ['uPhone' => $acc['uPhone']],
                [
                    'uName'     => $acc['uName'],
                    'uEmail'    => $acc['uEmail'],
                    'uPassword' => Hash::make($acc['password']),
                    'uRole'     => $acc['uRole'],
                    'uStatus'   => 'active',
                    'uGender'   => true,
                    'uDoB'      => $dob,
                    'age_group' => $acc['age_group'],
                ]
            );

            $this->command->info("Seeded {$acc['uRole']} | phone {$acc['uPhone']} | pass {$acc['password']}");
        }
    }
}
