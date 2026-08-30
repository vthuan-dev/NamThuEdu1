import React from 'react';
import { Clock, GraduationCap, Mail, Phone } from 'lucide-react';

export function WaitingForClass() {
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* `p-5` dưới sm: card này nằm trong container đã có `p-4`, nên p-8 cộng
            lại ăn 96px chiều ngang — trên máy 375px chỉ còn ~280px cho nội dung. */}
        <div className="bg-white rounded-2xl shadow-xl p-5 sm:p-8 md:p-12">
          {/* Icon */}
          <div className="flex justify-center mb-5 sm:mb-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full flex items-center justify-center">
              <Clock className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-4">
            Chờ xếp lớp
          </h1>

          {/* Message */}
          <div className="text-center mb-8">
            <p className="text-lg text-gray-600 mb-2">
              Xin chào <span className="font-semibold text-orange-600">{user?.name || 'bạn'}</span>!
            </p>
            <p className="text-gray-600">
              Tài khoản của bạn đã được tạo thành công nhưng chưa được xếp vào lớp học.
            </p>
          </div>

          {/* Info Box */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-8">
            <div className="flex items-start gap-3">
              <GraduationCap className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-amber-900 mb-2">
                  Điều gì sẽ xảy ra tiếp theo?
                </h3>
                <ul className="space-y-2 text-sm text-amber-800">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 mt-1">•</span>
                    <span>Giáo viên hoặc quản trị viên sẽ xem xét hồ sơ của bạn</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 mt-1">•</span>
                    <span>Bạn sẽ được xếp vào lớp phù hợp với độ tuổi và trình độ</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 mt-1">•</span>
                    <span>Sau khi được xếp lớp, bạn có thể đăng nhập lại để bắt đầu học</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="border-t border-gray-200 pt-6">
            <p className="text-center text-gray-600 mb-4">
              Cần hỗ trợ? Liên hệ với chúng tôi:
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="tel:0123456789"
                className="flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                <Phone className="w-5 h-5" />
                <span>0123 456 789</span>
              </a>
              <a
                href="mailto:support@example.com"
                className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Mail className="w-5 h-5" />
                <span>support@example.com</span>
              </a>
            </div>
          </div>

          {/* Logout Button */}
          <div className="mt-8 text-center">
            <button
              onClick={() => {
                localStorage.clear();
                window.location.href = '/dang-nhap';
              }}
              className="text-gray-500 hover:text-gray-700 underline"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
