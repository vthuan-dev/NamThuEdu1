import { test as base } from '@playwright/test';
import { PlaywrightAiFixture } from '@midscene/web/playwright';

const test = base.extend(PlaywrightAiFixture());

test.describe('Midscene AI — Demo', () => {
  test('AI tự tìm và click phần tử', async ({ page, ai }) => {

    await page.goto('https://namthuedu.vn/dang-nhap');

    // AI tự nhận diện field nhập liệu
    await ai('điền số điện thoại 0904521297 vào ô đầu tiên');
    await ai('điền mật khẩu vào ô tiếp theo');
    await ai('click nút đăng nhập màu xanh');

    // Assert bằng AI — kiểm tra UI thực tế
    await ai('assert: trang đã chuyển sang dashboard học viên, có sidebar bên trái');
  });
});
