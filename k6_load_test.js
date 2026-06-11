import http from 'k6/http';
import { sleep, check } from 'k6';

// ==========================================
// CẤU HÌNH KỊCH BẢN TEST
// ==========================================
export const options = {
    stages: [
        { duration: '10s', target: 100 }, // Giai đoạn 1: Lên 100 user trong 10s
        { duration: '30s', target: 100 }, // Giai đoạn 2: Giữ 100 user liên tục đập server
        { duration: '10s', target: 0 },  // Giai đoạn 3: Rút êm về 0
    ],
    // Ngưỡng chịu đựng mong muốn
    thresholds: {
        http_req_duration: ['p(95)<1000'], // 95% request phải phản hồi dưới 1 giây
        http_req_failed: ['rate<0.05'],    // Tỷ lệ lỗi phải dưới 5%
    },
};

const BASE_URL = 'http://127.0.0.1:3000/api';

// ==========================================
// DỮ LIỆU ĐỂ TEST (THAY ĐỔI CHO PHÙ HỢP)
// ==========================================
// Bạn cần tạo trước 1 user học viên có sẵn trong Database
const STUDENT_PHONE = '0123456789'; // SỬA PHONE Ở ĐÂY
const STUDENT_PASSWORD = 'password123';         // SỬA PASSWORD Ở ĐÂY

export default function () {
    // ----------------------------------------------------
    // BƯỚC 1: ĐĂNG NHẬP (Lấy Token)
    // ----------------------------------------------------
    let loginRes = http.post(`${BASE_URL}/login`, JSON.stringify({
        phone: STUDENT_PHONE,
        password: STUDENT_PASSWORD,
    }), {
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    });

    check(loginRes, {
        'Login thành công (status 200)': (r) => r.status === 200,
    });

    // Nếu đăng nhập thất bại thì bỏ qua các bước sau
    if (loginRes.status !== 200) {
        sleep(1);
        return; 
    }

    // Lấy token từ cục response trả về
    let token = loginRes.json('data.access_token') || loginRes.json('token') || loginRes.json('data.token');
    
    let authHeaders = {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };

    sleep(1); // User thường đọc trang web mất 1 giây rồi mới bấm tiếp

    // ----------------------------------------------------
    // BƯỚC 2: TẢI DANH SÁCH BÀI THI (Dashboard/Exams)
    // ----------------------------------------------------
    let testsRes = http.get(`${BASE_URL}/student/tests`, authHeaders);
    
    check(testsRes, {
        'Lấy danh sách bài thi thành công': (r) => r.status === 200,
    });

    // Cố gắng lấy ID của bài thi đầu tiên để test
    let testList = testsRes.json('data.data') || testsRes.json('data');
    if (!testList || testList.length === 0) {
        // Nếu không có bài thi nào, test public test endpoint
        http.get(`${BASE_URL}/tests`);
        sleep(1);
        return;
    }
    
    let examId = testList[0].id; // Lấy bài đầu tiên
    sleep(1);

    // ----------------------------------------------------
    // BƯỚC 3: BẮT ĐẦU LÀM BÀI (Tạo Submission)
    // ----------------------------------------------------
    let startRes = http.post(`${BASE_URL}/student/tests/${examId}/start`, null, authHeaders);
    
    check(startRes, {
        'Bắt đầu làm bài thi thành công': (r) => r.status === 200 || r.status === 201,
    });

    let submissionId = startRes.json('data.submission_id') || startRes.json('data.id');

    if (!submissionId) {
        sleep(1);
        return;
    }
    sleep(1);

    // ----------------------------------------------------
    // BƯỚC 4: LƯU TẠM ĐÁP ÁN NHIỀU LẦN (Nặng server nhất)
    // ----------------------------------------------------
    // Giả lập học viên trả lời 3 câu hỏi, mỗi câu cách nhau 2 giây
    for (let i = 1; i <= 3; i++) {
        let answerRes = http.post(`${BASE_URL}/student/tests/${submissionId}/answer`, JSON.stringify({
            question_id: i, // ID câu hỏi giả định
            answer_content: "A" // Đáp án giả định
        }), authHeaders);

        let checkName = 'Lưu đáp án câu ' + i + ' thành công';
        let checkObj = {};
        checkObj[checkName] = (r) => r.status === 200;
        check(answerRes, checkObj);
        
        sleep(2); // Đọc đề và suy nghĩ mất 2s
    }

    // ----------------------------------------------------
    // BƯỚC 5: NỘP BÀI (Chốt điểm)
    // ----------------------------------------------------
    let submitRes = http.post(`${BASE_URL}/student/tests/${submissionId}/submit`, null, authHeaders);
    
    check(submitRes, {
        'Nộp bài thi thành công': (r) => r.status === 200,
    });

    sleep(1);
}
