// ============================================================
//  Member Hub (/member) — login/daftar akun + portal
// ============================================================
const GS = (typeof GOOGLE_SCRIPT_URL !== "undefined") ? GOOGLE_SCRIPT_URL : "";
const TOKEN_KEY = "ss_member_token";
const QUEST_WA_GROUP = "https://chat.whatsapp.com/Lpnbndl1UFv9ZaLsrbtpgw?s=cl&p=i&ilr=0&amv=0"; // grup WA buat kirim spread challenge
const ADMIN_WA = "6281214574782"; // WA Arnold buat claim voucher ulang tahun
let _wa = "";        // wa (normalized) yang lagi diproses
let _profile = null; // { token, nickname, birthDate, wa }

// ---------- Preferensi warga (Pengaturan ⚙️) ----------
// ss_font: "normal" | "large" -> html[data-font] (semua ukuran rem ikut ke-scale)
// ss_mute: "1" = semua sfx & musik senyap
(function applyPrefs() {
    try {
        const f = localStorage.getItem("ss_font");
        if (f === "medium" || f === "large") document.documentElement.setAttribute("data-font", f);
    } catch (e) { }
})();
function sndMuted() {
    try { return localStorage.getItem("ss_mute") === "1"; } catch (e) { return false; }
}
let _loyaltyLoaded = false;

function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

function normWa(v) {
    let d = String(v || "").replace(/\D/g, "");
    if (d.indexOf("62") === 0) return d;
    if (d.indexOf("0") === 0) return d;
    if (d.indexOf("8") === 0) return "0" + d;
    return d;
}

function fetchJSONP(url, cbPrefix, timeoutMs) {
    return new Promise((resolve, reject) => {
        const cb = cbPrefix + "_" + Date.now() + "_" + Math.floor(Math.random() * 1e6);
        const s = document.createElement("script");
        const to = setTimeout(() => { reject(new Error("timeout")); done(); }, timeoutMs || 15000);
        function done() { try { delete window[cb]; } catch (e) { } if (s.parentNode) s.parentNode.removeChild(s); }
        window[cb] = (data) => { clearTimeout(to); resolve(data); done(); };
        s.src = url + (url.indexOf("?") >= 0 ? "&" : "?") + "callback=" + cb + "&_=" + Date.now();
        s.onerror = () => { clearTimeout(to); reject(new Error("network")); done(); };
        document.body.appendChild(s);
    });
}

async function apiPost(payload) {
    const res = await fetch(GS, { method: "POST", body: JSON.stringify(payload) });
    return await res.json();
}

// Blocker loader full-screen: tampil tiap kirim data biar user nggak bisa klik-klik lain
function showBusy(text) {
    const o = $("busyOverlay");
    if (!o) return;
    const t = $("busyText");
    if (t) t.textContent = text || "Mengirim…";
    o.classList.add("show");
}
function hideBusy() {
    const o = $("busyOverlay");
    if (o) o.classList.remove("show");
}

// ---------- Skeleton shimmer per section (pengganti spinner bulat) ----------
// Bentuknya ngikutin layout kontennya biar transisi loading -> isi kerasa mulus.
function skEl(style) { return '<div class="sk" style="' + style + '"></div>'; }

function skeletonEvents() {
    const card = '<div class="sk-card">' +
        skEl("width:60%;height:16px;") +
        skEl("width:42%;height:12px;margin-top:10px;") +
        skEl("width:100%;height:44px;margin-top:14px;border-radius:13px;") +
        '</div>';
    return skEl("width:150px;height:16px;margin-bottom:14px;") + card + card + card;
}

function skeletonLoyalty() {
    return '<div class="sk-card">' + skEl("width:55%;height:16px;") +
        '<div style="display:flex;gap:8px;margin-top:14px;">' + skEl("flex:1;height:64px;") + skEl("flex:1;height:64px;") + skEl("flex:1;height:64px;") + skEl("flex:1;height:64px;") + '</div>' +
        skEl("width:100%;height:44px;margin-top:14px;border-radius:13px;") + '</div>' +
        skEl("width:100%;height:210px;border-radius:22px;margin-bottom:14px;") +
        '<div style="display:flex;gap:10px;margin-bottom:14px;">' + skEl("flex:1;height:90px;border-radius:16px;") + skEl("flex:1;height:90px;border-radius:16px;") + '</div>' +
        '<div class="sk-card">' + skEl("width:40%;height:14px;") + skEl("width:100%;height:40px;margin-top:12px;") + '</div>';
}

function skeletonRank() {
    const row = skEl("width:100%;height:46px;border-radius:14px;margin-top:10px;");
    return '<div style="display:flex;gap:8px;margin-bottom:12px;">' + skEl("width:110px;height:34px;border-radius:999px;") + skEl("width:130px;height:34px;border-radius:999px;") + '</div>' +
        '<div class="sk-card">' + skEl("width:50%;height:18px;margin:0 auto;") + row + row + row + row + row + '</div>';
}

function skeletonGallery() {
    const ava = skEl("width:64px;height:64px;border-radius:50%;flex:0 0 auto;");
    const col = (a, b, c) => '<div style="flex:1;display:flex;flex-direction:column;gap:12px;">' + skEl("height:" + a + "px;border-radius:14px;") + skEl("height:" + b + "px;border-radius:14px;") + skEl("height:" + c + "px;border-radius:14px;") + '</div>';
    return '<div style="display:flex;gap:14px;margin-bottom:16px;overflow:hidden;">' + ava + ava + ava + ava + ava + '</div>' +
        skEl("width:100%;height:118px;border-radius:14px;margin-bottom:16px;") + // mading warga
        '<div style="display:flex;gap:8px;margin-bottom:14px;">' + skEl("width:70px;height:32px;border-radius:999px;") + skEl("width:84px;height:32px;border-radius:999px;") + skEl("width:104px;height:32px;border-radius:999px;") + '</div>' +
        '<div style="display:flex;gap:12px;">' + col(190, 150, 170) + col(150, 190, 140) + '</div>';
}

function skeletonQuest() {
    return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' + skEl("width:130px;height:18px;") + skEl("width:110px;height:34px;border-radius:12px;") + '</div>' +
        skEl("width:100%;height:336px;border-radius:16px;") +
        '<div style="display:flex;gap:14px;justify-content:center;margin-top:16px;">' + skEl("width:38px;height:38px;border-radius:50%;") + skEl("width:52px;height:20px;align-self:center;") + skEl("width:38px;height:38px;border-radius:50%;") + '</div>';
}

function setMsg(text, isErr) {
    const m = $("authMsg");
    m.className = "auth-msg" + (isErr ? " err" : "");
    m.textContent = text || "";
}

// ---------- Auth flow ----------
$("nextBtn").addEventListener("click", stepCheckWa);
$("waInput").addEventListener("keydown", (e) => { if (e.key === "Enter") stepCheckWa(); });
$("loginBtn").addEventListener("click", doLogin);
$("loginPass").addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });
$("setupBtn").addEventListener("click", doSetup);
$("backBtn1").addEventListener("click", resetToWa);
$("backBtn2").addEventListener("click", resetToWa);
$("logoutBtn").addEventListener("click", logout);

function resetToWa() {
    $("stepLogin").style.display = "none";
    $("stepSetup").style.display = "none";
    $("stepWa").style.display = "flex";
    if ($("setupBirth")) $("setupBirth").value = "";
    if ($("dpValue")) {
        $("dpValue").textContent = "Pilih tanggal lahir...";
        $("dpValue").classList.add("dp-placeholder");
    }
    setMsg("");
}

async function stepCheckWa() {
    const wa = normWa($("waInput").value);
    if (!wa || wa.length < 8) { setMsg("Nomor WhatsApp-nya kurang lengkap ya 🙏", true); return; }
    if (!GS) { setMsg("Konfigurasi belum siap, refresh dulu ya.", true); return; }
    _wa = wa;
    const btn = $("nextBtn"); btn.disabled = true; setMsg("Mengecek…");
    showBusy("Mengecek nomor kamu…");
    try {
        const r = await fetchJSONP(GS + "?page=memberStatus&wa=" + encodeURIComponent(wa), "ms", 20000);
        if (!r || !r.isMember) {
            setMsg("Nomor ini belum terdaftar sebagai warga 🌱 Yuk ikut salah satu event kami dulu!", true);
            return;
        }
        const nick = r.nickname || "kamu";
        $("stepWa").style.display = "none";
        setMsg("");
        if (r.hasAccount) {
            $("loginHi").textContent = "Hai " + nick + "! Masukin password kamu 👋";
            $("stepLogin").style.display = "flex";
            $("loginPass").focus();
        } else {
            $("setupHi").textContent = "Hai " + nick + "! Yuk buat akun ✨";
            $("stepSetup").style.display = "flex";
            $("setupPass").focus();
        }
    } catch (e) {
        setMsg("Gagal terhubung ke server. Coba lagi ya.", true);
    } finally { btn.disabled = false; hideBusy(); }
}

async function doLogin() {
    const pass = $("loginPass").value;
    if (!pass) { setMsg("Password-nya diisi dulu ya.", true); return; }
    const btn = $("loginBtn"); btn.disabled = true; setMsg("Masuk…");
    showBusy("Masuk…");
    try {
        const r = await apiPost({ action: "memberLogin", wa: _wa, password: pass });
        if (r.status === "success") { onAuthSuccess(r); }
        else { setMsg(r.message || "Gagal masuk.", true); }
    } catch (e) { setMsg("Gagal terhubung ke server.", true); }
    finally { btn.disabled = false; hideBusy(); }
}

async function doSetup() {
    const pass = $("setupPass").value;
    const birth = $("setupBirth").value;
    if (pass.length < 4) { setMsg("Password minimal 4 karakter.", true); return; }
    if (!birth) { setMsg("Tanggal lahir diisi dulu ya 🎂", true); return; }
    const btn = $("setupBtn"); btn.disabled = true; setMsg("Membuat akun…");
    showBusy("Membuat akun…");
    try {
        const r = await apiPost({ action: "memberSetup", wa: _wa, password: pass, birthDate: birth });
        if (r.status === "success") { onAuthSuccess(r); }
        else { setMsg(r.message || "Gagal membuat akun.", true); }
    } catch (e) { setMsg("Gagal terhubung ke server.", true); }
    finally { btn.disabled = false; hideBusy(); }
}

// ---------- Confetti Helper ----------
// canvas-confetti default zIndex cuma 100 -> ketutup modal (quest-modal = 1200).
// Paksa selalu di atas semua overlay/modal di app ini.
const CONFETTI_Z = 99999;
function fireConfetti(preset) {
    if (typeof confetti !== "function") return;
    if (preset === "login") {
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 }, zIndex: CONFETTI_Z });
    } else if (preset === "quest") {
        confetti({ particleCount: 100, spread: 80, origin: { y: 0.55 }, colors: ['#0046ff', '#ffe600', '#00b4ff', '#ff007f'], zIndex: CONFETTI_Z });
    } else if (preset === "reward") {
        confetti({ particleCount: 120, spread: 90, origin: { y: 0.5 }, colors: ['#ffe600', '#ffffff', '#0046ff'], zIndex: CONFETTI_Z });
    } else if (preset === "love") {
        confetti({ particleCount: 45, spread: 55, scalar: 0.9, startVelocity: 32, origin: { y: 0.7 }, colors: ['#ff2d55', '#ff6b8a', '#ffb3c1', '#ffe600'], zIndex: CONFETTI_Z });
    }
}

function onAuthSuccess(r) {
    _profile = { token: r.token, nickname: r.nickname, birthDate: r.birthDate, wa: r.wa, journalRecords: r.journalRecords || "{}", photoUrl: r.photoUrl || "", bio: r.bio || "", moodRecords: r.moodRecords || "{}" };
    // MERGE mood server + lokal (bukan nimpa buta): server menang per-hari (kebenaran
    // lintas device), tapi hari yang cuma ada di lokal (sync-nya sempet gagal/offline)
    // jangan sampai kehapus
    try {
        const srv = JSON.parse(r.moodRecords || "{}") || {};
        const loc = JSON.parse(localStorage.getItem("ss_mood") || "{}") || {};
        Object.keys(loc).forEach(mk => {
            srv[mk] = srv[mk] || {};
            Object.keys(loc[mk]).forEach(d => { if (!srv[mk][d]) srv[mk][d] = loc[mk][d]; });
        });
        localStorage.setItem("ss_mood", JSON.stringify(srv));
    } catch (e) { }
    BDAY_TODAY = Array.isArray(r.birthdays) ? r.birthdays.filter(b => b && b.nickname) : [];
    try { localStorage.setItem(TOKEN_KEY, r.token); } catch (e) { }
    showDashboard();
    fireConfetti("login");
}

function logout() {
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) { }
    _profile = null; _loyaltyLoaded = false; _eventsLoaded = false; _recLoaded = false; _questsLoaded = false; _lbLoaded = false; _lbData = null; _loyaltyStats = null;
    showAuth();
    $("loginPass").value = ""; $("setupPass").value = "";
    resetToWa();
    $("waInput").value = "";
}

// ---------- Dashboard ----------
function hideBoot() { const b = $("bootLoader"); if (b) b.style.display = "none"; }
function showAuth() {
    hideBoot();
    $("dashView").style.display = "none";
    $("authView").style.display = "block";
    const mw = $("mochiWidget"); if (mw) mw.classList.remove("show");
}

function showDashboard() {
    hideBoot();
    $("authView").style.display = "none";
    $("dashView").style.display = "block";
    $("dashHi").textContent = "Hai, " + (_profile.nickname || "Sahabat") + "! 👋";
    const mw = $("mochiWidget"); if (mw) mw.classList.add("show");
    renderProfileAva();
    // Yang lagi ultah dapet perlakuan spesial: sapaan, topi ultah di Mochi, confetti
    if (isMyBirthdayToday()) {
        $("dashHi").textContent = "Happy Birthday, " + (_profile.nickname || "Sahabat") + "! 🎂🥳";
        const av = $("mochiAvatar");
        if (av && !av.querySelector(".mochi-hat")) {
            const hat = document.createElement("span");
            hat.className = "mochi-hat";
            av.appendChild(hat);
        }
        fireConfetti("reward");
    }
    launchBalloons(); // ada sahabat ultah (atau kamu sendiri)? balon-balon terbang 🎈
    startMochiBubbles(); // bubble pintar Mochi: pesan-pesan relevan tampil bergiliran
    initPush(); // daftar push notification (OneSignal) — no-op kalau belum dikonfigurasi
    if (!_mochiSched) { _mochiSched = true; scheduleMochi(); } // Mochi mulai patroli 🐩
    // Ikutin tab dari hash (biar refresh nggak balik ke tab pertama)
    activateTab((location.hash || "").replace("#", "") || "loyalty");
    // Prefetch tab lain di background pas browser idle (non-blocking) biar pindah tab instan
    schedulePrefetch();
}

// Jalanin prefetch pas idle (best practice: nggak rebutan sama render tab aktif)
function schedulePrefetch() {
    const run = () => prefetchTabs();
    if ("requestIdleCallback" in window) requestIdleCallback(run, { timeout: 2500 });
    else setTimeout(run, 600);
}

// Panggil semua loader (idempotent via guard _xxxLoaded) tanpa nunggu -> render ke pane masing2.
// Kalau ada yg gagal, loader-nya reset guard sendiri -> nanti pas tab dibuka bakal retry live.
// Prefetch BERURUTAN, bukan barengan — tiap user cuma megang 1-2 eksekusi
// Apps Script pada satu waktu (jaga limit simultaneous executions project).
async function prefetchTabs() {
    const fns = [loadLoyalty, loadEvents, loadRec, loadQuests, loadLeaderboard, loadGallery];
    for (const fn of fns) {
        try { await fn(); } catch (e) { }
        await new Promise(r => setTimeout(r, 350)); // kasih napas antar request
    }
}

// Error state + tombol "Coba lagi" (dipakai loader biar gagal fetch nggak "meracuni" tab)
function renderError(container, retryFn, msg) {
    if (!container) return;
    container.innerHTML =
        '<div class="placeholder"><div class="em">📡</div><h3>Gagal memuat</h3>' +
        '<p>' + (msg || "Cek koneksi internetmu, lalu coba lagi ya.") + '</p>' +
        '<button class="btn-primary retry-btn" style="margin:14px auto 0;max-width:220px;">🔄 Coba lagi</button></div>';
    const b = container.querySelector(".retry-btn");
    if (b) b.addEventListener("click", retryFn);
}

const VALID_TABS = ["loyalty", "events", "rec", "quest", "rank", "gallery"];
function activateTab(pane) {
    if (pane === "home") pane = "loyalty"; // alias URL: internal tetap "loyalty" (id pane & data lama), URL pakai #home
    if (VALID_TABS.indexOf(pane) < 0) pane = "loyalty";
    document.querySelectorAll(".tab").forEach(x => x.classList.toggle("active", x.dataset.pane === pane));
    document.querySelectorAll(".pane").forEach(x => x.classList.remove("active"));
    const el = $("pane-" + pane); if (el) el.classList.add("active");
    window.scrollTo(0, 0); // pindah tab = mulai dari atas, jangan bawa posisi scroll tab sebelumnya
    const dt = $("dashTop"); if (dt) dt.style.display = (pane === "loyalty") ? "" : "none";
    // Sesi belum keverifikasi (_profile kosong)? Loader butuh profil -> tampilkan
    // skeleton dulu; nanti showDashboard() manggil activateTab lagi pas sesi valid.
    if (!_profile) { renderPaneSkeleton(pane); return; }
    if (pane === "loyalty") loadLoyalty();
    if (pane === "events") loadEvents();
    if (pane === "rec") loadRec();
    if (pane === "quest") loadQuests();
    if (pane === "rank") loadLeaderboard();
    if (pane === "gallery") loadGallery();
}

function renderPaneSkeleton(pane) {
    if (pane === "loyalty") { const l = $("loyaltyLoading"); if (l) l.style.display = "none"; $("loyaltyContent").innerHTML = skeletonLoyalty(); }
    else if (pane === "events") $("pane-events").innerHTML = skeletonEvents();
    else if (pane === "quest") $("pane-quest").innerHTML = skeletonQuest();
    else if (pane === "rank") { const l = $("lbLoading"); if (l) l.style.display = "none"; $("lbContent").innerHTML = skeletonRank(); }
    else if (pane === "gallery") $("pane-gallery").innerHTML = skeletonGallery();
    else if (pane === "rec") loadRec(); // rekomendasi dari config lokal, nggak butuh profil
}
document.querySelectorAll(".tab").forEach(t => {
    t.addEventListener("click", () => {
        const pane = t.dataset.pane;
        try { location.hash = (pane === "loyalty" ? "home" : pane); } catch (e) { }
        activateTab(pane);
    });
});
// Back/forward atau ubah hash manual -> ikutin (cuma kalau dashboard tampil)
window.addEventListener("hashchange", () => {
    if ($("dashView").style.display === "none") return;
    const h = (location.hash || "").replace("#", "");
    if (h === "snail-mail") { openSnailBox(false); return; } // halaman kotak surat (deep-link/refresh aman)
    closeSnailPage(false);
    activateTab(h);
});

// ---------- Event pane ----------
let _eventsLoaded = false;
async function loadEvents() {
    if (_eventsLoaded) return;
    const pane = $("pane-events");
    const _ws = (typeof WORKSHOPS !== "undefined" && Array.isArray(WORKSHOPS)) ? WORKSHOPS : [];
    // Config belum masuk -> tunggu event, render ulang sekali
    if (!_ws.length) {
        pane.innerHTML = skeletonEvents();
        window.addEventListener("workshops:updated", function once() {
            window.removeEventListener("workshops:updated", once);
            loadEvents();
        });
        return;
    }
    _eventsLoaded = true;
    pane.innerHTML = skeletonEvents();
    let counts = {}, registered = {};
    try {
        const [c, r] = await Promise.all([
            fetchJSONP(GS, "cnt", 12000).catch(() => ({})),
            fetchJSONP(GS + "?page=memberEvents&wa=" + encodeURIComponent(_profile.wa), "mev", 15000).catch(() => ({}))
        ]);
        counts = c || {}; registered = (r && r.registered) || {};
        _evRegistered = registered; // simpan buat bubble pintar Mochi (skip event yg udah didaftar)
        _evCounts = counts;         // simpan buat flyer event di Mading Warga
    } catch (e) { }
    renderEventTicket(); // tiket countdown di Home baru bisa kerender setelah _evRegistered keisi

    const items = _ws
        .map(w => ({ w: w, status: (typeof getWorkshopStatus === "function") ? getWorkshopStatus(w) : "open" }))
        .filter(x => x.status === "open" || x.status === "not-open-yet");

    if (!items.length) {
        pane.innerHTML = '<div class="placeholder"><div class="em">📅</div><h3>Belum ada event buka</h3><p>Pantau terus ya, event baru bakal muncul di sini 🌱</p></div>';
        return;
    }

    let html = '<div class="section-lbl">🎟️ Upcoming Events</div>';
    // Bulan ultah? Tempelin catatan diskon voucher di atas daftar event
    const bd = birthdayInfo();
    if (bd) {
        html += '<button class="ev-bday-note" id="evBdayNote">' +
            '<span class="ebn-tape"></span>' +
            '🎂 Bulan ultahmu! Semua event <b>diskon ' + bd.age + '%</b> buat kamu — ketuk buat cek vouchernya 🎁' +
            '</button>';
    }
    items.forEach(x => {
        const w = x.w;
        const max = w.maxQuota || 0;
        const used = counts[w.id] || 0;
        const left = max > 0 ? Math.max(0, max - used) : null;
        const full = max > 0 && used >= max;
        const isReg = !!registered[w.id];
        const dateTxt = w.workshopDate || (typeof formatDateIndo === "function" && w.eventDate ? formatDateIndo(w.eventDate) : "");
        // Badge = harga dari config (ganti tag OPEN yang nggak informatif).
        // Early bird aktif -> harga normal dicoret. Nggak ada harga -> fallback OPEN.
        const kIDR = n => (n >= 1000 ? Math.round(n / 1000) : n); // 250000 -> 250
        let badge;
        if (x.status === "not-open-yet") {
            badge = '<span class="ev-badge soon">SOON</span>';
        } else {
            const cur = (typeof getCurrentPrice === "function") ? getCurrentPrice(w) : w.normalPrice;
            const eb = (typeof isEarlyBird === "function") && isEarlyBird(w) && w.normalPrice > cur;
            badge = (cur > 0)
                ? '<span class="ev-badge price">' + (eb ? '<s>' + kIDR(w.normalPrice) + '</s> ' : '') + kIDR(cur) + ' IDR</span>'
                : '<span class="ev-badge open">FREE 🎉</span>';
        }

        let action;
        if (isReg) action = '<div class="ev-done">✅ You\'re in — see you there! 💙</div>';
        else if (x.status === "not-open-yet") action = '<div class="ev-meta">Registration opens soon</div>';
        else if (full) action = '<div class="ev-full">Fully booked 😢</div>';
        else {
            let href = "../" + (w.path || "");
            // Event member (journaling-date): bawa WA (nggak input ulang) + flag from=member (balik ke portal)
            if (w.id === "journaling-date") href += (href.indexOf("?") >= 0 ? "&" : "?") + "wa=" + encodeURIComponent(_profile.wa) + "&from=member";
            action = '<a class="btn-primary" href="' + esc(href) + '">Register →</a>';
        }

        const meta = [dateTxt, (left != null && !full && !isReg ? (left + " seats left") : "")].filter(Boolean).join(" · ");

        html += '<div class="ev">' +
            '<div class="ev-top"><div class="ev-name">' + esc(w.name || w.id) + '</div>' + badge + '</div>' +
            (meta ? '<div class="ev-meta">' + esc(meta) + '</div>' : '') +
            '<div class="ev-action">' + action + '</div>' +
            '</div>';
    });
    pane.innerHTML = html;
    const ebn = $("evBdayNote");
    if (ebn) ebn.addEventListener("click", () => activateTab("loyalty"));
}

// ---------- Rekomendasi pane (dari recommendation-config.js, sama kayak /recommendation) ----------
let _recLoaded = false;
function loadRec() {
    if (_recLoaded) return;
    _recLoaded = true;
    const pane = $("pane-rec");
    const list = (typeof RECOMMENDATIONS !== "undefined" && Array.isArray(RECOMMENDATIONS)) ? RECOMMENDATIONS.filter(it => it && it.title) : [];
    if (!list.length) {
        pane.innerHTML = '<div class="placeholder"><div class="em">🛍️</div><h3>Belum ada rekomendasi</h3><p>Segera nyusul ya!</p></div>';
        return;
    }
    // Filter tabs: Semua + kategori yang dipakai (label dari RECOMMENDATION_CATEGORIES)
    const cats = [];
    list.forEach(it => { if (it.category && cats.indexOf(it.category) < 0) cats.push(it.category); });
    let tabs = '<button class="rfilter active" data-cat="all">All</button>';
    cats.forEach(c => { tabs += '<button class="rfilter" data-cat="' + esc(c) + '">' + esc(recCatLabel_(c)) + '</button>'; });
    const bar = $("recTabs");
    bar.innerHTML = tabs;
    bar.querySelectorAll(".rfilter").forEach(b => b.addEventListener("click", () => {
        bar.querySelectorAll(".rfilter").forEach(x => x.classList.remove("active"));
        b.classList.add("active");
        _recCat = b.dataset.cat;
        renderRecCards();
    }));
    const search = $("recSearch");
    if (search) search.addEventListener("input", () => { _recSearch = search.value.toLowerCase().trim(); renderRecCards(); });
    renderRecCards();
}

let _recCat = "all";
let _recSearch = "";
function recCatLabel_(cat) {
    return (typeof RECOMMENDATION_CATEGORIES !== "undefined" && RECOMMENDATION_CATEGORIES[cat]) || cat;
}
function renderRecCards() {
    const wrap = $("recList");
    let list = recList_();
    if (_recCat !== "all") list = list.filter(it => it.category === _recCat);
    if (_recSearch) list = list.filter(it =>
        String(it.title || "").toLowerCase().includes(_recSearch) ||
        String(it.description || "").toLowerCase().includes(_recSearch));
    if (!list.length) { wrap.innerHTML = '<div class="placeholder"><p style="color:var(--muted)">Nggak nemu yang kamu cari 🔍</p></div>'; return; }
    let html = "";
    list.forEach(it => {
        const img = it.image ? (/^https?:\/\//.test(it.image) ? it.image : "../" + it.image) : "";
        html += '<div class="rec">' +
            (img ? '<img src="' + esc(img) + '" alt="" loading="lazy" decoding="async" onerror="this.style.opacity=0.3">' : '') +
            '<div class="rec-body">' +
            '<div class="rec-title">' + esc(it.title) + '</div>' +
            // deskripsi = HTML (boleh <strong> dll) dari config statis terpercaya
            (it.description ? '<div class="rec-desc">' + it.description + '</div>' : '') +
            (it.link ? '<a class="rec-link" href="' + esc(it.link) + '" target="_blank" rel="noopener">View Product →</a>' : '') +
            '</div></div>';
    });
    wrap.innerHTML = html;
}
function recList_() {
    return (typeof RECOMMENDATIONS !== "undefined" && Array.isArray(RECOMMENDATIONS)) ? RECOMMENDATIONS.filter(it => it && it.title) : [];
}

// ---------- Side Quest pane ----------
let _questsLoaded = false;

let _questChallenges = [];
let _questSubmitted = [];
let _questPhotos = {};      // { challengeId: photoUrl } — foto yg udah diupload member
let _questCaptions = {};    // { challengeId: caption }
let _questView = "book";    // "book" | "grid" | "list"
let _qbRefresh = null;      // refresh halaman buku yg lagi kebuka (diisi renderQuestBook)

function questImg(q) {
    return q.image ? (/^https?:\/\//.test(q.image) ? q.image : "../" + q.image) : "../images/mochi_maskot_sm.png";
}
function questPoints(q) { return (q.points && q.points > 0) ? q.points : 50; }
function questCaption(q) { return "Halo semuaa! 🎉 Ini spread challenge" + (q.title ? ' "' + q.title + '"' : "") + " journaling-ku ✨ #SemingguSatu"; }

// HEIC (foto iPhone) nggak bisa didecode browser -> konversi ke JPEG dulu
// (heic2any dimuat on-demand dari CDN, cuma pas ketemu file HEIC)
function isHeicFile(f) {
    return /heic|heif/i.test((f && f.type) || "") || /\.(heic|heif)$/i.test((f && f.name) || "");
}
async function heicToJpeg(file) {
    if (!window.heic2any) {
        await new Promise((res, rej) => {
            const s = document.createElement("script");
            s.src = "https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js";
            s.onload = res; s.onerror = () => rej(new Error("gagal load konverter HEIC"));
            document.head.appendChild(s);
        });
    }
    const out = await window.heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
    return Array.isArray(out) ? out[0] : out;
}

// Kompres foto di HP dulu (resize + WebP/JPEG) biar hemat storage Drive.
async function compressImage(file, maxDim, quality) {
    if (isHeicFile(file)) file = await heicToJpeg(file);
    return new Promise((resolve, reject) => {
        if (!file || !/^image\//.test(file.type)) { reject(new Error("File bukan gambar")); return; }
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            let w = img.naturalWidth, h = img.naturalHeight;
            const m = maxDim || 1280;
            if (w > h && w > m) { h = Math.round(h * m / w); w = m; }
            else if (h >= w && h > m) { w = Math.round(w * m / h); h = m; }
            const c = document.createElement("canvas"); c.width = w; c.height = h;
            c.getContext("2d").drawImage(img, 0, 0, w, h);
            // WebP lebih hemat ~30%; browser yang belum support (Safari lama) otomatis fallback JPEG
            let mime = "image/webp";
            let dataUrl = c.toDataURL(mime, quality || 0.75);
            if (dataUrl.indexOf("data:image/webp") !== 0) {
                mime = "image/jpeg";
                dataUrl = c.toDataURL(mime, quality || 0.75);
            }
            resolve({ base64: dataUrl.split(",")[1], dataUrl: dataUrl, mime: mime });
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Gagal baca gambar")); };
        img.src = url;
    });
}

async function loadQuests() {
    if (_questsLoaded) return;
    _questsLoaded = true;
    const pane = $("pane-quest");
    pane.innerHTML = skeletonQuest();
    try {
        const [c, s] = await Promise.all([
            fetchJSONP(GS + "?page=challenges", "chl", 15000),
            fetchJSONP(GS + "?page=memberQuests&wa=" + encodeURIComponent(_profile.wa), "mq", 15000)
        ]);
        _questChallenges = (c && c.challenges) || [];
        _questSubmitted = (s && s.submitted) || [];
        _questPhotos = (s && s.photos) || {};
        _questCaptions = (s && s.captions) || {};
    } catch (e) {
        _questsLoaded = false;            // biar bisa retry pas tab dibuka lagi
        renderError(pane, loadQuests);
        return;
    }

    if (!_questChallenges.length) {
        pane.innerHTML = '<div class="placeholder"><div class="em">⚡</div><h3>Belum ada Quest</h3><p>Pantau terus ya, challenge baru bakal muncul di sini! 🌱</p></div>';
        return;
    }
    // Belum selesai di atas
    _questChallenges.sort((a, b) => (_questSubmitted.indexOf(a.id) >= 0 ? 1 : 0) - (_questSubmitted.indexOf(b.id) >= 0 ? 1 : 0));
    renderQuestBoard();
}

function renderQuestBoard() {
    const pane = $("pane-quest");
    const toolbar =
        '<div class="gallery-toolbar">' +
        '<div class="section-lbl" style="margin:0;">🎯 Quest Board</div>' +
        '<div class="view-toggle">' +
        '<button class="vbtn' + (_questView === "book" ? " active" : "") + '" id="qViewBook" title="Mode Buku" aria-label="Mode Buku">' + ICON_BOOK + '</button>' +
        '<button class="vbtn' + (_questView === "grid" ? " active" : "") + '" id="qViewGrid" title="Mode Grid" aria-label="Mode Grid">' + ICON_GRID + '</button>' +
        '<button class="vbtn' + (_questView === "list" ? " active" : "") + '" id="qViewList" title="Mode List" aria-label="Mode List">' + ICON_FEED + '</button>' +
        '</div>' +
        '</div>';
    _qbRefresh = null;
    if (_questView === "book") {
        pane.innerHTML = toolbar + '<div id="questGrid"></div>';
        renderQuestBook($("questGrid"));
    } else {
        const body = (_questView === "list")
            ? '<div class="quest-list" id="questGrid">' + _questChallenges.map(renderQuestRow).join("") + '</div>'
            : '<div class="quest-grid" id="questGrid">' + _questChallenges.map(renderQuestCell).join("") + '</div>';
        pane.innerHTML = toolbar + body;
        $("questGrid").querySelectorAll("[data-i]").forEach(cell =>
            cell.addEventListener("click", () => openQuestDetail(Number(cell.dataset.i))));
    }
    $("qViewBook").addEventListener("click", () => { _questView = "book"; renderQuestBoard(); });
    $("qViewGrid").addEventListener("click", () => { _questView = "grid"; renderQuestBoard(); });
    $("qViewList").addEventListener("click", () => { _questView = "list"; renderQuestBoard(); });
}

// ---------- Quest Book: buku harian terbuka + flip halaman 3D ----------
// Halaman kiri = prompt/deskripsi challenge (kertas dot-grid), halaman kanan =
// aksi (polaroid contoh/karya, teman yg udah ikut, tombol upload) di kertas garis.
// Swipe / panah = flip: selembar "leaf" muter di spine (depan = halaman kanan
// sekarang, belakang = halaman kiri challenge berikutnya) kayak buku beneran.
let _qbCur = 0;

function questWorks(q) { // karya di galeri buat challenge ini (kalau galeri udah ke-load)
    return (_galleryItems || []).filter(x => x && x.photo && x.title === q.title);
}

function qbLeftHtml(i) {
    const q = _questChallenges[i];
    const done = _questSubmitted.indexOf(q.id) >= 0;
    const stk = "str-" + ((i % 11) + 1) + ".png"; // sticker beda tiap halaman
    return '<span class="qb-xp">🪙 +' + questPoints(q) + ' XP</span>' +
        '<div class="qb-title">' + esc(q.title) + '</div>' +
        (q.theme ? '<div class="qb-theme">🎨 ' + esc(q.theme) + '</div>' : '') +
        (q.description ? '<div class="qb-desc">' + esc(q.description) + '</div>' : '') +
        '<img class="qb-stk" src="../images/sticker/' + stk + '" alt="">' +
        (done ? '<span class="qb-stamp">✓ CLEARED</span>' : '');
}

function qbRightHtml(i) {
    const q = _questChallenges[i];
    const done = _questSubmitted.indexOf(q.id) >= 0;
    const myPhoto = _questPhotos[q.id];
    const works = questWorks(q);
    let friends;
    if (works.length) {
        friends = '<div class="qb-friends">' +
            works.slice(0, 3).map(w => '<img src="' + esc(w.photo) + '" alt="">').join("") +
            '<span>' + works.length + ' karya teman 💙</span></div>';
    } else {
        friends = '<div class="qb-friends empty">Jadilah yang pertama upload ✨</div>';
    }
    return '<div class="qb-pola">' +
        '<span class="qb-tape pola"></span>' +
        '<div class="qb-pola-img"><img src="' + esc(myPhoto || questImg(q)) + '" alt="" onerror="this.style.opacity=.25"></div>' +
        '<div class="qb-pola-cap">' + (myPhoto ? "karya kamu ✨" : "inspirasi spread 💡") + '</div>' +
        '</div>' +
        friends +
        '<button class="qb-cta' + (done ? " done" : "") + '" data-open="' + i + '">' + (done ? "✏️ Lihat / Edit Karya" : "🚀 Ikut Challenge") + '</button>';
}

function renderQuestBook(host) {
    const N = _questChallenges.length;
    if (_qbCur >= N) _qbCur = 0;
    host.innerHTML =
        '<div class="qbook-wrap">' +
        '<div class="qbook" id="qbook">' +
        '<div class="qb-page qb-left" id="qbLeft"></div>' +
        '<div class="qb-page qb-right" id="qbRight"></div>' +
        '<div class="qb-leaf" id="qbLeaf"><div class="qb-face qb-front" id="qbFront"></div><div class="qb-face qb-back" id="qbBack"></div></div>' +
        '<div class="qb-rings">' + "<span></span>".repeat(7) + '</div>' +
        '</div>' +
        '<div class="qbook-nav">' +
        '<button class="qb-arrow" id="qbPrev" aria-label="Challenge sebelumnya">‹</button>' +
        '<div class="qb-count" id="qbCount"></div>' +
        '<button class="qb-arrow" id="qbNext" aria-label="Challenge berikutnya">›</button>' +
        '</div>' +
        '</div>';

    const book = $("qbook"), leftP = $("qbLeft"), rightP = $("qbRight");
    const leaf = $("qbLeaf"), front = $("qbFront"), back = $("qbBack");
    let anim = false;

    function wireCta() {
        rightP.querySelectorAll("[data-open]").forEach(b =>
            b.addEventListener("click", () => openQuestDetail(Number(b.dataset.open))));
    }
    function setPages(i) {
        _qbCur = i;
        leftP.innerHTML = qbLeftHtml(i);
        rightP.innerHTML = qbRightHtml(i);
        $("qbCount").textContent = (i + 1) + " / " + N;
        $("qbPrev").style.opacity = i === 0 ? ".35" : "1";
        $("qbNext").style.opacity = i === N - 1 ? ".35" : "1";
        wireCta();
    }
    _qbRefresh = () => setPages(_qbCur);

    function setLeaf(deg, animate) {
        leaf.style.transition = animate ? "transform .65s cubic-bezier(.35,.1,.25,1)" : "none";
        // translateZ tipis: leaf selalu sedikit di depan halaman statis, nggak z-fighting pas sejajar
        leaf.style.transform = "translateZ(.5px) rotateY(" + deg + "deg)";
    }
    function flip(dir) { // 1 = maju, -1 = mundur
        if (anim) return;
        const j = _qbCur + dir;
        if (j < 0 || j >= N) { // mentok: goyang dikit
            book.classList.add("nudge");
            setTimeout(() => book.classList.remove("nudge"), 320);
            return;
        }
        anim = true;
        playSfx("flip", 0.7);
        if (dir === 1) {
            front.innerHTML = qbRightHtml(_qbCur); // muka depan leaf = halaman kanan sekarang
            back.innerHTML = qbLeftHtml(j);        // baliknya = halaman kiri berikutnya
            rightP.innerHTML = qbRightHtml(j);     // di bawah leaf udah nunggu halaman baru
        } else {
            front.innerHTML = qbRightHtml(j);
            back.innerHTML = qbLeftHtml(_qbCur);
            leftP.innerHTML = qbLeftHtml(j);
        }
        // Posisi awal dipasang SELAGI leaf masih hidden, di-commit dulu (reflow +
        // double rAF), baru transisi jalan — kalau nggak, pas back leaf sempat
        // ke-paint di posisi depan (0°) sekejap sebelum lompat ke -180°.
        setLeaf(dir === 1 ? 0 : -180, false);
        leaf.style.display = "block";
        void leaf.offsetWidth;
        requestAnimationFrame(() => requestAnimationFrame(() => {
            setLeaf(dir === 1 ? -180 : 0, true);
            setTimeout(() => {
                // JANGAN rebuild innerHTML di akhir flip — <img> baru harus decode
                // ulang, bikin area foto kedip (kelihatan membesar-mengecil pas back).
                // Pindahin node dari muka leaf ke halaman statis: elemen & gambar
                // yang sama persis, udah ke-paint, jadi seamless.
                _qbCur = j;
                const srcFace = dir === 1 ? back : front;
                const target = dir === 1 ? leftP : rightP;
                target.innerHTML = "";
                while (srcFace.firstChild) target.appendChild(srcFace.firstChild);
                $("qbCount").textContent = (j + 1) + " / " + N;
                $("qbPrev").style.opacity = j === 0 ? ".35" : "1";
                $("qbNext").style.opacity = j === N - 1 ? ".35" : "1";
                wireCta();
                leaf.style.display = "none";
                anim = false;
            }, 680);
        }));
    }

    setPages(_qbCur);
    $("qbPrev").addEventListener("click", () => flip(-1));
    $("qbNext").addEventListener("click", () => flip(1));
    // swipe kiri/kanan di atas buku = flip
    let sx = 0, sy = 0;
    book.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    book.addEventListener("touchend", (e) => {
        const t = e.changedTouches[0];
        const dx = t.clientX - sx, dy = t.clientY - sy;
        if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy)) flip(dx < 0 ? 1 : -1);
    }, { passive: true });
}

function renderQuestRow(q, i) {
    const done = _questSubmitted.indexOf(q.id) >= 0;
    const works = questWorks(q).length;
    return '<div class="quest-row' + (done ? " done" : "") + '" data-i="' + i + '">' +
        '<div class="qr-main">' +
        '<div class="qr-title">' + esc(q.title) + (done ? ' <span class="qr-done">✓ Cleared</span>' : '') + '</div>' +
        (q.description ? '<div class="qr-desc">' + esc(q.description) + '</div>' : '') +
        (q.theme ? '<div class="qr-theme">🎨 ' + esc(q.theme) + '</div>' : '') +
        (works ? '<div class="qr-friends">👥 ' + works + ' karya teman 💙</div>' : '') +
        '</div>' +
        '<div class="qr-xp">🪙 +' + questPoints(q) + '</div>' +
        '</div>';
}

function renderQuestCell(q, i) {
    const done = _questSubmitted.indexOf(q.id) >= 0;
    const works = questWorks(q).length;
    const tape = '<div class="jtape ' + (i % 2 === 0 ? "tl" : "tr blue") + '"></div>';
    return '<div class="qg-cell' + (done ? ' done' : '') + '" data-i="' + i + '">' +
        tape +
        '<div class="qg-imgwrap">' +
        '<img class="qg-img" src="' + esc(questImg(q)) + '" alt="" loading="lazy" decoding="async" onerror="this.style.opacity=.25">' +
        '<span class="qg-xp">🪙 +' + questPoints(q) + '</span>' +
        (works ? '<span class="qg-count">👥 ' + works + '</span>' : '') +
        '</div>' +
        '<div class="qg-body">' +
        '<div class="qg-title">' + esc(q.title) + '</div>' +
        (q.theme ? '<div class="qg-theme">🎨 ' + esc(q.theme) + '</div>' : '') +
        '</div>' +
        '</div>';
}

// ---- Kunci scroll background pas modal kebuka (aman iOS Safari) ----
let _scrollLockY = 0;
function lockScroll() {
    _scrollLockY = window.scrollY || window.pageYOffset || 0;
    const b = document.body;
    b.style.position = "fixed";
    b.style.top = "-" + _scrollLockY + "px";
    b.style.left = "0";
    b.style.right = "0";
    b.style.width = "100%";
}
function unlockScroll() {
    const b = document.body;
    b.style.position = "";
    b.style.top = "";
    b.style.left = "";
    b.style.right = "";
    b.style.width = "";
    window.scrollTo(0, _scrollLockY);
}
function closeQuestModal() {
    const modal = $("questModal");
    if (modal) modal.classList.remove("show");
    unlockScroll();
}

// ---- Detail quest (modal ala postingan IG) ----
function openQuestDetail(i) {
    const q = _questChallenges[i];
    if (!q) return;
    const done = _questSubmitted.indexOf(q.id) >= 0;
    const modal = $("questModal");
    $("questModalBox").innerHTML =
        '<div class="qm-topbar"><button class="qm-close" id="qmClose" aria-label="Tutup">✕</button></div>' +
        '<img class="qm-img" src="' + esc(questImg(q)) + '" alt="" onerror="this.style.opacity=.25">' +
        '<div class="qm-body">' +
        '<div class="quest-meta-tags">' +
        (q.theme ? '<span class="q-tag theme">🎨 ' + esc(q.theme) + '</span>' : '') +
        '<span class="q-tag exp">🪙 +' + questPoints(q) + ' XP</span>' +
        (done ? '<span class="q-tag done">✓ Cleared</span>' : '') +
        '</div>' +
        '<div class="quest-game-title" style="margin-top:8px;">' + esc(q.title) + '</div>' +
        (q.description ? '<div class="quest-game-desc">' + esc(q.description) + '</div>' : '') +
        '<div class="quest-objective-box" style="margin-top:12px;">' +
        '<div class="q-obj-header"><span>📖</span> Mission Objective</div>' +
        '<div class="q-obj-text">Bikin spread sesuai tema, kirim buktinya ke Grup WA + upload foto buat galeri.</div>' +
        '</div>' +
        '<div class="quest-action" id="qmAction" style="margin-top:14px;"></div>' +
        '</div>';
    renderQuestAction(q, i);
    modal.classList.add("show");
    lockScroll();
    $("qmClose").addEventListener("click", closeQuestModal);
}

// Form pilih foto + caption (dipakai saat submit & edit)
function photoPickerHtml(labelText, capPlaceholder) {
    return '<div class="qm-picker">' +
        '<label class="qm-file">' +
        '<span class="qm-file-ic">📷</span>' +
        '<b class="qm-file-lbl">' + esc(labelText) + '</b>' +
        '<span class="qm-file-sub">Ketuk buat pilih foto dari galeri 🖼️</span>' +
        '<input type="file" class="qm-file-input" accept="image/*" hidden>' +
        '</label>' +
        '<div class="qm-preview" style="display:none;"><img alt=""></div>' +
        '<textarea class="qm-cap-input" maxlength="280" placeholder="' + esc(capPlaceholder || "Tulis caption buat galeri… ✨ (opsional)") + '"></textarea>' +
        '</div>';
}
function wirePhotoPicker(scope) {
    if (!scope) return;
    const input = scope.querySelector(".qm-file-input");
    const prev = scope.querySelector(".qm-preview");
    const file = scope.querySelector(".qm-file");
    const ic = scope.querySelector(".qm-file-ic");
    const lbl = scope.querySelector(".qm-file-lbl");
    const sub = scope.querySelector(".qm-file-sub");
    if (!input) return;
    input.addEventListener("change", async () => {
        const f = input.files && input.files[0];
        if (!f) return;
        showBusy("Memproses foto…");
        try {
            const r = await compressImage(f, 1280, 0.75);
            input._photo = r;
            if (prev) { prev.style.display = "block"; prev.querySelector("img").src = r.dataUrl; }
            // state sukses yang jelas: kotak jadi hijau + copy berubah
            if (file) file.classList.add("ok");
            if (ic) ic.textContent = "✅";
            if (lbl) lbl.textContent = "Foto siap!";
            if (sub) sub.textContent = "Ketuk lagi kalau mau ganti foto";
        } catch (e) { alert("Gagal proses foto: " + (e.message || "")); }
        finally { hideBusy(); }
    });
}

function renderQuestAction(q, i) {
    const action = $("qmAction");
    const done = _questSubmitted.indexOf(q.id) >= 0;
    const waCap = questCaption(q);
    if (!done) {
        action.innerHTML =
            photoPickerHtml("Tambah foto spread (opsional)") +
            '<button class="btn-quest-start" id="qmSubmit" style="margin-top:10px;">🚀 Ambil Quest →</button>';
        wirePhotoPicker(action);
        $("qmSubmit").addEventListener("click", () => submitQuest(q, i, action));
        return;
    }
    // ---- Sudah ikut: view mode (karya di galeri) <-> edit mode (form) ----
    const photo = _questPhotos[q.id];
    const cap = _questCaptions[q.id] || "";
    let view = '<div class="ev-done">✅ Kamu udah ikut challenge ini! 🎉</div>';
    if (photo) {
        view += '<div class="qm-work-lbl">📖 Karya kamu di galeri</div>' +
            '<div class="qm-polaroid">' +
            '<div class="washi-tape-top"></div>' +
            '<button class="qm-edit-fab" data-edit title="Edit foto / caption">✏️</button>' +
            '<div class="qm-polaroid-imgwrap"><img src="' + esc(photo) + '" alt=""></div>' +
            (cap ? '<div class="feed-caption-box" style="margin-top:8px;"><p class="caption-text">' + esc(cap) + '</p></div>' : '') +
            '</div>' +
            '<button class="btn-ghost2" data-edit style="margin-top:10px;">✏️ Edit foto / caption</button>';
    } else {
        view += '<button class="qm-add-photo" data-edit>' +
            '<span class="qm-add-icon">📷</span>' +
            '<b>Pajang karyamu di galeri!</b>' +
            '<span>Upload foto spread + caption ✨</span>' +
            '</button>';
    }
    const html =
        '<div id="qmView">' + view + '</div>' +
        '<div id="qmEditBox" class="qm-editpanel" style="display:none;">' +
        '<div class="qm-edit-head">✏️ ' + (photo ? "Edit karya kamu" : "Upload karya kamu") + '</div>' +
        photoPickerHtml(photo ? "Ganti foto" : "Pilih foto") +
        '<div style="display:flex;gap:8px;margin-top:10px;">' +
        '<button class="btn-ghost2" id="qmEditCancel" style="flex:0 0 auto;width:auto;">Batal</button>' +
        '<button class="btn-primary" id="qmEditSave" style="flex:1;width:auto;min-width:0;">💾 Simpan</button>' +
        '</div></div>' +
        '<div class="qm-work-lbl" style="margin-top:16px;">📲 Share ke grup</div>' +
        '<div class="q-caption">' + esc(waCap) + '</div>' +
        '<button class="btn-ghost2 quest-copy" style="margin-top:8px;">📋 Salin caption WA</button>' +
        '<a class="btn-primary" href="' + QUEST_WA_GROUP + '" target="_blank" rel="noopener" style="margin-top:8px;">📲 Buka Grup WA</a>';
    action.innerHTML = html;

    const copyBtn = action.querySelector(".quest-copy");
    if (copyBtn) copyBtn.addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(waCap); copyBtn.textContent = "✓ Caption tersalin"; }
        catch (e) { copyBtn.textContent = "Salin manual ya"; }
    });
    const viewBox = $("qmView");
    const editBox = $("qmEditBox");
    // semua tombol/area ber-atribut data-edit -> masuk mode edit (swap, bukan numpuk)
    action.querySelectorAll("[data-edit]").forEach(el => el.addEventListener("click", () => {
        viewBox.style.display = "none";
        editBox.style.display = "block";
        const ci = editBox.querySelector(".qm-cap-input");
        if (ci && !ci.value) ci.value = cap;
    }));
    wirePhotoPicker(editBox);
    const cancelBtn = $("qmEditCancel");
    if (cancelBtn) cancelBtn.addEventListener("click", () => {
        editBox.style.display = "none";
        viewBox.style.display = "block";
    });
    const saveBtn = $("qmEditSave");
    if (saveBtn) saveBtn.addEventListener("click", () => editQuestPhoto(q, i, editBox));
}

async function submitQuest(q, i, action) {
    const btn = action.querySelector("#qmSubmit");
    const input = action.querySelector(".qm-file-input");
    const capInput = action.querySelector(".qm-cap-input");
    const photo = input && input._photo;
    const caption = capInput ? capInput.value.trim() : "";
    if (!confirm("Ambil quest" + (q.title ? ' "' + q.title + '"' : "") + "?")) return;
    const orig = btn ? btn.textContent : "";
    if (btn) { btn.disabled = true; btn.textContent = "Mengirim…"; }
    showBusy(photo ? "Mengirim karya kamu…" : "Mengirim…");
    try {
        const payload = { action: "memberSubmitQuest", token: _profile.token, challengeId: q.id, caption: caption };
        if (photo) { payload.photoBase64 = photo.base64; payload.photoMime = photo.mime; }
        const r = await apiPost(payload);
        if (r.status !== "success") { if (btn) { btn.disabled = false; btn.textContent = orig; } alert(r.message || "Gagal."); return; }
        playSfx("challenge-done");
        fireConfetti("quest");
        if (_questSubmitted.indexOf(q.id) < 0) _questSubmitted.push(q.id);
        if (photo) _questPhotos[q.id] = photo.dataUrl;   // preview lokal sampai reload
        if (caption) _questCaptions[q.id] = caption;
        const cell = $("questGrid") && $("questGrid").querySelector('[data-i="' + i + '"]');
        if (cell) cell.classList.add("done");
        _galleryLoaded = false;
        if (typeof _qbRefresh === "function") _qbRefresh(); // sinkron halaman Quest Book
        renderQuestAction(q, i);
        try { await navigator.clipboard.writeText(questCaption(q)); } catch (e) { }
        try { window.open(QUEST_WA_GROUP, "_blank"); } catch (e) { }
    } catch (e) { if (btn) { btn.disabled = false; btn.textContent = orig; } alert("Gagal terhubung ke server."); }
    finally { hideBusy(); }
}

async function editQuestPhoto(q, i, box) {
    const input = box.querySelector(".qm-file-input");
    const capInput = box.querySelector(".qm-cap-input");
    const photo = input && input._photo;
    const caption = capInput ? capInput.value.trim() : "";
    if (!photo) { alert("Pilih fotonya dulu ya 📷"); return; }
    const btn = $("qmEditSave");
    const orig = btn ? btn.textContent : "";
    if (btn) { btn.disabled = true; btn.textContent = "Menyimpan…"; }
    showBusy("Menyimpan karya kamu…");
    try {
        const r = await apiPost({ action: "memberEditQuest", token: _profile.token, challengeId: q.id, photoBase64: photo.base64, photoMime: photo.mime, caption: caption });
        if (r.status !== "success") { if (btn) { btn.disabled = false; btn.textContent = orig; } alert(r.message || "Gagal."); return; }
        _questPhotos[q.id] = photo.dataUrl;
        _questCaptions[q.id] = caption;
        _galleryLoaded = false;
        if (typeof _qbRefresh === "function") _qbRefresh(); // sinkron halaman Quest Book
        playSfx("challenge-done");
        fireConfetti("quest");
        renderQuestAction(q, i);
    } catch (e) { if (btn) { btn.disabled = false; btn.textContent = orig; } alert("Gagal terhubung ke server."); }
    finally { hideBusy(); }
}

// ---------- Leaderboard pane ----------
let _lbLoaded = false;
let _lbData = null;      // { top, me, topEvents } — dipakai juga buat My Summary (wrapped)
async function loadLeaderboard() {
    if (_lbLoaded) return;
    _lbLoaded = true;
    const loading = $("lbLoading"), content = $("lbContent");
    loading.style.display = "none"; content.innerHTML = skeletonRank();
    let data = { top: [], me: null };
    try {
        data = await fetchJSONP(GS + "?page=leaderboard&wa=" + encodeURIComponent(_profile.wa), "lb", 20000);
    } catch (e) {
        loading.style.display = "none";
        _lbLoaded = false;
        renderError(content, loadLeaderboard);
        return;
    }
    loading.style.display = "none";
    _lbData = data;
    const top = (data && data.top) || [];
    const me = (data && data.me) || null;
    const topEvents = (data && data.topEvents) || [];
    if (!top.length && !topEvents.length) {
        content.innerHTML = '<div class="placeholder"><div class="em">🏆</div><h3>Belum ada peringkat</h3><p>Ikut challenge buat ngumpulin poin & masuk papan peringkat! ⚡</p></div>';
        return;
    }

    // ---- Board 1: Challenge Champions (biru) ----
    let chHtml;
    if (!top.length) {
        chHtml = '<div class="placeholder"><div class="em">⚡</div><h3>Belum ada poin challenge</h3><p>Ikut challenge buat masuk papan peringkat!</p></div>';
    } else {
        const top5 = top.slice(0, 5);
        let rows = "";
        top5.forEach(x => {
            const isMe = me && x.rank === me.rank && x.nickname === me.nickname;
            const pts = '<div class="rank-pts"><b>' + x.poin + '</b> pts</div>';
            if (x.rank === 1) {
                // Juara 1 = kartu stiker emas + crown
                rows += '<div class="rank-item top1' + (isMe ? ' me' : '') + '">' +
                    '<span class="rank-num gold">1</span>' +
                    '<div class="rank-info"><span class="rank-name">' + esc(x.nickname) + '</span>' +
                    '<span class="rank-tag">Top Crafter</span></div>' +
                    '<span class="rank-crown">👑</span>' + pts + '</div>';
            } else {
                const numCls = x.rank === 2 ? " silver" : (x.rank === 3 ? " bronze" : "");
                rows += '<div class="rank-item glass' + (isMe ? ' me' : '') + '">' +
                    '<span class="rank-num' + numCls + '">' + x.rank + '</span>' +
                    '<div class="rank-info"><span class="rank-name">' + esc(x.nickname) + '</span></div>' + pts + '</div>';
            }
        });
        const meBox = (me && me.rank > 5)
            ? '<div class="lb-me">Your rank: #' + me.rank + ' of ' + me.total + ' · ' + me.poin + ' pts ⚡</div>'
            : '';
        chHtml =
            '<div class="lb-card" id="lbCard">' +
            '<div class="lb-tape"></div>' +
            '<div class="lb-clip">📎</div>' +
            '<header class="lb-header">' +
            '<div class="lb-badge">LEADERBOARD</div>' +
            '<h2>Challenge Champions</h2>' +
            '<p>Points from journaling challenge ⚡</p>' +
            '</header>' +
            '<div class="lb-list">' + rows + '</div>' +
            meBox +
            '<div class="lb-foot">@seminggu_satu</div>' +
            '</div>' +
            '<button class="wrapped-btn" id="lbWrapped"><span class="wr-btn-tape"></span>🎁 My Summary ✨</button>' +
            '<button class="share-ig-btn" id="lbShare">' + ICON_CAMERA + ' Share to IG Story</button>';
    }

    // ---- Board 2: Top 5 Teman Jurnal (kuning dominan, aksen biru) ----
    let tjHtml;
    if (!topEvents.length) {
        tjHtml = '<div class="placeholder"><div class="em">💛</div><h3>Belum ada data</h3><p>Ikut event buat masuk Top 5 Teman Jurnal!</p></div>';
    } else {
        let tjRows = "";
        topEvents.forEach(x => {
            const cnt = '<div class="rank-pts"><b>' + x.events + '</b>×</div>';
            if (x.rank === 1) {
                tjRows += '<div class="rank-item tj1' + (x.me ? ' me' : '') + '">' +
                    '<span class="rank-num gold">1</span>' +
                    '<div class="rank-info"><span class="rank-name">' + esc(x.nickname) + '</span>' +
                    '<span class="rank-tag tj-tag">Paling Setia</span></div>' +
                    '<span class="rank-crown">👑</span>' + cnt + '</div>';
            } else {
                const numCls = x.rank === 2 ? " silver" : (x.rank === 3 ? " bronze" : "");
                tjRows += '<div class="rank-item tjrow' + (x.me ? ' me' : '') + '">' +
                    '<span class="rank-num' + numCls + '">' + x.rank + '</span>' +
                    '<div class="rank-info"><span class="rank-name">' + esc(x.nickname) + '</span></div>' + cnt + '</div>';
            }
        });
        tjHtml =
            '<div class="tj-card" id="tjCard">' +
            '<div class="lb-tape tj-tape"></div>' +
            '<div class="lb-clip">✂️</div>' +
            '<header class="lb-header tj-header">' +
            '<div class="lb-badge tj-badge">TOP 5</div>' +
            '<h2>Teman Jurnal</h2>' +
            '<p>Paling sering journaling bareng kita ✨</p>' +
            '</header>' +
            '<div class="lb-list">' + tjRows + '</div>' +
            '<div class="lb-foot tj-foot">@seminggu_satu</div>' +
            '</div>' +
            '<button class="share-ig-btn" id="tjShare">' + ICON_CAMERA + ' Share to IG Story</button>';
    }

    content.innerHTML =
        '<div class="lb-switch">' +
        '<button class="gchip active" data-board="ch">🏆 Challenge</button>' +
        '<button class="gchip" data-board="tj">💛 Teman Jurnal</button>' +
        '</div>' +
        '<div id="boardCh">' + chHtml + '</div>' +
        '<div id="boardTj" style="display:none;">' + tjHtml + '</div>';

    // Switch board (default: Challenge) -> cuma satu tombol share yang tampil
    content.querySelectorAll(".lb-switch .gchip").forEach(c => c.addEventListener("click", () => {
        content.querySelectorAll(".lb-switch .gchip").forEach(x => x.classList.remove("active"));
        c.classList.add("active");
        $("boardCh").style.display = (c.dataset.board === "ch") ? "" : "none";
        $("boardTj").style.display = (c.dataset.board === "tj") ? "" : "none";
    }));
    const shareBtn = $("lbShare");
    if (shareBtn) shareBtn.addEventListener("click", shareLeaderboard);
    const tjBtn = $("tjShare");
    if (tjBtn) tjBtn.addEventListener("click", shareTopJurnal);
    const wrBtn = $("lbWrapped");
    if (wrBtn) wrBtn.addEventListener("click", openWrapped);
}

async function shareTopJurnal() {
    const card = $("tjCard");
    const btn = $("tjShare");
    if (!card) return;
    const label = btn.innerHTML; // ada SVG di dalamnya
    btn.disabled = true; btn.textContent = "Preparing…";
    const clone = card.cloneNode(true);
    clone.classList.add("export");
    clone.style.width = "360px"; clone.style.height = "640px"; clone.style.maxWidth = "none";
    clone.style.position = "fixed"; clone.style.left = "-10000px"; clone.style.top = "0";
    document.body.appendChild(clone);
    try {
        const blob = await renderCardToBlob(clone, { width: 360, height: 640, windowWidth: 360, windowHeight: 640 });
        await shareOrDownloadImage(blob, "teman-jurnal-seminggu-satu.png",
            "Top 5 Teman Jurnal Seminggu Satu! 💛 @seminggu_satu",
            "Gambar Top 5 ke-download 📥 — upload ke IG Story ya!");
    } catch (e) {
        if (!(e && e.name === "AbortError")) alert("Gagal bikin gambar" + (e && e.message ? " (" + e.message + ")" : "") + ". Coba lagi ya.");
    } finally {
        if (clone.parentNode) clone.parentNode.removeChild(clone);
        btn.disabled = false; btn.innerHTML = label;
    }
}

// Render elemen -> PNG blob, anti-hang (guard html2canvas + timeout 15 dtk + cek blob null)
function renderCardToBlob(el, opts) {
    if (typeof html2canvas === "undefined") {
        return Promise.reject(new Error("html2canvas belum siap — cek koneksi internet"));
    }
    // html2canvas nge-clone SELURUH dokumen (termasuk semua foto galeri yg udah
    // ke-prefetch di pane lain) -> nge-load ulang semuanya & bikin timeout.
    // Solusi: skip elemen yang bukan ancestor/descendant target (head/style tetap ikut).
    const keep = (n) => n === el || n.contains(el) || el.contains(n) || !document.body.contains(n);
    const render = html2canvas(el, Object.assign({ scale: 3, backgroundColor: null, useCORS: true, ignoreElements: (n) => !keep(n) }, opts || {}))
        .then(canvas => new Promise((res, rej) => {
            try { canvas.toBlob(b => b ? res(b) : rej(new Error("gagal render gambar")), "image/png"); }
            catch (e) { rej(e); }
        }));
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("kelamaan (timeout)")), 15000));
    return Promise.race([render, timeout]);
}

async function shareOrDownloadImage(blob, filename, shareText, downloadNote) {
    const file = new File([blob], filename, { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: shareText });
    } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = filename; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        if (downloadNote) alert(downloadNote);
    }
}

async function shareLeaderboard() {
    const card = $("lbCard");
    const btn = $("lbShare");
    if (!card) return;
    const label = btn.innerHTML; // ada SVG di dalamnya
    btn.disabled = true; btn.textContent = "Preparing…";
    const clone = card.cloneNode(true);
    clone.classList.add("export");
    clone.style.width = "360px"; clone.style.height = "640px"; clone.style.maxWidth = "none";
    clone.style.position = "fixed"; clone.style.left = "-10000px"; clone.style.top = "0";
    document.body.appendChild(clone);
    try {
        const blob = await renderCardToBlob(clone, { width: 360, height: 640, windowWidth: 360, windowHeight: 640 });
        await shareOrDownloadImage(blob, "leaderboard-seminggu-satu.png",
            "Papan peringkat challenge Seminggu Satu! 🏆 @seminggu_satu",
            "Gambar leaderboard ke-download 📥 — upload ke IG Story ya!");
    } catch (e) {
        if (!(e && e.name === "AbortError")) alert("Gagal bikin gambar" + (e && e.message ? " (" + e.message + ")" : "") + ". Coba lagi ya.");
    } finally {
        if (clone.parentNode) clone.parentNode.removeChild(clone);
        btn.disabled = false; btn.innerHTML = label;
    }
}

// ---------- Loyalty pane ----------
// ---------- My Summary: "Journal Wrapped" ala Spotify, versi scrapbook ----------
// Slider fullscreen (scroll-snap) berisi perjalanan member: challenge, poin+rank,
// streak mingguan, event, ditutup outro. Data diambil dari state yg udah ke-load
// (leaderboard, quests, journalRecords, loyalty) — slide yg datanya nggak ada di-skip.
let _loyaltyStats = null; // { count, tier, tierEmoji } — diisi loadLoyalty

function wrappedData() {
    const me = (_lbData && _lbData.me) || null;
    const topEvents = (_lbData && _lbData.topEvents) || [];
    const evMe = topEvents.find ? topEvents.find(x => x.me) : null;
    const records = getJournalTrackerData(_profile.wa).records || {};
    const doneIds = _questSubmitted || [];
    const titles = (_questChallenges || []).filter(q => doneIds.indexOf(q.id) >= 0).map(q => q.title);
    const photos = doneIds.map(id => _questPhotos[id]).filter(Boolean).slice(0, 3);
    const evCount = _loyaltyStats ? _loyaltyStats.count : (evMe ? evMe.events : null);
    const p = persona(evCount || 0);
    return {
        nickname: _profile.nickname || "Sahabat",
        questDone: doneIds.length,
        questTotal: (_questChallenges || []).length,
        questTitles: titles,
        questPhotos: photos,
        poin: me ? me.poin : null,
        rank: me ? me.rank : null,
        rankTotal: me ? me.total : null,
        streak: calculateJournalStreak(records),
        checkins: Object.keys(records).length,
        events: evCount,
        tier: p.title,
        tierEmoji: p.emoji
    };
}

function buildWrappedSlides(d) {
    const slides = [];
    // 1) Cover
    slides.push('<div class="wr-slide wr-blue">' +
        '<span class="wr-tape" style="top:52px;left:20px;transform:rotate(-14deg);"></span>' +
        '<span class="wr-tape" style="bottom:76px;right:16px;transform:rotate(9deg);"></span>' +
        '<img class="wr-imgstk" src="../images/sticker/str-1.png" style="width:86px;top:9%;right:6%;transform:rotate(10deg);" alt="">' +
        '<img class="wr-imgstk" src="../images/sticker/str-5.png" style="width:76px;bottom:11%;left:5%;transform:rotate(-12deg);" alt="">' +
        '<span class="wr-stk" style="top:27%;left:13%;">🌟</span>' +
        '<div class="wr-anim wr-kicker">SEMINGGU SATU PRESENTS</div>' +
        '<div class="wr-anim wr-title wr-hero" style="--d:.08s;">My Journal<br>Wrapped ✨</div>' +
        '<div class="wr-anim wr-sub" style="--d:.16s;">Perjalanan journaling-mu bareng kita, ' + esc(d.nickname) + ' 💙</div>' +
        '<div class="wr-anim wr-hint" style="--d:.3s;">geser ke kiri buat mulai →</div>' +
        '</div>');
    // 2) Challenge quest
    let chips = "";
    d.questTitles.slice(0, 4).forEach(t => { chips += '<span class="wr-chip">' + esc(t) + '</span>'; });
    if (d.questTitles.length > 4) chips += '<span class="wr-chip">+' + (d.questTitles.length - 4) + ' lagi ✨</span>';
    let polas = "";
    d.questPhotos.forEach(ph => { polas += '<span class="wr-pola"><img src="' + esc(ph) + '" alt="" loading="lazy" decoding="async"></span>'; });
    slides.push('<div class="wr-slide wr-paper">' +
        '<span class="wr-tape" style="top:56px;right:22px;transform:rotate(12deg);"></span>' +
        '<span class="wr-stk" style="top:13%;left:10%;">🎯</span>' +
        '<img class="wr-imgstk" src="../images/sticker/str-2.png" style="width:84px;bottom:9%;right:5%;transform:rotate(9deg);" alt="">' +
        '<div class="wr-anim wr-kicker">CHALLENGE QUEST</div>' +
        '<div class="wr-anim wr-big" style="--d:.08s;">' + d.questDone + '</div>' +
        '<div class="wr-anim wr-title" style="--d:.14s;">challenge kamu selesain 🎯</div>' +
        (d.questTotal ? '<div class="wr-anim wr-sub" style="--d:.2s;">dari ' + d.questTotal + ' quest yang ada</div>' : '') +
        (chips ? '<div class="wr-anim wr-chips" style="--d:.26s;">' + chips + '</div>' : '') +
        (polas ? '<div class="wr-anim wr-polas" style="--d:.34s;">' + polas + '</div>'
            : (!d.questDone ? '<div class="wr-anim wr-sub" style="--d:.3s;">Belum ada quest — yuk mulai minggu ini! 🚀</div>' : '')) +
        '</div>');
    // 3) Poin + rank (cuma kalau ada di leaderboard)
    if (d.poin != null) {
        const top5 = d.rank && d.rank <= 5;
        const beat = (d.rank && d.rankTotal) ? Math.round(((d.rankTotal - d.rank) / d.rankTotal) * 100) : null;
        slides.push('<div class="wr-slide wr-yellow">' +
            '<span class="wr-tape b" style="top:54px;left:20px;transform:rotate(-10deg);"></span>' +
            '<span class="wr-stk" style="top:16%;right:12%;">⚡</span>' +
            '<img class="wr-imgstk" src="../images/sticker/str-4.png" style="width:72px;bottom:12%;left:6%;transform:rotate(-10deg);" alt="">' +
            '<div class="wr-anim wr-kicker">POIN CHALLENGE</div>' +
            '<div class="wr-anim wr-big" style="--d:.08s;">' + d.poin + '</div>' +
            '<div class="wr-anim wr-title" style="--d:.14s;">poin terkumpul ⚡</div>' +
            (d.rank ? '<div class="wr-anim wr-rankbox" style="--d:.22s;">Peringkat <b>#' + d.rank + '</b> dari ' + d.rankTotal + ' sahabat</div>' : '') +
            (top5 ? '<div class="wr-anim wr-stamp5" style="--d:.3s;">TOP 5! 👑</div>'
                : (beat ? '<div class="wr-anim wr-sub" style="--d:.3s;">Kamu ngalahin ' + beat + '% sahabat lain 🔥</div>' : '')) +
            '</div>');
    }
    // 4) Streak mingguan
    let stamps = "";
    const on = Math.min(d.checkins, 8);
    for (let i = 0; i < 8; i++) stamps += '<span class="wr-stamp' + (i < on ? " on" : "") + '">' + (i < on ? "✓" : "") + '</span>';
    slides.push('<div class="wr-slide wr-paper">' +
        '<span class="wr-tape" style="top:58px;left:24px;transform:rotate(-12deg);"></span>' +
        '<span class="wr-stk" style="top:14%;right:10%;">🔥</span>' +
        '<img class="wr-imgstk" src="../images/sticker/str-6.png" style="width:86px;bottom:9%;left:5%;transform:rotate(-7deg);" alt="">' +
        '<div class="wr-anim wr-kicker">WEEKLY JOURNAL</div>' +
        '<div class="wr-anim wr-big" style="--d:.08s;">' + d.streak + '</div>' +
        '<div class="wr-anim wr-title" style="--d:.14s;">minggu streak beruntun 🔥</div>' +
        '<div class="wr-anim wr-sub" style="--d:.2s;">' + d.checkins + ' minggu journaling tercatat 💪</div>' +
        '<div class="wr-anim wr-stamps" style="--d:.28s;">' + stamps + '</div>' +
        '</div>');
    // 5) Event (cuma kalau datanya ada)
    if (d.events != null) {
        slides.push('<div class="wr-slide wr-pink">' +
            '<span class="wr-tape" style="top:54px;right:24px;transform:rotate(10deg);"></span>' +
            '<span class="wr-stk" style="top:15%;left:11%;">🎪</span>' +
            '<img class="wr-imgstk" src="../images/sticker/str-3.png" style="width:80px;bottom:10%;right:5%;transform:rotate(8deg);" alt="">' +
            '<div class="wr-anim wr-kicker">EVENT JOURNALING</div>' +
            '<div class="wr-anim wr-big" style="--d:.08s;">' + d.events + '</div>' +
            '<div class="wr-anim wr-title" style="--d:.14s;">event kamu datengin 🎪</div>' +
            '<div class="wr-anim wr-tier" style="--d:.24s;">' + d.tierEmoji + ' ' + esc(d.tier) + '</div>' +
            '</div>');
    }
    // 6) Outro
    slides.push('<div class="wr-slide wr-blue">' +
        '<span class="wr-tape" style="top:58px;right:22px;transform:rotate(8deg);"></span>' +
        '<span class="wr-stk" style="top:16%;left:12%;">💌</span>' +
        '<img class="wr-imgstk" src="../images/sticker/str-7.png" style="width:88px;bottom:16%;right:6%;transform:rotate(8deg);" alt="">' +
        '<span class="wr-stk" style="top:24%;right:16%;">🌈</span>' +
        '<div class="wr-anim wr-title wr-hero">Keep journaling,<br>' + esc(d.nickname) + '! 💙</div>' +
        '<div class="wr-anim wr-sub" style="--d:.12s;">Cerita kecil tiap minggu bakal jadi kenangan besar. Sampai jumpa di challenge berikutnya! ✨</div>' +
        '<div class="wr-anim wr-foot" style="--d:.22s;">@seminggu_satu</div>' +
        '</div>');
    return slides;
}

function openWrapped() {
    showWrapped(buildWrappedSlides(wrappedData()), {
        filename: "my-summary-seminggu-satu.png",
        text: "My Journal Wrapped ✨ @seminggu_satu"
    });
}

// Musik latar wrapped: auto-play pas Summary/Passport dibuka (lolos kebijakan
// autoplay karena dipicu klik tombol), loop, berhenti pas ditutup.
// Lazy: file mp3 baru di-download pas pertama kali wrapped dibuka.
let _wrAudio = null;
function wrappedMusicPlay() {
    if (sndMuted()) return;
    try {
        if (!_wrAudio) {
            _wrAudio = new Audio("../bg-music-2.mp3");
            _wrAudio.loop = true;
            _wrAudio.volume = 0.55;
        }
        _wrAudio.currentTime = 0;
        _wrAudio.play().catch(() => { }); // kalau browser nolak, ya udah tanpa musik
    } catch (e) { }
}
function wrappedMusicStop() {
    if (_wrAudio) { try { _wrAudio.pause(); } catch (e) { } }
}

// Engine slider wrapped (dipakai My Summary & Passport): scroll-snap + dots +
// auto-next + tombol share IG per slide.
function showWrapped(slides, shareMeta) {
    let modal = $("wrappedModal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "wrappedModal";
        modal.className = "wrapped-modal";
        document.body.appendChild(modal);
        modal.addEventListener("click", (e) => { if (e.target === modal) closeWrapped(); }); // klik backdrop (layar gede) = tutup
    }
    // selipin tombol share di akhir tiap slide
    const SHARE_BTN = '<button class="wr-share wr-anim" style="--d:.45s;" data-wrshare title="Share to IG Story">📸 Share</button>';
    slides = slides.map(s => s.replace(/<\/div>$/, SHARE_BTN + "</div>"));
    let dots = "";
    slides.forEach(() => { dots += '<span class="wr-dot"><i></i></span>'; });
    // .wr-phone: di HP = fullscreen, di layar gede = frame seukuran HP di tengah (kayak story)
    modal.innerHTML =
        '<div class="wr-phone">' +
        '<div class="wr-top"><div class="wr-dots">' + dots + '</div><button class="wr-close" id="wrClose" aria-label="Tutup">✕</button></div>' +
        '<div class="wr-track" id="wrTrack">' + slides.join("") + '</div>' +
        '<button class="wr-zone left" id="wrPrev" aria-label="Sebelumnya"></button>' +
        '<button class="wr-zone right" id="wrNext" aria-label="Lanjut"></button>' +
        '</div>';
    modal.classList.add("show");
    lockScroll();
    wrappedMusicPlay();
    const track = $("wrTrack");
    const slideEls = track.querySelectorAll(".wr-slide");
    const dotEls = modal.querySelectorAll(".wr-dot");
    const WR_MS = 5000; // auto-next per slide; pause selama disentuh, stop di slide terakhir
    let cur = -1, burst = false;
    function arm() {
        clearTimeout(modal._wrTimer);
        if (cur < slideEls.length - 1) {
            modal._wrTimer = setTimeout(() => track.scrollBy({ left: track.clientWidth, behavior: "smooth" }), WR_MS);
        }
    }
    // bar aktif keisi 0->100% sinkron sama timer (kayak story); yang lewat full, sisanya kosong
    function armAnim() {
        dotEls.forEach((dt, k) => {
            dt.classList.remove("run", "hold");
            dt.classList.toggle("on", k < cur);
        });
        const cd = dotEls[cur];
        if (!cd) return;
        if (cur < slideEls.length - 1) { void cd.offsetWidth; cd.classList.add("run"); } // reflow = restart animasi dari 0
        else cd.classList.add("on"); // slide terakhir nggak auto-next -> bar langsung penuh
    }
    function setLive() {
        const i = Math.max(0, Math.min(slideEls.length - 1, Math.round(track.scrollLeft / track.clientWidth)));
        if (i === cur) return;
        cur = i;
        slideEls.forEach((s, k) => s.classList.toggle("live", k === i));
        if (i === slideEls.length - 1 && !burst) { burst = true; fireConfetti("reward"); }
        arm();
        armAnim();
    }
    setLive();
    track.addEventListener("scroll", setLive, { passive: true });
    track.addEventListener("touchstart", () => {
        clearTimeout(modal._wrTimer);
        const cd = dotEls[cur];
        if (cd) cd.classList.add("hold"); // disentuh = timer pause, bar ikut berhenti
    }, { passive: true });
    track.addEventListener("touchend", () => { arm(); armAnim(); }, { passive: true }); // lepas = mulai ulang 5 dtk penuh
    $("wrClose").addEventListener("click", closeWrapped);
    $("wrPrev").addEventListener("click", () => track.scrollBy({ left: -track.clientWidth, behavior: "smooth" }));
    $("wrNext").addEventListener("click", () => track.scrollBy({ left: track.clientWidth, behavior: "smooth" }));
    modal.querySelectorAll("[data-wrshare]").forEach((b, i) =>
        b.addEventListener("click", () => {
            const cd = dotEls[cur];
            if (cd) cd.classList.add("hold"); // auto-next mati pas share -> bar ikut berhenti
            shareWrappedSlide(slideEls[i], i, shareMeta || {});
        }));
}

// Share satu slide wrapped -> PNG 1080x1920 (clone 360x640 di-render scale 3)
async function shareWrappedSlide(slideEl, idx, meta) {
    const modal = $("wrappedModal");
    if (modal) clearTimeout(modal._wrTimer); // jangan auto-next pas lagi nge-share
    showBusy("Menyiapkan gambar…");
    const clone = slideEl.cloneNode(true);
    clone.classList.add("export", "live");
    clone.style.position = "fixed"; clone.style.left = "-10000px"; clone.style.top = "0";
    document.body.appendChild(clone);
    try {
        const blob = await renderCardToBlob(clone, { width: 360, height: 640, windowWidth: 360, windowHeight: 640 });
        const fname = String(meta.filename || "wrapped-seminggu-satu.png").replace(".png", "-" + (idx + 1) + ".png");
        await shareOrDownloadImage(blob, fname,
            meta.text || "Journal Wrapped ✨ @seminggu_satu",
            "Gambar ke-download 📥 — upload ke IG Story ya!");
    } catch (e) {
        if (!(e && e.name === "AbortError")) alert("Gagal bikin gambar" + (e && e.message ? " (" + e.message + ")" : "") + ". Coba lagi ya.");
    } finally {
        if (clone.parentNode) clone.parentNode.removeChild(clone);
        hideBusy();
    }
}

function closeWrapped() {
    const modal = $("wrappedModal");
    if (modal) {
        clearTimeout(modal._wrTimer);
        modal.classList.remove("show");
    }
    wrappedMusicStop();
    unlockScroll();
}

// ---------- Passport Wrapped (pengganti halaman /loyalty dari Member Hub) ----------
// ---------- Paspor Warga: buku paspor beneran — cover, identitas, visa stamp per event ----------
function openPassport() {
    if (!_loyaltyStats) return; // tombolnya cuma ada setelah loadLoyalty sukses
    let modal = $("pspModal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "pspModal";
        modal.className = "psp-modal";
        document.body.appendChild(modal);
        modal.addEventListener("click", (e) => { if (e.target === modal) closePassport(); });
    }
    modal.innerHTML =
        '<button class="psp-close" id="pspClose" aria-label="Tutup">✕</button>' +
        '<div class="psp-stage" id="pspStage"></div>';
    modal.classList.add("show");
    lockScroll();
    wrappedMusicPlay(); // musik latar sama kayak wrapped (dipicu klik -> lolos autoplay)
    $("pspClose").addEventListener("click", closePassport);
    // lebar stage dikunci ke px GENAP: 92vw bisa pecahan -> muka buku (50%) duduk
    // di setengah pixel dan teks/stiker cover kena resample (blur)
    const stg = $("pspStage");
    let sw = Math.min(Math.round(window.innerWidth * 0.92), 400);
    if (sw % 2) sw--;
    stg.style.width = sw + "px";
    renderPassportBook(stg);
}

function closePassport() {
    const m = $("pspModal");
    if (m) m.classList.remove("show");
    wrappedMusicStop();
    unlockScroll();
}

// Muka depan cover (jadi "leaf" pas buku tertutup; baliknya = halaman dalam cover)
function pspCoverFaceHtml() {
    return '<div class="psp-cvface">' +
        '<span class="psp-emblem">SS</span>' +
        '<span class="psp-cover-t">PASSPORT</span>' +
        '<span class="psp-cover-s">BALAI WARGA · SEMINGGU SATU</span>' +
        '<img class="psp-cover-stk" src="../images/sticker/str-6.png" alt="">' +
        '<span class="psp-cover-hint">ketuk buat buka 📖</span>' +
        '</div>';
}

function pspWhen(e) {
    return e.eventDate ? fmtEventDate(e.eventDate) : (e.label || e.date || "");
}

// Halaman identitas ala ID card: foto, data diri bergaris titik, ttd, stempel hijau
function pspIdentityHtml() {
    const s = _loyaltyStats;
    const photo = _profile.photoUrl
        ? '<img src="' + esc(_profile.photoUrl) + '" alt="">'
        : '<span class="psp-photo-init">' + esc((_profile.nickname || "S").charAt(0).toUpperCase()) + '</span>';
    const bd = (String(_profile.birthDate || "").match(/\d{4}-\d{2}-\d{2}/) || [""])[0];
    const noPsp = formatCardNumber(_profile.wa).replace(/\s*·\s*/g, "-");
    return '<div class="psp-in">' +
        '<div class="psp-kicker">★ IDENTITAS WARGA ★</div>' +
        '<div class="psp-photo">' + photo + '</div>' +
        '<div class="psp-photo-cap">authorized journaler</div>' +
        '<div class="psp-row"><span>Issued to</span><b>' + esc(_profile.nickname || "Sahabat") + '</b></div>' +
        '<div class="psp-row"><span>No. paspor</span><b>' + esc(noPsp) + '</b></div>' +
        (bd ? '<div class="psp-row"><span>Date of birth</span><b>' + esc(fmtEventDate(bd)) + '</b></div>' : '') +
        (s.since ? '<div class="psp-row"><span>Warga sejak</span><b>' + s.since + '</b></div>' : '') +
        '<div class="psp-row"><span>Tier</span><b>' + s.tierEmoji + ' ' + esc(s.tier) + '</b></div>' +
        (_profile.bio ? '<div class="psp-bio">"' + esc(_profile.bio) + '"</div>' : '') +
        '<div class="psp-sign">' + esc(_profile.nickname || "Sahabat") + ' ♡</div>' +
        '<div class="psp-photo-cap">signature of authorized journaler</div>' +
        '<span class="psp-ok">WARGA AKTIF ✓</span>' +
        '</div>';
}

// Lembar kosong ber-watermark — jadi balik cover & halaman kiri pertama.
// Sengaja kosong: kalau ada konten, pas animasi buka keliatan dobel sama
// muka belakang leaf yang lagi muter.
function pspBlankPageHtml() {
    return '<div class="psp-in psp-blank"><span class="psp-wm">SS</span></div>';
}

// Halaman visa: max 3 stempel imigrasi per halaman, tinta & kemiringan selang-seling.
// Tiap halaman dapet 2 stiker tempelan (deterministik dari nomor halaman, biar
// nggak acak tiap render) + emoji kecil biar kerasa scrapbook.
const PSP_STK = [
    ['<img class="psp-vstk" src="../images/sticker/str-1.png" style="bottom:10px;right:6px;width:46px;transform:rotate(10deg);" alt="">',
     '<span class="psp-vemo" style="top:34px;left:6px;transform:rotate(-12deg);">✨</span>'],
    ['<img class="psp-vstk" src="../images/sticker/str-2.png" style="bottom:12px;left:6px;width:44px;transform:rotate(-9deg);" alt="">',
     '<span class="psp-vemo" style="top:38px;right:8px;transform:rotate(10deg);">🌈</span>'],
    ['<img class="psp-vstk" src="../images/sticker/str-4.png" style="bottom:10px;right:8px;width:44px;transform:rotate(8deg);" alt="">',
     '<span class="psp-vemo" style="top:36px;left:8px;transform:rotate(-8deg);">🌱</span>'],
    ['<img class="psp-vstk" src="../images/sticker/str-7.png" style="bottom:12px;left:8px;width:46px;transform:rotate(-7deg);" alt="">',
     '<span class="psp-vemo" style="top:34px;right:6px;transform:rotate(12deg);">💌</span>'],
    ['<img class="psp-vstk" src="../images/sticker/str-11.png" style="bottom:10px;right:6px;width:44px;transform:rotate(9deg);" alt="">',
     '<span class="psp-vemo" style="top:38px;left:6px;transform:rotate(-10deg);">🎈</span>']
];

function pspVisaPageHtml(evs, start, pageNo) {
    const chunk = evs.slice(start, start + 3);
    const stk = PSP_STK[(pageNo - 1) % PSP_STK.length].join("");
    let inner = '<div class="psp-kicker">VISA & STEMPEL · HAL. ' + pageNo + '</div>';
    if (!chunk.length) {
        inner += '<div class="psp-vempty">🎪<br>Halaman ini nunggu<br>stempel event berikutnya…</div>';
    } else {
        chunk.forEach((e, i) => {
            const n = start + i;
            const when = pspWhen(e);
            inner += '<div class="psp-vstamp ink' + (n % 3) + (n % 2 ? " r" : "") + '">' +
                '<span class="pv-top">SEMINGGU SATU ★ ADMITTED</span>' +
                '<b class="pv-name">' + esc(e.name) + '</b>' +
                (when ? '<span class="pv-date">' + esc(when) + '</span>' : '') +
                '</div>';
        });
    }
    return '<div class="psp-in">' + inner + stk + '</div>';
}

function pspLoyaltyPageHtml() {
    const s = _loyaltyStats;
    let dots = "";
    for (let i = 0; i < s.target; i++) dots += '<span class="psp-loy-dot' + (i < s.progress ? " on" : "") + '">' + (i < s.progress ? "★" : "") + '</span>';
    const toGo = Math.max(0, s.target - s.progress);
    return '<div class="psp-in">' +
        '<div class="psp-kicker">KUPON HADIAH</div>' +
        '<div class="psp-loy-dots">' + dots + '</div>' +
        (s.eligible
            ? '<div class="psp-vempty" style="color:#0a7a3d;">🎉 Hadiah gratis siap diklaim!<br>Tunjukkin ke admin ya.</div>'
            : '<div class="psp-vempty">' + (toGo && s.progress ? '<b>' + toGo + ' event lagi</b><br>menuju hadiah gratis 🎁' : 'Yuk mulai kumpulin<br>stempel hadiah! 🎁') + '</div>') +
        '</div>';
}

function pspOutroHtml() {
    const s = _loyaltyStats;
    return '<div class="psp-in psp-incover">' +
        '<div class="psp-ic-t">KEEP<br>EXPLORING 🌍</div>' +
        '<div class="psp-ic-note">' + s.count + ' event · ' + s.uniqueWs + ' jenis petualangan.<br>Trait kamu: <b>' + esc(s.trait) + '</b> ✨</div>' +
        '<img class="psp-ic-stk" src="../images/sticker/str-7.png" alt="">' +
        '<div class="psp-ic-foot">@seminggu_satu</div>' +
        '</div>';
}

// Susunan spread: [dalam cover | identitas] -> halaman visa berpasangan -> [kupon | outro]
function pspSpreads() {
    const evs = (_loyaltyStats.events || []).slice();
    const tv = e => { const m = String(e.eventDate || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? Number(m[1] + m[2] + m[3]) : 0; };
    evs.sort((a, b) => tv(a) - tv(b));
    const spreads = [[pspBlankPageHtml(), pspIdentityHtml()]];
    const nPages = Math.max(1, Math.ceil(evs.length / 3));
    for (let pg = 0; pg < nPages; pg += 2) {
        spreads.push([pspVisaPageHtml(evs, pg * 3, pg + 1), pspVisaPageHtml(evs, (pg + 1) * 3, pg + 2)]);
    }
    spreads.push([pspLoyaltyPageHtml(), pspOutroHtml()]);
    return spreads;
}

// Mesin flip = kembaran Quest Book: perspektif PERMANEN (tapi diisolasi di kotak
// leaf sendiri, jadi halaman statis & cover tetap tajam), tanpa bongkar-pasang
// konteks 3D antar flip (biang "nyangkut" di iOS), muka leaf tanpa bayangan gede
// (biang "shadow nyapu kanan-kiri"), dan penyelesaian flip via transitionend
// (nggak ada jendela ghost di akhir putaran).
function renderPassportBook(host) {
    const SP = pspSpreads();
    let cur = 0;
    host.innerHTML =
        '<div class="psp-book" id="pspBook">' +
        '<div class="psp-page psp-left" id="pspLeft"></div>' +
        '<div class="psp-page psp-right" id="pspRight"></div>' +
        '<div class="psp-leafbox"><div class="psp-leaf" id="pspLeaf"><div class="psp-face psp-front" id="pspFront"></div><div class="psp-face psp-back" id="pspBack"></div></div></div>' +
        '<button type="button" class="psp-cover-static" id="pspCoverBtn">' + pspCoverFaceHtml() + '</button>' +
        '</div>' +
        '<div class="qbook-nav" id="pspNav" style="visibility:hidden;">' +
        '<button class="qb-arrow" id="pspPrev" aria-label="Halaman sebelumnya">‹</button>' +
        '<div class="qb-count" id="pspCount"></div>' +
        '<button class="qb-arrow" id="pspNext" aria-label="Halaman berikutnya">›</button>' +
        '</div>';
    const book = $("pspBook"), leftP = $("pspLeft"), rightP = $("pspRight");
    const leaf = $("pspLeaf"), front = $("pspFront"), back = $("pspBack");
    const coverBtn = $("pspCoverBtn");
    let anim = false;

    function setPages(i) {
        cur = i;
        leftP.innerHTML = SP[i][0];
        rightP.innerHTML = SP[i][1];
        $("pspCount").textContent = (i + 1) + " / " + SP.length;
        $("pspPrev").style.opacity = i === 0 ? ".35" : "1";
        $("pspNext").style.opacity = i === SP.length - 1 ? ".35" : "1";
    }
    function setLeaf(deg, animate) {
        leaf.style.transition = animate ? "transform .65s cubic-bezier(.35,.1,.25,1)" : "none";
        leaf.style.transform = "rotateY(" + deg + "deg)";
    }
    function showLeaf() { leaf.style.opacity = "1"; }
    function hideLeaf() { leaf.style.opacity = "0"; }
    // selesai TEPAT di akhir transisi (transitionend) -> nggak ada jeda leaf nganggur
    // di 180° yang bisa bocorin muka lamanya; timeout cuma jaring pengaman
    function finishOnce(ms, fn) {
        let done = false;
        const go = () => {
            if (done) return;
            done = true;
            leaf.removeEventListener("transitionend", go);
            fn();
        };
        leaf.addEventListener("transitionend", go);
        setTimeout(go, ms);
    }

    function flip(dir) {
        if (anim) return;
        const j = cur + dir;
        if (j < 0 || j >= SP.length) {
            book.classList.add("nudge");
            setTimeout(() => book.classList.remove("nudge"), 320);
            return;
        }
        anim = true;
        playSfx("flip", 0.7);
        // Muka leaf yang nampilin halaman SEKARANG diisi lewat ADOPSI node (bukan
        // rebuild innerHTML) — rebuild maksa <img> stiker decode ulang = kedip.
        if (dir === 1) {
            front.innerHTML = "";
            while (rightP.firstChild) front.appendChild(rightP.firstChild);
            back.innerHTML = SP[j][0];
            rightP.innerHTML = SP[j][1];
        } else {
            back.innerHTML = "";
            while (leftP.firstChild) back.appendChild(leftP.firstChild);
            front.innerHTML = SP[j][1];
            leftP.innerHTML = SP[j][0];
        }
        setLeaf(dir === 1 ? 0 : -180, false);
        showLeaf();
        void leaf.offsetWidth;
        requestAnimationFrame(() => requestAnimationFrame(() => {
            setLeaf(dir === 1 ? -180 : 0, true);
            finishOnce(720, () => {
                cur = j;
                const srcFace = dir === 1 ? back : front;
                const target = dir === 1 ? leftP : rightP;
                target.innerHTML = "";
                while (srcFace.firstChild) target.appendChild(srcFace.firstChild);
                $("pspCount").textContent = (j + 1) + " / " + SP.length;
                $("pspPrev").style.opacity = j === 0 ? ".35" : "1";
                $("pspNext").style.opacity = j === SP.length - 1 ? ".35" : "1";
                hideLeaf();
                anim = false;
            });
        }));
    }
    setPages(0);

    // ---- keadaan awal: buku TERTUTUP ----
    // Cover yang keliatan = elemen STATIS (di luar kotak perspektif -> tajam).
    // Leaf udah dipersiapin diam-diam (muka depan = kembaran cover, belakang =
    // lembar kosong) tapi transparan; pas diketuk tinggal tukeran satu frame.
    anim = true;
    front.innerHTML = pspCoverFaceHtml();
    back.innerHTML = SP[0][0];
    leftP.style.visibility = "hidden";
    hideLeaf();
    book.style.transition = "none";
    book.style.transform = "translateX(-" + Math.round(book.offsetWidth / 4) + "px)";
    void book.offsetWidth;
    book.style.transition = "";
    let opened = false;
    function openBook() {
        if (opened) return;
        opened = true;
        playSfx("flip", 0.7);
        leftP.style.visibility = "";
        setLeaf(0, false);
        showLeaf();
        coverBtn.style.display = "none"; // leaf kembarannya gantiin di frame yang sama
        void leaf.offsetWidth;
        requestAnimationFrame(() => requestAnimationFrame(() => {
            book.style.transform = "translateX(0)"; // geser ke posisi spread (transisi CSS)
            leaf.style.transition = "transform .9s cubic-bezier(.3,.1,.25,1)";
            leaf.style.transform = "rotateY(-180deg)";
            finishOnce(950, () => {
                // adopsi node: muka belakang leaf (lembar kosong) -> halaman kiri statis
                leftP.innerHTML = "";
                while (back.firstChild) leftP.appendChild(back.firstChild);
                hideLeaf();
                $("pspNav").style.visibility = "";
                anim = false;
            });
        }));
    }
    coverBtn.addEventListener("click", openBook);

    $("pspPrev").addEventListener("click", () => flip(-1));
    $("pspNext").addEventListener("click", () => flip(1));
    let sx = 0, sy = 0;
    book.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    book.addEventListener("touchend", (e) => {
        const t = e.changedTouches[0];
        const dx = t.clientX - sx, dy = t.clientY - sy;
        if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy)) flip(dx < 0 ? 1 : -1);
    }, { passive: true });
}

function persona(count) {
    let title, tag, emoji;
    if (count >= 10) { title = "DEWA JOURNALING"; tag = "Warga kehormatan Seminggu Satu 👑"; emoji = "👑"; }
    else if (count >= 6) { title = "LEGENDA JOURNALING"; tag = "Sahabat setia Seminggu Satu 🎁"; emoji = "🏆"; }
    else if (count >= 4) { title = "JOURNALING ENTHUSIAST"; tag = "Anak tongkrongan Seminggu Satu 🔥"; emoji = "🔥"; }
    else if (count >= 2) { title = "PETUALANG KREATIF"; tag = "Mulai betah kumpul bareng kita ✨"; emoji = "✨"; }
    else { title = "PENDATANG BARU"; tag = "Baru gabung keluarga Seminggu Satu 🌱"; emoji = "🌱"; }
    return { title, tag, emoji };
}

// Nomor kartu = hash dari WA, BUKAN nomor WA-nya (privat, jangan dipajang).
// Deterministik: warga yang sama selalu dapet nomor yang sama.
function formatCardNumber(wa) {
    const raw = String(wa || "").replace(/\D/g, "");
    if (!raw) return "SS · 2026 · 0000 · 8888";
    const seg = seed => {
        let h = seed;
        for (let i = 0; i < raw.length; i++) { h = (h * 31 + raw.charCodeAt(i)) >>> 0; }
        return String(h % 10000).padStart(4, "0");
    };
    return "SS · " + seg(7) + " · " + seg(1337) + " · " + seg(2026);
}

function init3DCardListeners() {
    const wrap = $("memberCardWrap");
    const card = $("memberCard3D");
    if (!wrap || !card) return;

    let isFlipped = false;

    // reset kilau ke kondisi awal (dipanggil saat flip biar warna kartu balik normal)
    function resetShine() {
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
        card.style.setProperty("--shine-x", "50%");
        card.style.setProperty("--shine-y", "50%");
        card.style.setProperty("--shine-opacity", "0.25");
    }

    wrap.addEventListener("click", () => {
        isFlipped = !isFlipped;
        playSfx("flip", 0.7);
        card.style.transform = ""; // buang tilt inline biar flip (class) nggak konflik
        resetShine();              // jangan bawa sisa kilau dari posisi sebelumnya
        card.classList.toggle("is-flipped", isFlipped);
    });

    wrap.addEventListener("mousemove", (e) => {
        if (isFlipped) return;
        const rect = wrap.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const percentX = (x / rect.width) * 100;
        const percentY = (y / rect.height) * 100;

        const rotX = -((y - centerY) / centerY) * 14;
        const rotY = ((x - centerX) / centerX) * 14;

        card.style.transform = "rotateX(" + rotX.toFixed(2) + "deg) rotateY(" + rotY.toFixed(2) + "deg)";
        card.style.setProperty("--rx", rotX.toFixed(2) + "deg");
        card.style.setProperty("--ry", rotY.toFixed(2) + "deg");
        card.style.setProperty("--shine-x", percentX.toFixed(1) + "%");
        card.style.setProperty("--shine-y", percentY.toFixed(1) + "%");
        card.style.setProperty("--shine-opacity", "0.4");
    });

    wrap.addEventListener("mouseleave", () => {
        if (isFlipped) return;
        card.style.transform = "rotateX(0deg) rotateY(0deg)";
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
        card.style.setProperty("--shine-x", "50%");
        card.style.setProperty("--shine-y", "50%");
        card.style.setProperty("--shine-opacity", "0.25");
    });

    if (window.DeviceOrientationEvent) {
        window.addEventListener("deviceorientation", (e) => {
            if (isFlipped) return;
            const gamma = e.gamma;
            const beta = e.beta;
            if (gamma == null || beta == null) return;

            const rotY = Math.max(-18, Math.min(18, gamma / 2.5));
            const rotX = Math.max(-18, Math.min(18, (beta - 45) / 2.5));

            const shineX = Math.max(10, Math.min(90, 50 + gamma * 1.2));
            const shineY = Math.max(10, Math.min(90, 50 + (beta - 45) * 1.2));

            card.style.transform = "rotateX(" + rotX.toFixed(2) + "deg) rotateY(" + rotY.toFixed(2) + "deg)";
            card.style.setProperty("--rx", rotX.toFixed(2) + "deg");
            card.style.setProperty("--ry", rotY.toFixed(2) + "deg");
            card.style.setProperty("--shine-x", shineX.toFixed(1) + "%");
            card.style.setProperty("--shine-y", shineY.toFixed(1) + "%");
            card.style.setProperty("--shine-opacity", "0.4");
        }, true);
    }
}

// ---------- Tracker Journaling Mingguan (Monthly 4-Week Grid) ----------
const MONTH_NAMES_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function getMonthWeekObj(d) {
    const date = d ? new Date(d) : new Date();
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    let weekNo = Math.min(4, Math.ceil(day / 7));
    const monthStr = String(month + 1).padStart(2, "0");
    return {
        year: year,
        month: month,
        monthName: MONTH_NAMES_EN[month],
        week: weekNo,
        key: year + "-" + monthStr + "-W" + weekNo
    };
}

// Tracker disimpan di server (sheet members, per WA) -> ngikut lintas device/browser.
// Data records ada di _profile.journalRecords (dikirim server saat login/session).
function getJournalTrackerData(wa) {
    try {
        const raw = (_profile && _profile.journalRecords) ? _profile.journalRecords : "{}";
        const parsed = JSON.parse(raw);
        return { records: (parsed && typeof parsed === "object") ? parsed : {} };
    } catch (e) { return { records: {} }; }
}

function calculateJournalStreak(records) {
    let streak = 0;
    const now = new Date();
    let checkDate = new Date(now);

    let currWeek = getMonthWeekObj(checkDate);
    if (records[currWeek.key]) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 7);
    } else {
        checkDate.setDate(checkDate.getDate() - 7);
        const lastWeek = getMonthWeekObj(checkDate);
        if (!records[lastWeek.key]) return 0;
    }

    for (let i = 0; i < 52; i++) {
        const wObj = getMonthWeekObj(checkDate);
        if (records[wObj.key]) {
            if (wObj.key !== currWeek.key) streak++;
            checkDate.setDate(checkDate.getDate() - 7);
        } else {
            break;
        }
    }
    return streak;
}

function renderJournalTrackerHtml(wa) {
    const data = getJournalTrackerData(wa);
    const records = data.records || {};
    const currMonthWeek = getMonthWeekObj(new Date());
    const currentWeekNum = currMonthWeek.week;
    const isCurrentChecked = !!records[currMonthWeek.key];
    const streak = calculateJournalStreak(records);

    const year = currMonthWeek.year;
    const monthStr = String(currMonthWeek.month + 1).padStart(2, "0");

    // Ikon SVG (stamp & pensil) -> ga pake emoji OS biar clean
    const SVG_CHECK = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    const SVG_PENCIL = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>';

    let gridHtml = "";
    for (let w = 1; w <= 4; w++) {
        const key = year + "-" + monthStr + "-W" + w;
        const isDone = !!records[key];
        const isCurrent = (w === currentWeekNum);
        const isPastUntracked = (w < currentWeekNum && !isDone);

        let boxClass = "jt-week-box";
        let statusHtml = '<span class="jt-week-status empty">—</span>';
        let labelText = "Week " + w;

        if (isDone) {
            boxClass += " done";
            statusHtml = '<span class="jt-stamp">' + SVG_CHECK + '</span>';
        } else if (isCurrent) {
            boxClass += " current";
            statusHtml = '<span class="jt-pencil">' + SVG_PENCIL + '</span>';
            labelText = "This Week";
        } else if (isPastUntracked) {
            boxClass += " neutral";
        }

        gridHtml +=
            '<div class="' + boxClass + '">' +
            '<span class="jt-week-label">' + esc(labelText) + '</span>' +
            statusHtml +
            '</div>';
    }

    // udah check-in -> nggak perlu banner apa-apa, kartu "Minggu Ini" di atas udah ngabarin
    let actionBtnHtml = "";
    if (!isCurrentChecked) {
        actionBtnHtml = '<button type="button" class="jt-action-btn" id="jtCheckInBtn">' + SVG_PENCIL + ' Check In This Week (+1 Streak)</button>';
    }

    const currRec = records[currMonthWeek.key] || {};
    const currentNote = currRec.note || "";
    // Ada foto -> foto + note digabung jadi SATU polaroid ditempel (note = caption
    // tulisan tangan di bawah foto). Note doang tanpa foto -> tag note lama.
    const noteHtml = (currentNote && !currRec.photo) ? '<div class="jt-note-tag"><span class="note-label">Note:</span> <span class="note-text">"' + esc(currentNote) + '"</span> ✨</div>' : '';
    const polaCap = currentNote ? '"' + esc(currentNote) + '"' : 'Minggu ke-' + currentWeekNum + ' kelar ✍️';
    const photoHtml = currRec.photo
        ? '<button type="button" class="jt-photo-toggle" id="jtPhotoToggle" aria-expanded="false">' +
          '<span>📸 Memori minggu ini</span><span class="jt-chev">▾</span></button>' +
          '<div class="jt-photo-wrap" id="jtPhotoWrap"><div class="jt-pola">' +
          '<span class="jt-pola-tape"></span>' +
          '<img src="' + esc(currRec.photo) + '" alt="" loading="lazy" decoding="async">' +
          '<div class="jt-pola-cap">' + polaCap + '<span class="jt-pola-date">' + esc(currMonthWeek.monthName) + ' · Week ' + currentWeekNum + '</span></div>' +
          '</div></div>'
        : '';

    return (
        '<div class="journal-tracker-card" id="journalTrackerWidget">' +
        '<div class="washi-tape-header"></div>' +
        '<div class="jt-head">' +
        '<div class="jt-title-group">' +
        '<div>' +
        '<div class="jt-title">Weekly Journal Tracker</div>' +
        '<div class="jt-sub">' + esc(currMonthWeek.monthName) + ' ' + currMonthWeek.year + '</div>' +
        '</div>' +
        '</div>' +
        '<div class="jt-streak-pill">🔥 ' + streak + '-Week Streak</div>' +
        '</div>' +
        '<div class="jt-grid">' + gridHtml + '</div>' +
        actionBtnHtml +
        photoHtml +
        noteHtml +
        '</div>'
    );
}

function initJournalTrackerListeners(wa) {
    const btn = $("jtCheckInBtn");
    if (btn) btn.addEventListener("click", () => openCheckinModal(wa));

    // accordion foto karya minggu ini
    const pt = $("jtPhotoToggle");
    if (pt) pt.addEventListener("click", () => {
        const w = $("jtPhotoWrap");
        const open = w.classList.toggle("open");
        pt.classList.toggle("open", open);
        pt.setAttribute("aria-expanded", open ? "true" : "false");
    });
}

// Modal check-in mingguan: foto karya (opsional, masuk galeri) + refleksi singkat
function openCheckinModal(wa) {
    const modal = $("questModal");
    const cw = getMonthWeekObj(new Date());
    $("questModalBox").innerHTML =
        '<div class="qm-topbar"><button class="qm-close" id="qmClose" aria-label="Tutup">✕</button></div>' +
        '<div class="qm-body">' +
        '<div class="quest-game-title">✍️ Weekly Check-In</div>' +
        '<div class="quest-game-desc">Udah journaling minggu ini? Simpan memorinya — foto spreadnya + refleksi singkat. Fotonya bakal ada di Gallery 💙</div>' +
        photoPickerHtml("Add this week's journal photo (optional)", "Refleksi singkat minggu ini… ✨ (opsional)") +
        '<button class="btn-primary" id="ciSave" style="margin-top:12px;">✓ Check In (+1 Streak)</button>' +
        '</div>';
    modal.classList.add("show");
    lockScroll();
    $("qmClose").addEventListener("click", closeQuestModal);
    wirePhotoPicker($("questModalBox"));
    // refresh tracker + kartu Minggu Ini (dipakai jalur optimistis & rollback)
    function refreshCheckinUi() {
        const widget = $("journalTrackerWidget");
        if (widget) {
            widget.outerHTML = renderJournalTrackerHtml(wa);
            initJournalTrackerListeners(wa);
        }
        const wn = $("weekNowCard");
        if (wn) { wn.outerHTML = renderWeekNowHtml(); initWeekNowListeners(); }
    }
    $("ciSave").addEventListener("click", async () => {
        const box = $("questModalBox");
        const input = box.querySelector(".qm-file-input");
        const capInput = box.querySelector(".qm-cap-input");
        const photo = input && input._photo;
        const note = capInput ? capInput.value.trim() : "";
        const btn = $("ciSave");

        // ---- TANPA foto: optimistis — stempel langsung nempel, server nyusul ----
        if (!photo) {
            const prevRecords = _profile.journalRecords;
            try {
                const recs = JSON.parse(_profile.journalRecords || "{}") || {};
                recs[cw.key] = { note: note, ts: Date.now() };
                _profile.journalRecords = JSON.stringify(recs);
            } catch (e) { }
            pushTagCheckin(cw.key);
            playSfx("check-in");
            fireConfetti("quest");
            closeQuestModal();
            refreshCheckinUi();
            apiPost({ action: "memberCheckin", token: _profile.token, weekKey: cw.key, note: note }).then(r => {
                if (r.status === "success") {
                    _profile.journalRecords = r.journalRecords || _profile.journalRecords; // sinkron versi server
                } else {
                    _profile.journalRecords = prevRecords; // rollback: stempel dicopot lagi
                    refreshCheckinUi();
                    alert(r.message || "Check-in belum kesimpen 😢 Coba lagi ya.");
                }
            }).catch(() => {
                _profile.journalRecords = prevRecords;
                refreshCheckinUi();
                alert("Gagal terhubung ke server. Check-in belum kesimpen, coba lagi ya.");
            });
            return;
        }

        // ---- DENGAN foto: tetap nunggu (upload beneran, butuh kepastian) ----
        const orig = btn.textContent;
        btn.disabled = true; btn.textContent = "Menyimpan…";
        showBusy("Menyimpan check-in + foto…");
        try {
            const r = await apiPost({ action: "memberCheckin", token: _profile.token, weekKey: cw.key, note: note, photoBase64: photo.base64, photoMime: photo.mime });
            if (r.status !== "success") { btn.disabled = false; btn.textContent = orig; alert(r.message || "Gagal menyimpan absen."); return; }
            _profile.journalRecords = r.journalRecords || _profile.journalRecords; // sinkron dari server
            _galleryLoaded = false; // biar galeri refetch (foto weekly ikut tampil)
            pushTagCheckin(cw.key); // jangan kirimi reminder mingguan lagi
            playSfx("check-in");
            fireConfetti("quest");
            closeQuestModal();
            refreshCheckinUi();
        } catch (e) {
            btn.disabled = false; btn.textContent = orig;
            alert("Gagal terhubung ke server. Coba lagi ya.");
        } finally { hideBusy(); }
    });
}

// ---------- Birthday Sahabat (ultah member lain) ----------
// Diisi dari server pas login/session (field birthdays di profil response):
// daftar { nickname } member yang ultah HARI INI. Kosong = semua fitur
// ultah (balon, banner, story) nggak muncul.
let BDAY_TODAY = [];

// Ultah-nya SI USER sendiri hari ini? (beda sama BDAY_TODAY yg buat semua orang).
// Testing: tinggal ubah birthDate akun di sheet members ke bulan-tanggal hari ini.
function isMyBirthdayToday() {
    if (!_profile) return false;
    const m = String(_profile.birthDate || "").match(/\d{4}-(\d{2})-(\d{2})/);
    if (!m) return false;
    const now = new Date();
    return parseInt(m[1], 10) === (now.getMonth() + 1) && parseInt(m[2], 10) === now.getDate();
}

// Isi surat ultah dari Mochi (dipilih acak tiap buka)
const BDAY_WISHES = [
    "Selamat ulang tahun! 🎂 Semoga tahun ini penuh halaman-halaman baru yang warnanya secerah spread favoritmu. Mochi sayang kamu! 🐾💙",
    "Happy birthday, sahabat! 🎉 Semoga makin bahagia, makin sehat, dan makin rajin nulisin cerita-cerita kecil yang bikin senyum lebar. Peluk hangat dari Mochi! 🤗",
    "Yeay, kamu naik level hari ini! ✨ Semoga semua wish yang pernah kamu tulis di journal pelan-pelan jadi kenyataan ya. Woof woof! 🎈",
    "Di hari spesialmu, Mochi cuma mau bilang: makasih udah jadi bagian keluarga Seminggu Satu 💙 Semoga harimu semanis washi tape favoritmu! 🎂✨"
];

// Balon-balon terbang sekali pas dashboard kebuka — KHUSUS buat yang lagi ultah sendiri
// (member lain cukup lihat banner + story ultah, nggak perlu balon)
function launchBalloons() {
    if (!isMyBirthdayToday() || $("bdayBalloons")) return;
    const c = document.createElement("div");
    c.id = "bdayBalloons";
    c.className = "bday-balloons";
    c.setAttribute("aria-hidden", "true");
    let html = "";
    for (let i = 0; i < 10; i++) {
        const left = 4 + Math.random() * 88;
        const dur = (6 + Math.random() * 5).toFixed(1);
        const delay = (Math.random() * 4).toFixed(1);
        const size = (1 + Math.random() * 1.5).toFixed(2);
        const hue = Math.floor(Math.random() * 360);
        html += '<span style="left:' + left.toFixed(0) + '%;animation-duration:' + dur + 's;animation-delay:' + delay + 's;font-size:' + size + 'rem;filter:hue-rotate(' + hue + 'deg) drop-shadow(0 4px 6px rgba(0,0,0,.15));">🎈</span>';
    }
    c.innerHTML = html;
    document.body.appendChild(c);
    setTimeout(() => { if (c.parentNode) c.parentNode.removeChild(c); }, 16000); // beres terbang -> bersihin
}

// Banner "lagi ada yg ultah" di paling atas tab Loyalty (tab default, pasti ke-notice).
// Khusus buat MEMBER LAIN — yang lagi ultah nggak perlu dikabarin soal dirinya sendiri
// (dia udah dapet sapaan + voucher + surat spesial).
function bdayFriendsBannerHtml() {
    const myNick = (_profile && _profile.nickname) || "";
    const others = BDAY_TODAY.filter(b => b.nickname !== myNick);
    if (!others.length) return "";
    const who = others.map(b => b.nickname).join(" & ");
    return '<a class="bday-banner" href="' + QUEST_WA_GROUP + '" target="_blank" rel="noopener">' +
        '<span class="bb-tape"></span>' +
        '<span class="bb-balloon a">🎈</span><span class="bb-balloon b">🎈</span>' +
        '<span class="bb-emoji">🎂</span>' +
        '<span class="bb-txt"><b>' + esc(who) + ' lagi ultah hari ini! 🎉</b>' +
        '<span>Kirim ucapan manis di grup yuk 💙</span></span>' +
        '</a>';
}

// ---------- Birthday Surprise ----------
// Voucher = umur% (mis. 27 th -> 27%), tampil sepanjang BULAN ulang tahun.
function birthdayInfo() {
    const bd = _profile && _profile.birthDate ? String(_profile.birthDate) : "";
    const m = bd.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const now = new Date();
    if ((now.getMonth() + 1) !== parseInt(m[2], 10)) return null; // cuma tampil pas bulan ultah
    const age = now.getFullYear() - parseInt(m[1], 10);
    if (age <= 0 || age > 120) return null;
    return { age: age };
}

function buildBirthdayHtml(b) {
    const nm = _profile.nickname || "Sahabat";
    return '<div class="bday">' +
        '<div class="bday-emoji">🎂🎉</div>' +
        '<div class="bday-title">Selamat Ulang Tahun, ' + esc(nm) + '!</div>' +
        '<div class="bday-sub">Ada kejutan spesial buat kamu bulan ini ✨</div>' +
        '<div class="voucher" id="voucherCard">' +
        '<span class="v-tape a"></span>' +
        '<span class="v-cut">✂️</span>' +
        '<span class="v-notch l"></span><span class="v-notch r"></span>' +
        '<img class="v-stk" src="../images/sticker/str-8.png" alt="">' +
        '<div class="v-off">' + b.age + '<small>%</small></div>' +
        '<div><span class="v-lbl">🎂 Voucher Ulang Tahun</span></div>' +
        '<div class="v-desc">Diskon ' + b.age + '% buat event journaling apa aja 💙</div>' +
        '<div class="v-brand">@seminggu_satu · buat ' + esc(nm) + '</div>' +
        '</div>' +
        '<button class="btn-primary bday-claim" style="margin-top:12px;">📲 Claim Voucher via WhatsApp</button>' +
        '<button class="btn-ghost2 bday-share" style="margin-top:8px;">🎁 Kirim gambar voucher ke admin</button>' +
        '<p class="bday-note">Berlaku sepanjang bulan ini. Klik claim → chat admin (pesan udah siap) 💙</p>' +
        '</div>';
}

function wireBirthday(b) {
    const nm = _profile.nickname || "Sahabat";
    const claim = document.querySelector(".bday-claim");
    const share = document.querySelector(".bday-share");
    if (claim) claim.addEventListener("click", () => {
        const msg = "Halo kak Arnold! 🎂 Aku mau claim *Voucher Ulang Tahun " + b.age + "% OFF* dari Balai Warga buat event journaling.\n\nNama: " + nm + "\nWA: " + _profile.wa + "\n\nMakasih! 💙";
        window.open("https://wa.me/" + ADMIN_WA + "?text=" + encodeURIComponent(msg), "_blank");
    });
    if (share) share.addEventListener("click", shareVoucher);
}

async function shareVoucher() {
    const card = document.getElementById("voucherCard");
    if (!card) return;
    const btn = document.querySelector(".bday-share");
    const label = btn.textContent; btn.disabled = true; btn.textContent = "Menyiapkan…";
    try {
        const blob = await renderCardToBlob(card);
        await shareOrDownloadImage(blob, "voucher-ultah-seminggu-satu.png",
            "Voucher ulang tahunku dari Seminggu Satu! 🎂 @seminggu_satu",
            "Voucher ke-download 📥 — kirim ke admin buat claim ya!");
    } catch (e) { if (!(e && e.name === "AbortError")) alert("Gagal bikin gambar" + (e && e.message ? " (" + e.message + ")" : "") + ". Coba lagi ya."); }
    finally { btn.disabled = false; btn.textContent = label; }
}

// ---------- Log Event: riwayat event yang pernah didatengin (timeline scrapbook) ----------
function openEventLog() {
    if (!_loyaltyStats) return;
    const evs = (_loyaltyStats.events || []).slice();
    // urut lama -> baru: dibaca sebagai perjalanan (yang tanggalnya nggak kebaca di depan)
    const tval = e => { const m = String(e.eventDate || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? Number(m[1] + m[2] + m[3]) : 0; };
    evs.sort((a, b) => tval(a) - tval(b));

    const modal = $("questModal");
    let inner;
    if (!evs.length) {
        inner = '<div class="placeholder" style="padding:1.5rem 0;"><div class="em">\ud83c\udf31</div>' +
            '<h3>Belum ada jejak event</h3><p>Yuk mulai petualangan pertamamu!</p></div>' +
            '<button class="btn-primary" id="elogNext">Lihat event yang lagi buka \ud83c\udfaa</button>';
    } else {
        let rows = "";
        evs.forEach((e, i) => {
            const when = e.eventDate ? fmtEventDate(e.eventDate) : (e.label || e.date || "");
            rows += '<div class="elog-item' + (i % 2 ? " alt" : "") + '">' +
                '<span class="elog-dot">' + (i + 1) + '</span>' +
                '<div class="elog-card"><span class="elog-tape' + (i % 2 ? " b" : "") + '"></span>' +
                '<div class="elog-name">' + esc(e.name) + '</div>' +
                (when ? '<div class="elog-date">\ud83d\uddd3 ' + esc(when) + '</div>' : '') +
                (i === 0 ? '<span class="elog-first">event pertamamu! \ud83d\udc99</span>' : '') +
                '</div></div>';
        });
        inner = '<div class="elog">' +
            '<img class="elog-stk" src="../images/sticker/str-3.png" style="top:-14px;right:-4px;width:54px;transform:rotate(12deg);" alt="">' +
            '<img class="elog-stk" src="../images/sticker/str-5.png" style="bottom:64px;left:-10px;width:48px;transform:rotate(-10deg);" alt="">' +
            '<div class="elog-start">\ud83c\udf31 AWAL PERJALANAN</div>' +
            rows +
            '<div class="elog-item"><span class="elog-dot next">?</span>' +
            '<button type="button" class="elog-next" id="elogNext">Petualangan berikutnya? Cek event yang lagi buka \ud83c\udfaa</button></div>' +
            '</div>';
    }
    $("questModalBox").innerHTML =
        '<div class="qm-topbar"><button class="qm-close" id="qmClose" aria-label="Tutup">\u2715</button></div>' +
        '<div class="qm-body">' +
        '<div class="quest-game-title">\ud83c\udf9f\ufe0f Log Event Kamu</div>' +
        '<div class="quest-game-desc">' + (evs.length ? evs.length + ' event udah kamu datengin bareng Balai Warga \ud83d\udc99' : 'Jejak event-mu bakal tercatat di sini \u2728') + '</div>' +
        inner +
        '</div>';
    modal.classList.add("show");
    lockScroll();
    $("qmClose").addEventListener("click", closeQuestModal);
    const nx = $("elogNext");
    if (nx) nx.addEventListener("click", () => { closeQuestModal(); activateTab("events"); });
}

// ---------- Kartu "Minggu Ini": jawaban pertama pas buka app — udah check-in belum ----------
function weekDaysLeft() {
    const now = new Date();
    const cw = getMonthWeekObj(now);
    const lastDay = new Date(cw.year, cw.month + 1, 0).getDate();
    const weekEnd = cw.week === 4 ? lastDay : cw.week * 7; // W4 molor sampai akhir bulan
    return Math.max(1, weekEnd - now.getDate() + 1);
}

function renderWeekNowHtml() {
    const records = getJournalTrackerData(_profile.wa).records || {};
    const cw = getMonthWeekObj(new Date());
    const streak = calculateJournalStreak(records);
    // Udah check-in? Kartunya NGGAK usah tampil — tracker udah nunjukin stempel &
    // streak, kebanyakan info. Placeholder tersembunyi disisain biar bisa
    // di-render ulang (mis. rollback check-in optimistis yang gagal).
    if (records[cw.key]) {
        return '<div id="weekNowCard" style="display:none"></div>';
    }
    const left = weekDaysLeft();
    const leftTxt = left <= 1
        ? '<b>Hari terakhir</b> minggu ke-' + cw.week + ' \u2014 jangan sampai bolong! \u23f0'
        : '<b>' + left + ' hari lagi</b> sebelum minggu ke-' + cw.week + ' ditutup';
    return '<div class="wn-card todo" id="weekNowCard"><span class="wn-tape"></span>' +
        '<div class="wn-body"><div class="wn-title">Belum check-in minggu ini \u270d\ufe0f</div>' +
        '<div class="wn-sub">' + leftTxt + (streak > 0 ? ' \u00b7 streak ' + streak + ' minggu taruhannya \ud83d\udd25' : '') + '</div></div>' +
        '<button type="button" class="wn-btn" id="wnCheckinBtn">Check-In \u2192</button>' +
        '</div>';
}

function initWeekNowListeners() {
    const b = $("wnCheckinBtn");
    if (b) b.addEventListener("click", () => openCheckinModal(_profile.wa));
}

// ---------- Tiket countdown: event terdaftar terdekat ----------
function nearestRegisteredEvent() {
    if (!_evRegistered) return null; // loadEvents belum jalan -> nanti dia manggil renderEventTicket lagi
    const ws = (typeof WORKSHOPS !== "undefined" && Array.isArray(WORKSHOPS)) ? WORKSHOPS : [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let best = null;
    ws.forEach(w => {
        if (!_evRegistered[w.id]) return;
        const d = (typeof parseDate === "function") ? parseDate(w.eventDate) : null;
        if (!d) return;
        const days = Math.round((d - today) / 86400000);
        if (days < 0) return; // udah lewat
        if (!best || days < best.days) best = { w: w, days: days };
    });
    return best;
}

function renderEventTicket() {
    const slot = $("evTicketSlot");
    if (!slot) return; // Home belum kerender
    const ev = nearestRegisteredEvent();
    if (!ev) { slot.innerHTML = ""; return; }
    const when = ev.days === 0 ? "HARI INI! \ud83c\udf89" : (ev.days === 1 ? "Besok!" : ev.days + " hari lagi");
    const dateTxt = ev.w.workshopDate || (typeof formatDateIndo === "function" && ev.w.eventDate ? formatDateIndo(ev.w.eventDate) : "");
    slot.innerHTML =
        '<button type="button" class="evt-ticket" id="evTicketBtn">' +
        '<span class="evt-left">\ud83c\udf9f\ufe0f</span>' +
        '<span class="evt-mid"><span class="evt-name">' + esc(ev.w.name || "Event") + '</span>' +
        (dateTxt ? '<span class="evt-date">' + esc(dateTxt) + ' \u00b7 kamu udah terdaftar \u2713</span>' : '<span class="evt-date">kamu udah terdaftar \u2713</span>') +
        '</span>' +
        '<span class="evt-count">' + esc(when) + '</span>' +
        '</button>';
    $("evTicketBtn").addEventListener("click", () => activateTab("events"));
}

// ---------- Recap bulanan: Wrapped mini bulan lalu (nongol tanggal 1-7) ----------
const BULAN_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
function prevMonthInfo() {
    const now = new Date();
    const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const m = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    return { year: y, month: m, name: BULAN_ID[m], prefix: y + "-" + String(m + 1).padStart(2, "0") };
}

function renderRecapCardHtml() {
    if (new Date().getDate() > 7) return ""; // cuma minggu pertama tiap bulan
    const pm = prevMonthInfo();
    const records = getJournalTrackerData(_profile.wa).records || {};
    const checkins = Object.keys(records).filter(k => k.indexOf(pm.prefix) === 0).length;
    if (!checkins) return ""; // bulan lalu kosong -> recap-nya bakal sedih, skip aja
    return '<button type="button" class="recap-card" id="recapCard"><span class="rc-tape"></span>' +
        '<span class="rc-ic">\ud83d\udcd6</span>' +
        '<span class="rc-body"><span class="rc-title">Recap ' + pm.name + ' udah keluar! \u2728</span>' +
        '<span class="rc-sub">Lihat perjalanan journaling-mu sebulan kemarin</span></span>' +
        '<span class="rc-go">Buka \u2192</span>' +
        '</button>';
}

function openMonthlyRecap() {
    const pm = prevMonthInfo();
    const records = getJournalTrackerData(_profile.wa).records || {};
    const checkins = Object.keys(records).filter(k => k.indexOf(pm.prefix) === 0).length;
    const streak = calculateJournalStreak(records);
    const nick = esc(_profile.nickname || "Sahabat");
    // karya bulan lalu dari galeri (null = galeri belum ke-load, slide-nya di-skip)
    let works = null;
    if (_galleryItems && _galleryItems.length) {
        const from = new Date(pm.year, pm.month, 1).getTime();
        const to = new Date(pm.year, pm.month + 1, 1).getTime();
        works = _galleryItems.filter(it => it.mine && it.ts && it.ts >= from && it.ts < to);
    }
    const slides = [];
    // 1) Cover
    slides.push('<div class="wr-slide wr-blue">' +
        '<span class="wr-tape" style="top:52px;left:20px;transform:rotate(-14deg);"></span>' +
        '<img class="wr-imgstk" src="../images/sticker/str-3.png" style="width:82px;top:9%;right:6%;transform:rotate(10deg);" alt="">' +
        '<img class="wr-imgstk" src="../images/sticker/str-5.png" style="width:74px;bottom:11%;left:5%;transform:rotate(-12deg);" alt="">' +
        '<div class="wr-anim wr-kicker">RECAP BULANAN</div>' +
        '<div class="wr-anim wr-title wr-hero" style="--d:.08s;">' + pm.name + '<br>Kamu \ud83d\udcd6</div>' +
        '<div class="wr-anim wr-sub" style="--d:.16s;">Sebulan kemarin bareng Balai Warga, ' + nick + ' \ud83d\udc99</div>' +
        '<div class="wr-anim wr-hint" style="--d:.3s;">geser ke kiri buat mulai \u2192</div>' +
        '</div>');
    // 2) Check-in mingguan
    let stamps = "";
    for (let i = 0; i < 4; i++) stamps += '<span class="wr-stamp' + (i < checkins ? " on" : "") + '">' + (i < checkins ? "\u2713" : "") + '</span>';
    slides.push('<div class="wr-slide wr-paper">' +
        '<span class="wr-tape" style="top:56px;right:22px;transform:rotate(12deg);"></span>' +
        '<span class="wr-stk" style="top:13%;left:10%;">\u270d\ufe0f</span>' +
        '<img class="wr-imgstk" src="../images/sticker/str-6.png" style="width:84px;bottom:9%;right:5%;transform:rotate(9deg);" alt="">' +
        '<div class="wr-anim wr-kicker">WEEKLY JOURNAL</div>' +
        '<div class="wr-anim wr-big" style="--d:.08s;">' + checkins + '</div>' +
        '<div class="wr-anim wr-title" style="--d:.14s;">minggu check-in di bulan ' + pm.name + ' \u270d\ufe0f</div>' +
        (checkins >= 4 ? '<div class="wr-anim wr-stamp5" style="--d:.26s;">FULL MONTH! \ud83d\udc51</div>' : '<div class="wr-anim wr-sub" style="--d:.2s;">dari 4 minggu yang ada</div>') +
        '<div class="wr-anim wr-stamps" style="--d:.32s;">' + stamps + '</div>' +
        '</div>');
    // 3) Karya (kalau data galeri ada)
    if (works && works.length) {
        let polas = "";
        works.slice(0, 3).forEach(w => { polas += '<span class="wr-pola"><img src="' + esc(w.photo) + '" alt="" loading="lazy" decoding="async"></span>'; });
        slides.push('<div class="wr-slide wr-yellow">' +
            '<span class="wr-tape b" style="top:54px;left:20px;transform:rotate(-10deg);"></span>' +
            '<span class="wr-stk" style="top:15%;right:12%;">\ud83c\udfa8</span>' +
            '<img class="wr-imgstk" src="../images/sticker/str-2.png" style="width:76px;bottom:10%;left:6%;transform:rotate(-9deg);" alt="">' +
            '<div class="wr-anim wr-kicker">KARYA BULAN ' + pm.name.toUpperCase() + '</div>' +
            '<div class="wr-anim wr-big" style="--d:.08s;">' + works.length + '</div>' +
            '<div class="wr-anim wr-title" style="--d:.14s;">karya kamu pajang di galeri \ud83c\udfa8</div>' +
            (polas ? '<div class="wr-anim wr-polas" style="--d:.26s;">' + polas + '</div>' : '') +
            '</div>');
    }
    // 3b) Cuaca Hati bulan lalu (kalau ada catatan mood)
    const moodMk = pm.year + "-" + String(pm.month + 1).padStart(2, "0");
    const moodRec = moodStore()[moodMk] || {};
    const moodDays = Object.keys(moodRec).length;
    if (moodDays) {
        const tally = {};
        Object.values(moodRec).forEach(k => { tally[k] = (tally[k] || 0) + 1; });
        const domK = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0];
        const dom = MOODS.find(x => x.k === domK) || MOODS[0];
        slides.push('<div class="wr-slide wr-paper">' +
            '<span class="wr-tape" style="top:56px;left:22px;transform:rotate(-11deg);"></span>' +
            '<span class="wr-stk" style="top:13%;right:10%;">🌦️</span>' +
            '<div class="wr-anim wr-kicker">CUACA HATI ' + esc(pm.name.toUpperCase()) + '</div>' +
            '<div class="wr-anim wr-big" style="--d:.08s;">' + dom.e + '</div>' +
            '<div class="wr-anim wr-title" style="--d:.14s;">bulan yang kebanyakan ' + esc(dom.t.toLowerCase()) + '</div>' +
            '<div class="wr-anim wr-sub" style="--d:.2s;">' + moodDays + ' hari kamu catat cuacanya 💙</div>' +
            '<div class="wr-anim" style="--d:.28s;">' + moodGridHtml(moodMk, true) + '</div>' +
            '</div>');
    }

    // 4) Outro + streak berjalan
    slides.push('<div class="wr-slide wr-blue">' +
        '<span class="wr-tape" style="top:58px;right:22px;transform:rotate(8deg);"></span>' +
        '<span class="wr-stk" style="top:16%;left:12%;">\ud83c\udf31</span>' +
        '<img class="wr-imgstk" src="../images/sticker/str-7.png" style="width:86px;bottom:16%;right:6%;transform:rotate(8deg);" alt="">' +
        '<div class="wr-anim wr-title wr-hero">Bulan baru,<br>cerita baru \u2728</div>' +
        (streak > 0 ? '<div class="wr-anim wr-sub" style="--d:.12s;">Streak-mu masih jalan ' + streak + ' minggu \ud83d\udd25 gas terus bulan ini, ' + nick + '!</div>'
            : '<div class="wr-anim wr-sub" style="--d:.12s;">Mulai lagi pelan-pelan minggu ini ya, ' + nick + ' \ud83d\udc99</div>') +
        '<div class="wr-anim wr-foot" style="--d:.22s;">@seminggu_satu</div>' +
        '</div>');
    showWrapped(slides, {
        filename: "recap-" + pm.prefix + "-seminggu-satu.png",
        text: "Recap " + pm.name + " \u2728 @seminggu_satu"
    });
}

async function loadLoyalty() {
    if (_loyaltyLoaded) return;
    _loyaltyLoaded = true;
    const loading = $("loyaltyLoading"), content = $("loyaltyContent");
    loading.style.display = "none"; content.innerHTML = skeletonLoyalty();
    try {
        const d = await fetchJSONP(GS + "?page=loyalty&wa=" + encodeURIComponent(_profile.wa), "loy", 20000);
        loading.style.display = "none";
        if (!d || !d.found) {
            content.innerHTML = '<div class="placeholder"><div class="em">🌱</div><h3>Belum ada riwayat</h3><p>Yuk ikut event pertamamu!</p></div>';
            return;
        }
        const count = d.count || 0, target = d.target || 6, progress = d.progress || 0;
        const p = persona(count);
        // buat My Summary + Passport Wrapped
        const evList = d.events || [];
        const uniqueWs = (function () { const s = {}; evList.forEach(e => { s[e.name] = 1; }); return Object.keys(s).length; })();
        const years = evList.map(e => { const m = String(e.date || "").match(/(\d{4})$/); return m ? Number(m[1]) : null; }).filter(Boolean);
        _loyaltyStats = {
            count: count, target: target, progress: progress, eligible: !!d.eligible,
            tier: p.title, tierEmoji: p.emoji, tierTag: p.tag,
            trait: uniqueWs >= 3 ? "Sang Penjelajah" : (count >= 3 ? "Si Paling Setia" : "Pencari Inspirasi"),
            events: evList, uniqueWs: uniqueWs,
            since: years.length ? Math.min.apply(null, years) : null
        };
        const toGo = Math.max(0, target - progress);
        let stamps = "";
        for (let i = 0; i < target; i++) stamps += '<div class="stamp' + (i < progress ? ' on' : '') + '">' + (i < progress ? '★' : '') + '</div>';
        const rewardBox = d.eligible
            ? '<div class="eligible">🎉 Kamu dapat HADIAH GRATIS! Tunjukkin ke admin ya.</div>'
            : '<div class="togo">' + (count === 0 ? '' : '<b>' + toGo + ' event lagi</b> buat hadiah gratis 🎁') + '</div>';

        const cardNum = formatCardNumber(_profile.wa);

        const cardHtml =
            '<div class="member-card-wrapper" id="memberCardWrap">' +
            '<div class="member-card-3d" id="memberCard3D">' +
            '<div class="card-face front"><div class="card-tape a"></div><div class="card-tape b"></div>' +
            '<div class="card-bg-pattern"></div>' +
            '<div class="holo-sheen" id="cardSheen"></div>' +
            '<img class="card-stk" src="../images/sticker/str-6.png" alt="">' +
            '<div class="card-layer card-top">' +
            '<div class="card-sticker">SS</div>' +
            '<div class="card-logo">' +
            '<div class="card-logo-title">SEMINGGU SATU</div>' +
            '<div class="card-logo-sub">WARGA DIGITAL</div>' +
            '</div>' +
            '</div>' +
            '<div class="card-layer card-mid">' +
            '<div class="card-tier-badge">' + p.emoji + ' ' + esc(p.title) + '</div>' +
            '<div class="card-number">' + esc(cardNum) + '</div>' +
            '</div>' +
            '<div class="card-layer card-bot">' +
            '<div class="card-holder">' +
            '<span class="card-label">Nama Warga</span>' +
            '<span class="card-name">' + esc(_profile.nickname || "Sahabat") + '</span>' +
            '</div>' +
            '<div class="card-flip-hint"><span>Flip</span> 🔄</div>' +
            '</div>' +
            '</div>' +
            '<div class="card-face back">' +
            '<div class="card-bg-pattern"></div>' +
            '<div class="card-tape-strip"></div>' +
            '<div class="card-layer card-back-body">' +
            '<div class="card-sig-line">' +
            '<span>BALAI WARGA <b>#SEMINGGUSATU</b></span>' +
            '<span class="card-stamp">VERIFIED</span>' +
            '</div>' +
            '<div class="card-back-mid">' +
            '<div class="card-back-stats">' +
            '<div class="card-stat-box">' +
            '<div class="val">' + count + '</div>' +
            '<div class="lbl">Events</div>' +
            '</div>' +
            '<div class="card-stat-box">' +
            '<div class="val">' + (d.questCount || 0) + '</div>' +
            '<div class="lbl">Challenges</div>' +
            '</div>' +
            '</div>' +
            '<div class="card-back-tag">' + esc(p.tag) + '</div>' +
            '</div>' +
            '<div class="card-back-foot">' +
            '<span class="card-stamp">STATUS: ACTIVE</span>' +
            '<div class="card-flip-hint"><span>Flip</span> 🔄</div>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '</div>';

        const trackerHtml = renderJournalTrackerHtml(_profile.wa);

        const bday = birthdayInfo();
        const birthdayHtml = bday ? buildBirthdayHtml(bday) : "";

        content.innerHTML =
            renderWeekNowHtml() +
            '<div id="moodSlot"></div>' +
            bdayFriendsBannerHtml() +
            birthdayHtml +
            trackerHtml +
            '<div id="evTicketSlot"></div>' +
            renderRecapCardHtml() +
            '<div id="snailSlot"></div>' +
            '<button type="button" class="psp-cta" id="btnPassport">' +
            '<span class="psp-cta-emblem">SS</span>' +
            '<span class="psp-cta-body"><span class="psp-cta-t">Paspor Warga</span>' +
            '<span class="psp-cta-s">Identitas + stempel event yang udah kamu datengin</span></span>' +
            '<span class="psp-cta-go">buka →</span>' +
            '</button>' +
            cardHtml +
            '<div class="stat-cards">' +
            '<button type="button" class="scard" id="scardEvents"><b>' + count + '</b><span>Events Joined</span><span class="scard-go">lihat \u2192</span></button>' +
            '<button type="button" class="scard" id="scardQuests"><b>' + (d.questCount || 0) + '</b><span>Challenges</span><span class="scard-go">karyaku \u2192</span></button>' +
            '</div>' +
            '<div class="tier"><div class="em">' + p.emoji + '</div><div><div class="t">' + esc(p.title) + '</div><div class="d">' + esc(p.tag) + '</div></div></div>' +
            '<div class="card"><div class="section-lbl">Loyalty Card 🎁</div><div class="stamps">' + stamps + '</div>' + rewardBox + '</div>';

        $("btnPassport").addEventListener("click", openPassport);
        init3DCardListeners();
        initJournalTrackerListeners(_profile.wa);
        initWeekNowListeners();
        refreshMoodWidget(); // widget cuaca hati (data sync dari localStorage/profil)
        renderEventTicket(); // kalau _evRegistered belum ada, loadEvents yang ngisi nanti
        loadSnailMail().then(() => {
            snailCtaRefresh();
            // habis refresh di #snail-mail -> langsung buka lagi halamannya
            if (location.hash === "#snail-mail") openSnailBox(false);
        }).catch(() => { }); // kotak surat bulanan Mochi
        const rc = $("recapCard");
        if (rc) rc.addEventListener("click", openMonthlyRecap);
        $("scardEvents").addEventListener("click", openEventLog);
        $("scardQuests").addEventListener("click", async () => {
            // buka story karya sendiri (kayak nge-tap avatar sendiri di story bar)
            if (!_galleryLoaded || !_galleryItems.length) {
                showBusy("Ngambil karya kamu\u2026");
                try { await loadGallery(); } finally { hideBusy(); }
            }
            if (!_storyGroups.length) _storyGroups = buildStoryGroups();
            const mi = _storyGroups.findIndex(g => g.mine);
            if (mi >= 0) { openStory(mi, 0); return; }
            alert("Belum ada karya kamu di galeri \u2014 yuk mulai dari challenge pertama! \ud83c\udfaf");
            activateTab("quest");
        });
        if (bday) { wireBirthday(bday); fireConfetti("reward"); }
        else if (d.eligible) { fireConfetti("reward"); }
    } catch (e) {
        loading.style.display = "none";
        _loyaltyLoaded = false;           // biar bisa retry pas tab dibuka lagi
        renderError(content, loadLoyalty);
    }
}

// ---------- Push notification (OneSignal) ----------
// Aktif cuma kalau ONESIGNAL_APP_ID keisi di env.js & halaman di-serve https.
// SDK-nya nebeng service worker sw.js yang sama (importScripts di dalamnya).
let _pushInit = false;
function initPush() {
    if (_pushInit) return;
    if (typeof ONESIGNAL_APP_ID === "undefined" || !ONESIGNAL_APP_ID) return;
    if (location.protocol !== "https:") return; // file:// lokal -> skip
    _pushInit = true;
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
        try {
            await OneSignal.init({
                appId: ONESIGNAL_APP_ID,
                serviceWorkerPath: "/sahabat/sw.js",
                serviceWorkerParam: { scope: "/sahabat/" }
            });
            // tag nomor WA -> server bisa exclude pengirim pas broadcast karya baru
            if (_profile && _profile.wa) OneSignal.User.addTag("wa", String(_profile.wa).replace(/\D/g, ""));
            // udah check-in minggu ini? tandai biar nggak kena reminder mingguan
            try {
                const cw = getMonthWeekObj(new Date());
                const records = getJournalTrackerData(_profile.wa).records || {};
                if (records[cw.key]) OneSignal.User.addTag("ciw", cw.key);
            } catch (e) { }
            // prompt izin ala slidedown (OneSignal atur frequency capping-nya)
            OneSignal.Slidedown.promptPush();
        } catch (e) { /* push gagal init = bukan masalah fatal */ }
    });
}

// Tandai "udah check-in minggu [weekKey]" ke OneSignal — dipakai filter
// reminder mingguan biar yang udah check-in nggak diganggu
function pushTagCheckin(weekKey) {
    try {
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push((OneSignal) => { OneSignal.User.addTag("ciw", weekKey); });
    } catch (e) { }
}

// ---------- Shimmer placeholder buat semua gambar konten ----------
// Gambar yang belum ke-load dikasih animasi shimmer (bukan blank putih).
// Otomatis buat SEMUA <img> di halaman — termasuk yang di-render belakangan
// (pindah tab, modal, story) via MutationObserver. Gambar dekoratif transparan
// (sticker, maskot, logo, seal) di-skip biar nggak ada kotak shimmer aneh.
(function initImgShimmer() {
    const SKIP_SRC = /images\/sticker\/|mochi|logo|seal-paw/i;
    function watch(img) {
        if (img._shim) return;
        img._shim = true;
        if (SKIP_SRC.test(img.src || "") || img.classList.contains("wr-imgstk") || img.classList.contains("mp-imgstk")) return;
        if (img.complete) return; // udah ke-load (atau udah error) -> nggak perlu
        img.classList.add("img-shimmer");
        const done = () => img.classList.remove("img-shimmer");
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
    }
    function scan(root) {
        if (root.tagName === "IMG") watch(root);
        else if (root.querySelectorAll) root.querySelectorAll("img").forEach(watch);
    }
    scan(document.body);
    new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(n => {
        if (n.nodeType === 1) scan(n);
    }))).observe(document.body, { childList: true, subtree: true });
})();

// ---------- Auto-login ----------
(async function init() {
    let token = "";
    try { token = localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { }
    if (!token || !GS) { showAuth(); return; }   // nggak ada sesi -> langsung form login
    // Ada token -> optimis: langsung tampilkan shell dashboard (menu + skeleton),
    // verifikasi sesi jalan di belakang — nggak ada blocker "cek sesi" lagi
    hideBoot();
    $("authView").style.display = "none";
    $("dashView").style.display = "block";
    $("dashHi").textContent = "Hai! 👋";
    activateTab((location.hash || "").replace("#", "") || "loyalty"); // _profile masih kosong -> skeleton
    try {
        const r = await apiPost({ action: "memberSession", token: token });
        if (r.status === "success") { onAuthSuccess(r); }
        else { try { localStorage.removeItem(TOKEN_KEY); } catch (e) { } showAuth(); }
    } catch (e) { showAuth(); }
})();

// ---------- Custom Datepicker Controller ----------
(function initDatePicker() {
    const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

    let selectedYear = null;
    let selectedMonth = null; // 0 - 11
    let selectedDay = null;

    let currentYear = 2000; // default view for birthdate selection
    let currentMonth = 0;   // Januari

    const trigger = $("dpTrigger");
    const modal = $("dpModal");
    const backdrop = $("dpBackdrop");
    const closeBtn = $("dpClose");
    const monthSelect = $("dpMonthSelect");
    const yearSelect = $("dpYearSelect");
    const prevBtn = $("dpPrevMonth");
    const nextBtn = $("dpNextMonth");
    const daysContainer = $("dpDays");
    const selectedDisplay = $("dpSelectedDisplay");
    const dpValue = $("dpValue");
    const setupBirth = $("setupBirth");
    const confirmBtn = $("dpConfirmBtn");
    const clearBtn = $("dpClearBtn");

    if (!trigger || !modal) return;

    // Populate Months
    MONTHS.forEach((m, idx) => {
        const opt = document.createElement("option");
        opt.value = idx;
        opt.textContent = m;
        monthSelect.appendChild(opt);
    });

    // Populate Years (1940 - current year)
    const thisYear = new Date().getFullYear();
    for (let y = thisYear; y >= 1940; y--) {
        const opt = document.createElement("option");
        opt.value = y;
        opt.textContent = y;
        yearSelect.appendChild(opt);
    }

    function formatDateIndo(y, m, d) {
        if (!y || m == null || !d) return "Belum dipilih";
        return `${d} ${MONTHS[m]} ${y}`;
    }

    function formatISODate(y, m, d) {
        if (!y || m == null || !d) return "";
        const mm = String(m + 1).padStart(2, "0");
        const dd = String(d).padStart(2, "0");
        return `${y}-${mm}-${dd}`;
    }

    function updateHeaderDisplay() {
        if (selectedYear && selectedMonth !== null && selectedDay) {
            selectedDisplay.textContent = formatDateIndo(selectedYear, selectedMonth, selectedDay);
        } else {
            selectedDisplay.textContent = "Belum dipilih";
        }
    }

    function renderDays() {
        daysContainer.innerHTML = "";

        monthSelect.value = currentMonth;
        yearSelect.value = currentYear;

        const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

        const today = new Date();
        const isTodayMonth = today.getFullYear() === currentYear && today.getMonth() === currentMonth;

        // Empty padding cells before first day
        for (let i = 0; i < firstDayIndex; i++) {
            const empty = document.createElement("div");
            empty.className = "dp-day empty";
            daysContainer.appendChild(empty);
        }

        // Days of month
        for (let day = 1; day <= daysInMonth; day++) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "dp-day";
            btn.textContent = day;

            if (isTodayMonth && day === today.getDate()) {
                btn.classList.add("today");
            }

            if (selectedYear === currentYear && selectedMonth === currentMonth && selectedDay === day) {
                btn.classList.add("selected");
            }

            btn.addEventListener("click", () => {
                selectedYear = currentYear;
                selectedMonth = currentMonth;
                selectedDay = day;
                updateHeaderDisplay();
                renderDays();
            });

            daysContainer.appendChild(btn);
        }
    }

    function openModal() {
        if (setupBirth.value) {
            const parts = setupBirth.value.split("-");
            if (parts.length === 3) {
                selectedYear = parseInt(parts[0], 10);
                selectedMonth = parseInt(parts[1], 10) - 1;
                selectedDay = parseInt(parts[2], 10);
                currentYear = selectedYear;
                currentMonth = selectedMonth;
            }
        }
        updateHeaderDisplay();
        renderDays();
        modal.style.display = "flex";
    }

    function closeModal() {
        modal.style.display = "none";
    }

    trigger.addEventListener("click", openModal);
    backdrop.addEventListener("click", closeModal);
    closeBtn.addEventListener("click", closeModal);

    monthSelect.addEventListener("change", (e) => {
        currentMonth = parseInt(e.target.value, 10);
        renderDays();
    });

    yearSelect.addEventListener("change", (e) => {
        currentYear = parseInt(e.target.value, 10);
        renderDays();
    });

    prevBtn.addEventListener("click", () => {
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
        renderDays();
    });

    nextBtn.addEventListener("click", () => {
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        renderDays();
    });

    clearBtn.addEventListener("click", () => {
        selectedYear = null;
        selectedMonth = null;
        selectedDay = null;
        setupBirth.value = "";
        dpValue.textContent = "Pilih tanggal lahir...";
        dpValue.classList.add("dp-placeholder");
        updateHeaderDisplay();
        closeModal();
    });

    confirmBtn.addEventListener("click", () => {
        if (!selectedYear || selectedMonth === null || !selectedDay) {
            setMsg("Silakan pilih tanggal lahir dulu ya 🎂", true);
            return;
        }
        const iso = formatISODate(selectedYear, selectedMonth, selectedDay);
        const indoText = formatDateIndo(selectedYear, selectedMonth, selectedDay);
        setupBirth.value = iso;
        dpValue.textContent = indoText;
        dpValue.classList.remove("dp-placeholder");
        closeModal();
    });
})();

// ---------- FAB Controller ----------
(function initFabController() {
    const mainBtn = $("fabMainBtn");
    const menu = $("fabMenu");
    const container = $("fabContainer");
    if (!mainBtn || !menu) return;

    let isOpen = false;

    function toggleMenu(show) {
        isOpen = (show !== undefined) ? show : !isOpen;
        mainBtn.classList.toggle("open", isOpen);
        menu.classList.toggle("open", isOpen);
    }

    mainBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleMenu();
    });

    document.addEventListener("click", (e) => {
        if (isOpen && container && !container.contains(e.target)) {
            toggleMenu(false);
        }
    });

    const actionProfile = $("fabActionProfile");
    if (actionProfile) {
        actionProfile.addEventListener("click", () => {
            toggleMenu(false);
            if (_profile) openProfileEditor();
        });
    }

    const actionMail = $("fabActionMail");
    if (actionMail) {
        actionMail.addEventListener("click", () => {
            toggleMenu(false);
            openPostboxPage(); // Kotak Pos Warga (saran/aspirasi ber-vote)
        });
    }

    const actionTop = $("fabActionTop");
    if (actionTop) {
        actionTop.addEventListener("click", () => {
            toggleMenu(false);
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    }

    // ---- Install PWA ke home screen ----
    const installBtn = $("fabActionInstall");
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    let deferredPrompt = null;

    if (installBtn && !isStandalone) {
        // Android/Chrome: tangkap prompt native browser
        window.addEventListener("beforeinstallprompt", (e) => {
            e.preventDefault();
            deferredPrompt = e;
            installBtn.style.display = "";
        });
        // iOS Safari ga support prompt native -> tetap tampil, pakai instruksi manual
        if (isIOS) installBtn.style.display = "";

        installBtn.addEventListener("click", async () => {
            toggleMenu(false);
            if (deferredPrompt) {
                deferredPrompt.prompt();
                try { await deferredPrompt.userChoice; } catch (e) { }
                deferredPrompt = null;
                installBtn.style.display = "none";
            } else if (isIOS) {
                alert("Cara install di iPhone:\n\n1. Tap tombol Share (kotak + panah ke atas) di bawah\n2. Pilih \"Add to Home Screen\" / \"Tambah ke Layar Utama\"\n3. Tap \"Add\" / \"Tambah\"\n\nMochi bakal nangkring di home screen kamu! 🐾");
            } else {
                alert("Buat install: buka menu browser (⋮) terus pilih \"Install app\" / \"Add to Home screen\" ya 📲");
            }
        });

        // udah keinstall -> sembunyiin tombolnya
        window.addEventListener("appinstalled", () => {
            installBtn.style.display = "none";
            deferredPrompt = null;
        });
    }

    // ---- Pengaturan (tema, ukuran teks, suara) ----
    const actionSettings = $("fabActionTheme");
    if (actionSettings) {
        actionSettings.addEventListener("click", () => {
            toggleMenu(false);
            openSettings();
        });
    }
})();

// ---------- Pengaturan ⚙️: Balai-mu, aturanmu ----------
function setThemePref(dark) {
    if (dark) document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.removeAttribute("data-theme");
    try { localStorage.setItem("ss_theme", dark ? "dark" : "light"); } catch (e) { }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#0d1526" : "#0046ff");
}

function openSettings() {
    const modal = $("questModal");
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const fontPref = document.documentElement.getAttribute("data-font") || "normal";
    const muted = sndMuted();
    const seg = (id, opts) => '<div class="st-seg" id="' + id + '">' +
        opts.map(o => '<button type="button" class="st-opt' + (o.on ? " on" : "") + '" data-v="' + o.v + '">' + o.t + '</button>').join("") + '</div>';
    $("questModalBox").innerHTML =
        '<div class="qm-topbar"><button class="qm-close" id="qmClose" aria-label="Tutup">✕</button></div>' +
        '<div class="qm-body">' +
        '<div class="quest-game-title">⚙️ Pengaturan</div>' +
        '<div class="quest-game-desc">Atur Balai-mu senyaman kamu 💙</div>' +
        '<div class="st-row"><div class="st-lbl">🌓 Tema</div>' +
        seg("stTheme", [{ v: "light", t: "☀️ Terang", on: !isDark }, { v: "dark", t: "🌙 Gelap", on: isDark }]) + '</div>' +
        '<div class="st-row"><div class="st-lbl">🔤 Ukuran Teks</div>' +
        seg("stFont", [
            { v: "normal", t: "Normal", on: fontPref === "normal" },
            { v: "medium", t: "Sedang", on: fontPref === "medium" },
            { v: "large", t: "Besar", on: fontPref === "large" }
        ]) + '</div>' +
        '<div class="st-row"><div class="st-lbl">🔊 Suara & Musik</div>' +
        seg("stSound", [{ v: "on", t: "🔔 Nyala", on: !muted }, { v: "off", t: "🔕 Senyap", on: muted }]) + '</div>' +
        '</div>';
    modal.classList.add("show");
    lockScroll();
    $("qmClose").addEventListener("click", closeQuestModal);
    function pick(segId, cb) {
        $(segId).querySelectorAll(".st-opt").forEach(b => b.addEventListener("click", () => {
            $(segId).querySelectorAll(".st-opt").forEach(x => x.classList.toggle("on", x === b));
            cb(b.dataset.v);
        }));
    }
    pick("stTheme", v => { setThemePref(v === "dark"); playSfx("light", 0.8); });
    pick("stFont", v => {
        if (v === "medium" || v === "large") document.documentElement.setAttribute("data-font", v);
        else document.documentElement.removeAttribute("data-font");
        try { localStorage.setItem("ss_font", v); } catch (e) { }
        playSfx("love", 0.5);
    });
    pick("stSound", v => {
        try { localStorage.setItem("ss_mute", v === "off" ? "1" : "0"); } catch (e) { }
        if (v === "off") { gameMusicStop(); wrappedMusicStop(); mochiNoteStop(); }
        else playSfx("love", 0.6); // konfirmasi suara nyala lagi
    });
}

// ============================================================
//  Profil warga: avatar sapaan + editor (foto, tanggal lahir, bio)
// ============================================================
function renderProfileAva() {
    const el = $("profileAvaInner");
    if (!el || !_profile) return;
    el.parentNode.innerHTML = _profile.photoUrl
        ? '<img src="' + esc(_profile.photoUrl) + '" alt="" id="profileAvaInner">'
        : '<span id="profileAvaInner">' + esc((_profile.nickname || "S").charAt(0).toUpperCase()) + '</span>';
}

function openProfileEditor() {
    if (!_profile) return;
    const modal = $("questModal");
    const avaHtml = _profile.photoUrl
        ? '<img src="' + esc(_profile.photoUrl) + '" alt="">'
        : esc((_profile.nickname || "S").charAt(0).toUpperCase());
    $("questModalBox").innerHTML =
        '<div class="qm-topbar"><button class="qm-close" id="qmClose" aria-label="Tutup">✕</button></div>' +
        '<div class="qm-body" style="text-align:center;">' +
        '<div class="quest-game-title">🪪 Profil Kamu</div>' +
        '<div class="quest-game-desc">Hai ' + esc(_profile.nickname || "Sahabat") + '! Atur foto, tanggal lahir, dan bio kamu di sini.</div>' +
        '<div class="pe-ava" id="peAva">' + avaHtml + '</div>' +
        '<label class="qm-file" style="margin-top:4px;">' +
        '<span class="qm-file-ic">📷</span>' +
        '<b class="qm-file-lbl">Ganti foto profil</b>' +
        '<span class="qm-file-sub">Ketuk buat pilih foto dari galeri 🖼️</span>' +
        '<input type="file" id="peFile" accept="image/*" hidden>' +
        '</label>' +
        '<div class="pe-field"><label>Nama panggilan 🏷️</label>' +
        '<input type="text" id="peNick" maxlength="30" value="' + esc(_profile.nickname || "") + '" placeholder="Nama panggilanmu"></div>' +
        '<div class="pe-field"><label>Tanggal lahir 🎂</label>' +
        '<input type="date" id="peBirth" value="' + esc((String(_profile.birthDate || "").match(/\d{4}-\d{2}-\d{2}/) || [""])[0]) + '"></div>' +
        '<div class="pe-field"><label>Bio singkat ✨</label>' +
        '<textarea id="peBio" maxlength="160" rows="3" placeholder="Ceritain dikit tentang kamu… (max 160)">' + esc(_profile.bio || "") + '</textarea></div>' +
        '<button class="btn-primary" id="peSave" style="margin-top:14px;">💾 Simpan Profil</button>' +
        '</div>';
    modal.classList.add("show");
    lockScroll();
    $("qmClose").addEventListener("click", closeQuestModal);

    let newPhoto = null;
    $("peFile").addEventListener("change", async (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        showBusy("Memproses foto…");
        try {
            newPhoto = await compressImage(f, 512, 0.8);
            $("peAva").innerHTML = '<img src="' + newPhoto.dataUrl + '" alt="">';
        } catch (err) { alert("Gagal proses foto: " + (err.message || "")); }
        finally { hideBusy(); }
    });

    $("peSave").addEventListener("click", async () => {
        const btn = $("peSave");
        const nick = $("peNick").value.trim();
        if (!nick) { alert("Nama panggilan jangan kosong ya 😊"); return; }
        const birth = $("peBirth").value.trim();
        const bio = $("peBio").value.trim();

        function applyProfileUi() {
            renderProfileAva();
            $("dashHi").textContent = "Hai, " + (_profile.nickname || "Sahabat") + "! 👋";
        }

        // ---- TANPA foto baru: optimistis — profil keganti seketika, server nyusul ----
        if (!newPhoto) {
            const prev = { nickname: _profile.nickname, birthDate: _profile.birthDate, bio: _profile.bio };
            _profile.nickname = nick;
            _profile.birthDate = birth || _profile.birthDate;
            _profile.bio = bio;
            applyProfileUi();
            fireConfetti("login");
            closeQuestModal();
            apiPost({ action: "memberUpdateProfile", token: _profile.token, nickname: nick, birthDate: birth, bio: bio }).then(r => {
                if (r.status === "success") {
                    _profile.nickname = r.nickname || _profile.nickname;
                    _profile.birthDate = r.birthDate || _profile.birthDate;
                    _profile.bio = r.bio !== undefined ? r.bio : _profile.bio;
                    applyProfileUi();
                    _galleryLoaded = false; // nickname di galeri ikut berubah -> refetch nanti
                    _lbLoaded = false; _lbData = null; // nama di leaderboard juga
                } else {
                    _profile.nickname = prev.nickname; _profile.birthDate = prev.birthDate; _profile.bio = prev.bio; // rollback
                    applyProfileUi();
                    alert(r.message || "Profil belum kesimpen 😢 Coba lagi ya.");
                }
            }).catch(() => {
                _profile.nickname = prev.nickname; _profile.birthDate = prev.birthDate; _profile.bio = prev.bio;
                applyProfileUi();
                alert("Gagal terhubung ke server. Profil belum kesimpen, coba lagi ya.");
            });
            return;
        }

        // ---- DENGAN foto baru: tetap nunggu (upload beneran) ----
        btn.disabled = true;
        showBusy("Menyimpan profil…");
        try {
            const r = await apiPost({
                action: "memberUpdateProfile", token: _profile.token,
                nickname: nick, birthDate: birth, bio: bio,
                photoBase64: newPhoto.base64, photoMime: newPhoto.mime
            });
            if (r.status !== "success") { btn.disabled = false; alert(r.message || "Gagal menyimpan."); return; }
            _profile.nickname = r.nickname || _profile.nickname;
            _profile.birthDate = r.birthDate || _profile.birthDate;
            _profile.photoUrl = r.photoUrl || _profile.photoUrl;
            _profile.bio = r.bio !== undefined ? r.bio : _profile.bio;
            applyProfileUi();
            _galleryLoaded = false; // avatar & nickname di galeri ikut berubah -> refetch nanti
            _lbLoaded = false; _lbData = null; // nama di leaderboard juga
            fireConfetti("login");
            closeQuestModal();
        } catch (e) { btn.disabled = false; alert("Gagal terhubung ke server. Coba lagi ya."); }
        finally { hideBusy(); }
    });
}

(function initProfileBtn() {
    const b = $("profileBtn");
    if (b) b.addEventListener("click", openProfileEditor);
})();

// ============================================================
//  Mochi's Corner (maskot) — pembawa surat prompt harian
// ============================================================
// Bubble pintar: Mochi jadi asisten kecil — kumpulin SEMUA pesan yang relevan
// (urut prioritas), nanti ditampilkan bergiliran. Datanya dari state client.
let _evRegistered = null; // peta event yg udah didaftar (diisi loadEvents)
let _evCounts = null;     // jumlah pendaftar per event (diisi loadEvents, buat kuota flyer)

function mochiSmartMessages() {
    const msgs = [];
    // 1) Ultah sendiri: surat spesial nunggu
    if (isMyBirthdayToday()) msgs.push("🎂 Ada surat spesial buat kamu — tap aku!");
    // 2) Ada teman ultah: ajak ngucapin
    const myNick = (_profile && _profile.nickname) || "";
    const bd = BDAY_TODAY.filter(b => b.nickname !== myNick);
    if (bd.length) msgs.push("🎈 " + bd[0].nickname + " ultah hari ini — kirim ucapan yuk!");
    // 2b) Surat bulanan belum dibaca? kabarin (excitement-nya di sini)
    try {
        const un = snailAvail().filter(l => !snailReadSet().has(l.id)).length;
        if (un) msgs.push("\ud83d\udcec Surat bulanan dari Mochi udah nyampe — buka Kotak Surat di Home!");
    } catch (e) { }
    // 3) Belum check-in minggu ini: ingetin (bawa-bawa streak biar makin kepancing)
    try {
        const records = getJournalTrackerData(_profile.wa).records || {};
        const cw = getMonthWeekObj(new Date());
        if (!records[cw.key]) {
            const streak = calculateJournalStreak(records);
            msgs.push(streak > 0
                ? "🔥 Streak " + streak + " minggu — check-in sekarang biar nggak putus!"
                : "✍️ Belum check-in minggu ini — yuk mulai streak pertamamu!");
        }
    } catch (e) { }
    // 4) SEMUA event yang lagi buka & belum didaftar diingetin satu-satu
    //    (urut dari yang paling dekat; yang tanggalnya nggak kebaca di ekor)
    try {
        const ws = (typeof WORKSHOPS !== "undefined" && Array.isArray(WORKSHOPS)) ? WORKSHOPS : [];
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const evs = [];
        ws.forEach(w => {
            if (typeof getWorkshopStatus !== "function" || getWorkshopStatus(w) !== "open") return;
            if (_evRegistered && _evRegistered[w.id]) return; // udah daftar -> nggak perlu diingetin
            const d = (typeof parseDate === "function") ? parseDate(w.eventDate) : null;
            const days = d ? Math.round((d - today) / 86400000) : null;
            if (days !== null && days < 0) return; // event udah lewat
            evs.push({ w: w, days: days });
        });
        evs.sort((a, b) => (a.days === null ? 9999 : a.days) - (b.days === null ? 9999 : b.days));
        evs.forEach(ev => {
            if (ev.days === null) {
                msgs.push("🎟️ " + (ev.w.name || "Event baru") + " lagi buka pendaftaran — cek tab Event yuk!");
            } else {
                const when = ev.days === 0 ? "HARI INI" : (ev.days === 1 ? "besok" : ev.days + " hari lagi");
                msgs.push("🎪 " + (ev.w.name || "Event") + " " + when + " — udah daftar?");
            }
        });
    } catch (e) { }
    // 4b) Cuaca hati: belum dicatat -> colek; lagi hujan/badai -> Mochi hadir nemenin
    try {
        const todayMood = moodOf(moodMonthKey(), new Date().getDate());
        if (!todayMood) msgs.push("🌦️ Cuaca hatimu hari ini belum dicatat — cerita ke Mochi yuk!");
        else if (todayMood === "hujan") msgs.push("🌧️ Hati lagi hujan ya… pelan-pelan aja hari ini. Mochi di sini 🤗");
        else if (todayMood === "badai") msgs.push("⛈️ Berat ya hari ini… Mochi nyiapin sesuatu di kartu cuacamu di Home 💙");
    } catch (e) { }
    // 5) Penutup: teaser surat harian (selalu ada di ekor rotasi)
    msgs.push("💌 Baca surat dari Mochi");
    return msgs;
}

// Rotasi bubble: tampilkan pesan relevan bergiliran (~7 dtk per pesan), sekali per sesi.
// List dibangun ulang tiap giliran biar data yang nyusul ke-load (mis. registrasi
// event) langsung kepakai.
function startMochiBubbles() {
    const mb = $("mochiBubble");
    if (!mb || mb._teased) return;
    mb._teased = true;
    const shown = [];
    function next() {
        const msg = mochiSmartMessages().find(m => shown.indexOf(m) < 0);
        if (!msg) { mb.classList.remove("show"); return; }
        shown.push(msg);
        mb.textContent = msg;
        mb.classList.add("show");
        setTimeout(() => {
            mb.classList.remove("show");
            // jeda antar pesan biar kerasa "ganti", bukan teks loncat
            setTimeout(next, 2000);
        }, 6200);
    }
    next();
}
(function initMochi() {
    const wrap = $("mochiAvatar");
    if (!wrap) return;
    wrap.addEventListener("click", () => {
        const h = document.createElement("span");
        h.className = "mochi-heart";
        h.textContent = "💌";
        h.style.left = (Math.random() * 34 + 12) + "px";
        wrap.appendChild(h);
        setTimeout(() => { if (h.parentNode) h.parentNode.removeChild(h); }, 800);
        wrap.style.transform = "scale(1.15) rotate(6deg)";
        setTimeout(() => { wrap.style.transform = ""; }, 150);
        openMochiPrompt();
    });
})();

// ---------- Mochi si Penjaga Balai: pelari misterius pembawa Surat Nyasar ----------
// Sesekali lari melintas layar bawa 💌 — ketangkep (di-tap) = prompt kejutan acak.
// Max 3x per sesi, nggak muncul pas ada modal kebuka.
let _mochiRuns = 0;
let _mochiSched = false;

function scheduleMochi() {
    if (_mochiRuns >= 3) return;
    const delay = (_mochiRuns === 0 ? 25000 : 150000) + Math.random() * 60000;
    setTimeout(spawnMochi, delay);
}

function spawnMochi() {
    if (_mochiRuns >= 3) return;
    // lagi ada modal kebuka / masih di halaman login? coba lagi nanti
    if (document.body.style.position === "fixed" || $("dashView").style.display === "none") { scheduleMochi(); return; }
    _mochiRuns++;
    const el = document.createElement("button");
    el.className = "mochi-run";
    el.setAttribute("aria-label", "Mochi bawa surat nyasar — tangkap!");
    el.innerHTML = '<span class="mochi-catch">💌 Tangkap aku!</span><img src="../images/sticker/str-6.png" alt="">';
    document.body.appendChild(el);
    el.addEventListener("animationend", () => {
        if (el.parentNode) el.parentNode.removeChild(el); // lolos... balik lagi nanti
        scheduleMochi();
    });
    el.addEventListener("click", () => {
        if (el.parentNode) el.parentNode.removeChild(el);
        playSfx("catch-mochi");
        openStrayLetter();
        scheduleMochi();
    }, { once: true });
}

// Bisik-bisik Balai: fakta seru komunitas, dirakit dari data yang UDAH ada di
// client (galeri, leaderboard, mading, streak) — beda-beda tiap saat, nol request.
function balaiWhispers(ctx) {
    const out = [];
    const now = Date.now();
    const WEEK = 7 * 86400000;
    try {
        const recent = (_galleryItems || []).filter(it => it.ts && (now - it.ts) < WEEK);
        if (recent.length) out.push("Ada " + recent.length + " karya baru minggu ini di galeri — udah lihat semua? 👀");
        const cnt = {};
        recent.forEach(it => { if (it.nickname && it.nickname !== "Seminggu Satu") cnt[it.nickname] = (cnt[it.nickname] || 0) + 1; });
        const busiest = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
        if (busiest && cnt[busiest] >= 2) out.push("Psst… minggu ini " + busiest + " paling rajin — " + cnt[busiest] + " karya! 👏");
        const loved = (_galleryItems || []).filter(it => (it.likes || 0) > 0).sort((a, b) => (b.likes || 0) - (a.likes || 0))[0];
        if (loved) out.push("Karya paling disayang se-Balai saat ini punya " + loved.nickname + " — " + loved.likes + " ❤️");
    } catch (e) { }
    try {
        if (_lbData && _lbData.top && _lbData.top[0]) out.push("Psst… " + _lbData.top[0].nickname + " lagi di puncak leaderboard dengan " + _lbData.top[0].poin + " poin ⚡ Kejar yuk!");
        if (_lbData && _lbData.me && _lbData.me.rank) out.push("Peringkat #" + _lbData.me.rank + " dari " + _lbData.me.total + "… satu karya lagi bisa nyalip nih 👀");
        if (_lbData && _lbData.topEvents && _lbData.topEvents[0]) out.push(_lbData.topEvents[0].nickname + " paling sering dateng event — " + _lbData.topEvents[0].events + " kali! Setia banget 💙");
    } catch (e) { }
    try {
        const streak = calculateJournalStreak(getJournalTrackerData(_profile.wa).records || {});
        if (streak > 0) out.push("Streak journaling-mu " + streak + " minggu 🔥 Jangan sampe putus ya!");
    } catch (e) { }
    try {
        // nggak relevan kalau lagi DI mading (ya jelas dia lagi baca)
        if (ctx !== "mading" && _boardData && _boardData.items && _boardData.items.length) out.push(_boardData.items.length + " pesan semangat nempel di Mading Warga — udah mampir baca? 📌");
    } catch (e) { }
    try {
        if (_questChallenges.length) {
            const undone = _questChallenges.length - _questSubmitted.length;
            if (undone > 0) out.push("Masih ada " + undone + " challenge yang belum kamu sentuh… Mochi nungguin karyamu 🎯");
            else out.push("Kamu udah nyelesain SEMUA challenge — legend! 🏆");
        }
    } catch (e) { }
    if (!out.length) out.push("Balai lagi hangat-hangatnya — makasih udah jadi bagian dari sini 💙");
    return out;
}

// Surat Nyasar: bisik-bisik komunitas dari Mochi (hadiah nangkep dia)
function openStrayLetter() {
    fireConfetti("love");
    let modal = $("mochiModal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "mochiModal";
        modal.className = "mochi-modal";
        document.body.appendChild(modal);
        modal.addEventListener("click", (e) => { if (e.target === modal) closeMochiPrompt(); });
    }
    const whispers = balaiWhispers();
    const pick = whispers[Math.floor(Math.random() * whispers.length)];
    modal.innerHTML =
        '<div class="mochi-box">' +
        '<button class="mp-close" id="mpClose" aria-label="Tutup">✕</button>' +
        '<img class="mp-imgstk" src="../images/sticker/str-6.png" style="width:64px;bottom:8px;right:8px;transform:rotate(10deg);" alt="">' +
        '<div class="mp-head">💌 Surat Nyasar!</div>' +
        '<div class="mp-sub">Kamu berhasil nangkep Mochi si Penjaga Balai — dia bawa bisik-bisik seru~</div>' +
        '<div class="mp-card fortune pop" id="mpCard" style="margin-top:16px;">' +
        '<img class="mp-mochi" src="../images/mochi_maskot_sm.png" alt="">' +
        '<div class="mp-kicker">SURAT NYASAR · RAHASIA BALAI ✨</div>' +
        '<div><span class="mp-cat">📣 Bisik-bisik Balai</span></div>' +
        '<div class="mp-text" id="mpText">“' + esc(pick) + '”</div>' +
        '<div class="mp-actions">' +
        '<button class="mp-btn" id="slClose">Makasih, Mochi! 🐾</button>' +
        '</div>' +
        '</div>' +
        '</div>';
    modal.classList.add("show");
    lockScroll();
    $("mpClose").addEventListener("click", closeMochiPrompt);
    $("slClose").addEventListener("click", closeMochiPrompt);
}

// ---------- Journaling Prompt (mystery envelope gacha, data: list_prompt.json) ----------
let _prompts = null;
let _mpLastId = 0;

// Prompt dimuat via <script> injection (bukan fetch) biar jalan juga di file:// lokal.
function loadPrompts() {
    if (_prompts) return Promise.resolve(_prompts);
    if (Array.isArray(window.SS_PROMPTS) && window.SS_PROMPTS.length) {
        _prompts = window.SS_PROMPTS;
        return Promise.resolve(_prompts);
    }
    return new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "list_prompt.js";
        s.onload = () => {
            if (Array.isArray(window.SS_PROMPTS) && window.SS_PROMPTS.length) { _prompts = window.SS_PROMPTS; resolve(_prompts); }
            else reject(new Error("daftar prompt kosong"));
        };
        s.onerror = () => reject(new Error("gagal load daftar prompt"));
        document.body.appendChild(s);
    });
}

// Prompt harian: deterministik per tanggal (sehari sama terus, besok ganti — vibe gacha harian)
function dailyPrompt(list) {
    const d = new Date();
    let seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    seed = (seed * 9301 + 49297) % 233280;
    return list[seed % list.length];
}

function randomPrompt(list) {
    const it = list[Math.floor(Math.random() * list.length)];
    if (list.length > 1 && it.id === _mpLastId) return randomPrompt(list); // jangan dobel berturut-turut
    return it;
}

// ---------- Fortune Cookie (data: list_fortune.js, pola sama kayak prompt) ----------
let _fortunes = null;
let _fcLastId = 0;

function loadFortunes() {
    if (_fortunes) return Promise.resolve(_fortunes);
    if (Array.isArray(window.SS_FORTUNES) && window.SS_FORTUNES.length) {
        _fortunes = window.SS_FORTUNES;
        return Promise.resolve(_fortunes);
    }
    return new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "list_fortune.js";
        s.onload = () => {
            if (Array.isArray(window.SS_FORTUNES) && window.SS_FORTUNES.length) { _fortunes = window.SS_FORTUNES; resolve(_fortunes); }
            else reject(new Error("daftar fortune kosong"));
        };
        s.onerror = () => reject(new Error("gagal load daftar fortune"));
        document.body.appendChild(s);
    });
}

// Fortune harian deterministik (formula beda dari prompt biar nggak sejalan)
function dailyFortune(list) {
    const d = new Date();
    let seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    seed = (seed * 7901 + 29573) % 233280;
    return list[seed % list.length];
}

function randomFortune(list) {
    const it = list[Math.floor(Math.random() * list.length)];
    if (list.length > 1 && it.id === _fcLastId) return randomFortune(list);
    return it;
}

function fortuneCatLabel(c) {
    return {
        mochi_hug: "🐾 Pelukan Mochi",
        encouragement: "💪 Penyemangat",
        self_love: "💗 Self-Love",
        wisdom: "🦉 Kata Bijak"
    }[c] || "🥠 Fortune";
}

async function openMochiPrompt() {
    showBusy("Mochi lagi nyiapin surat…");
    let list;
    try { list = await loadPrompts(); }
    catch (e) { hideBusy(); alert("Gagal ngambil daftar prompt 😢 Coba lagi ya."); return; }
    hideBusy();

    let modal = $("mochiModal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "mochiModal";
        modal.className = "mochi-modal";
        document.body.appendChild(modal);
        modal.addEventListener("click", (e) => { if (e.target === modal) closeMochiPrompt(); });
    }
    // Selalu tampil menu pilihan: Prompt Harian + Fortune Cookie (+ Surat Ultah pas ultah)
    renderMochiChooser(modal, list);
    modal.classList.add("show");
    lockScroll();
}

// Menu hadiah Mochi: pilih mau dibawain apa hari ini
// ---------- Cuaca Hati: mood check-in harian bareng Mochi 🌦️ ----------
// Kesimpen di localStorage per bulan: ss_mood = { "2026-07": { "26": "cerah" } }
const MOODS = [
    { k: "cerah", e: "☀️", t: "Cerah", d: "senang & semangat" },
    { k: "berawan", e: "⛅", t: "Berawan", d: "biasa aja / so-so" },
    { k: "hujan", e: "🌧️", t: "Hujan", d: "sedih / mellow" },
    { k: "badai", e: "⛈️", t: "Badai", d: "marah / kewalahan" },
    { k: "pelangi", e: "🌈", t: "Pelangi", d: "lega & bersyukur" }
];
function moodStore() {
    try { return JSON.parse(localStorage.getItem("ss_mood") || "{}") || {}; } catch (e) { return {}; }
}
function moodMonthKey(d) {
    const x = d || new Date();
    return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0");
}
function moodSave(day, k) {
    try {
        const s = moodStore();
        const mk = moodMonthKey();
        s[mk] = s[mk] || {};
        s[mk][String(day)] = k;
        localStorage.setItem("ss_mood", JSON.stringify(s)); // optimistis: UI langsung keisi
    } catch (e) { }
    // sinkron ke server (kolom moodRecords) — lintas device/browser/PWA
    apiPost({ action: "memberSetMood", token: _profile.token, mood: k }).then(r => {
        if (r && r.status === "success" && r.moodRecords) {
            try { localStorage.setItem("ss_mood", r.moodRecords); } catch (e) { }
        }
    }).catch(() => { }); // gagal sinkron (offline) = catatan tetap aman di lokal (di-merge pas login, nggak ketimpa)
}
function moodOf(mk, day) {
    const s = moodStore();
    return (s[mk] || {})[String(day)] || "";
}
// grid kalender mood 1 bulan (7 kolom); mk = "YYYY-MM"
function moodGridHtml(mk, small) {
    const m = mk.match(/^(\d{4})-(\d{2})$/);
    if (!m) return "";
    const year = +m[1], mon = +m[2] - 1;
    const days = new Date(year, mon + 1, 0).getDate();
    const rec = moodStore()[mk] || {};
    const now = new Date();
    const isCurMonth = moodMonthKey(now) === mk;
    let cells = "";
    for (let d = 1; d <= days; d++) {
        const mood = MOODS.find(x => x.k === rec[String(d)]);
        const future = isCurMonth && d > now.getDate();
        cells += '<span class="mg-cell' + (mood ? " on" : "") + (future ? " fut" : "") + '">' +
            (mood ? mood.e : '<i>' + d + '</i>') + '</span>';
    }
    return '<div class="mg-grid' + (small ? " sm" : "") + '">' + cells + '</div>';
}

// Respons Mochi per cuaca: validasi perasaan + micro-prompt journaling + aksi lanjutan.
// 3 variasi per cuaca, dipilih seeded per tanggal biar nggak monoton.
const MOOD_CARE = {
    cerah: {
        g: [
            { e: "🍭", t: "Permen ekstra — hari manis pantes ditambah manis" },
            { e: "🌻", t: "Bunga matahari, buat yang lagi ikut bersinar" },
            { e: "📸", t: "Kamera bekas Mochi — abadikan harinya!" }
        ],
        v: ["Ikut seneng! Simpan energinya ya ☀️", "Cerah gini nular ke se-Balai loh 😄", "Mantep — ini hari yang layak diinget"],
        p: ["Apa 1 hal yang bikin hari ini cerah? Tulis, biar bisa dibaca ulang pas mendung.", "Siapa yang ikut andil bikin harimu enak? Bilang makasih yuk.", "Energi lagi penuh — hal kecil apa yang mau kamu selesain hari ini?"],
        cta: { t: "✍️ Abadikan di jurnal", act: "prompt" }
    },
    berawan: {
        g: [
            { e: "🍪", t: "Cemilan buat nemenin hari yang biasa-biasa aja" },
            { e: "🧦", t: "Kaos kaki hangat — hari abu-abu butuh yang empuk" },
            { e: "🎈", t: "Balon kecil, biar hatinya agak ringan" }
        ],
        v: ["Hari biasa juga tetap berarti kok ⛅", "Nggak semua hari harus spesial — hadir aja udah cukup", "Pelan-pelan aja, awannya juga jalan kok"],
        p: ["Tulis 3 hal kecil yang 'lumayan' hari ini.", "Kalau harimu adalah lagu, kira-kira judulnya apa?", "Apa 1 hal yang lagi kamu tunggu minggu ini?"],
        cta: { t: "✍️ Pancing pelan-pelan", act: "prompt" }
    },
    hujan: {
        g: [
            { e: "🍦", t: "Es krim buat yang lagi hujan-hujanan. Dingin, tapi manis — kayak nangis terus lega" },
            { e: "☕", t: "Cokelat hangat. Pegang pakai dua tangan ya" },
            { e: "🧸", t: "Temen peluk buat malam ini — dia pendengar yang baik" }
        ],
        v: ["Nggak apa-apa sedih. Nangis juga boleh 💧", "Peluk dulu 🤗 kamu nggak sendirian di hujan ini", "Sedihmu valid — nggak usah buru-buru cerah"],
        p: ["Kalau sedihnya bisa ngomong, dia mau bilang apa?", "Tulis surat pendek buat dirimu yang lagi hujan-hujanan ini.", "Apa yang biasanya bikin kamu hangat pas begini? Boleh banget dilakuin sekarang."],
        cta: { t: "🤗 Ambil pelukan kata", act: "hug" }
    },
    badai: {
        g: [
            { e: "🍵", t: "Teh anget. Seruput pelan… perangnya bisa nanti" },
            { e: "🎧", t: "Headphone — biar badainya ketutup suara hujan yang tenang" },
            { e: "🧋", t: "Boba dulu. Nggak nyelesain masalah, tapi nemenin" }
        ],
        v: ["Tarik napas dulu… badai selalu lewat ⛈️→🌤️", "Marah atau kewalahan itu sinyal, bukan aib", "Satu-satu aja — nggak semua harus beres sekarang"],
        p: ["Tumpahin semua yang bikin penuh ke satu halaman — berantakan juga gapapa.", "Apa 1 hal KECIL yang masih bisa kamu pegang kendalinya sekarang?", "Mulai dari 'aku kewalahan karena…' dan biarin jujur."],
        cta: { t: "🗑️ Tumpahin dulu ke kertas", act: "tulis" } // habis sobek baru ditawarin napas (release -> regulate)
    },
    pelangi: {
        g: [
            { e: "🏅", t: "Medali 'udah ngelewatin' — dipakai di hati aja" },
            { e: "🧁", t: "Cupcake perayaan kecil. Lega itu layak dirayain" },
            { e: "🎁", t: "Kado kecil: isinya rasa bangga dari Mochi" }
        ],
        v: ["Lega ya rasanya 🌈 Selamat udah ngelewatin!", "Momen kayak gini layak dirayain", "Habis hujan emang gitu — nikmatin pelanginya"],
        p: ["Apa yang tadinya berat dan sekarang udah lewat? Tulis — itu bukti kamu bisa.", "Resep pelangimu apa? Catat biar bisa dipakai lagi.", "Siapa atau apa yang bantu kamu sampai di titik lega ini?"],
        cta: { t: "📌 Bagi semangat ke Mading", act: "mading" }
    }
};

// ---------- Napas bareng Mochi: 3 putaran 4-7-8 ----------
function renderBreath(modal) {
    modal.innerHTML =
        '<div class="mochi-box">' +
        '<button class="mp-close" id="mpClose" aria-label="Tutup">✕</button>' +
        '<div class="mp-head">🌬️ Napas Bareng Mochi</div>' +
        '<div class="mp-sub">Ikutin lingkarannya — 3 putaran aja, pelan-pelan</div>' +
        '<div class="br-scene"><div class="br-circle" id="brCircle"><img src="../images/sticker/str-6.png" alt=""></div></div>' +
        '<div class="br-text" id="brText">Siap? Duduk yang nyaman dulu 🪑</div>' +
        '<div class="mp-actions"><button class="mp-btn" id="brStart">Mulai 🌬️</button>' +
        '<button class="mp-btn ghost" id="brBack">← Balik</button></div>' +
        '</div>';
    // suara napas (~5.1s = tarik + hembus): diputar UTUH per siklus, tanpa jeda —
    // fase "tahan" dihapus (motong audio & bikin kepatah-patah)
    let brAudio = null;
    function brSound(actn) {
        if (sndMuted()) return;
        try {
            if (!brAudio) brAudio = new Audio("../sound-effect/breath.mp3");
            if (actn === "start") { brAudio.currentTime = 0; brAudio.play().catch(() => { }); }
            else if (actn === "stop") { brAudio.pause(); brAudio.currentTime = 0; }
        } catch (e) { }
    }
    $("mpClose").addEventListener("click", () => { brSound("stop"); closeMochiPrompt(); });
    $("brBack").addEventListener("click", () => { brSound("stop"); openMoodTracker(modal); });
    const circle = $("brCircle"), txt = $("brText");
    const PHASES = [
        { t: "Tarik napas… 👃", ms: 2500, s: 1.35, a: "start" },
        { t: "Hembusin pelan… 🌬️", ms: 2600, s: 1, a: "" }
    ];
    function run(cycle, pi) {
        if (!circle.isConnected) { brSound("stop"); return; } // modal pindah view -> stop
        if (cycle >= 3) {
            txt.textContent = "Selesai. Kepala udah agak lega? 💙";
            circle.classList.add("done");
            playSfx("love", 0.6);
            const st = $("brStart");
            if (st) { st.textContent = "Sekali lagi 🔁"; st.disabled = false; }
            return;
        }
        const ph = PHASES[pi];
        txt.textContent = ph.t + "  (" + (cycle + 1) + "/3)";
        if (ph.a) brSound(ph.a);
        circle.style.transition = "transform " + ph.ms + "ms ease-in-out";
        circle.style.transform = "scale(" + ph.s + ")";
        setTimeout(() => run(pi === 1 ? cycle + 1 : cycle, (pi + 1) % 2), ph.ms);
    }
    $("brStart").addEventListener("click", () => {
        $("brStart").disabled = true;
        circle.classList.remove("done");
        circle.style.transform = "scale(1)";
        run(0, 0);
    });
}

// ---------- "Kamu pernah lewatin ini" 🌈 ----------
// Nyari bukti PULIH paling baru dari riwayat mood-nya sendiri: rentetan hari
// berat (hujan/badai) yang disusul hari baik (pelangi/cerah). Self-evidence
// buat ngelawan perasaan "nggak akan membaik".
function moodEvidence() {
    const s = moodStore();
    const entries = [];
    Object.keys(s).sort().forEach(mk => {
        const m = mk.match(/^(\d{4})-(\d{2})$/);
        if (!m) return;
        Object.keys(s[mk]).forEach(d => {
            entries.push({ mo: +m[2], d: +d, k: s[mk][d], t: new Date(+m[1], +m[2] - 1, +d).getTime() });
        });
    });
    entries.sort((a, b) => a.t - b.t);
    const BAD = { hujan: 1, badai: 1 }, GOOD = { pelangi: 1, cerah: 1 };
    const todayT = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();
    let best = null;
    for (let i = 1; i < entries.length; i++) {
        if (!GOOD[entries[i].k] || entries[i].t >= todayT) continue;
        let n = 0, j = i - 1;
        while (j >= 0 && BAD[entries[j].k]) { n++; j--; }
        if (n >= 1) best = { n: n, g: entries[i] }; // terus di-overwrite -> dapet yang paling recent
    }
    if (!best) return "";
    const mo = MOODS.find(x => x.k === best.g.k) || MOODS[0];
    return "Inget " + best.g.d + " " + BULAN_ID[best.g.mo - 1] + "? Habis " + best.n + " hari berat" + (best.n > 1 ? " berturut-turut" : "") +
        ", kamu nyatet " + mo.t.toLowerCase() + " " + mo.e + " — kamu pernah lewatin ini, dan bisa lagi.";
}

// ---------- Tulis Lepas + Sobek 🗑️ (expressive writing ala Pennebaker) ----------
// Nulis bebas tentang yang paling berat, terus DIROBEK. Nggak disimpen di mana
// pun (nggak ke localStorage, nggak ke server) — manfaatnya di proses nulisnya,
// dan jaminan tanpa jejak itu yang bikin berani jujur.
function renderTulisLepas(modal) {
    modal.innerHTML =
        '<div class="mochi-box">' +
        '<button class="mp-close" id="mpClose" aria-label="Tutup">✕</button>' +
        '<div class="mp-head">🗑️ Tulis Lepas</div>' +
        '<div class="mp-sub">Tumpahin yang paling berat. Habis ini dirobek — nggak disimpen, nggak dibaca siapa pun. Termasuk Mochi.</div>' +
        '<div class="tl-stage" id="tlStage">' +
        '<textarea id="tlInput" class="tl-input" rows="7" placeholder="Tulis aja semuanya… boleh marah, boleh ngumpat, boleh CAPS LOCK SEMUA. Ini cuma antara kamu dan kertas ini."></textarea>' +
        '</div>' +
        '<div class="mp-actions" id="tlActions">' +
        '<button class="mp-btn" id="tlShred" disabled>🗑️ SOBEK</button>' +
        '</div>' +
        '</div>';
    $("mpClose").addEventListener("click", closeMochiPrompt);
    const input = $("tlInput"), shred = $("tlShred"), stage = $("tlStage");
    // sependek apa pun boleh disobek — kadang "ANJIR" doang udah cukup 😄
    input.addEventListener("input", () => { shred.disabled = input.value.trim().length < 1; });
    setTimeout(() => input.focus(), 250);
    shred.addEventListener("click", () => {
        const text = input.value; // cuma buat ditampilin sesaat pas dirobek — abis itu musnah
        playSfx("flip", 1);
        // kertas berisi tulisannya dibelah dua (tepi zigzag) terus jatuh
        stage.innerHTML =
            '<div class="tl-paper tl-half l"><pre>' + esc(text) + '</pre></div>' +
            '<div class="tl-paper tl-half r"><pre>' + esc(text) + '</pre></div>';
        $("tlActions").style.visibility = "hidden";
        setTimeout(() => {
            stage.innerHTML =
                '<div class="tl-after">' +
                '<div class="tl-after-em">💨</div>' +
                '<div class="tl-after-t">Udah keluar, udah dirobek.</div>' +
                '<div class="tl-after-s">Nggak ada jejaknya — beneran. Lega dikit?</div>' +
                '</div>';
            $("tlActions").style.visibility = "";
            $("tlActions").innerHTML =
                '<button class="mp-btn ghost" id="tlAgain">✍️ Tulis lagi</button>' +
                '<button class="mp-btn" id="tlBreath">🌬️ Napas dulu</button>';
            playSfx("shine", 0.6);
            $("tlAgain").addEventListener("click", () => renderTulisLepas(modal));
            $("tlBreath").addEventListener("click", () => renderBreath(modal));
        }, 950);
    });
}

// buka Cuaca Hati langsung (dari widget Home) — tanpa lewat chooser
function openMoodDirect() {
    let modal = $("mochiModal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "mochiModal";
        modal.className = "mochi-modal";
        document.body.appendChild(modal);
        modal.addEventListener("click", (e) => { if (e.target === modal) closeMochiPrompt(); });
    }
    openMoodTracker(modal);
    modal.classList.add("show");
    lockScroll();
}

// ---------- Widget cuaca hati di Home (ala weather app) ----------
function moodWidgetHtml() {
    const today = new Date().getDate();
    const picked = moodOf(moodMonthKey(), today);
    if (!picked) {
        return '<button type="button" class="mood-w empty" id="moodWidget">' +
            '<span class="mw-em">🌦️</span>' +
            '<span class="mw-body"><span class="mw-t">Mochi pengen tau cuaca hatimu hari ini</span>' +
            '<span class="mw-s">Cerah? Hujan? Cerita dikit yuk</span></span>' +
            '<span class="mw-go">catat →</span>' +
            '</button>';
    }
    const mo = MOODS.find(x => x.k === picked) || MOODS[0];
    const care = MOOD_CARE[picked];
    const seed = today + new Date().getMonth();
    const line = care ? care.v[seed % care.v.length] : "";
    return '<button type="button" class="mood-w mw-' + mo.k + '" id="moodWidget">' +
        '<span class="mw-em big">' + mo.e + '</span>' +
        '<span class="mw-body"><span class="mw-k">CUACA HATIMU HARI INI</span>' +
        '<span class="mw-t">' + mo.t + ' · ' + esc(mo.d) + '</span>' +
        (line ? '<span class="mw-s">' + esc(line) + '</span>' : '') + '</span>' +
        '</button>';
}
function refreshMoodWidget() {
    const slot = $("moodSlot");
    if (!slot) return;
    slot.innerHTML = moodWidgetHtml();
    const w = $("moodWidget");
    if (w) w.addEventListener("click", openMoodDirect);
}

function openMoodTracker(modal, justPicked) {
    const today = new Date().getDate();
    const mk = moodMonthKey();
    const picked = moodOf(mk, today);
    let btns = "";
    MOODS.forEach(mo => {
        btns += '<button type="button" class="mood-btn' + (picked === mo.k ? " on" : "") + '" data-mood="' + mo.k + '">' +
            '<span class="mood-e">' + mo.e + '</span><span class="mood-t">' + mo.t + '</span>' +
            '<span class="mood-d">' + mo.d + '</span></button>';
    });
    const rec = moodStore()[mk] || {};
    const cnt = Object.keys(rec).length;
    // respons Mochi buat cuaca yang dipilih (validasi + prompt + aksi) — seeded per hari
    let respHtml = "";
    if (picked && MOOD_CARE[picked]) {
        const care = MOOD_CARE[picked];
        const seed = new Date().getDate() + new Date().getMonth();
        const val = care.v[seed % care.v.length];
        const pr = care.p[seed % care.p.length];
        const gift = care.g[seed % care.g.length];
        const evi = (picked === "hujan" || picked === "badai") ? moodEvidence() : "";
        respHtml = '<div class="mood-resp">' +
            '<div class="mr-gift' + (justPicked ? " pop" : "") + '">' +
            '<span class="mrg-from">🐾 Mochi ngasih ini buat kamu:</span>' +
            '<span class="mrg-item">' + gift.e + '</span>' +
            '<span class="mrg-note">“' + esc(gift.t) + '”</span>' +
            '</div>' +
            '<div class="mr-v">' + esc(val) + '</div>' +
            (evi ? '<div class="mr-evi">🌈 <b>Bukti dari kamu sendiri:</b> ' + esc(evi) + '</div>' : '') +
            '<div class="mr-p">✍️ <i>' + esc(pr) + '</i></div>' +
            '<button type="button" class="mp-btn mr-cta" id="mrCta">' + care.cta.t + '</button>' +
            '</div>';
    }
    modal.innerHTML =
        '<div class="mochi-box">' +
        '<button class="mp-close" id="mpClose" aria-label="Tutup">✕</button>' +
        '<img class="mp-imgstk" src="../images/sticker/str-1.png" style="width:56px;bottom:8px;left:6px;transform:rotate(-9deg);" alt="">' +
        '<div class="mp-head">🌦️ Cuaca Hati Hari Ini</div>' +
        '<div class="mp-sub">' + (picked ? "Udah dicatat — boleh diganti kalau cuacanya berubah 😉" : "Hari ini hatimu lagi cuaca apa?") + '</div>' +
        '<div class="mood-row">' + btns + '</div>' +
        respHtml +
        '<div class="mood-cal">' +
        '<div class="mood-cal-t">📓 ' + esc(BULAN_ID[new Date().getMonth()]) + ' — ' + cnt + ' hari tercatat</div>' +
        moodGridHtml(mk) +
        '</div>' +
        '</div>';
    $("mpClose").addEventListener("click", closeMochiPrompt);
    modal.querySelectorAll(".mood-btn").forEach(b => b.addEventListener("click", () => {
        moodSave(today, b.dataset.mood);
        openMoodTracker(modal, true); // re-render + hadiah Mochi nge-pop
        refreshMoodWidget();          // display cuaca di Home ikut ganti
        setTimeout(() => playSfx("shine", 0.7), 150); // kilau pas hadiahnya muncul
    }));
    const cta = $("mrCta");
    if (cta && picked && MOOD_CARE[picked]) {
        const act = MOOD_CARE[picked].cta.act;
        cta.addEventListener("click", async () => {
            if (act === "tulis") { renderTulisLepas(modal); return; }
            if (act === "breath") { renderBreath(modal); return; }
            if (act === "mading") { closeMochiPrompt(); openMadingModal(); return; }
            if (act === "hug") {
                showBusy("Mochi lagi ngambil kue…");
                try { await loadFortunes(); } catch (e) { hideBusy(); alert("Gagal ngambil kue-nya 😢"); return; }
                hideBusy();
                renderFortuneScene(modal, null, false, "mochi_hug"); // kue khusus pelukan
                return;
            }
            // default: prompt harian
            showBusy("Mochi lagi nyiapin surat…");
            try {
                const list = await loadPrompts();
                hideBusy();
                renderMochiEnvelope(modal, list, "prompt");
            } catch (e) { hideBusy(); alert("Gagal ngambil prompt 😢 Coba lagi ya."); }
        });
    }
}

function renderMochiChooser(modal, list) {
    const bday = isMyBirthdayToday();
    modal.innerHTML =
        '<div class="mochi-box">' +
        '<button class="mp-close" id="mpClose" aria-label="Tutup">✕</button>' +
        '<img class="mp-imgstk" src="../images/sticker/str-6.png" style="width:62px;bottom:8px;left:6px;transform:rotate(-8deg);" alt="">' +
        '<img class="mp-imgstk" src="../images/sticker/str-7.png" style="width:58px;bottom:10px;right:8px;transform:rotate(11deg);" alt="">' +
        '<div class="mp-head">' + (bday ? "🎂 Mochi bawa banyak hadiah!" : "🐾 Mochi bawa apa hari ini?") + '</div>' +
        '<div class="mp-sub">' + (bday ? "Hari spesial! Mau buka yang mana dulu?" : "Ambil yang kamu butuh — semuanya juga boleh 😉") + '</div>' +
        '<div class="mp-choose">' +
        (bday ? '<button class="mp-choice mc-bday" id="mcBday"><span class="mc-em">🎂</span><b>Surat Ultah</b><span>spesial hari ini ✨</span></button>' : '') +
        '<button class="mp-choice" id="mcPrompt"><span class="mc-em">✍️</span><b>Prompt Harian</b><span>ide journaling</span></button>' +
        '<button class="mp-choice cookie" id="mcCookie"><span class="mc-em">🥠</span><b>Fortune Cookie</b><span>pesan manis buatmu</span></button>' +
        '</div>' +
        '</div>';
    // Napas Bareng & Tulis Lepas sengaja NGGAK ada di sini — mereka kejutan yang
    // muncul sebagai CTA pas nyatet cuaca hati (badai -> tumpahin -> napas)
    $("mpClose").addEventListener("click", closeMochiPrompt);
    const mcB = $("mcBday");
    if (mcB) mcB.addEventListener("click", () => renderMochiEnvelope(modal, list, "bday"));
    $("mcPrompt").addEventListener("click", () => renderMochiEnvelope(modal, list, "prompt"));
    $("mcCookie").addEventListener("click", () => openFortune(modal, list));
}

async function openFortune(modal, list) {
    showBusy("Mochi lagi ngambil kue…");
    try { await loadFortunes(); } catch (e) { hideBusy(); alert("Gagal ngambil kue-nya 😢 Coba lagi ya."); return; }
    hideBusy();
    renderFortuneScene(modal, list);
}

// Scene fortune cookie: kue goyang-goyang -> diketuk -> pecah -> strip kertas keluar.
// again=true (dari tombol "Kue lagi"): ulang ritual dari awal, isinya fortune acak.
function renderFortuneScene(modal, list, again, cat) {
    modal.innerHTML =
        '<div class="mochi-box">' +
        '<button class="mp-close" id="mpClose" aria-label="Tutup">✕</button>' +
        '<img class="mp-imgstk" src="../images/sticker/str-3.png" style="width:60px;bottom:8px;left:6px;transform:rotate(-10deg);" alt="">' +
        '<img class="mp-imgstk" src="../images/sticker/str-11.png" style="width:56px;bottom:10px;right:8px;transform:rotate(11deg);" alt="">' +
        '<div class="mp-head">🥠 Fortune Cookie dari Mochi</div>' +
        '<div class="mp-sub">Pecahin kuenya — ada pesan manis di dalamnya~</div>' +
        '<div class="fc-scene" id="fcScene">' +
        '<button class="fc-cookie" id="fcCookie" aria-label="Pecahin fortune cookie">🥠</button>' +
        '<div class="env-hint">ketuk kue-nya buat mecahin 🥠</div>' +
        '</div>' +
        '<div class="mp-card fortune" id="mpCard" style="display:none;">' +
        '<img class="mp-mochi" src="../images/mochi_maskot_sm.png" alt="">' +
        '<div class="mp-kicker" id="mpKicker"></div>' +
        '<div><span class="mp-cat" id="mpCat"></span></div>' +
        '<div class="mp-text" id="mpText"></div>' +
        '<div class="mp-actions" id="mpActions"></div>' +
        '</div>' +
        '</div>';
    $("mpClose").addEventListener("click", closeMochiPrompt);

    const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    const dateStr = now.getDate() + " " + MON[now.getMonth()] + " " + now.getFullYear();
    function showFortune(it, isDaily) {
        _fcLastId = it.id;
        $("mpKicker").textContent = (isDaily ? "FORTUNE HARI INI · " : "FORTUNE · ") + dateStr;
        $("mpCat").textContent = fortuneCatLabel(it.category);
        $("mpText").textContent = "“" + it.message + "”";
        const card = $("mpCard");
        card.classList.remove("pop");
        void card.offsetWidth;
        card.classList.add("pop");
    }

    const cookie = $("fcCookie");
    let cracked = false;
    cookie.addEventListener("click", () => {
        if (cracked) return;
        cracked = true;
        playSfx("open-cookie");
        cookie.classList.add("crack");
        if (typeof confetti === "function") setTimeout(() => fireConfetti("quest"), 450);
        setTimeout(() => {
            $("fcScene").style.display = "none";
            $("mpCard").style.display = "block";
            const pool = cat ? _fortunes.filter(f => f.category === cat) : _fortunes;
            if (again || cat) showFortune(randomFortune(pool.length ? pool : _fortunes), false);
            else showFortune(dailyFortune(_fortunes), true);
            $("mpActions").innerHTML =
                '<button class="mp-btn ghost" id="fcCopy">📋 Salin</button>' +
                '<button class="mp-btn" id="fcAgain">🥠 Kue lagi</button>' +
                '<button class="mp-btn ghost" id="fcPrompt" style="flex:1 1 100%;">✍️ Baca Prompt Harian</button>';
            // "Kue lagi" = ulang ritualnya dari awal (kue muncul -> ketuk -> pecah)
            $("fcAgain").addEventListener("click", () => renderFortuneScene(modal, list, true, cat));
            $("fcPrompt").addEventListener("click", () => renderMochiEnvelope(modal, list, "prompt"));
            $("fcCopy").addEventListener("click", async () => {
                const btn = $("fcCopy");
                try { await navigator.clipboard.writeText($("mpText").textContent.replace(/[“”]/g, "")); btn.textContent = "✓ Tersalin"; }
                catch (e) { btn.textContent = "Salin manual ya"; }
                setTimeout(() => { btn.textContent = "📋 Salin"; }, 1800);
            });
        }, 780);
    });
}

// Amplop + isi surat. mode: "prompt" (kuning, prompt harian) | "bday" (pink, ucapan ultah)
function renderMochiEnvelope(modal, list, mode) {
    const bday = mode === "bday";
    const nick = (_profile && _profile.nickname) || "Sahabat";
    modal.innerHTML =
        '<div class="mochi-box">' +
        '<button class="mp-close" id="mpClose" aria-label="Tutup">✕</button>' +
        '<img class="mp-imgstk" src="../images/sticker/str-6.png" style="width:62px;bottom:8px;left:6px;transform:rotate(-8deg);" alt="">' +
        '<img class="mp-imgstk" src="../images/sticker/str-11.png" style="width:58px;bottom:10px;right:8px;transform:rotate(11deg);" alt="">' +
        '<div class="mp-head">' + (bday ? "🎂 Surat Ultah dari Mochi" : "💌 Surat dari Mochi") + '</div>' +
        '<div class="mp-sub">' + (bday ? "Ada ucapan spesial di hari spesialmu~" : "Ada prompt journaling harian buat kamu~") + '</div>' +
        '<div class="env-scene" id="envScene">' +
        '<div class="envelope' + (bday ? " env-bday" : "") + '" id="envelope" role="button" aria-label="Buka amplop">' +
        '<div class="env-back"></div>' +
        '<div class="env-letter"></div>' +
        '<div class="env-front"></div>' +
        '<div class="env-addr">Untuk: ' + esc(nick) + (bday ? ' 🎂' : ' ✍️') + '</div>' +
        '<div class="env-postage"><img src="../images/mochi_maskot_sm.png" alt=""></div>' +
        '<div class="env-flap"></div>' +
        '<img class="env-seal" src="seal-paw.png" alt="">' +
        '<span class="env-tape a"></span><span class="env-tape b"></span>' +
        (bday
            ? '<span class="env-stk s1">🎈</span><span class="env-stk s2">🎉</span><span class="env-stk s3">🎁</span><span class="env-stk s4">🌈</span><span class="env-stk s5">🐾</span>'
            : '<span class="env-stk s1">✂️</span><span class="env-stk s2">🌟</span><span class="env-stk s3">📎</span><span class="env-stk s4">🌈</span><span class="env-stk s5">🐾</span>') +
        '</div>' +
        '<div class="env-hint">ketuk amplopnya buat buka ' + (bday ? '🎂' : '💌') + '</div>' +
        '</div>' +
        '<div class="mp-card" id="mpCard" style="display:none;">' +
        '<img class="mp-mochi" src="../images/mochi_maskot_sm.png" alt="">' +
        '<div class="mp-kicker" id="mpKicker"></div>' +
        '<div><span class="mp-cat" id="mpCat"></span></div>' +
        '<div class="mp-text" id="mpText"></div>' +
        '<div class="mp-actions" id="mpActions"></div>' +
        '</div>' +
        '</div>';
    $("mpClose").addEventListener("click", closeMochiPrompt);

    const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    const dateStr = now.getDate() + " " + MON[now.getMonth()] + " " + now.getFullYear();

    function showPrompt(it, isDaily) {
        _mpLastId = it.id;
        $("mpKicker").textContent = isDaily ? "DAILY PROMPT · " + dateStr : "RANDOM PROMPT 🎲";
        $("mpCat").textContent = "🏷️ " + (it.category || "Journaling");
        $("mpText").textContent = "“" + it.prompt + "”";
        const card = $("mpCard");
        card.classList.remove("pop");
        void card.offsetWidth; // restart animasi pop
        card.classList.add("pop");
    }

    function fillActions() {
        const switchable = isMyBirthdayToday(); // bisa bolak-balik dua surat
        $("mpActions").innerHTML = bday
            ? '<button class="mp-btn ghost" id="mpVoucher">🎁 Voucher Ultah</button>' +
              (switchable ? '<button class="mp-btn" id="mpSwitch">✍️ Baca Prompt Harian</button>' : '')
            : '<button class="mp-btn ghost" id="mpCopy">📋 Salin</button>' +
              '<button class="mp-btn" id="mpRandom">🎲 Prompt acak lainnya</button>' +
              (switchable ? '<button class="mp-btn bday-btn" id="mpSwitch" style="flex:1 1 100%;">🎂 Baca Surat Ultah</button>' : '');
        const sw = $("mpSwitch");
        if (sw) sw.addEventListener("click", () => renderMochiEnvelope(modal, list, bday ? "prompt" : "bday"));
        const vc = $("mpVoucher");
        if (vc) vc.addEventListener("click", () => { closeMochiPrompt(); activateTab("loyalty"); });
        const rd = $("mpRandom");
        if (rd) rd.addEventListener("click", () => showPrompt(randomPrompt(list), false));
        const cp = $("mpCopy");
        if (cp) cp.addEventListener("click", async () => {
            try { await navigator.clipboard.writeText($("mpText").textContent.replace(/[“”]/g, "")); cp.textContent = "✓ Tersalin"; }
            catch (e) { cp.textContent = "Salin manual ya"; }
            setTimeout(() => { cp.textContent = "📋 Salin"; }, 1800);
        });
    }

    // ketuk amplop -> seal copot, flap kebuka, surat naik, baru kartunya muncul
    const env = $("envelope");
    let opened = false;
    env.addEventListener("click", () => {
        if (opened) return;
        opened = true;
        playSfx("open-mail");
        env.classList.add("open");
        if (typeof confetti === "function") setTimeout(() => fireConfetti(bday ? "reward" : "quest"), 500);
        setTimeout(() => {
            $("envScene").style.display = "none";
            $("mpCard").style.display = "block";
            if (bday) {
                $("mpKicker").textContent = "HAPPY BIRTHDAY · " + dateStr;
                $("mpCat").textContent = "🎂 Untuk " + nick;
                $("mpText").textContent = BDAY_WISHES[Math.floor(Math.random() * BDAY_WISHES.length)];
                const card = $("mpCard");
                card.classList.remove("pop");
                void card.offsetWidth;
                card.classList.add("pop");
            } else {
                showPrompt(dailyPrompt(list), true);
            }
            fillActions();
        }, 1000);
    });
}

function closeMochiPrompt() {
    const modal = $("mochiModal");
    if (modal) modal.classList.remove("show");
    unlockScroll();
}

// Tutup modal quest detail kalau klik area gelap di luar box
(function initModals() {
    const modal = $("questModal");
    if (modal) modal.addEventListener("click", (e) => { if (e.target === modal) closeQuestModal(); });
})();

// ---------- Galeri (feed foto challenge semua member, ala IG) ----------
let _galleryLoaded = false;
let _galleryItems = [];
let _galleryFilter = "all";   // "all" | "mine" | "t:<judul>"
let _galleryView = "grid";    // "grid" | "feed" (default grid, samain sama tab Challenge)

// Ikon toggle view (SVG currentColor -> otomatis ikut light/dark mode)
const ICON_FEED = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="6" rx="1.8"/><rect x="4" y="14" width="16" height="6" rx="1.8"/></svg>';
const ICON_BOOK = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h6.5A3.5 3.5 0 0 1 12 7.5V20a2.5 2.5 0 0 0-2.5-2.5H2z"/><path d="M22 4h-6.5A3.5 3.5 0 0 0 12 7.5V20a2.5 2.5 0 0 1 2.5-2.5H22z"/></svg>';
const ICON_GRID = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/></svg>';
// Ikon shared (sama kayak ikon tab -> konsisten se-app)
const ICON_CAMERA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';

async function loadGallery() {
    if (_galleryLoaded) return;
    _galleryLoaded = true;
    const pane = $("pane-gallery");
    pane.innerHTML = skeletonGallery();
    try {
        const g = await fetchJSONP(GS + "?page=questGallery&wa=" + encodeURIComponent(_profile.wa), "gal", 20000);
        _galleryItems = (g && g.items) || [];
    } catch (e) {
        _galleryLoaded = false;
        renderError(pane, loadGallery);
        return;
    }
    renderGallery();
    // Data galeri baru masuk -> refresh Quest Board biar hitungan "karya teman"
    // (badge 👥 di buku/grid/list) langsung keisi
    if (_questsLoaded && _questChallenges.length && $("questGrid")) renderQuestBoard();
}

function galFiltered() {
    let items = _galleryItems.slice();
    if (_galleryFilter === "mine") items = items.filter(x => x.mine);
    else if (_galleryFilter.indexOf("t:") === 0) { const t = _galleryFilter.slice(2); items = items.filter(x => x.title === t); }
    return items;
}

function renderGallery() {
    const pane = $("pane-gallery");
    if (!_galleryItems.length) {
        pane.innerHTML = '<div class="placeholder"><div class="em">📸</div><h3>Galeri masih kosong</h3><p>Ikut challenge & upload foto spread-mu — nanti muncul di sini! ✨</p></div>';
        return;
    }
    // Urutan chip WAJIB: All, Mine, Workshop, Reka-Rekat, Temu-Warga, baru sisanya (challenge/weekly, dst)
    const PRIORITY_TITLES = ["Workshop", "Reka-Rekat", "Temu-Warga"];
    const challengeSet = [];
    PRIORITY_TITLES.forEach(t => { if (_galleryItems.some(it => it.title === t)) challengeSet.push(t); });
    _galleryItems.forEach(it => { if (challengeSet.indexOf(it.title) < 0) challengeSet.push(it.title); });
    let chips = '<button class="gchip' + (_galleryFilter === "all" ? " active" : "") + '" data-f="all">🌍 All</button>' +
        '<button class="gchip' + (_galleryFilter === "mine" ? " active" : "") + '" data-f="mine">📌 Mine</button>';
    challengeSet.forEach(t => {
        chips += '<button class="gchip' + (_galleryFilter === ("t:" + t) ? " active" : "") + '" data-f="t:' + esc(t) + '">' + esc(t) + '</button>';
    });

    pane.innerHTML =
        '<div class="story-bar" id="storyBar"></div>' +
        '<div id="wargaBoard"></div>' +
        '<div class="gallery-toolbar">' +
        '<div class="gfilters" id="galFilters">' + chips + '</div>' +
        '<div class="view-toggle">' +
        '<button class="vbtn' + (_galleryView === "grid" ? " active" : "") + '" id="btnViewGrid" title="Mode Grid" aria-label="Mode Grid">' + ICON_GRID + '</button>' +
        '<button class="vbtn' + (_galleryView === "feed" ? " active" : "") + '" id="btnViewFeed" title="Mode Feed" aria-label="Mode Feed">' + ICON_FEED + '</button>' +
        '</div>' +
        '</div>' +
        '<div class="ig-feed" id="igFeed"' + (_galleryView === "feed" ? "" : ' style="display:none"') + '></div>' +
        '<div class="ig-grid" id="igGrid"' + (_galleryView === "grid" ? "" : ' style="display:none"') + '></div>';

    renderStoryBar(); // bar story selalu di atas, nggak kepengaruh filter/view
    loadBoard();      // Mading Warga (papan gabus pesan semangat)

    const items = galFiltered();
    const feed = $("igFeed"), grid = $("igGrid");
    if (!items.length) {
        const empty = '<div class="placeholder" style="grid-column:1/-1;padding:2rem 1rem;"><div class="em">🍃</div><p>Belum ada foto di filter ini.</p></div>';
        feed.innerHTML = empty; grid.innerHTML = empty;
    } else {
        feed.innerHTML = items.map(galFeedCard).join("");
        // bagi ke 2 kolom flex (masonry manual, bebas bug paint css-columns)
        const colA = [], colB = [];
        items.forEach((it, i) => ((i % 2 === 0) ? colA : colB).push(galGridItem(it, i)));
        grid.innerHTML = '<div class="ig-col">' + colA.join("") + '</div><div class="ig-col">' + colB.join("") + '</div>';
        wireGallery(feed, grid);
    }

    pane.querySelectorAll("#galFilters .gchip").forEach(c => c.addEventListener("click", () => { _galleryFilter = c.dataset.f; renderGallery(); }));
    $("btnViewFeed").addEventListener("click", () => { _galleryView = "feed"; renderGallery(); });
    $("btnViewGrid").addEventListener("click", () => { _galleryView = "grid"; renderGallery(); });
}

// "2026-07-11" -> "11 Jul 2026" (buat tanggal event di galeri)
function fmtEventDate(s) {
    const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return "";
    const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return parseInt(m[3], 10) + " " + MON[parseInt(m[2], 10) - 1] + " " + m[1];
}

// "2 jam lalu" dari timestamp submission
function timeAgo(ts) {
    if (!ts) return "";
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return "baru aja";
    const m = Math.floor(s / 60); if (m < 60) return m + " menit lalu";
    const h = Math.floor(m / 60); if (h < 24) return h + " jam lalu";
    const d = Math.floor(h / 24); if (d < 7) return d + " hari lalu";
    const dt = new Date(ts);
    return dt.getDate() + "/" + (dt.getMonth() + 1) + "/" + dt.getFullYear();
}

function galFeedCard(it) {
    const initial = esc((it.nickname || "S").charAt(0).toUpperCase());
    const isEvent = (it.kind === "workshop" || it.kind === "reka-rekat" || it.kind === "temu-warga");
    // event pakai tanggal event ("11 Jul 2026"), post member pakai time-ago
    const when = isEvent ? (it.eventDate ? "🗓 " + fmtEventDate(it.eventDate) : "") : timeAgo(it.ts);
    const evCls = it.kind === "workshop" ? " ev-ws" : (it.kind === "reka-rekat" ? " ev-rr" : (it.kind === "temu-warga" ? " ev-tw" : (it.kind === "weekly" ? " ev-wj" : "")));
    const bIcon = it.kind === "workshop" ? "🎪" : (it.kind === "reka-rekat" ? "✂️" : (it.kind === "temu-warga" ? "🏘️" : (it.kind === "weekly" ? "📖" : "🎯")));
    const ava = isEvent
        ? '<div class="ig-ava official">SS</div>'
        : (it.avatar ? '<div class="ig-ava"><img src="' + esc(it.avatar) + '" alt="" loading="lazy"></div>' : '<div class="ig-ava">' + initial + '</div>');
    // dekorasi bingkai foto per jenis
    let frameDeco = '<div class="washi-tape-top"></div>';
    if (it.kind === "workshop") frameDeco = '<span class="ev-stamp">WORKSHOP</span>';
    else if (it.kind === "reka-rekat") frameDeco = '<span class="rr-heart">♥</span>';
    else if (it.kind === "temu-warga") frameDeco = '<span class="ev-stamp tw">TEMU-WARGA</span><img class="tw-stk" src="../images/sticker/str-6.png" alt="">';
    else if (it.kind === "weekly") frameDeco = '<span class="wj-check">✓</span>';
    return '<article class="ig-card feed-card' + evCls + '" data-id="' + esc(it.id) + '">' +
        '<header class="feed-header">' +
        '<div class="user-meta"' + (!isEvent ? ' data-wcard="' + esc(it.id) + '" role="button"' : '') + '>' + ava +
        '<div class="user-info"><span class="username">' + esc(it.nickname || "Sahabat") +
        (it.mine ? ' <span class="me-star" title="Karya kamu">⭐</span>' : '') +
        (isEvent ? ' <span class="ig-me official-tag">OFFICIAL</span>' : '') + '</span>' +
        (when ? '<span class="post-time">' + when + '</span>' : '') + '</div></div>' +
        '<div class="quest-badge-sticker">' + bIcon + ' ' + esc(it.title) + '</div>' +
        '</header>' +
        '<div class="feed-photo-frame">' +
        frameDeco +
        '<div class="ig-imgwrap feed-photo-wrap" data-tap="' + esc(it.id) + '"><img src="' + esc(it.photo) + '" alt="" loading="lazy" decoding="async" onerror="this.style.opacity=.25"><div class="like-overlay">❤️</div>' + ((it.ts && (Date.now() - it.ts) < 86400000) ? '<span class="gal-new">BARU</span>' : '') + '</div>' +
        '</div>' +
        '<div class="feed-actions"><button class="action-btn ig-btn-like' + (it.liked ? " active" : "") + '" data-like="' + esc(it.id) + '"><span class="li-icon">' + (it.liked ? "❤️" : "🤍") + '</span> <span class="li-count">' + (it.likes || 0) + '</span> Likes</button></div>' +
        (it.caption ? '<div class="feed-caption-box"><p class="caption-text"><b>' + esc(it.nickname || "Sahabat") + '</b> ' + esc(it.caption) + '</p></div>' : '') +
        '</article>';
}

function galGridItem(it, i) {
    // Bingkai per jenis: workshop = album kraft + photo corners + stempel,
    // reka-rekat = kertas pink sobek + hati, sisanya polaroid/stitched selang-seling
    const ratio = ["ratio-45", "ratio-11", "ratio-34"][i % 3];
    const initial = esc((it.nickname || "S").charAt(0).toUpperCase());
    let frame, deco = "", stampIn = "";
    if (it.kind === "workshop") {
        frame = "frame-workshop";
        deco = '<img class="tw-stk" src="../images/sticker/str-6.png" alt="">'; // anjing lebah pojok kanan atas
        stampIn = '<span class="ev-stamp">WORKSHOP</span>';
    } else if (it.kind === "reka-rekat") {
        frame = "frame-rekarekat";
        deco = '<span class="rr-heart">♥</span><img class="gal-stk" src="../images/sticker/str-2.png" alt="">';
        stampIn = '<span class="ev-stamp rr">REKA-REKAT</span>';
    } else if (it.kind === "temu-warga") {
        frame = "frame-temuwarga";
        deco = '<img class="tw-stk" src="../images/sticker/str-6.png" alt="">';
        stampIn = '<span class="ev-stamp tw">TEMU-WARGA</span>';
    } else if (it.kind === "weekly") {
        frame = "frame-weekly";
        deco = '<span class="wj-check">✓</span><img class="gal-stk" src="../images/sticker/str-1.png" alt="">';
    } else {
        frame = (i % 2 === 0) ? "frame-polaroid" : "frame-stitched";
        deco = (i % 2 === 0) ? '<div class="jtape ' + (i % 4 === 0 ? "tr" : "tl") + '"></div>' : "";
    }
    const ava = (it.kind === "workshop" || it.kind === "reka-rekat" || it.kind === "temu-warga")
        ? '<span class="jcard-ava official">SS</span>'
        : (it.avatar ? '<span class="jcard-ava"><img src="' + esc(it.avatar) + '" alt="" loading="lazy"></span>' : '<span class="jcard-ava">' + initial + '</span>');
    const isNew = it.ts && (Date.now() - it.ts) < 86400000; // <24 jam
    return '<div class="jcard ' + frame + '" data-id="' + esc(it.id) + '">' +
        deco +
        '<div class="jcard-imgwrap ' + ratio + '"><img src="' + esc(it.photo) + '" alt="" loading="lazy" decoding="async" onerror="this.style.opacity=.25">' + stampIn + (isNew ? '<span class="gal-new">BARU</span>' : '') + '</div>' +
        '<div class="jcard-body">' +
        '<div class="jcard-author">' + ava +
        '<span class="jcard-nick">' + esc(it.nickname || "Sahabat") + (it.mine ? ' <span class="me-star">⭐</span>' : "") + '</span>' +
        '<span class="jcard-likes">' + (it.liked ? "❤️" : "🤍") + ' ' + (it.likes || 0) + '</span></div>' +
        (it.eventDate ? '<div class="jcard-date">🗓 ' + esc(fmtEventDate(it.eventDate)) + '</div>' : '') +
        (it.caption ? '<div class="jcard-cap">' + esc(it.caption) + '</div>' : '') +
        '</div>' +
        '</div>';
}

function wireGallery(feed, grid) {
    feed.querySelectorAll(".ig-btn-like").forEach(btn =>
        btn.addEventListener("click", () => toggleLike(btn.dataset.like)));
    const taps = {};
    feed.querySelectorAll(".ig-imgwrap").forEach(wrap => {
        wrap.addEventListener("click", () => {
            const id = wrap.dataset.tap, now = Date.now();
            if (taps[id] && now - taps[id] < 300) {
                const it = _galleryItems.find(x => x.id === id);
                if (it && !it.liked) toggleLike(id);
                const ov = wrap.querySelector(".like-overlay");
                if (ov) { ov.classList.add("pop"); setTimeout(() => ov.classList.remove("pop"), 800); }
                taps[id] = 0;
            } else taps[id] = now;
        });
    });
    grid.querySelectorAll(".jcard").forEach(g => g.addEventListener("click", () => {
        const it = _galleryItems.find(x => x.id === g.dataset.id);
        if (it) openGalleryLightbox(it);
    }));
    // tap avatar/nama di header feed -> kartu profil mini
    feed.querySelectorAll("[data-wcard]").forEach(el => el.addEventListener("click", () => {
        const it = _galleryItems.find(x => x.id === el.dataset.wcard);
        if (it) openWargaCard(it);
    }));
}

// Lightbox: buka foto galeri gede + info + tombol love (dipakai dari grid).
// Bisa swipe kiri/kanan buat pindah foto (ngikutin filter yang lagi aktif).
function openGalleryLightbox(it) {
    const modal = $("questModal");
    const box = $("questModalBox");
    box._lbList = galFiltered();
    box._lbIdx = Math.max(0, box._lbList.findIndex(x => x.id === it.id));
    if (!box._lbWired) {
        box._lbWired = true; // listener sekali aja — navigasi baca state _lbList/_lbIdx
        let sx = 0, sy = 0;
        box.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
        box.addEventListener("touchend", (e) => {
            if (!$("lbImg")) return; // modal lagi dipake quest/check-in, bukan lightbox
            const t = e.changedTouches[0];
            const dx = t.clientX - sx, dy = t.clientY - sy;
            if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
            const j = box._lbIdx + (dx < 0 ? 1 : -1);
            box.classList.remove("lb-in-l", "lb-in-r", "lb-nudge");
            if (j < 0 || j >= box._lbList.length) { // mentok: goyang dikit
                void box.offsetWidth;
                box.classList.add("lb-nudge");
                return;
            }
            openGalleryLightbox(box._lbList[j]);
            void box.offsetWidth;
            box.classList.add(dx < 0 ? "lb-in-l" : "lb-in-r");
        }, { passive: true });
    }
    const initial = esc((it.nickname || "S").charAt(0).toUpperCase());
    const isEvent = (it.kind === "workshop" || it.kind === "reka-rekat" || it.kind === "temu-warga");
    const bIcon = it.kind === "workshop" ? "🎪" : (it.kind === "reka-rekat" ? "✂️" : (it.kind === "temu-warga" ? "🏘️" : (it.kind === "weekly" ? "📖" : "🎯")));
    const ava = isEvent
        ? '<div class="ig-ava official">SS</div>'
        : (it.avatar ? '<div class="ig-ava"><img src="' + esc(it.avatar) + '" alt=""></div>' : '<div class="ig-ava">' + initial + '</div>');
    $("questModalBox").innerHTML =
        '<div class="qm-topbar"><button class="qm-close" id="qmClose" aria-label="Tutup">✕</button></div>' +
        '<div class="ig-imgwrap" id="lbImg" style="aspect-ratio:1/1"><img src="' + esc(it.photo) + '" alt="" onerror="this.style.opacity=.25"><div class="like-overlay">❤️</div></div>' +
        '<div class="qm-body">' +
        '<div class="ig-head" style="padding-left:0;padding-right:0;"' + (!isEvent ? ' data-wcard="1" role="button"' : '') + '>' + ava +
        '<div class="ig-user-info"><div class="ig-user-row"><span class="ig-user">' + esc(it.nickname || "Sahabat") + '</span>' +
        (it.mine ? '<span class="me-star" title="Karya kamu">⭐</span>' : '') +
        (isEvent ? '<span class="ig-me official-tag">OFFICIAL</span>' : '') + '</div>' +
        '<div class="ig-chal">' + bIcon + ' ' + esc(it.title) + (it.eventDate ? ' · 🗓 ' + esc(fmtEventDate(it.eventDate)) : '') + '</div></div></div>' +
        '<div class="ig-actions" style="padding-left:0;padding-right:0;"><button class="ig-btn-like" data-like="' + esc(it.id) + '"><span class="li-icon">' + (it.liked ? "❤️" : "🤍") + '</span> <span class="li-count">' + (it.likes || 0) + '</span> Likes</button></div>' +
        (it.caption ? '<div class="ig-cap" style="padding-left:0;padding-right:0;"><b>' + esc(it.nickname || "Sahabat") + '</b> ' + esc(it.caption) + '</div>' : '') +
        '</div>';
    modal.classList.add("show");
    lockScroll();
    $("qmClose").addEventListener("click", closeQuestModal);
    const likeBtn = box.querySelector(".ig-btn-like");
    if (likeBtn) likeBtn.addEventListener("click", () => toggleLike(it.id));
    const wcHead = box.querySelector("[data-wcard]");
    if (wcHead) wcHead.addEventListener("click", () => openWargaCard(it));
    const wrap = $("lbImg");
    let last = 0;
    if (wrap) wrap.addEventListener("click", () => {
        const now = Date.now();
        if (last && now - last < 300) {
            if (!it.liked) toggleLike(it.id);
            const ov = wrap.querySelector(".like-overlay");
            if (ov) { ov.classList.add("pop"); setTimeout(() => ov.classList.remove("pop"), 800); }
            last = 0;
        } else last = now;
    });
}

// ---------- Sound effects kecil (sekali bunyi) ----------
// Audio di-cache per nama biar tap kedua langsung bunyi tanpa fetch ulang.
const _sfxCache = {};
function playSfx(name, vol) {
    if (sndMuted()) return;
    try {
        let a = _sfxCache[name];
        if (!a) { a = new Audio("../sound-effect/" + name + ".mp3"); _sfxCache[name] = a; }
        a.volume = vol || 0.9;
        a.currentTime = 0;
        a.play().catch(() => { });
    } catch (e) { }
}

// toggle tema (dark/light) bunyi "cetek" lampu — theme.js udah nge-dispatch event ini
document.addEventListener("ss-theme-change", () => playSfx("light", 0.8));

// ---------- Snail Mail: surat bulanan dari Mochi 📬 ----------
// 12 surat di snail_mail.js, tiap surat "nyampe" tanggal 1 jam 9 pagi. Gratis
// buat semua warga; yang udah kebuka ngumpul di Kotak Surat (arsip di Home).
let _snailMail = null;
function loadSnailMail() {
    if (_snailMail) return Promise.resolve(_snailMail);
    if (Array.isArray(window.SS_SNAILMAIL) && window.SS_SNAILMAIL.length) {
        _snailMail = window.SS_SNAILMAIL;
        return Promise.resolve(_snailMail);
    }
    return new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "snail_mail.js";
        s.onload = () => {
            if (Array.isArray(window.SS_SNAILMAIL) && window.SS_SNAILMAIL.length) { _snailMail = window.SS_SNAILMAIL; resolve(_snailMail); }
            else reject(new Error("daftar surat kosong"));
        };
        s.onerror = () => reject(new Error("gagal load surat"));
        document.body.appendChild(s);
    });
}

// surat yang udah "nyampe" (publish_date jam 09:00 udah lewat), terbaru duluan
function snailAvail() {
    const now = Date.now();
    return (_snailMail || []).filter(l => {
        const t = new Date(String(l.publish_date) + "T09:00:00").getTime();
        return t && t <= now;
    }).sort((a, b) => String(b.publish_date).localeCompare(String(a.publish_date)));
}
function snailReadSet() {
    try { return new Set(JSON.parse(localStorage.getItem("ss_snail_read") || "[]")); } catch (e) { return new Set(); }
}
function snailMarkRead(id) {
    try {
        const s = Array.from(snailReadSet());
        if (s.indexOf(id) < 0) s.push(id);
        localStorage.setItem("ss_snail_read", JSON.stringify(s));
    } catch (e) { }
}
function snailMonthLabel(l) {
    const m = String(l.publish_date).match(/^(\d{4})-(\d{2})/);
    return m ? BULAN_ID[parseInt(m[2], 10) - 1] + " " + m[1] : "";
}
// skin unik per bulan (warna kertas + perangko) -> tiap surat kerasa beda
const SN_STAMPS = ["🐌", "🕊️", "🌻", "🍂", "❄️", "🌷"];
function snailSkin(l) {
    const m = String(l.publish_date).match(/-(\d{2})-/);
    return m ? (parseInt(m[1], 10) - 1) % 6 : 0;
}

function snailCtaRefresh() {
    const slot = $("snailSlot");
    if (!slot) return;
    const avail = snailAvail();
    if (!avail.length) { slot.innerHTML = ""; return; }
    const read = snailReadSet();
    const unread = avail.filter(l => !read.has(l.id)).length;
    slot.innerHTML =
        '<button type="button" class="snail-cta" id="snailCta">' +
        '<span class="snail-ic">📬</span>' +
        '<span class="snail-body"><span class="snail-t">Kotak Surat Mochi</span>' +
        '<span class="snail-s">' + (unread ? unread + ' surat belum dibaca 💌' : avail.length + ' surat terkumpul \u00b7 surat baru tiap tanggal 1') + '</span></span>' +
        (unread ? '<span class="snail-new">BARU</span>' : '<span class="snail-go">buka \u2192</span>') +
        '</button>';
    $("snailCta").addEventListener("click", openSnailBox);
}

// ---------- Halaman Kotak Surat (#snail-mail) ----------
// Halaman sendiri (bukan modal) biar bisa di-refresh / deep-link. Vibe "dapet
// surat": amplop hero goyang + wax seal, diketuk kebuka beranimasi, koleksi
// amplop mini per bulan, dan siput jalan menuju surat berikutnya.
function openSnailBox(setHash) {
    let m = $("snailPage");
    if (!m) {
        m = document.createElement("div");
        m.id = "snailPage";
        m.className = "snail-page";
        document.body.appendChild(m);
    }
    m.innerHTML = '<div class="snp-wrap">' +
        '<div class="snp-head"><div class="snp-title">📬 Kotak Surat Mochi</div>' +
        '<button class="snp-close" id="snpClose" aria-label="Tutup">✕</button></div>' +
        '<div class="snp-sub">Sebulan sekali Mochi nulis surat buat semua warga — pelan kayak siput, tapi selalu nyampe 💌</div>' +
        '<div id="snpBody"></div>' +
        '</div>';
    m.classList.add("show");
    m.scrollTop = 0;
    lockScroll();
    $("snpClose").addEventListener("click", () => closeSnailPage());
    gameMusicPlay("music-snail.mp3"); // musik halaman kotak surat (blocked pas deep-link tanpa gesture -> nyusul di interaksi berikutnya)
    if (setHash !== false) { try { if (location.hash !== "#snail-mail") location.hash = "snail-mail"; } catch (e) { } }
    loadSnailMail().then(renderSnailBox).catch(() => {
        const b = $("snpBody");
        if (b) b.innerHTML = '<div class="placeholder"><div class="em">📭</div><p>Gagal ngambil surat. Coba lagi ya.</p></div>';
    });
}

function closeSnailPage(retHash) {
    const m = $("snailPage");
    if (!m || !m.classList.contains("show")) return;
    m.classList.remove("show");
    // KOSONGIN isinya: halaman cuma di-hide, DOM-nya masih connected — loop game
    // (hopper/snake/dash/catch) ngecek stage.isConnected, jadi kalau nggak dicabut
    // game-nya terus jalan di balik layar & sfx-nya (flip/light) bocor ke Home
    const b = $("snpBody");
    if (b) b.innerHTML = "";
    unlockScroll();
    gameMusicStop();
    snailCtaRefresh(); // badge BARU di Home ikut update
    if (retHash !== false) { try { if (location.hash === "#snail-mail") location.hash = "home"; } catch (e) { } }
}

function renderSnailBox() {
    const body = $("snpBody");
    if (!body) return;
    const avail = snailAvail();
    const read = snailReadSet();
    const unreadL = avail.filter(l => !read.has(l.id));

    // hero: surat terbaru yang belum dibaca -> amplop gede ber-seal, diketuk kebuka
    let hero = "";
    if (unreadL.length) {
        const l = unreadL[0];
        const k = snailSkin(l);
        hero = '<div class="snp-hero">' +
            '<div class="snp-hero-k">💌 SURAT BARU NYAMPE!</div>' +
            '<button type="button" class="sn-henv sk' + k + '" id="snHero" data-sn="' + esc(l.id) + '">' +
            '<span class="sn-hletter"><span class="sn-hl-t">' + esc(l.theme) + '</span></span>' +
            '<span class="sn-hflap sk' + k + '"></span>' +
            '<img class="sn-hseal" src="seal-paw.png" alt="">' +
            '<span class="sn-hair"></span>' +
            '<span class="sn-hdoodle d1">✈️</span><span class="sn-hdoodle d2">♡</span>' +
            '<span class="sn-hstamp">' + SN_STAMPS[k] + '<i>BALAI POST</i></span>' +
            '<span class="sn-hlabel">UNTUK: WARGA BALAI<b>' + esc(snailMonthLabel(l).toUpperCase()) + '</b></span>' +
            '</button>' +
            '<div class="snp-hero-hint">ketuk amplopnya buat buka ✨</div>' +
            '</div>';
    }

    // koleksi: semua surat yang udah nyampe, amplop mini skin per bulan
    let coll = "";
    avail.forEach((l, i) => {
        const k = snailSkin(l);
        const isNew = !read.has(l.id);
        coll += '<button type="button" class="sn-mini sk' + k + (i % 2 ? " r" : "") + '" data-sn="' + esc(l.id) + '">' +
            '<span class="sn-mini-stamp">' + SN_STAMPS[k] + '</span>' +
            (isNew ? '<img class="sn-mini-seal" src="seal-paw.png" alt="">' : '<span class="sn-mini-done">✓ dibaca</span>') +
            '<span class="sn-mini-month">' + esc(snailMonthLabel(l).toUpperCase()) + '</span>' +
            '<span class="sn-mini-theme">' + esc(l.theme) + '</span>' +
            (isNew ? '<span class="sn-badge">BARU</span>' : '') +
            '</button>';
    });

    // siput jalan: progress menuju surat bulan depan
    const nextL = (_snailMail || []).filter(l => new Date(String(l.publish_date) + "T09:00:00").getTime() > Date.now())
        .sort((a, b) => String(a.publish_date).localeCompare(String(b.publish_date)))[0];
    let walk = "";
    if (nextL) {
        const nt = new Date(String(nextL.publish_date) + "T09:00:00").getTime();
        const lastT = avail.length ? new Date(String(avail[0].publish_date) + "T09:00:00").getTime() : nt - 30 * 86400000;
        const pct = Math.max(4, Math.min(92, Math.round(((Date.now() - lastT) / (nt - lastT)) * 100)));
        const days = Math.max(1, Math.ceil((nt - Date.now()) / 86400000));
        walk = '<div class="snp-walk">' +
            '<div class="snp-walk-line"><span class="snp-snail" style="left:' + pct + '%">🐌</span><span class="snp-mailbox">📮</span></div>' +
            '<div class="snp-walk-t">Surat ' + esc(snailMonthLabel(nextL)) + ' lagi di jalan — <b>' + days + ' hari lagi</b> nyampe 💨</div>' +
            '</div>';
    }

    // saran baca ulang: surat yang temanya nyambung sama mood dominan bulan ini
    let sugg = "";
    try {
        const rec = moodStore()[moodMonthKey()] || {};
        const tally = {};
        Object.values(rec).forEach(k => { tally[k] = (tally[k] || 0) + 1; });
        const domK = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0];
        // mood -> kandidat surat (urut paling relevan); dipilih yang UDAH nyampe
        const MOOD_LETTER = {
            hujan: ["SM-045", "SM-040", "SM-038"],
            badai: ["SM-048", "SM-040", "SM-044", "SM-038"],
            berawan: ["SM-044", "SM-039", "SM-038"]
        };
        if (domK && MOOD_LETTER[domK] && (tally[domK] || 0) >= 3) {
            const lid = MOOD_LETTER[domK].find(id => avail.some(l => l.id === id));
            const l = avail.find(x => x.id === lid);
            if (l) {
                const mo = MOODS.find(x => x.k === domK);
                sugg = '<button type="button" class="sn-sugg" data-sn="' + esc(l.id) + '">' +
                    '💌 Bulan ini hatimu sering ' + mo.t.toLowerCase() + ' ' + mo.e +
                    ' — surat ini mungkin ngena: <b>“' + esc(l.theme) + '”</b></button>';
            }
        }
    } catch (e) { }

    body.innerHTML = hero + sugg +
        (coll ? '<div class="snp-sec">📚 Koleksi Suratmu (' + avail.length + ')</div><div class="snp-grid">' + coll + '</div>'
            : '<div class="placeholder" style="padding:1.4rem 0;"><div class="em">📭</div><p>Belum ada surat yang nyampe.</p></div>') +
        walk;

    const heroEl = $("snHero");
    if (heroEl) heroEl.addEventListener("click", () => {
        if (heroEl.classList.contains("open")) return;
        heroEl.classList.add("open"); // seal copot -> flap kebuka -> surat naik
        playSfx("open-mail");
        const l = avail.find(x => x.id === heroEl.dataset.sn);
        setTimeout(() => { if (l) openSnailLetter(l, true); }, 1000);
    });
    body.querySelectorAll(".sn-mini, .sn-sugg").forEach(b => b.addEventListener("click", () => {
        const l = avail.find(x => x.id === b.dataset.sn);
        if (l) openSnailLetter(l);
    }));
}

// ---------- Bonus aktivitas di amplop: Cari Kata / Bingo (gantian tiap bulan) ----------
// Deterministik dari bulan surat (PRNG mulberry32) -> semua warga dapet puzzle
// yang sama, nggak berubah tiap buka. Progress kesimpen di localStorage.
function snMulberry(a) {
    return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
function snSeed(l) {
    const m = String(l.publish_date).match(/^(\d{4})-(\d{2})/);
    return m ? parseInt(m[1] + m[2], 10) : 2026;
}
// Paket aktivitas PER SURAT — konten nyambung sama tema suratnya, rotasi 4 game:
// Cari Kata (ws), Bingo, Susun Kata (scramble), Tangkap Rasa (catch).
const SN_ACT = {
    // === siklus game: ws -> bingo -> catch -> scramble -> dash -> snake, muter 2x setahun ===
    "SM-038": { // Jul · Lelah yang Sering Tak Diundang
        type: "ws", title: "CARI KATA: RESEP ISTIRAHAT",
        words: ["REHAT", "NAPAS", "PULIH", "SANTAI", "TIDUR", "TENANG"]
    },
    "SM-039": { // Agu · Standar Hidup yang Bikin Siksa
        type: "hopper", title: "PAPER HOPPER: NAIK DI TEMPOKU",
        goal: 50,
        words: ["Pelan", "Cukup", "Fokus", "Tumbuh", "Punyaku"]
    },
    "SM-040": { // Sep · Ketika Emosi Datang Meluap-luap
        type: "catch", title: "TANGKAP RASA: BADAI EMOSI",
        goal: 30,
        emos: [
            { w: "Kesal", v: "Wajar kok kesal. Tarik napas dulu ya 🍃" },
            { w: "Sedih", v: "Sedih boleh singgah, nangis juga boleh 💧" },
            { w: "Marah", v: "Marahmu valid. Pelan-pelan redainnya 🕯️" },
            { w: "Cemas", v: "Nggak semua yang di kepala itu nyata 💭" },
            { w: "Capek", v: "Nggak apa-apa kok kalau lagi capek 💤" },
            { w: "Senang", v: "Simpan rasa ini di jurnalmu ya! ✨" }
        ]
    },
    "SM-041": { // Okt · Suara Hati yang Terlalu Keras Menghakimi
        type: "scramble", title: "SUSUN KATA: SUARA YANG LEMBUT",
        rounds: [
            { w: "LEMBUT", q: "Kalau sahabatmu salah, kamu ngomongnya gimana? Coba pakai nada itu ke dirimu sendiri." },
            { w: "MAAF", q: "Tulis 1 kesalahan kecilmu minggu ini — terus maafin, beneran." },
            { w: "LAYAK", q: "Apa 1 hal baik yang pernah kamu tolak karena ngerasa nggak pantas?" },
            { w: "CUKUP", q: "Hari ini, apa yang sebenarnya udah cukup tapi masih kamu paksa?" },
            { w: "BAIK", q: "Tulis 3 kata baik buat dirimu. Sekarang ya, bukan nanti." }
        ]
    },
    "SM-042": { // Nov · Belajar Bilang Tidak
        type: "dash", title: "WORD DASH: BERANI BILANG TIDAK",
        goal: 15,
        words: ["Tidak!", "Batas", "Berani", "Jujur", "Cukup"],
        clouds: ["Ga enak…", "Iya deh", "Sungkan", "Nanti aja"]
    },
    "SM-043": { // Des · Melepaskan Genggaman yang Bikin Luka
        type: "snake", title: "WORD SNAKE: MAKAN KATA, LEPAS BEBAN",
        quote: "Melepaskan bukan kalah tapi memberi ruang untuk tumbuh"
    },
    "SM-044": { // Jan · Berantakan Itu Manusiawi
        type: "ws", title: "CARI KATA: URAI PELAN-PELAN",
        words: ["URAI", "PELAN", "PROSES", "SABAR", "MULAI", "BISA"]
    },
    "SM-045": { // Feb · Kesepian di Keramaian
        type: "snake", title: "WORD SNAKE: SATU SAPA KECIL",
        quote: "Mendekat itu mulai dari satu sapa kecil"
    },
    "SM-046": { // Mar · Memaafkan Versi Diri yang Dulu
        type: "catch", title: "TANGKAP RASA: BERDAMAI SAMA YANG DULU",
        goal: 30,
        emos: [
            { w: "Nyesel", v: "Keputusan itu dibuat dengan yang kamu tau saat itu 🤍" },
            { w: "Malu", v: "Semua orang punya babak yang pengen dilupain 🌱" },
            { w: "Marah", v: "Marah ke diri sendiri boleh, tapi jangan nginep 🕯️" },
            { w: "Benci", v: "Kamu bukan kesalahanmu 💙" },
            { w: "Sedih", v: "Yang dulu itu bagian dari cerita tumbuhmu 📖" },
            { w: "Bangga", v: "Nah! Lihat sejauh apa kamu udah jalan ✨" }
        ]
    },
    "SM-047": { // Apr · Merayakan Kemenangan Kecil
        type: "scramble", title: "SUSUN KATA: PESTA KECIL",
        rounds: [
            { w: "BANGGA", q: "Tulis 1 win kecil minggu ini yang belum sempet kamu rayain." },
            { w: "RAYAKAN", q: "Cara paling sederhana buat ngerayain dirimu hari ini apa?" },
            { w: "KECIL", q: "Kenapa ya kita suka nunggu momen besar dulu baru ngerasa cukup?" },
            { w: "MAJU", q: "Dibanding 3 bulan lalu, kamu udah maju di hal apa?" },
            { w: "SENYUM", q: "Hal kecil apa yang hari ini berhasil bikin kamu senyum?" }
        ]
    },
    "SM-048": { // Mei · Rasa Cemas yang Suka Bohong
        type: "dash", title: "WORD DASH: NEMBUS AWAN CEMAS",
        goal: 15,
        words: ["Tenang", "Nyata", "Aman", "Pelan", "Bisa"],
        clouds: ["Gimana?", "Panik", "Takut", "Overthink"]
    },
    "SM-049": { // Jun · Pelukan Hangat untuk Diri Sendiri
        type: "hopper", title: "PAPER HOPPER: TERBANG DIPELUK",
        goal: 50,
        words: ["Sayang", "Bangga", "Terima", "Hangat", "Pulih"]
    }
};

// tipe game per surat: dari paket; surat tanpa paket fallback gantian ws/bingo
function snActType(l) {
    const pack = SN_ACT[l.id];
    if (pack && pack.type) return pack.type;
    return "ws"; // surat tanpa paket fallback ke Cari Kata (bingo di-takeout dari rotasi)
}
function snActLabel(l) {
    const t = snActType(l);
    if (t === "ws") return "Cari Kata 🔍";
    if (t === "bingo") return "Bingo Journaling 🎯";
    if (t === "scramble") return "Susun Kata 🔤";
    if (t === "dash") return "Mochi's Word Dash ☁️";
    if (t === "snake") return "Word Snake 🐍";
    if (t === "hopper") return "Paper Hopper 📄";
    return "Tangkap Rasa 🫧";
}

const SN_WS_POOL = ["JURNAL", "MOCHI", "WASHI", "STIKER", "SYUKUR", "MIMPI", "CERITA", "WARGA", "BALAI", "PELUK", "NAPAS", "TENANG", "KARYA", "PENSIL", "KOPI", "SENJA"];
function snShuffle(arr, rnd) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
}
// generator word search 8x8: 5 kata (kanan/bawah/diagonal), sisa diisi huruf acak
function snBuildWs(l) {
    const N = 8, rnd = snMulberry(snSeed(l));
    const pack = SN_ACT[l.id];
    const words = (pack && pack.words ? pack.words.slice() : snShuffle(SN_WS_POOL, rnd).slice(0, 5)).filter(w => w.length <= N);
    const grid = new Array(N * N).fill("");
    const placed = [];
    const DIRS = [[0, 1], [1, 0], [1, 1]];
    words.forEach(w => {
        for (let att = 0; att < 300; att++) {
            const d = DIRS[Math.floor(rnd() * DIRS.length)];
            const maxR = N - (d[0] ? w.length : 1), maxC = N - (d[1] ? w.length : 1);
            const r0 = Math.floor(rnd() * (maxR + 1)), c0 = Math.floor(rnd() * (maxC + 1));
            let ok = true;
            const cells = [];
            for (let k = 0; k < w.length; k++) {
                const idx = (r0 + d[0] * k) * N + (c0 + d[1] * k);
                if (grid[idx] && grid[idx] !== w[k]) { ok = false; break; }
                cells.push(idx);
            }
            if (!ok) continue;
            cells.forEach((idx, k) => { grid[idx] = w[k]; });
            placed.push({ word: w, cells: cells });
            break;
        }
    });
    const AZ = "ABCDEFGHIJKLMNOPRSTUWY";
    for (let i = 0; i < grid.length; i++) if (!grid[i]) grid[i] = AZ[Math.floor(rnd() * AZ.length)];
    return { n: N, grid: grid, placed: placed };
}

const SN_BINGO_POOL = [
    "Journaling 10 menit tanpa HP", "Tempel washi tape favorit", "Tulis 3 hal yang kamu syukuri", "Doodle mood hari ini",
    "Journaling sambil ngeteh/ngopi", "Tempel tiket atau struk kenangan", "Tulis quote favorit minggu ini", "Journaling di luar kamar",
    "Pakai 3 warna di satu halaman", "Tulis surat kecil buat diri sendiri", "Foto spread-mu & share ke Balai", "Journaling sebelum tidur",
    "Gambar cuaca hatimu hari ini", "Cerita 1 hal kecil yang bikin senyum", "Bikin wishlist bulan ini", "Journaling bareng musik favorit",
    "Tempel foto atau polaroid", "Tulis 1 kata buat bulan ini", "Rapihin meja journaling-mu", "Ajak 1 teman journaling bareng"
];
function snBuildBingo(l) {
    const pack = SN_ACT[l.id];
    const rnd = snMulberry(snSeed(l) + 7);
    // paket themed diacak urutannya (deterministik) biar papan tetap kerasa acak
    return snShuffle(pack && pack.items ? pack.items : SN_BINGO_POOL, rnd).slice(0, 16);
}

// progress per surat di localStorage
function snActState(id) {
    try { return JSON.parse(localStorage.getItem("ss_snail_act_" + id) || "[]"); } catch (e) { return []; }
}
function snActSave(id, arr) {
    try { localStorage.setItem("ss_snail_act_" + id, JSON.stringify(arr)); } catch (e) { }
}

function openSnailActivity(l) {
    const k = snailSkin(l);
    const type = snActType(l);
    const box = $("snpBody");
    if (!box) return;
    gameMusicStop(); // musik halaman berhenti; game yang punya musik nyalain sendiri
    if (type === "ws") {
        gameMusicPlay("music-cari-kata.mp3");
        const ws = snBuildWs(l);
        const found = snActState(l.id); // list kata yang udah ketemu
        let cellsHtml = "";
        ws.grid.forEach((ch, i) => { cellsHtml += '<button type="button" class="ws-cell" data-i="' + i + '">' + ch + '</button>'; });
        let wordsHtml = "";
        ws.placed.forEach(pl => { wordsHtml += '<span class="ws-word' + (found.indexOf(pl.word) >= 0 ? " done" : "") + '" data-w="' + pl.word + '">' + pl.word + '</span>'; });
        box.innerHTML =
            '<div class="sn-paper sn-flat sk' + k + '" style="padding-top:20px;">' +
            '<span class="sn-washi"></span>' +
            '<div class="sn-kicker">' + esc((SN_ACT[l.id] || {}).title || "CARI KATA 🔍") + ' · ' + esc(snailMonthLabel(l).toUpperCase()) + '</div>' +
            '<div class="sn-act-hint">Ketuk huruf PERTAMA terus huruf TERAKHIR katanya ya!</div>' +
            '<div class="ws-grid">' + cellsHtml + '</div>' +
            '<div class="ws-words">' + wordsHtml + '</div>' +
            '</div>' +
            '<button type="button" class="sn-back" id="snBack">← Balik ke surat</button>';
        $("snBack").addEventListener("click", () => openSnailLetter(l, true));
        const pg = $("snailPage");
        if (pg) pg.scrollTop = 0;
        const cellEls = box.querySelectorAll(".ws-cell");
        // tandai kata yang udah ketemu
        function paintFound() {
            ws.placed.forEach(pl => {
                if (found.indexOf(pl.word) >= 0) pl.cells.forEach(i => cellEls[i].classList.add("found"));
            });
        }
        paintFound();
        let startI = -1;
        cellEls.forEach(el => el.addEventListener("click", () => {
            const i = Number(el.dataset.i);
            if (startI < 0) { startI = i; el.classList.add("sel"); return; }
            if (i === startI) { el.classList.remove("sel"); startI = -1; return; }
            // cek garis lurus dari startI ke i cocok sama salah satu kata
            const hit = ws.placed.find(pl => {
                const a = pl.cells[0], b = pl.cells[pl.cells.length - 1];
                return (a === startI && b === i) || (a === i && b === startI);
            });
            cellEls[startI].classList.remove("sel");
            startI = -1;
            if (hit && found.indexOf(hit.word) < 0) {
                found.push(hit.word);
                snActSave(l.id, found);
                playSfx("challenge-done", 0.7);
                paintFound();
                const wEl = box.querySelector('.ws-word[data-w="' + hit.word + '"]');
                if (wEl) wEl.classList.add("done");
                if (found.length === ws.placed.length) fireConfetti("reward"); // semua ketemu!
            }
        }));
    } else if (type === "bingo") {
        const items = snBuildBingo(l);
        const marked = snActState(l.id); // list index yang dicentang
        let cellsHtml = "";
        items.forEach((t, i) => {
            cellsHtml += '<button type="button" class="bg-cell' + (marked.indexOf(i) >= 0 ? " on" : "") + '" data-i="' + i + '">' + esc(t) + '</button>';
        });
        box.innerHTML =
            '<div class="sn-paper sn-flat sk' + k + '" style="padding-top:20px;">' +
            '<span class="sn-washi"></span>' +
            '<div class="sn-kicker">' + esc((SN_ACT[l.id] || {}).title || "BINGO JOURNALING 🎯") + ' · ' + esc(snailMonthLabel(l).toUpperCase()) + '</div>' +
            '<div class="sn-act-hint">Kerjain misi kecilnya, ketuk buat nyentang. Satu baris penuh = BINGO! 🎉</div>' +
            '<div class="bg-grid">' + cellsHtml + '</div>' +
            '<div class="bg-banner" id="bgBanner" style="display:none;">🎉 BINGO! Kamu keren banget!</div>' +
            '</div>' +
            '<button type="button" class="sn-back" id="snBack">← Balik ke surat</button>';
        $("snBack").addEventListener("click", () => openSnailLetter(l, true));
        const pg = $("snailPage");
        if (pg) pg.scrollTop = 0;
        function hasBingo() {
            const on = i => marked.indexOf(i) >= 0;
            for (let r = 0; r < 4; r++) if ([0, 1, 2, 3].every(c => on(r * 4 + c))) return true;
            for (let c = 0; c < 4; c++) if ([0, 1, 2, 3].every(r => on(r * 4 + c))) return true;
            if ([0, 5, 10, 15].every(on) || [3, 6, 9, 12].every(on)) return true;
            return false;
        }
        function syncBanner(celebrate) {
            const b = $("bgBanner");
            if (!b) return;
            const win = hasBingo();
            b.style.display = win ? "" : "none";
            if (win && celebrate) { fireConfetti("reward"); playSfx("challenge-done"); }
        }
        syncBanner(false);
        box.querySelectorAll(".bg-cell").forEach(el => el.addEventListener("click", () => {
            const i = Number(el.dataset.i);
            const at = marked.indexOf(i);
            const hadBingo = hasBingo();
            if (at >= 0) { marked.splice(at, 1); el.classList.remove("on"); }
            else { marked.push(i); el.classList.add("on"); playSfx("love", 0.6); }
            snActSave(l.id, marked);
            syncBanner(!hadBingo); // bingo BARU aja kejadian -> rayain
        }));
    } else if (type === "scramble") {
        snActScramble(l, box, k);
    } else if (type === "dash") {
        snActDash(l, box, k);
    } else if (type === "snake") {
        snActSnake(l, box, k);
    } else if (type === "hopper") {
        snActHopper(l, box, k);
    } else {
        snActCatch(l, box, k);
    }
}

// ---------- Paper Hopper: Mochi lompat-lompat pijakan kertas ke atas (doodle jump) ----------
// Geser kiri-kanan buat ngarahin; mantul otomatis tiap nginjek memo. Pijakan
// berisi kata penyemangat / elemen kerajinan; power-up ☕/🖊️ = lompat super.
// Jatuh nggak langsung game over (3 ❤️, respawn) — target: nembus langit-langit galeri.
function snActHopper(l, box, k) {
    const pack = SN_ACT[l.id];
    const GOAL_M = pack.goal || 50;      // "meter" galeri
    const PXM = 100;                     // 1 m = 100px dunia
    const CRAFT = ["Washi", "Stiker", "Stempel", "Memo", "Catatan", "Pita"];
    box.innerHTML =
        '<div class="sn-paper sn-flat sk' + k + '" style="padding-top:20px;">' +
        '<span class="sn-washi"></span>' +
        '<div class="sn-kicker">' + esc(pack.title) + ' · ' + esc(snailMonthLabel(l).toUpperCase()) + '</div>' +
        '<div class="sn-act-hint">Geser kiri-kanan buat ngarahin Mochi — dia mantul sendiri tiap nginjek kertas! Naik sampai ' + GOAL_M + ' m, ☕/🖊️ = lompat super 🚀</div>' +
        '<div class="hp-stage" id="hpStage">' +
        '<div class="ct-score" id="hpScore">0 m / ' + GOAL_M + ' m</div>' +
        '<div class="wsn-lives hp-lives" id="hpLives">❤️❤️❤️</div>' +
        '<img class="hp-mochi" id="hpMochi" src="../images/sticker/str-6.png" alt="">' +
        '<div class="ct-start" id="hpStart"><button type="button" class="btn-primary" id="hpPlay">Lompat! 🐾</button></div>' +
        '</div>' +
        '</div>' +
        '<button type="button" class="sn-back" id="snBack">← Balik ke surat</button>';
    $("snBack").addEventListener("click", () => openSnailLetter(l, true));

    const stage = $("hpStage"), mochi = $("hpMochi"), scoreEl = $("hpScore"), livesEl = $("hpLives");
    const JUMP = 430, G = 900;
    let mx = 0.5, myW = 0, vyW = 0, camAlt = 0, hearts = 3, playing = false, lastT = 0, topSpawn = 0;
    const plats = [];

    function moveTo(clientX) {
        const rc = stage.getBoundingClientRect();
        mx = Math.max(0.06, Math.min(0.94, (clientX - rc.left) / rc.width));
    }
    stage.addEventListener("touchmove", e => { moveTo(e.touches[0].clientX); e.preventDefault(); }, { passive: false });
    stage.addEventListener("touchstart", e => moveTo(e.touches[0].clientX), { passive: true });
    stage.addEventListener("mousemove", e => moveTo(e.clientX));

    function cleanup() {
        plats.forEach(p => { if (p.el.parentNode) p.el.parentNode.removeChild(p.el); });
        plats.length = 0;
    }
    function addPlat(alt, isFirst) {
        const w = (plats.length % 2 === 0)
            ? pack.words[Math.floor(Math.random() * pack.words.length)]
            : CRAFT[Math.floor(Math.random() * CRAFT.length)];
        const el = document.createElement("div");
        const pu = !isFirst && Math.random() < 0.12; // sesekali ada power-up
        el.className = "hp-plat c" + (Math.floor(Math.random() * 5));
        el.innerHTML = esc(w) + (pu ? ' <span class="hp-pu">' + (Math.random() < 0.5 ? "☕" : "🖊️") + '</span>' : '');
        stage.appendChild(el);
        plats.push({ el: el, x: isFirst ? 0.5 : (0.1 + Math.random() * 0.8), alt: alt, pu: pu });
        topSpawn = Math.max(topSpawn, alt);
    }
    function end(win) {
        playing = false;
        gameMusicStop();
        cleanup();
        const st = $("hpStart");
        st.style.display = "";
        if (win) {
            playSfx("challenge-done");
            fireConfetti("reward");
            st.innerHTML = '<div class="ct-end">Kamu nembus langit-langit galeri! 🎨✨<br>Ternyata naiknya nggak harus buru-buru kan?</div>' +
                '<button type="button" class="btn-primary" id="hpPlay" style="margin-top:10px;">Lompat lagi 🔁</button>';
        } else {
            st.innerHTML = '<div class="ct-end">Kertasnya licin 📄💨<br>Nggak apa-apa, mulai dari pijakan pertama lagi ya 💙</div>' +
                '<button type="button" class="btn-primary" id="hpPlay" style="margin-top:10px;">Coba lagi 🐾</button>';
        }
        $("hpPlay").addEventListener("click", start);
    }
    function loop(t) {
        if (!playing || !stage.isConnected) { gameMusicStop(); return; }
        const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
        lastT = t;
        const rc = stage.getBoundingClientRect();
        const W = rc.width, H = rc.height;
        // fisika (dunia: ke atas = alt nambah)
        vyW -= G * dt;
        const prevW = myW;
        myW += vyW * dt;
        // nginjek pijakan (cuma pas lagi turun; cek nyebrangin alt pijakan)
        if (vyW < 0) {
            for (const p of plats) {
                if (prevW >= p.alt && myW <= p.alt && Math.abs((p.x - mx) * W) < 46) {
                    myW = p.alt;
                    if (p.pu) {
                        vyW = JUMP * 1.9; // lompat super!
                        playSfx("catch-mochi", 0.5);
                        mochi.classList.add("boost");
                        setTimeout(() => mochi.classList.remove("boost"), 500);
                    } else {
                        vyW = JUMP;
                        playSfx("flip", 0.15);
                    }
                    break;
                }
            }
        }
        // kamera ngikut ke atas
        camAlt = Math.max(camAlt, myW - H * 0.55);
        // spawn pijakan baru di atas layar
        while (topSpawn < camAlt + H + 120) addPlat(topSpawn + 62 + Math.random() * 32);
        // jatuh ke bawah layar -> respawn di pijakan terdekat, -1 ❤️
        if (myW < camAlt - 70) {
            hearts--;
            livesEl.textContent = "❤️".repeat(Math.max(0, hearts)) + "🩶".repeat(3 - Math.max(0, hearts));
            playSfx("light", 0.5);
            stage.classList.add("shake");
            setTimeout(() => stage.classList.remove("shake"), 350);
            if (hearts <= 0) { end(false); return; }
            const anchor = plats.filter(p => p.alt > camAlt + 40).sort((a, b) => a.alt - b.alt)[0];
            if (anchor) { myW = anchor.alt + 2; mx = anchor.x; vyW = JUMP; }
            else { myW = camAlt + 80; vyW = JUMP; }
        }
        // render
        mochi.style.transform = "translate(" + (mx * W - 23) + "px," + (H - (myW - camAlt) - 46) + "px)" +
            (vyW > 0 ? " scaleY(1.06)" : " scaleY(.97)");
        for (let i = plats.length - 1; i >= 0; i--) {
            const p = plats[i];
            const sy = H - (p.alt - camAlt);
            if (sy > H + 60) { // udah lewat bawah -> buang
                if (p.el.parentNode) p.el.parentNode.removeChild(p.el);
                plats.splice(i, 1);
                continue;
            }
            p.el.style.transform = "translate(" + (p.x * W - 34) + "px," + sy + "px)";
        }
        const m = Math.max(0, Math.floor(myW / PXM));
        scoreEl.textContent = Math.min(m, GOAL_M) + " m / " + GOAL_M + " m";
        if (myW >= GOAL_M * PXM) { end(true); return; }
        requestAnimationFrame(loop);
    }
    function start() {
        cleanup();
        mx = 0.5; myW = 0; vyW = JUMP; camAlt = 0; hearts = 3; topSpawn = 0;
        livesEl.textContent = "❤️❤️❤️";
        scoreEl.textContent = "0 m / " + GOAL_M + " m";
        addPlat(0, true);
        while (topSpawn < 400) addPlat(topSpawn + 62 + Math.random() * 32);
        $("hpStart").style.display = "none";
        gameMusicPlay("music-jump.mp3");
        playing = true;
        lastT = 0;
        requestAnimationFrame(loop);
    }
    $("hpPlay").addEventListener("click", start);
    const pg = $("snailPage");
    if (pg) pg.scrollTop = 0;
}

// ---------- Word Snake: Mochi memanjang makan kata sesuai urutan kutipan ----------
// Makan kata yang BENER urutannya -> badan manjang & kalimatnya kerangkai;
// salah makan = "tersedak" (❤️ -3 total). Tembok wrap-around, nabrak badan
// sendiri cuma kehilangan ❤️ — vibe santai, bukan hukuman.
function snActSnake(l, box, k) {
    const pack = SN_ACT[l.id];
    const tokens = pack.quote.split(" ");
    const COLS = 11, ROWS = 13;
    box.innerHTML =
        '<div class="sn-paper sn-flat sk' + k + '" style="padding-top:20px;">' +
        '<span class="sn-washi"></span>' +
        '<div class="sn-kicker">' + esc(pack.title) + ' · ' + esc(snailMonthLabel(l).toUpperCase()) + '</div>' +
        '<div class="sn-act-hint">Geser (swipe) buat belokin Mochi — makan kata sesuai urutan kalimatnya! Salah makan = tersedak 😖</div>' +
        '<div class="wsn-quote" id="wsnQuote"></div>' +
        '<div class="wsn-stage" id="wsnStage">' +
        '<div class="wsn-lives" id="wsnLives">❤️❤️❤️</div>' +
        '<div class="ct-start" id="wsnStart"><button type="button" class="btn-primary" id="wsnPlay">Mulai 🐍</button></div>' +
        '</div>' +
        '<div class="wsn-pad">' +
        '<button type="button" class="wsn-btn" data-d="u">▲</button>' +
        '<div><button type="button" class="wsn-btn" data-d="l">◀</button>' +
        '<button type="button" class="wsn-btn" data-d="d">▼</button>' +
        '<button type="button" class="wsn-btn" data-d="r">▶</button></div>' +
        '</div>' +
        '</div>' +
        '<button type="button" class="sn-back" id="snBack">← Balik ke surat</button>';
    $("snBack").addEventListener("click", () => openSnailLetter(l, true));

    const stage = $("wsnStage"), quoteEl = $("wsnQuote"), livesEl = $("wsnLives");
    const CELL = Math.floor(stage.clientWidth / COLS);
    stage.style.height = (CELL * ROWS) + "px";

    let snake, dir, ndir, idx, hearts, tiles, eaten, playing = false, lastStep = 0, invUntil = 0;
    let stepMs = 300; // tempo langkah; transisi CSS ngikutin ini biar gerak meluncur mulus
    const segEls = [], tileEls = [];

    function renderQuote() {
        let h = "";
        tokens.forEach((w, i) => {
            h += '<span class="wsn-tok' + (i < idx ? " ate" : (i === idx ? " next" : "")) + '">' + esc(w) + '</span>';
        });
        quoteEl.innerHTML = h;
    }
    // span = lebar pill dalam satuan sel (kata panjang bisa 2-3 sel)
    function cellFree(x, y, span) {
        span = span || 1;
        for (let i = 0; i < span; i++) {
            const cx = x + i;
            if (snake.some(s => s.x === cx && s.y === y)) return false;
            if (tiles.some(t => t.y === y && cx >= t.x && cx < t.x + (t.span || 1))) return false;
        }
        return true;
    }
    function spawnTiles() {
        tiles.length = 0;
        tileEls.forEach(e => { if (e.parentNode) e.parentNode.removeChild(e); });
        tileEls.length = 0;
        // 1 kata bener + 2 pengecoh (dari sisa kata kutipan; kalau kurang, kata umum)
        const DECOY = ["nanti", "jangan", "kemarin", "takut"];
        const opts = [tokens[idx]];
        const others = tokens.slice(idx + 1).concat(DECOY).filter(w => w !== tokens[idx]);
        while (opts.length < 3 && others.length) opts.push(others.splice(Math.floor(Math.random() * others.length), 1)[0]);
        opts.forEach(w => {
            // perkiraan lebar pill dalam sel (font .7rem ~6px/huruf + padding)
            const span = Math.min(3, Math.max(1, Math.ceil((w.length * 6 + 16) / CELL)));
            const hot = w === tokens[idx];
            let x, y, tries = 0;
            do {
                if (hot) {
                    // kata target selalu di area tengah — jauh dari tepi, hati, & pojok
                    x = 1 + Math.floor(Math.random() * Math.max(1, COLS - span - 1));
                    y = 2 + Math.floor(Math.random() * (ROWS - 4));
                } else {
                    x = Math.floor(Math.random() * (COLS - span + 1));
                    y = 1 + Math.floor(Math.random() * (ROWS - 1)); // baris atas buat indikator ❤️
                }
                tries++;
            } while (!cellFree(x, y, span) && tries < 80);
            const el = document.createElement("div");
            // kata yang BENER dikasih warna sama kayak highlight di bar kutipan
            el.className = "wsn-word" + (hot ? " hot" : "");
            el.textContent = w;
            el.style.transform = "translate(" + (x * CELL) + "px," + (y * CELL) + "px)";
            el.style.height = CELL + "px";
            stage.appendChild(el);
            tiles.push({ x: x, y: y, w: w, span: span });
            tileEls.push(el);
        });
    }
    function draw() {
        while (segEls.length < snake.length) {
            let el;
            if (segEls.length === 0) {
                // kepala = Mochi, dilebihin dikit & di-center di sel biar nyambung sama badan
                el = document.createElement("img");
                el.src = "../images/sticker/str-6.png";
                el.className = "wsn-head";
                el.alt = "";
                el.style.width = Math.round(CELL * 1.4) + "px";
                el.style.height = Math.round(CELL * 1.4) + "px";
                el.style.marginLeft = (-Math.round(CELL * 0.2)) + "px";
                el.style.marginTop = (-Math.round(CELL * 0.2)) + "px";
            } else {
                // badan = pill berisi kata yang udah dimakan
                el = document.createElement("div");
                el.className = "wsn-seg";
                el.style.width = Math.round(CELL * 1.6) + "px";
                el.style.height = Math.round(CELL * 0.78) + "px";
                el.style.marginLeft = (-Math.round(CELL * 0.3)) + "px";
                el.style.marginTop = Math.round(CELL * 0.11) + "px";
            }
            stage.appendChild(el);
            segEls.push(el);
        }
        snake.forEach((s, i) => {
            const el = segEls[i];
            // transisi = tempo langkah -> meluncur nyambung, nggak gerak-berhenti-gerak.
            // Loncat wrap tembok (delta > 1 sel) transisinya dimatiin biar nggak "kelempar".
            const px = el._cx, py = el._cy;
            const jump = px !== undefined && (Math.abs(s.x - px) > 1 || Math.abs(s.y - py) > 1);
            el.style.transition = jump ? "none" : "transform " + stepMs + "ms linear";
            el._cx = s.x; el._cy = s.y;
            el.style.transform = "translate(" + (s.x * CELL) + "px," + (s.y * CELL) + "px)";
            if (i > 0) {
                // segmen persis di belakang kepala = kata terbaru; ekor = kata pertama
                const w = eaten[eaten.length - i] || "";
                if (el.textContent !== w) el.textContent = w;
            }
        });
    }
    function hurt() {
        hearts--;
        livesEl.textContent = "❤️".repeat(Math.max(0, hearts)) + "🩶".repeat(3 - Math.max(0, hearts));
        playSfx("light", 0.5);
        stage.classList.add("shake");
        setTimeout(() => stage.classList.remove("shake"), 350);
        invUntil = performance.now() + 1400;
        if (hearts <= 0) end(false);
    }
    function end(win) {
        playing = false;
        gameMusicStop();
        const st = $("wsnStart");
        st.style.display = "";
        if (win) {
            playSfx("challenge-done");
            fireConfetti("reward");
            st.innerHTML = '<div class="ct-end">Kalimatnya utuh! 🎉</div>' +
                '<div class="wsn-final">"' + esc(pack.quote) + '"</div>' +
                '<button type="button" class="btn-primary" id="wsnCopy" style="margin-top:10px;">📋 Salin jadi daily quote</button>' +
                '<button type="button" class="btn-primary" id="wsnPlay" style="margin-top:8px;background:transparent;color:var(--blue);border:1.5px dashed var(--blue);box-shadow:none;">Main lagi 🔁</button>';
            $("wsnCopy").addEventListener("click", async () => {
                try { await navigator.clipboard.writeText('"' + pack.quote + '" — Mochi 🐾 @seminggu_satu'); $("wsnCopy").textContent = "✓ Tersalin!"; }
                catch (e) { prompt("Salin manual ya:", pack.quote); }
            });
        } else {
            st.innerHTML = '<div class="ct-end">Mochi kekenyangan kata yang salah 😖<br>Pelan-pelan aja, kalimatnya nggak lari kok 💙</div>' +
                '<button type="button" class="btn-primary" id="wsnPlay" style="margin-top:10px;">Coba lagi 🐍</button>';
        }
        $("wsnPlay").addEventListener("click", start);
    }
    function step(now) {
        dir = ndir;
        const h = snake[0];
        const nx = (h.x + dir.x + COLS) % COLS, ny = (h.y + dir.y + ROWS) % ROWS; // tembok wrap
        // nabrak badan sendiri (kecuali lagi kebal)
        if (now >= invUntil && snake.some((s, i) => i > 0 && s.x === nx && s.y === ny)) hurt();
        snake.unshift({ x: nx, y: ny });
        const ti = tiles.findIndex(t => t.y === ny && nx >= t.x && nx < t.x + (t.span || 1));
        if (ti >= 0) {
            if (tiles[ti].w === tokens[idx]) {
                eaten.push(tokens[idx]); // kata nempel jadi badan
                idx++;
                playSfx("love", 0.6);
                renderQuote();
                if (idx >= tokens.length) { draw(); end(true); return; }
                spawnTiles(); // badan manjang: ekor nggak di-pop
            } else {
                hurt(); // tersedak
                if (!playing) return;
                snake.pop(); // nggak manjang
                spawnTiles();
            }
        } else {
            snake.pop();
        }
        draw();
    }
    function loop(t) {
        if (!playing || !stage.isConnected) { gameMusicStop(); return; }
        stepMs = Math.max(200, 300 - idx * 8);
        if (t - lastStep > stepMs) { step(t); lastStep = t; }
        requestAnimationFrame(loop);
    }
    function setDir(d) {
        const D = { u: { x: 0, y: -1 }, d: { x: 0, y: 1 }, l: { x: -1, y: 0 }, r: { x: 1, y: 0 } }[d];
        if (!D) return;
        // putar balik dilarang CUMA kalau udah punya badan (nabrak leher sendiri);
        // masih kepala doang boleh — kata yang pas di belakang tetap kekejar
        if (snake.length > 1 && D.x === -dir.x && D.y === -dir.y) return;
        ndir = D;
    }
    let sx = 0, sy = 0;
    stage.addEventListener("touchstart", e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    stage.addEventListener("touchend", e => {
        const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
        if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return;
        setDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "r" : "l") : (dy > 0 ? "d" : "u"));
    }, { passive: true });
    box.querySelectorAll(".wsn-btn").forEach(b => b.addEventListener("click", () => setDir(b.dataset.d)));

    function start() {
        segEls.forEach(e => { if (e.parentNode) e.parentNode.removeChild(e); });
        segEls.length = 0;
        snake = [{ x: 5, y: 6 }]; // mulai cuma kepala — badan tumbuh dari kata yang dimakan
        dir = { x: 1, y: 0 }; ndir = dir;
        idx = 0; hearts = 3; invUntil = 0;
        tiles = []; eaten = [];
        livesEl.textContent = "❤️❤️❤️";
        renderQuote();
        spawnTiles();
        draw();
        $("wsnStart").style.display = "none";
        gameMusicPlay("music-snake.mp3");
        playing = true;
        lastStep = 0;
        requestAnimationFrame(loop);
    }
    $("wsnPlay").addEventListener("click", start);
    const pg = $("snailPage");
    if (pg) pg.scrollTop = 0;
}

// ---------- Mochi's Word Dash: flappy nembus awan pikiran negatif ----------
// Tap = ngepak. Kumpulin kata positif yang beterbangan; nabrak awan negatif
// nggak langsung game over (3 ❤️) — vibe-nya "bersihin kepala", bukan dihukum.
function snActDash(l, box, k) {
    const pack = SN_ACT[l.id];
    const GOAL = pack.goal || 15;
    box.innerHTML =
        '<div class="sn-paper sn-flat sk' + k + '" style="padding-top:20px;">' +
        '<span class="sn-washi"></span>' +
        '<div class="sn-kicker">' + esc(pack.title) + ' · ' + esc(snailMonthLabel(l).toUpperCase()) + '</div>' +
        '<div class="sn-act-hint">Tap buat ngepak! Kumpulin ' + GOAL + ' kata positif, hindarin awan pikiran negatif ☁️</div>' +
        '<div class="wd-stage" id="wdStage">' +
        '<div class="ct-score" id="wdScore">0 / ' + GOAL + '</div>' +
        '<div class="wd-lives" id="wdLives">❤️❤️❤️</div>' +
        '<img class="wd-mochi" id="wdMochi" src="../images/sticker/str-6.png" alt="">' +
        '<div class="ct-start" id="wdStart"><button type="button" class="btn-primary" id="wdPlay">Terbang! 🕊️</button></div>' +
        '</div>' +
        '</div>' +
        '<button type="button" class="sn-back" id="snBack">← Balik ke surat</button>';
    $("snBack").addEventListener("click", () => openSnailLetter(l, true));

    const stage = $("wdStage"), mochi = $("wdMochi"), scoreEl = $("wdScore"), livesEl = $("wdLives");
    const MX = 54; // posisi x Mochi (tetap)
    let my = 0, vy = 0, playing = false, lives = 3, got = 0, lastT = 0, spawnT = 0, invUntil = 0;
    const obs = []; // { el, x, gapY, gapH, chip: {el, x, y, taken} | null }

    function flap() { if (playing) { vy = -260; playSfx("catch-mochi", 0.35); } }
    stage.addEventListener("pointerdown", (e) => { flap(); e.preventDefault(); });

    function cleanup() {
        obs.forEach(o => { if (o.el.parentNode) o.el.parentNode.removeChild(o.el); if (o.chip && o.chip.el.parentNode) o.chip.el.parentNode.removeChild(o.chip.el); });
        obs.length = 0;
    }
    function spawnOb(W, H) {
        const gapH = 150;
        const gapY = 34 + Math.random() * (H - gapH - 68);
        const cw = pack.clouds[Math.floor(Math.random() * pack.clouds.length)];
        const el = document.createElement("div");
        el.className = "wd-ob";
        el.innerHTML =
            '<div class="wd-cloud top" style="height:' + gapY + 'px;"><span>☁️ ' + esc(cw) + '</span></div>' +
            '<div class="wd-cloud bot" style="top:' + (gapY + gapH) + 'px;"></div>';
        stage.appendChild(el);
        const o = { el: el, x: W + 40, gapY: gapY, gapH: gapH, chip: null };
        // ~60% celah ada kata positifnya
        if (Math.random() < 0.62) {
            const wi = Math.floor(Math.random() * pack.words.length);
            const w = pack.words[wi];
            const ce = document.createElement("div");
            ce.className = "wd-chip c" + (wi % 5); // warna beda per kata biar rame
            ce.textContent = "✨ " + w;
            stage.appendChild(ce);
            o.chip = { el: ce, x: o.x + 26, y: gapY + gapH / 2 - 14, taken: false };
        }
        obs.push(o);
    }
    function end(win) {
        playing = false;
        gameMusicStop();
        cleanup();
        const st = $("wdStart");
        st.style.display = "";
        if (win) {
            playSfx("challenge-done");
            fireConfetti("reward");
            st.innerHTML = '<div class="ct-end">Kepala udah bersih & ringan ✨<br>Kata-kata baiknya bawa ke jurnal ya!</div>' +
                '<button type="button" class="btn-primary" id="wdPlay" style="margin-top:10px;">Terbang lagi 🔁</button>';
        } else {
            st.innerHTML = '<div class="ct-end">Kepalanya lagi penuh banget ☁️<br>Tarik napas dulu… terus coba lagi pelan-pelan 💙</div>' +
                '<button type="button" class="btn-primary" id="wdPlay" style="margin-top:10px;">Coba lagi 🕊️</button>';
        }
        $("wdPlay").addEventListener("click", start);
    }
    function loop(t) {
        if (!playing || !stage.isConnected) { gameMusicStop(); return; }
        const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
        lastT = t;
        const rc = stage.getBoundingClientRect();
        const W = rc.width, H = rc.height;
        // fisika Mochi
        vy += 620 * dt;
        my = Math.max(4, Math.min(H - 52, my + vy * dt));
        if (my <= 4 || my >= H - 52) vy = 0; // mentok atas/bawah: berhenti halus, bukan mati
        mochi.style.transform = "translateY(" + my + "px) rotate(" + Math.max(-22, Math.min(26, vy / 9)) + "deg)";
        // spawn
        if (t - spawnT > 1700) { spawnOb(W, H); spawnT = t; }
        const vx = 105 + got * 3;
        const inv = t < invUntil;
        mochi.classList.toggle("hurt", inv);
        for (let i = obs.length - 1; i >= 0; i--) {
            const o = obs[i];
            o.x -= vx * dt;
            o.el.style.transform = "translateX(" + o.x + "px)";
            if (o.chip && !o.chip.taken) {
                o.chip.x -= vx * dt;
                o.chip.el.style.transform = "translate(" + o.chip.x + "px," + o.chip.y + "px)";
            }
            // tabrakan (kotak Mochi ~ MX..MX+46, my..my+44)
            const hitX = o.x < MX + 46 && o.x + 62 > MX;
            if (hitX && !inv && (my < o.gapY - 6 || my + 44 > o.gapY + o.gapH + 6)) {
                lives--;
                livesEl.textContent = "❤️".repeat(Math.max(0, lives)) + "🩶".repeat(3 - Math.max(0, lives));
                playSfx("light", 0.5); // "duk" kecil pas nabrak awan
                invUntil = t + 1300; // kebal sebentar biar nggak double-hit
                stage.classList.add("shake");
                setTimeout(() => stage.classList.remove("shake"), 350);
                if (lives <= 0) { end(false); return; }
            }
            // ambil kata positif
            if (o.chip && !o.chip.taken && o.chip.x < MX + 46 && o.chip.x + 66 > MX && o.chip.y < my + 44 && o.chip.y + 28 > my) {
                o.chip.taken = true;
                o.chip.el.classList.add("got");
                (function (el) { setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 300); })(o.chip.el);
                got++;
                scoreEl.textContent = got + " / " + GOAL;
                playSfx("love", 0.55);
                mochi.classList.add("boost");
                setTimeout(() => mochi.classList.remove("boost"), 450);
                if (got >= GOAL) { end(true); return; }
            }
            if (o.x < -90) {
                if (o.el.parentNode) o.el.parentNode.removeChild(o.el);
                if (o.chip && o.chip.el.parentNode) o.chip.el.parentNode.removeChild(o.chip.el);
                obs.splice(i, 1);
            }
        }
        requestAnimationFrame(loop);
    }
    function start() {
        cleanup();
        got = 0; lives = 3; vy = 0; invUntil = 0;
        my = stage.getBoundingClientRect().height / 2 - 22;
        scoreEl.textContent = "0 / " + GOAL;
        livesEl.textContent = "❤️❤️❤️";
        $("wdStart").style.display = "none";
        gameMusicPlay("music-word-dash.mp3");
        playing = true;
        lastT = 0; spawnT = 0;
        requestAnimationFrame(loop);
    }
    $("wdPlay").addEventListener("click", start);
    const pg = $("snailPage");
    if (pg) pg.scrollTop = 0;
}

// ---------- Susun Kata: acak huruf -> kata kunci -> refleksi journaling ----------
function snActScramble(l, box, k) {
    const pack = SN_ACT[l.id];
    const rounds = pack.rounds;
    const solved = snActState(l.id); // index ronde yang udah kebuka
    let cur = 0;
    while (cur < rounds.length && solved.indexOf(cur) >= 0) cur++;

    function shuffledTiles(word, ri) {
        // deterministik per ronde biar susunannya stabil, dan dijamin nggak kebetulan
        // udah urut (digeser 1 kalau hasil acaknya = kata aslinya)
        let a = snShuffle(word.split(""), snMulberry(snSeed(l) + ri * 31 + 5));
        if (a.join("") === word) a.push(a.shift());
        return a;
    }

    function render() {
        if (cur >= rounds.length) {
            box.innerHTML =
                '<div class="sn-paper sn-flat sk' + k + '" style="padding-top:20px;text-align:center;">' +
                '<span class="sn-washi"></span>' +
                '<div class="sn-kicker">' + esc(pack.title) + '</div>' +
                '<div class="sc-done-em">🎉</div>' +
                '<div class="sc-q" style="text-align:center;">Semua kata kebuka! Refleksinya boleh banget dibawa ke jurnal minggu ini 💙</div>' +
                '</div>' +
                '<button type="button" class="sn-back" id="snBack">← Balik ke surat</button>';
            $("snBack").addEventListener("click", () => openSnailLetter(l, true));
            return;
        }
        const r = rounds[cur];
        const tiles = shuffledTiles(r.w, cur);
        let tilesHtml = "";
        tiles.forEach((ch, i) => { tilesHtml += '<button type="button" class="sc-tile" data-i="' + i + '">' + ch + '</button>'; });
        let slotsHtml = "";
        for (let i = 0; i < r.w.length; i++) slotsHtml += '<span class="sc-slot"></span>';
        box.innerHTML =
            '<div class="sn-paper sn-flat sk' + k + '" style="padding-top:20px;">' +
            '<span class="sn-washi"></span>' +
            '<div class="sn-kicker">' + esc(pack.title) + ' · ' + (cur + 1) + '/' + rounds.length + '</div>' +
            '<div class="sn-act-hint">Susun huruf-hurufnya jadi satu kata — ketuk hurufnya urut ya! (salah? ketuk ↺)</div>' +
            '<div class="sc-slots" id="scSlots">' + slotsHtml + '</div>' +
            '<div class="sc-tiles" id="scTiles">' + tilesHtml + '</div>' +
            '<button type="button" class="sc-reset" id="scReset">↺ Ulang</button>' +
            '<div class="sc-reveal" id="scReveal" style="display:none;"></div>' +
            '</div>' +
            '<button type="button" class="sn-back" id="snBack">← Balik ke surat</button>';
        $("snBack").addEventListener("click", () => openSnailLetter(l, true));
        const slots = box.querySelectorAll(".sc-slot");
        const tileEls = box.querySelectorAll(".sc-tile");
        let typed = "";
        function resetRound() {
            typed = "";
            slots.forEach(s => { s.textContent = ""; s.classList.remove("fill"); });
            tileEls.forEach(t => { t.disabled = false; t.classList.remove("used"); });
        }
        $("scReset").addEventListener("click", resetRound);
        tileEls.forEach(t => t.addEventListener("click", () => {
            if (t.disabled || typed.length >= r.w.length) return;
            t.disabled = true; t.classList.add("used");
            slots[typed.length].textContent = t.textContent;
            slots[typed.length].classList.add("fill");
            typed += t.textContent;
            if (typed.length === r.w.length) {
                if (typed === r.w) {
                    playSfx("challenge-done", 0.7);
                    solved.push(cur);
                    snActSave(l.id, solved);
                    const rev = $("scReveal");
                    rev.style.display = "";
                    rev.innerHTML = '<div class="sc-word">✨ ' + esc(r.w) + '</div><div class="sc-q">' + esc(r.q) + '</div>' +
                        '<button type="button" class="btn-primary" id="scNext" style="margin-top:12px;">' + (cur + 1 < rounds.length ? "Kata berikutnya →" : "Selesai 🎉") + '</button>';
                    $("scTiles").style.display = "none";
                    $("scReset").style.display = "none";
                    if (cur + 1 >= rounds.length) fireConfetti("reward");
                    $("scNext").addEventListener("click", () => { cur++; render(); });
                } else {
                    const sl = $("scSlots");
                    sl.classList.add("wrong");
                    setTimeout(() => { sl.classList.remove("wrong"); resetRound(); }, 480);
                }
            }
        }));
        const pg = $("snailPage");
        if (pg) pg.scrollTop = 0;
    }
    render();
}

// musik latar game (satu pemutar, src gonta-ganti per game; loop, stop pas keluar)
let _gameAudio = null, _gameSrc = "";
function gameMusicPlay(file) {
    if (sndMuted()) return;
    try {
        if (!_gameAudio) { _gameAudio = new Audio(); _gameAudio.loop = true; }
        if (_gameSrc !== file) {
            _gameAudio.src = "../music/" + file;
            _gameSrc = file;
        } else if (!_gameAudio.paused) {
            return; // file sama & masih muter -> biarin nyambung (musik halaman surat)
        }
        _gameAudio.volume = 0.6;
        _gameAudio.currentTime = 0;
        _gameAudio.play().catch(() => { });
    } catch (e) { }
}
function gameMusicStop() {
    try { if (_gameAudio) _gameAudio.pause(); } catch (e) { }
}

// ---------- Tangkap Rasa: arcade gelembung emosi jatuh, Mochi nangkepin ----------
function snActCatch(l, box, k) {
    const pack = SN_ACT[l.id];
    const GOAL = pack.goal || 10;
    box.innerHTML =
        '<div class="sn-paper sn-flat sk' + k + '" style="padding-top:20px;">' +
        '<span class="sn-washi"></span>' +
        '<div class="sn-kicker">' + esc(pack.title) + ' · ' + esc(snailMonthLabel(l).toUpperCase()) + '</div>' +
        '<div class="sn-act-hint">Geser Mochi kiri-kanan buat nangkep gelembung rasa — tiap rasa yang ketangkep dipeluk sama Mochi 🫧</div>' +
        '<div class="ct-stage" id="ctStage">' +
        '<div class="ct-score" id="ctScore">0 / ' + GOAL + '</div>' +
        '<div class="ct-toast" id="ctToast"></div>' +
        '<img class="ct-mochi" id="ctMochi" src="../images/sticker/str-6.png" alt="">' +
        '<div class="ct-start" id="ctStart"><button type="button" class="btn-primary" id="ctPlay">Mulai 🫧</button></div>' +
        '</div>' +
        '</div>' +
        '<button type="button" class="sn-back" id="snBack">← Balik ke surat</button>';
    $("snBack").addEventListener("click", () => openSnailLetter(l, true));

    const stage = $("ctStage"), mochi = $("ctMochi"), toast = $("ctToast"), scoreEl = $("ctScore");
    let mx = 0.5; // posisi mochi 0..1
    function moveTo(clientX) {
        const rc = stage.getBoundingClientRect();
        mx = Math.max(0.08, Math.min(0.92, (clientX - rc.left) / rc.width));
        mochi.style.left = (mx * 100) + "%";
    }
    stage.addEventListener("touchmove", e => { moveTo(e.touches[0].clientX); e.preventDefault(); }, { passive: false });
    stage.addEventListener("touchstart", e => moveTo(e.touches[0].clientX), { passive: true });
    stage.addEventListener("mousemove", e => moveTo(e.clientX));

    let caught = 0, playing = false, lastSpawn = 0, lastT = 0;
    const bubs = [];
    let toastTimer = null;
    function showToast(v) {
        toast.textContent = v;
        toast.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove("show"), 1700);
    }
    function spawn() {
        const ei = Math.floor(Math.random() * pack.emos.length);
        const emo = pack.emos[ei];
        const el = document.createElement("div");
        el.className = "ct-bub c" + (ei % 6); // warna beda per emosi biar playful
        el.textContent = emo.w;
        const x = 0.1 + Math.random() * 0.8;
        el.style.left = (x * 100) + "%";
        el.style.rotate = (Math.random() * 10 - 5).toFixed(1) + "deg";
        stage.appendChild(el);
        bubs.push({ el: el, x: x, y: -30, v: 55 + Math.random() * 40 + caught * 2.2, emo: emo });
    }
    function loop(t) {
        if (!playing || !stage.isConnected) { gameMusicStop(); return; } // halaman ditinggal -> stop
        const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
        lastT = t;
        if (t - lastSpawn > Math.max(520, 1100 - caught * 22)) { spawn(); lastSpawn = t; }
        const rc = stage.getBoundingClientRect();
        const catchY = rc.height - 74;
        for (let i = bubs.length - 1; i >= 0; i--) {
            const b = bubs[i];
            b.y += b.v * dt;
            b.el.style.transform = "translate(-50%," + b.y + "px)";
            if (b.y >= catchY && b.y <= catchY + 46 && Math.abs(b.x - mx) < 0.14) {
                // ketangkep!
                b.el.classList.add("pop");
                (function (el) { setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 250); })(b.el);
                bubs.splice(i, 1);
                caught++;
                scoreEl.textContent = caught + " / " + GOAL;
                playSfx("love", 0.55);
                showToast(b.emo.v);
                if (caught >= GOAL) { end(); return; }
            } else if (b.y > rc.height + 20) {
                if (b.el.parentNode) b.el.parentNode.removeChild(b.el);
                bubs.splice(i, 1);
            }
        }
        requestAnimationFrame(loop);
    }
    function end() {
        playing = false;
        gameMusicStop();
        bubs.forEach(b => { if (b.el.parentNode) b.el.parentNode.removeChild(b.el); });
        bubs.length = 0;
        playSfx("challenge-done");
        fireConfetti("reward");
        const st = $("ctStart");
        st.style.display = "";
        st.innerHTML = '<div class="ct-end">Semua rasanya udah dipeluk 🤗<br>Kepala rasanya lebih lega kan?</div>' +
            '<button type="button" class="btn-primary" id="ctPlay" style="margin-top:10px;">Main lagi 🔁</button>';
        $("ctPlay").addEventListener("click", start);
    }
    function start() {
        caught = 0;
        scoreEl.textContent = "0 / " + GOAL;
        $("ctStart").style.display = "none";
        gameMusicPlay("music_catch.mp3");
        playing = true;
        lastSpawn = 0; lastT = 0;
        requestAnimationFrame(loop);
    }
    $("ctPlay").addEventListener("click", start);
    const pg = $("snailPage");
    if (pg) pg.scrollTop = 0;
}

// Baca satu surat: kertas se-skin amplopnya, postmark bulan, ttd Mochi
function openSnailLetter(l, silent) {
    const body = $("snpBody");
    if (!body) return;
    gameMusicPlay("music-snail.mp3"); // balik dari game -> musik halaman surat lagi
    if (!silent) playSfx("open-mail");
    snailMarkRead(l.id);
    const k = snailSkin(l);
    body.innerHTML =
        '<div class="sn-paper sk' + k + '">' +
        '<span class="sn-washi"></span>' +
        '<span class="sn-postmark">POS BALAI WARGA<br>' + esc(snailMonthLabel(l).toUpperCase()) + '</span>' +
        '<div class="sn-kicker">SNAIL MAIL · ' + SN_STAMPS[k] + '</div>' +
        '<div class="sn-title">' + esc(l.theme) + '</div>' +
        '<div class="sn-body">' + esc(l.letter_content) + '</div>' +
        '<div class="sn-sign">— Mochi 🐾</div>' +
        '</div>' +
        '<button type="button" class="sn-bonus" id="snBonus">🎁 Bonus bulan ini: ' + snActLabel(l) + ' →</button>' +
        '<button type="button" class="sn-back" id="snBack">← Balik ke Kotak Surat</button>';
    $("snBack").addEventListener("click", renderSnailBox);
    $("snBonus").addEventListener("click", () => openSnailActivity(l));
    const pg = $("snailPage");
    if (pg) pg.scrollTop = 0;
}

// ---------- Kotak Pos Warga: kotak saran ber-vote di mading ----------
const SG_CATS = [
    { k: "challenge", e: "🎯", t: "Ide Challenge / Game" },
    { k: "surat", e: "💌", t: "Tema Surat Bulanan" },
    { k: "fitur", e: "✨", t: "Usulan Fitur" }
];
let _sgData = null;   // { items, left }
let _sgCat = "challenge";

function sgCatInfo(k) { return SG_CATS.find(c => c.k === k) || SG_CATS[2]; }

async function loadSuggestions(force) {
    if (_sgData && !force) return _sgData;
    _sgData = await fetchJSONP(GS + "?page=suggestions&wa=" + encodeURIComponent(_profile.wa), "sug", 15000);
    if (!_sgData || !Array.isArray(_sgData.items)) _sgData = { items: [] };
    if (typeof _sgData.left !== "number") _sgData.left = 0;
    return _sgData;
}

function renderPbPanel() {
    const panel = $("pbBody");
    if (!panel || !_sgData) return;
    const left = _sgData.left;
    let chips = "";
    SG_CATS.forEach(c => {
        chips += '<button type="button" class="pb-cat' + (_sgCat === c.k ? " on" : "") + '" data-cat="' + c.k + '">' + c.e + ' ' + c.t + '</button>';
    });
    // urut: vote terbanyak dulu, seri -> terbaru
    const items = _sgData.items.slice().sort((a, b) => (b.votes - a.votes) || (b.ts - a.ts));
    let list = "";
    items.forEach(it => {
        const c = sgCatInfo(it.category);
        list += '<div class="pb-item">' +
            '<div class="pb-item-top"><span class="pb-item-cat">' + c.e + ' ' + esc(c.t) + '</span>' +
            '<button type="button" class="pb-vote' + (it.voted ? " on" : "") + '" data-sgv="' + esc(it.id) + '">📮 ' + it.votes + '</button></div>' +
            '<div class="pb-item-text">' + esc(it.text) + '</div>' +
            '<div class="pb-item-by">— ' + esc(it.nickname) + (it.mine ? ' <span class="me-star">⭐</span>' : '') + ' · ' + esc(timeAgo(it.ts)) + '</div>' +
            '</div>';
    });
    panel.innerHTML =
        '<div class="pb-form">' +
        '<div class="pb-form-t">Mau usul apa nih? 📨</div>' +
        '<div class="pb-cats">' + chips + '</div>' +
        '<textarea id="pbInput" maxlength="200" rows="3" placeholder="Tulis ide / aspirasimu… (max 200)"></textarea>' +
        '<button type="button" class="btn-primary" id="pbSend"' + (left <= 0 ? " disabled" : "") + ' style="margin-top:8px;">' +
        (left <= 0 ? "Kuota hari ini habis — besok lagi 🌙" : "📮 Masukin ke Kotak Pos" + (left < 2 ? " (" + left + " lagi)" : "")) + '</button>' +
        '</div>' +
        (list ? '<div class="pb-list-t">📬 Aspirasi warga — dukung yang kamu suka!</div>' + list
            : '<div class="pb-empty">Belum ada usulan — jadilah yang pertama! ✨</div>');

    panel.querySelectorAll(".pb-cat").forEach(b => b.addEventListener("click", () => {
        _sgCat = b.dataset.cat;
        panel.querySelectorAll(".pb-cat").forEach(x => x.classList.toggle("on", x.dataset.cat === _sgCat));
    }));
    $("pbSend").addEventListener("click", () => {
        const text = $("pbInput").value.trim();
        if (text.length < 5) { alert("Usulannya kependekan 😅 ceritain dikit lagi ya."); return; }
        // OPTIMISTIS (pola sama kayak mood): usulan langsung nempel di list, POST
        // jalan di belakang; gagal -> dicabut lagi + kuota balik
        const temp = {
            id: "tmp" + Date.now().toString(36),
            nickname: _profile.nickname || "Kamu",
            category: _sgCat, text: text,
            votes: 0, voted: false, mine: true, ts: Date.now()
        };
        _sgData.items.unshift(temp);
        _sgData.left = Math.max(0, _sgData.left - 1);
        playSfx("open-mail");
        fireConfetti("quest");
        renderPbPanel(); // form ke-reset + item baru langsung keliatan, nol loading
        apiPost({ action: "memberPostSuggestion", token: _profile.token, category: temp.category, text: temp.text }).then(r => {
            if (r.status === "success") {
                if (r.id) { temp.id = r.id; renderPbPanel(); } // id asli -> tombol vote-nya langsung valid
            } else {
                const at = _sgData.items.indexOf(temp);
                if (at >= 0) _sgData.items.splice(at, 1);
                _sgData.left++;
                renderPbPanel();
                alert(r.message || "Gagal ngirim usulan.");
            }
        }).catch(() => {
            const at = _sgData.items.indexOf(temp);
            if (at >= 0) _sgData.items.splice(at, 1);
            _sgData.left++;
            renderPbPanel();
            alert("Gagal terhubung ke server. Usulanmu belum kekirim, coba lagi ya.");
        });
    });
    panel.querySelectorAll("[data-sgv]").forEach(b => b.addEventListener("click", async () => {
        const it = _sgData.items.find(x => x.id === b.dataset.sgv);
        if (!it) return;
        // optimistis: toggle langsung, koreksi dari respons server
        it.voted = !it.voted;
        it.votes = Math.max(0, it.votes + (it.voted ? 1 : -1));
        if (it.voted) playSfx("love", 0.6);
        b.classList.toggle("on", it.voted);
        b.textContent = "📮 " + it.votes;
        try {
            const r = await apiPost({ action: "memberVoteSuggestion", token: _profile.token, id: it.id });
            if (r.status === "success") { it.votes = r.votes; it.voted = r.voted; b.textContent = "📮 " + it.votes; b.classList.toggle("on", it.voted); }
        } catch (e) { }
    }));
}

// ---------- Cuaca Balai: agregat anonim mood se-komunitas di mading ----------
let _bwData = null;
const BW_MSG = {
    cerah: "Minggu ini Balai lagi cerah ☀️ — energinya bagus, gas berkarya!",
    berawan: "Cuaca Balai lagi kalem ⛅ — pelan-pelan juga nggak apa-apa.",
    hujan: "Minggu ini Balai lagi sering hujan 🌧️ — saling jaga & saling sapa ya 💙",
    badai: "Lagi banyak warga yang kewalahan ⛈️ — yuk makin lembut ke sesama 🤗",
    pelangi: "Banyak yang lagi lega 🌈 — habis gelap emang terbit pelangi!"
};
async function fillBalaiWeather() {
    const slot = $("balaiWeatherSlot");
    if (!slot) return;
    try {
        if (!_bwData) _bwData = await fetchJSONP(GS + "?page=balaiWeather", "bw", 12000);
    } catch (e) { return; } // gagal ya udah, strip-nya nggak muncul aja
    if (!_bwData || !_bwData.dominant || (_bwData.total || 0) < 3) return; // data kurang -> jangan sok tau
    const mo = MOODS.find(x => x.k === _bwData.dominant) || MOODS[0];
    slot.innerHTML =
        '<div class="bw-strip md-in" style="--d:.1s">' +
        '<span class="bw-em">' + mo.e + '</span>' +
        '<span class="bw-body"><span class="bw-k">🌦️ CUACA BALAI MINGGU INI</span>' +
        '<span class="bw-t">' + esc(BW_MSG[_bwData.dominant] || "") + '</span>' +
        '<span class="bw-n">' + _bwData.total + ' catatan cuaca hati dari warga</span></span>' +
        '</div>';
}

function wirePostbox(modal) {
    const pb = $("mdPostbox");
    if (pb) pb.addEventListener("click", openPostboxPage);
}

// halaman khusus Kotak Pos (overlay di atas mading)
function openPostboxPage() {
    let pg = $("pbPage");
    if (!pg) {
        pg = document.createElement("div");
        pg.id = "pbPage";
        pg.className = "pb-page";
        document.body.appendChild(pg);
    }
    pg.innerHTML =
        '<div class="snp-wrap">' +
        '<div class="snp-head"><div class="snp-title">📮 Kotak Pos Warga</div>' +
        '<button class="snp-close" id="pbClose" aria-label="Tutup">✕</button></div>' +
        '<div class="snp-sub">Usulan & aspirasimu buat Balai — ide challenge, tema surat bulanan, sampai fitur baru. Vote yang kamu suka, yang paling didukung bakal diwujudkan! 💙</div>' +
        '<div class="pb-panel" id="pbBody"><div class="pb-empty">📮 Lagi ngecek isi kotak pos…</div></div>' +
        '</div>';
    pg.classList.add("show");
    playSfx("open-mail", 0.6);
    $("pbClose").addEventListener("click", closePostboxPage);
    loadSuggestions().then(renderPbPanel).catch(() => {
        const b = $("pbBody");
        if (b) b.innerHTML = '<div class="pb-empty">Gagal ngambil isi kotak pos — coba lagi ya 🙏</div>';
    });
}

function closePostboxPage() {
    const pg = $("pbPage");
    if (pg) pg.classList.remove("show");
}

// ---------- Kartu profil mini warga: rumahnya bio ----------
// Dibuka dari tap avatar/nama di feed galeri & lightbox. Data dari item galeri
// (server nempelin bio + avatar terkini di tiap item).
function openWargaCard(it) {
    const key = it.ownerKey || "";
    const works = _galleryItems.filter(x => key ? x.ownerKey === key : x.nickname === it.nickname);
    const info = works.find(x => x.bio) || works.find(x => x.avatar) || it;
    const likes = works.reduce((a, x) => a + (x.likes || 0), 0);
    const ava = info.avatar
        ? '<img src="' + esc(info.avatar) + '" alt="">'
        : esc((it.nickname || "S").charAt(0).toUpperCase());
    const modal = $("questModal");
    $("questModalBox").innerHTML =
        '<div class="qm-topbar"><button class="qm-close" id="qmClose" aria-label="Tutup">✕</button></div>' +
        '<div class="qm-body" style="text-align:center;">' +
        '<div class="pe-ava">' + ava + '</div>' +
        '<div class="wc-name">' + esc(it.nickname || "Sahabat") + (it.mine ? ' <span class="me-star">⭐</span>' : '') + '</div>' +
        '<div class="wc-bio">' + (info.bio
            ? '"' + esc(info.bio) + '"'
            : (it.mine ? 'Belum ada bio — isi lewat Edit Profil ✍️' : 'Belum nulis bio ✍️')) + '</div>' +
        '<div class="wc-chips"><span class="wc-chip">🎨 ' + works.length + ' karya</span><span class="wc-chip">❤️ ' + likes + ' likes</span></div>' +
        (works.length ? '<button class="btn-primary" id="wcStory" style="margin-top:14px;">Lihat karyanya →</button>' : '') +
        '</div>';
    modal.classList.add("show");
    lockScroll();
    $("qmClose").addEventListener("click", closeQuestModal);
    const ws = $("wcStory");
    if (ws) ws.addEventListener("click", () => {
        closeQuestModal();
        if (!_storyGroups.length) _storyGroups = buildStoryGroups();
        const gi = _storyGroups.findIndex(g => !g.official && !g.bday && g.nickname === it.nickname);
        if (gi >= 0) openStory(gi, 0);
    });
}

// ---------- Mading Warga: papan gabus pesan semangat antar warga ----------
// Sticky notes warna-warni + pin, horizontal scroll. Limit 2 pesan/hari/warga
// (di-enforce server, direset otomatis ganti hari).
let _boardData = null;

// Susunan teaser di-cache: boardEntries() naruh flyer di posisi acak, jadi kalau
// dihitung ulang tiap render, teaser keliatan "berubah-ubah" tiap ganti tab.
// Diacak ulang cuma pas data mading beneran di-refetch.
let _teaserEntries = null;

async function loadBoard(force) {
    const host = $("wargaBoard");
    if (!host) return;
    if (_boardData && !force) { renderBoard(); return; }
    // skeleton dulu biar mading nggak nge-pop tiba-tiba (layout shift)
    if (!_boardData) {
        host.innerHTML =
            '<div class="wb-head">' + skEl("width:130px;height:16px;") + skEl("width:118px;height:30px;border-radius:999px;") + '</div>' +
            skEl("width:100%;height:118px;border-radius:14px;margin-bottom:16px;");
    }
    try {
        _boardData = await fetchJSONP(GS + "?page=board&wa=" + encodeURIComponent(_profile.wa), "brd", 15000);
    } catch (e) { _boardData = null; }
    // normalisasi (server lama / respons aneh): items harus array, left harus angka
    if (!_boardData || !Array.isArray(_boardData.items)) _boardData = { items: [] };
    if (typeof _boardData.left !== "number") _boardData.left = 0;
    _teaserEntries = null; // data baru -> susunan teaser boleh dikocok ulang
    renderBoard();
}

// Foto weekly tracker minggu BERJALAN (dari data galeri; id weekly = "jw_<wa>_<weekKey>")
// -> otomatis "reset" tiap ganti minggu tanpa perlu server
function weeklyPhotosThisWeek() {
    const cw = getMonthWeekObj(new Date());
    return (_galleryItems || []).filter(it => it.kind === "weekly" && it.photo && String(it.id).indexOf("_" + cw.key) > 0);
}

// Foto kegiatan OFFICIAL (workshop/reka-rekat/temu-warga) yang di-post <=7 hari terakhir
function officialPhotosThisWeek() {
    const now = Date.now();
    return (_galleryItems || []).filter(it =>
        (it.kind === "workshop" || it.kind === "reka-rekat" || it.kind === "temu-warga") &&
        it.photo && it.ts && (now - it.ts) < 7 * 86400000);
}

// Flyer event: lagi buka pendaftaran & (kalau datanya ada) kuotanya belum penuh
function boardFlyers() {
    const ws = (typeof WORKSHOPS !== "undefined" && Array.isArray(WORKSHOPS)) ? WORKSHOPS : [];
    const out = [];
    ws.forEach(w => {
        if (typeof getWorkshopStatus !== "function" || getWorkshopStatus(w) !== "open") return;
        let left = null;
        if (w.maxQuota > 0 && _evCounts && typeof _evCounts[w.id] === "number") {
            left = Math.max(0, w.maxQuota - _evCounts[w.id]);
            if (left === 0) return; // penuh -> nggak usah dipromoin
        }
        out.push({ t: "flyer", w: w, left: left });
    });
    return out;
}

function boardFlyerHtml(w, left, i, mini) {
    const tag = mini ? "div" : "button"; // teaser-nya sendiri udah button, jangan nested
    const dateTxt = w.workshopDate || "";
    return '<' + tag + ' class="wb-flyer' + (i % 2 ? " r" : "") + (mini ? " mini" : "") + '"' + (mini ? '' : ' data-goev="1"') + '>' +
        '<span class="wb-tape2 wt-b" style="top:5px;"></span>' +
        '<div class="wb-flyer-k">📢 PENDAFTARAN DIBUKA</div>' +
        '<div class="wb-flyer-t">' + esc(w.name || "Event") + '</div>' +
        (dateTxt ? '<div class="wb-flyer-d">🗓 ' + esc(dateTxt) + '</div>' : '') +
        (left !== null ? '<span class="wb-flyer-q">🔥 sisa ' + left + ' seat</span>' : '') +
        (mini ? '' : '<div class="wb-flyer-cta">Daftar di tab Event →</div>') +
        '</' + tag + '>';
}

function boardPhotoHtml(it, i, mini) {
    return '<div class="wb-photo f' + ((i % 4) + 1) + (i % 2 ? " r" : "") + (mini ? " mini" : "") + '">' +
        boardAttach(i + 1) +
        '<img src="' + esc(it.photo) + '" alt="" loading="lazy" decoding="async">' +
        '<div class="wb-meta">' + (it.kind === "weekly" ? "📖 " + esc(it.nickname) : storyKindIcon(it.kind) + " " + esc(it.title)) + '</div>' +
        '</div>';
}

// Gabungan isi papan: sticky notes + polaroid (weekly warga + kegiatan official
// <=7 hari) DIJALIN selang-seling (2 notes : 1 foto), lalu flyer event nyelip
// di posisi ACAK — kayak mading beneran yang ditempel banyak tangan
function boardEntries() {
    const notes = ((_boardData && _boardData.items) || []).map(m => ({ t: "note", ts: m.ts || 0, m: m }));
    const photos = weeklyPhotosThisWeek().concat(officialPhotosThisWeek())
        .sort((a, b) => (b.ts || 0) - (a.ts || 0))
        .map(p => ({ t: "photo", ts: p.ts || 0, p: p }));
    const out = [];
    let i = 0, j = 0;
    while (i < notes.length || j < photos.length) {
        if (i < notes.length) out.push(notes[i++]);
        if (i < notes.length) out.push(notes[i++]);
        if (j < photos.length) out.push(photos[j++]);
    }
    boardFlyers().forEach(f => out.splice(Math.floor(Math.random() * (out.length + 1)), 0, f));
    return out;
}

function boardEntryHtml(e, i, mini) {
    if (e.t === "flyer") return boardFlyerHtml(e.w, e.left, i, mini);
    return e.t === "photo" ? boardPhotoHtml(e.p, i, mini) : boardNoteHtml(e.m, i, mini);
}

// Penempel bervariasi: pin / selotip kuning / biru / pink (biar nggak seragam)
function boardAttach(i) {
    if (i % 4 === 0) return '<span class="wb-pin">📌</span>';
    return '<span class="wb-tape2 ' + ["wt-y", "wt-b", "wt-p"][i % 3] + '"></span>';
}

function boardNoteHtml(m, i, mini) {
    const COLORS = ["note-y", "note-p", "note-b", "note-g"];
    const text = mini && m.text.length > 64 ? m.text.slice(0, 64) + "…" : m.text;
    return '<div class="wb-note ' + COLORS[i % COLORS.length] + (i % 2 ? " r" : "") + (mini ? " mini" : "") + '">' +
        boardAttach(i) +
        '<div class="wb-text">' + esc(text) + '</div>' +
        '<div class="wb-meta">— ' + esc(m.nickname) + ' · ' + esc(timeAgo(m.ts)) + '</div>' +
        '</div>';
}

// Teaser di Gallery: papan mini berisi 2-3 pesan terbaru, klik = buka Mading full
function renderBoard() {
    const host = $("wargaBoard");
    if (!host) return;
    if (!_teaserEntries) _teaserEntries = boardEntries();
    const entries = _teaserEntries;
    let notes = "";
    entries.slice(0, 3).forEach((e, i) => { notes += boardEntryHtml(e, i, true); });
    if (!notes) notes = '<div class="wb-empty">Belum ada pesan — jadilah yang pertama nempel! ✨</div>';
    host.innerHTML =
        '<div class="wb-head">' +
        '<div class="story-lbl" style="margin:0;">📌 Mading Warga</div>' +
        '<button class="wb-add" id="wbOpen">Buka Mading' + (entries.length ? ' (' + entries.length + ')' : '') + ' →</button>' +
        '</div>' +
        '<button class="wb-board wb-teaser" id="wbTeaser">' +
        '<div class="wb-track">' + notes + '</div>' +
        '</button>';
    $("wbOpen").addEventListener("click", openMadingModal);
    $("wbTeaser").addEventListener("click", openMadingModal);
}

// ---- Mading full: halaman gabus selayar, sticky notes masonry 2 kolom ----
// ---------- Pesan suara Mochi di mading: little reminder harian ----------
// 12 voice note di /mochi_notes, dipilih seeded dari tanggal -> tiap hari beda.
// Selesai ngomong baru bg music nyala, biar suaranya nggak tabrakan.
const MOCHI_NOTE_COUNT = 12;
let _noteAudio = null;
function mochiNotePlay() {
    if (sndMuted()) return;
    try {
        const now = new Date();
        const n = ((now.getFullYear() * 372 + now.getMonth() * 31 + now.getDate()) % MOCHI_NOTE_COUNT) + 1;
        if (!_noteAudio) _noteAudio = new Audio();
        _noteAudio.src = "../mochi_notes/note-" + n + ".mp3";
        _noteAudio.loop = false;
        _noteAudio.volume = 1;
        _noteAudio.onended = () => {
            const b = $("mdNote");
            if (b) b.classList.remove("play");
            wrappedMusicPlay();
        };
        _noteAudio.currentTime = 0;
        _noteAudio.play().catch(() => { });
        const b = $("mdNote");
        if (b) b.classList.add("play");
    } catch (e) { }
}
function mochiNoteStop() {
    try { if (_noteAudio) { _noteAudio.onended = null; _noteAudio.pause(); } } catch (e) { }
}

function openMadingModal() {
    let modal = $("madingModal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "madingModal";
        modal.className = "mading-modal";
        document.body.appendChild(modal);
    }
    renderMadingModal();
    modal.classList.add("show");
    lockScroll();
    mochiNotePlay(); // pesan kecil dari Mochi dulu, musik nyusul setelah selesai
}

function closeMading() {
    closePostboxPage(); // halaman kotak pos numpang di atas mading
    const modal = $("madingModal");
    if (modal) modal.classList.remove("show");
    mochiNoteStop();
    wrappedMusicStop();
    unlockScroll();
}

function renderMadingModal() {
    const modal = $("madingModal");
    if (!modal) return;
    const entries = boardEntries();
    const left = _boardData ? _boardData.left : 0;
    const _whList = balaiWhispers("mading");
    const _mdInfoPick = _whList[Math.floor(Math.random() * _whList.length)];
    // dua kolom diisi selang-seling (bukan CSS columns yang numpuk kiri semua),
    // plus sticker die-cut nyelip tiap beberapa item biar papannya rame
    const colA = [], colB = [];
    // tiap item dibungkus .md-in -> animasi "ketempel" satu-satu (delay bertingkat,
    // wrapper yang dianimasikan biar rotate miring notes-nya nggak ketiban)
    const pinDelay = i => Math.min(i * 0.3, 3.6).toFixed(2); // beneran satu-satu, cap 3.6 dtk
    entries.forEach((e, i) => {
        ((i % 2 === 0) ? colA : colB).push('<div class="md-in" style="--d:' + pinDelay(i) + 's">' + boardEntryHtml(e, i, false) + '</div>');
        if (i % 3 === 2) {
            const n = ((i * 7) % 11) + 1;
            const rot = (i % 2 ? -1 : 1) * (6 + (i % 9));
            ((i % 2 === 0) ? colB : colA).push('<div class="md-in" style="--d:' + pinDelay(i + 1) + 's"><img class="md-stk" src="../images/sticker/str-' + n + '.png" alt="" style="transform:rotate(' + rot + 'deg);"></div>');
        }
    });
    // 🏆 spotlight: karya challenge TERBARU dari rank #1 leaderboard (kalau datanya udah ke-load)
    let champHtml = "";
    try {
        const top1 = _lbData && _lbData.top && _lbData.top[0];
        if (top1) {
            const work = (_galleryItems || [])
                .filter(it => it.kind === "quest" && it.nickname === top1.nickname && it.photo)
                .sort((a, b) => (b.ts || 0) - (a.ts || 0))[0];
            if (work) {
                champHtml = '<div class="md-champ md-in" style="--d:.15s">' +
                    '<span class="mc-crown">👑</span>' +
                    '<span class="wb-tape2 wt-y" style="left:14px;"></span>' +
                    '<div class="mc-k">🏆 KARYA SANG JUARA · RANK #1 🎉</div>' +
                    '<div class="mc-frame"><img src="' + esc(work.photo) + '" alt="" loading="lazy" decoding="async">' +
                    '<span class="mc-conf c1">🎊</span><span class="mc-conf c2">✨</span></div>' +
                    '<div class="mc-name">' + esc(top1.nickname) + ' <span class="mc-poin">⚡ ' + top1.poin + ' poin</span></div>' +
                    '<div class="mc-title">🎯 ' + esc(work.title) + '</div>' +
                    '</div>';
            }
        }
    } catch (e) { }

    const boardHtml = entries.length
        ? '<div class="md-cols"><div class="md-col">' + colA.join("") + '</div><div class="md-col">' + colB.join("") + '</div></div>'
        : '<div class="wb-empty" style="margin-top:14px;">Belum ada pesan — jadilah yang pertama nempel! ✨</div>';
    const addLabel = left <= 0
        ? '＋ Tempel Pesan <small>(kuota habis — besok lagi 🌙)</small>'
        : '＋ Tempel Pesan' + (left < 2 ? ' <small>(' + left + ' lagi)</small>' : '');
    modal.innerHTML =
        '<div class="md-wrap">' +

        '<img class="md-deco" src="../images/sticker/str-2.png" alt="" style="bottom:10px;left:-8px;transform:rotate(-12deg);">' +
        '<div class="md-head">' +
        '<div class="md-title">📌 Mading Warga</div>' +
        '<button class="md-close" id="mdClose" aria-label="Tutup">✕</button>' +
        '</div>' +
        '<button type="button" class="md-note" id="mdNote"><span class="md-note-ic">🎧</span> Pesan kecil dari Mochi buat hari ini <span class="md-note-eq"><i></i><i></i><i></i></span></button>' +
        '<button class="wb-add" id="mdAdd" style="width:100%;padding:11px;font-size:.85rem;"' + (left <= 0 ? ' disabled' : '') + '>' + addLabel + '</button>' +
        '<div class="md-compose" id="mdCompose" style="display:none;">' +
        '<span class="wb-pin">📌</span>' +
        '<textarea id="mdInput" maxlength="140" rows="3" placeholder="Tulis pesan semangatmu… ✨ (max 140)"></textarea>' +
        '<button class="btn-primary" id="mdSend" style="margin-top:8px;">📌 Tempel</button>' +
        '</div>' +
        // kertas pengumuman: sorotan komunitas acak (reuse mesin bisik-bisik)
        '<div class="md-info md-in" style="--d:0s">' +
        '<span class="wb-tape2 wt-b" style="width:70px;"></span>' +
        '<img class="md-info-stk" src="../images/sticker/str-8.png" alt="">' +
        '<div class="md-info-k">📣 INFO BALAI</div>' +
        '<div class="md-info-t">' + esc(_mdInfoPick) + '</div>' +
        '</div>' +
        '<div id="balaiWeatherSlot"></div>' +
        champHtml +
        boardHtml +
        '</div>' +
        '<button type="button" class="md-pbfab" id="mdPostbox" aria-label="Kotak Pos Warga — kirim aspirasimu">' +
        '<span class="pbf-lbl">POS</span><span class="pbf-slot"></span><span class="pbf-hint">📮 kirim surat</span>' +
        '</button>';
    $("mdClose").addEventListener("click", closeMading);
    $("mdNote").addEventListener("click", () => { wrappedMusicStop(); mochiNotePlay(); }); // tap = puter ulang
    wirePostbox(modal);
    fillBalaiWeather(); // strip cuaca komunitas (async, nggak ngeblok papan)
    modal.querySelectorAll("[data-goev]").forEach(b => b.addEventListener("click", () => {
        closeMading();
        try { location.hash = "events"; } catch (e) { }
        activateTab("events");
    }));
    $("mdAdd").addEventListener("click", () => {
        if ((_boardData ? _boardData.left : 0) <= 0) { alert("Kuota nempel pesanmu hari ini habis (2/hari). Besok lagi ya! 🌙"); return; }
        const c = $("mdCompose");
        c.style.display = c.style.display === "none" ? "block" : "none";
        if (c.style.display === "block") $("mdInput").focus();
    });
    $("mdSend").addEventListener("click", () => {
        const text = $("mdInput").value.trim();
        if (text.length < 3) { alert("Pesannya kependekan 😅"); return; }
        // OPTIMISTIS: pesan langsung nempel di papan (tanpa loader/refetch),
        // POST nyusul di belakang; gagal -> pesan dicopot lagi + kuota balik
        const temp = { id: "tmpb" + Date.now().toString(36), nickname: _profile.nickname || "Kamu", text: text, ts: Date.now() };
        _boardData.items.unshift(temp);
        _boardData.left = Math.max(0, _boardData.left - 1);
        _teaserEntries = null;          // teaser di Gallery ikut keisi pesan baru
        playSfx("love", 0.6);
        fireConfetti("quest");
        renderMadingModal();            // langsung kerender, pesan baru ikut animasi tempel
        renderBoard();
        apiPost({ action: "memberPostBoard", token: _profile.token, text: temp.text }).then(r => {
            if (r.status !== "success") {
                const at = _boardData.items.indexOf(temp);
                if (at >= 0) _boardData.items.splice(at, 1);
                _boardData.left++;
                _teaserEntries = null;
                renderMadingModal();
                renderBoard();
                alert(r.message || "Gagal nempel pesan.");
            }
        }).catch(() => {
            const at = _boardData.items.indexOf(temp);
            if (at >= 0) _boardData.items.splice(at, 1);
            _boardData.left++;
            _teaserEntries = null;
            renderMadingModal();
            renderBoard();
            alert("Gagal terhubung ke server. Pesanmu belum nempel, coba lagi ya.");
        });
    });
}

// ---------- Sahabat Stories (bar di atas Gallery, ala scrapbook) ----------
// Foto galeri digroup per orang -> bulatan story. Official (Workshop/Reka-Rekat)
// digabung jadi satu story "Seminggu Satu". Urutan bulatan diacak tiap render.
let _storyGroups = [];
let _storyGIdx = 0;
let _storySIdx = 0;
// Auto-next ngikutin animasi progress bar (storyRun 3.5s di CSS) via animationend,
// jadi pas foto ditahan (pause) progress-nya ikut berhenti kayak IG.

function storyKindIcon(kind) {
    return kind === "workshop" ? "🎪" : (kind === "reka-rekat" ? "✂️" : (kind === "temu-warga" ? "🏘️" : (kind === "weekly" ? "📖" : "🎯")));
}

// ---- Penanda story udah dilihat (per foto, disimpan di localStorage) ----
const STORY_SEEN_KEY = "ss_story_seen";
function storySeenSet() {
    try { return new Set(JSON.parse(localStorage.getItem(STORY_SEEN_KEY) || "[]")); } catch (e) { return new Set(); }
}
function markStorySeen(id) {
    if (!id) return;
    try {
        const s = storySeenSet();
        s.add(id);
        localStorage.setItem(STORY_SEEN_KEY, JSON.stringify(Array.from(s).slice(-800))); // cap biar nggak numpuk
    } catch (e) { }
    updateStoryBarSeen();
}
// Update ring di bar tanpa re-render (re-render bakal reshuffle urutan, jarring)
function updateStoryBarSeen() {
    const seen = storySeenSet();
    document.querySelectorAll("#storyBar .story-item").forEach(el => {
        const g = _storyGroups[Number(el.dataset.g)];
        if (!g) return;
        const done = g.items.every(it => seen.has(it.id));
        el.classList.toggle("seen", done);
    });
}

function buildStoryGroups() {
    const map = {};
    const order = [];
    _galleryItems.forEach(it => {
        if (!it.photo) return;
        const official = (it.kind === "workshop" || it.kind === "reka-rekat" || it.kind === "temu-warga");
        const key = official ? "__official__" : ("u:" + (it.nickname || "Sahabat"));
        if (!map[key]) {
            map[key] = { key: key, official: official, nickname: official ? "Seminggu Satu" : (it.nickname || "Sahabat"), mine: false, items: [] };
            order.push(map[key]);
        }
        if (it.mine) map[key].mine = true;
        map[key].items.push(it);
    });
    order.forEach(g => g.items.sort((a, b) => (b.ts || 0) - (a.ts || 0))); // TERBARU duluan
    // grup diurutkan dari yang postingan terbarunya paling baru (bukan random lagi)
    order.sort((a, b) => ((b.items[0] && b.items[0].ts) || 0) - ((a.items[0] && a.items[0].ts) || 0));
    // Yang BELUM dilihat maju ke depan, yang udah kelar mundur (kayak IG)
    const seen = storySeenSet();
    const unseen = order.filter(g => !g.items.every(it => seen.has(it.id)));
    const done = order.filter(g => g.items.every(it => seen.has(it.id)));
    const sorted = unseen.concat(done);
    // Ada yg ultah? Selipin story ultah di paling depan (ala iklan di story IG, tapi manis)
    if (BDAY_TODAY.length) {
        const dayKey = new Date().toISOString().slice(0, 10);
        sorted.unshift({
            key: "__bday__", bday: true, official: false, mine: false,
            nickname: "Ultah Hari Ini",
            items: BDAY_TODAY.map(b => ({ bday: true, nickname: b.nickname, id: "bd_" + b.nickname + "_" + dayKey }))
        });
    }
    // Story punyamu SELALU paling depan (kayak IG), ultah nomor dua
    const mi = sorted.findIndex(g => g.mine);
    if (mi > 0) sorted.unshift(sorted.splice(mi, 1)[0]);
    return sorted;
}

function renderStoryBar() {
    const wrap = $("storyBar");
    if (!wrap) return;
    _storyGroups = buildStoryGroups();
    if (!_storyGroups.length) { wrap.innerHTML = ""; return; }
    const seen = storySeenSet();
    let html = '<div class="story-lbl">✨ Sahabat Stories</div><div class="story-track">';
    _storyGroups.forEach((g, idx) => {
        const rot = ["st-r1", "st-r2", "st-r3"][idx % 3];
        const isSeen = g.items.every(it => seen.has(it.id));
        const latest = g.items[0]; // items udah diurut terbaru duluan
        const ava = g.bday
            ? '<span class="story-ava bday-face">🎂</span>'
            : (g.official
                ? '<span class="story-ava official">SS</span>'
                : '<span class="story-ava"><img src="' + esc(latest.photo) + '" alt="" loading="lazy" decoding="async"></span>');
        html += '<button class="story-item ' + rot + (isSeen ? " seen" : "") + '" data-g="' + idx + '">' +
            '<span class="story-ring' + (g.bday ? " ring-bday" : "") + '">' + ava + '</span>' +
            '<span class="story-sticker">' + (g.bday ? "🎈" : storyKindIcon(latest.kind)) + '</span>' +
            '<span class="story-count">' + g.items.length + '</span>' +
            '<span class="story-name">' + (g.bday ? "Ultah 🎈" : (g.mine ? "⭐ " : "") + esc(g.nickname)) + '</span>' +
            '</button>';
    });
    html += '</div>';
    wrap.innerHTML = html;
    wrap.querySelectorAll(".story-item").forEach(el =>
        el.addEventListener("click", () => openStory(Number(el.dataset.g), 0)));
}

function openStory(gIdx, sIdx) {
    let modal = $("storyModal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "storyModal";
        modal.className = "story-modal";
        document.body.appendChild(modal);
        modal.addEventListener("click", (e) => { if (e.target === modal) closeStory(); });
    }
    _storyGIdx = gIdx; _storySIdx = sIdx;
    modal.classList.add("show");
    lockScroll();
    renderStoryViewer();
}

function closeStory() {
    const modal = $("storyModal");
    if (modal) modal.classList.remove("show");
    unlockScroll();
}

// HTML satu kartu story. active=false dipakai buat muka kubus tetangga pas drag
// (tanpa id + tanpa progress jalan, biar nggak dobel listener/animasi).
function storyBoxHtml(gIdx, sIdx, active) {
    const g = _storyGroups[gIdx];
    const it = g && g.items[sIdx];
    if (!it) return "";
    let bars = '<div class="story-bars">';
    for (let i = 0; i < g.items.length; i++) {
        bars += '<div class="sbar' + (i < sIdx ? " done" : (i === sIdx && active ? " run" : "")) + '"><i></i></div>';
    }
    bars += '</div>';
    // Story ultah: kartu ucapan festive, bukan foto
    if (it.bday) {
        return '<div class="story-box">' +
            '<span class="story-tape-tl"></span><span class="story-tape-br"></span>' +
            bars +
            '<div class="story-head">' +
            '<div class="story-who"><div class="ig-ava bday-ava">🎂</div>' +
            '<div><div class="story-who-name">Ultah Hari Ini</div>' +
            '<div class="story-who-sub">spesial buat sahabat kita 💙</div></div></div>' +
            (active ? '<button class="story-close" id="storyClose" aria-label="Tutup">✕</button>' : '<span class="story-close">✕</span>') +
            '</div>' +
            '<div class="story-bday">' +
            '<span class="sb-balloon x1">🎈</span><span class="sb-balloon x2">🎈</span><span class="sb-balloon x3">🎈</span>' +
            '<img class="wr-imgstk" src="../images/sticker/str-7.png" style="width:74px;bottom:10px;right:8px;transform:rotate(9deg);" alt="">' +
            '<div class="sb-cake">🎂</div>' +
            '<div class="sb-title">Happy Birthday,<br>' + esc(it.nickname) + '! 🎉</div>' +
            '<div class="sb-sub">Panjang umur, makin rajin journaling ya ✨</div>' +
            (active ? '<a class="sb-btn" href="' + QUEST_WA_GROUP + '" target="_blank" rel="noopener">💌 Kirim Ucapan di Grup</a>' : '') +
            (active ? '<div class="story-nav"><button id="storyPrev" aria-label="Story sebelumnya"></button><button id="storyNext" aria-label="Story selanjutnya"></button></div>' : '') +
            '</div>' +
            '</div>';
    }
    const avaP = (g.items.find(x => x.avatar) || {}).avatar;
    const ava = g.official
        ? '<div class="ig-ava official">SS</div>'
        : (avaP ? '<div class="ig-ava"><img src="' + esc(avaP) + '" alt=""></div>' : '<div class="ig-ava">' + esc((g.nickname || "S").charAt(0).toUpperCase()) + '</div>');
    const icon = storyKindIcon(it.kind);
    return '<div class="story-box">' +
        '<span class="story-tape-tl"></span><span class="story-tape-br"></span>' +
        bars +
        '<div class="story-head">' +
        '<div class="story-who"' + (active && !g.official ? ' data-wcard="' + esc(it.id) + '" role="button"' : '') + '>' + ava +
        '<div><div class="story-who-name">' + esc(g.nickname) +
        (it.mine ? ' <span class="me-star" title="Karya kamu">⭐</span>' : '') +
        (g.official ? ' <span class="ig-me official-tag">OFFICIAL</span>' : '') + '</div>' +
        '<div class="story-who-sub">' + (it.eventDate ? "🗓 " + esc(fmtEventDate(it.eventDate)) : esc(timeAgo(it.ts))) + '</div></div></div>' +
        (active ? '<button class="story-close" id="storyClose" aria-label="Tutup">✕</button>' : '<span class="story-close">✕</span>') +
        '</div>' +
        '<div class="story-photo">' +
        '<img src="' + esc(it.photo) + '" alt="" onerror="this.style.opacity=.25">' +
        '<span class="story-stamp">' + icon + '</span>' +
        (active ? '<div class="story-nav"><button id="storyPrev" aria-label="Story sebelumnya"></button><button id="storyNext" aria-label="Story selanjutnya"></button></div>' : '') +
        '</div>' +
        '<div class="story-badge">' + icon + ' ' + esc(it.title || "Challenge") + '</div>' +
        (it.caption ? '<div class="story-note">' + esc(it.caption) + '</div>' : '') +
        '</div>';
}

// Grup (orang) sebelah buat swipe kubus. dir: +1 = orang berikutnya, -1 = sebelumnya.
function storyGroupNeighbor(dir) {
    const gi = _storyGIdx + dir;
    if (gi < 0 || gi >= _storyGroups.length) return null;
    return { g: gi, s: 0 };
}

function renderStoryViewer() {
    const modal = $("storyModal");
    const g = _storyGroups[_storyGIdx];
    if (!modal || !g || !g.items[_storySIdx]) { closeStory(); return; }
    markStorySeen(g.items[_storySIdx].id); // foto ini resmi "udah dilihat"
    modal.innerHTML =
        '<div class="story-stage" id="storyStage">' +
        '<div class="story-cube" id="storyCube">' +
        '<div class="story-face cur">' + storyBoxHtml(_storyGIdx, _storySIdx, true) + '</div>' +
        '</div></div>';
    let held = false; // habis drag/long-press, click bawaan di-swallow biar nggak dobel navigasi
    $("storyClose").addEventListener("click", closeStory);
    // tap avatar/nama di header story -> kartu profil mini (story ditutup dulu,
    // questModal z-nya di bawah story modal)
    const swc = modal.querySelector("[data-wcard]");
    if (swc) swc.addEventListener("click", () => {
        const wit = _galleryItems.find(x => x.id === swc.dataset.wcard);
        if (wit) { closeStory(); openWargaCard(wit); }
    });
    $("storyPrev").addEventListener("click", () => { if (!held) prevStory(); });
    $("storyNext").addEventListener("click", () => { if (!held) nextStory(); });
    const runBar = modal.querySelector(".sbar.run i");
    if (runBar) runBar.addEventListener("animationend", nextStory);

    // ---- Gesture ala IG ----
    // Tap kiri/kanan = pindah foto orang yg sama. DRAG horizontal = kubus 3D muter
    // ngikutin jari -> loncat ke story ORANG sebelah. Drag bawah = tutup. Tahan = pause.
    const stage = $("storyStage");
    const cube = $("storyCube");
    const curFace = cube.querySelector(".story-face.cur");
    const curBox = curFace.querySelector(".story-box");
    let sx = 0, sy = 0, st = 0, axis = "", animating = false;
    let W = 0, half = 0, faceL = null, faceR = null;

    function setCube(angle, animate) {
        cube.style.transition = animate ? "transform .3s ease" : "none";
        cube.style.transform = "translateZ(" + (-half) + "px) rotateY(" + angle + "deg)";
    }
    function makeFace(n, side) { // side: 1 = kanan (orang berikutnya), -1 = kiri
        if (!n) return null;
        const f = document.createElement("div");
        f.className = "story-face";
        f.style.transform = "rotateY(" + (side * 90) + "deg) translateZ(" + half + "px)";
        f.innerHTML = storyBoxHtml(n.g, n.s, false);
        cube.appendChild(f);
        return f;
    }
    function flattenCube() { // balikin ke tampilan datar (nggak ada transform 3D nganggur)
        if (faceL) { faceL.remove(); faceL = null; }
        if (faceR) { faceR.remove(); faceR = null; }
        cube.style.transition = "none";
        cube.style.transform = "";
        curFace.style.transform = "";
    }
    function afterCube(fn) { // transitionend + fallback timer (kalau transform nggak berubah, event nggak ke-fire)
        let done = false;
        const go = () => { if (!done) { done = true; fn(); } };
        cube.addEventListener("transitionend", go, { once: true });
        setTimeout(go, 340);
    }

    stage.addEventListener("touchstart", (e) => {
        if (animating) return;
        const t = e.touches[0];
        sx = t.clientX; sy = t.clientY; st = Date.now();
        axis = ""; held = false;
        W = stage.offsetWidth || 1; half = W / 2;
        curBox.classList.add("hold"); // pause progress selama disentuh
    }, { passive: true });

    stage.addEventListener("touchmove", (e) => {
        if (animating) return;
        const t = e.touches[0];
        const dx = t.clientX - sx, dy = t.clientY - sy;
        if (!axis && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
            axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
            if (axis === "x") { // rakit muka kubus orang sebelah, sekali di awal drag
                curFace.style.transform = "translateZ(" + half + "px)";
                faceL = makeFace(storyGroupNeighbor(-1), -1);
                faceR = makeFace(storyGroupNeighbor(1), 1);
            }
        }
        if (axis === "x") {
            held = true;
            let p = Math.max(-1, Math.min(1, dx / W));
            if ((p > 0 && !faceL) || (p < 0 && !faceR)) p *= 0.25; // mentok: rubber band
            setCube(p * 90, false);
        } else if (axis === "y" && dy > 0) {
            held = true;
            stage.style.transition = "none";
            stage.style.transform = "translateY(" + (dy * 0.6) + "px)";
        }
    }, { passive: true });

    stage.addEventListener("touchend", (e) => {
        if (animating) { axis = ""; return; }
        const t = e.changedTouches[0];
        const dx = t.clientX - sx, dy = t.clientY - sy, dt = Date.now() - st;
        if (axis === "x") {
            const commit = Math.abs(dx) > W * 0.3 || (dt < 250 && Math.abs(dx) > 30);
            const dir = dx < 0 ? 1 : -1;
            const n = storyGroupNeighbor(dir);
            if (commit && n) {
                // progress tetap paused (class hold nggak dilepas) sampai re-render,
                // biar animationend nggak nyelonong pindah foto pas kubus lagi muter
                animating = true;
                setCube(dir * -90, true);
                afterCube(() => { _storyGIdx = n.g; _storySIdx = n.s; renderStoryViewer(); });
            } else if (commit && dir === 1) {
                closeStory(); flattenCube(); // orang terakhir di-swipe next -> tutup
            } else {
                curBox.classList.remove("hold");
                animating = true;
                setCube(0, true);
                afterCube(() => { animating = false; flattenCube(); });
            }
        } else if (axis === "y") {
            curBox.classList.remove("hold");
            if (dy > 90) closeStory();
            stage.style.transition = "transform .25s ease";
            stage.style.transform = "";
        } else {
            curBox.classList.remove("hold");
            if (dt > 350) held = true; // long-press: pause doang, lepas jangan navigasi
        }
        axis = "";
    }, { passive: true });

    stage.addEventListener("touchcancel", () => {
        curBox.classList.remove("hold");
        if (!animating && (faceL || faceR)) {
            animating = true;
            setCube(0, true);
            afterCube(() => { animating = false; flattenCube(); });
        }
        stage.style.transform = "";
        axis = "";
    }, { passive: true });
}

function nextStory() {
    const g = _storyGroups[_storyGIdx];
    if (!g) { closeStory(); return; }
    if (_storySIdx < g.items.length - 1) { _storySIdx++; renderStoryViewer(); }
    else if (_storyGIdx < _storyGroups.length - 1) { _storyGIdx++; _storySIdx = 0; renderStoryViewer(); }
    else closeStory(); // semua story habis
}

function prevStory() {
    if (_storySIdx > 0) { _storySIdx--; renderStoryViewer(); }
    else if (_storyGIdx > 0) { _storyGIdx--; _storySIdx = _storyGroups[_storyGIdx].items.length - 1; renderStoryViewer(); }
    else renderStoryViewer(); // udah paling awal: restart foto pertama
}

async function toggleLike(id) {
    const it = _galleryItems.find(x => x.id === id);
    if (!it) return;
    const prevLiked = it.liked, prevLikes = it.likes || 0;
    it.liked = !prevLiked; it.likes = Math.max(0, prevLikes + (it.liked ? 1 : -1));
    if (it.liked) { playSfx("love"); fireConfetti("love"); }
    updateLikeDom(id, it);
    try {
        const r = await apiPost({ action: "memberToggleLike", token: _profile.token, submissionId: id });
        if (r && r.status === "success") {
            it.liked = !!r.liked;
            it.likes = (typeof r.likes === "number") ? r.likes : it.likes;
        } else { it.liked = prevLiked; it.likes = prevLikes; }
    } catch (e) { it.liked = prevLiked; it.likes = prevLikes; }
    updateLikeDom(id, it);
}

function updateLikeDom(id, it) {
    document.querySelectorAll('.ig-btn-like[data-like="' + id + '"]').forEach(btn => {
        btn.classList.toggle("active", !!it.liked);
        const ic = btn.querySelector(".li-icon"), ct = btn.querySelector(".li-count");
        if (ic) ic.textContent = it.liked ? "❤️" : "🤍";
        if (ct) ct.textContent = it.likes || 0;
    });
    document.querySelectorAll('.jcard[data-id="' + id + '"] .jcard-likes').forEach(b => {
        b.textContent = (it.liked ? "❤️" : "🤍") + " " + (it.likes || 0);
    });
}

// ---------- Pull to refresh (tarik dari atas -> reload) ----------
(function initPullRefresh() {
    const ind = $("ptrIndicator");
    if (!ind) return;
    const TH = 68;        // jarak minimal buat trigger refresh
    const MAX = 120;      // batas tarikan
    let startY = 0, dist = 0, pulling = false, busy = false;

    function atTop() { return (window.scrollY || document.documentElement.scrollTop || 0) <= 0; }
    function modalOpen() {
        const q = $("questModal");
        return (q && q.classList.contains("show")) || document.body.style.position === "fixed";
    }
    function setInd(pull, ready) {
        ind.style.opacity = Math.min(1, pull / TH).toFixed(2);
        ind.style.transform = "translate(-50%, " + (Math.min(pull, MAX) - 50) + "px) rotate(" + (pull * 2.2) + "deg)";
        ind.querySelector(".ptr-ic").textContent = ready ? "⟳" : "↓";
    }
    function reset(animate) {
        ind.classList.remove("spin");
        ind.style.transition = animate ? "transform .25s ease, opacity .25s ease" : "none";
        ind.style.opacity = 0;
        ind.style.transform = "translate(-50%, -50px)";
        if (animate) setTimeout(() => { ind.style.transition = "none"; }, 260);
    }

    window.addEventListener("touchstart", (e) => {
        if (busy || !atTop() || modalOpen()) { pulling = false; return; }
        startY = e.touches[0].clientY; dist = 0; pulling = true;
        ind.style.transition = "none";
    }, { passive: true });

    window.addEventListener("touchmove", (e) => {
        if (!pulling) return;
        dist = e.touches[0].clientY - startY;
        if (dist <= 0 || !atTop()) { setInd(0, false); return; }
        const pull = dist * 0.5;                 // resistance
        if (e.cancelable) e.preventDefault();    // tahan overscroll bawaan
        setInd(pull, pull >= TH);
    }, { passive: false });

    window.addEventListener("touchend", () => {
        if (!pulling) return;
        pulling = false;
        const pull = Math.max(0, dist) * 0.5;
        if (pull >= TH) {
            busy = true;
            ind.classList.add("spin");
            ind.style.opacity = 1;
            ind.style.transform = "translate(-50%, 16px)";
            ind.querySelector(".ptr-ic").textContent = "⟳";
            setTimeout(() => location.reload(), 400);
        } else {
            reset(true);
        }
    }, { passive: true });
})();
