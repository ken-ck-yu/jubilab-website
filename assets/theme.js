/* Theme toggle. The stored choice is applied before first paint by a tiny inline script in each page's head.
   Light is the default; dark is only used when the visitor chooses it with the header button. */
(function () {
  // Early-access form. Without JS everything still works: the "If other" boxes are always visible and the
  // server checks every answer. With JS the boxes appear only when Other is chosen, and the checkbox group
  // gets a "choose at least one" check.
  var form = document.getElementById("early-access-form");
  if (form) {
    var others = form.querySelectorAll(".other[data-other-for]");
    var syncOther = function (box) {
      var name = box.getAttribute("data-other-for");
      var pick = form.querySelector('input[name="' + name + '"][value="other"]');
      var on = !!(pick && pick.checked);
      box.hidden = !on;
      box.querySelector("input").required = on;
      if (!on) box.querySelector("input").value = "";
    };
    Array.prototype.forEach.call(others, function (box) {
      syncOther(box);
      form.querySelectorAll('input[name="' + box.getAttribute("data-other-for") + '"]').forEach(function (i) {
        i.addEventListener("change", function () { syncOther(box); });
      });
    });
    var boxes = form.querySelectorAll('input[name="runs-on"]');
    var syncRuns = function () {
      var any = Array.prototype.some.call(boxes, function (c) { return c.checked; });
      boxes[0].setCustomValidity(any ? "" : "Please choose at least one.");
    };
    Array.prototype.forEach.call(boxes, function (c) { c.addEventListener("change", syncRuns); });
    syncRuns();

    // The server redirects to /?error=<what>#access when an answer is missing or invalid; say which one.
    var msg = document.getElementById("form-error");
    var texts = {
      email: "That email address does not look right. Please check it and send the form again.",
      role: "Please choose your role.",
      "role-other": "You chose Other for your role but did not say what it is. Please choose your role again and type your answer.",
      field: "Please choose your field.",
      "field-other": "You chose Other for your field but did not say what it is. Please choose your field again and type your answer.",
      "runs-on": "Please choose at least one place where your analysis runs.",
      "runs-on-other": "You chose Other for where your analysis runs but did not say what it is. Please choose again and type your answer.",
      "human-data": "Please say whether your work involves human or patient-derived data.",
      tracking: "Your comment could not be read. Please remove unusual characters and try again."
    };
    var m = /(^|[?&])error=([a-z-]+)(&|$)/.exec(location.search);
    if (msg && m && Object.prototype.hasOwnProperty.call(texts, m[2])) {
      msg.textContent = texts[m[2]];
      msg.hidden = false;
      var code = m[2];
      var target = code === "email" ? document.getElementById("email") : document.getElementById(code.replace(/-other$/, "") + "-group");
      if (target) target.setAttribute("aria-describedby", "form-error");
      // Wait for the browser's own jump to #access, which would otherwise take focus away again.
      setTimeout(function () { msg.focus(); }, 50);
    }
  }
  var btn = document.getElementById("theme-toggle");
  if (!btn) return;
  var root = document.documentElement;
  var meta = document.querySelector('meta[name="theme-color"]');
  function isDark() { return root.getAttribute("data-theme") === "dark"; }
  function sync() {
    var label = isDark() ? "Switch to light theme" : "Switch to dark theme";
    btn.setAttribute("aria-label", label);
    btn.title = label;
    if (meta) meta.setAttribute("content", isDark() ? "#0e1416" : "#f4f5f2");
  }
  btn.hidden = false;
  sync();
  btn.addEventListener("click", function () {
    if (isDark()) root.removeAttribute("data-theme"); else root.setAttribute("data-theme", "dark");
    try { localStorage.setItem("jubilab-theme", isDark() ? "dark" : "light"); } catch (e) {}
    sync();
  });
})();
