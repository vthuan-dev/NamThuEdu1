import { useState } from 'react';
import { useNavigate } from 'react-router';
import * as Icons from 'lucide-react';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import {
  AGE_GROUP_CATALOG,
  type AgeGroupCatalog,
  type ExamTypeOption,
  type ExamSkillKey,
  buildCreatorUrl,
} from './examCatalog';

/**
 * Wizard "Tạo đề thi" V3 — gộp toàn bộ về MỘT trang.
 *
 * Thay cho flow 3 bước (nhóm → loại → xác nhận), giờ tất cả nằm trên một trang
 * với progressive disclosure:
 *  - Cột trái: 3 khối chọn xếp dọc (Nhóm học viên → Loại đề → Kỹ năng), khối sau
 *    chỉ hiện khi đã chọn xong khối trước.
 *  - Cột phải: thẻ preview cập nhật trực tiếp + nút "Bắt đầu tạo đề" (bỏ hẳn bước
 *    xác nhận riêng).
 *
 * Nhóm chỉ có 1 loại đề (Kids/Teens) sẽ tự chọn loại đó ngay → tối thiểu số click.
 * Áp dụng chung cho mọi loại đề vì đọc từ AGE_GROUP_CATALOG.
 */

const ICON_MAP = Icons as unknown as Record<string, LucideIcon>;

const resolveIcon = (name: string, fallback: LucideIcon = FileText): LucideIcon => {
  const found = ICON_MAP[name];
  return typeof found === 'object' || typeof found === 'function' ? (found as LucideIcon) ?? fallback : fallback;
};

// Ảnh banner cho từng nhóm tuổi (đặt trong public/images).
const AGE_GROUP_IMAGE: Record<string, string> = {
  kids: '/images/agecard-kids.png',
  teens: '/images/agecard-teens.png',
  adults: '/images/agecard-adults.png',
};

