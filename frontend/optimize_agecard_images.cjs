/**
 * Nén 3 ảnh thẻ nhóm tuổi ở trang "Tạo đề thi mới" sang WebP.
 *
 * Vấn đề: agecard-kids/teens/adults.png đều là PNG 1024x1024 (404–554 KB,
 * tổng ~1.4 MB), trong khi khung hiển thị chỉ cao 112px (class h-28) và rộng
 * khoảng 190px trên desktop, ~380px khi mobile xếp 1 cột. Ảnh gốc lớn gấp
 * nhiều lần mức cần, lại ở định dạng không phù hợp cho tranh nhiều màu.
 *
 * Xuất 2 phiên bản mỗi ảnh:
 *   *-800.webp  cho màn Retina (2x của 400px)
 *   *-400.webp  cho màn thường
 * Giữ nguyên PNG gốc làm fallback cho trình duyệt không hỗ trợ WebP.
 *
 * Chạy: node optimize_agecard_images.cjs  (từ thư mục frontend)
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const dir = path.join(__dirname, 'public', 'images');
const files = ['agecard-kids.png', 'agecard-teens.png', 'agecard-adults.png'];

(async () => {
  let tongGoc = 0;
  let tong1x = 0;

  for (const f of files) {
    const src = path.join(dir, f);
    const base = f.replace(/\.png$/, '');
    const goc = fs.statSync(src).size;
    tongGoc += goc;

    const meta = await sharp(src).metadata();
    // Không upscale: nếu ảnh gốc nhỏ hơn mức mong muốn thì giữ bề rộng gốc.
    const w2x = Math.min(800, meta.width);
    const w1x = Math.min(400, meta.width);

    const out2x = path.join(dir, `${base}-800.webp`);
    const out1x = path.join(dir, `${base}-400.webp`);

    await sharp(src).resize({ width: w2x }).webp({ quality: 82, effort: 6 }).toFile(out2x);
    await sharp(src).resize({ width: w1x }).webp({ quality: 82, effort: 6 }).toFile(out1x);

    const s2 = fs.statSync(out2x).size;
    const s1 = fs.statSync(out1x).size;
    tong1x += s1;

    const kb = (n) => (n / 1024).toFixed(0) + ' KB';
    const giam = (n) => (100 - (n / goc) * 100).toFixed(0) + '%';

    console.log(`${f}  goc ${kb(goc)} (${meta.width}x${meta.height})`);
    console.log(`   ${base}-800.webp  ${kb(s2)}  giam ${giam(s2)}  (${w2x}px)`);
    console.log(`   ${base}-400.webp  ${kb(s1)}  giam ${giam(s1)}  (${w1x}px)`);
  }

  const kb = (n) => (n / 1024).toFixed(0) + ' KB';
  console.log(`\nTong tai ve o man thuong: ${kb(tongGoc)} -> ${kb(tong1x)}`);
})().catch((e) => { console.error(e); process.exit(1); });
