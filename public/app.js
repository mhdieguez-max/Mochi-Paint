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
  var stampFn = null, stampLabel = "", stampBtns = [];
  var palMode = "page";
  var pageFn = null, pageName = "", lineData = null;
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

  // ---------- colors & shades ----------
  var BASES = ["#F06292", "#FF8A80", "#FFB74D", "#FFE082", "#AED581", "#4DD0B1", "#64B5F6", "#9575CD", "#F48FB1", "#A1887F", "#546E7A", "#37323E"];
  var BASE_NAMES = ["Sakura", "Coral", "Peach", "Lemon", "Matcha", "Mint", "Sky", "Lavender", "Blossom", "Cocoa", "Slate", "Ink"];

  function hexRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function rgbHex(r, g, b) {
    function p(v) { v = Math.max(0, Math.min(255, Math.round(v))); return v.toString(16).padStart(2, "0"); }
    return "#" + p(r) + p(g) + p(b);
  }
  function mixWhite(h, t) { var c = hexRgb(h); return rgbHex(c[0] + (255 - c[0]) * t, c[1] + (255 - c[1]) * t, c[2] + (255 - c[2]) * t); }
  function darken(h, t) { var c = hexRgb(h); return rgbHex(c[0] * (1 - t), c[1] * (1 - t), c[2] * (1 - t)); }
  function makeShades(h) { return [mixWhite(h, .72), mixWhite(h, .48), mixWhite(h, .24), h, darken(h, .18), darken(h, .36), darken(h, .54)]; }

  function hslHex(h, s, l) {
    s /= 100; l /= 100;
    var k = function (n) { return (n + h / 30) % 12; };
    var a = s * Math.min(l, 1 - l);
    var f = function (n) { return l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); };
    return rgbHex(255 * f(0), 255 * f(8), 255 * f(4));
  }
  function surprisePalette() {
    var start = Math.floor(Math.random() * 360), out = [];
    for (var i = 0; i < 12; i++) {
      out.push(hslHex((start + i * 30 + Math.random() * 14) % 360, 58 + Math.random() * 26, 62 + Math.random() * 15));
    }
    return out;
  }

  var pal = document.getElementById("palette");
  function renderPalette(colors, names) {
    pal.innerHTML = "";
    colors.forEach(function (h, i) {
      var b = document.createElement("button");
      b.className = "swatch";
      var nm = (names && names[i]) || "Color " + (i + 1);
      b.title = nm;
      b.setAttribute("aria-label", nm);
      b.style.background = h;
      b.addEventListener("click", function () {
        color = h;
        renderShades();
        pal.querySelectorAll(".swatch").forEach(function (s) { s.classList.remove("on"); });
        b.classList.add("on");
        highlightColor(null);
      });
      pal.appendChild(b);
    });
    var dice = document.createElement("button");
    dice.className = "swatch dice";
    dice.title = "Surprise me — random pastel palette";
    dice.setAttribute("aria-label", "Surprise palette");
    dice.textContent = "🎲";
    dice.addEventListener("click", function () {
      renderPalette(surprisePalette(), null);
      toast("Surprise palette! 🎲 (tap again for another)");
    });
    pal.appendChild(dice);
    color = colors[0];
    pal.firstChild.classList.add("on");
    renderShades();
  }

  var shadesEl = document.getElementById("shades");
  function renderShades() {
    shadesEl.innerHTML = "";
    makeShades(color).forEach(function (h, i) {
      var b = document.createElement("button");
      b.className = "shade";
      b.setAttribute("aria-label", "Shade " + (i + 1));
      b.style.background = h;
      b.addEventListener("click", function () {
        shade = h;
        shadesEl.querySelectorAll(".shade").forEach(function (s) { s.classList.remove("on"); });
        b.classList.add("on");
        highlightColor(null);
        updatePreview();
      });
      shadesEl.appendChild(b);
      if (i === 3) { shade = h; b.classList.add("on"); }
    });
    updatePreview();
  }

  var sizeIn = document.getElementById("size"), previewDot = document.getElementById("previewDot");
  var ccDot = document.getElementById("ccDot"), ccBtn = document.getElementById("currentColor");
  function syncCurrentColor() {
    if (ccDot) ccDot.style.background = shade;
    var mc = document.getElementById("miniCcDot");
    if (mc) mc.style.background = shade;
  }
  // tapping the current-colour swatch jumps to the Colors panel
  if (ccBtn) ccBtn.addEventListener("click", function () {
    var t = document.querySelector('.tab[data-panel="panelColors"]');
    if (t) t.click();
  });
  function updatePreview() {
    var d = Math.min(size, 30);
    previewDot.style.width = d + "px";
    previewDot.style.height = d + "px";
    previewDot.style.background = shade;
    syncCurrentColor();
  }
  sizeIn.addEventListener("input", function () { size = Math.round(+sizeIn.value); updatePreview(); });
  renderPalette(BASES, BASE_NAMES);

  // ---------- Phase 3/4: easy-access colour swatches (rail) + mobile favourites ----------
  var quickWrap = document.getElementById("quickColors");
  var quickBtns = quickWrap ? [].slice.call(quickWrap.querySelectorAll(".qsw")) : [];
  var miniFavBtns = [].slice.call(document.querySelectorAll("#miniFavs .mfav"));
  function clearDockColorSel() {
    pal.querySelectorAll(".swatch").forEach(function (s) { s.classList.remove("on"); });
    shadesEl.querySelectorAll(".shade").forEach(function (s) { s.classList.remove("on"); });
  }
  // reflect the active colour on both the rail swatches and the mini favourites
  function highlightColor(hex) {
    var h = hex ? hex.toLowerCase() : null;
    quickBtns.forEach(function (b) {
      var on = h && b.getAttribute("data-color").toLowerCase() === h;
      b.classList.toggle("on", !!on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    miniFavBtns.forEach(function (b) {
      var on = h && b.getAttribute("data-color").toLowerCase() === h;
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }
  function setColorHex(hex) {
    color = hex; shade = hex;
    highlightColor(hex);
    clearDockColorSel();
    updatePreview();   // syncs the current-colour swatches + size preview everywhere
  }
  quickBtns.forEach(function (b) {
    b.addEventListener("click", function () { setColorHex(b.getAttribute("data-color")); });
  });
  miniFavBtns.forEach(function (b) {
    b.addEventListener("click", function () { setColorHex(b.getAttribute("data-color")); });
  });
  var moreColorsBtn = document.getElementById("moreColors");
  if (moreColorsBtn) moreColorsBtn.addEventListener("click", function () {
    var t = document.querySelector('.tab[data-panel="panelColors"]');
    if (t) t.click();                 // reveal the full pastel palette in the dock
    var panel = document.getElementById("panelColors");
    if (panel && panel.scrollIntoView) panel.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });

  // ---------- tools ----------
  var toolsEl = document.getElementById("tools");
  function markTool() {
    toolsEl.querySelectorAll(".tbtn[data-tool]").forEach(function (b) {
      var on = b.getAttribute("data-tool") === tool;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    // mirror the active tool onto the mobile mini toolbar
    var mu = document.getElementById("miniToolUse");
    if (mu) {
      var map = { pencil: "ic-pencil", marker: "ic-marker", crayon: "ic-crayon", spray: "ic-spray", fill: "ic-fill", eraser: "ic-eraser" };
      mu.setAttribute("href", "#" + (map[tool] || "ic-pencil"));
    }
    var me = document.getElementById("miniEraser");
    if (me) me.setAttribute("aria-pressed", tool === "eraser" ? "true" : "false");
    if (tool !== "eraser" && tool !== "stamp") lastDrawTool = tool;
    if (tool !== "stamp") markPal(null);
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
  var STAMPS = Pals.PALS.map(function (p) { return [p.name, p.species, p.draw]; });

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
    if (!pageFn) { lineData = null; return; }
    var s = Math.min(W, H) * 0.46;
    withChar(lctx, W / 2, H / 2, s, pageFn, true);
    // Punch out the white construction fills so only the outlines remain —
    // paint on the board layer below must show through the page interior.
    var img = lctx.getImageData(0, 0, W, H), d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 0 && d[i] > 244 && d[i + 1] > 244 && d[i + 2] > 244) d[i + 3] = 0;
    }
    lctx.putImageData(img, 0, 0);
    lineData = d;
  }
  function loadPage(fn, name, slug) {
    pageFn = fn; pageName = name;
    currentSlug = slug || "blank";
    pushUndo();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    drawPage();
    restoreProgress();
    if (fn) {
      setHint(name + " is ready to color! Grab the paint can to fill areas, or shade with the brushes.");
      toast(name + " coloring page loaded 🎨");
    } else {
      setHint("Blank page — free drawing time!");
      toast("Fresh blank page ✨");
    }
  }

  // ---------- dock tabs ----------
  document.querySelectorAll(".tab").forEach(function (t) {
    t.addEventListener("click", function () {
      document.querySelectorAll(".tab").forEach(function (x) { x.classList.remove("on"); });
      document.querySelectorAll(".panel").forEach(function (x) { x.classList.remove("on"); });
      t.classList.add("on");
      document.getElementById(t.getAttribute("data-panel")).classList.add("on");
    });
  });

  // ---------- pal grid ----------
  var grid = document.getElementById("stampGrid");

  var blankBtn = document.createElement("button");
  blankBtn.className = "stamp";
  blankBtn.title = "Blank page";
  var blankFace = document.createElement("div");
  blankFace.textContent = "✨";
  blankFace.style.cssText = "width:72px;height:72px;display:flex;align-items:center;justify-content:center;font-size:30px;";
  var blankLabel = document.createElement("b");
  blankLabel.textContent = "Blank";
  blankBtn.appendChild(blankFace);
  blankBtn.appendChild(blankLabel);
  blankBtn.addEventListener("click", function () {
    loadPage(null, "", "blank");
    markPal(blankBtn);
  });
  grid.appendChild(blankBtn);
  stampBtns.push(blankBtn);

  STAMPS.forEach(function (st) {
    var b = document.createElement("button");
    b.className = "stamp";
    b.title = st[0] + " the " + st[1];
    var pc = document.createElement("canvas");
    var pd = Math.min(window.devicePixelRatio || 1, 2);
    pc.width = Math.round(72 * pd); pc.height = Math.round(72 * pd);
    pc.style.width = "72px"; pc.style.height = "72px";
    var g = pc.getContext("2d");
    g.setTransform(pd, 0, 0, pd, 0, 0);
    withChar(g, 36, 34, 34, st[2], false);
    var label = document.createElement("b");
    label.textContent = st[0];
    b.appendChild(pc);
    b.appendChild(label);
    b.addEventListener("click", function () {
      if (palMode === "page") {
        loadPage(st[2], st[0] + " the " + st[1], st[0].toLowerCase());
        markPal(b);
      } else {
        stampFn = st[2];
        stampLabel = st[0] + " the " + st[1];
        tool = "stamp";
        markTool();
        markPal(b);
        setHint(stampLabel + " selected — tap the canvas to stamp! The size slider makes them big or smol.");
      }
    });
    stampBtns.push(b);
    grid.appendChild(b);
  });
  function markPal(el) {
    stampBtns.forEach(function (s) { s.classList.remove("on"); });
    if (el) el.classList.add("on");
  }

  // mode chips
  var modePage = document.getElementById("modePage"), modeStamp = document.getElementById("modeStamp");
  modePage.addEventListener("click", function () {
    palMode = "page";
    modePage.classList.add("on"); modeStamp.classList.remove("on");
    blankBtn.hidden = false;
    setHint("Tap a pal to open them as a coloring page!");
  });
  modeStamp.addEventListener("click", function () {
    palMode = "stamp";
    modeStamp.classList.add("on"); modePage.classList.remove("on");
    blankBtn.hidden = true;
    setHint("Tap a pal, then tap the canvas to stamp them anywhere!");
  });

  // ---------- undo / redo / clear / save ----------
  var undoBtn = document.getElementById("undoBtn"), redoBtn = document.getElementById("redoBtn");
  function updateHistoryButtons() {
    undoBtn.disabled = undoStack.length === 0;
    redoBtn.disabled = redoStack.length === 0;
    var mu = document.getElementById("miniUndo");
    if (mu) mu.disabled = undoStack.length === 0;
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
    if (pageFn) {
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
    if (tool === "stamp" && stampFn) { withChar(ctx, p[0], p[1], size * 4 * dpr, stampFn, false); scheduleSave(); return; }
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
  function endStroke() { drawing = false; pts = []; snap = null; scheduleSave(); }
  board.addEventListener("pointerup", endStroke);
  board.addEventListener("pointercancel", endStroke);

  // brush-size ring that follows the cursor
  var ring = document.getElementById("cursorRing"), wrap = document.getElementById("canvasWrap");
  function updateRing(e) {
    if (tool === "fill" || tool === "stamp" || e.pointerType === "touch") { ring.style.display = "none"; return; }
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
  // Deep link from the home page: /?pal=usagi opens that pal's coloring page.
  var startIdx = 0;
  try {
    var palParam = (new URLSearchParams(location.search).get("pal") || "").toLowerCase();
    STAMPS.forEach(function (st, i) {
      if (st[0].toLowerCase() === palParam) startIdx = i;
    });
  } catch (err) {}
  function boot() {
    if (!ready) { requestAnimationFrame(boot); return; }
    pageFn = STAMPS[startIdx][2];
    pageName = STAMPS[startIdx][0] + " the " + STAMPS[startIdx][1];
    currentSlug = STAMPS[startIdx][0].toLowerCase();
    drawPage();
    restoreProgress();
    markPal(stampBtns[startIdx + 1]);
    setHint(pageName + " is ready to color! Grab the paint can to fill areas, or shade with the brushes.");
    undoStack = [];
    updateHistoryButtons();
    syncCurrentColor();
    hideSplash();
  }
  boot();

  // ---------- Phase 4: mobile drawer + left-handed mode ----------
  var appEl = document.getElementById("app");
  var railEl = document.getElementById("rail");
  var drawerToggle = document.getElementById("drawerToggle");
  var drawerClose = document.getElementById("drawerClose");
  var drawerScrim = document.getElementById("drawerScrim");
  var drawerReturnFocus = null;

  function drawerFocusables() {
    return [].slice.call(railEl.querySelectorAll(
      'button:not([disabled]),[href],input,[tabindex]:not([tabindex="-1"])'
    )).filter(function (el) { return el.offsetWidth > 0 || el.offsetHeight > 0; });
  }
  function openDrawer() {
    if (appEl.classList.contains("drawer-open")) return;
    drawerReturnFocus = document.activeElement;
    if (drawerScrim) drawerScrim.hidden = false;
    appEl.classList.add("drawer-open");
    if (drawerToggle) drawerToggle.setAttribute("aria-expanded", "true");
    railEl.setAttribute("role", "dialog");
    railEl.setAttribute("aria-modal", "true");
    setTimeout(function () { if (drawerClose) drawerClose.focus(); }, 40);
    document.addEventListener("keydown", drawerKeydown, true);
  }
  function closeDrawer() {
    if (!appEl.classList.contains("drawer-open")) return;
    appEl.classList.remove("drawer-open");
    if (drawerToggle) drawerToggle.setAttribute("aria-expanded", "false");
    railEl.removeAttribute("role");
    railEl.removeAttribute("aria-modal");
    document.removeEventListener("keydown", drawerKeydown, true);
    setTimeout(function () {
      if (drawerScrim && !appEl.classList.contains("drawer-open")) drawerScrim.hidden = true;
    }, 300);
    var back = drawerReturnFocus && drawerReturnFocus.focus ? drawerReturnFocus : drawerToggle;
    if (back && back.focus) back.focus();
  }
  function drawerKeydown(e) {
    if (e.key === "Escape") { e.preventDefault(); closeDrawer(); return; }
    if (e.key !== "Tab") return;
    var f = drawerFocusables();
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (f.indexOf(document.activeElement) === -1) { e.preventDefault(); first.focus(); return; }
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  if (drawerToggle) drawerToggle.addEventListener("click", function () {
    if (appEl.classList.contains("drawer-open")) closeDrawer(); else openDrawer();
  });
  if (drawerClose) drawerClose.addEventListener("click", closeDrawer);
  if (drawerScrim) drawerScrim.addEventListener("click", closeDrawer);

  // mini toolbar proxies
  function bindOpen(id) { var el = document.getElementById(id); if (el) el.addEventListener("click", openDrawer); }
  bindOpen("miniTool"); bindOpen("miniSize"); bindOpen("miniColor");
  var miniEraserBtn = document.getElementById("miniEraser");
  if (miniEraserBtn) miniEraserBtn.addEventListener("click", function () {
    tool = (tool === "eraser") ? (lastDrawTool || "pencil") : "eraser";
    markTool();
    setHint(HINTS[tool] || "");
  });
  var miniUndoBtn = document.getElementById("miniUndo");
  if (miniUndoBtn) miniUndoBtn.addEventListener("click", function () { undoBtn.click(); });

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

  // ---------- optional Supabase gallery ----------
  var CFG = window.KAWAII_CONFIG || {};
  var sb = null;
  if (CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase) {
    sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);
    document.getElementById("shareBtn").hidden = false;
    document.getElementById("galleryBtn").hidden = false;
  }
  // Android back button: an open dialog gets its own history entry, so the
  // hardware/gesture back closes the dialog instead of leaving the app.
  // The dialog "close" event is unreliable in some WebViews, so every close
  // path pops the entry explicitly instead of listening for it.
  function openDialog(d) {
    // Only one dialog is ever open; never stack a second marker entry.
    try { if (!(history.state && history.state.mochiDialog)) history.pushState({ mochiDialog: d.id }, ""); } catch (e) { }
    d.showModal();
  }
  function popDialogState() {
    if (history.state && history.state.mochiDialog) history.back();
  }
  function closeDialog(d) {
    d.close();
    popDialogState(d);
  }
  window.addEventListener("popstate", function () {
    document.querySelectorAll("dialog[open]").forEach(function (d) { d.close(); });
  });
  document.querySelectorAll("dialog").forEach(function (d) {
    d.addEventListener("cancel", function () {
      setTimeout(function () { popDialogState(d); }, 0);
    });
  });

  var galleryDialog = document.getElementById("galleryDialog");
  document.getElementById("galleryBtn").addEventListener("click", function () {
    loadGallery();
    openDialog(galleryDialog);
  });
  document.getElementById("galleryClose").addEventListener("click", function () {
    closeDialog(galleryDialog);
  });

  var shareDialog = document.getElementById("shareDialog");
  document.getElementById("shareBtn").addEventListener("click", function () {
    openDialog(shareDialog);
  });
  document.getElementById("shareForm").addEventListener("submit", function (e) {
    // method="dialog" closes the dialog for both buttons; pop its history entry.
    setTimeout(function () { popDialogState(shareDialog); }, 0);
    if (e.submitter && e.submitter.value === "cancel") return;
    if (!sb) return;
    var title = document.getElementById("artTitle").value.trim() || "Untitled masterpiece";
    var artist = document.getElementById("artArtist").value.trim() || "Anonymous artist";
    compositeCanvas().toBlob(function (blob) {
      if (!blob) { toast("Could not export the drawing"); return; }
      var path = Date.now() + "-" + Math.random().toString(36).slice(2, 8) + ".png";
      sb.storage.from("artworks").upload(path, blob, { contentType: "image/png" })
        .then(function (res) {
          if (res.error) throw res.error;
          return sb.from("artworks").insert({ title: title, artist: artist, image_path: path });
        })
        .then(function (res) {
          if (res.error) throw res.error;
          toast("Shared to the gallery! 🌟");
          loadGallery();
        })
        .catch(function (err) {
          console.error(err);
          toast("Sharing failed — check your Supabase setup");
        });
    }, "image/png");
  });

  function loadGallery() {
    if (!sb) return;
    sb.from("artworks")
      .select("title, artist, image_path, created_at")
      .order("created_at", { ascending: false })
      .limit(24)
      .then(function (res) {
        if (res.error) { console.error(res.error); return; }
        var g = document.getElementById("galleryGrid");
        g.innerHTML = "";
        if (!res.data.length) {
          var p = document.createElement("p");
          p.className = "sub";
          p.textContent = "No masterpieces yet — be the first to share one!";
          g.appendChild(p);
          return;
        }
        res.data.forEach(function (row) {
          var galUrl = sb.storage.from("artworks").getPublicUrl(row.image_path).data.publicUrl;
          var fig = document.createElement("figure");
          var img = document.createElement("img");
          img.src = galUrl;
          img.alt = row.title + " by " + row.artist;
          img.loading = "lazy";
          var cap = document.createElement("figcaption");
          cap.textContent = row.title + " · " + row.artist;
          fig.appendChild(img);
          fig.appendChild(cap);
          g.appendChild(fig);
        });
      });
  }

  // ---------- PWA: offline support (production only, keeps local dev simple) ----------
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(function () { });
  }
})();
