// Click-through: the window ignores the mouse except while it is over Mochi herself.
(() => {
  let interactive = false;
  const set = (v) => { if (v !== interactive) { interactive = v; window.mochiHost.setInteractive(v); } };
  window.addEventListener("mousemove", (e) => {
    const t = e.target;
    set(!!(t && t.classList && t.classList.contains("mochi-hit")));
  }, { passive: true });
  document.addEventListener("mouseleave", () => set(false));
  window.mochiHost.onConfig((c) => { if (window.mochiMascot) window.mochiMascot.configure(c); });
  window.mochiHost.onOutfit((id) => window.mochiMascot && window.mochiMascot.setOutfit(id));
  window.mochiHost.onSize((px) => {
    if (!window.mochiMascot) return;
    window.mochiMascot.configure({ size: px });
    window.dispatchEvent(new Event("resize"));            // keep her on screen if she was standing near the edge
  });
  window.mochiHost.onSay((t) => window.mochiMascot && window.mochiMascot.say(t));
})();
