import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { usePageTitle, PAGE_TITLES } from "../../../hooks/usePageTitle";
import { publicApi, type PublicTest } from "../../../services/publicApi";
import {
  StickyContactBar,
  Header,
  Footer,
  StatsSection,
  TestimonialsSection,
  ParticlesBackground,
  CourseTypesSection,
} from "./components";
import {
  ArrowRight,
  Clock,
  Award,
  MessageSquare,
  Trophy,
  Target,
  BookOpen,
  BarChart2,
  Zap,
  ChevronRight,
  Star,
  Users,
  GraduationCap,
  TrendingUp,
  Phone,
} from "lucide-react";

export function LandingPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  usePageTitle(PAGE_TITLES.LANDING);
  const [tests, setTests] = useState<PublicTest[]>([]);
  const [testsLoading, setTestsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setTestsLoading(true);
        const testsResult = await publicApi.getTests();
        setTests(testsResult.slice(0, 6));
      } finally {
        setTestsLoading(false);
      }
    };
    loadData();
  }, []);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "EducationalOrganization",
        "@id": "https://namthuedu.vn/#organization",
        "name": "NamThuEdu",
        "url": "https://namthuedu.vn",
        "logo": "https://namthuedu.vn/favicon.png",
        "description": "Nền tảng học tiếng Anh chuẩn VSTEP, IELTS và Cambridge tại Cần Thơ, Việt Nam.",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "Cần Thơ",
          "addressCountry": "VN"
        },
        "hasOfferCatalog": {
          "@type": "OfferCatalog",
          "name": "Khóa luyện thi tiếng Anh",
          "itemListElement": [
            { "@type": "Course", "name": "Luyện thi VSTEP B1–C1", "description": "Luyện thi chứng chỉ tiếng Anh quốc gia VSTEP" },
            { "@type": "Course", "name": "Luyện thi IELTS", "description": "Luyện thi IELTS 4 kỹ năng" },
            { "@type": "Course", "name": "Cambridge Young Learners", "description": "Starters, Movers, Flyers cho học sinh tiểu học" }
          ]
        }
      },
      {
        "@type": "WebSite",
        "@id": "https://namthuedu.vn/#website",
        "url": "https://namthuedu.vn",
        "name": "NamThuEdu",
        "inLanguage": "vi",
        "publisher": { "@id": "https://namthuedu.vn/#organization" },
        "potentialAction": {
          "@type": "SearchAction",
          "target": "https://namthuedu.vn/bai-viet?q={search_term_string}",
          "query-input": "required name=search_term_string"
        }
      }
    ]
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Helmet>
        <title>NamThuEdu — Học tiếng Anh thông minh hơn | VSTEP, IELTS, Cambridge</title>
        <meta name="description" content="NamThuEdu - Nền tảng học tiếng Anh chuẩn VSTEP, IELTS và Cambridge tại Cần Thơ. Luyện thi thông minh với AI chấm bài tự động." />
        <link rel="canonical" href="https://namthuedu.vn/" />
        <meta property="og:url" content="https://namthuedu.vn/" />
        <meta property="og:title" content="NamThuEdu — Học tiếng Anh thông minh hơn" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>
      <Header />

      <main>
        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-gradient-to-br from-orange-50 via-amber-50 to-white py-16 lg:py-24">
          {/* Particles background */}
          <div className="pointer-events-none absolute inset-0 z-0">
            <ParticlesBackground />
          </div>

          {/* Subtle background blobs (on top of particles) */}
          <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
            <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-orange-100 opacity-40 blur-3xl" />
            <div className="absolute -bottom-16 -left-16 h-72 w-72 rounded-full bg-amber-100 opacity-30 blur-3xl" />
          </div>

          <div className="relative z-10 mx-auto max-w-7xl px-4" style={{ zIndex: 10 }}>
            <div className="grid items-center gap-12 lg:grid-cols-2">

              {/* LEFT — Text + CTAs */}
              <div className="space-y-8">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700">
                  <TrendingUp className="h-4 w-4" />
                  {t('landing.guest.hero.badge')}
                </div>

                {/* Headline */}
                <h1 className="text-4xl font-extrabold leading-tight text-slate-900 lg:text-5xl xl:text-6xl" style={{ fontFamily: "'Playpen Sans', 'Baloo 2', cursive" }}>
                  {t('landing.guest.hero.headline')}{" "}
                  <span className="relative inline-block" style={{ color: "rgba(15,23,42,0.18)" }}>
                    {t('landing.guest.hero.headlineHighlight')}
                    {/* Orange text reveal overlay — clips left→right in sync with underline */}
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent whitespace-nowrap"
                      style={{
                        animation: "textRevealLoop 3.2s cubic-bezier(0.4,0,0.2,1) 0.3s infinite",
                      }}
                    >
                      {t('landing.guest.hero.headlineHighlight')}
                    </span>
                    {/* Underline SVG */}
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 220 10"
                      className="absolute -bottom-1 left-0 w-full"
                      preserveAspectRatio="none"
                    >
                      <path
                        d="M3 7 C45 2, 95 8, 140 5 C170 3, 195 7, 217 4"
                        stroke="#F97316"
                        strokeWidth="2.5"
                        fill="none"
                        strokeLinecap="round"
                        style={{
                          strokeDasharray: 300,
                          strokeDashoffset: 300,
                          animation: "drawUnderlineLoop 3.2s cubic-bezier(0.4,0,0.2,1) 0.3s infinite",
                        }}
                      />
                    </svg>
                    <style>{`
                      @keyframes drawUnderlineLoop {
                        0%   { stroke-dashoffset: 300; opacity: 0.8; }
                        40%  { stroke-dashoffset: 0;   opacity: 0.8; }
                        70%  { stroke-dashoffset: 0;   opacity: 0.8; }
                        88%  { stroke-dashoffset: 0;   opacity: 0; }
                        100% { stroke-dashoffset: 300; opacity: 0; }
                      }
                      @keyframes textRevealLoop {
                        0%   { clip-path: inset(0 100% 0 0); opacity: 1; }
                        40%  { clip-path: inset(0 0% 0 0);   opacity: 1; }
                        70%  { clip-path: inset(0 0% 0 0);   opacity: 1; }
                        88%  { clip-path: inset(0 0% 0 0);   opacity: 0; }
                        100% { clip-path: inset(0 100% 0 0); opacity: 0; }
                      }
                    `}</style>
                  </span>
                  <br />
                  {t('landing.guest.hero.headlineLine2')}
                </h1>

                {/* Sub-headline */}
                <p className="max-w-lg text-lg leading-relaxed text-slate-600">
                  {t('landing.guest.hero.subheadline')}
                </p>

                {/* CTA Buttons */}
                <div className="flex flex-col gap-4 sm:flex-row">
                  <button
                    onClick={() => navigate("/dang-nhap")}
                    className="cursor-pointer relative overflow-hidden group flex items-center justify-center gap-2 rounded-xl border-2 border-orange-500 bg-gradient-to-r from-orange-500 to-amber-500 px-8 py-4 text-base font-bold text-white shadow-lg transition-all duration-200 hover:shadow-xl"
                  >
                    <span className="absolute inset-0 bg-white -translate-x-full group-hover:translate-x-0 transition-transform duration-300 ease-in-out" />
                    <span className="relative z-10 flex items-center gap-2 group-hover:text-orange-600 transition-colors duration-300">
                      {t('landing.guest.hero.ctaStart')}
                      <ArrowRight className="h-5 w-5" />
                    </span>
                  </button>
                  <a
                    href="#tests"
                    className="cursor-pointer relative overflow-hidden group flex items-center justify-center gap-2 rounded-xl border-2 border-orange-400 bg-white px-8 py-4 text-base font-bold text-orange-600 shadow-sm transition-all duration-200"
                  >
                    <span className="absolute inset-0 bg-gradient-to-r from-orange-500 to-amber-500 -translate-x-full group-hover:translate-x-0 transition-transform duration-300 ease-in-out" />
                    <span className="relative z-10 group-hover:text-white transition-colors duration-300">
                      {t('landing.guest.hero.ctaTests')}
                    </span>
                  </a>
                </div>

                {/* Slogan — classic bordered ribbon */}
                <div className="inline-flex items-center gap-0 self-start rounded-full border border-amber-200 bg-white/80 px-1 py-1 shadow-sm backdrop-blur-sm">
                  {/* Left decorative line */}
                  <span className="ml-3 mr-2 hidden h-px w-5 bg-gradient-to-r from-transparent to-amber-400 sm:block" />

                  {(['p1', 'p2', 'p3'] as const).map((key, idx) => (
                    <React.Fragment key={key}>
                      <span className="px-3 text-xs font-semibold tracking-widest text-amber-800 uppercase" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                        {t(`landing.guest.hero.slogan.${key}`)}
                      </span>
                      {idx < 2 && (
                        <span className="text-[10px] text-amber-400 select-none">◆</span>
                      )}
                    </React.Fragment>
                  ))}

                  {/* Right decorative line */}
                  <span className="ml-2 mr-3 hidden h-px w-5 bg-gradient-to-l from-transparent to-amber-400 sm:block" />
                </div>
              </div>

              {/* RIGHT — Visual stack */}
              <div className="relative flex justify-center lg:justify-end">
                {/* Depth layer card (behind) */}
                <div className="absolute right-2 top-6 h-[480px] w-72 rotate-3 rounded-3xl bg-orange-200/40 lg:right-0 lg:w-80" />

                {/* Main app-preview card */}
                <div className="relative w-72 overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-2xl lg:w-80">
                  {/* Card header */}
                  <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                        <GraduationCap className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">NamThuEdu</p>
                        <p className="text-xs text-orange-100">{t('landing.guest.previewCard.subtitle')}</p>
                      </div>
                    </div>
                  </div>

                  {/* Progress bars */}
                  <div className="space-y-4 p-5">
                    {[
                      { label: "VSTEP B2 — Reading", pct: 82 },
                      { label: "VSTEP B2 — Listening", pct: 68 },
                      { label: "IELTS — Writing", pct: 55 },
                    ].map(({ label, pct }) => (
                      <div key={label}>
                        <div className="mb-1.5 flex justify-between text-xs font-medium text-slate-600">
                          <span>{label}</span>
                          <span className="font-bold text-orange-600">{pct}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-orange-100">
                          <div
                            className="h-2 rounded-full bg-gradient-to-r from-orange-400 to-amber-400"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    ))}

                    {/* Motivational streak banner */}
                    <div className="mt-3 flex items-center gap-3 rounded-xl border border-orange-100 bg-gradient-to-r from-orange-50 to-amber-50 p-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-amber-500 text-lg shadow-sm">
                        🔥
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-orange-600">Luyện tập mỗi ngày</p>
                        <p className="truncate text-xs text-slate-500">Tiến bộ rõ rệt sau mỗi buổi học</p>
                      </div>
                      <TrendingUp className="h-4 w-4 flex-shrink-0 text-orange-400" />
                    </div>
                  </div>

                  {/* Role selector */}
                  <div className="space-y-2 px-5 pb-5">
                    <button
                      onClick={() => navigate("/dang-nhap")}
                      className="group cursor-pointer flex w-full items-center gap-3 rounded-xl border-2 border-blue-100 bg-blue-50 p-3 text-left transition-all duration-200 hover:border-blue-300 hover:bg-blue-100 hover:scale-[1.02] hover:shadow-md active:scale-[0.98]"
                    >
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 transition-transform duration-200 group-hover:scale-110">
                        <Users className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 transition-transform duration-200 group-hover:translate-x-0.5">
                        <p className="text-sm font-bold text-blue-700">{t('landing.guest.previewCard.studentTitle')}</p>
                        <p className="text-xs text-slate-500">{t('landing.guest.previewCard.studentDesc')}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-blue-400 transition-transform duration-200 group-hover:translate-x-1" />
                    </button>
                    <button
                      onClick={() => navigate("/giao-vien/dang-nhap")}
                      className="group cursor-pointer flex w-full items-center gap-3 rounded-xl border-2 border-purple-100 bg-purple-50 p-3 text-left transition-all duration-200 hover:border-purple-300 hover:bg-purple-100 hover:scale-[1.02] hover:shadow-md active:scale-[0.98]"
                    >
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 transition-transform duration-200 group-hover:scale-110">
                        <GraduationCap className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 transition-transform duration-200 group-hover:translate-x-0.5">
                        <p className="text-sm font-bold text-purple-700">{t('landing.guest.previewCard.teacherTitle')}</p>
                        <p className="text-xs text-slate-500">{t('landing.guest.previewCard.teacherDesc')}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-purple-400 transition-transform duration-200 group-hover:translate-x-1" />
                    </button>
                  </div>
                </div>


                {/* Floating badge — Rating */}
                <div className="absolute -right-4 bottom-1/4 hidden items-center gap-2 rounded-2xl border border-amber-100 bg-white px-4 py-3 shadow-xl lg:flex">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500">
                    <Star className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">4.9 / 5</p>
                    <p className="text-xs text-slate-500">{t('landing.guest.previewCard.badgeRatingLabel')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── STATS ────────────────────────────────────────────────────────── */}
        <StatsSection />

        {/* ── COURSES ──────────────────────────────────────────────────────── */}
        <div id="khoa-hoc">
          <CourseTypesSection />
        </div>

        {/* ── TESTS ────────────────────────────────────────────────────────── */}
        <section id="tests" className="bg-gray-50 px-4 py-16">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 text-center">
              <h2 className="text-3xl font-bold text-slate-900">
                {t('landing.guest.tests.title')}
              </h2>
              <p className="mt-3 text-lg text-slate-600">
                {t('landing.guest.tests.subtitle')}
              </p>
            </div>

            {testsLoading ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-slate-500">
                {t('landing.guest.tests.loading')}
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {tests.map((test) => (
                  <div
                    key={test.id}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
                  >
                    <div>
                      <div className="mb-4 flex items-center gap-2">
                        <span className="rounded-lg bg-orange-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-orange-700">
                          {test.type || "VSTEP"}
                        </span>
                        <span className="rounded-lg bg-blue-50 px-3 py-1 text-xs font-semibold capitalize text-blue-600">
                          {test.skill || "Mixed"}
                        </span>
                      </div>
                      <h3 className="mb-2 line-clamp-2 text-xl font-bold text-slate-800">
                        {test.title}
                      </h3>
                      <p className="mb-6 line-clamp-2 text-sm text-slate-600">
                        {test.description || t('landing.guest.tests.defaultDesc')}
                      </p>
                    </div>

                    <div className="mt-auto">
                      <div className="mb-6 flex items-center gap-6 text-sm font-medium text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Clock className="size-4 text-orange-500" />
                          <span>{test.duration} phút</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Award className="size-4 text-amber-500" />
                          <span>{test.total_score} điểm</span>
                        </div>
                      </div>

                      <button
                        onClick={() => navigate("/dang-nhap")}
                        className="cursor-pointer flex w-full items-center justify-center gap-2 rounded-xl bg-slate-50 py-3 text-sm font-bold text-orange-600 transition-all duration-200 hover:bg-orange-50 group-hover:bg-orange-500 group-hover:text-white"
                      >
                        {t('landing.guest.tests.cta')}
                        <ArrowRight className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── FEATURES ─────────────────────────────────────────────────────── */}
        <section id="features" className="bg-white px-4 py-12">
          <div className="mx-auto max-w-5xl">
            <div className="mb-10 text-center">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-orange-500">{t('landing.guest.features.title')}</p>
              <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">{t('landing.guest.features.subtitle')}</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {([
                { icon: BookOpen,      color: "bg-orange-50 text-orange-500", key: "exam" },
                { icon: BarChart2,     color: "bg-purple-50 text-purple-500", key: "progress" },
                { icon: Zap,           color: "bg-rose-50 text-rose-500",    key: "grading" },
              ] as { icon: React.ElementType; color: string; key: string }[]).map(({ icon: Icon, color, key }) => (
                <div
                  key={key}
                  className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md"
                >
                  <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mb-1.5 text-base font-semibold text-slate-900">{t(`landing.guest.features.items.${key}.title`)}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{t(`landing.guest.features.items.${key}.desc`)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA BANNER ───────────────────────────────────────────────────── */}
        <section className="bg-gray-950 px-4 py-12">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-orange-400">NamThuEdu</p>
            <h2 className="mb-3 text-2xl font-bold text-white md:text-3xl">
              {t('landing.guest.ctaBanner.title')}
            </h2>
            <p className="mb-8 text-sm text-gray-400">
              {t('landing.guest.ctaBanner.subtitle')}
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <button
                onClick={() => navigate("/dang-nhap")}
                className="cursor-pointer relative overflow-hidden group flex items-center gap-2 rounded-xl border-2 border-orange-500 bg-orange-500 px-7 py-3 text-sm font-semibold text-white transition-all duration-200 hover:shadow-lg hover:shadow-orange-900/30"
              >
                <span className="absolute inset-0 bg-white -translate-x-full group-hover:translate-x-0 transition-transform duration-300 ease-in-out" />
                <span className="relative z-10 flex items-center gap-2 group-hover:text-orange-600 transition-colors duration-300">
                  {t('landing.guest.ctaBanner.cta')}
                  <ArrowRight className="h-4 w-4" />
                </span>
              </button>
              <a
                href="tel:0776818160"
                className="cursor-pointer relative overflow-hidden group flex items-center gap-2 rounded-xl border border-gray-600 bg-transparent px-7 py-3 text-sm font-medium text-gray-300 transition-all duration-200"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-orange-500 to-amber-500 -translate-x-full group-hover:translate-x-0 transition-transform duration-300 ease-in-out" />
                <span className="relative z-10 flex items-center gap-2 group-hover:text-white transition-colors duration-300">
                  <Phone className="h-4 w-4" />
                  {t('landing.guest.ctaBanner.ctaContact')}
                </span>
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      <StickyContactBar onRegisterConsult={() => navigate("/dang-ky")} />
    </div>
  );
}
