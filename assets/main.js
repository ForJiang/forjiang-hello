/**
 * 把 hello-data.js 里的 path 数据渲染成“边写边显”的手写字标。
 * 复刻 motion/react 的行为：pathLength 0->1 用 stroke-dashoffset 走完全长实现，
 * 每条 path 的 duration / delay / ease / opacity 时长均取自参考组件。
 */
(function () {
  var NS = "http://www.w3.org/2000/svg";
  var svg = document.getElementById("hello-svg");
  var dock = document.getElementById("dock");
  var replayBtn = document.getElementById("replay");

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var completeTimer = null;

  function totalTime() {
    return HELLO_DATA.en.paths.reduce(function (max, p) {
      return Math.max(max, p.delay + p.dur);
    }, 0);
  }

  function render() {
    var data = HELLO_DATA.en;

    svg.setAttribute("viewBox", data.viewBox);
    svg.setAttribute("stroke-width", data.strokeWidth);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    document.body.classList.remove("done");
    dock.setAttribute("aria-hidden", "true");
    window.clearTimeout(completeTimer);

    var paths = data.paths.map(function (p) {
      var el = document.createElementNS(NS, "path");
      el.setAttribute("d", p.d);
      el.setAttribute("stroke-linecap", "round");
      el.style.setProperty("--dur", p.dur + "s");
      el.style.setProperty("--delay", p.delay + "s");
      el.style.setProperty("--ease", p.ease === "easeInOut" ? "ease-in-out" : "ease-out");
      el.style.setProperty("--op-dur", p.opDur + "s");
      el.style.setProperty("--op-delay", p.opDelay + "s");
      svg.appendChild(el);
      return el;
    });

    if (reduceMotion) {
      paths.forEach(function (el) {
        el.style.strokeDashoffset = "0";
        el.style.opacity = "1";
      });
      finish();
      return;
    }

    // 先测量并落定初始态（全藏），强制回流后再挂动画，避免浏览器把起始状态跳过
    paths.forEach(function (el) {
      var len = el.getTotalLength();
      el.style.setProperty("--len", String(len));
      el.style.strokeDasharray = String(len);
      el.style.strokeDashoffset = String(len);
      el.style.opacity = "0";
    });
    svg.getBoundingClientRect();
    paths.forEach(function (el) {
      el.classList.add("drawing");
    });

    // 对应参考组件的 onAnimationComplete：最后一条 path 画完时显示重播
    completeTimer = window.setTimeout(finish, totalTime() * 1000 + 80);
  }

  function finish() {
    document.body.classList.add("done");
    dock.setAttribute("aria-hidden", "false");
  }

  replayBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    render();
  });

  // 点页面任意处都能重播（字标是空心描边，只监听 svg 会点不中）
  document.addEventListener("click", function (e) {
    if (e.target === replayBtn) return;
    render();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "r" || e.key === "R") {
      render();
    }
  });

  render();
})();
