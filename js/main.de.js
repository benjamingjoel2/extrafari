/* Extrafari — site behaviour (no dependencies) */
(function () {
  "use strict";

  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Footer year */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  /* Header: transparent over the home hero, solid after scrolling */
  var header = document.querySelector(".site-header");
  if (header) {
    var ticking = false;
    function onScroll() { header.classList.toggle("is-scrolled", window.scrollY > 24); ticking = false; }
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; window.requestAnimationFrame(onScroll); } }, { passive: true });
    onScroll();
  }

  /* Mobile menu */
  var menuBtn = document.querySelector(".menu-btn");
  var mega = document.getElementById("mega-menu");
  if (menuBtn && mega) {
    function setMenu(open) {
      mega.classList.toggle("is-open", open);
      if (header) header.classList.toggle("menu-open", open);
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.style.overflow = open ? "hidden" : "";
    }
    menuBtn.addEventListener("click", function () { setMenu(!mega.classList.contains("is-open")); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && mega.classList.contains("is-open")) { setMenu(false); menuBtn.focus(); }
    });
    mega.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
    window.addEventListener("resize", function () { if (window.innerWidth > 960) setMenu(false); });
  }

  /* Hero slider: ring progress on the active dot, advances when the ring completes */
  var hero = document.querySelector(".hero");
  if (hero) {
    var slides = Array.prototype.slice.call(hero.querySelectorAll(".hero-slide"));
    var dots = Array.prototype.slice.call(hero.querySelectorAll(".hero__dot"));
    var pause = hero.querySelector(".hero__pause");
    var current = 0;
    function show(i) {
      current = (i + slides.length) % slides.length;
      slides.forEach(function (s, j) { s.classList.toggle("is-active", j === current); s.setAttribute("aria-hidden", j === current ? "false" : "true"); });
      dots.forEach(function (d, j) {
        d.classList.remove("is-active");
        if (j === current) { void d.offsetWidth; d.classList.add("is-active"); d.setAttribute("aria-current", "true"); }
        else d.removeAttribute("aria-current");
      });
    }
    dots.forEach(function (d, j) { d.addEventListener("click", function () { show(j); }); });
    dots.forEach(function (d) {
      var fill = d.querySelector(".fill");
      if (fill) fill.addEventListener("animationend", function () { if (!hero.classList.contains("is-paused")) show(current + 1); });
    });
    function setPaused(p) {
      hero.classList.toggle("is-paused", p);
      pause.setAttribute("aria-label", p ? "Diashow abspielen" : "Diashow anhalten");
    }
    if (pause) pause.addEventListener("click", function () { setPaused(!hero.classList.contains("is-paused")); });
    if (reduced) setPaused(true);
    show(0);
  }

  /* Story carousel */
  var stories = document.getElementById("stories");
  if (stories) {
    var items = Array.prototype.slice.call(stories.querySelectorAll(".story"));
    var sdots = Array.prototype.slice.call(stories.querySelectorAll(".stories__dots button"));
    var si = 0;
    function showStory(i) {
      si = (i + items.length) % items.length;
      items.forEach(function (s, j) { s.classList.toggle("is-active", j === si); });
      sdots.forEach(function (d, j) { if (j === si) d.setAttribute("aria-current", "true"); else d.removeAttribute("aria-current"); });
    }
    stories.querySelectorAll("[data-dir]").forEach(function (b) {
      b.addEventListener("click", function () { showStory(si + parseInt(b.getAttribute("data-dir"), 10)); });
    });
    sdots.forEach(function (d, j) { d.addEventListener("click", function () { showStory(j); }); });
  }

  /* Newsletter */
  var nl = document.getElementById("newsletter-form");
  if (nl) {
    nl.addEventListener("submit", function (e) {
      e.preventDefault();
      var status = document.getElementById("newsletter-status");
      status.className = "form-status";
      if (nl.website && nl.website.value) return;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nl.email.value.trim())) {
        status.textContent = "Bitte geben Sie eine gültige E-Mail-Adresse ein.";
        status.classList.add("is-visible", "is-error");
        nl.email.focus();
        return;
      }
      var endpoint = nl.getAttribute("data-endpoint");
      if (endpoint) {
        fetch(endpoint, { method: "POST", headers: { Accept: "application/json" }, body: new FormData(nl) })
          .then(function (r) { if (!r.ok) throw new Error(); nl.reset(); status.textContent = "Vielen Dank, Sie sind angemeldet."; status.classList.add("is-visible"); })
          .catch(function () { status.textContent = "Leider ist etwas schiefgelaufen. Bitte versuchen Sie es später noch einmal."; status.classList.add("is-visible", "is-error"); });
        return;
      }
      nl.reset();
      status.textContent = "Vielen Dank, Sie sind angemeldet. (Verbinden Sie einen Newsletter-Dienst über data-endpoint, um Anmeldungen zu speichern.)";
      status.classList.add("is-visible");
    });
  }

  /* Safari filters */
  var filters = document.getElementById("safari-filters");
  var list = document.getElementById("safari-list");
  if (filters && list) {
    var regionEl = document.getElementById("filter-region");
    var styleEl = document.getElementById("filter-style");
    var durationEl = document.getElementById("filter-duration");
    var countEl = document.getElementById("safari-count");
    var emptyEl = document.getElementById("safari-empty");
    var cards = Array.prototype.slice.call(list.querySelectorAll(".card"));

    var params = new URLSearchParams(window.location.search);
    if (params.get("region")) regionEl.value = params.get("region");
    if (params.get("style")) styleEl.value = params.get("style");
    if (params.get("duration")) durationEl.value = params.get("duration");

    function applyFilters() {
      var region = regionEl.value, style = styleEl.value, duration = durationEl.value, shown = 0;
      cards.forEach(function (card) {
        var days = parseInt(card.getAttribute("data-days"), 10) || 0;
        var ok = (!region || card.getAttribute("data-region") === region) &&
          (!style || card.getAttribute("data-style") === style) &&
          (!duration || (duration === "short" ? days <= 8 : days >= 9));
        card.classList.toggle("is-hidden", !ok);
        if (ok) shown += 1;
      });
      countEl.textContent = shown === 1 ? "1 Safari" : "{n} Safaris".replace("{n}", shown);
      emptyEl.classList.toggle("is-visible", shown === 0);
      var next = new URLSearchParams();
      if (region) next.set("region", region);
      if (style) next.set("style", style);
      if (duration) next.set("duration", duration);
      var qs = next.toString();
      window.history.replaceState(null, "", window.location.pathname + (qs ? "?" + qs : "") + window.location.hash);
    }
    [regionEl, styleEl, durationEl].forEach(function (el) { el.addEventListener("change", applyFilters); });
    filters.addEventListener("submit", function (e) { e.preventDefault(); });
    applyFilters();
  }

  /* Enquiry form */
  var form = document.getElementById("enquiry-form");
  if (form) {
    var status = document.getElementById("form-status");
    var safariSelect = document.getElementById("safari");
    var preset = new URLSearchParams(window.location.search).get("safari");
    if (preset && safariSelect) {
      Array.prototype.forEach.call(safariSelect.options, function (opt) { if (opt.text === preset) safariSelect.value = opt.value; });
    }
    var parksParam = new URLSearchParams(window.location.search).get("parks");
    var parksField = document.getElementById("parks-field");
    if (parksParam && parksField) {
      var names = parksParam.split("|").filter(Boolean);
      var chips = document.getElementById("parks-chips");
      names.forEach(function (n) { var s = document.createElement("span"); s.textContent = n; chips.appendChild(s); });
      document.getElementById("parks").value = names.join("; ");
      parksField.hidden = false;
      if (safariSelect && !preset) safariSelect.value = "Etwas ganz Eigenes";
      var msg = document.getElementById("message");
      if (msg && !msg.value) msg.value = "Ich möchte besuchen: " + names.join(", ") + ".\n\n";
    }
    function setInvalid(input, invalid) {
      var field = input.closest(".field");
      if (field) field.classList.toggle("is-invalid", invalid);
      input.setAttribute("aria-invalid", invalid ? "true" : "false");
    }
    function validate() {
      var firstBad = null;
      form.querySelectorAll("[required]").forEach(function (input) {
        var value = input.value.trim();
        var bad = !value;
        if (!bad && input.type === "email") bad = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        if (!bad && input.type === "number") { var n = Number(value); bad = !(n >= Number(input.min || 1) && n <= Number(input.max || 999)); }
        setInvalid(input, bad);
        if (bad && !firstBad) firstBad = input;
      });
      return firstBad;
    }
    form.querySelectorAll("[required]").forEach(function (input) {
      input.addEventListener("input", function () { if (input.closest(".field").classList.contains("is-invalid")) validate(); });
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      status.className = "form-status";
      if (form.website && form.website.value) return;
      var firstBad = validate();
      if (firstBad) { status.textContent = "Bitte prüfen Sie die markierten Felder."; status.classList.add("is-visible", "is-error"); firstBad.focus(); return; }
      var data = new FormData(form), lines = [];
      data.forEach(function (value, key) { if (key === "website" || !String(value).trim()) return; lines.push(key.charAt(0).toUpperCase() + key.slice(1) + ": " + value); });
      var endpoint = form.getAttribute("data-endpoint");
      if (endpoint) {
        var button = form.querySelector("[type=submit]"); button.disabled = true;
        fetch(endpoint, { method: "POST", headers: { Accept: "application/json" }, body: data })
          .then(function (res) { if (!res.ok) throw new Error("Request failed"); form.reset(); status.textContent = "Vielen Dank. Ihre Anfrage wurde gesendet, und ein Planer meldet sich innerhalb eines Werktages."; status.classList.add("is-visible"); })
          .catch(function () { status.textContent = "Leider konnte Ihre Anfrage nicht gesendet werden. Bitte schreiben Sie stattdessen an extrafari@tourground.com."; status.classList.add("is-visible", "is-error"); })
          .finally(function () { button.disabled = false; });
        return;
      }
      var subject = "Safari-Anfrage" + (data.get("safari") ? ": " + data.get("safari") : "");
      window.location.href = "mailto:extrafari@tourground.com?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(lines.join("\n"));
      status.textContent = "Ihr E-Mail-Programm öffnet sich mit der ausgefüllten Anfrage. Falls nichts passiert, schreiben Sie direkt an extrafari@tourground.com.";
      status.classList.add("is-visible");
    });
  }
})();
