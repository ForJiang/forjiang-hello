# ForJiang — hello

一个零依赖的纯静态演示页：黑屏中央用 SVG 描边动画"手写"出 **hello**，写完 3.5 秒。

复刻自 Apple Hello 效果的 motion/react 组件（英文 hello 部分），但不依赖 React，无需构建，直接扔到 GitHub Pages 静态托管。

## 本地预览

```bash
python3 -m http.server 8000
# 打开 http://localhost:8000
```

直接双击 `index.html` 也能跑（无任何外链资源）。

## 文件说明

| 文件 | 作用 |
| --- | --- |
| `index.html` | 页面结构 |
| `style.css` | 样式；`draw-path` / `fade-in` 两个 keyframes 即"边写边显"效果 |
| `assets/hello-data.js` | path 几何数据与动画时序，由参考组件脚本提取，请勿手改 `d` 字符串 |
| `assets/main.js` | 渲染逻辑：取每条 path 的真实长度，驱动 `stroke-dashoffset` 从全长走到 0 |
| `favicon.svg` | favicon |

## 实现要点

- motion 的 `pathLength: 0 -> 1` 通过 `stroke-dasharray = pathLength`、`stroke-dashoffset` 从全长动画到 0 复刻；每条 path 的 `duration` / `delay` / `ease` 以及 opacity 的时长都按参考组件原样保留（英文共 2 条 path，全程 3.5s）。
- 写完前页面只有居中的字标；写完后底部淡入 Replay 按钮。点击任意处、按钮或按 `R` 均可重播。
- 支持 `prefers-reduced-motion`（reduce 时直接显示完成态）和无 JS 时的纯文本兜底。
- 无框架、无构建、无外部请求。

## 部署

推送到 GitHub 后，Settings → Pages → Source 选 `Deploy from a branch`，分支 `main`、目录 `/` 即可。线上地址：https://forjiang.github.io/forjiang-hello/
