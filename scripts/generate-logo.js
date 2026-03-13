const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const PUBLIC = path.join(__dirname, "..", "public");

const TEAL = "#2a7d6e";
const BG_R = 247, BG_G = 246, BG_B = 244; // #f7f6f4
const BG = { r: BG_R, g: BG_G, b: BG_B };

async function removeWhiteBg(inputPath, size) {
  // Load, resize, then make near-white pixels transparent
  const { data, info } = await sharp(inputPath)
    .resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Make white/near-white pixels transparent (threshold: 240+)
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) {
      data[i + 3] = 0; // set alpha to 0
    }
  }

  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
}

async function generateLogo() {
  const brainIcon = path.join(PUBLIC, "icon-brain.png");

  // === 1. Logo with text (landscape) ===
  const logoW = 1400;
  const logoH = 400;
  const brainSize = 260;

  const brainBuf = await removeWhiteBg(brainIcon, brainSize);

  const textSvg = Buffer.from(`<svg width="900" height="120" xmlns="http://www.w3.org/2000/svg">
  <text x="0" y="82" font-family="Arial, Helvetica, sans-serif" font-size="72" font-weight="700" letter-spacing="5" fill="${TEAL}">SUPORTE BIPOLAR</text>
</svg>`);

  await sharp({
    create: { width: logoW, height: logoH, channels: 4, background: BG }
  })
    .composite([
      { input: brainBuf, left: 100, top: Math.round((logoH - brainSize) / 2) },
      { input: textSvg, left: 410, top: Math.round((logoH - 120) / 2) },
    ])
    .png()
    .toFile(path.join(PUBLIC, "logo-brain-3.png"));
  console.log("✓ logo-brain-3.png");

  fs.copyFileSync(
    path.join(PUBLIC, "logo-brain-3.png"),
    path.join(PUBLIC, "logo-generated.png")
  );
  console.log("✓ logo-generated.png");

  // === 2. OG Image (1200x630) ===
  const ogW = 1200;
  const ogH = 630;
  const ogBrainSize = 200;

  const ogBrainBuf = await removeWhiteBg(brainIcon, ogBrainSize);

  const ogTextSvg = Buffer.from(`<svg width="800" height="90" xmlns="http://www.w3.org/2000/svg">
  <text x="0" y="68" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="700" letter-spacing="4" fill="${TEAL}">SUPORTE BIPOLAR</text>
</svg>`);

  const ogSubtitleSvg = Buffer.from(`<svg width="600" height="40" xmlns="http://www.w3.org/2000/svg">
  <text x="0" y="30" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#6b7280">Seu painel de estabilidade</text>
</svg>`);

  const blockW = ogBrainSize + 40 + 750;
  const startX = Math.round((ogW - blockW) / 2);
  const centerY = Math.round(ogH / 2);

  await sharp({
    create: { width: ogW, height: ogH, channels: 4, background: BG }
  })
    .composite([
      { input: ogBrainBuf, left: startX, top: centerY - Math.round(ogBrainSize / 2) },
      { input: ogTextSvg, left: startX + ogBrainSize + 40, top: centerY - 55 },
      { input: ogSubtitleSvg, left: startX + ogBrainSize + 40, top: centerY + 25 },
    ])
    .png()
    .toFile(path.join(PUBLIC, "og-image.png"));
  console.log("✓ og-image.png");

  // === 3. Favicon.png (32x32 from icon.svg with "SB") ===
  const svgPath = path.join(PUBLIC, "icon.svg");
  await sharp(svgPath)
    .resize(32, 32)
    .png()
    .toFile(path.join(PUBLIC, "favicon.png"));
  console.log("✓ favicon.png");

  // === 4. Regenerate favicon.ico from favicon.png ===
  // Sharp can't do ICO, but we can make a 32x32 PNG which browsers accept
  // The existing .ico will be replaced by the build pipeline or manually

  console.log("\nDone! All logos regenerated with 'SUPORTE BIPOLAR'");
}

generateLogo().catch(console.error);
