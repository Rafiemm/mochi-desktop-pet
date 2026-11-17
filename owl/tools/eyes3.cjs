// Eye builder for Mochi's open-eyed heads (green iris, black pupil, white sclera, dark lash/lid on top).
//   buildEyes(head) -> { head: head RGBA with both eye sockets cut out (+ soft inner shadow), sheets: {L,R}: sclera sheet + sliding iris, meta }
const L = require("./lib.cjs");
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function nelder(f, x0, step, iters = 700) {
  const n = x0.length; let S = [x0.slice()];
  for (let i = 0; i < n; i++) { const p = x0.slice(); p[i] += step[i]; S.push(p); }
  let F = S.map(f);
  for (let it = 0; it < iters; it++) {
    const o = [...S.keys()].sort((a, b) => F[a] - F[b]); S = o.map((i) => S[i]); F = o.map((i) => F[i]);
    const c = Array(n).fill(0); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += S[i][j] / n;
    const mv = (t) => c.map((v, j) => v + t * (S[n][j] - v)), xr = mv(-1), fr = f(xr);
    if (fr < F[0]) { const xe = mv(-2), fe = f(xe); if (fe < fr) { S[n] = xe; F[n] = fe; } else { S[n] = xr; F[n] = fr; } }
    else if (fr < F[n - 1]) { S[n] = xr; F[n] = fr; }
    else { const xc = fr < F[n] ? mv(-0.5) : mv(0.5), fc = f(xc); if (fc < Math.min(fr, F[n])) { S[n] = xc; F[n] = fc; } else for (let i = 1; i <= n; i++) { S[i] = S[0].map((v, j) => v + 0.5 * (S[i][j] - v)); F[i] = f(S[i]); } }
  }
  return S[0];
}
const rotEll = ([cx, cy, a, b, t], x, y) => { const c = Math.cos(t), s = Math.sin(t), dx = x - cx, dy = y - cy, u = (dx * c + dy * s) / a, v = (-dx * s + dy * c) / b; return u * u + v * v; };
const inEll = ([cx, cy, a, b], x, y) => { const dx = x - cx, dy = y - cy; return (dx * dx) / (a * a) + (dy * dy) / (b * b); };

