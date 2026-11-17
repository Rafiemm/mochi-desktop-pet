// Cut every pose image out of its white background (shadow-aware) and crop to its bounding box.
const L = require("./lib.cjs"), fs = require("fs"), path = require("path");
const src = [];
for (const f of fs.readdirSync("../poses")) if (f.endsWith(".png")) src.push([f.replace(".png", ""), path.join("../poses", f)]);
const out = {};
for (const [name, file] of src) {
  const im = L.read(file), { w, h, d } = im, N = w * h, isBody = /body$/.test(name);
  // background = near-white anywhere, OR light neutral grey (the soft floor shadow) only in the lower part of the image
  const bg = new Uint8Array(N), q = new Int32Array(N); let qs = 0, qe = 0;
  // floor zone = bottom quarter of the character itself: find its extent with a strict near-white flood first
  let floorY;
  { const st = new Uint8Array(N), qq = new Int32Array(N); let a0 = 0, b0 = 0; const strict = (i) => Math.min(d[i*4], d[i*4+1], d[i*4+2]) >= 236;
    const ps = (i) => { if (!st[i] && strict(i)) { st[i] = 1; qq[b0++] = i; } };
    for (let x = 0; x < w; x++) { ps(x); ps((h-1)*w + x); } for (let y = 0; y < h; y++) { ps(y*w); ps(y*w + w - 1); }
    while (a0 < b0) { const i = qq[a0++], x = i % w, y = (i / w) | 0; if (x > 0) ps(i-1); if (x < w-1) ps(i+1); if (y > 0) ps(i-w); if (y < h-1) ps(i+w); }
    let y0 = h, y1 = 0; for (let i = 0; i < N; i++) if (!st[i]) { const y = (i / w) | 0; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    floorY = y1 - 0.24 * (y1 - y0); }
  const like = (i) => { const r = d[i*4], g = d[i*4+1], b = d[i*4+2], mx = Math.max(r,g,b), mn = Math.min(r,g,b); if (mn >= 236) return true; if (!isBody) return false; return (i / w) >= floorY && mx - mn <= 22 && mx >= 150 && mn >= 140; };
  const push = (i) => { if (!bg[i] && like(i)) { bg[i] = 1; q[qe++] = i; } };
  for (let x = 0; x < w; x++) { push(x); push((h-1)*w + x); } for (let y = 0; y < h; y++) { push(y*w); push(y*w + w - 1); }
  while (qs < qe) { const i = q[qs++], x = i % w, y = (i / w) | 0; if (x > 0) push(i-1); if (x < w-1) push(i+1); if (y > 0) push(i-w); if (y < h-1) push(i+w); }
  if (isBody) { // enclosed floor patches (e.g. between the legs): light/neutral regions in the lower 40% that the border flood could not reach
    const seen = new Uint8Array(N), stack = [];
    for (let i0 = Math.floor(floorY) * w; i0 < N; i0++) { if (seen[i0] || bg[i0] || !like(i0)) continue;
      const comp = []; stack.push(i0); seen[i0] = 1;
      while (stack.length) { const i = stack.pop(); comp.push(i); const x = i % w, y = (i / w) | 0;
        for (const j of [x > 0 ? i-1 : -1, x < w-1 ? i+1 : -1, y > 0 ? i-w : -1, y < h-1 ? i+w : -1]) if (j >= 0 && !seen[j] && !bg[j] && like(j) && (j / w) >= floorY) { seen[j] = 1; stack.push(j); } }
      if (comp.length >= 400) for (const i of comp) bg[i] = 1; }
  }
  // reuse the unmatting from lib by painting the shadow region white first, then running the standard cutout
  const clean = { w, h, d: new Uint8ClampedArray(d) };
  for (let i = 0; i < N; i++) if (bg[i]) { clean.d[i*4] = 255; clean.d[i*4+1] = 255; clean.d[i*4+2] = 255; }
  const cut = L.cutout(clean, { extraBg: bg });
  const bb = L.bbox(cut), pad = 4;
  const c = L.crop(cut, bb.x0 - pad, bb.y0 - pad, bb.x1 - bb.x0 + 1 + pad*2, bb.y1 - bb.y0 + 1 + pad*2);
  L.write(`../cut/${name}.png`, c);
  out[name] = { w: c.w, h: c.h, origW: w, origH: h, bbox: bb };
  console.log(name.padEnd(30), `${w}x${h} -> ${c.w}x${c.h}`);
}
fs.writeFileSync("../cut/index.json", JSON.stringify(out, null, 1));
