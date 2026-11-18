// Isian pendaftaran warga sendiri (warna pilihan, inisial, foto, dll) buat
// halaman "Tiket kamu" di Balai Warga -- warga sering lupa dulu milih apa.
// WAJIB token sesi member (bukan cuma nomor WA kayak member-events): isinya
// data pribadi + foto, jadi cuma pemilik akun yang boleh lihat.
// Cuma event yang batch-nya masih aktif & belum lewat (foto pendaftaran
// toh dihapus H+1 sama cron-cleanup-past-registration-photos).
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { waKey } from "../_shared/auth.ts";

// field internal yang nggak relevan buat ditunjukin ke warga
const HIDDEN_EXTRA = new Set(["void"]);

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const data = await req.json();
    const token = String(data.token || "");
    if (!token) return errorResponse("Sesi tidak valid.");
    const admin = supabaseAdmin();
    const { data: me } = await admin.from("members").select("wa").eq("token", token).maybeSingle();
    if (!me) return errorResponse("Sesi kadaluarsa. Login lagi ya.");
    const key = waKey(me.wa);
    if (!key) return jsonResponse({ status: "success", registrations: {} });
    // data lama dari migrasi Sheets kadang kesimpen tanpa 62 / pakai 0
    const variants = [key, "0" + key.slice(2), key.slice(2)];

    const { data: regs } = await admin
      .from("registrations")
      .select("workshop_type, batch_id, full_name, nickname, ig_username, extra, created_at, batches(active, event_date, label)")
      .in("wa", variants)
      .eq("archived", false)
      .order("created_at", { ascending: false });

    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
    const out: Record<string, unknown> = {};
    for (const r of regs || []) {
      // deno-lint-ignore no-explicit-any
      const b = r.batches as any;
      if (!b || !b.active) continue;
      if (b.event_date && String(b.event_date) < today) continue;
      if (out[r.workshop_type]) continue; // ambil yang paling baru per tipe
      const extra: Record<string, unknown> = {};
      for (const [k, v] of Object.entries((r.extra || {}) as Record<string, unknown>)) {
        if (HIDDEN_EXTRA.has(k)) continue;
        extra[k] = v;
      }
      out[r.workshop_type] = {
        batchId: r.batch_id,
        submittedAt: r.created_at,
        fullName: r.full_name || "",
        nickname: r.nickname || "",
        ig: r.ig_username || "",
        extra,
      };
    }
    return jsonResponse({ status: "success", registrations: out });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
