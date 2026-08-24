import { assertEquals } from "jsr:@std/assert@1";
import { matchDetectedFoodsToCatalog, type CatalogFood } from "./food-photo-logic.ts";

const CATALOG: CatalogFood[] = [
  { id: 1, name: "Tomate", name_variants: ["tomates cerises", "tomate grappe"] },
  { id: 2, name: "Concombre", name_variants: null },
  { id: 3, name: "Blanc de poulet", name_variants: ["poulet", "escalope de poulet"] },
  { id: 4, name: "Carotte", name_variants: ["carottes"] },
  { id: 5, name: "Pomme", name_variants: null },
];

Deno.test("matchDetectedFoodsToCatalog - correspondance exacte sur le nom (insensible à la casse et aux accents)", () => {
  const result = matchDetectedFoodsToCatalog(["tomate", "CONCOMBRE"], CATALOG);
  assertEquals(result.matched, [
    { food_id: 1, name: "Tomate", confidence: "high" },
    { food_id: 2, name: "Concombre", confidence: "high" },
  ]);
  assertEquals(result.unmatched, []);
});

Deno.test("matchDetectedFoodsToCatalog - correspondance exacte sur une variante", () => {
  const result = matchDetectedFoodsToCatalog(["poulet"], CATALOG);
  assertEquals(result.matched, [{ food_id: 3, name: "Blanc de poulet", confidence: "high" }]);
});

Deno.test("matchDetectedFoodsToCatalog - correspondance approximative en sous-chaîne, confiance 'medium'", () => {
  const result = matchDetectedFoodsToCatalog(["carottes râpées"], CATALOG);
  assertEquals(result.matched, [{ food_id: 4, name: "Carotte", confidence: "medium" }]);
});

Deno.test("matchDetectedFoodsToCatalog - aliment détecté sans correspondance reste dans unmatched", () => {
  const result = matchDetectedFoodsToCatalog(["sushi"], CATALOG);
  assertEquals(result.matched, []);
  assertEquals(result.unmatched, ["sushi"]);
});

Deno.test("matchDetectedFoodsToCatalog - déduplique deux noms détectés pointant vers le même aliment", () => {
  const result = matchDetectedFoodsToCatalog(["tomate", "tomates cerises"], CATALOG);
  assertEquals(result.matched, [{ food_id: 1, name: "Tomate", confidence: "high" }]);
});

Deno.test("matchDetectedFoodsToCatalog - une correspondance exacte trouvée ailleurs n'est pas volée par un match approximatif antérieur", () => {
  // "pomme" est un exact-match direct malgré la présence de "Pomme de terre" potentielle dans un vrai catalogue élargi.
  const result = matchDetectedFoodsToCatalog(["pomme"], CATALOG);
  assertEquals(result.matched, [{ food_id: 5, name: "Pomme", confidence: "high" }]);
});

Deno.test("matchDetectedFoodsToCatalog - liste vide de noms détectés", () => {
  const result = matchDetectedFoodsToCatalog([], CATALOG);
  assertEquals(result.matched, []);
  assertEquals(result.unmatched, []);
});

Deno.test("matchDetectedFoodsToCatalog - ignore les chaînes vides ou blanches", () => {
  const result = matchDetectedFoodsToCatalog(["", "   ", "tomate"], CATALOG);
  assertEquals(result.matched, [{ food_id: 1, name: "Tomate", confidence: "high" }]);
  assertEquals(result.unmatched, []);
});
