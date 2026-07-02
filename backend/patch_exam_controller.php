<?php
$file = 'd:/Project/NamThuEdu/backend/app/Http/Controllers/ExamController.php';
$content = file_get_contents($file);

$search1 = <<<EOD
        \$paginate = \$request->get('paginate') === 'true';
        \$exams = \$paginate
            ? \$query->paginate((int) \$request->get('per_page', 20))
            : \$query->get();

        return response()->json([
EOD;

$replace1 = <<<EOD
        \$paginate = \$request->get('paginate') === 'true';
        \$exams = \$paginate
            ? \$query->paginate((int) \$request->get('per_page', 20))
            : \$query->get();

        \$collection = \$paginate ? \$exams->getCollection() : \$exams;
        \$collection->transform(function (\$exam) {
            \$exam->questions_count = \$exam->getQuestionsCount();
            return \$exam;
        });

        return response()->json([
EOD;

$search2 = <<<EOD
        \$pendingExams = Exam::with(['teacher'])
                           ->withCount('questions')
                           ->where('eStatus', 'pending')
                           ->orderBy('eCreated_at', 'desc')
                           ->get();

        return response()->json([
EOD;

$replace2 = <<<EOD
        \$pendingExams = Exam::with(['teacher'])
                           ->withCount('questions')
                           ->where('eStatus', 'pending')
                           ->orderBy('eCreated_at', 'desc')
                           ->get();

        \$pendingExams->transform(function (\$exam) {
            \$exam->questions_count = \$exam->getQuestionsCount();
            return \$exam;
        });

        return response()->json([
EOD;

$content = str_replace($search1, $replace1, $content);
$content = str_replace($search2, $replace2, $content);

file_put_contents($file, $content);
echo "Patched successfully.\n";
