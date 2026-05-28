/**
 * Generates installer branding assets for Windows (NSIS) and macOS (DMG).
 * All assets use the exact same visual language as icon.svg:
 *   - Rounded square bg: linear-gradient #6366f1 → #4338ca (top-left to bottom-right)
 *   - Globe arcs: 4 ellipses at same proportions as icon.svg
 *   - Z lettermark: same stroke proportions as icon.svg
 *
 * Windows NSIS:
 *   - installer-banner.bmp  150×57
 *   - installer-sidebar.bmp 164×314
 *
 * macOS DMG:
 *   - dmg-background.png    660×400
 *
 * Run: node scripts/generate-installer-assets.mjs
 */

import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = join(__dir, "..");
const out   = join(root, "src-tauri", "icons");
mkdirSync(out, { recursive: true });

// ── Exact colours from icon.svg ───────────────────────────────────────────────
const GRAD_START = "#6366f1"; // indigo-500
const GRAD_END   = "#4338ca"; // indigo-700
const BG_DARK    = "#0f0e1a"; // near-black background for installer pages

// ── Icon tile SVG (mirrors icon.svg exactly, scaled to `sz` px) ──────────────
// icon.svg viewport is 1024×1024. We scale everything by (sz/1024).
function iconTileSvg(sz) {
  const s = sz / 1024;
  const rx = 224 * s;

  // Globe arc parameters from icon.svg (cx=512,cy=512, radii as in file)
  // Scaled to our viewport
  const cx = sz / 2;
  const cy = sz / 2;
  const r1 = 270 * s; // outer circle
  const r2x = 270 * s; const r2y = 112 * s; // lat ellipse 1
  const r3x = 270 * s; const r3y = 40  * s; // lat ellipse 2
  const r4x = 112 * s; const r4y = 270 * s; // meridian

  const sw1 = 22 * s;
  const sw2 = 18 * s;
  const sw3 = 14 * s;

  // Z lettermark from icon.svg: 310,312 → 714,312 / 714,312→310,712 / 310,712→714,712
  const zSw = 82 * s;
  const x1 = 310 * s; const x2 = 714 * s;
  const y1 = 312 * s; const y2 = 712 * s;

  return `
  <defs>
    <linearGradient id="icon_bg_${sz}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${GRAD_START}"/>
      <stop offset="100%" stop-color="${GRAD_END}"/>
    </linearGradient>
  </defs>
  <rect width="${sz}" height="${sz}" rx="${rx}" ry="${rx}" fill="url(#icon_bg_${sz})"/>
  <rect width="${sz}" height="${sz}" rx="${rx}" ry="${rx}"
        fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="${1 * s}"/>
  <ellipse cx="${cx}" cy="${cy}" rx="${r1}"  ry="${r1}"
           fill="none" stroke="rgba(255,255,255,0.13)" stroke-width="${sw1}"/>
  <ellipse cx="${cx}" cy="${cy}" rx="${r2x}" ry="${r2y}"
           fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="${sw2}"/>
  <ellipse cx="${cx}" cy="${cy}" rx="${r3x}" ry="${r3y}"
           fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="${sw3}"/>
  <ellipse cx="${cx}" cy="${cy}" rx="${r4x}" ry="${r4y}"
           fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="${sw2}"/>
  <g fill="none" stroke="white" stroke-width="${zSw}"
     stroke-linecap="round" stroke-linejoin="round">
    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y1}"/>
    <line x1="${x2}" y1="${y1}" x2="${x1}" y2="${y2}"/>
    <line x1="${x1}" y1="${y2}" x2="${x2}" y2="${y2}"/>
  </g>`;
}

// ── PNG → 24-bit uncompressed BMP (required by NSIS) ─────────────────────────
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
}