export function CreateExamSetup() {
  const navigate = useNavigate();

  const [ageGroup, setAgeGroup] = useState<AgeGroupCatalog | null>(null);
  const [examType, setExamType] = useState<ExamTypeOption | null>(null);
  const [skill, setSkill] = useState<ExamSkillKey | null>(null);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handlePickAgeGroup = (g: AgeGroupCatalog) => {
    if (ageGroup?.key === g.key) return;
    setAgeGroup(g);
    // Nhóm chỉ có 1 loại đề → tự chọn luôn để tiết kiệm thao tác.
    if (g.examTypes.length === 1) {
      const only = g.examTypes[0];
      setExamType(only);
      setSkill(only.needsSkill ? (only.skills?.[0]?.value ?? 'mixed') : null);
    } else {
      setExamType(null);
      setSkill(null);
    }
  };

  const handlePickType = (t: ExamTypeOption) => {
    setExamType(t);
    setSkill(t.needsSkill ? (t.skills?.[0]?.value ?? 'mixed') : null);
  };

  const needsSkill = !!examType?.needsSkill && (examType?.skills?.length ?? 0) > 0;
  const ready = !!ageGroup && !!examType && (!needsSkill || !!skill);

  const handleConfirm = () => {
    if (!ageGroup || !examType || !ready) return;
    navigate(buildCreatorUrl({ ageGroup: ageGroup.key, examType, skill: skill ?? undefined }));
  };

  const missingHint = !ageGroup
    ? 'Chọn nhóm học viên'
    : !examType
      ? 'Chọn loại đề'
      : needsSkill && !skill
        ? 'Chọn kỹ năng'
        : '';

  const selectedSkill = examType?.skills?.find((s) => s.value === skill);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <style>{`@keyframes ceSetupReveal{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}.ce-reveal{animation:ceSetupReveal .28s ease-out}`}</style>

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="flex items-center gap-3 px-6 py-3.5">
          <button
            type="button"
            onClick={() => navigate('/giao-vien/de-thi')}
            className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-slate-100 cursor-pointer"
            title="Quay lại"
          >
            <ArrowLeft className="h-4 w-4 text-slate-500" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900">Tạo đề thi mới</h1>
            <p className="text-sm text-slate-400">
              Chọn nhóm, loại đề và bắt đầu soạn — tất cả trên một trang
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-12 px-8 py-12 lg:grid-cols-[1fr_420px]">
        {/* ── Cột trái: các khối chọn ────────────────────────── */}
        <div className="space-y-10">
          {/* Bước 1 — Nhóm học viên */}
          <section>
            <StepHeader index={1} done={!!ageGroup} title="Đề thi dành cho ai?" hint="Chọn nhóm để gợi ý loại đề phù hợp" />
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              {AGE_GROUP_CATALOG.map((g) => {
                const isSel = ageGroup?.key === g.key;
                const img = AGE_GROUP_IMAGE[g.key];
                return (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => handlePickAgeGroup(g)}
                    className={`group relative overflow-hidden rounded-2xl border bg-white text-left transition-all cursor-pointer ${
                      isSel ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    {isSel && (
                      <span className="absolute right-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 shadow-sm">
                        <Check className="h-3.5 w-3.5 text-white" />
                      </span>
                    )}
                    {/* Ảnh banner */}
                    <div className="h-28 w-full overflow-hidden bg-slate-50">
                      <img
                        src={img}
                        alt={g.label}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                    {/* Nội dung */}
                    <div className="p-5">
                      <h3 className="text-lg font-semibold text-slate-900">{g.label}</h3>
                      <p className="text-[13px] text-slate-500">{g.range}</p>
                      <p className="mt-2 text-[12px] text-slate-400">
                        {g.examTypes.length === 1 ? '1 loại đề chuyên dụng' : `${g.examTypes.length} loại đề`}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Bước 2 — Loại đề */}
          {ageGroup && (
            <section className="ce-reveal">
              <StepHeader
                index={2}
                done={!!examType}
                title="Loại đề bạn muốn tạo?"
                hint="Mỗi loại có giao diện soạn riêng tối ưu cho cấu trúc đề"
              />
              <div className="space-y-4">
                {ageGroup.examTypes.map((t) => {
                  const Icon = resolveIcon(t.iconName);
                  const isSel = examType?.value === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => handlePickType(t)}
                      className={`flex w-full items-start gap-5 rounded-2xl border bg-white p-6 text-left transition-all cursor-pointer ${
                        isSel ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div
                        className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl"
                        style={{ backgroundColor: `${t.themeColor}1A`, color: t.themeColor }}
                      >
                        <Icon className="h-8 w-8" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-slate-900">{t.name}</h3>
                          {t.badge && (
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                              {t.badge}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{t.description}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-5 text-[12px] text-slate-400">
                          <span className="inline-flex items-center gap-1.5">
                            <Icons.Clock className="h-4 w-4" />
                            {t.duration}
                          </span>
                          {t.needsSkill && (
                            <span className="inline-flex items-center gap-1.5">
                              <Icons.Layers className="h-4 w-4" />
                              {t.skills?.filter((s) => s.value !== 'mixed').length ?? 0} kỹ năng
                            </span>
                          )}
                        </div>
                      </div>
                      <div
                        className={`mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border transition-colors ${
                          isSel ? 'border-slate-900 bg-slate-900' : 'border-slate-300'
                        }`}
                      >
                        {isSel && <Check className="h-3.5 w-3.5 text-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Bước 3 — Kỹ năng (chỉ khi loại đề cần) */}
          {examType && needsSkill && (
            <section className="ce-reveal">
              <StepHeader index={3} done={!!skill} title="Chọn nội dung / kỹ năng" hint="Có thể tạo full đề hoặc luyện từng kỹ năng" />
              <div className="flex flex-wrap gap-2.5">
                {examType.skills!.map((s) => {
                  const active = skill === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setSkill(s.value)}
                      title={s.description}
                      className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                        active
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* ── Cột phải: preview sống + CTA ─────────────────────────────────── */}
        <aside className="h-fit lg:sticky lg:top-24">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {examType ? (
              <>
                {/* Banner tinted nhẹ */}
                <div className="flex items-start gap-4 border-b border-slate-100 p-6" style={{ background: `${examType.themeColor}0D` }}>
                  <div
                    className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-white"
                    style={{ backgroundColor: examType.themeColor }}
                  >
                    {(() => {
                      const Icon = resolveIcon(examType.iconName);
                      return <Icon className="h-7 w-7" />;
                    })()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-900">{examType.name}</h3>
                      {selectedSkill && skill !== 'mixed' && (
                        <span
                          className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white"
                          style={{ backgroundColor: examType.themeColor }}
                        >
                          {selectedSkill.label}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[13px] text-slate-500">{examType.tagline ?? examType.description}</p>
                  </div>
                </div>

                {/* Highlights */}
                <div className="space-y-4 p-6">
                  {ageGroup && (
                    <PreviewItem iconName="Users" label="Đối tượng" value={`${ageGroup.label} · ${ageGroup.range}`} color={examType.themeColor} />
                  )}
                  <PreviewItem iconName="Clock" label="Thời lượng" value={examType.duration} color={examType.themeColor} />
                  {examType.highlights?.map((h) => (
                    <PreviewItem key={h.label} iconName={h.iconName} label={h.label} value={h.value} color={examType.themeColor} />
                  ))}
                </div>
              </>
            ) : (
              <div className="px-6 py-14 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                  <FileText className="h-8 w-8 text-slate-400" />
                </div>
                <p className="mt-4 text-sm font-medium text-slate-500">Chưa có gì để xem trước</p>
                <p className="mt-1 text-[13px] text-slate-400">Chọn nhóm và loại đề để xem chi tiết</p>
              </div>
            )}

            {/* CTA */}
            <div className="border-t border-slate-100 p-6">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!ready}
                className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[15px] font-semibold transition-colors ${
                  ready ? 'bg-slate-900 text-white hover:bg-slate-800 cursor-pointer' : 'cursor-not-allowed bg-slate-100 text-slate-400'
                }`}
              >
                Bắt đầu tạo đề
                <ChevronRight className="h-5 w-5" />
              </button>
              {!ready && missingHint && (
                <p className="mt-2.5 text-center text-[12px] text-slate-400">{missingHint}</p>
              )}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

// ── Section header với số bước ────────────────────────────────────────────────
function StepHeader({
  index,
  title,
  hint,
  done,
}: {
  index: number;
  title: string;
  hint?: string;
  done?: boolean;
}) {
  return (
    <div className="mb-5 flex items-center gap-3.5">
      <div
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
          done ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white'
        }`}
      >
        {done ? <Check className="h-4 w-4" /> : index}
      </div>
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {hint && <p className="text-[13px] text-slate-400">{hint}</p>}
      </div>
    </div>
  );
}

function PreviewItem({
  iconName,
  label,
  value,
  color,
}: {
  iconName: string;
  label: string;
  value: string;
  color: string;
}) {
  const Icon = resolveIcon(iconName);
  return (
    <div className="flex items-start gap-3.5">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}1A`, color }}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
        <div className="mt-0.5 text-sm font-semibold leading-snug text-slate-900">{value}</div>
      </div>
    </div>
  );
}
