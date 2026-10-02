/* Extrafari — site behaviour (no dependencies) */
(function () {
  "use strict";

  var ARROW_R = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  /* Footer year */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  /* Mega menu */
  var menuBtn = document.querySelector(".menu-btn");
  var mega = document.getElementById("mega-menu");
  if (menuBtn && mega) {
    function setMenu(open) {
      mega.classList.toggle("is-open", open);
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    }
    menuBtn.addEventListener("click", function () { setMenu(!mega.classList.contains("is-open")); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && mega.classList.contains("is-open")) { setMenu(false); menuBtn.focus(); }
    });
    document.addEventListener("click", function (e) {
      if (mega.classList.contains("is-open") && !e.target.closest(".site-header")) setMenu(false);
    });
  }

  /* Hero video control (visual state only until a video is added) */
  var play = document.querySelector(".hero__play");
  if (play) {
    var video = document.querySelector(".hero video");
    play.addEventListener("click", function () {
      var paused = play.getAttribute("data-state") === "paused";
      play.setAttribute("data-state", paused ? "playing" : "paused");
      play.setAttribute("aria-label", paused ? "Pause background video" : "Play background video");
      if (video) { if (paused) video.play(); else video.pause(); }
    });
  }

  /* Generic horizontal carousel: centres the active item, wraps around */
  function carousel(opts) {
    var root = document.getElementById(opts.id);
    if (!root) return null;
    var track = root.querySelector(opts.track);
    var items = Array.prototype.slice.call(track.children);
    var index = 0;
    var cur = root.querySelector("[data-cur]");
    var total = root.querySelector("[data-total]");
    if (total) total.textContent = pad(items.length);

    function pad(n) { return (n < 10 ? "0" : "") + n; }

    function layout() {
      var viewport = root.getBoundingClientRect().width;
      var item = items[index];
      var left = 0;
      for (var i = 0; i < index; i++) left += items[i].getBoundingClientRect().width + (opts.gap || 0);
      var offset;
      if (opts.align === "start") offset = left;
      else offset = left - (viewport - item.getBoundingClientRect().width) / 2;
      if (opts.clampEnd) {
        var trackW = 0; items.forEach(function (it, i) { trackW += it.getBoundingClientRect().width + (i ? (opts.gap || 0) : 0); });
        offset = Math.max(0, Math.min(offset, trackW - viewport));
      }
      track.style.transform = "translateX(" + (-offset) + "px)";
      items.forEach(function (it, i) { it.classList.toggle("is-active", i === index); });
      if (cur) cur.textContent = pad(index + 1);
      if (opts.onChange) opts.onChange(index);
    }

    function go(n) {
      index = (n + items.length) % items.length;
      layout();
    }

    root.querySelectorAll("[data-dir]").forEach(function (b) {
      b.addEventListener("click", function () { go(index + parseInt(b.getAttribute("data-dir"), 10)); });
    });
    window.addEventListener("resize", layout);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
    layout();
    return { go: go, index: function () { return index; }, items: items };
  }

  /* Country carousel with tab bar */
  var countryTabs = document.getElementById("country-tabs");
  var countries = carousel({
    id: "country-slider", track: ".slider__track",
    onChange: function (i) {
      if (!countryTabs) return;
      Array.prototype.forEach.call(countryTabs.children, function (b, j) { b.setAttribute("aria-selected", i === j ? "true" : "false"); });
    }
  });
  if (countries && countryTabs) {
    countries.items.forEach(function (slide, i) {
      var b = document.createElement("button");
      b.type = "button"; b.setAttribute("role", "tab");
      b.textContent = slide.getAttribute("data-name");
      b.setAttribute("aria-selected", i === 0 ? "true" : "false");
      b.addEventListener("click", function () { countries.go(i); });
      countryTabs.appendChild(b);
    });
    countries.go(0);
  }

  /* Experiences carousel */
  carousel({ id: "exp-carousel", track: ".exp__track", gap: 40 });

  /* Award cards: step one card at a time from the start, no wrap past the end */
  carousel({ id: "award-carousel", track: ".cards__track", gap: 24, align: "start", clampEnd: true });

  /* Tabs */
  var tabs = document.getElementById("why-tabs");
  if (tabs) {
    var tabBtns = Array.prototype.slice.call(tabs.querySelectorAll('[role="tab"]'));
    var panels = Array.prototype.slice.call(tabs.querySelectorAll('[role="tabpanel"]'));
    var current = 0;
    function selectTab(i) {
      current = (i + tabBtns.length) % tabBtns.length;
      tabBtns.forEach(function (b, j) { b.setAttribute("aria-selected", j === current ? "true" : "false"); });
      panels.forEach(function (p, j) { p.classList.toggle("is-active", j === current); });
    }
    tabBtns.forEach(function (b, i) { b.addEventListener("click", function () { selectTab(i); }); });
    tabs.querySelectorAll("[data-tabdir]").forEach(function (b) {
      b.addEventListener("click", function () { selectTab(current + parseInt(b.getAttribute("data-tabdir"), 10)); });
    });

    /* Mobile accordion built from the same panels */
    var acc = document.getElementById("why-accordion");
    if (acc) {
      panels.forEach(function (p, i) {
        var d = document.createElement("details");
        if (i === 0) d.open = true;
        var s = document.createElement("summary");
        s.textContent = tabBtns[i].textContent;
        d.appendChild(s);
        var clone = p.cloneNode(true);
        clone.removeAttribute("id"); clone.classList.add("is-active");
        d.appendChild(clone);
        acc.appendChild(d);
      });
    }
  }

  /* Newsletter form */
  var nl = document.getElementById("newsletter-form");
  if (nl) {
    nl.addEventListener("submit", function (e) {
      e.preventDefault();
      var status = document.getElementById("newsletter-status");
      status.className = "form-status";
      if (nl.website && nl.website.value) return;
      var email = nl.email.value.trim();
      if (!nl.first_name.value.trim() || !nl.last_name.value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        status.textContent = "Please add your name and a valid email address.";
        status.classList.add("is-visible", "is-error");
        return;
      }
      var endpoint = nl.getAttribute("data-endpoint");
      if (endpoint) {
        fetch(endpoint, { method: "POST", headers: { Accept: "application/json" }, body: new FormData(nl) })
          .then(function (r) { if (!r.ok) throw new Error(); nl.reset(); status.textContent = "Thank you, you are subscribed."; status.classList.add("is-visible"); })
          .catch(function () { status.textContent = "Sorry, something went wrong. Please try again later."; status.classList.add("is-visible", "is-error"); });
        return;
      }
      nl.reset();
      status.textContent = "Thank you, you are subscribed. (Connect a newsletter service with data-endpoint to store sign-ups.)";
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
      countEl.textContent = shown === 1 ? "1 safari" : shown + " safaris";
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
      if (safariSelect && !preset) safariSelect.value = "Something custom";
      var msg = document.getElementById("message");
      if (msg && !msg.value) msg.value = "I would like to visit: " + names.join(", ") + ".\n\n";
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
      if (firstBad) { status.textContent = "Please check the highlighted fields."; status.classList.add("is-visible", "is-error"); firstBad.focus(); return; }
      var data = new FormData(form), lines = [];
      data.forEach(function (value, key) { if (key === "website" || !String(value).trim()) return; lines.push(key.charAt(0).toUpperCase() + key.slice(1) + ": " + value); });
      var endpoint = form.getAttribute("data-endpoint");
      if (endpoint) {
        var button = form.querySelector("[type=submit]"); button.disabled = true;
        fetch(endpoint, { method: "POST", headers: { Accept: "application/json" }, body: data })
          .then(function (res) { if (!res.ok) throw new Error("Request failed"); form.reset(); status.textContent = "Thank you. Your enquiry has been sent and a planner will be in touch within one working day."; status.classList.add("is-visible"); })
          .catch(function () { status.textContent = "Sorry, something went wrong sending your enquiry. Please email hello@extrafari.com instead."; status.classList.add("is-visible", "is-error"); })
          .finally(function () { button.disabled = false; });
        return;
      }
      var subject = "Safari enquiry" + (data.get("safari") ? ": " + data.get("safari") : "");
      window.location.href = "mailto:hello@extrafari.com?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(lines.join("\n"));
      status.textContent = "Opening your email app with the enquiry pre-filled. If nothing happens, email hello@extrafari.com directly.";
      status.classList.add("is-visible");
    });
  }
})();
