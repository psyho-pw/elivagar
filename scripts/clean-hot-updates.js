const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) return;

function cleanHotUpdates(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      cleanHotUpdates(full);
    } else if (name.includes('hot-update')) {
      fs.unlinkSync(full);
    }
  }
}

cleanHotUpdates(distDir);
