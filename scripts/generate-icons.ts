// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp = require("sharp") as typeof import("sharp").default;
import path from "path";

const PUBLIC = path.join(process.cwd(), "public");

const CONFIGS = [
  { type: "totem",   bg: "#F6F0E5", sizes: [192, 512] },
  { type: "admin",   bg: "#3B2415", sizes: [192, 512] },
  { type: "pedidos", bg: "#C8853A", sizes: [192, 512] },
];

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

async function generate() {
  const logoPath = path.join(PUBLIC, "logo.png");

  for (const { type, bg, sizes } of CONFIGS) {
    const { r, g, b } = hexToRgb(bg);

    for (const size of sizes) {
      const padding = Math.round(size * 0.15);
      const logoSize = size - padding * 2;

      const logoBuffer = await sharp(logoPath)
        .resize(logoSize, logoSize, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .toBuffer();

      await sharp({
        create: {
          width: size,
          height: size,
          channels: 4,
          background: { r, g, b, alpha: 255 },
        },
      })
        .composite([{ input: logoBuffer, gravity: "centre" }])
        .png()
        .toFile(path.join(PUBLIC, `icon-${type}-${size}.png`));

      console.log(`✓ icon-${type}-${size}.png`);
    }
  }
}

generate().catch(console.error);