exports.buildEyes = (head, log = () => {}) => {
  const W = head.w, H = head.h, N = W * H, d = head.d, nb4 = (i, x, y) => [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
  const px = (i) => [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]];
  const isGreen = (i) => { const [r, g, b] = px(i); return d[i * 4 + 3] > 200 && g > r + 22 && g > b + 12; };
  const isPupil = (i) => { const [r, g, b] = px(i); return d[i * 4 + 3] > 200 && Math.max(r, g, b) < 75 && r - b < 24; };
  const isScl = (i) => { const [r, g, b] = px(i), mn = Math.min(r, g, b); return d[i * 4 + 3] > 200 && mn >= 150 && Math.max(r, g, b) - mn <= 30 && r >= b; };
  // 1. green regions -> one per eye
  const gm = new Uint8Array(N), seen = new Uint8Array(N), blobs = [];
  for (let i = 0; i < N; i++) if (isGreen(i)) gm[i] = 1;
  for (let i0 = 0; i0 < N; i0++) {
    if (!gm[i0] || seen[i0]) continue; const st = [i0], pts = []; seen[i0] = 1;
    while (st.length) { const i = st.pop(); pts.push(i); const x = i % W, y = (i / W) | 0; for (const j of nb4(i, x, y)) if (j >= 0 && gm[j] && !seen[j]) { seen[j] = 1; st.push(j); } }
    if (pts.length > 1500) blobs.push(pts);
  }
  blobs.sort((a, b) => b.length - a.length);
  const two = blobs.slice(0, 2);
  if (two.length !== 2) throw new Error("expected 2 irises, found " + blobs.length);
  const eyes = two.map((pts) => { let sx = 0, sy = 0; for (const i of pts) { sx += i % W; sy += (i / W) | 0; } return { pts, cx: sx / pts.length, cy: sy / pts.length }; }).sort((a, b) => a.cx - b.cx);
  const D = eyes[1].cx - eyes[0].cx, U = D / 520;
  const headLayer = new Uint8ClampedArray(d), meta = {}, sheets = {};
  eyes.forEach((e, ei) => {
    const k = ei ? "R" : "L";
    // 2. iris circle: robust circle fit on the rim of the green ring
    let rim = []; for (const i of e.pts) { const x = i % W, y = (i / W) | 0; if (nb4(i, x, y).some((j) => j < 0 || !gm[j])) rim.push([x, y]); }
    let c = [e.cx, e.cy, Math.sqrt(e.pts.length / Math.PI) * 1.25];
    const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    for (let it = 0; it < 6; it++) {
      const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], B = [0, 0, 0];
      for (const [x, y] of rim) { const v = [x, y, 1], t = x * x + y * y; for (let a = 0; a < 3; a++) { for (let b = 0; b < 3; b++) A[a][b] += v[a] * v[b]; B[a] += v[a] * t; } }
      const D0 = det(A), sol = [0, 1, 2].map((q) => det(A.map((r, a) => r.map((v, b) => (b === q ? B[a] : v)))) / D0);
      c = [sol[0] / 2, sol[1] / 2, Math.sqrt(sol[2] + (sol[0] / 2) ** 2 + (sol[1] / 2) ** 2)];
      const keep = rim.filter(([x, y]) => Math.abs(Math.hypot(x - c[0], y - c[1]) - c[2]) < 4 * U + 2);
      if (keep.length < 20) break; rim = keep;
    }
    const ell = [c[0], c[1], c[2] + 2 * U, c[2] + 2 * U];
    // 3. socket = sclera + iris disc connected to the iris centre, kept inside a window around the eye
    const eyeish = (i) => isScl(i) || isGreen(i) || isPupil(i) || inEll(ell, i % W, (i / W) | 0) <= 1.14;
    const half = Math.round(2.6 * c[2]), bx0 = Math.max(1, Math.round(c[0] - half)), bx1 = Math.min(W - 2, Math.round(c[0] + half)), by0 = Math.max(1, Math.round(c[1] - half)), by1 = Math.min(H - 2, Math.round(c[1] + half));
    // boundary of the eye opening: first run of non-eye pixels along rays from the iris centre, then a robust ellipse through those points
    const P = [];
    for (let a = 0; a < 360; a += 2) { const ca = Math.cos(a * Math.PI / 180), sa = Math.sin(a * Math.PI / 180);
      for (let r = Math.round(c[2] * 0.9); r < 2.6 * c[2]; r++) { let bad = 0; for (let t = 0; t < 4; t++) { const x = Math.round(c[0] + ca * (r + t)), y = Math.round(c[1] + sa * (r + t)); if (x < 0 || y < 0 || x >= W || y >= H || !eyeish(y * W + x)) bad++; } if (bad >= 3) { P.push([c[0] + ca * r, c[1] + sa * r]); break; } } }
    let E = [c[0], c[1], 1.5 * c[2], 1.4 * c[2], 0]; const lo = 1.0 * c[2], hi = 2.4 * c[2];
    const cost = (p) => (p[2] < lo || p[3] < lo || p[2] > hi || p[3] > hi) ? 1e12 : P.reduce((sum, [x, y]) => { const r = (Math.sqrt(rotEll(p, x, y)) - 1) * Math.min(p[2], p[3]); return sum + Math.min(r * r, 100); }, 0);
    for (let it = 0; it < 3; it++) E = nelder(cost, E, [8 * U, 8 * U, 8 * U, 8 * U, 0.15]);
    const sock = new Uint8Array(N);
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) { const i = y * W + x; if (rotEll(E, x, y) <= 0.97 || inEll(ell, x, y) <= 1.0 || (inEll(ell, x, y) <= 1.8 && (isGreen(i) || isPupil(i)))) sock[i] = 1; }
    const outside = new Uint8Array(N);
    for (let i = 0; i < N; i++) outside[i] = sock[i] ? 0 : 1;
    const hullM = new Uint8Array(N); let xmin = W, xmax = 0, ymin = H, ymax = 0;
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) { const i = y * W + x; if (!outside[i]) { hullM[i] = 1; if (x < xmin) xmin = x; if (x > xmax) xmax = x; if (y < ymin) ymin = y; if (y > ymax) ymax = y; } }
    const dOut = new Int16Array(N).fill(32000), bq = []; for (let i = 0; i < N; i++) if (!hullM[i]) { dOut[i] = 0; bq.push(i); }
    const lim = Math.round(40 * U);
    for (let h = 0; h < bq.length; h++) { const i = bq[h], x = i % W, y = (i / W) | 0, nd = dOut[i] + 1; if (nd > lim) continue; for (const j of nb4(i, x, y)) if (j >= 0 && dOut[j] > nd) { dOut[j] = nd; bq.push(j); } }
    const e2 = Math.max(2, Math.round(2.5 * U)), hole = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (hullM[i] && dOut[i] > e2) hole[i] = 1;
    // original iris/pupil pixels left in the thin rim around the socket (iris touching the lid): turn them into lid shadow
    for (let i = 0; i < N; i++) if (hullM[i] && !hole[i] && (isGreen(i) || isPupil(i))) { headLayer[i * 4] = 62; headLayer[i * 4 + 1] = 38; headLayer[i * 4 + 2] = 30; }
    // 4. head layer: transparent socket + soft inner shadow (stronger under the upper lid)
    for (let i = 0; i < N; i++) if (hole[i]) {
      const dd = dOut[i] - e2, y = (i / W) | 0, top = 1 - (y - ymin) / (ymax - ymin), a = Math.min(0.55, 0.4 * Math.exp(-dd / (9 * U)) * (1 + 0.9 * top * top));
      headLayer[i * 4] = 30; headLayer[i * 4 + 1] = 18; headLayer[i * 4 + 2] = 14; headLayer[i * 4 + 3] = Math.round(a * 255);
    }
    // 5. sclera sheet: real sclera, extended into the iris area and under the fur (nearest source + blur)
    const ext = Math.round(34 * U), sclM = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (hullM[i] && dOut[i] > 2 && isScl(i) && inEll(ell, i % W, (i / W) | 0) > 1.34) { const [r, g, b] = px(i); if (g - r < 8 && g - b < 22) sclM[i] = 1; }
    const region = new Int16Array(N).fill(32000), rq = []; for (let i = 0; i < N; i++) if (hullM[i]) { region[i] = 0; rq.push(i); }
    for (let h = 0; h < rq.length; h++) { const i = rq[h], x = i % W, y = (i / W) | 0, nd = region[i] + 1; if (nd > ext) continue; for (const j of nb4(i, x, y)) if (j >= 0 && region[j] > nd) { region[j] = nd; rq.push(j); } }
    // smooth diffusion fill (Gauss-Seidel) from the known sclera pixels over the socket + a margin under the fur
    const fill = L.make(W, H), fx0 = Math.max(1, bx0 - ext), fx1 = Math.min(W - 2, bx1 + ext), fy0 = Math.max(1, by0 - ext), fy1 = Math.min(H - 2, by1 + ext), inReg = (i) => region[i] <= ext;
    let kn = 0, kr = 0, kg = 0, kb = 0; for (let i = 0; i < N; i++) if (sclM[i]) { kn++; kr += d[i * 4]; kg += d[i * 4 + 1]; kb += d[i * 4 + 2]; }
    for (let y = fy0; y <= fy1; y++) for (let x = fx0; x <= fx1; x++) { const i = y * W + x; if (!inReg(i)) continue; if (sclM[i]) { for (let c = 0; c < 3; c++) fill.d[i * 4 + c] = d[i * 4 + c]; } else { fill.d[i * 4] = kr / kn; fill.d[i * 4 + 1] = kg / kn; fill.d[i * 4 + 2] = kb / kn; } fill.d[i * 4 + 3] = 255; }
    for (let it = 0; it < 260; it++) for (let y = fy0; y <= fy1; y++) for (let x = fx0; x <= fx1; x++) { const i = y * W + x; if (!inReg(i) || sclM[i]) continue; for (let c = 0; c < 3; c++) fill.d[i * 4 + c] = (fill.d[(i - 1) * 4 + c] + fill.d[(i + 1) * 4 + c] + fill.d[(i - W) * 4 + c] + fill.d[(i + W) * 4 + c]) / 4; }
    { // bright flat sclera colour in the middle of the exposed area, blending into the real sclera at the margin (no dark ring left over from the old iris)
      let lum = []; for (let i = 0; i < N; i++) if (sclM[i]) lum.push([d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2], i]); lum.sort((p, q) => q[0] - p[0]);
      let rs = 0, gs = 0, bs = 0, n = 0; for (let t = 0; t < Math.floor(lum.length * 0.5); t++) { const i = lum[t][1]; rs += d[i * 4]; gs += d[i * 4 + 1]; bs += d[i * 4 + 2]; n++; }
      const base = [rs / n, gs / n, bs / n], dK = new Int16Array(N).fill(32000), kq = []; for (let i = 0; i < N; i++) if (sclM[i]) { dK[i] = 0; kq.push(i); }
      const lim2 = Math.round(90 * U); for (let h = 0; h < kq.length; h++) { const i = kq[h], x = i % W, y = (i / W) | 0, nd = dK[i] + 1; if (nd > lim2) continue; for (const j of nb4(i, x, y)) if (j >= 0 && dK[j] > nd) { dK[j] = nd; kq.push(j); } }
      for (let i = 0; i < N; i++) if (inReg(i) && !sclM[i]) { const w = smooth(3 * U, 22 * U, dK[i]); for (let c = 0; c < 3; c++) fill.d[i * 4 + c] = fill.d[i * 4 + c] * (1 - w) + base[c] * w; }
    }
    const src = new Int32Array(N).fill(-1); for (let i = 0; i < N; i++) if (inReg(i) && fill.d[i * 4 + 3] === 255) src[i] = i;
    // 6. iris sprite: real pixels inside the iris disc; where the lid hides part of it, copy from the nearest visible iris pixel
    const vis = new Uint8Array(N); for (let i = 0; i < N; i++) if (hullM[i] && inEll(ell, i % W, (i / W) | 0) <= 1) vis[i] = 1;
    const isrc = new Int32Array(N).fill(-1), iq = []; for (let i = 0; i < N; i++) if (vis[i]) { isrc[i] = i; iq.push(i); }
    for (let h = 0; h < iq.length; h++) { const i = iq[h], x = i % W, y = (i / W) | 0; for (const j of nb4(i, x, y)) if (j >= 0 && isrc[j] < 0 && inEll(ell, j % W, (j / W) | 0) <= 1.06) { isrc[j] = isrc[i]; iq.push(j); } }
    // 7. travel limits: how far the iris can slide before more than ~30% of it leaves the socket
    const samples = []; for (let y = Math.floor(ell[1] - ell[3]); y <= ell[1] + ell[3]; y += 3) for (let x = Math.floor(ell[0] - ell[2]); x <= ell[0] + ell[2]; x += 3) if (inEll(ell, x, y) <= 1) samples.push([x, y]);
    const outFrac = (dx, dy) => { let o = 0; for (const [x, y] of samples) { const xx = Math.round(x + dx), yy = Math.round(y + dy); if (xx < 0 || yy < 0 || xx >= W || yy >= H || !hole[yy * W + xx]) o++; } return o / samples.length; };
    const o0 = outFrac(0, 0), cap = Math.round(80 * U), thr = Math.max(0.3, o0 + 0.12);
    const reach = (ux, uy) => { let t = 0; while (t < cap && outFrac(ux * (t + 2), uy * (t + 2)) <= thr) t += 2; return t; };
    const range = { left: reach(-1, 0), right: reach(1, 0), up: reach(0, -1), down: reach(0, 1) };
    // 8. crop + draw the sheets
    const sx0 = Math.max(0, xmin - ext), sy0 = Math.max(0, ymin - ext), sx1 = Math.min(W - 1, xmax + ext), sy1 = Math.min(H - 1, ymax + ext), sw = sx1 - sx0 + 1, sh = sy1 - sy0 + 1;
    const sclera = L.make(sw, sh);
    for (let y = sy0; y <= sy1; y++) for (let x = sx0; x <= sx1; x++) { const i = y * W + x, t = ((y - sy0) * sw + (x - sx0)) * 4; if (src[i] >= 0) { sclera.d[t] = fill.d[i * 4]; sclera.d[t + 1] = fill.d[i * 4 + 1]; sclera.d[t + 2] = fill.d[i * 4 + 2]; sclera.d[t + 3] = 255; } }
    const ix0 = Math.floor(ell[0] - ell[2] - 4), iy0 = Math.floor(ell[1] - ell[3] - 4), iw = Math.ceil(2 * ell[2] + 8), ih = Math.ceil(2 * ell[3] + 8), iris = L.make(iw, ih);
    for (let y = iy0; y < iy0 + ih; y++) for (let x = ix0; x < ix0 + iw; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue; const ev = inEll(ell, x, y); if (ev > 1.08) continue; const i = y * W + x; if (isrc[i] < 0) continue;
      const a = 1 - smooth(0.92, 1.05, ev), s = isrc[i] * 4, t = ((y - iy0) * iw + (x - ix0)) * 4;
      iris.d[t] = d[s]; iris.d[t + 1] = d[s + 1]; iris.d[t + 2] = d[s + 2]; iris.d[t + 3] = Math.round(a * 255);
    }
    if (!exports._dbg) exports._dbg = {}; exports._dbg[k] = { hullM, hole, sclM };
    sheets[k] = { sclera: { img: sclera, x: sx0, y: sy0 }, iris: { img: iris, x: ix0, y: iy0 } };
    meta[k] = { sclera: [sx0, sy0, sw, sh], iris: [ix0, iy0, iw, ih], center: [+ell[0].toFixed(1), +ell[1].toFixed(1)], r: +ell[2].toFixed(1), range, hiddenAtNeutral: +o0.toFixed(2), socket: [xmin, ymin, xmax, ymax] };
    log(`  eye ${k}: iris c(${ell[0].toFixed(0)},${ell[1].toFixed(0)}) r${ell[2].toFixed(0)} socket ${xmax - xmin}x${ymax - ymin} hidden ${o0.toFixed(2)} range L${range.left} R${range.right} U${range.up} D${range.down}`);
  });
  return { head: { w: W, h: H, d: headLayer }, sheets, meta };
};

