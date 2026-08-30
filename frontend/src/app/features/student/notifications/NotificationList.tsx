import { useState } from "react";
import { Link } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Bell,
  ClipboardList,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  Trophy,
  Clock,
  MoreVertical,
  Check,
  Trash2,
  PenLine,
} from "lucide-react";
import { studentApi } from "../../../../services/studentApi";
import { Header } from "../../../components/shared/Header";
import { formatTimeAgo } from "../../../../utils/formatters";
import { studentRolePalette } from "../../../../utils/studentRoleTheme";

const PAL = studentRolePalette();

type NotificationType = 'all' | 'assignment' | 'graded' | 'score_updated' | 'deadline' | 'message' | 'achievement';
const STUDENT_BASE_PATH = "/hoc-vien";

function resolveStudentActionUrl(actionUrl: string): string {
  const normalized = actionUrl.startsWith("/") ? actionUrl : `/${actionUrl}`;

  if (normalized.startsWith(`${STUDENT_BASE_PATH}/`)) return normalized;
  if (normalized.startsWith("/bai-tap")) return `${STUDENT_BASE_PATH}/bai-tap`;
  if (normalized.startsWith("/luyen-tap")) return `${STUDENT_BASE_PATH}/luyen-tap`;
  if (normalized.startsWith("/thong-bao")) return `${STUDENT_BASE_PATH}/thong-bao`;
  if (normalized.startsWith("/tien-do")) return `${STUDENT_BASE_PATH}/tien-do`;
  if (normalized.startsWith("/lich-su")) return `${STUDENT_BASE_PATH}/lich-su`;
  if (normalized.startsWith("/ho-so")) return `${STUDENT_BASE_PATH}/ho-so`;
  if (normalized.startsWith("/cai-dat")) return `${STUDENT_BASE_PATH}/cai-dat`;
  if (normalized.startsWith("/ket-qua/")) return `${STUDENT_BASE_PATH}${normalized}`;
  if (normalized.startsWith("/dap-an/")) return `${STUDENT_BASE_PATH}${normalized}`;
  if (normalized.startsWith("/phong-cho/")) return `${STUDENT_BASE_PATH}${normalized}`;
  if (normalized.startsWith("/lam-bai/")) return `${STUDENT_BASE_PATH}${normalized}`;

  return `${STUDENT_BASE_PATH}${normalized}`;
}

