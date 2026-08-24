import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const STRIPE_PRICE_ID_MONTHLY = Deno.env.get("STRIPE_PRICE_ID_MONTHLY");
const STRIPE_PRICE_ID_ANNUAL = Deno.env.get("STRIPE_PRICE_ID_ANNUAL");

// Checkout web uniquement (US-091) — le mobile passe par RevenueCat/App Store/Google Play.
// Nécessite STRIPE_SECRET_KEY + STRIPE_PRICE_ID_MONTHLY + STRIPE_PRICE_ID_ANNUAL configurés
// dans les secrets Supabase (Dashboard → Edge Functions → Secrets) — pas encore fait à ce stade
// du projet (pas de compte Stripe créé), d'où le MISSING_CONFIG explicite plutôt qu'un crash.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST uniquement" } }, 405);

  if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_ID_MONTHLY || !STRIPE_PRICE_ID_ANNUAL) {
    return json(
      {
        error: {
          code: "MISSING_CONFIG",
          message: "Le paiement Stripe n'est pas encore configuré côté serveur (STRIPE_SECRET_KEY / STRIPE_PRICE_ID_MONTHLY / STRIPE_PRICE_ID_ANNUAL).",
        },
      },
      500
    );
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: { code: "UNAUTHENTICATED", message: "Authorization manquant" } }, 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json({ error: { code: "UNAUTHENTICATED", message: "Session invalide" } }, 401);
  const userId = userData.user.id;
  const userEmail = userData.user.email;

  let body: { plan?: "monthly" | "annual"; success_url?: string; cancel_url?: string } = {};
  try {
    body = await req.json();
  } catch {
    // ignore
  }
  if (body.plan !== "monthly" && body.plan !== "annual") {
    return json({ error: { code: "INVALID_PLAN", message: "plan doit être 'monthly' ou 'annual'." } }, 400);
  }
  if (!body.success_url || !body.cancel_url) {
    return json({ error: { code: "MISSING_URLS", message: "success_url et cancel_url requis." } }, 400);
  }

  const { data: sub } = await supabase.from("subscriptions").select("stripe_customer_id").eq("user_id", userId).maybeSingle();

  let stripeCustomerId = sub?.stripe_customer_id as string | undefined;
  if (!stripeCustomerId) {
    const customerRes = await stripeRequest("/v1/customers", {
      email: userEmail ?? "",
      "metadata[supabase_user_id]": userId,
    });
    if (!customerRes.ok) return json({ error: { code: "STRIPE_ERROR", message: await stripeErrorMessage(customerRes) } }, 502);
    const customer = await customerRes.json();
    stripeCustomerId = customer.id;
    await supabase.from("subscriptions").update({ stripe_customer_id: stripeCustomerId }).eq("user_id", userId);
  }

  const priceId = body.plan === "annual" ? STRIPE_PRICE_ID_ANNUAL : STRIPE_PRICE_ID_MONTHLY;

  const sessionRes = await stripeRequest("/v1/checkout/sessions", {
    mode: "subscription",
    customer: stripeCustomerId!,
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    success_url: body.success_url,
    cancel_url: body.cancel_url,
    "metadata[supabase_user_id]": userId,
  });
  if (!sessionRes.ok) return json({ error: { code: "STRIPE_ERROR", message: await stripeErrorMessage(sessionRes) } }, 502);
  const session = await sessionRes.json();

  return json({ checkout_url: session.url }, 200);
});

async function stripeRequest(path: string, form: Record<string, string>): Promise<Response> {
  return fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(form).toString(),
  });
}

async function stripeErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body?.error?.message ?? `Erreur Stripe (${res.status})`;
  } catch {
    return `Erreur Stripe (${res.status})`;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
}
