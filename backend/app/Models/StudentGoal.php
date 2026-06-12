<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StudentGoal extends Model
{
    use HasFactory;

    protected $table = 'student_goals';

    protected $fillable = [
        'student_id',
        'teacher_id',
        'target_level',
        'target_skill',
        'exam_type',
        'target_date',
        'note',
        'status',
        'ai_analysis',
        'ai_analyzed_at',
    ];

    protected $casts = [
        'target_date'    => 'date',
        'ai_analysis'    => 'array',
        'ai_analyzed_at' => 'datetime',
        'created_at'     => 'datetime',
        'updated_at'     => 'datetime',
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
