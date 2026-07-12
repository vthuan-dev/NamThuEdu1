import React, { useState } from 'react';
import { getAuthToken } from '../../../../utils/authStorage';
import { UserPlus, Baby, Users, GraduationCap, X } from 'lucide-react';

interface CreateStudentProps {
  onClose: () => void;
  onSuccess: () => void;
}

type AgeGroup = 'kids' | 'teens' | 'adults';

interface StudentFormData {
  studentName: string;
  studentPhone: string;
  studentPassword: string;
  studentDoB: string;
  age_group: AgeGroup;
}

export function CreateStudent({ onClose, onSuccess }: CreateStudentProps) {
  const [formData, setFormData] = useState<StudentFormData>({
    studentName: '',
    studentPhone: '',
    studentPassword: 'user123',
    studentDoB: '',
    age_group: 'teens',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ageGroups = [
    {
      value: 'kids' as AgeGroup,
      label: 'Trẻ em',
      ageRange: '6-12 tuổi',
      icon: Baby,
      color: 'from-pink-400 to-purple-400',
      bgColor: 'bg-pink-50',
      borderColor: 'border-pink-300',
      description: 'Lớp 1 - 5 (Tiểu học)'
    },
    {
      value: 'teens' as AgeGroup,
      label: 'Thiếu niên',
      ageRange: '13-17 tuổi',
      icon: Users,
      color: 'from-orange-400 to-amber-400',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-300',
      description: 'Cấp 2 - 3 (THCS + THPT)'
    },
    {
      value: 'adults' as AgeGroup,
      label: 'Người lớn',
      ageRange: '18+ tuổi',
      icon: GraduationCap,
      color: 'from-slate-400 to-gray-400',
      bgColor: 'bg-slate-50',
      borderColor: 'border-slate-300',
      description: 'Sinh viên & người đi làm'
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const token = getAuthToken();
      // Backend falls back to "user123" if password is empty; still send default explicitly.
      const payload = {
        ...formData,
        studentPassword: formData.studentPassword?.trim() || 'user123',
      };

      const response = await fetch(`${import.meta.env.VITE_API_URL}/teacher/student`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Không thể tạo học viên');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-orange-600 to-amber-600 text-white p-6 rounded-t-2xl flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <UserPlus className="w-6 h-6" />
            <h2 className="text-2xl font-bold">Tạo tài khoản học viên</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Age Group Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              Chọn độ tuổi học viên <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-slate-500 mb-3">
              Học viên sẽ được tự động gán vào lớp phù hợp với độ tuổi
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {ageGroups.map((group) => {
                const Icon = group.icon;
                const isSelected = formData.age_group === group.value;
                
                return (
                  <button
                    key={group.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, age_group: group.value }))}
                    className={`
                      relative p-4 rounded-xl border-2 transition-all
                      ${isSelected 
                        ? `${group.borderColor} ${group.bgColor} shadow-lg scale-105` 
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                      }
                    `}
                  >
                    <div className="flex flex-col items-center text-center space-y-2">
                      <div className={`
                        w-12 h-12 rounded-full bg-gradient-to-r ${group.color} 
                        flex items-center justify-center
                        ${isSelected ? 'scale-110' : ''}
                        transition-transform
                      `}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">{group.label}</div>
                        <div className="text-sm text-slate-600 font-medium">{group.ageRange}</div>
                        <div className="text-xs text-slate-500 mt-1">{group.description}</div>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="absolute top-2 right-2">
                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Student Name */}
          <div>
            <label htmlFor="studentName" className="block text-sm font-semibold text-slate-700 mb-2">
              Họ và tên <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="studentName"
              name="studentName"
              value={formData.studentName}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Nhập họ và tên học viên"
            />
          </div>

          {/* Phone Number */}
          <div>
            <label htmlFor="studentPhone" className="block text-sm font-semibold text-slate-700 mb-2">
              Số điện thoại <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              id="studentPhone"
              name="studentPhone"
              value={formData.studentPhone}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Nhập số điện thoại"
            />
            <p className="mt-1 text-xs text-slate-500">Số điện thoại sẽ dùng để đăng nhập</p>
          </div>

          {/* Password */}
          <div>
            <label htmlFor="studentPassword" className="block text-sm font-semibold text-slate-700 mb-2">
              Mật khẩu <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="studentPassword"
              name="studentPassword"
              value={formData.studentPassword}
              onChange={handleChange}
              required
              minLength={6}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Mặc định: user123"
            />
            <p className="mt-1 text-xs text-slate-500">
              Mật khẩu mặc định: <span className="font-semibold text-slate-700">user123</span> (có thể đổi trước khi tạo)
            </p>
          </div>

          {/* Date of Birth (Optional) */}
          <div>
            <label htmlFor="studentDoB" className="block text-sm font-semibold text-slate-700 mb-2">
              Ngày sinh (Tùy chọn)
            </label>
            <input
              type="date"
              id="studentDoB"
              name="studentDoB"
              value={formData.studentDoB}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-red-700 text-sm flex items-center gap-2">
                <span>⚠️</span> {error}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-xl hover:from-orange-700 hover:to-amber-700 hover:shadow-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Đang tạo...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  <span>Tạo học viên</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
