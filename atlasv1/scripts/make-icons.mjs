// Génère icons/icon.svg, icon-192.png, icon-512.png — Atlas portant la charge.
// PNG écrit à la main (zlib de Node), zéro dépendance.

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const ART = [
  '................',
  '................',
  '..OOOOOOOOOOOO..',
  '...T........T...',
  '...T........T...',
  '....T..TT..T....',
  '....T..TT..T....',
  '.....TTTTTT.....',
  '......TTTT......',
  '......TTTT......',
  '......TTTT......',
  '.....TT..TT.....',
  '.....T....T.....',
  '....TT....TT....',
  '....T......T....',
  '................',
];

const COLORS = { '.': [0x10, 0x0D, 0x0B], T: [0xC9, 0x62, 0x2B], O: [0xE0, 0xA4, 0x58] };

function crc32(buf) {
  let c, table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  c = -1;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size) {
  const scale = size / 16;
  const raw = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * 3);
    raw[row] = 0; // filtre none
    for (let x = 0; x < size; x++) {
      const ch = ART[Math.floor(y / scale)][Math.floor(x / scale)];
      const [r, g, b] = COLORS[ch] || COLORS['.'];
      const o = row + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8 bits, truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function svgIcon() {
  let rects = '';
  ART.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      const fill = ch === 'T' ? '#C9622B' : '#E0A458';
      rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}"/>`;
    });
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect width="16" height="16" fill="#100D0B"/>${rects}</svg>\n`;
}

mkdirSync(join(ROOT, 'icons'), { recursive: true });
writeFileSync(join(ROOT, 'icons/icon-192.png'), png(192));
writeFileSync(join(ROOT, 'icons/icon-512.png'), png(512));
writeFileSync(join(ROOT, 'icons/icon.svg'), svgIcon());
console.log('icons générées : icon.svg, icon-192.png, icon-512.png');
