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

const WORKSHOP_TYPES = ["3d-frame-journaling", "paper-journal", "upcycle-journal", "bookmark-journal", "reka-rekat", "journaling-date", "side-by-side"];
const PREP_TYPES = ["todos", "bring", "notes", "supplies", "richnote"];
const prepKey = (event: string, type: string) => `prep__${event}__${type}`;
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());

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
        for (const b of activeBatches || []) {
          const { count } = await admin.from("registrations").select("id", { count: "exact", head: true }).eq("batch_id", b.id);
          summary[b.workshop_type] = count ?? 0;
        }
        return jsonResponse({ status: "success", summary });
      }

      case "getLoyalty": {
        const members = await loyaltyMembers(admin);
        return jsonResponse({ status: "success", members });
      }

      case "getOverview": {
        const { data: activeBatches } = await admin.from("batches").select("id, workshop_type").eq("active", true);
        const summary: Record<string, number> = {};
        for (const id of WORKSHOP_TYPES) summary[id] = 0;
        for (const b of activeBatches || []) {
          const { count } = await admin.from("registrations").select("id", { count: "exact", head: true }).eq("batch_id", b.id);
          summary[b.workshop_type] = count ?? 0;
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
        const activeSheets: Record<string, string> = {};
        for (const b of activeBatches || []) activeSheets[b.workshop_type] = b.id;
        return jsonResponse({ status: "success", summary, modal, ideas, members, activeSheets });
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
          batches.push({ id: b.id, label: b.label || "", active: !!b.active, eventDate: b.event_date || "", count: count ?? 0 });
        }
        return jsonResponse({ status: "success", workshop, batches });
      }

      case "newBatch": {
        const workshop = String(data.workshop || "");
        if (!WORKSHOP_TYPES.includes(workshop)) return errorResponse("Workshop tidak dikenal: " + workshop);
        const label = String(data.label || "").trim();
        if (!label) return errorResponse("Label batch wajib diisi.");
        await admin.from("batches").update({ active: false }).eq("workshop_type", workshop);
        await admin.from("batches").insert({ workshop_type: workshop, label, active: true, event_date: data.eventDate || null });
        return jsonResponse({ status: "success", message: `Batch baru '${label}' dibuat & jadi aktif.` });
      }

      case "setActiveBatch": {
        const workshop = String(data.workshop || "");
        const batchId = String(data.batchId || "");
        if (!WORKSHOP_TYPES.includes(workshop)) return errorResponse("Workshop tidak dikenal: " + workshop);
        if (!batchId) return errorResponse("Batch wajib dipilih.");
        await admin.from("batches").update({ active: false }).eq("workshop_type", workshop);
        const { error } = await admin.from("batches").update({ active: true }).eq("id", batchId).eq("workshop_type", workshop);
        if (error) return errorResponse("Batch tidak ditemukan untuk workshop ini.");
        return jsonResponse({ status: "success", message: "Batch aktif diubah." });
      }

      case "renameBatch": {
        const batchId = String(data.batchId || "");
        if (!batchId) return errorResponse("Batch belum dipilih.");
        // deno-lint-ignore no-explicit-any
        const patch: Record<string, any> = {};
        if (data.label != null && String(data.label).trim() !== "") patch.label = String(data.label).trim();
        if (data.eventDate != null) patch.event_date = String(data.eventDate).trim() || null;
        if (!Object.keys(patch).length) return errorResponse("Nggak ada yang diubah.");
        const { error } = await admin.from("batches").update(patch).eq("id", batchId);
        if (error) return errorResponse("Batch tidak ditemukan.");
        return jsonResponse({ status: "success", message: "Batch diperbarui." });
      }

      case "getChallenges": {
        const { data: rows } = await admin.from("challenges").select("*").order("created_at", { ascending: false });
        return jsonResponse({ status: "success", challenges: rows || [] });
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

        const { data: regs } = await admin.from("registrations").select("full_name, nickname, workshop_type, created_at").order("created_at", { ascending: false }).limit(8);
        for (const r of regs || []) acts.push({ type: "daftar", who: r.nickname || r.full_name || "Peserta", detail: nameMap[r.workshop_type] || r.workshop_type, ts: r.created_at ? new Date(r.created_at).getTime() : 0 });

        const { data: challenges } = await admin.from("challenges").select("id, title");
        const chalTitle: Record<string, string> = {};
        for (const c of challenges || []) chalTitle[c.id] = c.title;
        const { data: qs } = await admin.from("quest_submissions").select("nickname, challenge_id, created_at").order("created_at", { ascending: false }).limit(15);
        for (const r of qs || []) acts.push({ type: "quest", who: r.nickname || "Member", detail: chalTitle[r.challenge_id] || "Side Quest", ts: r.created_at ? new Date(r.created_at).getTime() : 0 });

        const { data: mem } = await admin.from("members").select("nickname, created_at").order("created_at", { ascending: false }).limit(10);
        for (const r of mem || []) acts.push({ type: "member", who: r.nickname || "Warga", detail: "gabung Balai Warga", ts: r.created_at ? new Date(r.created_at).getTime() : 0 });

        acts.sort((a, b) => b.ts - a.ts);
        return jsonResponse({ status: "success", activity: acts.slice(0, 40) });
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
        const items = (rows || []).map((r) => ({ id: r.id, wa: r.wa, nickname: r.nickname || "Warga", category: r.category, text: r.message, votes: voteCount[r.id] || 0, ts: r.created_at ? new Date(r.created_at).getTime() : 0 }));
        return jsonResponse({ status: "success", items });
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
        const ALLOWED_BUCKETS = ["recommendation-photos"];
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
