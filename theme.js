// Tema gelap/terang se-site Seminggu Satu.
// Disimpan di localStorage ("ss_theme") -> otomatis kebawa antar halaman (1 domain).
// Taruh <script src="theme.js"></script> (atau ../theme.js) PALING ATAS di <head>
// biar tema keburu diterapkan sebelum halaman ke-render (anti "flash" putih).
(function () {
    try {
        if (localStorage.getItem("ss_theme") === "dark") {
            document.documentElement.setAttribute("data-theme", "dark");
        }
    } catch (e) { }
})();

// Toggle dipakai tombol di halaman mana pun. Balikin true kalau jadi gelap.
window.ssToggleTheme = function () {
    var isDark = document.documentElement.getAttribute("data-theme") === "dark";
    try {
        if (isDark) {
            document.documentElement.removeAttribute("data-theme");
            localStorage.setItem("ss_theme", "light");
        } else {
            document.documentElement.setAttribute("data-theme", "dark");
            localStorage.setItem("ss_theme", "dark");
        }
    } catch (e) { }
    var now = !isDark;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", now ? (meta.getAttribute("data-dark") || "#0d1526") : (meta.getAttribute("data-light") || "#0046ff"));
    try { document.dispatchEvent(new CustomEvent("ss-theme-change", { detail: { dark: now } })); } catch (e) { }
    return now;
};

window.ssIsDark = function () {
    return document.documentElement.getAttribute("data-theme") === "dark";
};

// Auto-inject tombol toggle (pojok kanan atas) di halaman yang BELUM punya tombol sendiri.
// Home (#themeToggle) & Sahabat (#fabActionTheme) sudah punya -> di-skip otomatis.
(function () {
    function injectThemeFab() {
        if (document.getElementById("themeToggle") ||
            document.getElementById("fabActionTheme") ||
            document.getElementById("ssThemeFab")) return;
        if (document.documentElement.hasAttribute("data-no-theme-fab")) return;
        if (!document.body) return;

        var btn = document.createElement("button");
        btn.id = "ssThemeFab";
        btn.type = "button";
        btn.title = "Ganti tema";
        btn.setAttribute("aria-label", "Ganti tema gelap/terang");
        btn.style.cssText = "position:fixed;top:14px;right:14px;z-index:2000;width:42px;height:42px;" +
            "border-radius:50%;border:1px solid rgba(120,130,160,.35);cursor:pointer;font-size:1.1rem;" +
            "line-height:1;display:flex;align-items:center;justify-content:center;padding:0;" +
            "box-shadow:0 6px 18px rgba(0,0,0,.18);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);" +
            "transition:transform .15s ease;";
        function paint() {
            var dark = window.ssIsDark();
            btn.textContent = dark ? "☀️" : "🌙";
            btn.style.background = dark ? "rgba(23,32,53,.92)" : "rgba(255,255,255,.92)";
        }
        paint();
        btn.addEventListener("click", function () { window.ssToggleTheme(); paint(); });
        btn.addEventListener("mouseenter", function () { btn.style.transform = "scale(1.08)"; });
        btn.addEventListener("mouseleave", function () { btn.style.transform = "scale(1)"; });
        document.body.appendChild(btn);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", injectThemeFab);
    else injectThemeFab();
})();
