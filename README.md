# MystiMark · 玄迹

[![HTML](https://img.shields.io/badge/HTML-5-E34F26?logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS](https://img.shields.io/badge/CSS-3-1572B6?logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES2020-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Pyodide](https://img.shields.io/badge/Pyodide-0.27-FF6F00)](https://pyodide.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-ZXunan%2FMystiMark-181717?logo=github)](https://github.com/ZXunan/MystiMark)

[![MystiMark | Try it](https://img.shields.io/badge/Try_it-mystimark-7a2418)](https://mystimark.brmeng.top/)

**In-browser studio for hiding and recovering messages inside images.**

A zero-upload, zero-install web app that lets you tuck a short text or a
small signature image into a PNG/JPEG, then pull it back out later —
without the picture ever leaving your device.

English | [中文](README_zh.md)

---

## ⚠️ Important Notice

- **Your pixels never leave the device.** Everything runs inside your
  browser tab; there is no server, no upload, no account, and no
  analytics. The first ~30 MB download is Pyodide itself, pulled from
  the public jsDelivr CDN.
- **Stays cached after first load.** The service worker caches the
  local assets; repeat visits open instantly without re-downloading
  the engine.
- **Audit-friendly.** The Python engine ships as plain source inside
  `py_src/bw_bundle.json`. You can read the whole math layer in a
  few minutes and verify there is nothing phoning home.
- **No warranty.** Provided as-is; the authors are not responsible for
  any loss arising from use of this tool.

## Overview

MystiMark wraps a public DWT-DCT-SVD image-message-hiding algorithm in
a zero-upload browser UI, a bilingual front-end, and a
service-worker-cached asset pipeline. The engine executes unmodified
inside Pyodide (CPython compiled to WebAssembly), so the same algorithm
that runs locally for power users also runs in the browser for casual
ones — without a server in the middle.

## Features

- **Text mode** — Embed a UTF-8 message (up to 200 characters).
- **Image mode** — Embed a small PNG/JPEG signature image.
- **Two independent passwords** — One for the message, one for the
  image-block scramble. Same key on both sides is required to recover.
- **Self-contained trace shape** — After a successful hide, the engine
  reports the exact shape value you need to recover. The value pops up
  in a modal you can't miss; copy it to a safe place.
- **Bilingual UI** — English / 简体中文, switchable in the masthead.
- **Service worker cache** — First load pulls ~30 MB; repeat visits are
  instant.
- **Keyboard-navigable** — All dropzones are reachable by Tab, all
  buttons by Enter/Space.
- **Reduced-motion friendly** — Honours `prefers-reduced-motion` and
  disables smooth scroll for users who request it.

## ❤️ Sponsors

> [Want to appear here?](mailto:zxunan@example.com)

*No sponsors yet — be the first.*

## Ecosystem

Community projects that extend or integrate with MystiMark:

| Project | Description | Status |
|---|---|---|
| _(none yet)_ | _Have something to add? Open a PR._ | — |

## Tech Stack

| Component | Technology |
|---|---|
| Markup | HTML5 |
| Styling | Vanilla CSS3, no framework |
| Behaviour | Plain ES2020 JavaScript, no build step |
| Engine runtime | [Pyodide](https://pyodide.org/) 0.27 (CPython 3.12 → WebAssembly) |
| Engine deps | opencv-python 4.11, numpy 2.x, pywavelets, Pillow |
| Caching | Service Worker (same-origin only) |
| Hosting | Static site, deploys to GitHub Pages in one click |

---

## ⚙️ How it works

When the user clicks **Hide message**, the JS UI:

1. Uploads the chosen image into memory as raw bytes.
2. Sends those bytes to Pyodide via `pyodide_main.embed_str()` /
   `embed_img()`.
3. The Python engine embeds the message and returns a new PNG byte
   stream.
4. The JS UI renders the new PNG to a canvas and offers it for
   download.

The same path runs in reverse for **Recover message**.
Nothing in this flow touches a network request after the
initial page + Pyodide + bundle load.

## Configuration

There is no build step and no config file. The only knobs are:

- **`sw.js`** — `VERSION` constant. Bump it (`mm-v1.0` → `mm-v1.1`)
  every time you change `index.html`, `styles.css`, `main.js`,
  `i18n.js`, or `bw_bundle.json` — otherwise users on a stale
  service worker will see the old version.
- **`src/main.js`** — `PYODIDE_VERSION` constant. Pin to the Pyodide
  release you tested against. Bump cautiously; the runtime ABI
  changes between majors.

## Browser support

Tested on the latest two stable releases of:

- Chrome / Edge
- Firefox
- Safari

Requires WebAssembly + ES2020 + `OffscreenCanvas`. Older browsers will
get a graceful degrade — buttons still appear but the embed / recover
actions won't fire.

---

## Project Structure

```
.
|-- index.html              Entry point. Sections: studio / extract / about.
|-- styles.css              All styles. Vanilla CSS, no framework.
|-- sw.js                   Service Worker. Caches local static assets.
|   src/
|   |-- main.js             UI wiring, state machine, Pyodide calls.
|   `-- i18n.js             Bilingual string table (en / zh).
|   py_src/
|   |-- pyodide_main.py     Engine wrappers (hide / recover / probe).
|   |-- _bootstrap.py       Sets up the Pyodide filesystem + imports.
|   `-- bw_bundle.json      The engine sources, inlined as one JSON.
|-- .nojekyll               Tells GitHub Pages to skip Jekyll.
|-- .gitignore              Standard ignores.
`-- (License: MIT — see the License section above)
```

---

## ⚖️ Disclaimer

> Please read carefully before using this project:
>
> 📖 **For technical learning and research.** The authors are not
> responsible for any account suspension, service interruption, or
> other loss arising from use of this tool. Use at your own risk and
> in compliance with the laws and regulations of your country or
> region.

---

## ⭐ Star History

If you find this project useful, please give it a star — it helps
other people find it too.

[![Star History Chart](https://api.star-history.com/svg?repos=ZXunan/MystiMark&type=Date)](https://star-history.com/#ZXunan/MystiMark&Date)

---

## Built on

> **MystiMark is built on top of the open-source
> [guofei9987/blind_watermark](https://github.com/guofei9987/blind_watermark)
> project.** The DWT-DCT-SVD image-message-hiding algorithm shipped
> inside `py_src/bw_bundle.json` is an unmodified port of that
> project's Python engine. MystiMark adds a zero-upload browser UI,
> a bilingual front-end, and a service-worker-cached asset pipeline
> on top of it. If you use MystiMark in research or a product, please
> consider starring the upstream repository as well.

## License

MIT — © 2026 MystiMark · 玄迹.

---

## About

MystiMark is an open-source, in-browser studio for hiding and
recovering messages inside images. Powered by an unmodified
DWT-DCT-SVD Python engine running inside Pyodide.
