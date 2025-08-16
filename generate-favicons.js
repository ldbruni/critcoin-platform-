const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Put your source image in the root directory as 'favicon-source.png'
const sourceImage = 'favicon-source.png';
const outputDir = './frontend/public';

const sizes = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'logo192.png', size: 192 },
  { name: 'logo512.png', size: 512 }
];

async function generateFavicons() {
  if (!fs.existsSync(sourceImage)) {
    console.error(`❌ Source image '${sourceImage}' not found!`);
    console.log('📝 Place your favicon image as "favicon-source.png" in the root directory');
    return;
  }

  console.log('🎨 Generating favicon files...');

  try {
    // Generate PNG files
    for (const { name, size } of sizes) {
      await sharp(sourceImage)
        .resize(size, size, { fit: 'cover' })
        .png()
        .toFile(path.join(outputDir, name));
      
      console.log(`✅ Generated ${name} (${size}x${size})`);
    }

    console.log('\n🚀 All favicon files generated successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Create favicon.ico manually using online tool: https://favicon.io/favicon-converter/');
    console.log('2. Or install ImageMagick and run:');
    console.log('   convert favicon-source.png -resize 16x16 favicon-source.png -resize 32x32 favicon-source.png -resize 24x24 favicon-source.png -resize 64x64 favicon.ico');
    
  } catch (error) {
    console.error('❌ Error generating favicons:', error);
  }
}

generateFavicons();