const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Simple CRC32 implementation for PNG chunks
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 0xedb88320 ^ (c >>> 1);
    } else {
      c = c >>> 1;
    }
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const body = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(body);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([lenBuf, body, crcBuf]);
}

function createPng(width, height, drawFn) {
  const rawData = Buffer.alloc(height * (1 + width * 4));
  
  const getPixel = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return [0, 0, 0, 0];
    const rowOffset = y * (1 + width * 4) + 1;
    const pxOffset = rowOffset + x * 4;
    return [
      rawData[pxOffset],
      rawData[pxOffset + 1],
      rawData[pxOffset + 2],
      rawData[pxOffset + 3]
    ];
  };

  const setPixel = (x, y, r, g, b, a = 255) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const rowOffset = y * (1 + width * 4) + 1;
    const pxOffset = rowOffset + x * 4;
    
    if (a < 255 && rawData[pxOffset + 3] > 0) {
      const prevA = rawData[pxOffset + 3] / 255;
      const curA = a / 255;
      const outA = curA + prevA * (1 - curA);
      rawData[pxOffset] = Math.round((r * curA + rawData[pxOffset] * prevA * (1 - curA)) / outA);
      rawData[pxOffset + 1] = Math.round((g * curA + rawData[pxOffset + 1] * prevA * (1 - curA)) / outA);
      rawData[pxOffset + 2] = Math.round((b * curA + rawData[pxOffset + 2] * prevA * (1 - curA)) / outA);
      rawData[pxOffset + 3] = Math.round(outA * 255);
    } else {
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  };

  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0;
  }

  drawFn(setPixel, width, height, getPixel);

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdrChunk = createChunk('IHDR', ihdrData);

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

const iconsDir = path.join(__dirname, 'assets', 'tray-icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

function hexToRgba(hex, alpha = 255) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return [r, g, b, alpha];
}

// Draw a filled circle with anti-aliasing
function drawCircle(setPixel, cx, cy, radius, hex, alpha = 255) {
  const [r, g, b] = hexToRgba(hex, alpha);
  const rInner = radius - 0.7;
  const rOuter = radius + 0.7;
  const minX = Math.floor(cx - rOuter);
  const maxX = Math.ceil(cx + rOuter);
  const minY = Math.floor(cy - rOuter);
  const maxY = Math.ceil(cy + rOuter);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dist = Math.hypot(x - cx, y - cy);
      if (dist <= rInner) {
        setPixel(x, y, r, g, b, alpha);
      } else if (dist < rOuter) {
        const factor = (rOuter - dist) / (rOuter - rInner);
        setPixel(x, y, r, g, b, Math.round(alpha * factor));
      }
    }
  }
}

// Draw a line with anti-aliasing
function drawLine(setPixel, x0, y0, x1, y1, width, hex, alpha = 255) {
  const [r, g, b] = hexToRgba(hex, alpha);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  if (len === 0) return;
  const steps = Math.ceil(len * 3);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = x0 + dx * t;
    const cy = y0 + dy * t;
    drawCircle(setPixel, cx, cy, width / 2, hex, alpha);
  }
}

// Draw a rounded rectangle
function drawRoundedRect(setPixel, x, y, w, h, radius, hex, alpha = 255) {
  const [r, g, b] = hexToRgba(hex, alpha);
  const x1 = x, x2 = x + w - 1;
  const y1 = y, y2 = y + h - 1;
  
  for (let py = Math.floor(y1); py <= Math.ceil(y2); py++) {
    for (let px = Math.floor(x1); px <= Math.ceil(x2); px++) {
      // Check distance to corners
      let inside = true;
      let dist = 0;
      if (px < x1 + radius && py < y1 + radius) {
        dist = Math.hypot(px - (x1 + radius), py - (y1 + radius));
        inside = dist <= radius;
      } else if (px > x2 - radius && py < y1 + radius) {
        dist = Math.hypot(px - (x2 - radius), py - (y1 + radius));
        inside = dist <= radius;
      } else if (px < x1 + radius && py > y2 - radius) {
        dist = Math.hypot(px - (x1 + radius), py - (y2 - radius));
        inside = dist <= radius;
      } else if (px > x2 - radius && py > y2 - radius) {
        dist = Math.hypot(px - (x2 - radius), py - (y2 - radius));
        inside = dist <= radius;
      }

      if (inside) {
        setPixel(px, py, r, g, b, alpha);
      }
    }
  }
}

// Draw hollow rounded rect (border)
function drawRoundedRectBorder(setPixel, x, y, w, h, radius, strokeWidth, hex, alpha = 255) {
  drawLine(setPixel, x + radius, y, x + w - radius, y, strokeWidth, hex, alpha);
  drawLine(setPixel, x + radius, y + h, x + w - radius, y + h, strokeWidth, hex, alpha);
  drawLine(setPixel, x, y + radius, x, y + h - radius, strokeWidth, hex, alpha);
  drawLine(setPixel, x + w, y + radius, x + w, y + h - radius, strokeWidth, hex, alpha);
}

