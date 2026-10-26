// The sky over Home (version 4, 27 October 2026). Jay: "sunrises are beautiful, and the sun in general - please
// ensure it is in the app." Everything here is computed for Crick, Northamptonshire, from the real time: where the
// sun and moon are, how high, the moon's phase, and the colour of the light. Nothing is fetched.
//
// Sky.state(date)  -> {sunAlt, sunAz, sunrise, sunset, moonAlt, moonAz, moonPhase, moonFraction, mode, palette}
// Sky.mount(canvas, getDate) starts drawing; Sky.pause() / Sky.resume() for when Home is hidden.
(function () {
  "use strict";
  var LAT = 52.383, LNG = -1.133;               // Crick
  var PI = Math.PI, rad = PI / 180, dayMs = 864e5, J1970 = 2440588, J2000 = 2451545, e = rad * 23.4397;

  // ---------- where the sun and moon are (low-precision formulas from the Astronomical Almanac) ----------
  function toDays(d) { return d.valueOf() / dayMs - 0.5 + J1970 - J2000; }
  function ra(l, b) { return Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l)); }
  function dec(l, b) { return Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l)); }
  function sidereal(d, lw) { return rad * (280.16 + 360.9856235 * d) - lw; }
  function alt(H, phi, de) { return Math.asin(Math.sin(phi) * Math.sin(de) + Math.cos(phi) * Math.cos(de) * Math.cos(H)); }
  function az(H, phi, de) { return Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(de) * Math.cos(phi)); }
  function sunCoords(d) {
    var M = rad * (357.5291 + 0.98560028 * d);
    var C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
    var L = M + C + rad * 102.9372 + PI;
    return { dec: dec(L, 0), ra: ra(L, 0) };
  }
  function moonCoords(d) {
    var L = rad * (218.316 + 13.176396 * d), M = rad * (134.963 + 13.064993 * d), F = rad * (93.272 + 13.22935 * d);
    var l = L + rad * 6.289 * Math.sin(M), b = rad * 5.128 * Math.sin(F), dist = 385001 - 20905 * Math.cos(M);
    return { ra: ra(l, b), dec: dec(l, b), dist: dist };
  }
  function sunPos(date) {
    var lw = rad * -LNG, phi = rad * LAT, d = toDays(date), c = sunCoords(d), H = sidereal(d, lw) - c.ra;
    return { alt: alt(H, phi, c.dec) / rad, az: az(H, phi, c.dec) / rad };
  }
  function moonPos(date) {
    var lw = rad * -LNG, phi = rad * LAT, d = toDays(date), c = moonCoords(d), H = sidereal(d, lw) - c.ra;
    var h = alt(H, phi, c.dec); h = h + rad * 0.017 / Math.tan(h + rad * 10.26 / (h + rad * 5.10)); // refraction
    return { alt: h / rad, az: az(H, phi, c.dec) / rad };
  }
  function moonIllum(date) {
    var d = toDays(date), s = sunCoords(d), m = moonCoords(d), sdist = 149598000;
    var phi = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
    var inc = Math.atan2(sdist * Math.sin(phi), m.dist - sdist * Math.cos(phi));
    var ang = Math.atan2(Math.cos(s.dec) * Math.sin(s.ra - m.ra), Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra));
    return { fraction: (1 + Math.cos(inc)) / 2, phase: 0.5 + 0.5 * inc * (ang < 0 ? -1 : 1) / PI };
  }
  var riseCache = {};
  function riseSet(date) {                        // scan the day in two-minute steps for the sun crossing -0.833 degrees
    var k = date.toDateString(); if (riseCache[k]) return riseCache[k];
    var t0 = new Date(date); t0.setHours(0, 0, 0, 0);
    var rise = null, set = null, noon = null, best = -99, prev = sunPos(t0).alt;
    for (var m = 2; m <= 1440; m += 2) {
      var t = new Date(t0.getTime() + m * 6e4), a = sunPos(t).alt;
      if (prev < -0.833 && a >= -0.833 && !rise) rise = t;
      if (prev >= -0.833 && a < -0.833) set = t;
      if (a > best) { best = a; noon = t; }
      prev = a;
    }
    return (riseCache[k] = { rise: rise, set: set, noon: noon, peak: best });
  }

  // ---------- the colour of the light, keyed by the sun's height in degrees ----------
  // z zenith, u upper sky, h horizon, g glow, ga glow strength, f/m/n far, middle and near hills, p the page below.
  var KEYS = [
    { a: -18, z: "#02040b", u: "#070b1c", h: "#0f1633", g: "#2a2f5c", ga: 0.0, f: "#0d1328", m: "#0a0f21", n: "#070b18", p: "#0a0f20" },
    { a: -11, z: "#040917", u: "#0d1534", h: "#262a58", g: "#5a4a86", ga: 0.12, f: "#141a38", m: "#0f1530", n: "#0b1025", p: "#0d1228" },
    { a: -6, z: "#0b1534", u: "#28336b", h: "#8e5a86", g: "#e0789a", ga: 0.32, f: "#2a2648", m: "#1f1d3c", n: "#171530", p: "#141633" },
    { a: -2, z: "#182a5c", u: "#544f92", h: "#f2897a", g: "#ff9a6a", ga: 0.55, f: "#4a3a5e", m: "#3a2d4d", n: "#2b2140", p: "#221a33" },
    { a: 1, z: "#2a4386", u: "#b07fae", h: "#ffa06a", g: "#ffa85e", ga: 0.85, f: "#8a5f74", m: "#6a4862", n: "#4f3550", p: "#f6dcc8" },
    { a: 5, z: "#4472b4", u: "#dba6aa", h: "#ffcc8e", g: "#ffc47a", ga: 0.7, f: "#9a7f88", m: "#7d6878", n: "#5f5168", p: "#fbe8d6" },
    { a: 12, z: "#5794d4", u: "#b4d4ef", h: "#f6e7d0", g: "#fff0c4", ga: 0.38, f: "#a3aaa6", m: "#7f8c80", n: "#647463", p: "#f7f2e9" },
    { a: 30, z: "#3d86d2", u: "#90c2ec", h: "#dcecf8", g: "#fffbe6", ga: 0.26, f: "#a9bab7", m: "#81a088", n: "#61806a", p: "#f1f5f8" }
  ];
  function hex(c) { var n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function mix(a, b, t) { var x = hex(a), y = hex(b); return "#" + [0, 1, 2].map(function (i) { var v = Math.round(x[i] + (y[i] - x[i]) * t); return ("0" + v.toString(16)).slice(-2); }).join(""); }
  function rgba(c, al) { var x = hex(c); return "rgba(" + x[0] + "," + x[1] + "," + x[2] + "," + al + ")"; }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function paletteFor(a, evening) {
    var i = 0; while (i < KEYS.length - 2 && a > KEYS[i + 1].a) i++;
    var A = KEYS[i], B = KEYS[i + 1], t = Math.max(0, Math.min(1, (a - A.a) / (B.a - A.a))); t = smooth(t);
    var p = {}; ["z", "u", "h", "g", "f", "m", "n"].forEach(function (k) { p[k] = mix(A[k], B[k], t); });
    p.ga = A.ga + (B.ga - A.ga) * t;
    // the page below the hills changes mode at sunset rather than blending through a muddy middle
    var light = a > -1;
    p.p = light ? mix(KEYS[4].p, KEYS[7].p, Math.max(0, Math.min(1, (a - 1) / 29))) : mix(KEYS[0].p, KEYS[3].p, Math.max(0, Math.min(1, (a + 18) / 17)));
    if (evening && a < 10 && a > -8) {          // sunsets run warmer and pinker than sunrises
      var w = 0.35 * (1 - Math.abs(a - 1) / 9);
      p.h = mix(p.h, "#ff7a59", Math.max(0, w)); p.g = mix(p.g, "#ff8a5b", Math.max(0, w * 0.8)); p.u = mix(p.u, "#c46a8e", Math.max(0, w * 0.5));
    }
    p.mode = light ? "light" : "dark";
    return p;
  }

  function state(date) {
    var s = sunPos(date), m = moonPos(date), il = moonIllum(date), rs = riseSet(date);
    var evening = rs.noon ? date > rs.noon : date.getHours() >= 12;
    return { sunAlt: s.alt, sunAz: s.az, moonAlt: m.alt, moonAz: m.az, moonPhase: il.phase, moonFraction: il.fraction,
      sunrise: rs.rise, sunset: rs.set, noon: rs.noon, peak: rs.peak, evening: evening, palette: paletteFor(s.alt, evening),
      mode: s.alt > -1 ? "light" : "dark" };
  }

  // ---------- drawing ----------
  var cv, cx, W = 0, H = 0, dpr = 1, getDate, raf = 0, running = false, last = 0, stars = [], clouds = [], hills = [];
  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function seeded(n) { var x = Math.sin(n * 9301 + 49297) * 233280; return x - Math.floor(x); }
  function build() {
    stars = []; for (var i = 0; i < 150; i++) stars.push({ x: seeded(i), y: Math.pow(seeded(i + 500), 1.4), r: 0.4 + seeded(i + 900) * 1.2, tw: seeded(i + 1300) * 6.28, sp: 0.6 + seeded(i + 1700) * 1.6 });
    clouds = []; for (var c = 0; c < 4; c++) clouds.push(cloudSprite(c));
    hills = [0, 1, 2].map(function (layer) {        // rolling Northamptonshire fields, nearer layers lower and bolder
      var pts = [], amp = [10, 16, 22][layer], base = [0, 16, 34][layer], f1 = [2.2, 1.6, 1.15][layer], ph = [0.7, 2.1, 4.0][layer];
      for (var x = 0; x <= 60; x++) { var u = x / 60; pts.push([u, base - amp * (0.6 * Math.sin(u * PI * f1 + ph) + 0.4 * Math.sin(u * PI * f1 * 2.3 + ph * 1.7))]); }
      return pts;
    });
  }
  function cloudSprite(n) {                      // long, soft bands of cloud rather than puffs
    var w = 420, h = 90, c = document.createElement("canvas"); c.width = w; c.height = h;
    var g = c.getContext("2d");
    for (var i = 0; i < 30; i++) {
      var u = seeded(n * 60 + i), px = 50 + u * (w - 100), py = 45 + (seeded(n * 60 + i + 30) - 0.5) * 22 * Math.sin(u * PI);
      var r = (14 + seeded(n * 60 + i + 9) * 26) * (0.55 + 0.45 * Math.sin(u * PI));
      g.save(); g.translate(px, py); g.scale(2.3, 0.62);
      var rg = g.createRadialGradient(0, 0, 0, 0, 0, r); rg.addColorStop(0, "rgba(0,0,0,0.30)"); rg.addColorStop(0.6, "rgba(0,0,0,0.14)"); rg.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = rg; g.beginPath(); g.arc(0, 0, r, 0, 2 * PI); g.fill(); g.restore();
    }
    return { img: c, w: w, h: h, x: seeded(n + 70), y: [0.18, 0.42, 0.62, 0.3][n] + seeded(n + 80) * 0.08, s: [0.9, 0.7, 1.05, 0.55][n], speed: 0.4 + seeded(n + 100) * 0.8 };
  }
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    var r = cv.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  }
  function horizonY() { return Math.round(Math.max(250, Math.min(320, H * 0.36))); }
  function place(altDeg, azDeg, hy, peak) {         // looking south: east on the left, west on the right
    var x = W / 2 + (azDeg / 125) * (W / 2), top = Math.min(hy - 60, 178);   // stays below the greeting
    var y = hy - (altDeg / Math.max(18, peak || 25)) * (hy - top);
    return [Math.max(26, Math.min(W - 26, x)), y];
  }
  function draw(t) {
    var date = getDate(), st = state(date), p = st.palette, hy = horizonY(), time = t / 1000;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // sky
    var g = cx.createLinearGradient(0, 0, 0, hy + 10);
    g.addColorStop(0, p.z); g.addColorStop(0.55, p.u); g.addColorStop(1, p.h);
    cx.fillStyle = g; cx.fillRect(0, 0, W, hy + 40);
    // stars
    var night = Math.max(0, Math.min(1, (-st.sunAlt - 4) / 8));
    if (night > 0) {
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i], tw = still ? 0.8 : 0.55 + 0.45 * Math.sin(time * s.sp + s.tw);
        cx.fillStyle = "rgba(255,255,255," + (night * tw * (0.35 + s.r * 0.4)).toFixed(3) + ")";
        cx.beginPath(); cx.arc(s.x * W, s.y * (hy - 20), s.r, 0, 2 * PI); cx.fill();
      }
    }
    var sp = place(st.sunAlt, st.sunAz, hy, st.peak), sx = sp[0], sy = sp[1], low = Math.max(0, Math.min(1, (10 - st.sunAlt) / 12));
    // the glow the sun throws across the whole sky, strongest along the horizon when it is low
    if (p.ga > 0.01 && st.sunAlt > -14) {
      var gy = Math.min(sy, hy + 30), big = cx.createRadialGradient(sx, gy, 0, sx, gy, W * 1.1);
      big.addColorStop(0, rgba(p.g, p.ga * 0.85)); big.addColorStop(0.35, rgba(p.g, p.ga * 0.35)); big.addColorStop(1, rgba(p.g, 0));
      cx.fillStyle = big; cx.fillRect(0, 0, W, hy + 40);
      if (low > 0) {
        cx.save(); cx.translate(sx, hy); cx.scale(1.9, 0.42);
        var band = cx.createRadialGradient(0, 0, 0, 0, 0, W * 0.7);
        band.addColorStop(0, rgba(p.g, 0.75 * low * Math.min(1, p.ga + 0.2))); band.addColorStop(0.5, rgba(p.g, 0.28 * low)); band.addColorStop(1, rgba(p.g, 0));
        cx.fillStyle = band; cx.beginPath(); cx.arc(0, 0, W * 0.7, 0, 2 * PI); cx.fill(); cx.restore();
      }
    }
    // the moon, with its real phase
    var mVis = st.moonAlt > -1 && st.sunAlt < 6;
    if (mVis) drawMoon(st, hy, night);
    // clouds, lit by wherever the sun is
    drawClouds(st, p, hy, time, sx);
    // the sun: rays, halo, corona, disc
    if (st.sunAlt > -3) drawSun(sx, sy, st, p, time, low);
    // the fields
    var cols = [p.f, p.m, p.n];
    for (var l = 0; l < 3; l++) {
      var pts = hills[l], base = hy + [4, 10, 18][l];
      cx.beginPath(); cx.moveTo(0, H);
      for (var k = 0; k < pts.length; k++) cx.lineTo(pts[k][0] * W, base + pts[k][1]);
      cx.lineTo(W, H); cx.closePath();
      var hg = cx.createLinearGradient(0, base - 30, 0, base + 60);
      hg.addColorStop(0, cols[l]); hg.addColorStop(1, mix(cols[l], p.p, 0.15 + l * 0.05));
      cx.fillStyle = hg; cx.fill();
      if (l === 0 && night > 0.5 && st.moonAlt > 0) { cx.strokeStyle = 'rgba(200,210,240,' + (0.18 * night).toFixed(3) + ')'; cx.lineWidth = 1.2; cx.beginPath(); for (var q2 = 0; q2 < pts.length; q2++) cx[q2 ? 'lineTo' : 'moveTo'](pts[q2][0] * W, base + pts[q2][1]); cx.stroke(); }
      if (l === 0 && st.sunAlt > -4 && st.sunAlt < 14) {   // the crest catches the light nearest the sun
        cx.save(); cx.globalCompositeOperation = "lighter";
        var rim = cx.createRadialGradient(sx, base, 0, sx, base, W * 0.6);
        rim.addColorStop(0, rgba(p.g, 0.35 * low)); rim.addColorStop(1, rgba(p.g, 0));
        cx.strokeStyle = rim; cx.lineWidth = 2; cx.beginPath();
        for (var q = 0; q < pts.length; q++) cx[q ? "lineTo" : "moveTo"](pts[q][0] * W, base + pts[q][1]);
        cx.stroke(); cx.restore();
      }
    }
    // mist settling in the low fields at dawn and dusk
    if (st.sunAlt < 8 && st.sunAlt > -8) {
      var mist = cx.createLinearGradient(0, hy + 10, 0, hy + 60);
      mist.addColorStop(0, rgba(p.h, 0)); mist.addColorStop(0.5, rgba(p.h, 0.22 * (1 - Math.abs(st.sunAlt) / 8))); mist.addColorStop(1, rgba(p.h, 0));
      cx.fillStyle = mist; cx.fillRect(0, hy + 10, W, 50);
    }
    // below the hills, the light falls across the rest of the page
    var nearBase = hy + 8, fall = Math.min(H, nearBase + 260), pg = cx.createLinearGradient(0, nearBase, 0, fall);
    pg.addColorStop(0, rgba(p.p, 0)); pg.addColorStop(0.3, rgba(p.p, 0.35)); pg.addColorStop(0.7, rgba(p.p, 0.85)); pg.addColorStop(1, p.p);
    cx.fillStyle = pg; cx.fillRect(0, nearBase, W, fall - nearBase); cx.fillStyle = p.p; cx.fillRect(0, fall, W, H - fall);
    if (st.mode === "light" && st.sunAlt < 14) {     // a warm wash from the low sun, all the way down
      var wash = cx.createRadialGradient(sx, hy, 0, sx, hy, H * 1.2);
      wash.addColorStop(0, rgba(p.g, 0.22 * low)); wash.addColorStop(1, rgba(p.g, 0));
      cx.fillStyle = wash; cx.fillRect(0, hy, W, H - hy);
    }
    last = { st: st, hy: hy, sun: [sx, sy] };
  }
  function drawSun(sx, sy, st, p, time, low) {
    var a = st.sunAlt, pulse = still ? 1 : 1 + 0.03 * Math.sin(time * 0.9);
    var disc = a < 1 ? "#ff6f3a" : a < 4 ? mix("#ff6f3a", "#ffa04a", (a - 1) / 3) : a < 12 ? mix("#ffa04a", "#ffe08a", (a - 4) / 8) : mix("#ffe08a", "#fff8e2", Math.min(1, (a - 12) / 14));
    var r = 17 + 9 * low;
    // soft crepuscular rays, slowly turning, only when the sun is low enough to throw them
    if (a < 16) {
      cx.save(); cx.translate(sx, sy); cx.rotate(still ? 0 : time * 0.012);
      var rayA = 0.06 * Math.min(1, (16 - a) / 10);
      for (var i = 0; i < 14; i++) {
        var ang = i / 14 * 2 * PI, len = W * (0.7 + 0.25 * seeded(i + 3)), wdt = 0.035 + 0.03 * seeded(i + 11);
        var rg = cx.createRadialGradient(0, 0, r, 0, 0, len); rg.addColorStop(0, rgba(p.g, rayA)); rg.addColorStop(1, rgba(p.g, 0));
        cx.fillStyle = rg; cx.beginPath(); cx.moveTo(0, 0); cx.arc(0, 0, len, ang - wdt, ang + wdt); cx.closePath(); cx.fill();
      }
      cx.restore();
    }
    var halo = cx.createRadialGradient(sx, sy, r * 0.6, sx, sy, r * 7 * pulse);
    halo.addColorStop(0, rgba(disc, 0.7)); halo.addColorStop(0.22, rgba(p.g, 0.34)); halo.addColorStop(1, rgba(p.g, 0));
    cx.fillStyle = halo; cx.beginPath(); cx.arc(sx, sy, r * 7 * pulse, 0, 2 * PI); cx.fill();
    if (low > 0.2) {                               // the long horizontal glare of a low sun
      cx.save(); cx.translate(sx, sy); cx.scale(6, 0.5);
      var gl = cx.createRadialGradient(0, 0, 0, 0, 0, r * 3); gl.addColorStop(0, "rgba(255,236,200," + (0.5 * low).toFixed(3) + ")"); gl.addColorStop(1, "rgba(255,236,200,0)");
      cx.fillStyle = gl; cx.beginPath(); cx.arc(0, 0, r * 3, 0, 2 * PI); cx.fill(); cx.restore();
    }
    var cor = cx.createRadialGradient(sx, sy, r * 0.9, sx, sy, r * 2.4);
    cor.addColorStop(0, "rgba(255,248,230,0.65)"); cor.addColorStop(1, "rgba(255,240,210,0)");
    cx.fillStyle = cor; cx.beginPath(); cx.arc(sx, sy, r * 2.4, 0, 2 * PI); cx.fill();
    var d = cx.createRadialGradient(sx, sy, 0, sx, sy, r);
    d.addColorStop(0, "#fffef6"); d.addColorStop(0.5, mix(disc, "#fffef6", 0.6)); d.addColorStop(0.88, mix(disc, "#fffef6", 0.15)); d.addColorStop(1, disc);
    cx.fillStyle = d; cx.beginPath(); cx.arc(sx, sy, r, 0, 2 * PI); cx.fill();
  }
  function drawMoon(st, hy, night) {
    var mp = place(st.moonAlt, st.moonAz, hy, st.peak + 20), mx = mp[0], my = mp[1], r = 17;
    var day = st.sunAlt > -2, vis = day ? 0.55 : Math.max(0.35, night), k = st.moonPhase, c = Math.cos(2 * PI * k), right = k < 0.5;
    var glow = cx.createRadialGradient(mx, my, r, mx, my, r * 6);
    glow.addColorStop(0, "rgba(235,232,210," + (0.22 * vis * (0.3 + st.moonFraction)).toFixed(3) + ")"); glow.addColorStop(1, "rgba(235,232,210,0)");
    cx.fillStyle = glow; cx.beginPath(); cx.arc(mx, my, r * 6, 0, 2 * PI); cx.fill();
    cx.fillStyle = "rgba(40,48,86," + (day ? 0 : 0.55 * vis).toFixed(3) + ")"; cx.beginPath(); cx.arc(mx, my, r, 0, 2 * PI); cx.fill();
    cx.save(); cx.beginPath();
    if (right) { cx.arc(mx, my, r, -PI / 2, PI / 2, false); cx.ellipse(mx, my, r * Math.abs(c), r, 0, PI / 2, -PI / 2, c > 0); }
    else { cx.arc(mx, my, r, -PI / 2, PI / 2, true); cx.ellipse(mx, my, r * Math.abs(c), r, 0, PI / 2, 3 * PI / 2, c < 0); }
    cx.closePath(); cx.clip();
    var lit = cx.createRadialGradient(mx - r * 0.3, my - r * 0.3, 1, mx, my, r);
    lit.addColorStop(0, "rgba(255,253,240," + vis + ")"); lit.addColorStop(1, "rgba(226,221,196," + vis + ")");
    cx.fillStyle = lit; cx.fillRect(mx - r, my - r, 2 * r, 2 * r);
    cx.fillStyle = "rgba(170,165,140," + (0.35 * vis).toFixed(3) + ")";
    if (!day) [[-5, -4, 4.5], [5, 3, 3.5], [-1, 7, 3], [6, -7, 2.4]].forEach(function (m) { cx.beginPath(); cx.arc(mx + m[0], my + m[1], m[2], 0, 2 * PI); cx.fill(); });
    cx.restore();
  }
  function drawClouds(st, p, hy, time, sx) {
    var a = st.sunAlt, top, bot, al;
    if (a < -8) { top = "#2b3460"; bot = "#1a2142"; al = 0.35; }
    else if (a < 0) { top = mix("#7a6aa0", "#f2a7b8", (a + 8) / 8); bot = mix("#3a3460", "#ff9a7a", (a + 8) / 8); al = 0.7; }
    else if (a < 10) { top = mix("#ffe9dc", "#ffffff", a / 10); bot = mix("#ff9c78", "#f3dccd", a / 10); al = 0.8; }
    else { top = "#ffffff"; bot = "#e9f0f7"; al = 0.6; }
    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i], w = c.w * c.s * Math.max(0.8, W / 390), h = c.h * c.s * Math.max(0.8, W / 390);
      var drift = still ? 0 : (time * c.speed * 2) % (W + w);
      var x = ((c.x * (W + w) + drift) % (W + w)) - w, y = c.y * (hy - 60) + 30;
      var key = top + bot + Math.round(w);
      if (c.key !== key) {                         // re-tint only when the light changes, not every frame
        var off = c.off || (c.off = document.createElement("canvas")); off.width = Math.ceil(w); off.height = Math.ceil(h);
        var g = off.getContext("2d"); g.clearRect(0, 0, off.width, off.height); g.globalCompositeOperation = "source-over";
        g.drawImage(c.img, 0, 0, w, h); g.globalCompositeOperation = "source-in";
        var lg = g.createLinearGradient(0, 0, 0, h); lg.addColorStop(0, top); lg.addColorStop(1, bot);
        g.fillStyle = lg; g.fillRect(0, 0, w, h); c.key = key;
      }
      cx.globalAlpha = al * (x + w / 2 < sx ? 0.92 : 1); cx.drawImage(c.off, x, y); cx.globalAlpha = 1;
    }
  }
  function frame(t) {
    if (!running) return;
    if (!still && t - (frame.prev || 0) > 33) { draw(t); frame.prev = t; }
    raf = requestAnimationFrame(frame);
  }
  var slowTimer = 0;
  function mount(canvas, dateFn) {
    cv = canvas; cx = cv.getContext("2d"); getDate = dateFn || function () { return new Date(); };
    build(); resize(); draw(performance.now());
    window.addEventListener("resize", function () { resize(); draw(performance.now()); });
    resume();
  }
  function resume() {
    if (running) return; running = true;
    if (still) { draw(performance.now()); slowTimer = setInterval(function () { draw(performance.now()); }, 60000); }
    else raf = requestAnimationFrame(frame);
  }
  function pause() { running = false; cancelAnimationFrame(raf); clearInterval(slowTimer); }
  window.Sky = { state: state, mount: mount, pause: pause, resume: resume, redraw: function () { if (cx) { resize(); draw(performance.now()); } }, last: function () { return last; }, horizonY: horizonY };
})();
