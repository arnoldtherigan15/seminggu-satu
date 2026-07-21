// ============================================================
//  Member Hub (/member) — login/daftar akun + portal
// ============================================================
const GS = (typeof GOOGLE_SCRIPT_URL !== "undefined") ? GOOGLE_SCRIPT_URL : "";
const TOKEN_KEY = "ss_member_token";
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
        function done() { try { delete window[cb]; } catch (e) {} if (s.parentNode) s.parentNode.removeChild(s); }
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
    } finally { btn.disabled = false; }
}

async function doLogin() {
    const pass = $("loginPass").value;
    if (!pass) { setMsg("Password-nya diisi dulu ya.", true); return; }
    const btn = $("loginBtn"); btn.disabled = true; setMsg("Masuk…");
    try {
        const r = await apiPost({ action: "memberLogin", wa: _wa, password: pass });
        if (r.status === "success") { onAuthSuccess(r); }
        else { setMsg(r.message || "Gagal masuk.", true); }
    } catch (e) { setMsg("Gagal terhubung ke server.", true); }
    finally { btn.disabled = false; }
}

async function doSetup() {
    const pass = $("setupPass").value;
    const birth = $("setupBirth").value;
    if (pass.length < 4) { setMsg("Password minimal 4 karakter.", true); return; }
    if (!birth) { setMsg("Tanggal lahir diisi dulu ya 🎂", true); return; }
    const btn = $("setupBtn"); btn.disabled = true; setMsg("Membuat akun…");
    try {
        const r = await apiPost({ action: "memberSetup", wa: _wa, password: pass, birthDate: birth });
        if (r.status === "success") { onAuthSuccess(r); }
        else { setMsg(r.message || "Gagal membuat akun.", true); }
    } catch (e) { setMsg("Gagal terhubung ke server.", true); }
    finally { btn.disabled = false; }
}

function onAuthSuccess(r) {
    _profile = { token: r.token, nickname: r.nickname, birthDate: r.birthDate, wa: r.wa };
    try { localStorage.setItem(TOKEN_KEY, r.token); } catch (e) {}
    showDashboard();
}

function logout() {
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
    _profile = null; _loyaltyLoaded = false; _eventsLoaded = false; _recLoaded = false; _questsLoaded = false; _lbLoaded = false;
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
}

function showDashboard() {
    hideBoot();
    $("authView").style.display = "none";
    $("dashView").style.display = "block";
    $("dashHi").textContent = "Hai, " + (_profile.nickname || "Sahabat") + "! 👋";
    // Ikutin tab dari hash (biar refresh nggak balik ke tab pertama)
    activateTab((location.hash || "").replace("#", "") || "loyalty");
}

