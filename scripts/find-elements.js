const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

// Function to find bounding box of non-white / colored elements in a region
function findBoundingBox(pngPath, testFn) {
  const data = fs.readFileSync(pngPath);
  const png = PNG.sync.read(data);
  let minX = png.width, minY = png.height, maxX = 0, maxY = 0;
  let count = 0;

  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const idx = (png.width * y + x) << 2;
      const r = png.data[idx];
      const g = png.data[idx + 1];
      const b = png.data[idx + 2];
      const a = png.data[idx + 3];

      if (testFn(r, g, b, a, x, y)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        count++;
      }
    }
  }

  if (count === 0) return null;
  return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1, count };
}

console.log('--- 04_create_it_support_form.png: Orange Submit Button ---');
// In 04, find the orange submit button "KIRIM SERVICE TICKET"
const orangeBtn = findBoundingBox(
  'apps/frontend/public/kb/user-guide/raw/04_create_it_support_form.png',
  (r, g, b, a, x, y) => {
    // Orange/amber button color typically r > 220, g ~ 120-180, b < 120
    return r > 220 && g > 110 && g < 190 && b < 140 && y > 500 && x > 1200;
  }
);
console.log('Orange button:', orangeBtn);

console.log('--- 05_create_dev_ticket_form.png: Blue/Cyan Submit Button ---');
// In 05, find the blue button "KIRIM TIKET ORACLE"
const devBtn = findBoundingBox(
  'apps/frontend/public/kb/user-guide/raw/05_create_dev_ticket_form.png',
  (r, g, b, a, x, y) => {
    // Blue/cyan button: r < 140, g > 150, b > 200, or similar
    return b > 200 && r < 160 && y > 600 && x > 1200;
  }
);
console.log('Dev button:', devBtn);

console.log('--- 06_ticket_detail_chat_rating.png: Chat Input & Send Button ---');
// In 06, find the blue send button in chat bar at bottom right
const chatSendBtn = findBoundingBox(
  'apps/frontend/public/kb/user-guide/raw/06_ticket_detail_chat_rating.png',
  (r, g, b, a, x, y) => {
    return b > 180 && r < 100 && y > 850 && x > 1400;
  }
);
console.log('Chat Send button:', chatSendBtn);
