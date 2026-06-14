/**
 * main.js — UI wiring for the MystiMark studio.
 *
 * The hiding / recovery engine runs a DWT-DCT-SVD Python implementation
 * inside Pyodide, which is loaded once on first user action.
 *
 * Plain DOM + ES modules, no framework. Bilingual (en/zh) via i18n.js.
 */

import { applyI18n, initI18n, t, getLang } from "./i18n.js";

// Set <html lang> + initial <title> as early as possible (before DOM ready)
initI18n();

// Debug switch — gates info-level console.log() statements. Error /
// warn logs are NOT affected (those should always reach the console
// for support diagnostics). Flip to `true` while developing.
const DEBUG = false;
const dlog = (...args) => { if (DEBUG) console.log("[BW]", ...args); };

// EMA of the bytes/sec download rate. The ETA is based on this, not
// on a cumulative average — that way the estimate tracks short-term
// bursts and slowdowns instead of being anchored to the very first
// (typically slow) bytes.
let bootRateEMA = 0;  // MB/sec
let bootLastSampleT = 0;
let bootLastSampleMB = 0;
let bootSmRate = 0;   // 5s sliding average (MB/s) — used as the anchor for EMA

// Reentrancy guards + button-enable helpers. The click handlers are
// responsible for disabling the buttons in the same tick as the
// click; these helpers re-enable them when the operation finishes
// or fails.
let isEmbedding = false;
let isExtracting = false;
function enableEmbedBtn()   {
  const b = $("#embedBtn");
  if (!b) return;
  b.disabled = false;
  b.classList.remove("is-running");
}
function enableExtractBtn() {
  const b = $("#extractBtn");
  if (!b) return;
  b.disabled = false;
  b.classList.remove("is-running");
}

// First-time hint: ALWAYS shown (the user asked for it to be 常驻 /
// always-on so they understand the slow load is a one-off). The user
// also asked that the text NOT vary between first and repeat visits —
// the same "first time only..." line is shown both before and after
// the runtime is cached, so the layout never shifts.
function maybeShowFirstTimeHint() {
  const hint = document.getElementById("bootHint");
  if (!hint) return;
  // Always show the hint — do NOT hide it after the runtime is ready.
  hint.hidden = false;
  hint.textContent = t("boot.first_time_hint");
}

// ----------------- bootstrap Pyodide on first action -----------------

let pyodide = null;
let pyodideReady = null;

// Boot progress model. We track both a coarse stage (for the label
// and the cumulative weight on the bar) and a finer per-stage
// "bytes done" so we can drive a smooth progress bar and an ETA.
//
// BOOT_WEIGHTS controls how much of the progress bar each stage
// "occupies" visually. The bulk of the load (numpy + opencv-python
// + pywavelets, ~30 MB) lives in the "packages" stage, so we give
// it 90% of the bar. The other stages are short intros that the
// user barely needs to see — the bar should look "full of work"
// during packages.
//
// STAGE_MB is the real byte estimate per stage (used for ETA math,
// not for bar width).
const BOOT_WEIGHTS = {
  idle:     0,
  script:   0.02,
  runtime:  0.93,   // Pyodide initialization dominates the perceived load
  packages: 0.04,
  bundle:   0.01,
  ready:    1.0,
  failed:   0,
};
// Per-stage total in MB. The progress bar shows "this stage's MB done
// out of total" so the user sees movement even within a single stage.
const STAGE_MB = {
  script:   4,
  runtime:  10,
  packages: 28,
  bundle:   0.1,
};
// Bytes already "done" within the current stage, for smoother bar fill
// during the package download.
let stageBytesDone = 0;
let stageBytesTotal = 0;
let bootStartTs = 0;
// Total bytes we estimate are done, used for the bar and ETA
let bootDoneMB = 0;

let pyodideBootProgress = "idle";

