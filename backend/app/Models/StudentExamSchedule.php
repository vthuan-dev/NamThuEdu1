<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StudentExamSchedule extends Model
{
    use HasFactory;

    protected $table = 'student_exam_schedules';

    protected $fillable = [
        'student_id',
        'teacher_id',
        'title',
        'exam_type',
        'exam_date',
        'exam_time',
        'location',
        'note',
    ];

    protected $casts = [
        'exam_date'  => 'date',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id', 'uId');
    }

    public function teacher()
    {
        return $this->belongsTo(User::class, 'teacher_id', 'uId');
    }
}