// 1. Crown / Server Master Icon
function drawCrown(size) {
  return (setPixel, w, h) => {
    const s = size / 16;
    // Draw gold crown
    const gold = '#f59e0b';
    const darkGold = '#d97706';
    const lightGold = '#fde68a';

    // Base band
    drawRoundedRect(setPixel, 2 * s, 11 * s, 12 * s, 2.5 * s, 1 * s, gold);
    drawRoundedRect(setPixel, 3 * s, 11.5 * s, 10 * s, 1 * s, 0.5 * s, lightGold);

    // Crown peaks: 3 peaks
    // Left peak
    drawLine(setPixel, 2.5 * s, 11 * s, 2 * s, 4.5 * s, 1.4 * s, gold);
    // Center peak
    drawLine(setPixel, 8 * s, 11 * s, 8 * s, 3 * s, 1.6 * s, gold);
    // Right peak
    drawLine(setPixel, 13.5 * s, 11 * s, 14 * s, 4.5 * s, 1.4 * s, gold);

    // Webbing between peaks
    drawLine(setPixel, 2 * s, 4.5 * s, 5 * s, 8 * s, 1.2 * s, gold);
    drawLine(setPixel, 5 * s, 8 * s, 8 * s, 3 * s, 1.2 * s, gold);
    drawLine(setPixel, 8 * s, 3 * s, 11 * s, 8 * s, 1.2 * s, gold);
    drawLine(setPixel, 11 * s, 8 * s, 14 * s, 4.5 * s, 1.2 * s, gold);

    // Jewels on tips
    drawCircle(setPixel, 2 * s, 4.5 * s, 1.4 * s, '#ef4444');
    drawCircle(setPixel, 8 * s, 3 * s, 1.6 * s, '#3b82f6');
    drawCircle(setPixel, 14 * s, 4.5 * s, 1.4 * s, '#10b981');
  };
}

// 2. Database Server Icon
function drawDatabase(size) {
  return (setPixel, w, h) => {
    const s = size / 16;
    const green = '#10b981';
    const darkGreen = '#059669';
    const lightGreen = '#a7f3d0';

    // 3 cylinder layers
    const layers = [3 * s, 7 * s, 11 * s];
    for (const ly of layers) {
      // Body
      drawRoundedRect(setPixel, 3 * s, ly, 10 * s, 3 * s, 1.5 * s, green);
      // Top highlight
      drawRoundedRect(setPixel, 4 * s, ly + 0.5 * s, 8 * s, 1 * s, 0.5 * s, lightGreen, 200);
      // Small status LED on right of each cylinder
      drawCircle(setPixel, 11 * s, ly + 1.5 * s, 0.8 * s, '#ffffff');
    }
  };
}

// 3. Device / Laptop Icon
function drawDevice(size) {
  return (setPixel, w, h) => {
    const s = size / 16;
    const blue = '#3b82f6';
    const screenBg = '#1e293b';
    const cyan = '#38bdf8';

    // Screen frame
    drawRoundedRect(setPixel, 2.5 * s, 2.5 * s, 11 * s, 8 * s, 1 * s, blue);
    // Screen display
    drawRoundedRect(setPixel, 3.8 * s, 3.8 * s, 8.4 * s, 5.4 * s, 0.5 * s, screenBg);
    // Code/terminal prompt highlight inside screen
    drawLine(setPixel, 5 * s, 5.5 * s, 7 * s, 5.5 * s, 0.9 * s, cyan);
    drawLine(setPixel, 5 * s, 7 * s, 9 * s, 7 * s, 0.9 * s, '#ffffff');

    // Laptop base keyboard
    drawRoundedRect(setPixel, 1.5 * s, 11 * s, 13 * s, 2.2 * s, 0.8 * s, '#64748b');
    // Trackpad notch
    drawRoundedRect(setPixel, 6.5 * s, 11.2 * s, 3 * s, 0.8 * s, 0.4 * s, '#94a3b8');
  };
}

// 4. Network / LAN IP Icon
function drawNetwork(size) {
  return (setPixel, w, h) => {
    const s = size / 16;
    const cyan = '#06b6d4';
    const sky = '#38bdf8';

    // Outer globe circle
    drawCircle(setPixel, 8 * s, 8 * s, 6 * s, cyan);
    drawCircle(setPixel, 8 * s, 8 * s, 4.8 * s, '#0f172a');

    // Equator line
    drawLine(setPixel, 2.5 * s, 8 * s, 13.5 * s, 8 * s, 1.2 * s, sky);
    // Vertical meridian
    drawLine(setPixel, 8 * s, 2.5 * s, 8 * s, 13.5 * s, 1.2 * s, sky);

    // Latitude arcs / dots
    drawCircle(setPixel, 8 * s, 5 * s, 1 * s, '#ffffff');
    drawCircle(setPixel, 8 * s, 11 * s, 1 * s, '#ffffff');
    drawCircle(setPixel, 5 * s, 8 * s, 1 * s, '#ffffff');
    drawCircle(setPixel, 11 * s, 8 * s, 1 * s, '#ffffff');
  };
}

