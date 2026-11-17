// Build Mochi's outfits from the images you generated.      node build-outfits.cjs
//
// Put the generated images in ../outfits/src/ :
//     <id>.png            the REST body in that outfit (required)          e.g. raincoat.png
//     <id>.<pose>.png     optional extra poses: wave, walkA, walkB, celebrate, thumbs, think   e.g. raincoat.wave.png
//     names.json          optional display names: { "raincoat": "Yellow raincoat" }
//     calib.json          optional nudges: { "raincoat": { "s": 1.02, "dx": 0, "dy": 0.5 } }   (scale multiplier, dx/dy in % of the stage)
// Poses you do not supply fall back to that outfit's rest image (she still waddles, hops and waves her whole body).
//
// Output: ../mascot/assets/outfits/<id>/body-<pose>.webp + outfits.js / outfits.json, then everything is copied to ../../desktop/src.
const L = require("./lib.cjs"), fs = require("fs"), path = require("path"), sharp = require("sharp");

const SRC = path.resolve(__dirname, "../outfits/src");
const MASCOT = path.resolve(__dirname, "../mascot");
const OUT = path.join(MASCOT, "assets/outfits");
const DESKTOP = path.resolve(__dirname, "../../desktop/src");
const OUT_SCALE = 0.75, r3 = (v) => +v.toFixed(3);
const layout = JSON.parse(fs.readFileSync(path.join(MASCOT, "layout.json"), "utf8"));
const POSES = Object.keys(layout.bodies);

// same cut-out as cutall.cjs (white background + soft floor shadow -> transparent)
function cutImage(file) {
  const im = L.read(file), { w, h, d } = im, N = w * h;
  const bg = new Uint8Array(N), q = new Int32Array(N); let qs = 0, qe = 0, floorY;
  { const st = new Uint8Array(N), qq = new Int32Array(N); let a0 = 0, b0 = 0; const strict = (i) => Math.min(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) >= 236;
    const ps = (i) => { if (!st[i] && strict(i)) { st[i] = 1; qq[b0++] = i; } };
    for (let x = 0; x < w; x++) { ps(x); ps((h - 1) * w + x); } for (let y = 0; y < h; y++) { ps(y * w); ps(y * w + w - 1); }
    while (a0 < b0) { const i = qq[a0++], x = i % w, y = (i / w) | 0; if (x > 0) ps(i - 1); if (x < w - 1) ps(i + 1); if (y > 0) ps(i - w); if (y < h - 1) ps(i + w); }
    let y0 = h, y1 = 0; for (let i = 0; i < N; i++) if (!st[i]) { const y = (i / w) | 0; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    floorY = y1 - 0.24 * (y1 - y0); }
  const like = (i) => { const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mn >= 236) return true; return (i / w) >= floorY && mx - mn <= 22 && mx >= 150 && mn >= 140; };
  const push = (i) => { if (!bg[i] && like(i)) { bg[i] = 1; q[qe++] = i; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); } for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (qs < qe) { const i = q[qs++], x = i % w, y = (i / w) | 0; if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (y > 0) push(i - w); if (y < h - 1) push(i + w); }
  { const seen = new Uint8Array(N), stack = [];       // enclosed floor patches between the legs
    for (let i0 = Math.floor(floorY) * w; i0 < N; i0++) { if (seen[i0] || bg[i0] || !like(i0)) continue;
      const comp = []; stack.push(i0); seen[i0] = 1;
      while (stack.length) { const i = stack.pop(); comp.push(i); const x = i % w, y = (i / w) | 0;
        for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) if (j >= 0 && !seen[j] && !bg[j] && like(j) && (j / w) >= floorY) { seen[j] = 1; stack.push(j); } }
      if (comp.length >= 400) for (const i of comp) bg[i] = 1; } }
  const clean = { w, h, d: new Uint8ClampedArray(d) };
  for (let i = 0; i < N; i++) if (bg[i]) { clean.d[i * 4] = 255; clean.d[i * 4 + 1] = 255; clean.d[i * 4 + 2] = 255; }
  const cut = L.cutout(clean, { extraBg: bg }), bb = L.bbox(cut), pad = 4;
  return L.crop(cut, bb.x0 - pad, bb.y0 - pad, bb.x1 - bb.x0 + 1 + pad * 2, bb.y1 - bb.y0 + 1 + pad * 2);
}

