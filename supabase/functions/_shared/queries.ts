import { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { waKey } from "./auth.ts";

const LOYALTY_TARGET = 6; // stamp per hadiah

export type LoyaltyMember = {
  key: string; wa: string; nickname: string; fullName: string; ig: string;
  count: number; claimed: number; progress: number; eligible: boolean;
  questCount: number; notes: string[];
  events: { workshop: string; label: string; eventDate: string; date: string }[];
};

// Port dari loyaltyMembers_() -- jauh lebih simpel sekarang karena
// `registrations` udah 1 tabel gabungan (dulu perlu scan puluhan sheet).
export async function loyaltyMembers(admin: SupabaseClient): Promise<LoyaltyMember[]> {
  const { data: regs } = await admin
    .from("registrations")
    .select("wa, full_name, nickname, ig_username, created_at, workshop_type, batches(label, event_date)")
    .neq("workshop_type", "journaling-date");

  const { data: claimsRow } = await admin.from("app_config").select("value").eq("key", "LOYALTY_CLAIMS_JSON").maybeSingle();
  const { data: notesRow } = await admin.from("app_config").select("value").eq("key", "LOYALTY_NOTES_JSON").maybeSingle();
  let claims: Record<string, number> = {};
  let notesMap: Record<string, string[]> = {};
  try { claims = JSON.parse(claimsRow?.value || "{}"); } catch (_e) { /* abaikan */ }
  try { notesMap = JSON.parse(notesRow?.value || "{}"); } catch (_e) { /* abaikan */ }

  const qmap = await questCountMap(admin);

  const byWa: Record<string, LoyaltyMember> = {};
  for (const r of regs || []) {
    const key = waKey(r.wa);
    if (!key) continue;
    if (!byWa[key]) {
      byWa[key] = { key, wa: r.wa, nickname: "", fullName: "", ig: "", count: 0, claimed: 0, progress: 0, eligible: false, questCount: 0, notes: [], events: [] };
    }
    const m = byWa[key];
    if (!m.nickname && r.nickname) m.nickname = r.nickname;
    if (!m.fullName && r.full_name) m.fullName = r.full_name;
    if (!m.ig && r.ig_username) m.ig = r.ig_username;
    // deno-lint-ignore no-explicit-any
    const batch = r.batches as any;
    m.events.push({
      workshop: r.workshop_type,
      label: batch?.label || "",
      eventDate: batch?.event_date || "",
      date: r.created_at ? new Date(r.created_at).toISOString() : "",
    });
  }

  return Object.values(byWa).map((m) => {
    const total = m.events.length;
    const claimed = Number(claims[m.key]) || 0;
    const progress = Math.max(0, total - claimed * LOYALTY_TARGET);
    return {
      ...m,
      count: total,
      claimed,
      progress,
      eligible: progress >= LOYALTY_TARGET,
      questCount: qmap[m.key] || 0,
      notes: Array.isArray(notesMap[m.key]) ? notesMap[m.key] : [],
    };
  }).sort((a, b) => b.count - a.count);
}

export async function questCountMap(admin: SupabaseClient): Promise<Record<string, number>> {
  const { data } = await admin.from("quest_submissions").select("wa, challenge_id");
  const seen: Record<string, Set<string>> = {};
  for (const r of data || []) {
    const k = waKey(r.wa);
    if (!k) continue;
    (seen[k] ||= new Set()).add(r.challenge_id);
  }
  const out: Record<string, number> = {};
  for (const k of Object.keys(seen)) out[k] = seen[k].size;
  return out;
}

export async function questPointsMap(admin: SupabaseClient): Promise<Record<string, number>> {
  const { data: challenges } = await admin.from("challenges").select("id, points");
  const chalPts: Record<string, number> = {};
  for (const c of challenges || []) chalPts[c.id] = c.points || 0;

  const { data } = await admin.from("quest_submissions").select("wa, challenge_id");
  const seen: Record<string, Set<string>> = {};
  for (const r of data || []) {
    const k = waKey(r.wa);
    if (!k) continue;
    (seen[k] ||= new Set()).add(r.challenge_id);
  }
  const out: Record<string, number> = {};
  for (const k of Object.keys(seen)) {
    let p = 0;
    for (const cid of seen[k]) p += chalPts[cid] || 0;
    out[k] = p;
  }
  return out;
}

// +5 poin leaderboard per aksi: check-in mingguan (journal_records), 1 entri
// Gratitude Jar, 1 entri Jurnal Bulanan, 1 pesan Mading -- di luar poin
// challenge (questPointsMap). Flat per aksi (bukan per minggu/bulan), biar
// makin rajin makin nambah, sama kayak semangat "jangan di-punish" fitur2
// itu sendiri (lihat skill seminggu-psych).
const EXTRA_POINT_VALUE = 5;

export async function extraPointsMap(admin: SupabaseClient): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const add = (wa: string, n: number) => {
    const k = waKey(wa);
    if (!k || n <= 0) return;
    out[k] = (out[k] || 0) + n * EXTRA_POINT_VALUE;
  };

  const { data: members } = await admin.from("members").select("wa, journal_records, jar_records, writing_records");
  for (const m of members || []) {
    let n = 0;
    n += Object.keys(m.journal_records || {}).length; // 1 key minggu = 1 check-in
    const jar = m.jar_records || {};
    for (const mk of Object.keys(jar)) n += Array.isArray(jar[mk]?.items) ? jar[mk].items.length : 0;
    const wr = m.writing_records || {};
    for (const mk of Object.keys(wr)) n += Array.isArray(wr[mk]?.entries) ? wr[mk].entries.length : 0;
    add(m.wa, n);
  }

  const { data: msgs } = await admin.from("board_messages").select("wa");
  for (const r of msgs || []) add(r.wa, 1);

  return out;
}