// Pyodide CDN choice. jsdelivr is the canonical source — it's the
// only one we can rely on for a *complete* mirror (Huaweicloud, for
// example, does not mirror python_stdlib.zip). For users on the
// China backbone the download is slow regardless of CDN; the bigger
// win is the Pyodide-built-in IndexedDB cache which makes the SECOND
// visit essentially instant (~1-2s).
const PYODIDE_VERSION = "v0.27.7";
const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/`;

function preloadPyodide() {
  if (pyodide || pyodideReady) return;
  ensurePyodide().catch(() => { /* error already shown by ensurePyodide */ });
}

async function ensurePyodide() {
  if (pyodide) return pyodide;
  if (pyodideReady) return pyodideReady;
  bootStartTs = performance.now();
  pyodideBootProgress = "script";
  bootDoneMB = 0;
  stageBytesDone = 0;
  stageBytesTotal = STAGE_MB.script;
  updateBootProgress();

  // Stage 1: the Pyodide loader script
  const script = document.createElement("script");
  script.src = PYODIDE_BASE + "pyodide.js";
  document.head.appendChild(script);
  // We can't get a progress event for a non-fetch script tag, so we
  // approximate: count a little progress while the tag is in the DOM
  // (typical <100ms) and then jump to done on onload.
  await new Promise((res, rej) => {
    script.onload = res;
    script.onerror = () => rej(new Error("Failed to download Pyodide runtime"));
  });
  bootDoneMB += STAGE_MB.script;
  updateBootProgress();

  pyodideReady = (async () => {
    try {
      // Stage 2: loadPyodide (fetches the rest of the runtime).
      // Pyodide's loadPyodide() doesn't expose download progress for
      // its internal fetches (it streams .wasm + .zip + lockfile).
      // We keep the bar visibly moving at ~60fps so the user never
      // sees a frozen UI, even though the underlying bytes are a
      // black box.
      //
      // Important: we use a *fixed per-frame step* (1/60s of stage
      // per rAF tick) rather than `elapsed = now - start`. The
      // reason: when the user switches tabs / minimises the window,
      // rAF is paused AND time keeps moving — if we computed the
      // step from elapsed, the bar would jump straight to 95% the
      // moment the user comes back. A fixed step means the bar
      // genuinely waits the full BUDGET_MS of *frame time*, which
      // can be 75s wall-clock on a foregrounded tab but pauses when
      // the user is elsewhere (which is the right behaviour: they
      // aren't watching anyway).
      pyodideBootProgress = "runtime";
      stageBytesDone = 0;
      stageBytesTotal = STAGE_MB.runtime;
      updateBootProgress();
      const fakeProgress = (() => {
        const BUDGET_MS = 75000;  // 75s wall-clock budget
        const start = performance.now();
        let raf = 0;
        let stopped = false;
        // Track visible time only. `lastVisibleMs` advances only when
        // the tab is foregrounded. `pauseOnHidden` tracks the wall
        // time at which we last went backgrounded, so we can subtract
        // it out at the end.
        let lastVisibleMs = start;
        let pauseStart = 0;
        const tick = () => {
          if (stopped) return;
          const now = performance.now();
          if (document.visibilityState === "hidden") {
            if (pauseStart === 0) pauseStart = now;
            // don't credit this gap to the visible budget
          } else {
            if (pauseStart > 0) {
              // we just came back into the foreground
              // shift `start` forward by the gap so totalMs below
              // doesn't count it
              lastVisibleMs += (now - pauseStart);
              pauseStart = 0;
            }
            lastVisibleMs = now;
          }
          // Total visible time since boot
          const totalMs = lastVisibleMs - start;
          // Linear ramp 0 → 0.95 over BUDGET_MS, plus a small sine
          // wobble so micro-stutters don't read as "frozen".
          const lin = Math.min(0.95, totalMs / BUDGET_MS);
          const wobble = Math.sin(now / 1100) * 0.005;
          stageBytesDone = Math.max(0, Math.min(0.95, lin + wobble)) * STAGE_MB.runtime;
          renderBootBarOnly();
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return { stop: () => { stopped = true; cancelAnimationFrame(raf); } };
      })();
      let py;
      try {
        py = await window.loadPyodide({ indexURL: PYODIDE_BASE });
      } finally {
        fakeProgress.stop();
      }
      bootDoneMB += STAGE_MB.runtime;
      stageBytesDone = STAGE_MB.runtime;
      // Stop the fake animation before updating — otherwise the next
      // rAF tick could overwrite the "real" 100% stageBytesDone with
      // its (still < 1) linear estimate.
      updateBootProgress();

      // Stage 3: packages. We don't add a separate log entry here —
      // the boot progress bar already shows "正在加载 numpy / opencv
      // / pywavelets..." and a second log line for the same event
      // is just noise.
      pyodideBootProgress = "packages";
      stageBytesDone = 0;
      stageBytesTotal = STAGE_MB.packages;
      // loadPackage supports an `extractProgress` callback that fires
      // with (currentBytes, totalBytes) while a single package is
      // being downloaded. We use that for the fine-grained progress
      // within the "packages" stage.
      // NOTE: We deliberately do NOT load Pillow. cv2 already handles
      // PNG/JPEG decode + encode for the small set of operations
      // pyodide_main.py needs, and skipping Pillow saves ~4MB / ~20s of
      // download on first load.
      const pkgs = ["numpy", "opencv-python", "pywavelets"];
      const perPkg = STAGE_MB.packages / pkgs.length;
      let pkgIdx = -1;
      // Smoothness: extractProgress fires during *download* but
      // pauses during the *unpack* phase (which can take 5-10s per
      // wheel). We bridge those gaps with a requestAnimationFrame
      // loop that walks stageBytesDone forward at the current EMA
      // rate — so the bar never visually freezes.
      let smoothRaf = 0;
      let smoothStop = false;
      const startT = performance.now();
      const tick = () => {
        if (smoothStop) return;
        const dt = (performance.now() - startT) / 1000;
        // Allow stageBytesDone to keep advancing at the current EMA
        // rate, but never past STAGE_MB.packages. The extractProgress
        // callback below resets stageBytesDone to the *true* value on
        // every real event, and our tick just ensures forward motion
        // between events.
        if (bootRateEMA > 0.05) {
          const projected = stageBytesDone + bootRateEMA * (1/60);
          stageBytesDone = Math.min(STAGE_MB.packages, projected);
          updateBootProgress();
        }
        smoothRaf = requestAnimationFrame(tick);
      };
      smoothRaf = requestAnimationFrame(tick);
      try {
        await py.loadPackage(pkgs, {
          extractProgress: (cur, total) => {
            // cur/total is for the *current* package. We can't see
            // which package index we're in, but we can build a running
            // total by accumulating per-package completions.
            if (cur > 0 && cur >= total && pkgIdx < pkgs.length - 1) {
              pkgIdx++;
              stageBytesDone = (pkgIdx + 1) * perPkg;
            } else if (cur > 0 && cur < total) {
              // mid-package: interpolate within the current package
              const frac = cur / total;
              stageBytesDone = (pkgIdx >= 0 ? pkgIdx : 0) * perPkg + frac * perPkg;
            }
            updateBootProgress();
          },
        });
      } catch (_) { /* loadPackage throws on real failure, caught below */ }
      finally {
        smoothStop = true;
        cancelAnimationFrame(smoothRaf);
      }
      // make sure we mark packages fully done even if progress events
      // were sparse
      stageBytesDone = STAGE_MB.packages;
      bootDoneMB += STAGE_MB.packages;
      updateBootProgress();

      // Stage 4: the bundled engine sources (small JSON)
      pyodideBootProgress = "bundle";
      stageBytesDone = 0;
      stageBytesTotal = STAGE_MB.bundle;
      updateBootProgress();
      const resp = await fetch("./py_src/bw_bundle.json");
      if (!resp.ok) throw new Error("Could not load bw_bundle.json");
      const bundle = await resp.json();
      py.FS.mkdirTree("/mystimark_engine");
      for (const [path, content] of Object.entries(bundle)) {
        if (path === "/pyodide_main.py") {
          py.FS.writeFile("/pyodide_main.py", content);
        } else if (path === "/_bootstrap.py") {
          py.FS.writeFile("/_bootstrap.py", content);
        } else {
          const fname = path.split("/").pop();
          py.FS.writeFile(`/mystimark_engine/${fname}`, content);
        }
      }
      // Both _bootstrap.py and pyodide_main.py live in bw_bundle.json and
      // are mounted into the Pyodide filesystem above. No need to fetch
      // them again from disk — that path was a leftover from when the
      // engine sources shipped as standalone .py files. The bootstrap
      // script does the heavy lifting of registering each engine module
      // with importlib so relative imports inside the package resolve.
      const bootstrapSrc = py.FS.readFile("/_bootstrap.py");
      py.runPython(new TextDecoder().decode(bootstrapSrc));
      py.runPython(
        "import mystimark_engine.version as _v; _v.bw_notes.close()"
      );
      py.runPython("import pyodide_main");
      // Probe the runtime for sanity, but the version string lives in
      // the console only — the user can see "Runtime ready" via the
      // boot progress bar and doesn't need a separate log line with
      // Python / numpy / cv2 versions.
      const info = py.runPython("pyodide_main.probe()").toJs();
      dlog("runtime", {
        python: info.get("python"),
        cv2: info.get("cv2"),
        numpy: info.get("numpy"),
      });
      stageBytesDone = STAGE_MB.bundle;
      bootDoneMB += STAGE_MB.bundle;
      pyodideBootProgress = "ready";
      // Mark this tab as having successfully booted Pyodide once —
      // subsequent visits can use this to skip the "first-time" hint.
      try { localStorage.setItem("bw:pyodideBooted", "1"); } catch (_) {}
      updateBootProgress();
      // The hint only applies while we're loading. Once ready, the
      // boot watchdog (4s timer in maybeShowFirstTimeHint) handles
      // either case: hide the slow-load message, OR keep the cached
      // confirmation. Nothing to do here.

      pyodide = py;
      if (typeof window !== "undefined") window.__pyodide = py;
      return py;
    } catch (e) {
      pyodideBootProgress = "failed";
      updateBootProgress();
      console.error("[BW] ensurePyodide failed:", e);
      // No log entry here — the boot bar already says "Could not load
      // the Python runtime. Click Retry…", which is all the user
      // needs. The full error is in the console.
      // Pyodide maintains its own IndexedDB cache (under names like
      // "pyodide-cache" / "python_stdlib" / package-specific DBs). If
      // a prior version of the page corrupted those entries — e.g. a
      // service worker rewrite that intercepted their fetches — every
      // subsequent boot will reuse the broken cached files and fail in
      // the same place. On failure, nuke those databases and surface a
      // helpful error so the user knows the fix.
      try {
        if (indexedDB.databases) {
          const dbs = await indexedDB.databases();
          for (const db of dbs) {
            if (db.name && (db.name.startsWith("pyodide") ||
                            db.name.includes("python_stdlib") ||
                            db.name.includes("-pyodide"))) {
              dlog("removing stale IndexedDB:", db.name);
              await new Promise((res) => {
                const req = indexedDB.deleteDatabase(db.name);
                req.onsuccess = req.onerror = req.onblocked = () => res();
              });
            }
          }
        }
      } catch (cleanupErr) {
        console.warn("[BW] IndexedDB cleanup failed:", cleanupErr);
      }
      // Reset the singleton so the next call retries from scratch.
      pyodideReady = null;
      throw e;
    }
  })();
  return pyodideReady;
}

// Format seconds as "Xs" / "Xm Ys" for ETA display.
function fmtETA(seconds) {
  if (!isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 1) return "<1s";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds - m * 60);
  return `${m}m ${s}s`;
}

// Compute how much of the bar should be filled, based on the current
// stage and how far through the current stage we are (0..1).
// Bar width uses BOOT_WEIGHTS (which can be configured independently
// of real byte sizes — e.g. we give "packages" 90% of the bar even
// though it's 67% of the bytes).
function barFraction(stage, fracInStage) {
  const order = ["script", "runtime", "packages", "bundle"];
  const idx = order.indexOf(stage);
  if (idx < 0) return stage === "ready" ? 1 : 0;
  let total = 0;
  for (let i = 0; i < idx; i++) total += BOOT_WEIGHTS[order[i]];
  total += (BOOT_WEIGHTS[stage] || 0) * Math.max(0, Math.min(1, fracInStage));
  return total;
}

// Within-stage progress as a 0..1 fraction. Returns 0 for "ready",
// 1 for "script"/"runtime" (we don't really know), and
// stageBytesDone/STAGE_MB for packages/bundle.
function stageFraction(stage) {
  if (stage === "script") {
    // The script tag fires onload essentially instantly; treat as 1.
    return 1;
  }
  if (stage === "runtime") {
    // The fake animation drives stageBytesDone linearly from 0 to
    // STAGE_MB.runtime. Use that fraction so the bar actually ramps
    // during the runtime stage — otherwise it would jump straight
    // to 95% the instant we enter the stage.
    if (STAGE_MB.runtime <= 0) return 1;
    return Math.max(0, Math.min(1, stageBytesDone / STAGE_MB.runtime));
  }
  if (stage === "packages" || stage === "bundle") {
    if (STAGE_MB[stage] <= 0) return 1;
    return Math.max(0, Math.min(1, stageBytesDone / STAGE_MB[stage]));
  }
  if (stage === "ready") return 1;
  return 0;
}

// Just update the bar fill width + class, without touching the EMA
// rate samples. Used for the fake "runtime" stage progress animation.
function renderBootBarOnly() {
  const el = document.getElementById("bootProgress");
  if (!el) return;
  const stage = pyodideBootProgress;
  const frac = stageFraction(stage);
  const total = barFraction(stage, frac);
  const bar = el.querySelector(".boot-progress__bar-fill");
  if (bar) bar.style.width = (total * 100).toFixed(1) + "%";
  el.className = "boot-progress is-" + stage;
}

function updateBootProgress() {
  const el = document.getElementById("bootProgress");
  if (!el) return;
  const text = el.querySelector(".boot-progress__text");
  const bar = el.querySelector(".boot-progress__bar-fill");
  const eta = el.querySelector(".boot-progress__eta");
  if (!text || !bar) return;

  const stage = pyodideBootProgress;
  const frac = stageFraction(stage);
  const total = barFraction(stage, frac);
  // For ETA we use the *real* byte estimates, not the bar weights.
  const totalMB =
    STAGE_MB.script + STAGE_MB.runtime + STAGE_MB.packages + STAGE_MB.bundle;
  // Cumulative "real" MB done — fed by extractProgress / fake ease-out
  // animation, used only for ETA (not for the bar).
  const baseMB = (() => {
    if (stage === "script")   return 0;
    if (stage === "runtime")  return STAGE_MB.script;
    if (stage === "packages") return STAGE_MB.script + STAGE_MB.runtime;
    if (stage === "bundle")   return STAGE_MB.script + STAGE_MB.runtime + STAGE_MB.packages;
    if (stage === "ready")    return totalMB;
    return 0;
  })();
  const cumMB = baseMB + stageBytesDone;

  // ETA: use an exponential moving average of the recent download
  // rate. We only sample from real progress callbacks (extractProgress
  // for packages, file load for bundle); the fake "runtime" animation
  // does NOT feed this, so the estimate doesn't get anchored to fake
  // ease-out values.
  let etaTxt = "";
  // Only show ETA for stages where we actually see real progress data.
  // During "script" and "runtime", the bar moves but we have no real
  // bytes/second measurement, so we'd just be guessing.
  if (stage === "packages" || stage === "bundle") {
    const now = performance.now();
    if (bootLastSampleT > 0) {
      const dt = (now - bootLastSampleT) / 1000;
      const dmb = cumMB - bootLastSampleMB;
      if (dt > 0.05) {
        const inst = Math.max(0, dmb / dt);
        // EMA, alpha = 0.3
        bootRateEMA = bootRateEMA === 0 ? inst : bootRateEMA * 0.7 + inst * 0.3;
        bootLastSampleT = now;
        bootLastSampleMB = cumMB;
      }
    } else {
      bootLastSampleT = now;
      bootLastSampleMB = cumMB;
    }
    if (bootRateEMA > 0.05) {
      const remainingMB = Math.max(0, totalMB - cumMB);
      const etaSec = remainingMB / bootRateEMA;
      etaTxt = t("boot.eta", { time: fmtETA(etaSec) });
    } else {
      etaTxt = t("boot.eta", { time: "—" });
    }
  } else if (stage === "ready" || stage === "failed" || stage === "idle") {
    etaTxt = "";
  } else {
    // script / runtime: no real rate data yet, hide the ETA
    etaTxt = "";
  }

  // Label
  const stageText = {
    idle:     t("boot.idle"),
    script:   t("boot.script"),
    runtime:  t("boot.runtime"),
    packages: t("boot.packages"),
    bundle:   t("boot.bundle"),
    ready:    t("boot.ready"),
    failed:   t("boot.failed"),
  }[stage] || "";
  // For "failed", show the message + a Retry button
  if (stage === "failed") {
    text.innerHTML = "";
    text.appendChild(document.createTextNode(stageText + "  "));
    const btn = document.createElement("button");
    btn.className = "boot-progress__retry";
    btn.textContent = t("boot.retry");
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "…";
      try {
        // Wipe all pyodide-* IndexedDBs and the SW cache, then reload
        if (indexedDB.databases) {
          const dbs = await indexedDB.databases();
          for (const db of dbs) {
            if (db.name) await new Promise((res) => {
              const r = indexedDB.deleteDatabase(db.name);
              r.onsuccess = r.onerror = r.onblocked = () => res();
            });
          }
        }
        if ('caches' in self) {
          const ks = await caches.keys();
          await Promise.all(ks.map((k) => caches.delete(k)));
        }
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
      } catch (_) {}
      // Force a full reload — bypass any in-memory state
      location.reload();
    });
    text.appendChild(btn);
  } else {
    text.textContent = stageText + (etaTxt ? "  " + etaTxt : "");
  }

  // Bar
  bar.style.width = (total * 100).toFixed(1) + "%";
  el.className = "boot-progress is-" + stage;

  if (eta) eta.textContent = etaTxt;
}

// ----------------- python helpers (run in Pyodide) -----------------
//
// CRITICAL: none of these helpers ever let a Python exception escape.
// The Python engine raises a wide variety of exceptions
// (ValueError, IndexError, UnicodeDecodeError, etc.) on any "weird"
// input — a wrong trace shape, a wrong password, an image that doesn't
// carry a hidden message at all, an image that's too small to embed into.
// We don't want any of those traces to bubble up into the UI; the user
// must only ever see our pre-translated, friendly messages.
//
// The protocol is: every helper returns { ok: bool, value?, reason? }.
// `reason` is a short stable error key (string) the JS layer translates
// to a localized message via i18n. `value` is the actual result on
// success. Failures store the raw Python exception in `pyodide_main`'s
// `_last_error` global for debugging in the browser console, but the
// UI never reads it.

const PY_RUN = `
import json, traceback

