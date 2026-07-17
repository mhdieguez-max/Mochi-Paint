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

  // ---------- state ----------
  var tool = "pencil", size = 10, color = "#F06292", shade = "#F06292";
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
  var IMAGE_PALS = MEADOW_PALS.concat(FOREST_PALS, BARNYARD_PALS, SNOW_PALS);
  var undoStack = [], redoStack = [], drawing = false, pts = [], snap = null;

  var hint = document.getElementById("hint");
  var HINTS = {
    pencil: "Pencil selected — draw on the canvas",
    marker: "Marker selected — strokes layer softly like real ink",
    crayon: "Crayon selected — waxy, textured strokes",
    spray: "Spray selected — hold and move to airbrush",
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
  // tapping the current-colour swatch scrolls the palette into view
  if (ccBtn) ccBtn.addEventListener("click", function () {
    if (quickWrap && quickWrap.scrollIntoView) quickWrap.scrollIntoView({ block: "nearest", behavior: "smooth" });
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
    color = hex; shade = hex;
    highlightColor(hex);
    updatePreview();   // syncs the current-colour swatch + size preview
  }
  quickBtns.forEach(function (b) {
    b.addEventListener("click", function () { setColorHex(b.getAttribute("data-color")); });
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
    img.onload = function () { ctx.drawImage(img, 0, 0, W, H); };
    img.src = data;
  }

  function drawPage() {
    lctx.clearRect(0, 0, W, H);
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
  function updateHistoryButtons() {
    undoBtn.disabled = undoStack.length === 0;
    redoBtn.disabled = redoStack.length === 0;
  }
  function pushUndo() {
    try {
      undoStack.push(ctx.getImageData(0, 0, W, H));
      if (undoStack.length > 15) undoStack.shift();
      redoStack = [];
    } catch (e) { }
    updateHistoryButtons();
  }
  undoBtn.addEventListener("click", function () {
    var im = undoStack.pop();
    if (!im) { toast("Nothing to undo"); updateHistoryButtons(); return; }
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
      g.font = "48px 'Baloo 2', cursive";
      g.textAlign = "center";
      g.fillText("Mochi Paint · " + pageName, 700, 1680);
    } else if (pageFn) {
      withChar(g, 700, 840, 620, pageFn, true);
      g.fillStyle = "#5A4A42";
      g.font = "48px 'Baloo 2', cursive";
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
  function seg(a, b) {
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = tool === "eraser" ? "#ffffff" : shade;
    ctx.lineWidth = (tool === "eraser" ? size * 2.6 : Math.max(1, size * 0.7)) * dpr;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  function markerPath() {
    if (!snap) return;
    ctx.putImageData(snap, 0, 0);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.globalAlpha = 0.4; ctx.strokeStyle = shade; ctx.lineWidth = size * 2 * dpr;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    if (pts.length === 1) ctx.lineTo(pts[0][0] + 0.1, pts[0][1]);
    for (var i = 1; i < pts.length; i++) {
      var mx = (pts[i - 1][0] + pts[i][0]) / 2, my = (pts[i - 1][1] + pts[i][1]) / 2;
      ctx.quadraticCurveTo(pts[i - 1][0], pts[i - 1][1], mx, my);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  function crayonSeg(a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1];
    var steps = Math.ceil(Math.max(1, Math.hypot(dx, dy)) / (2 * dpr));
    ctx.fillStyle = shade;
    for (var i = 0; i <= steps; i++) {
      var t = i / steps, x = a[0] + dx * t, y = a[1] + dy * t;
      for (var k = 0; k < 3; k++) {
        ctx.globalAlpha = 0.15 + Math.random() * 0.35;
        var ox = (Math.random() - 0.5) * size * dpr, oy = (Math.random() - 0.5) * size * dpr;
        ctx.beginPath();
        ctx.arc(x + ox, y + oy, (0.5 + Math.random() * 0.45) * size * 0.45 * dpr, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
  function sprayAt(x, y) {
    ctx.fillStyle = shade;
    for (var i = 0; i < 28; i++) {
      var ang = Math.random() * 6.283, rad = Math.random() * size * 1.8 * dpr;
      ctx.globalAlpha = 0.25 + Math.random() * 0.4;
      ctx.beginPath();
      ctx.arc(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad, (0.6 + Math.random()) * dpr, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
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
        if (pre) {
          undoStack.push(pre);
          if (undoStack.length > 15) undoStack.shift();
          redoStack = [];
          updateHistoryButtons();
        }
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

  board.addEventListener("pointerdown", function (e) {
    if (!ready) { initCanvas(); if (!ready) return; }
    e.preventDefault();
    try { board.setPointerCapture(e.pointerId); } catch (err) { }
    var p = pos(e);
    if (tool === "fill") { doFill(p[0], p[1]); return; }   // manages its own undo snapshot
    pushUndo();
    drawing = true;
    pts = [p];
    if (tool === "crayon") crayonSeg(p, p);
    else if (tool === "spray") sprayAt(p[0], p[1]);
    else if (tool === "marker") { snap = ctx.getImageData(0, 0, W, H); markerPath(); }
    else seg(p, [p[0] + 0.1, p[1]]);
  });
  board.addEventListener("pointermove", function (e) {
    updateRing(e);
    if (!drawing) return;
    var p = pos(e), last = pts[pts.length - 1];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 1.5 * dpr) return;
    pts.push(p);
    if (tool === "crayon") crayonSeg(last, p);
    else if (tool === "spray") sprayAt(p[0], p[1]);
    else if (tool === "marker") markerPath();
    else seg(last, p);
  });
  function endStroke(e) {
    // A cancelled pointer means the browser took the gesture over (usually a
    // two-finger pinch-zoom starting on the canvas) — revert the accidental
    // mark so pinching never leaves a stray dot or line behind.
    if (drawing && e && e.type === "pointercancel") {
      var pre = undoStack.pop();
      if (pre) ctx.putImageData(pre, 0, 0);
      updateHistoryButtons();
    }
    drawing = false; pts = []; snap = null; scheduleSave();
  }
  board.addEventListener("pointerup", endStroke);
  board.addEventListener("pointercancel", endStroke);

  // brush-size ring that follows the cursor
  var ring = document.getElementById("cursorRing"), wrap = document.getElementById("canvasWrap");
  function updateRing(e) {
    if (tool === "fill" || e.pointerType === "touch") { ring.style.display = "none"; return; }
    var r = wrap.getBoundingClientRect();
    var d = tool === "eraser" ? size * 2.6 : tool === "marker" ? size * 2 : tool === "spray" ? size * 3.6 : Math.max(2, size * 0.7);
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
      drawPage();
      restoreProgress();
      setHint("Blank page — free drawing time!");
      undoStack = [];
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
        drawPage();
        restoreProgress();
        setHint(pageName + " is ready to color! Grab the paint can to fill areas, or shade with the brushes.");
        undoStack = [];
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
    drawPage();
    restoreProgress();
    setHint(pageName + " is ready to color! Grab the paint can to fill areas, or shade with the brushes.");
    undoStack = [];
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
