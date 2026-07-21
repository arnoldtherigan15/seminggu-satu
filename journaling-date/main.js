// ============================================================
//  Journaling Date (event member gratis) — Registration Logic
//  Alur: cek member via WA -> detail sesi + foto -> daftar.
// ============================================================

const ID = "journaling-date";
const MAX_SLOT = 6;
let _member = null;      // { wa, nickname } setelah lolos gate
let _configApplied = false;

// ---------- Utils ----------
function showToast(message) {
    const c = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = message;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}
function showBlocker(msg) {
    document.getElementById('blockerMessage').textContent = msg || 'Memproses…';
    document.getElementById('blockerLoader').classList.add('visible');
}
function hideBlocker() { document.getElementById('blockerLoader').classList.remove('visible'); }

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
        const to = setTimeout(() => { reject(new Error("timeout")); cleanup(); }, timeoutMs || 15000);
        function cleanup() { try { delete window[cb]; } catch (e) {} if (s.parentNode) s.parentNode.removeChild(s); }
        window[cb] = (data) => { clearTimeout(to); resolve(data); cleanup(); };
        s.src = url + (url.indexOf("?") >= 0 ? "&" : "?") + "callback=" + cb + "&_=" + Date.now();
        s.onerror = () => { clearTimeout(to); reject(new Error("network")); cleanup(); };
        document.body.appendChild(s);
    });
}

// ---------- Config sesi (dari server, via workshop-config.js) ----------
function applyConfig() {
    const w = (typeof getWorkshopById === "function") ? getWorkshopById(ID) : null;
    if (!w) return; // config belum ada -> biarin default
    _configApplied = true;

    // Kalau di-set tutup dari config -> tampilkan closed
    if (typeof getWorkshopStatus === "function") {
        const st = getWorkshopStatus(w);
        if (st !== "open") {
            document.getElementById("gateSection").style.display = "none";
            document.getElementById("formSection").style.display = "none";
            document.getElementById("closedSection").style.display = "block";
            return;
        }
    }
    // Isi detail sesi (kalau form udah kebuka)
    const dt = document.getElementById("jdDate"); if (dt) dt.textContent = w.workshopDate || "-";
    const tm = document.getElementById("jdTime"); if (tm) tm.textContent = w.workshopTime || "-";
    const ln = document.getElementById("jdLoc");
    if (ln) { ln.textContent = w.locationName || "-"; if (w.mapsLink) ln.href = w.mapsLink; }
}
applyConfig();
window.addEventListener("workshops:updated", applyConfig);

// ---------- Slot / kuota ----------
async function refreshSlot() {
    const el = document.getElementById("jdSlotText");
    const sub = document.getElementById("submitBtn");
    try {
        const counts = await fetchJSONP(GOOGLE_SCRIPT_URL, "cnt", 10000);
        const w = (typeof getWorkshopById === "function") ? getWorkshopById(ID) : null;
        const max = (w && w.maxQuota) ? w.maxQuota : MAX_SLOT;
        const used = (counts && counts[ID]) || 0;
        const left = Math.max(0, max - used);
        if (left <= 0) {
            el.textContent = "Slot penuh 😢";
            sub.disabled = true; sub.innerHTML = "Slot Penuh";
        } else {
            el.textContent = "Sisa " + left + " dari " + max + " slot";
            sub.disabled = false;
        }
    } catch (e) {
        // Gagal cek: fail-open (server tetap validasi ulang saat submit)
        el.textContent = "Slot terbatas (" + MAX_SLOT + " orang)";
        sub.disabled = false;
    }
}

// ---------- Gate: cek member ----------
document.getElementById("checkBtn").addEventListener("click", checkMember);
document.getElementById("waInput").addEventListener("keydown", (e) => { if (e.key === "Enter") checkMember(); });

