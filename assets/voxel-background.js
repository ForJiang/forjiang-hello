/**
 * VoxelTopographyGrid 背景——由同名 React 组件逐行移植为原生 JS（无依赖）。
 * 等距视角体素网格：三角函数高度起伏，指针附近隆起；画家算法从后往前绘制。
 */
(function () {
  var canvas = document.getElementById("voxel-bg");
  if (!canvas) return;
  var ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;

  // 原组件的 props 默认值
  var tileSize = 28;
  var maxHeight = 70;
  var primaryColor = "#6366f1";
  var wireColor = "rgba(129, 140, 248, 0.4)";
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

  // 预计算左右侧面颜色（每帧零分配）
  var leftFaceColor =
    "rgba(" + Math.floor(baseRgb.r * 0.45) + ", " + Math.floor(baseRgb.g * 0.45) +
    ", " + Math.floor(baseRgb.b * 0.45) + ", 0.85)";
  var rightFaceColor =
    "rgba(" + Math.floor(baseRgb.r * 0.65) + ", " + Math.floor(baseRgb.g * 0.65) +
    ", " + Math.floor(baseRgb.b * 0.65) + ", 0.85)";

  // 顶面高度照明的颜色查找表
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
  var rafId = null;

  // 位图尺寸跟随 canvas 的 CSS 盒子（由 CSS 的 100%/100lvh 驱动），
  // 不写死内联 px——移动端工具栏收放时盒子会变，ResizeObserver 会补上
  function handleResize() {
    var rect = canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (reduceMotion) draw(); // 静态模式：尺寸变化后补画一帧
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
    time += speed;

    mouse.x += (mouse.targetX - mouse.x) * 0.32;
    mouse.y += (mouse.targetY - mouse.y) * 0.32;

    var mx = mouse.x;
    var my = mouse.y;

    ctx.fillStyle = "#020617"; // slate-950
    ctx.fillRect(0, 0, width, height);

    var gridCols = Math.ceil(width / tileW) + 4;
    var gridRows = Math.ceil(height / tileH) + 8;

    var originX = width * 0.5;
    var originY = height / 3.2;

    var startR = -Math.floor(gridRows / 2);
    var endR = Math.ceil(gridRows / 2);
    var startC = -Math.floor(gridCols / 2);
    var endC = Math.ceil(gridCols / 2);

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

        // 屏幕空间剔除
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

        // 左侧面
        ctx.beginPath();
        ctx.moveTo(topP4X, py);
        ctx.lineTo(isoX, topP3Y);
        ctx.lineTo(isoX, topP3Y + sideBottomShift);
        ctx.lineTo(topP4X, py + sideBottomShift);
        ctx.closePath();
        ctx.fillStyle = leftFaceColor;
        ctx.fill();

        // 右侧面
        ctx.beginPath();
        ctx.moveTo(isoX, topP3Y);
        ctx.lineTo(topP2X, py);
        ctx.lineTo(topP2X, py + sideBottomShift);
        ctx.lineTo(isoX, topP3Y + sideBottomShift);
        ctx.closePath();
        ctx.fillStyle = rightFaceColor;
        ctx.fill();

        // 顶面
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

        // 线框叠加
        ctx.strokeStyle = wireColor;
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
    }
  }

  if (reduceMotion) {
    draw(); // 只画一帧静态地形，不循环
  } else {
    (function loop() {
      draw();
      rafId = requestAnimationFrame(loop);
    })();
  }
})();
