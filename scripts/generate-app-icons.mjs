/**
 * Generate all required iOS App Icon sizes from icon-512.png
 * Run: node scripts/generate-app-icons.mjs
 * Requires: sharp (already in devDependencies)
 */
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const SOURCE = join(import.meta.dirname, '..', 'public', 'icon-512.png');
const OUTPUT_DIR = join(import.meta.dirname, '..', 'ios-template', 'AppIcon.appiconset');

// iOS App Icon sizes (points × scale)
const ICONS = [
  // iPhone Notification
  { size: 20, scale: 2, filename: 'icon-20@2x.png' },
  { size: 20, scale: 3, filename: 'icon-20@3x.png' },
  // iPhone Settings
  { size: 29, scale: 2, filename: 'icon-29@2x.png' },
  { size: 29, scale: 3, filename: 'icon-29@3x.png' },
  // iPhone Spotlight
  { size: 40, scale: 2, filename: 'icon-40@2x.png' },
  { size: 40, scale: 3, filename: 'icon-40@3x.png' },
  // iPhone App
  { size: 60, scale: 2, filename: 'icon-60@2x.png' },
  { size: 60, scale: 3, filename: 'icon-60@3x.png' },
  // iPad Notifications
  { size: 20, scale: 1, filename: 'icon-20.png' },
  // iPad Settings
  { size: 29, scale: 1, filename: 'icon-29.png' },
  // iPad Spotlight
  { size: 40, scale: 1, filename: 'icon-40.png' },
  // iPad App
  { size: 76, scale: 1, filename: 'icon-76.png' },
  { size: 76, scale: 2, filename: 'icon-76@2x.png' },
  // iPad Pro App
  { size: 83.5, scale: 2, filename: 'icon-83.5@2x.png' },
  // App Store
  { size: 1024, scale: 1, filename: 'icon-1024.png' },
];

mkdirSync(OUTPUT_DIR, { recursive: true });

const contents = {
  images: [],
  info: { version: 1, author: 'generate-app-icons.mjs' },
};

for (const icon of ICONS) {
  const pixels = Math.round(icon.size * icon.scale);
  console.log(`Generating ${icon.filename} (${pixels}x${pixels}px)`);

  await sharp(SOURCE)
    .resize(pixels, pixels, { fit: 'cover', kernel: 'lanczos3' })
    .png({ quality: 100 })
    .toFile(join(OUTPUT_DIR, icon.filename));

  contents.images.push({
    filename: icon.filename,
    idiom: icon.size >= 76 && icon.scale === 1 ? 'ipad' : icon.size === 83.5 ? 'ipad' : icon.size === 1024 ? 'ios-marketing' : 'universal',
    platform: 'ios',
    size: `${icon.size}x${icon.size}`,
    scale: `${icon.scale}x`,
  });
}

writeFileSync(
  join(OUTPUT_DIR, 'Contents.json'),
  JSON.stringify(contents, null, 2)
);

console.log(`\nDone! ${ICONS.length} icons generated at:\n${OUTPUT_DIR}`);
console.log('\nAfter running "npx cap add ios", copy this folder to:');
console.log('ios/App/App/Assets.xcassets/AppIcon.appiconset/');
