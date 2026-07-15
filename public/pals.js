// Mochi Paint pals — the single source of truth for character art.
// Loaded by both the home page (color previews) and the coloring studio
// (color previews, stamps, and LINE_MODE coloring pages), so a card on the
// home page is always the exact same drawing as the page it opens.
//
// Helpers draw in a -1..1 space. In LINE_MODE they render as a coloring
// page: white fills, uniform dark outlines, no blush/shadow. Every
// silhouette part must geometrically overlap the head/body so the outline
// stays one connected line drawing. #4A3B36 and #6B5347 stay dark in
// LINE_MODE — never use them for regions that should be colorable.
window.MochiPals = (function () {
  "use strict";

  var TAU = 7;
  var LINE_MODE = false;

  function oc(c, col) { if (!LINE_MODE) c.strokeStyle = col.replace(/,\s*0\.\d+\)/, ",0.85)"); }
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

  // ---------- meadow ----------
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
  function stFrog(c) {
    oc(c, "rgba(105,140,90,0.55)");
    ground(c);
    CC(c, -0.3, -0.42, 0.19, "#A8D8A0");
    CC(c, 0.3, -0.42, 0.19, "#A8D8A0");
    bead(c, -0.3, -0.44, 0.07); bead(c, 0.3, -0.44, 0.07);
    E(c, 0, 0.14, 0.6, 0.48, "#A8D8A0");
    EF(c, 0, 0.34, 0.36, 0.24, "#E8F4DE");
    cheek(c, -0.44, -0.02, 0.08); cheek(c, 0.44, -0.02, 0.08);
    grin(c, 0, -0.04, 0.16);
    E(c, -0.32, 0.62, 0.14, 0.08, "#A8D8A0");
    E(c, 0.32, 0.62, 0.14, 0.08, "#A8D8A0");
  }
  function stBee(c) {
    oc(c, "rgba(140,110,70,0.55)");
    ground(c);
    c.beginPath();
    c.moveTo(-0.1, -0.4); c.quadraticCurveTo(-0.22, -0.55, -0.24, -0.66);
    c.moveTo(0.1, -0.4); c.quadraticCurveTo(0.22, -0.55, 0.24, -0.66);
    c.stroke();
    CC(c, -0.24, -0.72, 0.1, "#6C5348");
    CC(c, 0.24, -0.72, 0.1, "#6C5348");
    E(c, -0.66, 0, 0.15, 0.24, "rgba(255,255,255,0.92)", 0.35);
    E(c, 0.66, 0, 0.15, 0.24, "rgba(255,255,255,0.92)", -0.35);
    CC(c, 0, 0.08, 0.56, "#FFDE7A");
    c.save(); c.beginPath(); c.arc(0, 0.08, 0.56, 0, TAU); c.clip();
    if (LINE_MODE) {
      // Stripes as chords so they read as colorable bands, not solid ink.
      c.beginPath();
      c.moveTo(-0.7, 0.22); c.lineTo(0.7, 0.22);
      c.moveTo(-0.7, 0.36); c.lineTo(0.7, 0.36);
      c.moveTo(-0.7, 0.46); c.lineTo(0.7, 0.46);
      c.moveTo(-0.7, 0.6); c.lineTo(0.7, 0.6);
      c.stroke();
    } else {
      c.fillStyle = "#6B5347";
      c.fillRect(-0.7, 0.22, 1.4, 0.14);
      c.fillRect(-0.7, 0.46, 1.4, 0.14);
    }
    c.restore();
    bead(c, -0.2, -0.08, 0.06); bead(c, 0.2, -0.08, 0.06);
    cheek(c, -0.38, 0.04, 0.08); cheek(c, 0.38, 0.04, 0.08);
    catMouth(c, 0, 0.02, 0.04);
    EF(c, -0.18, 0.64, 0.07, 0.05, "#6C5348");
    EF(c, 0.18, 0.64, 0.07, 0.05, "#6C5348");
  }

  // ---------- barnyard ----------
  function stCow(c) {
    oc(c, "rgba(110,105,115,0.5)");
    ground(c);
    TR(c, [-0.32, -0.26], [-0.42, -0.62], [-0.16, -0.32], "#EED9A9");
    TR(c, [0.32, -0.26], [0.42, -0.62], [0.16, -0.32], "#EED9A9");
    E(c, -0.55, -0.1, 0.15, 0.1, "#FDFCF8", -0.5);
    E(c, 0.55, -0.1, 0.15, 0.1, "#FDFCF8", 0.5);
    E(c, 0, 0.12, 0.6, 0.5, "#FDFCF8");
    EF(c, -0.34, -0.1, 0.19, 0.13, "#4E4A50", 0.5);
    EF(c, 0.38, 0.34, 0.17, 0.12, "#4E4A50", -0.4);
    EF(c, 0, -0.36, 0.16, 0.1, "#4E4A50");
    bead(c, -0.28, -0.02, 0.06); bead(c, 0.28, -0.02, 0.06);
    E(c, 0, 0.3, 0.24, 0.15, "#F6CFD6");
    EF(c, -0.08, 0.3, 0.035, 0.045, "#D98CA2");
    EF(c, 0.08, 0.3, 0.035, 0.045, "#D98CA2");
    cheek(c, -0.46, 0.14, 0.07); cheek(c, 0.46, 0.14, 0.07);
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

  // ---------- snow ----------
  function stPom(c) {
    oc(c, "rgba(150,150,165,0.55)");
    ground(c);
    CC(c, 0.6, 0.05, 0.2, "#FFFDFB");
    TR(c, [-0.42, -0.32], [-0.34, -0.66], [-0.12, -0.36], "#FFFDFB");
    TR(c, [0.42, -0.32], [0.34, -0.66], [0.12, -0.36], "#FFFDFB");
    TR(c, [-0.36, -0.46], [-0.31, -0.6], [-0.22, -0.47], "#C9CDD6");
    TR(c, [0.36, -0.46], [0.31, -0.6], [0.22, -0.47], "#C9CDD6");
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
  function stPanda(c) {
    oc(c, "rgba(105,100,105,0.55)");
    ground(c);
    CC(c, -0.34, -0.42, 0.16, "#3E3A3C");
    CC(c, 0.34, -0.42, 0.16, "#3E3A3C");
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

  // ---------- cozy den ----------
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
  function stBear(c) {
    oc(c, "rgba(120,85,55,0.55)");
    ground(c);
    CC(c, -0.33, -0.42, 0.17, "#B9855C");
    CC(c, 0.33, -0.42, 0.17, "#B9855C");
    EF(c, -0.33, -0.46, 0.08, 0.08, "#E8CBA8");
    EF(c, 0.33, -0.46, 0.08, 0.08, "#E8CBA8");
    E(c, 0, 0.14, 0.6, 0.52, "#B9855C");
    E(c, 0, 0.28, 0.2, 0.14, "#F2DBBB");
    EF(c, 0, 0.22, 0.055, 0.045, "#4A3B36");
    grin(c, 0, 0.28, 0.045);
    bead(c, -0.24, 0.02, 0.06); bead(c, 0.24, 0.02, 0.06);
    cheek(c, -0.44, 0.16, 0.07); cheek(c, 0.44, 0.16, 0.07);
    E(c, -0.24, 0.62, 0.14, 0.09, "#B9855C");
    E(c, 0.24, 0.62, 0.14, 0.09, "#B9855C");
  }
  function stHamster(c) {
    oc(c, "rgba(180,130,80,0.5)");
    CC(c, -0.34, -0.5, 0.14, "#F2D8B8");
    CC(c, 0.34, -0.5, 0.14, "#F2D8B8");
    EF(c, -0.34, -0.5, 0.07, 0.07, "#F6CFD6");
    EF(c, 0.34, -0.5, 0.07, 0.07, "#F6CFD6");
    CC(c, 0, 0.08, 0.58, "#F2D8B8");
    EF(c, 0, 0.3, 0.34, 0.26, "#FCF6EC");
    bead(c, -0.2, -0.08, 0.06); bead(c, 0.2, -0.08, 0.06);
    EF(c, 0, 0.08, 0.05, 0.04, "#4A3B36");
    catMouth(c, 0, 0.16, 0.045);
    cheek(c, -0.4, 0.04, 0.09); cheek(c, 0.4, 0.04, 0.09);
    E(c, -0.16, 0.62, 0.1, 0.06, "#F2D8B8");
    E(c, 0.16, 0.62, 0.1, 0.06, "#F2D8B8");
  }
  function stHedgehog(c) {
    oc(c, "rgba(140,100,60,0.55)");
    for (var hi = 0; hi < 7; hi++) {
      var ha = Math.PI * (1 + hi / 6);
      CC(c, Math.cos(ha) * 0.42, -0.02 + Math.sin(ha) * 0.36, 0.17, "#C79B6E");
    }
    CC(c, 0, -0.04, 0.46, "#C79B6E");
    CC(c, 0, 0.16, 0.44, "#F5E3C8");
    bead(c, -0.16, 0.06, 0.055); bead(c, 0.16, 0.06, 0.055);
    EF(c, 0, 0.18, 0.05, 0.04, "#4A3B36");
    grin(c, 0, 0.24, 0.04);
    cheek(c, -0.32, 0.18, 0.07); cheek(c, 0.32, 0.18, 0.07);
    E(c, -0.16, 0.58, 0.1, 0.06, "#F5E3C8");
    E(c, 0.16, 0.58, 0.1, 0.06, "#F5E3C8");
  }

  // ---------- dinosaurs ----------
  function stTrex(c) {
    oc(c, "rgba(86,130,85,0.55)");
    ground(c);
    // Spikes, tail, and muzzle go under the body/head so they merge into one
    // connected silhouette instead of crossing lines through it.
    for (var i = 0; i < 3; i++) TR(c, [-0.5 + i * 0.19, -0.16], [-0.4 + i * 0.19, -0.44], [-0.31 + i * 0.19, -0.16], "#C6E58A");
    TR(c, [-0.54, 0.1], [-0.9, -0.04], [-0.56, 0.28], "#9AD17B");
    E(c, -0.1, 0.18, 0.48, 0.38, "#9AD17B");
    E(c, 0.36, -0.16, 0.34, 0.3, "#9AD17B");
    bead(c, 0.26, -0.23, 0.055);
    cheek(c, 0.54, -0.12, 0.055);
    grin(c, 0.42, -0.05, 0.1);
    E(c, -0.22, 0.56, 0.11, 0.26, "#9AD17B", 0.04);
    E(c, 0.18, 0.56, 0.11, 0.26, "#9AD17B", -0.04);
    E(c, -0.3, 0.78, 0.17, 0.07, "#9AD17B");
    E(c, 0.1, 0.78, 0.17, 0.07, "#9AD17B");
    E(c, 0.1, 0.22, 0.12, 0.07, "#9AD17B", 0.35);
    E(c, 0.3, 0.32, 0.1, 0.06, "#9AD17B", 0.5);
  }
  function stTricera(c) {
    oc(c, "rgba(120,105,75,0.55)");
    ground(c);
    E(c, 0, 0.3, 0.58, 0.36, "#D8B66A");
    E(c, 0, -0.14, 0.43, 0.34, "#D8B66A");
    E(c, 0, -0.24, 0.56, 0.22, "#E9CE8A");
    TR(c, [-0.26, -0.36], [-0.42, -0.67], [-0.08, -0.42], "#F7E7BE");
    TR(c, [0.26, -0.36], [0.42, -0.67], [0.08, -0.42], "#F7E7BE");
    TR(c, [-0.06, -0.18], [0.06, -0.18], [0, -0.42], "#F7E7BE");
    bead(c, -0.18, -0.12, 0.055); bead(c, 0.18, -0.12, 0.055);
    EF(c, 0, 0.04, 0.14, 0.09, "#F4DDA9");
    grin(c, 0, 0.1, 0.05);
    E(c, -0.32, 0.62, 0.12, 0.09, "#D8B66A");
    E(c, 0.32, 0.62, 0.12, 0.09, "#D8B66A");
  }
  function stStego(c) {
    oc(c, "rgba(75,130,110,0.55)");
    ground(c);
    E(c, -0.08, 0.28, 0.62, 0.32, "#78C6A3");
    E(c, 0.5, 0.02, 0.24, 0.22, "#78C6A3");
    TR(c, [-0.58, 0.22], [-0.94, 0.1], [-0.6, 0.36], "#78C6A3");
    for (var i = 0; i < 5; i++) TR(c, [-0.48 + i * 0.2, 0.02], [-0.38 + i * 0.2, -0.32 - Math.abs(2 - i) * 0.03], [-0.28 + i * 0.2, 0.02], "#F3B6C7");
    bead(c, 0.56, -0.04, 0.05);
    cheek(c, 0.68, 0.08, 0.055);
    grin(c, 0.58, 0.1, 0.045);
    E(c, -0.36, 0.62, 0.1, 0.13, "#78C6A3");
    E(c, 0.2, 0.62, 0.1, 0.13, "#78C6A3");
  }
  function stPtero(c) {
    oc(c, "rgba(120,100,150,0.55)");
    ground(c);
    E(c, 0, 0.06, 0.28, 0.42, "#B8A0D8");
    TR(c, [-0.22, -0.08], [-0.86, -0.42], [-0.44, 0.32], "#D7C4EF");
    TR(c, [0.22, -0.08], [0.86, -0.42], [0.44, 0.32], "#D7C4EF");
    E(c, 0, -0.42, 0.26, 0.2, "#B8A0D8");
    TR(c, [-0.08, -0.56], [0.08, -0.56], [0, -0.82], "#F6DCA8");
    bead(c, -0.09, -0.46, 0.045); bead(c, 0.09, -0.46, 0.045);
    TR(c, [-0.09, -0.38], [0.09, -0.38], [0, -0.23], "#F6A96C");
    cheek(c, -0.19, -0.36, 0.045); cheek(c, 0.19, -0.36, 0.045);
    E(c, -0.1, 0.48, 0.07, 0.14, "#B8A0D8");
    E(c, 0.1, 0.48, 0.07, 0.14, "#B8A0D8");
  }

  // ---------- mermaid cove ----------
  function stMermaid(c) {
    oc(c, "rgba(80,130,150,0.55)");
    ground(c);
    c.beginPath(); c.moveTo(-0.16, 0.3); c.quadraticCurveTo(0.18, 0.5, 0.02, 0.82); c.stroke();
    TR(c, [0.02, 0.82], [-0.18, 0.58], [0.16, 0.58], "#79D1C3");
    E(c, 0, 0.28, 0.22, 0.34, "#79D1C3");
    E(c, 0, -0.1, 0.24, 0.28, "#F4C7A1");
    CC(c, 0, -0.48, 0.26, "#F4C7A1");
    for (var i = 0; i < 8; i++) CC(c, -0.24 + i * 0.07, -0.63 + Math.sin(i) * 0.04, 0.09, "#9B6BCB");
    E(c, -0.34, 0.04, 0.11, 0.22, "#F4C7A1", 0.35);
    E(c, 0.34, 0.04, 0.11, 0.22, "#F4C7A1", -0.35);
    bead(c, -0.09, -0.5, 0.04); bead(c, 0.09, -0.5, 0.04);
    cheek(c, -0.16, -0.4, 0.05); cheek(c, 0.16, -0.4, 0.05);
    catMouth(c, 0, -0.39, 0.03);
  }
  function stSeahorse(c) {
    oc(c, "rgba(90,140,150,0.55)");
    ground(c);
    // Chunky curled tail (a thick filled crescent, not a thin stroke).
    c.beginPath();
    c.arc(0.05, 0.42, 0.3, 1.5 * Math.PI, 0.35 * Math.PI);
    c.arc(0.05, 0.42, 0.14, 0.35 * Math.PI, 1.5 * Math.PI, true);
    c.closePath(); c.fillStyle = mapFill("#7EC9D4"); c.fill(); c.stroke();
    E(c, 0.05, -0.18, 0.32, 0.46, "#7EC9D4");
    // Coronet bumps and trunk snout go under the head so they merge into one
    // connected silhouette; the head's fill absorbs the overlap.
    CC(c, 0.0, -0.72, 0.055, "#F6C6D5");
    CC(c, 0.13, -0.77, 0.055, "#F6C6D5");
    CC(c, 0.26, -0.72, 0.055, "#F6C6D5");
    E(c, 0.46, -0.5, 0.16, 0.065, "#7EC9D4", -0.2);
    E(c, 0.16, -0.56, 0.26, 0.21, "#7EC9D4");
    for (var i = 0; i < 4; i++) TR(c, [-0.16, -0.48 + i * 0.2], [-0.44, -0.36 + i * 0.2], [-0.16, -0.26 + i * 0.2], "#F6C6D5");
    EF(c, 0.14, -0.14, 0.16, 0.3, "#DFF3F5");
    bead(c, 0.2, -0.58, 0.05);
    grin(c, 0.33, -0.43, 0.035);
    cheek(c, 0.02, -0.56, 0.05);
  }
  function stJelly(c) {
    oc(c, "rgba(130,105,165,0.55)");
    E(c, 0, -0.28, 0.5, 0.36, "#C6A7ED");
    for (var i = 0; i < 5; i++) {
      c.beginPath();
      c.moveTo(-0.34 + i * 0.17, 0.02);
      c.quadraticCurveTo(-0.44 + i * 0.17, 0.36, -0.28 + i * 0.17, 0.7);
      c.stroke();
    }
    bead(c, -0.16, -0.32, 0.055); bead(c, 0.16, -0.32, 0.055);
    cheek(c, -0.3, -0.18, 0.06); cheek(c, 0.3, -0.18, 0.06);
    catMouth(c, 0, -0.2, 0.04);
  }
  function stDolphin(c) {
    oc(c, "rgba(80,120,165,0.55)");
    ground(c);
    E(c, 0.02, 0.03, 0.62, 0.28, "#87BFE8", -0.15);
    TR(c, [-0.52, 0.04], [-0.86, -0.2], [-0.74, 0.22], "#87BFE8");
    TR(c, [0, -0.18], [0.18, -0.54], [0.25, -0.14], "#87BFE8");
    E(c, 0.56, -0.04, 0.22, 0.13, "#87BFE8", -0.1);
    bead(c, 0.46, -0.09, 0.045);
    cheek(c, 0.58, 0.02, 0.045);
    grin(c, 0.6, 0.04, 0.04);
    EF(c, 0.02, 0.2, 0.22, 0.08, "#D9F2FF", -0.15);
  }

  // ---------- halloween ----------
  function stPumpkin(c) {
    oc(c, "rgba(160,95,45,0.55)");
    ground(c);
    E(c, -0.22, 0.15, 0.34, 0.46, "#F2A04B");
    E(c, 0.22, 0.15, 0.34, 0.46, "#F2A04B");
    E(c, 0, 0.15, 0.38, 0.5, "#FFB45C");
    TR(c, [-0.1, -0.36], [0.1, -0.36], [0, -0.66], "#7DA35C");
    TR(c, [-0.2, 0.0], [-0.05, -0.1], [-0.05, 0.1], "#4A3B36");
    TR(c, [0.2, 0.0], [0.05, -0.1], [0.05, 0.1], "#4A3B36");
    catMouth(c, 0, 0.24, 0.09);
  }
  function stGhost(c) {
    oc(c, "rgba(135,130,155,0.55)");
    ground(c);
    c.beginPath();
    c.moveTo(-0.48, 0.64); c.lineTo(-0.48, -0.14);
    c.quadraticCurveTo(-0.48, -0.62, 0, -0.62);
    c.quadraticCurveTo(0.48, -0.62, 0.48, -0.14);
    c.lineTo(0.48, 0.64);
    c.quadraticCurveTo(0.32, 0.48, 0.16, 0.64);
    c.quadraticCurveTo(0, 0.48, -0.16, 0.64);
    c.quadraticCurveTo(-0.32, 0.48, -0.48, 0.64);
    c.closePath(); c.fillStyle = mapFill("#FCFBFF"); c.fill(); c.stroke();
    bead(c, -0.16, -0.14, 0.065); bead(c, 0.16, -0.14, 0.065);
    EF(c, 0, 0.06, 0.08, 0.1, "#4A3B36");
    cheek(c, -0.3, 0.02, 0.06); cheek(c, 0.3, 0.02, 0.06);
  }
  function stWitchCat(c) {
    oc(c, "rgba(90,80,100,0.55)");
    ground(c);
    TR(c, [-0.5, -0.22], [0, -0.82], [0.5, -0.22], "#7B5AA6");
    E(c, 0, -0.22, 0.62, 0.08, "#7B5AA6");
    TR(c, [-0.42, -0.04], [-0.34, -0.34], [-0.16, -0.12], "#4B4656");
    TR(c, [0.42, -0.04], [0.34, -0.34], [0.16, -0.12], "#4B4656");
    CC(c, 0, 0.22, 0.48, "#4B4656");
    bead(c, -0.17, 0.12, 0.055); bead(c, 0.17, 0.12, 0.055);
    cheek(c, -0.32, 0.24, 0.06); cheek(c, 0.32, 0.24, 0.06);
    catMouth(c, 0, 0.24, 0.045);
    CC(c, 0.54, 0.43, 0.1, "#4B4656");
  }
  function stBat(c) {
    oc(c, "rgba(80,75,95,0.55)");
    ground(c);
    TR(c, [-0.14, -0.3], [-0.26, -0.58], [-0.02, -0.38], "#5C5674");
    TR(c, [0.14, -0.3], [0.26, -0.58], [0.02, -0.38], "#5C5674");
    CC(c, 0, 0.02, 0.34, "#5C5674");
    TR(c, [-0.3, -0.04], [-0.86, -0.36], [-0.66, 0.3], "#7A7294");
    TR(c, [0.3, -0.04], [0.86, -0.36], [0.66, 0.3], "#7A7294");
    bead(c, -0.12, -0.04, 0.05); bead(c, 0.12, -0.04, 0.05);
    cheek(c, -0.22, 0.1, 0.045); cheek(c, 0.22, 0.1, 0.045);
    grin(c, 0, 0.08, 0.04);
  }

  // ---------- christmas ----------
  function stReindeer(c) {
    oc(c, "rgba(120,85,55,0.55)");
    ground(c);
    // Chunky colorable antlers (filled shapes, not thin strokes) — the beams
    // overlap the head so the coloring-page outline stays connected.
    E(c, -0.3, -0.5, 0.06, 0.18, "#A9784D", 0.18);
    E(c, -0.44, -0.6, 0.11, 0.05, "#A9784D", 0.5);
    E(c, -0.2, -0.68, 0.1, 0.05, "#A9784D", -0.45);
    E(c, 0.3, -0.5, 0.06, 0.18, "#A9784D", -0.18);
    E(c, 0.44, -0.6, 0.11, 0.05, "#A9784D", -0.5);
    E(c, 0.2, -0.68, 0.1, 0.05, "#A9784D", 0.45);
    E(c, -0.52, -0.1, 0.14, 0.09, "#C18A5A", 0.4);
    E(c, 0.52, -0.1, 0.14, 0.09, "#C18A5A", -0.4);
    E(c, 0, 0.1, 0.5, 0.48, "#C18A5A");
    E(c, 0, 0.24, 0.2, 0.14, "#F2D4AD");
    bead(c, -0.17, 0, 0.055); bead(c, 0.17, 0, 0.055);
    EF(c, 0, 0.14, 0.07, 0.055, "#E85F5C");
    grin(c, 0, 0.23, 0.05);
    cheek(c, -0.34, 0.14, 0.06); cheek(c, 0.34, 0.14, 0.06);
  }
  function stSnowman(c) {
    oc(c, "rgba(120,145,165,0.55)");
    ground(c);
    CC(c, 0, 0.34, 0.42, "#FDFEFF");
    CC(c, 0, -0.24, 0.32, "#FDFEFF");
    E(c, 0, -0.58, 0.36, 0.08, "#5B6B84");
    E(c, 0, -0.72, 0.22, 0.16, "#5B6B84");
    bead(c, -0.11, -0.28, 0.04); bead(c, 0.11, -0.28, 0.04);
    TR(c, [0.02, -0.18], [0.3, -0.12], [0.02, -0.06], "#F5A25D");
    catMouth(c, 0, -0.08, 0.035);
    E(c, 0, 0.02, 0.34, 0.06, "#E85F5C");
    CC(c, 0, 0.2, 0.035, "#4A3B36"); CC(c, 0, 0.38, 0.035, "#4A3B36");
  }
  function stTree(c) {
    oc(c, "rgba(70,120,75,0.55)");
    ground(c);
    TR(c, [0, -0.78], [-0.42, -0.18], [0.42, -0.18], "#7FC46B");
    TR(c, [0, -0.5], [-0.54, 0.14], [0.54, 0.14], "#69B65E");
    TR(c, [0, -0.18], [-0.66, 0.58], [0.66, 0.58], "#5FA855");
    E(c, 0, 0.7, 0.14, 0.16, "#A9784D");
    CC(c, -0.22, -0.08, 0.055, "#F48FB1"); CC(c, 0.25, 0.12, 0.055, "#FFE082"); CC(c, -0.1, 0.34, 0.055, "#64B5F6");
    TR(c, [0, -0.94], [-0.08, -0.78], [0.08, -0.78], "#FFE082");
  }
  function stSantaBear(c) {
    oc(c, "rgba(120,85,55,0.55)");
    ground(c);
    TR(c, [-0.34, -0.34], [0.12, -0.82], [0.34, -0.3], "#E85F5C");
    CC(c, 0.18, -0.82, 0.09, "#fff");
    E(c, 0, -0.3, 0.42, 0.08, "#fff");
    CC(c, -0.32, -0.26, 0.14, "#B9855C"); CC(c, 0.32, -0.26, 0.14, "#B9855C");
    E(c, 0, 0.12, 0.5, 0.46, "#B9855C");
    E(c, 0, 0.26, 0.2, 0.14, "#F2DBBB");
    bead(c, -0.18, 0.02, 0.055); bead(c, 0.18, 0.02, 0.055);
    EF(c, 0, 0.16, 0.055, 0.045, "#4A3B36");
    grin(c, 0, 0.24, 0.045);
    cheek(c, -0.34, 0.14, 0.06); cheek(c, 0.34, 0.14, 0.06);
  }

  var GROUPS = [
    { slug: "meadow", icon: "🌿", title: "Meadow Pals", accent: "#6FAE6B", bg: "linear-gradient(160deg,#EAF7E9,#F5FBF0)", tagline: "Soft grass, buzzing bees, and lily pads - gentle friends from the flower path." },
    { slug: "barnyard", icon: "🌾", title: "Barnyard Pals", accent: "#D69A3E", bg: "linear-gradient(160deg,#FCF3DC,#FFFBF2)", tagline: "The cheerful farmyard crew, always up early and ready for color." },
    { slug: "snow", icon: "❄️", title: "Snow Pals", accent: "#5B95C9", bg: "linear-gradient(160deg,#E6F1FB,#F5FAFF)", tagline: "Frosty friends for cool blues, cozy scarves, and soft snowy colors." },
    { slug: "den", icon: "🏡", title: "Cozy Den Pals", accent: "#C4708E", bg: "linear-gradient(160deg,#FBEAF0,#FFF6F9)", tagline: "The homebodies who curl up by the fire and round out the family." },
    { slug: "dinosaurs", icon: "🦖", title: "Dinosaur Pals", accent: "#67A65F", bg: "linear-gradient(160deg,#E8F6DD,#FFFDF4)", tagline: "Big roars, tiny smiles, leafy spikes, and prehistoric coloring fun." },
    { slug: "mermaids", icon: "🧜‍♀️", title: "Mermaid Cove", accent: "#48AFC0", bg: "linear-gradient(160deg,#DDF7F7,#F5FDFF)", tagline: "Sea-sparkle pages with shells, waves, tails, and friendly ocean pals." },
    { slug: "halloween", icon: "🎃", title: "Halloween Pals", accent: "#D37A35", bg: "linear-gradient(160deg,#FFF1DE,#F6EEFF)", tagline: "Pumpkins, costumes, moonlight, and sweet little spooky pages." },
    { slug: "christmas", icon: "🎄", title: "Christmas Pals", accent: "#C94F5D", bg: "linear-gradient(160deg,#EAF8EF,#FFF7F7)", tagline: "Holiday pages for red noses, snow days, ornaments, and warm cocoa colors." }
  ];

  var PALS = [
    { slug: "usagi", name: "Usagi", species: "bunny", group: "meadow", draw: stBunny },
    { slug: "fuwa", name: "Fuwa", species: "sheep", group: "meadow", draw: stSheep },
    { slug: "kero", name: "Kero", species: "frog", group: "meadow", draw: stFrog },
    { slug: "hachi", name: "Hachi", species: "bee", group: "meadow", draw: stBee },
    { slug: "miruku", name: "Miruku", species: "cow", group: "barnyard", draw: stCow },
    { slug: "kobo", name: "Kobo", species: "puppy", group: "barnyard", draw: stPuppy },
    { slug: "piyo", name: "Piyo", species: "chick", group: "barnyard", draw: stChick },
    { slug: "kamo", name: "Kamo", species: "duck", group: "barnyard", draw: stDuck },
    { slug: "yuki", name: "Yuki", species: "pom pup", group: "snow", draw: stPom },
    { slug: "kori", name: "Kori", species: "polar bear", group: "snow", draw: stPolar },
    { slug: "panpan", name: "Panpan", species: "panda", group: "snow", draw: stPanda },
    { slug: "pen", name: "Pen", species: "penguin", group: "snow", draw: stPenguin },
    { slug: "mochi", name: "Mochi", species: "cat loaf", group: "den", draw: stCatloaf },
    { slug: "kuma", name: "Kuma", species: "bear", group: "den", draw: stBear },
    { slug: "hamu", name: "Hamu", species: "hamster", group: "den", draw: stHamster },
    { slug: "hari", name: "Hari", species: "hedgehog", group: "den", draw: stHedgehog },
    { slug: "rexi", name: "Rexi", species: "t-rex", group: "dinosaurs", draw: stTrex },
    { slug: "trixie", name: "Trixie", species: "triceratops", group: "dinosaurs", draw: stTricera },
    { slug: "spike", name: "Spike", species: "stegosaurus", group: "dinosaurs", draw: stStego },
    { slug: "ptera", name: "Ptera", species: "pterodactyl", group: "dinosaurs", draw: stPtero },
    { slug: "marina", name: "Marina", species: "mermaid", group: "mermaids", draw: stMermaid },
    { slug: "coral", name: "Coral", species: "seahorse", group: "mermaids", draw: stSeahorse },
    { slug: "jelli", name: "Jelli", species: "jellyfish", group: "mermaids", draw: stJelly },
    { slug: "splash", name: "Splash", species: "dolphin", group: "mermaids", draw: stDolphin },
    { slug: "patch", name: "Patch", species: "pumpkin", group: "halloween", draw: stPumpkin },
    { slug: "boo", name: "Boo", species: "ghost", group: "halloween", draw: stGhost },
    { slug: "miso", name: "Miso", species: "witch cat", group: "halloween", draw: stWitchCat },
    { slug: "nox", name: "Nox", species: "bat", group: "halloween", draw: stBat },
    { slug: "rudy", name: "Rudy", species: "reindeer", group: "christmas", draw: stReindeer },
    { slug: "flurry", name: "Flurry", species: "snowman", group: "christmas", draw: stSnowman },
    { slug: "piney", name: "Piney", species: "christmas tree", group: "christmas", draw: stTree },
    { slug: "noel", name: "Noel", species: "santa bear", group: "christmas", draw: stSantaBear }
  ];

  function bySlug(slug) {
    for (var i = 0; i < PALS.length; i++) if (PALS[i].slug === slug) return PALS[i];
    return null;
  }

  // Draw a pal centered at (x, y) with half-size s. asLines=true renders the
  // coloring-page version (white fills + dark outlines) instead of full color.
  function render(c, x, y, s, draw, asLines) {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    LINE_MODE = !!asLines;
    c.lineWidth = 0.045;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.strokeStyle = asLines ? "#5A4A42" : "rgba(90,74,66,0.85)";
    draw(c);
    LINE_MODE = false;
    c.restore();
  }

  return { GROUPS: GROUPS, PALS: PALS, bySlug: bySlug, render: render };
})();
