/* Theme toggle. The stored choice is applied before first paint by a tiny inline script in each page's head.
   Light is the default; dark is only used when the visitor chooses it with the header button. */
(function () {
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
