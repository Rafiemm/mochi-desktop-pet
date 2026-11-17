# Rebuilding Mochi's assets (only needed if the artwork changes)

Source images live in `poses/` (named `mochi-<pose>-body.png`, `mochi-<expression>-head.png`, `mochi-tail.png`). From `tools/`:

```
node cutall.cjs && node analyze.cjs && node build-mochi.cjs && node inject.cjs
```

- `cutall.cjs` cuts every image out of its white background into `cut/`
- `analyze.cjs` measures neck anchors, collar widths and head registration
- `build-mochi.cjs` builds the eye layers, sizes and positions everything, writes `mascot/assets/` + `mascot/layout.json`
- `inject.cjs` embeds the layout into `mascot/mochi-mascot.js`
- Per-pose size/position tweaks go in `calib.json` (see the top of `build-mochi.cjs`)
- `node serve.cjs ../mascot 5180` serves the demo page at http://127.0.0.1:5180/
