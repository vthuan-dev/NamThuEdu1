import http from 'k6/http';
import { sleep, check } from 'k6';

// Cấu hình bài test
export const options = {
    // Kịch bản: Tăng dần số lượng VUs (Virtual Users - Người dùng ảo)
    stages: [
        { duration: '10s', target: 10 }, // Tăng dần lên 10 người dùng trong 10 giây
        { duration: '20s', target: 10 }, // Giữ mức 10 người dùng trong 20 giây
        { duration: '10s', target: 0 },  // Giảm dần về 0 người dùng trong 10 giây
    ],
};

export default function () {
    // Địa chỉ server local của bạn (Mặc định Laravel chạy port 8000)
    // Sửa lại URL nếu bạn test trang web cụ thể hoặc API cụ thể
    const res = http.get('http://127.0.0.1:8000');
    
    // Kiểm tra xem server có trả về mã 200 OK không
    check(res, {
        'status is 200': (r) => r.status === 200,
        // Cảnh báo nếu phản hồi chậm hơn 500ms
        'transaction time < 500ms': (r) => r.timings.duration < 500,
    });

    // Mô phỏng việc người dùng chờ/đọc nội dung trong 1 giây trước khi click tiếp
    sleep(1);
}
