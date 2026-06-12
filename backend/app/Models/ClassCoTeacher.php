<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ClassCoTeacher extends Model
{
    use HasFactory;

    protected $table = 'class_co_teachers';

    protected $fillable = [
        'class_id',
        'inviter_id',
        'teacher_id',
        'type',
        'status',
        'message',
        'responded_at',
    ];

    protected $casts = [
        'responded_at' => 'datetime',
        'created_at'   => 'datetime',
        'updated_at'   => 'datetime',
    ];

    public function class()
    {
        return $this->belongsTo(Classes::class, 'class_id', 'cId');
    }

    public function teacher()
    {
        return $this->belongsTo(User::class, 'teacher_id', 'uId');
    }

    public function inviter()
    {
        return $this->belongsTo(User::class, 'inviter_id', 'uId');
    }

    /** ID các lớp mà giáo viên này là co-teacher đã chấp nhận. */
    public static function acceptedClassIdsFor($teacherId): array
    {
        return static::where('teacher_id', $teacherId)
            ->where('status', 'accepted')
            ->pluck('class_id')
            ->all();
    }

    /** Giáo viên có quyền quản lý lớp (chủ lớp hoặc co-teacher đã chấp nhận)? */
    public static function teacherCanAccess($classId, $teacherId): bool
    {
        return static::where('class_id', $classId)
            ->where('teacher_id', $teacherId)
            ->where('status', 'accepted')
            ->exists();
    }
}
