import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Monitor, Smartphone, LogOut, Trash2, ChevronDown, Loader2, RefreshCw } from 'lucide-react';
import { studentApi } from '../../../../services/studentApi';
import { useToastContext } from '../../../../contexts/ToastContext';
import type { AccentTheme } from './AccountInfoCard';

const DEFAULT_ACCENT: AccentTheme = {
  base: '#7C3AED', deep: '#6D28D9', soft: '#F5F3FF', ring: '#EDE9FE', border: '#E8E4F9',
};

interface Session {
  id: number;
  name: string;
  ip: string | null;
  last_used_at: string | null;
  created_at: string;
  is_current: boolean;
}

function formatTime(iso: string | null): string {
  if (!iso) return 'Chưa sử dụng';
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return 'Vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)} ngày trước`;
  return d.toLocaleDateString('vi-VN');
}

function DeviceIcon({ name }: { name: string }) {
  const lower = name.toLowerCase();
  if (lower.includes('mobile') || lower.includes('android') || lower.includes('ios')) {
    return <Smartphone className="w-4 h-4" />;
  }
  return <Monitor className="w-4 h-4" />;
}

type Props = {
  defaultExpanded?: boolean;
  /** Bộ màu accent; mặc định tím (Adults). */
  accent?: AccentTheme;
};

export function SecurityCard({ defaultExpanded = true, accent = DEFAULT_ACCENT }: Props) {
  const toast = useToastContext();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(defaultExpanded);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['student', 'sessions'],
    queryFn: () => studentApi.getSessions(),
    enabled: expanded,
  });

  const sessions: Session[] = (data as any)?.data?.data ?? [];

  const revokeMutation = useMutation({
    mutationFn: (id: number) => studentApi.revokeSession(id),
    onSuccess: () => {
      toast.success('Đã đăng xuất thiết bị');
      queryClient.invalidateQueries({ queryKey: ['student', 'sessions'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Không thể đăng xuất thiết bị');
    },
  });

  const revokeAllMutation = useMutation({
    mutationFn: () => studentApi.revokeAllSessions(),
    onSuccess: (res: any) => {
      toast.success(res?.data?.message ?? 'Đã đăng xuất tất cả thiết bị khác');
      queryClient.invalidateQueries({ queryKey: ['student', 'sessions'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Có lỗi xảy ra');
    },
  });

  const otherSessions = sessions.filter((s) => !s.is_current);

  return (
    <section
      className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
      style={{
        '--acc': accent.base,
        '--acc-deep': accent.deep,
        '--acc-soft': accent.soft,
        '--acc-ring': accent.ring,
        '--acc-border': accent.border,
      } as any}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 p-4 sm:p-6 hover:bg-slate-50/50 transition-colors text-left"
        aria-expanded={expanded}
      >
        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--acc-soft)' }}>
          <Shield className="w-5 h-5" style={{ color: 'var(--acc)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">Bảo mật & Thiết bị</h2>
          <p className="text-xs sm:text-sm text-slate-500 truncate">
            Quản lý phiên đăng nhập và thiết bị đang hoạt động
          </p>
        </div>
        <div className="flex items-center gap-2">
          {sessions.length > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
              style={{ background: 'var(--acc-ring)', color: 'var(--acc-deep)' }}>
              {sessions.length} thiết bị
            </span>
          )}
          <ChevronDown
            className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {expanded && (
        <div id="security-card-body" className="border-t border-slate-100 px-4 sm:px-6 pb-6 pt-4 space-y-5">

          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-slate-400 gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Đang tải...</span>
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Không có phiên nào.</p>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center gap-3 p-3 rounded-xl border transition-colors"
                  style={{
                    borderColor: session.is_current ? 'var(--acc)' : '#F1F5F9',
                    background: session.is_current ? 'var(--acc-soft)' : '#FAFAFA',
                  }}
                >
                  {/* Icon */}
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background: session.is_current ? 'var(--acc-ring)' : '#F1F5F9',
                      color: session.is_current ? 'var(--acc)' : '#64748B',
                    }}
                  >
                    <DeviceIcon name={session.name} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800 truncate">
                        {session.name}
                      </span>
                      {session.is_current && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ background: 'var(--acc)', color: '#fff' }}>
                          Thiết bị này
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {session.ip ? `IP: ${session.ip} · ` : ''}
                      Lần cuối: {formatTime(session.last_used_at)}
                    </p>
                    <p className="text-xs text-slate-400">
                      Đăng nhập: {new Date(session.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  {/* Revoke button */}
                  {!session.is_current && (
                    <button
                      onClick={() => revokeMutation.mutate(session.id)}
                      disabled={revokeMutation.isPending}
                      className="flex-shrink-0 p-2 rounded-lg transition-colors hover:bg-red-50 text-slate-400 hover:text-red-500"
                      title="Đăng xuất thiết bị này"
                    >
                      {revokeMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <LogOut className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => refetch()}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-slate-100 text-slate-600"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Làm mới
            </button>

            {otherSessions.length > 0 && (
              <button
                onClick={() => revokeAllMutation.mutate()}
                disabled={revokeAllMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors hover:bg-red-50 text-red-600 border border-red-100"
              >
                {revokeAllMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                Đăng xuất {otherSessions.length} thiết bị khác
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