const VALID_TABS = ["loyalty", "events", "rec", "quest", "rank"];
function activateTab(pane) {
    if (VALID_TABS.indexOf(pane) < 0) pane = "loyalty";
    document.querySelectorAll(".tab").forEach(x => x.classList.toggle("active", x.dataset.pane === pane));
    document.querySelectorAll(".pane").forEach(x => x.classList.remove("active"));
    const el = $("pane-" + pane); if (el) el.classList.add("active");
    if (pane === "loyalty") loadLoyalty();
    if (pane === "events") loadEvents();
    if (pane === "rec") loadRec();
    if (pane === "quest") loadQuests();
    if (pane === "rank") loadLeaderboard();
}
document.querySelectorAll(".tab").forEach(t => {
    t.addEventListener("click", () => {
        const pane = t.dataset.pane;
        try { location.hash = pane; } catch (e) {}
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
    } catch (e) {}

    const items = _ws
        .map(w => ({ w: w, status: (typeof getWorkshopStatus === "function") ? getWorkshopStatus(w) : "open" }))
        .filter(x => x.status === "open" || x.status === "not-open-yet");

    if (!items.length) {
        pane.innerHTML = '<div class="placeholder"><div class="em">📅</div><h3>Belum ada event buka</h3><p>Pantau terus ya, event baru bakal muncul di sini 🌱</p></div>';
        return;
    }

    let html = '<div class="section-lbl">Event yang bisa kamu ikuti</div>';
    items.forEach(x => {
        const w = x.w;
        const max = w.maxQuota || 0;
        const used = counts[w.id] || 0;
        const left = max > 0 ? Math.max(0, max - used) : null;
        const full = max > 0 && used >= max;
        const isReg = !!registered[w.id];
        const dateTxt = w.workshopDate || (typeof formatDateIndo === "function" && w.eventDate ? formatDateIndo(w.eventDate) : "");
        let badge = x.status === "not-open-yet"
            ? '<span class="ev-badge soon">Segera</span>'
            : '<span class="ev-badge open">Buka</span>';

        let action;
        if (isReg) action = '<div class="ev-done">✅ Kamu udah daftar di event ini</div>';
        else if (x.status === "not-open-yet") action = '<div class="ev-meta">Pendaftaran belum dibuka</div>';
        else if (full) action = '<div class="ev-full">Slot penuh 😢</div>';
        else {
            let href = "../" + (w.path || "");
            // Event member (journaling-date): bawa WA (nggak input ulang) + flag from=member (balik ke portal)
            if (w.id === "journaling-date") href += (href.indexOf("?") >= 0 ? "&" : "?") + "wa=" + encodeURIComponent(_profile.wa) + "&from=member";
            action = '<a class="btn-primary" href="' + esc(href) + '">Daftar →</a>';
        }

        const meta = [dateTxt, (left != null && !full && !isReg ? ("Sisa " + left + " slot") : "")].filter(Boolean).join(" · ");

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
const REC_CAT_LABEL = { tools: "🛠️ Alat", material: "🎨 Bahan", paper: "📄 Kertas" };
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
    let tabs = '<button class="rfilter active" data-cat="all">Semua</button>';
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
            (img ? '<img src="' + esc(img) + '" alt="" loading="lazy" onerror="this.style.opacity=0.3">' : '') +
            '<div class="rec-body">' +
            '<div class="rec-title">' + esc(it.title) + '</div>' +
            // deskripsi = HTML (boleh <strong> dll) dari config statis terpercaya
            (it.description ? '<div class="rec-desc">' + it.description + '</div>' : '') +
            (it.link ? '<a class="rec-link" href="' + esc(it.link) + '" target="_blank" rel="noopener">Lihat produk →</a>' : '') +
            '</div></div>';
    });
    wrap.innerHTML = html;
}
function recList_() {
    return (typeof RECOMMENDATIONS !== "undefined" && Array.isArray(RECOMMENDATIONS)) ? RECOMMENDATIONS.filter(it => it && it.title) : [];
}

// ---------- Side Quest pane ----------
let _questsLoaded = false;
function compressImage(file, maxSize, quality) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = ev => {
            const img = new Image();
            img.onload = () => {
                const c = document.createElement("canvas");
                let w = img.width, h = img.height;
                if (w > h) { if (w > maxSize) { h *= maxSize / w; w = maxSize; } }
                else { if (h > maxSize) { w *= maxSize / h; h = maxSize; } }
                c.width = w; c.height = h;
                c.getContext("2d").drawImage(img, 0, 0, w, h);
                resolve(c.toDataURL("image/jpeg", quality));
            };
            img.onerror = reject; img.src = ev.target.result;
        };
        reader.onerror = reject; reader.readAsDataURL(file);
    });
}

