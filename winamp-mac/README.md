# Winamp for macOS

A native-feeling Winamp player for macOS, built with Electron and
[Webamp](https://github.com/captbaritone/webamp) — a mature, MIT-licensed
reimplementation of Winamp 2.9 in JavaScript.

Rather than re-implementing Winamp's `.wsz` skin format, bitmap slicing, EQ
DSP, and visualizer from scratch, this app wraps Webamp (which already does
all of that correctly and is well-tested) in a native macOS shell.

## Features

**Classic Winamp UI** (via Webamp):

- Main player window with spectrum analyzer / oscilloscope visualizer,
  kbps/kHz readout, scrolling marquee, shuffle & repeat
- Playlist editor with drag-reorder, selection ops, and the classic
  ADD/REM/SEL/MISC button menus
- 10-band graphic equalizer with preamp, presets menu, and `.eqf` support
- **Milkdrop visualizer** (Butterchurn) with the bundled preset collection —
  open it from the main window context menu → Windows → Milkdrop; it starts
  docked below the main/EQ stack
- Full `.wsz` classic skin support — load from the File menu or drag a skin
  from Finder onto the window
- Winamp keyboard shortcuts (X/C/V/B/Z etc.) via Webamp's hotkeys
- Double-size mode (`Ctrl+D`), window shade modes, window snapping/docking

**Native macOS shell** (this app):

- Hidden titlebar with native traffic-light buttons
- File menu: Open Audio Files (`Cmd+O`), Open URL for internet radio /
  SHOUTcast-style streams (`Cmd+L`), Load Playlist (`Cmd+Shift+O`), Save
  Playlist (`Cmd+S`), Load Skin (`Cmd+Shift+S`)
- Playback menu: play/pause, stop, previous/next (`Cmd+←`/`Cmd+→`), seek,
  shuffle (`Cmd+U`), repeat (`Cmd+R`)
- Playlist save/load as `.m3u`/`.m3u8` (with `#EXTINF` metadata) and `.pls`
  import; relative paths in playlists are resolved against the playlist's
  own directory
- Dock menu with Play/Pause, Stop, Previous, Next
- Global hotkeys that work while the app is in the background:
  `Cmd+Alt+Space` (play/pause), `Cmd+Alt+←`/`→` (prev/next), `Cmd+Alt+↓`
  (stop). Hardware media keys and the lock screen "now playing" widget work
  through the OS media session (Webamp's `enableMediaSession`).
- Finder drag-and-drop for audio files and `.wsz` skins
- The last skin and playlist persist across launches (skins are copied into
  the app's user data directory)

### Not included (and why)

- **Media library** — Winamp's ML database/browser isn't part of Webamp;
  it would be a substantial separate build.
- **CD ripping/burning, video playback** — need native disc/codec access
  that doesn't fit an Electron + Web Audio app.
- **Native Winamp plugins (.dll)** — Windows binaries; can't run here.
  Milkdrop is covered by Butterchurn, which is a faithful WebGL port.
- **Modern (Winamp 3/5) skins** — Webamp supports classic 2.x skins only.
- **Bundled extra skins** — the classic default skin is built in; the skin
  CDNs were unreachable from the build sandbox, so grab `.wsz` files from
  the [Winamp Skin Museum](https://skins.webamp.org) and load them via
  `Cmd+Shift+S` or drag-and-drop.

## Requirements

- macOS
- Node.js 18+

## Setup

```sh
cd winamp-mac
npm install
```

## Run in development

```sh
npm start
```

## Build a macOS app (.app / .dmg)

```sh
npm run build:mac
```

This uses `electron-builder` and must be run on macOS. Output (including the
`.dmg`) appears in `dist/`. The app is unsigned by default — right-click →
Open the first time, or configure code signing for distribution.

## Project layout

- `main.js` — Electron main process: window creation, native menus, dock
  menu, global hotkeys, file/skin/playlist dialogs, M3U/PLS parsing and
  writing, and persisting the last skin + playlist to
  `app.getPath("userData")`.
- `preload.js` — Exposes a minimal `window.winampHost` bridge to the renderer
  (contextIsolation is on, nodeIntegration is off).
- `src/index.html`, `src/style.css`, `src/app.js` — Renderer: mounts Webamp
  (butterchurn ESM bundle) into `#webamp`, wires the host bridge, and
  implements the in-app Open URL prompt.
- `src/test-harness.html` — Stand-in for `winampHost` so the renderer can be
  exercised in a plain browser (used for headless verification; serve the
  project root over HTTP since plain Chromium blocks ESM over `file://`).

## Verification status

Developed in a sandboxed Linux container without macOS and without outbound
access to download an Electron binary, so the Electron shell itself (menus,
dialogs, dock, global shortcuts, persistence) could not be launched
end-to-end here.

What *was* verified, headlessly in Chromium via `src/test-harness.html`:

- Webamp mounts with no console/page errors; main player, playlist, EQ, and
  Milkdrop windows all render pixel-correct and dock without overlapping
- Real audio playback: a generated WAV plays (`getMediaStatus() ===
  "PLAYING"`), with correct duration and kbps/kHz readout
- The Milkdrop window initializes WebGL and animates a preset with the
  track-title overlay
- The Open URL prompt opens via the command channel, accepts a stream URL on
  Enter, and appends it to the playlist

Not yet verified on an actual Mac: native menus/dialogs, dock menu, global
shortcuts, Finder drag-and-drop, traffic-light chrome, ESM renderer over
`file://` (supported since Electron 28; this app uses Electron 43), and the
skin/playlist persistence round-trip through `main.js`. Please run
`npm start` on macOS to confirm these before relying on the app.