// 5. Open DPC Application Icon
function drawAppOpen(size) {
  return (setPixel, w, h) => {
    const s = size / 16;
    const indigo = '#6366f1';
    const darkIndigo = '#4338ca';

    // App window card
    drawRoundedRect(setPixel, 2 * s, 2 * s, 12 * s, 12 * s, 2 * s, indigo);
    // Window header bar
    drawRoundedRect(setPixel, 2 * s, 2 * s, 12 * s, 3.5 * s, 2 * s, darkIndigo);
    // 3 window control dots
    drawCircle(setPixel, 4 * s, 3.7 * s, 0.8 * s, '#ef4444');
    drawCircle(setPixel, 6 * s, 3.7 * s, 0.8 * s, '#f59e0b');
    drawCircle(setPixel, 8 * s, 3.7 * s, 0.8 * s, '#10b981');

    // App content: Arrow pointing up-right (launch/open)
    drawLine(setPixel, 5.5 * s, 10.5 * s, 10.5 * s, 5.5 * s, 1.5 * s, '#ffffff');
    drawLine(setPixel, 7.5 * s, 5.5 * s, 10.5 * s, 5.5 * s, 1.5 * s, '#ffffff');
    drawLine(setPixel, 10.5 * s, 5.5 * s, 10.5 * s, 8.5 * s, 1.5 * s, '#ffffff');
  };
}

// 6. Restart Server Icon
function drawRestart(size) {
  return (setPixel, w, h) => {
    const s = size / 16;
    const blue = '#0ea5e9';

    // Circle arc with 2 arrows
    // Top arrow going right
    drawLine(setPixel, 5 * s, 4 * s, 11 * s, 4 * s, 1.5 * s, blue);
    drawLine(setPixel, 9 * s, 2 * s, 11.5 * s, 4 * s, 1.5 * s, blue);
    drawLine(setPixel, 9 * s, 6 * s, 11.5 * s, 4 * s, 1.5 * s, blue);

    // Right curve down
    drawLine(setPixel, 11 * s, 4 * s, 13 * s, 8 * s, 1.5 * s, blue);
    drawLine(setPixel, 13 * s, 8 * s, 11 * s, 12 * s, 1.5 * s, blue);

    // Bottom arrow going left
    drawLine(setPixel, 11 * s, 12 * s, 5 * s, 12 * s, 1.5 * s, blue);
    drawLine(setPixel, 7 * s, 10 * s, 4.5 * s, 12 * s, 1.5 * s, blue);
    drawLine(setPixel, 7 * s, 14 * s, 4.5 * s, 12 * s, 1.5 * s, blue);

    // Left curve up
    drawLine(setPixel, 5 * s, 12 * s, 3 * s, 8 * s, 1.5 * s, blue);
    drawLine(setPixel, 3 * s, 8 * s, 5 * s, 4 * s, 1.5 * s, blue);
  };
}

// 7. Settings / Gear Icon
function drawSettings(size) {
  return (setPixel, w, h) => {
    const s = size / 16;
    const slate = '#64748b';
    const center = 8 * s;
    const rOuter = 5.5 * s;
    const rInner = 2.5 * s;

    // 8 gear cogs
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      const x = center + Math.cos(angle) * (rOuter + 0.8 * s);
      const y = center + Math.sin(angle) * (rOuter + 0.8 * s);
      drawCircle(setPixel, x, y, 1.6 * s, slate);
    }

    // Outer wheel
    drawCircle(setPixel, center, center, rOuter, slate);
    // Center hole
    drawCircle(setPixel, center, center, rInner, '#ffffff', 0); // Transparent center hole
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        if (Math.hypot(px - center, py - center) <= rInner) {
          // erase center
          setPixel(px, py, 0, 0, 0, 0);
        }
      }
    }
  };
}

// 8. Exit / Quit Icon
function drawExit(size) {
  return (setPixel, w, h) => {
    const s = size / 16;
    const red = '#ef4444';
    const darkRed = '#b91c1c';

    // Circular power badge
    drawCircle(setPixel, 8 * s, 8 * s, 6.5 * s, red);
    
    // Close / X cross in center
    drawLine(setPixel, 5 * s, 5 * s, 11 * s, 11 * s, 1.8 * s, '#ffffff');
    drawLine(setPixel, 11 * s, 5 * s, 5 * s, 11 * s, 1.8 * s, '#ffffff');
  };
}

const icons = [
  { name: 'crown', fn: drawCrown },
  { name: 'database', fn: drawDatabase },
  { name: 'device', fn: drawDevice },
  { name: 'network', fn: drawNetwork },
  { name: 'app-open', fn: drawAppOpen },
  { name: 'restart', fn: drawRestart },
  { name: 'settings', fn: drawSettings },
  { name: 'exit', fn: drawExit }
];

for (const icon of icons) {
  const png16 = createPng(16, 16, icon.fn(16));
  const png32 = createPng(32, 32, icon.fn(32));

  fs.writeFileSync(path.join(iconsDir, `${icon.name}.png`), png16);
  fs.writeFileSync(path.join(iconsDir, `${icon.name}@2x.png`), png32);
  console.log(`Generated icon: ${icon.name}.png & ${icon.name}@2x.png`);
}

console.log("All tray icons generated successfully!");
