import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildPushMessages, sendExpoPushBatch } from "../_shared/push-logic.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Déclenchée par pg_cron chaque soir ~19h Paris (verify_jwt désactivé, cf. migration
// schedule_notification_crons) — rappelle le dîner du soir aux utilisateurs opt-in.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST uniquement" } }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let body: { date?: string } = {};
  try {
    body = await req.json();
  } catch {
    // ignore, body optionnel
  }
  const todayISO = body.date ?? new Date().toISOString().slice(0, 10);

  const { data: dinners } = await admin
    .from("meals")
    .select("name, meal_plans(user_id)")
    .eq("meal_type", "dinner")
    .eq("meal_date", todayISO);

  let sent = 0;
  for (const dinner of dinners ?? []) {
    const userId = (dinner as any).meal_plans?.user_id;
    if (!userId) continue;

    const { data: profile } = await admin.from("user_profiles").select("notif_dinner_reminder").eq("id", userId).maybeSingle();
    if (!profile?.notif_dinner_reminder) continue;

    const { data: tokens } = await admin.from("push_tokens").select("expo_push_token").eq("user_id", userId);
    const messages = buildPushMessages(
      (tokens ?? []).map((t) => t.expo_push_token),
      "🦡 C'est l'heure du dîner",
      `Ce soir : ${dinner.name}`,
      { screen: "planning" }
    );
    if (messages.length === 0) continue;
    await sendExpoPushBatch(messages);
    sent += messages.length;
  }

  return json({ date: todayISO, dinners_found: dinners?.length ?? 0, notifications_sent: sent }, 200);
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
}
