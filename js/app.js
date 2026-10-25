// Website-owned navigation enhancement: DOM controls and viewport changes update
// menu visibility and accessible state. No framework, network calls, or tracking.
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
  if (nav && toggle && links) {
    var narrow = window.matchMedia("(max-width: 54rem)");
    var setOpen = function (open) {
      nav.dataset.menuOpen = String(open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    };
    nav.dataset.menuReady = "true";
    setOpen(false);
    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });
    links.addEventListener("click", function (event) {
      if (event.target.closest("a")) setOpen(false);
    });
    nav.addEventListener("keydown", function (event) {
      // An open Products menu takes the first Escape (handled below).
      if (event.key === "Escape" && nav.dataset.productsOpen !== "true" && toggle.getAttribute("aria-expanded") === "true") {
        setOpen(false);
        toggle.focus();
      }
    });
    // CSS owns layout; crossing the breakpoint must never retain mobile styles.
    narrow.addEventListener("change", function () {
      setOpen(false);
    });
  }

  // Products menu: a disclosure button. Wide screens with a pointer also preview it on hover (CSS).
  var menuButton = document.getElementById("productsButton");
  var menu = document.getElementById("productsMenu");
  if (nav && menuButton && menu) {
    var setMenu = function (open) {
      nav.dataset.productsOpen = String(open);
      menuButton.setAttribute("aria-expanded", String(open));
    };
    setMenu(false);
    menuButton.addEventListener("click", function () {
      setMenu(menuButton.getAttribute("aria-expanded") !== "true");
    });
    menu.addEventListener("click", function (event) {
      if (event.target.closest("a")) setMenu(false);
    });
    nav.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && menuButton.getAttribute("aria-expanded") === "true") {
        setMenu(false);
        menuButton.focus();
      }
    });
    document.addEventListener("click", function (event) {
      if (!event.target.closest("#productsGroup")) setMenu(false);
    });
  }
})();
