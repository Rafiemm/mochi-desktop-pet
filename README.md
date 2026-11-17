# Mochi desktop pet

Mochi is an animated cat that lives on top of your Windows desktop. She follows your cursor with her eyes, wanders along the bottom of the screen, talks, and updates herself.

## Install

Download `Mochi-Setup-<version>.exe` from the [latest release](../../releases/latest) and run it. Windows may show a SmartScreen warning because the installer is not code-signed: click **More info → Run anyway**.

Mochi sits in the system tray: hide/show her, change outfit, choose which monitor she lives on, start with Windows, check for updates.

## Updates

Installed copies check GitHub Releases on startup and every 6 hours, download new versions in the background and install them the next time Mochi restarts (or from the tray: **Restart to update**). No reinstall needed.

## Repo layout

| Folder | What |
|---|---|
| `desktop/` | The Electron app (`npm install`, `npm start`, `npm run dist`) |
| `owl/mascot/` | The mascot web component (JS/CSS/assets), shared by the app |
| `owl/tools/` | Asset pipeline: cut-outs, layout, `build-outfits.cjs` |
| `owl/outfits/src/` | Generated outfit images go here |
| `Mochi-prompts.md`, `Mochi-outfit-prompts.md` | Image-generation prompts |

## Releasing a new version

```bash
cd desktop
# 1. bump "version" in package.json
# 2.
npm run release     # builds the installer and publishes the GitHub Release using your gh login
```

## Adding outfits

Put the generated images in `owl/outfits/src/`, run `node owl/tools/build-outfits.cjs`, bump the version and release. See `Mochi-outfit-prompts.md`.
