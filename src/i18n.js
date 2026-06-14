/**
 * i18n.js — minimal EN/ZH bilingual support.
 *
 *   - Default language comes from `navigator.language`, falling back to "en".
 *   - The user can override it via the toggle in the masthead.
 *   - The chosen language is stored in `localStorage` under "bw:lang".
 *   - `t(key, vars?)` returns a translated string with optional `{var}`
 *     interpolation.
 *   - `applyI18n(lang)` walks the DOM and replaces every text node / attr
 *     that carries a `data-i18n` (text) or `data-i18n-attr` (attribute,
 *     space-separated "attr:key" pairs) marker.
 *
 * Adding a new language: extend `STRINGS` with a new key, then add a button
 * to index.html and a case in `applyI18n`.
 */

export const SUPPORTED_LANGS = ["en", "zh"];

const STRINGS = {
  en: {
    // <html>
    "html.lang": "en",
    "page.title": "Xuanji · MystiMark",
    "page.description":
      "An in-browser studio for hiding and recovering messages inside images. Powered by an unmodified DWT-DCT-SVD Python engine running inside Pyodide — no server, no upload, no account.",

    // masthead
    "nav.studio": "Embed",
    "nav.method": "About",
    "nav.attacks": "Extract",
    "nav.source.aria": "GitHub repository",
    "lang.label": "Language",
    "lang.en": "EN",
    "lang.zh": "中",

    // skip link
    "skip.to_studio": "Skip to studio",

    // hero
    "hero.eyebrow": "A trace you can't see while viewing the image",
    "hero.title.1": "Hide a message ",
    "hero.title.em": "inside",
    "hero.title.2": " an image,",
    "hero.title.line2": "without affecting how the original image looks.",
    "hero.lede":
      "All processing happens locally in your browser. Nothing is uploaded, nothing is logged, and your images never leave the device — keeping your privacy and security fully under your control.",
    "hero.meta.1": "● In&nbsp;browser",
    "hero.meta.2": "● Python&nbsp;3 · opencv · numpy",
    "hero.meta.3": "● Open source",

    // Pyodide preloading progress bar
    "boot.idle":     "",
    "boot.script":   "Downloading Pyodide loader (≈4 MB)",
    "boot.runtime":  "Initializing Python (≈10 MB)",
    "boot.packages": "Loading numpy / opencv / pywavelets / Pillow (≈28 MB)",
    "boot.bundle":   "Loading MystiMark engine",
    "boot.ready":    "Runtime ready. You can embed or extract.",
    "boot.first_time_hint":
      "First load only — the runtime is cached locally after this. Reloading is instant on the next visit.",
    "boot.first_time_done":
      "Runtime cached. The next visit will skip the slow download.",
    "boot.failed":   "Could not load the Python runtime. Click Retry to clear the cache and try again.",

    // wm_shape success modal
    "modal.wm_shape.title":    "Save this number",
    "modal.wm_shape.lede":     "Your message has been hidden in the image. To recover it later, you (or whoever holds this image) will need the value below — without it, recovery is impossible.",
    "modal.wm_shape.label":    "trace shape",
    "modal.wm_shape.tabs":     "text: a single bit-length  ·  image: height,width",
    "modal.wm_shape.copy":     "Copy",
    "modal.wm_shape.copied":   "Copied",
    "modal.wm_shape.got_it":   "I’ve saved it",
    "boot.eta":      "≈ {time} left",
    "boot.retry":    "Retry",
    "plate.head": "00 / Studio",
    "plate.original": "Original",
    "plate.embedded": "Embedded",
    "plate.foot.wm": 'wm: <em>“mystimark.studio”</em>',
    "plate.foot.params": "d1=36 · d2=20",

    // studio intro
    "studio.kicker": "Section 01",
    "studio.title": "The studio.",
    "studio.sub":
      "Pick a picture, choose a message (text or image), embed. The Python package handles the rest.",

    // step 1
    "step1.num": "01",
    "step1.title": "Pick a picture.",
    "step1.desc":
      "A PNG or JPEG. Larger images carry a longer message. Everything stays in the browser.",
    "dz1.icon": "↑",
    "dz1.label": "Drop an image, or click to browse",
    "dz1.hint": "PNG · JPEG · up to ~4096&thinsp;px",
    "meta.name": "Name",
    "meta.size": "Size",
    "meta.mode": "Mode",

    // step 2
    "step2.num": "02",
    "step2.title": "Write the message.",
    "step2.desc":
      "A short text or a small image. The library encodes it as a bit array and embeds it across all three colour channels.",
    "tab.text": "Text",
    "tab.image": "Image",
    "field.wm": "Message",
    "field.wm.placeholder": "Enter a message to hide",
    "field.wm.hint": "UTF-8 · up to 200 chars",
    "dz2.icon": "▣",
    "dz2.label": "Drop a signature image",
    "dz2.hint": "PNG · grayscale or RGB",
    "advanced.toggle": "Advanced options",
    "advanced.hint":
      "Optional. Two separate keys: one for the hidden content (text mode) and one for the image-block scramble. Change them to test password-protected recovery — same key on both sides is required to recover the message.",
    "field.pwd_wm": "Password · text",
    "field.pwd_img": "Password · image",

    // step 3
    "step3.num": "03",
    "step3.title": "Render &amp; save.",
    "step3.desc":
      "The engine embeds the message in your browser. No upload, no server, no waiting room.",
    "btn.embed.label": "Hide message",
    "btn.embed.sub.idle": "Awaiting image",
    "btn.embed.sub.ready": "Ready · 1 click",
    "btn.embed.sub.running": "Processing file…",
    "btn.embed.sub.again": "Try again",
    "btn.download": "Download marked PNG",
    "status.idle": "Load an image to begin.",

    // extract
    "extract.kicker": "Section 02",
    "extract.title": "Recover the message.",
    "extract.sub":
      "Drop a marked image. If you just used the studio above to mark it, trace shape is filled in automatically; otherwise, fill it in by hand.",
    "dz3.icon": "↓",
    "dz3.label": "Drop marked image",
    "dz3.hint.idle": "No file selected",
    "field.wm_shape": "trace_shape",
    "field.wm_shape.placeholder": "e.g. 23  for text  ·  128,128  for an image",
    "field.wm_shape.hint":
      "Pre-filled from the last hide in this tab. For text it’s a single number (the bit count). For an image it’s <code>height,width</code>.",
    "btn.extract.label": "Recover message",
    "btn.extract.sub.idle": "Awaiting image",
    "btn.extract.sub.ready": "Ready · 1 click",
    "btn.extract.sub.running": "Extracting…",
    "btn.extract.sub.done": "Done",
    "btn.extract.sub.again": "Try again",
    "extract.caption": "Recovered text",
    "extract.empty": "—",
    "extract.recovered_image": "Recovered image",
    "extract.recovered_text_label": "Recovered text ↓",

    // Friendly extraction-failure reasons (shown in the log, never the
    // raw Python traceback). The reason keys come from the Python
    // _bw_safe wrapper in main.js.
    "status.extract_fail_friendly":
      "Could not recover the message. {reason}",
    "status.embed_fail_friendly":
      "Could not hide the message. {reason}",
    "extract.reason.decoding_failed":
      "Could not decode the embedded message. The trace shape is probably wrong, or this image wasn't marked by this studio (wrong password?).",
    "extract.reason.shape_mismatch":
      "trace shape doesn't fit this image. Check that the value matches what was used at hide time (for text: a single bit-length integer; for image: height,width).",
    "extract.reason.no_message":
      "This image doesn't look like it carries a hidden message with the current settings. Try a different trace shape or password.",
    "extract.reason.wrong_password":
      "The password looks wrong. The two passwords (text / image) and trace shape must all match what was used at hide time.",
    "extract.reason.bad_shape_text":
      "trace shape is empty or not a positive number. For text, enter a single positive integer (the bit length of the embedded message).",
    "extract.reason.bad_shape_image":
      "trace shape must be two positive integers like 128,128 (height,width). It is currently empty, malformed, or contains a non-positive value.",
    "extract.reason.generic":
      "Recovery failed. The most common cause is a wrong trace shape or password.",
    "embed.reason.need_wm_image":
      "Drop a signature image first.",
    "embed.reason.decoding_failed":
      "Could not hide the message in this image. Try a smaller signature or a different host image.",
    "embed.reason.shape_mismatch":
      "The signature image is too large for the host image. Use a smaller signature (roughly 1/8 of the host's width and height).",
    "embed.reason.no_message": "Could not hide. Try a different image or smaller signature.",
    "embed.reason.wrong_password": "The password is invalid. Use 0 or a positive integer.",
    "embed.reason.generic": "Hide failed. Try a different image or signature.",

    // log panels
    "embed_log.title": "Hide log",
    "embed_log.empty": "No activity yet — load an image and hide a message.",
    "extract_log.title": "Recovery log",
    "extract_log.empty": "No activity yet — drop a marked image to recover.",
    "status.ex_need_file": "Drop a marked image to begin recovery.",

    // about
    "about.kicker": "Colophon",
    "about.title": "Special thanks",
    "about.body":
      "The engine implements the DWT&nbsp;·&nbsp;DCT&nbsp;·&nbsp;SVD algorithm and runs unmodified inside Pyodide with <code>opencv-python 4.11</code>, <code>numpy 2.x</code>, <code>pywavelets</code> and <code>Pillow</code>.",
    "about.body.quiet":
      "First load takes a few seconds while Pyodide boots and pulls ~30 MB of compiled wheels from the CDN. After that, every hide / recover is local. No analytics. No cookies. No server.",
    "about.engine": "Engine",
    "about.engine.val": "MystiMark · DWT-DCT-SVD",
    "about.runtime": "Runtime",
    "about.runtime.val": "Pyodide 0.27",
    "about.stack": "Stack",
    "about.stack.val": "Python · opencv · numpy · pywavelets",
    "about.theme": "Theme",
    "about.theme.val": "Light / Cream / Ink / Oxblood",
    "about.status": "Status",
    "about.status.val": "Studio is open",
    "about.version": "Version",
    "about.version.val": "V1.0",

    // colophon
    "colophon.1": "© MystiMark · 2026",
    "colophon.2": "Set in Newsreader &amp; JetBrains Mono",
    "colophon.3": "Powered by Pyodide &amp; the original Python package.",

    // dynamic status messages
    "status.loading_pyodide":
      "Loading Python runtime (Pyodide + opencv + numpy + pywavelets)…",
    "status.loading_pkgs": "Loading numpy / opencv-python / pywavelets / pillow…",
    "status.runtime_ready": "Runtime ready.",
    "status.loaded":
      "Loaded {w}×{h} ({size}).",
    "status.wm_loaded": "Signature image loaded. Shape = ({H}, {W}).",
    "status.wm_need_image": "Drop a signature image to continue.",
    "status.embed_done": "Done. trace shape = {shape}.",
    "status.embed_fail": "Hide failed: {err}",
    "status.ex_loaded":
      "Marked image loaded. Set trace shape and click recover.",
    "status.extracting": "Recovering…",
    "status.extract_done_text": "Recovered {n} chars.",
    "status.extract_done_img": "Recovered image.",
    "status.extract_fail": "Recover failed: {err}",
    "status.runtime_version":
      "Runtime ready. Python {py} · cv2 {cv2} · numpy {np}.",
    "status.ex_no_msg": "(empty / wrong shape)",
    "status.need_wm_image": "Drop a signature image first.",
  },

  zh: {
    "html.lang": "zh-Hans",
    "page.title": "玄迹 · MystiMark",
    "page.description":
      "一个浏览器内运行的 MystiMark 工作台。在 Pyodide 中直接执行 DWT&nbsp;·&nbsp;DCT&nbsp;·&nbsp;SVD 算法——无需服务器，无需上传。",

    "nav.studio": "藏入消息",
    "nav.method": "关于",
    "nav.attacks": "恢复消息",
    "nav.source.aria": "GitHub 仓库",
    "lang.label": "语言",
    "lang.en": "EN",
    "lang.zh": "中",

    "skip.to_studio": "跳到工作台",

    "hero.eyebrow": "浏览图片时无法察觉的痕迹",
    "hero.title.1": "把一段信息 ",
    "hero.title.em": "藏进",
    "hero.title.2": " 一张图片里，",
    "hero.title.line2": "且不影响原图的正常显示。",
    "hero.lede":
      "本网站所有功能都在本地运行，全方面保护你的隐私安全。",
    "hero.meta.1": "● 浏览器内运行",
    "hero.meta.2": "● Python&nbsp;3 · opencv · numpy",
    "hero.meta.3": "● 开源",

    // Pyodide 预加载进度条
    "boot.idle":     "",
    "boot.script":   "正在下载 Pyodide 启动器（≈4 MB）",
    "boot.runtime":  "正在初始化 Python（≈10 MB）",
    "boot.packages": "正在加载 numpy / opencv / pywavelets / Pillow（≈28 MB）",
    "boot.bundle":   "正在加载 MystiMark 引擎",
    "boot.ready":    "运行时已就绪，可以开始藏入或恢复消息。",
    "boot.first_time_hint":
      "仅首次加载较慢，之后会本地缓存。再次访问秒开。",
    "boot.failed":   "Python 运行时加载失败。点击「重试」可清缓存并重新加载。",

    // wm_shape 成功模态框
    "modal.wm_shape.title":    "请保存这个数字",
    "modal.wm_shape.lede":     "消息已成功藏入图片。要在之后取回这段信息，没有这个值就不可能恢复——妥善保存。",
    "modal.wm_shape.label":    "trace shape",
    "modal.wm_shape.tabs":     "文本：单个数字（比特长度）  ·  图片：高,宽",
    "modal.wm_shape.copy":     "复制",
    "modal.wm_shape.copied":   "已复制",
    "modal.wm_shape.got_it":   "已保存",
    "boot.eta":      "约还需 {time}",
    "boot.retry":    "重试",
    "plate.head": "00 / 工作台",
    "plate.original": "原图",
    "plate.embedded": "处理后",
    "plate.foot.wm": '痕迹：<em>"mystimark.studio"</em>',
    "plate.foot.params": "d1=36 · d2=20",

    "studio.kicker": "第一章",
    "studio.title": "藏入消息。",
    "studio.sub":
      "选一张图，挑一段信息（文字或图片），把消息藏进去。剩下的交给我们。",

    "step1.num": "01",
    "step1.title": "选一张图。",
    "step1.desc":
      "PNG 或 JPEG 即可。图片越大，可藏入的消息越长。所有处理都在浏览器内完成。",
    "dz1.icon": "↑",
    "dz1.label": "拖入图片，或点击选择",
    "dz1.hint": "PNG · JPEG · 最大约 4096&thinsp;px",
    "meta.name": "名称",
    "meta.size": "尺寸",
    "meta.mode": "模式",

    "step2.num": "02",
    "step2.title": "写一段信息。",
    "step2.desc":
      "一段短文本，或一张小图。库会把它编码成比特流，并在三个颜色通道上分别写入。",
    "tab.text": "文字",
    "tab.image": "图片",
    "field.wm": "消息内容",
    "field.wm.placeholder": "请输入要藏入的消息",
    "field.wm.hint": "UTF-8 · 最多 200 字符",
    "dz2.icon": "▣",
    "dz2.label": "拖入签名图片",
    "dz2.hint": "PNG · 灰度或 RGB",
    "advanced.toggle": "高级选项",
    "advanced.hint":
      "可选。两个独立密钥：一个用于消息内容（文字模式下），一个用于图像块置乱。修改后可测试密码保护恢复——两端使用相同密钥才能恢复信息。",
    "field.pwd_wm": "密码 · 文本",
    "field.pwd_img": "密码 · 图像",

    "step3.num": "03",
    "step3.title": "渲染并保存。",
    "step3.desc":
      "MystiMark 在你的浏览器里藏入消息。无需上传、无需服务器、无需排队。",
    "btn.embed.label": "藏入消息",
    "btn.embed.sub.idle": "等待图片",
    "btn.embed.sub.ready": "就绪 · 1 次点击",
    "btn.embed.sub.running": "文件处理中···",
    "btn.embed.sub.again": "重试",
    "btn.download": "下载带痕迹的 PNG",
    "status.idle": "先加载一张图片开始。",

    "extract.kicker": "第二章",
    "extract.title": "恢复消息。",
    "extract.sub":
      "拖入一张带痕迹的图片，如果你是刚用上面的工作台藏入的，trace shape 会自动填好，否则需要你手动填入。",
    "dz3.icon": "↓",
    "dz3.label": "拖入带痕迹的图片",
    "dz3.hint.idle": "尚未选择文件",
    "field.wm_shape": "trace shape",
    "field.wm_shape.placeholder": "例如：23（文字） · 128,128（图片）",
    "field.wm_shape.hint":
      "从本标签页的上一次藏入自动填入。文字是单个数字（bit 数），图片是 <code>高,宽</code>。",
    "btn.extract.label": "恢复消息",
    "btn.extract.sub.idle": "等待图片",
    "btn.extract.sub.ready": "就绪 · 1 次点击",
    "btn.extract.sub.running": "正在恢复中···",
    "btn.extract.sub.done": "已完成",
    "btn.extract.sub.again": "重试",
    "extract.caption": "恢复出的文字",
    "extract.empty": "—",
    "extract.recovered_image": "恢复出的图片",
    "extract.recovered_text_label": "恢复出的文字 ↓",

    // 恢复/藏入失败时的友好提示（永远只显示原因，不显示 Python 堆栈）
    "status.extract_fail_friendly": "无法恢复消息。{reason}",
    "status.embed_fail_friendly": "无法藏入消息。{reason}",
    "extract.reason.decoding_failed":
      "无法解码藏入的信息。可能是 trace shape 填错了，或者这张图不是用本工作台藏入的（密码不一致？）。",
    "extract.reason.shape_mismatch":
      "trace shape 跟这张图不匹配。确认填写的值跟藏入时一致（文本：一个比特长度整数；图片：高,宽）。",
    "extract.reason.no_message":
      "这张图在当前设置下看起来没有藏入痕迹。换一个 trace shape 或密码再试。",
    "extract.reason.wrong_password":
      "密码看起来不对。两个密码（文本/图片）和 trace shape 都需要跟藏入时一致。",
    "extract.reason.bad_shape_text":
      "trace shape 为空或不是正整数。文本模式下请填写一个正整数（即藏入消息的比特长度）。",
    "extract.reason.bad_shape_image":
      "trace shape 应填两个正整数，例如 128,128（高,宽）。当前为空、格式不对或含非正数。",
    "extract.reason.generic": "恢复失败。最常见的原因是 trace shape 或密码不正确。",
    "embed.reason.need_wm_image": "请先拖入一张签名图片。",
    "embed.reason.decoding_failed": "无法把消息藏入这张图。换一张更小的签名或换一张图试试。",
    "embed.reason.shape_mismatch":
      "签名图片相对载体图太大。换个更小的签名（一般不超过载体图宽高的 1/8）。",
    "embed.reason.no_message": "藏入失败。换张图或换个签名再试。",
    "embed.reason.wrong_password": "密码无效，请使用 0 或正整数。",
    "embed.reason.generic": "藏入失败。换张图或换个签名再试。",

    // log panels
    "embed_log.title": "藏入日志",
    "embed_log.empty": "还没有活动——加载图片并藏入消息后，日志会显示在这里。",
    "extract_log.title": "恢复日志",
    "extract_log.empty": "还没有活动——拖入带痕迹的图片后，日志会显示在这里。",
    "status.ex_need_file": "拖入带痕迹的图片以开始恢复。",

    "about.kicker": "更多信息",
    "about.title": "关于",
    "about.body":
      "引擎实现 DWT&nbsp;·&nbsp;DCT&nbsp;·&nbsp;SVD 算法，在 Pyodide 中逐字执行，依赖 <code>opencv-python 4.11</code>、<code>numpy 2.x</code>、<code>pywavelets</code>、<code>Pillow</code>。",
    "about.body.quiet":
      "首次加载需要几秒——Pyodide 启动并从 CDN 拉取约 30 MB 编译好的 wheel。之后每次藏入/恢复都是本地的。无埋点、无 Cookie、无服务器。",
    "about.engine": "引擎",
    "about.engine.val": "MystiMark · DWT-DCT-SVD",
    "about.runtime": "运行时",
    "about.runtime.val": "Pyodide 0.27",
    "about.stack": "技术栈",
    "about.stack.val": "Python · opencv · numpy · pywavelets",
    "about.theme": "主题",
    "about.theme.val": "浅色 / 米白 / 墨黑 / 牛血红",
    "about.status": "状态",
    "about.status.val": "工作台已开放",
    "about.version": "版本",
    "about.version.val": "V1.0",

    "colophon.1": "© MystiMark · 玄迹 · 2026",
    "colophon.2": "字体：Newsreader &amp; JetBrains Mono",
    "colophon.3": "由 Pyodide 与原版 Python 包驱动。",

    "status.loading_pyodide": "正在加载 Python 运行时（Pyodide + opencv + numpy + pywavelets）…",
    "status.loading_pkgs": "正在加载 numpy / opencv-python / pywavelets / pillow…",
    "status.runtime_ready": "运行时已就绪。",
    "status.loaded": "已加载 {w}×{h}（{size}）。",
    "status.wm_loaded": "签名图片已加载。尺寸 = ({H}, {W})。",
    "status.wm_need_image": "拖入一张签名图片继续。",
    "status.embed_done": "完成。trace shape = {shape}。",
    "status.embed_fail": "藏入失败：{err}",
    "status.ex_loaded": "带痕迹图片已加载。设置 trace shape 后点击恢复。",
    "status.extracting": "正在恢复…",
    "status.extract_done_text": "已恢复 {n} 个字符。",
    "status.extract_done_img": "已恢复图片。",
    "status.extract_fail": "恢复失败：{err}",
    "status.runtime_version": "运行时已就绪。Python {py} · cv2 {cv2} · numpy {np}。",
    "status.ex_no_msg": "（空 / 错误的形状）",
    "status.need_wm_image": "请先拖入一张签名图片。",
  },
};

