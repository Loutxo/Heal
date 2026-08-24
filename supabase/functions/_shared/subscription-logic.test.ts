import { assertEquals } from "jsr:@std/assert@1";
import { daysUntilTrialEnd, hasActiveAccess, isTrialEndingReminderDue, shouldShowTrialCountdown } from "./subscription-logic.ts";

const NOW = new Date("2026-08-24T12:00:00Z");

Deno.test("hasActiveAccess - null (pas de ligne subscriptions) refuse l'accès", () => {
  assertEquals(hasActiveAccess(null, NOW), false);
});

Deno.test("hasActiveAccess - essai en cours autorise l'accès", () => {
  assertEquals(hasActiveAccess({ status: "trial", trial_ends_at: "2026-09-01T00:00:00Z", current_period_end: null }, NOW), true);
});

Deno.test("hasActiveAccess - essai expiré refuse l'accès", () => {
  assertEquals(hasActiveAccess({ status: "trial", trial_ends_at: "2026-08-20T00:00:00Z", current_period_end: null }, NOW), false);
});

Deno.test("hasActiveAccess - abonnement actif autorise l'accès", () => {
  assertEquals(hasActiveAccess({ status: "active", trial_ends_at: "2026-08-01T00:00:00Z", current_period_end: "2026-09-24T00:00:00Z" }, NOW), true);
});

Deno.test("hasActiveAccess - past_due garde l'accès (Stripe retente le paiement)", () => {
  assertEquals(hasActiveAccess({ status: "past_due", trial_ends_at: "2026-08-01T00:00:00Z", current_period_end: "2026-08-24T00:00:00Z" }, NOW), true);
});

Deno.test("hasActiveAccess - canceled refuse l'accès", () => {
  assertEquals(hasActiveAccess({ status: "canceled", trial_ends_at: "2026-08-01T00:00:00Z", current_period_end: "2026-08-24T00:00:00Z" }, NOW), false);
});

Deno.test("hasActiveAccess - expired refuse l'accès", () => {
  assertEquals(hasActiveAccess({ status: "expired", trial_ends_at: "2026-08-01T00:00:00Z", current_period_end: null }, NOW), false);
});

Deno.test("daysUntilTrialEnd - arrondit au jour supérieur", () => {
  assertEquals(daysUntilTrialEnd("2026-08-27T12:00:00Z", NOW), 3);
  assertEquals(daysUntilTrialEnd("2026-08-27T13:00:00Z", NOW), 4);
});

Deno.test("daysUntilTrialEnd - négatif si déjà expiré", () => {
  assertEquals(daysUntilTrialEnd("2026-08-20T12:00:00Z", NOW), -4);
});

Deno.test("shouldShowTrialCountdown - visible à partir de J-7 (US-090)", () => {
  assertEquals(shouldShowTrialCountdown("2026-08-31T12:00:00Z", NOW), true); // J-7
  assertEquals(shouldShowTrialCountdown("2026-09-05T12:00:00Z", NOW), false); // J-12, trop tôt
});

Deno.test("shouldShowTrialCountdown - toujours visible pendant la fenêtre J-7 à J-0", () => {
  assertEquals(shouldShowTrialCountdown("2026-08-24T12:00:00Z", NOW), true); // J-0
});

Deno.test("shouldShowTrialCountdown - masqué une fois l'essai expiré (le paywall prend le relais)", () => {
  assertEquals(shouldShowTrialCountdown("2026-08-20T12:00:00Z", NOW), false);
});

Deno.test("isTrialEndingReminderDue - déclenche exactement à J-3 et J-1", () => {
  assertEquals(isTrialEndingReminderDue("2026-08-27T12:00:00Z", NOW, 3), true);
  assertEquals(isTrialEndingReminderDue("2026-08-25T12:00:00Z", NOW, 1), true);
  assertEquals(isTrialEndingReminderDue("2026-08-27T12:00:00Z", NOW, 1), false);
});
