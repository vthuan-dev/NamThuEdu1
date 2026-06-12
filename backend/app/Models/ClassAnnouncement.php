<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ClassAnnouncement extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'class_announcements';

    protected $fillable = [
        'class_id',
        'teacher_id',
        'title',
        'content',
        'priority',
        'is_pinned',
    ];

    protected $casts = [
        'is_pinned'  => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function class()
    {
        return $this->belongsTo(Classes::class, 'class_id', 'cId');
    }

    public function teacher()
    {
        return $this->belongsTo(User::class, 'teacher_id', 'uId');
    }
}
