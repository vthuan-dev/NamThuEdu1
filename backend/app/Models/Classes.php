<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Classes extends Model
{
    use HasFactory;

    protected $table = 'classes';
    protected $primaryKey = 'cId';
    public $timestamps = false;
    const CREATED_AT = 'cCreated_at';

    protected $fillable = [
        'cName',
        'cTeacher_id',
        'cDescription',
        'cStatus',
        'course',
        'age_group',
    ];

    protected $casts = [
        'cCreated_at' => 'datetime',
    ];

    /**
     * Relationships
     */
    public function teacher()
    {
        return $this->belongsTo(User::class, 'cTeacher_id', 'uId');
    }

    public function course()
    {
        return $this->belongsTo(Course::class, 'course', 'cId');
    }

    public function parentCourse()
    {
        return $this->belongsTo(Classes::class, 'course', 'cId');
    }

    public function students()
    {
        return $this->hasMany(User::class, 'class_id', 'cId')->where('uRole', 'student');
    }

    public function transfersFrom()
    {
        return $this->hasMany(ClassTransfer::class, 'from_class_id', 'cId');
    }

    public function transfersTo()
    {
        return $this->hasMany(ClassTransfer::class, 'to_class_id', 'cId');
    }

    public function announcements()
    {
        return $this->hasMany(ClassAnnouncement::class, 'class_id', 'cId');
    }

    public function goals()
    {
        return $this->hasMany(ClassGoal::class, 'class_id', 'cId');
    }

    public function pendingHandover()
    {
        return $this->hasOne(ClassHandoverRequest::class, 'class_id', 'cId')
                    ->where('status', 'pending');
    }

    /**
     * Scopes
     */
    public function scopeActive($query)
    {
        return $query->where('cStatus', 'active');
    }

    public function scopeByTeacher($query, $teacherId)
    {
        return $query->where('cTeacher_id', $teacherId);
    }

    public function scopeByCourse($query, $courseId)
    {
        return $query->where('course', $courseId);
    }

    /**
     * Helper methods
     */
    public function getStudentCount()
    {
        return $this->students()->count();
    }

    public function hasStudent($studentId)
    {
        return $this->students()->where('uId', $studentId)->exists();
    }
}
