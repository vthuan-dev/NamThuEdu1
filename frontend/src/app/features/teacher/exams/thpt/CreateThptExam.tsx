import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
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
  Sparkles,
} from 'lucide-react';
import { api } from '../../../../../services/api';
import { useToastContext } from '../../../../../contexts/ToastContext';
import type { ThptConfig, ThptSection, SectionType } from '../../../../../types/thpt';
import {
  THPT_THEME,
  blankConfig,
  createSection,
  sectionMeta,
  countQuestions,
  totalQuestions,
  nextQuestionNumber,
  renumberConfig,
  LETTERS,
} from './sections';
import { SectionEditor } from './editors/SectionEditor';
import { AddSectionModal } from './AddSectionModal';
import { AssignModal } from '../../assignments/AssignModal';
import { ThptImportModal } from './components/ThptImportModal';

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
  const [searchParams] = useSearchParams();
  const queryAgeGroup = searchParams.get('age_group') as AgeGroup | null;

  // Dung toast context TOAN CUC (co ToastContainer render san o app root) thay vi
  // useToast() local — truoc day mang toasts local khong duoc render nen moi
  // canh bao publish (thieu audio/dap an, loi 422) deu VO HINH -> nguoi dung
  // tuong "bam Xuat ban khong duoc, khong phan hoi gi".
  const toast = useToastContext();

  const [examId, setExamId] = useState<string | undefined>(params.examId);
  const [examTitle, setExamTitle] = useState(queryAgeGroup === 'teens' ? 'Đề tổng hợp Teens' : 'Đề Tiếng Anh THPT');
  const [examDescription, setExamDescription] = useState('');
  const [ageGroup, setAgeGroup] = useState<AgeGroup>(queryAgeGroup || 'teens');
  const [config, setConfig] = useState<ThptConfig>(() => {
    const cfg = blankConfig();
    if (queryAgeGroup === 'teens') {
      cfg.level = 'THCS';
    }
    return cfg;
  });

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
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const handleThptImport = (data: any) => {
    if (data.sections && Array.isArray(data.sections)) {
      let runningStart = nextQuestionNumber(config.sections);
      const newSections: ThptSection[] = data.sections.map((s: any) => {
        const sec = {
          ...s,
          id: s.id || `s_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        };
        if (sec.type === 'mc_cloze' || sec.type === 'word_bank_cloze' || sec.type === 'open_cloze') {
          if (Array.isArray(sec.blanks)) {
            sec.blanks = sec.blanks.map((blank: any, idx: number) => {
              const qNum = runningStart + idx;
              return { ...blank, question_number: qNum };
            });
            runningStart += sec.blanks.length;
          }
        } else {
          if (Array.isArray(sec.items)) {
            sec.items = sec.items.map((item: any, idx: number) => {
              const qNum = runningStart + idx;
              return { ...item, question_number: qNum };
            });
            runningStart += sec.items.length;
          }
        }
        return sec;
      });

      setConfig(prev => renumberConfig({
        ...prev,
        sections: [...prev.sections, ...newSections],
      }));
      setHasUnsaved(true);
      toast.success(`Đã import ${newSections.length} phần thi thành công!`);
      return;
    }

    if (data.skill === 'listening' && Array.isArray(data.groups)) {
      let runningStart = nextQuestionNumber(config.sections);
      const newSections: ThptSection[] = data.groups.map((g: any) => {
        const isImageBlock = !!g.task_image;
        const sec = createSection('listening', runningStart, undefined, isImageBlock ? 'image_block' : undefined);
        sec.title = isImageBlock ? 'Nghe + ảnh đề' : 'Nghe';
        (sec as any).audio_url = g.audio_url || '';
        (sec as any).task_image = g.task_image || '';

        const items = Array.isArray(g.questions)
          ? g.questions.map((q: any, qi: number) => {
              const qNum = runningStart + qi;
              if (q.qType === 'fill_blank') {
                return {
                  question_number: qNum,
                  kind: 'fill_blank' as const,
                  prompt: q.qContent || '',
                  accepted_answers: [q.correctAnswer || q.correct_answer || ''],
                  case_sensitive: false,
                  explanation: q.qExplanation || q.q_explanation || '',
                };
              } else {
                const opts = Array.isArray(q.options)
                  ? q.options.map((o: any, oi: number) => ({ id: LETTERS[oi] || String(oi), text: o.content || '' }))
                  : [];
                const correctIdx = Array.isArray(q.options) ? q.options.findIndex((o: any) => !!o.isCorrect) : -1;
                const correctId = correctIdx !== -1 ? (LETTERS[correctIdx] || String(correctIdx)) : '';
                return {
                  question_number: qNum,
                  kind: 'mc' as const,
                  prompt: q.qContent || '',
                  options: opts,
                  correct_id: correctId,
                  explanation: q.qExplanation || q.q_explanation || '',
                };
              }
            })
          : [];
        (sec as any).items = items;
        runningStart += items.length;
        return sec;
      });

      setConfig(prev => renumberConfig({
        ...prev,
        sections: [...prev.sections, ...newSections],
      }));
      setHasUnsaved(true);
      toast.success(`Đã import ${newSections.length} phần Listening!`);
    } else if (data.skill === 'speaking' && Array.isArray(data.parts)) {
      let runningStart = nextQuestionNumber(config.sections);
      const newSections: ThptSection[] = data.parts.map((p: any, pi: number) => {
        const sec = createSection('speaking', runningStart + pi);
        const item = (sec as any).items?.[0];
        if (item) {
          item.prompt = p.qContent || p.q_content || '';
          item.prep_seconds = p.prepSeconds ?? p.prep_seconds ?? 30;
          item.speak_seconds = p.speakSeconds ?? p.speak_seconds ?? 120;
          item.explanation = p.qExplanation || p.q_explanation || '';
        }
        return sec;
      });

      setConfig(prev => renumberConfig({
        ...prev,
        sections: [...prev.sections, ...newSections],
      }));
      setHasUnsaved(true);
      toast.success(`Đã import ${newSections.length} phần Speaking!`);
    }
  };
  const assignExams = useMemo(() => {
    if (!examId) return [];
    return [
      {
        eId: Number(examId),
        eTitle: examTitle,
        eType: 'thpt',
        ageGroup: ageGroup,
      },
    ];
  }, [examId, examTitle, ageGroup]);

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

  /**
   * Các lỗi chặn xuất bản (đồng bộ rule backend validateThptConfig).
   * Ví dụ: phần Nghe thiếu audio, thiếu câu hỏi, ...
   */
  const publishBlockers = useMemo<string[]>(() => {
    const issues: string[] = [];
    for (const [idx, sec] of config.sections.entries()) {
      const label = sec.title || sectionMeta[sec.type]?.label || `Phần ${idx + 1}`;
      if (sec.type === 'listening') {
        if (!String((sec as any).audio_url || '').trim()) {
          issues.push(`${label}: chưa có audio.`);
        }
        if (!Array.isArray((sec as any).items) || (sec as any).items.length === 0) {
          issues.push(`${label}: chưa có câu hỏi nào.`);
        }
      }
      if (sec.type === 'speaking') {
        if (!Array.isArray((sec as any).items) || (sec as any).items.length === 0) {
          issues.push(`${label}: chưa có đề nói nào.`);
        }
      }
      if (sec.type === 'writing') {
        if (!Array.isArray((sec as any).items) || (sec as any).items.length === 0) {
          issues.push(`${label}: chưa có đề viết nào.`);
        }
      }
    }
    return issues;
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

    // 1) Ràng buộc client: thiếu audio / cấu trúc phần
    if (publishBlockers.length > 0) {
      const preview = publishBlockers.slice(0, 4).join(' · ');
      toast.warning(
        `Chưa xuất bản được — đề chưa đủ nội dung: ${preview}${publishBlockers.length > 4 ? ' …' : ''}`,
        6000,
      );
      return;
    }

    // 2) Ràng buộc: mọi câu trắc nghiệm / fill phải có đáp án đúng
    if (missingAnswers.length > 0) {
      const preview = missingAnswers.slice(0, 3).join(' · ');
      toast.warning(
        `Còn ${missingAnswers.length} câu chưa có đáp án đúng. Vui lòng bổ sung trước khi xuất bản: ${preview}${missingAnswers.length > 3 ? ' …' : ''}`,
        6000,
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
      const data = err?.response?.data;
      const errs = data?.errors;
      const msg = data?.message || 'Xuất bản thất bại.';
      // 422 validation → warning rõ ràng (vd: thiếu audio Listening)
      if (err?.response?.status === 422 || (Array.isArray(errs) && errs.length > 0)) {
        const detail = Array.isArray(errs) && errs.length
          ? errs.slice(0, 5).join(' · ')
          : msg;
        toast.warning(
          Array.isArray(errs) && errs.length
            ? `${msg} ${detail}`
            : msg,
          7000,
        );
      } else {
        toast.error(msg, 5000);
      }
    } finally {
      setIsPublishing(false);
    }
  };

  // ── Section ops ────────────────────────────────────────────────────────
  // Mọi thao tác đổi cấu trúc đều đi qua renumberConfig để số thứ tự câu LUÔN
  // liên tục từ 1 (thêm/xoá câu, thêm/bớt chỗ trống, đổi thứ tự phần...).
  const addSection = (
    type: SectionType,
    initItemKind?: 'mc' | 'fill_blank',
    initLayout?: 'image_block',
  ) => {
    const newSec = createSection(type, nextQuestionNumber(config.sections), initItemKind, initLayout);
    setConfig((prev) => renumberConfig({ ...prev, sections: [...prev.sections, newSec] }));
    setActiveIdx(config.sections.length);
    setHasUnsaved(true);
  };

  const updateSection = (idx: number, next: ThptSection) => {
    setConfig((prev) => {
      const sections = [...prev.sections];
      sections[idx] = next;
      return renumberConfig({ ...prev, sections });
    });
    setHasUnsaved(true);
  };

  const removeSection = (idx: number) => {
    if (!window.confirm('Xoá phần này khỏi đề?')) return;
    setConfig((prev) =>
      renumberConfig({ ...prev, sections: prev.sections.filter((_, i) => i !== idx) }),
    );
    setActiveIdx((cur) => Math.max(0, cur >= idx ? cur - 1 : cur));
    setHasUnsaved(true);
  };

  const moveSection = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= config.sections.length) return;
    setConfig((prev) => {
      const sections = [...prev.sections];
      [sections[idx], sections[target]] = [sections[target], sections[idx]];
      return renumberConfig({ ...prev, sections });
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

          {/* Import AI */}
          <button
            type="button"
            onClick={() => { setShowImportModal(true); }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-semibold text-white transition-all text-sm cursor-pointer"
            style={{ backgroundColor: '#0D9488' }}
            title="Import đề thi THCS/THPT từ PDF/Word bằng AI"
          >
            <Sparkles className="w-4 h-4" />
            <span>Import (AI)</span>
          </button>

          {/* Nút LỨU riêng — trước đây chỉ có nút Xuất bản nên giáo viên không có
              cách nào lưu nháp giữa lúc soạn ("chưa hiển thị nút lưu"). */}
          <button
            type="button"
            onClick={async () => {
              try {
                await handleSaveDraft();
                toast.success('Đã lưu.');
              } catch {
                /* handleSaveDraft đã hiện lỗi */
              }
            }}
            disabled={isSaving || isPublishing || !examId || (!hasUnsaved && !isDirty)}
            title={
              !hasUnsaved && !isDirty
                ? 'Không có thay đổi nào cần lưu'
                : 'Lưu thay đổi (chưa áp dụng cho học viên)'
            }
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-semibold text-slate-700 bg-white ring-1 ring-slate-300 hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icons.Save className="w-4 h-4" />}
            <span>Lưu</span>
          </button>

          {/* Xuất bản (tự lưu thay đổi trước khi áp dụng cho học viên).
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

          {/* Giao đề cho học viên (chỉ hiện khi đã xuất bản) */}
          {examStatus === 'published' && (() => {
            const canAssign = total > 0 && !isDirty && !hasUnsaved && !hasDraft;
            return (
              <button
                type="button"
                onClick={() => setShowAssignModal(true)}
                disabled={!canAssign}
                title={
                  !canAssign
                    ? 'Chỉ có thể giao đề khi số câu hỏi > 0 và đề đã được cập nhật/xuất bản mới nhất cho học viên.'
                    : 'Giao đề cho học viên'
                }
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm bg-indigo-600 hover:bg-indigo-700"
              >
                <Icons.UserPlus className="w-4 h-4" />
                <span>Giao cho học viên</span>
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
              <div className="pt-1 border-t border-slate-100">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={config.show_explanation !== false}
                    onChange={(e) => {
                      setConfig((p) => ({ ...p, show_explanation: e.target.checked }));
                      setHasUnsaved(true);
                    }}
                    className="mt-0.5 w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <div className="flex-1 text-xs">
                    <span className="font-semibold text-slate-700 block">Hiện giải thích đáp án</span>
                    <span className="text-slate-400 block text-[11px] leading-tight mt-0.5">
                      Hiển thị phần giải thích cho học viên khi xem lại bài
                    </span>
                  </div>
                </label>
              </div>
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
      <AssignModal
        open={showAssignModal}
        exams={assignExams}
        onClose={() => setShowAssignModal(false)}
        onAssigned={() => setShowAssignModal(false)}
      />
      <ThptImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleThptImport}
      />
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
