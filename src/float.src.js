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
  var ICON_H = 66, HUES = [205, 265, 175, 330, 130];   // one hue per window, so no two on screen ever match
  var FLOW = 1.0, COUNT = 5;
  // Speed-up near the hole: +80% right at the horizon, fading over about 140 px. It scales the inward and sideways motion together, so the window travels the very same path, just faster (the path and the window's bend are untouched).
  var PULL = 0.8, PULL_L = 140;
  var pull = function (r) { return 1 + PULL * Math.exp(-(r - R0) / PULL_L); };
  var GAP = 180;   // minimum animation frames (about 3 s, plus up to 4 s random) between one window entering and the next, so they trickle in instead of arriving together

  var canvas = document.createElement('canvas');
  canvas.className = 'floaters';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  var ctx = canvas.getContext('2d');
  var W = 0, H = 0, dpr = 1, cx = 0, cy = 0, R0 = 40;

//#debug-start
  // ---- Debug mode: add ?debug to the page address (e.g. index.html?debug) ----
  // Space = pause/resume, Right arrow = step one frame, S = slow motion, C = copy the recent frame log, T = twinkle a star now, G = shooting star now.
  // It auto-pauses the instant it detects a glitch (the window turning too fast, or its outline jumping), so you can inspect that exact frame.
  var DBG = /[?&]debug\b/.test(location.search);
  var D = { paused: false, step: false, slow: false, auto: true, thTurn: 2.5, thJump: 7, frame: 0, log: [], glitch: null, info: {} };
  var dbgEl = null;
  if (DBG) {
    dbgEl = document.createElement('div');
    dbgEl.style.cssText = 'position:fixed;right:10px;top:10px;z-index:99999;width:300px;background:rgba(10,10,20,.92);color:#cfe;font:11px/1.45 ui-monospace,Consolas,monospace;padding:10px;border:1px solid #456;border-radius:8px;pointer-events:auto';
    dbgEl.innerHTML = '<div id="dbgtxt" style="white-space:pre"></div><div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">' +
      '<button data-a="pause">Pause (Space)</button><button data-a="step">Step (→)</button><button data-a="slow">Slow (S)</button>' +
      '<button data-a="twinkle">Twinkle (T)</button><button data-a="shoot">Shooting star (G)</button><button data-a="copy">Copy log (C)</button><button data-a="respawn">Respawn</button><button data-a="auto">Auto-freeze: on</button></div>' +
      '<div id="dbgmsg" style="margin-top:6px;color:#fc6"></div>';
    document.body.appendChild(dbgEl);
    dbgEl.addEventListener('click', function (e) { var a = e.target.getAttribute && e.target.getAttribute('data-a'); if (a) act(a); });
    addEventListener('keydown', function (e) {
      if (e.code === 'Space') { e.preventDefault(); act('pause'); }
      else if (e.code === 'ArrowRight') { e.preventDefault(); act('step'); }
      else if (e.key === 's' || e.key === 'S') act('slow');
      else if (e.key === 'c' || e.key === 'C') act('copy');
      else if (e.key === 't' || e.key === 'T') act('twinkle');
      else if (e.key === 'g' || e.key === 'G') act('shoot');
    });
  }
  function act(a) {
    if (a === 'pause') { D.paused = !D.paused; D.glitch = D.paused ? D.glitch : null; }
    else if (a === 'step') { D.paused = true; D.step = true; }
    else if (a === 'slow') D.slow = !D.slow;
    else if (a === 'twinkle') addTwinkle();   // adds one more; they overlap and each finishes
    else if (a === 'shoot') addShot();        // adds one more; they overlap and each finishes
    else if (a === 'auto') { D.auto = !D.auto; dbgEl.querySelector('[data-a=auto]').textContent = 'Auto-freeze: ' + (D.auto ? 'on' : 'off'); }
    else if (a === 'respawn') { D.paused = false; D.glitch = null; tabs.forEach(function (p, i) { seed(p, i * 300); }); }
    else if (a === 'copy') {
      var txt = JSON.stringify({ note: 'Tabvergence float debug: last frames, newest last', viewport: [innerWidth, innerHeight], R0: R0, glitch: D.glitch, log: D.log.slice(-240) });
      var done = function () { dbgEl.querySelector('#dbgmsg').textContent = 'Log copied (' + Math.min(240, D.log.length) + ' frames). Paste it to Claude.'; };
      (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(txt) : Promise.reject()).then(done, function () { window.prompt('Copy this log:', txt); });
    }
  }
  function dbgPanel() {
    if (!DBG) return;
    var t = 'frame ' + D.frame + (D.paused ? '  [PAUSED]' : '') + (D.slow ? '  [slow]' : '') + '\n';
    tabs.forEach(function (p, i) {
      var d = D.info[i];
      t += (p.wait > 0 ? 'tab ' + i + ': waiting\n' : d ? 'tab ' + i + ': r-R0 ' + Math.round(p.r - R0) + '  k ' + d.k.toFixed(2) + '  bend ' + d.bend.toFixed(2) + '\n   w ' + d.w.toFixed(0) + ' h ' + d.h.toFixed(0) + ' heading ' + d.hd.toFixed(1) + '°\n   turn ' + d.turn.toFixed(2) + '°/frame  jump ' + d.jump.toFixed(1) + 'px\n' : 'tab ' + i + '\n');
    });
    dbgEl.querySelector('#dbgtxt').textContent = t;
    if (D.glitch) dbgEl.querySelector('#dbgmsg').textContent = 'GLITCH on tab ' + D.glitch.tab + ' at r-R0=' + Math.round(D.glitch.r - R0) + ': ' + D.glitch.why + '. Press C, then paste the log to Claude.';
  }

