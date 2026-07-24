// ============================================================
//  Member Hub (/member) — login/daftar akun + portal
// ============================================================
const GS = (typeof GOOGLE_SCRIPT_URL !== "undefined") ? GOOGLE_SCRIPT_URL : "";
const TOKEN_KEY = "ss_member_token";
const QUEST_WA_GROUP = "https://chat.whatsapp.com/Lpnbndl1UFv9ZaLsrbtpgw?s=cl&p=i&ilr=0&amv=0"; // grup WA buat kirim spread challenge
const ADMIN_WA = "6281214574782"; // WA Arnold buat claim voucher ulang tahun
let _wa = "";        // wa (normalized) yang lagi diproses
let _profile = null; // { token, nickname, birthDate, wa }
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
            setMsg("Nomor ini belum terdaftar sebagai member 🌱 Yuk ikut salah satu event kami dulu!", true);
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
    _profile = { token: r.token, nickname: r.nickname, birthDate: r.birthDate, wa: r.wa, journalRecords: r.journalRecords || "{}" };
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
    // Teaser sekali per sesi: kabarin ada surat prompt harian dari Mochi
    const mb = $("mochiBubble");
    if (mb && !mb._teased) {
        mb._teased = true;
        mb.classList.add("show");
        setTimeout(() => mb.classList.remove("show"), 5000);
    }
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
function prefetchTabs() {
    [loadLoyalty, loadEvents, loadRec, loadQuests, loadLeaderboard, loadGallery].forEach(fn => {
        try { fn(); } catch (e) { }
    });
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
    if (VALID_TABS.indexOf(pane) < 0) pane = "loyalty";
    document.querySelectorAll(".tab").forEach(x => x.classList.toggle("active", x.dataset.pane === pane));
    document.querySelectorAll(".pane").forEach(x => x.classList.remove("active"));
    const el = $("pane-" + pane); if (el) el.classList.add("active");
    window.scrollTo(0, 0); // pindah tab = mulai dari atas, jangan bawa posisi scroll tab sebelumnya
    const dt = $("dashTop"); if (dt) dt.style.display = (pane === "loyalty") ? "" : "none";
    if (pane === "loyalty") loadLoyalty();
    if (pane === "events") loadEvents();
    if (pane === "rec") loadRec();
    if (pane === "quest") loadQuests();
    if (pane === "rank") loadLeaderboard();
    if (pane === "gallery") loadGallery();
}
document.querySelectorAll(".tab").forEach(t => {
    t.addEventListener("click", () => {
        const pane = t.dataset.pane;
        try { location.hash = pane; } catch (e) { }
        activateTab(pane);
    });
});
// Back/forward atau ubah hash manual -> ikutin (cuma kalau dashboard tampil)
window.addEventListener("hashchange", () => {
    if ($("dashView").style.display !== "none") activateTab((location.hash || "").replace("#", ""));
});

// ---------- Event pane ----------
let _eventsLoaded = false;
async function loadEvents() {
    if (_eventsLoaded) return;
    const pane = $("pane-events");
    const _ws = (typeof WORKSHOPS !== "undefined" && Array.isArray(WORKSHOPS)) ? WORKSHOPS : [];
    // Config belum masuk -> tunggu event, render ulang sekali
    if (!_ws.length) {
        pane.innerHTML = '<div class="spinner"><div class="ring"></div></div>';
        window.addEventListener("workshops:updated", function once() {
            window.removeEventListener("workshops:updated", once);
            loadEvents();
        });
        return;
    }
    _eventsLoaded = true;
    pane.innerHTML = '<div class="spinner"><div class="ring"></div></div>';
    let counts = {}, registered = {};
    try {
        const [c, r] = await Promise.all([
            fetchJSONP(GS, "cnt", 12000).catch(() => ({})),
            fetchJSONP(GS + "?page=memberEvents&wa=" + encodeURIComponent(_profile.wa), "mev", 15000).catch(() => ({}))
        ]);
        counts = c || {}; registered = (r && r.registered) || {};
    } catch (e) { }

    const items = _ws
        .map(w => ({ w: w, status: (typeof getWorkshopStatus === "function") ? getWorkshopStatus(w) : "open" }))
        .filter(x => x.status === "open" || x.status === "not-open-yet");

    if (!items.length) {
        pane.innerHTML = '<div class="placeholder"><div class="em">📅</div><h3>Belum ada event buka</h3><p>Pantau terus ya, event baru bakal muncul di sini 🌱</p></div>';
        return;
    }

    let html = '<div class="section-lbl">🎟️ Upcoming Events</div>';
    items.forEach(x => {
        const w = x.w;
        const max = w.maxQuota || 0;
        const used = counts[w.id] || 0;
        const left = max > 0 ? Math.max(0, max - used) : null;
        const full = max > 0 && used >= max;
        const isReg = !!registered[w.id];
        const dateTxt = w.workshopDate || (typeof formatDateIndo === "function" && w.eventDate ? formatDateIndo(w.eventDate) : "");
        let badge = x.status === "not-open-yet"
            ? '<span class="ev-badge soon">SOON</span>'
            : '<span class="ev-badge open">OPEN</span>';

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

        const meta = [dateTxt, (left != null && !full && !isReg ? (left + " slots left") : "")].filter(Boolean).join(" · ");

        html += '<div class="ev">' +
            '<div class="ev-top"><div class="ev-name">' + esc(w.name || w.id) + '</div>' + badge + '</div>' +
            (meta ? '<div class="ev-meta">' + esc(meta) + '</div>' : '') +
            '<div class="ev-action">' + action + '</div>' +
            '</div>';
    });
    pane.innerHTML = html;
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
    pane.innerHTML = '<div class="spinner"><div class="ring"></div></div>';
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
    return '<span class="qb-tape tl"></span>' +
        '<span class="qb-xp">🪙 +' + questPoints(q) + ' XP</span>' +
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
    return '<span class="qb-tape tr"></span>' +
        '<div class="qb-pola">' +
        '<div class="qb-pola-img"><img src="' + esc(myPhoto || questImg(q)) + '" alt="" loading="lazy" decoding="async" onerror="this.style.opacity=.25"></div>' +
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
        leaf.style.transform = "rotateY(" + deg + "deg)";
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
        leaf.style.display = "block";
        if (dir === 1) {
            front.innerHTML = qbRightHtml(_qbCur); // muka depan leaf = halaman kanan sekarang
            back.innerHTML = qbLeftHtml(j);        // baliknya = halaman kiri berikutnya
            rightP.innerHTML = qbRightHtml(j);     // di bawah leaf udah nunggu halaman baru
            setLeaf(0, false);
            void leaf.offsetWidth;
            setLeaf(-180, true);
        } else {
            front.innerHTML = qbRightHtml(j);
            back.innerHTML = qbLeftHtml(_qbCur);
            leftP.innerHTML = qbLeftHtml(j);
            setLeaf(-180, false);
            void leaf.offsetWidth;
            setLeaf(0, true);
        }
        setTimeout(() => {
            leaf.style.display = "none";
            setPages(j);
            anim = false;
        }, 680);
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
    return '<div class="quest-row' + (done ? " done" : "") + '" data-i="' + i + '">' +
        '<div class="qr-main">' +
        '<div class="qr-title">' + esc(q.title) + (done ? ' <span class="qr-done">✓ Cleared</span>' : '') + '</div>' +
        (q.description ? '<div class="qr-desc">' + esc(q.description) + '</div>' : '') +
        (q.theme ? '<div class="qr-theme">🎨 ' + esc(q.theme) + '</div>' : '') +
        '</div>' +
        '<div class="qr-xp">🪙 +' + questPoints(q) + '</div>' +
        '</div>';
}

