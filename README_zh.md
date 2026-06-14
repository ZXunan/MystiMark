# MystiMark · 玄迹

[![HTML](https://img.shields.io/badge/HTML-5-E34F26?logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS](https://img.shields.io/badge/CSS-3-1572B6?logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES2020-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Pyodide](https://img.shields.io/badge/Pyodide-0.27-FF6F00)](https://pyodide.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-ZXunan%2FMystiMark-181717?logo=github)](https://github.com/ZXunan/MystiMark)

[![MystiMark | 在线 demo](https://img.shields.io/badge/在线demo-mystimark-7a2418)](https://mystimark.brmeng.top/)

**在浏览器里藏一段消息到图片里，再原样取出来——全程不需要上传到任何服务器**

零上传、免安装的网页工作台，支持文字和签名图两种模式。基于 Pyodide
在浏览器内执行未修改的 DWT-DCT-SVD 频域消息隐藏算法。

[English](README.md) | 中文

---

## ⚠️ 重要提示

- **像素从未离开你的设备。** 所有计算都在浏览器标签页里完成——
  没有服务器、没有上传、没有账号、没有埋点。首次启动时从浏览器加载约 30 MB 的浏览器运行时。之后不再有外部请求。
- **首加载慢，之后秒开。** Service Worker 缓存本地资源，重复访问
  跳过慢速下载。
- **可审计。** 引轮源代码以纯 Python 源码打包在
  `py_src/bw_bundle.json` 里，你可以几分钟内读完整个数学层，验证
  没有偷偷外发请求。
- **无任何担保。** 按原样提供，使用产生的任何损失由使用者自行
  承担。

## 概述

MystiMark 把公开的的 DWT-DCT-SVD 图像消息隐藏算法包成零上传的浏览器
UI，加上中英双语前端和 Service Worker 资源缓存管线。引轮在 Pyodide
里以未修改的形式打包家(CPython 3.12 → WebAssembly),所以本地能跑的
算法在浏览器里也能跑  中间没有服务器。

## 功能

- **文字模式** ——藏入 UTF-8 消息(最多 200 字符)。
- **图片模式** ——藏入一张小尺寸 PNG / JPEG 签名图。
- **两套独立密码** ——一个用于消息，一个用于图像块置乱。两端使用
  相同密钥才能恢复。
- **自包含的 trace shape** ——藏入成功后，引轮会报告恢复消息所需
  的精确形式值。该值在一个不能错过的模态框里弹出，请复制到安全
  地方。
- **中英双语 UI** ——顶栏切换 EN / 中。
- **Service Worker 缓存** ——首加载拉取约 30 MB，之后秒开。
- **键盘可导航导** ——所有拖入区可 Tab，所有按钮可 Enter / Space。
- **尊重无障碍偏好** ——`prefers-reduced-motion` 启用时关闭平滑
  滚动。

## ❤️ 赞助

> [想出现在这里？](mailto:zxunan@example.com)

*暂无赞助者 —— 来做第一个。*

## 生态

社区中扩展或集成 MystiMark 的项目：

| 项目 | 说明 | 状态 |
|---|---|---|
| _(暂无)_ | _有想加的？开 PR。_ | —— |

## 技术栈

| 组件 | 技术 |
|---|---|
| 标记 | HTML5 |
| 样式 | 原生 CSS3，无框架 |
| 行为 | 原生 ES2020 JavaScript，无构建步骤 |
| 引擎运行时 | [Pyodide](https://pyodide.org/) 0.27(CPython 3.12  → WebAssembly) |
| 引擎依赖 | opencv-python 4.11、numpy 2.x、pywavelets、Pillow |
| 缓存 | Service Worker(仅同源) |
| 托管 | 纯静态站，一键部署到 GitHub Pages |

---

## ⚙️ 工作原理

当用户点击 ⨪藏入消息⨪(或 ⨪Hide message⨪)时，JS 端：

1. 把图片读入内存为原始字节。
2. 通过 `pyodide_main.embed_str()` / `embed_img()` 把字节交给 Pyodide。
3. Python 引擎藏入消息，返回新的 PNG 字节流。
4. JS 把新 PNG 渲柒到 canvas 上，提供下载。

**恢复消息** / **Recover message** 是镜像流程。整个过程除了首次加载
页面 + Pyodide + bundle，没有任何网络请求。

## 配置

没有构建步骤，没有配置文件。唯一的旋钮是：

- **`sw.js`** —— `VERSION` 常量。每次修改 `index.html`、`styles.css`、
  `main.js`、`i18n.js` 或 `bw_bundle.json` 都要 bump(`mm-v1.0`  → 
  `mm-v1.1`) —— 否则停留在旧 SW 的用户会看到旧版本。
- **`src/main.js`** —— `PYODIDE_VERSION` 常量。固定到你测试过的 Pyodide
  版本。谨慎 bump，运行时 ABI 在大版本之间会变。

## 浏览器支持

测试过的最新两个稳定版本：

- Chrome / Edge
- Firefox
- Safari

需要 WebAssembly + ES2020 + `OffscreenCanvas`。旧浏览器会优雅降级
—— 按钮还在，但藏入/恢复不会执行。

---

## 项目结构

```
.
|-- index.html              入口。分区：工作室 / 恢复 / 关于。
|-- styles.css              全部样式。原生 CSS，无框架。
|-- sw.js                   Service Worker。缓存本地静态资源。
|   src/
|   |-- main.js             UI 接线、状态机、Pyodide 调用。
|   `-- i18n.js             双语字符串表 (en / zh)。
|   py_src/
|   |-- pyodide_main.py     引擎包装(藏入 / 恢复 / capture)。
|   |-- _bootstrap.py       初始化 Pyodide 文件系统 + 导入。
|   `-- bw_bundle.json      引擎源码(内联为单 JSON)。
|-- .nojekyll               告诉 GitHub Pages 跳过 Jekyll。
|-- .gitignore              标准忽略。
`-- (许可证 ： MIT, 见上方 `## 许可证` 段)
```

---

## ⚖️ 免责声明

> 使用前请仔细阅读：
>
> 📖 **仅供技术学习与研究使用。** 作者不承担任何因使用本工具导致的
> 账号封禁、服务中断、数据丢失或其他损失。请在使用前确认你所在国家
> 或地区的法律法规，并自行承担相关风险。

---

## ⭐ Star History

如果你觉得这个项目有用，欢迎点个 Star  —— 这能帮助更多人发现它。

[![Star History Chart](https://api.star-history.com/svg?repos=ZXunan/MystiMark&type=Date)](https://star-history.com/#ZXunan/MystiMark&Date)

---

## 基于

> **MystiMark 基于开源项目
> [guofei9987/blind_watermark](https://github.com/guofei9987/blind_watermark)
> 构建。** 打包在 `py_src/bw_bundle.json` 里的 DWT-DCT-SVD 图像消息
> 隐藏算法，是该项目的 Python 引擎的未修改移植。MystiMark 在它之上
> 添加了零上传的浏览器 UI、中英双语前端、以及 Service Worker 缓存的
> 资源管线。如果你在研究或产品中使用了 MystiMark，也欢迎给上游仓库
> 点个 Star。

## 许可证

MIT —— © 2026 MystiMark · 玄迹。

---

## 关于

MystiMark 是一款开源的浏览器内工作台，用于在图像中隐藏和恢复消息。

基于未修改的 DWT-DCT-SVD Python 引擎，在 Pyodide 中运行。