async function pngToBmp(pngBuf, bgHex = BG_DARK) {
  const bg = hexToRgb(bgHex);
  const { data, info } = await sharp(pngBuf)
    .flatten({ background: bg })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const rowPadded  = Math.ceil((width * 3) / 4) * 4;
  const pixelBytes = rowPadded * height;
  const fileSize   = 54 + pixelBytes;
  const bmp        = Buffer.alloc(fileSize, 0);

  bmp.write("BM", 0, "ascii");
  bmp.writeUInt32LE(fileSize, 2);
  bmp.writeUInt32LE(54, 10);
  bmp.writeUInt32LE(40,         14);
  bmp.writeInt32LE(width,       18);
  bmp.writeInt32LE(height,      22);
  bmp.writeUInt16LE(1,          26);
  bmp.writeUInt16LE(24,         28);
  bmp.writeUInt32LE(0,          30);
  bmp.writeUInt32LE(pixelBytes, 34);
  bmp.writeInt32LE(2835,        38);
  bmp.writeInt32LE(2835,        42);

  for (let row = 0; row < height; row++) {
    const dstBase = 54 + (height - 1 - row) * rowPadded;
    for (let col = 0; col < width; col++) {
      const s = (row * width + col) * channels;
      bmp[dstBase + col * 3 + 0] = data[s + 2];
      bmp[dstBase + col * 3 + 1] = data[s + 1];
      bmp[dstBase + col * 3 + 2] = data[s + 0];
    }
  }
  return bmp;
}

// ── 1. NSIS header banner — 150×57 ───────────────────────────────────────────
async function genBanner() {
  const W = 150, H = 57;
  const iSz = 38; // icon tile size
  const iX  = 9;
  const iY  = Math.round((H - iSz) / 2);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <!-- Dark page background -->
  <rect width="${W}" height="${H}" fill="${BG_DARK}"/>

  <!-- Subtle right-side gradient wash matching brand colour -->
  <rect x="${W * 0.5}" y="0" width="${W * 0.5}" height="${H}"
        fill="${GRAD_START}" opacity="0.07"/>

  <!-- Top & bottom accent lines in brand colour -->
  <line x1="0" y1="1"         x2="${W}" y2="1"
        stroke="${GRAD_START}" stroke-width="2" opacity="0.85"/>
  <line x1="0" y1="${H - 1}"  x2="${W}" y2="${H - 1}"
        stroke="${GRAD_START}" stroke-width="1" opacity="0.35"/>

  <!-- Icon tile (exact icon.svg reproduction) -->
  <g transform="translate(${iX},${iY})">
    <svg width="${iSz}" height="${iSz}" viewBox="0 0 ${iSz} ${iSz}">
      ${iconTileSvg(iSz)}
    </svg>
  </g>

  <!-- "Zonaly" wordmark: "Zon" white, "aly" accent #818cf8 -->
  <text x="${iX + iSz + 10}" y="${H / 2 + 1}"
        font-family="Segoe UI, Helvetica Neue, Arial, sans-serif"
        font-size="21" font-weight="700" letter-spacing="-0.4"
        dominant-baseline="middle">
    <tspan fill="white">Zon</tspan><tspan fill="#818cf8">aly</tspan>
  </text>
</svg>`;

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  writeFileSync(join(out, "installer-banner.bmp"), await pngToBmp(png));
  console.log("  ✓  installer-banner.bmp (150×57)");
}

// ── 2. NSIS sidebar — 164×314 ────────────────────────────────────────────────
async function genSidebar() {
  const W = 164, H = 314;
  const iSz = 72;
  const iX  = Math.round((W - iSz) / 2);
  const iY  = Math.round(H * 0.24);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="page_bg" x1="0%" y1="0%" x2="40%" y2="100%">
      <stop offset="0%"   stop-color="#13112b"/>
      <stop offset="100%" stop-color="#0f0d20"/>
    </linearGradient>
    <linearGradient id="wordmark_grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#c7d2fe"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#page_bg)"/>

  <!-- Top accent bar -->
  <rect x="0" y="0" width="${W}" height="3"
        fill="${GRAD_START}" opacity="0.85"/>

  <!-- Icon tile -->
  <g transform="translate(${iX},${iY})">
    <svg width="${iSz}" height="${iSz}" viewBox="0 0 ${iSz} ${iSz}">
      ${iconTileSvg(iSz)}
    </svg>
  </g>

  <!-- "Zonaly" wordmark: "Zon" white, "aly" accent #818cf8 -->
  <text x="${W / 2}" y="${iY + iSz + 24}"
        font-family="Segoe UI, Helvetica Neue, Arial, sans-serif"
        font-size="26" font-weight="700" letter-spacing="-0.5"
        text-anchor="middle">
    <tspan fill="white">Zon</tspan><tspan fill="#818cf8">aly</tspan>
  </text>

  <!-- Bottom accent bar -->
  <rect x="0" y="${H - 2}" width="${W}" height="2"
        fill="${GRAD_START}" opacity="0.4"/>
</svg>`;

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  writeFileSync(join(out, "installer-sidebar.bmp"), await pngToBmp(png));
  console.log("  ✓  installer-sidebar.bmp (164×314)");
}

