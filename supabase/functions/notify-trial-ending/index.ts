import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildPushMessages, sendExpoPushBatch } from "../_shared/push-logic.ts";
import { isTrialEndingReminderDue } from "../_shared/subscription-logic.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Déclenchée par pg_cron chaque matin (verify_jwt désactivé) — rappels J-3 et J-1 avant fin
// d'essai (US-090). Pas de préférence opt-out pour ces deux rappels précis (contrairement aux
// autres notifications) : le tableau des notifications du CdCF les marque explicitement "Non"
// désactivables, ce sont des rappels de facturation, pas du contenu optionnel.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST uniquement" } }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let body: { date?: string } = {};
  try {
    body = await req.json();
  } catch {
    // ignore
  }
  const now = body.date ? new Date(body.date + "T12:00:00Z") : new Date();

  const { data: trialSubs } = await admin.from("subscriptions").select("user_id, trial_ends_at").eq("status", "trial");

  let sentJ3 = 0;
  let sentJ1 = 0;

  for (const sub of trialSubs ?? []) {
    const isJ3 = isTrialEndingReminderDue(sub.trial_ends_at, now, 3);
    const isJ1 = isTrialEndingReminderDue(sub.trial_ends_at, now, 1);
    if (!isJ3 && !isJ1) continue;

    const { data: tokens } = await admin.from("push_tokens").select("expo_push_token").eq("user_id", sub.user_id);
    const messages = buildPushMessages(
      (tokens ?? []).map((t) => t.expo_push_token),
      isJ3 ? "🦡 Votre essai se termine dans 3 jours" : "🦡 Dernier jour d'essai",
      isJ3
        ? "Abonnez-vous dès maintenant pour ne pas perdre l'accès à vos plannings personnalisés."
        : "C'est votre dernier jour d'essai gratuit — abonnez-vous pour continuer sans interruption.",
      { screen: "paywall" }
    );
    if (messages.length > 0) await sendExpoPushBatch(messages);
    if (isJ3) sentJ3++;
    if (isJ1) sentJ1++;
  }

  return json({ trials_checked: trialSubs?.length ?? 0, sent_j3: sentJ3, sent_j1: sentJ1 }, 200);
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
}
