#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  const toCrc = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(toCrc), 0);
  return Buffer.concat([lenBuf, toCrc, crcBuf]);
}

function encodePng(width, height, rgbaBuffer) {
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bits per channel
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowSize = width * 4 + 1;
  const raw = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    raw[y * rowSize] = 0; // Filter 0 (None)
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = y * rowSize + 1 + x * 4;
      raw[dstIdx] = rgbaBuffer[srcIdx];
      raw[dstIdx + 1] = rgbaBuffer[srcIdx + 1];
      raw[dstIdx + 2] = rgbaBuffer[srcIdx + 2];
      raw[dstIdx + 3] = rgbaBuffer[srcIdx + 3];
    }
  }

  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    header,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

function renderVaultIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const scale = size / 512;
  const cornerR = 112 * scale;

  function pointInHex(px, py, cx, cy, rx, ry) {
    const dx = Math.abs(px - cx) / rx;
    const dy = Math.abs(py - cy) / ry;
    return (dx <= 1 && dy <= 1 && (dx * 0.5 + dy * 0.866) <= 0.866);
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const nx = x / scale;
      const ny = y / scale;

      // Check rounded rect squircle
      let insideBase = true;
      if (nx < 112 && ny < 112 && Math.hypot(nx - 112, ny - 112) > 112) insideBase = false;
      if (nx > 400 && ny < 112 && Math.hypot(nx - 400, ny - 112) > 112) insideBase = false;
      if (nx < 112 && ny > 400 && Math.hypot(nx - 112, ny - 400) > 112) insideBase = false;
      if (nx > 400 && ny > 400 && Math.hypot(nx - 400, ny - 400) > 112) insideBase = false;

      if (!insideBase) {
        buf[idx] = 0;
        buf[idx + 1] = 0;
        buf[idx + 2] = 0;
        buf[idx + 3] = 0;
        continue;
      }

      // Base Obsidian gradient: #0B0F19 to #04060A
      const gradT = (nx + ny) / 1024;
      let r = Math.round(11 * (1 - gradT) + 4 * gradT);
      let g = Math.round(15 * (1 - gradT) + 6 * gradT);
      let b = Math.round(25 * (1 - gradT) + 10 * gradT);
      let a = 255;

      // Outer gold border hexagon: cx=256, cy=256, rx=180, ry=200
      const dOuter = pointInHex(nx, ny, 256, 256, 182, 198);
      const dOuterInner = pointInHex(nx, ny, 256, 256, 162, 178);

      // Inner chamber emerald hexagon: cx=256, cy=256, rx=140, ry=150
      const dEmeraldOuter = pointInHex(nx, ny, 256, 256, 142, 150);
      const dEmeraldInner = pointInHex(nx, ny, 256, 256, 132, 140);

      // Keyhole circle & dial
      const distCenter = Math.hypot(nx - 256, ny - 230);
      const isKeyholeCircle = distCenter <= 48;
      const isKeyholeNeck = ny >= 230 && ny <= 324 && Math.abs(nx - 256) <= (26 + (ny - 230) * 0.12);
      const isKeyhole = isKeyholeCircle || isKeyholeNeck;

      const isInnerCoreRing = distCenter <= 22;
      const isInnerCoreNode = distCenter <= 10;

      if (isInnerCoreNode) {
        // Emerald core node
        r = 16; g = 185; b = 129;
      } else if (isInnerCoreRing) {
        // Dark ring around node
        r = 7; g = 9; b = 14;
      } else if (isKeyhole) {
        // Gold keyhole dial: #F59E0B
        r = 245; g = 158; b = 11;
      } else if (dEmeraldOuter && !dEmeraldInner) {
        // Emerald chamber border: #10B981
        r = 16; g = 185; b = 129;
      } else if (dOuter && !dOuterInner) {
        // Gold outer shield border: #F59E0B / #FCD34D
        r = 245; g = 158; b = 11;
      } else if (dEmeraldInner) {
        // Inner chamber fill: #07090E
        r = 7; g = 9; b = 14;
      } else if (dOuterInner) {
        // Between gold and emerald: #0B0F19
        r = 11; g = 15; b = 25;
      }

      buf[idx] = r;
      buf[idx + 1] = g;
      buf[idx + 2] = b;
      buf[idx + 3] = a;
    }
  }

  return encodePng(size, size, buf);
}

function makeIco(png16, png32, png48) {
  const images = [
    { size: 16, buf: png16 },
    { size: 32, buf: png32 },
    { size: 48, buf: png48 }
  ];

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Icon type
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = [];
  const bodies = [];

  for (const img of images) {
    const entry = Buffer.alloc(16);
    entry[0] = img.size >= 256 ? 0 : img.size; // Width
    entry[1] = img.size >= 256 ? 0 : img.size; // Height
    entry[2] = 0; // Colors (0 = 256+)
    entry[3] = 0; // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(img.buf.length, 8); // Image size in bytes
    entry.writeUInt32LE(offset, 12); // Offset
    entries.push(entry);
    bodies.push(img.buf);
    offset += img.buf.length;
  }

  return Buffer.concat([header, ...entries, ...bodies]);
}

const outDir = path.join(__dirname, '..', 'apps', 'web-pwa', 'public');

console.log('Generating KRONA VAULT™ Favicons in', outDir);

const png16 = renderVaultIcon(16);
const png32 = renderVaultIcon(32);
const png48 = renderVaultIcon(48);
const png96 = renderVaultIcon(96);
const png180 = renderVaultIcon(180);
const png192 = renderVaultIcon(192);
const png512 = renderVaultIcon(512);

fs.writeFileSync(path.join(outDir, 'favicon-96x96.png'), png96);
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), png180);
fs.writeFileSync(path.join(outDir, 'web-app-manifest-192x192.png'), png192);
fs.writeFileSync(path.join(outDir, 'web-app-manifest-512x512.png'), png512);

const ico = makeIco(png16, png32, png48);
fs.writeFileSync(path.join(outDir, 'favicon.ico'), ico);

console.log('✅ Generated:');
console.log(' - favicon-96x96.png (' + png96.length + ' bytes)');
console.log(' - apple-touch-icon.png (' + png180.length + ' bytes)');
console.log(' - web-app-manifest-192x192.png (' + png192.length + ' bytes)');
console.log(' - web-app-manifest-512x512.png (' + png512.length + ' bytes)');
console.log(' - favicon.ico (' + ico.length + ' bytes)');
