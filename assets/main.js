/**
 * Renders the path data from hello-data.js as a "draws as it reveals" wordmark.
 * Replicates motion/react behavior: pathLength 0->1 is implemented by walking
 * stroke-dashoffset from the full length to 0, with each path's duration /
 * delay / ease / opacity timing taken from the reference component.
 */
(function () {
  var NS = "http://www.w3.org/2000/svg";
  var svg = document.getElementById("hello-svg");
  var clockTime = document.getElementById("clock-time");
  var clockDate = document.getElementById("clock-date");
  var fsBtn = document.getElementById("fs-btn");
  var fsLabel = document.getElementById("fs-label");

  var DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var completeTimer = null;
  var lightTimer = null;
  var lightIntensity = 0;

  function totalTime() {
    return HELLO_DATA.en.paths.reduce(function (max, p) {
      return Math.max(max, p.delay + p.dur);
    }, 0);
  }

  // Publish the wordmark as a light source for the voxel background: position,
  // elliptical reach, and current intensity (viewport CSS pixels, same space
  // the canvas draws in). The wordmark's box only changes on resize, so the
  // measured rect is cached and re-read after a resize — re-reading it on
  // every 80ms ramp tick would force a layout flush each time for a box that
  // cannot have moved
  var lightRect = null;

  function publishLight(intensity) {
    lightIntensity = intensity;
    if (!lightRect) lightRect = svg.getBoundingClientRect();
    window.__helloLight = {
      x: lightRect.left + lightRect.width / 2,
      y: lightRect.top + lightRect.height / 2,
      rx: Math.max(60, lightRect.width * 0.62),
      ry: Math.max(50, lightRect.height * 1.25),
      intensity: intensity,
    };
  }

  function render() {
    var data = HELLO_DATA.en;

    svg.setAttribute("viewBox", data.viewBox);
    svg.setAttribute("stroke-width", data.strokeWidth);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    document.body.classList.remove("done");
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
      publishLight(1);
      finish();
      return;
    }

    // Measure and commit the hidden initial state, force a reflow, then attach
    // the animation so the browser cannot skip the starting state
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

    // Mirrors the reference component's onAnimationComplete: reveal the clock
    // and signature when the last path finishes drawing
    completeTimer = window.setTimeout(finish, totalTime() * 1000 + 80);

    // The wordmark's glow ramps up as it writes itself
    window.clearInterval(lightTimer);
    var lightTotal = totalTime() * 1000;
    var lightStart = performance.now();
    publishLight(0.18);
    lightTimer = window.setInterval(function () {
      var p = Math.min(1, (performance.now() - lightStart) / lightTotal);
      publishLight(0.18 + 0.82 * p);
      if (p >= 1) window.clearInterval(lightTimer);
    }, 80);
  }

  function finish() {
    document.body.classList.add("done");
  }

  // Replay is keyboard-only (R): a click-anywhere replay kept interrupting
  // the calm of the page, especially accidental taps on mobile
  document.addEventListener("keydown", function (e) {
    if (e.key === "r" || e.key === "R") {
      render();
    }
  });

  // ---------- Fullscreen control (OriginButton-style fill) ----------

  // Diameter that guarantees the circle covers the button from any origin:
  // twice the farthest corner distance (ported from the reference component).
  // Callers measure the button rect themselves and pass it in — a pointer
  // event already needs one measurement, so setFillOrigin must not read again
  function coverDiameter(width, height, x, y) {
    return Math.ceil(
      2 *
        Math.max(
          Math.hypot(x, y),
          Math.hypot(width - x, y),
          Math.hypot(x, height - y),
          Math.hypot(width - x, height - y)
        )
    );
  }

  function setFillOrigin(rect, x, y) {
    var size = coverDiameter(rect.width, rect.height, x, y);
    fsBtn.style.setProperty("--ox", x + "px");
    fsBtn.style.setProperty("--oy", y + "px");
    fsBtn.style.setProperty("--size", size + "px");
  }

  function setFillOriginFromPointer(e) {
    var rect = fsBtn.getBoundingClientRect();
    setFillOrigin(rect, e.clientX - rect.left, e.clientY - rect.top);
  }

  function setFillOriginFromCenter() {
    var rect = fsBtn.getBoundingClientRect();
    setFillOrigin(rect, rect.width / 2, rect.height / 2);
  }

  if (fsBtn) {
    fsBtn.addEventListener("pointerenter", function (e) {
      setFillOriginFromPointer(e);
      fsBtn.classList.add("is-filling");
    });
    fsBtn.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      setFillOriginFromPointer(e);
      fsBtn.classList.add("is-filling");
    });
    fsBtn.addEventListener("pointerleave", function () {
      fsBtn.classList.remove("is-filling");
    });
    fsBtn.addEventListener("focus", function () {
      if (fsBtn.matches(":focus-visible")) {
        setFillOriginFromCenter();
        fsBtn.classList.add("is-filling");
      }
    });
    fsBtn.addEventListener("blur", function () {
      fsBtn.classList.remove("is-filling");
    });
    fsBtn.addEventListener("click", function () {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        // Rejects in embedded views without the fullscreen permission —
        // swallow it so the demo keeps working either way
        var p = document.documentElement.requestFullscreen();
        if (p && p.catch) p.catch(function () {});
      }
    });
    document.addEventListener("fullscreenchange", function () {
      fsLabel.textContent = document.fullscreenElement ? "Exit Fullscreen" : "Fullscreen";
    });
  }

  // The wordmark size depends on vw units — drop the cached rect and re-publish
  window.addEventListener("resize", function () {
    lightRect = null;
    publishLight(lightIntensity);
  });

  // Live clock: re-arms itself on each second boundary so it never drifts
  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function renderClock() {
    var now = new Date();
    clockTime.textContent =
      pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds());
    clockDate.textContent =
      DAYS[now.getDay()] + " · " + now.getFullYear() + "-" +
      pad(now.getMonth() + 1) + "-" + pad(now.getDate());
    window.setTimeout(renderClock, 1000 - now.getMilliseconds());
  }

  renderClock();

  render();
})();
