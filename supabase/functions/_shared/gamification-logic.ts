// Logique de gamification pure et testable (calcul de points, streak, badges simples).
// Les conditions de badges qui nécessitent un historique large (légumineuses sur 4 semaines,
// 30 jours sans hors-saison, 4 saisons) restent calculées directement dans l'Edge Function
// via requêtes SQL — trop dépendantes de l'état de la base pour être de bonnes candidates
// à l'extraction en fonction pure.

import { glycemicLevelFromLoad } from "./meal-plan-logic.ts";

export type ValidatedFood = { category_id: number; glycemic_index: number | null; carbs_g: number; quantity_g: number };

const VEGETABLE_CATEGORY = 2;
const FRUIT_CATEGORY = 3;
const LEGUME_CATEGORY = 7;

// Repas conforme au menu Heal (validation 1 clic) : score fixe, l'utilisateur a suivi
// exactement ce qui a été pensé pour lui (CdCF US-060).
export const ONE_CLICK_POINTS = 15;

// Repas saisi manuellement (aliments différents du menu) : 5 à 12 points selon la qualité
// glycémique réelle de ce qui a été mangé, avec un petit bonus si le repas contient des
// légumes/fruits/légumineuses (CdCF US-060 : "5-12 points selon score").
export function scoreManualValidation(foods: ValidatedFood[]): { nutritionalScore: number; points: number; glycemicLoad: number } {
  const glycemicLoad = foods.reduce((sum, f) => sum + ((f.glycemic_index ?? 0) * (f.carbs_g * f.quantity_g / 100)) / 100, 0);
  const level = glycemicLevelFromLoad(glycemicLoad);
  const basePoints = level === "low" ? 11 : level === "moderate" ? 8 : 5;
  const hasPlantFood = foods.some((f) => [VEGETABLE_CATEGORY, FRUIT_CATEGORY, LEGUME_CATEGORY].includes(f.category_id));
  const points = Math.max(5, Math.min(12, basePoints + (hasPlantFood ? 1 : 0)));
  // score nutritionnel indicatif sur 100, dérivé du niveau glycémique — sert d'affichage,
  // pas de recalcul indépendant des points.
  const nutritionalScore = level === "low" ? 85 : level === "moderate" ? 60 : 35;
  return { nutritionalScore, points, glycemicLoad };
}

export type MealTypeShort = "breakfast" | "lunch" | "snack" | "dinner";

// Un jour compte pour le streak s'il y a au moins 2 repas validés ce jour-là, dont au moins
// un repas "principal" (déjeuner ou dîner) — CdCF US-062.
export function qualifiesStreakDay(validatedMealTypesForDay: MealTypeShort[]): boolean {
  const hasMainMeal = validatedMealTypesForDay.some((t) => t === "lunch" || t === "dinner");
  return validatedMealTypesForDay.length >= 2 && hasMainMeal;
}

export type StreakState = { currentStreak: number; maxStreak: number; lastActiveDate: string | null };

// Transition pure du streak pour un nouveau jour qualifiant. bonusPoints n'est attribué que
// le jour où le palier est franchi pour la première fois (pas à chaque jour au-delà).
export function nextStreakState(state: StreakState, qualifyingDate: string): StreakState & { bonusPoints: number } {
  if (state.lastActiveDate === qualifyingDate) {
    // déjà comptabilisé aujourd'hui (deuxième validation du même jour qui fait franchir le seuil) —
    // pas de changement d'état, pas de bonus redondant.
    return { ...state, bonusPoints: 0 };
  }

  const isConsecutive = state.lastActiveDate !== null && addOneDay(state.lastActiveDate) === qualifyingDate;
  const currentStreak = isConsecutive ? state.currentStreak + 1 : 1;
  const maxStreak = Math.max(state.maxStreak, currentStreak);
  const bonusPoints = currentStreak === 7 ? 10 : currentStreak === 3 ? 5 : 0;

  return { currentStreak, maxStreak, lastActiveDate: qualifyingDate, bonusPoints };
}

function addOneDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// --- Conditions de badges simples, exprimées comme fonctions pures sur des compteurs déjà
// calculés par l'Edge Function (nombre de repas validés, etc.) ---

export function hasReachedMealCount(totalValidatedMeals: number, requiredCount: number): boolean {
  return totalValidatedMeals >= requiredCount;
}

export function hasReachedStreak(currentStreak: number, requiredDays: number): boolean {
  return currentStreak >= requiredDays;
}

export function isPerfectWeek(validatedMealsPerDay: number[]): boolean {
  // 7 jours × 3 repas validés (au moins) — CdCF "Semaine parfaite".
  return validatedMealsPerDay.length >= 7 && validatedMealsPerDay.every((n) => n >= 3);
}

export function hasEnoughVegetableMeals(mealsWithVegetablePortions: number[], requiredMeals: number, minPortions: number): boolean {
  return mealsWithVegetablePortions.filter((portions) => portions >= minPortions).length >= requiredMeals;
}

export function hasEnoughOmega3MealsThisWeek(omega3MealsThisWeek: number, requiredMeals: number): boolean {
  return omega3MealsThisWeek >= requiredMeals;
}

export function hasEnoughActiveDays(activeDaysCount: number, requiredDays: number): boolean {
  return activeDaysCount >= requiredDays;
}
