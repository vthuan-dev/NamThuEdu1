<?php

namespace App\Http\Controllers\Concerns;

use App\Models\ClassCoTeacher;
use App\Models\Classes;
use App\Models\Exam;
use App\Models\Submission;
use App\Models\TestAssignment;
use App\Models\User;

/**
 * Shared teacher access rules for grading endpoints.
 *
 * A teacher may view/grade a submission if:
 * 1) they own the exam (exam.eTeacher_id), OR
 * 2) they own / co-teach the student's class, OR
 * 3) the assignment targets a class they manage, OR
 * 4) the assignment targets a student in a class they manage.
 *
 * This is intentionally broader than eTeacher_id-only ownership so that
 * teachers can grade bank exams they assigned to their own classes.
 */
trait TeacherSubmissionAccess
{
    protected function teacherManagedClassIds(int $teacherId): array
    {
        $owned = Classes::where('cTeacher_id', $teacherId)->pluck('cId')->all();
        $co = ClassCoTeacher::acceptedClassIdsFor($teacherId);

        return array_values(array_unique(array_map('intval', array_merge($owned, $co))));
    }

    protected function teacherCanAccessSubmission($user, Submission $submission): bool
    {
        if (!$user || ($user->uRole ?? null) !== 'teacher') {
            return false;
        }

        $teacherId = (int) $user->uId;

        // 1) Exam owner
        $examTeacherId = optional($submission->exam)->eTeacher_id
            ?? Exam::where('eId', $submission->exam_id)->value('eTeacher_id');
        if ((int) $examTeacherId === $teacherId) {
            return true;
        }

        $classIds = $this->teacherManagedClassIds($teacherId);
        if (empty($classIds)) {
            return false;
        }

        // 2) Student belongs to a managed class
        $studentClassId = optional($submission->user)->class_id
            ?? User::where('uId', $submission->user_id)->value('class_id');
        if ($studentClassId && in_array((int) $studentClassId, $classIds, true)) {
            return true;
        }

        // 3/4) Assignment targets a managed class or a student in a managed class
        if ($submission->assignment_id) {
            $assignment = TestAssignment::where('taId', $submission->assignment_id)
                ->first(['taId', 'taTarget_type', 'taTarget_id']);

            if ($assignment) {
                if ($assignment->taTarget_type === 'class'
                    && in_array((int) $assignment->taTarget_id, $classIds, true)) {
                    return true;
                }

                if ($assignment->taTarget_type === 'student') {
                    $targetClass = User::where('uId', $assignment->taTarget_id)->value('class_id');
                    if ($targetClass && in_array((int) $targetClass, $classIds, true)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }
}
