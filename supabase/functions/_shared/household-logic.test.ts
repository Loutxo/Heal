import { assertEquals } from "jsr:@std/assert@1";
import { combineHouseholdRestrictions } from "./household-logic.ts";

const OWNER = { allergies: ["gluten"], diet_preferences: [], pathologies: [] };

Deno.test("combineHouseholdRestrictions - aucun membre renvoie juste les restrictions du titulaire", () => {
  const result = combineHouseholdRestrictions(OWNER, []);
  assertEquals(result, { allergies: ["gluten"], dietPreferences: [], pathologies: [] });
});

Deno.test("combineHouseholdRestrictions - union des allergies de plusieurs membres", () => {
  const members = [
    { allergies: ["peanuts"], diet_preferences: [], pathologies: [] },
    { allergies: ["shellfish", "peanuts"], diet_preferences: [], pathologies: [] },
  ];
  const result = combineHouseholdRestrictions(OWNER, members);
  assertEquals(new Set(result.allergies), new Set(["gluten", "peanuts", "shellfish"]));
  assertEquals(result.allergies.length, 3); // dédupliqué malgré "peanuts" déclaré deux fois
});

Deno.test("combineHouseholdRestrictions - une préférence végane d'un membre s'applique au menu partagé", () => {
  const members = [{ allergies: [], diet_preferences: ["vegan"], pathologies: [] }];
  const result = combineHouseholdRestrictions(OWNER, members);
  assertEquals(result.dietPreferences, ["vegan"]);
});

Deno.test("combineHouseholdRestrictions - une pathologie d'un membre (ex: diabète) s'ajoute", () => {
  const members = [{ allergies: [], diet_preferences: [], pathologies: ["diabetes_type2"] }];
  const result = combineHouseholdRestrictions(OWNER, members);
  assertEquals(result.pathologies, ["diabetes_type2"]);
});

Deno.test("combineHouseholdRestrictions - gère les champs null d'un membre sans planter", () => {
  const members = [{ allergies: null, diet_preferences: null, pathologies: null }];
  const result = combineHouseholdRestrictions(OWNER, members);
  assertEquals(result, { allergies: ["gluten"], dietPreferences: [], pathologies: [] });
});