async function checkMember() {
    const raw = document.getElementById("waInput").value;
    const wa = normWa(raw);
    const msg = document.getElementById("gateMsg");
    if (!wa || wa.length < 8) { msg.className = "jd-msg err"; msg.textContent = "Nomor WhatsApp-nya kurang lengkap ya 🙏"; return; }
    if (typeof GOOGLE_SCRIPT_URL === "undefined" || !GOOGLE_SCRIPT_URL) { msg.className = "jd-msg err"; msg.textContent = "Konfigurasi belum siap, refresh dulu ya."; return; }

    const btn = document.getElementById("checkBtn");
    btn.disabled = true; msg.className = "jd-msg"; msg.textContent = "";
    showBlocker("Mengecek keanggotaan…");
    try {
        const r = await fetchJSONP(GOOGLE_SCRIPT_URL + "?page=memberCheck&wa=" + encodeURIComponent(wa), "mc", 20000);
        if (r && r.isMember) {
            _member = { wa: wa, nickname: r.nickname || "Sahabat" };
            document.getElementById("gateSection").style.display = "none";
            document.getElementById("formSection").style.display = "block";
            document.getElementById("greetName").textContent = "Hai, " + _member.nickname + "! 👋";
            document.getElementById("submitBtn").disabled = true; // kunci sampai tiket dicek
            applyConfig();
            // Cek tiket dengan blocker biar user nggak submit duluan
            showBlocker("Mengecek tiket…");
            await refreshSlot();
        } else {
            msg.className = "jd-msg err";
            msg.innerHTML = "Nomor ini belum terdaftar sebagai member 🌱<br>Journaling Date khusus alumni event. Yuk ikut salah satu event kami dulu!";
        }
    } catch (e) {
        msg.className = "jd-msg err"; msg.textContent = "Gagal terhubung ke server. Coba lagi ya.";
    } finally {
        btn.disabled = false; hideBlocker();
    }
}

// ---------- Foto (kompres + preview) ----------
function compressImage(file, maxSize, quality) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = ev => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                if (w > h) { if (w > maxSize) { h *= maxSize / w; w = maxSize; } }
                else { if (h > maxSize) { w *= maxSize / h; h = maxSize; } }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject; img.src = ev.target.result;
        };
        reader.onerror = reject; reader.readAsDataURL(file);
    });
}

function wirePhoto(inputId, boxId, previewId, b64Id) {
    const input = document.getElementById(inputId);
    input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { showToast("Ukuran gambar maksimal 5MB."); input.value = ""; return; }
        try {
            showBlocker("Memproses foto…");
            const dataUrl = await compressImage(file, 1200, 0.8);
            document.getElementById(b64Id).value = dataUrl.split(',')[1];
            const box = document.getElementById(boxId), prev = document.getElementById(previewId);
            prev.src = dataUrl; box.classList.add('has-image');
        } catch (err) { showToast("Gagal memproses foto, coba lagi."); }
        finally { hideBlocker(); }
    });
}
wirePhoto('photo1', 'box1', 'preview1', 'photo1Base64');
wirePhoto('photo2', 'box2', 'preview2', 'photo2Base64');
wirePhoto('photo3', 'box3', 'preview3', 'photo3Base64');
wirePhoto('photo4', 'box4', 'preview4', 'photo4Base64');

// ---------- Submit ----------
document.getElementById("jdForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!_member) { showToast("Cek keanggotaan dulu ya."); return; }

    const btn = document.getElementById("submitBtn");
    const status = document.getElementById("statusMessage");
    const original = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = "Mengirim…";
    status.style.display = "none";
    showBlocker("Mengamankan tempatmu…");

    const payload = {
        workshopType: ID,
        whatsapp: _member.wa,
        nickname: _member.nickname,
        photo1Base64: document.getElementById("photo1Base64").value || "",
        photo2Base64: document.getElementById("photo2Base64").value || "",
        photo3Base64: document.getElementById("photo3Base64").value || "",
        photo4Base64: document.getElementById("photo4Base64").value || ""
    };

    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 60000);
    try {
        const res = await fetch(GOOGLE_SCRIPT_URL, { method: "POST", body: JSON.stringify(payload), signal: controller.signal });
        clearTimeout(tid);
        const result = await res.json();
        if (result.status === "success") {
            const params = new URLSearchParams({ name: _member.nickname, whatsapp: _member.wa, workshop: ID });
            if (new URLSearchParams(location.search).get("from") === "member") params.set("from", "member");
            window.location.href = "../success.html?" + params.toString();
        } else {
            throw new Error(result.message || "Terjadi kesalahan.");
        }
    } catch (err) {
        status.className = "jd-msg err";
        status.textContent = (err.name === "AbortError")
            ? "Koneksi timeout. Cek internetmu lalu coba lagi ya."
            : err.message;
        status.style.display = "block";
    } finally {
        clearTimeout(tid);
        btn.disabled = false; btn.innerHTML = original;
        if (window.lucide) lucide.createIcons();
        hideBlocker();
    }
});

// Datang dari portal member (udah login) -> WA dibawa lewat ?wa= -> auto cek, nggak input ulang
(function () {
    var wa = new URLSearchParams(location.search).get("wa");
    if (wa) {
        document.getElementById("waInput").value = wa;
        checkMember();
    }
})();

if (window.lucide) lucide.createIcons();
