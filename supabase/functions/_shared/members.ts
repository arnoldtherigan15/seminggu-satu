import { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { waKey } from "./auth.ts";
import { loyaltyMembers } from "./queries.ts";

// "Member" = nomor WA pernah kedaftar di minimal 1 event BERBAYAR (loyalty).
// journaling-date dikecualikan (event gratis khusus member) -- port dari
// memberInfo_ / LOYALTY_EXCLUDE_ di Google_Script_Code.js.
//
// PENTING: pake loyaltyMembers() (normalisasi wa di kode, bukan `.eq("wa", key)`
// mentah ke DB) -- sebagian baris `registrations.wa` hasil migrasi lama nggak
// tersimpan dalam format yang udah dinormalisasi persis, jadi exact-match query
// bisa false-negative padahal orangnya emang member (ketemu di member-status,
// tapi nggak ketemu di sini -- bug nyata yang bikin reset-password/setup gagal
// walau akunnya valid).
export async function isMemberWa(admin: SupabaseClient, wa: string): Promise<boolean> {
  const key = waKey(wa);
  if (!key) return false;
  const members = await loyaltyMembers(admin);
  return members.some((m) => m.key === key);
}

function jakartaMonthDay(): string {
  // "MM-DD" di timezone Asia/Jakarta (WIB, UTC+7, no DST) -- port dari
  // Utilities.formatDate(new Date(), tz, "MM-dd") di todaysBirthdays_().
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${m}-${d}`;
}

export async function todaysBirthdays(admin: SupabaseClient): Promise<{ nickname: string }[]> {
  const { data } = await admin.from("members").select("nickname, birth_date");
  const md = jakartaMonthDay();
  return (data || [])
    .filter((m) => m.birth_date && String(m.birth_date).slice(5, 10) === md)
    .map((m) => ({ nickname: m.nickname || "Sahabat" }));
}

// deno-lint-ignore no-explicit-any
export async function profileResponse(admin: SupabaseClient, row: any) {
  return {
    status: "success",
    token: row.token,
    nickname: row.nickname || "",
    birthDate: row.birth_date || "",
    wa: waKey(row.wa),
    journalRecords: JSON.stringify(row.journal_records || {}),
    photoUrl: row.photo_url || "",
    bio: row.bio || "",
    moodRecords: JSON.stringify(row.mood_records || {}),
    publicOptIn: row.public_opt_in ? "1" : "",
    publicId: row.public_id || "",
    birthdays: await todaysBirthdays(admin),
  };
}
