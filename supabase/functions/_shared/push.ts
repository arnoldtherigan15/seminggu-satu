// Port dari sendPush_() -- OneSignal push notification. ONESIGNAL_APP_ID
// aman publik (udah ada di env.js), tapi ONESIGNAL_REST_KEY WAJIB lewat
// secret (Deno.env), JANGAN PERNAH di-hardcode di sini -- beda dari
// Google_Script_Code.js yang gitignored, folder ini KE-COMMIT ke git.
// deno-lint-ignore no-explicit-any
export async function sendPush(heading: string, message: string, url?: string, excludeWa?: string, filters?: any[]) {
  try {
    const appId = Deno.env.get("ONESIGNAL_APP_ID");
    const key = Deno.env.get("ONESIGNAL_REST_KEY");
    if (!appId || !key) return; // belum dikonfigurasi -> diem aja

    // deno-lint-ignore no-explicit-any
    const payload: any = {
      app_id: appId,
      headings: { en: heading },
      contents: { en: message },
      url: url || "https://seminggusatu.com/warga/",
    };

    const waDigits = String(excludeWa || "").replace(/\D/g, "");
    // deno-lint-ignore no-explicit-any
    let base: any[] = [];
    if (filters && filters.length) {
      base = filters;
    } else if (waDigits) {
      base = [
        { field: "tag", key: "wa", relation: "!=", value: waDigits },
        { operator: "OR" },
        { field: "tag", key: "wa", relation: "not_exists" },
      ];
    }
    // Mode istirahat (warga/main.js setRest): subscription bertag "rest" NGGAK
    // dikirimin push apa pun. Filter OneSignal: kondisi berurutan = AND, "OR"
    // misahin grup -> syarat rest not_exists ditempel ke TIAP grup OR.
    const NOT_RESTING = { field: "tag", key: "rest", relation: "not_exists" };
    if (!base.length) {
      payload.filters = [NOT_RESTING];
    } else {
      // deno-lint-ignore no-explicit-any
      const out: any[] = [];
      for (const f of base) {
        if (f && f.operator === "OR") { out.push(NOT_RESTING, f); } else out.push(f);
      }
      out.push(NOT_RESTING);
      payload.filters = out;
    }

    await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${key}` },
      body: JSON.stringify(payload),
    });
  } catch (_e) {
    // push gagal jangan ganggu alur utama
  }
}
