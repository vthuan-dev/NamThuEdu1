import { useState, useEffect, useRef } from "react";
import { Link } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell, Check, ClipboardList, CheckCircle, AlertCircle,
  MessageSquare, Trophy, Clock, ChevronRight, X, PenLine,
} from "lucide-react";
import { studentApi } from "../../../services/studentApi";
import type { ExamSchedule } from "../../../services/studentApi";
import { formatTimeAgo, formatDateTime } from "../../../utils/formatters";
import { ExamScheduleDetailPopup } from "./ExamScheduleDetailPopup";

const PURPLE = "#7C3AED";
const STUDENT_BASE_PATH = "/hoc-vien";

interface NotificationDto {
  id: number | string;
  title: string;
  message: string;
  type: string;
  color?: string;
  is_read?: boolean;
  created_at: string;
  action_url?: string;
  action_label?: string;
}

const ICON_MAP: Record<string, any> = {
  assignment: ClipboardList,
  graded:     CheckCircle,
  // Điểm bị sửa sau khi đã chấm — tách khỏi `graded` để học viên nhận ra ngay
  // đây không phải thông báo chấm bài bình thường.
  score_updated: PenLine,
  deadline:   AlertCircle,
  message:    MessageSquare,
  achievement: Trophy,
};

function getIcon(type: string) {
  return ICON_MAP[type] ?? Bell;
}

function resolveStudentActionUrl(actionUrl?: string): string | null {
  if (!actionUrl) return null;
  const normalized = actionUrl.startsWith("/") ? actionUrl : `/${actionUrl}`;
  if (normalized.startsWith(`${STUDENT_BASE_PATH}/`)) return normalized;
  return `${STUDENT_BASE_PATH}${normalized}`;
}

