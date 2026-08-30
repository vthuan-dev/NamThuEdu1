import { describe, it, expect } from 'vitest';
import {
  resolveScoreScale,
  getSubmissionDisplayScore,
  toRawScore,
  isIeltsExam,
} from './gradeHelpers';

/**
 * `submissions.sScore` không có thang thống nhất — mỗi luồng chấm lưu một kiểu
 * (THPT đã quy đổi sẵn, GENERAL là phần trăm, VSTEP/IELTS là band × 10).
 *
 * Các test dưới đây neo lại đúng những con số THẬT lấy từ DB production để
 * tránh tái phát lỗi hiển thị "3.40/100" cho bài THPT 3.40/10.
 */
describe('thang điểm theo từng loại đề', () => {
  it('THPT: sScore đã là điểm quy đổi nên không chia thêm', () => {
    // Dữ liệu thật: eType=THPT, sScore=3.40, thpt_config.scale_max=10.
    // Trước khi sửa UI hiện "3.40/100" → trông như 3.4%.
    const ds = getSubmissionDisplayScore({
      examType: 'THPT',
      score: 3.4,
      scaleMax: 10,
    });
    expect(ds).toEqual({ value: 3.4, max: 10, label: 'hệ 10' });
  });

  it('THPT: tôn trọng scale_max giáo viên đặt khác 10', () => {
    const ds = getSubmissionDisplayScore({ examType: 'THPT', score: 87, scaleMax: 100 });
    expect(ds?.value).toBe(87);
    expect(ds?.max).toBe(100);
  });

  it('GENERAL: sScore là phần trăm nên quy về hệ 10', () => {
    // Dữ liệu thật: eType=GENERAL, sScore=37.50 → phải ra 3.75/10.
    const ds = getSubmissionDisplayScore({ examType: 'GENERAL', score: 37.5 });
    expect(ds).toEqual({ value: 3.75, max: 10, label: 'hệ 10' });
  });

  it('GENERAL: điểm tối đa 100% ra đúng 10/10', () => {
    const ds = getSubmissionDisplayScore({ examType: 'GENERAL', score: 100 });
    expect(ds?.value).toBe(10);
  });

  it('VSTEP: giữ band 0-10, chia 10 từ giá trị thô', () => {
    const ds = getSubmissionDisplayScore({ examType: 'VSTEP', score: 65 });
    expect(ds).toEqual({ value: 6.5, max: 10, label: 'band VSTEP' });
  });

  it('IELTS: giữ band 0-9 chứ không quy về hệ 10', () => {
    // Quy về hệ 10 sẽ biến band 7.0 thành 7.8 — vô nghĩa với giáo viên IELTS.
    const ds = getSubmissionDisplayScore({ examType: 'IELTS', score: 70 });
    expect(ds).toEqual({ value: 7, max: 9, label: 'band IELTS' });
  });

  it('IELTS_ACADEMIC cũng được nhận là IELTS', () => {
    // eType thật trong DB có biến thể IELTS_ACADEMIC (xem migration
    // add_ielts_skill_to_exams_table).
    expect(isIeltsExam('IELTS_ACADEMIC')).toBe(true);
    expect(resolveScoreScale({ examType: 'IELTS_ACADEMIC' }).max).toBe(9);
  });

  it('IELTS được ưu tiên nhận diện trước VSTEP', () => {
    // Thứ tự kiểm tra quan trọng: cả hai đều là đề "band", nếu xét VSTEP trước
    // thì đề IELTS sẽ bị gán thang 10.
    expect(resolveScoreScale({ examType: 'IELTS' }).max).toBe(9);
  });

  it('không có điểm thì trả null', () => {
    expect(getSubmissionDisplayScore({ examType: 'GENERAL' })).toBeNull();
  });

  it('điểm 0 vẫn hiển thị, không bị coi là thiếu điểm', () => {
    // Dữ liệu thật có nhiều bài sScore=0.00; nếu dùng kiểm tra falsy thì các
    // bài này sẽ hiện dấu "—" thay vì 0 điểm.
    const ds = getSubmissionDisplayScore({ examType: 'GENERAL', score: 0 });
    expect(ds?.value).toBe(0);
  });

  it('VSTEP chưa có sScore thì lấy trung bình 4 kỹ năng của AI', () => {
    const feedback = JSON.stringify({
      vstep_scores: { listening: 6, reading: 7, writing: 6.5, speaking: 6.5 },
    });
    const ds = getSubmissionDisplayScore({ examType: 'VSTEP', sGemini_feedback: feedback });
    expect(ds?.value).toBe(6.5);
    expect(ds?.max).toBe(10);
  });

  it('scale_max = 0 hoặc null rơi về hệ 10 mặc định', () => {
    // Phòng trường hợp dữ liệu cũ có scale_max = 0 → tránh chia cho 0.
    expect(resolveScoreScale({ examType: 'GENERAL', scaleMax: 0 }).max).toBe(10);
    expect(resolveScoreScale({ examType: 'GENERAL', scaleMax: null }).max).toBe(10);
    expect(Number.isFinite(getSubmissionDisplayScore({ examType: 'GENERAL', score: 50, scaleMax: 0 })!.value)).toBe(true);
  });
});

describe('quy đổi ngược khi lưu điểm', () => {
  it('GENERAL: giáo viên nhập 8/10 phải lưu thành 80 phần trăm', () => {
    // Đây là lỗi mất điểm thật: không quy đổi thì sScore = 8, tức 8%.
    expect(toRawScore(8, { examType: 'GENERAL' })).toBe(80);
  });

  it('THPT: giáo viên nhập 8/10 lưu nguyên 8', () => {
    expect(toRawScore(8, { examType: 'THPT', scaleMax: 10 })).toBe(8);
  });

  it('VSTEP: band 6.5 lưu thành 65', () => {
    expect(toRawScore(6.5, { examType: 'VSTEP' })).toBe(65);
  });

  it('IELTS: band 7 lưu thành 70', () => {
    expect(toRawScore(7, { examType: 'IELTS' })).toBe(70);
  });

  it('quy đổi hai chiều không làm lệch điểm', () => {
    // Vòng hiển thị → lưu → hiển thị phải trả về đúng giá trị ban đầu, nếu không
    // mỗi lần giáo viên mở modal rồi lưu lại sẽ làm điểm trôi dần.
    const cases: Array<{ examType: string; display: number; scaleMax?: number }> = [
      { examType: 'GENERAL', display: 3.75 },
      { examType: 'GENERAL', display: 8 },
      { examType: 'THPT', display: 3.4, scaleMax: 10 },
      { examType: 'VSTEP', display: 6.5 },
      { examType: 'IELTS', display: 7.5 },
    ];
    for (const c of cases) {
      const raw = toRawScore(c.display, { examType: c.examType, scaleMax: c.scaleMax });
      const back = getSubmissionDisplayScore({
        examType: c.examType,
        score: raw,
        scaleMax: c.scaleMax,
      });
      expect(back?.value).toBeCloseTo(c.display, 5);
    }
  });
});