//#debug-end
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
  var tabs = [], hueNext = 0, tick = 0, lastLaunch = -1e9;
  function seed(p, delayFrames, first) {
    // enter from the left or right sides (so they pass beside the headline), always starting fully off screen
    var side = Math.random() < 0.5 ? Math.PI : 0;
    p.a = side + (Math.random() - 0.5) * 1.0;
    var M = first ? 30 : 140;   // margin: well past the edge, even after the window's own stretch (the very first window starts just outside, so it is on screen within a second or two)
    var r = 200;
    for (; r < 4000; r += 25) {
      var x = cx + Math.cos(p.a) * r, y = cy + Math.sin(p.a) * r * flatF(r);
      if (x < -M || x > W + M || y < -M || y > H + M) break;
    }
    p.r = r;
    // Depth: 0 = far away (smaller, dimmer, slower), 1 = close (bigger, brighter, faster). Nearer windows are drawn on top.
    p.depth = first ? 0.7 + Math.random() * 0.3 : Math.random();   // the first one is a near, bright one
    p.s = 0.8 + 0.4 * p.depth;
    p.size = 0.7 + 0.4 * p.depth;
    p.dim = 0.6 + 0.4 * p.depth;
    p.hue = HUES[hueNext++ % HUES.length];   // fixed cycle through all five hues
    // Launch clock: wait at least GAP (plus a little random) after the previous window was released
    var want = delayFrames || 0, earliest = lastLaunch + GAP + Math.random() * 240 - tick;
    p.wait = Math.max(want, earliest, 0);
    lastLaunch = tick + p.wait;
    p.prev = null; //#d
    return p;
  }
  locate();
  for (var i = 0; i < COUNT; i++) tabs.push(seed({}, 0, i === 0));   // the launch clock spaces them out, one at a time

  // #FFF4A8 (the black hole's pale yellow) mixed into a window's own hue: amount m (0..1) scaled by wt
  function tint(h, sat, lig, alpha, m, wt, to) {
    var S = sat / 100, L = lig / 100, c = S * Math.min(L, 1 - L);
    var f = function (n) { var k = (n + h / 30) % 12; return L - c * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
    var base = [f(0), f(8), f(4)], t = m * wt; to = to || [255, 244, 168];
    return 'rgba(' + [0, 1, 2].map(function (i) { return Math.round(base[i] * 255 + (to[i] - base[i] * 255) * t); }).join(',') + ',' + alpha + ')';
  }

  function drawTab(p) {
    var k = clamp((p.r - R0) / 280, 0.08, 1);              // 1 = far, small = nearly swallowed
    var sq = Math.pow(k, 0.8);
    var sw2 = (1 - k) * (1 - k);                           // how far swallowed, eased
    var w = 48 * p.size * (0.3 + 0.7 * sq) * (1 + 3 * TAB_STRETCH * sw2);        // stretches along the fall line
    var h = 32 * p.size * (0.22 + 0.78 * sq) / (1 + 0.5 * TAB_STRETCH * sw2);    // and thins across it
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
//#debug-start
    if (DBG) {
      var bpts = shape.body.map(mp), c1 = mp([50, 33]), m1 = mp([75, 33]), m0 = mp([25, 33]);
      var hd = Math.atan2(m1[1] - m0[1], m1[0] - m0[0]) * 180 / Math.PI, turn = 0, jump = 0;
      if (D.moved && p.prev && p.prev.r > p.r) {
        turn = Math.abs(hd - p.prev.hd); if (turn > 180) turn = 360 - turn;
        for (var bi = 0; bi < bpts.length; bi++) { var jx = bpts[bi][0] - p.prev.pts[bi][0] - (c1[0] - p.prev.c[0]), jy = bpts[bi][1] - p.prev.pts[bi][1] - (c1[1] - p.prev.c[1]); jump = Math.max(jump, Math.hypot(jx, jy)); }
      }
      var ti = tabs.indexOf(p);
      if (D.moved) {
        var dT = p.prev ? Math.abs(turn - p.prev.turn) : 0, dJ = p.prev ? Math.abs(jump - p.prev.jump) : 0;
        p.prev = { r: p.r, hd: hd, pts: bpts, c: c1, turn: turn, jump: jump };
        D.log.push({ f: D.frame, tab: ti, rR0: +(p.r - R0).toFixed(1), a: +p.a.toFixed(4), k: +k.toFixed(3), bend: +bend.toFixed(3), w: +w.toFixed(1), h: +h.toFixed(1), heading: +hd.toFixed(2), turn: +turn.toFixed(2), jump: +jump.toFixed(2), spine: [S[0], S[N >> 1], S[N - 1]].map(function (q) { return [+q[0].toFixed(1), +q[1].toFixed(1)]; }) });
        if (D.log.length > 1500) D.log.splice(0, 500);
        // Judge sudden CHANGES in turn rate / outline motion (the swallow at the very end legitimately turns fast, so it is ignored below 60px).
        if (p.r - R0 > 60 && (dT > 0.2 || dJ > 0.4)) D.glitch = D.glitch || { tab: ti, r: p.r, why: dT > 0.2 ? 'turn rate jumped by ' + dT.toFixed(2) + '° in one frame' : 'outline motion jumped by ' + dJ.toFixed(2) + 'px in one frame', frame: D.frame };
      }
      if (D.moved) D.info[ti] = { k: k, bend: bend, w: w, h: h, hd: hd, turn: turn, jump: jump };
      p.dbgDraw = { S: S, bpts: bpts, m0: m0, m1: m1 };
    }
//#debug-end
    ctx.save();
    ctx.globalAlpha = clamp(fade(p.r) * (0.35 + 0.55 * k) * TAB_ALPHA * p.dim, 0, 1);
    // a soft glow on the nearer windows lifts them off the ones behind
    // as the window starts to stretch it turns to the black hole's pale yellow (#FFF4A8): outline and glow fully, the body part-way
    var tm = clamp((sw2 - 0.03) / 0.5, 0, 1); tm = tm * tm * (3 - 2 * tm);
    // the glow turns the black hole's orange (#FF8A1F) and swells: a wider, stronger halo, but still soft and see-through
    var gA = (0.15 + 0.35 * p.depth) * (1 - tm) + 0.95 * tm;
    ctx.shadowColor = tint(p.hue, 90, 60, gA.toFixed(2), tm, 1, [255, 138, 31]); ctx.shadowBlur = 4 + 12 * p.depth + 22 * tm;
    ctx.fillStyle = tint(p.hue, 55, 22, '.9', tm, 0.7);
    ctx.strokeStyle = tint(p.hue, 90, 72, '.95', tm, 1);
    ctx.lineWidth = 1.4; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    var ga0 = ctx.globalAlpha;
    trace(shape.body, true); ctx.fill(); ctx.stroke();
    // orange halo: starts a little before the tint and builds quickly; extra soft passes stack so it reads clearly while the window is still stretching
    var gm = clamp((sw2 + 0.02) / 0.22, 0, 1); gm = gm * gm * (3 - 2 * gm);
    if (gm > 0.01) {
      ctx.globalAlpha = clamp(Math.max(ctx.globalAlpha, 0.55) * gm, 0, 1);
      ctx.shadowColor = 'rgba(255,138,31,' + (0.9 * gm).toFixed(2) + ')';
      var ss0 = ctx.strokeStyle; ctx.strokeStyle = 'rgba(255,138,31,1)';
      for (var gp = 0; gp < 3; gp++) { ctx.shadowBlur = 14 + 16 * gp; ctx.stroke(); }
      ctx.globalAlpha = ga0; ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; ctx.strokeStyle = ss0; ctx.stroke();   // redraw the pale outline over the halo's seed stroke
    }
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';   // glow on the outline only, not on every detail
    trace(shape.divider, false); ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    var ga = ctx.globalAlpha;
    shape.face.forEach(function (f) { ctx.globalAlpha = ga * f.a; trace(f.pts, true); ctx.fill(); });
    ctx.restore();
//#debug-start
    if (DBG && p.dbgDraw) {
      var g = p.dbgDraw;
      ctx.save(); ctx.lineWidth = 1; ctx.strokeStyle = '#ff3df0'; ctx.beginPath();
      g.S.forEach(function (q, i) { i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.stroke();
      ctx.fillStyle = D.glitch && D.glitch.tab === tabs.indexOf(p) ? '#ff4444' : '#7dffb0';
      g.bpts.forEach(function (q, i) { if (i % 3 === 0) ctx.fillRect(q[0] - 1.2, q[1] - 1.2, 2.4, 2.4); });
      ctx.strokeStyle = '#ffd400'; ctx.beginPath(); ctx.moveTo(g.m0[0], g.m0[1]); ctx.lineTo(g.m1[0], g.m1[1]); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '10px monospace'; ctx.fillText(Math.round(p.r - R0), g.m1[0] + 6, g.m1[1] - 6);
      ctx.restore();
    }
//#debug-end
  }


  // ---- Sky: very rarely one of the page's own background stars twinkles, and now and then a shooting star crosses. Both are drawn behind the windows. ----
  // Star positions are read from the page's CSS (the dots in the body background), so a twinkle always lands exactly on a star that is already there.
  var skyStars = [];
  (function () {
    var bg = getComputedStyle(document.body).backgroundImage || '', re = /(\d*\.?\d+)px (\d*\.?\d+)px at (\d*\.?\d+)% (\d*\.?\d+)%, (rgba?\([^)]*\))/g, m;
    while ((m = re.exec(bg))) { var c = m[5].match(/\d+/g); skyStars.push({ x: +m[3] / 100, y: +m[4] / 100, r: Math.max(+m[1], +m[2]), c: c.slice(0, 3).join(',') }); }
  })();
  var TWINKLE_LEN = 110;                                        // frames (about 1.8 s), a slow gentle swell
  var twinkles = [], nextTwinkle = 420 + Math.random() * 480;   // first one after about 7-15 s, then one every 6-15 s
  var shots = [], nextShot = 1500 + Math.random() * 1200;       // first shooting star after about 25-45 s, then one every 30-70 s
  // Each one runs to its end on its own; several can overlap (the debug keys rely on that).
  function addTwinkle() { if (skyStars.length) twinkles.push({ s: skyStars[(Math.random() * skyStars.length) | 0], t: 0 }); }
  function addShot() {
    var ang = (18 + Math.random() * 22) * Math.PI / 180, dir = Math.random() < 0.5 ? 1 : -1;   // shallow downward angle, left to right or right to left
    shots.push({ x: (dir > 0 ? 0.05 + Math.random() * 0.45 : 0.95 - Math.random() * 0.45) * W, y: (0.05 + Math.random() * 0.4) * H,
                 vx: Math.cos(ang) * dir, vy: Math.sin(ang), t: 0, len: 110 + Math.random() * 90, dur: 46 + Math.random() * 14 });
  }
  function drawSky(dt) {
    var body = document.body.getBoundingClientRect();
    if (!twinkles.length && (nextTwinkle -= dt) <= 0) { addTwinkle(); nextTwinkle = 360 + Math.random() * 540; }
    twinkles = twinkles.filter(function (tw) {
      tw.t += dt;
      var u = tw.t / TWINKLE_LEN;
      if (u >= 1) return false;
      var s = tw.s, x = body.left + s.x * body.width, y = body.top + s.y * body.height, col = s.c;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      var e = Math.sin(Math.PI * u); e *= e;                  // soft rise and fall
      var rad = 5 + 6 * e, gl = ctx.createRadialGradient(x, y, 0, x, y, rad);   // a clear but gentle swell: halo, brighter dot, and a faint little cross at the peak
      gl.addColorStop(0, 'rgba(' + col + ',' + (0.4 * e).toFixed(3) + ')'); gl.addColorStop(1, 'rgba(' + col + ',0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(' + col + ',' + (0.95 * e).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(x, y, 1 + 0.9 * e, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(' + col + ',' + (0.45 * e).toFixed(3) + ')'; ctx.lineWidth = 0.8; ctx.lineCap = 'round';
      var arm = 2 + 5 * e; ctx.beginPath(); ctx.moveTo(x - arm, y); ctx.lineTo(x + arm, y); ctx.moveTo(x, y - arm); ctx.lineTo(x, y + arm); ctx.stroke();
      ctx.restore();
      return true;
    });
    if (!shots.length && (nextShot -= dt) <= 0) { addShot(); nextShot = 1800 + Math.random() * 2400; }
    shots = shots.filter(function (sh) {
      sh.t += dt;
      var q = sh.t / sh.dur;
      if (q >= 1) return false;
      var fa = Math.sin(Math.PI * q), dist = 560 * q * (2 - q) * 0.9;              // eases out as it burns away
      var hx = sh.x + sh.vx * dist, hy = sh.y + sh.vy * dist, tl = sh.len * (0.4 + 0.6 * fa);
      var tx = hx - sh.vx * tl, ty = hy - sh.vy * tl;
      var lg = ctx.createLinearGradient(tx, ty, hx, hy);
      lg.addColorStop(0, 'rgba(190,205,255,0)'); lg.addColorStop(0.7, 'rgba(225,232,255,' + (0.35 * fa).toFixed(3) + ')'); lg.addColorStop(1, 'rgba(255,255,255,' + (0.95 * fa).toFixed(3) + ')');
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      ctx.strokeStyle = lg; ctx.lineWidth = 1.7; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
      var hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, 6); hg.addColorStop(0, 'rgba(255,255,255,' + (0.8 * fa).toFixed(3) + ')'); hg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(hx, hy, 6, 0, TAU); ctx.fill();
      ctx.restore();
      return true;
    });
  }

  var last = performance.now();
  function frame(now) {
    var dt = Math.min(2.5, (now - last) / 16.667); last = now;
//#debug-start
    D.moved = true;
    if (DBG) {
      if (D.paused && !D.step) { D.moved = false; dt = 0; }
      else if (D.step) { dt = 1; D.step = false; }
      else if (D.slow) dt *= 0.15;
      if (D.moved) D.frame++;
    }
//#debug-end
    tick += dt;
    locate();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    drawSky(dt);
    var live = [];
    tabs.forEach(function (p) {
      if (p.wait > 0) { p.wait -= dt; return; }
      var g = pull(p.r) * 0.85 * FLOW * dt;
      p.r -= inward(p.r, p.s) * g;
      p.a += swirl(p.r, p.s) * g;
      if (p.r < R0 * 0.9) { seed(p, 120 + Math.random() * 240); return; }   // gone: a short pause, then a new one from off screen
      live.push(p);
    });
    live.sort(function (a, b) { return a.depth - b.depth; }).forEach(drawTab);   // far to near
    if (DBG) { if (D.auto && D.glitch && D.moved && !D.paused) D.paused = true; dbgPanel(); } //#d
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
