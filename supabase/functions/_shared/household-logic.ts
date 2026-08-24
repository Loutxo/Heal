// Combine les restrictions du titulaire du compte avec celles des membres du foyer (allergies,
// préférences alimentaires, pathologies) pour un menu partagé — logique pure, testable.
//
// Choix volontairement simple pour ne pas complexifier le produit : un menu partagé doit être
// sûr et compatible pour TOUT le foyer, donc on prend l'UNION de chaque type de restriction
// (une allergie ou préférence déclarée par n'importe qui exclut l'aliment pour tout le monde).
// Pas de calcul calorique par membre — household_size (déjà existant) continue de piloter les
// quantités, cette logique ne touche qu'aux ingrédients autorisés.

export type HouseholdMember = {
  allergies: string[] | null;
  diet_preferences: string[] | null;
  pathologies: string[] | null;
};

export type CombinedRestrictions = {
  allergies: string[];
  dietPreferences: string[];
  pathologies: string[];
};

export function combineHouseholdRestrictions(
  owner: { allergies: string[]; diet_preferences: string[]; pathologies: string[] },
  members: HouseholdMember[]
): CombinedRestrictions {
  const allergies = new Set(owner.allergies);
  const dietPreferences = new Set(owner.diet_preferences);
  const pathologies = new Set(owner.pathologies);

  for (const member of members) {
    for (const a of member.allergies ?? []) allergies.add(a);
    for (const d of member.diet_preferences ?? []) dietPreferences.add(d);
    for (const p of member.pathologies ?? []) pathologies.add(p);
  }

  return {
    allergies: [...allergies],
    dietPreferences: [...dietPreferences],
    pathologies: [...pathologies],
  };
}
