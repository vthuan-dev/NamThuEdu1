<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StudentGoalAnalysis extends Model
{
    use HasFactory;

    protected $table = 'student_goal_analyses';
    public $timestamps = false; // chỉ có created_at (useCurrent)

    protected $fillable = [
        'student_id',
        'goal_id',
        'target_level',
        'overall_progress_percent',
        'current_level_estimate',
        'on_track',
        'analysis',
        'performance_snapshot',
    ];

    protected $casts = [
        'analysis'             => 'array',
        'performance_snapshot' => 'array',
        'on_track'             => 'boolean',
        'created_at'           => 'datetime',
    ];

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id', 'uId');
    }
}
