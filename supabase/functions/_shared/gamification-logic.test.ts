import { assertEquals } from "jsr:@std/assert@1";
import {
  hasEnoughActiveDays,
  hasEnoughOmega3MealsThisWeek,
  hasEnoughVegetableMeals,
  hasReachedMealCount,
  hasReachedStreak,
  isPerfectWeek,
  nextStreakState,
  qualifiesStreakDay,
  scoreManualValidation,
} from "./gamification-logic.ts";

// ---- scoreManualValidation ----

Deno.test("scoreManualValidation - repas à faible charge glycémique avec légume : points au max (12)", () => {
  const r = scoreManualValidation([
    { category_id: 2, glycemic_index: 15, carbs_g: 4, quantity_g: 150 }, // légume, GI bas
  ]);
  assertEquals(r.points, 12);
});

Deno.test("scoreManualValidation - repas à charge glycémique élevée sans légume : points au minimum (5)", () => {
  const r = scoreManualValidation([
    { category_id: 8, glycemic_index: 78, carbs_g: 17, quantity_g: 300 }, // féculent IG élevé, grosse portion
  ]);
  assertEquals(r.points, 5);
});

Deno.test("scoreManualValidation - jamais en-dehors de la fourchette 5-12 du CdCF", () => {
  const extreme = scoreManualValidation([{ category_id: 8, glycemic_index: 100, carbs_g: 50, quantity_g: 500 }]);
  assertEquals(extreme.points >= 5 && extreme.points <= 12, true);
});

// ---- qualifiesStreakDay ----

Deno.test("qualifiesStreakDay - 2 repas dont un principal : jour valide", () => {
  assertEquals(qualifiesStreakDay(["breakfast", "dinner"]), true);
});

Deno.test("qualifiesStreakDay - 2 repas mais aucun principal : jour invalide", () => {
  assertEquals(qualifiesStreakDay(["breakfast", "snack"]), false);
});

Deno.test("qualifiesStreakDay - un seul repas même principal : jour invalide", () => {
  assertEquals(qualifiesStreakDay(["dinner"]), false);
});

// ---- nextStreakState ----

Deno.test("nextStreakState - premier jour jamais actif : streak à 1", () => {
  const r = nextStreakState({ currentStreak: 0, maxStreak: 0, lastActiveDate: null }, "2026-08-24");
  assertEquals(r.currentStreak, 1);
  assertEquals(r.bonusPoints, 0);
});

Deno.test("nextStreakState - jour consécutif : streak incrémenté", () => {
  const r = nextStreakState({ currentStreak: 1, maxStreak: 1, lastActiveDate: "2026-08-24" }, "2026-08-25");
  assertEquals(r.currentStreak, 2);
});

Deno.test("nextStreakState - jour manqué (saut) : streak repart à 1, pas de bonus", () => {
  const r = nextStreakState({ currentStreak: 5, maxStreak: 5, lastActiveDate: "2026-08-20" }, "2026-08-25");
  assertEquals(r.currentStreak, 1);
  assertEquals(r.bonusPoints, 0);
});

Deno.test("nextStreakState - atteint exactement 3 jours : bonus de 5 points", () => {
  const r = nextStreakState({ currentStreak: 2, maxStreak: 2, lastActiveDate: "2026-08-23" }, "2026-08-24");
  assertEquals(r.currentStreak, 3);
  assertEquals(r.bonusPoints, 5);
});

Deno.test("nextStreakState - atteint exactement 7 jours : bonus de 10 points", () => {
  const r = nextStreakState({ currentStreak: 6, maxStreak: 6, lastActiveDate: "2026-08-23" }, "2026-08-24");
  assertEquals(r.currentStreak, 7);
  assertEquals(r.bonusPoints, 10);
});

Deno.test("nextStreakState - 4e jour (après le palier 3) : pas de bonus redondant", () => {
  const r = nextStreakState({ currentStreak: 3, maxStreak: 3, lastActiveDate: "2026-08-23" }, "2026-08-24");
  assertEquals(r.currentStreak, 4);
  assertEquals(r.bonusPoints, 0);
});

Deno.test("nextStreakState - même jour revalidé deux fois : idempotent, pas de double comptage", () => {
  const r = nextStreakState({ currentStreak: 2, maxStreak: 2, lastActiveDate: "2026-08-24" }, "2026-08-24");
  assertEquals(r.currentStreak, 2);
  assertEquals(r.bonusPoints, 0);
});

Deno.test("nextStreakState - maxStreak ne redescend jamais après un reset", () => {
  const r = nextStreakState({ currentStreak: 8, maxStreak: 8, lastActiveDate: "2026-08-15" }, "2026-08-20");
  assertEquals(r.currentStreak, 1);
  assertEquals(r.maxStreak, 8);
});

// ---- badges simples ----

Deno.test("hasReachedMealCount / hasReachedStreak - bornes", () => {
  assertEquals(hasReachedMealCount(1, 1), true);
  assertEquals(hasReachedMealCount(0, 1), false);
  assertEquals(hasReachedStreak(3, 3), true);
  assertEquals(hasReachedStreak(2, 3), false);
});

Deno.test("isPerfectWeek - 7 jours à 3 repas ou plus", () => {
  assertEquals(isPerfectWeek([3, 3, 3, 3, 3, 3, 3]), true);
  assertEquals(isPerfectWeek([3, 3, 3, 2, 3, 3, 3]), false);
  assertEquals(isPerfectWeek([3, 3, 3, 3, 3, 3]), false); // seulement 6 jours
});

Deno.test("hasEnoughVegetableMeals - compte seulement les repas avec assez de portions", () => {
  assertEquals(hasEnoughVegetableMeals([2, 2, 1, 3, 2], 4, 2), true); // 4 repas à >=2 portions
  assertEquals(hasEnoughVegetableMeals([2, 1, 1, 3, 2], 4, 2), false); // seulement 3
});

Deno.test("hasEnoughOmega3MealsThisWeek / hasEnoughActiveDays - bornes", () => {
  assertEquals(hasEnoughOmega3MealsThisWeek(3, 3), true);
  assertEquals(hasEnoughOmega3MealsThisWeek(2, 3), false);
  assertEquals(hasEnoughActiveDays(30, 30), true);
  assertEquals(hasEnoughActiveDays(29, 30), false);
});
