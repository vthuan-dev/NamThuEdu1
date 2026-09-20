/**
 * IELTS Listening — audio component (default native player).
 *
 *  • Hiển thị thanh audio mặc định của trình duyệt (controls), không custom UI
 *  • Tự phát khi mount (nếu trình duyệt cho phép) — nếu bị chặn thì học viên bấm play
 *  • Dùng âm lượng mặc định của thiết bị
 *  • Gọi `onEnded` khi phát xong để parent chuyển sang section kế
 *  • Khi `lockAfterEnd=true` (full test mode): sau khi audio kết thúc sẽ
 *    ẩn controls để mô phỏng đúng luật "1 lần duy nhất" của bài thi thật.
 *    Khi `lockAfterEnd=false` (practice mode): cho phép pause/seek/replay tự do.
 */
import { useEffect, useRef, useState } from "react";
import { normalizeAudioUrl } from "../../../../../../utils/examUtils";
import { getFullMediaUrl } from "../../../../../../utils/mediaUtils";

interface IeltsAudioOnceProps {
  src: string;
  /** if true, will start playing immediately on mount (caller must ensure user gesture) */
  autoPlay?: boolean;
  onPlay?: () => void;
  onEnded?: () => void;
  /** label shown above the player */
  title?: string;
  /**
   * Khi true: sau khi audio kết thúc → khoá controls (mô phỏng CBT thật).
   * Khi false: cho phép tua/replay (practice mode). Default: true.
   */
  lockAfterEnd?: boolean;
}

export function IeltsAudioOnce({
  src,
  autoPlay = true,
  onPlay,
  onEnded,
  lockAfterEnd = true,
}: IeltsAudioOnceProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [ended, setEnded] = useState(false);
  const safeSrc = normalizeAudioUrl(getFullMediaUrl(src));

  // Try autoplay on mount
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !autoPlay) return;
    audio.play()
      .then(() => onPlay?.())
      .catch(() => {
        // Autoplay blocked → học viên bấm play trên thanh mặc định
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, safeSrc]);

  const handleEnded = () => {
    if (lockAfterEnd) setEnded(true);
    onEnded?.();
  };

  // Khi ended + lockAfterEnd → ẩn audio bar, hiển thị placeholder rõ ràng
  if (ended && lockAfterEnd) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 border border-gray-200 rounded-md text-sm text-gray-600">
        <span className="text-gray-400">🔒</span>
        Audio đã phát xong. Theo luật thi, bạn không thể nghe lại.
      </div>
    );
  }

  return (
    <audio
      ref={audioRef}
      src={safeSrc}
      controls
      preload="auto"
      className="w-full"
      onPlay={() => onPlay?.()}
      onEnded={handleEnded}
      controlsList={lockAfterEnd ? "nodownload noplaybackrate" : "nodownload"}
    />
  );
}
