const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Create splash directory if it doesn't exist
const splashDir = path.join(__dirname, '../public/images/splash');
if (!fs.existsSync(splashDir)) {
  fs.mkdirSync(splashDir, { recursive: true });
}

// Define splash screen sizes for iOS devices
const sizes = [
  { width: 640, height: 1136, name: 'splash-640x1136.png' },
  { width: 750, height: 1334, name: 'splash-750x1334.png' },
  { width: 1242, height: 2208, name: 'splash-1242x2208.png' },
  { width: 1125, height: 2436, name: 'splash-1125x2436.png' },
  { width: 1242, height: 2688, name: 'splash-1242x2688.png' }
];

// Source image
const sourceImage = path.join(__dirname, '../public/images/earthie_logo.png');
const backgroundColor = '#18181b';
const logoWidth = 200; // Width of the logo on the splash screen

// Generate each splash screen
async function generateSplashScreens() {
  console.log('Generating splash screens...');
  
  for (const size of sizes) {
    try {
      // Create a canvas with the background color
      const canvas = sharp({
        create: {
          width: size.width,
          height: size.height,
          channels: 4,
          background: backgroundColor
        }
      });
      
      // Resize the logo to appropriate size
      const logo = await sharp(sourceImage)
        .resize(logoWidth, null, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .toBuffer();
      
      // Calculate position to center the logo
      const logoPositionX = Math.round((size.width - logoWidth) / 2);
      const logoPositionY = Math.round((size.height / 2) - (logoWidth / 2));
      
      // Composite the logo onto the background canvas
      await canvas
        .composite([
          {
            input: logo,
            top: logoPositionY,
            left: logoPositionX,
          }
        ])
        .toFile(path.join(splashDir, size.name));
      
      console.log(`Created: ${size.name}`);
    } catch (err) {
      console.error(`Error generating ${size.name}:`, err);
    }
  }
  
  console.log('Splash screens generated successfully!');
}

generateSplashScreens().catch(console.error); 