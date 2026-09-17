/*
 * Meetscript voor de eigen websites (sales-dashboard, tab Websites, spec §15).
 *
 * Plaatsen:  <script defer src="https://meet.globaal.be/m.js" data-site="unabo"></script>
 *
 * Wat het doet: paginaweergave, actieve leestijd, scrolldiepte, klikken (met positie
 * voor de klikkaart), formulierverzendingen, aandacht per sectie en laadsnelheid.
 * Wat het bewust NIET doet: cookies zetten (localStorage enkel na ?meet=uit), formulierinhoud of
 * getypte tekst lezen, sessies opnemen. Het IP-adres wordt op de server alleen
 * gebruikt om de locatie op te zoeken en niet bewaard.
 *
 * Eigen bezoeken uitsluiten: open een site één keer met ?meet=uit (en ?meet=aan om
 * het terug te zetten). Dat is een keuze van de bezoeker zelf, op zijn eigen toestel.
 */
(function () {
  "use strict";
  var script = document.currentScript;
  if (!script || !window.JSON || !document.addEventListener) return;
  var site = script.getAttribute("data-site");
  if (!site) return;
  var nav = navigator;
  if (nav.webdriver || /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview/i.test(nav.userAgent)) return;

  try {
    var q = new URLSearchParams(location.search).get("meet");
    if (q === "uit") localStorage.setItem("meet-uit", "1");
    if (q === "aan") localStorage.removeItem("meet-uit");
    if (localStorage.getItem("meet-uit") === "1") return;
  } catch (e) {}

  var API = new URL("/api/meet", script.src).href;

  function id() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }
  function stuur(data, bijVertrek) {
    var body = JSON.stringify(data);
    if (bijVertrek && nav.sendBeacon) {
      try {
        if (nav.sendBeacon(API, body)) return;
      } catch (e) {}
    }
    try {
      fetch(API, { method: "POST", body: body, keepalive: true, credentials: "omit", headers: { "Content-Type": "text/plain" } });
    } catch (e) {}
  }
  function kort(s, n) {
    return (s || "").replace(/\s+/g, " ").trim().slice(0, n);
  }
  function docHoogte() {
    var b = document.body, h = document.documentElement;
    return Math.max(b ? b.scrollHeight : 0, h.scrollHeight, h.offsetHeight);
  }
  // Alleen marketingparameters blijven in het adres; al de rest kan persoonsgegevens bevatten.
  function schoonAdres() {
    var u = new URL(location.href), uit = new URL(u.origin + u.pathname);
    u.searchParams.forEach(function (v, k) {
      if (/^utm_/.test(k) || k === "gclid" || k === "gbraid" || k === "wbraid" || k === "fbclid" || k === "msclkid") uit.searchParams.set(k, k.slice(-4) === "clid" || k.slice(-5) === "braid" ? "1" : v);
    });
    return uit.href;
  }

  // ---- toestand van de huidige paginaweergave ----
  var pv, start, actief, zichtbaarSinds, maxScroll, klikken, secties, sectieZicht, vitals, observer, vorigeUrl;

  function nieuwePagina(referrer) {
    pv = id();
    start = Date.now();
    actief = 0;
    zichtbaarSinds = document.visibilityState === "visible" ? Date.now() : 0;
    maxScroll = 0;
    klikken = [];
    secties = {};
    sectieZicht = {};
    vitals = vitals && vorigeUrl ? {} : vitals || {};
    vorigeUrl = location.href;
    stuur({
      t: "pv",
      s: site,
      pv: pv,
      u: schoonAdres(),
      r: referrer,
      ti: kort(document.title, 150),
      sw: screen.width,
      vw: window.innerWidth,
      l: nav.language,
      tz: (Intl.DateTimeFormat().resolvedOptions() || {}).timeZone || "",
    });
    meetScroll();
    volgSecties();
  }

  function actieveTijd() {
    return actief + (zichtbaarSinds ? Date.now() - zichtbaarSinds : 0);
  }

  function meetScroll() {
    var h = docHoogte(), onder = window.scrollY + window.innerHeight;
    var p = h > 0 ? Math.min(100, Math.round((onder / h) * 100)) : 100;
    if (p > maxScroll) maxScroll = p;
  }

  // ---- aandacht per sectie: hoe lang een blok minstens half in beeld stond ----
  function sectieNaam(el, i) {
    var n = el.getAttribute("data-meet-sectie") || el.getAttribute("aria-label");
    if (!n) {
      var kop = el.querySelector("h1,h2,h3");
      n = kop ? kop.textContent : "";
    }
    return kort(n, 70) || (el.id ? "#" + el.id : el.tagName.toLowerCase() + " " + (i + 1));
  }
  function volgSecties() {
    if (observer) observer.disconnect();
    if (!window.IntersectionObserver) return;
    var els = document.querySelectorAll("[data-meet-sectie], main section, main > article, body > section, footer");
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var s = secties[e.target.__meetNaam];
        if (!s) return;
        if (e.isIntersecting && document.visibilityState === "visible") {
          sectieZicht[s.n] = sectieZicht[s.n] || Date.now();
        } else if (sectieZicht[s.n]) {
          s.ms += Date.now() - sectieZicht[s.n];
          delete sectieZicht[s.n];
        }
      });
    }, { threshold: 0.5 });
    var h = docHoogte();
    for (var i = 0; i < els.length && i < 40; i++) {
      var el = els[i], naam = sectieNaam(el, i);
      if (secties[naam]) continue;
      var r = el.getBoundingClientRect();
      el.__meetNaam = naam;
      secties[naam] = { n: naam, ms: 0, o: i, y: Math.round(r.top + window.scrollY), h: Math.round(r.height), dh: h };
      observer.observe(el);
    }
  }
  function sectieStand() {
    var uit = [], nu = Date.now();
    for (var k in secties) {
      var s = secties[k];
      uit.push({ n: s.n, ms: s.ms + (sectieZicht[k] ? nu - sectieZicht[k] : 0), o: s.o, y: s.y, h: s.h, dh: s.dh });
    }
    return uit;
  }

  // ---- klikken ----
  document.addEventListener("click", function (ev) {
    if (!pv || klikken.length > 300) return;
    var t = ev.target && ev.target.closest ? ev.target : null;
    if (!t) return;
    var el = t.closest("a,button,summary,label,select,input,[role=button],[data-meet]") || t;
    var soort = "overig", doel = "", tekst = "";
    if (el.tagName === "A" && el.href) {
      var href = el.getAttribute("href") || "";
      if (/^tel:/i.test(href)) soort = "tel";
      else if (/^mailto:/i.test(href)) soort = "mail";
      else if (/wa\.me|whatsapp/i.test(href)) soort = "whatsapp";
      else if (/\.(pdf|docx?|xlsx?|zip)(\?|$)/i.test(href)) soort = "download";
      else if (el.host && el.host !== location.host) soort = "uitgaand";
      else soort = "link";
      doel = soort === "tel" || soort === "mail" ? href.split("?")[0] : el.host === location.host ? el.pathname + el.hash : el.href.split("?")[0];
    } else if (el !== t || /^(BUTTON|SUMMARY|SELECT|INPUT|LABEL)$/.test(el.tagName)) {
      soort = "knop";
    }
    // Nooit de waarde van een invoerveld: enkel wat er zichtbaar op de knop staat.
    // Klik naast een link: alleen korte eigen tekst van het aangeklikte element, geen hele sectie.
    if (soort === "overig") tekst = t.childElementCount === 0 ? t.getAttribute("alt") || t.textContent : t.getAttribute("aria-label") || "";
    else if (el.tagName === "INPUT") tekst = el.type === "submit" || el.type === "button" ? el.value : el.name || el.type;
    else tekst = el.getAttribute("data-meet") || el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || (el.querySelector && el.querySelector("img[alt]") ? el.querySelector("img[alt]").alt : "");
    var cls = typeof el.className === "string" ? el.className.split(/\s+/).filter(Boolean).slice(0, 2).join(".") : "";
    var w = Math.max(document.documentElement.scrollWidth, 1);
    klikken.push({
      k: soort,
      tx: kort(tekst, 80),
      d: kort(doel, 200),
      el: (el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (cls ? "." + cls : "")).slice(0, 80),
      x: Math.round((ev.pageX / w) * 1000),
      y: Math.round(ev.pageY),
      dh: docHoogte(),
      vw: window.innerWidth,
      ts: Date.now() - start,
    });
    if (klikken.length >= 15) verstuurStand(false);
  }, true);

  document.addEventListener("submit", function (ev) {
    if (!pv) return;
    var f = ev.target;
    klikken.push({
      k: "formulier",
      tx: kort(f.getAttribute("data-meet") || f.getAttribute("name") || f.id || "formulier", 80),
      d: kort(f.getAttribute("action") || location.pathname, 200),
      el: "form" + (f.id ? "#" + f.id : ""),
      x: -1, y: -1, dh: docHoogte(), vw: window.innerWidth, ts: Date.now() - start,
    });
    verstuurStand(true);
  }, true);

  // ---- laadsnelheid (Core Web Vitals) ----
  vitals = {};
  try {
    var navE = performance.getEntriesByType("navigation")[0];
    if (navE) {
      vitals.ttfb = Math.round(navE.responseStart);
      addEventListener("load", function () {
        setTimeout(function () {
          var n = performance.getEntriesByType("navigation")[0];
          if (n && n.loadEventEnd) vitals.laad = Math.round(n.loadEventEnd);
        }, 0);
      });
    }
    new PerformanceObserver(function (l) {
      var e = l.getEntries();
      if (e.length) vitals.lcp = Math.round(e[e.length - 1].startTime);
    }).observe({ type: "largest-contentful-paint", buffered: true });
    var cls = 0;
    new PerformanceObserver(function (l) {
      l.getEntries().forEach(function (e) {
        if (!e.hadRecentInput) cls += e.value;
      });
      vitals.cls = Math.round(cls * 1000) / 1000;
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver(function (l) {
      l.getEntries().forEach(function (e) {
        if (e.interactionId && (!vitals.inp || e.duration > vitals.inp)) vitals.inp = Math.round(e.duration);
      });
    }).observe({ type: "event", buffered: true, durationThreshold: 40 });
  } catch (e) {}

  // ---- versturen ----
  function verstuurStand(bijVertrek) {
    if (!pv) return;
    meetScroll();
    stuur({
      t: "st",
      s: site,
      pv: pv,
      a: actieveTijd(),
      sc: maxScroll,
      dh: docHoogte(),
      c: klikken.splice(0, klikken.length),
      sec: sectieStand(),
      v: vitals,
    }, bijVertrek);
  }

  addEventListener("scroll", function () {
    if (pv) meetScroll();
  }, { passive: true });

  document.addEventListener("visibilitychange", function () {
    if (!pv) return;
    if (document.visibilityState === "hidden") {
      if (zichtbaarSinds) actief += Date.now() - zichtbaarSinds;
      zichtbaarSinds = 0;
      verstuurStand(true);
    } else {
      zichtbaarSinds = Date.now();
    }
  });
  addEventListener("pagehide", function () {
    verstuurStand(true);
  });

  // Sites met client-side navigatie (Astro ClientRouter op hdssr.com): elke
  // adreswijziging is een nieuwe paginaweergave.
  function adresGewijzigd() {
    if (location.href.split("#")[0] === (vorigeUrl || "").split("#")[0]) return;
    var vorige = vorigeUrl;
    if (zichtbaarSinds) {
      actief += Date.now() - zichtbaarSinds;
      zichtbaarSinds = Date.now();
    }
    verstuurStand(false);
    setTimeout(function () {
      nieuwePagina(vorige);
    }, 50);
  }
  var push = history.pushState;
  history.pushState = function () {
    var r = push.apply(this, arguments);
    adresGewijzigd();
    return r;
  };
  addEventListener("popstate", adresGewijzigd);
  document.addEventListener("astro:page-load", function () {
    if (pv) volgSecties();
  });

  nieuwePagina(document.referrer);
})();
