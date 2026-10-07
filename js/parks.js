/* Extrafari — national parks directory: search, filters, selection and enquiry handoff */
(function () {
  "use strict";
  var parks = window.EXTRAFARI_PARKS || [];
  var q = document.getElementById("parks-q");
  if (!q || !parks.length) return;

  var regionEl = document.getElementById("parks-region");
  var countryEl = document.getElementById("parks-country");
  var operatesEl = document.getElementById("parks-operates");
  var countEl = document.getElementById("parks-count");
  var clearBtn = document.getElementById("parks-clear");
  var topGrid = document.getElementById("top-grid");
  var topEmpty = document.getElementById("top-empty");
  var dir = document.getElementById("parks-directory");
  var dirEmpty = document.getElementById("parks-empty");
  var bar = document.getElementById("selection-bar");
  var selCount = document.getElementById("selection-count");
  var selNames = document.getElementById("selection-names");
  var selClear = document.getElementById("selection-clear");
  var selEnquire = document.getElementById("selection-enquire");

  var STORE = "extrafari.parks";
  var selected = [];
  try { selected = JSON.parse(sessionStorage.getItem(STORE) || "[]"); } catch (e) { selected = []; }

  function key(p) { return p.name + " (" + p.country + ")"; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fmt(n) { return n == null ? "" : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function norm(s) { return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }

  /* Country select */
  var countries = [];
  parks.forEach(function (p) { if (countries.indexOf(p.country) < 0) countries.push(p.country); });
  countries.sort().forEach(function (c) {
    var o = document.createElement("option"); o.value = c; o.textContent = c; countryEl.appendChild(o);
  });
  var params = new URLSearchParams(window.location.search);
  if (params.get("country")) countryEl.value = params.get("country");
  if (params.get("q")) q.value = params.get("q");

  /* Highlight matched text */
  function hl(text, terms) {
    var out = esc(text);
    terms.forEach(function (t) {
      if (!t) return;
      var re = new RegExp("(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig");
      out = out.replace(re, "<mark>$1</mark>");
    });
    return out;
  }

  /* Render featured cards */
  var topParks = parks.filter(function (p) { return p.top; }).sort(function (a, b) { return a.rank - b.rank; });
  topParks.forEach(function (p) {
    var card = document.createElement("article");
    card.className = "park-card";
    card.setAttribute("data-key", key(p));
    card.setAttribute("tabindex", "0");
    card.setAttribute("role", "button");
    card.setAttribute("aria-pressed", "false");
    card.innerHTML =
      '<div class="park-card__media scene ' + (p.img ? 'has-photo' : 'scene--' + esc(p.scene)) + '"' + (p.img ? ' style="background-image:url(' + esc(p.img.replace('/500px-', '/960px-')) + ')"' : '') + '><span class="rank">' + (p.rank < 10 ? "0" : "") + p.rank + '</span><span class="tag">' + (p.operates ? "Extrafari operates here" : "On request") + '</span></div>' +
      '<div class="park-card__body"><span class="country" data-hl="country">' + esc(p.country) + '</span><h3 data-hl="name">' + esc(p.name) + '</h3><p>' + esc(p.desc) + '</p>' +
      '<div class="park-card__facts"><div><strong>Best time</strong>' + esc(p.best) + '</div><div><strong>Known for</strong>' + esc(p.wildlife) + '</div>' +
      '<div><strong>Size</strong>' + (p.area ? fmt(p.area) + " km²" : "n/a") + (p.est ? " &middot; established " + p.est : "") + '</div></div>' +
      '<div class="park-card__select"><span class="label-add">Add to enquiry</span><span class="label-added">Added</span><span class="check"></span></div></div>';
    card.addEventListener("click", function () { toggle(p); });
    card.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(p); } });
    topGrid.appendChild(card);
  });

  /* Render directory grouped by country */
  var groups = {};
  parks.forEach(function (p) { (groups[p.country] = groups[p.country] || []).push(p); });
  countries.sort().forEach(function (c) {
    var list = groups[c].slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    var op = list[0].operates;
    var g = document.createElement("div");
    g.className = "country-group";
    g.setAttribute("data-country", c);
    g.innerHTML =
      '<button type="button" class="country-group__head" aria-expanded="false"><h3 data-hl="country">' + esc(c) + '</h3>' +
      '<span class="meta">' + (op ? '<span class="op">Extrafari operates here</span>' : "") + '<span>' + list[0].region + '</span><span class="n">' + list.length + (list.length === 1 ? " park" : " parks") + '</span>' +
      '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg></span></button>' +
      '<div class="country-group__body"></div>';
    var body = g.querySelector(".country-group__body");
    list.forEach(function (p) {
      var row = document.createElement("div");
      row.className = "park-row";
      row.setAttribute("data-key", key(p));
      row.innerHTML =
        (p.img ? '<img class="thumb" loading="lazy" src="' + esc(p.img.replace('/500px-', '/120px-')) + '" alt="">' : '<span class="thumb"></span>') +
        '<span class="name" data-hl="name">' + esc(p.name) + (p.top ? '<span class="star" title="One of our top picks">&#9733;</span>' : "") + '</span>' +
        '<span class="fact">' + (p.area ? fmt(p.area) + " km²" : "") + '</span>' +
        '<span class="fact">' + (p.est ? "est. " + p.est : "") + '</span>' +
        '<button type="button"><span class="label-add">Add</span><span class="label-added">Added</span></button>';
      row.querySelector("button").addEventListener("click", function () { toggle(p); });
      body.appendChild(row);
    });
    g.querySelector(".country-group__head").addEventListener("click", function () {
      var open = g.classList.toggle("is-open");
      this.setAttribute("aria-expanded", open ? "true" : "false");
    });
    dir.appendChild(g);
  });

  /* Filtering */
  function matches(p, terms, region, country, operates) {
    if (region && p.region !== region) return false;
    if (country && p.country !== country) return false;
    if (operates && !p.operates) return false;
    if (!terms.length) return true;
    var hay = norm(p.name + " " + p.country + " " + p.region + " " + (p.wildlife || ""));
    return terms.every(function (t) { return hay.indexOf(t) >= 0; });
  }

  function apply() {
    var raw = q.value.trim();
    var terms = raw ? norm(raw).split(/\s+/) : [];
    var region = regionEl.value, country = countryEl.value, operates = operatesEl.checked;
    var shownTop = 0, shownAll = 0, shownCountries = 0;

    topGrid.querySelectorAll(".park-card").forEach(function (card, i) {
      var ok = matches(topParks[i], terms, region, country, operates);
      card.classList.toggle("is-hidden", !ok);
      if (ok) shownTop++;
      card.querySelectorAll("[data-hl]").forEach(function (el) {
        var p = topParks[i]; el.innerHTML = hl(el.getAttribute("data-hl") === "name" ? p.name : p.country, raw ? raw.split(/\s+/) : []);
      });
    });
    topEmpty.classList.toggle("is-visible", shownTop === 0);

    dir.querySelectorAll(".country-group").forEach(function (g) {
      var c = g.getAttribute("data-country");
      var visible = 0;
      g.querySelectorAll(".park-row").forEach(function (row) {
        var p = groups[c].filter(function (x) { return key(x) === row.getAttribute("data-key"); })[0];
        var ok = matches(p, terms, region, country, operates);
        row.classList.toggle("is-hidden", !ok);
        if (ok) visible++;
        row.querySelector("[data-hl]").innerHTML = hl(p.name, raw ? raw.split(/\s+/) : []) + (p.top ? '<span class="star" title="One of our top picks">&#9733;</span>' : "");
      });
      g.classList.toggle("is-hidden", visible === 0);
      g.querySelector("h3").innerHTML = hl(c, raw ? raw.split(/\s+/) : []);
      g.querySelector(".n").textContent = visible + (visible === 1 ? " park" : " parks");
      if (visible) shownCountries++;
      shownAll += visible;
      /* Auto-open groups when the user is actively searching or has narrowed to one country */
      var active = terms.length > 0 || !!country || (!!region && shownCountries <= 12);
      if (active) { g.classList.add("is-open"); g.querySelector(".country-group__head").setAttribute("aria-expanded", "true"); }
    });
    dirEmpty.classList.toggle("is-visible", shownAll === 0);
    countEl.textContent = shownAll + (shownAll === 1 ? " park" : " parks") + " in " + shownCountries + (shownCountries === 1 ? " country" : " countries");
    clearBtn.style.visibility = raw ? "visible" : "hidden";

    var next = new URLSearchParams();
    if (raw) next.set("q", raw);
    if (country) next.set("country", country);
    var qs = next.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? "?" + qs : "") + window.location.hash);
  }

  var timer;
  q.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(apply, 80); });
  [regionEl, countryEl, operatesEl].forEach(function (el) { el.addEventListener("change", apply); });
  clearBtn.addEventListener("click", function () { q.value = ""; apply(); q.focus(); });
  document.getElementById("parks-search").addEventListener("submit", function (e) { e.preventDefault(); apply(); });

  /* Selection */
  function toggle(p) {
    var k = key(p);
    var i = selected.indexOf(k);
    if (i >= 0) selected.splice(i, 1); else selected.push(k);
    try { sessionStorage.setItem(STORE, JSON.stringify(selected)); } catch (e) {}
    renderSelection();
  }
  function renderSelection() {
    document.querySelectorAll("[data-key]").forEach(function (el) {
      var on = selected.indexOf(el.getAttribute("data-key")) >= 0;
      el.classList.toggle("is-selected", on);
      if (el.hasAttribute("aria-pressed")) el.setAttribute("aria-pressed", on ? "true" : "false");
    });
    selCount.textContent = String(selected.length);
    selNames.textContent = selected.join(", ");
    bar.classList.toggle("is-visible", selected.length > 0);
    document.body.classList.toggle("has-selection", selected.length > 0);
    selEnquire.href = "contact.html?parks=" + encodeURIComponent(selected.join("|"));
  }
  selClear.addEventListener("click", function () { selected = []; try { sessionStorage.removeItem(STORE); } catch (e) {} renderSelection(); });

  /* Photo credits */
  var creditsEl = document.getElementById("parks-credits");
  if (creditsEl) {
    parks.filter(function (p) { return p.img; }).forEach(function (p) {
      var li = document.createElement("li");
      li.innerHTML = esc(p.name) + ": <a href=\"" + esc(p.imgPage) + "\" rel=\"noopener\" target=\"_blank\">photo</a>" + (p.imgBy ? " by " + esc(p.imgBy) : "") + (p.imgLicense ? ", " + esc(p.imgLicense) : " (author and licence on the Commons file page)") + ", via Wikimedia Commons";
      creditsEl.appendChild(li);
    });
  }

  apply();
  renderSelection();
})();
