<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TeacherPinnedStudent extends Model
{
    protected $table = 'teacher_pinned_students';

    protected $fillable = [
        'teacher_id',
        'student_id',
    ];

    public function teacher()
    {
        return $this->belongsTo(User::class, 'teacher_id', 'uId');
    }

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id', 'uId');
    }
}
