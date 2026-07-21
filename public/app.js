(function () {
  "use strict";

  // ---------- two-layer canvas: paint below, line art above ----------
  var board = document.getElementById("board");
  var ctx = board.getContext("2d");
  var lines = document.getElementById("lines");
  var lctx = lines.getContext("2d");
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
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
        W = nw; H = nh;
        board.width = W; board.height = H;
        lines.width = W; lines.height = H;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, W, H);
        // Scale the paint to the new size so it stays aligned with the
        // vector line art, which re-renders at the new scale.
        ctx.drawImage(old, 0, 0, old.width, old.height, 0, 0, W, H);
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

  // contain-fit the page card inside the visible workspace
  function fitLayout() {
    if (!workspace) return;
    var aw = workspace.clientWidth, ah = workspace.clientHeight;
    if (aw < 50 || ah < 50) return;
    var w = aw, h = ah;
    if (pageImg) {
      var s = Math.min(aw / pageImg.width, ah / pageImg.height);
      w = Math.max(50, Math.round(pageImg.width * s));
      h = Math.max(50, Math.round(pageImg.height * s));
    }
    wrapEl.style.width = w + "px";
    wrapEl.style.height = h + "px";
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
      pinch = { d: touchDist(), mid: touchMid() };
      try { workspace.setPointerCapture(e.pointerId); } catch (err) { }
    }
  }, true);
  workspace.addEventListener("pointermove", function (e) {
    if (e.pointerType !== "touch" || !touchPts.has(e.pointerId)) return;
    touchPts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && touchPts.size >= 2) {
      var d = touchDist(), mid = touchMid();
      if (pinch.d > 0) setZoom(zoomF * (d / pinch.d), mid[0], mid[1]);
      panX += mid[0] - pinch.mid[0];
      panY += mid[1] - pinch.mid[1];
      clampPan(); applyView();
      pinch.d = d; pinch.mid = mid;
    }
  }, true);
  function touchEnd(e) {
    if (e.pointerType !== "touch") return;
    touchPts.delete(e.pointerId);
    if (pinch && touchPts.size < 2) pinch = null;
    if (touchPts.size === 0) gestureLock = false;
  }
  workspace.addEventListener("pointerup", touchEnd, true);
  workspace.addEventListener("pointercancel", touchEnd, true);

  // ---------- state ----------
  var tool = "pencil", size = 10, color = "#ec4899", shade = "#ec4899";
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
    { slug: "panpan", name: "Panpan", species: "panda", src: "coloring-pages/snow/panpan-panda.png", thumb: "coloring-pages/snow/previews/panpan-panda-color.png" },
    { slug: "pen", name: "Pen", species: "penguin", src: "coloring-pages/snow/pen-penguin.png", thumb: "coloring-pages/snow/previews/pen-penguin-color.png" }
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
  function setHint(t) { hint.textContent = t; }

  function toast(msg) {
    var t = document.getElementById("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.hidden = true; }, 2200);
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
  // tapping the big color button pops the palette open over the canvas
  var colorPop = document.getElementById("colorPop");
  function openColorPop(open) {
    if (!colorPop) return;
    colorPop.classList.toggle("open", open);
    if (ccBtn) ccBtn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  if (ccBtn) ccBtn.addEventListener("click", function () {
    openColorPop(!(colorPop && colorPop.classList.contains("open")));
  });
  document.addEventListener("pointerdown", function (e) {
    if (!colorPop || !colorPop.classList.contains("open")) return;
    if (colorPop.contains(e.target) || (ccBtn && ccBtn.contains(e.target))) return;
    openColorPop(false);
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") openColorPop(false); });
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
    color = hex; shade = hex;
    highlightColor(hex);
    updatePreview();   // syncs the current-colour swatch + size preview
  }
  quickBtns.forEach(function (b) {
    b.addEventListener("click", function () { setColorHex(b.getAttribute("data-color")); openColorPop(false); });
  });
  setColorHex(color);

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
  var SAVE_PREFIX = "mochi-progress-";
  var currentSlug = "blank";
  var saveT = null;
  function scheduleSave() {
    clearTimeout(saveT);
    saveT = setTimeout(function () {
      try { localStorage.setItem(SAVE_PREFIX + currentSlug, board.toDataURL("image/png")); } catch (e) { }
    }, 600);
  }
  function restoreProgress() {
    var data = null;
    try { data = localStorage.getItem(SAVE_PREFIX + currentSlug); } catch (e) { }
    if (!data) return;
    var img = new Image();
    img.onload = function () {
      ctx.drawImage(img, 0, 0, W, H);
      boardDirty = true;   // restored paint has no in-session history, but the
      updateHistoryButtons();   // undo button can still reset to a fresh page
    };
    img.src = data;
  }

  function drawPage() {
    lctx.clearRect(0, 0, W, H);
    maskCanvas = null; maskBits = null;   // region masks depend on lineData
    if (!pageFn && !pageImg) { lineData = null; return; }
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
    // Punch out the white construction fills so only the outlines remain —
    // paint on the board layer below must show through the page interior.
    var img = lctx.getImageData(0, 0, W, H), d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 0 && d[i] > 244 && d[i + 1] > 244 && d[i + 2] > 244) d[i + 3] = 0;
    }
    lctx.putImageData(img, 0, 0);
    lineData = d;
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
      if (undoStack.length > 15) undoStack.shift();
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
      clearArmT = setTimeout(disarmClear, 2600);
      return;
    }
    disarmClear();
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
  document.getElementById("saveBtn").addEventListener("click", function () {
    var a = document.createElement("a");
    a.download = "kawaii-drawing.png";
    a.href = compositeCanvas().toDataURL("image/png");
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast("Saved as kawaii-drawing.png 💾");
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
  function buildRegionMask(x, y) {
    var seen = new Uint8Array(W * H), stack = [x, y];
    var img = ctx.createImageData(W, H), od = img.data;
    while (stack.length) {
      var py = stack.pop(), px = stack.pop();
      if (px < 0 || py < 0 || px >= W || py >= H) continue;
      var idx = py * W + px;
      if (seen[idx]) continue;
      if (lineData[idx * 4 + 3] > 60) continue;
      seen[idx] = 1;
      od[idx * 4 + 3] = 255;
      stack.push(px + 1, py, px - 1, py, px, py + 1, px, py - 1);
    }
    var c = document.createElement("canvas");
    c.width = W; c.height = H;
    c.getContext("2d").putImageData(img, 0, 0);
    maskBits = seen;
    return c;
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
  // Boundary-aware flood fill on the PAINT layer only. Outline pixels on the
  // separate line-art layer (lineData, sampled once per page) act as walls, so
  // paint can never cross or cover a protected outline. Returns how much was
  // filled and whether the region reached the canvas edge (i.e. was not
  // enclosed). A hard pixel cap keeps a runaway/leaked fill from freezing.
  function floodFill(x, y) {
    x = Math.max(0, Math.min(W - 1, Math.round(x)));
    y = Math.max(0, Math.min(H - 1, Math.round(y)));
    if (lineData && lineData[(y * W + x) * 4 + 3] > 60) return { filled: 0, border: false, onLine: true };
    var img = ctx.getImageData(0, 0, W, H), d = img.data;
    var i0 = (y * W + x) * 4, tr = d[i0], tg = d[i0 + 1], tb = d[i0 + 2];
    var f = hexRgb(shade);
    if (Math.abs(tr - f[0]) + Math.abs(tg - f[1]) + Math.abs(tb - f[2]) < 12) return { filled: 0, border: false, onLine: false };
    var seen = new Uint8Array(W * H), stack = [x, y];
    var filled = 0, border = false, MAX = W * H;   // seen[] already bounds work to O(W*H)
    while (stack.length) {
      var py = stack.pop(), px = stack.pop();
      if (px < 0 || py < 0 || px >= W || py >= H) continue;
      var idx = py * W + px;
      if (seen[idx]) continue;
      var j = idx * 4;
      if (lineData && lineData[j + 3] > 60) continue;
      if (Math.abs(d[j] - tr) + Math.abs(d[j + 1] - tg) + Math.abs(d[j + 2] - tb) > 110) continue;
      seen[idx] = 1;
      d[j] = f[0]; d[j + 1] = f[1]; d[j + 2] = f[2]; d[j + 3] = 255;
      filled++;
      if (px === 0 || py === 0 || px === W - 1 || py === H - 1) border = true;
      if (filled > MAX) break;
      stack.push(px + 1, py, px - 1, py, px, py + 1, px, py - 1);
    }
    ctx.putImageData(img, 0, 0);
    return { filled: filled, border: border, onLine: false };
  }

  // Bucket click handler: shows feedback, yields a frame so the UI can paint the
  // busy state (never a frozen tap), runs the fill, then records ONE undo step
  // (only when something actually changed) and autosaves.
  var filling = false;
  function doFill(x, y) {
    if (!ready || filling) return;
    filling = true;
    var pre = null;
    try { pre = ctx.getImageData(0, 0, W, H); } catch (e) { pre = null; }
    wrap.classList.add("busy");
    setHint("Filling…");
    // two rAFs guarantee the busy cursor/hint is painted before the sync fill
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      var res = floodFill(x, y);
      wrap.classList.remove("busy");
      filling = false;
      if (res && res.filled > 0) {
        boardDirty = true;
        if (pre) {
          undoStack.push(pre);
          if (undoStack.length > 15) undoStack.shift();
          redoStack = [];
        }
        updateHistoryButtons();
        scheduleSave();
        setHint(res.border
          ? "Filled! 🪣 (that area was open at the edges — close the gaps to fill just one spot)"
          : "Filled! 🪣");
      } else if (res && res.onLine) {
        setHint("That's an outline — tap inside an area to fill it 🪣");
      } else {
        setHint("Tap inside an area to fill it with color 🪣");
      }
    }); });
  }

  // Never start a stroke while a two-finger zoom/pan gesture is active (the
  // workspace's capture-phase pinch handlers run before this one).
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
    drawing = true;
    pts = [p];
    if (tool === "crayon") paintThrough(function (g) { crayonSeg(p, p, g); });
    else if (tool === "spray") paintThrough(function (g) { sprayAt(p[0], p[1], g); });
    else if (tool === "marker") { snap = ctx.getImageData(0, 0, W, H); markerPath(); }
    else paintThrough(function (g) { seg(p, [p[0] + 0.1, p[1]], g); });
  });
  board.addEventListener("pointermove", function (e) {
    updateRing(e);
    if (!drawing) return;
    var p = pos(e), last = pts[pts.length - 1];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 1.5 * dpr) return;
    pts.push(p);
    if (tool === "crayon") paintThrough(function (g) { crayonSeg(last, p, g); });
    else if (tool === "spray") paintThrough(function (g) { sprayAt(p[0], p[1], g); });
    else if (tool === "marker") markerPath();
    else paintThrough(function (g) { seg(last, p, g); });
  });
  // Revert a stroke in progress (second finger landed, or the pointer was
  // cancelled) so a pinch never leaves a stray dot or line behind.
  function cancelActiveStroke() {
    if (!drawing) return;
    var pre = undoStack.pop();
    if (pre) ctx.putImageData(pre, 0, 0);
    updateHistoryButtons();
    drawing = false; pts = []; snap = null;
  }
  function endStroke(e) {
    if (drawing && e && e.type === "pointercancel") { cancelActiveStroke(); scheduleSave(); return; }
    drawing = false; pts = []; snap = null; scheduleSave();
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
      img.onerror = function () { startForest = null; boot(); };   // fall back to the default pal
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
  var appEl = document.getElementById("app");

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

  // ---------- PWA: offline support (production only, keeps local dev simple) ----------
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(function () { });
  }
})();
