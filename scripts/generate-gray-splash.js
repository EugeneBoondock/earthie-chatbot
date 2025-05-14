const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Create splash directory if it doesn't exist
const splashDir = path.join(__dirname, '../public/images/splash-gray');
if (!fs.existsSync(splashDir)) {
  fs.mkdirSync(splashDir, { recursive: true });
}

// Define splash screen sizes for iOS devices (same as original)
const sizes = [
  { width: 640, height: 1136, name: 'splash-640x1136.png' },
  { width: 750, height: 1334, name: 'splash-750x1334.png' },
  { width: 1242, height: 2208, name: 'splash-1242x2208.png' },
  { width: 1125, height: 2436, name: 'splash-1125x2436.png' },
  { width: 1242, height: 2688, name: 'splash-1242x2688.png' }
];

// Match your app's background color
// Using earthie dark color from your theme (exact match with SplashScreen.tsx)
const backgroundColor = '#0f172a';

// Generate each plain splash screen
async function generatePlainSplashScreens() {
  console.log('Generating plain splash screens...');
  
  for (const size of sizes) {
    try {
      // Create a canvas with only the background color
      await sharp({
        create: {
          width: size.width,
          height: size.height,
          channels: 4,
          background: backgroundColor
        }
      })
      .toFile(path.join(splashDir, size.name));
      
      console.log(`Created: ${size.name}`);
    } catch (err) {
      console.error(`Error generating ${size.name}:`, err);
    }
  }
  
  console.log('Plain splash screens generated successfully!');
}

generatePlainSplashScreens().catch(console.error); 