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

// Ikon SVG bulan/matahari (stroke currentColor -> ikut warna tombol)
window.SS_ICON_MOON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
window.SS_ICON_SUN = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';

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
            "border-radius:50%;border:1px solid rgba(120,130,160,.35);cursor:pointer;" +
            "line-height:1;display:flex;align-items:center;justify-content:center;padding:0;" +
            "box-shadow:0 6px 18px rgba(0,0,0,.18);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);" +
            "transition:transform .15s ease;";
        function paint() {
            var dark = window.ssIsDark();
            btn.innerHTML = dark ? window.SS_ICON_SUN : window.SS_ICON_MOON;
            btn.style.background = dark ? "rgba(23,32,53,.92)" : "rgba(255,255,255,.92)";
            btn.style.color = dark ? "#eaeffc" : "#10245e";
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
