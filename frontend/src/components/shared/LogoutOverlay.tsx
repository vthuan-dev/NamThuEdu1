/**
 * LogoutOverlay — Hiệu ứng chuyển trang khi đăng xuất.
 *
 * Tái sử dụng animation của màn hình đăng nhập thành công (loginAnimations.css):
 * vòng tròn vẽ dần + dấu check, chỉ thay đổi text cho phù hợp ngữ cảnh đăng xuất.
 */
import '../../styles/loginAnimations.css';

type LogoutOverlayProps = {
  /** Hiện/ẩn overlay */
  show: boolean;
  /** Tiêu đề — mặc định "Đã đăng xuất!" */
  title?: string;
  /** Mô tả phụ — mặc định "Đang chuyển về trang đăng nhập..." */
  subtitle?: string;
};

export function LogoutOverlay({
  show,
  title = 'Đã đăng xuất!',
  subtitle = 'Đang chuyển về trang đăng nhập...',
}: LogoutOverlayProps) {
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        background: 'rgba(255, 255, 255, 0.95)',
        animation: 'fadeIn 300ms ease-out',
      }}
    >
      <div className="flex flex-col items-center gap-4">
        {/* Animated Checkmark — giống màn hình đăng nhập */}
        <div
          className="relative"
          style={{ width: '80px', height: '80px', animation: 'scaleIn 400ms ease-out' }}
        >
          <svg viewBox="0 0 80 80" className="w-full h-full">
            <circle
              cx="40"
              cy="40"
              r="36"
              fill="none"
              stroke="#10B981"
              strokeWidth="4"
              style={{
                strokeDasharray: '226',
                strokeDashoffset: '226',
                animation: 'drawCircle 600ms ease-out forwards',
              }}
            />
            <path
              d="M 25 40 L 35 50 L 55 30"
              fill="none"
              stroke="#10B981"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                strokeDasharray: '50',
                strokeDashoffset: '50',
                animation: 'drawCheck 400ms ease-out 300ms forwards',
              }}
            />
          </svg>
        </div>

        {/* Text */}
        <div className="text-center" style={{ animation: 'fadeInUp 400ms ease-out 400ms both' }}>
          <h3 className="text-xl font-bold text-gray-900 mb-1">{title}</h3>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
