import { Calendar, Clock3, BookOpen, CheckCircle2, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { studentApi } from "../../../../services/studentApi";

type ScheduleItem = {
  id: string;
  title: string;
  type: "lesson" | "test" | "practice";
  date: string;
  start: string;
  end: string;
  done?: boolean;
};

function normalize(items: any[]): ScheduleItem[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  return items.slice(0, 8).map((it, idx) => ({
    id: String(it.id ?? idx + 1),
    title: String(it.title ?? it.name ?? "Buổi học"),
    type: (it.type ?? "lesson") as "lesson" | "test" | "practice",
    date: String(it.date ?? "Sắp tới"),
    start: String(it.start ?? "19:00"),
    end: String(it.end ?? "19:45"),
    done: Boolean(it.done),
  }));
}

export function StudentSchedule() {
  const { data, isLoading } = useQuery({
    queryKey: ["student", "tests", "schedule"],
    queryFn: () => studentApi.getTests({ status: "pending" }),
  });

  const pending = (data as any)?.data?.data?.pending ?? [];
  const schedule = normalize(
    pending.map((t: any, idx: number) => ({
      id: t.assignment_id,
      title: t.exam_title,
      type: "test",
      date: idx === 0 ? "Hôm nay" : idx === 1 ? "Ngày mai" : "Tuần này",
      start: "19:00",
      end: "20:00",
      done: false,
    })),
  );

  if (isLoading) {
    return (
      <div className="py-6 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-2xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="py-4 sm:py-6 space-y-4 sm:space-y-5">
      <div className="rounded-3xl bg-white p-4 sm:p-6" style={{ border: "1.5px solid #E5E7EB" }}>
        <div className="flex items-center gap-2.5 sm:gap-3">
          <Calendar className="w-6 h-6 sm:w-7 sm:h-7 text-sky-600 flex-shrink-0" />
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800">Lịch học của tôi</h1>
        </div>
        <p className="text-sm text-slate-500 mt-2">Theo dõi buổi học, lịch luyện tập và bài thi sắp tới.</p>
      </div>

      {schedule.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center" style={{ border: "1.5px solid #F1F5F9" }}>
          <Calendar className="w-10 h-10 mx-auto text-gray-300 mb-2" />
          <p className="text-sm font-semibold text-slate-500">Không có bài thi hoặc buổi học nào sắp tới.</p>
        </div>
      ) : null}
      <div className="space-y-3">
        {schedule.map((item) => {
          const icon =
            item.type === "test" ? <AlertCircle className="w-5 h-5 text-rose-500" /> :
            item.type === "practice" ? <Clock3 className="w-5 h-5 text-amber-500" /> :
            <BookOpen className="w-5 h-5 text-indigo-500" />;

          return (
            <div key={item.id} className="rounded-2xl bg-white p-4" style={{ border: "1.5px solid #F1F5F9" }}>
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 truncate">{item.title}</p>
                  <p className="text-xs sm:text-sm text-slate-500">{item.date} • {item.start} - {item.end}</p>
                </div>
                {/* `flex-shrink-0` + `whitespace-nowrap`: không có hai thuộc tính
                    này thì chữ "Hoàn thành" bị ngắt thành hai dòng trên màn hẹp. */}
                {item.done ? (
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 flex-shrink-0 whitespace-nowrap">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Hoàn thành
                  </span>
                ) : (
                  <span className="text-xs font-bold text-sky-600 flex-shrink-0 whitespace-nowrap">Sắp tới</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

