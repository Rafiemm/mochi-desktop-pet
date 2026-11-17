// Online updates from GitHub Releases. Installed copies check on start and every 6 hours, download in the
// background and install when Mochi next restarts (or right away from the tray menu).
const { app } = require("electron");

let autoUpdater = null;
const status = { text: "", ready: false, version: null };
let notify = () => {}, onChange = () => {}, manual = false;

function init(opts) {
  notify = opts.say; onChange = opts.onChange;
  if (!app.isPackaged) return;                       // no updates while running from source (npm start)
  try { autoUpdater = require("electron-updater").autoUpdater; } catch (e) { return; }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("checking-for-update", () => set("Checking for updates..."));
  autoUpdater.on("update-available", (i) => { set("Downloading v" + i.version + "..."); if (manual) notify("A new version is coming! Downloading..."); });
  autoUpdater.on("update-not-available", () => { set(""); if (manual) notify("I'm already up to date!"); manual = false; });
  autoUpdater.on("update-downloaded", (i) => {
    status.ready = true; status.version = i.version; set("");
    notify("I have an update (v" + i.version + ")! I'll install it next time I restart.");
  });
  autoUpdater.on("error", () => { set(""); if (manual) notify("I couldn't check for updates. Are you online?"); manual = false; });
  setTimeout(check, 15 * 1000);
  setInterval(check, 6 * 60 * 60 * 1000);
}
function set(t) { status.text = t; onChange(); }
function check(isManual) {
  if (!autoUpdater || status.ready) return;
  manual = isManual === true;
  autoUpdater.checkForUpdates().catch(() => {});
}
function installNow() { if (autoUpdater && status.ready) autoUpdater.quitAndInstall(false, true); }

module.exports = { init, check, installNow, status, available: () => !!autoUpdater };
