# Mochi mascot - integration brief for an AI coding agent

You are adding **Mochi**, an animated cat mascot, to a website. This folder is complete: everything needed is in `mascot/`.
Do **not** redraw, regenerate, resize or edit the images, and do **not** rewrite or "improve" `mochi-mascot.js` / `mochi-mascot.css`.
Your job is only to **install it correctly, wire it to the site, and set its wording**. Read this whole file first.

## 0. What Mochi is
A dependency-free vanilla JS component (no npm packages, no build step). She creates her own markup, sits fixed in the bottom-right
corner, follows the cursor with her eyes and head, swishes her tail, talks in a speech bubble, and can wave, jump, celebrate, give a
thumbs-up, dance, cheer, shrug, think, walk around the page, blink, fidget and fall asleep when idle.
She is one character (a cream cat with peach patches, a rose-pink knit sweater and a gold bell). There are no variants.

## 1. Folder contents
```
mascot/mochi-mascot.js     the component (layout data is embedded)
mascot/mochi-mascot.css    styles
mascot/assets/             all images (about 0.9 MB in total; roughly 150 KB is loaded before she appears)
demo/index.html            a working demo page with a button for every action (open via a local server)
START_HERE.md              this file
```

## 2. Install (any site)
1. Copy `mascot/mochi-mascot.js`, `mascot/mochi-mascot.css` and the whole `mascot/assets/` folder into the site's **public/static folder** under
   a folder named `mochi/` so the files are served as:
   - `/mochi/mochi-mascot.js`
   - `/mochi/mochi-mascot.css`
   - `/mochi/assets/...`
2. Add to the site's HTML `<head>`/before `</body>` **once, globally** (root layout / base template, not per page):
   ```html
   <link rel="stylesheet" href="/mochi/mochi-mascot.css">
   <script src="/mochi/mochi-mascot.js" data-assets="/mochi/assets/" defer></script>
   ```
   Always include `data-assets` (explicit path) so it works even when a framework injects the script.
3. It must be served over http(s). It will not work when the page is opened as a `file://`.

### Framework notes
- **Plain HTML / static site:** paste the two tags into every page template (or the shared header/footer include).
- **Next.js (App Router):** put the files in `public/mochi/`. In `app/layout.tsx` add
  `<link rel="stylesheet" href="/mochi/mochi-mascot.css" />` and
  `<Script src="/mochi/mochi-mascot.js" strategy="afterInteractive" data-assets="/mochi/assets/" />` (`import Script from "next/script"`).
  Mount it once in the root layout so it survives navigation.
- **Next.js (Pages Router):** same, in `pages/_app.tsx` / `_document.tsx`.
- **React/Vite/CRA, Vue, Nuxt, Svelte, Astro:** put the files in the public/static folder (`public/mochi/`), add the `<link>` and `<script defer ...>` tags to the root `index.html` (or root layout). No imports, no npm install.
- **WordPress:** copy the folder into the theme (`/wp-content/themes/<theme>/mochi/`), then use `wp_enqueue_style` / `wp_enqueue_script` (footer) and add the `data-assets` attribute via the `script_loader_tag` filter. Or paste the tags into the footer template.
- **Shopify/Wix/Squarespace/Webflow:** upload the files to the platform's file hosting/CDN, then add the two tags in the global custom-code (footer) section, with `data-assets` pointing at the hosted assets URL.
- Single-page apps: do **not** mount it on every route/component render; once globally is enough (it is idempotent anyway).

## 3. Where she appears / adjusting without editing the files
By default she is fixed at the bottom-right, `z-index: 9999`, and never blocks clicks except on her own body.
Adjust only through CSS overrides in the site's own stylesheet (do not edit `mochi-mascot.css`):
```css
.mochi-mascot {
  --mochi-size: clamp(190px, 20vw, 300px);  /* width of the whole mascot, tail included */
  --mochi-right: 12px;                       /* distance from the right edge */
  --mochi-bottom: 6px;                       /* distance from the bottom */
  --mochi-z: 9999;                           /* raise/lower above other fixed UI */
}
```
Typical fixes: a cookie banner or chat widget covers her -> raise `--mochi-bottom` / `--mochi-right`, or change `--mochi-z`.
Dark site -> add `data-theme="dark"` on the `.mochi-mascot` element or set the `--mochi-bubble-*` variables.
Script options: `data-roam="false"` (stop her wandering on her own), `data-click="false"` (ignore clicks on her).

## 3b. Customise the size, position and WORDS (no code edits needed)
Everything below is optional. Put it in a small script **before** the Mochi script tag (or call `mochiMascot.configure({...})` later).
Tailor the wording to the site's brand voice, language and audience; keep lines short and friendly. The built-in remarks are cat puns
("Purr-fect timing!") - replace them if the site needs a different tone.
```html
<script>
  window.MOCHI_CONFIG = {
    welcome: "Welcome! Looking for something? Just ask.",   // first message after load ("" = say nothing)
    phrases: [                                               // random remarks every ~50 s (false or [] = none)
      "Our team replies within one business day.",
      "Psst... the best offers are below."
    ],
    phraseEvery: 50,        // seconds between remarks (0.85x-1.15x randomised)
    phraseHold: 4000,       // how long each remark stays after typing (ms)
    welcomeDelay: 1500, welcomeHold: 5000,
    roamEvery: 50,          // seconds between self-started strolls/waves (default ~50)
    size: 240,              // mascot width in px (or "20vw", "clamp(160px,18vw,260px)")
    right: 24, bottom: 12,  // distance from the bottom-right corner (px or any CSS length)
    zIndex: 9999,
    theme: "dark",          // optional: "dark" for dark sites
    bubble: { bg: "#ffffff", ink: "#3a2a2a", border: "rgba(214,120,130,.28)", font: "15px/1.4 Inter, sans-serif" }
  };
</script>
```
- **Size:** `size` above, or the CSS variable `--mochi-size`. It is responsive by default and shrinks on phones; give a different phone size with a media query on `--mochi-size`.
- **Wording:** `welcome`, `phrases` (any language), plus anything you pass to `mochiMascot.say("...")` for event-specific lines.
- Short alternatives via script-tag attributes: `data-size="220" data-right="24" data-bottom="12" data-welcome="Hello!" data-theme="dark"`.
- If the user told you what Mochi should say, use their wording exactly. Otherwise write sensible on-brand lines yourself.