def _bw_safe(fn, *args, **kwargs):
    """Run an engine call; convert any exception into a JSON
    dict with a stable 'reason' code so the JS UI never sees a
    traceback. Bytes results are returned as a list of ints (JSON-safe)
    under the 'bytes' key; everything else under 'value'."""
    try:
        v = fn(*args, **kwargs)
        if isinstance(v, (bytes, bytearray)):
            return json.dumps({"ok": True, "bytes": list(v)})
        return json.dumps({"ok": True, "value": v})
    except Exception as e:
        # Translate the exception into a short reason key. The full
        # Python traceback is kept only in the browser console (logged
        # from JS via console.warn) — it never reaches the UI.
        # Order matters: more specific patterns first.
        msg = (str(e) or "").lower()
        if "non-hex" in msg or "invalid literal for int" in msg or "unicodedecode" in msg:
            reason = "decoding_failed"
        elif "nonetype" in msg or "attributeerror" in msg:
            # "'NoneType' object has no attribute 'shape'" — the lib
            # found no extractable message.
            reason = "no_message"
        elif "shape" in msg or "size" in msg or "mismatch" in msg or "smaller" in msg or "too small" in msg:
            # numpy broadcasting errors, shape tuple mismatches, etc.
            reason = "shape_mismatch"
        elif "indexerror" in msg or "out of range" in msg or "out of bounds" in msg:
            reason = "shape_mismatch"
        elif "password" in msg or "dencode" in msg:
            reason = "wrong_password"
        elif "valueerror" in msg:
            # Catch-all for the remaining ValueError cases (most often
            # the library complaining about malformed embedded bytes).
            reason = "decoding_failed"
        else:
            reason = "generic"
        return json.dumps({"ok": False, "reason": reason, "msg": str(e), "tb": traceback.format_exc()})
