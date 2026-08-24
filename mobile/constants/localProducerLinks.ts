// v1 : lien de redirection simple vers un annuaire existant, pas d'annuaire propre à Heal
// (cf. Product Brief §2 — aucune donnée producteur×produit ouverte et fiable trouvée en France
// à date). France : Bienvenue à la Ferme (réseau officiel des Chambres d'agriculture, 8000+ fermes,
// recherche par code postal). Suisse : Swiss Farmers (union des paysans suisses). Pour les autres pays,
// pas de source unique vérifiée à ce jour — on utilise une recherche Google ciblée plutôt que de
// parier sur un annuaire non vérifié qui pourrait ne plus exister.
export const LOCAL_PRODUCER_LINKS: Record<string, { url: string; source: string }> = {
  // France
  'Auvergne-Rhône-Alpes': { url: 'https://www.bienvenue-a-la-ferme.com/auvergne-rhone-alpes', source: 'Bienvenue à la Ferme' },
  'Bourgogne-Franche-Comté': { url: 'https://www.bienvenue-a-la-ferme.com/bourgogne-franche-comte', source: 'Bienvenue à la Ferme' },
  'Bretagne': { url: 'https://www.bienvenue-a-la-ferme.com/bretagne', source: 'Bienvenue à la Ferme' },
  'Centre-Val de Loire': { url: 'https://www.bienvenue-a-la-ferme.com/centre-val-de-loire', source: 'Bienvenue à la Ferme' },
  'Corse': { url: 'https://www.bienvenue-a-la-ferme.com/corse', source: 'Bienvenue à la Ferme' },
  'Grand Est': { url: 'https://www.bienvenue-a-la-ferme.com/grand-est', source: 'Bienvenue à la Ferme' },
  'Hauts-de-France': { url: 'https://www.bienvenue-a-la-ferme.com/hauts-de-france', source: 'Bienvenue à la Ferme' },
  'Île-de-France': { url: 'https://www.bienvenue-a-la-ferme.com/ile-de-france', source: 'Bienvenue à la Ferme' },
  'Normandie': { url: 'https://www.bienvenue-a-la-ferme.com/normandie', source: 'Bienvenue à la Ferme' },
  'Nouvelle-Aquitaine': { url: 'https://www.bienvenue-a-la-ferme.com/nouvelle-aquitaine', source: 'Bienvenue à la Ferme' },
  'Occitanie': { url: 'https://www.bienvenue-a-la-ferme.com/occitanie', source: 'Bienvenue à la Ferme' },
  'Pays de la Loire': { url: 'https://www.bienvenue-a-la-ferme.com/pays-de-la-loire', source: 'Bienvenue à la Ferme' },
  "Provence-Alpes-Côte d'Azur": { url: 'https://www.bienvenue-a-la-ferme.com/provence-alpes-cote-d-azur', source: 'Bienvenue à la Ferme' },
  // Suisse
  'Suisse': { url: 'https://www.swiss-farmers.ch/farm-shops/', source: 'Swiss Farmers' },
};

// Pour les régions FR, "pays" (2e paramètre) n'est pas utilisé pour la recherche de repli —
// seul le nom de la région (Belgique, Allemagne...) sert de clé, ces "régions" représentant
// chacune un pays entier dans le modèle de données actuel.
const FALLBACK_SEARCH_TERMS: Record<string, string> = {
  Belgique: 'producteurs locaux fermiers',
  Allemagne: 'Hofladen Direktvermarkter in der Nähe',
  Espagne: 'productores locales venta directa',
  Italie: 'produttori locali vendita diretta fattoria',
  Luxembourg: 'producteurs locaux fermiers Luxembourg',
};

export function getLocalProducerLink(regionName: string): { url: string; source: string } {
  const direct = LOCAL_PRODUCER_LINKS[regionName];
  if (direct) return direct;

  const terms = FALLBACK_SEARCH_TERMS[regionName] ?? 'producteurs locaux fermiers';
  return {
    url: `https://www.google.com/search?q=${encodeURIComponent(`${terms} ${regionName}`)}`,
    source: 'Recherche Google',
  };
}
