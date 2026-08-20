// Port dari handleAdmin() -- 1 router buat semua aksi admin dashboard
// (admin/index.html), sama pola kayak Google_Script_Code.js: 1 action = 1
// case, requireAdminAuth di awal tiap action yang butuh login (semua KECUALI
// "login" sendiri).
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { waKey } from "../_shared/auth.ts";
import { uploadBase64 } from "../_shared/storage.ts";
import { getConfigValue, setConfigValue } from "../_shared/config.ts";
import { adminLogin, requireAdminAuth } from "../_shared/admin-auth.ts";
import { loyaltyMembers, questPointsMap, extraPointsMap, memberNickMap } from "../_shared/queries.ts";
import { callGemini } from "../_shared/gemini.ts";
import { mergeBatchConfig, currentPrice } from "../_shared/batch-merge.ts";

const WORKSHOP_TYPES = ["3d-frame-journaling", "paper-journal", "upcycle-journal", "bookmark-journal", "reka-rekat", "journaling-date", "side-by-side"];
const PREP_TYPES = ["todos", "bring", "notes", "supplies", "richnote"];
const prepKey = (event: string, type: string) => `prep__${event}__${type}`;
// Konteks FAQ per BATCH (bukan per workshop kayak prepKey lainnya) --
// venue/rute/bawaan beda tiap batch/volume event yang sama.
const prepFaqKey = (event: string, batchId: string) => `prep__${event}__faqcontext__${batchId || "general"}`;
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());

