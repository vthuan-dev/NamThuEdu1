/**
 * KidsSkillGuide — Trang hướng dẫn kỹ năng cho trẻ 6-12 (Cambridge YL)
 *
 * Mở từ 4 card kỹ năng (Nghe / Đọc / Viết / Nói) ở trang "Bài thi của em".
 * Mỗi kỹ năng hiển thị:
 *  - Hero minh hoạ (SVG vẽ tay, không phụ thuộc ảnh ngoài) + mô tả thân thiện.
 *  - Lộ trình 4 bước tăng dần, có icon + mô tả.
 *  - Vài mẹo nhỏ ("bí kíp").
 *  - Nút bắt đầu luyện ngay (đi vào phiên luyện tập tự do).
 *
 * Style: tông kids rose/cam, bo tròn lớn, emoji — đồng bộ KidsTests/KidsDashboard.
 */
import { useMemo, type ReactElement } from 'react';
import { Link, useParams, Navigate } from 'react-router';
import {
  Headphones, BookOpen, PenLine, Mic, ArrowRight, ArrowLeft, Sparkles, Play, Lightbulb, CheckCircle2,
} from 'lucide-react';
import { usePageTitle } from '../../../../hooks/usePageTitle';

const BASE = '/hoc-vien';

type SkillKey = 'listening' | 'reading' | 'writing' | 'speaking';

interface RoadmapStep { emoji: string; title: string; desc: string; }
interface SkillData {
  key: SkillKey;
  label: string;
  tagline: string;
  Icon: typeof Headphones;
  emoji: string;
  // màu chủ đạo
  accent: string;
  accentSoft: string;
  heroBg: string;
  pageBg: string;
  intro: string;
  roadmap: RoadmapStep[];
  tips: string[];
  Hero: () => ReactElement;
}

/* ─── Minh hoạ SVG cho từng kỹ năng ─────────────────────────────────────── */

function ListeningHero() {
  return (
    <svg width="200" height="180" viewBox="0 0 200 180" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Bạn nhỏ đang nghe">
      <circle cx="100" cy="92" r="70" fill="#FFF1F2" />
      {/* sóng âm */}
      <g stroke="#FB7185" strokeWidth="4" strokeLinecap="round" opacity="0.8">
        <path d="M40 70c-8 14-8 28 0 42" />
        <path d="M28 60c-13 21-13 41 0 62" />
      </g>
      <g stroke="#F97316" strokeWidth="4" strokeLinecap="round" opacity="0.8">
        <path d="M160 70c8 14 8 28 0 42" />
        <path d="M172 60c13 21 13 41 0 62" />
      </g>
      {/* đầu */}
      <circle cx="100" cy="96" r="34" fill="#FDBA74" />
      <path d="M66 92a34 34 0 0 1 68 0v6H66z" fill="#FB923C" />
      {/* tai nghe */}
      <path d="M62 96a38 38 0 0 1 76 0" stroke="#E11D48" strokeWidth="8" strokeLinecap="round" fill="none" />
      <rect x="54" y="92" width="16" height="26" rx="8" fill="#E11D48" />
      <rect x="130" y="92" width="16" height="26" rx="8" fill="#E11D48" />
      {/* mắt + miệng */}
      <circle cx="90" cy="98" r="4" fill="#7C2D12" />
      <circle cx="112" cy="98" r="4" fill="#7C2D12" />
      <path d="M90 112c4 5 16 5 20 0" stroke="#7C2D12" strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="82" cy="108" r="4" fill="#FDA4AF" opacity="0.7" />
      <circle cx="120" cy="108" r="4" fill="#FDA4AF" opacity="0.7" />
      {/* nốt nhạc */}
      <text x="150" y="44" fontSize="22">🎵</text>
      <text x="32" y="40" fontSize="18">🎶</text>
    </svg>
  );
}

