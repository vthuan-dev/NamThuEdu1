<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ClassGoalReminderLog extends Model
{
    use HasFactory;

    protected $table = 'class_goal_reminder_logs';
    public $timestamps = false;
    const CREATED_AT = 'created_at';

    protected $fillable = [
        'class_goal_id',
        'reminded_on',
        'students_notified',
        'created_at',
    ];

    protected $casts = [
        'reminded_on' => 'date',
        'created_at'  => 'datetime',
    ];

    public function goal()
    {
        return $this->belongsTo(ClassGoal::class, 'class_goal_id', 'id');
    }
}
