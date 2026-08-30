<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

/**
 * Nhóm tuổi khi giáo viên tạo học viên.
 *
 * Lỗi đã báo: chọn "Thiếu niên" nhưng học viên tạo ra lại là "Người lớn".
 * Nguyên nhân: nhánh tự suy ra nhóm tuổi từ ngày sinh GHI ĐÈ lựa chọn của giáo
 * viên. Vì `age_group` là required nên nó luôn có mặt, tức là hễ nhập ngày sinh
 * thì ô chọn nhóm tuổi trở thành vô nghĩa.
 */
class StudentAgeGroupTest extends TestCase
{
    use RefreshDatabase;

    protected User $teacher;

    protected function setUp(): void
    {
        parent::setUp();
        $this->teacher = User::factory()->create(['uRole' => 'teacher']);
    }

    private function createStudent(array $payload)
    {
        return $this->actingAs($this->teacher, 'sanctum')
            ->postJson('/api/teacher/student', array_merge([
                'studentName'  => 'Học viên Thử',
                'studentPhone' => '0900000001',
                'age_group'    => 'teens',
            ], $payload));
    }

    /** @test */
    public function chon_thieu_nien_khong_nhap_ngay_sinh_thi_ra_thieu_nien(): void
    {
        $this->createStudent([])->assertStatus(200);

        $this->assertSame('teens', User::where('uPhone', '0900000001')->value('age_group'));
    }

    /**
     * Đây chính là lỗi đã báo: giáo viên chọn "Thiếu niên", nhập kèm ngày sinh
     * của người trưởng thành, và hệ thống lặng lẽ đổi thành "Người lớn".
     *
     * @test
     */
    public function lua_chon_cua_giao_vien_thang_ngay_sinh(): void
    {
        $this->createStudent(['studentDoB' => '2001-01-01'])->assertStatus(200);

        $this->assertSame('teens', User::where('uPhone', '0900000001')->value('age_group'));
    }

    /** @test */
    public function chon_tre_em_thi_ra_tre_em_du_ngay_sinh_la_nguoi_lon(): void
    {
        $this->createStudent([
            'age_group'  => 'kids',
            'studentDoB' => '1995-06-15',
        ])->assertStatus(200);

        $this->assertSame('kids', User::where('uPhone', '0900000001')->value('age_group'));
    }

    /** @test */
    public function chon_nguoi_lon_thi_ra_nguoi_lon(): void
    {
        $this->createStudent([
            'age_group'  => 'adults',
            'studentDoB' => '2000-03-03',
        ])->assertStatus(200);

        $this->assertSame('adults', User::where('uPhone', '0900000001')->value('age_group'));
    }

    /**
     * Ngày sinh vẫn phải được lưu — bỏ ghi đè nhóm tuổi không có nghĩa là bỏ
     * luôn dữ liệu ngày sinh.
     *
     * @test
     */
    public function ngay_sinh_van_duoc_luu(): void
    {
        $this->createStudent(['studentDoB' => '2011-05-20'])->assertStatus(200);

        $student = User::where('uPhone', '0900000001')->first();
        $this->assertSame('2011-05-20', $student->uDoB->format('Y-m-d'));
        $this->assertSame('teens', $student->age_group);
    }

    /**
     * Tạo hàng loạt dùng nhánh code riêng (batchCreateStudents) nên phải khoá
     * cùng hành vi, nếu không lỗi sẽ sống lại ở đường import danh sách.
     *
     * @test
     */
    public function tao_hang_loat_cung_ton_trong_lua_chon(): void
    {
        $this->actingAs($this->teacher, 'sanctum')
            ->postJson('/api/teacher/student', [
                [
                    'studentName'  => 'HV Một',
                    'studentPhone' => '0900000011',
                    'studentDoB'   => '1990-01-01',
                    'age_group'    => 'teens',
                ],
                [
                    'studentName'  => 'HV Hai',
                    'studentPhone' => '0900000012',
                    'studentDoB'   => '2018-01-01',
                    'age_group'    => 'adults',
                ],
            ])->assertStatus(200);

        $this->assertSame('teens',  User::where('uPhone', '0900000011')->value('age_group'));
        $this->assertSame('adults', User::where('uPhone', '0900000012')->value('age_group'));
    }

    /**
     * Giới tính và địa chỉ: form vẫn gửi lên nhưng createSingleStudent chưa hề
     * đọc, nên giáo viên nhập xong mở lại thấy trống. `uGender` là cột boolean
     * (1 = Nam) nên chuỗi 'male'/'female' phải được quy đổi.
     *
     * @test
     */
    public function luu_gioi_tinh_va_dia_chi(): void
    {
        $this->createStudent([
            'gender'  => 'female',
            'address' => 'Số 1, Phường A, Thành phố Cần Thơ',
        ])->assertStatus(200);

        $student = User::where('uPhone', '0900000001')->first();
        $this->assertFalse($student->uGender);
        $this->assertSame('Số 1, Phường A, Thành phố Cần Thơ', $student->uAddress);
    }

    /** @test */
    public function gioi_tinh_nam_luu_thanh_true(): void
    {
        $this->createStudent(['gender' => 'male'])->assertStatus(200);

        $this->assertTrue(User::where('uPhone', '0900000001')->first()->uGender);
    }

    /**
     * Không gửi giới tính thì để trống, không được mặc định thành Nam.
     *
     * @test
     */
    public function khong_gui_gioi_tinh_thi_de_trong(): void
    {
        $this->createStudent([])->assertStatus(200);

        $this->assertNull(User::where('uPhone', '0900000001')->value('uGender'));
    }
}