function ReadingHero() {
  return (
    <svg width="200" height="180" viewBox="0 0 200 180" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Bạn nhỏ đang đọc sách">
      <circle cx="100" cy="92" r="70" fill="#EFF6FF" />
      {/* sách mở */}
      <path d="M40 120V72c18-10 36-10 60 0 24-10 42-10 60 0v48c-18-9-36-9-60 0-24-9-42-9-60 0z" fill="#fff" stroke="#2563EB" strokeWidth="3" />
      <path d="M100 72v48" stroke="#2563EB" strokeWidth="3" />
      {/* dòng chữ */}
      <g stroke="#93C5FD" strokeWidth="3" strokeLinecap="round">
        <path d="M54 86h32M54 96h28M54 106h32" />
        <path d="M114 86h32M114 96h28M114 106h32" />
      </g>
      {/* đầu bé ló lên trên sách */}
      <circle cx="100" cy="52" r="22" fill="#FDBA74" />
      <path d="M78 50a22 22 0 0 1 44 0z" fill="#A16207" />
      <circle cx="93" cy="52" r="3" fill="#7C2D12" />
      <circle cx="107" cy="52" r="3" fill="#7C2D12" />
      <path d="M94 60c3 3 9 3 12 0" stroke="#7C2D12" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <text x="150" y="46" fontSize="20">⭐</text>
      <text x="34" y="60" fontSize="18">📚</text>
    </svg>
  );
}

function WritingHero() {
  return (
    <svg width="200" height="180" viewBox="0 0 200 180" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Bạn nhỏ đang viết">
      <circle cx="100" cy="92" r="70" fill="#F0FFF4" />
      {/* tờ giấy */}
      <rect x="52" y="58" width="76" height="92" rx="8" fill="#fff" stroke="#059669" strokeWidth="3" transform="rotate(-6 90 104)" />
      <g stroke="#A7F3D0" strokeWidth="3" strokeLinecap="round">
        <path d="M64 84h44M62 98h46M60 112h40" transform="rotate(-6 90 104)" />
      </g>
      {/* bút chì */}
      <g transform="rotate(38 138 96)">
        <rect x="128" y="40" width="16" height="84" rx="4" fill="#FBBF24" />
        <path d="M128 124l8 16 8-16z" fill="#FDE68A" />
        <path d="M132 134l4 6 4-6z" fill="#7C2D12" />
        <rect x="128" y="40" width="16" height="12" rx="4" fill="#F472B6" />
      </g>
      {/* dấu tích */}
      <text x="150" y="50" fontSize="20">✨</text>
      <text x="36" y="120" fontSize="18">📝</text>
    </svg>
  );
}

function SpeakingHero() {
  return (
    <svg width="200" height="180" viewBox="0 0 200 180" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Bạn nhỏ đang nói">
      <circle cx="100" cy="92" r="70" fill="#FEFCE8" />
      {/* bong bóng thoại */}
      <path d="M120 44h44a10 10 0 0 1 10 10v24a10 10 0 0 1-10 10h-26l-12 12v-12h-6a10 10 0 0 1-10-10V54a10 10 0 0 1 10-10z" fill="#fff" stroke="#B45309" strokeWidth="3" />
      <text x="132" y="78" fontSize="20" fontWeight="bold" fill="#B45309">Hi!</text>
      {/* đầu bé */}
      <circle cx="84" cy="100" r="32" fill="#FDBA74" />
      <path d="M52 96a32 32 0 0 1 64 0v4H52z" fill="#92400E" />
      <circle cx="76" cy="100" r="4" fill="#7C2D12" />
      <circle cx="96" cy="100" r="4" fill="#7C2D12" />
      {/* miệng đang nói */}
      <ellipse cx="86" cy="114" rx="8" ry="6" fill="#7C2D12" />
      <circle cx="68" cy="110" r="4" fill="#FDA4AF" opacity="0.7" />
      {/* micro */}
      <g transform="rotate(18 120 128)">
        <rect x="112" y="112" width="14" height="30" rx="7" fill="#B45309" />
        <rect x="116" y="142" width="6" height="14" rx="3" fill="#78350F" />
      </g>
      <text x="40" y="54" fontSize="18">🎤</text>
    </svg>
  );
}

