// Measures neck anchor + collar width of every body, and the registration shift of every head (vs the rest head).
const L = require("./lib.cjs"), fs = require("fs"), { detect } = require("./neck.cjs");
const idx = JSON.parse(fs.readFileSync("../cut/index.json", "utf8"));
const hsv = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), df = mx - mn; let h = 0; if (df) { if (mx === r) h = ((g - b) / df) % 6; else if (mx === g) h = (b - r) / df + 2; else h = (r - g) / df + 4; h *= 60; if (h < 0) h += 360; } return [h, mx ? df / mx : 0, mx / 255]; };
const out = { bodies: {}, heads: {} };
for (const n of Object.keys(idx).filter((k) => /body$/.test(k))) {
  const im = L.read(`../cut/${n}.png`), { w, h, d } = im, nk = detect(im);
  const nonPink = (x, y) => { const i = (y * w + x) * 4; if (d[i + 3] < 200) return false; const [hh, s, v] = hsv(d[i], d[i + 1], d[i + 2]); return !((hh > 340 || hh < 12) && s > 0.28); };
  const seen = new Uint8Array(w * h), st = [[Math.round(nk.x), nk.y + 6]]; let x0 = w, x1 = 0, y1 = 0; seen[st[0][1] * w + st[0][0]] = 1;
  const lim = nk.y + Math.round((nk.bottom - nk.y) * 0.2);
  while (st.length) { const [x, y] = st.pop(); if (x < x0) x0 = x; if (x > x1) x1 = x; if (y > y1) y1 = y;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h || Y > lim || seen[Y * w + X] || !nonPink(X, Y)) continue; seen[Y * w + X] = 1; st.push([X, Y]); } }
  out.bodies[n] = { w, h, neckX: +nk.x.toFixed(1), neckY: nk.y, bottom: nk.bottom, collarW: x1 - x0 + 1, collarY1: y1 };
  console.log(n.padEnd(24), JSON.stringify(out.bodies[n]));
}
// heads: place each in the original 1024x1536 frame and search the best translation onto the rest head
const FW = 1100, FH = 1560, frame = (n) => { const e = idx[n], im = L.read(`../cut/${n}.png`), f = L.make(FW, FH), ox = e.bbox.x0 - 4 + 20, oy = e.bbox.y0 - 4 + 20;
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) { const s = (y * im.w + x) * 4, X = x + ox, Y = y + oy; if (X < 0 || Y < 0 || X >= FW || Y >= FH) continue; const t = (Y * FW + X) * 4; for (let c = 0; c < 4; c++) f.d[t + c] = im.d[s + c]; } return f; };
const heads = Object.keys(idx).filter((k) => /head$/.test(k)), ref = frame("mochi-rest-head");
const mask = (f) => { const m = new Uint8Array(FW * FH); for (let i = 0; i < FW * FH; i++) m[i] = f.d[i * 4 + 3] > 200 ? 1 : 0; return m; }, mr = mask(ref);
for (const n of heads) {
  const f = frame(n), m = mask(f); let best = [0, 0], bs = -1;
  for (let dy = -40; dy <= 40; dy += 2) for (let dx = -40; dx <= 40; dx += 2) { let inter = 0, uni = 0; for (let y = 60; y < FH - 60; y += 3) for (let x = 60; x < FW - 60; x += 3) { const a = mr[y * FW + x], b = m[(y - dy) * FW + (x - dx)]; if (a & b) inter++; if (a | b) uni++; } const s = inter / uni; if (s > bs) { bs = s; best = [dx, dy]; } }
  out.heads[n] = { dx: best[0], dy: best[1], iou: +bs.toFixed(4), ox: idx[n].bbox.x0 - 4 + 20, oy: idx[n].bbox.y0 - 4 + 20 };
  console.log(n.padEnd(22), JSON.stringify(out.heads[n]));
}
fs.writeFileSync("../cut/analysis.json", JSON.stringify(out, null, 1));
