import { Helmet } from "react-helmet-async";

const SITE_NAME = "NamThuEdu";
const SITE_URL = "https://namthuedu.vn";
const DEFAULT_IMAGE = "/images/banner.png";
const DEFAULT_DESCRIPTION =
  "Tổng hợp bài viết học tiếng Anh, ngữ pháp, từ vựng, mẹo thi VSTEP và IELTS từ đội ngũ giáo viên NamThuEdu tại Cần Thơ.";

interface BlogSEOProps {
  title: string;
  description?: string;
  image?: string;
  canonical?: string;
  type?: "website" | "article";
  publishedAt?: string;
  modifiedAt?: string;
  author?: string;
  noindex?: boolean;
}

export function BlogSEO({
  title,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_IMAGE,
  canonical,
  type = "website",
  publishedAt,
  modifiedAt,
  author,
  noindex = false,
}: BlogSEOProps) {
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  const fullImage = image.startsWith("http") ? image : `${SITE_URL}${image}`;
  const canonicalUrl = canonical
    ? canonical.startsWith("http") ? canonical : `${SITE_URL}${canonical}`
    : undefined;

  const breadcrumbJsonLd =
    type === "article" && canonicalUrl
      ? JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Trang chủ", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/bai-viet` },
            { "@type": "ListItem", position: 3, name: title, item: canonicalUrl },
          ],
        })
      : null;

  const articleJsonLd =
    type === "article"
      ? JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: title,
          description: description,
          image: fullImage,
          author: {
            "@type": "Person",
            name: author ?? SITE_NAME,
          },
          publisher: {
            "@type": "Organization",
            name: SITE_NAME,
            logo: {
              "@type": "ImageObject",
              url: `${SITE_URL}/favicon.png`,
            },
          },
          datePublished: publishedAt,
          dateModified: modifiedAt ?? publishedAt,
          mainEntityOfPage: {
            "@type": "WebPage",
            "@id": canonicalUrl,
          },
        })
      : null;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={noindex ? "noindex, nofollow" : "index, follow"} />
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

      {/* Open Graph */}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={fullImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      <meta property="og:locale" content="vi_VN" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={fullImage} />

      {/* Article-specific */}
      {type === "article" && publishedAt && (
        <meta property="article:published_time" content={publishedAt} />
      )}
      {type === "article" && (modifiedAt ?? publishedAt) && (
        <meta property="article:modified_time" content={modifiedAt ?? publishedAt} />
      )}
      {type === "article" && author && (
        <meta property="article:author" content={author} />
      )}

      {/* JSON-LD Structured Data */}
      {articleJsonLd && (
        <script type="application/ld+json">{articleJsonLd}</script>
      )}
      {breadcrumbJsonLd && (
        <script type="application/ld+json">{breadcrumbJsonLd}</script>
      )}
    </Helmet>
  );
}