// ---------- runtime ----------

const STORAGE_KEY = "bw:lang";

function detectInitialLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED_LANGS.includes(saved)) return saved;
  } catch (_) { /* localStorage may be blocked */ }
  const nav = (navigator.language || navigator.userLanguage || "en").toLowerCase();
  if (nav.startsWith("zh")) return "zh";
  return "en";
}

let currentLang = detectInitialLang();

export function getLang() {
  return currentLang;
}

export function t(key, vars) {
  const dict = STRINGS[currentLang] || STRINGS.en;
  let s = dict[key];
  if (s === undefined) s = STRINGS.en[key] !== undefined ? STRINGS.en[key] : key;
  if (vars) {
    for (const k of Object.keys(vars)) {
      s = s.replace(new RegExp("\\{" + k + "\\}", "g"), String(vars[k]));
    }
  }
  return s;
}

export function applyI18n(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) return;
  currentLang = lang;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch (_) {}

  // 1) update <html lang="…"> and <title> + meta
  document.documentElement.lang = STRINGS[lang]["html.lang"];
  document.title = t("page.title");
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute("content", t("page.description"));

  // 2) walk the DOM and replace any data-i18n / data-i18n-attr nodes
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (!key) return;
    el.innerHTML = t(key);
  });
  document.querySelectorAll("[data-i18n-attr]").forEach((el) => {
    const pairs = el.getAttribute("data-i18n-attr").split(/\s+/);
    for (const p of pairs) {
      const idx = p.indexOf(":");
      if (idx < 0) continue;
      const attr = p.slice(0, idx);
      const key = p.slice(idx + 1);
      el.setAttribute(attr, t(key));
    }
  });

  // 3) update placeholders (data-i18n-placeholder)
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
  });

  // 4) update language buttons state
  document.querySelectorAll("[data-lang-btn]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.langBtn === lang);
  });

  // 5) notify subscribers (e.g. main.js for dynamic status text)
  document.dispatchEvent(new CustomEvent("bw:lang", { detail: { lang } }));
}

// Boot on script load — sets the initial <html lang> synchronously so the
// page doesn't flash in the wrong language.
export function initI18n() {
  document.documentElement.lang = STRINGS[currentLang]["html.lang"];
  document.title = t("page.title");
  return currentLang;
}
