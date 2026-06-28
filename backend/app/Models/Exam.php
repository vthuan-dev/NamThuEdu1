<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Exam extends Model
{
    use HasFactory;

    protected $table = 'exams';
    protected $primaryKey = 'eId';
    public $timestamps = false;
    const CREATED_AT = 'eCreated_at';

    protected $fillable = [
        'exam_type_id',
        'template_id', // New: Link to exam template
        'exam_code',
        'eTitle',
        'eDescription',
        'eDifficulty_level',
        'eTarget_level',
        'eDuration',
        'eTotal_score',
        'ePass_score',
        'eStatus',
        'eVisibility',
        'teacher_id',
        'eTags',
        'eType',
        'eSkill',
        'eTeacher_id',
        'eDuration_minutes',
        'eIs_private',
        'eSource_type',
        'ePurpose', // New: Purpose of exam (exam, practice, review, etc.)
        'eScope',
        'ePart_type',
        'ePart_number',
        'eTopic', // New: Topic for practice sessions
        'eDifficulty', // New: Difficulty level
        'eParent_exam_id', // New: Link to parent exam if cloned
        // Age-group content fields
        'age_group',
        'content_type',
        'difficulty_level',
        'gamification_config',
        'ui_config',
        // Kids exam fields
        'kids_exam_config',
        // IELTS fields
        'ielts_test_type',
        'ielts_skill',
        'ielts_config',
        // THPT fields
        'thpt_config',
        'thpt_draft_config',
        'thpt_version',
        'thpt_versions',
    ];

    protected $casts = [
        'eIs_private' => 'boolean',
        'eCreated_at' => 'datetime',
        'eTags' => 'array',
        'gamification_config' => 'array',
        'ui_config' => 'array',
        'kids_exam_config' => 'array',
        'ielts_config' => 'array',
        'thpt_config' => 'array',
        'thpt_draft_config' => 'array',
        'thpt_versions' => 'array',
        'ePart_number' => 'integer',
    ];

    /**
     * Quyết định trạng thái kiểm duyệt khi một đề được publish.
     *
     * Đọc cài đặt `examAutoApprove` (admin_settings):
     *  - true (mặc định) → 'published' (đề lên thẳng, không cần admin duyệt)
     *  - false           → 'pending'   (đề chờ admin duyệt, giữ private)
     *
     * Dùng chung cho mọi luồng publish (generic / VSTEP / IELTS / THPT / Import)
     * để hành vi auto-duyệt nhất quán toàn hệ thống.
     */
    public static function resolveModerationStatus(): string
    {
        $raw = AdminSetting::where('key', 'examAutoApprove')->value('value');
        $autoApprove = filter_var($raw ?? 'true', FILTER_VALIDATE_BOOLEAN);
        return $autoApprove ? 'published' : 'pending';
    }

    /**
     * Relationships
     */
    public function examTemplate()
    {
        return $this->belongsTo(ExamTemplate::class, 'template_id');
    }

    // Alias for examTemplate relationship
    public function template()
    {
        return $this->belongsTo(ExamTemplate::class, 'template_id');
    }

    public function examType()
    {
        return $this->belongsTo(ExamType::class, 'exam_type_id', 'etId');
    }

    public function teacher()
    {
        return $this->belongsTo(User::class, 'eTeacher_id', 'uId');
    }

    public function questions()
    {
        return $this->hasMany(Question::class, 'exam_id', 'eId');
    }

    public function contentBlocks()
    {
        return $this->hasMany(ContentBlock::class, 'exam_id', 'eId');
    }

    public function testAssignments()
    {
        return $this->hasMany(TestAssignment::class, 'exam_id', 'eId');
    }

    public function assignments()
    {
        return $this->hasMany(TestAssignment::class, 'exam_id', 'eId');
    }

    public function submissions()
    {
        return $this->hasMany(Submission::class, 'exam_id', 'eId');
    }

    public function practiceSession()
    {
        return $this->hasOne(PracticeSession::class, 'ps_exam_id', 'eId');
    }

    public function parentExam()
    {
        return $this->belongsTo(Exam::class, 'eParent_exam_id', 'eId');
    }

    public function childExams()
    {
        return $this->hasMany(Exam::class, 'eParent_exam_id', 'eId');
    }

    /**
     * Scopes
     */
    public function scopePractice($query)
    {
        return $query->where('ePurpose', 'practice');
    }

    public function scopeByPurpose($query, $purpose)
    {
        return $query->where('ePurpose', $purpose);
    }

    public function scopeByDifficulty($query, $difficulty)
    {
        return $query->where('eDifficulty', $difficulty);
    }

    public function scopeForAgeGroup($query, $ageGroup)
    {
        return $query->where(function($q) use ($ageGroup) {
            $q->where('age_group', $ageGroup)
              ->orWhere('age_group', 'all');
        });
    }

    public function scopeByAgeGroup($query, $ageGroup)
    {
        return $query->where('age_group', $ageGroup);
    }

    /**
     * Kids exam relationships
     */
    public function kidsExamType()
    {
        return $this->belongsTo(\stdClass::class, 'kids_exam_type_id', 'id')
            ->from('kids_exam_types');
    }

    /**
     * Dynamically count questions for THPT exams from JSON config, fallback to Eloquent count for others.
     */
    public function getQuestionsCount(): int
    {
        if ($this->eType === 'THPT' && is_array($this->thpt_config)) {
            $count = 0;
            foreach ($this->thpt_config['sections'] ?? [] as $s) {
                $type = $s['type'] ?? '';
                if ($type === 'mc_cloze' || $type === 'word_bank_cloze' || $type === 'open_cloze') {
                    $count += count($s['blanks'] ?? []);
                } elseif ($type === 'tf_group') {
                    foreach ($s['items'] ?? [] as $it) {
                        $count += count($it['statements'] ?? []);
                    }
                } elseif ($type === 'reading_mixed') {
                    foreach ($s['items'] ?? [] as $it) {
                        $kind = $it['kind'] ?? '';
                        if ($kind === 'tf_group') {
                            $count += count($it['statements'] ?? []);
                        } else {
                            $count += 1;
                        }
                    }
                } elseif ($type === 'matching') {
                    foreach ($s['items'] ?? [] as $it) {
                        $count += count($it['answers'] ?? []);
                    }
                } else {
                    $count += count($s['items'] ?? []);
                }
            }
            return $count;
        }

        return $this->questions_count ?? $this->questions()->count();
    }
}
