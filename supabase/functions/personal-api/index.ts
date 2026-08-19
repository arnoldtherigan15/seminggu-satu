// Personal finance tracker Arnold -- GA ADA hubungannya sama bisnis
// Seminggu Satu, numpang di admin dashboard yang sama biar ga perlu
// login/hosting terpisah. Auth reuse token admin yang sama
// (requireAdminAuth) -- sama pola kayak admin-api, 1 action = 1 case.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { requireAdminAuth } from "../_shared/admin-auth.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const data = await req.json();
    const action = String(data.action || "");
    const admin = supabaseAdmin();

    try {
      await requireAdminAuth(admin, String(data.token || ""));
    } catch (e) {
      return errorResponse((e as Error).message, 401);
    }

    switch (action) {
      case "getPersonalData": {
        const [accRes, catRes, txRes] = await Promise.all([
          admin.from("personal_accounts").select("*").order("created_at", { ascending: true }),
          admin.from("personal_categories").select("*").order("created_at", { ascending: true }),
          admin.from("personal_transactions").select("*").order("date", { ascending: false }).order("created_at", { ascending: false }),
        ]);
        return jsonResponse({
          status: "success",
          accounts: accRes.data || [],
          categories: catRes.data || [],
          transactions: txRes.data || [],
        });
      }

      case "savePersonalAccount": {
        const id = String(data.id || "");
        const name = String(data.name || "").trim();
        if (!name) return errorResponse("Nama akun wajib diisi.");
        const payload = {
          name,
          type: String(data.type || "cash"),
          initial_balance: Math.round(Number(data.initialBalance) || 0),
          color: data.color ? String(data.color) : null,
        };
        if (id) {
          const { error } = await admin.from("personal_accounts").update(payload).eq("id", id);
          if (error) return errorResponse("Gagal update akun: " + error.message);
        } else {
          const { error } = await admin.from("personal_accounts").insert(payload);
          if (error) return errorResponse("Gagal bikin akun: " + error.message);
        }
        return jsonResponse({ status: "success", message: "Akun tersimpan." });
      }

      case "archivePersonalAccount": {
        const id = String(data.id || "");
        if (!id) return errorResponse("ID akun kosong.");
        const { error } = await admin.from("personal_accounts").update({ archived: !!data.archived }).eq("id", id);
        if (error) return errorResponse("Gagal update akun: " + error.message);
        return jsonResponse({ status: "success" });
      }

      case "deletePersonalAccount": {
        const id = String(data.id || "");
        if (!id) return errorResponse("ID akun kosong.");
        const { count } = await admin.from("personal_transactions").select("id", { count: "exact", head: true })
          .or(`account_id.eq.${id},to_account_id.eq.${id}`);
        if ((count ?? 0) > 0) return errorResponse("Akun ini masih punya transaksi -- pindahin/hapus transaksinya dulu, atau arsipkan aja akunnya.");
        const { error } = await admin.from("personal_accounts").delete().eq("id", id);
        if (error) return errorResponse("Gagal hapus akun: " + error.message);
        return jsonResponse({ status: "success", message: "Akun dihapus." });
      }

      case "savePersonalCategory": {
        const id = String(data.id || "");
        const name = String(data.name || "").trim();
        const type = String(data.type || "");
        if (!name) return errorResponse("Nama kategori wajib diisi.");
        if (type !== "income" && type !== "expense") return errorResponse("Tipe kategori nggak dikenal.");
        const payload = {
          name, type,
          color: data.color ? String(data.color) : null,
          icon: data.icon ? String(data.icon) : null,
        };
        if (id) {
          const { error } = await admin.from("personal_categories").update(payload).eq("id", id);
          if (error) return errorResponse("Gagal update kategori: " + error.message);
        } else {
          const { error } = await admin.from("personal_categories").insert(payload);
          if (error) return errorResponse("Gagal bikin kategori: " + error.message);
        }
        return jsonResponse({ status: "success", message: "Kategori tersimpan." });
      }

      case "archivePersonalCategory": {
        const id = String(data.id || "");
        if (!id) return errorResponse("ID kategori kosong.");
        const { error } = await admin.from("personal_categories").update({ archived: !!data.archived }).eq("id", id);
        if (error) return errorResponse("Gagal update kategori: " + error.message);
        return jsonResponse({ status: "success" });
      }

      case "deletePersonalCategory": {
        const id = String(data.id || "");
        if (!id) return errorResponse("ID kategori kosong.");
        const { count } = await admin.from("personal_transactions").select("id", { count: "exact", head: true }).eq("category_id", id);
        if ((count ?? 0) > 0) return errorResponse("Kategori ini masih dipakai transaksi -- ganti kategorinya dulu, atau arsipkan aja.");
        const { error } = await admin.from("personal_categories").delete().eq("id", id);
        if (error) return errorResponse("Gagal hapus kategori: " + error.message);
        return jsonResponse({ status: "success", message: "Kategori dihapus." });
      }

      case "savePersonalTransaction": {
        const id = String(data.id || "");
        const type = String(data.type || "");
        if (!["income", "expense", "transfer"].includes(type)) return errorResponse("Tipe transaksi nggak dikenal.");
        const amount = Math.round(Number(data.amount) || 0);
        if (amount <= 0) return errorResponse("Jumlah harus lebih dari 0.");
        const accountId = String(data.accountId || "");
        if (!accountId) return errorResponse("Akun wajib dipilih.");
        const date = String(data.date || "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return errorResponse("Tanggal nggak valid.");

        let toAccountId: string | null = null;
        let categoryId: string | null = null;
        if (type === "transfer") {
          toAccountId = String(data.toAccountId || "");
          if (!toAccountId) return errorResponse("Akun tujuan wajib dipilih buat transfer.");
          if (toAccountId === accountId) return errorResponse("Akun asal & tujuan transfer nggak boleh sama.");
        } else {
          categoryId = data.categoryId ? String(data.categoryId) : null;
        }

        const payload = {
          date, type, amount,
          account_id: accountId,
          to_account_id: toAccountId,
          category_id: categoryId,
          note: data.note ? String(data.note).slice(0, 300) : null,
        };
        if (id) {
          // "source" sengaja NGGAK ikut di-update -- biar transaksi yang asalnya
          // dari Impor AI tetap kecatat provenance-nya walau isinya diedit manual.
          const { error } = await admin.from("personal_transactions").update(payload).eq("id", id);
          if (error) return errorResponse("Gagal update transaksi: " + error.message);
        } else {
          const source = data.source === "screenshot" ? "screenshot" : "manual";
          const { error } = await admin.from("personal_transactions").insert({ ...payload, source });
          if (error) return errorResponse("Gagal simpan transaksi: " + error.message);
        }
        return jsonResponse({ status: "success", message: "Transaksi tersimpan." });
      }

      case "parseImportImage": {
        const imageBase64 = String(data.imageBase64 || "");
        const mimeType = String(data.mimeType || "image/jpeg");
        if (!imageBase64) return errorResponse("Gambar kosong.");

        const geminiKey = Deno.env.get("GEMINI_API_KEY");
        if (!geminiKey) return errorResponse("GEMINI_API_KEY belum diset di server.");

        const catRes = await admin.from("personal_categories").select("name,type").eq("archived", false);
        const categories = catRes.data || [];
        const incomeNames = categories.filter((c) => c.type === "income").map((c) => c.name);
        const expenseNames = categories.filter((c) => c.type === "expense").map((c) => c.name);

        const prompt = `Kamu bertugas membaca screenshot riwayat transaksi atau struk pembayaran (e-wallet/bank/marketplace) dan mengekstrak SEMUA transaksi yang terlihat di gambar ini menjadi data terstruktur.

Untuk setiap transaksi, tentukan:
- date: tanggal transaksi format YYYY-MM-DD. Kalau tahun tidak terlihat langsung di baris transaksi tapi terlihat di header grup di atasnya (mis. "Agustus 2026"), pakai tahun itu.
- description: deskripsi singkat (nama merchant/keterangan transaksi apa adanya dari gambar)
- amount: jumlah dalam Rupiah, angka bulat POSITIF saja (tanpa "Rp", tanpa titik/koma pemisah ribuan)
- type: "income" kalau dana MASUK (biasanya ditandai warna hijau / tanda "+"), "expense" kalau dana KELUAR (biasanya warna hitam/merah / tanda "-")
- categoryGuess: tebak kategori yang PALING cocok dari daftar berikut (harus sama persis salah satu dari daftar sesuai tipenya, atau null kalau tidak yakin):
  Kategori income: ${JSON.stringify(incomeNames)}
  Kategori expense: ${JSON.stringify(expenseNames)}

Abaikan elemen UI yang bukan transaksi (judul halaman, filter, tombol navigasi, saldo, dsb). Kalau gambar tidak berisi transaksi finansial sama sekali, kembalikan array kosong.`;

        const schema = {
          type: "OBJECT",
          properties: {
            transactions: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  date: { type: "STRING" },
                  description: { type: "STRING" },
                  amount: { type: "NUMBER" },
                  type: { type: "STRING", enum: ["income", "expense"] },
                  categoryGuess: { type: "STRING", nullable: true },
                },
                required: ["date", "description", "amount", "type"],
              },
            },
          },
          required: ["transactions"],
        };

        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${geminiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{
                  parts: [
                    { inlineData: { mimeType, data: imageBase64 } },
                    { text: prompt },
                  ],
                }],
                generationConfig: {
                  responseMimeType: "application/json",
                  responseSchema: schema,
                },
              }),
            },
          );
          const json = await res.json();
          if (!res.ok) {
            return errorResponse("Gagal memproses gambar: " + (json?.error?.message || res.statusText));
          }
          const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) return errorResponse("AI tidak mengembalikan hasil yang bisa dibaca.");
          let parsed: { transactions?: unknown };
          try {
            parsed = JSON.parse(text);
          } catch {
            return errorResponse("Gagal baca hasil dari AI.");
          }
          const transactions = Array.isArray(parsed.transactions) ? parsed.transactions : [];
          return jsonResponse({ status: "success", transactions });
        } catch (e) {
          return errorResponse("Gagal terhubung ke layanan AI: " + (e as Error).message);
        }
      }

      case "deletePersonalTransaction": {
        const id = String(data.id || "");
        if (!id) return errorResponse("ID transaksi kosong.");
        const { error } = await admin.from("personal_transactions").delete().eq("id", id);
        if (error) return errorResponse("Gagal hapus transaksi: " + error.message);
        return jsonResponse({ status: "success", message: "Transaksi dihapus." });
      }

      default:
        return errorResponse("Aksi tidak dikenal: " + action);
    }
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
