import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router";
import {
  ArrowLeft,
  Save,
  Headphones,
  Upload,
  FileAudio,
  CheckCircle2,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Plus,
  Trash2,
} from "lucide-react";
import { useToastContext } from "../../../../../contexts/ToastContext";
import { useTranslation } from "react-i18next";
import {
  saveVstepListeningSection,
  saveVstepListeningSectionAudio,
  deleteVstepListeningSection,
  publishVstepListeningExam,
  loadVstepListeningExam,
} from "../../../../../services/vstepApi";
import { teacherApi } from "../../../../../services/teacherApi";
import { transcribeAudio } from "../../../../../services/groqApi";
import { api } from "../../../../../services/api";
import { RichTextInput } from "../../../../../components/ui/RichTextInput";

// ─── Types ────────────────────────────────────────────────────────────────

interface Question {
  id: string;
  questionNumber: number;
  questionText: string;
  options: { A: string; B: string; C: string; D: string };
  correctAnswer: "A" | "B" | "C" | "D";
  explanation?: string;
}

interface ListeningSection {
  sectionNumber: number;
  sectionName: string;
  audioUrl: string;
  audioDuration: number;
  transcript: string;
  questions: Question[];
}

interface ListeningPart {
  partNumber: 1 | 2 | 3;
  partName: string;
  sections: ListeningSection[];
}

// ─── VSTEP B1-C1 Listening Layout ─────────────────────────────────────────
// Part 1: 1 audio chung × 8 questions
// Part 2: 3 conversations × 4 questions = 3 audios
// Part 3: 3 talks/lectures × 5 questions = 3 audios

const VSTEP_LISTENING_LAYOUT = {
  1: { sectionCount: 1, questionsPerSection: 8, questionStart: 1, label: "Announcements", partTitle: "Part 1 - Announcements", partDesc: "1 audio × 8 câu" },
  2: { sectionCount: 3, questionsPerSection: 4, questionStart: 9, label: "Conversation", partTitle: "Part 2 - Conversations", partDesc: "3 hội thoại × 4 câu" },
  3: { sectionCount: 3, questionsPerSection: 5, questionStart: 21, label: "Talk", partTitle: "Part 3 - Talks/Lectures", partDesc: "3 bài giảng × 5 câu" },
} as const;

const PART_LIST = [1, 2, 3] as const;

const sectionKey = (partNumber: number, sectionNumber: number) =>
  `${partNumber}-${sectionNumber}`;

const buildEmptySection = (
  partNumber: 1 | 2 | 3,
  sectionNumber: number
): ListeningSection => {
  const layout = VSTEP_LISTENING_LAYOUT[partNumber];
  const start =
    layout.questionStart + (sectionNumber - 1) * layout.questionsPerSection;
  return {
    sectionNumber,
    sectionName: `${layout.label} ${sectionNumber}`,
    audioUrl: "",
    audioDuration: 0,
    transcript: "",
    questions: Array.from({ length: layout.questionsPerSection }, (_, i) => ({
      id: `p${partNumber}-s${sectionNumber}-q${start + i}`,
      questionNumber: start + i,
      questionText: "",
      options: { A: "", B: "", C: "", D: "" },
      correctAnswer: "A" as const,
      explanation: "",
    })),
  };
};

const buildEmptyPart = (partNumber: 1 | 2 | 3): ListeningPart => {
  const layout = VSTEP_LISTENING_LAYOUT[partNumber];
  return {
    partNumber,
    partName: layout.partTitle,
    sections: Array.from({ length: layout.sectionCount }, (_, i) =>
      buildEmptySection(partNumber, i + 1)
    ),
  };
};