`;

async function pyEmbedStr(imgBytes, wmStr, pwdWm = 1, pwdImg = 1) {
  const py = await ensurePyodide();
  // Yield once before kicking off the Python work so the
  // click handler's DOM mutations (button disabled, sub-label,
  // is-running class) have a chance to paint. Without this, on a
  // slow machine the user sees the old "Ready" label frozen for a
  // moment before the browser gets to repaint. A 16ms yield is
  // small enough to be imperceptible and big enough to clear one
  // animation frame.
  await new Promise((r) => setTimeout(r, 16));
  py.runPython(PY_RUN);
  const arr = new Uint8Array(imgBytes);
  py.globals.set("_b", arr);
  py.globals.set("_wm", wmStr);
  py.globals.set("_pw", Number(pwdWm));
  py.globals.set("_pi", Number(pwdImg));
  py.runPython(`
import pyodide_main, json
_b = bytes(_b.to_py())
_result = _bw_safe(pyodide_main.embed_str, _b, _wm, pwd_wm=_pw, pwd_img=_pi)
`);
  // Yield again so the result-parsing work doesn't block repaints
  // of the (now disabled) button if the result is large.
  await new Promise((r) => setTimeout(r, 0));
  const r = JSON.parse(py.globals.get("_result"));
  if (!r.ok) {
    console.warn("[embed_str] python raised:", r.msg, "\n", r.tb);
    return { ok: false, reason: r.reason };
  }
  return { ok: true, value: r.bytes ? new Uint8Array(r.bytes) : r.value };
}

async function pyExtractStr(imgBytes, wmShape, pwdWm = 1, pwdImg = 1) {
  const py = await ensurePyodide();
  await new Promise((r) => setTimeout(r, 16));
  py.runPython(PY_RUN);
  py.globals.set("_b", new Uint8Array(imgBytes));
  py.globals.set("_ws", wmShape);
  py.globals.set("_pw", Number(pwdWm));
  py.globals.set("_pi", Number(pwdImg));
  py.runPython(`
