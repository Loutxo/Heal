import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildPushMessages, sendExpoPushBatch } from "../_shared/push-logic.ts";
import { mostRecentSaturday } from "../_shared/weekly-report-logic.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Déclenchée par pg_cron le dimanche ~10h Paris (verify_jwt désactivé) — ne rappelle que les
// utilisateurs qui ont un guide de batch cooking pour la semaine en cours (samedi->vendredi),
// pas ceux qui n'ont pas encore généré leur planning.
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
  const weekStart = mostRecentSaturday(body.date ?? new Date().toISOString().slice(0, 10));

  const { data: plans } = await admin
    .from("meal_plans")
    .select("user_id, batch_cooking_guides!inner(id)")
    .eq("week_start", weekStart);

  let sent = 0;
  for (const plan of plans ?? []) {
    const userId = plan.user_id;
    if (!userId) continue;

    const { data: profile } = await admin.from("user_profiles").select("notif_batch_cooking_reminder").eq("id", userId).maybeSingle();
    if (!profile?.notif_batch_cooking_reminder) continue;

    const { data: tokens } = await admin.from("push_tokens").select("expo_push_token").eq("user_id", userId);
    const messages = buildPushMessages(
      (tokens ?? []).map((t) => t.expo_push_token),
      "🦡 C'est parti pour le batch cooking",
      "Votre guide de préparation du week-end est prêt à suivre.",
      { screen: "batch-cooking" }
    );
    if (messages.length === 0) continue;
    await sendExpoPushBatch(messages);
    sent += messages.length;
  }

  return json({ week_start: weekStart, guides_found: plans?.length ?? 0, notifications_sent: sent }, 200);
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
}