// ── 3. DMG background — 660×400 ──────────────────────────────────────────────
async function genDmgBackground() {
  const W = 660, H = 400;

  // Large watermark icon tile, very low opacity, centred
  const wmSz = 260;
  const wmX  = Math.round((W - wmSz) / 2);
  const wmY  = Math.round((H - wmSz) / 2) - 20;

  // Arrow between app icon drop zone (180,220) and Applications folder (480,220)
  const arrowY  = 232;
  const arrowX1 = 254;
  const arrowX2 = 406;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="page_bg" x1="0%" y1="0%" x2="55%" y2="100%">
      <stop offset="0%"   stop-color="#14112e"/>
      <stop offset="50%"  stop-color="${BG_DARK}"/>
      <stop offset="100%" stop-color="#0b0916"/>
    </linearGradient>
    <radialGradient id="centre_glow" cx="50%" cy="48%" r="40%">
      <stop offset="0%"   stop-color="${GRAD_START}" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="${GRAD_START}" stop-opacity="0"/>
    </radialGradient>
    <marker id="arr" markerWidth="8" markerHeight="6"
            refX="8" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="rgba(255,255,255,0.28)"/>
    </marker>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#page_bg)"/>
  <ellipse cx="${W / 2}" cy="${H / 2}" rx="${W * 0.52}" ry="${H * 0.52}"
           fill="url(#centre_glow)"/>

  <!-- Watermark: icon tile at ~5% opacity -->
  <g transform="translate(${wmX},${wmY})" opacity="0.055">
    <svg width="${wmSz}" height="${wmSz}" viewBox="0 0 ${wmSz} ${wmSz}">
      ${iconTileSvg(wmSz)}
    </svg>
  </g>

  <!-- Top accent line -->
  <rect x="0" y="0" width="${W}" height="2"
        fill="${GRAD_START}" opacity="0.6"/>

  <!-- Drag arrow -->
  <line x1="${arrowX1}" y1="${arrowY}" x2="${arrowX2}" y2="${arrowY}"
        stroke="rgba(255,255,255,0.24)" stroke-width="1.5"
        marker-end="url(#arr)"/>

  <!-- "Drag Zonaly to Applications" label -->
  <text x="${W / 2}" y="${arrowY + 34}"
        font-family="-apple-system, Helvetica Neue, Arial, sans-serif"
        font-size="12" letter-spacing="0.2"
        fill="rgba(255,255,255,0.32)" text-anchor="middle">
    Drag Zonaly to Applications
  </text>

  <!-- Bottom-right corner watermark text -->
  <text x="${W - 18}" y="${H - 14}"
        font-family="-apple-system, Helvetica Neue, Arial, sans-serif"
        font-size="11" font-weight="600" letter-spacing="1.2"
        fill="rgba(255,255,255,0.12)" text-anchor="end">ZONALY</text>
</svg>`;

  await sharp(Buffer.from(svg)).png().toFile(join(out, "dmg-background.png"));
  console.log("  ✓  dmg-background.png (660×400)");
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Generating installer assets…\n");
  console.log("Windows NSIS:");
  await genBanner();
  await genSidebar();
  console.log("\nmacOS DMG:");
  await genDmgBackground();
  console.log("\nAll installer assets generated successfully.");
}

main().catch(e => { console.error(e); process.exit(1); });
