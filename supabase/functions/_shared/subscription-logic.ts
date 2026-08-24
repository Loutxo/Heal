// Logique pure d'accès abonné (US-090/091/092) — testable sans dépendre de la BDD/Stripe/RevenueCat.

export type SubscriptionStatus = "trial" | "active" | "past_due" | "canceled" | "expired";

export type SubscriptionRecord = {
  status: SubscriptionStatus;
  trial_ends_at: string;
  current_period_end: string | null;
};

// 'past_due' garde l'accès (Stripe retente le paiement automatiquement pendant quelques jours,
// couper l'accès immédiatement pénaliserait un simple échec de carte temporaire) — seuls
// 'canceled' et 'expired' bloquent, ainsi qu'un essai dont la date est dépassée.
export function hasActiveAccess(sub: SubscriptionRecord | null, now: Date): boolean {
  if (!sub) return false;
  if (sub.status === "canceled" || sub.status === "expired") return false;
  if (sub.status === "trial") return now < new Date(sub.trial_ends_at);
  return true; // active | past_due
}

// Nombre de jours restants d'essai, arrondi au jour supérieur (US-090 : indicateur affiché à
// partir de J-7). Négatif si l'essai est déjà expiré.
export function daysUntilTrialEnd(trialEndsAt: string, now: Date): number {
  const diffMs = new Date(trialEndsAt).getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function shouldShowTrialCountdown(trialEndsAt: string, now: Date): boolean {
  const days = daysUntilTrialEnd(trialEndsAt, now);
  return days <= 7 && days >= 0;
}

// Un essai est "à J-3" ou "à J-1" le jour calendaire exact (pas une fenêtre) — évite de renvoyer
// le rappel plusieurs jours de suite si le cron tourne une fois par jour à heure fixe.
export function isTrialEndingReminderDue(trialEndsAt: string, now: Date, daysBefore: 1 | 3): boolean {
  return daysUntilTrialEnd(trialEndsAt, now) === daysBefore;
}

// Effet de bord DB (non testé unitairement, comme les autres appels I/O des Edge Functions) —
// appelé par chaque fonction nécessitant un abonnement actif juste après la résolution du JWT.
export async function fetchSubscriptionAccess(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("subscriptions")
    .select("status, trial_ends_at, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  return hasActiveAccess(data, new Date());
}
