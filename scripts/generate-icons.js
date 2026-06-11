const sharp = require('sharp');
const path = require('path');

const logo = path.join(__dirname, '..', 'public', 'logo.png');
const publicDir = path.join(__dirname, '..', 'public');

async function main() {
  await sharp(logo)
    .resize(192, 192, { fit: 'contain', background: { r: 26, g: 10, b: 0, alpha: 1 } })
    .png()
    .toFile(path.join(publicDir, 'icon-192.png'));
  console.log('✅ icon-192.png gerado');

  await sharp(logo)
    .resize(512, 512, { fit: 'contain', background: { r: 26, g: 10, b: 0, alpha: 1 } })
    .png()
    .toFile(path.join(publicDir, 'icon-512.png'));
  console.log('✅ icon-512.png gerado');

  console.log('🎉 Ícones PWA gerados a partir de logo.png!');
}

main().catch((err) => {
  console.error('Erro:', err);
  process.exit(1);
});
