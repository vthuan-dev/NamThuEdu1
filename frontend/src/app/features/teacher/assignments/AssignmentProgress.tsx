import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import {
  ArrowLeft,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  Trophy,
  Calendar,
  Send,
  Eye,
  Bell,
  TrendingUp,
  Target,
  Loader2,
} from "lucide-react";
import { useAssignmentProgress } from "@/hooks/useAssignmentProgress";
import { formatVNDate } from "@/utils/dateUtils";

export function AssignmentProgress() {
  const { t } = useTranslation();
  const { assignmentId } = useParams();
  const [showReminderModal, setShowReminderModal] = useState(false);
  
  // Use custom hook
  const { data: progressData, loading, error } = useAssignmentProgress(assignmentId || '');

  // Extract data
  const assignment = progressData?.assignment;
  const students = progressData?.students || [];
  const completedStudents = students.filter((s) => s.status === "completed");
  const notCompletedStudents = students.filter((s) => s.status !== "completed");
  const totalStudents = progressData?.total_students || 0;
  const completionRate = progressData?.completion_rate || 0;

  const getTimeRemaining = () => {
    if (!assignment?.taDue_date) return t("teacher.assignments.progress.noDeadline");
    const now = new Date();
    const deadline = new Date(assignment.taDue_date);
    const diff = deadline.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (diff < 0) return t("teacher.assignments.progress.overdue");
    if (days > 0) return t("teacher.assignments.progress.daysHoursRemaining", { days, hours });
    if (hours > 0) return t("teacher.assignments.progress.hoursRemaining", { hours });
    return t("teacher.assignments.progress.almostDue");
  };

  const isOverdue = assignment?.taDue_date && new Date(assignment.taDue_date) < new Date();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-semibold">{t("teacher.assignments.progress.loading")}</p>
        </div>
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-6 flex items-center justify-center">
        <div className="text-center bg-white rounded-2xl p-8 border border-red-200">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <p className="text-red-600 font-semibold mb-2">{error || t("teacher.assignments.progress.notFound")}</p>
          <Link
            to="/giao-vien/bai-tap"
            className="inline-block px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all"
          >
            {t("teacher.assignments.progress.back")}
          </Link>
        </div>
      </div>
    );
  }

  const stats = [
    {
      label: t("teacher.assignments.progress.stats.totalStudents"),
      value: totalStudents,
      icon: Users,
      color: "from-blue-500 to-blue-600",
      bgColor: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      label: t("teacher.assignments.progress.stats.completed"),
      value: completedStudents.length,
      icon: CheckCircle2,
      color: "from-green-500 to-green-600",
      bgColor: "bg-green-50",
      iconColor: "text-green-600",
    },
    {
      label: t("teacher.assignments.progress.stats.notCompleted"),
      value: notCompletedStudents.length,
      icon: Clock,
      color: "from-orange-500 to-orange-600",
      bgColor: "bg-orange-50",
      iconColor: "text-orange-600",
    },
    {
      label: t("teacher.assignments.progress.stats.completionRate"),
      value: `${completionRate}%`,
      icon: TrendingUp,
      color: "from-purple-500 to-purple-600",
      bgColor: "bg-purple-50",
      iconColor: "text-purple-600",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <Link to="/giao-vien/bai-tap" className="text-gray-600 hover:text-blue-600 transition-colors">
            {t("teacher.assignments.progress.managementLink")}
          </Link>
          <span className="text-gray-400">/</span>
          <span className="text-gray-900 font-medium">{assignment?.taTitle || t('teacher.assignments.progress.title')}</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <Link
              to="/giao-vien/bai-tap"
              className="p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{t("teacher.assignments.progress.heading")} 📊</h1>
              <p className="text-gray-600 mt-1">{t("teacher.assignments.progress.subtitle")}</p>
            </div>
          </div>
        </div>

        {/* Assignment Info Card */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 text-white shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="text-blue-100 text-sm mb-1">{t("teacher.assignments.progress.examLabel")}</p>
              <p className="font-bold text-lg">{assignment?.taTitle || 'N/A'}</p>
              <span className="inline-block mt-2 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-lg text-xs font-semibold">
                {assignment?.taStatus || 'active'}
              </span>
            </div>
            <div>
              <p className="text-blue-100 text-sm mb-1">{t("teacher.assignments.table.target")}</p>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                <p className="font-bold text-lg">{totalStudents} {t("teacher.assignments.progress.stats.totalStudents")}</p>
              </div>
              <span className="inline-block mt-2 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-lg text-xs font-semibold">
                {t("teacher.assignments.progress.classLabel")}
              </span>
            </div>
            <div>
              <p className="text-blue-100 text-sm mb-1">{t("teacher.assignments.progress.dueDate")}</p>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                <p className="font-bold text-lg">
                  {assignment?.taDue_date ? formatVNDate(assignment.taDue_date) : 'N/A'}
                </p>
              </div>
              <p className="text-sm mt-2 font-semibold">{getTimeRemaining()}</p>
            </div>
            <div>
              <p className="text-blue-100 text-sm mb-1">{t("teacher.assignments.progress.avgScoreLabel")}</p>
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                <p className="font-bold text-lg">{progressData?.average_score?.toFixed(1) || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Overdue Banner */}
        {isOverdue && (
          <div className="bg-red-50 border-l-4 border-red-500 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-900">{t("teacher.assignments.progress.overdueTitle")}</p>
              <p className="text-sm text-red-700">
                {t("teacher.assignments.progress.overdueDesc")}
              </p>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200 p-6 hover:shadow-xl transition-all duration-300 group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-2">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <div
                  className={`w-12 h-12 ${stat.bgColor} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}
                >
                  <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Completed Students */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
                {t("teacher.assignments.progress.completedCount", { count: completedStudents.length })}
              </h2>
            </div>

            <div className="space-y-3">
              {completedStudents.map((student) => (
                <div
                  key={student.uId}
                  className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 p-4 hover:shadow-lg transition-all duration-200"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-gray-900">{student.uName}</p>
                      <p className="text-sm text-gray-600">{student.uPhone}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {student.submission?.sScore !== undefined && (
                        <>
                          <div className="px-3 py-1 bg-green-100 rounded-lg">
                            <p className="text-2xl font-bold text-green-700">{student.submission.sScore}</p>
                          </div>
                          <Trophy className="w-5 h-5 text-yellow-500" />
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs text-gray-600">
                      {student.submission?.sSubmitted_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(student.submission.sSubmitted_at).toLocaleString("vi-VN")}
                        </span>
                      )}
                      {student.submission?.sStatus === 'graded' && (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded font-semibold">
                          {t("teacher.assignments.progress.graded")}
                        </span>
                      )}
                    </div>
                    <Link
                      to={`/giao-vien/bai-tap/${assignmentId}/students/${student.uId}`}
                      className="text-blue-600 hover:text-blue-700 font-semibold text-sm flex items-center gap-1"
                    >
                      <Eye className="w-4 h-4" />
                      {t("teacher.common.viewDetail")}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Not Completed Students */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Clock className="w-6 h-6 text-orange-600" />
                {t("teacher.assignments.progress.notCompletedCount", { count: notCompletedStudents.length })}
              </h2>
            </div>

            <div className="space-y-3">
              {notCompletedStudents.map((student) => (
                <div
                  key={student.uId}
                  className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 p-4 hover:shadow-lg transition-all duration-200"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-gray-900">{student.uName}</p>
                      <p className="text-sm text-gray-600">{student.uPhone}</p>
                    </div>
                    <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-lg text-xs font-semibold">
                      {t("teacher.assignments.progress.notStarted")}
                    </span>
                  </div>

                  <button className="w-full py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2">
                    <Bell className="w-4 h-4" />
                    {t("teacher.assignments.progress.sendReminder")}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Floating Action Button */}
        {notCompletedStudents.length > 0 && (
          <button
            onClick={() => setShowReminderModal(true)}
            className="fixed bottom-8 right-8 px-6 py-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold rounded-full shadow-2xl shadow-orange-500/50 flex items-center gap-2 transition-all duration-200 hover:scale-105"
          >
            <Send className="w-5 h-5" />
            {t("teacher.assignments.progress.bulkReminderBtn", { count: notCompletedStudents.length })}
          </button>
        )}
      </div>
    </div>
  );
}