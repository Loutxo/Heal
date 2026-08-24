import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.6-flash";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

const MEAL_TYPES = ["breakfast", "lunch", "snack", "dinner"] as const;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST uniquement" } }, 405);

  if (!GEMINI_API_KEY) {
    return json(
      { error: { code: "MISSING_API_KEY", message: "GEMINI_API_KEY n'est pas configurée côté serveur (Supabase Dashboard → Edge Functions → Secrets)." } },
      500
    );
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: { code: "UNAUTHENTICATED", message: "Authorization manquant" } }, 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json({ error: { code: "UNAUTHENTICATED", message: "Session invalide" } }, 401);
  const userId = userData.user.id;

  let body: { week_start?: string; force_regenerate?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // corps vide toléré, on prend le prochain lundi par défaut
  }
  const weekStart = body.week_start ?? nextSaturday();
  const forceRegenerate = body.force_regenerate ?? false;

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (profileError || !profile) {
    return json({ error: { code: "PROFILE_NOT_FOUND", message: "Profil incomplet — terminez l'onboarding d'abord." } }, 422);
  }
  if (!profile.region_id) {
    return json({ error: { code: "NO_REGION", message: "Aucune région définie sur le profil." } }, 422);
  }

  const { data: healthData } = await supabase
    .from("user_health_data")
    .select("pathologies")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: restrictions } = await supabase
    .from("user_restrictions")
    .select("allergies, diet_preferences, disliked_foods")
    .eq("user_id", userId)
    .maybeSingle();

  // Pas de filtre sur status ici : la contrainte UNIQUE(user_id, week_start) s'applique à toute ligne,
  // quel que soit son statut (y compris d'anciennes lignes "archived" d'un ancien mécanisme de régénération).
  // Il faut donc toujours repérer cette ligne pour la réutiliser (update en place), jamais tenter un insert à côté.
  const { data: existingPlan } = await supabase
    .from("meal_plans")
    .select("id, status")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (existingPlan && !forceRegenerate) {
    return json({ error: { code: "PLAN_ALREADY_EXISTS", message: "Un planning existe déjà pour cette semaine (utilisez force_regenerate: true)." } }, 409);
  }

  // On ne peut générer une semaine que si l'on a déjà un planning pour elle (régénération) —
  // sinon, on ne peut la mettre en file d'attente qu'à partir du jeudi qui la précède, pour
  // rester au plus près de la saisonnalité et éviter la confusion entre semaine en cours et à venir.
  if (!existingPlan) {
    const { data: latestPlan } = await supabase
      .from("meal_plans")
      .select("week_start")
      .eq("user_id", userId)
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestPlan && weekStart > latestPlan.week_start) {
      const earliestGenerationDate = addDays(weekStart, -2);
      const todayISO = new Date().toISOString().slice(0, 10);
      if (todayISO < earliestGenerationDate) {
        return json(
          {
            error: {
              code: "TOO_EARLY_TO_GENERATE",
              message: `Le planning de la semaine du ${weekStart} ne peut être généré qu'à partir du ${earliestGenerationDate} (jeudi précédent).`,
              earliest_generation_date: earliestGenerationDate,
            },
          },
          422
        );
      }
    }
  }

  const month = new Date(weekStart + "T00:00:00Z").getUTCMonth() + 1;

  const { data: seasonalRows, error: seasonalError } = await supabase
    .from("food_seasonality")
    .select("food_id")
    .eq("region_id", profile.region_id)
    .contains("months_available", [month]);

  if (seasonalError) {
    return json({ error: { code: "SEASONALITY_ERROR", message: seasonalError.message } }, 500);
  }
  const seasonalIds = (seasonalRows ?? []).map((r) => r.food_id);

  const { data: foodsData, error: foodsError } = await supabase
    .from("foods")
    .select("id, name, category_id, glycemic_index, allergen_tags, diet_compatibility, unit_concrete_label, tcm_nature, food_nutrients(carbs_g, energy_kcal, proteins_g)")
    .in("id", seasonalIds)
    .eq("is_active", true);

  if (foodsError || !foodsData) {
    return json({ error: { code: "CANDIDATES_ERROR", message: foodsError?.message ?? "Impossible de charger les aliments de saison." } }, 500);
  }

  const allergies: string[] = restrictions?.allergies ?? [];
  const dietPreferences: string[] = restrictions?.diet_preferences ?? [];
  const dislikedNames = (restrictions?.disliked_foods ?? []).map((s: string) => s.toLowerCase());
  const pathologies: string[] = healthData?.pathologies ?? [];

  const safeFoods = foodsData
    .filter((f) => !(f.allergen_tags ?? []).some((tag: string) => allergies.includes(tag)))
    .filter((f) => dietPreferences.every((pref) => (f.diet_compatibility ?? []).includes(pref)))
    .filter((f) => !dislikedNames.includes(f.name.toLowerCase()));

  if (safeFoods.length < 15) {
    return json(
      {
        error: {
          code: "NOT_ENOUGH_FOODS",
          message: "Pas assez d'aliments compatibles disponibles pour générer un planning varié ce mois-ci dans votre région. La base d'aliments est encore un premier lot (60 aliments) — elle grandira avec le temps.",
        },
      },
      422
    );
  }

  const isDiabetic = pathologies.some((p) => ["diabetes_type1", "diabetes_type2", "prediabetes"].includes(p));
  const maxIg = isDiabetic ? 40 : 100;

  const calorieTargets = calculateCalorieTargets(profile);

  const foodsList = safeFoods
    .map((f) => {
      const n = nutrientsOf(f.food_nutrients);
      return `- id:${f.id} | ${f.name} | IG:${f.glycemic_index ?? "n/a"} | ${Math.round(n.energy_kcal)}kcal/${Math.round(n.proteins_g)}g prot. pour 100g | ${f.unit_concrete_label ?? ""} | nature MTC:${f.tcm_nature ?? "n/a"}`;
    })
    .join("\n");

  const systemPrompt = `Tu es le moteur de génération de menus de l'application Heal (planning repas de saison, personnalisé, adapté à la glycémie).

La semaine commence le SAMEDI : day_offset 0 = samedi, 1 = dimanche, 2 = lundi, 3 = mardi, 4 = mercredi, 5 = jeudi, 6 = vendredi.
Génère pour chaque jour : petit-déjeuner (breakfast), déjeuner (lunch), collation (snack), dîner (dinner), soit 28 repas.
N'utilise QUE les aliments listés ci-dessous, référencés par leur "id" exact (food_id). N'invente jamais d'id.

Règles impératives :
- DÎNERS : génère 7 dîners tous différents entre eux — ce sont les repas "de base" de la semaine, chacun avec une protéine, des légumes, et si pertinent un féculent accompagné de fibres.
- DÉJEUNERS DU WEEK-END (day_offset 0 et 1, samedi et dimanche) : des repas normaux et différents des dîners.
- DÉJEUNERS DE SEMAINE (day_offset 2 à 6, lundi à vendredi) : ce ne sont PAS de nouveaux repas — ce sont des restes ou un assemblage de préparations déjà faites. Reprends EXACTEMENT la même liste d'aliments et les mêmes quantités qu'un dîner déjà généré cette semaine (en priorité celui de la veille), et nomme ce repas "[Nom du dîner d'origine] (reste)".
- PETITS-DÉJEUNERS : au moins 4 recettes différentes sur les 7 jours (maximum 2 répétitions de la même recette).
- COLLATIONS : au moins 3 recettes différentes sur les 7 jours.
- Priorité n°1 de l'application : l'harmonie glycémique, même sans pathologie déclarée. Vise au moins 70% des dîners avec une charge glycémique estimée faible ou modérée (privilégie fibres et légumineuses, limite les grosses portions de féculents raffinés).
- IG max par aliment de repas principal : ${maxIg}.
- QUANTITÉS (quantity_g) : ajuste les grammages de chaque aliment pour que l'énergie totale de chaque repas se rapproche de sa cible (indiquée ci-dessous), en utilisant les kcal/100g fournis pour chaque aliment. Un dîner "reste" doit garder exactement les mêmes grammages que le dîner d'origine.
- eating_order : liste les noms d'aliments du repas dans l'ordre conseillé légumes → protéines → féculents (n'inclut pas les matières grasses de cuisson comme l'huile ou le beurre).
- Réponds UNIQUEMENT avec un JSON valide respectant strictement le schéma demandé, sans aucun texte avant ou après.`;

  const userPrompt = `Profil : sexe ${profile.sex}, niveau d'activité ${profile.activity_level}, IMC ${profile.bmi ?? "n/a"}.
Besoin énergétique quotidien estimé : ${calorieTargets.adjustedTdee} kcal (métabolisme de base ${calorieTargets.bmr} kcal × facteur d'activité, ajusté selon l'IMC).
Cibles par repas : petit-déjeuner ≈${calorieTargets.perMeal.breakfast} kcal, déjeuner ≈${calorieTargets.perMeal.lunch} kcal, collation ≈${calorieTargets.perMeal.snack} kcal, dîner ≈${calorieTargets.perMeal.dinner} kcal (± 15% acceptable).
Pathologies déclarées : ${pathologies.length ? pathologies.join(", ") : "aucune"}.
Allergies (déjà exclues de la liste ci-dessous) : ${allergies.length ? allergies.join(", ") : "aucune"}.
Semaine du ${weekStart} (samedi) au ${addDays(weekStart, 6)} (vendredi), mois ${month}.

Aliments disponibles (utiliser uniquement ces ids) :
${foodsList}`;

  const responseSchema = {
    type: "object",
    properties: {
      meals: {
        type: "array",
        items: {
          type: "object",
          properties: {
            day_offset: { type: "integer" },
            meal_type: { type: "string", enum: MEAL_TYPES },
            name: { type: "string" },
            eating_order: { type: "array", items: { type: "string" } },
            foods: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  food_id: { type: "integer" },
                  quantity_g: { type: "number" },
                },
                required: ["food_id", "quantity_g"],
              },
            },
          },
          required: ["day_offset", "meal_type", "name", "eating_order", "foods"],
        },
      },
    },
    required: ["meals"],
  };

  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { responseMimeType: "application/json", responseSchema, temperature: 0.8 },
      }),
    }
  );

  if (!geminiResponse.ok) {
    const errText = await geminiResponse.text();
    console.error("GEMINI_ERROR", geminiResponse.status, errText.slice(0, 1000));
    return json({ error: { code: "GEMINI_ERROR", message: `Erreur Gemini API (${geminiResponse.status}): ${errText.slice(0, 400)}` } }, 502);
  }

  const geminiJson = await geminiResponse.json();
  const rawText = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    console.error("GEMINI_EMPTY", JSON.stringify(geminiJson).slice(0, 1000));
    return json({ error: { code: "GEMINI_EMPTY", message: "Réponse vide de Gemini." } }, 502);
  }

  let parsed: { meals: Array<{ day_offset: number; meal_type: string; name: string; eating_order: string[]; foods: Array<{ food_id: number; quantity_g: number }> }> };
  try {
    parsed = JSON.parse(rawText);
  } catch {
    console.error("PARSE_ERROR", rawText.slice(0, 1000));
    return json({ error: { code: "PARSE_ERROR", message: "Réponse Gemini invalide (JSON non parsable)." } }, 502);
  }

  const foodById = new Map(safeFoods.map((f) => [f.id, f]));
  const validMeals = (parsed.meals ?? []).filter((m) => m.foods?.length && m.foods.every((mf) => foodById.has(mf.food_id)));

  if (validMeals.length < 20) {
    console.error("GENERATION_INCOMPLETE", validMeals.length, "of", parsed.meals?.length, "raw:", JSON.stringify(parsed).slice(0, 1500));
    return json({ error: { code: "GENERATION_INCOMPLETE", message: `Le modèle n'a généré que ${validMeals.length} repas valides sur 28 attendus. Réessayez.` } }, 502);
  }

  // La contrainte UNIQUE(user_id, week_start) porte sur toutes les lignes, pas seulement les actives —
  // archiver puis réinsérer provoquerait un conflit. On régénère donc en place : on garde le même
  // meal_plan (même id), on supprime ses anciens repas (cascade sur meal_foods), et on écrase generation_params.
  // Cela garde aussi la liste de courses et le guide batch cooking existants cohérents avec ce planning.
  let newPlan: { id: string } | null = null;

  if (existingPlan && forceRegenerate) {
    await supabase.from("meals").delete().eq("meal_plan_id", existingPlan.id);
    const { data: updatedPlan, error: planUpdateError } = await supabase
      .from("meal_plans")
      .update({
        status: "active",
        generation_params: { region_id: profile.region_id, pathologies, allergies, diet_preferences: dietPreferences, month },
      })
      .eq("id", existingPlan.id)
      .select()
      .single();
    if (planUpdateError || !updatedPlan) {
      return json({ error: { code: "PLAN_UPDATE_ERROR", message: planUpdateError?.message ?? "Erreur de mise à jour du planning." } }, 500);
    }
    newPlan = updatedPlan;
  } else {
    const { data: insertedPlan, error: planInsertError } = await supabase
      .from("meal_plans")
      .insert({
        user_id: userId,
        week_start: weekStart,
        status: "active",
        generation_params: { region_id: profile.region_id, pathologies, allergies, diet_preferences: dietPreferences, month },
      })
      .select()
      .single();
    if (planInsertError || !insertedPlan) {
      return json({ error: { code: "PLAN_INSERT_ERROR", message: planInsertError?.message ?? "Erreur d'insertion du planning." } }, 500);
    }
    newPlan = insertedPlan;
  }

  let createdCount = 0;
  for (const m of validMeals) {
    const mealDate = addDays(weekStart, m.day_offset);
    const foods = m.foods.map((mf) => foodById.get(mf.food_id)!);
    const estimatedGL = foods.reduce((sum, f, idx) => {
      const carbs = nutrientsOf(f.food_nutrients).carbs_g;
      const qty = m.foods[idx].quantity_g;
      return sum + ((f.glycemic_index ?? 0) * (carbs * qty / 100)) / 100;
    }, 0);

    const { data: mealRow, error: mealError } = await supabase
      .from("meals")
      .insert({
        meal_plan_id: newPlan.id,
        meal_date: mealDate,
        meal_type: m.meal_type,
        name: m.name,
        estimated_glycemic_load: Math.round(estimatedGL * 10) / 10,
        glycemic_level: estimatedGL <= 10 ? "low" : estimatedGL <= 19 ? "moderate" : "high",
        eating_order: m.eating_order ?? [],
      })
      .select()
      .single();

    if (mealError || !mealRow) continue;

    const mealFoodsPayload = m.foods.map((mf, idx) => ({
      meal_id: mealRow.id,
      food_id: mf.food_id,
      quantity_g: mf.quantity_g,
      quantity_concrete: foodById.get(mf.food_id)?.unit_concrete_label ?? null,
      sort_order: idx,
    }));
    await supabase.from("meal_foods").insert(mealFoodsPayload);
    createdCount++;
  }

  return json({ meal_plan_id: newPlan.id, week_start: weekStart, meals_created: createdCount }, 200);
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
}

