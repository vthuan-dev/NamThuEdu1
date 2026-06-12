<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ClassGoal extends Model
{
    use HasFactory;

    protected $table = 'class_goals';

    protected $fillable = [
        'class_id',
        'teacher_id',
        'goal_title',
        'target_date',
        'target_level',
        'description',
        'status',
    ];

    protected $casts = [
        'target_date' => 'date',
        'created_at'  => 'datetime',
        'updated_at'  => 'datetime',
    ];

    public function class()
    {
        return $this->belongsTo(Classes::class, 'class_id', 'cId');
    }

    public function teacher()
    {
        return $this->belongsTo(User::class, 'teacher_id', 'uId');
    }

    public function reminderLogs()
    {
        return $this->hasMany(ClassGoalReminderLog::class, 'class_goal_id', 'id');
    }
}
