import { assertEquals, assertAlmostEquals } from "jsr:@std/assert@1";
import {
  addDays,
  ageFromBirthDate,
  calculateCalorieTargets,
  checkGenerationTiming,
  filterSafeFoods,
  glycemicLevelFromLoad,
  nextSaturday,
  tcmGuidanceForMonth,
} from "./meal-plan-logic.ts";

const NOW = new Date("2026-08-24T12:00:00Z");

// ---- calculateCalorieTargets ----

Deno.test("calculateCalorieTargets - homme sédentaire, IMC normal : pas d'ajustement", () => {
  const t = calculateCalorieTargets({
    sex: "male",
    birth_date: "1990-08-24", // anniversaire exactement aujourd'hui -> 36 ans
    height_cm: 180,
    weight_kg: 75,
    activity_level: "sedentary",
    bmi: 23,
  });
  // BMR Mifflin = 10*75 + 6.25*180 - 5*36 + 5 = 750 + 1125 - 180 + 5 = 1700
  assertEquals(t.bmr, 1700);
  assertEquals(t.tdee, Math.round(1700 * 1.2));
  assertEquals(t.adjustedTdee, t.tdee); // IMC normal -> pas d'ajustement
});

Deno.test("calculateCalorieTargets - femme, IMC obèse (>=30) : réduction de 20%", () => {
  const t = calculateCalorieTargets({
    sex: "female",
    birth_date: "1990-01-01",
    height_cm: 165,
    weight_kg: 90,
    activity_level: "light",
    bmi: 32,
  });
  // adjustedTdee est calculé à partir du tdee brut (non arrondi), donc comparer à
  // Math.round(t.tdee * 0.8) peut différer de 1 par double-arrondi — tolérance de 1.
  assertAlmostEquals(t.adjustedTdee, t.tdee * 0.8, 1);
});

Deno.test("calculateCalorieTargets - IMC en surpoids (25-29.9) : réduction de 10%", () => {
  const t = calculateCalorieTargets({
    sex: "male",
    birth_date: "1985-01-01",
    height_cm: 175,
    weight_kg: 85,
    activity_level: "moderate",
    bmi: 27,
  });
  assertEquals(t.adjustedTdee, Math.round(t.tdee * 0.9));
});

Deno.test("calculateCalorieTargets - IMC insuffisant (<18.5) : majoration de 10%", () => {
  const t = calculateCalorieTargets({
    sex: "female",
    birth_date: "1995-01-01",
    height_cm: 170,
    weight_kg: 50,
    activity_level: "very_active",
    bmi: 17,
  });
  assertEquals(t.adjustedTdee, Math.round(t.tdee * 1.1));
});

Deno.test("calculateCalorieTargets - sexe autre que male/female : moyenne BMR homme/femme", () => {
  const base = { birth_date: "1990-01-01", height_cm: 170, weight_kg: 70, activity_level: "sedentary", bmi: null };
  const male = calculateCalorieTargets({ ...base, sex: "male" });
  const female = calculateCalorieTargets({ ...base, sex: "female" });
  const other = calculateCalorieTargets({ ...base, sex: "non_binary" });
  assertEquals(other.bmr, Math.round((male.bmr + female.bmr) / 2));
});

Deno.test("calculateCalorieTargets - répartition par repas somme à ~100% de la cible ajustée", () => {
  const t = calculateCalorieTargets({
    sex: "male",
    birth_date: "1990-01-01",
    height_cm: 180,
    weight_kg: 80,
    activity_level: "moderate",
    bmi: 23,
  });
  const sum = t.perMeal.breakfast + t.perMeal.lunch + t.perMeal.snack + t.perMeal.dinner;
  assertAlmostEquals(sum, t.adjustedTdee, 4); // tolérance d'arrondi
});

// ---- ageFromBirthDate ----

Deno.test("ageFromBirthDate - anniversaire déjà passé cette année", () => {
  assertEquals(ageFromBirthDate("1990-01-01", NOW), 36);
});

Deno.test("ageFromBirthDate - anniversaire pas encore atteint cette année", () => {
  assertEquals(ageFromBirthDate("1990-12-31", NOW), 35);
});

Deno.test("ageFromBirthDate - anniversaire exactement aujourd'hui compte comme passé", () => {
  assertEquals(ageFromBirthDate("1990-08-24", NOW), 36);
});

// ---- tcmGuidanceForMonth ----

Deno.test("tcmGuidanceForMonth - hiver (déc/jan/fév)", () => {
  for (const m of [12, 1, 2]) assertEquals(tcmGuidanceForMonth(m).includes("hiver"), true);
});

Deno.test("tcmGuidanceForMonth - printemps (mar/avr/mai)", () => {
  for (const m of [3, 4, 5]) assertEquals(tcmGuidanceForMonth(m).includes("printemps"), true);
});

Deno.test("tcmGuidanceForMonth - été (juin/juil/août)", () => {
  for (const m of [6, 7, 8]) assertEquals(tcmGuidanceForMonth(m).includes("été"), true);
});

Deno.test("tcmGuidanceForMonth - automne (sept/oct/nov) mentionne le cru et l'acide", () => {
  for (const m of [9, 10, 11]) {
    const g = tcmGuidanceForMonth(m);
    assertEquals(g.includes("automne"), true);
    assertEquals(g.includes("crue"), true);
    assertEquals(g.includes("acide"), true);
  }
});

// ---- nextSaturday / addDays ----

Deno.test("nextSaturday - depuis un lundi, tombe le samedi de la même semaine", () => {
  const monday = new Date("2026-08-24T10:00:00Z"); // lundi
  assertEquals(nextSaturday(monday), "2026-08-29");
});