(async () => {
  const names = fs.existsSync(path.join(SRC, "names.json")) ? JSON.parse(fs.readFileSync(path.join(SRC, "names.json"), "utf8")) : {};
  const calib = fs.existsSync(path.join(SRC, "calib.json")) ? JSON.parse(fs.readFileSync(path.join(SRC, "calib.json"), "utf8")) : {};
  const files = fs.existsSync(SRC) ? fs.readdirSync(SRC).filter((f) => f.toLowerCase().endsWith(".png")) : [];
  const byId = {};
  for (const f of files) {
    const parts = f.slice(0, -4).split(".");
    const pose = parts.length > 1 && POSES.includes(parts[parts.length - 1]) ? parts.pop() : "rest";
    const id = parts.join(".").toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
    (byId[id] = byId[id] || {})[pose] = path.join(SRC, f);
  }
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  const manifest = {};
  const stageW = layout.stage.w, stageH = layout.stage.h;
  for (const [id, poses] of Object.entries(byId)) {
    if (!poses.rest) { console.log(`skip ${id}: it needs ${id}.png (the rest pose)`); continue; }
    const c = calib[id] || {}, entry = { name: names[id] || id.replace(/[-_]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()), bodies: {} };
    fs.mkdirSync(path.join(OUT, id), { recursive: true });
    for (const [pose, file] of Object.entries(poses)) {
      const im = cutImage(file), ref = layout.bodies[pose];
      const refW = ref.width / 100 * stageW, refH = ref.height / 100 * stageH, refCx = (ref.left + ref.width / 2) / 100 * stageW, refTop = ref.top / 100 * stageH;
      const s = (refH / im.h) * (c.s || 1), w = im.w * s, h = im.h * s;                         // same height as the default body in this pose, feet on the same spot
      const x = refCx - w / 2 + (c.dx || 0) / 100 * stageW, y = refTop + (refH - h) + (c.dy || 0) / 100 * stageH;
      entry.bodies[pose] = { left: r3(x / stageW * 100), top: r3(y / stageH * 100), width: r3(w / stageW * 100), height: r3(h / stageH * 100) };
      const px = Math.round(w * OUT_SCALE), py = Math.round(h * OUT_SCALE);
      await sharp(Buffer.from(im.d.buffer, im.d.byteOffset, im.d.length), { raw: { width: im.w, height: im.h, channels: 4 } }).resize(px, py, { kernel: "lanczos3" }).webp({ quality: 86, alphaQuality: 100, effort: 6 }).toFile(path.join(OUT, id, `body-${pose}.webp`));
      console.log(`${id}/${pose}: ${px}x${py}  (source ${im.w}x${im.h})`);
    }
    manifest[id] = entry;
  }
  fs.writeFileSync(path.join(OUT, "outfits.json"), JSON.stringify(manifest, null, 1));
  fs.writeFileSync(path.join(OUT, "outfits.js"), "window.MOCHI_OUTFITS = " + JSON.stringify(manifest) + ";\n");
  console.log(Object.keys(manifest).length + " outfit(s) built");

  // copy the component + assets into the desktop app (and the handoff folder, if present)
  for (const dest of [DESKTOP, path.resolve(__dirname, "../../Mochi-Mascot-Handoff/mascot")]) {
    if (!fs.existsSync(dest)) continue;
    fs.copyFileSync(path.join(MASCOT, "mochi-mascot.js"), path.join(dest, "mochi-mascot.js"));
    fs.rmSync(path.join(dest, "assets/outfits"), { recursive: true, force: true });
    fs.cpSync(OUT, path.join(dest, "assets/outfits"), { recursive: true });
    console.log("synced -> " + dest);
  }
})();
