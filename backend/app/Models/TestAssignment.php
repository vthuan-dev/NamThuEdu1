<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TestAssignment extends Model
{
    use HasFactory;

    protected $table = 'test_assignments';
    protected $primaryKey = 'taId';
    public $timestamps = false;
    const CREATED_AT = 'taCreated_at';

    protected $fillable = [
        'exam_id',
        // Người giao đề. Cột này có trong schema từ migration
        // 2026_03_22_150000 nhưng chưa từng nằm trong $fillable, nên mọi giá trị
        // truyền vào create() đều bị Laravel lặng lẽ bỏ qua và cột luôn NULL.
        // Hệ quả: phân quyền xem bài nộp không có cách nào biết ai đã giao đề.
        'taTeacher_id',
        'taTarget_type',
        'taTarget_id',
        'taDeadline',
        'taStart_time',
        'taNotify_before_minutes',
        'taNotified_at',
        'taInstructions',
        'taMax_attempt',
        'taIs_public',
        'taCreated_at',
    ];

    protected $casts = [
        'taDeadline' => 'datetime',
        'taStart_time' => 'datetime',
        'taNotified_at' => 'datetime',
        'taNotify_before_minutes' => 'integer',
        'taIs_public' => 'boolean',
        'taCreated_at' => 'datetime',
    ];

    /**
     * Relationships
     */
    public function exam()
    {
        return $this->belongsTo(Exam::class, 'exam_id', 'eId');
    }

    public function submissions()
    {
        return $this->hasMany(Submission::class, 'assignment_id', 'taId');
    }

    /** Giáo viên đã giao đề này. NULL với assignment tạo trước khi cột được ghi. */
    public function assigner()
    {
        return $this->belongsTo(User::class, 'taTeacher_id', 'uId');
    }

    /**
     * Get the target (class or student)
     */
    public function target()
    {
        if ($this->taTarget_type === 'class') {
            return $this->belongsTo(Classes::class, 'taTarget_id', 'cId');
        } else {
            return $this->belongsTo(User::class, 'taTarget_id', 'uId');
        }
    }
}
