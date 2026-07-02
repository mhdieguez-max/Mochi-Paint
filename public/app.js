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
  var stampFn = null, stampLabel = "", stampBtns = [];
  var palMode = "page";
  var pageFn = null, pageName = "", lineData = null;
  var undoStack = [], redoStack = [], drawing = false, pts = [], snap = null;
  var LINE_MODE = false;

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
        updatePreview();
      });
      shadesEl.appendChild(b);
      if (i === 3) { shade = h; b.classList.add("on"); }
    });
    updatePreview();
  }

  var sizeIn = document.getElementById("size"), previewDot = document.getElementById("previewDot");
  function updatePreview() {
    var d = Math.min(size, 30);
    previewDot.style.width = d + "px";
    previewDot.style.height = d + "px";
    previewDot.style.background = shade;
  }
  sizeIn.addEventListener("input", function () { size = Math.round(+sizeIn.value); updatePreview(); });
  renderPalette(BASES, BASE_NAMES);

  // ---------- tools ----------
  var toolsEl = document.getElementById("tools");
  function markTool() {
    toolsEl.querySelectorAll(".tbtn[data-tool]").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-tool") === tool);
    });
    if (tool !== "stamp") markPal(null);
  }
  toolsEl.querySelectorAll(".tbtn[data-tool]").forEach(function (b) {
    b.addEventListener("click", function () {
      tool = b.getAttribute("data-tool");
      markTool();
      setHint(HINTS[tool]);
    });
  });

  // ---------- kawaii pals (original chunky-blob art) ----------
  // Helpers draw in a -1..1 space. In LINE_MODE they render as a coloring
  // page: white fills, uniform dark outlines, no blush/shadow.
  var TAU = 7;
  function oc(c, col) { if (!LINE_MODE) c.strokeStyle = col; }
  function mapFill(f) {
    if (!LINE_MODE) return f;
    if (f === "#4A3B36" || f === "#6B5347" || f === "#fff" || f === "#FFFFFF") return f;
    return "#FFFFFF";
  }
  function E(c, x, y, rx, ry, f, rot) { c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, TAU); c.fillStyle = mapFill(f); c.fill(); c.stroke(); }
  function EF(c, x, y, rx, ry, f, rot) { c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, TAU); c.fillStyle = mapFill(f); c.fill(); if (LINE_MODE && f !== "#fff" && f !== "#FFFFFF") c.stroke(); }
  function CC(c, x, y, r, f) { E(c, x, y, r, r, f); }
  function TR(c, a, b, d, f) { c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(d[0], d[1]); c.closePath(); c.fillStyle = mapFill(f); c.fill(); c.stroke(); }
  function ground(c) { if (LINE_MODE) return; EF(c, 0, 0.82, 0.6, 0.1, "rgba(130,144,180,0.16)"); }
  function bead(c, x, y, r) {
    EF(c, x, y, r, r, "#4A3B36");
    EF(c, x - r * 0.3, y - r * 0.3, r * 0.3, r * 0.3, "#fff");
  }
  function cheek(c, x, y, r) {
    if (LINE_MODE) { c.beginPath(); c.ellipse(x, y, r * 1.15, r * 0.75, 0, 0, TAU); c.stroke(); return; }
    EF(c, x, y, r * 1.15, r * 0.75, "rgba(244,143,177,0.5)");
  }
  function grin(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); }
  function catMouth(c, x, y, r) {
    c.beginPath(); c.arc(x - r, y, r, 0, Math.PI); c.arc(x + r, y, r, 0, Math.PI); c.stroke();
  }
  function sleepyEye(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0.1 * Math.PI, 0.9 * Math.PI); c.stroke(); }

  function stPom(c) {
    oc(c, "rgba(150,150,165,0.55)");
    ground(c);
    CC(c, 0.6, 0.05, 0.2, "#FFFDFB");
    TR(c, [-0.5, -0.35], [-0.36, -0.72], [-0.14, -0.42], "#FFFDFB");
    TR(c, [0.5, -0.35], [0.36, -0.72], [0.14, -0.42], "#FFFDFB");
    TR(c, [-0.42, -0.42], [-0.35, -0.62], [-0.22, -0.44], "#C9CDD6");
    TR(c, [0.42, -0.42], [0.35, -0.62], [0.22, -0.44], "#C9CDD6");
    CC(c, 0, 0.1, 0.6, "#FFFDFB");
    CC(c, -0.42, 0.5, 0.16, "#FFFDFB");
    CC(c, 0.42, 0.5, 0.16, "#FFFDFB");
    bead(c, -0.2, -0.02, 0.065); bead(c, 0.2, -0.02, 0.065);
    EF(c, 0, 0.12, 0.05, 0.04, "#4A3B36");
    cheek(c, -0.38, 0.14, 0.08); cheek(c, 0.38, 0.14, 0.08);
    catMouth(c, 0, 0.2, 0.05);
  }
  function stPolar(c) {
    oc(c, "rgba(150,150,165,0.55)");
    ground(c);
    E(c, 0, 0.3, 0.58, 0.46, "#FCFBF7");
    CC(c, -0.27, -0.58, 0.11, "#FCFBF7");
    CC(c, 0.27, -0.58, 0.11, "#FCFBF7");
    CC(c, 0, -0.26, 0.42, "#FCFBF7");
    E(c, -0.24, 0.66, 0.14, 0.09, "#FCFBF7");
    E(c, 0.24, 0.66, 0.14, 0.09, "#FCFBF7");
    bead(c, -0.17, -0.3, 0.06); bead(c, 0.17, -0.3, 0.06);
    EF(c, 0, -0.16, 0.055, 0.045, "#4A3B36");
    cheek(c, -0.32, -0.14, 0.07); cheek(c, 0.32, -0.14, 0.07);
    grin(c, 0, -0.1, 0.045);
  }
  function stCatloaf(c) {
    oc(c, "rgba(160,125,90,0.55)");
    ground(c);
    TR(c, [-0.52, -0.1], [-0.42, -0.5], [-0.2, -0.2], "#F7E7CF");
    TR(c, [0.52, -0.1], [0.42, -0.5], [0.2, -0.2], "#F7E7CF");
    TR(c, [-0.44, -0.2], [-0.4, -0.4], [-0.28, -0.22], "#E7A9B4");
    TR(c, [0.44, -0.2], [0.4, -0.4], [0.28, -0.22], "#E7A9B4");
    E(c, 0, 0.22, 0.64, 0.46, "#F7E7CF");
    EF(c, 0.32, -0.06, 0.2, 0.12, "#E5C193", 0.35);
    CC(c, 0.58, 0.42, 0.12, "#E5C193");
    bead(c, -0.22, 0.08, 0.065); bead(c, 0.22, 0.08, 0.065);
    cheek(c, -0.42, 0.22, 0.08); cheek(c, 0.42, 0.22, 0.08);
    catMouth(c, 0, 0.18, 0.05);
  }
  function stCow(c) {
    oc(c, "rgba(110,105,115,0.5)");
    ground(c);
    TR(c, [-0.28, -0.5], [-0.36, -0.72], [-0.16, -0.6], "#EED9A9");
    TR(c, [0.28, -0.5], [0.36, -0.72], [0.16, -0.6], "#EED9A9");
    E(c, -0.6, -0.12, 0.14, 0.09, "#FDFCF8", -0.5);
    E(c, 0.6, -0.12, 0.14, 0.09, "#FDFCF8", 0.5);
    E(c, 0, 0.12, 0.6, 0.5, "#FDFCF8");
    EF(c, -0.34, -0.1, 0.19, 0.13, "#4E4A50", 0.5);
    EF(c, 0.38, 0.34, 0.17, 0.12, "#4E4A50", -0.4);
    EF(c, 0, -0.5, 0.14, 0.09, "#4E4A50");
    bead(c, -0.28, -0.02, 0.06); bead(c, 0.28, -0.02, 0.06);
    E(c, 0, 0.3, 0.24, 0.15, "#F6CFD6");
    EF(c, -0.08, 0.3, 0.035, 0.045, "#D98CA2");
    EF(c, 0.08, 0.3, 0.035, 0.045, "#D98CA2");
    cheek(c, -0.46, 0.14, 0.07); cheek(c, 0.46, 0.14, 0.07);
  }
  function stBee(c) {
    oc(c, "rgba(140,110,70,0.55)");
    ground(c);
    c.beginPath(); c.arc(-0.24, -0.74, 0.13, 0, TAU); c.stroke();
    c.beginPath(); c.arc(0.24, -0.74, 0.13, 0, TAU); c.stroke();
    E(c, -0.66, 0, 0.15, 0.24, "rgba(255,255,255,0.92)", 0.35);
    E(c, 0.66, 0, 0.15, 0.24, "rgba(255,255,255,0.92)", -0.35);
    CC(c, 0, 0.08, 0.56, "#FFDE7A");
    c.save(); c.beginPath(); c.arc(0, 0.08, 0.56, 0, TAU); c.clip();
    c.fillStyle = "#6B5347";
    c.fillRect(-0.7, 0.22, 1.4, 0.14);
    c.fillRect(-0.7, 0.46, 1.4, 0.14);
    c.restore();
    bead(c, -0.2, -0.08, 0.06); bead(c, 0.2, -0.08, 0.06);
    cheek(c, -0.38, 0.04, 0.08); cheek(c, 0.38, 0.04, 0.08);
    catMouth(c, 0, 0.02, 0.04);
    EF(c, -0.18, 0.68, 0.07, 0.05, "#6B5347");
    EF(c, 0.18, 0.68, 0.07, 0.05, "#6B5347");
  }
  function stBear(c) {
    oc(c, "rgba(120,85,55,0.55)");
    ground(c);
    CC(c, -0.3, -0.54, 0.12, "#B9855C");
    CC(c, 0.3, -0.54, 0.12, "#B9855C");
    EF(c, -0.3, -0.54, 0.06, 0.06, "#E8CBA8");
    EF(c, 0.3, -0.54, 0.06, 0.06, "#E8CBA8");
    E(c, 0, 0.14, 0.6, 0.52, "#B9855C");
    E(c, 0, 0.28, 0.2, 0.14, "#F2DBBB");
    EF(c, 0, 0.22, 0.055, 0.045, "#4A3B36");
    grin(c, 0, 0.28, 0.045);
    bead(c, -0.24, 0.02, 0.06); bead(c, 0.24, 0.02, 0.06);
    cheek(c, -0.44, 0.16, 0.07); cheek(c, 0.44, 0.16, 0.07);
    E(c, -0.24, 0.62, 0.14, 0.09, "#B9855C");
    E(c, 0.24, 0.62, 0.14, 0.09, "#B9855C");
  }
  function stBunny(c) {
    oc(c, "rgba(150,150,165,0.55)");
    ground(c);
    E(c, -0.2, -0.5, 0.13, 0.35, "#FDFBF7", -0.08);
    E(c, 0.2, -0.5, 0.13, 0.35, "#FDFBF7", 0.08);
    EF(c, -0.2, -0.44, 0.06, 0.22, "#F6CFD6", -0.08);
    EF(c, 0.2, -0.44, 0.06, 0.22, "#F6CFD6", 0.08);
    CC(c, 0, 0.22, 0.56, "#FDFBF7");
    bead(c, -0.2, 0.06, 0.06); bead(c, 0.2, 0.06, 0.06);
    cheek(c, -0.38, 0.2, 0.08); cheek(c, 0.38, 0.2, 0.08);
    catMouth(c, 0, 0.18, 0.04);
    E(c, -0.12, 0.52, 0.11, 0.07, "#F6B8C8", 0.5);
    E(c, 0.12, 0.52, 0.11, 0.07, "#F6B8C8", -0.5);
    CC(c, 0, 0.52, 0.05, "#F09CB4");
  }
  function stPuppy(c) {
    oc(c, "rgba(140,100,60,0.55)");
    ground(c);
    E(c, -0.5, -0.32, 0.14, 0.24, "#C89468", 0.5);
    E(c, 0.5, -0.32, 0.14, 0.24, "#C89468", -0.5);
    E(c, 0, 0.14, 0.6, 0.5, "#EBC79B");
    EF(c, 0, 0.34, 0.32, 0.26, "#FCF7EF");
    EF(c, 0.26, -0.32, 0.13, 0.1, "#FCF7EF", 0.3);
    bead(c, -0.22, -0.06, 0.06); bead(c, 0.22, -0.06, 0.06);
    EF(c, 0, 0.14, 0.055, 0.045, "#4A3B36");
    grin(c, 0, 0.2, 0.05);
    cheek(c, -0.42, 0.08, 0.07); cheek(c, 0.42, 0.08, 0.07);
    CC(c, 0.62, 0.34, 0.12, "#C89468");
  }
  function stChick(c) {
    oc(c, "rgba(190,140,60,0.5)");
    ground(c);
    c.beginPath(); c.moveTo(-0.04, -0.56); c.quadraticCurveTo(-0.12, -0.74, -0.2, -0.7); c.moveTo(0.02, -0.56); c.quadraticCurveTo(0.08, -0.76, 0.16, -0.72); c.stroke();
    CC(c, 0, 0.06, 0.58, "#FFE38F");
    E(c, -0.5, 0.16, 0.14, 0.2, "#FFEDB0", 0.4);
    E(c, 0.5, 0.16, 0.14, 0.2, "#FFEDB0", -0.4);
    bead(c, -0.2, -0.04, 0.06); bead(c, 0.2, -0.04, 0.06);
    TR(c, [-0.07, 0.06], [0.07, 0.06], [0, 0.17], "#F5A25D");
    cheek(c, -0.36, 0.1, 0.09); cheek(c, 0.36, 0.1, 0.09);
    EF(c, -0.14, 0.66, 0.06, 0.04, "#F5A25D");
    EF(c, 0.14, 0.66, 0.06, 0.04, "#F5A25D");
  }
  function stSheep(c) {
    oc(c, "rgba(150,150,165,0.5)");
    ground(c);
    for (var i = 0; i < 8; i++) {
      var a = i / 8 * 6.283;
      CC(c, Math.cos(a) * 0.42, 0.05 + Math.sin(a) * 0.34, 0.19, "#FDFBF6");
    }
    CC(c, 0, 0.05, 0.44, "#FDFBF6");
    E(c, -0.32, 0.18, 0.1, 0.06, "#D9D3D6", 0.4);
    E(c, 0.32, 0.18, 0.1, 0.06, "#D9D3D6", -0.4);
    CC(c, 0, 0.16, 0.27, "#D9D3D6");
    CC(c, 0, -0.12, 0.14, "#FDFBF6");
    bead(c, -0.11, 0.12, 0.05); bead(c, 0.11, 0.12, 0.05);
    cheek(c, -0.2, 0.24, 0.06); cheek(c, 0.2, 0.24, 0.06);
    grin(c, 0, 0.2, 0.04);
  }

  function stPenguin(c) {
    oc(c, "rgba(90,105,120,0.55)");
    ground(c);
    E(c, -0.56, 0.15, 0.12, 0.22, "#4E5A66", 0.4);
    E(c, 0.56, 0.15, 0.12, 0.22, "#4E5A66", -0.4);
    E(c, 0, 0.1, 0.56, 0.55, "#4E5A66");
    EF(c, 0, 0.26, 0.38, 0.34, "#FDFCF8");
    EF(c, -0.2, -0.16, 0.09, 0.09, "#FDFCF8");
    EF(c, 0.2, -0.16, 0.09, 0.09, "#FDFCF8");
    bead(c, -0.2, -0.15, 0.05); bead(c, 0.2, -0.15, 0.05);
    TR(c, [-0.07, -0.04], [0.07, -0.04], [0, 0.08], "#F5A25D");
    cheek(c, -0.34, 0, 0.07); cheek(c, 0.34, 0, 0.07);
    E(c, -0.18, 0.68, 0.12, 0.07, "#F5A25D");
    E(c, 0.18, 0.68, 0.12, 0.07, "#F5A25D");
  }
  function stFrog(c) {
    oc(c, "rgba(105,140,90,0.55)");
    ground(c);
    CC(c, -0.3, -0.5, 0.17, "#A8D8A0");
    CC(c, 0.3, -0.5, 0.17, "#A8D8A0");
    bead(c, -0.3, -0.5, 0.07); bead(c, 0.3, -0.5, 0.07);
    E(c, 0, 0.14, 0.6, 0.48, "#A8D8A0");
    EF(c, 0, 0.34, 0.36, 0.24, "#E8F4DE");
    cheek(c, -0.44, -0.02, 0.08); cheek(c, 0.44, -0.02, 0.08);
    grin(c, 0, -0.04, 0.16);
    E(c, -0.32, 0.62, 0.14, 0.08, "#A8D8A0");
    E(c, 0.32, 0.62, 0.14, 0.08, "#A8D8A0");
  }
  function stPanda(c) {
    oc(c, "rgba(105,100,105,0.55)");
    ground(c);
    CC(c, -0.32, -0.55, 0.13, "#3E3A3C");
    CC(c, 0.32, -0.55, 0.13, "#3E3A3C");
    E(c, 0, 0.12, 0.6, 0.52, "#FCFBF7");
    EF(c, -0.21, -0.12, 0.11, 0.14, "#3E3A3C", 0.3);
    EF(c, 0.21, -0.12, 0.11, 0.14, "#3E3A3C", -0.3);
    EF(c, -0.19, -0.14, 0.045, 0.045, "#fff");
    EF(c, 0.23, -0.14, 0.045, 0.045, "#fff");
    EF(c, -0.19, -0.13, 0.022, 0.022, "#4A3B36");
    EF(c, 0.23, -0.13, 0.022, 0.022, "#4A3B36");
    EF(c, 0, 0.06, 0.05, 0.04, "#4A3B36");
    grin(c, 0, 0.12, 0.045);
    cheek(c, -0.4, 0.08, 0.07); cheek(c, 0.4, 0.08, 0.07);
    E(c, -0.42, 0.44, 0.16, 0.12, "#3E3A3C", 0.5);
    E(c, 0.42, 0.44, 0.16, 0.12, "#3E3A3C", -0.5);
  }
  function stDuck(c) {
    oc(c, "rgba(190,150,70,0.5)");
    ground(c);
    c.beginPath(); c.moveTo(0, -0.56); c.quadraticCurveTo(0.1, -0.78, 0.24, -0.7); c.stroke();
    CC(c, 0, 0.08, 0.56, "#FCF6E3");
    E(c, -0.48, 0.18, 0.13, 0.18, "#F5E7BF", 0.4);
    E(c, 0.48, 0.18, 0.13, 0.18, "#F5E7BF", -0.4);
    bead(c, -0.2, -0.06, 0.06); bead(c, 0.2, -0.06, 0.06);
    E(c, 0, 0.1, 0.14, 0.08, "#F5A25D");
    cheek(c, -0.36, 0.08, 0.08); cheek(c, 0.36, 0.08, 0.08);
    EF(c, -0.14, 0.66, 0.07, 0.05, "#F5A25D");
    EF(c, 0.14, 0.66, 0.07, 0.05, "#F5A25D");
  }

  var STAMPS = [
    ["Yuki", "pom pup", stPom],
    ["Kori", "polar bear", stPolar],
    ["Mochi", "cat loaf", stCatloaf],
    ["Miruku", "cow", stCow],
    ["Hachi", "bee", stBee],
    ["Kuma", "bear", stBear],
    ["Usagi", "bunny", stBunny],
    ["Kobo", "puppy", stPuppy],
    ["Piyo", "chick", stChick],
    ["Fuwa", "sheep", stSheep],
    ["Pen", "penguin", stPenguin],
    ["Kero", "frog", stFrog],
    ["Panpan", "panda", stPanda],
    ["Kamo", "duck", stDuck]
  ];

  function withChar(c, x, y, s, fn, asLines) {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    LINE_MODE = !!asLines;
    c.lineWidth = asLines ? 0.045 : 0.035;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.strokeStyle = asLines ? "#5A4A42" : "rgba(107,80,72,0.55)";
    fn(c);
    LINE_MODE = false;
    c.restore();
  }

  // ---------- coloring pages ----------
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
  function loadPage(fn, name) {
    pageFn = fn; pageName = name;
    pushUndo();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    drawPage();
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
    loadPage(null, "");
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
        loadPage(st[2], st[0] + " the " + st[1]);
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
  function pushUndo() {
    try {
      undoStack.push(ctx.getImageData(0, 0, W, H));
      if (undoStack.length > 15) undoStack.shift();
      redoStack = [];
    } catch (e) { }
  }
  document.getElementById("undoBtn").addEventListener("click", function () {
    var im = undoStack.pop();
    if (!im) { toast("Nothing to undo"); return; }
    try { redoStack.push(ctx.getImageData(0, 0, W, H)); } catch (e) { }
    ctx.putImageData(im, 0, 0);
  });
  document.getElementById("redoBtn").addEventListener("click", function () {
    var im = redoStack.pop();
    if (!im) { toast("Nothing to redo"); return; }
    try { undoStack.push(ctx.getImageData(0, 0, W, H)); } catch (e) { }
    ctx.putImageData(im, 0, 0);
  });
  document.getElementById("clearBtn").addEventListener("click", function () {
    pushUndo();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
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
  // flood fill on the paint layer; outline pixels on the line layer act as walls
  function floodFill(x, y) {
    x = Math.max(0, Math.min(W - 1, Math.round(x)));
    y = Math.max(0, Math.min(H - 1, Math.round(y)));
    if (lineData && lineData[(y * W + x) * 4 + 3] > 60) return;
    var img = ctx.getImageData(0, 0, W, H), d = img.data;
    var i0 = (y * W + x) * 4, tr = d[i0], tg = d[i0 + 1], tb = d[i0 + 2];
    var f = hexRgb(shade);
    if (Math.abs(tr - f[0]) + Math.abs(tg - f[1]) + Math.abs(tb - f[2]) < 12) return;
    var seen = new Uint8Array(W * H), stack = [x, y];
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
      stack.push(px + 1, py, px - 1, py, px, py + 1, px, py - 1);
    }
    ctx.putImageData(img, 0, 0);
  }

  board.addEventListener("pointerdown", function (e) {
    if (!ready) { initCanvas(); if (!ready) return; }
    e.preventDefault();
    try { board.setPointerCapture(e.pointerId); } catch (err) { }
    var p = pos(e);
    pushUndo();
    if (tool === "fill") { floodFill(p[0], p[1]); return; }
    if (tool === "stamp" && stampFn) { withChar(ctx, p[0], p[1], size * 4 * dpr, stampFn, false); return; }
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
  function endStroke() { drawing = false; pts = []; snap = null; }
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
  markTool();
  initCanvas();
  function boot() {
    if (!ready) { requestAnimationFrame(boot); return; }
    pageFn = STAMPS[0][2];
    pageName = STAMPS[0][0] + " the " + STAMPS[0][1];
    drawPage();
    markPal(stampBtns[1]);
    setHint(pageName + " is ready to color! Grab the paint can to fill areas, or shade with the brushes.");
    undoStack = [];
  }
  boot();

  // ---------- optional Supabase gallery ----------
  var CFG = window.KAWAII_CONFIG || {};
  var sb = null;
  if (CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase) {
    sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);
    document.getElementById("shareBtn").hidden = false;
    document.getElementById("galleryBtn").hidden = false;
  }
  var galleryDialog = document.getElementById("galleryDialog");
  document.getElementById("galleryBtn").addEventListener("click", function () {
    loadGallery();
    galleryDialog.showModal();
  });
  document.getElementById("galleryClose").addEventListener("click", function () {
    galleryDialog.close();
  });

  var shareDialog = document.getElementById("shareDialog");
  document.getElementById("shareBtn").addEventListener("click", function () {
    shareDialog.showModal();
  });
  document.getElementById("shareForm").addEventListener("submit", function (e) {
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
