// Neck anchor for every body: top of the light neck fur in the central part of the image.   node neck.cjs
const L = require("./lib.cjs"), fs = require("fs"), sharp = require("sharp");
const idx = JSON.parse(fs.readFileSync("../cut/index.json", "utf8"));
const hsv = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), df = mx - mn; let h = 0; if (df) { if (mx === r) h = ((g - b) / df) % 6; else if (mx === g) h = (b - r) / df + 2; else h = (r - g) / df + 4; h *= 60; if (h < 0) h += 360; } return [h, mx ? df / mx : 0, mx / 255]; };
exports.detect = (im) => {
  const { w, h, d } = im, a = Math.floor(w * 0.25), b = Math.ceil(w * 0.75);
  const light = (x, y) => { const i = (y*w + x)*4; if (d[i+3] < 200) return false; const [hh, s, v] = hsv(d[i], d[i+1], d[i+2]); return hh > 15 && hh < 48 && s > 0.06 && s < 0.62 && v > 0.74; };
  let top = -1;
  for (let y = 0; y < h && top < 0; y++) { let run = 0, best = 0; for (let x = a; x <= b; x++) { if (light(x, y)) { run++; if (run > best) best = run; } else run = 0; } if (best >= 34) top = y; }
  let sx = 0, n = 0; for (let y = top; y < top + 18; y++) for (let x = a; x <= b; x++) if (light(x, y)) { sx += x; n++; }
  // body extents
  let y1 = 0, x0 = w, x1 = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y*w + x)*4+3] > 40) { if (y > y1) y1 = y; if (x < x0) x0 = x; if (x > x1) x1 = x; }
  return { x: n ? sx / n : w / 2, y: top, bottom: y1, x0, x1 };
};
if (require.main === module) {
  const out = {}, tiles = [];
  (async () => {
    for (const n of Object.keys(idx).filter((k) => /body$/.test(k))) {
      const im = L.read(`../cut/${n}.png`), r = exports.detect(im); out[n] = r;
      console.log(n.padEnd(28), `neck (${Math.round(r.x)},${r.y})  bottom ${r.bottom}  size ${im.w}x${im.h}`);
      const k = 0.3, svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(im.w*k)}" height="${Math.round(im.h*k)}"><circle cx="${r.x*k}" cy="${r.y*k}" r="7" fill="#00ffff" stroke="#000"/><line x1="${(r.x-40)*k}" x2="${(r.x+40)*k}" y1="${r.y*k}" y2="${r.y*k}" stroke="#00ffff"/><text x="4" y="14" font-size="12" fill="#fff" font-family="Arial">${n.replace("-body","")}</text></svg>`);
      tiles.push(await sharp(`../cut/${n}.png`).resize(Math.round(im.w*k), Math.round(im.h*k)).flatten({ background: "#165c4a" }).composite([{ input: svg }]).png().toBuffer());
    }
    const metas = await Promise.all(tiles.map((t) => sharp(t).metadata())), cols = 8, rowsN = Math.ceil(tiles.length / cols), cw = 340, ch = 340;
    await sharp({ create: { width: cols * cw, height: rowsN * ch, channels: 4, background: "#222" } }).composite(tiles.map((t, i) => ({ input: t, left: (i % cols) * cw, top: Math.floor(i / cols) * ch }))).png().toFile("../neck_check.png");
    fs.writeFileSync("../cut/necks.json", JSON.stringify(out, null, 1));
  })();
}
