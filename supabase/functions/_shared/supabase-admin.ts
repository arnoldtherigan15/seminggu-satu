import { createClient } from "npm:@supabase/supabase-js@2";

// Service role client -- BYPASS RLS sepenuhnya. Cuma dipakai di sisi server
// (Edge Function), SUPABASE_SERVICE_ROLE_KEY otomatis disuntik Supabase,
// nggak pernah nyampe browser/frontend.
export function supabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}