Deno.test("nextSaturday - depuis un samedi, saute à la semaine suivante (comportement actuel)", () => {
  // Documente le comportement existant plutôt que de le changer silencieusement : si l'appel
  // tombe un samedi, next() renvoie le samedi suivant (+7j), pas le jour même.
  const saturday = new Date("2026-08-29T10:00:00Z");
  assertEquals(nextSaturday(saturday), "2026-09-05");
});

Deno.test("addDays - avance de plusieurs jours en traversant un changement de mois", () => {
  assertEquals(addDays("2026-08-29", 6), "2026-09-04");
});

Deno.test("addDays - recule (jours négatifs), utilisé par le verrou du jeudi", () => {
  assertEquals(addDays("2026-08-29", -2), "2026-08-27");
});

Deno.test("addDays - traverse une frontière d'année", () => {
  assertEquals(addDays("2026-12-30", 5), "2027-01-04");
});

// ---- filterSafeFoods ----

const FOODS = [
  { id: 1, name: "Pain complet", allergen_tags: ["gluten"], diet_compatibility: ["vegetarian", "vegan", "halal", "kosher", "no_pork", "no_alcohol_cooking"] },
  { id: 2, name: "Filet de porc", allergen_tags: [], diet_compatibility: ["no_alcohol_cooking"] },
  { id: 3, name: "Carotte", allergen_tags: [], diet_compatibility: ["vegetarian", "vegan", "halal", "kosher", "no_pork", "no_alcohol_cooking"] },
  { id: 4, name: "Coriandre", allergen_tags: null, diet_compatibility: null },
  { id: 5, name: "Emmental", allergen_tags: ["lactose"], diet_compatibility: ["vegetarian", "halal", "kosher", "no_pork", "no_alcohol_cooking"] },
];

Deno.test("filterSafeFoods - exclut les aliments portant un allergène déclaré", () => {
  const result = filterSafeFoods(FOODS, ["gluten"], [], []);
  assertEquals(result.some((f) => f.name === "Pain complet"), false);
  assertEquals(result.some((f) => f.name === "Carotte"), true);
});

Deno.test("filterSafeFoods - régression du bug no_pork : exige la préférence explicitement sur CHAQUE aliment", () => {
  // Avant le correctif, aucun aliment ne portait 'no_pork', donc ce filtre videbe la liste entière.
  const result = filterSafeFoods(FOODS, [], ["no_pork"], []);
  assertEquals(result.some((f) => f.name === "Filet de porc"), false); // n'a pas no_pork -> exclu, correct
  assertEquals(result.some((f) => f.name === "Carotte"), true); // porte bien no_pork -> conservé
});

Deno.test("filterSafeFoods - une préférence 'vegan' exclut un aliment végétarien mais non vegan (Emmental)", () => {
  const result = filterSafeFoods(FOODS, [], ["vegan"], []);
  assertEquals(result.some((f) => f.name === "Emmental"), false); // végétarien seulement -> exclu
  assertEquals(result.some((f) => f.name === "Carotte"), true);
  assertEquals(result.some((f) => f.name === "Pain complet"), true); // légitimement vegan aussi
});

Deno.test("filterSafeFoods - deux préférences combinées (vegan + no_pork) n'incluent que ce qui porte les deux", () => {
  const result = filterSafeFoods(FOODS, [], ["vegan", "no_pork"], []);
  assertEquals(result.map((f) => f.name).sort(), ["Carotte", "Pain complet"]);
});

Deno.test("filterSafeFoods - exclut les aliments détestés, insensible à la casse", () => {
  const result = filterSafeFoods(FOODS, [], [], ["CAROTTE"]);
  assertEquals(result.some((f) => f.name === "Carotte"), false);
});

Deno.test("filterSafeFoods - gère les allergen_tags/diet_compatibility null sans planter", () => {
  const result = filterSafeFoods(FOODS, ["gluten"], [], []);
  assertEquals(result.some((f) => f.name === "Coriandre"), true);
});

// ---- glycemicLevelFromLoad ----

Deno.test("glycemicLevelFromLoad - bornes low/moderate/high", () => {
  assertEquals(glycemicLevelFromLoad(0), "low");
  assertEquals(glycemicLevelFromLoad(10), "low");
  assertEquals(glycemicLevelFromLoad(10.1), "moderate");
  assertEquals(glycemicLevelFromLoad(19), "moderate");
  assertEquals(glycemicLevelFromLoad(19.1), "high");
  assertEquals(glycemicLevelFromLoad(50), "high");
});

// ---- checkGenerationTiming ----

Deno.test("checkGenerationTiming - premier planning jamais généré : toujours autorisé", () => {
  const r = checkGenerationTiming("2026-09-05", null, "2026-08-24");
  assertEquals(r.allowed, true);
});

Deno.test("checkGenerationTiming - régénération de la semaine déjà active : toujours autorisée", () => {
  const r = checkGenerationTiming("2026-08-29", "2026-08-29", "2026-08-24");
  assertEquals(r.allowed, true);
});

Deno.test("checkGenerationTiming - semaine future avant le jeudi précédent : refusée", () => {
  const r = checkGenerationTiming("2026-09-05", "2026-08-29", "2026-08-26");
  assertEquals(r.allowed, false);
  if (!r.allowed) assertEquals(r.earliestGenerationDate, "2026-09-03");
});

Deno.test("checkGenerationTiming - semaine future à partir du jeudi précédent : autorisée", () => {
  const r = checkGenerationTiming("2026-09-05", "2026-08-29", "2026-09-03");
  assertEquals(r.allowed, true);
});
