/**
 * Nén ảnh 2 trang đăng nhập sang WebP.
 *
 * Vấn đề: form-login.png 1732 KB và form-login-gv.png 1857 KB, trong khi khung
 * hiển thị tối đa chỉ 770px. Ảnh gốc 1370px và 1254px — vừa nặng vì là PNG
 * (định dạng không phù hợp cho ảnh nhiều màu/gradient), vừa lớn hơn mức cần.
 *
 * Xuất 2 phiên bản mỗi ảnh:
 *   *-1540.webp  cho màn Retina (2x của 770px)
 *   *-770.webp   cho màn thường
 * Giữ nguyên file PNG gốc để làm fallback cho trình duyệt quá cũ.
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const dir = path.join(__dirname, 'public', 'images');
const files = ['form-login.png', 'form-login-gv.png'];

(async () => {
  for (const f of files) {
    const src = path.join(dir, f);
    const base = f.replace(/\.png$/, '');
    const goc = fs.statSync(src).size;

    const meta = await sharp(src).metadata();
    // Không upscale: nếu ảnh gốc nhỏ hơn mức mong muốn thì giữ nguyên bề rộng gốc.
    const w2x = Math.min(1540, meta.width);
    const w1x = Math.min(770, meta.width);

    const out2x = path.join(dir, `${base}-1540.webp`);
    const out1x = path.join(dir, `${base}-770.webp`);

    await sharp(src).resize({ width: w2x }).webp({ quality: 82, effort: 6 }).toFile(out2x);
    await sharp(src).resize({ width: w1x }).webp({ quality: 82, effort: 6 }).toFile(out1x);

    const s2 = fs.statSync(out2x).size;
    const s1 = fs.statSync(out1x).size;
    const kb = (n) => (n / 1024).toFixed(0) + ' KB';
    const giam = (n) => (100 - (n / goc) * 100).toFixed(0) + '%';

    console.log(`${f}  goc ${kb(goc)} (${meta.width}x${meta.height})`);
    console.log(`   ${base}-1540.webp  ${kb(s2)}  giam ${giam(s2)}  (${w2x}px)`);
    console.log(`   ${base}-770.webp   ${kb(s1)}  giam ${giam(s1)}  (${w1x}px)`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
