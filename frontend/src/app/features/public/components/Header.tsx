import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { GraduationCap, Phone, Mail, MapPin, Menu, X, ChevronDown, BookOpen, Zap, FileText, Info, HelpCircle, MessageCircle } from "lucide-react";

// Danh mục khóa học đầy đủ theo 3 nhóm học viên (người lớn / thiếu niên / trẻ em).
// Dùng chung cho dropdown desktop và submenu mobile.
const COURSE_GROUPS: {
  group: string;
  age: string;
  items: { label: string; desc: string }[];
}[] = [
  {
    group: "Người lớn",
    age: "18+ tuổi",
    items: [
      { label: "VSTEP", desc: "Chứng chỉ tiếng Anh quốc gia (B1–C1)" },
      { label: "IELTS", desc: "Chứng chỉ tiếng Anh quốc tế (Academic & General)" },
    ],
  },
  {
    group: "Thiếu niên",
    age: "13–17 tuổi",
    items: [
      { label: "Luyện thi THPT", desc: "Tiếng Anh thi Tốt nghiệp & xét tuyển ĐH" },
      { label: "IELTS Foundation", desc: "Nền tảng IELTS cho học sinh cấp 2–3" },
    ],
  },
  {
    group: "Trẻ em",
    age: "6–12 tuổi",
    items: [
      { label: "Cambridge Starters", desc: "Pre A1 — Khởi đầu (6–8 tuổi)" },
      { label: "Cambridge Movers", desc: "A1 — Tiến bộ (8–10 tuổi)" },
      { label: "Cambridge Flyers", desc: "A2 — Thành thạo (10–12 tuổi)" },
    ],
  },
];

