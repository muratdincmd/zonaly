import { readFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");
const iconsDir = join(root, "src-tauri", "icons");
const svgPath = join(__dir, "icon.svg");

const svg = readFileSync(svgPath);
mkdirSync(iconsDir, { recursive: true });

// ── PNG sizes required by Tauri ──────────────────────────────────────────────
const pngTargets = [
  // Standard Tauri sizes
  { file: "32x32.png",              size: 32  },
  { file: "128x128.png",            size: 128 },
  { file: "128x128@2x.png",         size: 256 },
  { file: "icon.png",               size: 512 },
  // Windows Store / MSIX tiles
  { file: "Square30x30Logo.png",    size: 30  },
  { file: "Square44x44Logo.png",    size: 44  },
  { file: "Square71x71Logo.png",    size: 71  },
  { file: "Square89x89Logo.png",    size: 89  },
  { file: "Square107x107Logo.png",  size: 107 },
  { file: "Square142x142Logo.png",  size: 142 },
  { file: "Square150x150Logo.png",  size: 150 },
  { file: "Square284x284Logo.png",  size: 284 },
  { file: "Square310x310Logo.png",  size: 310 },
  { file: "StoreLogo.png",          size: 50  },
];

// ── ICO sizes (all embedded in one file) ─────────────────────────────────────
const icoSizes = [16, 24, 32, 48, 64, 128, 256];

// ── ICNS sizes (all embedded in one file) ────────────────────────────────────
const icnsSizes = [16, 32, 64, 128, 256, 512, 1024];

async function renderPng(size) {
  return sharp(svg, { density: Math.ceil((size / 1024) * 72 * 14) })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function main() {
  console.log("Generating PNG icons…");
  for (const { file, size } of pngTargets) {
    const buf = await renderPng(size);
    const dest = join(iconsDir, file);
    await sharp(buf).png().toFile(dest);
    console.log(`  ✓  ${file} (${size}px)`);
  }

  // ── ICO ──────────────────────────────────────────────────────────────────
  console.log("\nGenerating icon.ico…");
  // sharp doesn't write ICO natively; we build it manually from the spec.
  // ICO format: ICONDIR + ICONDIRENTRYs + image data (PNG allowed in Vista+)
  const icoBuffers = await Promise.all(icoSizes.map(renderPng));

  const headerSize = 6;
  const entrySize  = 16;
  const dirSize    = headerSize + icoSizes.length * entrySize;

  let offset = dirSize;
  const entries = icoBuffers.map((buf, i) => {
    const sz = icoSizes[i];
    const entry = { sz, buf, offset };
    offset += buf.length;
    return entry;
  });

  const totalSize = offset;
  const ico = Buffer.alloc(totalSize);

  // ICONDIR
  ico.writeUInt16LE(0,                   0); // reserved
  ico.writeUInt16LE(1,                   2); // type: ICO
  ico.writeUInt16LE(icoSizes.length,     4); // count

  // ICONDIRENTRYs
  entries.forEach(({ sz, buf, offset: imgOffset }, i) => {
    const base = headerSize + i * entrySize;
    ico.writeUInt8( sz > 255 ? 0 : sz, base);      // width  (0 = 256)
    ico.writeUInt8( sz > 255 ? 0 : sz, base + 1);  // height (0 = 256)
    ico.writeUInt8( 0,                 base + 2);   // color count
    ico.writeUInt8( 0,                 base + 3);   // reserved
    ico.writeUInt16LE(1,               base + 4);   // color planes
    ico.writeUInt16LE(32,              base + 6);   // bits per pixel
    ico.writeUInt32LE(buf.length,      base + 8);   // size of image data
    ico.writeUInt32LE(imgOffset,       base + 12);  // offset of image data
    buf.copy(ico, imgOffset);
  });

  const icoPath = join(iconsDir, "icon.ico");
  await sharp(ico, { raw: { width: 1, height: 1, channels: 4 } })
    .toFile(icoPath)
    .catch(() => {}); // sharp can't write ICO; write raw buffer directly

  // Write ICO directly (sharp doesn't support ICO output)
  const { writeFileSync } = await import("fs");
  writeFileSync(icoPath, ico);
  console.log(`  ✓  icon.ico (${icoSizes.join(", ")}px)`);

  // ── ICNS ─────────────────────────────────────────────────────────────────
  // Map of ICNS OSType → pixel size
  const icnsTypes = [
    { type: "icp4", size: 16  },
    { type: "icp5", size: 32  },
    { type: "icp6", size: 64  },
    { type: "ic07", size: 128 },
    { type: "ic08", size: 256 },
    { type: "ic09", size: 512 },
    { type: "ic10", size: 1024},
  ];

  console.log("\nGenerating icon.icns…");
  const icnsBuffers = await Promise.all(icnsTypes.map(({ size }) => renderPng(size)));

  // ICNS: magic (4) + file_length (4) + chunks
  let icnsSize = 8;
  const chunks = icnsTypes.map(({ type }, i) => {
    const data = icnsBuffers[i];
    icnsSize += 8 + data.length; // OSType(4) + length(4) + data
    return { type, data };
  });

  const icns = Buffer.alloc(icnsSize);
  icns.write("icns", 0, "ascii");
  icns.writeUInt32BE(icnsSize, 4);

  let pos = 8;
  for (const { type, data } of chunks) {
    icns.write(type, pos, "ascii");
    icns.writeUInt32BE(8 + data.length, pos + 4);
    data.copy(icns, pos + 8);
    pos += 8 + data.length;
    console.log(`  ✓  ${type} (${icnsTypes.find(t => t.type === type).size}px)`);
  }

  writeFileSync(join(iconsDir, "icon.icns"), icns);
  console.log("\nAll icons generated successfully.");
}

main().catch((e) => { console.error(e); process.exit(1); });
