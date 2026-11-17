// Publish the current version as a GitHub Release (installed copies of Mochi pick it up automatically).
//   1. bump "version" in package.json (e.g. 1.0.1)      2. npm run release
// Uses your logged-in GitHub CLI for the token; nothing is stored in the repo.
const { execFileSync, spawnSync } = require("child_process");
const path = require("path");
const root = path.resolve(__dirname, "..");
let token = process.env.GH_TOKEN;
if (!token) {
  try { token = execFileSync("gh", ["auth", "token"], { encoding: "utf8" }).trim(); }
  catch (e) { console.error("Run `gh auth login` first (or set GH_TOKEN)."); process.exit(1); }
}
const version = require(path.join(root, "package.json")).version;
console.log("Publishing Mochi v" + version + " ...");
const r = spawnSync("npx", ["electron-builder", "--win", "nsis", "--publish", "always"], { cwd: root, stdio: "inherit", shell: true, env: Object.assign({}, process.env, { GH_TOKEN: token }) });
process.exit(r.status || 0);
