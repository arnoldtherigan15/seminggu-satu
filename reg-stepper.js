// =========================================================================
//  reg-stepper.js -- form pendaftaran workshop jadi langkah-langkah
//  (Data diri -> Detail -> Bayar -> Cek & kirim).
//
//  Progressive enhancement: DOM form yang udah ada cuma DIKELOMPOKIN ulang
//  (elemennya dipindah, bukan dibikin ulang), jadi logic submit/upload/
//  validasi di main.js tiap halaman tetap jalan apa adanya. Kalau script ini
//  gagal / nggak dimuat, form tetap tampil 1 halaman kayak dulu.
//
//  + Draft teks disimpen di sessionStorage -- pas pindah ke app bank buat
//    transfer lalu balik & Safari reload, isian nggak ilang.
// =========================================================================
(function () {
    const form = document.getElementById('workshopForm');
    if (!form || form.dataset.stepped) return;
    form.dataset.stepped = '1';

    const DRAFT_KEY = 'ss_reg_draft:' + location.pathname;
    const kids = Array.from(form.children);
    const has = (el, sel) => el.matches(sel) || !!el.querySelector(sel);

    // --- klasifikasi blok form ---
    const groups = { data: [], detail: [], pay: [], send: [] };
    kids.forEach(el => {
        if (el.tagName === 'INPUT' && el.type === 'hidden') return; // pilihan visualizer (tetep di tempat)
        if (has(el, '#submitBtn') || el.id === 'statusMessage' || el.classList.contains('checkbox-group')) groups.send.push(el);
        else if (el.classList.contains('payment-info') || el.classList.contains('non-refund-notice') || has(el, '#paymentPhoto')) groups.pay.push(el);
        else if (has(el, '#whatsapp, #igUsername')) groups.data.push(el);
        else if (has(el, '#fullName, #nickname, #parentName, #childName')) groups.data.push(el);
        else groups.detail.push(el);
    });
    if (!groups.pay.length || !groups.send.length || !groups.data.length) return; // bentuk form beda -> biarin

    const STEPS = [
        { key: 'data', title: 'Data diri', sub: 'Biar kami tau harus nyapa siapa', els: groups.data },
        { key: 'detail', title: 'Detail', sub: 'Isi yang bakal masuk ke journal kamu', els: groups.detail },
        { key: 'pay', title: 'Bayar', sub: 'Transfer, lalu upload buktinya di sini', els: groups.pay },
        { key: 'send', title: 'Cek & kirim', sub: 'Pastikan semua udah bener', els: groups.send },
    ];

    // --- gaya (ngikut warna tema halaman lewat --primary-color / --accent-color) ---
    const css = document.createElement('style');
    css.textContent = `
.rs-progress{position:sticky;top:0;z-index:20;background:var(--paper,#fff);padding:12px 1.05rem 12px 10px;margin:0 -1.05rem 6px -10px;transition:box-shadow .15s ease}
.rs-progress.is-stuck{box-shadow:0 10px 14px -12px rgba(16,36,94,.35);border-radius:0 0 12px 12px}
.rs-progress-top{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:9px}
.rs-progress-top b{font-family:'Outfit',sans-serif;font-size:17px;font-weight:800}
.rs-progress-top span{font-size:13px;opacity:.65;font-weight:600;white-space:nowrap}
.rs-bars{display:flex;gap:6px}
.rs-bar{flex:1;height:6px;border-radius:999px;background:rgba(0,0,0,.09);overflow:hidden;border:0;padding:0;cursor:default}
.rs-bar i{display:block;height:100%;width:0;background:var(--primary-color,#000);border-radius:999px;transition:width .3s ease}
.rs-bar.done i,.rs-bar.on i{width:100%}
.rs-bar.done{cursor:pointer}
.rs-step[hidden]{display:none!important}
.rs-sub{margin:-2px 0 14px;font-size:14px;opacity:.7}
.rs-nav{display:flex;gap:10px;margin-top:18px}
.rs-nav{align-items:stretch}
.rs-nav .submit-btn{margin-top:0;min-height:56px;transform:none;box-shadow:0 6px 16px rgba(0,70,255,.22)}
.rs-nav .submit-btn::after{display:none}
.rs-nav .submit-btn:hover{transform:translateY(-1px)}
.rs-nav .submit-btn:active{transform:scale(.98)}
.rs-nav .submit-btn:disabled{transform:none;box-shadow:none}
.rs-back{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:56px;padding:0 20px;border-radius:14px;border:1.5px solid rgba(0,0,0,.15);background:transparent;color:inherit;font:inherit;font-weight:700;cursor:pointer;transition:transform .12s ease,border-color .12s ease}
.rs-back:hover{border-color:var(--primary-color,#000)}
.rs-back:active,.rs-next:active{transform:scale(.98)}
.rs-next{flex:1}
.rs-review{border:1.5px solid rgba(0,0,0,.1);border-radius:14px;padding:4px 14px;margin-bottom:16px}
.rs-review-row{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid rgba(0,0,0,.07);font-size:14.5px}
.rs-review-row:first-child{border-top:0}
.rs-review-row span{opacity:.6}
.rs-review-row b{text-align:right;word-break:break-word;font-weight:700}
.rs-edit{background:none;border:0;padding:0 0 0 8px;color:var(--accent-color,#3b82f6);font:inherit;font-size:13px;font-weight:700;cursor:pointer}
.rs-err{margin:10px 0 0;padding:10px 12px;border-radius:10px;background:#fff1f1;color:#b42318;font-size:14px;font-weight:600}
.rs-saved{font-size:12.5px;opacity:.55;margin-top:10px;text-align:center}
@media (prefers-reduced-motion:reduce){.rs-bar i{transition:none}}`;
    document.head.appendChild(css);

    // --- bangun langkah ---
    const progress = document.createElement('div');
    progress.className = 'rs-progress';
    progress.innerHTML = `<div class="rs-progress-top"><b id="rsTitle"></b><span id="rsCount"></span></div><div class="rs-bars" role="list"></div>`;
    form.insertBefore(progress, form.firstChild);
    const bars = progress.querySelector('.rs-bars');

    const submitBtn = document.getElementById('submitBtn');
    STEPS.forEach((st, i) => {
        const box = document.createElement('div');
        box.className = 'rs-step'; box.dataset.step = st.key; box.hidden = true;
        box.innerHTML = `<p class="rs-sub">${st.sub}</p>`;
        if (st.key === 'send') box.insertAdjacentHTML('beforeend', `<div class="rs-review" id="rsReview"></div>`);
        st.els.forEach(el => box.appendChild(el));
        // urutan di langkah Data diri: nama dulu, baru kontak
        const nav = document.createElement('div');
        nav.className = 'rs-nav';
        if (i > 0) nav.innerHTML = `<button type="button" class="rs-back" data-rs="back" aria-label="Kembali">&larr; Kembali</button>`;
        if (st.key !== 'send') nav.insertAdjacentHTML('beforeend', `<button type="button" class="submit-btn rs-next" data-rs="next"><span>Lanjut</span> &rarr;</button>`);
        else if (submitBtn) { submitBtn.classList.add('rs-next'); nav.appendChild(submitBtn); }
        box.appendChild(nav);
        if (st.key !== 'send') box.insertAdjacentHTML('beforeend', `<div class="rs-err" hidden></div>`);
        st.box = box;
        form.appendChild(box);
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'rs-bar'; b.dataset.i = i; b.setAttribute('role', 'listitem');
        b.innerHTML = '<i></i>'; b.title = st.title;
        bars.appendChild(b);
        st.bar = b;
    });
    if (document.getElementById('statusMessage')) STEPS[3].box.insertBefore(document.getElementById('statusMessage'), STEPS[3].box.querySelector('.rs-nav'));

    // langkah Detail kosong / semua bloknya disembunyiin config -> dilewatin
    const isShown = el => el.style.display !== 'none' && !el.hidden && getComputedStyle(el).display !== 'none';
    const active = () => STEPS.filter(st => st.key !== 'detail' || st.els.some(isShown));

    // --- validasi per langkah (pesan ramah, bukan alert) ---
    function fileFilled(group) {
        const inp = group.querySelector('input[type="file"]');
        if (inp && inp.files && inp.files.length) return true;
        const img = group.querySelector('img.preview-img, img[id$="Preview"]');
        const src = img && img.getAttribute('src');
        return !!(src && src !== '#' && !/^(about:blank)?$/.test(src));
    }
    function labelOf(el) {
        const g = el.closest('.form-group');
        const l = g && g.querySelector('label');
        return (l ? l.textContent : el.placeholder || el.name || '').trim();
    }
    function check(st) {
        const missing = [];
        st.els.filter(isShown).forEach(blk => {
            blk.querySelectorAll('input, select, textarea').forEach(inp => {
                if (inp.type === 'hidden' || inp.disabled || !isShown(inp.closest('.form-group') || inp)) return;
                if (inp.type === 'file') {
                    const g = inp.closest('.form-group') || blk;
                    if ((inp.required || inp.id === 'paymentPhoto') && !fileFilled(g)) missing.push(labelOf(inp) || 'Foto');
                } else if (inp.required && !String(inp.value || '').trim()) missing.push(labelOf(inp));
            });
        });
        if (st.key === 'data') {
            const wa = document.getElementById('whatsapp');
            if (wa && wa.value.trim() && wa.value.replace(/\D/g, '').length < 9) return ['Nomor WhatsApp kayaknya kurang digit'];
        }
        return missing;
    }

    // --- ringkasan buat langkah terakhir ---
    function renderReview() {
        const rows = [];
        const add = (label, val, step) => { if (val) rows.push(`<div class="rs-review-row"><span>${esc(label)}</span><b>${esc(val)}${step == null ? "" : `<button type="button" class="rs-edit" data-rs-go="${step}">Ubah</button>`}</b></div>`); };
        STEPS.slice(0, 3).forEach((st, si) => {
            if (!active().includes(st)) return;
            st.els.filter(isShown).forEach(blk => blk.querySelectorAll('input[type="text"], input[type="tel"], input:not([type]), select, textarea').forEach(inp => {
                if (inp.offsetParent === null && !st.box.hidden) return;
                add(labelOf(inp), String(inp.value || '').trim(), si);
            }));
            st.els.forEach(blk => blk.querySelectorAll('input[type="file"]').forEach(inp => {
                const g = inp.closest('.form-group'); if (!g || !isShown(g)) return;
                add(labelOf(inp), fileFilled(g) ? 'Udah diupload ✓' : '', si);
            }));
        });
        const amt = document.getElementById('paymentAmount');
        if (amt && amt.textContent.trim()) add('Total transfer', amt.textContent.trim(), null); // harga dari sistem, bukan isian
        document.getElementById('rsReview').innerHTML = rows.join('') || '<div class="rs-review-row"><span>Siap dikirim</span></div>';
    }
    function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

    // --- navigasi ---
    let cur = 0;
    function show(idx, scroll) {
        const list = active();
        idx = Math.max(0, Math.min(list.length - 1, idx));
        cur = idx;
        STEPS.forEach(st => { st.box.hidden = st !== list[idx]; st.bar.hidden = !list.includes(st); });
        list.forEach((st, i) => { st.bar.classList.toggle('done', i < idx); st.bar.classList.toggle('on', i === idx); });
        document.getElementById('rsTitle').textContent = list[idx].title;
        document.getElementById('rsCount').textContent = `Langkah ${idx + 1} dari ${list.length}`;
        if (list[idx].key === 'send') renderReview();
        try { sessionStorage.setItem(DRAFT_KEY + ':step', list[idx].key); } catch (e) { }
        if (scroll) {
            const top = form.getBoundingClientRect().top + window.scrollY - 12;
            if (window.scrollY > top || form.getBoundingClientRect().top < 0) window.scrollTo({ top, behavior: 'smooth' });
        }
        const first = list[idx].box.querySelector('input:not([type="hidden"]):not([type="file"]):not([type="checkbox"])');
        if (first && scroll && !first.value && window.matchMedia('(min-width: 700px)').matches) first.focus({ preventScroll: true });
    }
    function next() {
        const list = active(), st = list[cur];
        const errBox = st.box.querySelector('.rs-err');
        const miss = check(st);
        if (miss.length) {
            errBox.hidden = false;
            errBox.textContent = miss.length === 1 && /kurang digit/.test(miss[0]) ? miss[0] + ' -- cek lagi ya.' : 'Belum diisi: ' + miss.join(', ');
            return;
        }
        errBox.hidden = true;
        show(cur + 1, true);
    }
    form.addEventListener('click', (e) => {
        const b = e.target.closest('[data-rs]');
        if (b) { e.preventDefault(); if (b.dataset.rs === 'next') next(); else show(cur - 1, true); return; }
        const g = e.target.closest('[data-rs-go]');
        if (g) { e.preventDefault(); const st = STEPS[+g.dataset.rsGo]; show(active().indexOf(st), true); return; }
        const bar = e.target.closest('.rs-bar');
        if (bar && bar.classList.contains('done')) show(active().indexOf(STEPS[+bar.dataset.i]), true);
    });
    // Enter di tengah langkah = Lanjut (jangan langsung submit seluruh form)
    document.addEventListener('submit', (e) => {
        if (e.target !== form) return;
        if (active()[cur].key !== 'send') { e.preventDefault(); e.stopImmediatePropagation(); next(); return; }
        try { Object.keys(sessionStorage).filter(k => k.startsWith(DRAFT_KEY)).forEach(k => sessionStorage.removeItem(k)); } catch (err) { }
    }, true);
    form.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || e.isComposing || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON') return;
        if (!e.target.closest('.rs-step') || active()[cur].key === 'send') return;
        e.preventDefault(); next();
    });
    form.addEventListener('input', (e) => { const eb = e.target.closest('.rs-step') && e.target.closest('.rs-step').querySelector('.rs-err'); if (eb) eb.hidden = true; });

    // --- draft teks (bukan foto) biar nggak ilang pas pindah ke app bank ---
    const TEXT_SEL = 'input[type="text"], input[type="tel"], input[type="email"], input:not([type]), textarea';
    function saveDraft() {
        const d = {};
        form.querySelectorAll(TEXT_SEL).forEach(i => { if (i.id && i.value) d[i.id] = i.value; });
        const c = form.querySelector('input[name="consentCheck"]'); if (c) d.__consent = c.checked;
        try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch (e) { }
    }
    let saveT; form.addEventListener('input', () => { clearTimeout(saveT); saveT = setTimeout(saveDraft, 300); });
    form.addEventListener('change', saveDraft);
    let restored = false;
    try {
        const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || '{}');
        Object.keys(d).forEach(id => {
            if (id === '__consent') { const c = form.querySelector('input[name="consentCheck"]'); if (c) c.checked = !!d[id]; return; }
            const el = document.getElementById(id);
            if (el && !el.value) { el.value = d[id]; restored = true; }
        });
    } catch (e) { }

    // mulai: lanjutin langkah terakhir kalau ada draft (tapi bukan Bayar/Kirim -- foto bukti nggak kesimpen)
    let startKey = 'data';
    try { startKey = sessionStorage.getItem(DRAFT_KEY + ':step') || 'data'; } catch (e) { }
    if (startKey === 'send' || !restored) startKey = restored ? 'pay' : 'data';
    const det = STEPS[1];
    if (restored && active().includes(det) && det.els.some(b => b.querySelector('input[type="file"]')) && startKey !== 'data') startKey = 'detail'; // foto nggak ikut kesimpen
    show(Math.max(0, active().findIndex(st => st.key === startKey)), false);
    if (restored) {
        const note = document.createElement('p');
        note.className = 'rs-saved';
        note.textContent = 'Isianmu tadi udah dipulihin.';
        progress.after(note);
        setTimeout(() => note.remove(), 6000);
    }
    // bayangan tipis pas header langkah nempel di atas (biar kebaca kepisah dari isi)
    const stuck = () => progress.classList.toggle('is-stuck', progress.getBoundingClientRect().top <= 1 && form.getBoundingClientRect().top < 0);
    window.addEventListener('scroll', stuck, { passive: true }); stuck();
    // config workshop datang belakangan (mis. section foto baru dimunculin) -> hitung ulang jumlah langkah
    window.addEventListener('workshops:updated', () => setTimeout(() => show(Math.min(cur, active().length - 1), false), 0));
})();
