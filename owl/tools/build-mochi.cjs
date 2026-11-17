// Assemble Mochi: registered heads (+ tracking eyes), pose bodies, tail  ->  WebP layers + layout.json     node build-mochi.cjs
// Needs: ../cut/*.png (cutall.cjs), ../cut/analysis.json (analyze.cjs). Optional manual tweaks: ../calib.json
const L = require("./lib.cjs"), fs = require("fs"), path = require("path"), sharp = require("sharp"), { buildEyes } = require("./eyes3.cjs");

const OUT = path.resolve(__dirname, "../mascot/assets/"), OUT_SCALE = 0.75;      // exported pixel density relative to the rest-body cut (stage ~ 577 px wide)
const EYE_TRAVEL = 0.62;                                                      // share of the measured safe iris travel that cursor tracking uses
const CAL = Object.assign({
  headToCollar: 2.04,    // visible head width / collar width (measured on Mochi.png)
  overlap: 0.05,         // how far the chin sits over the neck, in collar widths
  headDx: 0,             // fine tune head position (collar widths)
  tail: { dx: 0.60, dy: 1.75, scale: 0.0, lengthToBody: 0.74, sway: 6 },   // tail root relative to the neck (collar widths); length as share of the rest body height
  poses: {},             // per pose: { s: scale multiplier, dx, dy (collar widths) }
}, fs.existsSync("../calib.json") ? JSON.parse(fs.readFileSync("../calib.json", "utf8")) : {});
CAL.tail = Object.assign({ dx: 0.60, dy: 1.75, scale: 0, lengthToBody: 0.74, sway: 6 }, CAL.tail);

const POSES = { rest: "mochi-rest-body", wave: "mochi-wave-body", walkA: "mochi-walk-a-body", walkB: "mochi-walk-b-body", celebrate: "mochi-celebrate-body", thumbs: "mochi-thumbs-body", think: "mochi-think-body" };
const AIR = new Set(["celebrate"]);
const HEADS = { rest: "mochi-rest-head", talk: "mochi-talk-head", blink: "mochi-blink-head", happy: "mochi-happy-head" };
const EYED = new Set(["rest", "talk"]);
const A = JSON.parse(fs.readFileSync("../cut/analysis.json", "utf8")), IDX = JSON.parse(fs.readFileSync("../cut/index.json", "utf8"));
const r1 = (v) => +v.toFixed(3);

