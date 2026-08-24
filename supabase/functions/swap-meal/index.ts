import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { calculateCalorieTargets, filterSafeFoods, glycemicLevelFromLoad } from "../_shared/meal-plan-logic.ts";
import { fetchSubscriptionAccess } from "../_shared/subscription-logic.ts";
import { combineHouseholdRestrictions } from "../_shared/household-logic.ts";

const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.6-flash";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST uniquement" } }, 405);

  if (!GEMINI_API_KEY) {
    return json({ error: { code: "MISSING_API_KEY", message: "GEMINI_API_KEY n'est pas configurée côté serveur." } }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: { code: "UNAUTHENTICATED", message: "Authorization manquant" } }, 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json({ error: { code: "UNAUTHENTICATED", message: "Session invalide" } }, 401);
  const userId = userData.user.id;

  if (!(await fetchSubscriptionAccess(supabase, userId))) {
    return json({ error: { code: "SUBSCRIPTION_REQUIRED", message: "Un abonnement actif est requis pour cette action." } }, 402);
  }

  let body: { meal_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    // ignore
  }
  if (!body.meal_id) return json({ error: { code: "MISSING_MEAL_ID", message: "meal_id requis" } }, 400);

  const { data: meal, error: mealError } = await supabase
    .from("meals")
    .select("id, meal_plan_id, meal_date, meal_type, name, meal_plans(id, user_id, week_start)")
    .eq("id", body.meal_id)
    .single();

  const plan = (meal as any)?.meal_plans;
  if (mealError || !meal || !plan || plan.user_id !== userId) {
    return json({ error: { code: "MEAL_NOT_FOUND", message: "Repas introuvable ou non autorisé." } }, 404);
  }

  const { data: profile, error: profileError } = await supabase.from("user_profiles").select("*").eq("id", userId).single();
  if (profileError || !profile) {
    return json({ error: { code: "PROFILE_NOT_FOUND", message: "Profil incomplet." } }, 422);
  }

  const { data: healthData } = await supabase.from("user_health_data").select("pathologies").eq("user_id", userId).maybeSingle();
  const { data: restrictions } = await supabase
    .from("user_restrictions")
    .select("allergies, diet_preferences, disliked_foods")
    .eq("user_id", userId)
    .maybeSingle();
  const { data: householdMembers } = await supabase
    .from("household_members")
    .select("allergies, diet_preferences, pathologies")
    .eq("user_id", userId);

  // Contexte de la semaine (hors repas à remplacer) pour éviter les doublons et permettre
  // aux déjeuners de semaine de continuer à référencer un dîner existant.
  const { data: weekMeals } = await supabase
    .from("meals")
    .select("id, meal_date, meal_type, name, meal_foods(quantity_g, foods(name))")
    .eq("meal_plan_id", plan.id)
    .neq("id", meal.id)
    .order("meal_date", { ascending: true });

  const weekMealsList = (weekMeals ?? [])
    .map((m: any) => {
      const ingredients = (m.meal_foods ?? []).map((mf: any) => `${mf.foods?.name ?? "?"} (${Math.round(mf.quantity_g)}g)`).join(", ");
      return `- ${m.meal_date} ${m.meal_type} — ${m.name} : ${ingredients}`;
    })
    .join("\n");

  const month = new Date(meal.meal_date + "T00:00:00Z").getUTCMonth() + 1;
  const dayOffset = Math.round(
    (new Date(meal.meal_date + "T00:00:00Z").getTime() - new Date(plan.week_start + "T00:00:00Z").getTime()) / 86400000
  );
  const isWeekday = dayOffset >= 2 && dayOffset <= 6;

  const { data: seasonalRows, error: seasonalError } = await supabase
    .from("food_seasonality")
    .select("food_id")
    .eq("region_id", profile.region_id)
    .contains("months_available", [month]);
  if (seasonalError) return json({ error: { code: "SEASONALITY_ERROR", message: seasonalError.message } }, 500);
  const seasonalIds = (seasonalRows ?? []).map((r) => r.food_id);

  const { data: foodsData, error: foodsError } = await supabase
    .from("foods")
    .select("id, name, category_id, glycemic_index, allergen_tags, diet_compatibility, unit_concrete_label, tcm_nature, tcm_flavor, food_nutrients(carbs_g, energy_kcal, proteins_g)")
    .in("id", seasonalIds)
    .eq("is_active", true);
  if (foodsError || !foodsData) {
    return json({ error: { code: "CANDIDATES_ERROR", message: foodsError?.message ?? "Impossible de charger les aliments de saison." } }, 500);
  }

  const combined = combineHouseholdRestrictions(
    {
      allergies: restrictions?.allergies ?? [],
      diet_preferences: restrictions?.diet_preferences ?? [],
      pathologies: healthData?.pathologies ?? [],
    },
    householdMembers ?? []
  );
  const allergies = combined.allergies;
  const dietPreferences = combined.dietPreferences;
  const pathologies = combined.pathologies;
  const dislikedNames = (restrictions?.disliked_foods ?? []).map((s: string) => s.toLowerCase());

  const safeFoods = filterSafeFoods(foodsData, allergies, dietPreferences, dislikedNames);

  if (safeFoods.length < 10) {
    return json({ error: { code: "NOT_ENOUGH_FOODS", message: "Pas assez d'aliments compatibles disponibles pour proposer une alternative." } }, 422);
  }

  const isDiabetic = pathologies.some((p) => ["diabetes_type1", "diabetes_type2", "prediabetes"].includes(p));
  const maxIg = isDiabetic ? 40 : 100;
  const calorieTargets = calculateCalorieTargets(profile);
  const mealTypeTarget =
    meal.meal_type === "breakfast"
      ? calorieTargets.perMeal.breakfast
      : meal.meal_type === "lunch"
      ? calorieTargets.perMeal.lunch
      : meal.meal_type === "snack"
      ? calorieTargets.perMeal.snack
      : calorieTargets.perMeal.dinner;

  const foodsList = safeFoods
    .map((f) => {
      const n = nutrientsOf(f.food_nutrients);
      const flavors = (f.tcm_flavor ?? []).join("/") || "n/a";
      return `- id:${f.id} | ${f.name} | IG:${f.glycemic_index ?? "n/a"} | ${Math.round(n.energy_kcal)}kcal/${Math.round(n.proteins_g)}g prot. pour 100g | ${f.unit_concrete_label ?? ""} | MTC nature:${f.tcm_nature ?? "n/a"} saveur:${flavors}`;
    })
    .join("\n");

  const systemPrompt = `Tu remplaces UN SEUL repas dans le planning de l'application Heal. Génère un repas alternatif, différent de "${meal.name}" et des autres repas déjà listés cette semaine.
${isWeekday && meal.meal_type === "lunch"
    ? `Ce déjeuner est un déjeuner de semaine : ce n'est PAS un nouveau repas, reprends EXACTEMENT les aliments et quantités d'un des dîners listés ci-dessous (choisis-en un différent de celui utilisé actuellement si possible), et nomme le repas "[Nom du dîner] (reste)".`
    : `Reste cohérent avec le type de repas "${meal.meal_type}".`}
N'utilise QUE les aliments listés, référencés par leur "id" exact. IG max par aliment : ${maxIg}. Vise environ ${mealTypeTarget} kcal (± 15%), calculé à partir des kcal/100g fournis.
eating_order : liste les noms d'aliments dans l'ordre conseillé légumes → protéines → féculents.
Réponds UNIQUEMENT en JSON valide respectant le schéma, sans texte avant ou après.`;

  const userPrompt = `Repas à remplacer : ${meal.meal_date} — ${meal.meal_type} — actuellement "${meal.name}".

Autres repas déjà prévus cette semaine :
${weekMealsList || "(aucun)"}

Aliments disponibles :
${foodsList}`;

  const responseSchema = {
    type: "object",
    properties: {
      name: { type: "string" },
      eating_order: { type: "array", items: { type: "string" } },
      foods: {
        type: "array",
        items: {
          type: "object",
          properties: { food_id: { type: "integer" }, quantity_g: { type: "number" } },
          required: ["food_id", "quantity_g"],
        },
      },
    },
    required: ["name", "eating_order", "foods"],
  };

  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { responseMimeType: "application/json", responseSchema, temperature: 0.9 },
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
  if (!rawText) return json({ error: { code: "GEMINI_EMPTY", message: "Réponse vide de Gemini." } }, 502);

  let parsed: { name: string; eating_order: string[]; foods: Array<{ food_id: number; quantity_g: number }> };
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return json({ error: { code: "PARSE_ERROR", message: "Réponse Gemini invalide (JSON non parsable)." } }, 502);
  }

  const foodById = new Map(safeFoods.map((f) => [f.id, f]));
  const validFoods = (parsed.foods ?? []).filter((mf) => foodById.has(mf.food_id));
  if (validFoods.length === 0) {
    return json({ error: { code: "GENERATION_INVALID", message: "Aucun aliment valide généré. Réessayez." } }, 502);
  }

  const estimatedGL = validFoods.reduce((sum, mf) => {
    const f = foodById.get(mf.food_id)!;
    const carbs = nutrientsOf(f.food_nutrients).carbs_g;
    return sum + ((f.glycemic_index ?? 0) * (carbs * mf.quantity_g / 100)) / 100;
  }, 0);

  const { error: updateError } = await supabase
    .from("meals")
    .update({
      name: parsed.name,
      estimated_glycemic_load: Math.round(estimatedGL * 10) / 10,
      glycemic_level: glycemicLevelFromLoad(estimatedGL),
      eating_order: parsed.eating_order ?? [],
    })
    .eq("id", meal.id);
  if (updateError) return json({ error: { code: "UPDATE_ERROR", message: updateError.message } }, 500);

  await supabase.from("meal_foods").delete().eq("meal_id", meal.id);
  const mealFoodsPayload = validFoods.map((mf, idx) => ({
    meal_id: meal.id,
    food_id: mf.food_id,
    quantity_g: mf.quantity_g,
    quantity_concrete: foodById.get(mf.food_id)?.unit_concrete_label ?? null,
    sort_order: idx,
  }));
  const { error: insertError } = await supabase.from("meal_foods").insert(mealFoodsPayload);
  if (insertError) return json({ error: { code: "INSERT_ERROR", message: insertError.message } }, 500);

  return json({ meal_id: meal.id, name: parsed.name }, 200);
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
}

type NutrientRow = { energy_kcal?: number; proteins_g?: number; carbs_g?: number };

function nutrientsOf(fn: unknown): { energy_kcal: number; proteins_g: number; carbs_g: number } {
  const row = (Array.isArray(fn) ? fn[0] : fn) as NutrientRow | null | undefined;
  return { energy_kcal: row?.energy_kcal ?? 0, proteins_g: row?.proteins_g ?? 0, carbs_g: row?.carbs_g ?? 0 };
}

