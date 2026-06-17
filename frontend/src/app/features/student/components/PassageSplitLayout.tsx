import type { ReactNode } from "react";
import { BookOpen } from "lucide-react";

type PassageSplitTone = "blue" | "emerald" | "teal" | "slate";

interface PassageSplitLayoutProps {
  passageTitle: ReactNode;
  passageSubtitle?: ReactNode;
  passageHtml?: string;
  passageContent?: ReactNode;
  questionsTitle: ReactNode;
  questionsSubtitle?: ReactNode;
  questionsHeaderExtra?: ReactNode;
  questionsContent: ReactNode;
  className?: string;
  gridClassName?: string;
  heightClassName?: string;
  passageBodyClassName?: string;
  questionsBodyClassName?: string;
  tone?: PassageSplitTone;
}

const toneClasses: Record<PassageSplitTone, { icon: string; passageHeader: string; questionHeader: string }> = {
  blue: {
    icon: "text-blue-600",
    passageHeader: "from-blue-50 to-white",
    questionHeader: "from-slate-50 to-white",
  },
  emerald: {
    icon: "text-emerald-600",
    passageHeader: "from-emerald-50 to-white",
    questionHeader: "from-slate-50 to-white",
  },
  teal: {
    icon: "text-teal-600",
    passageHeader: "from-teal-50 to-white",
    questionHeader: "from-slate-50 to-white",
  },
  slate: {
    icon: "text-slate-600",
    passageHeader: "from-slate-50 to-white",
    questionHeader: "from-slate-50 to-white",
  },
};

export function PassageSplitLayout({
  passageTitle,
  passageSubtitle,
  passageHtml,
  passageContent,
  questionsTitle,
  questionsSubtitle,
  questionsHeaderExtra,
  questionsContent,
  className = "",
  gridClassName = "grid-cols-1 lg:grid-cols-2",
  heightClassName = "h-[calc(100vh-12rem)]",
  passageBodyClassName = "",
  questionsBodyClassName = "",
  tone = "blue",
}: PassageSplitLayoutProps) {
  const toneClass = toneClasses[tone];

  return (
    <div className={`${className}`}>
      <div className={`grid ${gridClassName} gap-4 ${heightClassName}`}>
        <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col min-h-0">
          <div className={`px-5 py-3 border-b border-slate-100 bg-gradient-to-r ${toneClass.passageHeader}`}>
            <div className="flex items-center gap-2 mb-0.5">
              <BookOpen className={`w-4 h-4 ${toneClass.icon}`} />
              <h2 className="text-sm font-bold text-slate-900">{passageTitle}</h2>
            </div>
            {passageSubtitle && <div className="text-xs text-slate-700">{passageSubtitle}</div>}
          </div>
          {passageContent ?? (
            <div className={`flex-1 overflow-y-auto px-6 py-4 ${passageBodyClassName}`}>
              <article
                className="prose prose-sm max-w-none text-slate-800 leading-relaxed [&>p]:mb-4"
                dangerouslySetInnerHTML={{ __html: passageHtml || "<p><em>No passage</em></p>" }}
              />
            </div>
          )}
        </section>

        <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col min-h-0">
          <div className={`px-5 py-3 border-b border-slate-100 bg-gradient-to-r ${toneClass.questionHeader} flex items-center justify-between gap-3`}>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900">{questionsTitle}</h3>
              {questionsSubtitle && <div className="text-xs text-slate-500 mt-0.5">{questionsSubtitle}</div>}
            </div>
            {questionsHeaderExtra}
          </div>
          <div className={`flex-1 overflow-y-auto px-4 py-4 ${questionsBodyClassName}`}>
            {questionsContent}
          </div>
        </section>
      </div>
    </div>
  );
}
