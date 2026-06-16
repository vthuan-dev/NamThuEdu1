import { test } from '@playwright/test';

// Dynamic import to handle CJS/ESM compatibility
const getAgent = async (page: any) => {
  const mod = await import('@midscene/web');
  const AgentClass = (mod as any).Agent || (mod as any).MidsceneAgent || (mod as any).default;
  return new AgentClass(page);
};

test.describe('Midscene AI — Demo', () => {
  test('AI tự tìm và click phần tử', async ({ page }) => {
    const agent = await getAgent(page);

    await page.goto('https://namthuedu.vn/dang-nhap');

    // AI tự nhận diện field nhập liệu
    await agent.aiAction('điền số điện thoại 0904521297 vào ô đầu tiên');
    await agent.aiAction('điền mật khẩu vào ô tiếp theo');
    await agent.aiAction('click nút đăng nhập màu xanh');

    // Assert bằng AI — kiểm tra UI thực tế
    await agent.aiAssert('trang đã chuyển sang dashboard học viên, có sidebar bên trái');
  });
});
