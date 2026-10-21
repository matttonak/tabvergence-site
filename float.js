// Browser windows get funneled into the black hole, using the same method as the extension's welcome page:
// each window is bent along the flow path the star streaks follow, pinched to a point at the end facing the hole,
// and stretched and thinned as it is swallowed. Decorative only.
(function () {
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var planet = document.querySelector('.bh');
  if (!planet) return;

  var TAU = Math.PI * 2;
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  // --- same constants as the extension (space.js) ---
  var TAB_STRETCH = 3, TAB_BEND = 1.75, TAB_ALPHA = 1.3;   // alpha: 1 = as designed (the extension uses 2); lower here to stay quiet
  var ICON_H = 66, HUES = [205, 265, 175, 330];
  var FLOW = 1.0, COUNT = 2;

  var canvas = document.createElement('canvas');
  canvas.className = 'floaters';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  var ctx = canvas.getContext('2d');
  var W = 0, H = 0, dpr = 1, cx = 0, cy = 0, R0 = 40;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  }
  resize();
  addEventListener('resize', resize);

  function locate() {
    var r = planet.getBoundingClientRect();
    cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    R0 = clamp(r.width * 30 / 168, 24, 60);    // the event horizon is 30 of the logo's 168 units
  }

  // Inward speed and swirl speed grow as things fall closer (like gravity does).
  var inward = function (r, s) { return s * (0.3 + 260 / (r + 20)); };
  var swirl = function (r, s) { return Math.min(0.12, (s * 200) / (r * r)); };
  var fade = function (r) { return clamp((r - R0) / (R0 * 0.9), 0, 1); };
  // Vertical squash of the whole scene. Eased (zero slope at r = 320) rather than a hard min(), whose corner bent every window's heading as it crossed that radius.
  var flatF = function (r) { var u = Math.min(1, r / 320); return 0.6 + 0.4 * u * u * (3 - 2 * u); };

  // --- the window shape (same 100 x 66 geometry as the extension), flattened to points once ---
  var shape = null;
  function buildShape() {
    var sample = function (d, step) {
      var el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      el.setAttribute('d', d);
      var L = el.getTotalLength(), pts = [];
      for (var l = 0; l < L; l += step) { var q = el.getPointAtLength(l); pts.push([q.x, q.y]); }
      var e = el.getPointAtLength(L); pts.push([e.x, e.y]);
      return pts;
    };
    var rr = function (x, y, w, h, r) { return 'M' + (x + r) + ' ' + y + 'H' + (x + w - r) + 'A' + r + ' ' + r + ' 0 0 1 ' + (x + w) + ' ' + (y + r) + 'V' + (y + h - r) + 'A' + r + ' ' + r + ' 0 0 1 ' + (x + w - r) + ' ' + (y + h) + 'H' + (x + r) + 'A' + r + ' ' + r + ' 0 0 1 ' + x + ' ' + (y + h - r) + 'V' + (y + r) + 'A' + r + ' ' + r + ' 0 0 1 ' + (x + r) + ' ' + y + 'Z'; };
    var circ = function (x, y, r) { return 'M' + (x - r) + ' ' + y + 'a' + r + ' ' + r + ' 0 1 0 ' + (2 * r) + ' 0a' + r + ' ' + r + ' 0 1 0 ' + (-2 * r) + ' 0Z'; };
    shape = {
      body: sample(rr(1, 1, 98, 64, 5), 1.5),
      divider: sample('M1 18.5H99', 1.5),
      face: [
        // tab strip: an active tab (lighter body, dot, title) then two more tabs and a "+"
        { pts: sample(rr(4, 4.5, 28, 14, 3), 1.2), a: .16 },
        { pts: sample(circ(10, 11.2, 2.8), 1.0), a: .95 },
        { pts: sample(rr(16, 9.4, 12, 3.6, 1.8), 1.0), a: .5 },
        { pts: sample(rr(34, 7.5, .9, 7.5, .45), 1.0), a: .4 },
        { pts: sample(circ(40, 11.2, 2.3), 1.0), a: .55 },
        { pts: sample(rr(45, 9.6, 11, 3.2, 1.6), 1.0), a: .35 },
        { pts: sample(rr(61, 7.5, .9, 7.5, .45), 1.0), a: .4 },
        { pts: sample(circ(67, 11.2, 2.3), 1.0), a: .55 },
        { pts: sample(rr(72, 9.6, 10, 3.2, 1.6), 1.0), a: .35 },
        { pts: sample(rr(89.2, 10.6, 5.6, 1.3, .65), 1.0), a: .6 },
        { pts: sample(rr(91.35, 8.45, 1.3, 5.6, .65), 1.0), a: .6 },
        // page content
        { pts: sample(rr(10, 28, 55, 4.6, 2.3), 1.2), a: .35 },
        { pts: sample(rr(10, 38, 70, 4.6, 2.3), 1.2), a: .35 },
        { pts: sample(rr(10, 48, 40, 4.6, 2.3), 1.2), a: .35 }
      ]
    };
  }
  buildShape();

  // --- windows ---
  var tabs = [], hueNext = 0;
  function seed(p, delayFrames) {
    // enter from the left or right sides (so they pass beside the headline), always starting fully off screen
    var side = Math.random() < 0.5 ? Math.PI : 0;
    p.a = side + (Math.random() - 0.5) * 1.0;
    var M = 140;   // margin: well past the edge, even after the window's own stretch
    var r = 200;
    for (; r < 4000; r += 25) {
      var x = cx + Math.cos(p.a) * r, y = cy + Math.sin(p.a) * r * flatF(r);
      if (x < -M || x > W + M || y < -M || y > H + M) break;
    }
    p.r = r;
    p.s = 0.75 + Math.random() * 0.4;
    p.hue = HUES[hueNext++ % HUES.length];   // fixed cycle: blue, violet, teal, pink, repeat, so no two on screen ever match
    p.wait = delayFrames || 0;
    return p;
  }
  locate();
  for (var i = 0; i < COUNT; i++) tabs.push(seed({}, i * 900));   // second one starts about 15 seconds later

  function drawTab(p) {
    var k = clamp((p.r - R0) / 280, 0.08, 1);              // 1 = far, small = nearly swallowed
    var sq = Math.pow(k, 0.8);
    var sw2 = (1 - k) * (1 - k);                           // how far swallowed, eased
    var w = 48 * (0.3 + 0.7 * sq) * (1 + 3 * TAB_STRETCH * sw2);        // stretches along the fall line
    var h = 32 * (0.22 + 0.78 * sq) / (1 + 0.5 * TAB_STRETCH * sw2);    // and thins across it
    var pinch = 0.1 + 0.9 * sq;                            // hole-facing end narrows to a point
    var halfH = function (px) { return (h / 2) * (1 - (1 - pinch) * ((px + w / 2) / w)); };
    var scr = function (r, a) { return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * flatF(r)]; };
    // Spine: the window's own path through the flow, walked forward (toward the hole) and backward,
    // with the same motion the star streaks use, so it bends the way they do.
    // Far out the spine follows exactly the window's real direction of travel (so it is lined up from the moment it appears); the extra curl eases in only as it is swallowed.
    var u = clamp(sw2 / 0.5, 0, 1), bend = 1 + (TAB_BEND - 1) * u * u * (3 - 2 * u);
    var walk = function (dir) {
      var r = p.r, a = p.a, acc = 0, prev = scr(r, a), out = [prev];
      for (var i = 0; i < 70 && acc < w / 2; i++) {
        var v = inward(r, p.s), sp = swirl(r, p.s) * bend;
        var dt = Math.min(3, 2 / (Math.hypot(v, r * sp) + 1e-4));
        r -= dir * v * dt; a += dir * sp * dt;
        if (r < R0 * 0.5) break;
        var q = scr(r, a); acc += Math.hypot(q[0] - prev[0], q[1] - prev[1]); out.push(q); prev = q;
      }
      return out;
    };
    var head = walk(1), tail = walk(-1).reverse();
    var raw = tail.concat(head.slice(1));
    var cum = [0];
    for (var i = 1; i < raw.length; i++) cum.push(cum[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]));
    var T = cum[cum.length - 1], c0 = cum[tail.length - 1];
    if (raw.length < 2 || T < 0.5) return;
    var N = 64, S = [];
    // Point at distance d along the spine; past either end it carries straight on along the end direction (no collapsing).
    var at = function (d) {
      if (d <= 0 || d >= T) {
        var e = d <= 0 ? 0 : raw.length - 1, o = d <= 0 ? 1 : raw.length - 2, ex = raw[e][0] - raw[o][0], ey = raw[e][1] - raw[o][1], en = Math.hypot(ex, ey) || 1;
        var over = d <= 0 ? -d : d - T;
        return [raw[e][0] + ex / en * over, raw[e][1] + ey / en * over];
      }
      var j = 0; while (j < raw.length - 2 && cum[j + 1] < d) j++;
      var f = cum[j + 1] > cum[j] ? clamp((d - cum[j]) / (cum[j + 1] - cum[j]), 0, 1) : 0;
      return [raw[j][0] + (raw[j + 1][0] - raw[j][0]) * f, raw[j][1] + (raw[j + 1][1] - raw[j][1]) * f];
    };
    for (var i = 0; i < N; i++) S.push(at(c0 - w / 2 + (i / (N - 1)) * w));
    // Smooth tangents (average of neighbours) so the sides of the window curve instead of stepping in facets.
    var TN = S.map(function (q, i) {
      var a0 = S[Math.max(0, i - 2)], b0 = S[Math.min(N - 1, i + 2)], tx = b0[0] - a0[0], ty = b0[1] - a0[1], n = Math.hypot(tx, ty) || 1;
      return [tx / n, ty / n];
    });
    var mp = function (q) {
      var px = (q[0] / 100 - 0.5) * w, py = (q[1] / ICON_H - 0.5) * 2 * halfH(px);
      var t = clamp((px + w / 2) / w, 0, 1) * (N - 1), i = Math.min(N - 2, Math.floor(t)), f = t - i;
      var tx = TN[i][0] + (TN[i + 1][0] - TN[i][0]) * f, ty = TN[i][1] + (TN[i + 1][1] - TN[i][1]) * f, n = Math.hypot(tx, ty) || 1; tx /= n; ty /= n;
      return [S[i][0] + (S[i + 1][0] - S[i][0]) * f - ty * py, S[i][1] + (S[i + 1][1] - S[i][1]) * f + tx * py];
    };
    var trace = function (pts, close) { ctx.beginPath(); pts.forEach(function (q, i) { var m = mp(q); i ? ctx.lineTo(m[0], m[1]) : ctx.moveTo(m[0], m[1]); }); if (close) ctx.closePath(); };
    ctx.save();
    ctx.globalAlpha = clamp(fade(p.r) * (0.35 + 0.55 * k) * TAB_ALPHA, 0, 1);
    ctx.fillStyle = 'hsla(' + p.hue + ', 55%, 22%, .9)';
    ctx.strokeStyle = 'hsla(' + p.hue + ', 90%, 72%, .95)';
    ctx.lineWidth = 1.4; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    trace(shape.body, true); ctx.fill(); ctx.stroke();
    trace(shape.divider, false); ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    var ga = ctx.globalAlpha;
    shape.face.forEach(function (f) { ctx.globalAlpha = ga * f.a; trace(f.pts, true); ctx.fill(); });
    ctx.restore();
  }

  var last = performance.now();
  function frame(now) {
    var dt = Math.min(2.5, (now - last) / 16.667); last = now;
    locate();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    tabs.forEach(function (p) {
      if (p.wait > 0) { p.wait -= dt; return; }
      p.r -= inward(p.r, p.s) * 0.85 * FLOW * dt;
      p.a += swirl(p.r, p.s) * 0.85 * FLOW * dt;
      if (p.r < R0 * 0.9) { seed(p, 120 + Math.random() * 240); return; }   // gone: a short pause, then a new one from off screen
      drawTab(p);
    });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
