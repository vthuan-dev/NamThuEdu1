import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Lock, Eye, EyeOff, AlertCircle, ShieldCheck, ChevronDown } from 'lucide-react';
import { studentApi } from '../../../../services/studentApi';
import { useToastContext } from '../../../../contexts/ToastContext';
import type { AccentTheme } from './AccountInfoCard';

const DEFAULT_ACCENT: AccentTheme = {
  base: '#7C3AED', deep: '#6D28D9', soft: '#F5F3FF', ring: '#EDE9FE', border: '#E8E4F9',
};

type Form = {
  current_password: string;
  new_password: string;
  new_password_confirmation: string;
};

const inputBase =
  'w-full px-3.5 py-2.5 pr-10 rounded-lg border text-sm text-slate-900 ' +
  'placeholder:text-slate-400 transition-colors ' +
  'focus:outline-none focus:border-[var(--acc)] focus:ring-2 focus:ring-[var(--acc-ring)]';

const inputStyle = { borderColor: 'var(--acc-border)' };

const labelBase = 'block text-xs font-semibold text-slate-700 mb-1.5';

function PasswordStrength({ value }: { value: string }) {
  let score = 0;
  if (value.length >= 8) score++;
  if (/[A-Z]/.test(value)) score++;
  if (/[0-9]/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;

  const labels = ['Quá yếu', 'Yếu', 'Trung bình', 'Khá', 'Mạnh'];
  const colors = ['bg-slate-200', 'bg-rose-400', 'bg-amber-400', 'bg-sky-400', 'bg-emerald-500'];

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < score ? colors[score] : 'bg-slate-100'
            }`}
          />
        ))}
      </div>
      <p className="text-[11px] text-slate-500">
        Độ mạnh: <span className="font-semibold text-slate-700">{labels[score]}</span>
      </p>
    </div>
  );
}

type Props = {
  /** Whether card is expanded by default. Defaults to false (collapsed). */
  defaultExpanded?: boolean;
  /** Bộ màu accent; mặc định tím (Adults). */
  accent?: AccentTheme;
};

export function PasswordChangeCard({ defaultExpanded = false, accent = DEFAULT_ACCENT }: Props = {}) {
  const toast = useToastContext();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [form, setForm] = useState<Form>({
    current_password: '',
    new_password: '',
    new_password_confirmation: '',
  });
  const [show, setShow] = useState({ curr: false, new: false, confirm: false });

  const mutation = useMutation({
    mutationFn: () => studentApi.changePassword(form),
    onSuccess: () => {
      toast.success('Đổi mật khẩu thành công');
      setForm({ current_password: '', new_password: '', new_password_confirmation: '' });
    },
    onError: (err: any) => {
      const errors = err?.response?.data?.errors;
      const firstError = errors ? Object.values(errors).flat()[0] : null;
      const msg =
        firstError ||
        err?.response?.data?.message ||
        'Mật khẩu hiện tại không đúng. Vui lòng thử lại.';
      toast.error(String(msg));
    },
  });

  const passwordsMatch =
    !form.new_password_confirmation ||
    form.new_password === form.new_password_confirmation;
  const canSubmit =
    form.current_password.length >= 6 &&
    form.new_password.length >= 8 &&
    passwordsMatch &&
    !mutation.isPending;

  const fields = [
    {
      key: 'current_password' as const,
      label: 'Mật khẩu hiện tại',
      placeholder: '••••••••',
      show: show.curr,
      toggle: () => setShow((s) => ({ ...s, curr: !s.curr })),
    },
    {
      key: 'new_password' as const,
      label: 'Mật khẩu mới',
      placeholder: 'Tối thiểu 8 ký tự',
      show: show.new,
      toggle: () => setShow((s) => ({ ...s, new: !s.new })),
    },
    {
      key: 'new_password_confirmation' as const,
      label: 'Xác nhận mật khẩu mới',
      placeholder: 'Nhập lại mật khẩu mới',
      show: show.confirm,
      toggle: () => setShow((s) => ({ ...s, confirm: !s.confirm })),
    },
  ];

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
      {/* Header — clickable for collapse/expand */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 p-4 sm:p-6 hover:bg-slate-50/50 transition-colors text-left"
        aria-expanded={expanded}
        aria-controls="password-change-body"
      >
        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--acc-soft)' }}>
          <ShieldCheck className="w-5 h-5" style={{ color: 'var(--acc)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">Đổi mật khẩu</h2>
          <p className="text-xs sm:text-sm text-slate-500 truncate">
            Bảo mật tài khoản — đổi mật khẩu định kỳ
          </p>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div id="password-change-body" className="px-4 sm:px-6 pb-5 sm:pb-6 -mt-2">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) mutation.mutate();
        }}
      >
        {fields.map((field) => (
          <div key={field.key}>
            <label htmlFor={field.key} className={labelBase}>{field.label}</label>
            <div className="relative">
              <input
                id={field.key}
                type={field.show ? 'text' : 'password'}
                className={inputBase}
                style={inputStyle}
                placeholder={field.placeholder}
                value={form[field.key]}
                onChange={(e) =>
                  setForm((f) => ({ ...f, [field.key]: e.target.value }))
                }
                autoComplete={
                  field.key === 'current_password' ? 'current-password' : 'new-password'
                }
                required
              />
              <button
                type="button"
                onClick={field.toggle}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 transition-colors"
                aria-label={field.show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {field.show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Strength meter for new password */}
            {field.key === 'new_password' && form.new_password.length > 0 && (
              <PasswordStrength value={form.new_password} />
            )}

            {/* Mismatch warning */}
            {field.key === 'new_password_confirmation' &&
              form.new_password_confirmation.length > 0 &&
              !passwordsMatch && (
                <p className="text-[11px] text-rose-600 mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Mật khẩu xác nhận không khớp
                </p>
              )}
          </div>
        ))}

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold
                       bg-[var(--acc)] text-white hover:bg-[var(--acc-deep)] active:scale-[0.98] transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Lock className="w-4 h-4" />
            {mutation.isPending ? 'Đang đổi…' : 'Cập nhật mật khẩu'}
          </button>
        </div>
      </form>
        </div>
      )}
    </section>
  );
}