import pyodide_main
_b = bytes(_b.to_py())
_result = _bw_safe(pyodide_main.extract_str, _b, _ws, pwd_wm=_pw, pwd_img=_pi)
`);
  await new Promise((r) => setTimeout(r, 0));
  const r = JSON.parse(py.globals.get("_result"));
  if (!r.ok) {
    console.warn("[extract_str] python raised:", r.msg, "\n", r.tb);
    return { ok: false, reason: r.reason };
  }
  return { ok: true, value: r.bytes ? new Uint8Array(r.bytes) : String(r.value) };
}

async function pyStrBitLength(wmStr) {
  const py = await ensurePyodide();
  await new Promise((r) => setTimeout(r, 16));
  py.runPython(PY_RUN);
  py.globals.set("_s", wmStr);
  py.runPython(`
import pyodide_main
_result = _bw_safe(pyodide_main.wm_str_bit_length, _s)
_n = json.loads(_result)["value"] if json.loads(_result).get("ok") else 0
`);
  return Number(py.globals.get("_n"));
}

async function pyImgBitLength(imgBytes) {
  const py = await ensurePyodide();
  await new Promise((r) => setTimeout(r, 16));
  py.runPython(PY_RUN);
  py.globals.set("_b", new Uint8Array(imgBytes));
  py.runPython(`
import pyodide_main
_result = _bw_safe(pyodide_main.wm_img_bit_length, bytes(_b.to_py()))
_n = json.loads(_result)["value"] if json.loads(_result).get("ok") else 0
`);
  return Number(py.globals.get("_n"));
}

async function pyEmbedImg(imgBytes, wmBytes, pwdWm = 1, pwdImg = 1) {
  const py = await ensurePyodide();
  await new Promise((r) => setTimeout(r, 16));
  py.runPython(PY_RUN);
  py.globals.set("_b", new Uint8Array(imgBytes));
  py.globals.set("_wm", new Uint8Array(wmBytes));
  py.globals.set("_pw", Number(pwdWm));
  py.globals.set("_pi", Number(pwdImg));
  py.runPython(`
import pyodide_main
_b = bytes(_b.to_py())
_wm = bytes(_wm.to_py())
_result = _bw_safe(pyodide_main.embed_img, _b, _wm, pwd_wm=_pw, pwd_img=_pi)
`);
  await new Promise((r) => setTimeout(r, 0));
  const r = JSON.parse(py.globals.get("_result"));
  if (!r.ok) {
    console.warn("[embed_img] python raised:", r.msg, "\n", r.tb);
    return { ok: false, reason: r.reason };
  }
  return { ok: true, value: r.bytes ? new Uint8Array(r.bytes) : r.value };
}

async function pyExtractImg(imgBytes, wmShape, pwdWm = 1, pwdImg = 1) {
  const py = await ensurePyodide();
  await new Promise((r) => setTimeout(r, 16));
  py.runPython(PY_RUN);
  py.globals.set("_b", new Uint8Array(imgBytes));
  py.globals.set("_ws", wmShape);
  py.globals.set("_pw", Number(pwdWm));
  py.globals.set("_pi", Number(pwdImg));
  py.runPython(`
