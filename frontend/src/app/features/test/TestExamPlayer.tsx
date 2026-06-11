import { useState } from 'react';
import { useParams } from 'react-router';
import { ExamPlayer } from '../../../components/exam';

/**
 * Test page for ExamPlayer - FOR TEACHER TESTING
 * URL: /giao-vien/test-exam/:examId
 * 
 * Toggle between:
 * - Preview mode (read-only, no drag & drop)
 * - Student mode (interactive, with drag & drop)
 */
export function TestExamPlayer() {
  const { examId } = useParams();
  const [mode, setMode] = useState<'preview' | 'student'>('student');

  if (!examId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <p className="text-xl text-gray-600 mb-4 font-medium">Exam ID not found</p>
          <p className="text-gray-500">Usage: /giao-vien/test-exam/101</p>
        </div>
      </div>
    );
  }

  const handleSubmit = (answers: any, uploadedImages: any) => {
    console.log('🎉 Test Submit!');
    console.log('Answers:', answers);
    console.log('Uploaded images:', uploadedImages);
    alert('✅ Submit thành công! Check console để xem data.');
  };

  return (
    <div>
      {/* Test Mode Banner with Toggle */}
      <div className="bg-yellow-500 text-black py-3 px-4 flex items-center justify-between sticky top-0 z-50 shadow-lg">
        <div className="font-bold">
          🧪 TEST MODE - FOR TEACHER TESTING
        </div>
        
        <div className="flex items-center gap-4">
          <span className="font-medium">Mode:</span>
          <div className="flex gap-2">
            <button
              onClick={() => setMode('preview')}
              className={`px-4 py-2 rounded-lg font-bold transition-all ${
                mode === 'preview'
                  ? 'bg-blue-600 text-white shadow-lg scale-105'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              👁️ Preview (Read-only)
            </button>
            <button
              onClick={() => setMode('student')}
              className={`px-4 py-2 rounded-lg font-bold transition-all ${
                mode === 'student'
                  ? 'bg-green-600 text-white shadow-lg scale-105'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              🎮 Student (Interactive)
            </button>
          </div>
        </div>
      </div>
      
      <ExamPlayer
        examId={parseInt(examId)}
        mode={mode}
        showHeader={true}
        showTimer={true}
        allowInteraction={mode === 'student'}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
