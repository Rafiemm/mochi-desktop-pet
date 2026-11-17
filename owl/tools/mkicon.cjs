const sharp = require("sharp"), fs = require("fs"), path = require("path");
const src = path.resolve(__dirname, "../cut/mochi-rest-head.png");
(async () => {
  const out = path.resolve(__dirname, "../../desktop");
  const png = async (n) => sharp(src).trim().resize(n, n, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  fs.writeFileSync(path.join(out, "src/tray.png"), await png(32));
  fs.writeFileSync(path.join(out, "build/icon.png"), await png(512));
  const sizes = [16, 24, 32, 48, 64, 128, 256], bufs = [];
  for (const s of sizes) bufs.push(await png(s));
  const hdr = Buffer.alloc(6); hdr.writeUInt16LE(1, 2); hdr.writeUInt16LE(sizes.length, 4);
  let off = 6 + 16 * sizes.length; const dirs = [];
  sizes.forEach((s, i) => {
    const d = Buffer.alloc(16); d[0] = s % 256; d[1] = s % 256; d.writeUInt16LE(1, 4); d.writeUInt16LE(32, 6);
    d.writeUInt32LE(bufs[i].length, 8); d.writeUInt32LE(off, 12); off += bufs[i].length; dirs.push(d);
  });
  fs.writeFileSync(path.join(out, "build/icon.ico"), Buffer.concat([hdr, ...dirs, ...bufs]));
})();
