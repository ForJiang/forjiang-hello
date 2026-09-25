# ForJiang — hello

一个零依赖的纯静态演示页：靛蓝体素地形网格背景之上，居中用 SVG 描边动画"手写"出 **hello**（全程 3.5 秒），写完底部淡出重播入口。除此之外没有任何其他内容——它就是这一个动画的演示。

线上地址：**https://forjiang.github.io/forjiang-hello/**

手写动画复刻自 Apple Hello 效果的 motion/react 组件（英文 hello 部分），背景复刻自 VoxelTopographyGrid React 组件——两者都移植为原生 JS，不依赖 React，无需构建，可直接托管在 GitHub Pages。

## 本地预览

```bash
python3 -m http.server 8000
# 打开 http://localhost:8000
```

直接双击 `index.html` 也能跑（无任何外链资源）。

## 功能

- 打开即播放 hello 手写描边动画，字标在视口中精确居中
- 全屏体素地形背景：等距网格三角函数起伏，指针经过处体素隆起（带缓动跟随）
- 三种重播方式：点击页面任意处、点击 `↻ Replay` 按钮、按 `R` 键
- `prefers-reduced-motion` 为 reduce 时，背景只绘一帧静态地形、字标直接展示完成态
- 无 JS 环境下降级为纯文本 "hello"
- 无框架、无构建、无外部请求；界面文案为英文

## 文件说明

| 文件 | 作用 |
| --- | --- |
| `index.html` | 页面结构 |
| `style.css` | 样式；`draw-path` / `fade-in` 两个 keyframes 即"边写边显"效果，canvas 固定分层 |
| `assets/voxel-background.js` | 体素地形背景：由同名 React 组件逐行移植的原生 JS，全屏 fixed canvas |
| `assets/hello-data.js` | path 几何数据与动画时序，由参考组件脚本提取生成，请勿手改 `d` 字符串 |
| `assets/main.js` | 渲染逻辑：取每条 path 的真实长度，驱动 `stroke-dashoffset` 从全长走到 0 |
| `favicon.svg` | favicon |

## 实现要点

- motion 的 `pathLength: 0 -> 1` 通过 `stroke-dasharray = pathLength`、`stroke-dashoffset` 从全长动画到 0 复刻；每条 path 的 `duration` / `delay` / `ease` 以及 opacity 的时长都按参考组件原样保留（英文共 2 条 path，全程 3.5s）。
- 清晰度：SVG 设 `shape-rendering="geometricPrecision"`，非整数缩放下笔画边缘更干净；字标高度 `clamp(96px, 22vw, 168px)`，矢量渲染天然适配高分屏。
- 背景移植：原 React 组件用一个受边框包裹的 aspect-video 容器，这里改为 `position: fixed; inset: 0` 的全屏 canvas（`document.documentElement.clientWidth/Height` 测量 + ResizeObserver + DPR 上限 2），算法逐行对应原组件（画家算法从后往前、LUT 顶面配色、0.32 系数的指针缓动）；`body` 底色与 canvas 清屏色一致（`#020617`），iOS 地址栏收放造成的边缘缝隙不可见。
- 交互：字标是空心描边，在 SVG 上挂 click 会点不中，因此点击监听挂在 document 级（按钮处 `stopPropagation` 防止双触发）。
- `prefers-reduced-motion` 时跳过动画直接渲染完成态；无 JS 时由 `<noscript>` 兜底显示纯文本。

## 部署

推送到 GitHub 后，Settings → Pages → Source 选 `Deploy from a branch`，分支 `main`、目录 `/` 即可。Pages 有约 10 分钟 CDN 缓存，推送后线上更新稍有延迟属正常现象。
