/**
 * Renders the path data from hello-data.js as a "draws as it reveals" wordmark.
 * Replicates motion/react behavior: pathLength 0->1 is implemented by walking
 * stroke-dashoffset from the full length to 0, with each path's duration /
 * delay / ease / opacity timing taken from the reference component.
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

    // Mirrors the reference component's onAnimationComplete: reveal the dock
    // when the last path finishes drawing
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

  // Clicking anywhere replays (the wordmark is a hollow stroke, so a listener
  // on the svg alone would miss clicks between the letters)
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
