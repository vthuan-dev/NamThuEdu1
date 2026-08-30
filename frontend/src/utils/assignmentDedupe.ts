/**
 * Ẩn bản giao cũ đã hết lượt khi cùng đề đó vừa được giao lại.
 *
 * Vì sao cần: pool lượt làm bài được đếm theo `assignment_id`, KHÔNG theo
 * `exam_id`. Nên khi giáo viên giao lại một đề mà học viên đã dùng hết lượt,
 * bản giao mới là một pool mới — hành vi này đúng, và cũng chính là cách giáo
 * viên "mở lại" một đề.
 *
 * Nhưng danh sách gom theo assignment, nên hệ quả là học viên thấy HAI thẻ trùng
 * tên đề: một "Đã xong / Hết lượt" và một "Chưa làm". Không rõ nên bấm thẻ nào,
 * và dễ tưởng hệ thống lỗi lặp.
 *
 * Theo quyết định sản phẩm: ẩn bản cũ đã cạn lượt. Kết quả bài cũ KHÔNG bị xoá —
 * submission vẫn còn trong DB và xem được ở tab "Lịch sử thi".
 */

/** Phần thông tin tối thiểu cần để quyết định ẩn/hiện. */
export interface DedupableExam {
  examId: number;
  attemptsUsed?: number | null;
  attemptsAllowed?: number | null;
}

/**
 * Hết lượt = giáo viên có đặt giới hạn VÀ học viên đã dùng đủ.
 *
 * `attemptsAllowed <= 0` (hoặc null) nghĩa là không giới hạn — khớp với cách
 * backend hiểu `taMax_attempt` ở ThptExamController::startSubmission.
 */
function isExhausted(e: DedupableExam): boolean {
  const allowed = e.attemptsAllowed ?? 0;
  if (allowed <= 0) return false;
  return (e.attemptsUsed ?? 0) >= allowed;
}

/**
 * Loại các bản giao đã hết lượt của những đề mà học viên còn bản khác làm được.
 *
 * Giữ NGUYÊN thứ tự đầu vào, vì hàm này chạy sau bước sắp xếp.
 *
 * Cố ý KHÔNG chỉ giữ bản mới nhất: nếu giáo viên giao hai bản đều còn lượt (ví
 * dụ hai deadline khác nhau) thì cả hai đều hợp lệ, ẩn đi sẽ làm học viên mất
 * một lượt hợp pháp. Chỉ ẩn khi bản đó THỰC SỰ không làm được nữa.
 */
export function hideSupersededExhausted<T extends DedupableExam>(items: T[]): T[] {
  // Đề nào còn ít nhất một bản giao chưa cạn lượt.
  const examsWithPlayable = new Set<number>();
  for (const item of items) {
    if (!isExhausted(item)) examsWithPlayable.add(item.examId);
  }

  return items.filter((item) => !(isExhausted(item) && examsWithPlayable.has(item.examId)));
}
