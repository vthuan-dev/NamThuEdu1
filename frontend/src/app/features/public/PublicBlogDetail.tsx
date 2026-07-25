import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, Link } from "react-router";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { publicBlogApi, type Blog } from "../../../services/blogApi";
import { Header, Footer } from "./components";
import { BlogSEO } from "../../../components/shared/BlogSEO";
import {
  ArrowLeft,
  Calendar,
  Eye,
  BookOpen,
  Lightbulb,
  BookMarked,
  GraduationCap,
  Newspaper,
  ArrowRight,
  ChevronRight,
} from "lucide-react";

const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string; dot: string }> = {
  grammar:    { label: "Ngữ pháp",  icon: BookOpen,      color: "text-blue-600",    bg: "bg-blue-50",    dot: "bg-blue-500" },
  tips:       { label: "Mẹo học",   icon: Lightbulb,     color: "text-amber-600",   bg: "bg-amber-50",   dot: "bg-amber-500" },
  vocabulary: { label: "Từ vựng",   icon: BookMarked,    color: "text-violet-600",  bg: "bg-violet-50",  dot: "bg-violet-500" },
  teaching:   { label: "Giảng dạy", icon: GraduationCap, color: "text-emerald-600", bg: "bg-emerald-50", dot: "bg-emerald-500" },
  news:       { label: "Tin tức",   icon: Newspaper,     color: "text-orange-600",  bg: "bg-orange-50",  dot: "bg-orange-500" },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("vi-VN", { day: "2-digit", month: "long", year: "numeric" });
}

function BlogDetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-4 py-10">
      {/* Breadcrumb */}
      <div className="mb-8 flex items-center gap-2">
        <div className="h-3 w-16 rounded-full bg-gray-200" />
        <div className="h-3 w-3 rounded-full bg-gray-200" />
        <div className="h-3 w-16 rounded-full bg-gray-200" />
        <div className="h-3 w-3 rounded-full bg-gray-200" />
        <div className="h-3 w-32 rounded-full bg-gray-200" />
      </div>
      <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
        {/* Main */}
        <div>
          <div className="mb-4 h-6 w-20 rounded-full bg-gray-200" />
          <div className="mb-2 h-9 w-full rounded-lg bg-gray-200" />
          <div className="mb-6 h-9 w-2/3 rounded-lg bg-gray-200" />
          <div className="mb-6 flex gap-3">
            <div className="h-4 w-16 rounded-full bg-gray-200" />
            <div className="h-4 w-3 rounded-full bg-gray-200" />
            <div className="h-4 w-24 rounded-full bg-gray-200" />
          </div>
          <div className="mb-8 h-72 w-full rounded-xl bg-gray-200" />
          <div className="space-y-3">
            {[1,1,1,1,0.75,1,1,0.6,1,1,1,0.8].map((w, i) => (
              <div key={i} className="h-4 rounded bg-gray-100" style={{ width: `${w * 100}%` }} />
            ))}
          </div>
        </div>
        {/* Sidebar */}
        <div className="hidden lg:block">
          <div className="rounded-xl bg-gray-50 p-5">
            <div className="mb-4 h-5 w-28 rounded-lg bg-gray-200" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3 py-3">
                <div className="h-9 w-9 flex-shrink-0 rounded-lg bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-full rounded bg-gray-200" />
                  <div className="h-4 w-3/4 rounded bg-gray-200" />
                  <div className="h-3 w-16 rounded-full bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PublicBlogDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [post, setPost] = useState<Blog | null>(null);
  const [related, setRelated] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const ctaRef = useRef<HTMLDivElement>(null);
  const [ctaInView, setCtaInView] = useState(true);
  const [flyPos, setFlyPos] = useState<{ sx: number; sy: number; ex: number; ey: number } | null>(null);

  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        setCtaInView(entry.isIntersecting);
        window.dispatchEvent(
          new CustomEvent("blog-cta-visible", { detail: { visible: entry.isIntersecting } })
        );
        if (!entry.isIntersecting) {
          const ctaRect = el.getBoundingClientRect();
          const btnEl = document.querySelector<HTMLElement>('[data-blog-login]');
          const btnRect = btnEl?.getBoundingClientRect();
          if (btnRect) {
            setFlyPos({
              sx: ctaRect.left + ctaRect.width / 2 - 8,
              sy: Math.max(ctaRect.top + ctaRect.height / 2 - 8, 4),
              ex: btnRect.left + btnRect.width / 2 - 8,
              ey: btnRect.top + btnRect.height / 2 - 8,
            });
            setTimeout(() => setFlyPos(null), 700);
          }
        }
      },
      { rootMargin: "-80px 0px 0px 0px", threshold: 0 }
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      window.dispatchEvent(new CustomEvent("blog-cta-visible", { detail: { visible: true } }));
    };
  });

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    let postId = 0;
    publicBlogApi
      .getPost(slug)
      .then((res: any) => {
        if (cancelled) return;
        // cachedGet đã unwrap -> res chính là object bài viết
        const data: Blog = res;
        if (!data) { setNotFound(true); return; }
        setPost(data);
        postId = data.pId;
        return publicBlogApi.getPosts({ type: data.pType, per_page: 4 });
      })
      .then((res: any) => {
        if (cancelled || !res) return;
        // res là paginator -> mảng nằm ở res.data
        const items: Blog[] = res?.data ?? [];
        setRelated(items.filter((p) => p.pId !== postId).slice(0, 3));
      })
      .catch(() => { if (!cancelled) setNotFound(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <BlogDetailSkeleton />
        <Footer />
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="flex h-96 flex-col items-center justify-center gap-4 text-slate-400">
          <BookOpen className="h-14 w-14 opacity-30" />
          <p className="text-lg font-medium">{t('blog.public.detail.notFound')}</p>
          <button
            onClick={() => navigate("/bai-viet")}
            className="flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> {t('blog.public.detail.backToList')}
          </button>
        </div>
        <Footer />
      </div>
    );
  }

  const cfg = TYPE_CONFIG[post.pType] ?? TYPE_CONFIG.news;
  const Icon = cfg.icon;

  const seoDescription = post.pContent
    ? post.pContent
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#0?39;|&apos;/gi, "'")
        .replace(/&#x?[0-9a-f]+;/gi, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 160)
    : undefined;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <BlogSEO
        title={`${post.pTitle} | NamThuEdu`}
        description={seoDescription}
        image={post.pThumbnail || undefined}
        canonical={`/bai-viet/${post.pUrl || String(post.pId)}`}
        type="article"
        publishedAt={post.pCreated_at}
        author={post.author?.uName}
      />
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-10">
        {/* Breadcrumb */}
        <nav className="mb-8 flex items-center gap-1.5 text-xs text-slate-400">
          <Link to="/" className="hover:text-orange-500 transition-colors">{t('blog.public.detail.breadcrumbHome')}</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/bai-viet" className="hover:text-orange-500 transition-colors">{t('blog.public.detail.breadcrumbPosts')}</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="line-clamp-1 text-slate-600">{post.pTitle}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-[1fr_300px]">
          {/* ── Main content ── */}
          <article className="max-w-3xl w-full overflow-hidden">
            {/* Type badge */}
            <span className={`mb-4 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}>
              <Icon className="h-3 w-3" />
              {t(`blog.public.types.${post.pType}`, cfg.label)}
            </span>

            {/* Title */}
            <h1 className="mb-4 text-2xl font-bold leading-snug text-slate-900 md:text-3xl">
              {post.pTitle}
            </h1>

            {/* Meta */}
            <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-gray-100 pb-5 text-xs text-slate-400">
              {post.author && (
                <span className="font-semibold text-slate-600">{post.author.uName}</span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(post.pCreated_at)}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" />
                {post.pView ?? 0} {t('blog.public.detail.views')}
              </span>
              {post.category && (
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-slate-500">
                  {post.category.caName}
                </span>
              )}
            </div>

            {/* Thumbnail */}
            {post.pThumbnail && (
              <div className="mb-8 overflow-hidden rounded-xl">
                <img
                  src={post.pThumbnail}
                  alt={post.pTitle}
                  loading="lazy"
                  decoding="async"
                  className="h-72 w-full object-cover"
                />
              </div>
            )}

            {/* Content — render HTML safely */}
            <div
              className="prose prose-slate prose-base md:prose-lg max-w-3xl prose-headings:font-bold prose-a:text-orange-600 prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg"
              dangerouslySetInnerHTML={{ __html: post.pContent ?? "" }}
            />

            {/* Back link */}
            <div className="mt-10 border-t border-gray-100 pt-6">
              <button
                onClick={() => navigate("/bai-viet")}
                className="flex items-center gap-2 text-sm text-slate-500 hover:text-orange-600 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> {t('blog.public.detail.backLink')}
              </button>
            </div>
          </article>

          {/* ── Sidebar ── */}
          <aside className="space-y-6">
            {/* Related posts */}
            {related.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                {/* Header */}
                <div className="mb-4 flex items-center gap-2">
                  <span className="h-3.5 w-0.5 rounded-full bg-orange-400" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">
                    {t('blog.public.detail.relatedPosts')}
                  </h3>
                </div>

                {/* Items */}
                <div className="divide-y divide-slate-100">
                  {related.map((r, idx) => {
                    const rSlug = r.pUrl || String(r.pId);
                    const rCfg = TYPE_CONFIG[r.pType];
                    return (
                      <button
                        key={r.pId}
                        onClick={() => navigate(`/bai-viet/${rSlug}`)}
                        className="group flex w-full items-start gap-3 py-3.5 text-left first:pt-0 last:pb-0"
                      >
                        {/* Index number or thumbnail */}
                        <div className="mt-0.5 flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-50">
                          {r.pThumbnail ? (
                            <img
                              src={r.pThumbnail}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-lg font-bold text-slate-300">
                              {String(idx + 1).padStart(2, "0")}
                            </span>
                          )}
                        </div>

                        {/* Text */}
                        <div className="flex-1 min-w-0">
                          <p className="line-clamp-2 text-[0.8125rem] font-medium leading-snug text-slate-700 transition-colors group-hover:text-orange-600">
                            {r.pTitle}
                          </p>
                          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-400">
                            {rCfg && (
                              <span className={`h-1.5 w-1.5 rounded-full ${rCfg.dot}`} />
                            )}
                            <span>{formatDate(r.pCreated_at)}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Footer link */}
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <button
                    onClick={() => navigate(`/bai-viet?type=${post.pType}`)}
                    className="group flex items-center gap-1 text-xs font-medium text-slate-400 transition-colors hover:text-slate-700"
                  >
                    {t('blog.public.detail.seeAllPosts')}
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              </div>
            )}

            {/* CTA sidebar */}
            <div ref={ctaRef} className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-slate-900 p-6">
              {/* Decorative orbs */}
              <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/[0.03]" />
              <div className="pointer-events-none absolute -bottom-5 -left-5 h-20 w-20 rounded-full bg-orange-500/[0.08]" />

              <div className="relative">
                {/* Brand badge */}
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-orange-400/90">NamThuEdu</p>
                </div>

                <h3 className="mb-2 text-[0.9375rem] font-bold leading-snug text-white" style={{ whiteSpace: 'pre-line' }}>
                  {t('blog.public.detail.ctaTitle')}
                </h3>
                <p className="mb-5 text-xs leading-relaxed text-slate-400">
                  {t('blog.public.detail.ctaDesc')}
                </p>

                <div className="mb-4 h-px bg-white/[0.06]" />

                <button
                  onClick={() => navigate("/dang-nhap")}
                  className="group flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-px hover:bg-orange-600 hover:shadow-lg hover:shadow-orange-500/25 active:translate-y-0"
                >
                  {t('blog.public.detail.ctaButton')}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
            </div>

            {/* Notify header to highlight login button when CTA is off screen */}
          </aside>
        </div>
      </main>

      {/* Flying orb — animates from sidebar CTA center to header login button */}
      <AnimatePresence>
        {flyPos && (
          <motion.div
            key="fly-orb"
            className="pointer-events-none fixed z-[100] h-4 w-4 rounded-full bg-orange-500"
            style={{ left: flyPos.sx, top: flyPos.sy }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{
              x: flyPos.ex - flyPos.sx,
              y: flyPos.ey - flyPos.sy,
              scale: [0, 1.8, 1.2, 0.6, 0],
              opacity: [0, 1, 1, 0.8, 0],
            }}
            transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          />
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
}
