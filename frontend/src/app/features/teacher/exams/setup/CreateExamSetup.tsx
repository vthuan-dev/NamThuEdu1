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
 * Wizard "Tạo đề thi" — toàn bộ trên MỘT trang.
 *
 * Bố cục:
 *  - Cột trái: chỉ bước 1 (chọn nhóm học viên) với 3 thẻ ảnh lớn.
 *  - Cột phải (aside): bước 2 (loại đề) → bước 3 (kỹ năng) → chi tiết đề →
 *    nút "Bắt đầu tạo đề", xếp dọc trong một panel dính (sticky).
 *
 * Trước đây bước 2 và 3 nằm dưới bước 1 ở cột trái. Sau khi chọn nhóm, chúng
 * xuất hiện bên dưới — thường là ngoài khung nhìn — và cách xa nút bấm ở cột
 * phải, nên giáo viên hay không nhận ra là còn phải chọn tiếp. Dồn cả chuỗi
 * chọn → xem lại → bấm vào cùng một cột giúp mọi thao tác còn lại nằm gọn
 * trong tầm mắt.
 *
 * Nhóm chỉ có 1 loại đề (Kids/Teens) sẽ tự chọn loại đó ngay → tối thiểu số click.
 * Áp dụng chung cho mọi loại đề vì đọc từ AGE_GROUP_CATALOG.
 */

const ICON_MAP = Icons as unknown as Record<string, LucideIcon>;

const resolveIcon = (name: string, fallback: LucideIcon = FileText): LucideIcon => {
  const found = ICON_MAP[name];
  return typeof found === 'object' || typeof found === 'function' ? (found as LucideIcon) ?? fallback : fallback;
};

/**
 * Ảnh banner cho từng nhóm tuổi (đặt trong public/images).
 *
 * Ba thẻ này nằm ngay trong khung nhìn đầu tiên nên phải hiện gần như tức thì.
 * Bản PNG gốc là 1024x1024 và nặng 404–554 KB mỗi ảnh (tổng ~1.4 MB) trong khi ô
 * hiển thị chỉ cao 144px, nên ưu tiên WebP đã resize; PNG chỉ còn là fallback cho
 * trình duyệt không hỗ trợ WebP. Xem `optimize_agecard_images.cjs` để tạo lại.
 */
