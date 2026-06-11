const sharp = require('sharp');
const path = require('path');

async function generateIcon(size, outputPath) {
  const fontSize = Math.round(size * 0.38);
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="${Math.round(size * 0.18)}" fill="#C8853A"/>
      <text
        x="50%" y="52%"
        dominant-baseline="middle"
        text-anchor="middle"
        font-family="Arial, sans-serif"
        font-weight="bold"
        font-size="${fontSize}"
        fill="#1A0A00"
      >CB</text>
    </svg>
  `;

  await sharp(Buffer.from(svg)).png().toFile(outputPath);
  console.log(`✅ Gerado: ${outputPath} (${size}x${size})`);
}

async function main() {
  const publicDir = path.join(__dirname, '..', 'public');
  await generateIcon(192, path.join(publicDir, 'icon-192.png'));
  await generateIcon(512, path.join(publicDir, 'icon-512.png'));
  console.log('🎉 Ícones PWA gerados!');
}

main().catch((err) => {
  console.error('Erro:', err);
  process.exit(1);
});