export function NotificationDropdown({ activeColor = "#7C3AED", hoverBg = "hover:bg-purple-50" }: { activeColor?: string; hoverBg?: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [scheduleDetail, setScheduleDetail] = useState<ExamSchedule | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInitialLoadRef = useRef(true);
  const prevNotificationsRef = useRef<NotificationDto[]>([]);

  // Audio: single preloaded instance + autoplay unlock on first user gesture.
  // Browsers block Audio.play() until the user interacts with the page,
  // so we silently warm it up once on the first pointer/key/touch event.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlockedRef = useRef(false);

  useEffect(() => {
    if (!audioRef.current) {
      const a = new Audio("/sounds/sound-noti.mp3");
      a.preload = "auto";
      a.volume = 0.6;
      audioRef.current = a;
    }

    if (audioUnlockedRef.current) return;

    const unlock = () => {
      const a = audioRef.current;
      if (!a || audioUnlockedRef.current) return;
      const prevMuted = a.muted;
      a.muted = true;
      a.play()
        .then(() => {
          a.pause();
          a.currentTime = 0;
          a.muted = prevMuted;
          audioUnlockedRef.current = true;
        })
        .catch(() => {
          /* will retry on next gesture */
        });
    };

    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    window.addEventListener("touchstart", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  const playNotificationSound = () => {
    const a = audioRef.current;
    if (!a) return;
    try {
      a.currentTime = 0;
    } catch {
      /* ignore */
    }
    a.play().catch((err) => {
      console.warn("Notification audio play failed or blocked:", err);
    });
  };

  // Fetch notifications. Polling 10s khi tab active, refetch ngay khi user
  // focus lại tab — đảm bảo gần realtime mà không tốn tài nguyên khi background.
  const { data, isLoading } = useQuery({
    queryKey: ["student", "notifications", "dropdown"],
    queryFn: () => studentApi.getNotifications({ limit: 10 }),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 0,
  });

  const notifications: NotificationDto[] = (data as any)?.data?.data?.notifications || [];
  const unreadCount: number = (data as any)?.data?.data?.unread_count || 0;

  const markAllReadMutation = useMutation({
    mutationFn: () => studentApi.markAllNotificationsRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["student", "notifications", "dropdown"] });
      const prev = queryClient.getQueryData(["student", "notifications", "dropdown"]);
      queryClient.setQueryData(["student", "notifications", "dropdown"], (old: any) => {
        if (!old) return old;
        const inner = old?.data?.data;
        return {
          ...old,
          data: {
            ...old.data,
            data: {
              ...inner,
              unread_count: 0,
              notifications: inner?.notifications?.map((n: any) => ({ ...n, is_read: true })) ?? [],
            },
          },
        };
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["student", "notifications", "dropdown"], ctx.prev);
    },
    onSuccess: () => {
      // Small delay so the server has committed before we refetch
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["student", "notifications"] });
      }, 800);
    },
  });

  // Delete a single notification (dismiss permanently)
  const deleteNotifMutation = useMutation({
    mutationFn: (id: number | string) => studentApi.deleteNotification(Number(id)),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["student", "notifications", "dropdown"] });
      const prev = queryClient.getQueryData(["student", "notifications", "dropdown"]);
      queryClient.setQueryData(["student", "notifications", "dropdown"], (old: any) => {
        if (!old) return old;
        const inner = old?.data?.data;
        const filtered = inner?.notifications?.filter((n: any) => String(n.id) !== String(id)) ?? [];
        return {
          ...old,
          data: {
            ...old.data,
            data: {
              ...inner,
              notifications: filtered,
              unread_count: filtered.filter((n: any) => !n.is_read).length,
            },
          },
        };
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["student", "notifications", "dropdown"], ctx.prev);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student", "notifications"] });
    },
  });

  // Play sound when a new unread notification arrives
  useEffect(() => {
    if (isLoading) return;

    if (isInitialLoadRef.current) {
      prevNotificationsRef.current = notifications;
      isInitialLoadRef.current = false;
      // On first load: play sound if there are any unread notifications
      const hasUnread = notifications.some(n => !n.is_read);
      if (hasUnread) {
        playNotificationSound();
      }
      return;
    }

    const prevIds = new Set(prevNotificationsRef.current.map(n => String(n.id)));
    const newUnread = notifications.filter(
      n => !n.is_read && !prevIds.has(String(n.id))
    );

    if (newUnread.length > 0) {
      playNotificationSound();
    }

    prevNotificationsRef.current = notifications;
  }, [notifications, isLoading]);

  const handleOpen = () => {
    setOpen(true);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setIsVisible(true))
    );
  };

  // Auto mark all as read when dropdown opens (Facebook-style: opening = seen)
  useEffect(() => {
    if (open && unreadCount > 0) {
      markAllReadMutation.mutate();
    }
  }, [open]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => setOpen(false), 220);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  // Real-time: when SW receives a push notification, refresh the badge count
  useEffect(() => {
    if (!navigator.serviceWorker) return;
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "NEW_NOTIFICATION") {
        queryClient.invalidateQueries({ queryKey: ["student", "notifications", "dropdown"] });
        playNotificationSound();
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [queryClient]);

  // Real-time: lắng nghe BroadcastChannel khi 1 tab khác cùng origin tạo
  // comment/reply mới — invalidate ngay để badge cập nhật không cần đợi 10s poll
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel("exam-comments");
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "comment_changed") {
        queryClient.invalidateQueries({ queryKey: ["student", "notifications", "dropdown"] });
      }
    };
    ch.addEventListener("message", handler);
    return () => {
      ch.removeEventListener("message", handler);
      ch.close();
    };
  }, [queryClient]);

  return (
    <div
      className="relative"
      ref={containerRef}
    >
      <button
        type="button"
        onClick={() => (open ? handleClose() : handleOpen())}
        className={`relative p-2 rounded-xl transition-colors duration-200 ${hoverBg}`}
        aria-label="Thông báo"
      >
        <Bell className="w-5 h-5" style={{ color: open ? activeColor : "#6B7280" }} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-bold text-white tabular-nums"
            style={{
              background: "#EF4444",
              boxShadow: "0 0 0 2px white",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
        {/* Mobile backdrop */}
        <div
          className="fixed inset-0 z-[109] sm:hidden"
          onClick={handleClose}
        />

        <div
          className={[
            /* mobile: fixed full-width below navbar */
            "fixed left-2 right-2 top-[56px]",
            /* sm+: classic absolute dropdown */
            "sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[400px]",
            "z-[110] rounded-2xl overflow-hidden border bg-white/95 backdrop-blur-md",
            "transition-all duration-200 ease-out",
            isVisible
              ? "opacity-100 scale-100 translate-y-0"
              : "opacity-0 scale-95 -translate-y-2",
          ].join(" ")}
          style={{
            borderColor: "#E5E7EB",
            boxShadow:
              "0 20px 48px rgba(124,58,237,0.12), 0 4px 12px rgba(0,0,0,0.06)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3.5 border-b"
            style={{ borderColor: "#F1F5F9" }}
          >
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black text-slate-850 uppercase tracking-widest">
                Thông báo
              </h3>
              {unreadCount > 0 && (
                <span
                  className="text-[9px] font-black px-2 py-0.5 rounded-full text-white bg-red-500 animate-pulse"
                >
                  {unreadCount} mới
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="text-[10px] font-black flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-slate-50 transition-colors border border-slate-100 text-slate-650 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                Đánh dấu tất cả
              </button>
            )}
          </div>

          {/* List */}
          <div
            className="overflow-y-auto"
            style={{ maxHeight: 420 }}
          >
            {isLoading ? (
              <div className="py-12 text-center">
                <div
                  className="w-8 h-8 border-2 rounded-full animate-spin mx-auto"
                  style={{ borderColor: "#EDE9FE", borderTopColor: activeColor }}
                />
                <p className="mt-3 text-xs text-gray-400">Đang tải...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 text-center px-6">
                <div
                  className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                  style={{ background: "#F5F3FF" }}
                >
                  <Bell className="w-6 h-6" style={{ color: "#A78BFA" }} />
                </div>
                <p className="text-sm font-semibold text-gray-700">
                  Chưa có thông báo nào
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Các cập nhật mới sẽ hiển thị ở đây
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {notifications.map((notif, idx) => {
                  const Icon = getIcon(notif.type);
                  const color = notif.color || "#7C3AED";
                  const isUnread = !notif.is_read;
                  // Zebra striping: xen ke dam/nhat giua 2 thong bao lien nhau
                  // de de phan biet tung muc (dong chan = nen sang, dong le = nen xam nhat).
                  const zebraBg = idx % 2 === 1 ? "#F5F6F8" : "#FFFFFF";
                  const url = resolveStudentActionUrl(notif.action_url);
                  const isResultUrl = url?.includes("/ket-qua/");
                  const isExamSchedule = String(notif.id).startsWith("exam_schedule_");

                  const openScheduleDetail = async () => {
                    const schId = Number(String(notif.id).replace("exam_schedule_", ""));
                    try {
                      const res = await studentApi.getExamSchedules();
                      const list: ExamSchedule[] = (res as any)?.data?.data?.schedules ?? [];
                      const found = list.find((s) => Number(s.id) === schId);
                      setScheduleDetail(found ?? {
                        id: schId,
                        student_id: 0,
                        title: notif.title.replace(/^📅\s*Lịch thi:\s*/, ""),
                        exam_type: null,
                        exam_date: "",
                        exam_time: null,
                        location: null,
                        note: notif.message,
                        days_until: null,
                        is_urgent: false,
                        teacher_name: null,
                        created_at: notif.created_at,
                      });
                    } catch {
                      /* ignore */
                    }
                    handleClose();
                  };

                  const handleNotifClick = (e: React.MouseEvent) => {
                    if (isExamSchedule) {
                      e.preventDefault();
                      openScheduleDetail();
                      return;
                    }
                    if (isResultUrl && url) {
                      e.preventDefault();
                      const parts = url.split("/");
                      const subId = Number(parts[parts.length - 1]);
                      if (subId) {
                        window.dispatchEvent(new CustomEvent("open-result-modal", { detail: { submissionId: subId } }));
                        handleClose();
                      }
                    } else {
                      handleClose();
                    }
                  };

                  const useLink = url && !isResultUrl && !isExamSchedule;
                  const Wrapper: any = useLink ? Link : "div";
                  const wrapperProps = useLink
                    ? { to: url, onClick: () => handleClose() }
                    : { onClick: handleNotifClick };

                  return (
                    <Wrapper
                      key={notif.id}
                      {...wrapperProps}
                      className="group flex items-start gap-3.5 px-4 py-3.5 transition-all duration-300 hover:bg-slate-50/50 cursor-pointer relative"
                      style={{
                        background: isUnread ? "rgba(124,58,237,0.06)" : zebraBg,
                        borderLeft: isUnread ? `4px solid ${color}` : "4px solid transparent",
                      }}
                    >
                      <div
                        className="w-9.5 h-9.5 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 transition-transform duration-300 group-hover:scale-105"
                        style={{ background: `${color}10`, border: `1px solid ${color}20` }}
                      >
                        <Icon className="w-4.5 h-4.5" style={{ color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4
                            className={`text-[13px] truncate ${
                              isUnread ? "font-black text-slate-900" : "font-bold text-slate-700"
                            }`}
                          >
                            {notif.title}
                          </h4>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {isUnread && (
                              <span
                                className="w-2 h-2 rounded-full mt-1.5"
                                style={{ background: color }}
                              />
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                deleteNotifMutation.mutate(notif.id);
                              }}
                              className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all"
                              aria-label="Xóa thông báo"
                            >
                              <X className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
                            </button>
                          </div>
                        </div>
                        <p
                          className="text-xs mt-1 leading-relaxed text-slate-500 line-clamp-2"
                        >
                          {notif.message}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2 text-[10px] text-slate-400 font-bold">
                          <Clock
                            className="w-3.5 h-3.5 text-slate-350"
                          />
                          <span title={formatDateTime(notif.created_at)}>{formatTimeAgo(notif.created_at)}</span>
                          <span className="text-slate-300 font-normal">·</span>
                          <span className="font-normal text-slate-400">{formatDateTime(notif.created_at)}</span>
                          {notif.action_label && url && (
                            <>
                              <span className="text-slate-200 font-normal">•</span>
                              <span
                                className="font-black flex items-center gap-0.5"
                                style={{ color }}
                              >
                                {notif.action_label}
                                <ChevronRight className="w-3 h-3" />
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </Wrapper>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        </>
      )}

      {scheduleDetail && (
        <ExamScheduleDetailPopup
          schedule={scheduleDetail}
          onClose={() => setScheduleDetail(null)}
        />
      )}
    </div>
  );
}