const bbox = (im, minA) => L.bbox(im, minA);
function faceExtent(im) {   // visible face (no whiskers): columns/rows that hold a solid amount of opaque pixels
  const { w, h, d } = im, col = new Int32Array(w), row = new Int32Array(h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 200) { col[x]++; row[y]++; }
  const cm = Math.max(...col), rm = Math.max(...row); let x0 = 0, x1 = w - 1, y1 = h - 1;
  while (col[x0] < cm * 0.22) x0++; while (col[x1] < cm * 0.22) x1--; while (row[y1] < rm * 0.3) y1--;
  return { x0, x1, y1, cx: (x0 + x1) / 2, w: x1 - x0 + 1 };
}
const toRGBA = (im, o = {}) => sharp(Buffer.from(im.d.buffer, im.d.byteOffset, im.d.length), { raw: { width: im.w, height: im.h, channels: 4 } });
async function save(im, file, W, H, q, lossless) {
  let p = toRGBA(im); if (W && H && (W !== im.w || H !== im.h)) p = p.resize(W, H, { kernel: "lanczos3" });
  await p.webp({ quality: q, alphaQuality: 100, effort: 6, lossless: !!lossless }).toFile(file);
  return fs.statSync(file).size;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true }); for (const f of fs.readdirSync(OUT)) if (f !== "outfits") fs.rmSync(path.join(OUT, f), { recursive: true, force: true });   // keep the outfits folder (built by build-outfits.cjs)
  const body = {}; for (const [k, n] of Object.entries(POSES)) body[k] = { im: L.read(`../cut/${n}.png`), a: A.bodies[n] };
  const rest = body.rest, collarRest = rest.a.collarW, W0 = rest.im.w;

  // ---------- heads: shared frame (registered), union crop ----------
  const frame = {}; const FW = 1100, FH = 1560;
  const heads = {};
  for (const [slot, n] of Object.entries(HEADS)) {
    const im = L.read(`../cut/${n}.png`), a = A.heads[n]; heads[slot] = { im, ox: a.ox + a.dx, oy: a.oy + a.dy, n };
    if (EYED.has(slot)) heads[slot].eyes = buildEyes(im, (m) => console.log(slot + m));
  }
  let bx0 = FW, by0 = FH, bx1 = 0, by1 = 0;
  for (const h of Object.values(heads)) { const b = bbox(h.im, 20); bx0 = Math.min(bx0, h.ox + b.x0); by0 = Math.min(by0, h.oy + b.y0); bx1 = Math.max(bx1, h.ox + b.x1); by1 = Math.max(by1, h.oy + b.y1); }
  const HW = bx1 - bx0 + 1, HH = by1 - by0 + 1;
  const fr = faceExtent(heads.rest.im), faceCx = heads.rest.ox + fr.cx - bx0, faceBottom = heads.rest.oy + fr.y1 - by0, faceW = fr.w;
  const hs = (collarRest * CAL.headToCollar) / faceW;                                  // head image px -> rest-body px
  console.log(`head frame ${HW}x${HH}, face ${faceW}px, scale ${hs.toFixed(3)}, collar ${collarRest}`);

  // ---------- stage geometry (rest-body pixels; origin = top-left of the stage) ----------
  const ov = CAL.overlap * collarRest, nkX = rest.a.neckX, nkY = rest.a.neckY;
  const bodyTop = faceBottom * hs - nkY - ov;                                           // rest body top edge
  const stageH = bodyTop + rest.im.h, restBottomAbs = bodyTop + rest.a.bottom;
  const neckAbs = { x: nkX, y: bodyTop + nkY };
  const headLeft0 = neckAbs.x - faceCx * hs + CAL.headDx * collarRest, headTop0 = neckAbs.y + ov - faceBottom * hs;
  const pct = (v, tot) => r1((v / tot) * 100);
  const ABS = []; const box = (x, y, w, h) => { const o = { x, y, w, h }; ABS.push(o); return o; };

  const layout = { aspect: 0, bodies: {}, headBox: {}, tailBox: {}, heads: {}, chin: { x: r1((faceCx / HW) * 100), y: r1(((faceBottom - 6) / HH) * 100) } };

  // ---------- tail ----------
  const tailIm = L.read("../cut/mochi-tail.png");
  let by = 0; for (let y = tailIm.h - 1; y >= 0 && !by; y--) for (let x = 0; x < tailIm.w; x++) if (tailIm.d[(y * tailIm.w + x) * 4 + 3] > 128) { by = y; break; }
  let sx = 0, sn = 0; for (let y = by - 6; y <= by; y++) for (let x = 0; x < tailIm.w; x++) if (tailIm.d[(y * tailIm.w + x) * 4 + 3] > 128) { sx += x; sn++; }
  const tailPivot = { x: sx / sn, y: by - 4 };
  const ts = CAL.tail.scale || (rest.im.h * CAL.tail.lengthToBody) / tailIm.h;
  layout.tail = { pivot: { x: r1((tailPivot.x / tailIm.w) * 100), y: r1((tailPivot.y / tailIm.h) * 100) }, sway: CAL.tail.sway };

  // ---------- bodies ----------
  for (const [k, b] of Object.entries(body)) {
    const ov2 = CAL.poses[k] || {}, a = b.a;
    const s = (collarRest / a.collarW) * (ov2.s || 1), w = b.im.w * s, h = b.im.h * s;
    const x = neckAbs.x - a.neckX * s + (ov2.dx || 0) * collarRest;
    const y = (AIR.has(k) ? neckAbs.y - a.neckY * s : restBottomAbs - a.bottom * s) + (ov2.dy || 0) * collarRest;
    layout.bodies[k] = box(x, y, w, h);
    const nx = x + a.neckX * s, ny = y + a.neckY * s;                                   // where this pose's neck ended up
    layout.headBox[k] = box(headLeft0 + (nx - neckAbs.x), headTop0 + (ny - neckAbs.y), HW * hs, HH * hs);
    const tw = tailIm.w * ts, th = tailIm.h * ts, ax = nx + CAL.tail.dx * collarRest, ay = ny + CAL.tail.dy * collarRest;
    layout.tailBox[k] = box(ax - tailPivot.x * ts, ay - tailPivot.y * ts, tw, th);
    const px = Math.round(w * OUT_SCALE), py = Math.round(h * OUT_SCALE);
    const bytes = await save(b.im, `${OUT}/body-${k}.webp`, px, py, 86);
    console.log(`body ${k.padEnd(9)} ${px}x${py} ${(bytes / 1024).toFixed(0)}KB  s=${s.toFixed(3)}`);
  }
  { const tw = Math.round(tailIm.w * ts * OUT_SCALE), th = Math.round(tailIm.h * ts * OUT_SCALE); console.log("tail", tw + "x" + th, ((await save(tailIm, `${OUT}/tail.webp`, tw, th, 86)) / 1024).toFixed(0) + "KB"); }

  // ---------- heads (+ eye layers) ----------
  const hpx = (HW * hs) * OUT_SCALE / HW;      // export px per head-frame px
  const frameCrop = async (im, ox, oy, headLayer) => { const f = L.make(HW, HH), d = headLayer || im.d; for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) { const X = x + ox - bx0, Y = y + oy - by0; if (X < 0 || Y < 0 || X >= HW || Y >= HH) continue; const s = (y * im.w + x) * 4, t = (Y * HW + X) * 4; f.d[t] = d[s]; f.d[t + 1] = d[s + 1]; f.d[t + 2] = d[s + 2]; f.d[t + 3] = d[s + 3]; } return f; };
  for (const [slot, h] of Object.entries(heads)) {
    const eyes = h.eyes, hl = await frameCrop(h.im, h.ox, h.oy, eyes ? eyes.head.d : null);
    const bytes = await save(hl, `${OUT}/head-${slot}.webp`, Math.round(HW * hpx), Math.round(HH * hpx), 88);
    const lay = { eyes: null };
    if (eyes) {
      lay.eyes = {};
      for (const k of ["L", "R"]) {
        const sh = eyes.sheets[k], m = eyes.meta[k], key = k.toLowerCase();
        const sc = sh.sclera, ir = sh.iris, sx0 = sc.x + h.ox - bx0, sy0 = sc.y + h.oy - by0, ix0 = ir.x + h.ox - bx0, iy0 = ir.y + h.oy - by0;
        await save(sc.img, `${OUT}/eye-${slot}-${key}-sclera.webp`, Math.round(sc.img.w * hpx), Math.round(sc.img.h * hpx), 82);
        await save(ir.img, `${OUT}/eye-${slot}-${key}-iris.webp`, Math.round(ir.img.w * hpx), Math.round(ir.img.h * hpx), 90);
        const rg = (v) => r1((v * EYE_TRAVEL / HW) * 100);
        lay.eyes[key] = {
          sclera: { left: pct(sx0, HW), top: pct(sy0, HH), width: pct(sc.img.w, HW), height: pct(sc.img.h, HH) },
          iris: { left: pct(ix0, HW), top: pct(iy0, HH), width: pct(ir.img.w, HW), height: pct(ir.img.h, HH) },
          range: { left: rg(m.range.left), right: rg(m.range.right), up: rg(m.range.up), down: rg(m.range.down) },
        };
      }
    }
    layout.heads[slot] = lay;
    console.log(`head ${slot.padEnd(6)} ${Math.round(HW * hpx)}x${Math.round(HH * hpx)} ${(bytes / 1024).toFixed(0)}KB${eyes ? "  +eyes" : ""}`);
  }
  // stage = union of every pose / head / tail box (+2% padding), so nothing is ever cut off
  { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const r of ABS) { x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h); }
    const pw = (x1 - x0) * 0.02; x0 -= pw; x1 += pw; y1 = Math.max(y1, restBottomAbs + 0.02 * (x1 - x0)); const SW = x1 - x0, SH = y1 - y0;
    for (const r of ABS) { r.left = pct(r.x - x0, SW); r.top = pct(r.y - y0, SH); r.width = pct(r.w, SW); r.height = pct(r.h, SH); delete r.x; delete r.y; delete r.w; delete r.h; }
    layout.aspect = r1(SW / SH); layout.stage = { w: Math.round(SW), h: Math.round(SH), restBodyW: pct(W0, SW), restBodyLeft: pct(0 - x0, SW) };
    const cv = (px, py) => ({ x: pct(px - x0, SW), y: pct(py - y0, SH) }); layout.ground = cv(neckAbs.x, restBottomAbs); }
  fs.writeFileSync("../mascot/layout.json", JSON.stringify(layout));
  const total = fs.readdirSync(OUT).reduce((s, f) => s + fs.statSync(path.join(OUT, f)).size, 0);
  console.log("layout.json written; assets total", (total / 1024).toFixed(0) + "KB");
})();
