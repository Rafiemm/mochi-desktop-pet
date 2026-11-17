// Embed mascot/layout.json into mascot/mochi-mascot.js (between the LAYOUT markers).   node inject.cjs
const fs = require("fs"), f = "../mascot/mochi-mascot.js", layout = fs.readFileSync("../mascot/layout.json", "utf8");
let s = fs.readFileSync(f, "utf8");
const a = s.indexOf("/* LAYOUT:BEGIN"), b = s.indexOf("/* LAYOUT:END */");
const head = s.slice(0, s.indexOf("\n", a) + 1);
fs.writeFileSync(f, head + "  const LAYOUT = " + layout + ";\n  " + s.slice(b));
console.log("layout injected", layout.length, "bytes");
