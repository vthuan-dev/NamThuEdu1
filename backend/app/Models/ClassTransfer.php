<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ClassTransfer extends Model
{
    use HasFactory;

    protected $table = 'class_transfers';
    
    // teacher_id: cột NOT NULL không default trong migration. Thiếu nó ở đây thì
    // Eloquent lọc bỏ giá trị controller truyền vào → INSERT thiếu cột → SQLSTATE
    // 1364 và mọi lần chuyển lớp trả 500.
    // transferred_by: giữ lại vì relation transferredBy() dùng tới.
    protected $fillable = [
        'student_id',
        'from_class_id',
        'to_class_id',
        'reason',
        'notes',
        'teacher_id',
        'transferred_by',
        'transferred_at',
    ];
    
    protected $casts = [
        'transferred_at' => 'datetime',
    ];
    
    /**
     * Relationships
     */
    public function student()
    {
        return $this->belongsTo(User::class, 'student_id', 'uId');
    }
    
    public function fromClass()
    {
        return $this->belongsTo(ClassModel::class, 'from_class_id', 'cId');
    }
    
    public function toClass()
    {
        return $this->belongsTo(ClassModel::class, 'to_class_id', 'cId');
    }
    
    public function transferredBy()
    {
        return $this->belongsTo(User::class, 'transferred_by', 'uId');
    }
    
    /**
     * Scopes
     */
    public function scopeByStudent($query, $studentId)
    {
        return $query->where('student_id', $studentId);
    }
    
    public function scopeRecent($query, $days = 30)
    {
        return $query->where('transferred_at', '>=', now()->subDays($days));
    }
}
