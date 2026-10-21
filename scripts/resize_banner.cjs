const sharp = require('../node_modules/sharp');
const path = require('path');
const fs = require('fs');

async function main() {
  const inputPath = 'C:/Users/dauvu/.gemini/antigravity/brain/b65e7bc0-e9b2-49dd-a7a7-144360edeb93/.user_uploaded/media_1792549232554_00cc2335.png';
  const outDir = path.resolve(__dirname, '../frontend/public/banners');
  
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // 1. Phien ban Seamless Backdrop: Nen gradient xanh ngoc emerald mo rong tu banner, khong lam meo chu va cay
  const bg = await sharp(inputPath)
    .resize(1024, 1024, { fit: 'cover', position: 'center' })
    .blur(16)
    .modulate({ brightness: 0.72, saturation: 1.15 })
    .toBuffer();

  const svgOverlay = Buffer.from(`
    <svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="vig" cx="50%" cy="50%" r="65%">
          <stop offset="30%" stop-color="#000000" stop-opacity="0"/>
          <stop offset="100%" stop-color="#03160a" stop-opacity="0.8"/>
        </radialGradient>
      </defs>
      <rect width="1024" height="1024" fill="url(#vig)"/>
    </svg>
  `);

  const banner = await sharp(inputPath).toBuffer();

  await sharp(bg)
    .composite([
      { input: svgOverlay, top: 0, left: 0 },
      { input: banner, top: 320, left: 0 }
    ])
    .webp({ quality: 95 })
    .toFile(path.join(outDir, 'popup-1111-seamless.webp'));

  await sharp(path.join(outDir, 'popup-1111-seamless.webp'))
    .png({ quality: 95 })
    .toFile(path.join(outDir, 'popup-1111-seamless.png'));

  // Copy vao artifact directory de nguoi dung xem va tai ve de dang
  const artifactDir = 'C:/Users/dauvu/.gemini/antigravity/brain/b65e7bc0-e9b2-49dd-a7a7-144360edeb93';
  fs.copyFileSync(path.join(outDir, 'popup-1111-seamless.png'), path.join(artifactDir, 'popup-1111-square-1024x1024.png'));
  fs.copyFileSync(path.join(outDir, 'popup-1111-seamless.webp'), path.join(artifactDir, 'popup-1111-square-1024x1024.webp'));

  console.log('Successfully generated seamless 1024x1024 square banner in WebP and PNG!');
}

main().catch(console.error);
