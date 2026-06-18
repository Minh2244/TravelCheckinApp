const { removeBackground } = require('@imgly/background-removal-node');
const fs = require('fs');

async function processImage() {
  const inputPath = "E:/TravelCheckinApp/mobile/assets/mascot.jpg";
  const outputPath = "E:/TravelCheckinApp/mobile/assets/mascot_transparent.png";
  
  console.log("Removing background...");
  const inputBuffer = fs.readFileSync(inputPath);
  const blobIn = new Blob([inputBuffer], { type: 'image/jpeg' });
  const blob = await removeBackground(blobIn);
  const arrayBuffer = await blob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  fs.writeFileSync(outputPath, buffer);
  console.log("Done!");
}

processImage().catch(console.error);
