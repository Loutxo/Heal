// Logique pure du rapport hebdomadaire (US-070) — calcul des scores et du conseil de Basile,
// testable sans dépendre du pg_cron ni de la BDD.

import { glycemicLevelFromLoad } from "./meal-plan-logic.ts";

export type GlycemicLevel = "low" | "moderate" | "high";

// Samedi le plus récent <= la date donnée (samedi lui-même si la date est un samedi) — la semaine
// applicative va de ce samedi au vendredi suivant (convention Heal, pas le lundi-dimanche du CdCF).
export function mostRecentSaturday(dateISO: string): string {
  const d = new Date(dateISO + "T00:00:00Z");
  const day = d.getUTCDay(); // 0=dimanche ... 6=samedi
  const diff = (day + 1) % 7; // nombre de jours depuis le dernier samedi
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

export function averageGlycemicLoad(loads: number[]): number {
  if (loads.length === 0) return 0;
  return loads.reduce((sum, l) => sum + l, 0) / loads.length;
}

export function foodDiversityScore(categoryIds: number[]): number {
  return new Set(categoryIds).size;
}

// weekly_reports.top_meals est un uuid[] (référence vers meals.id, pas les noms en clair) —
// l'écran de rapport résout les noms côté client via une jointure sur ces ids.
export function pickTopMeals(meals: { id: string; score: number }[], count = 3): string[] {
  return [...meals]
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((m) => m.id);
}

export type ReportInputs = {
  mealsValidated: number;
  mealsTotal: number;
  glycemicLevel: GlycemicLevel;
  foodDiversity: number;
};

// Conseil personnalisé de Basile pour la semaine suivante — règles déterministes plutôt qu'un
// appel Gemini par utilisateur (le job tourne en batch pour tous les utilisateurs chaque semaine,
// un appel LLM par personne serait un coût et une latence inutiles pour un texte qui peut être
// couvert par un nombre raisonnable de cas concrets).
export function basileAdviceForReport(input: ReportInputs): string {
  const validationRate = input.mealsTotal > 0 ? input.mealsValidated / input.mealsTotal : 0;

  if (input.mealsValidated === 0) {
    return "Cette semaine, aucun repas n'a été validé — pensez à valider vos repas juste après les avoir mangés, ça ne prend que quelques secondes et ça m'aide à mieux vous conseiller !";
  }
  if (validationRate < 0.4) {
    return "Vous avez validé moins de la moitié de vos repas cette semaine. Essayez de prendre le réflexe juste après chaque repas — plus j'ai de données, plus mes conseils seront pertinents pour vous.";
  }
  if (input.glycemicLevel === "high" && input.foodDiversity < 6) {
    return "La charge glycémique de votre semaine est élevée et vos assiettes manquaient un peu de diversité. La semaine prochaine, essayez d'ajouter un légume supplémentaire à chaque repas principal — ça aide à la fois sur les deux fronts.";
  }
  if (input.glycemicLevel === "high") {
    return "Charge glycémique un peu élevée cette semaine. Rappel de l'ordre de consommation : légumes et protéines avant les féculents, ça aplatit la courbe même à repas identique.";
  }
  if (input.foodDiversity < 6) {
    return "Bonne maîtrise glycémique cette semaine ! Pour aller plus loin, essayez de varier un peu plus les familles d'aliments — chaque nouvelle couleur dans l'assiette apporte des nutriments différents.";
  }
  if (input.glycemicLevel === "low" && validationRate >= 0.85) {
    return "Semaine exemplaire : charge glycémique maîtrisée, bonne diversité, et vous avez suivi presque tous vos repas. Continuez comme ça, c'est exactement l'équilibre qu'on recherche !";
  }
  return "Belle semaine dans l'ensemble. Continuez à valider vos repas régulièrement, c'est ce qui me permet d'affiner vos prochains plannings au fil du temps.";
}

export { glycemicLevelFromLoad };
