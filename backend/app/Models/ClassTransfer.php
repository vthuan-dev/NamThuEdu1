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
    //
    // KHÔNG thêm 'transferred_by': bảng class_transfers không có cột đó. Giữ nó ở
    // đây chỉ làm Eloquent âm thầm bỏ qua khi ai đó gán vào.
    protected $fillable = [
        'student_id',
        'from_class_id',
        'to_class_id',
        'reason',
        'notes',
        'teacher_id',
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
    
    /**
     * Giáo viên thực hiện việc chuyển lớp.
     *
     * Dùng `teacher_id`. Trước đây relation này trỏ vào `transferred_by` — một cột
     * không tồn tại trong bảng — nên bất kỳ ai truy cập cũng nhận "Unknown column".
     */
    public function transferredBy()
    {
        return $this->belongsTo(User::class, 'teacher_id', 'uId');
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
