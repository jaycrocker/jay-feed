// Jay's Feed, version 4 (27 October 2026). The data model is in jay-assistant/system/feed.md.
(function () {
  "use strict";
  var app = document.querySelector(".app"), feed = document.getElementById("feed"), sheet = document.getElementById("sheet"), scrim = document.getElementById("scrim");
  var toastEl = document.getElementById("toast"), metaTheme = document.querySelector('meta[name="theme-color"]');
  var cards = [], notes = [], view = "home", query = "", api = "", key = "", lastError = "", sheetFor = null, sheetMode = "", dayOpen = false, dfyOpen = false;

  // ---- time: the real clock, or ?now=2026-10-27T07:20 to preview another moment ----
  var nowOffset = 0;
  (function () { var q = new URLSearchParams(location.search).get("now"); if (q) { var d = new Date(q); if (!isNaN(d)) nowOffset = d - Date.now(); } })();
  function now() { return new Date(Date.now() + nowOffset); }

  // ---- set-up: the first link carries #api=...&k=..., kept on this phone only ----
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  (function () {
    var h = location.hash.slice(1); if (!h) return;
    var p = new URLSearchParams(h);
    if (p.get("api") && p.get("k")) { ls("feed-api", p.get("api")); ls("feed-k", p.get("k")); history.replaceState(null, "", location.pathname + location.search); }
  })();
  api = ls("feed-api") || ""; key = ls("feed-k") || "";

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fmt(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>'); }
  function plain(s) { return String(s == null ? "" : s).replace(/\*\*(.+?)\*\*/g, "$1").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"); }
  function hi(s) { var t = fmt(s); if (!query) return t; var q = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); return t.replace(new RegExp("(" + q + ")(?![^<]*>)", "gi"), "<mark>$1</mark>"); }
  function hm(d) { return d ? d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : ""; }
  function when(iso) { if (!iso) return ""; var d = new Date(iso); if (isNaN(d)) return ""; var today = now().toDateString() === d.toDateString(); return (today ? "" : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) + " ") + hm(d); }
  function safeUrl(u) { return /^https:\/\//i.test(String(u || "")) ? String(u) : ""; }
  function card(id) { for (var i = 0; i < cards.length; i++) if (cards[i].id === id) return cards[i]; return null; }
  function mins(t) { var m = /^(\d{1,2}):(\d{2})$/.exec(String(t || "").trim()); return m ? Number(m[1]) * 60 + Number(m[2]) : null; }

  var I = {
    chev: '<svg class="i" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
    right: '<svg class="i chev" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
    arrow: '<svg class="i" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    out: '<svg class="i" viewBox="0 0 24 24"><path d="M7 17L17 7M9 7h8v8"/></svg>',
    tick: '<svg class="i" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>',
    copy: '<svg class="i" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/></svg>',
    heart: '<svg class="i" viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
    chat: '<svg class="i" viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg>',
    hist: '<svg class="i" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></svg>',
    clock: '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    close: '<svg class="i" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    send: '<svg class="i" viewBox="0 0 24 24"><path d="M4 12l16-8-6 16-2-7z"/></svg>',
    back: '<svg class="i" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
    phone: '<svg class="i" viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
    sunrise: '<svg class="i" viewBox="0 0 24 24" style="width:12px;height:12px"><path d="M4 18h16M7 14a5 5 0 0 1 10 0M12 4v4M5 9l1.5 1.5M19 9l-1.5 1.5"/></svg>',
    sunset: '<svg class="i" viewBox="0 0 24 24" style="width:12px;height:12px"><path d="M4 18h16M7 14a5 5 0 0 1 10 0M12 8V4M5 9l1.5 1.5M19 9l-1.5 1.5"/></svg>',
    mind: '<svg class="i" viewBox="0 0 24 24"><path d="M12 3a6 6 0 0 0-6 6c0 2.5 1.5 4 2.5 5v3h7v-3c1-1 2.5-2.5 2.5-5a6 6 0 0 0-6-6z"/><path d="M10 21h4"/></svg>',
    energy: '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/></svg>',
    moon: '<svg class="i" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
    body: '<svg class="i" viewBox="0 0 24 24"><path d="M4 12h3l2-5 4 10 2-5h5"/></svg>',
    dots: '<svg class="i" viewBox="0 0 24 24"><path d="M6 5h12M6 10h12M6 15h8"/></svg>'
  };
  var BOARD_ICONS = {
    money: ["#2b1d16", "#ffd08a", '<path d="M4 18V12M10 18V7M16 18v-4M22 18H2"/>'],
    business: ["#1f3a4a", "#bfe9f0", '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'],
    journal: ["#33244a", "#e4ddf4", '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M9 9h6M9 13h4"/>'],
    progress: ["#23452f", "#b9edc9", '<path d="M3 20l6-8 4 4 8-11"/><path d="M15 5h6v6"/>'],
    home: ["#3a2440", "#ffd9a8", '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>'],
    plan: ["#203050", "#c9d8ff", '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'],
    learn: ["#3a2a12", "#ffe0a8", '<path d="M3 8l9-4 9 4-9 4z"/><path d="M7 10v5c3 2 7 2 10 0v-5"/>'],
    map: ["#173a3a", "#bff0e6", '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>'],
    heart: ["#4a1a2e", "#ffc2d6", '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'],
    deck: ["#2a2a3a", "#e6e6ff", '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v4M8 20h8"/>']
  };
  var DAY_COLOURS = { rest: "#E8C9A6", work: "#B5733C", travel: "#5A4336", people: "#FFD08A", move: "#6FA680", mind: "#B9A7D9", appointment: "#8FA3B8", food: "#F2A65A", sleep: "#7A86B8" };

  // ---------------- the mode follows the sun ----------------
  var sky = null;
  function applyMode() {
    sky = window.Sky ? Sky.state(now()) : null;
    var dark = sky ? sky.mode === "dark" : (now().getHours() >= 18 || now().getHours() < 7), st = app.style;
    app.classList.toggle("dark", dark);
    var warm = sky && sky.sunAlt < 12;
    var v = dark ? {
      "--ink": "#eef1fa", "--soft": "#b4bdd6", "--label": "#a4afd0", "--glass": "rgba(18,24,52,0.62)", "--glass2": "rgba(255,255,255,0.06)", "--line": "rgba(255,255,255,0.1)",
      "--accent": "#e9c88a", "--accent-ink": "#141a33", "--nav-bg": "rgba(10,14,32,0.8)", "--nav-ink": "#9aa6c8", "--nav-on": "#eef1fa", "--past-veil": "rgba(14,20,48,0.62)", "--glass-solid": "#141a33", "--now-time": "#8a5a12"
    } : {
      "--ink": "#1d1612", "--soft": "#5b4a3e", "--label": "#6e4a30", "--glass": "rgba(255,255,255,0.74)", "--glass2": "rgba(255,255,255,0.5)", "--line": "rgba(60,40,20,0.1)",
      "--accent": warm ? "#a8501c" : "#1d5f8c", "--accent-ink": "#ffffff", "--nav-bg": "rgba(255,251,246,0.84)", "--nav-ink": "#6e5a4c", "--nav-on": "#1d1612", "--past-veil": "rgba(255,255,255,0.62)", "--glass-solid": "#fff8ef", "--now-time": "#ffe59a"
    };
    if (!dark && !warm) { v["--label"] = "#365571"; v["--soft"] = "#465a6a"; }
    for (var k in v) st.setProperty(k, v[k]);
    app.classList.toggle("bright-sky", Boolean(sky && sky.sunAlt > 9));   // dark ink on a bright midday sky, white otherwise
    if (view === "home" && sky) metaTheme.setAttribute("content", sky.palette.z);
  }

  // ---------------- cards ----------------
  function live(c) { return !(c.expires && Date.parse(c.expires) < now().getTime()); }
  function answered(c) { return Boolean(c.answer && c.answer.choice); }
  function isHome(c) { return c.kind === "Home" || c.id === "home"; }
  function open() { return cards.filter(function (c) { return live(c) && !answered(c) && !isHome(c); }).sort(function (a, b) { return (b.order || 0) - (a.order || 0) || String(b.created || "").localeCompare(String(a.created || "")); }); }
  function thread(c) {
    var a = c.answer || {}; if (a.thread && a.thread.length) return a.thread;
    var t = []; if (a.text) t.push({ who: "jay", text: a.text, at: a.at }); if (c.teamReply) t.push({ who: "team", text: c.teamReply, at: c.teamReplyAt || "" }); return t;
  }
  function lastTeam(c) { var t = thread(c); for (var i = t.length - 1; i >= 0; i--) if (t[i].who === "team") return t[i]; return null; }
  var seen = {}; try { seen = JSON.parse(ls("feed-seen") || "{}") || {}; } catch (e) { seen = {}; }
  function sig(c) { var t = lastTeam(c); return t ? "r" + t.text.length + ":" + t.text.slice(0, 20) : "c"; }
  function isNew(c) { return seen[c.id] !== sig(c); }
  function markSeen(id) { var c = card(id); if (!c || !isNew(c)) return; seen[c.id] = sig(c); ls("feed-seen", JSON.stringify(seen)); dots(); var b = document.getElementById("new-" + id); if (b) b.remove(); }
  function dots() {
    var fresh = open().filter(isNew).length;
    document.getElementById("d-feed").hidden = !fresh;
    try { if (navigator.setAppBadge) { if (fresh) navigator.setAppBadge(fresh); else navigator.clearAppBadge(); } } catch (e) {}
  }
  var watcher = ("IntersectionObserver" in window) ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      var id = en.target.dataset.id;
      if (en.isIntersecting && en.intersectionRatio >= 0.6) { en.target._t = setTimeout(function () { markSeen(id); }, 1200); themeFrom(en.target); }
      else clearTimeout(en.target._t);
    });
  }, { root: feed, threshold: [0, 0.6] }) : null;
  function themeFrom(el) { var c = el && el.dataset.top; if (c) metaTheme.setAttribute("content", c); }

  function render() {
    applyMode(); dots();
    app.classList.toggle("on-home", view === "home");
    feed.classList.toggle("posts", view === "feed");
    if (window.Sky) { if (view === "home") Sky.resume(); else Sky.pause(); }
    if (!api || !key) { feed.innerHTML = '<div class="empty"><h2>Open your setup link once.</h2><p>Your team sent a link that starts this app with your key - open it on this phone. The key stays on this phone.</p></div>'; return; }
    if (view === "tell") return renderTell();
    if (view === "done") return renderDone();
    if (view === "home") return renderHome();
    renderPosts();
  }

  // =====================================================================================================
  // HOME - one card with id "home": {"kind":"Home","home":{...}} (feed.md). Rewritten by the team through the day.
  // =====================================================================================================
  function daysTo(d) { var t = new Date(String(d) + (String(d).length === 10 ? "T00:00:00" : "")); if (isNaN(t)) return null; var a = now(); a.setHours(0, 0, 0, 0); t.setHours(0, 0, 0, 0); return Math.round((t - a) / 864e5); }
  function linkAttrs(x) {
    if (x.card && card(x.card)) return { tag: "button", attrs: 'type="button" data-act="open" data-id="' + esc(x.card) + '"' };
    var u = safeUrl(x.url); if (u) return { tag: "a", attrs: 'href="' + esc(u) + '" target="_blank" rel="noopener"' };
    return null;
  }
  function wrap(x, cls, inner) { var l = linkAttrs(x); if (!l) return '<div class="' + cls + '">' + inner + '</div>'; return '<' + l.tag + ' class="' + cls + '" ' + l.attrs + '>' + inner + '</' + l.tag + '>'; }
  function greeting(d) {
    var h = d.getHours();
    if (sky && sky.sunrise && d < sky.sunrise && h >= 4) return "Early, Jay.";
    if (h < 4) return "Still up, Jay?";
    if (h < 12) return "Morning, Jay.";
    if (h < 17 && !(sky && sky.mode === "dark")) return "Afternoon, Jay.";
    if (h < 22) return "Evening, Jay.";
    return "Night, Jay.";
  }
  function sunLine(d) {
    if (!sky || !sky.sunrise || !sky.sunset) return "";
    var left = (sky.sunset - d) / 36e5;
    if (d < sky.sunrise) return "Sunrise at " + hm(sky.sunrise) + ".";
    if (left > 0) { var hrs = Math.floor(left), half = left - hrs >= 0.5; return hrs >= 1 ? (hrs + (half ? " and a half" : "") + " hour" + (hrs === 1 && !half ? "" : "s") + " of light left.") : "The sun sets at " + hm(sky.sunset) + "."; }
    var f = Math.round(sky.moonFraction * 100);
    return f > 96 ? "A full moon tonight." : f < 4 ? "A new moon - the darkest sky of the month." : "The moon is " + f + "% lit tonight.";
  }

  function renderHome() {
    var hc = card("home"), h = (hc && hc.home) || {}, d = now();
    var hy = window.Sky ? Sky.horizonY() : 240, out = "";
    out += '<header class="h-sky" style="height:' + (hy + 26) + 'px"><div class="h-hello"><small>' + esc(d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })) + '</small><h1>' + greeting(d) + '</h1><p>' + esc(h.headline && !(h.day && h.day.date && h.day.date > isoDay(d)) ? h.headline : sunLine(d)) + '</p></div>' +
      (sky && sky.sunrise ? '<div class="h-times" style="bottom:' + (26 - 2) + 'px"><span>' + I.sunrise + hm(sky.sunrise) + '</span><span>' + hm(sky.sunset) + I.sunset + '</span></div>' : '') + '</header>';
    if (!hc) { feed.innerHTML = '<div class="home">' + out + '<section class="glass"><div class="lab">Home</div><p>Your team is setting this up - it fills with the next Morning.</p></section></div>'; return; }
    out += dayBlock(h, d);
    (h.highlights || []).forEach(function (x) { if (x.until && daysTo(x.until) !== null && daysTo(x.until) < 0) return; out += highlight(x); });
    out += foodBlock(h.food, d);
    out += teamBlock(h.team);
    out += todoBlock(h.todo || h.outstanding || [], h.todoMore || h.outstandingMore);
    out += aheadBlock(h.ahead || [], d);
    out += friendsBlock(h.people, d);
    out += dfyBlock(h.done || []);
    out += countdownBlock(h.countdowns || []);
    out += boardsBlock(h.boards || (h.links || []).map(function (l) { return { label: l.label, url: l.url, icon: guessIcon(l.label), permanent: true }; }), h.archive);
    out += '<button type="button" class="updated" data-act="refresh">' + (h.updated || hc.created ? "Updated " + esc(when(h.updated || hc.created)) + " by your team · tap to refresh" : "Tap to refresh") + '</button>';
    var keep = feed.scrollTop;
    feed.innerHTML = '<div class="home">' + out + '</div>';
    feed.scrollTop = keep;
    var nowRow = feed.querySelector(".drow.now"), dl = feed.querySelector(".dlist");
    if (dayOpen && nowRow && dl) dl.scrollTop = Math.max(0, nowRow.offsetTop - dl.offsetTop - 70);
  }

  function dayItems(h) {
    var day = h.day || {}, items = (day.items || []).map(function (x) { return Object.assign({}, x, { s: mins(x.time), e: mins(x.end) }); }).filter(function (x) { return x.s !== null; });
    items.sort(function (a, b) { return a.s - b.s; });
    items.forEach(function (x, i) { if (x.e === null || x.e <= x.s) { var nx = items[i + 1]; x.e = nx ? Math.min(nx.s, x.s + 120) : x.s + 45; if (x.e <= x.s) x.e = x.s + 15; } });
    return { items: items, start: mins(day.start), end: mins(day.end) };
  }
  function dayBlock(h, d) {
    var di = dayItems(h), items = di.items, t = d.getHours() * 60 + d.getMinutes();
    var dayDate = (h.day || {}).date, todayIso = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
    var ahead = dayDate && dayDate > todayIso;   // the day written is tomorrow's: nothing on it has happened yet
    if (ahead) t = -1;
    if (!items.length) {
      var nx = h.next; if (!nx) return "";
      return '<section class="glass"><div class="sec-h"><span class="lab">' + esc(nx.label || "Next") + '</span></div><div class="nn" style="margin-top:8px"><span class="k">NEXT</span><span class="t1">' + esc(nx.title || "") + '</span><time>' + esc(nx.time || "") + '</time>' + (nx.note ? '<span class="sub">' + fmt(nx.note) + '</span>' : '') + '</div></section>';
    }
    var start = di.start !== null ? di.start : Math.min(items[0].s, 6 * 60), end = di.end !== null ? di.end : Math.max(items[items.length - 1].e, 22 * 60), span = Math.max(60, end - start);
    var segs = "", cur = start, dark = app.classList.contains("dark");
    items.forEach(function (x) {
      var s = Math.max(start, x.s), e = Math.min(end, x.e); if (e <= cur) return;
      if (s > cur) segs += '<b style="width:' + ((s - cur) / span * 100).toFixed(2) + '%;background:transparent"></b>';
      var col = DAY_COLOURS[x.kind] || "#C9B8A6"; if (dark && x.kind === "travel") col = "#8A6E5E";
      s = Math.max(s, cur); segs += '<b style="width:' + ((e - s) / span * 100).toFixed(2) + '%;background:' + col + '"></b>'; cur = e;
    });
    var pos = Math.max(0, Math.min(100, (t - start) / span * 100));
    var nowItem = null, nextItem = null;
    var leaveAt = null;
    items.forEach(function (x) {
      if (x.s <= t && t < x.e && (!nowItem || x.s >= nowItem.s)) nowItem = x;
      if (x.s > t && !nextItem) { if (x.kind === "travel") { if (leaveAt === null) leaveAt = x.s; } else nextItem = x; }
    });
    if (nextItem && leaveAt !== null && leaveAt < nextItem.s && !nextItem.leave) nextItem = Object.assign({}, nextItem, { leave: hmm(leaveAt) });
    var nn = "";
    if (nowItem) nn += '<span class="k now">NOW</span><span class="t1">' + esc(nowItem.title) + (nowItem.where ? '<span style="font-weight:400;font-family:var(--body);font-size:0.95rem">, ' + esc(nowItem.where) + '</span>' : '') + '</span><time>to ' + hmm(nowItem.e) + '</time>';
    else if (ahead) nn += '<span class="k now">NOW</span><span class="t1">' + (d.getHours() >= 17 || d.getHours() < 4 ? "Rest - tomorrow is ready" : "Free") + '</span><time></time>';
    else if (t < start) nn += '<span class="k now">NOW</span><span class="t1">The day hasn\'t started</span><time></time>';
    else if (!nextItem) nn += '<span class="k now">NOW</span><span class="t1">' + (t >= end ? "Rest. The day is done." : "Free time") + '</span><time></time>';
    else nn += '<span class="k now">NOW</span><span class="t1">Free until ' + hmm(nextItem.s) + '</span><time></time>';
    if (nextItem) nn += '<span class="k">NEXT</span><span class="t2">' + (ahead ? new Date(dayDate + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long" }) + ": " : "") + esc(nextItem.title) + '</span><time>' + hmm(nextItem.s) + '</time>' + (nextItem.leave ? '<span class="sub">Leave ' + esc(nextItem.leave) + '</span>' : '');
    else if (h.tomorrow) nn += '<span class="k">NEXT</span><span class="t2">' + esc(h.tomorrow) + '</span><time></time>';
    var rows = items.map(function (x) {
      var cls = x.e <= t ? "past" : (x.s <= t && t < x.e ? "now" : ""), col = DAY_COLOURS[x.kind] || "#C9B8A6";
      var inner = '<time>' + (cls === "now" ? "NOW" : hmm(x.s)) + '</time><i style="background:' + col + '"></i><span><b>' + esc(x.title) + '</b>' + ((x.where || x.note) ? '<span class="s">' + esc([x.where, x.note].filter(Boolean).join(" · ")) + '</span>' : '') + '</span>';
      return wrap(x, "drow " + cls, inner);
    }).join("");
    return '<section class="glass"><div class="sec-h"><span class="lab">' + (ahead ? "Tomorrow" : "Your day") + '</span><button type="button" class="txtbtn" data-act="day" aria-expanded="' + dayOpen + '">' + (dayOpen ? "Fold away" : "See it all") + I.chev + '</button></div>' +
      '<div class="dbar" aria-hidden="true">' + segs + '<span class="past" style="width:' + pos.toFixed(1) + '%"></span><span class="mark" style="left:calc(' + pos.toFixed(1) + '% - 1px)"></span></div>' +
      '<div class="nn">' + nn + '</div><div class="dlist' + (dayOpen ? " open" : "") + '">' + rows + '</div></section>';
  }
  function isoDay(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function hmm(m) { m = ((m % 1440) + 1440) % 1440; return ("0" + Math.floor(m / 60)).slice(-2) + ":" + ("0" + (m % 60)).slice(-2); }

  var HL_ART = {
    gift: '<svg class="art" viewBox="0 0 170 130" aria-hidden="true"><rect x="40" y="56" width="92" height="66" rx="6" fill="none" stroke="#ffd9a8" stroke-width="2.5"/><rect x="32" y="40" width="108" height="20" rx="5" fill="none" stroke="#ffd9a8" stroke-width="2.5"/><path d="M86 40v82" stroke="#ffd08a" stroke-width="7"/><path d="M86 40c-14-22-38-16-30-4 6 8 30 4 30 4zM86 40c14-22 38-16 30-4-6 8-30 4-30 4z" fill="none" stroke="#ffd08a" stroke-width="3" stroke-linejoin="round"/><circle cx="150" cy="22" r="3" fill="#ffd08a"/><circle cx="24" cy="30" r="2" fill="#ffd9a8"/></svg>',
    home: '<svg class="art" viewBox="0 0 170 130" aria-hidden="true"><circle cx="138" cy="36" r="12" fill="#ffd08a"/><circle cx="138" cy="36" r="24" fill="#ffd08a" opacity="0.18"/><path d="M28 122V76l46-32 46 32v46z" fill="none" stroke="#ffd9a8" stroke-width="2.5" stroke-linejoin="round"/><path d="M62 122V96h24v26" fill="none" stroke="#ffd9a8" stroke-width="2.5"/><rect x="94" y="86" width="14" height="12" fill="#ffd08a"/><path d="M0 122h170" stroke="#ffd9a8" stroke-opacity="0.5" stroke-width="1.5"/></svg>',
    news: '<svg class="art" viewBox="0 0 170 130" aria-hidden="true"><path d="M0 100c30-14 50 14 85 0s55 14 85 0" fill="none" stroke="#bff0f4" stroke-width="2.5"/><path d="M0 116c30-14 50 14 85 0s55 14 85 0" fill="none" stroke="#bff0f4" stroke-opacity="0.6" stroke-width="2.5"/><circle cx="130" cy="40" r="14" fill="#bff0f4" opacity="0.9"/></svg>',
    warm: '<svg class="art" viewBox="0 0 170 130" aria-hidden="true"><g stroke="#ffd9a8" stroke-width="2.5" stroke-linecap="round"><path d="M120 30v-14M120 84v14M93 57H79M161 57h-14M101 38l-9-9M139 76l9 9M101 76l-9 9M139 38l9-9"/></g><circle cx="120" cy="57" r="16" fill="#ffd08a"/></svg>'
  };
  function highlight(x) {
    var style = HL_ART[x.style] ? x.style : "warm";
    var inner = HL_ART[style] + '<div class="tags"><span class="tag">' + esc(x.label || "Just for you") + '</span>' + (x.from ? '<span class="from">From the ' + esc(x.from) + '</span>' : '') + '</div>' +
      '<h3>' + esc(x.title) + '</h3>' + (x.text ? '<p>' + esc(x.text) + '</p>' : '') + ((x.card || x.url) ? '<span class="go">' + esc(x.cta || "Open it") + ' ' + I.arrow + '</span>' : '');
    return wrap(x, "hl " + style, inner);
  }
  function teamBlock(t) {
    if (!t) return "";
    var dark = app.classList.contains("dark");
    var defs = [["mind", "Mind", I.mind, dark ? ["#2e2a52", "#cfc4f2"] : ["#e4ddf4", "#4b3a82"]], ["energy", "Energy", (sky && sky.mode === "dark") ? I.moon : I.energy, dark ? ["#3d3220", "#f1cf8e"] : ["#fce3c0", "#8a4b1f"]], ["body", "Body", I.body, dark ? ["#1e3a2a", "#9fd3ae"] : ["#dceedf", "#2f5a3b"]]];
    var rows = defs.filter(function (x) { return t[x[0]]; }).map(function (x) {
      return '<div class="tline"><span class="ic" style="background:' + x[3][0] + ';color:' + x[3][1] + '">' + x[2] + '</span><div><b style="color:' + x[3][1] + '">' + x[1] + '</b><p>' + fmt(t[x[0]]) + '</p></div></div>';
    }).join("");
    return rows ? '<section class="glass soft"><span class="lab">From the team</span><div class="team">' + rows + '</div></section>' : "";
  }
  // ---- Food (Jay, 27 October: "a food plan for each day... specificity with the food... time, location, cost") ----
  function foodBlock(f, d) {
    if (!f || !(f.meals || []).length) return "";
    var tomorrow = f.date && f.date > isoDay(d), nowM = d.getHours() * 60 + d.getMinutes(), total = 0, priced = false;
    var rows = f.meals.slice().sort(function (p, q) { return (mins(p.time) || 0) - (mins(q.time) || 0); }).map(function (m) {
      var c = Number(String(m.cost == null ? "" : m.cost).replace(/[^0-9.]/g, ""));
      if (m.cost != null && m.cost !== "" && !isNaN(c)) { total += c; priced = true; }
      var cost = m.cost == null || m.cost === "" ? "" : (typeof m.cost === "number" ? (m.cost === 0 ? "home" : "£" + (m.cost % 1 ? m.cost.toFixed(2) : m.cost)) : String(m.cost));
      var past = !tomorrow && mins(m.end || m.time) !== null && mins(m.end || m.time) + 30 < nowM;
      var inner = '<time>' + esc(m.time || "") + '</time><span><span class="fm">' + esc(m.meal || "") + '</span><b>' + esc(m.what || "") + '</b>' + (m.where ? '<span class="fw">' + esc(m.where) + (m.note ? " · " + esc(m.note) : "") + '</span>' : (m.note ? '<span class="fw">' + esc(m.note) + '</span>' : "")) + '</span>' + (cost ? '<span class="fc">' + esc(cost) + '</span>' : '<span></span>');
      return wrap(m, past ? "past" : "", inner);
    }).join("");
    var aside = priced ? (total ? "about £" + (total % 1 ? total.toFixed(2) : total) + " today" : "all at home") : "";
    return '<section class="glass"><div class="sec-h"><span class="lab">' + (tomorrow ? "Food tomorrow" : "Food today") + '</span><span class="aside">' + esc(aside) + '</span></div><div class="food">' + rows + '</div>' + (f.note ? '<div class="food-note">' + esc(f.note) + '</div>' : "") + '</section>';
  }
  function todoBlock(list, more) {
    if (!list.length) return "";
    var openN = 0, doneN = 0;
    var rows = list.slice(0, 10).map(function (x) {
      var c = x.card ? card(x.card) : null, done = x.done || (c && answered(c) && !/^not now$/i.test(c.answer.choice));
      if (done) doneN++; else openN++;
      var inner = '<span class="ring">' + (done ? I.tick : '') + '</span><span class="l">' + esc(x.label) + '</span><time>' + esc(done ? "done" : (x.when || "")) + '</time>' + (done ? '<span></span>' : I.right);
      var cls = done ? "done" : (x.hot ? "hot" : "");
      if (c && !done) return '<button type="button" class="' + cls + '" data-act="goto" data-id="' + esc(x.card) + '">' + inner + '</button>';
      var l = !done && linkAttrs(x); if (l) return '<' + l.tag + ' class="' + cls + '" ' + l.attrs + '>' + inner + '</' + l.tag + '>';
      return '<div class="' + cls + '" style="cursor:default">' + inner + '</div>';
    }).join("");
    var aside = (doneN ? doneN + " done · " : "") + openN + " open" + (more ? " · " + Number(more) + " more" : "");
    return '<section class="glass"><div class="sec-h"><span class="lab">To do</span><span class="aside">' + aside + '</span></div><div class="todo">' + rows + '</div></section>';
  }
  function initials(s) { return String(s || "").split(/[\s,&]+/).filter(function (w) { return /^[A-Z]/.test(w); }).slice(0, 2).map(function (w) { return w[0]; }).join(""); }
  function sentKey(x) { return "home-sent-" + (x.card || (x.to + x.text).slice(0, 60)); }
  function friendsBlock(pp, d) {
    if (!pp) return "";
    var days = pp.week || [], todayKey = d.toLocaleDateString("en-GB", { weekday: "short" });
    var week = days.length ? '<div class="week" aria-label="Friends this week">' + days.map(function (x) {
      return '<div class="' + (x.status || "") + (x.day === todayKey ? " today" : "") + '"><i>' + (x.status === "on" ? I.tick : x.status === "maybe" ? "?" : "") + '</i>' + esc(x.day) + '</div>';
    }).join("") + '</div>' : "";
    // plans: the people.plans list, or the labels on the week's days; a plan can carry the message to send for it
    var plans = (pp.plans || days.filter(function (x) { return x.label; }).map(function (x) { return { day: x.day, label: x.label, status: x.status }; }));
    (pp.messages || []).forEach(function (m) { plans.push({ day: m.when || "", label: m.label || ("To " + m.to), to: m.to, message: m.text, card: m.card, status: m.status || "maybe" }); });
    var on = plans.filter(function (x) { return x.status === "on"; }).length, maybe = plans.filter(function (x) { return x.status === "maybe"; }).length;
    var rows = plans.map(function (x, i) {
      var sent = x.message && (ls(sentKey(x)) === "1" || (x.card && card(x.card) && answered(card(x.card))));
      var st = x.status === "on" ? "on" : (x.message && !sent ? "" : (sent ? "sent" : "waiting"));
      var dn = String(x.day || "").split(" "), dd = '<span class="d">' + (dn[1] ? esc(dn[0]) + '<b>' + esc(dn[1]) + '</b>' : '<b>' + esc(dn[0] || "·") + '</b>') + '</span>';
      var right = x.message && !sent ? '<button type="button" class="copy" data-act="copytext" data-i="' + i + '" aria-label="Copy the message">' + I.copy + 'Copy</button>'
        : '<span class="st">' + esc(x.statusText || st) + '</span>';
      return '<div class="plan' + (x.status === "on" ? " on" : "") + '" id="plan-' + i + '">' + dd + '<div class="w"><b>' + esc(x.label) + '</b>' + (x.to && x.label.indexOf(x.to) === -1 ? '<span>' + esc(x.to) + '</span>' : '') +
        (x.message && !sent ? '<q>' + esc(x.message) + '</q>' : '') + '</div>' + right + '</div>';
    }).join("");
    friendsPlans = plans;
    var aside = on ? on + " on" + (maybe ? " · " + maybe + " in the making" : "") : (maybe ? maybe + " in the making" : "");
    return '<section class="glass"><div class="sec-h"><span class="lab">Friends this week</span><span class="aside">' + aside + '</span></div>' + week +
      (rows ? '<div class="plans">' + rows + '</div>' : '') +
      ((pp.quiet || []).length ? '<div class="quiet">Not seen in a while ' + pp.quiet.map(function (q) { return '<span>' + esc(q) + '</span>'; }).join("") + '</div>' : '') + '</section>';
  }
  var friendsPlans = [];
  function dfyBlock(list) {
    if (!list.length) return "";
    var items = list.slice().sort(function (a, b) { return String(b.at || "").localeCompare(String(a.at || "")); });
    var shown = dfyOpen ? items : items.slice(0, 3), rest = items.length - shown.length;
    var today = items.filter(function (x) { return !x.at || new Date(x.at).toDateString() === now().toDateString(); }).length;
    return '<section class="glass soft"><div class="sec-h"><span class="lab">Done for you</span><span class="aside">' + (today ? today + " today" : "") + '</span></div><div class="dfy">' +
      shown.map(function (x) { return '<div>' + I.tick + '<span>' + fmt(x.text) + '</span></div>'; }).join("") +
      (rest > 0 ? '<button type="button" class="more" data-act="dfy">and ' + rest + ' more</button>' : (dfyOpen && items.length > 3 ? '<button type="button" class="more" data-act="dfy">Show fewer</button>' : '')) + '</div></section>';
  }
  function countdownBlock(list) {
    var tiles = list.map(function (c) { return { n: daysTo(c.date), label: c.label }; }).filter(function (c) { return c.n !== null && c.n >= 0; }).sort(function (a, b) { return a.n - b.n; }).slice(0, 4);
    if (!tiles.length) return "";
    return '<div><div class="lab out">Counting down</div><div class="cds" style="margin-top:8px">' + tiles.map(function (c) {
      return '<div class="cd glass" style="padding:12px 10px;border-radius:20px"><b>' + (c.n === 0 ? "Today" : c.n) + '</b><span>' + (c.n === 1 ? "Tomorrow: " : "") + esc(c.label) + '</span></div>';
    }).join("") + '</div></div>';
  }
  function guessIcon(label) {
    var l = String(label || "").toLowerCase();
    if (/money|budget|spend|wealth/.test(l)) return "money"; if (/business|paraplan|hub/.test(l)) return "business"; if (/journal/.test(l)) return "journal";
    if (/far|progress|score/.test(l)) return "progress"; if (/home|place|barn/.test(l)) return "home"; if (/plan|week|calendar/.test(l)) return "plan";
    if (/af8|study|learn|exam/.test(l)) return "learn"; if (/map|trip|bansko|travel/.test(l)) return "map"; if (/deck|pitch|explain/.test(l)) return "deck"; return "";
  }
  var pastBoards = [];
  function boardsBlock(list, archive) {
    var good = list.filter(function (b) { return safeUrl(b.url); });
    var isPast = function (b) { return b.until && /^\d{4}-\d{2}-\d{2}/.test(b.until) && daysTo(b.until) < 0; };
    pastBoards = good.filter(function (b) { return !b.permanent && isPast(b); }).concat((archive || []).filter(function (b) { return safeUrl(b.url); }));
    var seenUrl = {}; pastBoards = pastBoards.filter(function (b) { if (seenUrl[b.url]) return false; seenUrl[b.url] = 1; return true; });
    list = good.filter(function (b) { return !isPast(b); });
    if (!list.length && !pastBoards.length) return "";
    var tmp = list.filter(function (b) { return !b.permanent; }), perm = list.filter(function (b) { return b.permanent; }), out = "";
    if (tmp.length || pastBoards.length) out += '<div><div class="sec-h" style="padding:0 4px"><span class="lab">Boards for now</span>' + (pastBoards.length ? '<button type="button" class="txtbtn" data-act="archive">Looking back · ' + pastBoards.length + '</button>' : '') + '</div>' +
      (tmp.length ? '<div class="boards-tmp">' + tmp.map(function (b) {
        var until = b.untilLabel || (b.until ? (/^\d{4}-\d{2}-\d{2}/.test(b.until) ? "until " + new Date(b.until + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric" }) : b.until) : "");
        return '<a class="btmp" href="' + esc(b.url) + '" target="_blank" rel="noopener">' + (until ? '<em>' + esc(until) + '</em>' : '<em>this week</em>') + '<b>' + esc(b.label) + '</b></a>';
      }).join("") + '</div>' : '') + '</div>';
    if (perm.length) out += '<div><div class="lab out">Always here</div><div class="boards-perm">' + perm.slice(0, 8).map(function (b) {
      var ic = BOARD_ICONS[b.icon || guessIcon(b.label)] || ["#2a2f45", "#e6e9f5", ""];
      return '<a class="bperm" href="' + esc(b.url) + '" target="_blank" rel="noopener"><span style="background:' + ic[0] + '">' + (ic[2] ? '<svg class="i" viewBox="0 0 24 24" style="stroke:' + ic[1] + '">' + ic[2] + '</svg>' : '<b style="color:' + ic[1] + ';font-family:var(--display);font-size:1.4rem">' + esc(String(b.label || "?")[0]) + '</b>') + '</span>' + esc(b.short || b.label) + '</a>';
    }).join("") + '</div></div>';
    return out;
  }
  function openArchive() {
    var rows = pastBoards.slice().sort(function (x, y) { return String(y.until || y.at || "").localeCompare(String(x.until || x.at || "")); }).map(function (b) {
      var when = b.until && /^\d{4}-\d{2}-\d{2}/.test(b.until) ? new Date(b.until + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : (b.note || "");
      return '<a href="' + esc(b.url) + '" target="_blank" rel="noopener"><span><b style="display:block">' + esc(b.label) + '</b><small style="color:#9aa6c8">' + esc(when) + '</small></span>' + I.out + '</a>';
    }).join("");
    sheetFor = "archive"; sheetMode = "archive";
    sheet.innerHTML = '<div class="grab"></div><div class="head"><div style="flex:1;min-width:0"><small>Boards</small><h3 id="sheet-title">Looking back</h3></div><button type="button" class="round" data-act="close" aria-label="Close">' + I.close + '</button></div><div class="scroll" id="sheet-scroll"><div class="links">' + rows + '</div></div>';
    sheet.classList.add("on"); scrim.classList.add("on"); sheet.setAttribute("aria-hidden", "false");
  }

  // ---- Plans ahead (Jay, 23:36 26 October: "I want to be planning things more in advance") - six weeks, ideas to decide early ----
  function mondayOf(dt) { var x = new Date(dt); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
  function aheadBlock(list, d) {
    if (!list.length) return "";
    var start = mondayOf(d), weeks = [];
    for (var w = 0; w < 7; w++) { var m = new Date(start); m.setDate(start.getDate() + w * 7); weeks.push({ mon: m, items: [] }); }
    var todayIso = isoDay(d);
    list.forEach(function (x) {
      if (!x.date || x.date < todayIso) return;
      var dt = new Date(x.date + "T12:00:00"), idx = Math.floor((mondayOf(dt) - start) / (7 * 864e5));
      if (idx >= 0 && idx < weeks.length) weeks[idx].items.push(x);
    });
    weeks.forEach(function (wk) { wk.items.sort(function (p, q) { return (p.date + (p.time || "")).localeCompare(q.date + (q.time || "")); }); });
    var toDecide = list.filter(function (x) { return x.kind === "idea" && x.date >= todayIso; }).sort(function (p, q) { return String(p.decideBy || p.date).localeCompare(String(q.decideBy || q.date)); });
    var next = toDecide[0];
    var nextHtml = next ? wrap(next, "ahead-next", '<span class="an-k">Decide next' + (next.decideBy ? ' · by ' + esc(new Date(next.decideBy + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric" })) : '') + '</span><b>' + esc(next.label) + '</b><span class="an-s">' + esc([new Date(next.date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }), next.why].filter(Boolean).join(" · ")) + '</span>') : "";
    var cols = weeks.map(function (wk, i) {
      var label = i === 0 ? "This week" : i === 1 ? "Next week" : "w/c " + wk.mon.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      var rows = wk.items.map(function (x) {
        var dd = new Date(x.date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short" });
        var inner = '<span class="ad">' + esc(dd) + '</span><span class="al">' + esc(x.label) + '</span>';
        return wrap(x, "aitem " + (x.kind || "booked"), inner);
      }).join("");
      var hasWeekend = wk.items.some(function (x) { var g = new Date(x.date + "T12:00:00").getDay(); return (g === 0 || g === 6) && x.kind !== "free"; });
      if (!hasWeekend && i > 0) rows += '<div class="aitem free"><span class="ad">Sat</span><span class="al">Weekend free - fill it?</span></div>';
      return '<div class="awk"><div class="awh">' + label + '</div>' + (rows || '<div class="aempty">Nothing yet</div>') + '</div>';
    }).join("");
    return '<section class="glass ahead"><div class="sec-h"><span class="lab">Plans ahead</span><span class="aside">' + (toDecide.length ? toDecide.length + " idea" + (toDecide.length === 1 ? "" : "s") + " to decide" : "") + '</span></div>' + nextHtml +
      '<div class="aweeks">' + cols + '</div><div class="akey"><span><i class="k-b"></i>booked</span><span><i class="k-i"></i>idea - tap to decide</span><span><i class="k-f"></i>free</span></div></section>';
  }

  // =====================================================================================================
  // FOR YOU - one post per screen, each styled for itself (a kit of layouts and themes, or its own design)
  // =====================================================================================================
  var THEMES = {
    dawn: { bg: "linear-gradient(170deg,#1d2f4a 0%,#6b4f86 58%,#e0789a 100%)", ink: "#fff7f0", accent: "#ffd08a", accentInk: "#2a1530", motif: "sun", top: "#1d2f4a" },
    glacier: { bg: "linear-gradient(170deg,#06202b 0%,#145466 60%,#3fa3b6 110%)", ink: "#effafd", accent: "#bfe9f0", accentInk: "#082028", motif: "wave", top: "#06202b" },
    gold: { bg: "linear-gradient(170deg,#1f1608 0%,#6b4310 60%,#d08a22 115%)", ink: "#fff8ea", accent: "#ffd98a", accentInk: "#2a1a04", motif: "spark", top: "#1f1608" },
    forest: { bg: "linear-gradient(170deg,#07160f 0%,#16432c 60%,#3f8f5f 115%)", ink: "#f0fbf3", accent: "#b9edc9", accentInk: "#0b2416", motif: "leaf", top: "#07160f" },
    night: { bg: "linear-gradient(170deg,#05080c 0%,#1a2340 60%,#3a3f7a 115%)", ink: "#eef1ff", accent: "#c9cfff", accentInk: "#10142e", motif: "moon", top: "#05080c" },
    rose: { bg: "linear-gradient(170deg,#1c0c14 0%,#5c1f3c 60%,#c84a7a 115%)", ink: "#fff2f6", accent: "#ffc2d6", accentInk: "#2a0a18", motif: "bubble", top: "#1c0c14" },
    fairway: { bg: "repeating-linear-gradient(115deg,#134a31 0 46px,#175638 46px 92px)", ink: "#f4f1de", accent: "#e8f35a", accentInk: "#142e1f", motif: "ball", top: "#134a31" },
    cedar: { bg: "linear-gradient(180deg,rgba(255,170,90,0.28) 0%,rgba(40,18,8,0) 40%,rgba(30,12,4,0.55) 100%),repeating-linear-gradient(180deg,#8a5430 0 40px,#6b3d1f 40px 43px)", ink: "#fff4e6", accent: "#ff9a4d", accentInk: "#2a1206", label: "#ffd6a8", motif: "steam", top: "#6b3d1f" },
    porcelain: { bg: "radial-gradient(circle at 50% 30%,#f6f8f3 0%,#e4ece5 55%,#d3e0d8 100%)", ink: "#1f2e2a", soft: "#3f5650", label: "#245a4c", accent: "#245a4c", accentInk: "#f2f7f3", light: true, motif: "bowl", top: "#e4ece5" },
    paper: { bg: "linear-gradient(170deg,#fbf6ec 0%,#efe4d0 100%)", ink: "#2a1a12", soft: "#5a4636", label: "#8a4b1f", accent: "#b4541a", accentInk: "#ffffff", light: true, motif: "none", top: "#fbf6ec" },
    snow: { bg: "linear-gradient(175deg,#f4f8fc 0%,#d9e6f2 100%)", ink: "#13212d", soft: "#36495a", label: "#1d5f8c", accent: "#1d5f8c", accentInk: "#ffffff", light: true, motif: "mountain", top: "#f4f8fc" },
    ocean: { bg: "linear-gradient(170deg,#031b2e 0%,#0b4f7a 60%,#3aa0c8 115%)", ink: "#eefaff", accent: "#9fe3ff", accentInk: "#032033", motif: "wave", top: "#031b2e" },
    sunset: { bg: "linear-gradient(175deg,#2a1a3a 0%,#b24a5e 60%,#ff9a5a 110%)", ink: "#fff6ee", accent: "#ffe0a8", accentInk: "#3a1420", motif: "sun", top: "#2a1a3a" },
    plum: { bg: "linear-gradient(170deg,#1b1030 0%,#4b2a6a 60%,#8a4fa0 115%)", ink: "#fbf2ff", accent: "#f2c6ff", accentInk: "#2a0f3a", motif: "spark", top: "#1b1030" },
    ink: { bg: "linear-gradient(170deg,#0d0d10 0%,#1c1c24 100%)", ink: "#f4f4f6", accent: "#f4f4f6", accentInk: "#0d0d10", motif: "none", top: "#0d0d10" }
  };
  var KIND_THEME = { Do: "fairway", Send: "rose", Think: "night", Learn: "porcelain", Win: "gold", Fun: "sunset", Move: "glacier", Money: "gold", Build: "ink", Tomorrow: "dawn", Hello: "dawn", Gift: "plum" };
  function themeOf(c) {
    var base = typeof c.theme === "string" && THEMES[c.theme] ? THEMES[c.theme] : (THEMES[c.style] || THEMES[KIND_THEME[c.kind]] || THEMES.dawn);
    var t = Object.assign({}, base, (c.theme && typeof c.theme === "object") ? c.theme : {});
    if (Array.isArray(t.bg)) { t.fade = t.fade || t.bg[Math.min(1, t.bg.length - 1)]; t.bg = "linear-gradient(170deg," + t.bg.join(",") + ")"; }
    t.fade = t.fade || t.top || "#0b1022";
    var L = t.light;
    t.soft = t.soft || (L ? "rgba(20,20,20,0.72)" : "rgba(255,255,255,0.82)");
    t.label = t.label || (L ? t.accent : "rgba(255,255,255,0.78)");
    t.chip = t.chip || (L ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.28)");
    t.line = t.line || (L ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.4)");
    t.bubble = t.bubble || (L ? "#ffffff" : "#fbfaf4");
    t.bubbleInk = t.bubbleInk || "#1c2420";
    t.rail = t.rail || (L ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.3)");
    t.top = t.top || "#0b1022";
    return t;
  }
  function motifSvg(t, c) {
    var a = t.accent, k = t.ink, m = c.motif || t.motif;
    if (c.art && /^art\/[a-z0-9-]+\.svg$/.test(c.art)) return c.artStyle ? '<img class="motif" alt="" src="' + c.art + '" style="' + esc(c.artStyle) + '">' : '<img class="motif art-top" alt="" src="' + c.art + '">';
    if (c.artSvg && /^<svg[\s>]/i.test(String(c.artSvg).trim())) {
      var src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(c.artSvg);
      // a post's own illustration sits in the space above its words and sizes itself to fit (art-top), unless the designer placed it
      return c.artStyle ? '<img class="motif" alt="" src="' + src + '" style="' + esc(c.artStyle) + '">' : '<img class="motif art-top" alt="" src="' + src + '">';
    }
    var S = {
      ball: '<svg class="motif" style="right:-110px;top:-130px;width:300px" viewBox="0 0 300 300" aria-hidden="true"><circle cx="150" cy="150" r="140" fill="#f7f5ea"/><circle cx="150" cy="150" r="140" fill="none" stroke="#d9d5c2" stroke-width="10" stroke-opacity="0.5"/>' + [[80, 190], [108, 214], [140, 230], [174, 232], [66, 158], [94, 180], [124, 198], [156, 204], [188, 204], [70, 126], [98, 148], [130, 166], [162, 174], [196, 174]].map(function (p) { return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="9" fill="#e3dfcc"/>'; }).join("") + '</svg>',
      steam: '<svg class="motif" style="left:0;top:0;width:100%;height:240px" viewBox="0 0 390 230" preserveAspectRatio="none" aria-hidden="true"><path d="M60 230 C 30 180, 100 160, 70 110 S 90 40, 60 0" fill="none" stroke="#fff" stroke-opacity="0.2" stroke-width="14" stroke-linecap="round"/><path d="M190 230 C 160 175, 230 150, 200 100 S 220 30, 190 -10" fill="none" stroke="#fff" stroke-opacity="0.14" stroke-width="18" stroke-linecap="round"/><path d="M320 230 C 290 185, 360 165, 330 120 S 350 50, 320 10" fill="none" stroke="#fff" stroke-opacity="0.18" stroke-width="12" stroke-linecap="round"/></svg>',
      bowl: '<svg class="motif" style="left:50%;top:calc(var(--safe-top) + 40px);width:250px;margin-left:-125px" viewBox="70 70 250 210" aria-hidden="true"><circle cx="195" cy="200" r="88" fill="none" stroke="' + a + '" stroke-opacity="0.12" stroke-width="1.5"/><path d="M178 150c-10-20 10-30 0-52M200 146c-10-22 12-34 2-58M222 150c-10-20 10-30 0-50" fill="none" stroke="' + a + '" stroke-opacity="0.32" stroke-width="3" stroke-linecap="round"/><path d="M118 176h154c-4 56-36 86-77 86s-73-30-77-86z" fill="#fbfcf9" stroke="' + a + '" stroke-width="3" stroke-linejoin="round"/><path d="M128 196c32 10 102 10 134 0" fill="none" stroke="' + a + '" stroke-opacity="0.5" stroke-width="3" stroke-linecap="round"/><ellipse cx="195" cy="176" rx="77" ry="9" fill="#e9f1ec" stroke="' + a + '" stroke-width="3"/><rect x="170" y="262" width="50" height="10" rx="4" fill="' + a + '" fill-opacity="0.8"/></svg>',
      sun: '<svg class="motif" style="right:-70px;top:-60px;width:280px" viewBox="0 0 280 280" aria-hidden="true"><circle cx="140" cy="140" r="130" fill="' + a + '" opacity="0.12"/><circle cx="140" cy="140" r="90" fill="' + a + '" opacity="0.2"/><circle cx="140" cy="140" r="56" fill="' + a + '" opacity="0.92"/></svg>',
      moon: '<svg class="motif" style="right:20px;top:calc(var(--safe-top) + 70px);width:150px" viewBox="0 0 150 150" aria-hidden="true"><circle cx="75" cy="75" r="70" fill="' + a + '" opacity="0.08"/><path d="M100 30a48 48 0 1 0 20 76 40 40 0 1 1-20-76z" fill="' + a + '" opacity="0.9"/><circle cx="20" cy="20" r="1.5" fill="#fff"/><circle cx="130" cy="130" r="1.2" fill="#fff"/><circle cx="10" cy="110" r="1" fill="#fff"/></svg>',
      wave: '<svg class="motif" style="left:0;right:0;top:calc(var(--safe-top) + 60px);width:100%" viewBox="0 0 390 160" preserveAspectRatio="none" aria-hidden="true"><path d="M0 60c40-24 80 24 130 0s90 24 130 0 90 24 130 0" fill="none" stroke="' + a + '" stroke-opacity="0.5" stroke-width="3"/><path d="M0 95c40-24 80 24 130 0s90 24 130 0 90 24 130 0" fill="none" stroke="' + a + '" stroke-opacity="0.3" stroke-width="3"/><path d="M0 130c40-24 80 24 130 0s90 24 130 0 90 24 130 0" fill="none" stroke="' + a + '" stroke-opacity="0.18" stroke-width="3"/></svg>',
      leaf: '<svg class="motif" style="right:-30px;top:-20px;width:240px" viewBox="0 0 240 240" aria-hidden="true"><path d="M200 30C90 40 40 110 60 200c90-10 150-70 140-170z" fill="' + a + '" opacity="0.22"/><path d="M60 200C100 140 140 90 200 30" stroke="' + a + '" stroke-opacity="0.6" stroke-width="3" fill="none"/></svg>',
      spark: '<svg class="motif" style="right:10px;top:calc(var(--safe-top) + 50px);width:180px" viewBox="0 0 180 180" aria-hidden="true"><path d="M90 20l10 60 60 10-60 10-10 60-10-60-60-10 60-10z" fill="' + a + '" opacity="0.85"/><path d="M150 120l4 18 18 4-18 4-4 18-4-18-18-4 18-4z" fill="' + a + '" opacity="0.6"/><circle cx="30" cy="140" r="4" fill="' + a + '" opacity="0.6"/></svg>',
      bubble: '<svg class="motif" style="left:22px;right:22px;top:calc(var(--safe-top) + 74px);width:calc(100% - 44px);height:140px" viewBox="0 0 340 140" aria-hidden="true"><rect x="0" y="0" width="230" height="52" rx="26" fill="' + a + '" opacity="0.85"/><rect x="110" y="70" width="230" height="44" rx="22" fill="' + k + '" opacity="0.2"/></svg>',
      mountain: '<svg class="motif" style="left:0;top:calc(var(--safe-top) + 50px);width:100%" viewBox="0 0 390 200" preserveAspectRatio="none" aria-hidden="true"><path d="M0 200L90 60l50 60 70-100 80 110 40-40 60 110z" fill="' + a + '" opacity="0.18"/><path d="M190 20l20 30-12-4-8 10-8-10-12 4z" fill="#fff" opacity="0.9"/></svg>'
    };
    return S[m] || "";
  }
  var HIDE = /^(done|sent it|sent|booked it|watched it|got it|nice|♥ nice|ha|good|let's go|sitting with it|not now|not this week|later|not tonight|more (\w+ )*like this|taken in|read it)$/i;
  var POS = /^(done|sent it|sent|booked it|watched it|got it|nice|♥ nice|ha|good|let's go|sitting with it|love it|read it)$/i;
  function layoutOf(c) { return c.layout || (c.html ? "custom" : (/^(learn|think)$/i.test(c.kind || "") ? "learn" : /^(fun|win|gift)$/i.test(c.kind || "") ? "fun" : "task")); }
  function swipeRight(c, lay) {
    if (c.swipe && c.swipe.right) return c.swipe.right;
    var a = (c.actions || []).filter(function (x) { return !x.url && POS.test(x.answer || x.label); })[0];
    if (a) return a.answer || a.label;
    return lay === "learn" ? "Taken in" : lay === "fun" ? "Loved it" : "Done";
  }
  function primaryOf(c, shown) {
    if (c.primary) return c.primary;
    if (c.copy && c.copyPlace !== "more") return { label: c.copyLabel || "Copy message", copy: true };
    var u = shown.filter(function (x) { return x.url; })[0]; if (u) return u;
    return shown[0] || null;
  }
  function postVisual(c, t) {
    var v = c.visual; if (!v || !v.type) return "";
    if (v.type === "progress") {
      var max = Number(v.max) || 100, val = Math.max(0, Math.min(max, Number(v.value) || 0)), r = 33, circ = 2 * Math.PI * r;
      return '<div class="vis ring"><svg viewBox="0 0 78 78" aria-hidden="true"><circle cx="39" cy="39" r="' + r + '" fill="none" stroke="' + t.line + '" stroke-width="8"/><circle cx="39" cy="39" r="' + r + '" fill="none" stroke="' + t.accent + '" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + (circ * val / max).toFixed(1) + ' ' + circ.toFixed(1) + '"/></svg><div><b>' + esc(v.display || (val + " / " + max)) + '</b><span>' + esc(v.label || "") + '</span></div></div>';
    }
    if (v.type === "timeline") {
      var it = (v.items || []).slice(0, 5), n = it.length;
      if (!n) return "";
      var dots = it.map(function (x, i) { return '<i class="' + (x.now ? "now" : "") + '" style="left:' + (n === 1 ? 50 : i / (n - 1) * 100) + '%"></i>'; }).join("");
      return '<div class="vis"><div class="track">' + dots + '</div><div class="stops n' + n + '" style="grid-template-columns:repeat(' + n + ',minmax(0,1fr))">' + it.map(function (x) { return '<div class="' + (x.now ? "now" : "") + '"><time>' + esc(x.time || "") + '</time>' + esc(x.label || "") + '</div>'; }).join("") + '</div>' + (v.note ? '<div class="note">' + esc(v.note) + '</div>' : '') + '</div>';
    }
    if (v.type === "bars") {
      var items = (v.items || []).slice(0, 6), top = Number(v.max) || Math.max.apply(null, items.map(function (x) { return Number(x.value) || 0; }).concat([1]));
      return '<div class="vis bars">' + items.map(function (x) { return '<div><div class="l"><span>' + esc(x.label) + '</span><span>' + esc(x.display || x.value) + '</span></div><div class="t"><i style="width:' + Math.max(2, Math.min(100, 100 * (Number(x.value) || 0) / top)).toFixed(0) + '%"></i></div></div>'; }).join("") + '</div>';
    }
    return "";
  }
  function postHTML(c, i, n) {
    var t = themeOf(c), lay = layoutOf(c), a = c.answer || {}, th = thread(c), lt = lastTeam(c), fresh = isNew(c);
    var shown = (c.actions || []).filter(function (x) { return x.url || !HIDE.test(x.answer || x.label); });
    var prim = lay === "learn" && !c.primary && !c.copy ? null : primaryOf(c, shown);
    var secs = shown.filter(function (x) { return x !== prim; }).slice(0, 2);
    var right = swipeRight(c, lay), left = (c.swipe && c.swipe.left) || "Not now";
    var vars = "--p-ink:" + t.ink + ";--p-soft:" + t.soft + ";--p-label:" + t.label + ";--p-accent:" + t.accent + ";--p-accent-ink:" + t.accentInk + ";--p-chip:" + t.chip + ";--p-line:" + t.line + ";--p-bubble:" + t.bubble + ";--p-bubble-ink:" + t.bubbleInk + ";--p-rail:" + t.rail;
    var photo = safeUrl(c.image);
    var bg = '<div class="bg" style="background:' + esc(t.bg) + '"></div>' + (photo ? '<div class="photo" style="background-image:url(&quot;' + esc(photo) + '&quot;)"></div>' : motifSvg(t, c)) + '<div class="fade" style="--fade:' + esc(t.fade) + '"></div>';
    if (lay === "custom" && c.html) bg = '<div class="bg" style="background:' + esc(t.bg) + '"></div><iframe sandbox="" title="" aria-hidden="true" tabindex="-1" srcdoc="' + esc(c.html) + '"></iframe>';
    var label = c.label || [c.kind, c.due].filter(Boolean).join(" · ");
    var body = "";
    if (lay !== "custom" || !c.html) {
      body += label ? '<div class="plab">' + esc(label) + '</div>' : '';
      if (lay === "learn") {
        body += '<h2 class="pquote">' + esc(c.quote || c.title) + '</h2>' + (c.credit ? '<div class="pcredit">' + esc(c.credit) + '</div>' : '');
        if (c.body) body += '<div class="ptext">' + fmt(c.body) + '</div>';
      } else {
        if (c.big) body += '<div class="pbig">' + esc(c.big) + '</div>';
        body += '<h2 class="ptitle' + (c.big || String(c.title || "").length > 46 ? " sm" : "") + '">' + esc(c.title) + '</h2>';
        if (c.chips && c.chips.length) body += '<div class="chips">' + c.chips.slice(0, 4).map(function (x) { return '<span>' + esc(x) + '</span>'; }).join("") + '</div>';
        if (c.body) body += '<div class="ptext">' + fmt(c.body) + '</div>';
      }
      body += postVisual(c, t);
      if (c.compare && c.compare.length) body += '<div class="compare">' + c.compare.slice(0, 2).map(function (x) { return '<div class="' + (x.pick ? "pick" : "") + '"><em>' + esc(x.label) + '</em><b>' + esc(x.value) + '</b><span>' + esc(x.note || "") + '</span></div>'; }).join("") + '</div>';
      if (c.copy && c.copyPlace !== "more") body += '<div class="bubble">' + (c.copyTo ? '<small>To ' + esc(c.copyTo) + '</small>' : '') + esc(c.copy) + '</div>';
      if (c.tonight) body += '<div class="tonight"><span>' + esc(c.tonight.label || "Tonight") + '</span><span>' + esc(c.tonight.text || c.tonight) + '</span></div>';
      if (c.deeper && c.deeper.length) body += '<div class="deeper">' + c.deeper.slice(0, 3).map(function (x) {
        var u = safeUrl(x.url); var inner = '<em>' + esc(x.type || "More") + '</em><b>' + esc(x.label) + '</b>';
        return u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + inner + '</a>' : '<button type="button" data-act="more" data-id="' + esc(c.id) + '">' + inner + '</button>';
      }).join("") + '</div>';
    }
    if (lt) body += '<button type="button" class="preply" data-act="chat" data-id="' + esc(c.id) + '"><b>Team</b><span>' + esc(plain(lt.text)) + '</span></button>';
    if (prim) body += btn(c, prim, "primary");
    var secHtml = secs.map(function (x) { return btn(c, x, "sec"); }).join("");
    if (secHtml) body += '<div class="secs">' + secHtml + '</div>';
    body += '<span class="pstatus" id="s-' + esc(c.id) + '"></span>';
    var withLove = lay === "learn" || lay === "fun" || c.love;
    // the post's own tools sit in one row at the top, beside the history clock (Jay, 23:36 26 October: the side icons "don't align to the posts")
    var tools = (withLove ? '<button type="button" class="tool love" data-act="love" data-id="' + esc(c.id) + '" aria-pressed="' + Boolean(a.loved) + '" aria-label="Love it - more like this">' + I.heart + '</button>' : '') +
      '<button type="button" class="tool" data-act="chat" data-id="' + esc(c.id) + '" aria-label="Talk to the team about this">' + I.chat + (th.length ? '<span class="n">' + th.length + '</span>' : '') + '</button>' +
      (c.more ? '<button type="button" class="tool" data-act="more" data-id="' + esc(c.id) + '" aria-label="The detail">' + I.dots + '</button>' : '') +
      '<button type="button" class="tool" data-act="history" aria-label="Answered and done">' + I.hist + '</button>';
    return '<article class="post" id="p-' + esc(c.id) + '" data-id="' + esc(c.id) + '" data-top="' + esc(t.top) + '" data-right="' + esc(right) + '" data-left="' + esc(left) + '" data-love="' + (withLove ? 1 : 0) + '">' +
      '<div class="under r"><div><i>' + I.tick + '</i><b>' + esc(right) + '</b></div></div><div class="under l"><div><i>' + I.clock + '</i><b>' + esc(left) + '</b></div></div>' +
      '<div class="face" style="' + vars + '">' + bg +
      '<div class="ptop"><span class="pill">' + (fresh ? '<span class="nw" id="new-' + esc(c.id) + '">New ·</span>' : '') + (i + 1) + ' of ' + n + '</span><div class="tools">' + tools + '</div></div>' +
      '<div class="pbody">' + body + '</div>' +
      '<div class="hints"><span>← ' + esc(left.toLowerCase()) + '</span><span>' + esc(right.toLowerCase()) + ' →</span></div></div></article>';
  }
  function btn(c, x, cls) {
    if (x.more) return '<button type="button" class="' + cls + '" data-act="more" data-id="' + esc(c.id) + '">' + esc(x.label) + '</button>';
    if (x.copy) return '<button type="button" class="' + cls + '" data-act="copy" data-id="' + esc(c.id) + '">' + I.copy + esc(x.label) + '</button>';
    var u = safeUrl(x.url);
    if (u) return '<a class="' + cls + '" href="' + esc(u) + '" target="_blank" rel="noopener">' + (/^tel:/.test(x.url) ? I.phone : "") + esc(x.label) + (cls === "primary" ? I.out : "") + '</a>';
    if (/^tel:\+?[\d ]+$/.test(String(x.url || ""))) return '<a class="' + cls + '" href="' + esc(x.url) + '">' + I.phone + esc(x.label) + '</a>';
    return '<button type="button" class="' + cls + '" data-act="answer" data-id="' + esc(c.id) + '" data-answer="' + esc(x.answer || x.label) + '" data-quiet="' + (x.quiet ? "1" : "") + '">' + esc(x.label) + '</button>';
  }
  function renderPosts(focusId) {
    var list = open();
    metaTheme.setAttribute("content", "#0b1022");
    if (!list.length) { feed.innerHTML = '<div class="caught"><h2>' + (lastError ? "Can't reach your team right now." : "All caught up.") + '</h2><p>' + (lastError ? esc(lastError) : "Nothing waiting. Go and do something you love - new posts land through the day.") + '</p><div class="row"><button type="button" class="btn ghost" data-act="history">' + I.hist + ' Answered and done</button></div></div>'; return; }
    feed.innerHTML = list.map(function (c, i) { return postHTML(c, i, list.length); }).join("") + '<div class="caught"><h2>That\'s everything for now.</h2><p>Swipe back up, or tell the team anything on your mind.</p><div class="row"><button type="button" class="btn ghost" data-act="history">' + I.hist + ' Answered and done</button></div></div>';
    if (watcher) { watcher.disconnect(); feed.querySelectorAll(".post").forEach(function (el) { watcher.observe(el); }); }
    fitArt();
    if (focusId) { var el = document.getElementById("p-" + focusId); if (el) feed.scrollTop = el.offsetTop; }
    var first = feed.querySelector(".post"); if (first && !focusId) themeFrom(first);
  }

  function fitArt() {
    feed.querySelectorAll(".post").forEach(function (p) {
      var first = p.querySelector(".pbody > *"); if (!first) return;
      var y = first.getBoundingClientRect().top - p.getBoundingClientRect().top;
      p.querySelector(".face").style.setProperty("--words", Math.round(y) + "px");
    });
  }
  window.addEventListener("resize", function () { if (view === "feed") fitArt(); });

  // ---- swiping: right for done, left for not now - with a few seconds to undo ----
  (function () {
    var st = null;
    feed.addEventListener("pointerdown", function (e) {
      if (view !== "feed") return;
      var post = e.target.closest(".post"); if (!post || e.button > 0) return;
      st = { post: post, face: post.querySelector(".face"), x: e.clientX, y: e.clientY, id: e.pointerId, mode: "", dx: 0, w: post.offsetWidth };
    });
    feed.addEventListener("pointermove", function (e) {
      if (!st || e.pointerId !== st.id) return;
      var dx = e.clientX - st.x, dy = e.clientY - st.y;
      if (!st.mode) {
        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.3) { st.mode = "h"; try { st.face.setPointerCapture(e.pointerId); } catch (er) {} }
        else if (Math.abs(dy) > 12) { st = null; return; }
        else return;
      }
      st.dx = dx; st.face.classList.remove("springing");
      st.face.style.transform = "translateX(" + dx + "px) rotate(" + (dx / 28).toFixed(2) + "deg)";
      var r = st.post.querySelector(".under.r"), l = st.post.querySelector(".under.l"), k = Math.min(1, Math.abs(dx) / (st.w * 0.3));
      r.style.opacity = dx > 0 ? k : 0; l.style.opacity = dx < 0 ? k : 0;
    });
    function end(e) {
      if (!st || (e && e.pointerId !== st.id)) return;
      var s = st; st = null;
      if (s.mode !== "h") return;
      suppressClick = true; setTimeout(function () { suppressClick = false; }, 50);
      if (Math.abs(s.dx) > s.w * 0.28) commit(s.post, s.dx > 0 ? "right" : "left");
      else { s.face.classList.add("springing"); s.face.style.transform = ""; s.post.querySelectorAll(".under").forEach(function (u) { u.style.opacity = 0; }); }
    }
    feed.addEventListener("pointerup", end); feed.addEventListener("pointercancel", end);
  })();
  var suppressClick = false, pending = null;
  function commit(post, dir) {
    var id = post.dataset.id, c = card(id), face = post.querySelector(".face"), w = post.offsetWidth;
    var choice = dir === "right" ? post.dataset.right : post.dataset.left;
    face.classList.remove("springing"); face.classList.add("leaving");
    face.style.transform = "translateX(" + (dir === "right" ? 1.3 : -1.3) * w + "px) rotate(" + (dir === "right" ? 14 : -14) + "deg)";
    if (pending) finish(pending);
    pending = { id: id, choice: choice, dir: dir, post: post, timer: setTimeout(function () { finish(pending); }, 4200) };
    toast((dir === "right" ? "✓ " : "") + choice, true);
  }
  function finish(p) {
    if (!p || p.done) return; p.done = true; clearTimeout(p.timer); if (pending === p) pending = null; toastOff();
    var c = card(p.id); if (!c) return;
    var quiet = p.dir === "left" || /^(taken in|loved it|ha|nice|got it|watched it|sitting with it|love it|good|let's go)$/i.test(p.choice);
    var idx = open().indexOf(c);
    c.answer = Object.assign({}, c.answer || {}, { choice: p.choice, at: new Date().toISOString() });
    var list = open(), next = list[Math.min(idx, list.length - 1)];
    if (view === "feed") renderPosts(next && next.id);
    post({ op: "answer", id: p.id, choice: p.choice, quiet: quiet }).then(function (d) { if (d.answer) c.answer = d.answer; })
      .catch(function () { delete c.answer.choice; toast("Couldn't save - check your signal", false); if (view === "feed") renderPosts(p.id); });
  }
  function undo() {
    var p = pending; if (!p) return; clearTimeout(p.timer); pending = null; toastOff();
    var face = p.post.querySelector(".face"); face.classList.remove("leaving"); face.classList.add("springing"); face.style.transform = "";
    p.post.querySelectorAll(".under").forEach(function (u) { u.style.opacity = 0; });
  }
  var toastTimer = 0;
  function toast(text, withUndo) {
    toastEl.innerHTML = '<span>' + esc(text) + '</span>' + (withUndo ? '<button type="button" data-act="undo">Undo</button>' : '');
    toastEl.classList.add("on"); clearTimeout(toastTimer);
    if (!withUndo) toastTimer = setTimeout(toastOff, 3000);
  }
  function toastOff() { toastEl.classList.remove("on"); }

  // double tap a post that can be loved
  var lastTap = { t: 0, id: "" };
  feed.addEventListener("click", function (e) {
    if (view !== "feed" || e.target.closest("button,a")) return;
    var post = e.target.closest(".post"); if (!post || post.dataset.love !== "1") return;
    var t = Date.now();
    if (lastTap.id === post.dataset.id && t - lastTap.t < 320) { love(post.dataset.id, true); var hp = document.createElement("div"); hp.className = "heartpop"; hp.innerHTML = I.heart; post.appendChild(hp); setTimeout(function () { hp.remove(); }, 900); lastTap.t = 0; }
    else lastTap = { t: t, id: post.dataset.id };
  });
  function love(id, force) {
    var c = card(id); if (!c) return;
    var on = force === true ? true : !((c.answer || {}).loved);
    var b = feed.querySelector('#p-' + CSS.escape(id) + ' .love'); if (b) b.setAttribute("aria-pressed", String(on));
    c.answer = Object.assign({}, c.answer || {}, { loved: on });
    post({ op: "answer", id: id, loved: on, quiet: true }).then(function (d) { if (d.answer) c.answer = d.answer; }).catch(function () { if (b) b.setAttribute("aria-pressed", String(!on)); });
  }

  // =====================================================================================================
  // Answered and done, Tell us, the sheet
  // =====================================================================================================
  function renderDone() {
    metaTheme.setAttribute("content", "#0b1022");
    var q = query.toLowerCase();
    var list = cards.filter(function (c) {
      if (isHome(c)) return false;
      if (!q) return answered(c) || !live(c);
      var a = c.answer || {};
      return [c.title, c.body, c.more, c.copy, c.kind, c.author, a.choice, thread(c).map(function (m) { return m.text; }).join(" ")].join(" ").toLowerCase().indexOf(q) !== -1;
    }).sort(function (a, b) { return String((b.answer || {}).at || b.created || "").localeCompare(String((a.answer || {}).at || a.created || "")); });
    feed.innerHTML = '<div class="page"><div class="top"><button type="button" class="back" data-act="backfeed" aria-label="Back to For you">' + I.back + '</button><h2>Answered and done</h2></div><input type="search" id="search" placeholder="Search every post, message and reply" aria-label="Search" value="' + esc(query) + '">' +
      (list.length ? list.map(function (c) {
        var a = c.answer || {}, t = thread(c);
        return '<button type="button" class="item" data-act="more" data-id="' + esc(c.id) + '"><span class="t">' + (lastTeam(c) && isNew(c) ? '<span class="newdot" aria-label="New reply"></span>' : '') + hi(c.title) + '</span><span class="meta"><span>' + esc(c.kind || "") + '</span>' +
          (a.choice ? '<span class="ans">✓ ' + hi(a.choice) + '</span>' : (live(c) ? '<span>open</span>' : '<span>retired</span>')) +
          '<span>' + when(a.at || c.created) + '</span>' + (t.length ? '<span>' + t.length + ' message' + (t.length === 1 ? '' : 's') + '</span>' : '') + (a.loved ? '<span>♥</span>' : '') + '</span></button>';
      }).join("") : '<p>' + (query ? "Nothing matches that yet." : "Posts you swipe or answer land here, so you can find them again.") + '</p>') + '</div>';
    var s = document.getElementById("search");
    s.addEventListener("input", function () { query = s.value.trim(); var pos = s.selectionStart; renderDone(); var n = document.getElementById("search"); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} });
  }
  function renderTell() {
    metaTheme.setAttribute("content", "#0b1022");
    feed.innerHTML = '<div class="page tellbox"><h2>Tell the team anything.</h2><p>An idea, a feeling, a change of plan. Start with "idea:" and it gets filed with a date to come back to.</p>' +
      '<textarea id="tell-text" placeholder="What\'s on your mind?" aria-label="Message to the team"></textarea>' +
      '<div class="row"><button type="button" class="btn" data-act="tell">Send to the team</button><span class="status" id="tell-status"></span></div>' +
      (deferred && !installed() ? '<div class="install"><p>Put the Feed on your home screen.</p><button type="button" class="btn ghost" data-act="install">Install</button></div>' : '') +
      (notes.length ? '<p style="margin-top:10px">Sent recently</p><div class="sent">' + notes.slice(0, 6).map(function (n) { return '<div><time>' + esc(when(n.at)) + '</time>' + esc(n.text) + '</div>'; }).join("") + '</div>' : '') + '</div>';
  }
  function openSheet(id, mode) {
    var c = card(id); if (!c) return;
    sheetFor = id; sheetMode = mode;
    var inner = '<div class="grab"></div><div class="head"><div style="flex:1;min-width:0"><small>' + esc(c.author || "Your team") + (c.kind ? ' · ' + esc(c.kind) : '') + '</small><h3 id="sheet-title">' + esc(c.title) + '</h3></div><button type="button" class="round" data-act="close" aria-label="Close">' + I.close + '</button></div>';
    if (mode === "chat") {
      var t = thread(c);
      inner += '<div class="scroll" id="sheet-scroll"><div class="chat" id="chat">' + (t.length ? t.map(bubble).join("") : '<div class="sys">Ask anything about this. The team replies here, usually within a few minutes.</div>') +
        '</div></div><div class="compose"><textarea id="compose" rows="1" placeholder="Message the team about this…" aria-label="Message the team"></textarea><button type="button" class="send" data-act="send" data-id="' + esc(c.id) + '" aria-label="Send">' + I.send + '</button></div>';
    } else {
      var links = (c.actions || []).filter(function (x) { return safeUrl(x.url); }).concat((c.deeper || []).filter(function (x) { return safeUrl(x.url); })), a = c.answer || {};
      inner += '<div class="scroll" id="sheet-scroll">' + (c.quote ? '<div class="prose" style="font-family:var(--serif);font-style:italic;font-size:1.3rem">' + esc(c.quote) + '</div>' : '') +
        (c.body ? '<div class="prose">' + fmt(c.body) + '</div>' : '') + (c.more ? '<div class="prose dim">' + fmt(c.more) + '</div>' : '') +
        (c.copy ? '<div class="copybox"><div class="txt">' + esc(c.copy) + '</div><div class="row"><button type="button" class="btn" data-act="copy" data-id="' + esc(c.id) + '">' + I.copy + ' Copy message</button><span class="status" id="cs-' + esc(c.id) + '"></span></div></div>' : '') +
        (links.length ? '<div class="links">' + links.map(function (x) { return '<a href="' + esc(x.url) + '" target="_blank" rel="noopener"><span>' + esc(x.label) + '</span>' + I.out + '</a>'; }).join("") + '</div>' : '') +
        (a.choice ? '<div class="sys">You answered: ' + esc(a.choice) + (a.at ? ' · ' + esc(when(a.at)) : '') + '</div>' : '') +
        '<div class="row"><button type="button" class="btn ghost" data-act="chat" data-id="' + esc(c.id) + '">' + I.chat + (thread(c).length ? ' Conversation (' + thread(c).length + ')' : ' Ask the team') + '</button></div></div>';
    }
    sheet.innerHTML = inner; sheet.classList.add("on"); scrim.classList.add("on"); sheet.setAttribute("aria-hidden", "false");
    markSeen(id);
    var sc = document.getElementById("sheet-scroll"); if (mode === "chat" && sc) sc.scrollTop = sc.scrollHeight;
    var ta = document.getElementById("compose");
    if (ta) { ta.value = ls("feed-draft-" + id) || ""; ta.addEventListener("input", function () { ta.style.height = "auto"; ta.style.height = Math.min(130, ta.scrollHeight) + "px"; ls("feed-draft-" + id, ta.value); }); }
  }
  function bubble(m) { return '<div class="msg ' + (m.who === "jay" ? "jay" : "team") + '">' + (m.who === "jay" ? "" : "<b>Your team</b>") + fmt(m.text) + (m.at ? '<time>' + esc(when(m.at)) + '</time>' : '') + '</div>'; }
  function closeSheet() { sheet.classList.remove("on"); scrim.classList.remove("on"); sheet.setAttribute("aria-hidden", "true"); sheetFor = null; if (view === "done") renderDone(); }
  scrim.addEventListener("click", closeSheet);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && sheetFor) closeSheet(); });
  (function () {
    var y0 = null;
    sheet.addEventListener("touchstart", function (e) { var sc = document.getElementById("sheet-scroll"); if (e.target.closest(".compose")) return; if (!sc || sc.scrollTop <= 0 || e.target.closest(".head,.grab")) y0 = e.touches[0].clientY; }, { passive: true });
    sheet.addEventListener("touchmove", function (e) { if (y0 === null) return; var d = e.touches[0].clientY - y0; if (d > 0) sheet.style.transform = "translateY(" + d + "px)"; }, { passive: true });
    sheet.addEventListener("touchend", function (e) { if (y0 === null) return; var d = e.changedTouches[0].clientY - y0; y0 = null; sheet.style.transform = ""; if (d > 90) closeSheet(); });
  })();

  // ---- the Switchboard ----
  function load() {
    if (!api || !key) { render(); return; }
    fetch(api + (api.indexOf("?") === -1 ? "?" : "&") + "api=feed&k=" + encodeURIComponent(key), { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok) throw new Error(d.error === "key" ? "Your key was not recognised - open your setup link again." : "The Switchboard said: " + d.error);
        lastError = ""; cards = d.cards || []; notes = d.notes || [];
        if (pending) { var pc = card(pending.id); if (pc) pc.answer = Object.assign({}, pc.answer || {}); }
        ls("feed-cache", JSON.stringify({ cards: cards, notes: notes }));
        if (sheetFor && sheetMode === "chat") { var ch = document.getElementById("chat"), c = card(sheetFor); if (ch && c && thread(c).length) { ch.innerHTML = thread(c).map(bubble).join(""); markSeen(sheetFor); } }
        var typing = document.activeElement && /TEXTAREA|INPUT/.test(document.activeElement.tagName);
        if (!typing && !pending) {
          if (view === "home") render();
          else if (view === "feed") { var cur = currentPost(); applyMode(); dots(); renderPosts(cur); }
          else if (view === "done" && !query) renderDone(); else dots();
        }
      })
      .catch(function (e) { lastError = e.message || "No connection - showing what was here last."; if (!cards.length) render(); });
  }
  function currentPost() { var ps = feed.querySelectorAll(".post"), y = feed.scrollTop + feed.clientHeight / 2; for (var i = 0; i < ps.length; i++) if (ps[i].offsetTop <= y && ps[i].offsetTop + ps[i].offsetHeight > y) return ps[i].dataset.id; return null; }
  function post(body) {
    body.api = "feed"; body.k = key;
    return fetch(api, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); }).then(function (d) { if (!d.ok) throw new Error(d.error || "failed"); return d; });
  }
  function status(id, t, warn) { var s = document.getElementById("s-" + id) || document.getElementById("cs-" + id); if (s) { s.textContent = t; s.style.color = warn ? "#e9b872" : ""; } }
  function copyText(txt, done) {
    var ok = function () { done(true); }, fail = function () { done(false); };
    try { navigator.clipboard.writeText(txt).then(ok, fail); } catch (e) { fail(); }
  }
  function go(v, focusId) {
    view = v;
    document.querySelectorAll("nav button").forEach(function (x) { x.setAttribute("aria-selected", x.id === "tab-" + (v === "done" ? "feed" : v) ? "true" : "false"); });
    feed.scrollTop = 0; render();
    if (v === "feed" && focusId) renderPosts(focusId);
  }

  document.addEventListener("click", function (e) {
    if (suppressClick) { e.preventDefault(); e.stopPropagation(); return; }
    var b = e.target.closest("[data-act]"); if (!b) return;
    var id = b.dataset.id, act = b.dataset.act, c = card(id);
    if (act === "answer") {
      var ans = b.dataset.answer, quiet = b.dataset.quiet === "1";
      status(id, "Saving…");
      post({ op: "answer", id: id, choice: ans, quiet: quiet }).then(function (d) {
        if (c) c.answer = d.answer; status(id, "✓ " + ans + (quiet ? "" : " - the team is on it"));
        setTimeout(function () { var list = open(); var nx = list[0]; renderPosts(nx && nx.id); }, 900);
      }).catch(function () { status(id, "Couldn't save - check your signal and tap again", true); });
    } else if (act === "love") love(id);
    else if (act === "more") openSheet(id, "more");
    else if (act === "chat") openSheet(id, "chat");
    else if (act === "close") closeSheet();
    else if (act === "undo") undo();
    else if (act === "history") go("done");
    else if (act === "backfeed") go("feed");
    else if (act === "refresh") { b.textContent = "Refreshing…"; load(); }
    else if (act === "day") { dayOpen = !dayOpen; renderHome(); }
    else if (act === "archive") openArchive();
    else if (act === "dfy") { dfyOpen = !dfyOpen; renderHome(); }
    else if (act === "open" || act === "goto") {
      if (c && !answered(c) && live(c)) go("feed", id); else if (c) openSheet(id, "more");
    } else if (act === "copy") {
      copyText((c && c.copy) || "", function (ok) { status(id, ok ? "Copied - send it, then swipe right" : "Long-press the message to copy it", !ok); });
    } else if (act === "copytext") {
      var x = friendsPlans[Number(b.dataset.i)]; if (!x) return;
      copyText(x.message, function (ok) {
        if (!ok) { b.innerHTML = "Hold to copy"; return; }
        b.classList.add("sentq"); b.innerHTML = I.tick + "Sent?"; b.dataset.act = "sentit"; b.setAttribute("aria-label", "I've sent it");
      });
    } else if (act === "sentit") {
      var y = friendsPlans[Number(b.dataset.i)]; if (!y) return;
      ls(sentKey(y), "1");
      if (y.card && card(y.card)) post({ op: "answer", id: y.card, choice: "Sent it" }).then(function (d) { var cc = card(y.card); if (cc) cc.answer = d.answer; }).catch(function () {});
      renderHome();
    } else if (act === "send") {
      var ta = document.getElementById("compose"), v = ta ? ta.value.trim() : "";
      if (!v) { if (ta) ta.focus(); return; }
      var ch = document.getElementById("chat"), sys = ch.querySelector(".sys"); if (sys) sys.remove();
      ch.insertAdjacentHTML("beforeend", bubble({ who: "jay", text: v, at: new Date().toISOString() }) + '<div class="sys" id="sending">Sending…</div>');
      ta.value = ""; ta.style.height = ""; ls("feed-draft-" + id, ""); b.disabled = true;
      var sc = document.getElementById("sheet-scroll"); sc.scrollTop = sc.scrollHeight;
      post({ op: "answer", id: id, text: v }).then(function (d) { if (c) c.answer = d.answer; var s = document.getElementById("sending"); if (s) s.textContent = "Sent - the team usually replies within a few minutes"; })
        .catch(function () { var s = document.getElementById("sending"); if (s) { s.textContent = "Couldn't send - your message is back in the box"; s.style.color = "#e9b872"; } ta.value = v; })
        .then(function () { b.disabled = false; });
    } else if (act === "tell") {
      var tt = document.getElementById("tell-text"), val = tt ? tt.value.trim() : "", ts = document.getElementById("tell-status");
      if (!val) { if (tt) tt.focus(); return; }
      ts.textContent = "Sending…";
      post({ op: "note", text: val }).then(function () { ts.textContent = "✓ Sent - the team is on it"; notes.unshift({ text: val, at: new Date().toISOString() }); tt.value = ""; })
        .catch(function () { ts.textContent = "Couldn't send - tap again, or use Telegram"; ts.className = "status warn"; });
    } else if (act === "install") { if (!deferred) return; deferred.prompt(); deferred.userChoice.finally(function () { deferred = null; renderTell(); }); }
  }, true);

  ["home", "feed", "tell"].forEach(function (v) {
    document.getElementById("tab-" + v).addEventListener("click", function () {
      if (view === v) { feed.scrollTo({ top: 0, behavior: "smooth" }); return; }
      go(v);
    });
  });
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") load(); else if (window.Sky) Sky.pause(); });
  setInterval(function () { if (document.visibilityState === "visible") load(); }, 60000);
  setInterval(function () { if (document.visibilityState === "visible" && view === "home" && !dayOpen) { applyMode(); var t = feed.scrollTop; renderHome(); feed.scrollTop = t; } }, 5 * 60000);
  setInterval(function () { if (sheetFor && sheetMode === "chat" && document.visibilityState === "visible") load(); }, 20000);

  var deferred = null;
  function installed() { return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true || ls("feed-installed") === "1"; }
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); if (!installed()) deferred = e; });
  window.addEventListener("appinstalled", function () { ls("feed-installed", "1"); deferred = null; if (view === "tell") renderTell(); });
  if (installed()) ls("feed-installed", "1");
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(function () {});

  if (window.Sky) Sky.mount(document.getElementById("sky"), now);
  try { var cached = JSON.parse(ls("feed-cache") || "null"); if (cached) { cards = cached.cards || []; notes = cached.notes || []; } } catch (e) {}
  render();
  load();
})();
