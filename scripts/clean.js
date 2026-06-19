const fs = require('fs');
const path = require('path');

const pathsToClean = [
  path.join(__dirname, '../data'),
  path.join(__dirname, '../logs')
];

console.log('Starting cleanup...');

pathsToClean.forEach((targetPath) => {
  if (fs.existsSync(targetPath)) {
    try {
      fs.rmSync(targetPath, { recursive: true, force: true });
      console.log(`Successfully removed: ${targetPath}`);
    } catch (err) {
      console.error(`Failed to remove ${targetPath}:`, err.message);
    }
  } else {
    console.log(`Path does not exist (skipping): ${targetPath}`);
  }
});

console.log('Cleanup complete.');