const AGE_GROUP_IMAGE: Record<string, { webp: string; png: string }> = {
  kids: {
    webp: '/images/agecard-kids-400.webp 400w, /images/agecard-kids-800.webp 800w',
    png: '/images/agecard-kids.png',
  },
  teens: {
    webp: '/images/agecard-teens-400.webp 400w, /images/agecard-teens-800.webp 800w',
    png: '/images/agecard-teens.png',
  },
  adults: {
    webp: '/images/agecard-adults-400.webp 400w, /images/agecard-adults-800.webp 800w',
    png: '/images/agecard-adults.png',
  },
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

      <main className="mx-auto grid max-w-6xl items-start gap-8 px-8 py-12 lg:grid-cols-[1fr_360px]">
        {/* ── Cột trái: bước 1 — chọn nhóm học viên ──────────────────────────── */}
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
                  {/* Ảnh banner — tải sớm vì nằm trong khung nhìn đầu tiên */}
                  <div className="h-36 w-full overflow-hidden bg-slate-50">
                    <picture>
                      <source
                        type="image/webp"
                        srcSet={img?.webp}
                        sizes="(min-width: 1024px) 240px, (min-width: 640px) 30vw, 90vw"
                      />
                      <img
                        src={img?.png}
                        alt={`Nhóm ${g.label} — ${g.range}`}
                        width={1024}
                        height={1024}
                        loading="eager"
                        fetchPriority="high"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </picture>
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

        {/*
          ── Cột phải: panel tác vụ ────────────────────────────────────────────

          Chứa bước 2, bước 3, phần chi tiết và nút bấm — tức toàn bộ việc còn
          lại sau khi đã chọn nhóm. Cỡ chữ và khoảng đệm ở đây nhỏ hơn thẻ bên
          trái vì khung chỉ rộng 360px và phải chứa tối đa 2 loại đề + 5 kỹ năng
          + 5 dòng chi tiết mà vẫn giữ được nút bấm trong khung nhìn.
        */}
        <aside className="lg:sticky lg:top-24">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {!ageGroup ? (
              <div className="px-6 py-14 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                  <FileText className="h-7 w-7 text-slate-400" />
                </div>
                <p className="mt-4 text-sm font-medium text-slate-500">Chưa chọn nhóm học viên</p>
                <p className="mt-1 text-[12px] text-slate-400">Chọn một nhóm ở bên trái để xem loại đề phù hợp</p>
              </div>
            ) : (
              /* Giới hạn chiều cao phần chọn để nút bấm bên dưới không bị đẩy ra khỏi khung nhìn */
              <div className="max-h-[calc(100vh-16rem)] overflow-y-auto">
                {/* Bước 2 — Loại đề */}
                <section className="ce-reveal border-b border-slate-100 p-4">
                  <AsideStep index={2} done={!!examType} title="Loại đề" />
                  <div className="mt-3 space-y-2">
                    {ageGroup.examTypes.map((t) => {
                      const Icon = resolveIcon(t.iconName);
                      const isSel = examType?.value === t.value;
                      return (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => handlePickType(t)}
                          className={`flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors cursor-pointer ${
                            isSel ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div
                            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                            style={{ backgroundColor: `${t.themeColor}1A`, color: t.themeColor }}
                          >
                            <Icon className="h-[18px] w-[18px]" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-[13px] font-semibold text-slate-900">{t.name}</span>
                              {t.badge && (
                                <span className="flex-shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                                  {t.badge}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
                              <Icons.Clock className="h-3 w-3 flex-shrink-0" />
                              {t.duration}
                            </p>
                          </div>
                          <div
                            className={`flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full border transition-colors ${
                              isSel ? 'border-slate-900 bg-slate-900' : 'border-slate-300'
                            }`}
                          >
                            {isSel && <Check className="h-2.5 w-2.5 text-white" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Bước 3 — Kỹ năng (chỉ khi loại đề cần) */}
                {examType && needsSkill && (
                  <section className="ce-reveal border-b border-slate-100 p-4">
                    <AsideStep index={3} done={!!skill} title="Nội dung / kỹ năng" />
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {examType.skills!.map((s) => {
                        const active = skill === s.value;
                        return (
                          <button
                            key={s.value}
                            type="button"
                            onClick={() => setSkill(s.value)}
                            title={s.description}
                            className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
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

                {/* Chi tiết đề đã chọn */}
                {examType && (
                  <section className="ce-reveal p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Chi tiết</p>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-slate-500">
                      {examType.tagline ?? examType.description}
                    </p>
                    <div className="mt-3 space-y-2">
                      <SpecRow iconName="Users" label="Đối tượng" value={`${ageGroup.label} · ${ageGroup.range}`} />
                      {selectedSkill && skill !== 'mixed' && (
                        <SpecRow iconName="ListChecks" label="Kỹ năng" value={selectedSkill.label} />
                      )}
                      <SpecRow iconName="Clock" label="Thời lượng" value={examType.duration} />
                      {examType.highlights?.map((h) => (
                        <SpecRow key={h.label} iconName={h.iconName} label={h.label} value={h.value} />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* CTA */}
            <div className="border-t border-slate-100 p-4">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!ready}
                className={`flex w-full items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold transition-colors ${
                  ready ? 'bg-slate-900 text-white hover:bg-slate-800 cursor-pointer' : 'cursor-not-allowed bg-slate-100 text-slate-400'
                }`}
              >
                Bắt đầu tạo đề
                <ChevronRight className="h-4 w-4" />
              </button>
              {!ready && missingHint && (
                <p className="mt-2 text-center text-[11px] text-slate-400">{missingHint}</p>
              )}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

// ── Section header với số bước (cột trái) ────────────────────────────────────
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

// ── Nhãn bước thu nhỏ, dùng trong aside ─────────────────────────────────────
function AsideStep({ index, title, done }: { index: number; title: string; done?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
          done ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white'
        }`}
      >
        {done ? <Check className="h-3 w-3" /> : index}
      </div>
      <h2 className="text-[13px] font-semibold text-slate-900">{title}</h2>
    </div>
  );
}

// ── Dòng thông số nhãn-trái / giá trị-phải, gọn hơn thẻ icon cũ ──────────────
function SpecRow({ iconName, label, value }: { iconName: string; label: string; value: string }) {
  const Icon = resolveIcon(iconName);
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="flex flex-shrink-0 items-center gap-1.5 text-[11px] text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className="text-right text-[11px] font-semibold leading-snug text-slate-700">{value}</span>
    </div>
  );
}
