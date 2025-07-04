const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const imagesDir = path.join(__dirname, '../public/images');
const outputDir = path.join(__dirname, '../public/images/optimized');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const imagesToOptimize = [
  { name: 'earthie_cover.png', width: 600 },
  { name: 'earthie_logo.png', width: 512 },
  { name: 'radio_thumbnail.jpeg', width: 400 },
];

async function optimizeImages() {
  for (const image of imagesToOptimize) {
    const imagePath = path.join(imagesDir, image.name);
    if (fs.existsSync(imagePath)) {
      const pipeline = sharp(imagePath);

      // --- Optimize original PNG/JPEG ---
      const originalExt = path.extname(image.name);
      const optimizedName = `${path.basename(image.name, originalExt)}_optimized${originalExt}`;
      const optimizedPath = path.join(outputDir, optimizedName);

      if (originalExt.toLowerCase() === '.png') {
        await pipeline
          .resize({ width: image.width, withoutEnlargement: true })
          .png({ quality: 80, compressionLevel: 8 })
          .toFile(optimizedPath);
      } else if (originalExt.toLowerCase() === '.jpeg' || originalExt.toLowerCase() === '.jpg') {
        await pipeline
          .resize({ width: image.width, withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toFile(optimizedPath);
      }
      console.log(`Optimized ${image.name} -> ${optimizedPath}`);

      // --- Create WebP version ---
      const webpName = `${path.basename(image.name, originalExt)}.webp`;
      const webpPath = path.join(outputDir, webpName);
      await pipeline
        .resize({ width: image.width, withoutEnlargement: true })
        .webp({ quality: 75 })
        .toFile(webpPath);
      console.log(`Created WebP version -> ${webpPath}`);

    } else {
      console.warn(`Image not found, skipping: ${imagePath}`);
    }
  }
}

optimizeImages()
  .then(() => console.log('Image optimization complete.'))
  .catch(err => console.error('Image optimization failed:', err)); 