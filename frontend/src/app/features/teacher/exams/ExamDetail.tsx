import { Link, useParams, useNavigate } from "react-router";
import { ArrowLeft, Edit, Copy, Send, Download, Archive, Trash2, Clock, Target, FileText, BarChart3 } from "lucide-react";
import { useState, useEffect } from "react";
import { getKidsExam } from "../../../../services/kidsExamApi";
import { api } from "../../../../services/api";
import { useToast } from "../../../../hooks/useToast";
import { ToastContainer } from "../../../../components/ui/ToastContainer";
import { formatVNDate } from "@/utils/dateUtils";

interface Question {
  qId: number;
  qContent: string;
  qType: string;
  qPoints: number;
  qPart: number;
  qSubPart: number | null;
  kids_task_config: any;
}

interface ExamData {
  eId: number;
  eTitle: string;
  eDescription: string;
  eType: string;
  examType: string;
  mode: string;
  ageGroup: string;
  level: string;
  eDuration: number;
  totalPoints: number;
  passingScore: number;
  createdBy: number;
  eCreated_at: string;
  questions: Question[];
}

export function ExamDetail() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [examData, setExamData] = useState<ExamData | null>(null);

  useEffect(() => {
    loadExamData();
  }, [examId]);

  const loadExamData = async () => {
    if (!examId) return;

    try {
      setLoading(true);
      // Thử kids-exams trước
      try {
        const response = await getKidsExam(parseInt(examId));
        console.log('📥 Loaded kids exam data:', response);
        setExamData(response);
        return;
      } catch (kidsErr: any) {
        if (kidsErr?.response?.status !== 404) throw kidsErr;
      }

      // Fallback: đề thường (VSTEP / IELTS / General)
      const res = await api.get(`/teacher/exams/${examId}`);
      const exam = res.data?.data || res.data;
      console.log('📥 Loaded exam data:', exam);

      // VSTEP → chuyển thẳng sang trang preview chuyên dụng
      if (exam?.eType === 'VSTEP') {
        navigate(`/giao-vien/de-thi/${examId}/vstep`, { replace: true });
        return;
      }
      setExamData(exam);
    } catch (error: any) {
      console.error('❌ Failed to load exam:', error);
      toast.error('Không thể tải thông tin đề thi!');
    } finally {
      setLoading(false);
    }
  };

  // Group questions by part
  const groupQuestionsByPart = () => {
    if (!examData?.questions) return {};
    
    const grouped: { [key: number]: Question[] } = {};
    examData.questions.forEach(q => {
      const part = (q.qPart === null || q.qPart === undefined || isNaN(Number(q.qPart))) ? 1 : Number(q.qPart);
      if (!grouped[part]) {
        grouped[part] = [];
      }
      grouped[part].push(q);
    });
    
    // Sort questions within each part by qSubPart
    Object.keys(grouped).forEach(partKey => {
      const arr = grouped[parseInt(partKey)];
      if (!Array.isArray(arr)) return;
      arr.sort((a, b) => {
        if (a.qSubPart === null || a.qSubPart === undefined) return -1;
        if (b.qSubPart === null || b.qSubPart === undefined) return 1;
        return a.qSubPart - b.qSubPart;
      });
    });
    
    return grouped;
  };

  const getPartName = (partNumber: number) => {
    const partNames: { [key: number]: { name: string; icon: string } } = {
      1: { name: 'NGHE', icon: '🎧' },
      2: { name: 'ĐỌC VÀ VIẾT', icon: '📖' },
      3: { name: 'NÓI', icon: '🗣️' },
    };
    return partNames[partNumber] || { name: `PHẦN ${partNumber}`, icon: '📝' };
  };

  const getTaskTypeName = (taskType: string) => {
    const taskTypeNames: { [key: string]: string } = {
      'listen_and_draw_lines': 'Nghe và Nối Tranh',
      'listen_and_write': 'Nghe và Điền Từ',
      'listen_and_tick': 'Nghe và Đánh Dấu',
      'listen_colour_write': 'Nghe và Tô Màu',
      'look_and_read': 'Nhìn và Đọc',
      'look_read_write': 'Nhìn, Đọc và Viết',
      'unscramble_words': 'Sắp Xếp Từ',
      'cloze_test': 'Điền Từ Vào Chỗ Trống',
      'dialogue_matching': 'Ghép Nối Hội Thoại',
      'word_definition_matching': 'Ghép Nối Từ và Định Nghĩa',
      'word_bank_fill': 'Điền Từ Từ Ngân Hàng Từ',
      'find_differences': 'Tìm Điểm Khác Biệt',
      'picture_story_narration': 'Kể Chuyện Theo Tranh',
      'odd_one_out': 'Tìm Hình Khác Loại',
      'information_exchange': 'Trao Đổi Thông Tin',
      'object_placement': 'Đặt Vật Vào Tranh',
      'picture_questions': 'Trả Lời Câu Hỏi Về Hình',
      'picture_card_questions': 'Trả Lời Câu Hỏi Về Thẻ Hình',
      'listening_letter_match': 'Nghe và Ghép Chữ Cái',
    };
    return taskTypeNames[taskType] || taskType;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-amber-50/20 to-orange-50/10 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">📚</div>
          <p className="text-xl text-gray-600">Đang tải đề thi...</p>
        </div>
      </div>
    );
  }

  if (!examData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-amber-50/20 to-orange-50/10 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <p className="text-xl text-gray-600 mb-4">Không tìm thấy đề thi</p>
          <Link
            to="/giao-vien/de-thi"
            className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Quay lại danh sách
          </Link>
        </div>
      </div>
    );
  }

  const groupedQuestions = groupQuestionsByPart();
  const totalQuestions = examData.questions.length;

  return (
    <>
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
      <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-amber-50/20 to-orange-50/10">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-8 py-6">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                📝 {examData.eTitle}
              </h1>
              <p className="text-gray-600 mb-3">{examData.eDescription}</p>
              <div className="flex items-center gap-4 text-sm">
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                  🎯 {examData.ageGroup === 'kids' ? 'Kids' : examData.ageGroup}
                </span>
                {examData.examType && (
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full font-medium">
                    {examData.examType.toUpperCase()}
                  </span>
                )}
                {examData.mode && (
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                    {examData.mode === 'cambridge' ? 'Cambridge' : 'Flexible'}
                  </span>
                )}
                <span className="text-gray-500">
                  📅 {formatVNDate(examData.eCreated_at.replace(' ', 'T') + '+07:00')}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to={`/giao-vien/de-thi/kids/tao-moi/${examId}`}
                className="px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all flex items-center gap-2 font-medium shadow-lg shadow-orange-500/30"
              >
                <Edit className="w-4 h-4" />
                Chỉnh sửa
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border-2 border-blue-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-blue-100 rounded-lg">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Câu hỏi</p>
                <p className="text-2xl font-bold text-blue-600">{totalQuestions}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border-2 border-purple-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Clock className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Thời gian</p>
                <p className="text-2xl font-bold text-purple-600">{examData.eDuration} phút</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border-2 border-green-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-green-100 rounded-lg">
                <Target className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Tổng điểm</p>
                <p className="text-2xl font-bold text-green-600">{examData.totalPoints}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border-2 border-orange-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-orange-100 rounded-lg">
                <BarChart3 className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Điểm đạt</p>
                <p className="text-2xl font-bold text-orange-600">{examData.passingScore}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Questions by Part */}
        <div className="space-y-4">
          {Object.keys(groupedQuestions).sort((a, b) => parseInt(a) - parseInt(b)).map(partKey => {
            const partNumber = parseInt(partKey);
            const questions = groupedQuestions[partNumber];
            const partInfo = getPartName(partNumber);
            const partPoints = questions.reduce((sum, q) => sum + q.qPoints, 0);

            return (
              <div key={partNumber} className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
                {/* Part Header */}
                <div className={`p-6 ${
                  partNumber === 1 ? 'bg-blue-50 border-b-2 border-blue-200' :
                  partNumber === 2 ? 'bg-purple-50 border-b-2 border-purple-200' :
                  'bg-orange-50 border-b-2 border-orange-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold flex items-center gap-3">
                      <span className="text-3xl">{partInfo.icon}</span>
                      <span>PHẦN {partNumber}: {partInfo.name}</span>
                    </h3>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="px-3 py-1 bg-white rounded-full font-medium">
                        {questions.length} câu
                      </span>
                      <span className="px-3 py-1 bg-white rounded-full font-medium">
                        {partPoints} điểm
                      </span>
                    </div>
                  </div>
                </div>

                {/* Questions List */}
                <div className="p-6 space-y-4">
                  {questions.map((question) => (
                    <div
                      key={question.qId}
                      className="p-4 border-2 border-gray-200 rounded-lg hover:border-orange-300 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            {question.qSubPart && (
                              <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                                Part {partNumber}.{question.qSubPart}
                              </span>
                            )}
                            <h4 className="font-bold text-gray-900">
                              {getTaskTypeName(question.qType)}
                            </h4>
                          </div>
                          <div className="text-gray-600 text-sm mb-2">
                            {question.qContent ? (
                              /<\/?[a-z][\s\S]*>/i.test(question.qContent) ? (
                                <div
                                  className="prose prose-sm max-w-none text-gray-600 [&_p]:mb-1 [&_p:last-child]:mb-0"
                                  dangerouslySetInnerHTML={{ __html: question.qContent }}
                                />
                              ) : (
                                question.qContent
                              )
                            ) : (
                              'Không có mô tả'
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                            🎯 {question.qPoints} điểm
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">⚡ Thao tác</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Link
              to={`/giao-vien/de-thi/kids/tao-moi/${examId}`}
              className="px-4 py-3 border-2 border-orange-200 rounded-lg hover:bg-orange-50 transition-all flex items-center gap-2 justify-center font-medium"
            >
              <Edit className="w-4 h-4" />
              Chỉnh sửa
            </Link>
            <button
              className="px-4 py-3 border-2 border-blue-200 rounded-lg hover:bg-blue-50 transition-all flex items-center gap-2 justify-center font-medium"
              onClick={() => toast.info('Tính năng đang phát triển')}
            >
              <Copy className="w-4 h-4" />
              Nhân bản
            </button>
            <button
              className="px-4 py-3 border-2 border-green-200 rounded-lg hover:bg-green-50 transition-all flex items-center gap-2 justify-center font-medium"
              onClick={() => toast.info('Tính năng đang phát triển')}
            >
              <Send className="w-4 h-4" />
              Giao bài
            </button>
            <button
              className="px-4 py-3 border-2 border-purple-200 rounded-lg hover:bg-purple-50 transition-all flex items-center gap-2 justify-center font-medium"
              onClick={() => toast.info('Tính năng đang phát triển')}
            >
              <Download className="w-4 h-4" />
              Tải xuống
            </button>
            <button
              className="px-4 py-3 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-all flex items-center gap-2 justify-center font-medium"
              onClick={() => toast.info('Tính năng đang phát triển')}
            >
              <Archive className="w-4 h-4" />
              Lưu trữ
            </button>
            <button
              className="px-4 py-3 border-2 border-red-200 rounded-lg hover:bg-red-50 transition-all flex items-center gap-2 justify-center font-medium text-red-600"
              onClick={() => {
                if (confirm('Bạn có chắc muốn xóa đề thi này?')) {
                  toast.info('Tính năng đang phát triển');
                }
              }}
            >
              <Trash2 className="w-4 h-4" />
              Xóa
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}


