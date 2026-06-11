import { Bell, X } from 'lucide-react';
import { useState } from 'react';
import { UsePushNotificationReturn } from '../hooks/usePushNotification';

interface Props {
  push: UsePushNotificationReturn;
}

export function NotificationPermissionBanner({ push }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (push.permissionState !== 'default' || dismissed) return null;

  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm mx-auto px-4">
      <div className="bg-white border border-orange-200 rounded-2xl shadow-2xl shadow-orange-100/50 p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center shrink-0 mt-0.5">
          <Bell className="w-4 h-4 text-orange-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 leading-snug">Bật thông báo bài tập</p>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
            Nhận ngay khi giáo viên giao bài hoặc nhắc nhở deadline.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={push.requestPermission}
              className="flex-1 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              Cho phép
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="px-3 py-1.5 border border-gray-200 text-gray-500 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Để sau
            </button>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors text-gray-400 shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
