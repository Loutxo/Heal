import { assertEquals, assertAlmostEquals } from "jsr:@std/assert@1";
import { averageGlycemicLoad, basileAdviceForReport, foodDiversityScore, mostRecentSaturday, pickTopMeals } from "./weekly-report-logic.ts";

Deno.test("mostRecentSaturday - un samedi renvoie lui-même", () => {
  assertEquals(mostRecentSaturday("2026-08-29"), "2026-08-29"); // 29 août 2026 est un samedi
});

Deno.test("mostRecentSaturday - un vendredi renvoie le samedi précédent (6 jours avant)", () => {
  assertEquals(mostRecentSaturday("2026-09-04"), "2026-08-29");
});

Deno.test("mostRecentSaturday - un dimanche renvoie le samedi de la veille", () => {
  assertEquals(mostRecentSaturday("2026-08-30"), "2026-08-29");
});

Deno.test("averageGlycemicLoad - moyenne simple", () => {
  assertAlmostEquals(averageGlycemicLoad([10, 20, 30]), 20);
});

Deno.test("averageGlycemicLoad - liste vide renvoie 0", () => {
  assertEquals(averageGlycemicLoad([]), 0);
});

Deno.test("foodDiversityScore - compte les catégories distinctes", () => {
  assertEquals(foodDiversityScore([2, 2, 3, 5, 5, 5, 7]), 4);
});

Deno.test("foodDiversityScore - liste vide", () => {
  assertEquals(foodDiversityScore([]), 0);
});

Deno.test("pickTopMeals - garde les 3 meilleurs scores, triés décroissant", () => {
  const meals = [
    { id: "a", score: 50 },
    { id: "b", score: 90 },
    { id: "c", score: 70 },
    { id: "d", score: 60 },
  ];
  assertEquals(pickTopMeals(meals), ["b", "c", "d"]);
});

Deno.test("pickTopMeals - moins de repas que le count demandé", () => {
  const meals = [{ id: "a", score: 50 }];
  assertEquals(pickTopMeals(meals, 3), ["a"]);
});

Deno.test("basileAdviceForReport - aucun repas validé", () => {
  const advice = basileAdviceForReport({ mealsValidated: 0, mealsTotal: 21, glycemicLevel: "low", foodDiversity: 8 });
  assertEquals(advice.includes("aucun repas n'a été validé"), true);
});

Deno.test("basileAdviceForReport - taux de validation faible prime sur le reste", () => {
  const advice = basileAdviceForReport({ mealsValidated: 5, mealsTotal: 21, glycemicLevel: "low", foodDiversity: 8 });
  assertEquals(advice.includes("moins de la moitié"), true);
});

Deno.test("basileAdviceForReport - charge élevée + faible diversité combine les deux conseils", () => {
  const advice = basileAdviceForReport({ mealsValidated: 18, mealsTotal: 21, glycemicLevel: "high", foodDiversity: 4 });
  assertEquals(advice.includes("légume supplémentaire"), true);
});

Deno.test("basileAdviceForReport - semaine exemplaire", () => {
  const advice = basileAdviceForReport({ mealsValidated: 19, mealsTotal: 21, glycemicLevel: "low", foodDiversity: 9 });
  assertEquals(advice.includes("exemplaire"), true);
});
