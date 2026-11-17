const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("mochiHost", {
  setInteractive: (v) => ipcRenderer.send("interactive", v),
  onConfig: (fn) => ipcRenderer.on("config", (_e, c) => fn(c)),
  onOutfit: (fn) => ipcRenderer.on("outfit", (_e, id) => fn(id)),
  onSay: (fn) => ipcRenderer.on("say", (_e, t) => fn(t)),
});
