// Joseki site — minimal progressive enhancement. No framework, no tracking.
(function () {
  "use strict";

  // Nav hairline appears once the page is scrolled.
  var nav = document.getElementById("nav");
  if (nav) {
    var onScroll = function () {
      nav.dataset.scrolled = window.scrollY > 8 ? "true" : "false";
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // Mobile menu: reveal the primary links inline below the bar.
  var toggle = document.getElementById("navToggle");
  var links = document.querySelector(".nav__links");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      links.style.display = open ? "" : "flex";
      links.style.flexDirection = "column";
      links.style.width = "100%";
      links.style.padding = open ? "" : "0.75rem 0";
    });
  }
})();
