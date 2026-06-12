import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { getFullMediaUrl } from "../../../../utils/mediaUtils";

/** Shared, on-theme UI primitives for the teacher class-management screens.
 *  Calm palette: neutral surfaces + a single teal accent, soft semantic tints. */

export const TEAL = "#0D9488";
export const TEAL_DARK = "#0F766E";

export const AGE_META: Record<
  string,
  { label: string; pill: string; bar: string; soft: string }
> = {
  kids: { label: "Kids", pill: "bg-amber-50 text-amber-700 ring-1 ring-amber-200", bar: "#F59E0B", soft: "bg-amber-50" },
  teens: { label: "Teens", pill: "bg-teal-50 text-teal-700 ring-1 ring-teal-200", bar: "#0D9488", soft: "bg-teal-50" },
  adults: { label: "Adults", pill: "bg-violet-50 text-violet-700 ring-1 ring-violet-200", bar: "#7C3AED", soft: "bg-violet-50" },
};

export function ageMeta(group?: string) {
  return AGE_META[group || ""] || { label: group || "—", pill: "bg-gray-100 text-gray-600 ring-1 ring-gray-200", bar: "#9CA3AF", soft: "bg-gray-50" };
}

/** Initials avatar with optional real photo. Falls back to initials on missing/broken image. */
export function Avatar({ name, size = 40, src }: { name?: string; size?: number; src?: string | null }) {
  const [failed, setFailed] = useState(false);
  const initials = (name || "?")
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
  const resolved = src ? getFullMediaUrl(src) : null;

  if (resolved && !failed) {
    return (
      <img
        src={resolved}
        alt={name || "avatar"}
        onError={() => setFailed(true)}
        className="rounded-full object-cover ring-1 ring-black/5 shrink-0 bg-teal-50"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="flex items-center justify-center rounded-full bg-gradient-to-br from-teal-100 to-teal-50 text-[#0F766E] font-semibold ring-1 ring-teal-100 shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {initials || "?"}
    </div>
  );
}

/** Thin capacity bar. Teal → amber (≥80%) → red (full). */
export function CapacityBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0;
  const color = pct >= 100 ? "#EF4444" : pct >= 80 ? "#F59E0B" : TEAL;
  return (
    <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
      <div
        className="h-full rounded-full cm-bar-fill"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

/** Reusable modal shell: backdrop blur, ESC to close, click-outside, scale-in. */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth = "max-w-md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 cm-backdrop-in"
      onMouseDown={onClose}
    >
      <div
        className={`bg-white rounded-2xl w-full ${maxWidth} shadow-2xl ring-1 ring-black/5 cm-modal-in max-h-[88vh] flex flex-col`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-[#111827]">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="p-1.5 -mr-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto">{children}</div>
        {footer && <div className="flex gap-3 px-6 py-4 border-t border-gray-100">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

/** Standard form field wrapper. */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#374151] mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-[#9CA3AF] mt-1.5">{hint}</p>}
    </div>
  );
}

export const inputClass =
  "w-full px-3.5 py-2.5 border border-[#E5E7EB] rounded-xl text-[#111827] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/40 focus:border-[#0D9488] transition-shadow";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0D9488] text-white rounded-xl font-semibold hover:bg-[#0F766E] active:scale-[0.98] disabled:opacity-60 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0D9488]";

export const btnGhost =
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-[#E5E7EB] text-[#374151] rounded-xl font-semibold hover:bg-gray-50 active:scale-[0.98] transition-all";

/** Card skeleton for loading state. */
export function CardSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-6 border border-[#E5E7EB] animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 w-32 bg-gray-100 rounded" />
        <div className="h-5 w-14 bg-gray-100 rounded-full" />
      </div>
      <div className="h-3 w-3/4 bg-gray-100 rounded mb-3" />
      <div className="h-1.5 w-full bg-gray-100 rounded-full mb-4" />
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div className="h-8 w-24 bg-gray-100 rounded-lg" />
        <div className="h-8 w-16 bg-gray-100 rounded-lg" />
      </div>
    </div>
  );
}
