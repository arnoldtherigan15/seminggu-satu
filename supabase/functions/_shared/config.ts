import { SupabaseClient } from "npm:@supabase/supabase-js@2";

// Port dari getConfigValue_/setConfigValue_ -- key-value store generik
// (WORKSHOPS_JSON, IDEAS_JSON, LOYALTY_CLAIMS_JSON, prep__event__type, dst).
export async function getConfigValue(admin: SupabaseClient, key: string): Promise<string | null> {
  const { data } = await admin.from("app_config").select("value").eq("key", key).maybeSingle();
  return data?.value ?? null;
}

export async function setConfigValue(admin: SupabaseClient, key: string, value: string) {
  await admin.from("app_config").upsert({ key, value, updated_at: new Date().toISOString() });
}
