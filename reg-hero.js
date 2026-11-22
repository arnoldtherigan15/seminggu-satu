// =========================================================================
//  reg-hero.js -- judul & deskripsi di sampul halaman pendaftaran DIBACA DARI
//  CONFIG (sama kayak kartu di Home), bukan teks yang ketulis mati di HTML.
//
//  Urutan sumber (persis Home): deskripsi batch yang lagi dipilih (udah
//  di-merge server: override batch > Config) -> deskripsi Config tipe event.
//  Judul = nama di Config. Teks bawaan HTML cuma jadi cadangan kalau config
//  belum/ gagal kebaca.
// =========================================================================
(function () {
    const seg = location.pathname.split('/').filter(Boolean);
    const ID = seg[seg.length - 1] === 'index.html' || /\.html$/.test(seg[seg.length - 1] || '') ? seg[seg.length - 2] : seg[seg.length - 1];
    if (!ID) return;

    function selectedBatch() {
        try {
            // variabel global punya main.js tiap halaman (let di script biasa = global lexical)
            // eslint-disable-next-line no-undef
            if (typeof _openBatches !== 'undefined' && Array.isArray(_openBatches) && _openBatches.length) {
                // eslint-disable-next-line no-undef
                const sel = typeof _selectedBatchId !== 'undefined' ? _selectedBatchId : null;
                // eslint-disable-next-line no-undef
                return _openBatches.find(b => b.id === sel) || null;
            }
        } catch (e) { }
        return null;
    }

    let last = '';
    function apply() {
        const ws = typeof getWorkshopById === 'function' ? getWorkshopById(ID) : null;
        const batch = selectedBatch();
        const name = (ws && ws.name) || '';
        const desc = (batch && batch.description) || (ws && ws.description) || '';
        const key = name + '|' + desc;
        if (key === last) return;
        last = key;
        const h = document.querySelector('.hero .hero-content h2') || document.querySelector('.hero h2');
        if (h && name) {
            if (h.dataset.orig === undefined) h.dataset.orig = h.textContent;
            const bang = /!\s*$/.test(h.dataset.orig) && !/[!?.]\s*$/.test(name);
            h.textContent = name + (bang ? '!' : '');
        }
        const p = document.querySelector('.hero .subtitle');
        if (p && desc) p.textContent = desc;
    }

    function start() {
        apply();
        window.addEventListener('workshops:updated', () => setTimeout(apply, 0));
        // ganti batch di picker / data batch baru masuk -> deskripsinya ikut
        ['batchPicker', 'jdBatchPicker'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                new MutationObserver(() => setTimeout(apply, 0)).observe(el, { childList: true, subtree: true, attributes: true });
                el.addEventListener('click', () => setTimeout(apply, 50));
            }
        });
        // data batch datangnya async dari main.js -> cek berkala sebentar di awal
        let n = 0;
        const t = setInterval(() => { apply(); if (++n > 40 || selectedBatch()) { apply(); clearInterval(t); } }, 300);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