async function loadQuests() {
    if (_questsLoaded) return;
    _questsLoaded = true;
    const pane = $("pane-quest");
    pane.innerHTML = '<div class="spinner"><div class="ring"></div></div>';
    let challenges = [], submitted = [];
    try {
        const [c, s] = await Promise.all([
            fetchJSONP(GS + "?page=challenges", "chl", 15000).catch(() => ({})),
            fetchJSONP(GS + "?page=memberQuests&wa=" + encodeURIComponent(_profile.wa), "mq", 15000).catch(() => ({}))
        ]);
        challenges = (c && c.challenges) || [];
        submitted = (s && s.submitted) || [];
    } catch (e) {}
    if (!challenges.length) {
        pane.innerHTML = '<div class="placeholder"><div class="em">⚡</div><h3>Belum ada challenge</h3><p>Pantau terus ya, side quest baru bakal muncul di sini! 🌱</p></div>';
        return;
    }
    let html = '<div class="section-lbl">Challenge yang lagi jalan ⚡</div>';
    challenges.forEach(q => {
        const done = submitted.indexOf(q.id) >= 0;
        const img = q.image ? (/^https?:\/\//.test(q.image) ? q.image : "../" + q.image) : "";
        html += '<div class="quest" data-id="' + esc(q.id) + '">' +
            (img ? '<img class="quest-img" src="' + esc(img) + '" alt="" loading="lazy">' : '') +
            '<div class="quest-body">' +
            (q.theme ? '<span class="quest-theme">' + esc(q.theme) + '</span>' : '') +
            '<div class="quest-title">' + esc(q.title) + '</div>' +
            (q.description ? '<div class="quest-desc">' + esc(q.description) + '</div>' : '') +
            '<div class="quest-action">' +
            (done ? '<div class="ev-done">✅ Kamu udah ikut challenge ini</div>'
                : '<button class="btn-primary quest-join">Ikut Challenge →</button>') +
            '</div></div></div>';
    });
    pane.innerHTML = html;
    pane.querySelectorAll(".quest").forEach(card => {
        const btn = card.querySelector(".quest-join");
        if (btn) btn.addEventListener("click", () => startQuestSubmit(card));
    });
}

function startQuestSubmit(card) {
    const action = card.querySelector(".quest-action");
    action.innerHTML =
        '<input type="file" accept="image/*" class="quest-file" style="display:none">' +
        '<div class="quest-preview"></div>' +
        '<button class="btn-ghost2 quest-pick">📷 Pilih foto spread kamu</button>' +
        '<button class="btn-primary quest-send" style="display:none;margin-top:8px;">Kirim Challenge 🎉</button>';
    const file = action.querySelector(".quest-file");
    const pick = action.querySelector(".quest-pick");
    const send = action.querySelector(".quest-send");
    const prev = action.querySelector(".quest-preview");
    let b64 = "";
    pick.addEventListener("click", () => file.click());
    file.addEventListener("change", async e => {
        const f = e.target.files[0]; if (!f) return;
        if (f.size > 5 * 1024 * 1024) { alert("Ukuran foto maks 5MB ya."); return; }
        try {
            const dataUrl = await compressImage(f, 1400, 0.82);
            b64 = dataUrl.split(",")[1];
            prev.innerHTML = '<img src="' + dataUrl + '" style="width:100%;border-radius:12px;margin-bottom:8px;">';
            pick.textContent = "📷 Ganti foto";
            send.style.display = "block";
        } catch (err) { alert("Gagal memproses foto, coba lagi."); }
    });
    send.addEventListener("click", async () => {
        if (!b64) { alert("Pilih foto dulu ya."); return; }
        send.disabled = true; send.textContent = "Mengirim…";
        try {
            const r = await apiPost({ action: "memberSubmitQuest", token: _profile.token, challengeId: card.dataset.id, photoBase64: b64 });
            if (r.status === "success") {
                action.innerHTML = '<div class="ev-done">✅ Challenge kekirim! Makasih ya 🎉</div>' +
                    '<button class="btn-primary quest-share" style="margin-top:8px;">📲 Share ke grup WA</button>';
                action.querySelector(".quest-share").addEventListener("click", () => shareQuestImage(b64));
            } else { send.disabled = false; send.textContent = "Kirim Challenge 🎉"; alert(r.message || "Gagal kirim."); }
        } catch (e) { send.disabled = false; send.textContent = "Kirim Challenge 🎉"; alert("Gagal terhubung ke server."); }
    });
}

async function shareQuestImage(b64) {
    try {
        const blob = await (await fetch("data:image/jpeg;base64," + b64)).blob();
        const f = new File([blob], "spread-journal.jpg", { type: "image/jpeg" });
        if (navigator.canShare && navigator.canShare({ files: [f] })) {
            await navigator.share({ files: [f], text: "Spread challenge journaling-ku bareng Seminggu Satu! 💙 #SemingguSatu" });
        } else {
            alert("Yuk share foto spread-mu ke grup WA komunitas ya! 💙 (Buka WhatsApp → grup → kirim foto)");
        }
    } catch (e) { if (e && e.name === "AbortError") return; alert("Gagal share, coba lagi ya."); }
}

// ---------- Leaderboard pane ----------
let _lbLoaded = false;
async function loadLeaderboard() {
    if (_lbLoaded) return;
    _lbLoaded = true;
    const loading = $("lbLoading"), content = $("lbContent");
    loading.style.display = "block"; content.innerHTML = "";
    let data = { top: [], me: null };
    try {
        data = await fetchJSONP(GS + "?page=leaderboard&wa=" + encodeURIComponent(_profile.wa), "lb", 20000);
    } catch (e) {}
    loading.style.display = "none";
    const top = (data && data.top) || [];
    const me = (data && data.me) || null;
    if (!top.length) {
        content.innerHTML = '<div class="placeholder"><div class="em">🏆</div><h3>Belum ada peringkat</h3><p>Ikut side quest buat ngumpulin poin & masuk papan peringkat! ⚡</p></div>';
        return;
    }
    const medal = r => (r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : r);
    const top5 = top.slice(0, 5);
    let rows = "";
    top5.forEach(x => {
        const isMe = me && x.rank === me.rank && x.nickname === me.nickname;
        rows += '<div class="lb-row' + (x.rank === 1 ? ' top' : '') + (isMe ? ' me' : '') + '">' +
            '<span class="n">' + medal(x.rank) + '</span>' +
            '<span class="nm">' + esc(x.nickname) + '</span>' +
            '<span class="pt">' + x.poin + ' poin</span></div>';
    });
    const meBox = (me && me.rank > 5)
        ? '<div class="lb-me">Peringkat kamu: #' + me.rank + ' dari ' + me.total + ' · ' + me.poin + ' poin ⚡</div>'
        : '';

    content.innerHTML =
        '<div class="lb-card" id="lbCard">' +
        '<div class="lb-head">🏆 Papan Peringkat</div>' +
        '<div class="lb-title">Juara Side Quest</div>' +
        '<div class="lb-sub">Poin dari challenge journaling ⚡</div>' +
        '<div class="lb-rows">' + rows + '</div>' +
        meBox +
        '<div class="lb-foot">@seminggu_satu</div>' +
        '</div>' +
        '<button class="btn-primary" id="lbShare" style="margin-top:1rem;">📲 Share ke IG Story</button>';
    $("lbShare").addEventListener("click", shareLeaderboard);
}

async function shareLeaderboard() {
    const card = $("lbCard");
    const btn = $("lbShare");
    if (!card) return;
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = "Menyiapkan…";
    const clone = card.cloneNode(true);
    clone.classList.add("export");
    clone.style.width = "360px"; clone.style.height = "640px"; clone.style.maxWidth = "none";
    clone.style.position = "fixed"; clone.style.left = "-10000px"; clone.style.top = "0";
    document.body.appendChild(clone);
    try {
        const canvas = await html2canvas(clone, { scale: 3, backgroundColor: null, useCORS: true, width: 360, height: 640, windowWidth: 360, windowHeight: 640 });
        const blob = await new Promise(res => canvas.toBlob(res, "image/png"));
        const file = new File([blob], "leaderboard-seminggu-satu.png", { type: "image/png" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: "Leaderboard Seminggu Satu", text: "Papan peringkat side quest Seminggu Satu! 🏆 @seminggu_satu" });
        } else {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob); a.download = "leaderboard-seminggu-satu.png"; a.click();
            URL.revokeObjectURL(a.href);
            alert("Gambar leaderboard ke-download 📥 — upload ke IG Story ya!");
        }
    } catch (e) { if (!(e && e.name === "AbortError")) alert("Gagal bikin gambar, coba lagi ya."); }
    finally {
        if (clone.parentNode) clone.parentNode.removeChild(clone);
        btn.disabled = false; btn.textContent = label;
    }
}