export function NotificationList() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<NotificationType>('all');
  const [openMenu, setOpenMenu] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['student', 'notifications'],
    queryFn: () => studentApi.getNotifications(),
    // Khớp với NotificationDropdown: không có dòng này thì trang này phải F5 mới
    // thấy điểm vừa được chấm, trong khi chuông ở header đã hiện.
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id: number) => studentApi.markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', 'notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => studentApi.markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', 'notifications'] });
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: (id: number) => studentApi.deleteNotification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', 'notifications'] });
    },
  });

  const notifications = (data as any)?.data?.data?.notifications || [];
  const unreadCount = (data as any)?.data?.data?.unread_count || 0;

  const filteredNotifications = notifications.filter(notif => {
    if (filter === 'all') return true;
    // Tab "Kết quả" hiện cả thông báo sửa điểm — loại này không có tab riêng nên
    // nếu lọc đúng bằng nhau thì nó chỉ xem được ở tab "Tất cả".
    if (filter === 'graded') return notif.type === 'graded' || notif.type === 'score_updated';
    return notif.type === filter;
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'assignment': return ClipboardList;
      case 'graded': return CheckCircle;
      // Phân biệt "đã chấm" với "điểm bị sửa sau khi chấm".
      case 'score_updated': return PenLine;
      case 'deadline': return AlertCircle;
      case 'message': return MessageSquare;
      case 'achievement': return Trophy;
      default: return Bell;
    }
  };

  const tabs = [
    { key: 'all', label: t('student.notifications.tabs.all') },
    { key: 'assignment', label: t('student.notifications.tabs.assignments') },
    { key: 'graded', label: t('student.notifications.tabs.results') },
    { key: 'deadline', label: t('student.notifications.tabs.reminders') },
    { key: 'message', label: t('student.notifications.tabs.messages') },
  ];

  return (
    <div className="min-h-screen" style={{ background: PAL.bg }}>

      {/* Hero */}
      <div className="relative overflow-hidden"
        style={{ background: PAL.hero }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/3 w-72 h-72 rounded-full opacity-20"
            style={{ background: `radial-gradient(circle, ${PAL.orb}, transparent)`, transform: "translateY(-50%)" }} />
          <div className="absolute bottom-0 right-1/4 w-52 h-52 rounded-full opacity-15"
            style={{ background: `radial-gradient(circle, ${PAL.orb}, transparent)`, transform: "translateY(40%)" }} />
        </div>
        <div className="relative z-10 px-4 sm:px-8 lg:px-16 py-6 sm:py-10">
          {/* `flex-col` dưới sm: tiêu đề và khối "chưa đọc + Đánh dấu đã đọc"
              đứng cạnh nhau trên màn 375px thì cả hai đều bị bóp. */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-start gap-3 sm:gap-4 min-w-0">
              <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg"
                style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.25)" }}>
                <Bell className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-semibold tracking-widest uppercase mb-1" style={{ color: PAL.label }}>Hệ thống</p>
                <h1 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
                  {t('student.notifications.title')}
                </h1>
                <p className="text-sm mt-1 font-medium" style={{ color: PAL.sub }}>Theo dõi các thông báo và cập nhật mới nhất</p>
              </div>
            </div>
            {unreadCount > 0 && (
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <div className="px-3 py-1.5 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap"
                  style={{ background: "rgba(255,255,255,0.15)", color: "#FCD34D", border: "1px solid rgba(255,255,255,0.2)" }}>
                  {unreadCount} chưa đọc
                </div>
                <button
                  onClick={() => markAllReadMutation.mutate()}
                  disabled={markAllReadMutation.isPending}
                  className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 whitespace-nowrap"
                  style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.25)" }}
                >
                  <Check className="w-4 h-4 flex-shrink-0" />
                  {t('student.notifications.markAllRead')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-8 lg:px-16 py-6 sm:py-8 space-y-4 sm:space-y-5">
        {/* Tabs — `scrollbar-none` vì dải cuộn ngang có thanh scroll trên
            Windows trông rất lạc quẻ, còn trên mobile thì không cần. */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as NotificationType)}
              className="inline-flex items-center justify-center min-h-11 px-4 rounded-xl transition-all whitespace-nowrap text-sm font-semibold flex-shrink-0"
              style={{
                background: filter === tab.key ? PAL.accent : "white",
                color: filter === tab.key ? "white" : "#6B7280",
                border: `1.5px solid ${filter === tab.key ? PAL.accent : "#F0F0F8"}`,
                boxShadow: filter === tab.key ? `0 2px 8px ${PAL.accent}4D` : "none",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Notifications List */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: PAL.accentLight, borderTopColor: PAL.accent }} />
            <p className="mt-3 text-gray-500">{t('common.loading')}</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl" style={{ border: "1.5px solid #F0F0F8" }}>
            <Bell className="w-16 h-16 mx-auto mb-4" style={{ color: "#D1D5DB" }} />
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>
              {t('student.notifications.empty.title')}
            </h3>
            <p style={{ fontSize: 14, color: "#9CA3AF", marginTop: 8 }}>
              {t('student.notifications.empty.subtitle')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notif) => {
              const Icon = getNotificationIcon(notif.type);
              const isUnread = !notif.is_read;

              return (
                <div
                  key={notif.id}
                  className="bg-white rounded-2xl p-4 transition-all hover:-translate-y-0.5 relative"
                  style={{
                    border: isUnread ? `1.5px solid ${PAL.accent}66` : "1.5px solid #F0F0F8",
                    borderLeft: isUnread ? `4px solid ${PAL.accent}` : "4px solid #F0F0F8",
                    background: isUnread ? `${PAL.accentLight}55` : "white",
                    boxShadow: isUnread ? `0 2px 12px ${PAL.accent}14` : "0 1px 4px rgba(0,0,0,0.04)",
                  }}
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${notif.color}15` }}
                    >
                      <Icon className="w-5 h-5" style={{ color: notif.color }} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <h3
                          style={{
                            fontSize: 14,
                            fontWeight: isUnread ? 700 : 600,
                            color: "#1F1344",
                          }}
                        >
                          {notif.title}
                        </h3>
                        <div className="flex items-center gap-2">
                          {isUnread && (
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ background: PAL.accent }}
                            />
                          )}
                          <button
                            onClick={() => setOpenMenu(openMenu === notif.id ? null : notif.id)}
                            className="p-1 hover:bg-gray-100 rounded transition-all"
                          >
                            <MoreVertical className="w-4 h-4" style={{ color: "#9CA3AF" }} />
                          </button>
                        </div>
                      </div>

                      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 8 }}>
                        {notif.message}
                      </p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" style={{ color: "#9CA3AF" }} />
                          <span style={{ fontSize: 12, color: "#9CA3AF" }}>
                            {formatTimeAgo(notif.created_at)}
                          </span>
                        </div>

                        {notif.action_url && (() => {
                          const url = resolveStudentActionUrl(notif.action_url);
                          const opensResultModal = url?.includes("/ket-qua/");
                          
                          const handleActionClick = (e: React.MouseEvent) => {
                            if (isUnread) {
                              markAsReadMutation.mutate(notif.id as any);
                            }
                            if (opensResultModal) {
                              e.preventDefault();
                              const parts = url.split("/");
                              const subId = Number(parts[parts.length - 1]);
                              if (subId) {
                                window.dispatchEvent(new CustomEvent("open-result-modal", { detail: { submissionId: subId } }));
                              }
                            }
                          };

                          return opensResultModal ? (
                            <button
                              onClick={handleActionClick}
                              className="px-3 py-1.5 rounded-lg transition-all hover:opacity-90 text-white font-semibold text-xs text-center"
                              style={{ background: notif.color }}
                            >
                              {notif.action_label}
                            </button>
                          ) : (
                            <Link
                              to={url}
                              onClick={handleActionClick}
                              className="px-3 py-1.5 rounded-lg transition-all hover:opacity-90 text-white font-semibold text-xs text-center"
                              style={{ background: notif.color }}
                            >
                              {notif.action_label}
                            </Link>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Dropdown Menu */}
                    {openMenu === notif.id && (
                      <div
                        className="absolute right-4 top-12 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10"
                        style={{ minWidth: 160 }}
                      >
                        {isUnread && (
                          <button
                            onClick={() => {
                              markAsReadMutation.mutate(notif.id);
                              setOpenMenu(null);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-all"
                            style={{ fontSize: 13, color: "#374151" }}
                          >
                            <Check className="w-4 h-4" />
                            {t('student.notifications.actions.markRead')}
                          </button>
                        )}
                        <button
                          onClick={() => {
                            deleteNotificationMutation.mutate(notif.id);
                            setOpenMenu(null);
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2 hover:bg-red-50 transition-all"
                          style={{ fontSize: 13, color: "#EF4444" }}
                        >
                          <Trash2 className="w-4 h-4" />
                          {t('student.notifications.actions.delete')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
