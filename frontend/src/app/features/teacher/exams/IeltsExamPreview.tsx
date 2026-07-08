/**
 * IELTS Exam Preview (teacher view).
 *
 * Loads the same exam data the student sees, but renders a read-only preview
 * with all 4 skills (Listening / Reading / Writing / Speaking) and shows
 * correct answers when available — useful for grading reference.
 *
 * Routes: /giao-vien/de-thi/:examId/ielts
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ArrowLeft, Headphones, BookOpen, PenLine, Mic, FileText, Loader2,
  Volume2, Eye, ChevronRight, AlertCircle, CheckCircle2,
} from "lucide-react";
import { studentApi } from "../../../../services/studentApi";
import { api } from "../../../../services/api";
import { RichText } from "../../../../components/ui/RichText";

type Skill = "listening" | "reading" | "writing" | "speaking";

const SKILL_META: Record<Skill, { label: string; icon: typeof Headphones; color: string; bg: string }> = {
  listening: { label: "Listening", icon: Headphones, color: "#0EA5E9", bg: "#E0F2FE" },
  reading:   { label: "Reading",   icon: BookOpen,   color: "#10B981", bg: "#D1FAE5" },
  writing:   { label: "Writing",   icon: PenLine,    color: "#F59E0B", bg: "#FEF3C7" },
  speaking:  { label: "Speaking",  icon: Mic,        color: "#EC4899", bg: "#FCE7F3" },
};

export function IeltsExamPreview() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();

  const [activeSkill, setActiveSkill] = useState<Skill>("listening");
  const [data, setData] = useState<Record<Skill, any>>({
    listening: null, reading: null, writing: null, speaking: null,
  });
  const [loading, setLoading] = useState<Record<Skill, boolean>>({
    listening: false, reading: false, writing: false, speaking: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [examTitle, setExamTitle] = useState("Loading…");
  const [testType, setTestType] = useState("Academic");

  // Load skill data on demand
  useEffect(() => {
    const id = Number(examId);
    if (!id || data[activeSkill]) return;

    const loaders: Record<Skill, (id: number) => Promise<any>> = {
      listening: (id) => api.get(`/teacher/exams/${id}/ielts/listening`),
      reading:   (id) => api.get(`/teacher/exams/${id}/ielts/reading`),
      writing:   (id) => api.get(`/teacher/exams/${id}/ielts/writing`),
      speaking:  (id) => api.get(`/teacher/exams/${id}/ielts/speaking`),
    };

    setLoading((prev) => ({ ...prev, [activeSkill]: true }));
    loaders[activeSkill](id)
      .then((res: any) => {
        const payload = res.data?.data ?? res.data;
        setData((prev) => ({ ...prev, [activeSkill]: payload }));
        if (payload?.title) setExamTitle(payload.title);
        if (payload?.testType) setTestType(payload.testType);
      })
      .catch((err: any) => {
        setError(err?.response?.data?.message ?? err?.message ?? "Failed to load skill data");
      })
      .finally(() => setLoading((prev) => ({ ...prev, [activeSkill]: false })));
  }, [activeSkill, examId, data]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="px-2 py-0.5 rounded-md bg-red-100 text-red-700 text-[10px] font-bold uppercase tracking-wider">
                  IELTS
                </span>
                <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
                  {testType}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider">
                  Preview
                </span>
              </div>
              <h1 className="text-base font-bold text-slate-900 truncate">{examTitle}</h1>
            </div>
          </div>
          <div className="text-xs text-slate-500 hidden md:block">
            <Eye className="w-3.5 h-3.5 inline mr-1" />
            Read-only preview
          </div>
        </div>

        {/* Skill tabs */}
        <div className="px-6 flex items-center gap-1 overflow-x-auto">
          {(Object.keys(SKILL_META) as Skill[]).map((sk) => {
            const meta = SKILL_META[sk];
            const Icon = meta.icon;
            const active = activeSkill === sk;
            return (
              <button
                key={sk}
                type="button"
                onClick={() => setActiveSkill(sk)}
                className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? "text-slate-900"
                    : "text-slate-500 hover:text-slate-800 border-transparent"
                }`}
                style={active ? { borderColor: meta.color, color: meta.color } : undefined}
              >
                <Icon className="w-4 h-4" />
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-4 py-5">
        {loading[activeSkill] && (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-2" />
            <p className="text-sm text-slate-500">Loading {SKILL_META[activeSkill].label}…</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-red-900">Error loading skill</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {!loading[activeSkill] && data[activeSkill] && (
          <SkillPreview skill={activeSkill} payload={data[activeSkill]} />
        )}
      </div>
    </div>
  );
}

// ─── Per-skill preview ───────────────────────────────────────────────────────
function SkillPreview({ skill, payload }: { skill: Skill; payload: any }) {
  if (skill === "listening") return <ListeningPreview payload={payload} />;
  if (skill === "reading") return <ReadingPreview payload={payload} />;
  if (skill === "writing") return <WritingPreview payload={payload} />;
  if (skill === "speaking") return <SpeakingPreview payload={payload} />;
  return null;
}

function ListeningPreview({ payload }: { payload: any }) {
  const sections = payload?.sections ?? [];
  return (
    <div className="space-y-4">
      {sections.map((sec: any) => (
        <div key={sec.sectionNumber} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-sky-50 to-white">
            <div className="flex items-center gap-2 mb-0.5">
              <Headphones className="w-4 h-4 text-sky-600" />
              <h2 className="text-sm font-bold text-slate-900">{sec.sectionName}</h2>
              <span className="ml-auto text-xs text-slate-500">
                Q{sec.questionStart}–Q{sec.questionStart + sec.questionsPerSection - 1}
              </span>
            </div>
          </div>
          <div className="p-5 space-y-3">
            {sec.audioUrl ? (
              <audio controls src={sec.audioUrl} className="w-full" preload="none" />
            ) : (
              <div className="text-sm italic text-slate-400">No audio uploaded for this section.</div>
            )}

            {sec.questions?.length === 0 && (
              <div className="text-sm italic text-slate-400">No questions yet.</div>
            )}
            {sec.questions?.map((q: any) => (
              <PreviewQuestionRow key={q.qId} q={q} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReadingPreview({ payload }: { payload: any }) {
  const passages = payload?.passages ?? [];
  return (
    <div className="space-y-4">
      {passages.map((p: any) => (
        <div key={p.passageNumber} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white">
            <div className="flex items-center gap-2 mb-0.5">
              <BookOpen className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-900">{p.passageName}</h2>
              {p.title && <span className="text-xs italic text-slate-600">— {p.title}</span>}
              <span className="ml-auto text-xs text-slate-500">
                Q{p.questionStart}–Q{p.questionEnd}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-x divide-slate-100">
            <div className="px-5 py-4 max-h-[600px] overflow-y-auto prose prose-sm">
              <div dangerouslySetInnerHTML={{ __html: p.body || "<p><em>No passage</em></p>" }} />
            </div>
            <div className="px-4 py-4 max-h-[600px] overflow-y-auto space-y-3">
              {p.questions?.length === 0 && (
                <div className="text-sm italic text-slate-400">No questions yet.</div>
              )}
              {p.questions?.map((q: any) => (
                <PreviewQuestionRow key={q.qId} q={q} />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function WritingPreview({ payload }: { payload: any }) {
  const tasks = payload?.tasks ?? [];
  return (
    <div className="space-y-4">
      {tasks.length === 0 && (
        <div className="text-sm italic text-slate-400 text-center py-8">No writing tasks configured.</div>
      )}
      {tasks.map((t: any) => (
        <div key={t.taskNumber} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-amber-50 to-white">
            <div className="flex items-center gap-2 mb-0.5">
              <PenLine className="w-4 h-4 text-amber-600" />
              <h2 className="text-sm font-bold text-slate-900">{t.taskName}</h2>
              {t.tone && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-100 text-purple-700">{t.tone}</span>}
              {t.chartType && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-700">{t.chartType}</span>}
              {t.essayType && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-700">{t.essayType}</span>}
              <span className="ml-auto text-xs text-slate-500">≥{t.minWords} words · ~{t.recommendedMinutes} min</span>
            </div>
          </div>
          <div className="p-5 space-y-3">
            {t.imageUrl && (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <img src={t.imageUrl} alt={`Task ${t.taskNumber}`} className="w-full h-auto" />
              </div>
            )}
            <div
              className="prose prose-sm max-w-none text-slate-800 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: t.prompt || "<p><em>No prompt</em></p>" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function SpeakingPreview({ payload }: { payload: any }) {
  const parts = payload?.parts ?? [];
  return (
    <div className="space-y-4">
      {parts.length === 0 && (
        <div className="text-sm italic text-slate-400 text-center py-8">No speaking parts configured.</div>
      )}
      {parts.map((p: any) => (
        <div key={p.partNumber} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-pink-50 to-white">
            <div className="flex items-center gap-2 mb-0.5">
              <Mic className="w-4 h-4 text-pink-600" />
              <h2 className="text-sm font-bold text-slate-900">{p.partName}</h2>
              <span className="ml-auto text-xs text-slate-500">~{p.recommendedMinutes} min</span>
            </div>
          </div>
          <div className="p-5">
            {p.partNumber === 2 && p.cueCard ? (
              <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-pink-700 mb-2">Cue Card</div>
                <p className="text-base font-semibold text-slate-900 mb-3">{p.cueCard.topic}</p>
                {p.cueCard.bullets?.length > 0 && (
                  <ul className="space-y-1.5 text-sm text-slate-700">
                    {p.cueCard.bullets.map((b: string, i: number) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-pink-500 font-bold mt-0.5">·</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : p.questions?.length > 0 ? (
              <ol className="space-y-2 text-sm text-slate-800 list-decimal pl-5">
                {p.questions.map((q: any, idx: number) => (
                  <li key={q.qId ?? idx} className="leading-relaxed">{q.text}</li>
                ))}
              </ol>
            ) : (
              <div className="text-sm italic text-slate-400">No questions yet.</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function PreviewQuestionRow({ q }: { q: any }) {
  const correctAnswer = q.data?.correct_answer ?? null;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-7 h-7 rounded-md bg-slate-900 text-white text-xs font-bold tabular-nums flex items-center justify-center">
          {q.questionNumber}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-slate-900 mb-1.5">{q.questionText ? <RichText text={q.questionText} /> : <em className="text-slate-400">No prompt</em>}</div>

          {/* Question type pill */}
          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-700 mb-1.5">
            {q.questionType.replace(/_/g, " ")}
          </span>

          {/* Options (MCQ) */}
          {q.options && (
            <div className="space-y-1 mt-1">
              {Object.entries(q.options).map(([k, v]: any) => (
                <div key={k} className={`text-xs flex items-start gap-1.5 ${
                  correctAnswer === k ? "text-emerald-700 font-semibold" : "text-slate-600"
                }`}>
                  <span className="font-bold">{k}.</span>
                  <RichText text={v} />
                  {correctAnswer === k && <CheckCircle2 className="w-3 h-3 mt-0.5 flex-shrink-0" />}
                </div>
              ))}
            </div>
          )}

          {/* Non-MCQ correct answer hint */}
          {!q.options && correctAnswer && (
            <div className="text-xs text-emerald-700 mt-1">
              <CheckCircle2 className="w-3 h-3 inline mr-1" />
              Đáp án: <span className="font-semibold">{correctAnswer}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default IeltsExamPreview;
