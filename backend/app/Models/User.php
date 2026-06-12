<?php

namespace App\Models;

use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Database\Eloquent\SoftDeletes;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    protected $table = 'users';
    protected $primaryKey = 'uId';
    protected $dates = ['uDeleted_at'];
    const DELETED_AT = 'uDeleted_at';
    const CREATED_AT = 'uCreated_at';
    const UPDATED_AT = null; // No updated_at column

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'uName',
        'uPhone',
        'uEmail',
        'uPassword',
        'uGender',
        'uAddress',
        'class_id',
        'uRole',
        'uDoB',
        'uStatus',
        'age_group',
        'daily_goal_minutes',
        'date_of_birth',
        'theme_preference',
        'theme_updated_at',
        'refresh_token',
        'refresh_token_expires_at',
        'avatar_url',
        'bio',
        'language_preference',
        // NOTE: `plain_password` was removed (OWASP A02 — Cryptographic
        // Failures). The encrypted-plaintext column is being dropped via
        // migration `2026_06_09_000000_drop_plain_password_from_users_table`.
        // Do NOT re-add it; surface freshly generated passwords to the
        // teacher in the API response at creation/reset time only.
        'notifications_read_at',
        'dismissed_notification_ids',
        'notification_settings',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'uPassword',
        'refresh_token',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'uDoB' => 'date',
        'date_of_birth' => 'date',
        'uGender' => 'boolean',
        'daily_goal_minutes' => 'integer',
        'uCreated_at' => 'datetime',
        'theme_updated_at' => 'datetime',
        'refresh_token_expires_at' => 'datetime',
        'notifications_read_at'     => 'datetime',
        'dismissed_notification_ids' => 'array',
        'scheduled_delete_at'       => 'datetime',
        'notification_settings'     => 'array',
    ];

    /**
     * Get the password for authentication.
     */
    public function getAuthPassword()
    {
        return $this->uPassword;
    }

    /**
     * Get the identifier for authentication.
     */
    public function getAuthIdentifierName()
    {
        return 'uId';
    }

    /**
     * Get the identifier for authentication.
     */
    public function getAuthIdentifier()
    {
        return $this->uId;
    }

    /**
     * Alias accessor: $user->id luôn trả về uId.
     *
     * Lý do: code base + framework (Laravel broadcast channels, Sanctum, một
     * số helper) thỉnh thoảng đọc $user->id theo convention chuẩn Laravel,
     * nhưng bảng users của chúng ta dùng primaryKey = 'uId'. Trước khi có
     * accessor này, $user->id trả về null và đã tạo bug ngầm (ví dụ:
     * AdminSystemController::getProfile, routes/channels.php).
     *
     * Giữ accessor này như một "compat shim" — KHÔNG khuyến khích viết mới
     * theo $user->id; convention chuẩn của repo vẫn là $user->uId. Khi nào
     * Reminder #19 (chuẩn hoá naming) hoàn tất và cột rename về `id`, có
     * thể xoá accessor này.
     *
     * @return int|null
     */
    public function getIdAttribute()
    {
        return $this->attributes['uId'] ?? null;
    }

    /**
     * Relationships
     */
    
    // Class relationship (for students)
    public function class()
    {
        return $this->belongsTo(ClassModel::class, 'class_id', 'cId');
    }
    
    // Courses taught by teacher
    public function courses()
    {
        return $this->hasMany(Course::class, 'cTeacher', 'uId');
    }
    
    // Course enrollments (for students)
    public function courseEnrollments()
    {
        return $this->hasMany(CourseEnrollment::class, 'student_id', 'uId');
    }
    
    // Enrolled courses (for students)
    public function enrolledCourses()
    {
        return $this->belongsToMany(Course::class, 'course_enrollments', 'student_id', 'course_id')
                    ->withPivot('status', 'enrolled_at', 'completed_at', 'fee_paid', 'notes')
                    ->withTimestamps();
    }

    public function posts()
    {
        return $this->hasMany(Post::class, 'pAuthor_id', 'uId');
    }

    public function otpLogs()
    {
        return $this->hasMany(OtpLog::class, 'userId', 'uId');
    }
    
    /**
     * Scopes
     */
    public function scopeStudents($query)
    {
        return $query->where('uRole', 'student');
    }
    
    public function scopeTeachers($query)
    {
        return $query->where('uRole', 'teacher');
    }
    
    public function scopeAdmins($query)
    {
        return $query->where('uRole', 'admin');
    }
    
    public function scopeInClass($query, $classId)
    {
        return $query->where('class_id', $classId);
    }
    
    public function scopeByAgeGroup($query, $ageGroup)
    {
        return $query->where('age_group', $ageGroup);
    }
    
    public function scopeActive($query)
    {
        return $query->where('uStatus', 'active');
    }
    
    /**
     * Boot method for model events
     */
    protected static function boot()
    {
        parent::boot();
        // Class system đã deprecated — chỉ còn yêu cầu age_group cho student.
        // Validator class_id cũ đã được gỡ. Nếu sau này cần audit class history
        // thì query trực tiếp bảng class_enrollments / class_transfers.
    }
}
