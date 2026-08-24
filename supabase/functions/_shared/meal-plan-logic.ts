// Logique métier pure, partagée entre generate-meal-plan et swap-meal (et testable en isolation
// avec `deno test`, sans dépendre du runtime Edge Function ni d'un accès réseau/BDD).

export type Profile = {
  sex: string;
  birth_date: string;
  height_cm: number;
  weight_kg: number;
  activity_level: string;
  bmi: number | null;
};

export type CalorieTargets = {
  bmr: number;
  tdee: number;
  adjustedTdee: number;
  perMeal: { breakfast: number; lunch: number; snack: number; dinner: number };
};

export type FoodCandidate = {
  id: number;
  name: string;
  allergen_tags: string[] | null;
  diet_compatibility: string[] | null;
};

// Métabolisme de base (Mifflin-St Jeor) × facteur d'activité (Livrable 1 US-011/US-012),
// puis ajustement selon l'IMC (US-011) et répartition indicative par repas.
export function calculateCalorieTargets(profile: Profile): CalorieTargets {
  const age = ageFromBirthDate(profile.birth_date);
  const bmrMale = 10 * profile.weight_kg + 6.25 * profile.height_cm - 5 * age + 5;
  const bmrFemale = 10 * profile.weight_kg + 6.25 * profile.height_cm - 5 * age - 161;
  const bmr = profile.sex === "male" ? bmrMale : profile.sex === "female" ? bmrFemale : (bmrMale + bmrFemale) / 2;

  const activityMultipliers: Record<string, number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, very_active: 1.725 };
  const tdee = bmr * (activityMultipliers[profile.activity_level] ?? 1.375);

  let adjustmentFactor = 1;
  if (profile.bmi !== null) {
    if (profile.bmi < 18.5) adjustmentFactor = 1.1;
    else if (profile.bmi >= 30) adjustmentFactor = 0.8;
    else if (profile.bmi >= 25) adjustmentFactor = 0.9;
  }
  const adjustedTdee = Math.round(tdee * adjustmentFactor);

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    adjustedTdee,
    perMeal: {
      breakfast: Math.round(adjustedTdee * 0.25),
      lunch: Math.round(adjustedTdee * 0.3),
      snack: Math.round(adjustedTdee * 0.1),
      dinner: Math.round(adjustedTdee * 0.35),
    },
  };
}

// now est injectable (au lieu de `new Date()`) pour rester déterministe en test — seul l'appel
// depuis l'Edge Function passe l'heure réelle.
export function ageFromBirthDate(birthDate: string, now: Date = new Date()): number {
  const birth = new Date(birthDate + "T00:00:00Z");
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const hasHadBirthdayThisYear =
    now.getUTCMonth() > birth.getUTCMonth() || (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() >= birth.getUTCDate());
  if (!hasHadBirthdayThisYear) age--;
  return age;
}

// Nudge MTC par saison (Product Brief §8, règle 2) — jamais un filtre, juste une préférence légère
// à égalité de règles occidentales. Cf. diététique chinoise classique (Sun Simiao, Qian Jin Yao Fang) :
// l'automne favorise le tiède/légèrement piquant mais sans excès, avec un peu d'acide en renfort,
// et une cuisson longue plutôt que du cru.
export function tcmGuidanceForMonth(month: number): string {
  if ([12, 1, 2].includes(month)) {
    return "en hiver, privilégie les aliments de nature tiède ou chaude (ex: gingembre, poireau, viandes mijotées) qui réchauffent l'organisme.";
  }
  if ([3, 4, 5].includes(month)) {
    return "au printemps, privilégie les aliments de nature neutre ou tiède, saveur légèrement acide, qui soutiennent le renouveau (jeunes pousses, légumes verts).";
  }
  if ([6, 7, 8].includes(month)) {
    return "en été, privilégie les aliments de nature fraîche ou froide (ex: concombre, tomate, pastèque) qui rafraîchissent l'organisme.";
  }
  return "en automne, privilégie les aliments de nature tiède à saveur légèrement piquante mais sans excès (ex: gingembre, poireau, courge), en cuisson longue plutôt que crue, et inclus un peu de saveur acide pour contrer la sécheresse de la saison.";
}

export function nextSaturday(now: Date = new Date()): string {
  const day = now.getUTCDay(); // 0=dimanche ... 6=samedi
  const diff = ((6 - day + 7) % 7) || 7;
  const next = new Date(now);
  next.setUTCDate(next.getUTCDate() + diff);
  return next.toISOString().slice(0, 10);
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Un utilisateur choisissant une préférence (no_pork, vegan...) doit voir CHAQUE aliment retenu
// porter explicitement cette préférence dans diet_compatibility — c'est la règle qui a été cassée
// silencieusement (aucun aliment ne portait no_pork/no_alcohol_cooking) avant d'être corrigée.
export function filterSafeFoods<T extends FoodCandidate>(
  foods: T[],
  allergies: string[],
  dietPreferences: string[],
  dislikedNames: string[]
): T[] {
  const dislikedLower = dislikedNames.map((n) => n.toLowerCase());
  return foods
    .filter((f) => !(f.allergen_tags ?? []).some((tag) => allergies.includes(tag)))
    .filter((f) => dietPreferences.every((pref) => (f.diet_compatibility ?? []).includes(pref)))
    .filter((f) => !dislikedLower.includes(f.name.toLowerCase()));
}

export function glycemicLevelFromLoad(load: number): "low" | "moderate" | "high" {
  if (load <= 10) return "low";
  if (load <= 19) return "moderate";
  return "high";
}

// Une semaine dont le meal_plan n'existe pas encore ne peut être générée qu'à partir du jeudi
// qui la précède (2 jours avant), SAUF si c'est la toute première semaine du planning de
// l'utilisateur (aucun latestPlanWeekStart) ou qu'on régénère la semaine déjà existante.
export function checkGenerationTiming(
  weekStart: string,
  latestPlanWeekStart: string | null,
  todayISO: string
): { allowed: true } | { allowed: false; earliestGenerationDate: string } {
  if (latestPlanWeekStart === null || weekStart <= latestPlanWeekStart) return { allowed: true };
  const earliestGenerationDate = addDays(weekStart, -2);
  if (todayISO >= earliestGenerationDate) return { allowed: true };
  return { allowed: false, earliestGenerationDate };
}
