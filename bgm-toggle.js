/* =========================================================
   bgm-toggle.js — Seminggu Satu: tombol mute musik latar.
   Tiap halaman yang lagi muter musik latar (audio yang di-loop)
   otomatis dapat tombol bulat di pojok kiri bawah: tap = senyap,
   tap lagi = nyala. Pilihan disimpan (localStorage ss_mute_music,
   sama kayak setelan Musik di Pengaturan Balai Warga) dan berlaku
   di semua halaman. Efek suara pendek & voice note (nggak di-loop)
   nggak kena.
   ========================================================= */
(function () {
    if (window.ssBgm) return;
    var KEY = "ss_mute_music";
    function muted() {
        try { return localStorage.getItem(KEY) === "1" || localStorage.getItem("ss_mute") === "1"; } catch (e) { return false; }
    }
    function setMuted(v) {
        try {
            localStorage.setItem(KEY, v ? "1" : "0");
            if (!v) localStorage.removeItem("ss_mute");
        } catch (e) { }
    }

    var wanted = new Set();   // musik yang halaman ini MAU puter (lagi bunyi atau lagi di-mute)
    var internal = false;     // pause/play dari tombol ini sendiri (bukan dari halaman)
    var origPlay = HTMLMediaElement.prototype.play;
    var origPause = HTMLMediaElement.prototype.pause;
    function isBgm(el) { return el && el.loop; }

    HTMLMediaElement.prototype.play = function () {
        if (isBgm(this) && !internal) {
            wanted.add(this);
            if (muted()) { sync(); return Promise.resolve(); }  // dimute: catat aja, jangan bunyi
            var p = origPlay.apply(this, arguments);
            sync();
            return p;
        }
        return origPlay.apply(this, arguments);
    };
    HTMLMediaElement.prototype.pause = function () {
        if (isBgm(this) && !internal) { wanted.delete(this); sync(); }
        return origPause.apply(this, arguments);
    };
    // <audio autoplay> nggak lewat .play() -- tangkep event-nya (capture, nggak bubble)
    document.addEventListener("play", function (e) {
        var el = e.target;
        if (!isBgm(el) || internal) return;
        wanted.add(el);
        if (muted()) { internal = true; try { origPause.call(el); } catch (x) { } internal = false; }
        sync();
    }, true);
    document.addEventListener("ended", function (e) { if (isBgm(e.target)) { wanted.delete(e.target); sync(); } }, true);

    var ON = '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/>';
    var OFF = '<path d="M11 4.702a.7.7 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.7.7 0 0 0 11 19.298z"/><path d="m16.5 14.5 5-5"/><path d="m16.5 9.5 5 5"/>';
    var btn = null;
    function ensureBtn() {
        if (btn || !document.body) return btn;
        var st = document.createElement("style");
        st.textContent =
            ".ss-bgm{position:fixed;left:14px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:9900;" +
            "width:46px;height:46px;border-radius:50%;border:none;cursor:pointer;display:none;align-items:center;justify-content:center;" +
            "background:#fff;color:#10245e;box-shadow:0 0 0 3px #fff,0 4px 10px rgba(16,36,94,.28);transform:rotate(-6deg);" +
            "-webkit-tap-highlight-color:transparent;transition:transform .15s ease}" +
            ".ss-bgm.show{display:flex}.ss-bgm:active{transform:rotate(-6deg) scale(.92)}" +
            ".ss-bgm.is-muted{background:#ffe600}" +
            ".ss-bgm svg{width:22px;height:22px}" +
            ".ss-bgm:focus-visible{outline:3px solid #0046ff;outline-offset:3px}" +
            "@media (prefers-reduced-motion:reduce){.ss-bgm{transition:none}}";
        document.head.appendChild(st);
        btn = document.createElement("button");
        btn.type = "button";
        btn.className = "ss-bgm";
        btn.addEventListener("click", toggle);
        document.body.appendChild(btn);
        return btn;
    }
    function sync() {
        var b = ensureBtn();
        if (!b) { document.addEventListener("DOMContentLoaded", sync, { once: true }); return; }
        // buang elemen yang udah dicopot dari halaman / udah selesai
        wanted.forEach(function (el) { if (el.ended) wanted.delete(el); });
        if (!wanted.size) { b.classList.remove("show"); return; }
        var m = muted();
        b.classList.add("show");
        b.classList.toggle("is-muted", m);
        b.setAttribute("aria-pressed", String(m));
        b.setAttribute("aria-label", m ? "Nyalain musik" : "Matiin musik");
        b.title = m ? "Nyalain musik" : "Matiin musik";
        b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (m ? OFF : ON) + '</svg>';
    }
    function toggle() {
        var m = !muted();
        setMuted(m);
        internal = true;
        wanted.forEach(function (el) {
            try {
                if (m) origPause.call(el);
                else { if (!el.volume) el.volume = 0.5; var p = origPlay.call(el); if (p && p.catch) p.catch(function () { }); }
            } catch (e) { }
        });
        internal = false;
        sync();
    }
    // <audio autoplay> yang ke-parse belakangan: kalau lagi mute, jangan sampai sempat bunyi
    new MutationObserver(function (muts) {
        if (!muted()) return;
        muts.forEach(function (mu) {
            mu.addedNodes.forEach(function (n) {
                if (n.nodeType !== 1) return;
                var list = n.tagName === "AUDIO" ? [n] : (n.querySelectorAll ? n.querySelectorAll("audio[autoplay]") : []);
                Array.prototype.forEach.call(list, function (a) { if (a.loop && a.autoplay) { a.autoplay = false; wanted.add(a); sync(); } });
            });
        });
    }).observe(document.documentElement, { childList: true, subtree: true });

    // dipanggil halaman lain (mis. setelan Musik di Balai Warga) biar tombolnya ikut sinkron
    window.ssBgm = { sync: sync, muted: muted, setMuted: function (v) { setMuted(v); if (v) { internal = true; wanted.forEach(function (el) { try { origPause.call(el); } catch (e) { } }); internal = false; } sync(); } };
})();
