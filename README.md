# RetroAmp

A player in the style of the classic Winamp 2.9, built for modern Apple
platforms on top of
[Webamp](https://github.com/captbaritone/webamp) — an MIT-licensed
reimplementation of Winamp 2.9 in JavaScript with full `.wsz` skin support,
a 10-band equalizer, and the Milkdrop (Butterchurn) visualizer.

| App | Stack | Docs |
| --- | --- | --- |
| [`winamp-mac/`](winamp-mac) | Electron — native menus, dock controls, global hotkeys, playlist/skin persistence | [README](winamp-mac/README.md) |
| [`winamp-ios/`](winamp-ios) | Capacitor (WKWebView) — touch toolbar, Files picker, background audio | [README](winamp-ios/README.md) |

## Builds

Every push to `main` that touches either app runs the
[Build RetroAmp apps](.github/workflows/build-winamp.yml) workflow on GitHub's
macOS runners (it can also be triggered manually from the Actions tab). It
produces two artifacts:

- **retroamp-macos** — unsigned `.dmg` and `.zip` (right-click → Open on first
  launch)
- **retroamp-ios-simulator** — a Simulator `.app`; installing on a physical
  iPhone requires opening `winamp-ios` in Xcode and signing with your
  Apple ID (see the iOS README)

## Development

Each app is a self-contained npm project — see its README for setup, dev
runs, and packaging instructions.

## Disclaimer

RetroAmp is an unofficial, fan-made recreation of a classic media player
aesthetic. It is **not affiliated with, endorsed by, or connected to**
Winamp, Llama Group SA, or Nullsoft. "Winamp" is a trademark of its
respective owner. RetroAmp contains no original Winamp source code — the
player engine is [Webamp](https://github.com/captbaritone/webamp), an
independent MIT-licensed reimplementation. Classic `.wsz` skins remain the
property of their original artists.
