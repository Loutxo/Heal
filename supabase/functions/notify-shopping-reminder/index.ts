import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildPushMessages, sendExpoPushBatch } from "../_shared/push-logic.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Déclenchée par pg_cron le vendredi ~18h Paris (verify_jwt désactivé) — rappelle de faire les
// courses pour la semaine à venir (qui démarre le samedi) aux utilisateurs opt-in.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST uniquement" } }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: profiles } = await admin.from("user_profiles").select("id").eq("notif_shopping_reminder", true);

  let sent = 0;
  for (const profile of profiles ?? []) {
    const { data: tokens } = await admin.from("push_tokens").select("expo_push_token").eq("user_id", profile.id);
    const messages = buildPushMessages(
      (tokens ?? []).map((t) => t.expo_push_token),
      "🦡 Pensez à vos courses",
      "Votre liste de courses pour la semaine prochaine vous attend.",
      { screen: "shopping-list" }
    );
    if (messages.length === 0) continue;
    await sendExpoPushBatch(messages);
    sent += messages.length;
  }

  return json({ users_opted_in: profiles?.length ?? 0, notifications_sent: sent }, 200);
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
}
