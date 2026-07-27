(function () {
  "use strict";

  // ---------- two-layer canvas: paint below, line art above ----------
  var board = document.getElementById("board");
  var ctx = board.getContext("2d");
  var lines = document.getElementById("lines");
  var lctx = lines.getContext("2d");
  // Full device resolution (3× on modern phones) so lines and fills render
  // crisp. The bigger backing store's memory cost is offset by the smaller
  // undo depth and the zone-mask LRU below.
  var dpr = Math.min(window.devicePixelRatio || 1, 3);
  var W = 0, H = 0, ready = false;

  function initCanvas() {
    var r = board.getBoundingClientRect();
    if (r.width < 50 || r.height < 50) { requestAnimationFrame(initCanvas); return; }
    W = Math.round(r.width * dpr);
    H = Math.round(r.height * dpr);
    board.width = W; board.height = H;
    lines.width = W; lines.height = H;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ready = true;
    drawPage();
  }

  // Where the artwork lands on a w×h canvas — the same math drawPage uses.
  // Rotation, layout changes, and progress restores all remap paint through
  // this rectangle so color stays aligned with the line art (a plain
  // full-canvas stretch would distort the paint whenever the canvas aspect
  // changes, e.g. rotating the phone).
  function artRect(w, h) {
    if (pageImg) {
      var m = Math.min(w, h) * 0.04;
      var sc = Math.min((w - 2 * m) / pageImg.width, (h - 2 * m) / pageImg.height);
      var dw = pageImg.width * sc, dh = pageImg.height * sc;
      return { x: (w - dw) / 2, y: (h - dh) / 2, w: dw, h: dh };
    }
    if (pageFn) {
      // procedural pals render centered at scale min(w,h)*0.46
      var side = Math.min(w, h) * 0.92;
      return { x: (w - side) / 2, y: (h - side) / 2, w: side, h: side };
    }
    return { x: 0, y: 0, w: w, h: h };
  }
  // Draw a snapshot (canvas or image) of oldW×oldH onto the current board,
  // uniformly scaled and positioned so its art rectangle lands centered on
  // today's. The scale uses the SMALLER of the two axis ratios: for coloring
  // pages both ratios are equal (both rects contain-fit the same image), and
  // on the blank page — where the "art rect" is the whole canvas and the two
  // aspects can differ after a rotation — the min keeps every painted pixel
  // on the canvas instead of cropping the bottom half away.
  function remapPaint(src, oldW, oldH) {
    // Blank page: no artwork to anchor to, so stretch edge-to-edge. The
    // momentary aspect distortion reverses exactly on the next rotation —
    // a uniform contain-fit here would instead SHRINK the doodle a little
    // more on every rotation, which never comes back.
    if (!pageImg && !pageFn) {
      ctx.drawImage(src, 0, 0, oldW, oldH, 0, 0, W, H);
      return;
    }
    var a = artRect(oldW, oldH), b = artRect(W, H);
    if (a.w <= 0 || a.h <= 0) return;
    var s = Math.min(b.w / a.w, b.h / a.h);
    var tx = b.x + b.w / 2 - (a.x + a.w / 2) * s;
    var ty = b.y + b.h / 2 - (a.y + a.h / 2) * s;
    ctx.drawImage(src, 0, 0, oldW, oldH, tx, ty, oldW * s, oldH * s);
  }

  if (window.ResizeObserver) {
    new ResizeObserver(function () {
      if (!ready) return;
      var r = board.getBoundingClientRect();
      var nw = Math.round(r.width * dpr), nh = Math.round(r.height * dpr);
      if (nw < 50 || nh < 50) return;
      if (Math.abs(nw - W) > 4 || Math.abs(nh - H) > 4) {
        var old = document.createElement("canvas");
        old.width = W; old.height = H;
        old.getContext("2d").drawImage(board, 0, 0);
        var oldW = W, oldH = H;
        W = nw; H = nh;
        board.width = W; board.height = H;
        lines.width = W; lines.height = H;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, W, H);
        remapPaint(old, oldW, oldH);
        drawPage();
      }
    }).observe(board);
  }

  // ---------- fit-to-screen workspace + zoom / pan ----------
  // The white page card (#canvasWrap) is sized to the coloring page's
  // contain-fit inside the visible workspace, so the artwork fills the screen
  // with no tall blank canvas. Zoom/pan apply a CSS transform to the card;
  // pointer coordinates stay accurate because pos() reads the transformed
  // getBoundingClientRect(). Manual zoom survives viewport changes; only the
  // fit button (or a new page) resets it.
  var appEl = document.getElementById("app");
  var workspace = document.getElementById("workspace");
  var wrapEl = document.getElementById("canvasWrap");
  var zoomF = 1, panX = 0, panY = 0, ZMIN = 0.5, ZMAX = 4;
  var zoomInBtn = document.getElementById("zoomInBtn");
  var zoomOutBtn = document.getElementById("zoomOutBtn");
  var zoomFitBtn = document.getElementById("zoomFitBtn");

  function applyView() {
    wrapEl.style.transform = "translate(" + panX + "px," + panY + "px) scale(" + zoomF + ")";
    if (zoomInBtn) zoomInBtn.disabled = zoomF >= ZMAX - 0.001;
    if (zoomOutBtn) zoomOutBtn.disabled = zoomF <= ZMIN + 0.001;
  }
  function clampPan() {
    var r = workspace.getBoundingClientRect();
    var bw = wrapEl.clientWidth * zoomF, bh = wrapEl.clientHeight * zoomF;
    var mx = Math.max(0, (bw - r.width) / 2) + 48;
    var my = Math.max(0, (bh - r.height) / 2) + 48;
    panX = Math.max(-mx, Math.min(mx, panX));
    panY = Math.max(-my, Math.min(my, panY));
  }
  // Zoom keeping the content point under (cx,cy) fixed (pointer/pinch midpoint).
  function setZoom(nz, cx, cy) {
    nz = Math.max(ZMIN, Math.min(ZMAX, nz));
    var r = workspace.getBoundingClientRect();
    var CX = r.left + r.width / 2, CY = r.top + r.height / 2;
    if (cx == null) { cx = CX; cy = CY; }
    var qx = (cx - CX - panX) / zoomF, qy = (cy - CY - panY) / zoomF;
    zoomF = nz;
    panX = cx - CX - qx * zoomF;
    panY = cy - CY - qy * zoomF;
    clampPan();
    applyView();
  }
  function resetView() { zoomF = 1; panX = 0; panY = 0; applyView(); }

  // The page card fills the whole workspace — edge-to-edge white paper with
  // the artwork centered on it (drawPage handles the centering), like the
  // best kids' coloring apps. No lavender letterboxing around a small card.
  function fitLayout() {
    if (!workspace) return;
    var aw = workspace.clientWidth, ah = workspace.clientHeight;
    if (aw < 50 || ah < 50) return;
    wrapEl.style.width = aw + "px";
    wrapEl.style.height = ah + "px";
  }
  // Refit when the viewport, rotation, or mobile browser chrome changes the
  // visible area (Visual Viewport API when available, with fallbacks).
  var fitT = null;
  function queueFit() { clearTimeout(fitT); fitT = setTimeout(fitLayout, 120); }
  if (window.visualViewport) window.visualViewport.addEventListener("resize", queueFit);
  window.addEventListener("orientationchange", queueFit);
  window.addEventListener("resize", queueFit);
  if (window.ResizeObserver) new ResizeObserver(queueFit).observe(workspace);
  // catch resizes/rotations that happened while the tab was hidden
  document.addEventListener("visibilitychange", function () { if (!document.hidden) queueFit(); });

  if (zoomInBtn) zoomInBtn.addEventListener("click", function () { setZoom(zoomF * 1.25); });
  if (zoomOutBtn) zoomOutBtn.addEventListener("click", function () { setZoom(zoomF / 1.25); });
  if (zoomFitBtn) zoomFitBtn.addEventListener("click", function () { fitLayout(); resetView(); });

  // ---------- fullscreen / focus mode ----------
  // Real fullscreen where the API exists (desktop, Android, iPadOS). iPhone
  // Safari has no element fullscreen, so the same button becomes "focus
  // mode": it fades the chrome away and stays visible as the exit.
  var fsBtn = document.getElementById("fullscreenBtn");
  var fsRoot = document.documentElement;
  var fsSupported = !!(fsRoot.requestFullscreen || fsRoot.webkitRequestFullscreen);
  function fsActive() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement) ||
      appEl.classList.contains("focus-mode");
  }
  function syncFsBtn() {
    if (!fsBtn) return;
    var on = fsActive();
    fsBtn.querySelector(".fs-enter").hidden = on;
    fsBtn.querySelector(".fs-exit").hidden = !on;
    fsBtn.setAttribute("aria-pressed", on ? "true" : "false");
    var label = fsSupported
      ? (on ? "Exit fullscreen" : "Enter fullscreen")
      : (on ? "Show the buttons again" : "Focus mode: hide the buttons");
    fsBtn.setAttribute("aria-label", label);
    fsBtn.setAttribute("title", fsSupported ? (on ? "Exit fullscreen" : "Fullscreen") : (on ? "Show buttons" : "Focus mode"));
  }
  if (fsBtn) {
    if (!fsSupported) syncFsBtn();   // relabel as focus mode up front
    fsBtn.addEventListener("click", function () {
      if (fsSupported) {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
          (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        } else {
          try {
            var p = (fsRoot.requestFullscreen || fsRoot.webkitRequestFullscreen).call(fsRoot);
            if (p && p.catch) p.catch(function () { toast("Fullscreen is not available here 🙈"); });
          } catch (e) { toast("Fullscreen is not available here 🙈"); }
        }
      } else {
        var on = !appEl.classList.contains("focus-mode");
        appEl.classList.toggle("focus-mode", on);
        if (on) toast("Buttons hidden — tap the same spot to bring them back ✨");
        syncFsBtn();
      }
    });
    document.addEventListener("fullscreenchange", syncFsBtn);
    document.addEventListener("webkitfullscreenchange", syncFsBtn);
  }

  // Desktop: ctrl/cmd+wheel (and trackpad pinch) zooms at the pointer;
  // plain wheel pans while zoomed in.
  workspace.addEventListener("wheel", function (e) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      setZoom(zoomF * Math.pow(1.0015, -e.deltaY), e.clientX, e.clientY);
    } else if (zoomF > 1.001) {
      panX -= e.deltaX; panY -= e.deltaY;
      clampPan(); applyView();
    }
  }, { passive: false });

  // Touch: two fingers pinch-zoom/pan the page; a stroke in progress when the
  // second finger lands is reverted, and drawing stays off until all fingers
  // lift so a pinch never leaves paint behind.
  var touchPts = new Map(), pinch = null, gestureLock = false;
  function touchMid() {
    var xs = 0, ys = 0, n = 0;
    touchPts.forEach(function (p) { xs += p[0]; ys += p[1]; n++; });
    return [xs / n, ys / n];
  }
  function touchDist() {
    var pts = [];
    touchPts.forEach(function (p) { pts.push(p); });
    return Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]);
  }
  workspace.addEventListener("pointerdown", function (e) {
    if (e.pointerType !== "touch") return;
    touchPts.set(e.pointerId, [e.clientX, e.clientY]);
    if (touchPts.size === 2) {
      cancelActiveStroke();
      gestureLock = true;
      pinch = { d: touchDist(), mid: touchMid(), t0: Date.now(), moved: 0 };
      try { workspace.setPointerCapture(e.pointerId); } catch (err) { }
    }
  }, true);
  workspace.addEventListener("pointermove", function (e) {
    if (e.pointerType !== "touch" || !touchPts.has(e.pointerId)) return;
    touchPts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && touchPts.size >= 2) {
      var d = touchDist(), mid = touchMid();
      pinch.moved += Math.abs(d - pinch.d) + Math.hypot(mid[0] - pinch.mid[0], mid[1] - pinch.mid[1]);
      if (pinch.d > 0) setZoom(zoomF * (d / pinch.d), mid[0], mid[1]);
      panX += mid[0] - pinch.mid[0];
      panY += mid[1] - pinch.mid[1];
      clampPan(); applyView();
      pinch.d = d; pinch.mid = mid;
    }
  }, true);
  // Two-finger double-tap (the Procreate family gesture): toggle between
  // fit-to-screen and a comfy 2.2× zoom. A "tap" is a two-finger touch that
  // ends quickly without pinching or panning, so it can never paint.
  var lastTwoTapT = 0;
  function touchEnd(e) {
    if (e.pointerType !== "touch") return;
    touchPts.delete(e.pointerId);
    if (pinch && touchPts.size < 2) {
      if (Date.now() - pinch.t0 < 250 && pinch.moved < 12) {
        if (Date.now() - lastTwoTapT < 350) {
          lastTwoTapT = 0;
          if (zoomF > 1.05) { fitLayout(); resetView(); }
          else setZoom(2.2, pinch.mid[0], pinch.mid[1]);
        } else {
          lastTwoTapT = Date.now();
        }
      }
      pinch = null;
    }
    if (touchPts.size === 0) gestureLock = false;
  }
  workspace.addEventListener("pointerup", touchEnd, true);
  workspace.addEventListener("pointercancel", touchEnd, true);

  // ---------- state ----------
  var tool = "pencil", size = 10, shade = "#ec4899";
  var lastDrawTool = "pencil";
  var pageFn = null, pageImg = null, pageName = "", lineData = null;

  // Forest Pals: finished PNG line-art coloring pages (see /coloring-pages/forest).
  // They open in this same studio like every other pal — the PNG becomes the
  // protected line-art layer, so brushes and the paint can respect its outlines.
  var FOREST_PALS = [
    { slug: "ellie", name: "Ellie", species: "elephant", src: "coloring-pages/forest/ellie-elephant.png", thumb: "coloring-pages/forest/previews/ellie-elephant-color.png" },
    { slug: "suki", name: "Suki", species: "snake", src: "coloring-pages/forest/suki-snake.png", thumb: "coloring-pages/forest/previews/suki-snake-color.png" },
    { slug: "tora", name: "Tora", species: "tiger", src: "coloring-pages/forest/tora-tiger.png", thumb: "coloring-pages/forest/previews/tora-tiger-color.png" },
    { slug: "mika", name: "Mika", species: "cat", src: "coloring-pages/forest/mika-cat.png", thumb: "coloring-pages/forest/previews/mika-cat-color.png" },
    { slug: "momo", name: "Momo", species: "monkey", src: "coloring-pages/forest/momo-monkey.png", thumb: "coloring-pages/forest/previews/momo-monkey-color.png" },
    { slug: "leo", name: "Leo", species: "lion", src: "coloring-pages/forest/leo-lion.png", thumb: "coloring-pages/forest/previews/leo-lion-color.png" }
  ];
  // Meadow Pals moved to the same finished line-art format (July 2026).
  // Their procedural draw functions still exist in pals.js for sticker
  // stamping — only the coloring PAGES are image-based now.
  var MEADOW_PALS = [
    { slug: "usagi", name: "Usagi", species: "bunny", src: "coloring-pages/meadow/usagi-bunny.png", thumb: "coloring-pages/meadow/previews/usagi-bunny-color.png" },
    { slug: "fuwa", name: "Fuwa", species: "sheep", src: "coloring-pages/meadow/fuwa-sheep.png", thumb: "coloring-pages/meadow/previews/fuwa-sheep-color.png" },
    { slug: "kero", name: "Kero", species: "frog", src: "coloring-pages/meadow/kero-frog.png", thumb: "coloring-pages/meadow/previews/kero-frog-color.png" },
    { slug: "hachi", name: "Hachi", species: "bee", src: "coloring-pages/meadow/hachi-bee.png", thumb: "coloring-pages/meadow/previews/hachi-bee-color.png" }
  ];
  // Barnyard + Snow Pals use the same image-based page format (July 2026),
  // rendered from the shared pals.js art — replace the PNGs in place to
  // upgrade the artwork without touching code.
  var BARNYARD_PALS = [
    { slug: "miruku", name: "Miruku", species: "cow", src: "coloring-pages/barnyard/miruku-cow.png", thumb: "coloring-pages/barnyard/previews/miruku-cow-color.png" },
    { slug: "kobo", name: "Kobo", species: "puppy", src: "coloring-pages/barnyard/kobo-puppy.png", thumb: "coloring-pages/barnyard/previews/kobo-puppy-color.png" },
    { slug: "piyo", name: "Piyo", species: "chick", src: "coloring-pages/barnyard/piyo-chick.png", thumb: "coloring-pages/barnyard/previews/piyo-chick-color.png" },
    { slug: "kamo", name: "Kamo", species: "duck", src: "coloring-pages/barnyard/kamo-duck.png", thumb: "coloring-pages/barnyard/previews/kamo-duck-color.png" }
  ];
  var SNOW_PALS = [
    { slug: "yuki", name: "Yuki", species: "pom pup", src: "coloring-pages/snow/yuki-pom-pup.png", thumb: "coloring-pages/snow/previews/yuki-pom-pup-color.png" },
    { slug: "kori", name: "Kori", species: "polar bear", src: "coloring-pages/snow/kori-polar-bear.png", thumb: "coloring-pages/snow/previews/kori-polar-bear-color.png" },
    { slug: "panpan", name: "Panpan", species: "panda", src: "coloring-pages/snow/panpan-panda-v2.png", thumb: "coloring-pages/snow/previews/panpan-panda-color-v2.png" },
    { slug: "pen", name: "Pen", species: "penguin", src: "coloring-pages/snow/pen-penguin-v2.png", thumb: "coloring-pages/snow/previews/pen-penguin-color-v2.png" }
  ];
  var DEN_PALS = [
    { slug: "mochi", name: "Mochi", species: "cat loaf", src: "coloring-pages/den/mochi-cat-loaf.png", thumb: "coloring-pages/den/previews/mochi-cat-loaf-color.png" },
    { slug: "kuma", name: "Kuma", species: "bear", src: "coloring-pages/den/kuma-bear.png", thumb: "coloring-pages/den/previews/kuma-bear-color.png" },
    { slug: "hamu", name: "Hamu", species: "hamster", src: "coloring-pages/den/hamu-hamster.png", thumb: "coloring-pages/den/previews/hamu-hamster-color.png" },
    { slug: "hari", name: "Hari", species: "hedgehog", src: "coloring-pages/den/hari-hedgehog.png", thumb: "coloring-pages/den/previews/hari-hedgehog-color.png" }
  ];
  var DINOSAUR_PALS = [
    { slug: "rexi", name: "Rexi", species: "t-rex", src: "coloring-pages/dinosaurs/rexi-t-rex.png", thumb: "coloring-pages/dinosaurs/previews/rexi-t-rex-color.png" },
    { slug: "trixie", name: "Trixie", species: "triceratops", src: "coloring-pages/dinosaurs/trixie-triceratops.png", thumb: "coloring-pages/dinosaurs/previews/trixie-triceratops-color.png" },
    { slug: "spike", name: "Spike", species: "stegosaurus", src: "coloring-pages/dinosaurs/spike-stegosaurus.png", thumb: "coloring-pages/dinosaurs/previews/spike-stegosaurus-color.png" },
    { slug: "ptera", name: "Ptera", species: "pterodactyl", src: "coloring-pages/dinosaurs/ptera-pterodactyl.png", thumb: "coloring-pages/dinosaurs/previews/ptera-pterodactyl-color.png" }
  ];
  var MERMAID_PALS = [
    { slug: "marina", name: "Marina", species: "mermaid", src: "coloring-pages/mermaids/marina-mermaid.png", thumb: "coloring-pages/mermaids/previews/marina-mermaid-color.png" },
    { slug: "coral", name: "Coral", species: "seahorse", src: "coloring-pages/mermaids/coral-seahorse.png", thumb: "coloring-pages/mermaids/previews/coral-seahorse-color.png" },
    { slug: "jelli", name: "Jelli", species: "jellyfish", src: "coloring-pages/mermaids/jelli-jellyfish.png", thumb: "coloring-pages/mermaids/previews/jelli-jellyfish-color.png" },
    { slug: "splash", name: "Splash", species: "dolphin", src: "coloring-pages/mermaids/splash-dolphin.png", thumb: "coloring-pages/mermaids/previews/splash-dolphin-color.png" }
  ];
  var HALLOWEEN_PALS = [
    { slug: "patch", name: "Patch", species: "pumpkin", src: "coloring-pages/halloween/patch-pumpkin.png", thumb: "coloring-pages/halloween/previews/patch-pumpkin-color.png" },
    { slug: "boo", name: "Boo", species: "ghost", src: "coloring-pages/halloween/boo-ghost.png", thumb: "coloring-pages/halloween/previews/boo-ghost-color.png" },
    { slug: "miso", name: "Miso", species: "witch cat", src: "coloring-pages/halloween/miso-witch-cat.png", thumb: "coloring-pages/halloween/previews/miso-witch-cat-color.png" },
    { slug: "nox", name: "Nox", species: "bat", src: "coloring-pages/halloween/nox-bat.png", thumb: "coloring-pages/halloween/previews/nox-bat-color.png" }
  ];
  var CHRISTMAS_PALS = [
    { slug: "rudy", name: "Rudy", species: "reindeer", src: "coloring-pages/christmas/rudy-reindeer.png", thumb: "coloring-pages/christmas/previews/rudy-reindeer-color.png" },
    { slug: "flurry", name: "Flurry", species: "snowman", src: "coloring-pages/christmas/flurry-snowman.png", thumb: "coloring-pages/christmas/previews/flurry-snowman-color.png" },
    { slug: "piney", name: "Piney", species: "christmas tree", src: "coloring-pages/christmas/piney-christmas-tree.png", thumb: "coloring-pages/christmas/previews/piney-christmas-tree-color.png" },
    { slug: "noel", name: "Noel", species: "santa bear", src: "coloring-pages/christmas/noel-santa-bear.png", thumb: "coloring-pages/christmas/previews/noel-santa-bear-color.png" }
  ];
  var SWEETS_PALS = [
    { slug: "icy", name: "Icy", species: "snow cone", src: "coloring-pages/sweets/icy-snow-cone.png", thumb: "coloring-pages/sweets/previews/icy-snow-cone-color.png" },
    { slug: "star", name: "Star", species: "unicorn cupcake", src: "coloring-pages/sweets/star-cupcake.png", thumb: "coloring-pages/sweets/previews/star-cupcake-color.png" },
    { slug: "dream", name: "Dream", species: "donut", src: "coloring-pages/sweets/dream-donut.png", thumb: "coloring-pages/sweets/previews/dream-donut-color.png" },
    { slug: "crumby", name: "Crumby", species: "cookie", src: "coloring-pages/sweets/crumby-cookie.png", thumb: "coloring-pages/sweets/previews/crumby-cookie-color.png" }
  ];
  var NORTHPOLE_PALS = [
    { slug: "snower", name: "Snower", species: "snowman", src: "coloring-pages/northpole/snower-snowman.png", thumb: "coloring-pages/northpole/previews/snower-snowman-color.png" },
    { slug: "sparkle", name: "Sparkle", species: "reindeer", src: "coloring-pages/northpole/sparkle-reindeer.png", thumb: "coloring-pages/northpole/previews/sparkle-reindeer-color.png" },
    { slug: "mistle", name: "Mistle", species: "elf", src: "coloring-pages/northpole/mistle-elf.png", thumb: "coloring-pages/northpole/previews/mistle-elf-color.png" },
    { slug: "popper", name: "Popper", species: "peppermint duo", src: "coloring-pages/northpole/popper-peppermint-duo.png", thumb: "coloring-pages/northpole/previews/popper-peppermint-duo-color.png" }
  ];
  var IMAGE_PALS = MEADOW_PALS.concat(FOREST_PALS, BARNYARD_PALS, SNOW_PALS, DEN_PALS, DINOSAUR_PALS, MERMAID_PALS, HALLOWEEN_PALS, CHRISTMAS_PALS, SWEETS_PALS, NORTHPOLE_PALS);
  var undoStack = [], redoStack = [], drawing = false, pts = [], snap = null;

  var hint = document.getElementById("hint");
  var HINTS = {
    pencil: "Pencil selected — draw on the canvas (it stays inside the lines!)",
    marker: "Marker selected — strokes layer softly and stay inside the lines",
    crayon: "Crayon selected — waxy strokes that stay inside the lines",
    spray: "Spray selected — hold and move to airbrush inside the lines",
    fill: "Paint can selected — tap an area to fill it (it stays inside the lines!)",
    eraser: "Eraser selected — cleans up paint but never the outlines"
  };
  // Hints announce, then get out of the way: after a few seconds the pill
  // fades so it never sits over the artwork. Any new message re-shows it.
  function setHint(t) {
    hint.textContent = t;
    hint.classList.remove("idle");
    clearTimeout(setHint._t);
    setHint._t = setTimeout(function () { hint.classList.add("idle"); }, 4500);
  }

  // iOS Safari ignores user-scalable=no, so a pinch that lands on the
  // toolbars would browser-zoom the whole studio and leave it stuck that
  // way. GestureEvents fire only for that page-level pinch (canvas pinch
  // uses pointer events), so cancelling them blocks exactly the bad case.
  document.addEventListener("gesturestart", function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener("gesturechange", function (e) { e.preventDefault(); }, { passive: false });

  function toast(msg) {
    var t = document.getElementById("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.hidden = true; }, 2200);
  }

  // Gentle haptic tick on supported devices (Android); silently absent on iOS.
  function buzz(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { }
  }

  // ---------- quiet chrome: fade the UI while actively coloring ----------
  // Compact layouts only (phones + phone landscape) — on desktop the chrome
  // never crowds the artwork, and fading under a mouse feels glitchy.
  var compactMq = window.matchMedia("(max-width: 900px), (max-height: 520px)");
  var quietT = null;
  function quietOn() {
    if (!compactMq.matches) return;
    clearTimeout(quietT);
    appEl.classList.add("ui-quiet");
  }
  function quietOff(delay) {
    clearTimeout(quietT);
    if (!delay) { appEl.classList.remove("ui-quiet"); return; }
    quietT = setTimeout(function () { appEl.classList.remove("ui-quiet"); }, delay);
  }

  // ---------- colors: the rail palette is the single color control ----------
  function hexRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }

  var sizeIn = document.getElementById("size"), previewDot = document.getElementById("previewDot");
  var ccDot = document.getElementById("ccDot"), ccBtn = document.getElementById("currentColor");
  var quickWrap = document.getElementById("quickColors");
  var quickBtns = quickWrap ? [].slice.call(quickWrap.querySelectorAll(".qsw")) : [];
  function syncCurrentColor() {
    if (ccDot) ccDot.style.background = shade;
  }
  // tapping the big color button pops the palette open over the canvas;
  // a full-screen backdrop catches outside taps so they close the palette
  // instead of falling through and painting the canvas
  var colorPop = document.getElementById("colorPop");
  var popBackdrop = document.getElementById("popBackdrop");
  function openColorPop(open) {
    if (!colorPop) return;
    var wasOpen = colorPop.classList.contains("open");
    colorPop.classList.toggle("open", open);
    if (popBackdrop) popBackdrop.hidden = !open;
    if (ccBtn) ccBtn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      var sel = colorPop.querySelector('.qsw[aria-pressed="true"]') || colorPop.querySelector(".qsw");
      if (sel) sel.focus({ preventScroll: true });
    } else if (wasOpen && ccBtn) {
      ccBtn.focus({ preventScroll: true });
    }
  }
  if (ccBtn) ccBtn.addEventListener("click", function () {
    openColorPop(!(colorPop && colorPop.classList.contains("open")));
  });
  if (popBackdrop) popBackdrop.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    openColorPop(false);
    openHelp(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    openColorPop(false);
    openHelp(false);
    closeTutorial(true);
  });
  function updatePreview() {
    var d = Math.min(size, 30);
    previewDot.style.width = d + "px";
    previewDot.style.height = d + "px";
    previewDot.style.background = shade;
    syncCurrentColor();
  }
  sizeIn.addEventListener("input", function () { size = Math.round(+sizeIn.value); updatePreview(); });

  function highlightColor(hex) {
    var h = hex ? hex.toLowerCase() : null;
    quickBtns.forEach(function (b) {
      var on = h && b.getAttribute("data-color").toLowerCase() === h;
      b.classList.toggle("on", !!on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }
  function setColorHex(hex) {
    shade = hex;
    highlightColor(hex);
    updatePreview();   // syncs the current-colour swatch + size preview
  }
  quickBtns.forEach(function (b) {
    b.addEventListener("click", function () { setColorHex(b.getAttribute("data-color")); openColorPop(false); });
  });
  setColorHex(shade);

  // ---------- tools ----------
  var toolsEl = document.getElementById("tools");
  function markTool() {
    toolsEl.querySelectorAll(".tbtn[data-tool]").forEach(function (b) {
      var on = b.getAttribute("data-tool") === tool;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    if (tool !== "eraser") lastDrawTool = tool;
  }
  toolsEl.querySelectorAll(".tbtn[data-tool]").forEach(function (b) {
    b.addEventListener("click", function () {
      tool = b.getAttribute("data-tool");
      markTool();
      setHint(HINTS[tool]);
    });
  });

  // ---------- kawaii pals (shared art system) ----------
  // All character art lives in pals.js (window.MochiPals) so the home page
  // previews and these coloring pages are always the exact same drawings.
  var TAU = 7;
  var Pals = window.MochiPals;
  var STAMPS = Pals.PALS.map(function (p) { return [p.name, p.species, p.draw, p.group]; });

  function withChar(c, x, y, s, fn, asLines) {
    Pals.render(c, x, y, s, fn, asLines);
  }

  // ---------- coloring pages ----------
  // ---------- progress autosave: each pal's paint survives app restarts ----------
  // Saves live on-device only — no accounts, no network. IndexedDB holds the
  // image Blobs (roomy quota, so every pal's page can persist); localStorage
  // remains both the fallback for browsers that block IndexedDB (e.g. some
  // private modes) and the migration source for saves written by older
  // versions of the app.
  var SAVE_PREFIX = "mochi-progress-";
  var currentSlug = "blank";
  var saveT = null;
  var saveDb = null;
  function openSaveDb() {
    if (saveDb) return Promise.resolve(saveDb);
    return new Promise(function (resolve) {
      if (!window.indexedDB) return resolve(null);
      var req;
      try { req = indexedDB.open("mochi-paint", 1); } catch (e) { return resolve(null); }
      req.onupgradeneeded = function () { req.result.createObjectStore("progress"); };
      req.onsuccess = function () { saveDb = req.result; resolve(saveDb); };
      req.onerror = req.onblocked = function () { resolve(null); };
    });
  }
  function saveDbPut(slug, blob) {
    return openSaveDb().then(function (db) {
      if (!db) return false;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction("progress", "readwrite");
          tx.objectStore("progress").put(blob, slug);
          tx.oncomplete = function () { resolve(true); };
          tx.onabort = tx.onerror = function () { resolve(false); };
        } catch (e) { resolve(false); }
      });
    });
  }
  function saveDbGet(slug) {
    return openSaveDb().then(function (db) {
      if (!db) return null;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction("progress", "readonly");
          var rq = tx.objectStore("progress").get(slug);
          rq.onsuccess = function () { resolve(rq.result || null); };
          rq.onerror = function () { resolve(null); };
        } catch (e) { resolve(null); }
      });
    });
  }
  function scheduleSave() {
    clearTimeout(saveT);
    saveT = setTimeout(function () {
      var slug = currentSlug;
      board.toBlob(function (blob) {
        if (!blob) return;
        saveDbPut(slug, blob).then(function (ok) {
          if (ok) {
            // IndexedDB is now the source of truth — free the quota-hungry
            // dataURL copy an older version may have left behind.
            try { localStorage.removeItem(SAVE_PREFIX + slug); } catch (e) { }
          } else {
            try { localStorage.setItem(SAVE_PREFIX + slug, board.toDataURL("image/png")); } catch (e) { }
          }
        });
      }, "image/png");
    }, 600);
  }
  function restoreProgress() {
    var slug = currentSlug;
    saveDbGet(slug).then(function (blob) {
      var url = null, data = null;
      if (blob) {
        url = URL.createObjectURL(blob);
      } else {
        try { data = localStorage.getItem(SAVE_PREFIX + slug); } catch (e) { }
        if (!data) return;
      }
      var img = new Image();
      img.onload = function () {
        if (url) URL.revokeObjectURL(url);
        // The canvas is sized lazily (initCanvas defers until it has real
        // layout), so the restore may finish first — wait for it rather
        // than drawing into a 0×0 board and silently losing the save.
        var attempt = function (tries) {
          if (slug !== currentSlug) return;   // switched pages while loading
          if (!ready || !W) {
            if (tries > 0) setTimeout(function () { attempt(tries - 1); }, 120);
            return;
          }
          if (boardDirty) return;   // fresh strokes beat a late restore
          // Saves can come from a different canvas size/aspect (other
          // orientation, older layout) — remap through the art rectangle
          // so restored color lands exactly on the line art.
          remapPaint(img, img.width, img.height);
          boardDirty = true;   // restored paint has no in-session history, but the
          updateHistoryButtons();   // undo button can still reset to a fresh page
        };
        attempt(80);
      };
      img.onerror = function () { if (url) URL.revokeObjectURL(url); };
      img.src = url || data;
    });
  }

  function drawPage() {
    lctx.clearRect(0, 0, W, H);
    maskCanvas = null; maskBits = null;   // region masks depend on lineData
    if (!pageFn && !pageImg) { lineData = null; buildZones(); return; }
    if (pageImg) {
      // image-based coloring page (e.g. Forest Pals): fit centred with a margin
      var m = Math.min(W, H) * 0.04;
      var sc = Math.min((W - 2 * m) / pageImg.width, (H - 2 * m) / pageImg.height);
      var dw = pageImg.width * sc, dh = pageImg.height * sc;
      lctx.drawImage(pageImg, (W - dw) / 2, (H - dh) / 2, dw, dh);
    } else {
      var s = Math.min(W, H) * 0.46;
      withChar(lctx, W / 2, H / 2, s, pageFn, true);
    }
    // Convert the drawn page into a clean line-art overlay: white paper
    // becomes fully transparent, dark outline ink stays opaque, and the
    // anti-aliased gray fringe becomes SEMI-transparent so it blends over
    // whatever color sits below. The old binary punch-out (transparent only
    // when every channel was ≥236) left every AA gray and near-white noise
    // pixel opaque on this TOP layer — that was the white/gray grain and the
    // halos around outlines whenever color was filled underneath.
    var img = lctx.getImageData(0, 0, W, H), d = img.data;
    var LUM_PAPER = 242, LUM_INK = 130, LUM_SPAN = LUM_PAPER - LUM_INK;
    for (var i = 0; i < d.length; i += 4) {
      var a = d[i + 3];
      if (!a) continue;
      var lum = (d[i] * 77 + d[i + 1] * 151 + d[i + 2] * 28) >> 8;
      var ink = lum >= LUM_PAPER ? 0
        : lum <= LUM_INK ? 255
        : ((LUM_PAPER - lum) * 255 / LUM_SPAN) | 0;
      d[i + 3] = a === 255 ? ink : (ink * a / 255) | 0;
    }
    lctx.putImageData(img, 0, 0);
    lineData = d;
    buildZones();   // region labels + authored zone grouping, cached per layout
  }
  // The page to color is picked on the home screen and arrives via the
  // /?pal=<slug> deep link — boot() below loads it (image-based pals from
  // their PNG, procedural pals from pals.js, "blank" for free drawing).
  var forestImgCache = {};

  // ---------- undo / redo / clear / save ----------
  var undoBtn = document.getElementById("undoBtn"), redoBtn = document.getElementById("redoBtn");
  // boardDirty tracks "there may be paint on the page" so the undo button can
  // offer one final step — back to a completely fresh page — even after the
  // recorded history runs out (e.g. many strokes, or progress restored from a
  // previous visit that has no in-session history).
  var boardDirty = false;
  function updateHistoryButtons() {
    undoBtn.disabled = undoStack.length === 0 && !boardDirty;
    redoBtn.disabled = redoStack.length === 0;
  }
  function pushUndo() {
    boardDirty = true;
    try {
      undoStack.push(ctx.getImageData(0, 0, W, H));
      // 10 deep: snapshots are full-resolution ImageData, and the dpr-3
      // backing store makes each one ~3× bigger than the old cap assumed.
      if (undoStack.length > 10) undoStack.shift();
      redoStack = [];
    } catch (e) { }
    updateHistoryButtons();
  }
  function boardIsPristine() {
    try {
      var d = ctx.getImageData(0, 0, W, H).data;
      for (var i = 0; i < d.length; i += 4) {
        if (d[i] !== 255 || d[i + 1] !== 255 || d[i + 2] !== 255) return false;
      }
      return true;
    } catch (e) { return false; }   // can't read pixels? assume there's paint so undo still resets
  }
  undoBtn.addEventListener("click", function () {
    buzz(8);
    var im = undoStack.pop();
    if (!im) {
      // Out of recorded steps: one last undo resets the page to its fresh,
      // unpainted state so kids can always walk all the way back.
      if (!boardIsPristine()) {
        try { redoStack.push(ctx.getImageData(0, 0, W, H)); } catch (e) { }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, W, H);
        boardDirty = false;
        scheduleSave();
        toast("Back to a fresh page ✨ (redo brings the paint back)");
      } else {
        boardDirty = false;
        toast("Nothing to undo");
      }
      updateHistoryButtons();
      return;
    }
    try { redoStack.push(ctx.getImageData(0, 0, W, H)); } catch (e) { }
    ctx.putImageData(im, 0, 0);
    updateHistoryButtons();
    scheduleSave();
  });
  redoBtn.addEventListener("click", function () {
    buzz(8);
    var im = redoStack.pop();
    if (!im) { toast("Nothing to redo"); updateHistoryButtons(); return; }
    try { undoStack.push(ctx.getImageData(0, 0, W, H)); } catch (e) { }
    ctx.putImageData(im, 0, 0);
    boardDirty = true;
    updateHistoryButtons();
    scheduleSave();
  });
  // Clear needs a confirmation so a stray tap never wipes a child's drawing.
  var clearBtn = document.getElementById("clearBtn");
  var clearArmed = false, clearArmT = null;
  function disarmClear() { clearArmed = false; clearBtn.classList.remove("armed"); clearTimeout(clearArmT); }
  clearBtn.addEventListener("click", function () {
    if (!clearArmed) {
      clearArmed = true;
      clearBtn.classList.add("armed");
      clearBtn.setAttribute("title", "Tap again to clear");
      toast("Tap the trash again to clear the whole page");
      buzz([10, 40, 10]);
      clearArmT = setTimeout(disarmClear, 2600);
      return;
    }
    disarmClear();
    buzz(20);
    clearBtn.setAttribute("title", "Clear canvas");
    pushUndo();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    boardDirty = false;   // page is fresh again (the snapshot above still restores it)
    updateHistoryButtons();
    scheduleSave();
    toast(pageFn ? "Paint cleared — the outlines are safe! (undo brings paint back)" : "Fresh canvas! (undo brings it back)");
  });

  function compositeCanvas() {
    var t = document.createElement("canvas");
    t.width = W; t.height = H;
    var g = t.getContext("2d");
    g.drawImage(board, 0, 0);
    g.drawImage(lines, 0, 0);
    return t;
  }
  // Export the finished artwork (paint + line art) as a local PNG download.
  // The app deliberately does not invoke the system share sheet.
  function downloadArtwork(blob) {
    var a = document.createElement("a");
    var url = URL.createObjectURL(blob);
    a.download = "mochi-paint.png";
    a.href = url;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    buzz(12);
    toast("Saved as mochi-paint.png 💾");
  }
  document.getElementById("saveBtn").addEventListener("click", function () {
    compositeCanvas().toBlob(function (blob) {
      if (!blob) { toast("Hmm, couldn't export that — try again 🙈"); return; }
      downloadArtwork(blob);
    }, "image/png");
  });

  // Print: a fresh line-art page if one is open, otherwise the current artwork
  document.getElementById("printBtn").addEventListener("click", function () {
    var t = document.createElement("canvas");
    t.width = 1400; t.height = 1800;
    var g = t.getContext("2d");
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, t.width, t.height);
    if (pageImg) {
      // fresh printable copy of the image-based line art
      var isc = Math.min(1240 / pageImg.width, 1460 / pageImg.height);
      var idw = pageImg.width * isc, idh = pageImg.height * isc;
      g.drawImage(pageImg, (t.width - idw) / 2, 110, idw, idh);
      g.fillStyle = "#5A4A42";
      g.font = "600 48px 'Poppins', sans-serif";
      g.textAlign = "center";
      g.fillText("Mochi Paint · " + pageName, 700, 1680);
    } else if (pageFn) {
      withChar(g, 700, 840, 620, pageFn, true);
      g.fillStyle = "#5A4A42";
      g.font = "600 48px 'Poppins', sans-serif";
      g.textAlign = "center";
      g.fillText("Mochi Paint · " + pageName, 700, 1680);
    } else {
      var s = Math.min(1200 / W, 1500 / H);
      var dw = W * s, dh = H * s;
      g.drawImage(board, 0, 0, W, H, (t.width - dw) / 2, 150, dw, dh);
      g.drawImage(lines, 0, 0, W, H, (t.width - dw) / 2, 150, dw, dh);
    }
    var url = t.toDataURL("image/png");
    var w = window.open("", "_blank");
    if (w) {
      w.document.write('<title>Mochi Paint coloring page</title><img src="' + url + '" style="width:100%" onload="setTimeout(function(){window.print()},200)">');
      w.document.close();
      toast("Opening the print view 🖨️");
    } else {
      var a = document.createElement("a");
      a.download = "kawaii-coloring-page.png";
      a.href = url;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast("Pop-ups blocked — downloaded the page instead 🖨️");
    }
  });

  // ---------- drawing engine (paints on the board layer only) ----------
  function pos(e) {
    var r = board.getBoundingClientRect();
    return [(e.clientX - r.left) * (board.width / r.width), (e.clientY - r.top) * (board.height / r.height)];
  }

  // ---------- stay-inside-the-lines stroke clipping ----------
  // Every brush stroke is confined to the enclosed region it STARTS in — the
  // same outline walls the paint can respects (lineData) — so coloring can
  // never run outside the lines. The blank free-draw page stays unclipped.
  // Strokes draw onto a scratch canvas, get masked to the start region, and
  // are then composited onto the board.
  var scratch = document.createElement("canvas"), sctx = scratch.getContext("2d");
  var maskCanvas = null;   // alpha mask of the region the stroke may paint in
  var maskBits = null;     // Uint8Array membership map for the cached mask
  var strokeClip = false;  // whether the active stroke is clipped to maskCanvas

  function isWallAt(x, y) {
    return lineData && lineData[(y * W + x) * 4 + 3] > 60;
  }
  // If the tap lands on an outline, look for the nearest open pixel nearby so
  // a slightly-off tap still colors the region the child meant.
  function findRegionSeed(x, y) {
    x = Math.max(0, Math.min(W - 1, Math.round(x)));
    y = Math.max(0, Math.min(H - 1, Math.round(y)));
    if (!isWallAt(x, y)) return [x, y];
    var R = Math.round(8 * dpr);
    for (var r = 1; r <= R; r++) {
      for (var a = 0; a < 16; a++) {
        var nx = Math.round(x + Math.cos(a / 16 * 6.283) * r);
        var ny = Math.round(y + Math.sin(a / 16 * 6.283) * r);
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (!isWallAt(nx, ny)) return [nx, ny];
      }
    }
    return null;
  }
  // ---------- paint zones ----------
  // A "zone" is the authored paint target of one tap: usually a single
  // enclosed region, but for image-based pages it can group DISCONNECTED
  // regions that belong together — Yuki's ear inners, cheeks, and open
  // mouth fill with the fur they sit on, a scarf split by its hanging tail
  // fills as one scarf. Groups are authored per page as points in the
  // source image's native pixels (deterministic, no runtime guessing);
  // any region not listed stays its own zone, which automatically keeps
  // eye highlights and shine marks separate. Region labels are computed
  // once per page load / resize; each zone's mask is built on first use
  // and cached.
  var ZONE_GROUPS = {
    yuki: [
      // fur: head + body + tail + ear inners + cheeks + open mouth
      [[504, 649], [480, 1200], [892, 965], [398, 456], [659, 486], [330, 723], [654, 751], [492, 767]],
      // scarf: left band + right band + hanging tail + tail fringe
      [[365, 896], [738, 871], [604, 967], [609, 1101]],
      // trees fill as one tree each
      [[107, 357], [107, 459]],
      [[926, 370], [929, 471]]
    ],
    kori: [
      // bear: head + body + ear rings/inners + cheeks + foot pads
      [[518, 467], [505, 819], [689, 276], [678, 291], [348, 278], [357, 293], [681, 552], [355, 552], [624, 815], [357, 976], [361, 1000]],
      // caught fish: body + tail + fins
      [[630, 978], [687, 1046], [721, 959], [733, 1062], [642, 1064], [686, 990]],
      // ice fishing hole
      [[586, 1135], [740, 1145], [648, 1183]],
      // ice floe: top + carved side facets
      [[522, 1089], [48, 997], [1001, 1110], [53, 1158], [108, 1183], [190, 1222], [288, 1285], [399, 1319], [522, 1338], [680, 1333], [813, 1294], [886, 1269], [947, 1209]]
    ],
    panpan: [
      // panda: body/face + ear rings/inners + cheeks + nose + mouth + feet
      // (ring points sit on the annulus band at the top of each ear — the
      // earlier coordinates landed inside the inner discs, so the rings
      // stayed white after a one-tap panda fill)
      [[509, 779], [325, 290], [329, 375], [720, 292], [715, 375], [306, 656], [736, 653], [520, 644], [519, 699], [309, 1100], [724, 1100]],
      // bamboo stick in paw
      [[577, 953], [479, 1044], [520, 1006], [437, 1081], [654, 876], [631, 901]]
    ],
    pen: [
      // penguin: body + wings + cheeks + patch between feet
      [[474, 597], [162, 786], [781, 788], [299, 655], [657, 656], [471, 1051]],
      // beak + feet (the orange bits)
      [[476, 657], [477, 660], [367, 1070], [577, 1071]],
      // ice floe: top + side facets
      [[518, 1134], [78, 1173], [929, 1265], [484, 1333]],
      // fish friend: body + tail + fins
      [[754, 1080], [856, 1094], [804, 1135], [838, 1027]],
      // snowflakes fill as one flake each
      [[183, 176], [202, 134], [158, 135], [226, 174], [137, 178], [206, 218], [162, 220]],
      [[849, 174], [873, 137], [804, 177], [895, 177], [827, 219], [873, 219]]
    ]
  };
  var zoneLabels = null;   // Int32Array: component id + 1 per open pixel, 0 = ink
  var zoneIds = null;      // zoneIds[label] -> resolved zone id after grouping
  var zoneMasks = null;    // zone id -> {bits, canvas, filled, border}
  function buildZones() {
    zoneLabels = null; zoneIds = null; zoneMasks = null;
    if (!lineData) return;
    var labels = new Int32Array(W * H);
    var sizes = [0], microSeed = [0], borderFlag = [0];
    var stack = [];
    for (var s = 0; s < W * H; s++) {
      if (labels[s] || lineData[s * 4 + 3] > 60) continue;
      var id = sizes.length, n = 0, touch = 0;
      stack.length = 0; stack.push(s); labels[s] = id;
      while (stack.length) {
        var i = stack.pop(); n++;
        var x = i % W, y = (i / W) | 0;
        if (x === 0 || y === 0 || x === W - 1 || y === H - 1) touch = 1;
        if (x > 0 && !labels[i - 1] && lineData[(i - 1) * 4 + 3] <= 60) { labels[i - 1] = id; stack.push(i - 1); }
        if (x < W - 1 && !labels[i + 1] && lineData[(i + 1) * 4 + 3] <= 60) { labels[i + 1] = id; stack.push(i + 1); }
        if (y > 0 && !labels[i - W] && lineData[(i - W) * 4 + 3] <= 60) { labels[i - W] = id; stack.push(i - W); }
        if (y < H - 1 && !labels[i + W] && lineData[(i + W) * 4 + 3] <= 60) { labels[i + W] = id; stack.push(i + W); }
      }
      sizes.push(n); microSeed.push(s); borderFlag.push(touch);
    }
    // union-find over component ids
    var parent = new Int32Array(sizes.length);
    for (var p = 0; p < parent.length; p++) parent[p] = p;
    var find = function (a) { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
    var union = function (a, b) { a = find(a); b = find(b); if (a !== b) parent[b] = a; };
    // authored groups (image-based pages; points are source-image pixels)
    var groups = pageImg && ZONE_GROUPS[currentSlug];
    if (groups) {
      var m = Math.min(W, H) * 0.04;
      var sc = Math.min((W - 2 * m) / pageImg.width, (H - 2 * m) / pageImg.height);
      var gox = (W - pageImg.width * sc) / 2, goy = (H - pageImg.height * sc) / 2;
      // Authored points must land in open paper. A tiny nudge absorbs
      // scaling jitter, but never roams far — a distant nudge could union
      // a NEIGHBORING region into the zone, which is worse than skipping.
      var labelNear = function (cx, cy) {
        cx = Math.round(cx); cy = Math.round(cy);
        for (var r = 0; r <= 3; r++) {
          for (var a = 0; a < 12; a++) {
            var nx = Math.round(cx + Math.cos(a / 12 * 6.283) * r);
            var ny = Math.round(cy + Math.sin(a / 12 * 6.283) * r);
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            var l = labels[ny * W + nx];
            if (l) return l;
          }
        }
        return 0;
      };
      for (var gi = 0; gi < groups.length; gi++) {
        var first = 0;
        for (var pi = 0; pi < groups[gi].length; pi++) {
          var gl = labelNear(gox + groups[gi][pi][0] * sc, goy + groups[gi][pi][1] * sc);
          if (!gl) continue;
          if (!first) first = gl; else union(first, gl);
        }
      }
    }
    // Antialiasing pockets: tiny open islands sealed inside the line fringe
    // read as white pinholes if left out. Melt any component of 12px or less
    // into the first real region within a few pixels through the ink.
    // (Real details like the nose shine are bigger and keep their own zone.)
    for (var mc = 1; mc < sizes.length; mc++) {
      if (sizes[mc] > 12) continue;
      var sx = microSeed[mc] % W, sy = (microSeed[mc] / W) | 0;
      var found = 0;
      for (var r = 1; r <= 6 && !found; r++) {
        for (var a = 0; a < 16 && !found; a++) {
          var nx = Math.round(sx + Math.cos(a / 16 * 6.283) * r);
          var ny = Math.round(sy + Math.sin(a / 16 * 6.283) * r);
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          var nl = labels[ny * W + nx];
          if (nl && nl !== mc && sizes[nl] > 12) { union(nl, mc); found = 1; }
        }
      }
    }
    var ids = new Int32Array(sizes.length);
    for (var z = 1; z < sizes.length; z++) ids[z] = find(z);
    zoneLabels = labels; zoneIds = ids; zoneMasks = {};
    // border flags roll up to the zone root so leak feedback stays accurate
    var zb = {};
    for (var zb1 = 1; zb1 < sizes.length; zb1++) if (borderFlag[zb1]) zb[ids[zb1]] = 1;
    zoneMasks.borderZones = zb;
  }
  // Build (and cache) the full mask for one zone: every member region, plus
  // a few pixels of bleed INTO the outline ink only, so antialiasing can't
  // expose white seams. The bleed never crosses into another open region.
  function zoneMask(zid) {
    var lru = zoneMasks._lru || (zoneMasks._lru = []);
    var key = "z" + zid;
    var cached = zoneMasks[key];
    if (cached) {
      var at = lru.indexOf(key);
      if (at >= 0) lru.splice(at, 1);
      lru.push(key);
      return cached;
    }
    var bits = new Uint8Array(W * H);
    var filled = 0;
    for (var i = 0; i < W * H; i++) {
      var l = zoneLabels[i];
      if (l && zoneIds[l] === zid) { bits[i] = 1; filled++; }
    }
    var R = Math.max(2, Math.round(W / 400));
    // First bleed ring needs one full scan; later rings grow only from the
    // previous ring's pixels — the thin frontier — instead of rescanning the
    // whole canvas each pass. Cuts the cold cost of a first tap on a zone
    // roughly in half at dpr-3 resolutions.
    var frontier = [];
    for (var yy = 0; yy < H; yy++) {
      var row = yy * W;
      for (var xx = 0; xx < W; xx++) {
        var j = row + xx;
        if (bits[j] || lineData[j * 4 + 3] <= 60) continue;   // bleed into ink only
        if ((xx > 0 && bits[j - 1]) || (xx < W - 1 && bits[j + 1]) ||
            (yy > 0 && bits[j - W]) || (yy < H - 1 && bits[j + W])) frontier.push(j);
      }
    }
    for (var f = 0; f < frontier.length; f++) bits[frontier[f]] = 1;
    for (var pass = 1; pass < R && frontier.length; pass++) {
      var next = [];
      for (var q = 0; q < frontier.length; q++) {
        var j2 = frontier[q], xx2 = j2 % W, yy2 = (j2 / W) | 0, n;
        if (xx2 > 0) { n = j2 - 1; if (!bits[n] && lineData[n * 4 + 3] > 60) { bits[n] = 1; next.push(n); } }
        if (xx2 < W - 1) { n = j2 + 1; if (!bits[n] && lineData[n * 4 + 3] > 60) { bits[n] = 1; next.push(n); } }
        if (yy2 > 0) { n = j2 - W; if (!bits[n] && lineData[n * 4 + 3] > 60) { bits[n] = 1; next.push(n); } }
        if (yy2 < H - 1) { n = j2 + W; if (!bits[n] && lineData[n * 4 + 3] > 60) { bits[n] = 1; next.push(n); } }
      }
      frontier = next;
    }
    var img = ctx.createImageData(W, H), od = img.data;
    for (var b = 0; b < bits.length; b++) if (bits[b]) od[b * 4 + 3] = 255;
    var c = document.createElement("canvas");
    c.width = W; c.height = H;
    c.getContext("2d").putImageData(img, 0, 0);
    var mask = { bits: bits, canvas: c, filled: filled, border: !!zoneMasks.borderZones[zid] };
    zoneMasks[key] = mask;
    // Each cached mask holds a full-canvas bitmap + canvas (~15MB at dpr 3
    // on a phone), so keep only the few most recently used zones.
    lru.push(key);
    if (lru.length > 4) delete zoneMasks[lru.shift()];
    return mask;
  }
  function zoneAt(x, y) {
    if (!zoneLabels) return 0;
    var l = zoneLabels[y * W + x];
    return l ? zoneIds[l] : 0;
  }
  function buildRegionMask(x, y) {
    var mask = zoneMask(zoneAt(x, y));
    maskBits = mask.bits;
    return mask.canvas;
  }
  // Prepare clipping for a stroke starting at p. Returns false only when the
  // stroke starts squarely on an outline (nothing sensible to clip to).
  function beginStrokeClip(p) {
    strokeClip = false;
    if (!lineData) return true;   // blank page: free drawing, no clipping
    var seed = findRegionSeed(p[0], p[1]);
    if (!seed) return false;
    var idx = seed[1] * W + seed[0];
    if (!(maskCanvas && maskBits && maskBits[idx])) {
      maskCanvas = buildRegionMask(seed[0], seed[1]);   // also refreshes maskBits
    }
    strokeClip = true;
    return true;
  }
  // Draw one brush step: drawFn paints onto a context; the result is clipped
  // to the start region (when clipping is on) and composited onto the board.
  function paintThrough(drawFn, alpha) {
    if (scratch.width !== W || scratch.height !== H) { scratch.width = W; scratch.height = H; }
    sctx.clearRect(0, 0, W, H);
    drawFn(sctx);
    if (strokeClip && maskCanvas) {
      sctx.globalCompositeOperation = "destination-in";
      sctx.drawImage(maskCanvas, 0, 0);
      sctx.globalCompositeOperation = "source-over";
    }
    ctx.globalAlpha = alpha || 1;
    ctx.drawImage(scratch, 0, 0);
    ctx.globalAlpha = 1;
  }

  function seg(a, b, g) {
    g.lineCap = "round"; g.lineJoin = "round";
    g.strokeStyle = tool === "eraser" ? "#ffffff" : shade;
    g.lineWidth = (tool === "eraser" ? size * 2.6 : Math.max(1, size * 0.7)) * dpr;
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
  }
  function markerPath() {
    if (!snap) return;
    ctx.putImageData(snap, 0, 0);
    // The path is drawn opaque, then composited at marker alpha, so the whole
    // stroke keeps one even ink tone no matter how it overlaps itself.
    paintThrough(function (g) {
      g.lineCap = "round"; g.lineJoin = "round";
      g.strokeStyle = shade; g.lineWidth = size * 2 * dpr;
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      if (pts.length === 1) g.lineTo(pts[0][0] + 0.1, pts[0][1]);
      for (var i = 1; i < pts.length; i++) {
        var mx = (pts[i - 1][0] + pts[i][0]) / 2, my = (pts[i - 1][1] + pts[i][1]) / 2;
        g.quadraticCurveTo(pts[i - 1][0], pts[i - 1][1], mx, my);
      }
      g.stroke();
    }, 0.4);
  }
  function crayonSeg(a, b, g) {
    var dx = b[0] - a[0], dy = b[1] - a[1];
    var steps = Math.ceil(Math.max(1, Math.hypot(dx, dy)) / (2 * dpr));
    g.fillStyle = shade;
    for (var i = 0; i <= steps; i++) {
      var t = i / steps, x = a[0] + dx * t, y = a[1] + dy * t;
      for (var k = 0; k < 3; k++) {
        g.globalAlpha = 0.15 + Math.random() * 0.35;
        var ox = (Math.random() - 0.5) * size * dpr, oy = (Math.random() - 0.5) * size * dpr;
        g.beginPath();
        g.arc(x + ox, y + oy, (0.5 + Math.random() * 0.45) * size * 0.45 * dpr, 0, TAU);
        g.fill();
      }
    }
    g.globalAlpha = 1;
  }
  function sprayAt(x, y, g) {
    g.fillStyle = shade;
    for (var i = 0; i < 28; i++) {
      var ang = Math.random() * 6.283, rad = Math.random() * size * 1.8 * dpr;
      g.globalAlpha = 0.25 + Math.random() * 0.4;
      g.beginPath();
      g.arc(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad, (0.6 + Math.random()) * dpr, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
  }
  // Paint-can fill. On a coloring page one tap paints the whole AUTHORED
  // zone under the finger — including disconnected member regions like ear
  // inners or cheeks — with one solid opaque color in a single putImageData.
  // Walls come from the line art only (never from paint already on the
  // board), repainting replaces the zone completely, and the mask's bleed
  // under the ink means no white seams. Outlines stay crisp because the
  // line layer always draws on top.
  function floodFill(x, y) {
    x = Math.max(0, Math.min(W - 1, Math.round(x)));
    y = Math.max(0, Math.min(H - 1, Math.round(y)));
    if (lineData) {
      var seed = findRegionSeed(x, y);
      if (!seed) return { filled: 0, border: false, onLine: true };
      var zid = zoneAt(seed[0], seed[1]);
      if (!zid) return { filled: 0, border: false, onLine: true };
      var zone = zoneMask(zid);
      var img = ctx.getImageData(0, 0, W, H), d = img.data;
      var f = hexRgb(shade), mask = zone.bits;
      for (var i = 0; i < mask.length; i++) {
        if (!mask[i]) continue;
        var j = i * 4;
        d[j] = f[0]; d[j + 1] = f[1]; d[j + 2] = f[2]; d[j + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      return { filled: zone.filled, border: zone.border, onLine: false };
    }
    // Blank free-draw page: no outlines to bound a region, so fill the patch
    // of similar color under the tap (classic tolerance flood fill).
    var img2 = ctx.getImageData(0, 0, W, H), d2 = img2.data;
    var i0 = (y * W + x) * 4, tr = d2[i0], tg = d2[i0 + 1], tb = d2[i0 + 2];
    var f2 = hexRgb(shade);
    if (Math.abs(tr - f2[0]) + Math.abs(tg - f2[1]) + Math.abs(tb - f2[2]) < 12) return { filled: 0, border: false, onLine: false };
    var seen = new Uint8Array(W * H), stack = [x, y];
    var filled = 0, border = false, MAX = W * H;   // seen[] already bounds work to O(W*H)
    while (stack.length) {
      var py = stack.pop(), px = stack.pop();
      if (px < 0 || py < 0 || px >= W || py >= H) continue;
      var idx = py * W + px;
      if (seen[idx]) continue;
      var j2 = idx * 4;
      if (Math.abs(d2[j2] - tr) + Math.abs(d2[j2 + 1] - tg) + Math.abs(d2[j2 + 2] - tb) > 110) continue;
      seen[idx] = 1;
      d2[j2] = f2[0]; d2[j2 + 1] = f2[1]; d2[j2 + 2] = f2[2]; d2[j2 + 3] = 255;
      filled++;
      if (px === 0 || py === 0 || px === W - 1 || py === H - 1) border = true;
      if (filled > MAX) break;
      stack.push(px + 1, py, px - 1, py, px, py + 1, px, py - 1);
    }
    ctx.putImageData(img2, 0, 0);
    return { filled: filled, border: border, onLine: false };
  }

  // Bucket click handler: shows feedback, yields a frame so the UI can paint the
  // busy state (never a frozen tap), runs the fill, then records ONE undo step
  // (only when something actually changed) and autosaves.
  var filling = false;
  var FILL_CHEERS = ["Filled! 🪣✨", "Nice! That spot is painted 🪣", "Filled! Looking good 🎨", "Splash! Filled it in 🪣💕"];
  var fillCheerIdx = 0;
  function doFill(x, y) {
    if (!ready || filling) return;
    filling = true;
    var pre = null;
    try { pre = ctx.getImageData(0, 0, W, H); } catch (e) { pre = null; }
    wrap.classList.add("busy");
    quietOn();
    setHint("Filling…");
    // two rAFs guarantee the busy cursor/hint is painted before the sync fill
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      var res = floodFill(x, y);
      wrap.classList.remove("busy");
      filling = false;
      quietOff(600);
      if (res && res.filled > 0) {
        boardDirty = true;
        if (pre) {
          undoStack.push(pre);
          if (undoStack.length > 10) undoStack.shift();
          redoStack = [];
        }
        updateHistoryButtons();
        scheduleSave();
        buzz(12);
        // Zone fills on a coloring page are always enclosed by construction —
        // background zones legitimately reach the paper's edge, so no warning.
        // Only the blank free-draw page can truly flood to the border.
        setHint(!lineData && res.border
          ? "Filled all the way to the edge of the paper 🪣"
          : FILL_CHEERS[fillCheerIdx++ % FILL_CHEERS.length]);
      } else if (res && res.onLine) {
        setHint("That's an outline — tap inside an area to fill it 🪣");
      } else {
        setHint("Tap inside an area to fill it with color 🪣");
      }
    }); });
  }

  // Never start a stroke while a two-finger zoom/pan gesture is active (the
  // workspace's capture-phase pinch handlers run before this one).
  // One finger ALWAYS draws — never zooms. Zooming is strictly two-finger
  // (pinch, two-finger double-tap) or the buttons, so a kid tapping fast
  // can never accidentally fling the page into a zoom.
  board.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "touch" && (gestureLock || pinch)) return;
    if (!ready) { initCanvas(); if (!ready) return; }
    e.preventDefault();
    try { board.setPointerCapture(e.pointerId); } catch (err) { }
    var p = pos(e);
    if (tool === "fill") { doFill(p[0], p[1]); return; }   // manages its own undo snapshot
    if (!beginStrokeClip(p)) {
      setHint("That's an outline — start inside an area to color it ✏️");
      return;
    }
    pushUndo();
    quietOn();
    drawing = true;
    pts = [p];
    if (tool === "crayon") paintThrough(function (g) { crayonSeg(p, p, g); });
    else if (tool === "spray") paintThrough(function (g) { sprayAt(p[0], p[1], g); });
    else if (tool === "marker") { snap = ctx.getImageData(0, 0, W, H); markerPath(); }
    else paintThrough(function (g) { seg(p, [p[0] + 0.1, p[1]], g); });
  });
  // Batch pointer moves into one draw per animation frame: fast fingers fire
  // far more move events than screen frames, and the marker re-renders its
  // whole path on every update — flushing once per frame keeps coloring at
  // 60fps without changing what ends up on the page.
  var moveQ = [], moveRaf = 0;
  function flushMoves() {
    if (moveRaf) { cancelAnimationFrame(moveRaf); moveRaf = 0; }
    if (!drawing || !moveQ.length) { moveQ.length = 0; return; }
    var q = moveQ; moveQ = [];
    if (tool === "marker") {
      for (var m = 0; m < q.length; m++) pts.push(q[m]);
      markerPath();
      return;
    }
    for (var i = 0; i < q.length; i++) {
      var p = q[i], last = pts[pts.length - 1];
      pts.push(p);
      // drawFn runs synchronously inside paintThrough, so capturing the
      // loop variables here is safe.
      if (tool === "crayon") paintThrough(function (g) { crayonSeg(last, p, g); });
      else if (tool === "spray") paintThrough(function (g) { sprayAt(p[0], p[1], g); });
      else paintThrough(function (g) { seg(last, p, g); });
    }
  }
  board.addEventListener("pointermove", function (e) {
    updateRing(e);
    if (!drawing) return;
    var p = pos(e);
    var last = moveQ.length ? moveQ[moveQ.length - 1] : pts[pts.length - 1];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 1.5 * dpr) return;
    moveQ.push(p);
    if (!moveRaf) moveRaf = requestAnimationFrame(flushMoves);
  });
  // Revert a stroke in progress (second finger landed, or the pointer was
  // cancelled) so a pinch never leaves a stray dot or line behind.
  function cancelActiveStroke() {
    if (!drawing) return;
    var pre = undoStack.pop();
    if (pre) ctx.putImageData(pre, 0, 0);
    updateHistoryButtons();
    drawing = false; pts = []; snap = null; moveQ.length = 0;
    quietOff(350);
  }
  function endStroke(e) {
    if (drawing && e && e.type === "pointercancel") { cancelActiveStroke(); scheduleSave(); return; }
    flushMoves();
    drawing = false; pts = []; snap = null; scheduleSave();
    quietOff(350);
  }
  board.addEventListener("pointerup", endStroke);
  board.addEventListener("pointercancel", endStroke);

  // brush-size ring that follows the cursor (lives in the untransformed
  // workspace, so its diameter is multiplied by the current zoom)
  var ring = document.getElementById("cursorRing"), wrap = document.getElementById("canvasWrap");
  function updateRing(e) {
    if (tool === "fill" || e.pointerType === "touch") { ring.style.display = "none"; return; }
    var r = workspace.getBoundingClientRect();
    var d = tool === "eraser" ? size * 2.6 : tool === "marker" ? size * 2 : tool === "spray" ? size * 3.6 : Math.max(2, size * 0.7);
    d *= zoomF;
    ring.style.display = "block";
    ring.style.width = d + "px";
    ring.style.height = d + "px";
    ring.style.left = (e.clientX - r.left) + "px";
    ring.style.top = (e.clientY - r.top) + "px";
  }
  board.addEventListener("pointerleave", function () { ring.style.display = "none"; });

  // ---------- boot: select pencil, open the first coloring page ----------
  var splash = document.getElementById("splash");
  var splashShownAt = Date.now();
  function hideSplash() {
    if (!splash) return;
    // Keep the splash up at least briefly so it reads as a moment, not a flicker.
    var wait = Math.max(0, 1100 - (Date.now() - splashShownAt));
    setTimeout(function () { splash.classList.add("done"); }, wait);
    // First visit ever: run the little welcome tour once the splash is gone.
    setTimeout(maybeShowTutorial, wait + 600);
  }
  markTool();
  initCanvas();
  // Deep link from the home page: /?pal=usagi opens that pal's coloring page,
  // /?pal=ellie (etc.) opens an image-based page, and /?pal=blank opens a
  // blank canvas for free drawing.
  var startIdx = 0, startForest = null, startBlank = false;
  try {
    var palParam = (new URLSearchParams(location.search).get("pal") || "").toLowerCase();
    startBlank = palParam === "blank";
    STAMPS.forEach(function (st, i) {
      if (st[0].toLowerCase() === palParam) startIdx = i;
    });
    IMAGE_PALS.forEach(function (p) {
      if (p.slug === palParam) startForest = p;
    });
    // No deep link: open the image-based Usagi page.
    if (!palParam) startForest = MEADOW_PALS[0];
  } catch (err) {}
  function boot() {
    if (!ready) { requestAnimationFrame(boot); return; }
    if (startBlank) {
      pageFn = null; pageImg = null; pageName = "";
      currentSlug = "blank";
      fitLayout(); resetView();
      drawPage();
      restoreProgress();
      setHint("Blank page — free drawing time!");
      undoStack = []; redoStack = []; boardDirty = false;
      updateHistoryButtons();
      syncCurrentColor();
      hideSplash();
      return;
    }
    if (startForest) {
      var pal = startForest;
      pageName = pal.name + " the " + pal.species;
      currentSlug = pal.slug;
      var img = new Image();
      img.onload = function () {
        forestImgCache[pal.slug] = img;
        pageImg = img; pageFn = null;
        fitLayout(); resetView();
        drawPage();
        restoreProgress();
        setHint(pageName + " is ready to color! Grab the paint can to fill areas, or shade with the brushes.");
        undoStack = []; redoStack = []; boardDirty = false;
        updateHistoryButtons();
        hideSplash();
      };
      img.onerror = function () {
        var wasOffline = !navigator.onLine;
        startForest = null;
        boot();   // fall back to the built-in default pal
        if (wasOffline) setTimeout(function () {
          toast("That page has not been saved for offline use yet. Showing an offline-ready pal instead.");
        }, 0);
      };
      img.src = pal.src;
      syncCurrentColor();
      return;
    }
    pageFn = STAMPS[startIdx][2];
    pageName = STAMPS[startIdx][0] + " the " + STAMPS[startIdx][1];
    currentSlug = STAMPS[startIdx][0].toLowerCase();
    fitLayout(); resetView();
    drawPage();
    restoreProgress();
    setHint(pageName + " is ready to color! Grab the paint can to fill areas, or shade with the brushes.");
    undoStack = []; redoStack = []; boardDirty = false;
    updateHistoryButtons();
    syncCurrentColor();
    hideSplash();
  }
  boot();

  // ---------- left-handed mode ----------
  // (appEl is declared with the other element lookups near the top)

  // left-handed preference, persisted locally
  var LH_KEY = "mochi-left-handed";
  var leftHandBtn = document.getElementById("leftHandBtn");
  function applyLeftHanded(on) {
    appEl.classList.toggle("left-handed", !!on);
    if (leftHandBtn) leftHandBtn.setAttribute("aria-checked", on ? "true" : "false");
  }
  try { applyLeftHanded(localStorage.getItem(LH_KEY) === "1"); } catch (e) { }
  if (leftHandBtn) leftHandBtn.addEventListener("click", function () {
    var on = !appEl.classList.contains("left-handed");
    applyLeftHanded(on);
    try { localStorage.setItem(LH_KEY, on ? "1" : "0"); } catch (e) { }
  });

  // ---------- help dialog ----------
  var helpBtn = document.getElementById("helpBtn");
  var helpPop = document.getElementById("helpPop");
  var helpCloseBtn = document.getElementById("helpCloseBtn");
  var tutorialReplayBtn = document.getElementById("tutorialReplayBtn");
  function openHelp(open) {
    if (!helpPop) return;
    var wasOpen = !helpPop.hidden;
    if (open === wasOpen) return;
    helpPop.hidden = !open;
    helpPop.classList.toggle("open", open);
    if (popBackdrop) popBackdrop.hidden = !open;
    if (helpBtn) helpBtn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      if (helpCloseBtn) helpCloseBtn.focus({ preventScroll: true });
    } else if (helpBtn) {
      helpBtn.focus({ preventScroll: true });
    }
  }
  if (helpBtn) helpBtn.addEventListener("click", function () {
    var isOpen = helpPop && !helpPop.hidden;
    openColorPop(false);
    openHelp(!isOpen);
  });
  if (helpCloseBtn) helpCloseBtn.addEventListener("click", function () { openHelp(false); });

  // ---------- first-visit tutorial ----------
  var TUT_KEY = "mochi-tutorial-done";
  var tutorialEl = document.getElementById("tutorial");
  var tutArt = document.getElementById("tutArt");
  var tutTitle = document.getElementById("tutTitle");
  var tutBody = document.getElementById("tutBody");
  var tutDots = document.getElementById("tutDots");
  var tutSkip = document.getElementById("tutSkip");
  var tutNext = document.getElementById("tutNext");
  var TUT_STEPS = [
    { art: "🖌️", title: "Pick a tool", body: "Tap a tool to draw — pencil, marker, crayon, spray, or eraser. Your paint always stays inside the lines!" },
    { art: "🪣", title: "Tap to fill", body: "Grab the paint can, tap inside any shape, and it fills with your color — splash!" },
    { art: "🤏", title: "Zoom and move", body: "Pinch with two fingers to zoom in close, drag with two fingers to look around. Double-tap with two fingers to zoom — again to see it all." },
    { art: "💾", title: "No mistakes here", body: "Undo fixes anything, all the way back to a fresh page. Save keeps your masterpiece when it's done!" }
  ];
  var tutIdx = 0;
  function renderTut() {
    var s = TUT_STEPS[tutIdx];
    if (tutArt) tutArt.textContent = s.art;
    if (tutTitle) tutTitle.textContent = s.title;
    if (tutBody) tutBody.textContent = s.body;
    if (tutDots) [].forEach.call(tutDots.children, function (d, i) {
      d.classList.toggle("on", i === tutIdx);
    });
    if (tutNext) tutNext.textContent = tutIdx === TUT_STEPS.length - 1 ? "Let's paint! 🎨" : "Next";
  }
  function showTutorial() {
    if (!tutorialEl) return;
    if (tutDots && !tutDots.children.length) {
      TUT_STEPS.forEach(function () { tutDots.appendChild(document.createElement("i")); });
    }
    tutIdx = 0;
    renderTut();
    tutorialEl.hidden = false;
    if (tutNext) tutNext.focus({ preventScroll: true });
  }
  function closeTutorial(quiet) {
    if (!tutorialEl || tutorialEl.hidden) return;
    tutorialEl.hidden = true;
    try { localStorage.setItem(TUT_KEY, "1"); } catch (e) { }
    if (!quiet) toast("Have fun! Tap Help any time for a reminder 🍡");
  }
  function maybeShowTutorial() {
    var done = "1";
    try { done = localStorage.getItem(TUT_KEY); } catch (e) { }
    if (!done) showTutorial();
  }
  if (tutSkip) tutSkip.addEventListener("click", function () { closeTutorial(true); });
  if (tutNext) tutNext.addEventListener("click", function () {
    if (tutIdx < TUT_STEPS.length - 1) { tutIdx++; renderTut(); }
    else closeTutorial();
  });
  if (tutorialReplayBtn) tutorialReplayBtn.addEventListener("click", function () {
    openHelp(false);
    showTutorial();
  });

  // ---------- PWA: offline support (production only, keeps local dev simple) ----------
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(function () { });
  }
})();
