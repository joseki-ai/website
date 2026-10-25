// Website-owned early-access form. With an endpoint configured on the form
// (data-api), the answers are posted to it as JSON with a Turnstile token;
// otherwise, or if that request fails, the form opens an email in the
// visitor's mail app addressed to access@joseki.ai. No tracking.
(function () {
  "use strict";

  var form = document.getElementById("accessForm");
  if (!form) return;

  // Turnstile is rendered explicitly once its script has loaded (the script
  // tag follows this one, deferred, so this callback exists first). The
  // widget's flexible size needs a 300px column; narrower columns get the
  // compact widget instead of a clipped one.
  window.onTurnstileLoad = function () {
    var host = form.querySelector(".cf-turnstile");
    if (!host || !window.turnstile || host.childNodes.length) return;
    window.turnstile.render(host, {
      sitekey: host.getAttribute("data-sitekey"),
      size: host.clientWidth < 300 ? "compact" : "flexible",
    });
  };
  var status = document.getElementById("accessStatus");
  var submit = form.querySelector("button[type=submit]");
  var ADDRESS = "access@joseki.ai";
  var FIELDS = ["name", "email", "firm", "role", "focus", "size", "markets", "notes"];

  var value = function (name) {
    var field = form.elements[name];
    return field ? String(field.value || "").trim() : "";
  };
  var setError = function (name, message) {
    var field = form.elements[name];
    var slot = document.getElementById(name + "Error");
    if (field) field.setAttribute("aria-invalid", message ? "true" : "false");
    if (slot) slot.textContent = message;
  };
  var setStatus = function (state, message) {
    if (status) {
      status.dataset.state = state;
      status.textContent = message;
    }
    if (submit) submit.dataset.state = state === "ok" ? "success" : state;
  };
  var mailto = function (a) {
    var lines = [
      "Name: " + a.name, "Email: " + a.email, "Firm or team: " + (a.firm || "-"), "Role: " + (a.role || "-"),
      "Product of most interest: " + (a.focus || "-"), "Markets and venues: " + (a.markets || "-"), "Team size: " + (a.size || "-"), "", a.notes,
    ];
    var subject = "Joseki early access" + (a.firm ? " - " + a.firm : "");
    return "mailto:" + ADDRESS + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(lines.join("\n").trim() + "\n");
  };
  var openMail = function (a, state, message) {
    setStatus(state, message);
    window.location.href = mailto(a);
  };

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var missingName = value("name") ? "" : "Add your name.";
    var missingEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value("email")) ? "" : "Add a work email we can reply to.";
    setError("name", missingName);
    setError("email", missingEmail);
    if (missingName || missingEmail) {
      setStatus("error", (missingName && missingEmail ? "Two fields need" : "One field needs") + " a look before we can send.");
      var first = form.elements[missingName ? "name" : "email"];
      if (first && first.focus) first.focus();
      return;
    }
    var a = {};
    FIELDS.forEach(function (name) { a[name] = value(name); });

    var api = form.dataset.api;
    if (!api || typeof window.fetch !== "function") {
      openMail(a, "ok", "Your mail app should open with the email ready to send. If it does not, write to " + ADDRESS + ".");
      return;
    }
    var token = form.querySelector('[name="cf-turnstile-response"]');
    a.turnstile = token && token.value ? token.value : "";
    a.website = value("website");
    setStatus("loading", "Sending\u2026");
    if (submit) submit.disabled = true;
    window.fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(a) })
      .then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (data) {
          if (response.ok && data && data.ok) return data;
          throw new Error(data && data.error ? data.error + (data.detail ? ": " + data.detail : "") : "http " + response.status);
        });
      })
      .then(function () {
        setStatus("ok", "Thank you so much. We have received your message and will get back to you soon.");
        if (form.reset) form.reset();
        if (window.turnstile && window.turnstile.reset) window.turnstile.reset();
      })
      .catch(function (err) {
        var reason = err && err.message && !/fetch/i.test(err.message) ? err.message : "network";
        if (window.console && console.warn) console.warn("access form: " + reason);
        openMail(a, "error", "Something went wrong. Please send your message directly to " + ADDRESS + ".");
      })
      .then(function () { if (submit) submit.disabled = false; });
  });
})();
