// Vérification de signature Stripe (US-091/US-070 côté paiement) — implémentée nous-mêmes via
// Web Crypto plutôt que d'importer le SDK Stripe complet, pour rester dépendance-légère côté
// Edge Function. Algorithme documenté par Stripe : HMAC-SHA256 de "{timestamp}.{payload}".

export type ParsedStripeSignature = { timestamp: number; signatures: string[] };

export function parseStripeSignatureHeader(header: string): ParsedStripeSignature | null {
  const parts = header.split(",").map((p) => p.trim());
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key === "t") timestamp = parseInt(value, 10);
    else if (key === "v1" && value) signatures.push(value);
  }
  if (timestamp === null || signatures.length === 0) return null;
  return { timestamp, signatures };
}

// nowMs et toleranceSeconds injectables pour rester testable sans dépendre de l'horloge réelle.
export async function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
  nowMs: number = Date.now(),
  toleranceSeconds = 300
): Promise<boolean> {
  const parsed = parseStripeSignatureHeader(signatureHeader);
  if (!parsed) return false;

  const ageSeconds = Math.abs(nowMs / 1000 - parsed.timestamp);
  if (ageSeconds > toleranceSeconds) return false; // protection anti-rejeu

  const expectedSignature = await computeHmacSha256Hex(`${parsed.timestamp}.${payload}`, secret);
  return parsed.signatures.includes(expectedSignature);
}

async function computeHmacSha256Hex(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return [...new Uint8Array(signatureBuffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Traduit un événement Stripe en patch à appliquer sur la ligne `subscriptions` — logique pure
// séparée de la résolution user_id (qui nécessite une requête DB sur stripe_customer_id, faite
// dans l'Edge Function). Retourne null pour les types d'événements non gérés (ignorés sans erreur).
export type StripeSubscriptionPatch = {
  status?: "active" | "past_due" | "canceled";
  plan?: "monthly" | "annual";
  current_period_start?: string;
  current_period_end?: string;
  stripe_subscription_id?: string;
  canceled_at?: string;
};

export function subscriptionPatchForStripeEvent(eventType: string, data: any): StripeSubscriptionPatch | null {
  if (eventType === "checkout.session.completed") {
    return {
      status: "active",
      stripe_subscription_id: data.subscription ?? undefined,
    };
  }
  if (eventType === "invoice.payment_succeeded") {
    const patch: StripeSubscriptionPatch = { status: "active" };
    if (data.period_start) patch.current_period_start = new Date(data.period_start * 1000).toISOString();
    if (data.period_end) patch.current_period_end = new Date(data.period_end * 1000).toISOString();
    return patch;
  }
  if (eventType === "invoice.payment_failed") {
    return { status: "past_due" };
  }
  if (eventType === "customer.subscription.deleted") {
    return { status: "canceled", canceled_at: new Date().toISOString() };
  }
  return null;
}
