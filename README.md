# ForJiang — hello

A zero-dependency static demo page: over a full-screen black-and-gray voxel topography grid, **hello** is hand-drawn stroke by stroke in the center (3.5 seconds), and a replay entry fades in at the bottom when it finishes. Nothing else on the page — it is a demo of this one animation.

Live: **https://forjiang.github.io/forjiang-hello/**

The writing animation ports the Apple Hello motion/react component (the English "hello" variant); the background ports the VoxelTopographyGrid React component. Both are plain JavaScript ports — no React, no build step, ready for static hosting on GitHub Pages.

## Local preview

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` directly also works (no external requests).

## Features

- Plays the hello handwriting animation on load, with the wordmark perfectly centered in the viewport
- Full-screen voxel topography background: an isometric grid with trigonometric height waves; voxels rise where the pointer passes (with eased follow)
- Three ways to replay: click anywhere, click the `↻ Replay` button, or press `R`
- With `prefers-reduced-motion: reduce`, the background draws a single static frame and the wordmark shows its finished state without animating
- Falls back to a plain "hello" text when JavaScript is disabled
- No frameworks, no build, no external requests; all UI copy is English

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page structure |
| `style.css` | Styles; the `draw-path` / `fade-in` keyframes are the "draw as it reveals" effect, plus canvas layering |
| `assets/voxel-background.js` | Voxel topography background: a line-by-line vanilla JS port of the React component, full-screen fixed canvas |
| `assets/hello-data.js` | Path geometry and animation timing, extracted from the reference component by a script — do not hand-edit the `d` strings |
| `assets/main.js` | Render logic: measures each path's real length and drives `stroke-dashoffset` from full length to 0 |
| `favicon.svg` | Favicon |

## Implementation notes

- The `pathLength: 0 -> 1` of motion is replicated with `stroke-dasharray = pathLength` and a `stroke-dashoffset` animation from the full length to 0; each path's `duration`, `delay`, `ease`, and opacity timing are kept exactly as in the reference component (2 paths for English, 3.5s total).
- Crispness: the SVG uses `shape-rendering="geometricPrecision"` for cleaner stroke edges at non-integer scales; the wordmark height is `clamp(96px, 22vw, 168px)`, and vector rendering is naturally sharp on high-DPI screens.
- Background port: the original component used a bordered aspect-video container; here it is a full-screen fixed canvas. **The size is belt-and-braces CSS-driven**: `height: 100%` stretches the fixed box to whatever the browser treats as the viewport, and `min-height: 100lvh` adds the large-viewport floor, so no pane shape, scale, or iOS toolbar state can leave an uncovered strip. JS never writes inline px and only mirrors the canvas box into the bitmap via ResizeObserver (DPR capped at 2). The algorithm is a line-by-line port (back-to-front painter's algorithm, LUT top-face coloring, 0.32 pointer easing) with the palette recolored from indigo to a black/gray monochrome (`#000000` sky, `#737373` voxels, light-gray wireframe); the `body` background matches the canvas clear color (`#000000`) as a final fallback.
- Interaction: the wordmark is a hollow stroke, so a click listener on the SVG alone would miss; the click listener is attached at the document level (with `stopPropagation` on the button to avoid double-firing).
- With `prefers-reduced-motion` the animations are skipped and the finished state renders directly; without JS, `<noscript>` shows the plain text fallback.

## Deployment

After pushing to GitHub, set Settings → Pages → Source to `Deploy from a branch`, branch `main`, directory `/`. Note that Pages has a CDN cache of about 10 minutes, so a short delay before the live site updates is normal.