// ---------- Loyalty pane ----------
function persona(count) {
    let title, tag, emoji;
    if (count >= 10) { title = "DEWA JOURNALING"; tag = "Warga kehormatan Seminggu Satu 👑"; emoji = "👑"; }
    else if (count >= 6) { title = "LEGENDA JOURNALING"; tag = "Sahabat setia Seminggu Satu 🎁"; emoji = "🏆"; }
    else if (count >= 4) { title = "JOURNALING ENTHUSIAST"; tag = "Anak tongkrongan Seminggu Satu 🔥"; emoji = "🔥"; }
    else if (count >= 2) { title = "PETUALANG KREATIF"; tag = "Mulai betah kumpul bareng kita ✨"; emoji = "✨"; }
    else { title = "PENDATANG BARU"; tag = "Baru gabung keluarga Seminggu Satu 🌱"; emoji = "🌱"; }
    return { title, tag, emoji };
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
        const toGo = Math.max(0, target - progress);
        let stamps = "";
        for (let i = 0; i < target; i++) stamps += '<div class="stamp' + (i < progress ? ' on' : '') + '">' + (i < progress ? '★' : '') + '</div>';
        const rewardBox = d.eligible
            ? '<div class="eligible">🎉 Kamu dapat HADIAH GRATIS! Tunjukkin ke admin ya.</div>'
            : '<div class="togo">' + (count === 0 ? '' : '<b>' + toGo + ' event lagi</b> buat hadiah gratis 🎁') + '</div>';

        content.innerHTML =
            '<div class="stat-cards">' +
                '<div class="scard"><b>' + count + '</b><span>Kali Kumpul</span></div>' +
                '<div class="scard"><b>' + (d.questCount || 0) + '</b><span>⚡ Side Quest</span></div>' +
            '</div>' +
            '<div class="tier"><div class="em">' + p.emoji + '</div><div><div class="t">' + esc(p.title) + '</div><div class="d">' + esc(p.tag) + '</div></div></div>' +
            '<div class="card"><div class="section-lbl">Kartu Loyalty 🎁</div><div class="stamps">' + stamps + '</div>' + rewardBox + '</div>' +
            '<a class="btn-primary" href="../loyalty/?wa=' + encodeURIComponent(_profile.wa) + '">Buka Passport Lengkap →</a>';
    } catch (e) {
        loading.style.display = "none";
        content.innerHTML = '<div class="placeholder"><div class="em">📡</div><h3>Gagal memuat</h3><p>Cek internetmu lalu coba lagi.</p></div>';
    }
}

// ---------- Auto-login ----------
(async function init() {
    let token = "";
    try { token = localStorage.getItem(TOKEN_KEY) || ""; } catch (e) {}
    if (!token || !GS) { showAuth(); return; }   // nggak ada sesi -> langsung form login
    // Ada token -> boot loader tetap tampil sampai verifikasi selesai
    try {
        const r = await apiPost({ action: "memberSession", token: token });
        if (r.status === "success") { onAuthSuccess(r); }
        else { try { localStorage.removeItem(TOKEN_KEY); } catch (e) {} showAuth(); }
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
