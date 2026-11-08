/* Extrafari — renders site photo credits from assets/img/credits.json */
(function () {
  var root = (document.currentScript && document.currentScript.src || "").replace(/js\/[^\/]*$/, "");

  /* National park photographs (parks directory), from js/parks-data.js */
  var parksEl = document.getElementById("parks-credits");
  var parks = window.EXTRAFARI_PARKS || [];
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  if (parksEl) {
    parks.filter(function (p) { return p.img; }).forEach(function (p) {
      var li = document.createElement("li");
      li.innerHTML = esc(p.name) + ": <a href=\"" + esc(p.imgPage) + "\" rel=\"noopener\" target=\"_blank\">photo</a>" + (p.imgBy ? " par " + esc(p.imgBy) : "") + (p.imgLicense ? ", " + esc(p.imgLicense) : " (auteur et licence sur la page du fichier Commons)") + ", via Wikimedia Commons";
      parksEl.appendChild(li);
    });
  }
  var el = document.getElementById("site-credits");
  if (!el) return;
  fetch(root + "assets/img/credits.json").then(function (r) { return r.json(); }).then(function (data) {
    Object.keys(data).sort().forEach(function (k) {
      var c = data[k], li = document.createElement("li"), a = document.createElement("a");
      a.href = c.url; a.rel = "noopener"; a.target = "_blank"; a.textContent = c.title || k;
      li.appendChild(a);
      li.appendChild(document.createTextNode(" par " + (c.creator || "inconnu") + ", " + c.license + ", via " + (c.source === "flickr" ? "Flickr" : c.source)));
      el.appendChild(li);
    });
  }).catch(function () { el.innerHTML = "<li>Voir assets/img/credits.json dans les sources du site.</li>"; });
})();
