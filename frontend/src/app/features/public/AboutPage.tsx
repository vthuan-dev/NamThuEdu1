import { useNavigate } from "react-router";
import {
  GraduationCap,
  Users,
  Star,
  Target,
  Heart,
  Zap,
  Phone,
  ArrowRight,
  Quote,
  BookOpen,
  TrendingUp,
  Award,
} from "lucide-react";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { usePageTitle } from "../../../hooks/usePageTitle";

const stats = [
  { icon: Users,    value: "Nhiều học viên", label: "đã tin tưởng đồng hành" },
  { icon: Award,    value: "Nhiều năm",      label: "kinh nghiệm giảng dạy" },
  { icon: Star,     value: "Đánh giá cao",   label: "từ phụ huynh & học viên" },
  { icon: BookOpen, value: "3 chương trình", label: "VSTEP · IELTS · Thiếu niên" },
];

const values = [
  {
    Icon: Target,
    title: "Chất lượng",
    desc: "Đề thi sát chuẩn quốc gia và quốc tế. Hệ thống chấm điểm tự động kết hợp AI giúp học viên nhận phản hồi chính xác, kịp thời.",
  },
  {
    Icon: Heart,
    title: "Tận tâm",
    desc: "Đội ngũ giáo viên luôn đồng hành cùng học viên — theo dõi tiến độ, hỗ trợ cá nhân hóa và điều chỉnh lộ trình phù hợp từng người.",
  },
  {
    Icon: Zap,
    title: "Hiệu quả",
    desc: "Học đúng trọng tâm, luyện đúng dạng đề. Hệ thống gamification giúp duy trì động lực học tập mỗi ngày.",
  },
];

const commitments = [
  {
    Icon: GraduationCap,
    title: "Bám sát chuẩn chính thức",
    desc: "Đề thi được xây dựng theo đúng cấu trúc VSTEP, Cambridge YLE và IELTS — phản ánh sát định dạng bài thi thật.",
  },
  {
    Icon: Target,
    title: "Chấm điểm minh bạch",
    desc: "Mỗi bài làm có kết quả chi tiết từng câu, hiển thị rõ đúng/sai và đáp án chuẩn — không chấm cảm tính.",
  },
  {
    Icon: TrendingUp,
    title: "Lộ trình cá nhân hóa",
    desc: "Hệ thống theo dõi tiến độ và phân tích điểm yếu, gợi ý nội dung luyện tập phù hợp với từng học viên.",
  },
  {
    Icon: Heart,
    title: "Đồng hành tận tâm",
    desc: "Giáo viên hỗ trợ trực tiếp, phản hồi nhanh và sẵn sàng giải đáp trong suốt quá trình học.",
  },
];

const trustBadges = [
  { Icon: BookOpen, label: "Nội dung biên soạn bởi giáo viên giàu kinh nghiệm" },
  { Icon: Zap, label: "Cập nhật theo định dạng đề thi mới nhất" },
  { Icon: Award, label: "Thông tin học viên được bảo mật" },
];

