/**
 * 把 hello-data.js 里的 path 数据渲染成“边写边显”的手写字标。
 * 复刻 motion/react 的行为：pathLength 0->1 用 stroke-dashoffset 走完全长实现，
 * 每条 path 的 duration / delay / ease / opacity 时长均取自参考组件。
 */
(function () {
  var NS = "http://www.w3.org/2000/svg";
  var svg = document.getElementById("hello-svg");
  var reveal = document.getElementById("reveal");
  var replayBtn = document.getElementById("replay");
  var langOpts = Array.prototype.slice.call(document.querySelectorAll(".lang-opt"));

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var currentWord = "en";
  var completeTimer = null;

  function easeOf(ease) {
    return ease === "easeInOut" ? "ease-in-out" : "ease-out";
  }

  function totalTime(word) {
    var paths = HELLO_DATA[word].paths;
    return paths.reduce(function (max, p) {
      return Math.max(max, p.delay + p.dur);
    }, 0);
  }

  function render(word) {
    var data = HELLO_DATA[word];
    currentWord = word;

    svg.setAttribute("viewBox", data.viewBox);
    svg.setAttribute("stroke-width", data.strokeWidth);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    document.body.classList.remove("done");
    reveal.setAttribute("aria-hidden", "true");
    window.clearTimeout(completeTimer);

    var paths = data.paths.map(function (p) {
      var el = document.createElementNS(NS, "path");
      el.setAttribute("d", p.d);
      el.setAttribute("stroke-linecap", "round");
      if (p.cls === "stroke-yellow-400") {
        el.setAttribute("stroke", "#facc15");
      }
      el.style.setProperty("--dur", p.dur + "s");
      el.style.setProperty("--delay", p.delay + "s");
      el.style.setProperty("--ease", easeOf(p.ease));
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

    // 对应参考组件的 onAnimationComplete：最后一条 path 画完时揭示后续内容
    completeTimer = window.setTimeout(finish, totalTime(word) * 1000 + 80);
  }

  function finish() {
    document.body.classList.add("done");
    reveal.setAttribute("aria-hidden", "false");
  }

  replayBtn.addEventListener("click", function () {
    render(currentWord);
  });

  langOpts.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var word = btn.getAttribute("data-word");
      langOpts.forEach(function (b) {
        var active = b === btn;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-pressed", active ? "true" : "false");
      });
      if (word !== currentWord) {
        render(word);
      } else {
        render(word); // 同词也重播，给用户即时反馈
      }
    });
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "r" || e.key === "R") {
      render(currentWord);
    }
  });

  render("en");
})();
