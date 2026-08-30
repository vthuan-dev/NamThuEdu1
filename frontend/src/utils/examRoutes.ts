/**
 * Nhận biết route "đang làm bài" để layout tắt phần chrome không cần thiết.
 *
 * Vì sao cần: các route làm bài nằm TRONG nhóm con của layout học viên
 * (studentRoutes.tsx), nên header của layout vẫn bọc ngoài trang thi. Trên mobile
 * điều đó tạo HAI thanh đầu trang xếp chồng — header layout (h-16) cộng thanh
 * riêng của trang thi — ăn khoảng 120px chiều cao mà không mang thông tin nào
 * cần cho việc làm bài.
 *
 * Ngoài chiều cao, còn hai vấn đề nghiêm trọng hơn:
 *   - Menu điều hướng giữa bài thi khiến học viên dễ bấm ra ngoài và mất phiên.
 *   - DailyMotivationPopup (z-[9998]) và ExamReminderPopup (z-[200]) nằm trên
 *     mọi thứ của trang thi, có thể che đề hoặc nút Nộp bài.
 */

/**
 * Tiền tố các route làm bài.
 *
 * Dùng tiền tố thay vì so khớp tuyệt đối vì mọi route đều có tham số
 * (`/lam-bai/:id`, `/lam-bai-thpt/:examId`) và IELTS còn có route con theo kỹ
 * năng (`/lam-bai-ielts/:examId/listening`).
 *
 * `phong-cho` (phòng chờ) CỐ Ý không nằm trong danh sách: học viên chưa vào đề,
 * vẫn nên thấy điều hướng bình thường để có thể quay ra.
 */
const EXAM_TAKING_PREFIXES = [
  '/hoc-vien/lam-bai',
  '/hoc-vien/lam-bai-thpt',
  '/hoc-vien/lam-bai-vstep',
  '/hoc-vien/lam-bai-ielts',
] as const;

/**
 * `true` nếu đường dẫn là một trang đang làm bài.
 *
 * Lưu ý `/hoc-vien/lam-bai` là tiền tố của cả `/hoc-vien/lam-bai-thpt`, nên chỉ
 * cần một phần tử cũng khớp hết — các phần tử còn lại giữ lại để đọc code hiểu
 * ngay phạm vi áp dụng, và để an toàn nếu sau này đổi tên route gốc.
 */
export function isExamTakingPath(pathname: string): boolean {
  return EXAM_TAKING_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}
