const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const PUBLIC = path.join(__dirname, "..", "public");

// Build ICO file manually from PNG buffers
function createIco(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = dirEntrySize * count;
  let dataOffset = headerSize + dirSize;

  // ICO header
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);     // reserved
  header.writeUInt16LE(1, 2);     // type = ICO
  header.writeUInt16LE(count, 4); // image count

  const dirEntries = [];
  const sizes = [32, 16]; // must match pngBuffers order

  for (let i = 0; i < count; i++) {
    const entry = Buffer.alloc(dirEntrySize);
    const size = sizes[i];
    entry.writeUInt8(size === 256 ? 0 : size, 0);  // width
    entry.writeUInt8(size === 256 ? 0 : size, 1);  // height
    entry.writeUInt8(0, 2);   // palette
    entry.writeUInt8(0, 3);   // reserved
    entry.writeUInt16LE(1, 4);  // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(pngBuffers[i].length, 8);  // data size
    entry.writeUInt32LE(dataOffset, 12);           // data offset
    dataOffset += pngBuffers[i].length;
    dirEntries.push(entry);
  }

  return Buffer.concat([header, ...dirEntries, ...pngBuffers]);
}

async function main() {
  const svgPath = path.join(PUBLIC, "icon.svg");

  const png32 = await sharp(svgPath).resize(32, 32).png().toBuffer();
  const png16 = await sharp(svgPath).resize(16, 16).png().toBuffer();

  const ico = createIco([png32, png16]);
  fs.writeFileSync(path.join(PUBLIC, "favicon.ico"), ico);

  console.log("✓ favicon.ico (16x16 + 32x32)");
}

main().catch(console.error);
