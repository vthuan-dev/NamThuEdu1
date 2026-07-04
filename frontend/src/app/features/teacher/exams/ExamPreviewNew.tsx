import { useParams, useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { ExamPlayer } from '../../../../components/exam';

/**
 * NEW Teacher Exam Preview Page (Test Version)
 * Uses shared ExamPlayer component
 * URL: /giao-vien/de-thi/:examId/xem-moi
 */
export function ExamPreviewNew() {
  const { examId } = useParams();
  const navigate = useNavigate();

  if (!examId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <p className="text-xl text-gray-600 mb-4 font-medium">Exam ID not found</p>
          <button
            onClick={() => navigate('/giao-vien/de-thi')}
            className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all inline-flex items-center gap-2 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Exams
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Back button overlay - Navigate to exam list */}
      <div className="absolute top-4 left-4 z-50">
        <button
          onClick={() => navigate('/giao-vien/nganhang-de')}
          className="px-4 py-2 bg-white rounded-lg shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center gap-2 font-medium text-gray-700 hover:text-orange-600"
          title="Quay lại danh sách đề thi"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="hidden sm:inline">Quay lại</span>
        </button>
      </div>

      {/* Exam Player in preview mode */}
      <ExamPlayer
        examId={parseInt(examId)}
        mode="preview"
        showHeader={true}
        showTimer={true}
        allowInteraction={false}
      />
    </div>
  );
}
