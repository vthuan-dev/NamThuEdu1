import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  /**
   * Khi giá trị này đổi (vd: id phần thi đang xem), boundary tự reset để thử
   * render lại — cho phép học viên chuyển sang phần khác dù phần hiện tại lỗi.
   */
  resetKey?: string | number | null;
  /** Nhãn phần thi để hiện trong thông báo lỗi (tuỳ chọn). */
  label?: string;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * SectionErrorBoundary — chặn lỗi render của MỘT phần thi để KHÔNG làm sập cả
 * trang làm bài. Nhờ đó thanh công cụ (đồng hồ) và thanh điều hướng dưới cùng
 * (Trước / Tiếp theo / Nộp bài) vẫn hoạt động — học viên luôn nộp được bài kể
 * cả khi dữ liệu một phần bị lỗi hiển thị.
 */
export class SectionErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Lỗi hiển thị phần thi.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log để chẩn đoán phần thi/dữ liệu nào gây lỗi.
    console.error('[SectionErrorBoundary] section render failed', error, info?.componentStack);
  }

  componentDidUpdate(prevProps: Props) {
    // Đổi phần thi → thử render lại phần mới.
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, message: '' });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-500" />
          <h3 className="mb-1 text-base font-bold text-slate-900">
            Không hiển thị được {this.props.label ?? 'phần thi này'}
          </h3>
          <p className="mx-auto mb-4 max-w-md text-sm text-slate-600">
            Đã xảy ra lỗi khi tải nội dung phần thi này. Câu trả lời của bạn vẫn được lưu.
            Bạn có thể thử lại, chuyển sang phần khác, hoặc bấm <b>Nộp bài</b> ở dưới cùng.
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700"
          >
            <RefreshCw className="h-4 w-4" /> Thử lại
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