/* ─── Dữ liệu kỹ năng ────────────────────────────────────────────────────── */

const SKILLS: Record<SkillKey, SkillData> = {
  listening: {
    key: 'listening',
    label: 'Kỹ năng Nghe',
    tagline: 'Nghe và hiểu tiếng Anh',
    Icon: Headphones,
    emoji: '👂',
    accent: '#E11D48',
    accentSoft: '#FFE4E6',
    heroBg: 'linear-gradient(135deg, #FFF0F0, #FECDD3)',
    pageBg: 'linear-gradient(160deg, #FFF1F2 0%, #FFF7ED 100%)',
    intro: 'Nghe là kỹ năng đầu tiên giúp em làm quen với tiếng Anh. Khi nghe nhiều, em sẽ hiểu được người khác nói gì và bắt chước theo thật dễ dàng!',
    roadmap: [
      { emoji: '🔤', title: 'Bước 1 · Nghe âm và chữ cái', desc: 'Làm quen cách phát âm 26 chữ cái và các âm cơ bản trong tiếng Anh.' },
      { emoji: '🗣️', title: 'Bước 2 · Nghe từ quen thuộc', desc: 'Nghe các từ về màu sắc, con vật, đồ vật quanh em rồi chỉ đúng tranh.' },
      { emoji: '💬', title: 'Bước 3 · Nghe câu ngắn', desc: 'Nghe câu chào hỏi, câu hỏi đơn giản và làm theo hướng dẫn.' },
      { emoji: '📖', title: 'Bước 4 · Nghe câu chuyện', desc: 'Nghe đoạn hội thoại hoặc chuyện ngắn rồi trả lời câu hỏi vui.' },
    ],
    tips: [
      'Nghe mỗi ngày 10 phút, đều đặn hơn là nghe thật lâu một lần.',
      'Nghe xong thử nhắc lại to những từ em vừa nghe được.',
      'Không hiểu hết cũng không sao — đoán theo tranh và ngữ cảnh nhé!',
    ],
    Hero: ListeningHero,
  },
  reading: {
    key: 'reading',
    label: 'Kỹ năng Đọc',
    tagline: 'Đọc hiểu chuyện và hình ảnh',
    Icon: BookOpen,
    emoji: '📖',
    accent: '#2563EB',
    accentSoft: '#DBEAFE',
    heroBg: 'linear-gradient(135deg, #EFF6FF, #BFDBFE)',
    pageBg: 'linear-gradient(160deg, #EFF6FF 0%, #F0FDF4 100%)',
    intro: 'Đọc giúp em nhận ra mặt chữ và hiểu nghĩa của từ. Bắt đầu từ những từ ngắn, rồi tới câu chuyện có tranh thật vui!',
    roadmap: [
      { emoji: '🔡', title: 'Bước 1 · Nhận mặt chữ', desc: 'Nhìn và đọc to từng chữ cái, ghép vần các từ ngắn quen thuộc.' },
      { emoji: '🍎', title: 'Bước 2 · Đọc từ có tranh', desc: 'Đọc từ vựng kèm hình ảnh: con vật, trái cây, đồ chơi…' },
      { emoji: '📝', title: 'Bước 3 · Đọc câu ngắn', desc: 'Đọc câu đơn giản và nối câu với đúng bức tranh.' },
      { emoji: '📚', title: 'Bước 4 · Đọc chuyện ngắn', desc: 'Đọc một đoạn chuyện nhỏ rồi trả lời câu hỏi về nội dung.' },
    ],
    tips: [
      'Dùng ngón tay chỉ theo từng từ khi đọc để không bị lạc dòng.',
      'Gặp từ mới hãy nhìn tranh để đoán nghĩa trước.',
      'Đọc to thành tiếng giúp em nhớ từ lâu hơn nhé!',
    ],
    Hero: ReadingHero,
  },
  writing: {
    key: 'writing',
    label: 'Kỹ năng Viết',
    tagline: 'Viết câu đúng và đẹp',
    Icon: PenLine,
    emoji: '✏️',
    accent: '#059669',
    accentSoft: '#D1FAE5',
    heroBg: 'linear-gradient(135deg, #F0FFF4, #BBF7D0)',
    pageBg: 'linear-gradient(160deg, #F0FDF4 0%, #FEFCE8 100%)',
    intro: 'Viết giúp em ghi lại điều mình nghĩ bằng tiếng Anh. Bắt đầu từ tô chữ, viết từ, rồi viết được cả câu hoàn chỉnh!',
    roadmap: [
      { emoji: '✍️', title: 'Bước 1 · Tô và viết chữ cái', desc: 'Tập viết chữ in hoa và in thường đúng nét, đúng dòng kẻ.' },
      { emoji: '🔠', title: 'Bước 2 · Viết từ đơn', desc: 'Viết đúng chính tả các từ quen thuộc theo mẫu và theo tranh.' },
      { emoji: '🧩', title: 'Bước 3 · Sắp xếp thành câu', desc: 'Ghép các từ thành câu đơn giản đúng thứ tự.' },
      { emoji: '📄', title: 'Bước 4 · Viết câu của em', desc: 'Tự viết câu giới thiệu bản thân, sở thích, gia đình…' },
    ],
    tips: [
      'Viết chậm và rõ ràng quan trọng hơn là viết nhanh.',
      'Nhớ viết hoa chữ đầu câu và dùng dấu chấm cuối câu.',
      'Đọc lại câu vừa viết để kiểm tra chính tả nhé!',
    ],
    Hero: WritingHero,
  },
  speaking: {
    key: 'speaking',
    label: 'Kỹ năng Nói',
    tagline: 'Nói tiếng Anh tự tin',
    Icon: Mic,
    emoji: '🎤',
    accent: '#B45309',
    accentSoft: '#FEF3C7',
    heroBg: 'linear-gradient(135deg, #FEFCE8, #FEF08A)',
    pageBg: 'linear-gradient(160deg, #FEFCE8 0%, #FFF1F2 100%)',
    intro: 'Nói giúp em dùng tiếng Anh để trò chuyện. Đừng sợ sai — nói nhiều sẽ giúp em phát âm chuẩn và tự tin hơn mỗi ngày!',
    roadmap: [
      { emoji: '🔊', title: 'Bước 1 · Phát âm từng âm', desc: 'Bắt chước phát âm các âm và chữ cái theo mẫu.' },
      { emoji: '🐶', title: 'Bước 2 · Nói từ quen thuộc', desc: 'Gọi tên con vật, màu sắc, đồ vật bằng tiếng Anh.' },
      { emoji: '👋', title: 'Bước 3 · Nói câu chào hỏi', desc: 'Tập chào hỏi, giới thiệu tên và hỏi đáp đơn giản.' },
      { emoji: '🗨️', title: 'Bước 4 · Trò chuyện ngắn', desc: 'Nói về bản thân, sở thích trong một đoạn hội thoại nhỏ.' },
    ],
    tips: [
      'Nói to và rõ, nhìn vào gương để xem khẩu hình miệng.',
      'Bắt chước giọng trong video hoặc bài nghe mẫu.',
      'Sai cũng không sao — cứ nói nhiều là sẽ giỏi nhé!',
    ],
    Hero: SpeakingHero,
  },
};

