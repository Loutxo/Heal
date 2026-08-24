// Logique pure de rapprochement entre les noms d'aliments détectés par la vision (Gemini)
// et le catalogue `foods` — testable sans dépendre du réseau/de la BDD/de l'API Gemini.

export type CatalogFood = { id: number; name: string; name_variants: string[] | null };

export type MatchedFood = { food_id: number; name: string; confidence: "high" | "medium" };

export type PhotoMatchResult = { matched: MatchedFood[]; unmatched: string[] };

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Priorité à la correspondance exacte (nom ou variante) sur tout le catalogue ; seuls les noms
// détectés qui n'ont trouvé aucune correspondance exacte passent au rapprochement approximatif
// (sous-chaîne dans un sens ou l'autre) — évite qu'un match approximatif prenne le pas sur un
// exact trouvé plus loin dans la liste.
export function matchDetectedFoodsToCatalog(detectedNames: string[], catalog: CatalogFood[]): PhotoMatchResult {
  const normalizedCatalog = catalog.map((f) => ({
    food: f,
    normalizedName: normalize(f.name),
    normalizedVariants: (f.name_variants ?? []).map(normalize),
  }));

  const matchedIds = new Set<number>();
  const matched: MatchedFood[] = [];
  const stillUnmatched: string[] = [];

  for (const detected of detectedNames) {
    const normalizedDetected = normalize(detected);
    if (!normalizedDetected) continue;
    const exact = normalizedCatalog.find(
      (c) => c.normalizedName === normalizedDetected || c.normalizedVariants.includes(normalizedDetected)
    );
    if (exact && !matchedIds.has(exact.food.id)) {
      matchedIds.add(exact.food.id);
      matched.push({ food_id: exact.food.id, name: exact.food.name, confidence: "high" });
    } else if (!exact) {
      stillUnmatched.push(detected);
    }
  }

  const unmatched: string[] = [];
  for (const detected of stillUnmatched) {
    const normalizedDetected = normalize(detected);
    const partial = normalizedCatalog.find(
      (c) =>
        !matchedIds.has(c.food.id) &&
        (c.normalizedName.includes(normalizedDetected) ||
          normalizedDetected.includes(c.normalizedName) ||
          c.normalizedVariants.some((v) => v.includes(normalizedDetected) || normalizedDetected.includes(v)))
    );
    if (partial) {
      matchedIds.add(partial.food.id);
      matched.push({ food_id: partial.food.id, name: partial.food.name, confidence: "medium" });
    } else {
      unmatched.push(detected);
    }
  }

  return { matched, unmatched };
}
