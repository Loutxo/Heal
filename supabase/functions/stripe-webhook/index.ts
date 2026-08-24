import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { subscriptionPatchForStripeEvent, verifyStripeSignature } from "../_shared/stripe-webhook-logic.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");

// Reçoit les événements Stripe (verify_jwt désactivé — Stripe n'envoie pas de JWT Supabase,
// l'authenticité est garantie par la signature HMAC vérifiée ci-dessous, jamais sautée).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST uniquement" } }, 405);

  if (!STRIPE_WEBHOOK_SECRET) {
    console.error("STRIPE_WEBHOOK_SECRET non configuré — webhook ignoré.");
    return json({ error: { code: "MISSING_CONFIG", message: "Webhook non configuré côté serveur." } }, 500);
  }

  const signature = req.headers.get("Stripe-Signature");
  if (!signature) return json({ error: { code: "MISSING_SIGNATURE", message: "En-tête Stripe-Signature manquant." } }, 400);

  const rawBody = await req.text();
  const valid = await verifyStripeSignature(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  if (!valid) {
    console.error("STRIPE_SIGNATURE_INVALID");
    return json({ error: { code: "INVALID_SIGNATURE", message: "Signature invalide." } }, 400);
  }

  let event: { type: string; data: { object: any } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: { code: "PARSE_ERROR", message: "Payload non parsable." } }, 400);
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const object = event.data.object;

  // checkout.session.completed porte le user_id dans ses métadonnées (posé par
  // create-checkout-session) — c'est la source la plus fiable pour la toute première activation.
  // Les événements suivants (renouvellement, échec, résiliation) n'ont que le customer Stripe,
  // qu'on résout via stripe_customer_id déjà enregistré lors de l'étape checkout.
  let userId: string | null = object.metadata?.supabase_user_id ?? null;
  if (!userId && object.customer) {
    const { data: sub } = await admin.from("subscriptions").select("user_id").eq("stripe_customer_id", object.customer).maybeSingle();
    userId = sub?.user_id ?? null;
  }

  if (!userId) {
    console.error("STRIPE_WEBHOOK_NO_USER", event.type, object.customer);
    return json({ received: true, note: "user_id introuvable, événement ignoré" }, 200);
  }

  const patch = subscriptionPatchForStripeEvent(event.type, object);
  if (patch) {
    const { error } = await admin.from("subscriptions").update(patch).eq("user_id", userId);
    if (error) console.error("STRIPE_WEBHOOK_UPDATE_ERROR", event.type, userId, error.message);
  }

  return json({ received: true }, 200);
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
}
