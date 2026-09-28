/* Extrafari — site behaviour (no dependencies) */
(function () {
  "use strict";

  /* Footer year */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  /* Mobile navigation */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
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
      var region = regionEl.value;
      var style = styleEl.value;
      var duration = durationEl.value;
      var shown = 0;

      cards.forEach(function (card) {
        var days = parseInt(card.getAttribute("data-days"), 10) || 0;
        var ok =
          (!region || card.getAttribute("data-region") === region) &&
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
      var url = window.location.pathname + (qs ? "?" + qs : "") + window.location.hash;
      window.history.replaceState(null, "", url);
    }

    [regionEl, styleEl, durationEl].forEach(function (el) {
      el.addEventListener("change", applyFilters);
    });
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
      Array.prototype.forEach.call(safariSelect.options, function (opt) {
        if (opt.text === preset) safariSelect.value = opt.value;
      });
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
        if (!bad && input.type === "number") {
          var n = Number(value);
          bad = !(n >= Number(input.min || 1) && n <= Number(input.max || 999));
        }
        setInvalid(input, bad);
        if (bad && !firstBad) firstBad = input;
      });
      return firstBad;
    }

    form.querySelectorAll("[required]").forEach(function (input) {
      input.addEventListener("input", function () {
        if (input.closest(".field").classList.contains("is-invalid")) validate();
      });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      status.className = "form-status";

      if (form.website && form.website.value) return; /* honeypot */

      var firstBad = validate();
      if (firstBad) {
        status.textContent = "Please check the highlighted fields.";
        status.classList.add("is-visible", "is-error");
        firstBad.focus();
        return;
      }

      var data = new FormData(form);
      var lines = [];
      data.forEach(function (value, key) {
        if (key === "website" || !String(value).trim()) return;
        lines.push(key.charAt(0).toUpperCase() + key.slice(1) + ": " + value);
      });

      var endpoint = form.getAttribute("data-endpoint");
      if (endpoint) {
        var button = form.querySelector("[type=submit]");
        button.disabled = true;
        fetch(endpoint, {
          method: "POST",
          headers: { "Accept": "application/json" },
          body: data
        }).then(function (res) {
          if (!res.ok) throw new Error("Request failed");
          form.reset();
          status.textContent = "Thank you. Your enquiry has been sent and a planner will be in touch within one working day.";
          status.classList.add("is-visible");
        }).catch(function () {
          status.textContent = "Sorry, something went wrong sending your enquiry. Please email hello@extrafari.com instead.";
          status.classList.add("is-visible", "is-error");
        }).finally(function () {
          button.disabled = false;
        });
        return;
      }

      /* No endpoint configured: hand off to the visitor's email client. */
      var subject = "Safari enquiry" + (data.get("safari") ? ": " + data.get("safari") : "");
      var href = "mailto:hello@extrafari.com?subject=" + encodeURIComponent(subject) +
        "&body=" + encodeURIComponent(lines.join("\n"));
      window.location.href = href;
      status.textContent = "Opening your email app with the enquiry pre-filled. If nothing happens, email hello@extrafari.com directly.";
      status.classList.add("is-visible");
    });
  }
})();