import pyodide_main
_b = bytes(_b.to_py())
_result = _bw_safe(pyodide_main.extract_img, _b, _ws, pwd_wm=_pw, pwd_img=_pi)
`);
  await new Promise((r) => setTimeout(r, 0));
  const r = JSON.parse(py.globals.get("_result"));
  if (!r.ok) {
    console.warn("[extract_img] python raised:", r.msg, "\n", r.tb);
    return { ok: false, reason: r.reason };
  }
  return { ok: true, value: r.bytes ? new Uint8Array(r.bytes) : r.value };
}

async function pyAttack(imgBytes, kind, kwargs = {}) {
  // Kept as a no-op for code that may still reference it; the UI no
  // longer exposes attacks. Returns null.
  void imgBytes; void kind; void kwargs;
  return null;
}

// ----------------- state -----------------

const state = {
  originalFile: null,
  originalBytes: null,
  embeddedBytes: null,
  wmShape: null,        // [H, W] of the signature image, or bit length for text
  wmMode: "str",        // 'str' or 'img'
  pwdWm: 1,             // password for message content (text mode)
  pwdImg: 1,            // password for image-block scramble
};

// ----------------- helpers -----------------

const $ = (sel) => document.querySelector(sel);

// ----------------- i18n-aware status -----------------
// We track the current status as a (key, vars, kind) tuple so that switching
// language re-renders it correctly. There are TWO log panels:
//   • embedLogBody  — anything that happens on the embed side
//   • extractLogBody — anything that happens on the extract side
// Both keep the full history (so you can scroll up) and re-render in
// the active language on language switch.
let embedEntries = [];   // [{ key, vars, kind, time }]
let extractEntries = [];

function setStatus(msg, kind = "") {
  // Direct-string form. Not used in this build (we always go through
  // setStatusKey + a log panel), but kept for future ad-hoc calls.
  dlog("status", kind, msg);
}

function setStatusKey(key, vars = null, kind = "") {
  embedEntries.push({ key, vars, kind, time: Date.now() });
  renderEmbedLog();
}

// Switch the target log panel. Pass 'embed' (default) or 'extract'.
function setStatusTo(panel, key, vars = null, kind = "") {
  if (panel === "extract") {
    extractEntries.push({ key, vars, kind, time: Date.now() });
    renderExtractLog();
  } else {
    embedEntries.push({ key, vars, kind, time: Date.now() });
    renderEmbedLog();
  }
}

// Shorthand for the extract-side log panel.
function setExtractStatus(key, vars = null, kind = "") {
  setStatusTo("extract", key, vars, kind);
}

function fmtTime(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function renderEmbedLog() {
  const body = $("#embedLogBody");
  if (!body) return;
  body.setAttribute("data-empty", t("embed_log.empty"));
  body.innerHTML = "";
  for (const e of embedEntries) {
    const row = document.createElement("div");
    row.className = `log__row log__row--${e.kind || ""}`;
    const ts = document.createElement("span");
    ts.className = "log__ts";
    ts.textContent = fmtTime(e.time);
    const txt = document.createElement("span");
    txt.className = "log__text";
    txt.textContent = t(e.key, e.vars);
    row.appendChild(ts);
    row.appendChild(txt);
    body.appendChild(row);
  }
  body.scrollTop = body.scrollHeight;
}

function renderExtractLog() {
  const body = $("#extractLogBody");
  if (!body) return;
  body.setAttribute("data-empty", t("extract_log.empty"));
  body.innerHTML = "";
  for (const e of extractEntries) {
    const row = document.createElement("div");
    row.className = `log__row log__row--${e.kind || ""}`;
    const ts = document.createElement("span");
    ts.className = "log__ts";
    ts.textContent = fmtTime(e.time);
    const txt = document.createElement("span");
    txt.className = "log__text";
    txt.textContent = t(e.key, e.vars);
    row.appendChild(ts);
    row.appendChild(txt);
    body.appendChild(row);
  }
  body.scrollTop = body.scrollHeight;
}

function rerenderStatus() {
  renderEmbedLog();
  renderExtractLog();
}

function bytesHuman(n) {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / 1024 / 1024).toFixed(2) + " MB";
}

function downloadBytes(bytes, filename) {
  const blob = new Blob([bytes], { type: "image/png" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

function readFileAsBytes(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(new Uint8Array(fr.result));
    fr.onerror = reject;
    fr.readAsArrayBuffer(file);
  });
}

function drawBytesToCanvas(canvas, bytes) {
  const url = URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
  const img = new Image();
  img.onload = () => {
    const ctx = canvas.getContext("2d");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

// ----------------- dropzones -----------------
//
// Why a guard? A dropzone that wraps (or is wrapped by) a <label> can
// dispatch the file input's synthetic click TWICE per user action — once
// from our explicit `input.click()` and once from the label's native
// behavior. The picker only shows once, but the resulting `change` event
// can fire twice. Same goes for drag-drop: a file dropped onto the label
// also propagates a synthetic `change` on the input in some browsers.
// We dedupe via a per-zone "last handled file signature" and always
// reset `input.value` after handling so re-selecting the same file
// still fires `change`.

function fileSignature(f) {
  return `${f.name}|${f.size}|${f.lastModified}`;
}

function wireDropzone(zone, onFile) {
  const input = zone.querySelector('input[type="file"]');
  if (!input) return;
  let lastSig = null;
  const handle = (f) => {
    if (!f) return;
    const sig = fileSignature(f);
    if (sig === lastSig) return; // de-dup: same file already processed
    lastSig = sig;
    // Always reset the input so picking the same file again still fires
    // `change` (browsers swallow re-selection of an identical value).
    input.value = "";
    onFile(f);
  };
  zone.addEventListener("click", (e) => {
    // Avoid double-trigger: if the click bubbled up from the file input
    // itself, the browser already handled it.
    if (e.target === input) return;
    input.click();
  });
  zone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      input.click();
    }
  });
  ["dragenter", "dragover"].forEach((ev) =>
    zone.addEventListener(ev, (e) => {
      e.preventDefault();
      zone.classList.add("is-drag");
    })
  );
  ["dragleave", "drop"].forEach((ev) =>
    zone.addEventListener(ev, (e) => {
      e.preventDefault();
      zone.classList.remove("is-drag");
    })
  );
  zone.addEventListener("drop", (e) => {
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) handle(f);
  });
  input.addEventListener("change", () => {
    const f = input.files && input.files[0];
    if (f) handle(f);
  });
}

async function handleOriginalFile(file) {
  state.originalFile = file;
  state.originalBytes = await readFileAsBytes(file);

  const img = await loadImageFile(file);
  $("#metaName").textContent = file.name;
  $("#metaSize").textContent = `${img.naturalWidth} × ${img.naturalHeight}`;
  $("#metaMode").textContent = "RGB";
  $("#imgMeta").hidden = false;

  const dz = $("#dropzone");
  dz.classList.add("is-loaded");
  dz.querySelector(".dropzone__label").textContent = file.name;
  enableEmbedBtn();
  $("#embedSub").textContent = t("btn.embed.sub.ready");
  setStatusKey("status.loaded", {
    w: img.naturalWidth,
    h: img.naturalHeight,
    size: bytesHuman(state.originalBytes.length),
  }, "ok");
  setStatusTo("extract", "status.ex_need_file", null, "");
}

async function handleSignatureFile(file) {
  state.wmBytes = await readFileAsBytes(file);
  state.wmMode = "img";
  const img = await loadImageFile(file);
  state.savedH = img.naturalHeight;
  state.savedW = img.naturalWidth;
  state.wmShape = [state.savedH, state.savedW];
  $("#wmMetaName").textContent = file.name;
  $("#wmMetaSize").textContent = `${img.naturalWidth} × ${img.naturalHeight}`;
  $("#wmMetaMode").textContent = "Image";
  $("#wmMeta").hidden = false;
  const dz = $("#sigDropzone");
  dz.classList.add("is-loaded");
  dz.querySelector(".dropzone__label").textContent = file.name;
  $("#exShape").value = `${state.savedH},${state.savedW}`;
  setStatusKey("status.wm_loaded", { H: state.savedH, W: state.savedW }, "ok");
}

// ----------------- tabs (text / image signature) -----------------

function wireTabs() {
  const tabBtns = document.querySelectorAll("[data-tab]");
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;
      tabBtns.forEach((b) => b.classList.toggle("is-active", b === btn));
      document.querySelectorAll("[data-tabpanel]").forEach((p) => {
        p.hidden = p.dataset.tabpanel !== target;
      });
      if (target === "str") {
        state.wmMode = "str";
      } else if (target === "img") {
        state.wmMode = "img";
        if (!state.wmBytes) setStatusKey("status.wm_need_image");
      }
    });
  });
}

// ----------------- text inputs + passwords -----------------

function wireText() {
  const ta = $("#wmText");
  const count = $("#wmCount");
  const update = () => { count.textContent = String(ta.value.length); };
  ta.addEventListener("input", update);
  update();
}

function wirePasswords() {
  const pwm = $("#pwdWm");
  const pim = $("#pwdImg");
  if (!pwm || !pim) return;
  const sync = () => {
    state.pwdWm = Math.max(0, Math.floor(Number(pwm.value) || 1));
    state.pwdImg = Math.max(0, Math.floor(Number(pim.value) || 1));
  };
  pwm.addEventListener("input", sync);
  pim.addEventListener("input", sync);
  sync();
}

// ----------------- wm_shape modal -----------------
// Format a wm_shape array (text: [N]; image: [H, W]) into the
// user-facing string we display in the modal and write into the
// exShape field. The text form is a single integer; the image form
// is "H,W".
function formatWmShape(shape) {
  if (!Array.isArray(shape) || shape.length === 0) return "";
  if (shape.length === 1) return String(shape[0]);
  return `${shape[0]},${shape[1]}`;
}

function showWmShapeModal(value) {
  const modal = $("#wmShapeModal");
  const valEl = $("#wmShapeModalValue");
  const copyBtn = $("#wmShapeModalCopy");
  const okBtn = $("#wmShapeModalOk");
  if (!modal || !valEl || !copyBtn || !okBtn) return;
  valEl.textContent = value || "—";
  // Reset the copy button to its default label in case it was left
  // in the "copied" state from a previous open.
  copyBtn.classList.remove("is-copied");
  copyBtn.textContent = t("modal.wm_shape.copy");
  modal.hidden = false;
  // Focus the primary action so the user can dismiss with Enter
  // (or Tab + Enter) and so screen-readers announce the new dialog.
  setTimeout(() => okBtn.focus(), 0);
}

function hideWmShapeModal() {
  const modal = $("#wmShapeModal");
  if (modal) modal.hidden = true;
}

function wireWmShapeModal() {
  const modal = $("#wmShapeModal");
  if (!modal) return;
  const okBtn = $("#wmShapeModalOk");
  const copyBtn = $("#wmShapeModalCopy");
  // Click anywhere on the backdrop (but not the card) to dismiss.
  modal.addEventListener("click", (e) => {
    if (e.target && e.target.matches("[data-modal-dismiss]")) {
      hideWmShapeModal();
    }
  });
  if (okBtn) okBtn.addEventListener("click", hideWmShapeModal);
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      const val = $("#wmShapeModalValue")?.textContent || "";
      if (!val) return;
      try {
        // navigator.clipboard is gated on HTTPS / secure contexts
        // and may be unavailable on file://. Try it first, fall back
        // to a hidden textarea + execCommand.
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(val);
        } else {
          const ta = document.createElement("textarea");
          ta.value = val;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        }
        copyBtn.classList.add("is-copied");
        copyBtn.textContent = t("modal.wm_shape.copied");
        setTimeout(() => {
          if (copyBtn.classList.contains("is-copied")) {
            copyBtn.classList.remove("is-copied");
            copyBtn.textContent = t("modal.wm_shape.copy");
          }
        }, 1600);
      } catch (e) {
        console.warn("[BW] clipboard write failed:", e);
      }
    });
  }
  // Esc closes the modal — standard dialog UX.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) hideWmShapeModal();
  });
}

async function handleExtractFile(file) {
  const bytes = await readFileAsBytes(file);
  state.extractBytes = bytes;
  const img = await loadImageFile(file);
  const dz = $("#exDropzone");
  dz.classList.add("is-loaded");
  dz.querySelector(".dropzone__label").textContent = file.name;
  $("#exHint").textContent = `${img.naturalWidth} × ${img.naturalHeight}`;
  enableExtractBtn();
  setStatusTo("extract", "status.ex_loaded", null, "ok");
}

async function embedNow() {
  // Note: the click handler is responsible for disabling the
  // button and setting the "running" sub-label. By the time we
  // get here, isEmbedding is already true. We still set it in
  // case embedNow() is called from anywhere else (e.g. tests).
  if (isEmbedding) return;
  isEmbedding = true;
  try {
    let pngBytes;
    if (state.wmMode === "str") {
      const text = $("#wmText").value;
      const r = await pyEmbedStr(state.originalBytes, text, state.pwdWm, state.pwdImg);
      if (!r.ok) { friendlyFailEmbed(r.reason); return; }
      pngBytes = r.value;
      // The original library encodes the string into a 1D bit array whose
      // length depends on the hex value (leading zero bits dropped).
      // wm_shape = that bit length.
      const bitLen = await pyStrBitLength(text);
      state.wmShape = [bitLen];
      $("#exShape").value = String(bitLen);
    } else {
      if (!state.wmBytes) { friendlyFailEmbed("need_wm_image"); return; }
      const r = await pyEmbedImg(state.originalBytes, state.wmBytes, state.pwdWm, state.pwdImg);
      if (!r.ok) { friendlyFailEmbed(r.reason); return; }
      pngBytes = r.value;
      const bitLen = await pyImgBitLength(state.wmBytes);
      if (state.savedH && state.savedW) {
        state.wmShape = [state.savedH, state.savedW];
        $("#exShape").value = `${state.savedH},${state.savedW}`;
      } else {
        state.wmShape = [bitLen];
        $("#exShape").value = String(bitLen);
      }
    }
    state.embeddedBytes = pngBytes;
    drawBytesToCanvas($("#cvOriginal"), state.originalBytes);
    drawBytesToCanvas($("#cvEmbedded"), pngBytes);
    $("#result").hidden = false;
    // Enable the download button now that we actually have a result.
    const dlBtn = $("#downloadLink");
    dlBtn.disabled = false;
    dlBtn.onclick = (e) => {
      e.preventDefault();
      if (!state.embeddedBytes) return;
      const base = state.wmMode === "str"
        ? $("#wmText").value.replace(/[^\w\-]+/g, "_").slice(0, 24) || "marked"
        : "marked";
      downloadBytes(state.embeddedBytes, `${base}.png`);
    };
    setStatusKey("status.embed_done", { shape: JSON.stringify(state.wmShape) }, "ok");
    $("#embedSub").textContent = t("btn.embed.sub.ready");
    // Surface the wm_shape value in a modal the user can't miss. The
    // value is what they (or anyone holding the image) will need at
    // extract time — without it the message is unrecoverable.
    showWmShapeModal(formatWmShape(state.wmShape));
  } catch (e) {
    console.error("[embed] unexpected:", e);
    friendlyFailEmbed("generic");
  } finally {
    isEmbedding = false;
    enableEmbedBtn();
  }
}

function friendlyFailEmbed(reasonKey) {
  const reason = t("embed.reason." + (reasonKey || "generic"));
  setStatusKey("status.embed_fail_friendly", { reason }, "err");
  // The finally block in embedNow() re-enables the button and resets
  // the sub-label via enableEmbedBtn() (which also restores the
  // default sub-label).
  $("#embedSub").textContent = t("btn.embed.sub.again");
}

async function extractNow() {
  // Click handler is responsible for disabling the button and
  // logging the "extracting…" entry. We just run.
  if (isExtracting) return;
  isExtracting = true;
  try {
    const raw = $("#exShape").value.trim();
    // Auto-detect whether the user is recovering a text or image
    // message, based on the *shape of the trace shape value* — NOT on
    // the tab they happen to be on. Rationale: a user who hid a text
    // message and then closed the tab and reopens the page would
    // otherwise be in "str" mode by default and would have to
    // remember to leave the tab alone. Image mode is "23" (single
    // integer = bit length) or "128,128" (H,W). Distinguishing rule:
    //   • contains a comma         → image (H,W)
    //   • single positive integer  → text (bit length)
    const hasComma = raw.includes(",");
    let out;
    if (hasComma) {
      // Image signature: parse "H,W"
      const parts = raw.split(",").map((n) => Number(n.trim()));
      const shape = parts.length === 2 ? parts : [parts[0], parts[0]];
      if (!shape.every((n) => Number.isFinite(n) && n > 0)) {
        friendlyFailExtract("bad_shape_image");
        return;
      }
      const r = await pyExtractImg(state.extractBytes, shape, state.pwdWm, state.pwdImg);
      if (!r.ok) { friendlyFailExtract(r.reason); return; }
      out = r.value;
      drawBytesToCanvas($("#cvRecovered"), out);
      $("#recoveredPreview").hidden = false;
    } else {
      // Text message: a single positive integer bit length
      if (raw === "" || !/^\d+$/.test(raw)) {
        friendlyFailExtract("bad_shape_text");
        return;
      }
      const bitLen = Number(raw);
      if (bitLen <= 0) {
        friendlyFailExtract("bad_shape_text");
        return;
      }
      const r = await pyExtractStr(state.extractBytes, bitLen, state.pwdWm, state.pwdImg);
      if (!r.ok) { friendlyFailExtract(r.reason); return; }
      out = r.value;
    }
    if (state.wmMode === "str") {
      // Show the recovered text in its dedicated box on the right
      // (it's the headline result the user actually wants to read).
      const txt = $("#exText");
      if (txt) txt.textContent = out || t("status.ex_no_msg");
    }
    setStatusTo(
      "extract",
      state.wmMode === "str" ? "status.extract_done_text" : "status.extract_done_img",
      state.wmMode === "str" ? { n: String(out).length } : null,
      "ok"
    );
  } catch (e) {
    // JS-side bug guard. The Python side never throws to here because
    // _bw_safe converts all exceptions. If we DO land here, it's a
    // client bug — log it and show a generic friendly message.
    console.error("[extract] unexpected:", e);
    friendlyFailExtract("generic");
  } finally {
    isExtracting = false;
    enableExtractBtn();
  }
}

// Single funnel for every extraction failure — Python traceback or
// client-side validation. Always writes a friendly, i18n'd reason to
// the extract log and never exposes the raw error.
function friendlyFailExtract(reasonKey) {
  const reason = t("extract.reason." + (reasonKey || "generic"));
  setStatusTo("extract", "status.extract_fail_friendly", { reason }, "err");
  // The finally block in extractNow() re-enables the button.
}

// ----------------- boot -----------------

function boot() {
  // Apply i18n to the entire DOM now that it exists.
  applyI18n(getLang());

  // Wire language switcher buttons.
  document.querySelectorAll("[data-lang-btn]").forEach((btn) => {
    btn.addEventListener("click", () => applyI18n(btn.dataset.langBtn));
  });
  // When the language changes, re-render the current status text.
  document.addEventListener("bw:lang", rerenderStatus);

  // Show the "first time only" hint iff this tab has never
  // successfully booted Pyodide before.
  maybeShowFirstTimeHint();

  wireText();
  wirePasswords();
  wireTabs();
  wireWmShapeModal();
  wireDropzone($("#dropzone"), handleOriginalFile);
  wireDropzone($("#sigDropzone"), handleSignatureFile);
  wireDropzone($("#exDropzone"), handleExtractFile);
  $("#embedBtn").addEventListener("click", () => {
    // Disable the button in the same tick as the click so the user
    // gets instant feedback and can't queue up another embed while
    // the first one is still running. embedNow() will re-enable
    // it in the finally block.
    if (isEmbedding) return;
    if (!state.originalBytes) return;
    const btn = $("#embedBtn");
    btn.disabled = true;
    btn.classList.add("is-running");
    $("#embedSub").textContent = t("btn.embed.sub.running");
    embedNow();
  });
  $("#extractBtn").addEventListener("click", () => {
    if (isExtracting) return;
    if (!state.extractBytes) return;
    const btn = $("#extractBtn");
    btn.disabled = true;
    btn.classList.add("is-running");
    setStatusTo("extract", "status.extracting");
    extractNow();
  });

  // Immediately show the boot-progress hint (so the user always
  // sees *something* on first paint), then kick off the Pyodide
  // preload in the background. By the time they click Embed/Extract,
  // the runtime is most likely already hot.
  if (window.__pyodide) {
    pyodideBootProgress = "ready";
    updateBootProgress();
  } else {
    pyodideBootProgress = "script";
    updateBootProgress();
  }
  setTimeout(() => preloadPyodide(), 50);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