function renderQuestCell(q, i) {
    const done = _questSubmitted.indexOf(q.id) >= 0;
    const tape = '<div class="jtape ' + (i % 2 === 0 ? "tl" : "tr blue") + '"></div>';
    return '<div class="qg-cell' + (done ? ' done' : '') + '" data-i="' + i + '">' +
        tape +
        '<div class="qg-imgwrap">' +
        '<img class="qg-img" src="' + esc(questImg(q)) + '" alt="" loading="lazy" decoding="async" onerror="this.style.opacity=.25">' +
        '<span class="qg-xp">🪙 +' + questPoints(q) + '</span>' +
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
    loading.style.display = "block"; content.innerHTML = "";
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
                    '<span class="rank-crown">👑</span>' +
                    '<span class="rank-ava">' + esc((x.nickname || "S").charAt(0).toUpperCase()) + '</span>' +
                    '<div class="rank-info"><span class="rank-name">' + esc(x.nickname) + '</span>' +
                    '<span class="rank-tag">Top Crafter</span></div>' + pts + '</div>';
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
                    '<span class="rank-crown">👑</span>' +
                    '<span class="rank-ava tj-ava">' + esc((x.nickname || "S").charAt(0).toUpperCase()) + '</span>' +
                    '<div class="rank-info"><span class="rank-name">' + esc(x.nickname) + '</span>' +
                    '<span class="rank-tag tj-tag">Paling Setia</span></div>' + cnt + '</div>';
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
        '<span class="wr-tape w" style="bottom:76px;right:16px;transform:rotate(9deg);"></span>' +
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
            '<span class="wr-tape w" style="top:54px;left:20px;transform:rotate(-10deg);"></span>' +
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
        '<span class="wr-tape w" style="top:58px;right:22px;transform:rotate(8deg);"></span>' +
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

// Engine slider wrapped (dipakai My Summary & Passport): scroll-snap + dots +
// auto-next + tombol share IG per slide.
function showWrapped(slides, shareMeta) {
    let modal = $("wrappedModal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "wrappedModal";
        modal.className = "wrapped-modal";
        document.body.appendChild(modal);
    }
    // selipin tombol share di akhir tiap slide
    const SHARE_BTN = '<button class="wr-share wr-anim" style="--d:.45s;" data-wrshare title="Share to IG Story">📸 Share</button>';
    slides = slides.map(s => s.replace(/<\/div>$/, SHARE_BTN + "</div>"));
    let dots = "";
    slides.forEach((_, i) => { dots += '<span class="wr-dot' + (i === 0 ? " on" : "") + '"></span>'; });
    modal.innerHTML =
        '<div class="wr-top"><div class="wr-dots">' + dots + '</div><button class="wr-close" id="wrClose" aria-label="Tutup">✕</button></div>' +
        '<div class="wr-track" id="wrTrack">' + slides.join("") + '</div>' +
        '<button class="wr-zone left" id="wrPrev" aria-label="Sebelumnya"></button>' +
        '<button class="wr-zone right" id="wrNext" aria-label="Lanjut"></button>';
    modal.classList.add("show");
    lockScroll();
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
    function setLive() {
        const i = Math.max(0, Math.min(slideEls.length - 1, Math.round(track.scrollLeft / track.clientWidth)));
        if (i === cur) return;
        cur = i;
        slideEls.forEach((s, k) => s.classList.toggle("live", k === i));
        dotEls.forEach((dt, k) => dt.classList.toggle("on", k <= i));
        if (i === slideEls.length - 1 && !burst) { burst = true; fireConfetti("reward"); }
        arm();
    }
    setLive();
    track.addEventListener("scroll", setLive, { passive: true });
    track.addEventListener("touchstart", () => clearTimeout(modal._wrTimer), { passive: true });
    track.addEventListener("touchend", arm, { passive: true });
    $("wrClose").addEventListener("click", closeWrapped);
    $("wrPrev").addEventListener("click", () => track.scrollBy({ left: -track.clientWidth, behavior: "smooth" }));
    $("wrNext").addEventListener("click", () => track.scrollBy({ left: track.clientWidth, behavior: "smooth" }));
    modal.querySelectorAll("[data-wrshare]").forEach((b, i) =>
        b.addEventListener("click", () => shareWrappedSlide(slideEls[i], i, shareMeta || {})));
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
    unlockScroll();
}

// ---------- Passport Wrapped (pengganti halaman /loyalty dari Member Hub) ----------
function openPassport() {
    if (!_loyaltyStats) return; // tombolnya cuma ada setelah loadLoyalty sukses
    showWrapped(buildPassportSlides(_loyaltyStats), {
        filename: "passport-seminggu-satu.png",
        text: "My Journaling Passport ✨ @seminggu_satu"
    });
}

function buildPassportSlides(s) {
    const nick = _profile.nickname || "Sahabat";
    const slides = [];
    // 1) Cover
    slides.push('<div class="wr-slide wr-blue">' +
        '<span class="wr-tape" style="top:52px;left:20px;transform:rotate(-14deg);"></span>' +
        '<span class="wr-tape w" style="bottom:76px;right:16px;transform:rotate(9deg);"></span>' +
        '<span class="wr-stk" style="top:15%;right:11%;">🛂</span>' +
        '<img class="wr-imgstk" src="../images/sticker/str-6.png" style="width:88px;bottom:14%;left:5%;transform:rotate(-8deg);" alt="">' +
        '<span class="wr-stk" style="top:27%;left:13%;">📖</span>' +
        '<div class="wr-anim wr-kicker">SEMINGGU SATU PRESENTS</div>' +
        '<div class="wr-anim wr-title wr-hero" style="--d:.08s;">My Journaling<br>Passport ✨</div>' +
        '<div class="wr-anim wr-sub" style="--d:.16s;">Jejak petualangan journaling-mu, ' + esc(nick) + ' 💙</div>' +
        '<div class="wr-anim wr-hint" style="--d:.3s;">geser ke kiri buat mulai →</div>' +
        '</div>');
    // 2) Events joined
    slides.push('<div class="wr-slide wr-paper">' +
        '<span class="wr-tape" style="top:56px;right:22px;transform:rotate(12deg);"></span>' +
        '<span class="wr-stk" style="top:13%;left:10%;">🎪</span>' +
        '<img class="wr-imgstk" src="../images/sticker/str-1.png" style="width:80px;bottom:9%;right:5%;transform:rotate(9deg);" alt="">' +
        '<div class="wr-anim wr-kicker">EVENTS JOINED</div>' +
        '<div class="wr-anim wr-big" style="--d:.08s;">' + s.count + '</div>' +
        '<div class="wr-anim wr-title" style="--d:.14s;">event journaling kamu datengin 🎪</div>' +
        (s.since ? '<div class="wr-anim wr-sub" style="--d:.2s;">member sejak <b>' + s.since + '</b> 🌱</div>' : '') +
        (s.uniqueWs > 1 ? '<div class="wr-anim wr-chips" style="--d:.28s;"><span class="wr-chip">' + s.uniqueWs + ' tema beda dijelajahi 🗺️</span></div>' : '') +
        '</div>');
    // 3) Tier persona
    slides.push('<div class="wr-slide wr-yellow">' +
        '<span class="wr-tape w" style="top:54px;left:20px;transform:rotate(-10deg);"></span>' +
        '<span class="wr-stk" style="top:16%;right:12%;">🏅</span>' +
        '<img class="wr-imgstk" src="../images/sticker/str-3.png" style="width:76px;bottom:11%;left:5%;transform:rotate(-9deg);" alt="">' +
        '<div class="wr-anim wr-kicker">YOUR TITLE</div>' +
        '<div class="wr-anim wr-big" style="--d:.08s;">' + s.tierEmoji + '</div>' +
        '<div class="wr-anim wr-tier" style="--d:.16s;">' + esc(s.tier) + '</div>' +
        '<div class="wr-anim wr-sub" style="--d:.24s;">' + esc(s.tierTag) + '</div>' +
        '<div class="wr-anim wr-chips" style="--d:.32s;"><span class="wr-chip">🎖️ ' + esc(s.trait) + '</span></div>' +
        '</div>');
    // 4+) Your Journaling Journey: 6 event per slide, max 2 slide (12), sisanya dirangkum
    const evs = s.events || [];
    const PER = 6, MAXSLIDE = 2;
    for (let sl = 0; sl < Math.min(MAXSLIDE, Math.ceil(evs.length / PER)); sl++) {
        const chunk = evs.slice(sl * PER, sl * PER + PER);
        let rows = "";
        chunk.forEach((e, k) => {
            const when = e.eventDate || e.label || e.date || "";
            rows += '<div class="wr-jrow"><span class="n">' + (sl * PER + k + 1) + '</span>' +
                '<span class="nm">' + esc(e.name) + '</span>' +
                (when ? '<span class="dt">' + esc(when) + '</span>' : '') + '</div>';
        });
        const leftover = (sl === MAXSLIDE - 1 && evs.length > MAXSLIDE * PER)
            ? '<div class="wr-anim wr-chips" style="--d:.4s;"><span class="wr-chip">+' + (evs.length - MAXSLIDE * PER) + ' event lainnya ✨</span></div>'
            : '';
        slides.push('<div class="wr-slide wr-pink">' +
            '<span class="wr-tape" style="top:54px;' + (sl % 2 ? 'left:24px;transform:rotate(-10deg);' : 'right:24px;transform:rotate(10deg);') + '"></span>' +
            '<span class="wr-stk" style="top:13%;left:9%;">🚩</span>' +
            '<img class="wr-imgstk" src="../images/sticker/str-5.png" style="width:72px;bottom:8%;right:4%;transform:rotate(10deg);" alt="">' +
            '<div class="wr-anim wr-kicker">YOUR JOURNALING JOURNEY' + (evs.length > PER ? " " + (sl + 1) : "") + '</div>' +
            '<div class="wr-anim wr-journey" style="--d:.12s;">' + rows + '</div>' +
            leftover +
            '</div>');
    }
    // 5) Loyalty card stamps
    let st = "";
    for (let i = 0; i < s.target; i++) st += '<span class="wr-stamp star' + (i < s.progress ? " on" : "") + '">' + (i < s.progress ? "★" : "") + '</span>';
    slides.push('<div class="wr-slide wr-paper">' +
        '<span class="wr-tape" style="top:58px;left:24px;transform:rotate(-12deg);"></span>' +
        '<span class="wr-stk" style="top:14%;right:10%;">🎁</span>' +
        '<img class="wr-imgstk" src="../images/sticker/str-2.png" style="width:78px;bottom:9%;left:5%;transform:rotate(-8deg);" alt="">' +
        '<div class="wr-anim wr-kicker">LOYALTY CARD</div>' +
        '<div class="wr-anim wr-big" style="--d:.08s;">' + s.progress + '<span class="wr-big-sm">/' + s.target + '</span></div>' +
        '<div class="wr-anim wr-title" style="--d:.14s;">stamp terkumpul 🎁</div>' +
        '<div class="wr-anim wr-stamps" style="--d:.22s;">' + st + '</div>' +
        (s.eligible
            ? '<div class="wr-anim wr-stamp5" style="--d:.32s;">HADIAH GRATIS! 🎉</div>'
            : (s.count ? '<div class="wr-anim wr-sub" style="--d:.32s;"><b>' + Math.max(0, s.target - s.progress) + ' event lagi</b> buat hadiah gratis 🎁</div>' : '')) +
        '</div>');
    // 6) Outro
    slides.push('<div class="wr-slide wr-blue">' +
        '<span class="wr-tape w" style="top:58px;right:22px;transform:rotate(8deg);"></span>' +
        '<span class="wr-stk" style="top:16%;left:12%;">💌</span>' +
        '<img class="wr-imgstk" src="../images/sticker/str-8.png" style="width:90px;bottom:15%;right:6%;transform:rotate(7deg);" alt="">' +
        '<span class="wr-stk" style="top:24%;right:16%;">🌈</span>' +
        '<div class="wr-anim wr-title wr-hero">See you at the<br>next event, ' + esc(nick) + '! 💙</div>' +
        '<div class="wr-anim wr-sub" style="--d:.12s;">Tiap halaman passport ini kita isi bareng-bareng. Sampai jumpa lagi! ✨</div>' +
        '<div class="wr-anim wr-foot" style="--d:.22s;">@seminggu_satu</div>' +
        '</div>');
    return slides;
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

function formatCardNumber(wa) {
    const raw = String(wa || "").replace(/\D/g, "");
    if (!raw) return "SS · 2026 · 0000 · 8888";
    const p1 = raw.slice(0, 4) || "0800";
    const p2 = raw.slice(4, 8) || "0000";
    const p3 = raw.slice(8, 12) || "0000";
    return "SS · " + p1 + " · " + p2 + " · " + p3;
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

    let actionBtnHtml = "";
    if (isCurrentChecked) {
        actionBtnHtml = '<div class="jt-status-banner"><span>✨</span> You\'ve checked in for this week!</div>';
    } else {
        actionBtnHtml = '<button type="button" class="jt-action-btn" id="jtCheckInBtn">' + SVG_PENCIL + ' Check In This Week (+1 Streak)</button>';
    }

    const currRec = records[currMonthWeek.key] || {};
    const currentNote = currRec.note || "";
    const noteHtml = currentNote ? '<div class="jt-note-tag"><span class="note-label">Note:</span> <span class="note-text">"' + esc(currentNote) + '"</span> ✨</div>' : '';
    // foto karya minggu ini (kalau ada) -> polaroid mini
    const photoHtml = currRec.photo ? '<div class="jt-photo"><img src="' + esc(currRec.photo) + '" alt="" loading="lazy" decoding="async"></div>' : '';

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
    if (!btn) return;

    btn.addEventListener("click", () => openCheckinModal(wa));
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
    $("ciSave").addEventListener("click", async () => {
        const box = $("questModalBox");
        const input = box.querySelector(".qm-file-input");
        const capInput = box.querySelector(".qm-cap-input");
        const photo = input && input._photo;
        const note = capInput ? capInput.value.trim() : "";
        const btn = $("ciSave");
        const orig = btn.textContent;
        btn.disabled = true; btn.textContent = "Menyimpan…";
        showBusy(photo ? "Menyimpan check-in + foto…" : "Menyimpan check-in…");
        try {
            const payload = { action: "memberCheckin", token: _profile.token, weekKey: cw.key, note: note };
            if (photo) { payload.photoBase64 = photo.base64; payload.photoMime = photo.mime; }
            const r = await apiPost(payload);
            if (r.status !== "success") { btn.disabled = false; btn.textContent = orig; alert(r.message || "Gagal menyimpan absen."); return; }
            _profile.journalRecords = r.journalRecords || _profile.journalRecords; // sinkron dari server
            if (photo) _galleryLoaded = false; // biar galeri refetch (foto weekly ikut tampil)
            fireConfetti("quest");
            closeQuestModal();
            const widget = $("journalTrackerWidget");
            if (widget) {
                widget.outerHTML = renderJournalTrackerHtml(wa);
                initJournalTrackerListeners(wa);
            }
        } catch (e) {
            btn.disabled = false; btn.textContent = orig;
            alert("Gagal terhubung ke server. Coba lagi ya.");
        } finally { hideBusy(); }
    });
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
        '<div class="v-orb"></div>' +
        '<div class="v-off">' + b.age + '%</div>' +
        '<div class="v-lbl">Voucher Ulang Tahun 🎂</div>' +
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
        const msg = "Halo kak Arnold! 🎂 Aku mau claim *Voucher Ulang Tahun " + b.age + "% OFF* dari Member Hub buat event journaling.\n\nNama: " + nm + "\nWA: " + _profile.wa + "\n\nMakasih! 💙";
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

async function loadLoyalty() {
    if (_loyaltyLoaded) return;
    _loyaltyLoaded = true;
    const loading = $("loyaltyLoading"), content = $("loyaltyContent");
    loading.style.display = "block"; content.innerHTML = "";
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
            '<div class="card-logo-sub">DIGITAL MEMBER</div>' +
            '</div>' +
            '</div>' +
            '<div class="card-layer card-mid">' +
            '<div class="card-tier-badge">' + p.emoji + ' ' + esc(p.title) + '</div>' +
            '<div class="card-number">' + esc(cardNum) + '</div>' +
            '</div>' +
            '<div class="card-layer card-bot">' +
            '<div class="card-holder">' +
            '<span class="card-label">Member Name</span>' +
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
            '<span>MEMBER HUB <b>#SEMINGGUSATU</b></span>' +
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
            birthdayHtml +
            trackerHtml +
            cardHtml +
            '<div class="stat-cards">' +
            '<div class="scard"><span class="scard-ic">' + ICON_CAL + '</span><b>' + count + '</b><span>Events Joined</span></div>' +
            '<div class="scard"><span class="scard-ic">' + ICON_TARGET + '</span><b>' + (d.questCount || 0) + '</b><span>Challenges</span></div>' +
            '</div>' +
            '<div class="tier"><div class="em">' + p.emoji + '</div><div><div class="t">' + esc(p.title) + '</div><div class="d">' + esc(p.tag) + '</div></div></div>' +
            '<div class="card"><div class="section-lbl">Loyalty Card 🎁</div><div class="stamps">' + stamps + '</div>' + rewardBox + '</div>' +
            '<button class="btn-primary" id="btnPassport">Open Full Passport</button>';

        $("btnPassport").addEventListener("click", openPassport);
        init3DCardListeners();
        initJournalTrackerListeners(_profile.wa);
        if (bday) { wireBirthday(bday); fireConfetti("reward"); }
        else if (d.eligible) { fireConfetti("reward"); }
    } catch (e) {
        loading.style.display = "none";
        _loyaltyLoaded = false;           // biar bisa retry pas tab dibuka lagi
        renderError(content, loadLoyalty);
    }
}

// ---------- Auto-login ----------
(async function init() {
    let token = "";
    try { token = localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { }
    if (!token || !GS) { showAuth(); return; }   // nggak ada sesi -> langsung form login
    // Ada token -> boot loader tetap tampil sampai verifikasi selesai
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

    const actionQuest = $("fabActionQuest");
    if (actionQuest) {
        actionQuest.addEventListener("click", () => {
            toggleMenu(false);
            try { location.hash = "quest"; } catch (e) { }
            activateTab("quest");
        });
    }

    const actionShare = $("fabActionShare");
    if (actionShare) {
        actionShare.addEventListener("click", () => {
            toggleMenu(false);
            try { location.hash = "rank"; } catch (e) { }
            activateTab("rank");
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

    // ---- Toggle Dark Mode ----
    const ICON_MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    const ICON_SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
    const actionTheme = $("fabActionTheme");
    if (actionTheme) {
        const icon = $("fabThemeIcon");
        const label = $("fabThemeLabel");
        const meta = document.querySelector('meta[name="theme-color"]');
        function syncTheme() {
            const dark = document.documentElement.getAttribute("data-theme") === "dark";
            if (icon) icon.innerHTML = dark ? ICON_SUN : ICON_MOON;
            if (label) label.textContent = dark ? "Light Mode" : "Dark Mode";
            if (meta) meta.setAttribute("content", dark ? "#0d1526" : "#0046ff");
        }
        syncTheme();
        actionTheme.addEventListener("click", () => {
            toggleMenu(false);
            const dark = document.documentElement.getAttribute("data-theme") === "dark";
            if (dark) {
                document.documentElement.removeAttribute("data-theme");
                try { localStorage.setItem("ss_theme", "light"); } catch (e) { }
            } else {
                document.documentElement.setAttribute("data-theme", "dark");
                try { localStorage.setItem("ss_theme", "dark"); } catch (e) { }
            }
            syncTheme();
        });
    }
})();

// ============================================================
//  Mochi's Corner (maskot) — pembawa surat prompt harian
// ============================================================
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
    modal.innerHTML =
        '<div class="mochi-box">' +
        '<button class="mp-close" id="mpClose" aria-label="Tutup">✕</button>' +
        '<img class="mp-imgstk" src="../images/sticker/str-6.png" style="width:62px;bottom:8px;left:6px;transform:rotate(-8deg);" alt="">' +
        '<img class="mp-imgstk" src="../images/sticker/str-11.png" style="width:58px;bottom:10px;right:8px;transform:rotate(11deg);" alt="">' +
        '<div class="mp-head">💌 Surat dari Mochi</div>' +
        '<div class="mp-sub">Ada prompt journaling harian buat kamu~</div>' +
        '<div class="env-scene" id="envScene">' +
        '<div class="envelope" id="envelope" role="button" aria-label="Buka amplop">' +
        '<div class="env-back"></div>' +
        '<div class="env-letter"></div>' +
        '<div class="env-front"></div>' +
        '<div class="env-addr">Untuk: ' + esc((_profile && _profile.nickname) || "Sahabat") + ' ✍️</div>' +
        '<div class="env-postage"><img src="../images/mochi_maskot_sm.png" alt=""></div>' +
        '<div class="env-flap"></div>' +
        '<img class="env-seal" src="seal-paw.png" alt="">' +
        '<span class="env-tape a"></span><span class="env-tape b"></span>' +
        '<span class="env-stk s1">✂️</span><span class="env-stk s2">🌟</span><span class="env-stk s3">📎</span><span class="env-stk s4">🌈</span><span class="env-stk s5">🐾</span>' +
        '</div>' +
        '<div class="env-hint">ketuk amplopnya buat buka 💌</div>' +
        '</div>' +
        '<div class="mp-card" id="mpCard" style="display:none;">' +
        '<img class="mp-mochi" src="../images/mochi_maskot_sm.png" alt="">' +
        '<div class="mp-kicker" id="mpKicker"></div>' +
        '<div><span class="mp-cat" id="mpCat"></span></div>' +
        '<div class="mp-text" id="mpText"></div>' +
        '<div class="mp-actions">' +
        '<button class="mp-btn ghost" id="mpCopy">📋 Salin</button>' +
        '<button class="mp-btn" id="mpRandom">🎲 Prompt acak lainnya</button>' +
        '</div>' +
        '</div>';
    modal.classList.add("show");
    lockScroll();
    $("mpClose").addEventListener("click", closeMochiPrompt);

    const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    function showPrompt(it, isDaily) {
        _mpLastId = it.id;
        $("mpKicker").textContent = isDaily
            ? "DAILY PROMPT · " + now.getDate() + " " + MON[now.getMonth()] + " " + now.getFullYear()
            : "RANDOM PROMPT 🎲";
        $("mpCat").textContent = "🏷️ " + (it.category || "Journaling");
        $("mpText").textContent = "“" + it.prompt + "”";
        const card = $("mpCard");
        card.classList.remove("pop");
        void card.offsetWidth; // restart animasi pop
        card.classList.add("pop");
    }

    // ketuk amplop -> seal copot, flap kebuka, surat naik, baru kartu prompt muncul
    const env = $("envelope");
    let opened = false;
    env.addEventListener("click", () => {
        if (opened) return;
        opened = true;
        env.classList.add("open");
        if (typeof confetti === "function") setTimeout(() => confetti({ particleCount: 45, spread: 65, origin: { y: .6 }, zIndex: CONFETTI_Z }), 500);
        setTimeout(() => {
            $("envScene").style.display = "none";
            $("mpCard").style.display = "block";
            showPrompt(dailyPrompt(list), true);
        }, 1000);
    });

    $("mpRandom").addEventListener("click", () => showPrompt(randomPrompt(list), false));
    $("mpCopy").addEventListener("click", async () => {
        const btn = $("mpCopy");
        try { await navigator.clipboard.writeText($("mpText").textContent.replace(/[“”]/g, "")); btn.textContent = "✓ Tersalin"; }
        catch (e) { btn.textContent = "Salin manual ya"; }
        setTimeout(() => { btn.textContent = "📋 Salin"; }, 1800);
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
const ICON_TARGET = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/></svg>';
const ICON_CAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
const ICON_CAMERA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';

async function loadGallery() {
    if (_galleryLoaded) return;
    _galleryLoaded = true;
    const pane = $("pane-gallery");
    pane.innerHTML = '<div class="spinner"><div class="ring"></div></div>';
    try {
        const g = await fetchJSONP(GS + "?page=questGallery&wa=" + encodeURIComponent(_profile.wa), "gal", 20000);
        _galleryItems = (g && g.items) || [];
    } catch (e) {
        _galleryLoaded = false;
        renderError(pane, loadGallery);
        return;
    }
    renderGallery();
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
    // Urutan chip WAJIB: All, Mine, Workshop, Reka-Rekat, baru sisanya (challenge/weekly, dst)
    const PRIORITY_TITLES = ["Workshop", "Reka-Rekat"];
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
    const isEvent = (it.kind === "workshop" || it.kind === "reka-rekat");
    // event pakai tanggal event ("11 Jul 2026"), post member pakai time-ago
    const when = isEvent ? (it.eventDate ? "🗓 " + fmtEventDate(it.eventDate) : "") : timeAgo(it.ts);
    const evCls = it.kind === "workshop" ? " ev-ws" : (it.kind === "reka-rekat" ? " ev-rr" : (it.kind === "weekly" ? " ev-wj" : ""));
    const bIcon = it.kind === "workshop" ? "🎪" : (it.kind === "reka-rekat" ? "✂️" : (it.kind === "weekly" ? "📖" : "🎯"));
    const ava = isEvent ? '<div class="ig-ava official">SS</div>' : '<div class="ig-ava">' + initial + '</div>';
    // dekorasi bingkai foto per jenis
    let frameDeco = '<div class="washi-tape-top"></div>';
    if (it.kind === "workshop") frameDeco = '<span class="ev-stamp">WORKSHOP</span>';
    else if (it.kind === "reka-rekat") frameDeco = '<span class="rr-heart">♥</span>';
    else if (it.kind === "weekly") frameDeco = '<span class="wj-check">✓</span>';
    return '<article class="ig-card feed-card' + evCls + '" data-id="' + esc(it.id) + '">' +
        '<header class="feed-header">' +
        '<div class="user-meta">' + ava +
        '<div class="user-info"><span class="username">' + esc(it.nickname || "Sahabat") +
        (it.mine ? ' <span class="ig-me">KAMU</span>' : '') +
        (isEvent ? ' <span class="ig-me official-tag">OFFICIAL</span>' : '') + '</span>' +
        (when ? '<span class="post-time">' + when + '</span>' : '') + '</div></div>' +
        '<div class="quest-badge-sticker">' + bIcon + ' ' + esc(it.title) + '</div>' +
        '</header>' +
        '<div class="feed-photo-frame">' +
        frameDeco +
        '<div class="ig-imgwrap feed-photo-wrap" data-tap="' + esc(it.id) + '"><img src="' + esc(it.photo) + '" alt="" loading="lazy" decoding="async" onerror="this.style.opacity=.25"><div class="like-overlay">❤️</div></div>' +
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
        stampIn = '<span class="ev-stamp">WORKSHOP</span>';
    } else if (it.kind === "reka-rekat") {
        frame = "frame-rekarekat";
        deco = '<span class="rr-heart">♥</span>';
        stampIn = '<span class="ev-stamp rr">REKA-REKAT</span>';
    } else if (it.kind === "weekly") {
        frame = "frame-weekly";
        deco = '<span class="wj-check">✓</span>';
    } else {
        frame = (i % 2 === 0) ? "frame-polaroid" : "frame-stitched";
        deco = (i % 2 === 0) ? '<div class="jtape ' + (i % 4 === 0 ? "tr" : "tl") + '"></div>' : "";
    }
    const ava = (it.kind === "workshop" || it.kind === "reka-rekat")
        ? '<span class="jcard-ava official">SS</span>'
        : '<span class="jcard-ava">' + initial + '</span>';
    return '<div class="jcard ' + frame + '" data-id="' + esc(it.id) + '">' +
        deco +
        '<div class="jcard-imgwrap ' + ratio + '"><img src="' + esc(it.photo) + '" alt="" loading="lazy" decoding="async" onerror="this.style.opacity=.25">' + stampIn + '</div>' +
        '<div class="jcard-body">' +
        '<div class="jcard-author">' + ava +
        '<span class="jcard-nick">' + esc(it.nickname || "Sahabat") + (it.mine ? " · kamu" : "") + '</span>' +
        '<span class="jcard-likes">❤️ ' + (it.likes || 0) + '</span></div>' +
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
}

// Lightbox: buka foto galeri gede + info + tombol love (dipakai dari grid)
function openGalleryLightbox(it) {
    const modal = $("questModal");
    const initial = esc((it.nickname || "S").charAt(0).toUpperCase());
    const isEvent = (it.kind === "workshop" || it.kind === "reka-rekat");
    const bIcon = it.kind === "workshop" ? "🎪" : (it.kind === "reka-rekat" ? "✂️" : (it.kind === "weekly" ? "📖" : "🎯"));
    const ava = isEvent ? '<div class="ig-ava official">SS</div>' : '<div class="ig-ava">' + initial + '</div>';
    $("questModalBox").innerHTML =
        '<div class="qm-topbar"><button class="qm-close" id="qmClose" aria-label="Tutup">✕</button></div>' +
        '<div class="ig-imgwrap" id="lbImg" style="aspect-ratio:1/1"><img src="' + esc(it.photo) + '" alt="" onerror="this.style.opacity=.25"><div class="like-overlay">❤️</div></div>' +
        '<div class="qm-body">' +
        '<div class="ig-head" style="padding-left:0;padding-right:0;">' + ava +
        '<div class="ig-user-info"><div class="ig-user-row"><span class="ig-user">' + esc(it.nickname || "Sahabat") + '</span>' +
        (it.mine ? '<span class="ig-me">KAMU</span>' : '') +
        (isEvent ? '<span class="ig-me official-tag">OFFICIAL</span>' : '') + '</div>' +
        '<div class="ig-chal">' + bIcon + ' ' + esc(it.title) + (it.eventDate ? ' · 🗓 ' + esc(fmtEventDate(it.eventDate)) : '') + '</div></div></div>' +
        '<div class="ig-actions" style="padding-left:0;padding-right:0;"><button class="ig-btn-like" data-like="' + esc(it.id) + '"><span class="li-icon">' + (it.liked ? "❤️" : "🤍") + '</span> <span class="li-count">' + (it.likes || 0) + '</span> Likes</button></div>' +
        (it.caption ? '<div class="ig-cap" style="padding-left:0;padding-right:0;"><b>' + esc(it.nickname || "Sahabat") + '</b> ' + esc(it.caption) + '</div>' : '') +
        '</div>';
    modal.classList.add("show");
    lockScroll();
    $("qmClose").addEventListener("click", closeQuestModal);
    const box = $("questModalBox");
    const likeBtn = box.querySelector(".ig-btn-like");
    if (likeBtn) likeBtn.addEventListener("click", () => toggleLike(it.id));
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

// ---------- Sahabat Stories (bar di atas Gallery, ala scrapbook) ----------
// Foto galeri digroup per orang -> bulatan story. Official (Workshop/Reka-Rekat)
// digabung jadi satu story "Seminggu Satu". Urutan bulatan diacak tiap render.
let _storyGroups = [];
let _storyGIdx = 0;
let _storySIdx = 0;
// Auto-next ngikutin animasi progress bar (storyRun 3.5s di CSS) via animationend,
// jadi pas foto ditahan (pause) progress-nya ikut berhenti kayak IG.

function storyKindIcon(kind) {
    return kind === "workshop" ? "🎪" : (kind === "reka-rekat" ? "✂️" : (kind === "weekly" ? "📖" : "🎯"));
}

function buildStoryGroups() {
    const map = {};
    const order = [];
    _galleryItems.forEach(it => {
        if (!it.photo) return;
        const official = (it.kind === "workshop" || it.kind === "reka-rekat");
        const key = official ? "__official__" : ("u:" + (it.nickname || "Sahabat"));
        if (!map[key]) {
            map[key] = { key: key, official: official, nickname: official ? "Seminggu Satu" : (it.nickname || "Sahabat"), mine: false, items: [] };
            order.push(map[key]);
        }
        if (it.mine) map[key].mine = true;
        map[key].items.push(it);
    });
    order.forEach(g => g.items.sort((a, b) => (a.ts || 0) - (b.ts || 0))); // lama -> baru, kayak story beneran
    for (let i = order.length - 1; i > 0; i--) { // shuffle Fisher-Yates
        const j = Math.floor(Math.random() * (i + 1));
        const t = order[i]; order[i] = order[j]; order[j] = t;
    }
    return order;
}

function renderStoryBar() {
    const wrap = $("storyBar");
    if (!wrap) return;
    _storyGroups = buildStoryGroups();
    if (!_storyGroups.length) { wrap.innerHTML = ""; return; }
    let html = '<div class="story-lbl">✨ Sahabat Stories</div><div class="story-track">';
    _storyGroups.forEach((g, idx) => {
        const rot = ["st-r1", "st-r2", "st-r3"][idx % 3];
        const latest = g.items[g.items.length - 1];
        const ava = g.official
            ? '<span class="story-ava official">SS</span>'
            : '<span class="story-ava"><img src="' + esc(latest.photo) + '" alt="" loading="lazy" decoding="async"></span>';
        html += '<button class="story-item ' + rot + '" data-g="' + idx + '">' +
            '<span class="story-tape"></span>' +
            '<span class="story-ring">' + ava + '</span>' +
            '<span class="story-sticker">' + storyKindIcon(latest.kind) + '</span>' +
            '<span class="story-count">' + g.items.length + '</span>' +
            '<span class="story-name">' + esc(g.nickname) + (g.mine ? " · kamu" : "") + '</span>' +
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
    const ava = g.official
        ? '<div class="ig-ava official">SS</div>'
        : '<div class="ig-ava">' + esc((g.nickname || "S").charAt(0).toUpperCase()) + '</div>';
    const icon = storyKindIcon(it.kind);
    return '<div class="story-box">' +
        '<span class="story-tape-tl"></span><span class="story-tape-br"></span>' +
        bars +
        '<div class="story-head">' +
        '<div class="story-who">' + ava +
        '<div><div class="story-who-name">' + esc(g.nickname) +
        (it.mine ? ' <span class="ig-me">KAMU</span>' : '') +
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
    modal.innerHTML =
        '<div class="story-stage" id="storyStage">' +
        '<div class="story-cube" id="storyCube">' +
        '<div class="story-face cur">' + storyBoxHtml(_storyGIdx, _storySIdx, true) + '</div>' +
        '</div></div>';
    let held = false; // habis drag/long-press, click bawaan di-swallow biar nggak dobel navigasi
    $("storyClose").addEventListener("click", closeStory);
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
    if (it.liked) fireConfetti("love");
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
        b.textContent = "❤️ " + (it.likes || 0);
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
