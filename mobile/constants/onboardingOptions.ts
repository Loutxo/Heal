export const SEX_OPTIONS = [
  { value: 'male', label: 'Homme' },
  { value: 'female', label: 'Femme' },
  { value: 'non_binary', label: 'Non-binaire' },
  { value: 'undisclosed', label: 'Préfère ne pas dire' },
] as const;

export const ACTIVITY_LEVELS = [
  { value: 'sedentary', emoji: '🪑', label: 'Sédentaire', description: 'Je travaille assis, peu de marche' },
  { value: 'light', emoji: '🚶', label: 'Légèrement actif', description: 'Marche 30 min/jour ou sport 1–2×/semaine' },
  { value: 'moderate', emoji: '🚴', label: 'Modérément actif', description: 'Sport 3–4×/semaine ou travail physique modéré' },
  { value: 'very_active', emoji: '🏋️', label: 'Très actif', description: 'Sport intensif quotidien ou travail physique intensif' },
] as const;

export const PATHOLOGIES = [
  { value: 'diabetes_type1', label: 'Diabète de type 1' },
  { value: 'diabetes_type2', label: 'Diabète de type 2' },
  { value: 'prediabetes', label: 'Prédiabète' },
  { value: 'pcos', label: 'SOPK (syndrome des ovaires polykystiques)' },
  { value: 'hypothyroidism', label: 'Hypothyroïdie' },
  { value: 'hypercholesterolemia', label: 'Hypercholestérolémie' },
  { value: 'hypertriglyceridemia', label: 'Hypertriglycéridémie' },
  { value: 'celiac', label: 'Maladie cœliaque' },
  { value: 'crohn_ibd', label: 'Maladie de Crohn / MICI' },
] as const;

export const ALLERGIES = [
  { value: 'gluten', label: 'Gluten' },
  { value: 'lactose', label: 'Lactose' },
  { value: 'eggs', label: 'Œufs' },
  { value: 'tree_nuts', label: 'Fruits à coque' },
  { value: 'peanuts', label: 'Arachides' },
  { value: 'fish', label: 'Poisson' },
  { value: 'shellfish', label: 'Crustacés' },
  { value: 'soy', label: 'Soja' },
  { value: 'sesame', label: 'Sésame' },
  { value: 'celery', label: 'Céleri' },
  { value: 'mustard', label: 'Moutarde' },
  { value: 'sulfites', label: 'Sulfites' },
] as const;

export const DIET_PREFERENCES = [
  { value: 'vegetarian', label: 'Végétarien' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'halal', label: 'Halal' },
  { value: 'kosher', label: 'Casher' },
  { value: 'no_pork', label: 'Sans porc' },
  { value: 'no_alcohol_cooking', label: 'Sans alcool en cuisine' },
] as const;
