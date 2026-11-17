const { app, BrowserWindow, Tray, Menu, screen, ipcMain, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");
const updater = require("./updater");

if (!app.requestSingleInstanceLock()) app.quit();

let win = null, tray = null;
const state = { displayId: null, visible: true, quiet: false, outfit: "default", size: "auto" };
// Mochi's width in px. "auto" scales her to the screen (about a fifth of the screen height), so she suits any monitor.
const SIZES = [
  { px: 90, label: "Tiny" }, { px: 120, label: "Very small" }, { px: 150, label: "Small" }, { px: 180, label: "Medium small" },
  { px: 220, label: "Medium" }, { px: 260, label: "Large" }, { px: 320, label: "Extra large" }, { px: 400, label: "Huge" },
];
function outfitList() { try { const m = JSON.parse(fs.readFileSync(path.join(__dirname, "assets/outfits/outfits.json"), "utf8")); return Object.keys(m).map((id) => ({ id, name: m[id].name })); } catch (e) { return []; } }
const stateFile = () => path.join(app.getPath("userData"), "settings.json");
function loadState() { try { Object.assign(state, JSON.parse(fs.readFileSync(stateFile(), "utf8"))); } catch (e) { /* first run */ } }
function saveState() { try { fs.writeFileSync(stateFile(), JSON.stringify(state)); } catch (e) { /* ignore */ } }

function autoSize() { const h = targetDisplay().workArea.height; return Math.max(90, Math.min(320, Math.round(h * 0.2 * 0.611))); }
function sizePx() { return state.size === "auto" || !Number.isFinite(+state.size) ? autoSize() : Math.max(60, Math.min(600, Math.round(+state.size))); }
function applySize() { if (win && !win.isDestroyed()) win.webContents.send("size", sizePx()); }
function setSize(v) { state.size = v; saveState(); applySize(); refreshTray(); }
function stepSize(dir) {          // one notch bigger (+1) or smaller (-1) than she is now
  const cur = sizePx(), ladder = SIZES.map((s) => s.px);
  const next = dir > 0 ? ladder.find((p) => p > cur + 2) : [...ladder].reverse().find((p) => p < cur - 2);
  if (next) setSize(next);
}
function targetDisplay() {
  return screen.getAllDisplays().find((d) => d.id === state.displayId) || screen.getPrimaryDisplay();
}
function fit() {
  if (!win) return;
  const d = targetDisplay();
  state.displayId = d.id;
  win.setBounds(d.workArea);   // the whole display above the taskbar
}

function createWindow() {
  const d = targetDisplay();
  win = new BrowserWindow({
    ...d.workArea,
    transparent: true, frame: false, resizable: false, movable: false, hasShadow: false,
    skipTaskbar: true, focusable: false, alwaysOnTop: true, show: false,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, "index.html"), { query: { outfit: state.outfit, size: String(sizePx()) } });
  win.once("ready-to-show", () => { if (state.visible) win.showInactive(); applyQuiet(); });
  win.on("closed", () => { win = null; });
}

function applyQuiet() {
  if (win && !win.isDestroyed() && state.quiet) win.webContents.send("config", { phrases: false });
}

function buildMenu() {
  const displays = screen.getAllDisplays();
  const cur = targetDisplay().id;
  return Menu.buildFromTemplate([
    { label: "Mochi", enabled: false },
    { label: state.visible ? "Hide Mochi" : "Show Mochi", click: () => { state.visible = !state.visible; if (state.visible) win.showInactive(); else win.hide(); saveState(); refreshTray(); } },
    { label: "Say hi", click: () => win && win.webContents.send("say", "Meow! Hi!") },
    { type: "separator" },
    {
      label: "Outfit",
      submenu: [{ id: "default", name: "Pink sweater (original)" }].concat(outfitList()).map((o) => ({
        label: o.name, type: "radio", checked: o.id === state.outfit,
        click: () => { state.outfit = o.id; if (win) win.webContents.send("outfit", o.id); saveState(); },
      })),
    },
    {
      label: "Size",
      submenu: [
        { label: "Auto (fit my screen)", type: "radio", checked: state.size === "auto", click: () => setSize("auto") },
        ...SIZES.map((s) => ({ label: s.label + " (" + s.px + " px)", type: "radio", checked: state.size !== "auto" && sizePx() === s.px, click: () => setSize(s.px) })),
        { type: "separator" },
        { label: "Bigger", click: () => stepSize(1) },
        { label: "Smaller", click: () => stepSize(-1) },
      ],
    },
    {
      label: "Screen",
      submenu: displays.map((d, i) => ({
        label: "Display " + (i + 1) + (d.id === screen.getPrimaryDisplay().id ? " (main)" : "") + " - " + d.size.width + "x" + d.size.height,
        type: "radio", checked: d.id === cur,
        click: () => { state.displayId = d.id; fit(); applySize(); saveState(); refreshTray(); },
      })),
    },
    { label: "Stay quiet (no random remarks until restart)", type: "checkbox", checked: state.quiet, click: (m) => { state.quiet = m.checked; saveState(); if (m.checked) applyQuiet(); } },
    { label: "Start with Windows", type: "checkbox", checked: app.getLoginItemSettings().openAtLogin, click: (m) => app.setLoginItemSettings({ openAtLogin: m.checked }) },
    { type: "separator" },
    { label: "Mochi v" + app.getVersion() + (updater.status.text ? " - " + updater.status.text : ""), enabled: false },
    updater.status.ready
      ? { label: "Restart to update to v" + updater.status.version, click: () => updater.installNow() }
      : { label: "Check for updates", enabled: updater.available() && !updater.status.text, click: () => updater.check(true) },
    { type: "separator" },
    { label: "Quit Mochi", click: () => app.quit() },
  ]);
}
function refreshTray() { if (tray) tray.setContextMenu(buildMenu()); }

app.whenReady().then(() => {
  loadState();
  createWindow();
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, "tray.png")));
  tray.setToolTip("Mochi");
  refreshTray();
  updater.init({ say: (t) => win && win.webContents.send("say", t), onChange: refreshTray });
  const refit = () => { fit(); applySize(); refreshTray(); };
  screen.on("display-added", refit);
  screen.on("display-removed", refit);
  screen.on("display-metrics-changed", refit);
});

ipcMain.on("interactive", (_e, v) => {
  if (!win || win.isDestroyed()) return;
  if (v) win.setIgnoreMouseEvents(false); else win.setIgnoreMouseEvents(true, { forward: true });
});
app.on("second-instance", () => { if (win && state.visible) win.showInactive(); });
app.on("window-all-closed", () => app.quit());
