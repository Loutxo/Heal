import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");

// Résiliation web/Stripe uniquement (US-092) — les abonnements mobiles se résilient depuis
// l'App Store / Google Play, l'app y redirige plutôt que de dupliquer ce flux.
// Pas de remboursement au prorata (mention CGV) : l'accès reste actif jusqu'à current_period_end,
// on ne fait qu'annuler le renouvellement (cancel_at_period_end), jamais une annulation immédiate.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST uniquement" } }, 405);

  if (!STRIPE_SECRET_KEY) {
    return json({ error: { code: "MISSING_CONFIG", message: "Le paiement Stripe n'est pas encore configuré côté serveur." } }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: { code: "UNAUTHENTICATED", message: "Authorization manquant" } }, 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json({ error: { code: "UNAUTHENTICATED", message: "Session invalide" } }, 401);
  const userId = userData.user.id;

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();

  if (!sub?.stripe_subscription_id) {
    return json({ error: { code: "NO_STRIPE_SUBSCRIPTION", message: "Aucun abonnement Stripe actif à résilier (peut-être un abonnement mobile — résiliez-le depuis l'App Store / Google Play)." } }, 422);
  }

  const res = await fetch(`https://api.stripe.com/v1/subscriptions/${sub.stripe_subscription_id}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ cancel_at_period_end: "true" }).toString(),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    return json({ error: { code: "STRIPE_ERROR", message: errBody?.error?.message ?? `Erreur Stripe (${res.status})` } }, 502);
  }

  await supabase.from("subscriptions").update({ canceled_at: new Date().toISOString() }).eq("user_id", userId);

  const accessUntil = sub.current_period_end;
  return json(
    {
      message: accessUntil
        ? `Abonnement résilié. Vous gardez l'accès jusqu'au ${accessUntil.slice(0, 10)}.`
        : "Abonnement résilié.",
      access_until: accessUntil,
    },
    200
  );
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
}