export function Header() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const scrollToCourses = (e: React.MouseEvent) => {
    e.preventDefault();
    const performScroll = () =>
      document.getElementById('khoa-hoc')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (pathname === '/') {
      performScroll();
    } else {
      navigate('/');
      setTimeout(performScroll, 350);
    }
    setCoursesDropdownOpen(false);
  };

  const navItem = (path: string) =>
    `relative cursor-pointer pb-0.5 text-base font-medium transition-colors duration-200 hover:text-orange-600
    after:absolute after:bottom-0 after:left-0 after:h-[2px] after:bg-orange-500 after:transition-all after:duration-200
    ${
      pathname === path
        ? "text-orange-600 after:w-full"
        : "text-slate-700 after:w-0 hover:after:w-full"
    }`.replace(/\n\s+/g, " ").trim();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const openMobileMenu = () => {
    setMobileMenuOpen(true);
    window.dispatchEvent(new CustomEvent("mobileMenuChange", { detail: { open: true } }));
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    window.dispatchEvent(new CustomEvent("mobileMenuChange", { detail: { open: false } }));
  };
  const [coursesDropdownOpen, setCoursesDropdownOpen] = useState(false);
  const [mobileCoursesOpen, setMobileCoursesOpen] = useState(false);
  const loginAnim = useAnimation();

  useEffect(() => {
    const handler = (e: Event) => {
      const visible = (e as CustomEvent<{ visible: boolean }>).detail.visible;
      if (!visible) {
        loginAnim.start({
          scale: [1, 1.12, 0.96, 1.06, 1],
          transition: { duration: 0.55, ease: "easeInOut" },
        });
      }
    };
    window.addEventListener("blog-cta-visible", handler);
    return () => window.removeEventListener("blog-cta-visible", handler);
  }, [loginAnim]);

  return (
    <>
      {/* Top Bar - Contact & Social Proof */}
      <div className="border-b border-orange-100 bg-white">
        <div className="mx-auto flex h-9 max-w-7xl items-center justify-between px-4 text-xs text-slate-500">
          {/* Left: Contact */}
          <div className="hidden items-center gap-4 md:flex">
            <a
              href="tel:0776818160"
              className="flex items-center gap-1.5 font-medium transition-colors hover:text-orange-600"
            >
              <Phone className="h-3 w-3 text-orange-400" />
              <span>0776 818 160</span>
            </a>
          </div>

          {/* Right: Address */}
          <a
            href="https://maps.google.com/?q=Hẻm+387K1,+14B,+Trần+Nam+Phú,+Cần+Thơ"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 font-medium transition-colors hover:text-orange-600"
          >
            <MapPin className="h-3 w-3 flex-shrink-0 text-orange-400" />
            <span>Hẻm 387K1, 14B, Trần Nam Phú, Cần Thơ</span>
          </a>
        </div>
      </div>

      {/* Main Header - Sticky */}
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/95 backdrop-blur-sm shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          {/* Left: Logo + Brand */}
          <button
            onClick={() => navigate("/")}
            className="group flex cursor-pointer items-center gap-2.5 transition-all"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 shadow-sm transition-transform duration-200 group-hover:scale-105">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="relative text-[1.1rem] font-bold leading-tight text-slate-900 after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-0 after:bg-orange-500 after:transition-all after:duration-300 group-hover:after:w-full" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", fontWeight: 800, fontStyle: "italic", letterSpacing: "-0.02em" }}>
                NamThu<span className="text-orange-500">Edu</span>
              </span>
              <span className="hidden text-[10px] leading-none text-slate-400 sm:block">Học thông minh hơn</span>
            </div>
          </button>

          {/* Center: Navigation (Desktop only) */}
          <nav className="hidden items-center gap-8 lg:flex">
            {/* Courses Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setCoursesDropdownOpen(true)}
              onMouseLeave={() => setCoursesDropdownOpen(false)}
            >
              <a
                href="#khoa-hoc"
                onClick={scrollToCourses}
                className="flex cursor-pointer items-center gap-1 text-base font-medium text-slate-700 transition-colors duration-200 hover:text-orange-600"
              >
                Khóa học
                <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${coursesDropdownOpen ? 'rotate-180' : ''}`} />
              </a>

              {/* Dropdown Menu — đầy đủ khóa học theo 3 nhóm học viên */}
              {coursesDropdownOpen && (
                <div className="absolute left-1/2 -translate-x-1/2 top-full pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="w-[720px] max-w-[92vw] rounded-2xl bg-white shadow-xl ring-1 ring-black/5 overflow-hidden">
                    <div className="grid grid-cols-3 divide-x divide-slate-100">
                      {COURSE_GROUPS.map((grp) => (
                        <div key={grp.group} className="p-4">
                          <div className="mb-2 flex items-baseline justify-between px-1">
                            <span className="text-sm font-bold text-slate-800">{grp.group}</span>
                            <span className="text-[11px] font-medium text-orange-500">{grp.age}</span>
                          </div>
                          <div className="space-y-0.5">
                            {grp.items.map((item) => (
                              <a
                                key={item.label}
                                href="#khoa-hoc"
                                onClick={scrollToCourses}
                                className="block rounded-lg px-3 py-2 transition-all duration-200 hover:bg-orange-50"
                              >
                                <div className="text-sm font-semibold text-slate-700">{item.label}</div>
                                <div className="text-xs text-slate-500 leading-snug">{item.desc}</div>
                              </a>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => navigate("/tinh-nang")}
              className={navItem("/tinh-nang")}
            >
              Tính năng
            </button>
            <button
              onClick={() => navigate("/bai-viet")}
              className={navItem("/bai-viet")}
            >
              Bài viết
            </button>
            <button
              onClick={() => navigate("/ve-chung-toi")}
              className="relative cursor-pointer pb-0.5 text-base font-medium text-slate-700 transition-colors duration-200 hover:text-orange-600 after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-0 after:bg-orange-500 after:transition-all after:duration-200 hover:after:w-full"
            >
              Về chúng tôi
            </button>
          </nav>

          {/* Right: CTA Buttons */}
          <div className="flex items-center gap-3">
            {/* Mobile Menu Button */}
            <button
              onClick={() => openMobileMenu()}
              className="cursor-pointer rounded-lg p-2 transition-colors hover:bg-gray-100 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5 text-slate-700" />
            </button>

            {/* Desktop CTA — hidden on mobile */}
            <motion.button
              animate={loginAnim}
              data-blog-login="true"
              onClick={() => navigate("/dang-nhap")}
              className="hidden cursor-pointer relative overflow-hidden group rounded-xl border border-orange-300 bg-white px-5 py-2 text-sm font-semibold text-orange-600 transition-all duration-200 hover:border-orange-400 hover:text-orange-700 lg:block"
            >
              <span className="absolute inset-0 bg-orange-50 -translate-x-full group-hover:translate-x-0 transition-transform duration-300 ease-in-out" />
              <span className="relative z-10">Đăng nhập</span>
            </motion.button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence mode="wait">
      {mobileMenuOpen && (
        <motion.div
          key="mobile-menu-root"
          className="fixed inset-0 z-50 lg:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => closeMobileMenu()}
          />

          {/* Menu Panel — slides from left */}
          <motion.div
            key="drawer"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-105%" }}
            transition={{
              type: "spring",
              stiffness: 320,
              damping: 32,
              mass: 0.8,
            }}
            className="absolute left-0 top-0 h-full w-80 flex flex-col overflow-hidden shadow-2xl"
            style={{ background: "#EEF2FF" }}
          >
            {/* Brand Header */}
            <div
              className="flex items-center justify-between px-5 py-5"
              style={{ background: "linear-gradient(135deg, #E0E7FF 0%, #C7D2FE 100%)" }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 shadow-md">
                  <GraduationCap className="h-5 w-5 text-white" />
                </div>
                <div className="flex flex-col">
                  <span
                    className="text-[1.05rem] font-black leading-tight text-indigo-900"
                    style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", fontStyle: "italic", letterSpacing: "-0.02em" }}
                  >
                    NamThu<span className="text-orange-500">Edu</span>
                  </span>
                  <span className="text-[10px] leading-none text-indigo-400">Học thông minh hơn</span>
                </div>
              </div>
              <button
                onClick={() => closeMobileMenu()}
                className="cursor-pointer rounded-lg p-2 text-indigo-400 transition-colors hover:bg-indigo-100 hover:text-indigo-700"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Divider */}
            <div style={{ height: "1px", background: "rgba(99,102,241,0.15)" }} />

            {/* Navigation */}
            <nav className="flex flex-col flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
              {/* Courses with Submenu */}
              <div>
                <button
                  onClick={() => setMobileCoursesOpen(!mobileCoursesOpen)}
                  className="flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 font-medium text-indigo-900 transition-all duration-200 hover:bg-indigo-100"
                >
                  <span className="flex items-center gap-3">
                    <BookOpen className="h-4 w-4 text-orange-400 flex-shrink-0" />
                    <span>Khóa học</span>
                  </span>
                  <ChevronDown className={`h-4 w-4 text-indigo-400 transition-transform duration-300 ${mobileCoursesOpen ? "rotate-180" : ""}`} />
                </button>

                {/* Submenu — đầy đủ khóa học theo nhóm học viên */}
                {mobileCoursesOpen && (
                  <div className="ml-10 mt-0.5 space-y-2 animate-in slide-in-from-top-2 duration-200">
                    {COURSE_GROUPS.map((grp) => (
                      <div key={grp.group}>
                        <div className="flex items-baseline gap-2 px-3 pt-1.5 pb-0.5">
                          <span className="text-[11px] font-bold uppercase tracking-wide text-indigo-900">{grp.group}</span>
                          <span className="text-[10px] font-medium text-orange-500">{grp.age}</span>
                        </div>
                        {grp.items.map((item) => (
                          <a
                            key={item.label}
                            href="#khoa-hoc"
                            onClick={() => closeMobileMenu()}
                            className="block cursor-pointer rounded-lg px-3 py-2 text-sm transition-all duration-200 hover:bg-indigo-100 border-l-2 border-orange-400"
                          >
                            <div className="font-semibold text-indigo-800">{item.label}</div>
                            <div className="text-xs text-indigo-500 leading-snug">{item.desc}</div>
                          </a>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => { closeMobileMenu(); navigate("/tinh-nang"); }}
                className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left font-medium text-indigo-900 transition-all duration-200 hover:bg-indigo-100"
              >
                <Zap className="h-4 w-4 text-orange-500 flex-shrink-0" />
                <span>Tính năng</span>
              </button>
              <button
                onClick={() => { closeMobileMenu(); navigate("/bai-viet"); }}
                className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left font-medium text-indigo-900 transition-all duration-200 hover:bg-indigo-100"
              >
                <FileText className="h-4 w-4 text-orange-500 flex-shrink-0" />
                <span>Bài viết</span>
              </button>
              <button
                onClick={() => { closeMobileMenu(); navigate("/ve-chung-toi"); }}
                className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left font-medium text-indigo-900 transition-all duration-200 hover:bg-indigo-100"
              >
                <Info className="h-4 w-4 text-orange-500 flex-shrink-0" />
                <span>Về chúng tôi</span>
              </button>

              {/* Divider */}
              <div className="my-3" style={{ height: "1px", background: "rgba(99,102,241,0.15)" }} />

              {/* Secondary Links */}
              <a
                href="#help"
                onClick={() => closeMobileMenu()}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-indigo-500 transition-colors hover:bg-indigo-100 hover:text-indigo-800"
              >
                <HelpCircle className="h-4 w-4 flex-shrink-0" />
                <span>Trợ giúp</span>
              </a>
              <a
                href="#contact"
                onClick={() => closeMobileMenu()}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-indigo-500 transition-colors hover:bg-indigo-100 hover:text-indigo-800"
              >
                <MessageCircle className="h-4 w-4 flex-shrink-0" />
                <span>Liên hệ</span>
              </a>

              {/* Divider */}
              <div className="my-3" style={{ height: "1px", background: "rgba(99,102,241,0.15)" }} />

              {/* Contact Info */}
              <a
                href="tel:0776818160"
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-indigo-600 transition-colors hover:bg-indigo-100"
              >
                <Phone className="h-4 w-4 text-orange-500 flex-shrink-0" />
                <span>0776 818 160</span>
              </a>
              <a
                href="mailto:hello@namthu.vn"
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-indigo-600 transition-colors hover:bg-indigo-100"
              >
                <Mail className="h-4 w-4 text-orange-500 flex-shrink-0" />
                <span>hello@namthu.vn</span>
              </a>
            </nav>

            {/* CTA */}
            <div className="px-4 pb-6 pt-3" style={{ borderTop: "1px solid rgba(99,102,241,0.15)" }}>
              <button
                onClick={() => {
                  closeMobileMenu();
                  navigate("/dang-nhap");
                }}
                className="w-full cursor-pointer rounded-xl bg-orange-500 py-3 font-semibold text-white shadow-lg transition-all duration-200 hover:bg-orange-600 active:scale-95"
              >
                Đăng nhập
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </>
  );
}