/* ─── Trang hướng dẫn ────────────────────────────────────────────────────── */

export function KidsSkillGuide() {
  const { skill } = useParams<{ skill: string }>();
  const data = useMemo(() => SKILLS[(skill || '') as SkillKey], [skill]);

  usePageTitle(data ? `${data.label} · Hướng dẫn` : 'Hướng dẫn kỹ năng');

  // Skill không hợp lệ → quay về trang Bài thi
  if (!data) return <Navigate to={`${BASE}/bai-tap`} replace />;

  const { Hero } = data;
  const practiceLink = `${BASE}/bai-tap`;

  return (
    <div className="min-h-screen" style={{ background: data.pageBg }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-12 space-y-6">

        {/* ─── Quay lại ─────────────────────────────────────────── */}
        <Link
          to={`${BASE}/bai-tap`}
          className="inline-flex items-center gap-2 text-sm font-extrabold transition-colors"
          style={{ color: data.accent }}
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại Bài thi
        </Link>

        {/* ─── Hero ─────────────────────────────────────────────── */}
        <section
          className="relative overflow-hidden rounded-3xl p-5 sm:p-7 flex flex-col sm:flex-row items-center gap-5"
          style={{ background: data.heroBg, boxShadow: `0 12px 32px ${data.accent}22`, border: '2px solid rgba(255,255,255,0.9)' }}
        >
          <div className="flex-shrink-0" style={{ animation: 'kidsGuideFloat 3.5s ease-in-out infinite' }}>
            <style>{`@keyframes kidsGuideFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}`}</style>
            <Hero />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold mb-2"
              style={{ background: 'rgba(255,255,255,0.7)', color: data.accent }}
            >
              <data.Icon className="w-3.5 h-3.5" /> {data.tagline}
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight" style={{ color: data.accent }}>
              {data.emoji} {data.label}
            </h1>
            <p className="text-sm sm:text-base font-medium mt-2 leading-relaxed" style={{ color: data.accent, opacity: 0.85 }}>
              {data.intro}
            </p>
          </div>
        </section>

        {/* ─── Lộ trình ─────────────────────────────────────────── */}
        <section
          className="rounded-3xl p-5 sm:p-6"
          style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(0,0,0,0.05)', border: '2px solid rgba(255,255,255,0.9)' }}
        >
          <header className="flex items-center gap-2 mb-5">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: data.accent }}>
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 leading-tight">Lộ trình học 🌈</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">4 bước nhỏ — đi từ dễ đến khó, từng chút một!</p>
            </div>
          </header>

          <ol className="relative space-y-4">
            {/* đường nối dọc */}
            <span
              className="absolute left-[27px] top-2 bottom-2 w-0.5 rounded-full hidden sm:block"
              style={{ background: `${data.accent}22` }}
              aria-hidden="true"
            />
            {data.roadmap.map((step, i) => (
              <li key={i} className="relative flex items-start gap-4">
                <div
                  className="relative z-10 w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl"
                  style={{ background: data.accentSoft, border: `2px solid ${data.accent}33` }}
                >
                  {step.emoji}
                </div>
                <div
                  className="flex-1 rounded-2xl p-4"
                  style={{ background: data.accentSoft, border: '2px solid rgba(255,255,255,0.85)' }}
                >
                  <h3 className="text-sm font-extrabold" style={{ color: data.accent }}>{step.title}</h3>
                  <p className="text-xs sm:text-sm font-medium mt-1 leading-relaxed" style={{ color: data.accent, opacity: 0.8 }}>
                    {step.desc}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ─── Bí kíp ───────────────────────────────────────────── */}
        <section
          className="rounded-3xl p-5 sm:p-6"
          style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(0,0,0,0.05)', border: '2px solid rgba(255,255,255,0.9)' }}
        >
          <header className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #FBBF24, #F59E0B)' }}>
              <Lightbulb className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-extrabold text-slate-900 leading-tight">Bí kíp nhỏ cho em ✨</h2>
          </header>
          <ul className="space-y-2.5">
            {data.tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: data.accent }} />
                <span className="text-sm font-medium text-slate-700 leading-relaxed">{tip}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ─── CTA ──────────────────────────────────────────────── */}
        <Link
          to={practiceLink}
          className="group flex items-center justify-center gap-2 w-full py-4 rounded-3xl text-base font-extrabold text-white transition-all hover:-translate-y-0.5 active:scale-[0.98]"
          style={{ background: `linear-gradient(135deg, ${data.accent}, ${data.accent}cc)`, boxShadow: `0 10px 28px ${data.accent}55` }}
        >
          <Play className="w-5 h-5 fill-white" />
          Bắt đầu luyện {data.label.replace('Kỹ năng ', '')} ngay
          <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </div>
  );
}
