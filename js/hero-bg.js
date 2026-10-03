// Hero background: an endless 3D loss landscape, drawn as fine dots, contour lines and soft depth
// shading, seen by a slowly swaying camera. Two deep basins, one on each side of the headline, sit
// in the middle of a much larger round plane that runs past every edge of the hero and fades into
// fog, so the surface never shows an end. Training runs roll downhill on staggered clocks; the coral
// ones find a deep basin and light the red edge when they arrive, the first about two seconds in.
// Falls back to the static image (img/herobg.webp) for reduced motion or when canvas is unavailable.
(function () {
  "use strict";

  var host = document.querySelector(".hero__bg");
  if (!host || !window.requestAnimationFrame) return;
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var canvas = document.createElement("canvas");
  var ctx = canvas.getContext && canvas.getContext("2d");
  if (!ctx) return;

  var css = getComputedStyle(document.documentElement);
  var tok = function (name) { return css.getPropertyValue(name).trim(); };
  var PAL = { paper: tok("--color-paper"), accent: tok("--color-accent"), soft: tok("--color-accent-soft"), coral: tok("--color-coral") };

  var clamp01 = function (v) { return Math.max(0, Math.min(1, v)); };
  var easeIO = function (q) { return q * q * (3 - 2 * q); };
  var transparent = function (color) { return color.replace(/\)\s*$/, " / 0)"); };

  // The loss surface of the static image (tools/render_art.py, _loss), with the bowl flattened far
  // from the centre so the plane can extend well past the view, plus a second deep basin (with a
  // shallow neighbour and a ridge) that the camera keeps on the left.
  var g = function (x, y, cx, cy, w) { return Math.exp(-((x - cx) * (x - cx) + (y - cy) * (y - cy)) / w); };
  var loss = function (x, y) {
    var r2 = x * x + y * y;
    return 0.35 * r2 / (1 + 0.3 * r2) - 0.62 * g(x, y, 0.35, -0.3, 0.06) - 0.32 * g(x, y, -0.5, 0.45, 0.05)
      - 0.26 * g(x, y, 0.55, 0.55, 0.04) - 0.24 * g(x, y, -0.45, -0.5, 0.05) + 0.32 * g(x, y, 0, 0.05, 0.05)
      + 0.2 * g(x, y, 0.6, -0.8, 0.03) + 0.14 * Math.sin(3.2 * x + 0.4) * Math.cos(3 * y - 0.3)
      - 0.7 * g(x, y, -1.15, 1.3, 0.12) - 0.3 * g(x, y, -0.7, 0.9, 0.04) + 0.22 * g(x, y, -1.65, 1.15, 0.05);
  };
  // Gradient descent until the run settles, so the path ends exactly where the run visibly arrives;
  // len holds the distance travelled, so a run can move at an even pace along it.
  var rollPath = function (x, y) {
    var pts = [[x, y]], len = [0];
    for (var s = 0; s < 600; s++) {
      var e = 1e-3, dx = -0.04 * (loss(x + e, y) - loss(x - e, y)) / (2 * e), dy = -0.04 * (loss(x, y + e) - loss(x, y - e)) / (2 * e);
      var step = Math.sqrt(dx * dx + dy * dy);
      if (step < 0.002) break;
      x += dx; y += dy; pts.push([x, y]); len.push(len[len.length - 1] + step);
    }
    return { pts: pts, len: len };
  };

  // World units per surface unit; the plane spans a radius of RIM surface units and fades out from FADE.
  var LX = 2.1, LY = 2.1, LZ = 0.9, RIM = 5.2, FADE = 3.8;
  var rimOf = function (u, v) { return Math.max(0, Math.min(1, (RIM - Math.sqrt(u * u + v * v)) / (RIM - FADE))); };
  var LEVELS = [-0.45, -0.3, -0.15, 0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9];
  // Depth shading: the regions below a ladder of levels, filled one over another, so the shade
  // follows the same curves as the contour lines and deepens toward each basin floor.
  var SHADES = [];
  for (var lv0 = -0.75; lv0 <= 0.31; lv0 += 0.075) SHADES.push(lv0);
  var CASES = { 1: [[0, 3]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 5: [[0, 1], [3, 2]], 6: [[0, 2]], 7: [[3, 2]], 8: [[3, 2]],
    9: [[0, 2]], 10: [[0, 3], [1, 2]], 11: [[1, 2]], 12: [[3, 1]], 13: [[0, 1]], 14: [[0, 3]] };
  var dotN = 0, dots = [], contours = [], shades = [];

  // Marching squares over the whole plane: every crossing of level lv as a segment [u1, v1, u2, v2].
  function crossings(Z, C, lv) {
    var step = 2 * RIM / (C - 1), out = [];
    for (var j = 0; j < C - 1; j++) for (var i = 0; i < C - 1; i++) {
      var k = j * C + i, z = [Z[k], Z[k + 1], Z[k + C + 1], Z[k + C]];
      var idx = (z[0] >= lv) | ((z[1] >= lv) << 1) | ((z[2] >= lv) << 2) | ((z[3] >= lv) << 3);
      if (idx === 0 || idx === 15) continue;
      var u0 = -RIM + i * step, v0 = -RIM + j * step, cu = [0, 1, 1, 0], cv = [0, 0, 1, 1];
      var pt = function (e) {
        var s0 = [0, 1, 3, 0][e], s1 = [1, 2, 2, 3][e], tt = (lv - z[s0]) / ((z[s1] - z[s0]) || 1e-9);
        return [u0 + step * (cu[s0] + (cu[s1] - cu[s0]) * tt), v0 + step * (cv[s0] + (cv[s1] - cv[s0]) * tt)];
      };
      CASES[idx].forEach(function (c) { var p1 = pt(c[0]), p2 = pt(c[1]); out.push([p1[0], p1[1], p2[0], p2[1]]); });
    }
    return out;
  }
  // Chain segments into closed loops (shared crossings meet at the same point).
  function loops(segs) {
    var key = function (u, v) { return Math.round(u * 1e5) + "," + Math.round(v * 1e5); }, at = {}, used = [], out = [];
    segs.forEach(function (s, n) { [key(s[0], s[1]), key(s[2], s[3])].forEach(function (kk) { (at[kk] = at[kk] || []).push(n); }); });
    segs.forEach(function (s, n) {
      if (used[n]) return;
      used[n] = true;
      var ring = [[s[0], s[1]], [s[2], s[3]]], start = key(s[0], s[1]), cur = key(s[2], s[3]);
      while (cur !== start) {
        var next = (at[cur] || []).filter(function (m) { return !used[m]; })[0];
        if (next === undefined) return;  // open chain (cut by the grid edge): not a fillable region
        used[next] = true;
        var t = segs[next], far = key(t[0], t[1]) === cur ? [t[2], t[3]] : [t[0], t[1]];
        ring.push(far); cur = key(far[0], far[1]);
      }
      out.push(ring);
    });
    return out;
  }
  function buildSurface() {
    var C = 220, Z = [], j, i;
    for (j = 0; j < C; j++) for (i = 0; i < C; i++) Z.push(loss(-RIM + 2 * RIM * i / (C - 1), -RIM + 2 * RIM * j / (C - 1)));
    LEVELS.forEach(function (lv) {
      crossings(Z, C, lv).forEach(function (s) {
        var rim = rimOf(s[0], s[1]);
        if (rim > 0) contours.push([s[0], s[1], s[2], s[3], lv, rim]);
      });
    });
    SHADES.forEach(function (lv) {
      shades.push({ lv: lv, alpha: 0.006 + 0.012 * clamp01((0.3 - lv) / 1.05), rings: loops(crossings(Z, C, lv)) });
    });
  }
  function buildDots(n) {
    dotN = n; dots = [];
    for (var j = 0; j < n; j++) for (var i = 0; i < n; i++) {
      var u = -RIM + 2 * RIM * i / (n - 1), v = -RIM + 2 * RIM * j / (n - 1), rim = rimOf(u, v);
      if (rim > 0) dots.push([u, v, loss(u, v), rim]);
    }
  }

  // Each run loops on its own clock: roll downhill for TRAVEL of the cycle, rest while a coral run
  // lights the red edge (GLOW), then fade. The clocks are staggered so a run is almost always moving;
  // coral runs land 5 s apart, alternating between the right and the left basin.
  var PERIOD = 20000, TRAVEL = 0.6, GLOW = 0.25, FADE_OUT = 0.1;
  var runs = [
    [0.8, -0.9, 2000, true], [-1.9, 0.6, 7000, true], [1.2, -0.8, 12000, true], [-2.0, 1.1, 17000, true],
    [-1.6, 0.2, 500, false], [-0.2, 1.5, 4500, false], [0.1, 0.2, 9500, false], [0.6, 1.1, 13500, false], [-0.9, 0.0, 18500, false]
  ].map(function (r) { return { path: rollPath(r[0], r[1]), lands: r[2], deep: r[3] }; });

  var w = 0, h = 0, t0 = performance.now();
  function camera(t) {
    // A slow sway around one framing (not a full turn), so each deep basin keeps its side of the
    // headline. Large enough that the far rim sits above the top edge and the sides run past the
    // view; on narrow screens the two basins line up in the text column instead, one near, one far.
    var wide = w >= 700, S = Math.max(w, 2.2 * h), D = 6.2, pitch = 0.5;
    var yaw = (wide ? 0.8 : -0.75) + 0.2 * Math.sin(t * 2 * Math.PI / 90000);
    var cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    var cx = (wide ? 0.74 : 0.5) * w, cy = (wide ? 0.58 : 0.52) * h;
    return function (x, y, z) {
      var X = x * cyw - y * syw, Y = x * syw + y * cyw, depth = Y * cp - z * sp + D, up = Y * sp + z * cp;
      return [cx + S * X / depth, cy - S * up / depth, depth];
    };
  }

  function strokeBuckets(segs) {
    var buckets = [];
    for (var b = 0; b < 12; b++) buckets.push([]);
    segs.forEach(function (s) { if (s[4] > 0.01) buckets[Math.min(11, Math.floor(s[4] * 12 / 0.8))].push(s); });
    ctx.strokeStyle = PAL.accent; ctx.lineWidth = 0.8;
    buckets.forEach(function (list, q) {
      if (!list.length) return;
      ctx.globalAlpha = (q + 0.5) * 0.8 / 12; ctx.beginPath();
      list.forEach(function (s) { ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); });
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  var fogOf = function (d) { return (0.38 + 0.62 * clamp01(1 - (d - 4) / 10)) * clamp01((d - 1.2) / 1.4); };
  function drawLand(cam) {
    // 1. Depth shading: each level's loops filled even-odd, so a ridge inside a basin stays a hole.
    ctx.fillStyle = PAL.accent;
    shades.forEach(function (s) {
      if (!s.rings.length) return;
      ctx.globalAlpha = s.alpha; ctx.beginPath();
      s.rings.forEach(function (ring) {
        ring.forEach(function (p, n) {
          var q = cam(p[0] * LX, p[1] * LY, s.lv * LZ);
          if (n) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]);
        });
        ctx.closePath();
      });
      ctx.fill("evenodd");
    });
    // 2. Contour lines of the loss, traced once and re-projected each frame.
    var segs = contours.map(function (c) {
      var p1 = cam(c[0] * LX, c[1] * LY, c[4] * LZ), p2 = cam(c[2] * LX, c[3] * LY, c[4] * LZ);
      return [p1[0], p1[1], p2[0], p2[1], fogOf(p1[2]) * c[5] * 0.6];
    });
    strokeBuckets(segs);
    // 3. A dense lattice of small dots, larger and stronger near the camera.
    var D = [], b;
    for (b = 0; b < 10; b++) D.push([]);
    dots.forEach(function (d) {
      var p = cam(d[0] * LX, d[1] * LY, d[2] * LZ), al = fogOf(p[2]) * d[3] * 0.8;
      if (al < 0.03) return;
      var r = 0.45 + 1.5 * clamp01((7 - p[2]) / 5);
      D[Math.min(9, Math.floor(al * 10 / 0.8))].push([p[0] - r, p[1] - r, 2 * r]);
    });
    ctx.fillStyle = PAL.accent;
    D.forEach(function (list, q) {
      if (!list.length) return;
      ctx.globalAlpha = (q + 0.5) * 0.08; ctx.beginPath();
      list.forEach(function (d) { ctx.rect(d[0], d[1], d[2], d[2]); });
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  // The run's dashed trail up to fraction q of its length (an even pace on screen), and its head.
  function drawRun(cam, path, q, color, alpha) {
    var pts = path.pts, len = path.len, goal = clamp01(q) * len[len.length - 1];
    if (goal <= 0 || pts.length < 2) return null;
    var at = function (u, v) { return cam(u * LX, v * LY, loss(u, v) * LZ + 0.02); };
    var head = at(pts[0][0], pts[0][1]), i;
    ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.5 * alpha; ctx.setLineDash([4, 4]); ctx.beginPath();
    ctx.moveTo(head[0], head[1]);
    for (i = 1; i < pts.length && len[i] <= goal; i++) { head = at(pts[i][0], pts[i][1]); ctx.lineTo(head[0], head[1]); }
    if (i < pts.length) {
      var k = (goal - len[i - 1]) / (len[i] - len[i - 1]);
      head = at(pts[i - 1][0] + k * (pts[i][0] - pts[i - 1][0]), pts[i - 1][1] + k * (pts[i][1] - pts[i - 1][1]));
      ctx.lineTo(head[0], head[1]);
    }
    ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = 0.8 * alpha; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(head[0], head[1], 2.4, 0, 6.283); ctx.fill();
    ctx.globalAlpha = 1;
    return head;
  }

  function edge(x, y, k) {
    if (k < 0.02) return;
    var r = 46, grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, PAL.coral); grad.addColorStop(1, transparent(PAL.coral));
    ctx.globalAlpha = 0.28 * k; ctx.fillStyle = grad; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    ctx.globalAlpha = 0.7 * k; ctx.strokeStyle = PAL.coral; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.arc(x, y, 6 + 4 * (1 - k), 0, 6.283); ctx.stroke();
    ctx.globalAlpha = 0.85 * k; ctx.fillStyle = PAL.coral; ctx.beginPath(); ctx.arc(x, y, 2.4, 0, 6.283); ctx.fill();
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    var t = now - t0;
    ctx.globalAlpha = 1; ctx.fillStyle = PAL.paper; ctx.fillRect(0, 0, w, h);
    var cam = camera(t);
    drawLand(cam);
    var glows = [];
    runs.forEach(function (run) {
      var c = (((t - run.lands) / PERIOD + TRAVEL) % 1 + 1) % 1;
      if (c >= TRAVEL && t - (c - TRAVEL) * PERIOD < 0) return;  // landed before the page opened: wait for the next round
      var alpha = c < TRAVEL + GLOW ? 1 : clamp01(1 - (c - TRAVEL - GLOW) / FADE_OUT);
      if (alpha <= 0) return;
      var head = drawRun(cam, run.path, easeIO(Math.min(1, c / TRAVEL)), run.deep ? PAL.coral : PAL.soft, alpha);
      if (head && run.deep && c >= TRAVEL && c < TRAVEL + GLOW) glows.push([head, Math.sin(Math.PI * (c - TRAVEL) / GLOW)]);
    });
    glows.forEach(function (gl) { edge(gl[0][0], gl[0][1], gl[1]); });
  }

  function resize() {
    var dpr = Math.min(1.5, window.devicePixelRatio || 1);
    w = host.clientWidth; h = host.clientHeight;
    var n = w < 700 ? 110 : 170;
    if (n !== dotN) buildDots(n);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    frame(performance.now());
  }

  buildSurface();
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);
  host.classList.add("is-live");
  resize();
  if (window.ResizeObserver) new ResizeObserver(resize).observe(host); else window.addEventListener("resize", resize);

  var running = false, raf = 0;
  var last = 0;
  function loop(t) {
    if (t - last >= 32) { last = t; frame(t); }  // the motion is slow; 30 fps is plenty and halves the work
    if (running) raf = requestAnimationFrame(loop);
  }
  function setRunning(on) {
    if (on && !running) { running = true; raf = requestAnimationFrame(loop); }
    else if (!on && running) { running = false; cancelAnimationFrame(raf); }
  }
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (entries) { setRunning(entries[0].isIntersecting); }).observe(host);
  } else {
    setRunning(true);
  }
})();