export function AboutPage() {
  const navigate = useNavigate();
  usePageTitle("Về chúng tôi — NamThuEdu");

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      <main>
        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-gradient-to-br from-orange-50 via-amber-50 to-white px-4 py-16 lg:py-24">
          {/* Blobs */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-orange-100 opacity-40 blur-3xl" />
            <div className="absolute -bottom-10 -left-10 h-64 w-64 rounded-full bg-amber-100 opacity-30 blur-3xl" />
          </div>

          <div className="relative mx-auto max-w-4xl text-center">
            {/* Badge */}
            {/* <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-4 py-1.5 text-sm font-semibold text-orange-600 shadow-sm">
              <GraduationCap className="h-4 w-4" />
              Về chúng tôi
            </div> */}

            <h1 className="mb-5 text-4xl font-extrabold leading-tight text-slate-900 lg:text-5xl" style={{ fontFamily: "'Playpen Sans', 'Baloo 2', cursive" }}>
              NamThu Education —{" "}
              <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
                Đồng hành cùng bạn
              </span>
            </h1>

            <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-slate-600">
              Chúng tôi tin rằng mỗi người đều có thể chinh phục tiếng Anh — chỉ cần có đúng lộ trình, đúng công cụ và đúng người đồng hành.
            </p>

            {/* Stats chips */}
            <div className="flex flex-wrap items-center justify-center gap-4">
              {stats.map(({ icon: Icon, value, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-4 py-2.5 shadow-sm"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50">
                    <Icon className="h-4 w-4 text-orange-500" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-900">{value}</p>
                    <p className="text-xs text-slate-500">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── STORY ────────────────────────────────────────────────────────── */}
        <section className="px-4 py-16">
          <div className="mx-auto max-w-6xl">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              {/* Left — text */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-orange-500">
                  Câu chuyện của chúng tôi
                </p>
                <h2 className="mb-5 text-2xl font-bold text-slate-900 md:text-3xl">
                  Từ một ước mơ nhỏ đến hàng nghìn học viên
                </h2>
                <div className="space-y-4 text-sm leading-relaxed text-slate-600">
                  <p>
                    NamThu Education được thành lập với một mục tiêu giản dị: giúp người Việt học tiếng Anh đúng cách, không lãng phí thời gian và tiền bạc vào những phương pháp kém hiệu quả.
                  </p>
                  <p>
                    Chúng tôi bắt đầu từ những buổi học nhỏ, lắng nghe khó khăn thực sự của từng học viên — từ em học sinh tiểu học lần đầu tiếp xúc tiếng Anh, đến anh chị đi làm cần chứng chỉ VSTEP để thăng tiến.
                  </p>
                  <p>
                    Hôm nay, NamThuEdu là nền tảng học trực tuyến với hệ thống đề thi chuẩn, chấm điểm AI, và đội ngũ giáo viên tận tâm — tất cả trong một.
                  </p>
                </div>

                <div className="mt-6 flex items-center gap-3">
                  <div className="h-px flex-1 bg-gray-100" />
                  {/* <span className="text-xs text-slate-400">Thành lập từ 2019</span> */}
                  <div className="h-px flex-1 bg-gray-100" />
                </div>
              </div>

              {/* Right — quote card */}
              <div className="relative">
                <div className="rounded-2xl border border-orange-100 bg-orange-50 p-8">
                  <Quote className="mb-4 h-8 w-8 text-orange-300" />
                  <p className="mb-6 text-base leading-relaxed text-slate-700 italic">
                    "Học tiếng Anh không chỉ là học ngữ pháp hay từ vựng — đó là mở ra cánh cửa kết nối với cả thế giới. Chúng tôi ở đây để giúp bạn mở cánh cửa đó."
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-amber-500 text-sm font-bold text-white">
                      NT
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Thầy Nam</p>
                      <p className="text-xs text-slate-500">Sáng lập NamThu Education</p>
                    </div>
                  </div>
                </div>

                {/* Floating badge */}
                <div className="absolute -right-4 -top-4 hidden items-center gap-2 rounded-xl border border-amber-100 bg-white px-3 py-2 shadow-lg lg:flex">
                  <TrendingUp className="h-4 w-4 text-orange-500" />
                  <span className="text-xs font-semibold text-slate-700">Tăng trưởng mỗi năm</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── VALUES ───────────────────────────────────────────────────────── */}
        <section className="bg-slate-50 px-4 py-16">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 text-center">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-orange-500">
                Giá trị cốt lõi
              </p>
              <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">
                Những điều chúng tôi tin tưởng
              </h2>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {values.map(({ Icon, title, desc }) => (
                <div
                  key={title}
                  className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50">
                    <Icon className="h-5 w-5 text-orange-500" />
                  </div>
                  <h3 className="mb-2 text-base font-bold text-slate-900">{title}</h3>
                  <p className="text-sm leading-relaxed text-slate-500">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CAM KẾT & UY TÍN ─────────────────────────────────────────────── */}
        <section className="px-4 py-16">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 text-center">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-orange-500">
                Cam kết của chúng tôi
              </p>
              <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">
                Vì sao học viên tin tưởng NamThuEdu
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm text-slate-500">
                Chúng tôi đặt chất lượng học thuật và sự minh bạch lên hàng đầu — để mỗi giờ học của bạn đều thực sự hiệu quả.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {commitments.map(({ Icon, title, desc }) => (
                <div
                  key={title}
                  className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md"
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-orange-50">
                    <Icon className="h-5 w-5 text-orange-500" />
                  </div>
                  <h3 className="mb-2 text-base font-bold text-slate-900">{title}</h3>
                  <p className="text-sm leading-relaxed text-slate-500">{desc}</p>
                </div>
              ))}
            </div>

            {/* Trust strip */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {trustBadges.map(({ Icon, label }) => (
                <div
                  key={label}
                  className="inline-flex items-center gap-2.5 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-sm"
                >
                  <Icon className="h-4 w-4 flex-shrink-0 text-orange-500" />
                  <span className="text-xs font-medium text-slate-600">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA BANNER ───────────────────────────────────────────────────── */}
        <section className="bg-gray-950 px-4 py-14">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-orange-400">
              NamThuEdu
            </p>
            <h2 className="mb-3 text-2xl font-bold text-white md:text-3xl">
              Sẵn sàng bắt đầu hành trình của bạn?
            </h2>
            <p className="mb-8 text-sm text-gray-400">
              Đăng ký ngay hôm nay và nhận tư vấn lộ trình học miễn phí.
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <button
                onClick={() => navigate("/dang-nhap")}
                className="relative overflow-hidden group flex cursor-pointer items-center gap-2 rounded-xl border-2 border-orange-500 bg-orange-500 px-7 py-3 text-sm font-semibold text-white transition-all duration-200 hover:shadow-lg hover:shadow-orange-900/30"
              >
                <span className="absolute inset-0 bg-white -translate-x-full group-hover:translate-x-0 transition-transform duration-300 ease-in-out" />
                <span className="relative z-10 flex items-center gap-2 group-hover:text-orange-600 transition-colors duration-300">
                  Bắt đầu học ngay
                  <ArrowRight className="h-4 w-4" />
                </span>
              </button>
              <a
                href="tel:0776818160"
                className="relative overflow-hidden group flex cursor-pointer items-center gap-2 rounded-xl border border-gray-600 bg-transparent px-7 py-3 text-sm font-medium text-gray-300 transition-all duration-200"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-orange-500 to-amber-500 -translate-x-full group-hover:translate-x-0 transition-transform duration-300 ease-in-out" />
                <span className="relative z-10 flex items-center gap-2 group-hover:text-white transition-colors duration-300">
                  <Phone className="h-4 w-4" />
                  0776 818 160
                </span>
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