## 4. Make her react to the site (this is what makes her feel alive)
Global object `window.mochiMascot` (available after the script loads; `say` calls made early are queued, so call actions after load or inside event handlers):
```js
mochiMascot.say("Welcome!");                          // speech bubble, she talks while it types
mochiMascot.say("Thanks!", { duration: 6000 });       // hold time after typing (ms)
mochiMascot.wave();  mochiMascot.jump();  mochiMascot.celebrate();  mochiMascot.thumbsUp();
mochiMascot.dance(); mochiMascot.wink();  mochiMascot.clap();       mochiMascot.shrug();
mochiMascot.think(); mochiMascot.surprised();  mochiMascot.fidget();
mochiMascot.sleep(); mochiMascot.wake();
mochiMascot.pointAt("#pricing");                      // walks next to the element and cheers it on
mochiMascot.walkTo("left" | "right" | "center" | "home" | elementOrSelector | xPixels);
mochiMascot.stroll();  mochiMascot.home();  mochiMascot.stop();  mochiMascot.hush();
mochiMascot.react("celebrate");                       // wave jump celebrate thumbs dance wink clap shrug think surprised sleep wake walk home fidget
```
Actions return Promises (true = finished, false = interrupted). Starting a new action cancels the current one.

Honest notes on what the actions really are (she has 7 body poses: rest, wave, two walk steps, celebrate, thumbs-up, think):
- `pointAt` has no pointing picture: she walks next to the element, tilts her head toward it and gives a thumbs-up.
- `clap` is a cheer (arms up and down); `shrug` is a head tilt with a little squash; `wink` is a happy squint with a head tilt (no one-eye wink); `dance` alternates her two walk frames to a beat.
- `sleep` closes her eyes and slows her breathing; `wake` makes her startled.

### Recommended wiring (do these unless the user says otherwise)
| Site event | Call |
|---|---|
| Page load | nothing (she greets herself: waves + the welcome line) |
| Form submitted successfully / signup / application sent | `mochiMascot.celebrate(); mochiMascot.say("Thank you! We'll be in touch.")` |
| Form validation error / failed request | `mochiMascot.shrug(); mochiMascot.say("Oops - please check the highlighted fields.")` |
| Something loading (>1 s) | `mochiMascot.think()` |
| Hover/focus on a key CTA or feature card | `mochiMascot.say("<short helpful line>")` |
| Guiding the visitor to a section | `mochiMascot.pointAt("#services")` |
| User completes a step / positive confirmation | `mochiMascot.thumbsUp()` |
Keep messages short (under ~80 characters), friendly and on-brand. Do not call actions in tight loops or on every scroll/mousemove.
By herself she already blinks, looks around, swishes her tail, fidgets, occasionally strolls/waves/dances, says an idle quip every 45-60 s,
falls asleep after ~75 s of no activity and wakes startled.

## 5. Accessibility / performance (already handled - do not break)
- Respects `prefers-reduced-motion` (no walking/hopping; eyes still track).
- Speech is announced to screen readers; she never takes keyboard focus or covers important controls except by position (see section 3).
- Images stream in after the first paint. Do not convert images or add lazy-loading attributes.

## 6. Verify before you say you're done
Run the site locally and check each item; fix by adjusting installation/CSS overrides only:
1. Open the site in a browser: within ~2 s Mochi appears bottom-right, waves and says her welcome line.
2. Browser console: **no errors, no 404s** for `/mochi/...` files (Network tab, filter "mochi").
3. Move the mouse: her eyes and head follow it. The head must stay attached to the body at all times, and her tail swishes behind her.
4. In the console run `mochiMascot.celebrate()`, then `mochiMascot.walkTo("left")` -> she hops, then walks, without errors. Run `mochiMascot.say("test")` -> the bubble appears above her head and stays on screen.
5. Resize to a phone width (375 px): she shrinks (~130-175 px), no horizontal scrollbar, the bubble stays inside the screen.
6. She does not cover a cookie banner, chat widget, or primary buttons; if she does, fix with section 3.
7. Wire the recommended events from section 4 on the site's real forms/CTAs and test each once.
8. `demo/index.html` (served via a local server) shows every action; use it to compare if something looks wrong on the real site.

## 7. If something goes wrong
- She doesn't appear + 404 in console -> the files are not at the path in `data-assets` / `src`; fix the path (must end in `/assets/`).
- Nothing happens when calling `mochiMascot...` -> the script hasn't loaded yet; call from an event handler or after `window.addEventListener("load", ...)`.
- Blocked by Content-Security-Policy -> allow scripts/styles/images from the folder that hosts `/mochi/` (self).
- Do not "fix" problems by editing the component or the images. If it genuinely needs a code change, report the problem to the user instead.

## 8. Report back to the user
Say where the files went, what wording you set, what events you wired, and what you verified (list section 6 results). Mention anything you could not test.