type NutrientRow = { energy_kcal?: number; proteins_g?: number; carbs_g?: number };

function nutrientsOf(fn: unknown): { energy_kcal: number; proteins_g: number; carbs_g: number } {
  const row = (Array.isArray(fn) ? fn[0] : fn) as NutrientRow | null | undefined;
  return {
    energy_kcal: row?.energy_kcal ?? 0,
    proteins_g: row?.proteins_g ?? 0,
    carbs_g: row?.carbs_g ?? 0,
  };
}

// Métabolisme de base (Mifflin-St Jeor) × facteur d'activité (Livrable 1 US-011/US-012),
// puis ajustement selon l'IMC (US-011) et répartition indicative par repas.
function calculateCalorieTargets(profile: {
  sex: string;
  birth_date: string;
  height_cm: number;
  weight_kg: number;
  activity_level: string;
  bmi: number | null;
}) {
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

function ageFromBirthDate(birthDate: string): number {
  const birth = new Date(birthDate + "T00:00:00Z");
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const hasHadBirthdayThisYear =
    now.getUTCMonth() > birth.getUTCMonth() || (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() >= birth.getUTCDate());
  if (!hasHadBirthdayThisYear) age--;
  return age;
}

function nextSaturday(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0=dimanche ... 6=samedi
  const diff = ((6 - day + 7) % 7) || 7;
  now.setUTCDate(now.getUTCDate() + diff);
  return now.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
