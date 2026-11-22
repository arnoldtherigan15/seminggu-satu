// Publik (tanpa login) -- peserta ubah PILIHAN-nya (bukan foto) lewat link personal
// ?rid=<registrationId>. Sekarang khusus Upcycle Journal Private Session (private-uc):
// warna tali, warna buku, jenis buku, kotak susu. Nilai dicek ke daftar pilihan resmi.
//   action "get"  -> data & pilihan sekarang
//   action "save" -> simpan, kabarin admin (Telegram + push)
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { sendTelegramText } from "../_shared/telegram.ts";

const CHOICES: Record<string, Record<string, string[]>> = {
  "private-uc": {
    bookColor: ["Toska", "Biru Langit", "Maroon", "Abu Tua", "Jingga", "Hijau Tua", "Fusia", "Ungu", "Lavender", "Kunyit", "Kuning", "Jambon"],
    bookType: ["Dotted", "Polos", "Grid"],
    colorStrap: ["Putih", "Cream", "Kuning", "Stabilo", "Orange", "Merah", "Pink", "Pink Magenta", "Ungu", "Hijau", "Tosca", "Biru Muda", "Biru Tua", "Abu Abu", "Coklat", "Hitam"],
  },
};
const LABEL: Record<string, string> = { bookColor: "Warna buku", bookType: "Jenis buku", colorStrap: "Warna tali", hasOwnCarton: "Kotak susu" };

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const data = await req.json();
    const rid = String(data.rid || "");
    if (!/^[0-9a-f-]{36}$/i.test(rid)) return errorResponse("Link tidak valid.");
    const admin = supabaseAdmin();
    const { data: reg } = await admin.from("registrations").select("id, full_name, nickname, workshop_type, batch_id, extra, archived").eq("id", rid).maybeSingle();
    if (!reg || reg.archived) return errorResponse("Data pendaftaran nggak ketemu -- link mungkin udah nggak berlaku.");
    const allowed = CHOICES[reg.workshop_type];
    if (!allowed) return errorResponse("Link ini nggak bisa dipakai buat event ini.");
    const extra = reg.extra || {};
    const name = reg.nickname || reg.full_name || "Peserta";

    if (String(data.action || "get") === "get") {
      return jsonResponse({
        status: "success", name, workshopType: reg.workshop_type,
        current: { bookColor: extra.bookColor || "", bookType: extra.bookType || "", colorStrap: extra.colorStrap || "", hasOwnCarton: extra.hasOwnCarton !== false },
      });
    }

    const next = { ...extra };
    const changes: string[] = [];
    for (const k of Object.keys(allowed)) {
      if (data[k] === undefined) continue;
      const v = String(data[k] || "");
      if (!allowed[k].includes(v)) return errorResponse(`Pilihan ${LABEL[k].toLowerCase()} nggak valid.`);
      if (extra[k] !== v) changes.push(`${LABEL[k]}: ${extra[k] || "-"} → ${v}`);
      next[k] = v;
    }
    if (data.hasOwnCarton !== undefined) {
      const v = String(data.hasOwnCarton) !== "no" && data.hasOwnCarton !== false;
      if ((extra.hasOwnCarton !== false) !== v) changes.push(`${LABEL.hasOwnCarton}: ${v ? "bawa sendiri" : "dibawain admin"}`);
      next.hasOwnCarton = v;
    }
    if (!changes.length) return jsonResponse({ status: "success", message: "Nggak ada yang berubah.", changed: 0 });
    const { error } = await admin.from("registrations").update({ extra: next }).eq("id", rid);
    if (error) return errorResponse("Gagal menyimpan: " + error.message);
    try {
      await sendTelegramText(
        "✏️ *Peserta Ubah Pilihan*\n\n" + `👤 ${name}\n🎨 Upcycle Journal Private Session\n` + changes.map((c) => "• " + c).join("\n"),
        undefined,
        { url: "/admin/#pendaftar:" + encodeURIComponent(reg.workshop_type) + (reg.batch_id ? ":" + encodeURIComponent(reg.batch_id) : "") },
      );
    } catch (_e) { /* best-effort */ }
    return jsonResponse({ status: "success", message: "Pilihanmu udah diperbarui!", changed: changes.length });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