export async function memberNickMap(admin: SupabaseClient): Promise<Record<string, string>> {
  const { data } = await admin.from("members").select("wa, nickname");
  const out: Record<string, string> = {};
  for (const m of data || []) {
    const k = waKey(m.wa);
    if (k && m.nickname) out[k] = m.nickname;
  }
  return out;
}

export type GalleryItem = {
  id: string; kind: string; challengeId: string; title: string; nickname: string;
  photo: string; caption: string; ts: number; ownerKey: string; avatar: string; bio: string; eventDate?: string;
  publicId: string;
};

// Batas ambil data per sumber, diurut TERBARU duluan di level query (bukan di
// JS) -- biar query & payload-nya tetep ringan walau submission udah numpuk
// ribuan lifetime. Weekly journal nggak perlu batas karena udah kebatasin
// alami (1 foto/minggu/member, disimpen di kolom members bukan tabel sendiri).
const GALLERY_QUEST_CAP = 1500;
const GALLERY_EVENT_CAP = 500;

// Port dari questGalleryBase_() -- gabungan submission quest + foto weekly
// journal + foto event admin, diurut terbaru duluan.
export async function questGalleryBase(admin: SupabaseClient): Promise<GalleryItem[]> {
  const out: GalleryItem[] = [];

  const { data: challenges } = await admin.from("challenges").select("id, title");
  const titleMap: Record<string, string> = {};
  for (const c of challenges || []) titleMap[c.id] = c.title;

  const { data: members } = await admin.from("members").select("wa, nickname, photo_url, bio, journal_records, public_id");
  const avatarMap: Record<string, string> = {};
  const bioMap: Record<string, string> = {};
  const publicIdMap: Record<string, string> = {};
  for (const m of members || []) {
    const k = waKey(m.wa);
    if (!k) continue;
    if (m.photo_url) avatarMap[k] = m.photo_url;
    if (m.bio) bioMap[k] = m.bio;
    if (m.public_id) publicIdMap[k] = m.public_id;
  }
  const nickMap = await memberNickMap(admin);

  const { data: submissions } = await admin.from("quest_submissions")
    .select("id, challenge_id, wa, nickname, photo_url, caption, created_at")
    .order("created_at", { ascending: false }).limit(GALLERY_QUEST_CAP);
  for (const r of submissions || []) {
    if (!r.photo_url) continue;
    const k = waKey(r.wa);
    out.push({
      id: r.id, kind: "quest", challengeId: r.challenge_id, title: titleMap[r.challenge_id] || "Challenge",
      nickname: nickMap[k] || r.nickname || "Sahabat", photo: r.photo_url, caption: r.caption || "",
      ts: r.created_at ? new Date(r.created_at).getTime() : 0, ownerKey: k,
      avatar: avatarMap[k] || "", bio: bioMap[k] || "", publicId: publicIdMap[k] || "",
    });
  }

  for (const m of members || []) {
    const k = waKey(m.wa);
    const recs = m.journal_records || {};
    for (const wk of Object.keys(recs)) {
      const rec = recs[wk];
      if (!rec?.photo) continue;
      out.push({
        id: `jw_${k}_${wk}`, kind: "weekly", challengeId: "weekly", title: "Weekly Journal",
        nickname: m.nickname || "Sahabat", photo: rec.photo, caption: rec.note || "",
        ts: rec.ts ? new Date(rec.ts).getTime() : 0, ownerKey: k,
        avatar: avatarMap[k] || "", bio: bioMap[k] || "", publicId: publicIdMap[k] || "",
      });
    }
  }

  const { data: eventPhotos } = await admin.from("event_photos")
    .select("id, tag, photo_url, caption, created_at, event_date")
    .order("created_at", { ascending: false }).limit(GALLERY_EVENT_CAP);
  for (const r of eventPhotos || []) {
    if (!r.photo_url) continue;
    const tag = r.tag || "workshop";
    const uploadTs = r.created_at ? new Date(r.created_at).getTime() : 0;
    const eventTs = r.event_date ? new Date(`${r.event_date}T12:00:00`).getTime() : uploadTs;
    out.push({
      id: r.id, kind: tag, challengeId: "event",
      title: tag === "reka-rekat" ? "Reka-Rekat" : tag === "temu-warga" ? "Temu-Warga" : "Workshop",
      nickname: "Seminggu Satu", photo: r.photo_url, caption: r.caption || "",
      ts: eventTs, eventDate: r.event_date || "", ownerKey: "", avatar: "", bio: "", publicId: "",
    });
  }

  out.sort((a, b) => b.ts - a.ts);
  return out;
}

export async function questLikeMaps(admin: SupabaseClient, myWa?: string) {
  const { data } = await admin.from("quest_likes").select("target_id, wa");
  const myKey = waKey(myWa);
  const count: Record<string, number> = {};
  const mine: Record<string, boolean> = {};
  for (const r of data || []) {
    if (!r.target_id) continue;
    count[r.target_id] = (count[r.target_id] || 0) + 1;
    if (myKey && waKey(r.wa) === myKey) mine[r.target_id] = true;
  }
  return { count, mine };
}
