<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Post extends Model
{
    use HasFactory;

    protected $table = 'posts';
    protected $primaryKey = 'pId';
    const CREATED_AT = 'pCreated_at';
    const UPDATED_AT = 'pUpdated_at';

    protected $fillable = [
        'pTitle',
        'pContent',
        'pAuthor_id',
        'pType',
        'pCategory',
        'pUrl',
        'pThumbnail',
        'pView',
        'pLike',
        'pStatus',
        'pApproved_by',
        'pApproved_at',
        'pRejected_by',
        'pRejected_at',
        'pReject_reason',
        'pDeleted_at',
    ];

    protected $casts = [
        'pCreated_at' => 'datetime',
        'pUpdated_at' => 'datetime',
        'pDeleted_at' => 'datetime',
        'pApproved_at' => 'datetime',
        'pRejected_at' => 'datetime',
    ];

    protected $dates = ['pDeleted_at'];

    protected $appends = [
        'pId',
    ];

    /**
     * Relationships
     */
    public function author()
    {
        return $this->belongsTo(User::class, 'pAuthor_id', 'uId');
    }

    public function category()
    {
        return $this->belongsTo(Category::class, 'pCategory', 'caId');
    }

    public function approvedBy()
    {
        return $this->belongsTo(User::class, 'pApproved_by', 'uId');
    }

    public function rejectedBy()
    {
        return $this->belongsTo(User::class, 'pRejected_by', 'uId');
    }

    /**
     * Scopes
     */
    public function scopeActive($query)
    {
        return $query->where('pStatus', 'active');
    }

    public function scopeByAuthor($query, $authorId)
    {
        return $query->where('pAuthor_id', $authorId);
    }

    public function getPIdAttribute()
    {
        return $this->attributes['pId'] ?? $this->getKey();
    }
}