interface CreateVstepListeningProps {
  examId?: string;
  onComplete?: () => void;
  isFullTest?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────

export const CreateVstepListening = ({
  examId: propExamId,
  onComplete,
  isFullTest = false,
}: CreateVstepListeningProps = {}) => {
  const navigate = useNavigate();
  const { success, error } = useToastContext();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useParams();
  const urlExamId = params.examId || searchParams.get("id");

  const initialExamId =
    propExamId || urlExamId || `vstep-listening-${Date.now()}`;
  const [examId, setExamId] = useState<string>(initialExamId);
  const [examTitle, setExamTitle] = useState<string>(t("vstep.listening.title"));
  const [isLoading, setIsLoading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [currentPart, setCurrentPart] = useState<1 | 2 | 3>(1);

  // Per-section trackers — key = `${part}-${section}`
  const [savedSections, setSavedSections] = useState<Set<string>>(new Set());
  const [audioFiles, setAudioFiles] = useState<Record<string, File>>({});
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [transcribingKey, setTranscribingKey] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [autoSavingKey, setAutoSavingKey] = useState<string | null>(null);
  // Debounce timers cho auto-save questions per section
  const autoSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Track lần load đầu để skip auto-save khi chỉ load data
  const isInitialLoad = useRef(true);
  // Auto-save chạy trong setTimeout nên closure có thể giữ examId cũ (ID tạm).
  // Ref này luôn trỏ tới ID mới nhất sau khi ensureExam() đổi sang ID thật.
  const examIdRef = useRef(examId);
  useEffect(() => {
    examIdRef.current = examId;
  }, [examId]);
  // Giữ promise tạo đề đang chạy để nhiều lệnh lưu song song không tạo trùng đề.
  const ensureExamPromise = useRef<Promise<string> | null>(null);

  // Part 2 & 3 (3 sections each) default expanded; Part 1 (8 sections) collapsed
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => {
    const init = new Set<string>();
    [2, 3].forEach((p) => {
      const layout = VSTEP_LISTENING_LAYOUT[p as 2 | 3];
      for (let s = 1; s <= layout.sectionCount; s++) init.add(`${p}-${s}`);
    });
    return init;
  });

  /**
   * Section đang được soạn — key `${part}-${section}`.
   *
   * Full Test luôn mở đủ 7 section vì đề chuẩn cần đủ 35 câu. Đề đơn kỹ năng
   * mặc định chỉ 1 section — giáo viên tự thêm phần cần dạy, thay vì bị bắt
   * điền trọn 3 part mới được lưu (đúng cách Writing dùng activeTasks và
   * Speaking dùng activeParts).
   */
  const [activeSections, setActiveSections] = useState<Set<string>>(() => {
    const init = new Set<string>();
    if (isFullTest) {
      PART_LIST.forEach((p) => {
        const layout = VSTEP_LISTENING_LAYOUT[p as 1 | 2 | 3];
        for (let s = 1; s <= layout.sectionCount; s++) init.add(sectionKey(p, s));
      });
    } else {
      init.add(sectionKey(1, 1));
    }
    return init;
  });

  const [parts, setParts] = useState<ListeningPart[]>(
    PART_LIST.map((p) => buildEmptyPart(p as 1 | 2 | 3))
  );

  // Ref để truy cập parts mới nhất bên trong setTimeout (debounced auto-save)
  const partsRef = useRef(parts);
  useEffect(() => {
    partsRef.current = parts;
  }, [parts]);

  const currentPartData = parts.find((p) => p.partNumber === currentPart)!;
  const currentLayout = VSTEP_LISTENING_LAYOUT[currentPart];

  // ─── Helpers ────────────────────────────────────────────────────────────

  const updateSection = (
    partNumber: number,
    sectionNumber: number,
    updater: (s: ListeningSection) => ListeningSection
  ) => {
    setParts((prev) =>
      prev.map((p) => {
        if (p.partNumber !== partNumber) return p;
        return {
          ...p,
          sections: p.sections.map((s) =>
            s.sectionNumber === sectionNumber ? updater(s) : s
          ),
        };
      })
    );
  };

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isSectionActive = (partNumber: number, sectionNumber: number) =>
    activeSections.has(sectionKey(partNumber, sectionNumber));

  /** Các section của 1 part mà giáo viên đang thực sự soạn. */
  const activeSectionNumbers = (partNumber: number) => {
    const layout = VSTEP_LISTENING_LAYOUT[partNumber as 1 | 2 | 3];
    const list: number[] = [];
    for (let s = 1; s <= layout.sectionCount; s++) {
      if (activeSections.has(sectionKey(partNumber, s))) list.push(s);
    }
    return list;
  };

  const setAllExpanded = (partNumber: number, expanded: boolean) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      activeSectionNumbers(partNumber).forEach((s) => {
        const k = sectionKey(partNumber, s);
        if (expanded) next.add(k);
        else next.delete(k);
      });
      return next;
    });
  };

  const isPartFullySaved = (partNumber: number) => {
    const active = activeSectionNumbers(partNumber);
    if (active.length === 0) return false;
    return active.every((s) => savedSections.has(sectionKey(partNumber, s)));
  };

  /**
   * Đảm bảo đề đã tồn tại trong DB trước khi lưu.
   *
   * Editor sinh ID tạm `vstep-listening-<timestamp>` khi giáo viên vào trang tạo
   * mới, và mọi endpoint lưu đều tra theo eId — nên nếu không tạo đề thật trước,
   * lần lưu đầu tiên sẽ nhận 404. Reading đã có helper tương tự; Listening trước
   * đây bị thiếu, đó là lý do "bấm lưu mà không có gì xảy ra".
   */
  const ensureExam = async (): Promise<string> => {
    if (!examIdRef.current.startsWith("vstep-")) return examIdRef.current;

    // Upload audio và nút Lưu có thể cùng gọi ensureExam trong vài trăm ms.
    // Không dùng chung 1 promise thì mỗi lệnh sẽ tạo 1 đề riêng và dữ liệu bị
    // chia đôi giữa 2 đề khác nhau.
    if (ensureExamPromise.current) return ensureExamPromise.current;

    ensureExamPromise.current = (async () => {
      const res = await teacherApi.exams.create({
        eTitle: examTitle,
        eType: "VSTEP",
        eSkill: "listening",
        eScope: "skill",
        eDuration_minutes: 40,
        eIs_private: false,
        eSource_type: "manual",
      } as any);

      if (res.status === "success" && res.data) {
        const newId = String((res.data as any).eId);
        setExamId(newId);
        examIdRef.current = newId;
        if (!isFullTest) {
          navigate(`/giao-vien/de-thi/vstep/listening/sua/${newId}`, {
            replace: true,
          });
        }
        return newId;
      }
      throw new Error("Không thể tạo đề thi trong cơ sở dữ liệu.");
    })();

    try {
      return await ensureExamPromise.current;
    } catch (err) {
      // Cho phép thử lại sau khi lỗi (mạng, quyền...).
      ensureExamPromise.current = null;
      throw err;
    }
  };

  /** Thêm 1 section vào danh sách đang soạn và mở sẵn để nhập ngay. */
  const addSection = (partNumber: number, sectionNumber: number) => {
    const key = sectionKey(partNumber, sectionNumber);
    setActiveSections((prev) => new Set(prev).add(key));
    setExpandedKeys((prev) => new Set(prev).add(key));
    setCurrentPart(partNumber as 1 | 2 | 3);
  };

  /**
   * Bỏ 1 section khỏi đề. Nếu section đã lưu vào DB thì gọi API xoá trước —
   * chỉ ẩn trên UI sẽ để lại câu hỏi mồ côi mà học viên vẫn phải làm.
   */
  const removeSection = async (partNumber: number, sectionNumber: number) => {
    const key = sectionKey(partNumber, sectionNumber);
    const totalActive = activeSections.size;

    if (totalActive <= 1) {
      error("Đề phải còn ít nhất 1 phần. Không thể bỏ phần cuối cùng.");
      return;
    }

    if (savedSections.has(key) && !examId.startsWith("vstep-")) {
      try {
        await deleteVstepListeningSection(examId, partNumber, sectionNumber);
      } catch (err: any) {
        error(
          err.response?.data?.message ||
            `Không xoá được phần này: ${err.message}`
        );
        return;
      }
    }

    // Reset nội dung để lần thêm lại bắt đầu từ trạng thái trắng.
    updateSection(partNumber, sectionNumber, () =>
      buildEmptySection(partNumber as 1 | 2 | 3, sectionNumber)
    );
    setSavedSections((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    setActiveSections((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    success(`Đã bỏ ${buildEmptySection(partNumber as 1 | 2 | 3, sectionNumber).sectionName}`);
  };

  /** Chuyển nhanh phạm vi đề theo preset (Part 1 / Part 2 / Part 3 / Full 3 Part) */
  const applyPreset = (preset: 'part1' | 'part2' | 'part3' | 'full') => {
    const newActive = new Set<string>();
    const newExpanded = new Set<string>();

    if (preset === 'part1') {
      newActive.add(sectionKey(1, 1));
      newExpanded.add(sectionKey(1, 1));
      setCurrentPart(1);
    } else if (preset === 'part2') {
      for (let s = 1; s <= 3; s++) {
        newActive.add(sectionKey(2, s));
        newExpanded.add(sectionKey(2, s));
      }
      setCurrentPart(2);
    } else if (preset === 'part3') {
      for (let s = 1; s <= 3; s++) {
        newActive.add(sectionKey(3, s));
        newExpanded.add(sectionKey(3, s));
      }
      setCurrentPart(3);
    } else if (preset === 'full') {
      PART_LIST.forEach((p) => {
        const layout = VSTEP_LISTENING_LAYOUT[p as 1 | 2 | 3];
        for (let s = 1; s <= layout.sectionCount; s++) {
          newActive.add(sectionKey(p, s));
          newExpanded.add(sectionKey(p, s));
        }
      });
    }

    setActiveSections(newActive);
    setExpandedKeys(newExpanded);
    success(
      `Đã chuyển phạm vi đề sang: ${
        preset === 'part1'
          ? 'Part 1 (8 câu)'
          : preset === 'part2'
          ? 'Part 2 (12 câu)'
          : preset === 'part3'
          ? 'Part 3 (15 câu)'
          : 'Toàn bộ 3 Part (35 câu)'
      }`
    );
  };

  const isPresetActive = (preset: 'part1' | 'part2' | 'part3' | 'full') => {
    if (preset === 'part1') {
      return activeSections.size === 1 && activeSections.has(sectionKey(1, 1));
    }
    if (preset === 'part2') {
      return activeSections.size === 3 && [1, 2, 3].every((s) => activeSections.has(sectionKey(2, s)));
    }
    if (preset === 'part3') {
      return activeSections.size === 3 && [1, 2, 3].every((s) => activeSections.has(sectionKey(3, s)));
    }
    if (preset === 'full') {
      return activeSections.size === 7;
    }
    return false;
  };

  // ─── Debounced auto-save (questions + transcript) ───────────────────────
  // Trigger sau khi user chỉnh data, debounce 1.5s. Skip nếu chưa upload audio
  // hoặc chưa có ít nhất 1 câu hỏi hoàn thành.
  const scheduleSectionAutoSave = (partNumber: number, sectionNumber: number) => {
    if (isInitialLoad.current) return;
    if (!examIdRef.current || examIdRef.current.startsWith("vstep-")) return;

    const key = sectionKey(partNumber, sectionNumber);
    if (autoSaveTimers.current[key]) clearTimeout(autoSaveTimers.current[key]);

    autoSaveTimers.current[key] = setTimeout(async () => {
      const part = partsRef.current.find((p) => p.partNumber === partNumber);
      const section = part?.sections.find((s) => s.sectionNumber === sectionNumber);
      if (!section) return;

      // Cần audio server URL + ít nhất 1 câu hỏi hoàn thành
      if (!section.audioUrl || section.audioUrl.startsWith("blob:")) return;
      const filledQs = section.questions.filter(
        (q) =>
          q.questionText.trim() &&
          q.options.A &&
          q.options.B &&
          q.options.C &&
          q.options.D
      );
      if (filledQs.length === 0) return;

      setAutoSavingKey(key);
      try {
        await saveVstepListeningSection(examIdRef.current, partNumber, sectionNumber, {
          sectionName: section.sectionName,
          audioUrl: section.audioUrl,
          audioDuration: section.audioDuration || 1,
          transcript: section.transcript,
          questions: filledQs.map((q) => ({
            questionNumber: q.questionNumber,
            questionText: q.questionText,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation || "",
          })),
        });
        setSavedSections((prev) => {
          const next = new Set(prev);
          next.add(key);
          return next;
        });
        console.log(`💾 Auto-saved section ${key} (${filledQs.length} câu)`);
      } catch (err: any) {
        console.error("Auto-save section failed:", err);
      } finally {
        setAutoSavingKey(null);
      }
    }, 1500);
  };

  // Đủ câu trên CÁC SECTION ĐANG SOẠN (không tính section giáo viên không chọn).
  const isPartFullyFilled = (partNumber: number) => {
    const layout = VSTEP_LISTENING_LAYOUT[partNumber as 1 | 2 | 3];
    const active = activeSectionNumbers(partNumber);
    if (active.length === 0) return false;
    const totalExpected = active.length * layout.questionsPerSection;
    const part = parts.find((p) => p.partNumber === partNumber);
    if (!part) return false;
    const filledCount = part.sections.reduce(
      (acc, s) =>
        acc +
        (active.includes(s.sectionNumber)
          ? s.questions.filter(
              (q) =>
                q.questionText.trim() &&
                q.options.A &&
                q.options.B &&
                q.options.C &&
                q.options.D
            ).length
          : 0),
      0
    );
    return filledCount >= totalExpected;
  };

  // ─── Load existing exam ─────────────────────────────────────────────────

  useEffect(() => {
    const effectiveExamId = propExamId || urlExamId;

    if (!effectiveExamId) {
      if (!isFullTest && !params.examId) setSearchParams({ id: examId }, { replace: true });
      return;
    }

    if (effectiveExamId !== examId) setExamId(effectiveExamId);
    if (!isFullTest && !params.examId && !searchParams.get("id"))
      setSearchParams({ id: effectiveExamId }, { replace: true });

    setIsLoading(true);
    console.log("🔄 Loading listening exam:", effectiveExamId);
    loadVstepListeningExam(effectiveExamId)
      .then((response) => {
        console.log("📥 Load response:", response);
        if (response.status !== "success" || !response.data) {
          console.warn("⚠️ Load response không hợp lệ");
          return;
        }
        const examData = response.data;
        console.log("📦 Loaded parts data:", JSON.stringify(examData.parts, null, 2));
        setExamTitle(examData.title);

        const newParts: ListeningPart[] = PART_LIST.map((pn) => {
          const layout = VSTEP_LISTENING_LAYOUT[pn as 1 | 2 | 3];
          const apiPart = examData.parts.find(
            (p: any) => p.partNumber === pn
          );
          if (!apiPart) return buildEmptyPart(pn as 1 | 2 | 3);

          const sections: ListeningSection[] = Array.from(
            { length: layout.sectionCount },
            (_, i) => {
              const sn = i + 1;
              const apiSec = apiPart.sections?.find(
                (s: any) => s.sectionNumber === sn
              );
              if (!apiSec) return buildEmptySection(pn as 1 | 2 | 3, sn);

              const start =
                layout.questionStart + (sn - 1) * layout.questionsPerSection;
              const apiQs = Array.isArray(apiSec.questions)
                ? apiSec.questions
                : [];
              const questions: Question[] = Array.from(
                { length: layout.questionsPerSection },
                (_, qi) => {
                  const num = start + qi;
                  const apiQ = apiQs[qi];
                  if (apiQ) {
                    return {
                      id: `p${pn}-s${sn}-q${num}`,
                      questionNumber: apiQ.questionNumber || num,
                      questionText: apiQ.questionText || "",
                      options: apiQ.options || { A: "", B: "", C: "", D: "" },
                      correctAnswer: (apiQ.correctAnswer ||
                        "A") as Question["correctAnswer"],
                      explanation: apiQ.explanation || "",
                    };
                  }
                  return {
                    id: `p${pn}-s${sn}-q${num}`,
                    questionNumber: num,
                    questionText: "",
                    options: { A: "", B: "", C: "", D: "" },
                    correctAnswer: "A",
                  };
                }
              );

              // Reject stale blob URLs từ data cũ (blob chỉ live trong session tạo ra nó)
              const safeAudioUrl =
                apiSec.audioUrl && !apiSec.audioUrl.startsWith("blob:")
                  ? apiSec.audioUrl
                  : "";

              return {
                sectionNumber: sn,
                sectionName: apiSec.sectionName || `${layout.label} ${sn}`,
                audioUrl: safeAudioUrl,
                audioDuration: safeAudioUrl ? apiSec.audioDuration || 0 : 0,
                transcript: apiSec.transcript || "",
                questions,
              };
            }
          );

          return {
            partNumber: pn as 1 | 2 | 3,
            partName: apiPart.partName || layout.partTitle,
            sections,
          };
        });

        setParts(newParts);

        // Mark sections that are fully saved (audio + at least 1 question)
        const newSaved = new Set<string>();
        newParts.forEach((p) => {
          p.sections.forEach((s) => {
            if (
              s.audioUrl &&
              !s.audioUrl.startsWith("blob:") &&
              s.questions.some((q) => q.questionText.trim())
            ) {
              newSaved.add(sectionKey(p.partNumber, s.sectionNumber));
            }
          });
        });
        setSavedSections(newSaved);

        // Đề đơn kỹ năng: chỉ hiện các section thật sự có dữ liệu. Hiện đủ 7
        // khung trống sẽ khiến giáo viên tưởng bắt buộc điền hết mới lưu được.
        if (!isFullTest) {
          const active = new Set<string>();
          newParts.forEach((p) => {
            p.sections.forEach((s) => {
              const hasContent =
                (s.audioUrl && !s.audioUrl.startsWith("blob:")) ||
                s.transcript?.trim() ||
                s.questions.some((q) => q.questionText.trim());
              if (hasContent) active.add(sectionKey(p.partNumber, s.sectionNumber));
            });
          });
          if (active.size === 0) active.add(sectionKey(1, 1));
          setActiveSections(active);
          // Nhảy tới part đầu tiên có nội dung để giáo viên thấy ngay việc mình đã làm.
          const firstPart = Number([...active][0]?.split("-")[0] || 1);
          setCurrentPart(firstPart as 1 | 2 | 3);
        }

        success(t("vstep.listening.toast.loadSuccess"));
      })
      .catch((err) => {
        console.log("Exam not found or error loading, starting fresh:", err);
      })
      .finally(() => {
        setIsLoading(false);
        // Sau khi load xong, cho phép auto-save kích hoạt
        // (delay 1 tick để các setState từ load chạy xong trước)
        setTimeout(() => {
          isInitialLoad.current = false;
        }, 100);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propExamId]);

  // ─── Audio upload + transcribe (per section) ────────────────────────────

  const uploadAudioToServer = async (
    file: File,
    key: string
  ): Promise<string | null> => {
    setUploadingKey(key);
    try {
      const formData = new FormData();
      formData.append("audio", file, file.name);
      formData.append("questionId", `vstep-listening-${examId}-${key}`);
      const { data: result } = await api.post("/teacher/upload/audio", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (result.success) return result.data.audioUrl as string;
      const errMsg = result.errors
        ? Object.values(result.errors).flat().join(", ")
        : result.message || "Upload failed";
      throw new Error(errMsg);
    } catch (err: any) {
      console.error("Audio upload error:", err);
      error(`Lỗi upload audio: ${err.message || "Unknown error"}`);
      return null;
    } finally {
      setUploadingKey(null);
    }
  };

  const formatTranscript = (raw: string): string => {
    return raw
      .replace(/\s+/g, " ")
      .trim()
      .replace(
        /\s*(Recording\s+(?:number\s+)?\d+|Conversation\s+\d+|Number\s+\d+|Part\s+\d+|Question\s+\d+|Dialogue\s+\d+|Talk\s+\d+|Announcement\s+\d+)\b\.?/gi,
        "\n\n$1."
      )
      .replace(/([.?!])\s+(?=[A-Z"'])/g, "$1\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  };

  const runTranscribe = async (
    partNumber: number,
    sectionNumber: number,
    file: File
  ): Promise<string | null> => {
    const key = sectionKey(partNumber, sectionNumber);
    setTranscribingKey(key);
    try {
      const raw = await transcribeAudio(file, "en");
      const text = formatTranscript(raw);
      updateSection(partNumber, sectionNumber, (s) => ({
        ...s,
        transcript: text,
      }));
      const layout = VSTEP_LISTENING_LAYOUT[partNumber as 1 | 2 | 3];
      success(
        `✨ Đã transcript ${layout.label} ${sectionNumber} (${
          raw.split(/\s+/).length
        } từ)`
      );
      return text;
    } catch (err: any) {
      error(`Không tạo được transcript: ${err.message || "Unknown error"}`);
      return null;
    } finally {
      setTranscribingKey(null);
    }
  };

  const handleSectionAudioUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    partNumber: number,
    sectionNumber: number
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      error(t("vstep.listening.toast.audioError"));
      return;
    }

    const key = sectionKey(partNumber, sectionNumber);
    const blobUrl = URL.createObjectURL(file);

    // Tạo bản ghi đề trước khi upload để audio được ghi ngay vào DB — trước đây
    // bước auto-save bị bỏ qua vì examId vẫn là chuỗi tạm "vstep-listening-*".
    let targetExamId = examId;
    try {
      targetExamId = await ensureExam();
    } catch (err: any) {
      error(err.message || "Không tạo được đề thi để lưu audio.");
      return;
    }

    setAudioFiles((prev) => ({ ...prev, [key]: file }));
    updateSection(partNumber, sectionNumber, (s) => ({
      ...s,
      audioUrl: blobUrl,
    }));

    // Read duration metadata
    const audio = new Audio();
    audio.onloadedmetadata = () => {
      const duration = Math.floor(audio.duration) || 1;
      updateSection(partNumber, sectionNumber, (s) => ({
        ...s,
        audioDuration: duration,
      }));
    };
    audio.src = blobUrl;

    // Upload to server (persistent URL)
    const serverUrl = await uploadAudioToServer(file, key);
    if (serverUrl) {
      updateSection(partNumber, sectionNumber, (s) => ({
        ...s,
        audioUrl: serverUrl,
      }));
    }

    // Auto-transcribe with Whisper
    const transcript = await runTranscribe(partNumber, sectionNumber, file);

    // Auto-persist audio metadata to DB (only when real exam ID exists)
    console.log("🔍 Auto-save check:", {
      serverUrl,
      examId: targetExamId,
      isPlaceholderId: targetExamId?.startsWith("vstep-"),
      partNumber,
      sectionNumber,
    });
    if (serverUrl && targetExamId && !targetExamId.startsWith("vstep-")) {
      try {
        const latestPart = partsRef.current.find((p) => p.partNumber === partNumber);
        const latestSection = latestPart?.sections.find(
          (s) => s.sectionNumber === sectionNumber
        );
        const duration =
          audio.duration && Number.isFinite(audio.duration)
            ? Math.floor(audio.duration)
            : latestSection?.audioDuration || 1;
        console.log("📤 Auto-saving audio to DB:", {
          examId: targetExamId,
          partNumber,
          sectionNumber,
          audioUrl: serverUrl,
          duration,
          transcriptLen: (transcript || "").length,
        });
        const resp = await saveVstepListeningSectionAudio(
          targetExamId,
          partNumber,
          sectionNumber,
          {
            sectionName: latestSection?.sectionName,
            audioUrl: serverUrl,
            audioDuration: duration,
            transcript: transcript || latestSection?.transcript || "",
          }
        );
        console.log("✅ Auto-save audio response:", resp);
        const layout = VSTEP_LISTENING_LAYOUT[partNumber as 1 | 2 | 3];
        success(`✅ Đã lưu audio ${layout.label} ${sectionNumber} vào DB`);

        // Cập nhật savedSections nếu section này đã có câu hỏi
        const hasQuestions = latestSection?.questions.some((q) => q.questionText.trim());
        if (hasQuestions) {
          setSavedSections((prev) => {
            const next = new Set(prev);
            next.add(key);
            return next;
          });
        }
      } catch (err: any) {
        console.error("❌ Auto-save audio metadata failed:", err);
        console.error("Response:", err.response?.data);
        error(
          `Lưu audio thất bại: ${
            err.response?.data?.message || err.message
          }`
        );
      }
    } else {
      console.warn("⚠️ Auto-save skipped — không có serverUrl hoặc examId placeholder");
    }
  };

  const handleManualTranscribe = (partNumber: number, sectionNumber: number) => {
    const key = sectionKey(partNumber, sectionNumber);
    const file = audioFiles[key];
    if (!file) {
      error("Vui lòng upload lại file audio để transcribe");
      return;
    }
    runTranscribe(partNumber, sectionNumber, file);
  };

  // ─── Question updates ──────────────────────────────────────────────────

  const updateQuestion = (
    partNumber: number,
    sectionNumber: number,
    questionId: string,
    field: "questionText" | "correctAnswer" | "explanation",
    value: any
  ) => {
    updateSection(partNumber, sectionNumber, (s) => ({
      ...s,
      questions: s.questions.map((q) =>
        q.id === questionId ? { ...q, [field]: value } : q
      ),
    }));
    scheduleSectionAutoSave(partNumber, sectionNumber);
  };

  const updateOption = (
    partNumber: number,
    sectionNumber: number,
    questionId: string,
    option: "A" | "B" | "C" | "D",
    value: string
  ) => {
    updateSection(partNumber, sectionNumber, (s) => ({
      ...s,
      questions: s.questions.map((q) =>
        q.id === questionId
          ? { ...q, options: { ...q.options, [option]: value } }
          : q
      ),
    }));
    scheduleSectionAutoSave(partNumber, sectionNumber);
  };

  const handleQuestionPaste = (
    event: React.ClipboardEvent<HTMLElement>,
    partNumber: number,
    sectionNumber: number,
    questionId: string
  ) => {
    const value = event.clipboardData.getData("text");
    const firstOption = value.match(/\b([A-D])\.\s+/i);
    const optionCount = ["A", "B", "C", "D"].filter((letter) =>
      new RegExp(`\\b${letter}\\.\\s+`, "i").test(value)
    ).length;
    if (!firstOption || optionCount < 2) return;

    const options: Partial<Record<"A" | "B" | "C" | "D", string>> = {};
    const firstIndex = firstOption.index!;
    const tokens = value
      .substring(firstIndex)
      .split(/\b([A-D])\.\s+/i)
      .filter((token) => token.trim());
    for (let index = 0; index < tokens.length - 1; index += 2) {
      const letter = tokens[index].toUpperCase() as "A" | "B" | "C" | "D";
      const optionText = tokens[index + 1].trim();
      if (optionText) options[letter] = optionText;
    }

    event.preventDefault();
    updateSection(partNumber, sectionNumber, (section) => ({
      ...section,
      questions: section.questions.map((question) =>
        question.id === questionId
          ? {
              ...question,
              questionText: value
                .substring(0, firstIndex)
                .replace(/^\s*\d+\s*[.)]\s*/, "")
                .trim(),
              options: { ...question.options, ...options },
            }
          : question
      ),
    }));
    scheduleSectionAutoSave(partNumber, sectionNumber);
  };

  const handleOptionsPaste = (
    event: React.ClipboardEvent<HTMLInputElement>,
    partNumber: number,
    sectionNumber: number,
    questionId: string
  ) => {
    const value = event.clipboardData.getData("text");
    const matches = [
      ...value.matchAll(/(?:^|\s)([A-D])\.\s*(.*?)(?=(?:\s+[A-D]\.\s)|$)/gis),
    ];
    if (matches.length < 2) return;

    const options: Partial<Record<"A" | "B" | "C" | "D", string>> = {};
    matches.forEach((match) => {
      options[match[1].toUpperCase() as "A" | "B" | "C" | "D"] = match[2].trim();
    });
    event.preventDefault();
    updateSection(partNumber, sectionNumber, (section) => ({
      ...section,
      questions: section.questions.map((question) =>
        question.id === questionId
          ? { ...question, options: { ...question.options, ...options } }
          : question
      ),
    }));
    scheduleSectionAutoSave(partNumber, sectionNumber);
  };

  const updateTranscript = (
    partNumber: number,
    sectionNumber: number,
    value: string
  ) => {
    updateSection(partNumber, sectionNumber, (s) => ({
      ...s,
      transcript: value,
    }));
    scheduleSectionAutoSave(partNumber, sectionNumber);
  };

  // ─── Save section + Publish ─────────────────────────────────────────────

  const handleSaveSection = async (
    partNumber: number,
    sectionNumber: number
  ) => {
    const part = parts.find((p) => p.partNumber === partNumber);
    const section = part?.sections.find(
      (s) => s.sectionNumber === sectionNumber
    );
    if (!part || !section) return;
    const key = sectionKey(partNumber, sectionNumber);

    if (!section.audioUrl) {
      error(`${section.sectionName}: chưa có audio`);
      return;
    }
    if (section.audioUrl.startsWith("blob:")) {
      error(`${section.sectionName}: audio chưa upload server, vui lòng upload lại`);
      return;
    }
    if (uploadingKey === key) {
      error("Đang upload audio, đợi xong rồi save");
      return;
    }

    const filledQs = section.questions.filter(
      (q) =>
        q.questionText.trim() &&
        q.options.A &&
        q.options.B &&
        q.options.C &&
        q.options.D
    );
    if (filledQs.length === 0) {
      error(`${section.sectionName}: chưa có câu hỏi nào hoàn thành`);
      return;
    }

    setSavingKey(key);
    try {
      const targetExamId = await ensureExam();
      await saveVstepListeningSection(targetExamId, partNumber, sectionNumber, {
        sectionName: section.sectionName,
        audioUrl: section.audioUrl,
        audioDuration: section.audioDuration || 1,
        transcript: section.transcript,
        questions: filledQs.map((q) => ({
          questionNumber: q.questionNumber,
          questionText: q.questionText,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation || "",
        })),
      });

      // Hiện toast thành công NGAY SAU khi API trả OK
      success(
        `✅ Đã lưu ${section.sectionName} — ${filledQs.length} câu hỏi vào đề thi`
      );

      setSavedSections((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });

      // Full Test: báo hoàn thành ngay khi có nội dung, giống Reading/Writing/
      // Speaking. Chờ đủ 7 section khiến Listening thành nút thắt của cả đề.
      if (isFullTest && onComplete) {
        setTimeout(() => onComplete(), 300);
      }
    } catch (err: any) {
      error(
        err.response?.data?.message || `Lỗi lưu section: ${err.message}`
      );
    } finally {
      setSavingKey(null);
    }
  };

  /**
   * Xuất bản đề.
   *
   * Chỉ xét các section giáo viên đang soạn, và chỉ cần 1 section hoàn chỉnh là
   * cho xuất bản (đề bán phần) — giống Writing/Speaking. Section dở dang bị loại
   * khỏi payload kèm cảnh báo, không chặn cả quá trình như trước.
   */
  const handlePublish = async () => {
    const readySections: {
      partNumber: number;
      partName: string;
      section: ListeningSection;
      questions: Question[];
    }[] = [];
    const skipped: string[] = [];

    parts.forEach((p) => {
      p.sections.forEach((s) => {
        if (!isSectionActive(p.partNumber, s.sectionNumber)) return;

        if (!s.audioUrl || s.audioUrl.startsWith("blob:")) {
          skipped.push(`${s.sectionName}: chưa có audio`);
          return;
        }
        const filledQs = s.questions.filter(
          (q) =>
            q.questionText.trim() &&
            q.options.A &&
            q.options.B &&
            q.options.C &&
            q.options.D
        );
        if (filledQs.length === 0) {
          skipped.push(`${s.sectionName}: chưa có câu hỏi hoàn thành`);
          return;
        }
        readySections.push({
          partNumber: p.partNumber,
          partName: p.partName,
          section: s,
          questions: filledQs,
        });
      });
    });

    if (readySections.length === 0) {
      error(
        skipped[0]
          ? `Chưa xuất bản được — ${skipped[0]}`
          : "Đề chưa có phần nào hoàn chỉnh (cần audio + ít nhất 1 câu hỏi)."
      );
      return;
    }

    setIsPublishing(true);
    try {
      const targetExamId = await ensureExam();

      // Tự động lưu tất cả section hợp lệ vào CSDL trước khi xuất bản nếu chưa được lưu
      for (const item of readySections) {
        const secKey = sectionKey(item.partNumber, item.section.sectionNumber);
        if (!savedSections.has(secKey)) {
          await saveVstepListeningSection(targetExamId, item.partNumber, item.section.sectionNumber, {
            sectionName: item.section.sectionName,
            audioUrl: item.section.audioUrl,
            audioDuration: item.section.audioDuration || 1,
            transcript: item.section.transcript,
            questions: item.questions.map((q) => ({
              questionNumber: q.questionNumber,
              questionText: q.questionText,
              options: q.options,
              correctAnswer: q.correctAnswer,
              explanation: q.explanation || "",
            })),
          });
          setSavedSections((prev) => new Set(prev).add(secKey));
        }
      }

      // Gộp theo part nhưng GIỮ audio của từng section — trước đây payload chỉ
      // lấy sections[0].audioUrl nên Part 2/3 mất audio của section 2 và 3.
      const partMap = new Map<
        number,
        {
          partNumber: number;
          partName: string;
          audioUrl: string;
          sections: {
            sectionNumber: number;
            sectionName: string;
            audioUrl: string;
            questions: {
              questionNumber: number;
              questionText: string;
              options: Question["options"];
              correctAnswer: Question["correctAnswer"];
              explanation: string;
            }[];
          }[];
        }
      >();

      readySections.forEach(({ partNumber, partName, section, questions }) => {
        if (!partMap.has(partNumber)) {
          partMap.set(partNumber, {
            partNumber,
            partName,
            audioUrl: section.audioUrl,
            sections: [],
          });
        }
        partMap.get(partNumber)!.sections.push({
          sectionNumber: section.sectionNumber,
          sectionName: section.sectionName,
          audioUrl: section.audioUrl,
          questions: questions.map((q) => ({
            questionNumber: q.questionNumber,
            questionText: q.questionText,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation || "",
          })),
        });
      });

      const publishParts = [...partMap.values()]
        .sort((a, b) => a.partNumber - b.partNumber)
        .map((p) => ({
          ...p,
          questions: p.sections.flatMap((s) => s.questions),
        }));

      await publishVstepListeningExam(targetExamId, {
        title: examTitle,
        parts: publishParts,
      });

      const totalQuestions = publishParts.reduce(
        (acc, p) => acc + p.questions.length,
        0
      );
      success(
        `✅ Đã xuất bản đề — ${readySections.length} phần, ${totalQuestions} câu hỏi`
      );
      if (skipped.length > 0) {
        error(
          `Bỏ qua ${skipped.length} phần chưa hoàn chỉnh: ${skipped[0]}${
            skipped.length > 1 ? ` (và ${skipped.length - 1} phần khác)` : ""
          }`
        );
      }
      if (!isFullTest) {
        setTimeout(() => navigate("/giao-vien/de-thi"), 1500);
      }
    } catch (err: any) {
      error(
        err.response?.data?.message || t("vstep.listening.toast.publishError")
      );
    } finally {
      setIsPublishing(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div
      className={`bg-gray-50 flex flex-col ${
        isFullTest ? "h-full" : "h-screen overflow-hidden"
      }`}
    >
      {/* Header — hidden when in Full Test mode */}
      {!isFullTest && (
        <div className="bg-white border-b border-gray-200 flex-shrink-0 z-10">
          <div className="max-w-[1800px] mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate("/giao-vien/de-thi")}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <input
                    type="text"
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                    className="text-2xl font-bold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 -ml-2"
                    placeholder={t("vstep.listening.title")}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    {t("vstep.listening.subtitle")}
                    <span className="ml-2 text-xs text-green-600 font-medium">
                      • {t("vstep.listening.examIdLabel")}:{" "}
                      {examId.startsWith("vstep-") ? "chưa lưu" : examId}
                    </span>
                  </p>
                </div>
              </div>
              <button
                onClick={handlePublish}
                disabled={isPublishing || isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {isPublishing
                  ? t("vstep.listening.actions.publishing")
                  : t("vstep.listening.actions.publish")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Part Tabs */}
      <div className="bg-white border-b border-gray-200 flex-shrink-0">
        <div className="max-w-[1800px] mx-auto px-6">
          <div className="flex gap-2 overflow-x-auto">
            {PART_LIST.map((pn) => {
              const layout = VSTEP_LISTENING_LAYOUT[pn as 1 | 2 | 3];
              const isActive = currentPart === pn;
              const isFilled = isPartFullyFilled(pn);
              const partData = parts.find((p) => p.partNumber === pn);
              const activeNums = activeSectionNumbers(pn);
              const savedCount = activeNums.filter((s) =>
                savedSections.has(sectionKey(pn, s))
              ).length;
              // Đếm theo section ĐANG SOẠN, không phải theo layout đầy đủ — đề bán
              // phần không nên bị hiển thị là "0/3" như thể đang thiếu.
              const totalQs = activeNums.length * layout.questionsPerSection;

              // Cảnh báo: có câu hỏi nhưng thiếu audio file
              const sectionsWithQs =
                partData?.sections.filter(
                  (s) =>
                    activeNums.includes(s.sectionNumber) &&
                    s.questions.some((q) => q.questionText.trim())
                ) || [];
              const missingAudioCount = sectionsWithQs.filter(
                (s) => !s.audioUrl || s.audioUrl.startsWith("blob:")
              ).length;
              const hasWarning = sectionsWithQs.length > 0 && missingAudioCount > 0;

              return (
                <button
                  key={pn}
                  onClick={() => setCurrentPart(pn as 1 | 2 | 3)}
                  className={`flex items-center gap-3 px-6 py-4 border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? "border-blue-600 text-blue-600 bg-blue-50"
                      : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  <Headphones className="w-5 h-5" />
                  <div className="text-left">
                    <div className="font-semibold flex items-center gap-1.5">
                      Part {pn}
                      {hasWarning && (
                        <span
                          title={`Thiếu audio cho ${missingAudioCount} section`}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-medium border border-amber-200"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          {missingAudioCount === sectionsWithQs.length
                            ? "Thiếu audio"
                            : `Thiếu ${missingAudioCount} audio`}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {activeNums.length === 0 ? (
                        <span className="text-gray-400">chưa thêm phần nào</span>
                      ) : (
                        <>
                          {savedCount}/{activeNums.length} phần đã lưu • {totalQs} câu
                        </>
                      )}
                    </div>
                  </div>
                  {isFilled && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content — section cards */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">{t("vstep.listening.loading")}</p>
            </div>
          </div>
        ) : (
          <div className={`max-w-[1400px] mx-auto px-6 py-6 ${isFullTest ? 'pb-32' : ''}`}>
            {/* Quick Presets for Single-Skill Listening */}
            {!isFullTest && (
              <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-3.5 mb-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-gray-900 block">
                      Chọn nhanh cấu trúc đề nghe:
                    </span>
                    <span className="text-[11px] text-gray-500">
                      Cho phép bạn tạo đề luyện tập theo từng phần nhỏ hoặc đề thi đầy đủ
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => applyPreset("part1")}
                    className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                      isPresetActive("part1")
                        ? "bg-blue-600 text-white shadow-xs font-semibold"
                        : "bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200"
                    }`}
                  >
                    Chỉ Part 1 (8 câu)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("part2")}
                    className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                      isPresetActive("part2")
                        ? "bg-blue-600 text-white shadow-xs font-semibold"
                        : "bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200"
                    }`}
                  >
                    Chỉ Part 2 (12 câu)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("part3")}
                    className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                      isPresetActive("part3")
                        ? "bg-blue-600 text-white shadow-xs font-semibold"
                        : "bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200"
                    }`}
                  >
                    Chỉ Part 3 (15 câu)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("full")}
                    className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                      isPresetActive("full")
                        ? "bg-blue-600 text-white shadow-xs font-semibold"
                        : "bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200"
                    }`}
                  >
                    Đầy đủ 3 Part (35 câu)
                  </button>
                </div>
              </div>
            )}

            {/* Part header + expand controls */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {currentLayout.partTitle}
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {currentLayout.partDesc} • Đang soạn{" "}
                    {activeSectionNumbers(currentPart).length}/
                    {currentLayout.sectionCount} phần •{" "}
                    {activeSectionNumbers(currentPart).length *
                      currentLayout.questionsPerSection}{" "}
                    câu hỏi
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <button
                    onClick={() => setAllExpanded(currentPart, true)}
                    className="text-blue-600 hover:underline"
                  >
                    Mở tất cả
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={() => setAllExpanded(currentPart, false)}
                    className="text-gray-600 hover:underline"
                  >
                    Thu gọn
                  </button>
                </div>
              </div>

              {/* Chọn phần cần soạn — Full Test luôn cần đủ 7 phần nên ẩn khối này */}
              {!isFullTest && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  {(() => {
                    const available = Array.from(
                      { length: currentLayout.sectionCount },
                      (_, i) => i + 1
                    ).filter((s) => !isSectionActive(currentPart, s));

                    if (available.length === 0) {
                      return (
                        <p className="text-xs text-gray-400">
                          Đã thêm toàn bộ {currentLayout.sectionCount} phần của
                          Part {currentPart}.
                        </p>
                      );
                    }

                    return (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-gray-500">
                          Thêm phần vào đề:
                        </span>
                        {available.map((s) => (
                          <button
                            key={s}
                            id={`add-listening-section-${currentPart}-${s}`}
                            onClick={() => addSection(currentPart, s)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-dashed border-blue-300 text-blue-600 text-xs font-medium hover:bg-blue-50 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                            {currentLayout.label} {s}
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Section Cards */}
            <div className="space-y-3">
              {activeSectionNumbers(currentPart).length === 0 && !isFullTest && (
                <div className="bg-white rounded-xl border border-dashed border-blue-200 p-8 text-center my-2 shadow-xs">
                  <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
                    <Headphones className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900">
                    {currentLayout.partTitle} chưa có phần nào trong đề
                  </h3>
                  <p className="text-sm text-gray-500 max-w-md mx-auto mt-1 mb-5">
                    Bạn có thể chọn thêm các phần của {currentLayout.partTitle} ({currentLayout.partDesc}) vào bài thi này.
                  </p>
                  <button
                    onClick={() => addSection(currentPart, 1)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    Bắt đầu soạn {currentLayout.label} 1
                  </button>
                </div>
              )}

              {currentPartData.sections
                .filter((section) =>
                  isSectionActive(currentPart, section.sectionNumber)
                )
                .map((section) => {
                const key = sectionKey(currentPart, section.sectionNumber);
                const isExpanded = expandedKeys.has(key);
                const isSaved = savedSections.has(key);
                const isUploading = uploadingKey === key;
                const isTranscribing = transcribingKey === key;
                const isSaving = savingKey === key;

                const filledQsCount = section.questions.filter(
                  (q) =>
                    q.questionText.trim() &&
                    q.options.A &&
                    q.options.B &&
                    q.options.C &&
                    q.options.D
                ).length;
                const totalQs = section.questions.length;
                const startQ = section.questions[0]?.questionNumber;
                const endQ =
                  section.questions[section.questions.length - 1]
                    ?.questionNumber;

                return (
                  <div
                    key={key}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
                  >
                    {/* Header — nút toggle và nút bỏ phần phải tách riêng vì HTML
                        không cho phép lồng <button> trong <button>. */}
                    <div className="flex items-center gap-1 pr-3 hover:bg-gray-50 transition-colors">
                      <button
                        onClick={() => toggleExpand(key)}
                        className="flex-1 flex items-center gap-3 p-4 text-left"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        )}
                        <FileAudio className="w-5 h-5 text-blue-600" />
                        <div className="flex-1 text-left">
                          <div className="font-semibold text-gray-900">
                            {section.sectionName}{" "}
                            <span className="text-gray-400 font-normal text-sm">
                              (Q{startQ}
                              {endQ !== startQ ? `-${endQ}` : ""})
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                            {section.audioUrl ? (
                              section.audioUrl.startsWith("blob:") ? (
                                <span className="text-amber-600">
                                  ⚠ Audio chưa lưu server
                                </span>
                              ) : (
                                <span className="text-green-600">✓ Audio OK</span>
                              )
                            ) : (
                              <span className="text-gray-400">Chưa có audio</span>
                            )}
                            <span className="text-gray-300">•</span>
                            <span>
                              {filledQsCount}/{totalQs} câu hoàn thành
                            </span>
                          </div>
                        </div>
                        {isSaved ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <span className="text-xs text-gray-400">Chưa lưu</span>
                        )}
                      </button>

                      {/* Full Test cần đủ 7 phần nên không cho bỏ phần ở chế độ đó */}
                      {!isFullTest && (
                        <button
                          id={`remove-listening-section-${currentPart}-${section.sectionNumber}`}
                          onClick={() =>
                            removeSection(currentPart, section.sectionNumber)
                          }
                          title={`Bỏ ${section.sectionName} khỏi đề`}
                          aria-label={`Bỏ ${section.sectionName} khỏi đề`}
                          className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Body — 2 cột: trái = audio+transcript, phải = questions */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 p-4">
                        <div className="grid grid-cols-1 lg:grid-cols-[40%_60%] gap-4 items-start">
                          {/* LEFT: Audio + Transcript stacked — sticky khi scroll questions */}
                          <div className="space-y-4 lg:sticky lg:top-4 self-start">
                          {/* Audio upload */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Audio file
                            </label>
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-500 transition-colors">
                              <input
                                type="file"
                                accept="audio/*"
                                onChange={(e) =>
                                  handleSectionAudioUpload(
                                    e,
                                    currentPart,
                                    section.sectionNumber
                                  )
                                }
                                className="hidden"
                                id={`audio-${key}`}
                              />
                              <label
                                htmlFor={`audio-${key}`}
                                className="cursor-pointer block"
                              >
                                <Upload className="w-8 h-8 mx-auto text-gray-400 mb-1" />
                                <p className="text-xs text-gray-600">
                                  Click để chọn file audio
                                </p>
                              </label>
                            </div>
                            {section.audioUrl && (
                              <div className="mt-3">
                                <audio
                                  key={section.audioUrl}
                                  controls
                                  className="w-full"
                                  src={section.audioUrl}
                                />
                                <div className="flex items-center gap-2 mt-1 text-xs flex-wrap">
                                  {section.audioDuration > 0 && (
                                    <span className="text-green-600">
                                      ✓{" "}
                                      {Math.floor(section.audioDuration / 60)}:
                                      {(section.audioDuration % 60)
                                        .toString()
                                        .padStart(2, "0")}
                                    </span>
                                  )}
                                  {isUploading && (
                                    <span className="flex items-center gap-1 text-blue-600">
                                      <Loader2 className="w-3 h-3 animate-spin" />{" "}
                                      Đang upload server...
                                    </span>
                                  )}
                                  {!isUploading &&
                                    section.audioUrl.startsWith("blob:") && (
                                      <span className="text-amber-600">
                                        ⚠ Chưa lưu server
                                      </span>
                                    )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Transcript */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="block text-sm font-medium text-gray-700">
                                Transcript (tùy chọn)
                              </label>
                              <button
                                type="button"
                                onClick={() =>
                                  handleManualTranscribe(
                                    currentPart,
                                    section.sectionNumber
                                  )
                                }
                                disabled={isTranscribing || !audioFiles[key]}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded hover:from-purple-600 hover:to-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed"
                                title={
                                  !audioFiles[key]
                                    ? "Upload audio trước"
                                    : "Transcribe lại bằng AI"
                                }
                              >
                                {isTranscribing ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin" />{" "}
                                    Đang transcribe...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-3 h-3" /> AI
                                    Transcribe
                                  </>
                                )}
                              </button>
                            </div>
                            <div className="relative">
                              <textarea
                                value={section.transcript}
                                onChange={(e) =>
                                  updateTranscript(
                                    currentPart,
                                    section.sectionNumber,
                                    e.target.value
                                  )
                                }
                                rows={6}
                                disabled={isTranscribing}
                                placeholder="Nhập transcript hoặc bấm AI Transcribe..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm leading-relaxed whitespace-pre-wrap focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                              />
                              {isTranscribing && (
                                <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-lg pointer-events-none">
                                  <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-full shadow-md">
                                    <Loader2 className="w-3 h-3 animate-spin text-purple-600" />
                                    <span className="text-xs text-gray-700">
                                      AI đang nghe...
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                          {/* RIGHT: Questions */}
                          <div className="space-y-2 pb-16">
                            <h4 className="text-sm font-semibold text-gray-700">
                              Câu hỏi (Q{startQ}
                              {endQ !== startQ ? `-${endQ}` : ""})
                            </h4>
                          {section.questions.map((q) => (
                            <div
                              key={q.id}
                              className="border border-gray-200 rounded-lg p-3"
                            >
                              <div className="flex items-start gap-2">
                                <div className="flex-shrink-0 w-7 h-7 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                                  {q.questionNumber}
                                </div>
                                <div className="flex-1 space-y-2">
                                  <RichTextInput
                                    value={q.questionText}
                                    onChange={(html) =>
                                      updateQuestion(
                                        currentPart,
                                        section.sectionNumber,
                                        q.id,
                                        "questionText",
                                        html
                                      )
                                    }
                                    onPaste={(event) =>
                                      handleQuestionPaste(
                                        event,
                                        currentPart,
                                        section.sectionNumber,
                                        q.id
                                      )
                                    }
                                    placeholder="Câu hỏi..."
                                  />
                                  {(["A", "B", "C", "D"] as const).map((opt) => (
                                    <div
                                      key={opt}
                                      className="flex items-center gap-2"
                                    >
                                      <input
                                        type="radio"
                                        name={`correct-${q.id}`}
                                        checked={q.correctAnswer === opt}
                                        onChange={() =>
                                          updateQuestion(
                                            currentPart,
                                            section.sectionNumber,
                                            q.id,
                                            "correctAnswer",
                                            opt
                                          )
                                        }
                                        className="w-4 h-4 accent-green-600"
                                      />
                                      <div className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center text-xs font-medium">
                                        {opt}
                                      </div>
                                      <input
                                        type="text"
                                        value={q.options[opt]}
                                        onChange={(e) =>
                                          updateOption(
                                            currentPart,
                                            section.sectionNumber,
                                            q.id,
                                            opt,
                                            e.target.value
                                          )
                                        }
                                        onPaste={(event) =>
                                          handleOptionsPaste(
                                            event,
                                            currentPart,
                                            section.sectionNumber,
                                            q.id
                                          )
                                        }
                                        onDoubleClick={() =>
                                          updateQuestion(
                                            currentPart,
                                            section.sectionNumber,
                                            q.id,
                                            "correctAnswer",
                                            opt
                                          )
                                        }
                                        placeholder={`Đáp án ${opt}`}
                                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                      />
                                    </div>
                                  ))}

                                  {/* Explanation (Optional) */}
                                  <textarea
                                    value={q.explanation || ""}
                                    onChange={(e) =>
                                      updateQuestion(
                                        currentPart,
                                        section.sectionNumber,
                                        q.id,
                                        "explanation",
                                        e.target.value
                                      )
                                    }
                                    placeholder="💡 Giải thích đáp án (tuỳ chọn) - học sinh xem lại sau khi làm bài..."
                                    rows={2}
                                    className="w-full mt-1 px-2 py-1.5 text-sm border border-amber-200 bg-amber-50/40 rounded focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-y"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                          </div>
                        </div>

                        {/* Save button — sticky bottom của section card (lift cao hơn khi Full Test có fixed bar) */}
                        <div className={`sticky ${isFullTest ? 'bottom-[72px]' : 'bottom-0'} -mx-4 -mb-4 mt-4 px-4 py-3 bg-white border-t border-gray-200 flex items-center justify-between gap-3 shadow-[0_-2px_8px_rgba(0,0,0,0.04)] z-10`}>
                          <div className="text-xs text-gray-500">
                            {!section.audioUrl && (
                              <span className="text-amber-600">⚠ Chưa có audio</span>
                            )}
                            {section.audioUrl?.startsWith("blob:") && (
                              <span className="text-amber-600">⚠ Audio đang upload server, đợi xong rồi save</span>
                            )}
                            {section.audioUrl && !section.audioUrl.startsWith("blob:") && filledQsCount === 0 && (
                              <span className="text-amber-600">⚠ Chưa có câu hỏi nào hoàn thành</span>
                            )}
                            {section.audioUrl && !section.audioUrl.startsWith("blob:") && filledQsCount > 0 && filledQsCount < totalQs && (
                              <span className="text-blue-600">{filledQsCount}/{totalQs} câu sẽ được lưu</span>
                            )}
                            {section.audioUrl && !section.audioUrl.startsWith("blob:") && filledQsCount === totalQs && (
                              <span className="text-emerald-600">✓ Sẵn sàng lưu — {totalQs} câu hoàn thành</span>
                            )}
                            {autoSavingKey === key && (
                              <span className="ml-2 text-blue-600 inline-flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" /> Đang tự động lưu...
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() =>
                              handleSaveSection(
                                currentPart,
                                section.sectionNumber
                              )
                            }
                            disabled={
                              isSaving ||
                              isUploading ||
                              !section.audioUrl ||
                              section.audioUrl.startsWith("blob:") ||
                              filledQsCount === 0
                            }
                            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                          >
                            {isSaving ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Save className="w-4 h-4" />
                            )}
                            {isSaving
                              ? "Đang lưu..."
                              : `Lưu ${section.sectionName}`}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
