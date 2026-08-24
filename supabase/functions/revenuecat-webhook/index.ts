import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const REVENUECAT_WEBHOOK_SECRET = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");

// Reçoit les événements RevenueCat (abonnements mobiles App Store/Google Play). RevenueCat
// authentifie ses webhooks via un secret partagé qu'on choisit soi-même dans son dashboard et
// qu'il renvoie tel quel en "Authorization: Bearer <secret>" — pas de signature HMAC comme Stripe.
// Suppose que l'app mobile initialise le SDK RevenueCat avec app_user_id = l'id utilisateur
// Supabase (convention d'intégration standard), pas encore câblé côté app (RevenueCat SDK non
// installé — cf. décision de reporter le paiement mobile tant que le compte RevenueCat n'existe pas).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST uniquement" } }, 405);

  if (!REVENUECAT_WEBHOOK_SECRET) {
    console.error("REVENUECAT_WEBHOOK_SECRET non configuré — webhook ignoré.");
    return json({ error: { code: "MISSING_CONFIG", message: "Webhook non configuré côté serveur." } }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${REVENUECAT_WEBHOOK_SECRET}`) {
    return json({ error: { code: "UNAUTHORIZED", message: "Secret invalide." } }, 401);
  }

  let body: { event?: { type?: string; app_user_id?: string; expiration_at_ms?: number; original_app_user_id?: string } } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: { code: "PARSE_ERROR", message: "Payload non parsable." } }, 400);
  }

  const event = body.event;
  if (!event?.type || !event.app_user_id) {
    return json({ received: true, note: "événement incomplet, ignoré" }, 200);
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const userId = event.app_user_id;

  const patch: Record<string, unknown> = { revenuecat_user_id: userId };
  if (event.type === "INITIAL_PURCHASE" || event.type === "RENEWAL") {
    patch.status = "active";
    if (event.expiration_at_ms) patch.current_period_end = new Date(event.expiration_at_ms).toISOString();
  } else if (event.type === "CANCELLATION") {
    patch.canceled_at = new Date().toISOString();
    // La résiliation RevenueCat n'arrête pas l'accès immédiatement (comme Stripe) — le statut
    // reste 'active' jusqu'à EXPIRATION, qui arrive à la fin de la période déjà payée.
  } else if (event.type === "EXPIRATION") {
    patch.status = "expired";
  } else {
    return json({ received: true, note: `type d'événement non géré: ${event.type}` }, 200);
  }

  const { error } = await admin.from("subscriptions").update(patch).eq("user_id", userId);
  if (error) console.error("REVENUECAT_WEBHOOK_UPDATE_ERROR", event.type, userId, error.message);

  return json({ received: true }, 200);
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
}
