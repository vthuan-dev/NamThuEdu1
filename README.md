# NamThuEdu

Nền tảng luyện thi và quản lý đào tạo tiếng Anh trực tuyến, hỗ trợ nhiều định dạng đề thi chuẩn (VSTEP, IELTS, THPT, Cambridge YLE cho thiếu nhi và thiếu niên) cùng quy trình tạo đề, giao bài, chấm điểm và theo dõi tiến độ học viên.

Hệ thống gồm hai phần độc lập: API backend viết bằng Laravel và ứng dụng web frontend viết bằng React.

## Tính năng chính

Theo từng vai trò người dùng:

- **Giáo viên**: tạo đề thi 4 kỹ năng (VSTEP/IELTS full test), import đề từ PDF/Word/JSON với hỗ trợ AI, quản lý lớp học và học viên, giao bài và lên lịch, chấm điểm (tự động và thủ công), báo cáo kết quả, quản lý blog.
- **Học viên**: làm bài thi theo định dạng chuẩn (Listening, Reading, Writing, Speaking), xem kết quả và lời giải, theo dõi tiến độ, bảng xếp hạng, gamification.
- **Quản trị viên**: quản lý người dùng, khóa học, báo cáo doanh thu, nhật ký hoạt động, cấu hình hệ thống.

Các năng lực nổi bật:

- Tạo đề VSTEP/IELTS đầy đủ 4 kỹ năng theo cấu trúc chuẩn Bộ Giáo dục.
- Import đề thông minh: trích xuất văn bản từ PDF thuần và file Word, OCR PDF scan, chuyển văn bản sang JSON đề thi bằng AI (Google Gemini).
- Chấm điểm hỗ trợ AI cho Writing và Speaking, có quy trình giáo viên rà soát lại.
- Giám sát phòng thi thời gian thực qua WebSocket.
- Thông báo đẩy (Web Push) và đa ngôn ngữ (Việt/Anh).

## Công nghệ sử dụng

**Backend**
- PHP 8 / Laravel 8
- Laravel Sanctum (xác thực API)
- beyondcode/laravel-websockets, Pusher (realtime)
- L5-Swagger (tài liệu API), minishlink/web-push (thông báo đẩy)
- PHPUnit (kiểm thử)

**Frontend**
- React 19 + TypeScript + Vite
- Tailwind CSS, Radix UI, MUI
- React Router, TanStack Query, i18next
- Vitest (unit/integration), Playwright (E2E)

**Hạ tầng**
- GitHub Actions cho CI/CD (deploy backend và frontend riêng)
- Trình quản lý gói: pnpm (frontend), Composer (backend)

## Yêu cầu môi trường

- PHP >= 8.0, Composer
- Node.js >= 20, pnpm >= 9
- MySQL hoặc MariaDB
- (Tùy chọn) Khóa API Google Gemini và Groq cho các tính năng AI

## Cài đặt

### Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
# Cấu hình kết nối CSDL và các khóa API trong .env
php artisan migrate --seed
php artisan serve
```

### Frontend

```bash
cd frontend
pnpm install
cp .env.example .env
# Cấu hình VITE_API_BASE_URL và các biến môi trường trong .env
pnpm dev
```

## Biến môi trường

**Backend (`backend/.env`)**

| Biến | Mô tả |
|------|-------|
| `DB_*` | Thông tin kết nối cơ sở dữ liệu |
| `GEMINI_API_KEY` / `GEMINI_API_KEYS` | Khóa Google Gemini cho parse đề và chấm AI |
| `GROQ_API_KEY` | Khóa Groq cho gợi ý đáp án và chuyển giọng nói thành văn bản |
| `PUSHER_*` | Cấu hình realtime |

**Frontend (`frontend/.env`)**

| Biến | Mô tả |
|------|-------|
| `VITE_API_BASE_URL` | Địa chỉ API backend |
| `VITE_GROQ_API_KEY` | Khóa Groq dùng phía client (tùy chọn) |

## Kiểm thử

```bash
# Backend
cd backend && php artisan test

# Frontend (unit/integration)
cd frontend && pnpm test:run

# Frontend (E2E)
cd frontend && pnpm exec playwright test
```

## Cấu trúc dự án

```
.
├── backend/      API Laravel (controllers, models, services, migrations, seeders, tests)
├── frontend/     Ứng dụng React (features theo vai trò, components, services, hooks)
├── public/       Tài nguyên tĩnh và template dùng chung
└── .github/      Quy trình CI/CD (GitHub Actions)
```

Frontend tổ chức theo tính năng trong `frontend/src/app/features` (public, auth, student, teacher, admin), tách biệt rõ theo vai trò người dùng.

## Triển khai

Hệ thống được triển khai tự động qua GitHub Actions khi đẩy code lên nhánh `main`:

- `deploy-backend.yml` — triển khai API backend.
- `deploy-frontend.yml` — build và triển khai frontend.

## Giấy phép

Dự án nội bộ. Mọi quyền được bảo lưu.
