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

  // Default props of the original component (recolored to a black/gray monochrome palette)
  var tileSize = 28;
  var maxHeight = 70;
  var primaryColor = "#737373";
  var wireColor = "rgba(212, 212, 212, 0.35)";
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

  var mouse = { x: -1000, y: -1000, targetX: -1000, targetY: -1000 };
  var width = 0;
  var height = 0;
  var time = 0;
  var lastDpr = 0;

  // The bitmap follows the canvas's CSS box (driven by CSS 100% / 100lvh);
  // no inline px is written here — the box changes with mobile toolbar
  // show/hide, and the ResizeObserver fills in the new bitmap
  function handleResize() {
    var rect = canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    lastDpr = dpr;
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
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
    // DPR changes (moving between displays, browser zoom) do not fire
    // ResizeObserver — check every frame so the bitmap never goes stale
    var dprNow = Math.min(window.devicePixelRatio || 1, 2);
    if (dprNow !== lastDpr) {
      handleResize();
    }

    time += speed;

    mouse.x += (mouse.targetX - mouse.x) * 0.32;
    mouse.y += (mouse.targetY - mouse.y) * 0.32;

    var mx = mouse.x;
    var my = mouse.y;

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

    for (var r = startR; r < endR; r++) {
      for (var c = startC; c < endC; c++) {
        var isoX = originX + (c - r) * tileW;
        var isoY = originY + (c + r) * tileH;

        var dx = isoX - mx;
        var dy = isoY - my;
        var distSq = dx * dx + dy * dy;

        var wave1 = Math.sin(time * 2 + c * 0.25 + r * 0.25);
        var wave2 = Math.cos(time * 1.5 + c * 0.15 - r * 0.3);
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
        ctx.fillStyle = rightFaceColor;
        ctx.fill();

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

        ctx.fillStyle = topColorLUT[lutIdx];
        ctx.fill();

        // Wireframe overlay
        ctx.strokeStyle = wireColor;
        ctx.lineWidth = 0.6;
        ctx.stroke();
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