if (require.main === module) {   // debug render: node eyes3.cjs <head> [irisShiftX] [irisShiftY]  -> %TEMP%/eyes_dbg.png (magenta backdrop proves nothing is see-through)
  const sharp = require("sharp"), name = process.argv[2] || "mochi-rest-head", im = L.read(`../cut/${name}.png`), r = exports.buildEyes(im, console.log);
  const base = L.make(im.w, im.h); for (let i = 0; i < im.w * im.h; i++) { base.d[i * 4] = 255; base.d[i * 4 + 2] = 255; base.d[i * 4 + 3] = 255; }
  const put = (src, ox, oy, dx = 0, dy = 0) => { for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const s = (y * src.w + x) * 4, a = src.d[s + 3] / 255; if (!a) continue; const X = x + ox + dx, Y = y + oy + dy; if (X < 0 || Y < 0 || X >= base.w || Y >= base.h) continue; const t = (Y * base.w + X) * 4; for (let c = 0; c < 3; c++) base.d[t + c] = src.d[s + c] * a + base.d[t + c] * (1 - a); } };
  const sh = +(process.argv[3] || 0), sv = +(process.argv[4] || 0);
  for (const k of ["L", "R"]) { put(r.sheets[k].sclera.img, r.sheets[k].sclera.x, r.sheets[k].sclera.y); put(r.sheets[k].iris.img, r.sheets[k].iris.x, r.sheets[k].iris.y, sh, sv); }
  put(r.head, 0, 0);
  const m = r.meta.L, cx = (m.socket[0] + r.meta.R.socket[2]) / 2, cy = (m.socket[1] + m.socket[3]) / 2;
  L.write(process.env.TEMP + "/eyes_full.png", base);
  sharp(process.env.TEMP + "/eyes_full.png").extract({ left: Math.max(0, Math.round(m.socket[0] - 120)), top: Math.max(0, Math.round(cy - 220)), width: Math.min(im.w - Math.max(0, Math.round(m.socket[0] - 120)), Math.round(r.meta.R.socket[2] - m.socket[0] + 240)), height: 440 }).resize({ width: 1200 }).png().toFile(process.env.TEMP + "/eyes_dbg.png");
}
