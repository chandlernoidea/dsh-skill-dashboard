// Minimal read-only asar extractor: node tools/asar-extract.cjs <asar> <internal-prefix> <outDir>
const fs = require('node:fs');
const path = require('node:path');

const [asarPath, prefix = '', outDir = ''] = process.argv.slice(2);
if (!asarPath || !outDir) {
  console.error('usage: node asar-extract.cjs <asar> <internal-prefix> <outDir>');
  process.exit(2);
}

const fd = fs.openSync(asarPath, 'r');
// Layout: u32@0 = 4, u32@4 = header payload size, u32@8 = string size,
// u32@12 = json byte length, json bytes start at 16.
const sizeBuf = Buffer.alloc(16);
fs.readSync(fd, sizeBuf, 0, 16, 0);
const headerSize = sizeBuf.readUInt32LE(4);
const jsonLen = sizeBuf.readUInt32LE(12);
const jsonBuf = Buffer.alloc(jsonLen);
fs.readSync(fd, jsonBuf, 0, jsonLen, 16);
const header = JSON.parse(jsonBuf.toString('utf8'));
const base = 8 + headerSize;

const parts = prefix.split('/').filter(Boolean);
let node = header.files || {};
for (const p of parts) {
  if (p) node = node[p]?.files;
  if (!node) {
    console.error('prefix not found: ' + p);
    process.exit(3);
  }
}

let count = 0;
function walk(rel, files) {
  for (const [name, entry] of Object.entries(files)) {
    const relPath = rel ? `${rel}/${name}` : name;
    if (entry.files) { walk(relPath, entry.files); continue; }
    if (typeof entry.offset !== 'string') continue;
    const buf = Buffer.alloc(Number(entry.size));
    fs.readSync(fd, buf, 0, buf.length, base + Number(entry.offset));
    const target = path.join(outDir, relPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, buf);
    count++;
  }
}
walk('', node);
console.log('extracted ' + count + ' files to ' + path.resolve(outDir));
fs.closeSync(fd);
