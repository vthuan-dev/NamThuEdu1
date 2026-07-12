import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import * as Icons from 'lucide-react';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Send,
  Plus,
  ChevronUp,
  ChevronDown,
  Trash2,
  History,
} from 'lucide-react';
import { api } from '../../../../../services/api';
import { useToast } from '../../../../../hooks/useToast';
import type { ThptConfig, ThptSection, SectionType } from '../../../../../types/thpt';
import {
  THPT_THEME,
  blankConfig,
  createSection,
  sectionMeta,
  countQuestions,
  totalQuestions,
  nextQuestionNumber,
} from './sections';
import { SectionEditor } from './editors/SectionEditor';
import { AddSectionModal } from './AddSectionModal';

type AgeGroup = 'kids' | 'teens' | 'adults' | 'all';
type Level = 'THCS' | 'THPT' | 'DGNL' | 'OTHER';

const LEVELS: { value: Level; label: string }[] = [
  { value: 'THCS', label: 'THCS' },
  { value: 'THPT', label: 'THPT' },
  { value: 'DGNL', label: 'Đánh giá NL' },
  { value: 'OTHER', label: 'Khác' },
];

export function CreateThptExam() {
  const params = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [examId, setExamId] = useState<string | undefined>(params.examId);
  const [examTitle, setExamTitle] = useState('Đề Tiếng Anh THPT');
  const [examDescription, setExamDescription] = useState('');
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('teens');
  const [config, setConfig] = useState<ThptConfig>(blankConfig());

  const [activeIdx, setActiveIdx] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  /** Giáo viên có TOÀN QUYỀN với mọi đề (của mình và của giáo viên khác): xem + sửa. */
  const isOwner = true;
  /** Trạng thái publish hiện tại: 'draft' | 'published' */
  const [examStatus, setExamStatus] = useState<'draft' | 'published'>('draft');
  /** Đề đã xuất bản nhưng đang có thay đổi chưa áp dụng cho học viên */
  const [hasDraft, setHasDraft] = useState(false);

  /**
   * Snapshot dữ liệu lúc tải từ server (baseline) để so sánh phát hiện thay đổi.
   * Nút "Cập nhật/Xuất bản" chỉ bật khi dữ liệu hiện tại khác baseline này.
   */
  const baselineRef = useRef<string>('');

  /** Serialize phần dữ liệu có thể sửa để so sánh ổn định. */
  const serializeExam = (
    title: string,
    description: string,
    age: AgeGroup,
    cfg: ThptConfig,
  ): string =>
    JSON.stringify({
      title: title.trim(),
      description: (description || '').trim(),
      age,
      cfg,
    });

  const currentSnapshot = useMemo(
    () => serializeExam(examTitle, examDescription, ageGroup, config),
    [examTitle, examDescription, ageGroup, config],
  );

  /** Có thay đổi so với dữ liệu đang lưu ở CSDL hay không. */
  const isDirty = baselineRef.current !== '' && currentSnapshot !== baselineRef.current;

  const total = useMemo(() => totalQuestions(config), [config]);

  /**
   * Các câu trắc nghiệm chưa chọn đáp án đúng (correct_id/correct_marker rỗng).
   * Trước khi xuất bản, ràng buộc giáo viên phải chọn đáp án đúng cho tất cả.
   */
  const missingAnswers = useMemo<string[]>(() => {
    const missing: string[] = [];
    const label = (sec: ThptSection, qn: number) =>
      `${sec.title || sectionMeta[sec.type]?.label || 'Phần'} · Câu ${qn}`;
    for (const sec of config.sections) {
      switch (sec.type) {
        case 'mc_questions':
          for (const it of sec.items) {
            if (!String(it.correct_id || '').trim()) missing.push(label(sec, it.question_number));
          }
          break;
        case 'listening':
          for (const it of sec.items as any[]) {
            const kind = it.kind === 'fill_blank' ? 'fill_blank' : 'mc';
            if (kind === 'fill_blank') {
              const accepted = Array.isArray(it.accepted_answers) ? it.accepted_answers : [];
              if (!accepted.some((a: string) => String(a || '').trim())) {
                missing.push(label(sec, it.question_number));
              }
            } else if (!String(it.correct_id || '').trim()) {
              missing.push(label(sec, it.question_number));
            }
          }
          break;
        case 'writing':
          for (const it of sec.items) {
            if (!String(it.prompt || '').trim()) missing.push(label(sec, it.question_number));
          }
          break;
        case 'phonetics':
        case 'error_identification':
          for (const it of sec.items) {
            if (!String(it.correct_id || '').trim()) missing.push(label(sec, it.question_number));
          }
          break;
        case 'mc_cloze':
          for (const b of sec.blanks) {
            if (!String(b.correct_id || '').trim()) missing.push(label(sec, b.question_number));
          }
          break;
        case 'reading_mixed':
          for (const it of sec.items) {
            if (it.kind === 'mc' && !String(it.correct_id || '').trim()) missing.push(label(sec, it.question_number));
            if (it.kind === 'sentence_insertion' && !String(it.correct_marker || '').trim()) missing.push(label(sec, it.question_number));
          }
          break;
      }
    }
    return missing;
  }, [config]);

  // ── Init ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (examId) {
        // Có examId → load draft, không tạo mới dù lỗi để tránh tạo nhầm exam
        try {
          const res = await api.get(`/teacher/exams/${examId}/thpt/draft`);
          const data = res.data?.data;
          if (!mounted || !data) return;
          if (data.eTitle) setExamTitle(data.eTitle);
          if (data.eDescription !== undefined) setExamDescription(data.eDescription || '');
          if (data.age_group) setAgeGroup(data.age_group);
          const loadedCfg = data.thpt_config ? normalizeConfig(data.thpt_config) : blankConfig();
          if (data.thpt_config) setConfig(loadedCfg);
          // Giáo viên có TOÀN QUYỀN với mọi đề: luôn cho phép chỉnh sửa (không khoá non-owner).
          if (data.eStatus) setExamStatus(data.eStatus);
          setHasDraft(Boolean(data._has_draft));
          setHasUnsaved(false);
          // Lưu baseline để so sánh: dùng đúng giá trị vừa nạp vào state
          baselineRef.current = serializeExam(
            data.eTitle || examTitle,
            data.eDescription ?? '',
            (data.age_group as AgeGroup) || ageGroup,
            loadedCfg,
          );
        } catch (err: any) {
          setCreateError(err?.response?.data?.message || 'Không tải được đề thi.');
        }
        return;
      }
      // Không có examId → tạo draft mới
      try {
        const res = await api.post('/teacher/exams/thpt', {
          eTitle: examTitle,
          eDescription: examDescription,
          age_group: ageGroup,
          thpt_config: config,
        });
        const newId = res.data?.data?.eId;
        if (mounted && newId) {
          setExamId(String(newId));
          window.history.replaceState({}, '', `/giao-vien/de-thi/thpt/${newId}/sua`);
        }
      } catch (err: any) {
        setCreateError(err?.response?.data?.message || 'Không tạo được đề mới.');
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persist ──────────────────────────────────────────────────────────────
  /** Lưu thay đổi (nội bộ). Được gọi tự động bởi handlePublish trước khi áp dụng. */
  const handleSaveDraft = async () => {
    if (!examId) return;
    setIsSaving(true);
    try {
      await api.put(`/teacher/exams/${examId}/thpt`, {
        eTitle: examTitle,
        eDescription: examDescription,
        age_group: ageGroup,
        thpt_config: config,
      });
      setHasUnsaved(false);
      setLastSaved(new Date());
      // Sau khi lưu thành công → dữ liệu hiện tại trở thành baseline mới
      baselineRef.current = serializeExam(examTitle, examDescription, ageGroup, config);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Lưu thất bại.');
      throw err; // chặn publish nếu lưu lỗi
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!examId) return;
    // Ràng buộc: mọi câu trắc nghiệm phải có đáp án đúng trước khi xuất bản.
    if (missingAnswers.length > 0) {
      const preview = missingAnswers.slice(0, 3).join(' · ');
      toast.error(
        `Còn ${missingAnswers.length} câu chưa chọn đáp án đúng. Vui lòng chọn đáp án trước khi xuất bản: ${preview}${missingAnswers.length > 3 ? ' …' : ''}`,
      );
      return;
    }
    const wasRepublish = examStatus === 'published';
    setIsPublishing(true);
    try {
      await handleSaveDraft();
      await api.post(`/teacher/exams/${examId}/thpt/publish`);
      setHasDraft(false);
      setExamStatus('published');

      if (wasRepublish) {
        toast.success('Đã cập nhật đề. Học viên sẽ thấy bản mới ở lần thi tiếp theo.');
      } else {
        toast.success('Đã xuất bản đề thi.');
      }
      navigate('/giao-vien/de-thi');
    } catch (err: any) {
      const errs = err?.response?.data?.errors;
      const msg = err?.response?.data?.message || 'Xuất bản thất bại.';
      toast.error(Array.isArray(errs) ? `${msg}: ${errs.slice(0, 3).join(' · ')}` : msg);
    } finally {
      setIsPublishing(false);
    }
  };

  // ── Section ops ────────────────────────────────────────────────────────
  const addSection = (
    type: SectionType,
    initItemKind?: 'mc' | 'fill_blank',
    initLayout?: 'image_block',
  ) => {
    const newSec = createSection(type, nextQuestionNumber(config.sections), initItemKind, initLayout);
    setConfig((prev) => ({ ...prev, sections: [...prev.sections, newSec] }));
    setActiveIdx(config.sections.length);
    setHasUnsaved(true);
  };

  const updateSection = (idx: number, next: ThptSection) => {
    setConfig((prev) => {
      const sections = [...prev.sections];
      sections[idx] = next;
      return { ...prev, sections };
    });
    setHasUnsaved(true);
  };

  const removeSection = (idx: number) => {
    if (!window.confirm('Xoá phần này khỏi đề?')) return;
    setConfig((prev) => ({ ...prev, sections: prev.sections.filter((_, i) => i !== idx) }));
    setActiveIdx((cur) => Math.max(0, cur >= idx ? cur - 1 : cur));
    setHasUnsaved(true);
  };

  const moveSection = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= config.sections.length) return;
    setConfig((prev) => {
      const sections = [...prev.sections];
      [sections[idx], sections[target]] = [sections[target], sections[idx]];
      return { ...prev, sections };
    });
    setActiveIdx(target);
    setHasUnsaved(true);
  };

  const activeSection = config.sections[activeIdx];

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: THPT_THEME.bg }}>
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-white" style={{ borderColor: '#E2E8F0' }}>
        <div className="px-6 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/giao-vien/de-thi')}
            className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>

          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={examTitle}
              onChange={(e) => {
                setExamTitle(e.target.value);
                setHasUnsaved(true);
              }}
              className="w-full text-base font-bold text-slate-900 bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-blue-200 rounded-md px-2 py-1 -ml-2"
              placeholder="Tiêu đề đề thi"
            />
            <div className="px-2 text-xs text-slate-500 flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: THPT_THEME.primary }} />
                {config.level} · {config.sections.length} phần · {total} câu
              </span>

              {/* Trạng thái đề đang chạy cho học viên */}
              {examStatus === 'published' && (
                <>
                  <span className="text-slate-300">•</span>
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold"
                    style={{ backgroundColor: '#DCFCE7', color: '#166534' }}
                  >
                    Đang phát cho học viên
                  </span>
                </>
              )}

              {/* Có thay đổi chưa cập nhật cho học viên */}
              {hasDraft && (
                <>
                  <span className="text-slate-300">•</span>
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold"
                    style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
                  >
                    Có thay đổi chưa cập nhật
                  </span>
                </>
              )}

              {lastSaved && !hasUnsaved && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-emerald-600 font-medium">Đã lưu {lastSaved.toLocaleTimeString('vi-VN')}</span>
                </>
              )}
              {hasUnsaved && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-amber-600 font-medium">Chưa lưu</span>
                </>
              )}
            </div>
          </div>

          {/* Level */}
          <div className="hidden md:flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-100" title="Cấp độ đề">
            {LEVELS.map((lv) => (
              <button
                key={lv.value}
                type="button"
                onClick={() => {
                  setConfig((p) => ({ ...p, level: lv.value }));
                  setHasUnsaved(true);
                }}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  config.level === lv.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                {lv.label}
              </button>
            ))}
          </div>

          {/* Age group */}
          <div className="hidden lg:flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-100" title="Nhóm học viên">
            {(
              [
                { value: 'all', label: 'Mọi nhóm' },
                { value: 'teens', label: 'Teens' },
                { value: 'adults', label: 'Adults' },
              ] as { value: AgeGroup; label: string }[]
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setAgeGroup(opt.value);
                  setHasUnsaved(true);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  ageGroup === opt.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* 1 nút duy nhất: Xuất bản (tự lưu thay đổi trước khi áp dụng cho học viên).
              Đề đã xuất bản → chỉ bật khi có thay đổi so với CSDL (isDirty). */}
          {(() => {
            const isPublished = examStatus === 'published';
            const canPublish = isPublished ? isDirty : true;
            const disabled =
              isPublishing || isSaving || !examId || total === 0 || !isOwner || !canPublish;
            return (
              <button
                type="button"
                onClick={handlePublish}
                disabled={disabled}
                title={
                  !isOwner
                    ? 'Đề của giáo viên khác — chỉ xem'
                    : isPublished && !isDirty
                    ? 'Chưa có thay đổi nào so với bản đang chạy'
                    : isPublished
                    ? 'Lưu và cập nhật đề. Học viên sẽ thấy bản mới ở lần thi tiếp theo.'
                    : 'Xuất bản đề cho học viên'
                }
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm"
                style={{ backgroundColor: THPT_THEME.primary }}
              >
                {isPublishing || isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>{isPublished ? 'Cập nhật cho học viên' : 'Xuất bản'}</span>
              </button>
            );
          })()}
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Sidebar */}
        <aside className="space-y-3">
          <div className="rounded-2xl p-4 border bg-white" style={{ borderColor: '#E2E8F0' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Các phần</h3>
              <span className="text-xs font-bold text-slate-700">{config.sections.length}</span>
            </div>

            <div className="space-y-1.5">
              {config.sections.map((s, idx) => {
                const meta = sectionMeta(s.type);
                const Icon = (Icons as any)[meta.icon] ?? Icons.Square;
                const isActive = activeIdx === idx;
                return (
                  <div
                    key={s.id}
                    className={`rounded-xl px-2.5 py-2 transition-all cursor-pointer ${
                      isActive ? 'shadow-sm' : 'hover:bg-slate-50'
                    }`}
                    style={
                      isActive
                        ? { backgroundColor: '#EFF6FF', border: `1px solid ${THPT_THEME.primary}` }
                        : { border: '1px solid transparent' }
                    }
                    onClick={() => setActiveIdx(idx)}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 flex-shrink-0" style={{ color: isActive ? THPT_THEME.primary : '#64748B' }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate" style={{ color: isActive ? THPT_THEME.primary : '#0F172A' }}>
                          {s.title || meta.label}
                        </div>
                        <div className="text-[11px] text-slate-500">{countQuestions(s)} câu · {meta.label}</div>
                      </div>
                      <div className="flex flex-col -my-1">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); moveSection(idx, -1); }}
                          className="text-slate-300 hover:text-slate-600 cursor-pointer disabled:opacity-30"
                          disabled={idx === 0}
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); moveSection(idx, 1); }}
                          className="text-slate-300 hover:text-slate-600 cursor-pointer disabled:opacity-30"
                          disabled={idx === config.sections.length - 1}
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeSection(idx); }}
                        className="text-slate-300 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {config.sections.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6">Chưa có phần nào. Bấm "Thêm phần" để bắt đầu.</p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              disabled={!isOwner}
              title={!isOwner ? 'Đề của giáo viên khác — chỉ xem' : undefined}
              className="w-full mt-3 flex items-center justify-center gap-1.5 rounded-xl py-2.5 font-semibold text-sm text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: THPT_THEME.primary }}
            >
              <Plus className="w-4 h-4" />
              Thêm phần
            </button>
          </div>

          <div className="rounded-2xl p-4 border bg-white" style={{ borderColor: '#E2E8F0' }}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Cấu hình</h3>
            <div className="space-y-3 text-sm">
              <label className="block">
                <span className="text-slate-500 text-xs">Thời gian (phút)</span>
                <input
                  type="number"
                  min={5}
                  value={config.total_duration_minutes}
                  onChange={(e) => {
                    setConfig((p) => ({ ...p, total_duration_minutes: parseInt(e.target.value) || 0 }));
                    setHasUnsaved(true);
                  }}
                  className="w-full mt-0.5 text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </label>
              <label className="block">
                <span className="text-slate-500 text-xs">Thang điểm</span>
                <input
                  type="number"
                  min={1}
                  value={config.scale_max}
                  onChange={(e) => {
                    setConfig((p) => ({ ...p, scale_max: parseInt(e.target.value) || 10 }));
                    setHasUnsaved(true);
                  }}
                  className="w-full mt-0.5 text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </label>
            </div>
          </div>

          {createError && (
            <div className="rounded-xl p-3 border border-red-200 bg-red-50 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{createError}</p>
            </div>
          )}
        </aside>

        {/* Editor */}
        <main className="min-w-0 space-y-4">
          {!isOwner && (
            <div
              className="rounded-xl px-4 py-3 border flex items-start gap-2.5 text-sm"
              style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', color: '#1E40AF' }}
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Chế độ xem</div>
                <div className="text-xs mt-0.5 opacity-90">
                  Đây là đề của giáo viên khác chia sẻ. Bạn có thể xem nhưng không sửa được.
                  Hãy "Sao chép" rồi tùy biến nếu muốn dùng lại.
                </div>
              </div>
            </div>
          )}

          {/* Banner: đang có thay đổi chưa cập nhật cho học viên */}
          {isOwner && hasDraft && (
            <div
              className="rounded-xl px-4 py-3 border flex items-start gap-2.5 text-sm"
              style={{ backgroundColor: '#FFFBEB', borderColor: '#FCD34D', color: '#92400E' }}
            >
              <History className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold">Bạn đang chỉnh sửa</div>
                <div className="text-xs mt-0.5 opacity-90">
                  Học viên vẫn đang dùng bản cũ. Thay đổi chỉ áp dụng khi bạn bấm{' '}
                  <span className="font-semibold">Cập nhật cho học viên</span>. Học viên đang làm bài dở
                  không bị gián đoạn, lần thi tiếp theo mới thấy bản mới.
                </div>
              </div>
            </div>
          )}

          {/* Banner: đã xuất bản, chưa có thay đổi */}
          {isOwner && examStatus === 'published' && !hasDraft && (
            <div
              className="rounded-xl px-4 py-3 border flex items-start gap-2.5 text-sm"
              style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', color: '#166534' }}
            >
              <Send className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold">Đề đang phát cho học viên</div>
                <div className="text-xs mt-0.5 opacity-90">
                  Bạn có thể sửa thoải mái — học viên chưa thấy ngay. Sửa xong bấm{' '}
                  <span className="font-semibold">Cập nhật cho học viên</span> để áp dụng.
                </div>
              </div>
            </div>
          )}
          {activeSection ? (
            <SectionEditor
              key={activeSection.id}
              section={activeSection}
              allSections={config.sections}
              onChange={(next) => updateSection(activeIdx, next)}
            />
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white py-20 text-center">
              <p className="text-slate-400 mb-4">Đề chưa có phần nào</p>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-white text-sm cursor-pointer"
                style={{ backgroundColor: THPT_THEME.primary }}
              >
                <Plus className="w-4 h-4" />
                Thêm phần đầu tiên
              </button>
            </div>
          )}
        </main>
      </div>

      <AddSectionModal open={showAddModal} onClose={() => setShowAddModal(false)} onPick={addSection} />
    </div>
  );
}

/**
 * Migrate config cũ (v1 "parts") sang v2 "sections" nếu cần.
 */
function normalizeConfig(raw: any): ThptConfig {
  if (raw?.version === '2.0' && Array.isArray(raw.sections)) {
    return raw as ThptConfig;
  }
  // v1 → v2: parts trở thành sections (giữ nguyên type vì tương thích)
  if (Array.isArray(raw?.parts)) {
    const sections: ThptSection[] = raw.parts.map((p: any, i: number) => ({
      ...p,
      id: `sec_legacy_${i}`,
      points_per_question: 1,
    }));
    return {
      version: '2.0',
      level: 'THPT',
      total_duration_minutes: raw.total_duration_minutes ?? 60,
      scale_max: raw.scale_max ?? 10,
      sections,
    };
  }
  return blankConfig();
}
