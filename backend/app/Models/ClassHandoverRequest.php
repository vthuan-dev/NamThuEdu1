<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ClassHandoverRequest extends Model
{
    use HasFactory;

    protected $table = 'class_handover_requests';

    protected $fillable = [
        'class_id',
        'request_type',
        'from_teacher_id',
        'receiving_teacher_id',
        'status',
        'reason',
        'admin_note',
        'resolved_at',
    ];

    protected $casts = [
        'resolved_at' => 'datetime',
        'created_at'  => 'datetime',
        'updated_at'  => 'datetime',
    ];

    public function class()
    {
        return $this->belongsTo(Classes::class, 'class_id', 'cId');
    }

    public function fromTeacher()
    {
        return $this->belongsTo(User::class, 'from_teacher_id', 'uId');
    }

    public function receivingTeacher()
    {
        return $this->belongsTo(User::class, 'receiving_teacher_id', 'uId');
    }
}
