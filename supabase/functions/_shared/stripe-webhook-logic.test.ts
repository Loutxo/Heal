import { assertEquals } from "jsr:@std/assert@1";
import { parseStripeSignatureHeader, subscriptionPatchForStripeEvent, verifyStripeSignature } from "./stripe-webhook-logic.ts";

Deno.test("parseStripeSignatureHeader - extrait timestamp et signature v1", () => {
  const parsed = parseStripeSignatureHeader("t=1614556800,v1=abc123,v0=ignored");
  assertEquals(parsed, { timestamp: 1614556800, signatures: ["abc123"] });
});

Deno.test("parseStripeSignatureHeader - plusieurs signatures v1 (rotation de secret)", () => {
  const parsed = parseStripeSignatureHeader("t=1614556800,v1=aaa,v1=bbb");
  assertEquals(parsed, { timestamp: 1614556800, signatures: ["aaa", "bbb"] });
});

Deno.test("parseStripeSignatureHeader - en-tête invalide renvoie null", () => {
  assertEquals(parseStripeSignatureHeader("garbage"), null);
  assertEquals(parseStripeSignatureHeader("t=123"), null);
});

// Signature de référence calculée manuellement pour payload="hello" et secret="whsec_test" avec
// HMAC-SHA256 hex, timestamp=1000 — sert à vérifier l'implémentation contre une valeur connue.
async function computeReferenceSignature(payload: string, secret: string, timestamp: number): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${payload}`));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.test("verifyStripeSignature - accepte une signature valide dans la fenêtre de tolérance", async () => {
  const secret = "whsec_test";
  const payload = "hello";
  const timestamp = 1000;
  const sig = await computeReferenceSignature(payload, secret, timestamp);
  const header = `t=${timestamp},v1=${sig}`;
  const ok = await verifyStripeSignature(payload, header, secret, (timestamp + 60) * 1000);
  assertEquals(ok, true);
});

Deno.test("verifyStripeSignature - rejette une signature incorrecte", async () => {
  const header = "t=1000,v1=deadbeef";
  const ok = await verifyStripeSignature("hello", header, "whsec_test", 1060 * 1000);
  assertEquals(ok, false);
});

Deno.test("verifyStripeSignature - rejette un timestamp trop ancien (anti-rejeu)", async () => {
  const secret = "whsec_test";
  const payload = "hello";
  const timestamp = 1000;
  const sig = await computeReferenceSignature(payload, secret, timestamp);
  const header = `t=${timestamp},v1=${sig}`;
  // 400 secondes plus tard, au-delà de la tolérance par défaut de 300s
  const ok = await verifyStripeSignature(payload, header, secret, (timestamp + 400) * 1000);
  assertEquals(ok, false);
});

Deno.test("verifyStripeSignature - rejette un en-tête mal formé", async () => {
  const ok = await verifyStripeSignature("hello", "garbage", "whsec_test");
  assertEquals(ok, false);
});

Deno.test("subscriptionPatchForStripeEvent - checkout.session.completed active l'abonnement", () => {
  const patch = subscriptionPatchForStripeEvent("checkout.session.completed", { subscription: "sub_123" });
  assertEquals(patch, { status: "active", stripe_subscription_id: "sub_123" });
});

Deno.test("subscriptionPatchForStripeEvent - invoice.payment_succeeded renouvelle la période", () => {
  const patch = subscriptionPatchForStripeEvent("invoice.payment_succeeded", { period_start: 1700000000, period_end: 1702592000 });
  assertEquals(patch?.status, "active");
  assertEquals(patch?.current_period_start, new Date(1700000000 * 1000).toISOString());
  assertEquals(patch?.current_period_end, new Date(1702592000 * 1000).toISOString());
});

Deno.test("subscriptionPatchForStripeEvent - invoice.payment_failed passe en past_due", () => {
  assertEquals(subscriptionPatchForStripeEvent("invoice.payment_failed", {}), { status: "past_due" });
});

Deno.test("subscriptionPatchForStripeEvent - customer.subscription.deleted annule", () => {
  const patch = subscriptionPatchForStripeEvent("customer.subscription.deleted", {});
  assertEquals(patch?.status, "canceled");
  assertEquals(typeof patch?.canceled_at, "string");
});

Deno.test("subscriptionPatchForStripeEvent - événement non géré renvoie null", () => {
  assertEquals(subscriptionPatchForStripeEvent("payment_intent.created", {}), null);
});