// Admin ngetik tanggal event manual via prompt() di dashboard, format yang
// dicontohin ("11 Juli 2026") pake nama bulan BAHASA INDONESIA -- Postgres cuma
// ngerti nama bulan Inggris, jadi kalau langsung di-insert ke kolom `date`
// (mis. "11 Oktober 2026") DB-nya nolak. Dulu error ini nggak ketangkep sama
// sekali (insert()/update() nggak dicek errornya) jadi APInya bilang "sukses"
// padahal batch-nya nggak pernah kesimpen -- parser ini nerjemahin bulan
// Indonesia -> ISO (YYYY-MM-DD) dulu sebelum nyampe ke DB.
const ID_MONTHS: Record<string, number> = {
  januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
  juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12,
};
function parseIdDate(input: string): string | null {
  const s = String(input || "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; // udah ISO
  const m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/); // "11 Juli 2026"
  if (m) {
    const month = ID_MONTHS[m[2].toLowerCase()];
    if (month) {
      const dd = String(parseInt(m[1], 10)).padStart(2, "0");
      const mm = String(month).padStart(2, "0");
      return `${m[3]}-${mm}-${dd}`;
    }
  }
  return null; // format nggak dikenal -- biar caller yang mutusin
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const data = await req.json();
    const action = String(data.action || "");
    const admin = supabaseAdmin();

    if (action === "login") {
      const result = await adminLogin(admin, String(data.password || ""));
      if ("error" in result) return errorResponse(result.error);
      return jsonResponse({ status: "success", token: result.token });
    }

    // Semua action lain butuh sesi admin valid
    await requireAdminAuth(admin, String(data.token || ""));

    switch (action) {
      case "getRegistrations": {
        const workshop = String(data.workshop || "");
        if (!WORKSHOP_TYPES.includes(workshop)) return errorResponse("Workshop tidak dikenal: " + workshop);
        let batchId = data.batchId;
        if (!batchId) {
          const { data: b } = await admin.from("batches").select("id").eq("workshop_type", workshop).eq("active", true).maybeSingle();
          batchId = b?.id;
        }
        let q = admin.from("registrations").select("*").eq("workshop_type", workshop).order("created_at", { ascending: false });
        if (batchId) q = q.eq("batch_id", batchId);
        const { data: rows } = await q;
        return jsonResponse({ status: "success", workshop, batchId: batchId || null, items: rows || [], total: (rows || []).length });
      }

      case "deleteRegistration": {
        const id = String(data.id || "");
        if (!id) return errorResponse("ID peserta kosong.");
        const { data: reg } = await admin.from("registrations").select("payment_proof_url, extra").eq("id", id).maybeSingle();

        // Best-effort: bersihin bukti bayar + foto karya di Storage juga --
        // jangan sampe cuma row-nya yang ilang, fotonya nyangkut selamanya.
        // payment_proof_url disimpen sebagai "bucket/path" (bucket private,
        // bukan URL publik -- lihat uploadBase64() di _shared/storage.ts),
        // sedangkan extra.photos isinya URL publik penuh.
        try {
          const byBucket: Record<string, string[]> = {};
          const addRef = (u: string) => {
            if (!u) return;
            let bucket = "", path = "";
            const m = u.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
            if (m) { bucket = m[1]; path = decodeURIComponent(m[2]); }
            else if (!/^https?:\/\//.test(u) && u.indexOf("/") > 0) { const i = u.indexOf("/"); bucket = u.slice(0, i); path = u.slice(i + 1); }
            if (!bucket || !path) return;
            if (!byBucket[bucket]) byBucket[bucket] = [];
            byBucket[bucket].push(path);
          };
          addRef(reg?.payment_proof_url || "");
          const photos = (reg?.extra || {}).photos;
          if (Array.isArray(photos)) photos.forEach((p: unknown) => addRef(String(p || "")));
          for (const [bucket, paths] of Object.entries(byBucket)) {
            await admin.storage.from(bucket).remove(paths);
          }
        } catch (_e) { /* abaikan, tetep lanjut hapus row-nya */ }

        const { error } = await admin.from("registrations").delete().eq("id", id);
        if (error) return errorResponse("Peserta tidak ditemukan.");
        return jsonResponse({ status: "success", message: "Peserta & fotonya dihapus." });
      }

      case "getSummary": {
        const { data: activeBatches } = await admin.from("batches").select("id, workshop_type").eq("active", true);
        const summary: Record<string, number> = {};
        for (const id of WORKSHOP_TYPES) summary[id] = 0;
        // Sekarang DIJUMLAH dari semua batch aktif tipe itu (bisa lebih dari 1
        // buka bareng), bukan ketimpa jadi cuma nunjukin 1 batch doang.
        for (const b of activeBatches || []) {
          const { count } = await admin.from("registrations").select("id", { count: "exact", head: true }).eq("batch_id", b.id);
          summary[b.workshop_type] = (summary[b.workshop_type] || 0) + (count ?? 0);
        }
        return jsonResponse({ status: "success", summary });
      }

      case "getLoyalty": {
        const members = await loyaltyMembers(admin);
        return jsonResponse({ status: "success", members });
      }

      case "getOverview": {
        const { data: activeBatches } = await admin.from("batches").select("*").eq("active", true);
        let cfg: Record<string, unknown>[] = [];
        try { cfg = JSON.parse((await getConfigValue(admin, "WORKSHOPS_JSON")) || "[]"); } catch (_e) { /* abaikan */ }
        const cfgByType = new Map(cfg.map((w) => [String(w.id || ""), w]));

        const summary: Record<string, number> = {};
        for (const id of WORKSHOP_TYPES) summary[id] = 0;
        // openBatches: 1 entri per batch yang lagi buka (bukan per tipe) --
        // ini yang dipake Overview buat render 1 card per batch, biar batch
        // yang buka bareng (mis. Vol 6 & Vol 7) kelihatan sebagai 2 card
        // terpisah dengan data masing-masing, bukan ketumpuk jadi 1 angka.
        const openBatches: Record<string, unknown>[] = [];
        for (const b of activeBatches || []) {
          const { count } = await admin.from("registrations").select("id", { count: "exact", head: true }).eq("batch_id", b.id);
          summary[b.workshop_type] = (summary[b.workshop_type] || 0) + (count ?? 0);
          const typeConfig = cfgByType.get(b.workshop_type) || {};
          const merged = mergeBatchConfig(b, typeConfig);
          openBatches.push({
            workshopType: b.workshop_type,
            workshopName: (typeConfig as Record<string, unknown>).name || b.workshop_type,
            batchId: b.id, label: merged.label, count: count ?? 0,
            maxQuota: merged.maxQuota, eventDateIso: merged.eventDateIso, displayDate: merged.displayDate,
            workshopTime: merged.workshopTime, locationName: merged.locationName,
            currentPrice: currentPrice(merged, count ?? 0),
          });
        }
        const members = await loyaltyMembers(admin);
        const { data: costs } = await admin.from("workshop_costs").select("*");
        const modal: Record<string, Record<string, { nama: string; biaya: number; tipe: string }[]>> = {};
        for (const c of costs || []) {
          (modal[c.workshop_type] ||= {})[c.batch] ||= [];
          modal[c.workshop_type][c.batch].push({ nama: c.name, biaya: Number(c.amount) || 0, tipe: c.kind === "tetap" ? "tetap" : "per-peserta" });
        }
        let ideas: unknown[] = [];
        try { ideas = JSON.parse((await getConfigValue(admin, "IDEAS_JSON")) || "[]"); } catch (_e) { /* abaikan */ }
        // activeSheets: dipertahankan buat back-compat (siapa tau ada consumer
        // lama) -- sekarang cuma nunjukin SATU batch (yang pertama ketemu)
        // per tipe kalau ada lebih dari 1 aktif; `openBatches` di atas adalah
        // sumber data yang lengkap/akurat buat tipe yang punya 2+ batch buka.
        const activeSheets: Record<string, string> = {};
        for (const b of activeBatches || []) if (!activeSheets[b.workshop_type]) activeSheets[b.workshop_type] = b.id;
        return jsonResponse({ status: "success", summary, modal, ideas, members, activeSheets, openBatches });
      }

      case "claimReward": {
        const key = String(data.key || "");
        if (!key) return errorResponse("key kosong.");
        const dir = Number(data.dir) < 0 ? -1 : 1;
        const total = Number(data.total) || 0;
        const LOYALTY_TARGET = 6;
        let claims: Record<string, number> = {};
        try { claims = JSON.parse((await getConfigValue(admin, "LOYALTY_CLAIMS_JSON")) || "{}"); } catch (_e) { /* abaikan */ }
        let claimed = Number(claims[key]) || 0;
        if (dir > 0) {
          if ((claimed + 1) * LOYALTY_TARGET > total) return errorResponse("Stamp belum cukup untuk ditukar.");
          claimed += 1;
        } else claimed = Math.max(0, claimed - 1);
        claims[key] = claimed;
        await setConfigValue(admin, "LOYALTY_CLAIMS_JSON", JSON.stringify(claims));
        return jsonResponse({ status: "success", message: "OK" });
      }

      case "saveLoyaltyNotes": {
        const key = String(data.key || "");
        if (!key) return errorResponse("key kosong.");
        const notes = Array.isArray(data.notes) ? data.notes.map((s: unknown) => String(s || "")).filter((s: string) => s.trim()) : [];
        let notesMap: Record<string, string[]> = {};
        try { notesMap = JSON.parse((await getConfigValue(admin, "LOYALTY_NOTES_JSON")) || "{}"); } catch (_e) { /* abaikan */ }
        notesMap[key] = notes;
        await setConfigValue(admin, "LOYALTY_NOTES_JSON", JSON.stringify(notesMap));
        return jsonResponse({ status: "success", message: "Catatan tersimpan." });
      }

      case "listBatches": {
        const workshop = String(data.workshop || "");
        const { data: rows } = await admin.from("batches").select("*").eq("workshop_type", workshop).order("created_at", { ascending: false });
        const batches = [];
        for (const b of rows || []) {
          const { count } = await admin.from("registrations").select("id", { count: "exact", head: true }).eq("batch_id", b.id);
          batches.push({
            id: b.id, label: b.label || "", active: !!b.active, eventDate: b.event_date || "", count: count ?? 0,
            locationName: b.location_name || "", mapsLink: b.maps_link || "",
            workshopTime: b.workshop_time || "", whatsappGroupLink: b.whatsapp_group_link || "",
            workshopDate: b.workshop_date || "",
            normalPrice: b.normal_price, earlyBirdPrice: b.early_bird_price,
            earlyBirdDueDate: b.early_bird_due_date || "", earlyBirdMaxCount: b.early_bird_max_count,
            maxQuota: b.max_quota, openDate: b.open_date || "", closeDate: b.close_date || "",
          });
        }
        return jsonResponse({ status: "success", workshop, batches });
      }

      case "newBatch": {
        const workshop = String(data.workshop || "");
        if (!WORKSHOP_TYPES.includes(workshop)) return errorResponse("Workshop tidak dikenal: " + workshop);
        const label = String(data.label || "").trim();
        if (!label) return errorResponse("Label batch wajib diisi.");
        let eventDate: string | null = null;
        if (data.eventDate) {
          eventDate = parseIdDate(data.eventDate);
          if (!eventDate) return errorResponse(`Format tanggal "${data.eventDate}" nggak dikenali. Coba format "11 Juli 2026" atau "2026-07-11".`);
        }
        // Batch baru SELALU jadi aktif (buka), batch lain DIBIARIN apa adanya
        // -- bikin batch baru itu keputusan "buka sesi baru", bukan "ganti
        // satu-satunya sesi yang buka". Mau nutup batch lain? itu tindakan
        // terpisah lewat setActiveBatch, bukan efek samping di sini.
        //
        // Warisan data: batch baru nyontek 12 field override dari batch
        // TERBARU (created_at DESC) tipe ini, termasuk yang masih null (null
        // tetep null -- kalau batch sebelumnya ikut Config di suatu field,
        // batch baru juga tetep ikut Config, BUKAN dibekukan ke nilai Config
        // saat ini). Jadi Arnold cuma pernah nyentuh field yang emang udah
        // pernah menyimpang di riwayat batch tipe ini.
        const { data: prevBatch } = await admin.from("batches").select("*")
          .eq("workshop_type", workshop).order("created_at", { ascending: false }).limit(1).maybeSingle();
        const inherited = prevBatch ? {
          location_name: prevBatch.location_name, maps_link: prevBatch.maps_link,
          workshop_time: prevBatch.workshop_time, whatsapp_group_link: prevBatch.whatsapp_group_link,
          normal_price: prevBatch.normal_price, early_bird_price: prevBatch.early_bird_price,
          early_bird_due_date: prevBatch.early_bird_due_date, early_bird_max_count: prevBatch.early_bird_max_count,
          max_quota: prevBatch.max_quota, open_date: prevBatch.open_date, close_date: prevBatch.close_date,
          workshop_date: prevBatch.workshop_date,
        } : {};
        const { error: insErr } = await admin.from("batches").insert({
          workshop_type: workshop, label, active: true, event_date: eventDate, ...inherited,
        });
        if (insErr) return errorResponse("Gagal bikin batch baru: " + insErr.message);
        return jsonResponse({ status: "success", message: `Batch baru '${label}' dibuat & jadi aktif.` });
      }

      case "setActiveBatch": {
        const batchId = String(data.batchId || "");
        if (!batchId) return errorResponse("Batch wajib dipilih.");
        // Toggle per-baris murni -- nggak lagi matiin batch lain otomatis,
        // jadi bisa ada 0..N batch `active` bersamaan per tipe workshop.
        const open = data.open != null ? !!data.open : true;
        const { error } = await admin.from("batches").update({ active: open }).eq("id", batchId);
        if (error) return errorResponse("Batch tidak ditemukan.");
        return jsonResponse({ status: "success", message: open ? "Batch dibuka." : "Batch ditutup." });
      }

      case "renameBatch": {
        const batchId = String(data.batchId || "");
        if (!batchId) return errorResponse("Batch belum dipilih.");
        // deno-lint-ignore no-explicit-any
        const patch: Record<string, any> = {};
        if (data.label != null && String(data.label).trim() !== "") patch.label = String(data.label).trim();
        if (data.eventDate != null) {
          const raw = String(data.eventDate).trim();
          if (!raw) patch.event_date = null;
          else {
            const parsed = parseIdDate(raw);
            if (!parsed) return errorResponse(`Format tanggal "${raw}" nggak dikenali. Coba format "11 Juli 2026" atau "2026-07-11".`);
            patch.event_date = parsed;
          }
        }
        // Field-field ini override opsional PER BATCH (kosong = balik ikut
        // Config workshop) -- buat batch yang harga/kuota/jadwal/venue-nya
        // beda dari batch lain tipe yang sama.
        if (data.locationName != null) patch.location_name = String(data.locationName).trim() || null;
        if (data.mapsLink != null) patch.maps_link = String(data.mapsLink).trim() || null;
        if (data.workshopTime != null) patch.workshop_time = String(data.workshopTime).trim() || null;
        if (data.whatsappGroupLink != null) patch.whatsapp_group_link = String(data.whatsappGroupLink).trim() || null;
        if (data.workshopDate != null) patch.workshop_date = String(data.workshopDate).trim() || null;
        if (data.normalPrice != null) {
          const raw = String(data.normalPrice).trim();
          patch.normal_price = raw ? Number(raw) : null;
        }
        if (data.earlyBirdPrice != null) {
          const raw = String(data.earlyBirdPrice).trim();
          patch.early_bird_price = raw ? Number(raw) : null;
        }
        if (data.earlyBirdMaxCount != null) {
          const raw = String(data.earlyBirdMaxCount).trim();
          patch.early_bird_max_count = raw ? Number(raw) : null;
        }
        if (data.maxQuota != null) {
          const raw = String(data.maxQuota).trim();
          patch.max_quota = raw ? Number(raw) : null;
        }
        for (const [key, col] of [["earlyBirdDueDate", "early_bird_due_date"], ["openDate", "open_date"], ["closeDate", "close_date"]] as const) {
          if (data[key] == null) continue;
          const raw = String(data[key]).trim();
          if (!raw) { patch[col] = null; continue; }
          const parsed = parseIdDate(raw);
          if (!parsed) return errorResponse(`Format tanggal "${raw}" nggak dikenali. Coba format "11 Juli 2026" atau "2026-07-11".`);
          patch[col] = parsed;
        }
        if (!Object.keys(patch).length) return errorResponse("Nggak ada yang diubah.");
        const { error } = await admin.from("batches").update(patch).eq("id", batchId);
        if (error) return errorResponse("Gagal menyimpan perubahan: " + error.message);
        return jsonResponse({ status: "success", message: "Batch diperbarui." });
      }

      case "getChallenges": {
        const { data: rows } = await admin.from("challenges").select("*").order("created_at", { ascending: false });
        return jsonResponse({ status: "success", challenges: rows || [] });
      }

      case "generateChallengeIdea": {
        const existingTitles = Array.isArray(data.existingTitles)
          // deno-lint-ignore no-explicit-any
          ? data.existingTitles.map((t: any) => String(t || "")).filter(Boolean)
          : [];

        const geminiKey = Deno.env.get("GEMINI_API_KEY");
        if (!geminiKey) return errorResponse("GEMINI_API_KEY belum diset di server.");

        const prompt = `Kamu bantu bikinin ide "Challenge" baru buat komunitas journaling "Seminggu Satu" -- member ngerjain challenge ini di journal pribadi mereka (bikin spread/halaman sesuai tema), difoto, di-post buat dapet poin.

Challenge yang UDAH ADA (JANGAN bikin ide yang mirip/sama):
${existingTitles.length ? existingTitles.map((t) => `- ${t}`).join("\n") : "(belum ada challenge lain)"}

Bikin SATU ide challenge baru yang seru & gampang dikerjain siapa aja (nggak butuh skill gambar/seni khusus), temanya seputar journaling/refleksi diri/kreativitas sehari-hari -- fokus ke ekspresi diri & having fun, BUKAN kompetisi/perbandingan sama orang lain.

Kasih:
- title: judul singkat & catchy (2-5 kata)
- theme: label tema pendek buat badge kecil, boleh tambahin 1 emoji relevan di akhir (mis. "Movie Night 🎬")
- description: instruksi 1-2 kalimat, jelas apa yang perlu dikerjain, nada ramah & ngajak (bukan perintah kaku)
- points: saran poin (angka bulat 5-20, makin butuh effort/waktu ngerjain makin tinggi)`;

        const schema = {
          type: "OBJECT",
          properties: {
            title: { type: "STRING" },
            theme: { type: "STRING" },
            description: { type: "STRING" },
            points: { type: "NUMBER" },
          },
          required: ["title", "theme", "description", "points"],
        };

        const result = await callGemini(geminiKey, prompt, { responseSchema: schema, temperature: 1.1 });
        if (!result.ok) return errorResponse("Gagal generate ide: " + result.error);
        let idea: { title?: string; theme?: string; description?: string; points?: number };
        try {
          idea = JSON.parse(result.text || "");
        } catch {
          return errorResponse("Gagal baca hasil dari AI.");
        }
        return jsonResponse({ status: "success", idea });
      }

      case "saveChallenge": {
        const title = String(data.title || "").trim();
        if (!title) return errorResponse("Judul challenge wajib diisi.");
        const theme = String(data.theme || "").trim();
        const description = String(data.description || "").trim();
        const points = Number(data.points) || 10;
        const active = data.active === true || data.active === "true" || data.active === "on";
        let image = String(data.image || "");
        if (data.imageBase64) {
          const uploaded = await uploadBase64(admin, "quest-photos", data.imageBase64, `challenge-${title}`);
          if (uploaded) image = uploaded;
        }
        const id = String(data.id || "").trim();
        if (id) {
          const { data: existing } = await admin.from("challenges").select("image").eq("id", id).maybeSingle();
          if (!existing) return errorResponse("Challenge tidak ditemukan.");
          await admin.from("challenges").update({ title, theme, description, image: image || existing.image, points, active }).eq("id", id);
          return jsonResponse({ status: "success", message: "Challenge diperbarui." });
        }
        const newId = "q" + Date.now().toString(36);
        await admin.from("challenges").insert({ id: newId, title, theme, description, image, points, active });
        return jsonResponse({ status: "success", message: `Challenge '${title}' ditambahkan.` });
      }

      case "deleteChallenge": {
        const id = String(data.id || "");
        if (!id) return errorResponse("ID kosong.");
        const { error } = await admin.from("challenges").delete().eq("id", id);
        if (error) return errorResponse("Challenge tidak ditemukan.");
        return jsonResponse({ status: "success", message: "Challenge dihapus." });
      }

      case "getEventPhotos": {
        const { data: rows } = await admin.from("event_photos").select("*").order("created_at", { ascending: false });
        const photos = (rows || []).map((r) => ({ id: r.id, tag: r.tag || "workshop", photo: r.photo_url, caption: r.caption || "", ts: r.created_at ? new Date(r.created_at).getTime() : 0, eventDate: r.event_date || "" }));
        return jsonResponse({ status: "success", photos });
      }

      case "addEventPhoto": {
        const rawTag = String(data.tag || "");
        const tag = rawTag === "reka-rekat" || rawTag === "temu-warga" ? rawTag : "workshop";
        if (!data.photoBase64) return errorResponse("Fotonya belum dipilih.");
        const photoUrl = await uploadBase64(admin, "event-photos", data.photoBase64, `event-${tag}`);
        if (!photoUrl) return errorResponse("Gagal upload foto.");
        const id = "ev" + Date.now().toString(36);
        await admin.from("event_photos").insert({
          id, tag, photo_url: photoUrl, caption: String(data.caption || "").slice(0, 280),
          event_date: String(data.eventDate || "").slice(0, 10) || null,
        });
        return jsonResponse({ status: "success", message: "Foto event ditambahkan ke galeri." });
      }

      case "deleteEventPhoto": {
        const id = String(data.id || "");
        if (!id) return errorResponse("ID kosong.");
        const { error } = await admin.from("event_photos").delete().eq("id", id);
        if (error) return errorResponse("Foto tidak ditemukan.");
        return jsonResponse({ status: "success", message: "Foto dihapus." });
      }

      case "getLeaderboard": {
        const members = await loyaltyMembers(admin);
        const qp = await questPointsMap(admin);
        const ep = await extraPointsMap(admin);
        const nickMap = await memberNickMap(admin);
        const scored = members
          .map((m) => ({ key: m.key, nickname: nickMap[m.key] || m.nickname || m.fullName || "Sahabat", events: m.count, quests: m.questCount, poin: (qp[m.key] || 0) + (ep[m.key] || 0) }))
          .filter((x) => x.poin > 0)
          .sort((a, b) => b.poin - a.poin || b.events - a.events);
        const top = scored.slice(0, 50).map((x, i) => ({ rank: i + 1, nickname: x.nickname, poin: x.poin, events: x.events, quests: x.quests }));
        return jsonResponse({ status: "success", leaderboard: { top } });
      }

      case "getActivity": {
        // deno-lint-ignore no-explicit-any
        const acts: any[] = [];
        let nameMap: Record<string, string> = {};
        try {
          const cfg = JSON.parse((await getConfigValue(admin, "WORKSHOPS_JSON")) || "[]");
          for (const w of cfg) if (w?.id) nameMap[w.id] = w.name;
        } catch (_e) { /* abaikan */ }

        // Rentang WAKTU (bukan limit jumlah baris) -- biar perbandingan antar
        // workshop/challenge adil buat statistik & grafik di admin. Limit
        // jumlah bikin workshop yang lagi rame "makan jatah" workshop laen.
        const ACT_WINDOW_DAYS = 30;
        const actCutoff = new Date(Date.now() - ACT_WINDOW_DAYS * 86400000).toISOString();

        const { data: regs } = await admin.from("registrations").select("full_name, nickname, workshop_type, created_at").gte("created_at", actCutoff).order("created_at", { ascending: false }).limit(200);
        for (const r of regs || []) acts.push({ type: "daftar", who: r.nickname || r.full_name || "Peserta", detail: nameMap[r.workshop_type] || r.workshop_type, workshopType: r.workshop_type, ts: r.created_at ? new Date(r.created_at).getTime() : 0 });

        const { data: challenges } = await admin.from("challenges").select("id, title");
        const chalTitle: Record<string, string> = {};
        for (const c of challenges || []) chalTitle[c.id] = c.title;
        const { data: qs } = await admin.from("quest_submissions").select("nickname, challenge_id, created_at").gte("created_at", actCutoff).order("created_at", { ascending: false }).limit(200);
        for (const r of qs || []) acts.push({ type: "quest", who: r.nickname || "Member", detail: chalTitle[r.challenge_id] || "Side Quest", ts: r.created_at ? new Date(r.created_at).getTime() : 0 });

        const { data: mem } = await admin.from("members").select("nickname, created_at").gte("created_at", actCutoff).order("created_at", { ascending: false }).limit(200);
        for (const r of mem || []) acts.push({ type: "member", who: r.nickname || "Warga", detail: "gabung Balai Warga", ts: r.created_at ? new Date(r.created_at).getTime() : 0 });

        acts.sort((a, b) => b.ts - a.ts);

        // Kotak Pos Warga yang belum ditindak (approve/tolak) -- ini yang
        // beneran butuh keputusan admin, beda dari activity di atas yang
        // cuma info kejadian (udah kekirim ke Telegram juga).
        const { data: pendingRows } = await admin.from("suggestions").select("id, nickname, category, message, created_at").eq("status", "open").order("created_at", { ascending: false });
        const pending = (pendingRows || []).map((r) => ({ id: r.id, who: r.nickname || "Warga", category: r.category, text: r.message, ts: r.created_at ? new Date(r.created_at).getTime() : 0 }));

        // Ultah BULAN INI -- biar keliatan di inbox tanpa perlu buka Member Hub
        // (bukan cuma hari ini -- biar ada waktu nyiapin ucapan buat yang
        // ultahnya bentar lagi, bukan pas hari-H doang).
        const nowMM = today().slice(5, 7);
        const todayDD = parseInt(today().slice(8, 10), 10);
        const bdayMonthName = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", month: "long" }).format(new Date());
        const { data: bdayRows } = await admin.from("members").select("wa, nickname, birth_date").not("birth_date", "is", null);
        const loyalForBday = await loyaltyMembers(admin);
        const igByKey: Record<string, string> = {};
        for (const m of loyalForBday) if (m.ig) igByKey[m.key] = m.ig;
        const birthdaysMonth = (bdayRows || [])
          .filter((r) => r.birth_date && String(r.birth_date).slice(5, 7) === nowMM)
          .map((r) => {
            const key = waKey(r.wa);
            const day = parseInt(String(r.birth_date).slice(8, 10), 10);
            return { wa: key, nickname: r.nickname || "Warga", ig: igByKey[key] || "", day, isToday: day === todayDD };
          })
          .sort((a, b) => a.day - b.day);

        return jsonResponse({ status: "success", activity: acts, activityWindowDays: ACT_WINDOW_DAYS, pending, birthdaysMonth, bdayMonthName });
      }

      case "getMembers": {
        const { data: accRows } = await admin.from("members").select("wa, nickname, birth_date, pass_hash, created_at, last_login");
        const accounts = (accRows || []).map((r) => ({
          wa: waKey(r.wa), nickname: r.nickname || "", birthDate: r.birth_date || "",
          active: !!r.pass_hash, createdAt: r.created_at || "", lastLogin: r.last_login || "",
        }));
        const accKeys = new Set(accounts.map((a) => a.wa));

        const loyal = await loyaltyMembers(admin);
        const igMap: Record<string, string> = {};
        const loyalByKey: Record<string, typeof loyal[number]> = {};
        for (const m of loyal) { if (m.ig) igMap[m.key] = m.ig; loyalByKey[m.key] = m; }
        for (const a of accounts) {
          (a as { ig?: string }).ig = igMap[a.wa] || "";
          const lm = loyalByKey[a.wa];
          (a as { count?: number }).count = lm?.count || 0;
          (a as { questCount?: number }).questCount = lm?.questCount || 0;
        }

        const notReg = loyal.filter((m) => !accKeys.has(m.key)).map((m) => ({ nickname: m.nickname || m.fullName || "", wa: m.wa, count: m.count, ig: m.ig || "" }));

        const now = new Date();
        const nowM = parseInt(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", month: "2-digit" }).format(now), 10);
        const monthName = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", month: "long" }).format(now);
        const birthdays = accounts
          .filter((a) => a.birthDate && parseInt(a.birthDate.slice(5, 7), 10) === nowM)
          .map((a) => ({ nickname: a.nickname, wa: a.wa, day: parseInt(a.birthDate.slice(8, 10), 10), birthDate: a.birthDate, ig: (a as { ig?: string }).ig || "" }))
          .sort((a, b) => a.day - b.day);

        return jsonResponse({
          status: "success", totalAccounts: accounts.length, totalLoyal: loyal.length, monthName,
          accounts: accounts.sort((a, b) => (a.nickname || "").localeCompare(b.nickname || "")),
          notRegistered: notReg, birthdays,
        });
      }

      case "getSuggestions": {
        const { data: rows } = await admin.from("suggestions").select("*").order("created_at", { ascending: false });
        const { data: votes } = await admin.from("suggestion_votes").select("suggestion_id");
        const voteCount: Record<string, number> = {};
        for (const v of votes || []) voteCount[v.suggestion_id] = (voteCount[v.suggestion_id] || 0) + 1;
        const items = (rows || []).map((r) => ({ id: r.id, wa: r.wa, nickname: r.nickname || "Warga", category: r.category, text: r.message, votes: voteCount[r.id] || 0, approved: r.status === "approved", ts: r.created_at ? new Date(r.created_at).getTime() : 0 }));
        return jsonResponse({ status: "success", items });
      }

      case "setSuggestionApproved": {
        const id = String(data.id || "");
        if (!id) return errorResponse("Usulan tidak ditemukan.");
        const { error } = await admin.from("suggestions").update({ status: "approved", approved_at: new Date().toISOString() }).eq("id", id);
        if (error) return errorResponse("Gagal update.", 500);
        return jsonResponse({ status: "success", message: "Usulan ditandai disetujui." });
      }

      case "deleteSuggestion": {
        const id = String(data.id || "");
        if (!id) return errorResponse("Usulan tidak ditemukan.");
        const { error } = await admin.from("suggestions").delete().eq("id", id);
        if (error) return errorResponse("Usulan tidak ditemukan.");
        return jsonResponse({ status: "success", message: "Usulan dihapus." });
      }

      case "getBarterPosts": {
        const { data: rows } = await admin.from("barter_posts").select("*").order("created_at", { ascending: false });
        const nickMap = await memberNickMap(admin);
        const items = (rows || []).map((r) => ({
          id: r.id, wa: r.wa, nickname: nickMap[waKey(r.wa)] || r.nickname || "Warga",
          text: r.item_text, photo: r.photo_url, done: r.status === "done",
          ts: r.created_at ? new Date(r.created_at).getTime() : 0,
        }));
        return jsonResponse({ status: "success", items });
      }

      case "setBarterDone": {
        const id = String(data.id || "");
        if (!id) return errorResponse("Postingan tidak ditemukan.");
        const { error } = await admin.from("barter_posts").update({ status: "done" }).eq("id", id);
        if (error) return errorResponse("Gagal update.", 500);
        return jsonResponse({ status: "success", message: "Ditandai selesai." });
      }

      case "deleteBarterPost": {
        const id = String(data.id || "");
        if (!id) return errorResponse("Postingan tidak ditemukan.");
        const { error } = await admin.from("barter_posts").delete().eq("id", id);
        if (error) return errorResponse("Postingan tidak ditemukan.");
        return jsonResponse({ status: "success", message: "Postingan ditolak/dihapus." });
      }

      case "getConfig": {
        const json = await getConfigValue(admin, "WORKSHOPS_JSON");
        let config = null;
        try { config = json ? JSON.parse(json) : null; } catch (_e) { config = null; }
        return jsonResponse({ status: "success", config });
      }

      case "saveConfig": {
        if (!Array.isArray(data.config)) return errorResponse("Format config tidak valid (harus array).");
        await setConfigValue(admin, "WORKSHOPS_JSON", JSON.stringify(data.config));
        return jsonResponse({ status: "success", message: "Config tersimpan & langsung aktif di web." });
      }

      case "getPrep": {
        const event = String(data.event || "");
        if (!WORKSHOP_TYPES.includes(event)) return errorResponse("Event tidak dikenal: " + event);
        const prep: Record<string, unknown[]> = {};
        for (const type of PREP_TYPES) {
          const json = await getConfigValue(admin, prepKey(event, type));
          try { prep[type] = json ? JSON.parse(json) : []; } catch (_e) { prep[type] = []; }
        }
        return jsonResponse({ status: "success", event, prep });
      }

      case "savePrep": {
        const event = String(data.event || "");
        const type = String(data.prepType || "");
        if (!WORKSHOP_TYPES.includes(event)) return errorResponse("Event tidak dikenal: " + event);
        if (!PREP_TYPES.includes(type)) return errorResponse("Tipe prep tidak dikenal: " + type);
        await setConfigValue(admin, prepKey(event, type), JSON.stringify(Array.isArray(data.items) ? data.items : []));
        return jsonResponse({ status: "success", message: "Tersimpan." });
      }

      case "getPrepFaqContext": {
        const event = String(data.event || "");
        if (!WORKSHOP_TYPES.includes(event)) return errorResponse("Event tidak dikenal: " + event);
        const batchId = String(data.batchId || "");
        const context = (await getConfigValue(admin, prepFaqKey(event, batchId))) || "";
        return jsonResponse({ status: "success", context });
      }

      case "savePrepFaqContext": {
        const event = String(data.event || "");
        if (!WORKSHOP_TYPES.includes(event)) return errorResponse("Event tidak dikenal: " + event);
        const batchId = String(data.batchId || "");
        await setConfigValue(admin, prepFaqKey(event, batchId), String(data.context || "").slice(0, 4000));
        return jsonResponse({ status: "success", message: "Konteks tersimpan." });
      }

      case "generateFaqBlock": {
        const context = String(data.context || "").trim();
        const knownFacts = String(data.knownFacts || "").trim();
        const wsName = String(data.workshopName || "workshop ini");
        if (!context && !knownFacts) return errorResponse("Belum ada info apapun buat event ini.");
        const geminiKey = Deno.env.get("GEMINI_API_KEY");
        if (!geminiKey) return errorResponse("GEMINI_API_KEY belum diset di server.");

        const prompt = `Info dasar event "${wsName}" (data yang udah pasti akurat dari sistem):
"""
${knownFacts || "(nggak ada info dasar tersedia)"}
"""

Konteks tambahan yang diisi manual (venue detail/rute transport/apa yang perlu dibawa/dst, yang sistem GA tau otomatis):
"""
${context || "(belum ada konteks tambahan yang diisi)"}
"""

Buatin daftar FAQ (tanya-jawab) yang mengantisipasi pertanyaan paling umum yang bakal ditanyain peserta terkait KEDUA info di atas (jadwal, lokasi, harga, cara ke sana/rute transport, apa yang perlu dibawa, dsb) -- SESUAIKAN PERSIS sama apa yang ada di kedua blok itu, JANGAN NGARANG info yang nggak disebut di sana.

Format tiap FAQ:
Q: [pertanyaan]
A: [jawaban]

Pisahkan tiap FAQ dengan baris kosong. Gaya jawaban santai & akrab (bukan formal kayak surat resmi), boleh emoji secukupnya. Balas HANYA daftar FAQ-nya, tanpa kalimat pembuka/penutup tambahan.`;

        const result = await callGemini(geminiKey, prompt);
        if (!result.ok) return errorResponse("Gagal generate FAQ: " + result.error);
        const block = String(result.text || "").trim();
        if (!block) return errorResponse("AI nggak ngasih hasil yang bisa dibaca.");
        return jsonResponse({ status: "success", block });
      }

      case "generateFaqAnswer": {
        const context = String(data.context || "").trim();
        const knownFacts = String(data.knownFacts || "").trim();
        const question = String(data.question || "").trim();
        const wsName = String(data.workshopName || "workshop ini");
        if (!question) return errorResponse("Isi dulu pertanyaan yang mau dijawab.");
        const geminiKey = Deno.env.get("GEMINI_API_KEY");
        if (!geminiKey) return errorResponse("GEMINI_API_KEY belum diset di server.");

        const prompt = `Info dasar event "${wsName}" (data yang udah pasti akurat dari sistem):
"""
${knownFacts || "(nggak ada info dasar tersedia)"}
"""

Konteks tambahan yang diisi manual (venue detail/rute transport/apa yang perlu dibawa/dst, yang sistem GA tau otomatis):
"""
${context || "(belum ada konteks tambahan yang diisi)"}
"""

Peserta nanya: "${question}"

Jawab pertanyaan itu PAKAI INFO DARI KEDUA BLOK DI ATAS AJA (info dasar + konteks tambahan). Kalau infonya nggak ada/nggak cukup di kedua blok itu, jawab jujur kayak "belum ada infonya nih, nanti Arnold infoin lagi ya" -- JANGAN NGARANG jawaban yang nggak ada dasarnya di sana (misal ngarang alamat/rute/jam yang nggak disebut).

Gaya bahasa santai & akrab kayak chat personal dari temen (bukan formal), sesekali boleh sebut "Arnold" di orang ketiga buat nada personal, emoji secukupnya jangan berlebihan. Balas HANYA jawabannya aja, tanpa pembuka/penutup tambahan.`;

        const result = await callGemini(geminiKey, prompt);
        if (!result.ok) return errorResponse("Gagal generate jawaban: " + result.error);
        const answer = String(result.text || "").trim();
        if (!answer) return errorResponse("AI nggak ngasih hasil yang bisa dibaca.");
        return jsonResponse({ status: "success", answer });
      }

      case "getIdeas": {
        const json = await getConfigValue(admin, "IDEAS_JSON");
        let ideas: unknown[] = [];
        try { ideas = json ? JSON.parse(json) : []; } catch (_e) { ideas = []; }
        return jsonResponse({ status: "success", ideas });
      }

      case "saveIdeas": {
        await setConfigValue(admin, "IDEAS_JSON", JSON.stringify(Array.isArray(data.ideas) ? data.ideas : []));
        return jsonResponse({ status: "success", message: "Ide tersimpan." });
      }

      case "uploadImage": {
        // Upload gambar generik dari admin panel (dipakai KONTEN editor,
        // mis. foto item Rekomendasi) -- whitelist bucket biar nggak
        // disalahgunain upload ke bucket sembarangan.
        const ALLOWED_BUCKETS = ["recommendation-photos", "cost-item-photos"];
        const bucket = String(data.bucket || "");
        if (!ALLOWED_BUCKETS.includes(bucket)) return errorResponse("Bucket tidak dikenal: " + bucket);
        if (!data.imageBase64) return errorResponse("Gambar belum dipilih.");
        const url = await uploadBase64(admin, bucket, data.imageBase64, String(data.prefix || "img"));
        return jsonResponse({ status: "success", url });
      }

      case "getSignedUrl": {
        // Bukti bayar (bucket "payment-proofs") disimpen PRIVATE (bukan URL
        // publik) -- disimpen di DB sebagai "bucket/path" (lihat uploadBase64
        // di _shared/storage.ts). Admin butuh link sementara buat liatnya.
        const raw = String(data.path || "");
        const idx = raw.indexOf("/");
        if (idx < 0) return errorResponse("Path tidak valid.");
        const bucket = raw.slice(0, idx);
        const key = raw.slice(idx + 1);
        const ALLOWED_BUCKETS = ["payment-proofs"];
        if (!ALLOWED_BUCKETS.includes(bucket)) return errorResponse("Bucket tidak diizinkan: " + bucket);
        const { data: signed, error } = await admin.storage.from(bucket).createSignedUrl(key, 300);
        if (error || !signed) return errorResponse("Gagal generate link: " + (error?.message || "tidak diketahui"), 500);
        return jsonResponse({ status: "success", url: signed.signedUrl });
      }

      case "getContent": {
        const type = String(data.contentType || "");
        const { data: rows } = await admin.from("content_items").select("*").eq("content_type", type).order("created_at", { ascending: true });
        const items = (rows || []).map((r) => ({ id: r.id, title: r.title, ...(r.extra || {}) }));
        return jsonResponse({ status: "success", contentType: type, items });
      }

      case "saveContent": {
        const type = String(data.contentType || "");
        if (!type) return errorResponse("Tipe konten tidak dikenal: " + type);
        const items = Array.isArray(data.items) ? data.items : [];
        await admin.from("content_items").delete().eq("content_type", type);
        if (items.length) {
          // deno-lint-ignore no-explicit-any
          const rows = items.map((it: any) => {
            const { title, ...extra } = it;
            return { content_type: type, title: title || null, extra };
          });
          await admin.from("content_items").insert(rows);
        }
        return jsonResponse({ status: "success", message: `Konten '${type}' tersimpan (${items.length} item).` });
      }

      case "getModal": {
        const { data: rows } = await admin.from("workshop_costs").select("*");
        const modal: Record<string, Record<string, { nama: string; biaya: number; tipe: string }[]>> = {};
        for (const c of rows || []) {
          (modal[c.workshop_type] ||= {})[c.batch] ||= [];
          modal[c.workshop_type][c.batch].push({ nama: c.name, biaya: Number(c.amount) || 0, tipe: c.kind === "tetap" ? "tetap" : "per-peserta" });
        }
        return jsonResponse({ status: "success", modal });
      }

      case "saveModal": {
        const workshop = String(data.workshop || "");
        if (!WORKSHOP_TYPES.includes(workshop)) return errorResponse("Workshop tidak dikenal: " + workshop);
        const batch = String(data.batch || "");
        const items = Array.isArray(data.items) ? data.items : [];
        await admin.from("workshop_costs").delete().eq("workshop_type", workshop).eq("batch", batch);
        if (items.length) {
          // deno-lint-ignore no-explicit-any
          const rows = items.map((it: any) => ({
            workshop_type: workshop, batch, name: String(it.nama || ""), amount: Number(it.biaya) || 0,
            kind: it.tipe === "tetap" ? "tetap" : "per-peserta",
          }));
          await admin.from("workshop_costs").insert(rows);
        }
        return jsonResponse({ status: "success", message: "Tersimpan." });
      }

      case "getCostItems": {
        const { data: rows } = await admin.from("cost_items").select("*").order("name", { ascending: true });
        return jsonResponse({ status: "success", items: rows || [] });
      }

      case "saveCostItem": {
        const id = String(data.id || "");
        const name = String(data.name || "").trim();
        if (!name) return errorResponse("Nama item wajib diisi.");
        const payload = {
          name,
          default_price: Math.round(Number(data.defaultPrice) || 0),
          image_url: data.imageUrl ? String(data.imageUrl) : null,
          link: data.link ? String(data.link) : null,
        };
        if (id) {
          const { error } = await admin.from("cost_items").update(payload).eq("id", id);
          if (error) return errorResponse("Gagal update item: " + error.message);
        } else {
          const { error } = await admin.from("cost_items").insert(payload);
          if (error) return errorResponse("Gagal bikin item: " + error.message);
        }
        return jsonResponse({ status: "success", message: "Item tersimpan." });
      }

      case "deleteCostItem": {
        const id = String(data.id || "");
        if (!id) return errorResponse("ID item kosong.");
        const { error } = await admin.from("cost_items").delete().eq("id", id);
        if (error) return errorResponse("Gagal hapus item: " + error.message);
        return jsonResponse({ status: "success", message: "Item dihapus." });
      }

      case "parseProductLink": {
        // Shopee/Tokopedia itu SPA -- fetch server-side cuma dapet shell JS
        // kosong (dites: 200 OK tapi nggak ada <title>/OG tag sama sekali).
        // Nama produknya justru udah ke-embed di slug URL-nya sendiri
        // (mis. shopee.co.id/Lem-Uhu-Stick-21g-i.123.456), jadi cukup di-parse
        // dari situ -- ga perlu fetch/render halamannya sama sekali.
        const link = String(data.link || "").trim();
        if (!link) return errorResponse("Link kosong.");

        let slug = "";
        try {
          const path = decodeURIComponent(new URL(link).pathname);
          // Shopee: /{slug}-i.{shopId}.{itemId}
          const shopeeMatch = path.match(/^\/(.+)-i\.\d+\.\d+$/);
          if (shopeeMatch) {
            slug = shopeeMatch[1];
          } else {
            // Tokopedia & lainnya: ambil segmen path terakhir yang bukan angka/query doang
            const segments = path.split("/").filter(Boolean);
            slug = segments[segments.length - 1] || "";
          }
        } catch {
          return errorResponse("Link nggak valid.");
        }
        slug = slug.replace(/[-_~!()]+/g, " ").replace(/\s+/g, " ").trim();
        if (!slug) return errorResponse("Nggak nemu nama produk dari link ini.");

        // String logic biasa, ga perlu manggil AI buat kerjaan sesimpel ini --
        // buang kata promosi + rapiin kapitalisasi.
        const PROMO_WORDS = [
          "free", "gratis", "promo", "termurah", "terlaris", "terlaku", "cuci gudang",
          "diskon", "sale", "flash sale", "flashsale", "ready stock", "readystock",
          "grosir", "murah", "best seller", "bestseller", "ongkir", "gratis ongkir",
          "cod", "limited", "terbaru", "original", "ori", "termurah se-indonesia",
          "termurah sejabodetabek", "hot sale", "hemat",
        ].sort((a, b) => b.length - a.length); // frasa panjang duluan biar ga kepotong separuh
        let cleaned = slug;
        for (const w of PROMO_WORDS) {
          cleaned = cleaned.replace(new RegExp(`\\b${w.replace(/\s+/g, "\\s+")}\\b`, "gi"), " ");
        }
        cleaned = cleaned.replace(/\s+/g, " ").trim();
        if (!cleaned) cleaned = slug; // kalau abis dibersihin malah kosong, pakai slug asli aja
        const name = cleaned.split(" ").map((w) => w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w).join(" ");
        return jsonResponse({ status: "success", name });
      }

      case "parseReceiptImage": {
        // Halaman order/struk Shopee/Tokopedia itu butuh login akun sendiri --
        // server nggak punya akses session-nya, jadi nggak bisa di-fetch. Solusinya
        // sama kayak Impor AI di Personal Finance: user screenshot halamannya
        // sendiri (udah login), AI vision baca isinya dari gambar.
        const imageBase64 = String(data.imageBase64 || "");
        const mimeType = String(data.mimeType || "image/jpeg");
        if (!imageBase64) return errorResponse("Gambar kosong.");

        const geminiKey = Deno.env.get("GEMINI_API_KEY");
        if (!geminiKey) return errorResponse("GEMINI_API_KEY belum diset di server.");

        const prompt = `Kamu bertugas membaca screenshot struk/detail pesanan/riwayat pembelian dari marketplace (Shopee/Tokopedia/dll) dan mengekstrak SEMUA item/produk yang dibeli di dalamnya.

Untuk setiap item, tentukan:
- name: nama produk apa adanya dari gambar (boleh dipersingkat kalau terlalu panjang/bertele-tele, tapi tetap jelas produknya apa)
- price: harga SATUAN per item dalam Rupiah, angka bulat POSITIF (BUKAN subtotal -- kalau yang keliatan di gambar cuma subtotal dan quantity, bagi subtotal dengan quantity buat dapetin harga satuannya)
- qty: jumlah/kuantitas item tersebut yang dibeli (angka bulat, minimal 1)

Abaikan info yang bukan item produk (alamat pengiriman, status pengiriman, subtotal keseluruhan/ongkir/voucher/biaya layanan, info kurir, riwayat tracking, dsb). Kalau gambar tidak berisi daftar item pembelian sama sekali, kembalikan array kosong.`;

        const schema = {
          type: "OBJECT",
          properties: {
            items: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  name: { type: "STRING" },
                  price: { type: "NUMBER" },
                  qty: { type: "NUMBER" },
                },
                required: ["name", "price", "qty"],
              },
            },
          },
          required: ["items"],
        };

        const result = await callGemini(geminiKey, prompt, { imageBase64, mimeType, responseSchema: schema });
        if (!result.ok) return errorResponse("Gagal memproses gambar: " + result.error);
        let parsed: { items?: unknown };
        try {
          parsed = JSON.parse(result.text || "");
        } catch {
          return errorResponse("Gagal baca hasil dari AI.");
        }
        const items = Array.isArray(parsed.items) ? parsed.items : [];
        return jsonResponse({ status: "success", items });
      }

      case "generateReminderMessage": {
        // Pesan WA ke peserta beda isinya tergantung fase (jauh dari event ->
        // ajakan gabung grup, mepet -> reminder, udah lewat -> makasih) -- fase-nya
        // udah ditentuin di frontend (dari jarak hari ke event), di sini cuma
        // generate teksnya biar nggak template itu-itu terus tiap dipakai.
        const phase = String(data.phase || "reminder");
        if (!["welcome", "reminder", "thanks"].includes(phase)) return errorResponse("Fase pesan nggak dikenal.");
        const wsName = String(data.workshopName || "workshop ini");
        const groupLink = String(data.groupLink || "");

        const geminiKey = Deno.env.get("GEMINI_API_KEY");
        if (!geminiKey) return errorResponse("GEMINI_API_KEY belum diset di server.");

        let intent = "";
        let example = "";
        if (phase === "welcome") {
          intent = `Tulis pesan WhatsApp singkat buat peserta yang BARU AJA DAFTAR workshop "${wsName}". Ucapin terima kasih udah daftar, kasih semangat/antusiasme, dan ajak join grup WhatsApp event biar nggak ketinggalan info${groupLink ? ` (linknya: ${groupLink})` : " (bilang link grup-nya nanti dikirim menyusul, jangan sebut ada link kalau linknya belum ada)"}.`;
          example = `Hai ka {nama}, makasih banyak udah daftar workshop "${wsName}" ya! Arnold seneng banget kamu mau join. Biar ga ketinggalan info, gabung yuk ke grup WA-nya${groupLink ? ` di sini: ${groupLink}` : ""} 🥰`;
        } else if (phase === "reminder") {
          intent = `Tulis pesan WhatsApp singkat buat REMINDER peserta workshop "${wsName}" yang acaranya bentar lagi berlangsung (H-1/H-2). Ingetin acara mau mulai, ajak semangat, minta datang tepat waktu.`;
          example = `Hai ka {nama}, workshop "${wsName}" udah deket nih! Jangan lupa dateng tepat waktu ya, Arnold udah nungguin kamu 🎨`;
        } else {
          intent = `Tulis pesan WhatsApp singkat buat UCAPAN TERIMA KASIH ke peserta yang UDAH IKUT workshop "${wsName}" yang acaranya udah selesai. Ucapin terima kasih udah ikut, harap seneng & dapet manfaat, ajak dateng lagi ke event berikutnya.`;
          example = `Hai ka {nama}, makasih banyak udah seru-seruan bareng di "${wsName}" kemarin! Arnold seneng banget. Semoga next kita bisa ketemu lagi ya 🥰`;
        }

        const prompt = `${intent}

Contoh gaya yang HARUS ditiru persis nada & rasanya (JANGAN disalin kata-katanya mentah-mentah, bikin variasi baru dengan nada yang sama):
"${example}"

Ciri gaya itu yang wajib dipegang:
- Sapaan santai "Hai ka {nama}" atau variasinya (bukan "Halo {nama}" doang, apalagi sapaan formal kayak "Yth. {nama}")
- Bahasa sehari-hari yang casual & akrab, boleh selipin kata gaul (misal "seru-seruan", "next", "yuk", dst) secukupnya -- JANGAN kaku/formal kayak pesan broadcast perusahaan
- Sesekali sebut "Arnold" (penyelenggaranya) di orang ketiga buat ekspresiin perasaan personal (misal "Arnold seneng banget"), BUKAN "kami"/"tim kami" yang kesannya korporat
- Kesannya kayak chat personal dari temen deket, bukan pesan resmi/broadcast massal
- WAJIB pakai placeholder "{nama}" persis (buat nama peserta, bakal diganti otomatis nanti) -- jangan tulis nama asli siapapun
- Panjang 2-4 kalimat, jangan kepanjangan
- Variasikan kalimatnya tiap kali (jangan selalu mulai dengan pola kalimat yang sama)
- Emoji boleh dipakai secukupnya, jangan berlebihan

Balas HANYA teks pesannya aja, tanpa tanda kutip, tanpa penjelasan tambahan, tanpa embel-embel semacam "Berikut pesannya:".`;

        const result = await callGemini(geminiKey, prompt, { temperature: 1.1 }); // variasi lebih tinggi biar ga kerasa template-mirip terus
        if (!result.ok) return errorResponse("Gagal generate pesan: " + result.error);
        const message = String(result.text || "").trim().replace(/^["']|["']$/g, "");
        if (!message) return errorResponse("AI nggak ngasih hasil yang bisa dibaca.");
        return jsonResponse({ status: "success", message, phase });
      }

      case "getInventoryTransactions": {
        const { data: rows } = await admin.from("inventory_transactions").select("*")
          .order("date", { ascending: false }).order("created_at", { ascending: false });
        return jsonResponse({ status: "success", transactions: rows || [] });
      }

      case "saveInventoryTransaction": {
        const id = String(data.id || "");
        const itemId = String(data.itemId || "");
        if (!itemId) return errorResponse("Item wajib dipilih.");
        const type = String(data.type || "");
        if (!["beli", "pakai", "adjust"].includes(type)) return errorResponse("Tipe transaksi nggak dikenal.");
        const qty = Math.round(Number(data.qty) || 0);
        if (!qty) return errorResponse("Jumlah nggak boleh 0.");
        if (type !== "adjust" && qty < 0) return errorResponse("Jumlah harus positif buat beli/pakai.");
        const date = String(data.date || "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return errorResponse("Tanggal nggak valid.");
        const payload = {
          item_id: itemId, type, qty, date,
          workshop_type: data.workshopType ? String(data.workshopType) : null,
          note: data.note ? String(data.note).slice(0, 300) : null,
        };
        if (id) {
          const { error } = await admin.from("inventory_transactions").update(payload).eq("id", id);
          if (error) return errorResponse("Gagal update transaksi stok: " + error.message);
        } else {
          const { error } = await admin.from("inventory_transactions").insert(payload);
          if (error) return errorResponse("Gagal simpan transaksi stok: " + error.message);
        }
        return jsonResponse({ status: "success", message: "Transaksi stok tersimpan." });
      }

      case "deleteInventoryTransaction": {
        const id = String(data.id || "");
        if (!id) return errorResponse("ID transaksi kosong.");
        const { error } = await admin.from("inventory_transactions").delete().eq("id", id);
        if (error) return errorResponse("Gagal hapus transaksi stok: " + error.message);
        return jsonResponse({ status: "success", message: "Transaksi stok dihapus." });
      }

      case "setAttendance": {
        const id = String(data.registrationId || "");
        if (!id) return errorResponse("Parameter kurang.");
        const { error } = await admin.from("registrations").update({ attendance: !!data.hadir }).eq("id", id);
        if (error) return errorResponse("Registrasi tidak ditemukan.");
        return jsonResponse({ status: "success", message: "Kehadiran tersimpan." });
      }

      case "getLeads": {
        const { data: rows } = await admin.from("leads").select("*").order("created_at", { ascending: false });
        const leads = (rows || []).map((r) => ({ ...r, lastContact: r.last_contact?.slice(0, 10) || "", createdAt: r.created_at?.slice(0, 10) || "" }));
        return jsonResponse({ status: "success", leads });
      }

      case "addLead": {
        const username = String(data.username || "").trim().replace(/^@/, "");
        if (!username) return errorResponse("Username tidak boleh kosong.");
        const lead = {
          platform: String(data.platform || "Instagram"), username,
          status: String(data.status || "chatted"),
          following: data.following === true || String(data.following).toUpperCase() === "TRUE",
          notes: String(data.notes || ""), last_contact: today(),
        };
        const { data: inserted } = await admin.from("leads").insert(lead).select().single();
        return jsonResponse({ status: "success", lead: inserted });
      }

      case "updateLead": {
        const id = String(data.id || "");
        if (!id) return errorResponse("ID lead kosong.");
        // deno-lint-ignore no-explicit-any
        const patch: Record<string, any> = {};
        if (data.platform != null) patch.platform = String(data.platform);
        if (data.username != null) patch.username = String(data.username).trim().replace(/^@/, "");
        if (data.status != null) { patch.status = String(data.status); patch.last_contact = today(); }
        if (data.following != null) patch.following = data.following === true || String(data.following).toUpperCase() === "TRUE";
        if (data.notes != null) patch.notes = String(data.notes);
        const { error } = await admin.from("leads").update(patch).eq("id", id);
        if (error) return errorResponse("Lead tidak ditemukan.");
        return jsonResponse({ status: "success", message: "Lead diperbarui." });
      }

      case "deleteLead": {
        const id = String(data.id || "");
        if (!id) return errorResponse("ID lead kosong.");
        const { error } = await admin.from("leads").delete().eq("id", id);
        if (error) return errorResponse("Lead tidak ditemukan.");
        return jsonResponse({ status: "success", message: "Lead dihapus." });
      }

      // ---- Pesanan minum/makan per event (menu global + pesanan per batch) ----
      case "listAllBatches": {
        const { data: rows } = await admin.from("batches").select("id, workshop_type, label, event_date").order("event_date", { ascending: false, nullsFirst: false });
        let nameMap: Record<string, string> = {};
        try {
          const cfg = JSON.parse((await getConfigValue(admin, "WORKSHOPS_JSON")) || "[]");
          for (const w of cfg) if (w?.id) nameMap[w.id] = w.name;
        } catch (_e) { /* abaikan */ }
        const batches = (rows || []).map((b) => ({
          id: b.id, workshopType: b.workshop_type, workshopName: nameMap[b.workshop_type] || b.workshop_type,
          label: b.label || "", eventDate: b.event_date || "",
        }));
        return jsonResponse({ status: "success", batches });
      }

      case "listMenuItems": {
        const { data: rows } = await admin.from("menu_items").select("*").order("created_at", { ascending: true });
        const items = (rows || []).map((r) => ({ id: r.id, name: r.name, description: r.description || "", imageUrl: r.image_url || "", active: !!r.active }));
        return jsonResponse({ status: "success", items });
      }

      case "saveMenuItem": {
        const name = String(data.name || "").trim();
        if (!name) return errorResponse("Nama menu wajib diisi.");
        const description = String(data.description || "").trim();
        const active = data.active === true || data.active === "true" || data.active === "on";
        let image = String(data.image || "");
        if (data.imageBase64) {
          const uploaded = await uploadBase64(admin, "menu-photos", data.imageBase64, `menu-${name}`);
          if (uploaded) image = uploaded;
        }
        const id = String(data.id || "").trim();
        if (id) {
          const { data: existing } = await admin.from("menu_items").select("image_url").eq("id", id).maybeSingle();
          if (!existing) return errorResponse("Menu tidak ditemukan.");
          const { error: updErr } = await admin.from("menu_items").update({ name, description, image_url: image || existing.image_url, active }).eq("id", id);
          if (updErr) return errorResponse("Gagal simpan: " + updErr.message);
          return jsonResponse({ status: "success", message: "Menu diperbarui." });
        }
        const { error: insErr } = await admin.from("menu_items").insert({ name, description, image_url: image, active });
        if (insErr) return errorResponse("Gagal simpan: " + insErr.message);
        return jsonResponse({ status: "success", message: `Menu '${name}' ditambahkan.` });
      }

      case "deleteMenuItem": {
        const id = String(data.id || "");
        if (!id) return errorResponse("ID kosong.");
        const { error } = await admin.from("menu_items").delete().eq("id", id);
        if (error) return errorResponse("Gagal hapus -- menu ini kemungkinan masih punya riwayat pesanan. Nonaktifin aja (toggle Aktif) daripada dihapus.");
        return jsonResponse({ status: "success", message: "Menu dihapus." });
      }

      case "listOrders": {
        const batchId = String(data.batchId || "");
        if (!batchId) return errorResponse("Event belum dipilih.");
        const { data: rows } = await admin.from("event_orders").select("*").eq("batch_id", batchId).order("created_at", { ascending: true });
        const orders = (rows || []).map((r) => ({ id: r.id, participantName: r.participant_name, menuItemId: r.menu_item_id, registrationId: r.registration_id || "", ts: r.created_at ? new Date(r.created_at).getTime() : 0 }));
        return jsonResponse({ status: "success", orders });
      }

      case "saveOrder": {
        const batchId = String(data.batchId || "");
        const participantName = String(data.participantName || "").trim().slice(0, 60);
        const menuItemId = String(data.menuItemId || "");
        const id = String(data.id || "").trim();
        const registrationId = String(data.registrationId || "").trim() || null;
        if (!participantName || !menuItemId) return errorResponse("Nama & menu wajib diisi.");
        if (id) {
          // registrationId cuma di-apply kalau eksplisit dikirim (dari picker inline
          // di daftar peserta) -- form edit teks-bebas nggak ngirim ini, jangan sampe
          // nge-null-in link yang udah ada cuma gara-gara edit dari form itu.
          // deno-lint-ignore no-explicit-any
          const patch: Record<string, any> = { participant_name: participantName, menu_item_id: menuItemId };
          if (registrationId) patch.registration_id = registrationId;
          const { error } = await admin.from("event_orders").update(patch).eq("id", id);
          if (error) return errorResponse("Pesanan tidak ditemukan.");
          return jsonResponse({ status: "success", message: "Pesanan diperbarui." });
        }
        if (!batchId) return errorResponse("Event belum dipilih.");
        const { error: ordErr } = await admin.from("event_orders").insert({ batch_id: batchId, participant_name: participantName, menu_item_id: menuItemId, registration_id: registrationId });
        if (ordErr) return errorResponse("Gagal simpan: " + ordErr.message);
        return jsonResponse({ status: "success", message: "Pesanan ditambahkan." });
      }

      case "deleteOrder": {
        const id = String(data.id || "");
        if (!id) return errorResponse("ID kosong.");
        const { error } = await admin.from("event_orders").delete().eq("id", id);
        if (error) return errorResponse("Pesanan tidak ditemukan.");
        return jsonResponse({ status: "success", message: "Pesanan dihapus." });
      }

      case "getVendorWa": {
        const wa = (await getConfigValue(admin, "ORDER_VENDOR_WA")) || "";
        return jsonResponse({ status: "success", wa });
      }

      case "saveVendorWa": {
        await setConfigValue(admin, "ORDER_VENDOR_WA", String(data.wa || "").replace(/\D/g, ""));
        return jsonResponse({ status: "success", message: "Nomor vendor tersimpan." });
      }

      default:
        return errorResponse("Aksi admin tidak dikenal: " + action);
    }
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
