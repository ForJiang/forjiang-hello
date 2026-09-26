/**
 * Voxel topography background — a line-by-line vanilla JS port of the React
 * component of the same name (no dependencies).
 * Isometric voxel grid: trigonometric height waves with a raised mound under
 * the pointer; rendered back-to-front with the painter's algorithm.
 */
(function () {
  var canvas = document.getElementById("voxel-bg");
  if (!canvas) return;
  var ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;

  // Default props of the original component (recolored to a darker black/gray monochrome palette)
  var tileSize = 28;
  var maxHeight = 70;
  var primaryColor = "#4f4f4f";
  var wireColor = "rgba(190, 190, 190, 0.28)";
  var speed = 0.015;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function hexToRgb(hex) {
    var cleanHex = hex.replace("#", "");
    var bigint = parseInt(
      cleanHex.length === 3
        ? cleanHex.split("").map(function (c) { return c + c; }).join("")
        : cleanHex,
      16,
    );
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
  }

  var baseRgb = hexToRgb(primaryColor);

  // Pre-computed side face colors (zero allocations per frame)
  var leftFaceColor =
    "rgba(" + Math.floor(baseRgb.r * 0.45) + ", " + Math.floor(baseRgb.g * 0.45) +
    ", " + Math.floor(baseRgb.b * 0.45) + ", 0.85)";
  var rightFaceColor =
    "rgba(" + Math.floor(baseRgb.r * 0.65) + ", " + Math.floor(baseRgb.g * 0.65) +
    ", " + Math.floor(baseRgb.b * 0.65) + ", 0.85)";

  // Lookup table for top-face elevation lighting
  var topColorLUT = new Array(101);
  for (var i = 0; i <= 100; i++) {
    var ratio = i / 100;
    var r = Math.floor(baseRgb.r * (0.55 + ratio * 0.45));
    var g = Math.floor(baseRgb.g * (0.55 + ratio * 0.45));
    var b = Math.floor(baseRgb.b * (0.55 + ratio * 0.45));
    topColorLUT[i] = "rgb(" + r + "," + g + "," + b + ")";
  }

  // Lit top-face palette for the wordmark light: 24 intensity steps x 101
  // heights, each blended toward white. Pre-computed — zero allocations/frame.
  // 24 steps (not 10) so the per-voxel light has no visible banding.
  // The blend ceiling is deliberately low (0.4): the pool should read the
  // terrain without washing it out — the white wordmark must stay the
  // most legible thing on screen.
  var LIGHT_STEPS = 24;
  var litTopLUT = new Array(LIGHT_STEPS);
  var litRightLUT = new Array(LIGHT_STEPS);
  for (var s = 0; s < LIGHT_STEPS; s++) {
    var k = (s / (LIGHT_STEPS - 1)) * 0.4; // blend factor toward white
    var col = new Array(101);
    for (var j = 0; j <= 100; j++) {
      var rr = Math.floor((baseRgb.r * (0.55 + (j / 100) * 0.45)) * (1 - k) + 255 * k);
      var gg = Math.floor((baseRgb.g * (0.55 + (j / 100) * 0.45)) * (1 - k) + 255 * k);
      var bb = Math.floor((baseRgb.b * (0.55 + (j / 100) * 0.45)) * (1 - k) + 255 * k);
      col[j] = "rgb(" + rr + "," + gg + "," + bb + ")";
    }
    litTopLUT[s] = col;
    // The right side face catches the light too, at 60% strength — adds depth
    var kr = k * 0.6;
    litRightLUT[s] =
      "rgba(" + Math.floor(baseRgb.r * 0.65 * (1 - kr) + 255 * kr) + ", " +
      Math.floor(baseRgb.g * 0.65 * (1 - kr) + 255 * kr) + ", " +
      Math.floor(baseRgb.b * 0.65 * (1 - kr) + 255 * kr) + ", 0.85)";
  }

  var mouse = { x: -1000, y: -1000, targetX: -1000, targetY: -1000 };
  var width = 0;
  var height = 0;
  var time = 0;
  var lastDpr = 0;
  var lastW = 0;
  var lastH = 0;
  var waveTables = null;

  // Effective device pixel ratio: allow up to 3x so dpr-3 phones render the
  // terrain natively instead of being upscaled from 2x, bounded by a total
  // pixel budget so very large viewports do not pay 3x fill cost
  function effectiveDpr(w, h) {
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    var budgeted = Math.sqrt(4500000 / (w * h));
    if (budgeted < dpr) dpr = budgeted;
    return Math.max(1, dpr);
  }

  // The bitmap follows the canvas's CSS box (driven by CSS 100% / 100lvh);
  // no inline px is written here — the box changes with mobile toolbar
  // show/hide, and the ResizeObserver fills in the new bitmap
  function handleResize() {
    // window.inner* is the authoritative visible size: it follows the mobile
    // toolbar show/hide on every browser generation, while a fixed element's
    // CSS 100% stays pinned to the layout viewport on older iOS and leaves a
    // gap when the toolbar collapses. Writing inline px is safe here because
    // the per-frame guard in draw() re-reads window.inner* every frame, so
    // this size can never go stale.
    var w = Math.max(1, window.innerWidth);
    var h = Math.max(1, window.innerHeight);
    var dpr = effectiveDpr(w, h);
    if (w === lastW && h === lastH && dpr === lastDpr) return; // nothing changed
    lastW = w;
    lastH = h;
    lastDpr = dpr;
    width = w;
    height = h;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (reduceMotion) draw(); // static mode: repaint one frame after a resize
  }

  var resizeObserver = new ResizeObserver(handleResize);
  resizeObserver.observe(canvas);
  handleResize();
  window.addEventListener("resize", handleResize);
  window.addEventListener("orientationchange", handleResize);

  function updatePointerPos(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    mouse.targetX = clientX - rect.left;
    mouse.targetY = clientY - rect.top;
  }

  function handlePointerMove(e) {
    updatePointerPos(e.clientX, e.clientY);
  }

  function handlePointerLeave() {
    mouse.targetX = -1000;
    mouse.targetY = -1000;
  }

  window.addEventListener("pointermove", handlePointerMove, { passive: true });
  document.addEventListener("pointerleave", handlePointerLeave, { passive: true });

  var tileW = tileSize * 0.866025; // cos(30 deg)
  var tileH = tileSize * 0.5; // sin(30 deg)
  var maxRadiusSq = 220 * 220;
  var invMaxHeight = 1 / (maxHeight + 55);

  function draw() {
    // Per-frame guard: window.inner* changes (mobile toolbar, display zoom,
    // window resize, tab activation transitions) are picked up within a frame
    if (
      window.innerWidth !== lastW ||
      window.innerHeight !== lastH ||
      effectiveDpr(width, height) !== lastDpr
    ) {
      handleResize();
    }

    time += speed;

    mouse.x += (mouse.targetX - mouse.x) * 0.32;
    mouse.y += (mouse.targetY - mouse.y) * 0.32;

    var mx = mouse.x;
    var my = mouse.y;

    // The hello wordmark doubles as a light source (published by main.js): the
    // terrain beneath it is lit in real time, and the glow intensifies while
    // the pointer lingers inside the wordmark's ellipse.
    var light = window.__helloLight;
    var lightOn = !!light && light.intensity > 0.02;
    var lx = 0, ly = 0, lrx = 1, lry = 1, lint = 0;
    if (lightOn) {
      lx = light.x;
      ly = light.y;
      lrx = light.rx;
      lry = light.ry;
      lint = light.intensity;
      var pdx = (mx - lx) / lrx;
      var pdy = (my - ly) / lry;
      var pd = pdx * pdx + pdy * pdy;
      if (pd < 1.6) {
        // up to 2x brighter while the pointer lingers over the wordmark
        lint *= 1 + (1 - Math.sqrt(pd) / 1.265);
      }
    }

    ctx.fillStyle = "#000000"; // pure black sky
    ctx.fillRect(0, 0, width, height);

    var originX = width * 0.5;
    var originY = height / 3.2;

    // The iso grid spans a DIAMOND in screen space — a voxel maps to
    // (originX + (c-r)*tileW, originY + (c+r)*tileH) — so a range sized from
    // the viewport's side lengths leaves the corners uncovered (black wedges).
    // Corner reach in both axes: |c-r| must reach maxA and |c+r| must reach
    // maxB, and since c = (a+b)/2, r = (b-a)/2, both |c| and |r| need
    // (maxA + maxB)/2. A small margin covers the pointer bump overshoot.
    var maxA = Math.max(originX / tileW, (width - originX) / tileW);
    var maxB = Math.max(originY / tileH, (height - originY) / tileH);
    var half = Math.ceil((maxA + maxB) / 2) + 2;

    var startR = -half;
    var endR = half + 1;
    var startC = -half;
    var endC = half + 1;

    var cols = endC - startC;
    var rows = endR - startR;

    // Wave phase tables via angle addition. The height field is
    //   wave1 = sin(t2 + c*.25 + r*.25)
    //   wave2 = cos(t15 + c*.15 - r*.30)
    // Splitting each into per-index trig tables (rebuilt only when the grid
    // size changes) replaces two trig calls per voxel with a few multiplies;
    // sin(a+b) expansions are exact identities, so the picture is unchanged.
    if (!waveTables || waveTables.cols !== cols || waveTables.rows !== rows) {
      waveTables = {
        cols: cols,
        rows: rows,
        sinA: new Float64Array(cols), // sin(t2 + c*.25)
        cosA: new Float64Array(cols), // cos(t2 + c*.25)
        sinG: new Float64Array(cols), // sin(t15 + c*.15)
        cosG: new Float64Array(cols), // cos(t15 + c*.15)
        sinB: new Float64Array(rows), // sin(r*.25)
        cosB: new Float64Array(rows), // cos(r*.25)
        sinD: new Float64Array(rows), // sin(-r*.30)
        cosD: new Float64Array(rows), // cos(-r*.30)
      };
    }
    var t2 = time * 2;
    var t15 = time * 1.5;
    for (var ci = 0; ci < cols; ci++) {
      var cIndex = startC + ci;
      var a = t2 + cIndex * 0.25;
      var g = t15 + cIndex * 0.15;
      waveTables.sinA[ci] = Math.sin(a);
      waveTables.cosA[ci] = Math.cos(a);
      waveTables.sinG[ci] = Math.sin(g);
      waveTables.cosG[ci] = Math.cos(g);
    }
    for (var ri = 0; ri < rows; ri++) {
      var rIndex = startR + ri;
      var b = rIndex * 0.25;
      var d = rIndex * 0.3;
      waveTables.sinB[ri] = Math.sin(b);
      waveTables.cosB[ri] = Math.cos(b);
      waveTables.sinD[ri] = -Math.sin(d);
      waveTables.cosD[ri] = Math.cos(d);
    }

    for (var r = startR; r < endR; r++) {
      var rIdx = r - startR;
      var sinBr = waveTables.sinB[rIdx];
      var cosBr = waveTables.cosB[rIdx];
      var sinDr = waveTables.sinD[rIdx];
      var cosDr = waveTables.cosD[rIdx];

      for (var c = startC; c < endC; c++) {
        var cIdx = c - startC;
        var isoX = originX + (c - r) * tileW;
        var isoY = originY + (c + r) * tileH;

        var dx = isoX - mx;
        var dy = isoY - my;
        var distSq = dx * dx + dy * dy;

        // sin(a+b) / cos(a+b) from the per-index tables
        var wave1 = waveTables.sinA[cIdx] * cosBr + waveTables.cosA[cIdx] * sinBr;
        var wave2 = waveTables.cosG[cIdx] * cosDr - waveTables.sinG[cIdx] * sinDr;
        var h = (wave1 + wave2 + 2) * 0.25 * maxHeight;

        if (distSq < maxRadiusSq) {
          var dist = Math.sqrt(distSq);
          var influence = 1 - dist / 220;
          h += influence * influence * 55;
        }

        var py = isoY - h;

        // Screen-space culling
        if (
          isoX + tileW < 0 ||
          isoX - tileW > width ||
          py + h + 15 < 0 ||
          py - tileH > height
        ) {
          continue;
        }

        var topP1Y = py - tileH;
        var topP2X = isoX + tileW;
        var topP3Y = py + tileH;
        var topP4X = isoX - tileW;

        var sideBottomShift = h + 15;

        // Left side face
        ctx.beginPath();
        ctx.moveTo(topP4X, py);
        ctx.lineTo(isoX, topP3Y);
        ctx.lineTo(isoX, topP3Y + sideBottomShift);
        ctx.lineTo(topP4X, py + sideBottomShift);
        ctx.closePath();
        ctx.fillStyle = leftFaceColor;
        ctx.fill();

        // Right side face
        ctx.beginPath();
        ctx.moveTo(isoX, topP3Y);
        ctx.lineTo(topP2X, py);
        ctx.lineTo(topP2X, py + sideBottomShift);
        ctx.lineTo(isoX, topP3Y + sideBottomShift);
        ctx.closePath();
        ctx.fillStyle = litStep ? litRightLUT[litStep] : rightFaceColor;
        ctx.fill();

        // Wordmark light: elliptical falloff, quantized to a LUT step.
        // Smoothstep gives a softer edge than a plain quadratic.
        var litStep = 0;
        if (lightOn) {
          var ldx = isoX - lx;
          if (ldx > -lrx && ldx < lrx) {
            var ldy = isoY - ly;
            if (ldy > -lry && ldy < lry) {
              var ndx = ldx / lrx;
              var ndy = ldy / lry;
              var d2 = ndx * ndx + ndy * ndy;
              if (d2 < 1) {
                var infl = 1 - Math.sqrt(d2);
                infl = infl * infl * (3 - 2 * infl); // smoothstep
                // clamp to 1..LIGHT_STEPS-1: the LUT has exactly LIGHT_STEPS rows
                litStep = 1 + Math.min(LIGHT_STEPS - 2, (infl * lint * (LIGHT_STEPS - 2)) | 0);
              }
            }
          }
        }

        // Top face
        ctx.beginPath();
        ctx.moveTo(isoX, topP1Y);
        ctx.lineTo(topP2X, py);
        ctx.lineTo(isoX, topP3Y);
        ctx.lineTo(topP4X, py);
        ctx.closePath();

        var rawLight = h * invMaxHeight;
        var lightRatio = rawLight > 1 ? 1 : rawLight < 0.1 ? 0.1 : rawLight;
        var lutIdx = (lightRatio * 100) | 0;

        ctx.fillStyle = litStep ? litTopLUT[litStep][lutIdx] : topColorLUT[lutIdx];
        ctx.fill();

        // Wireframe overlay
        ctx.strokeStyle = wireColor;
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
    }

    // Per-pixel light pool: an additive elliptical white gradient over the
    // whole scene — smooth and free of voxel quantization — with a slow
    // breathing so the light feels alive rather than static. Alpha is kept
    // low: this is a sheen on the terrain, not a wash.
    if (lightOn) {
      var breathe = 0.88 + 0.12 * Math.sin(time * 0.9);
      var a0 = 0.045 * lint * breathe;
      if (a0 > 0.004) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.translate(lx, ly);
        ctx.scale(1, lry / lrx);
        var grad = ctx.createRadialGradient(0, 0, 0, 0, 0, lrx);
        grad.addColorStop(0, "rgba(255,255,255," + a0.toFixed(4) + ")");
        grad.addColorStop(0.45, "rgba(255,255,255," + (a0 * 0.38).toFixed(4) + ")");
        grad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(-lrx, -lrx, lrx * 2, lrx * 2);
        ctx.restore();
      }
    }
  }

  if (reduceMotion) {
    draw(); // draw a single static frame, no loop
  } else {
    (function loop() {
      draw();
      requestAnimationFrame(loop);
    })();
  }
})();
