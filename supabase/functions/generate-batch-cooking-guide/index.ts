import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.6-flash";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TASK_CATEGORIES = ["passive_cooking", "active_cooking", "cutting", "marinade", "sauce_base", "assembly"] as const;

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

  let body: { meal_plan_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    // ignore
  }
  if (!body.meal_plan_id) return json({ error: { code: "MISSING_PLAN_ID", message: "meal_plan_id requis" } }, 400);

  const { data: plan, error: planError } = await supabase
    .from("meal_plans")
    .select("id, user_id, week_start")
    .eq("id", body.meal_plan_id)
    .single();

  if (planError || !plan || plan.user_id !== userId) {
    return json({ error: { code: "PLAN_NOT_FOUND", message: "Planning introuvable ou non autorisé." } }, 404);
  }

  // Seuls les 7 dîners ont besoin de tâches de préparation : ce sont eux qui fournissent
  // la base des déjeuners de semaine (restes). Les déjeuners du week-end sont cuisinés le jour même.
  const { data: meals, error: mealsError } = await supabase
    .from("meals")
    .select("id, meal_date, meal_type, name, meal_foods(quantity_g, foods(name, category_id, food_categories(name)))")
    .eq("meal_plan_id", plan.id)
    .eq("meal_type", "dinner")
    .order("meal_date", { ascending: true });

  if (mealsError || !meals || meals.length === 0) {
    return json({ error: { code: "NO_MEALS", message: mealsError?.message ?? "Aucun dîner trouvé pour ce planning." } }, 422);
  }

  const mealsList = meals
    .map((m) => {
      const ingredients = (m.meal_foods ?? [])
        .map((mf: any) => `${mf.foods?.name ?? '?'} (${Math.round(mf.quantity_g)}g)`)
        .join(", ");
      return `- ${m.meal_date} — ${m.name} : ${ingredients}`;
    })
    .join("\n");

  // Quantités calculées côté serveur (fiables), utilisées pour compléter automatiquement
  // les descriptions des tâches — on ne compte pas sur Gemini pour bien formater les grammages.
  const weekTotalByFood = new Map<string, number>();
  const perDateByFood = new Map<string, Map<string, number>>();
  for (const m of meals) {
    const dateMap = perDateByFood.get(m.meal_date) ?? new Map<string, number>();
    for (const mf of (m.meal_foods ?? []) as any[]) {
      const name: string | undefined = mf.foods?.name;
      if (!name) continue;
      const key = name.toLowerCase().trim();
      const qty: number = mf.quantity_g ?? 0;
      weekTotalByFood.set(key, (weekTotalByFood.get(key) ?? 0) + qty);
      dateMap.set(key, (dateMap.get(key) ?? 0) + qty);
    }
    perDateByFood.set(m.meal_date, dateMap);
  }

  function appendQuantities(description: string, foodsInvolved: string[] | undefined, quantityMap: Map<string, number>): string {
    if (!foodsInvolved || foodsInvolved.length === 0) return description;
    const parts: string[] = [];
    for (const foodName of foodsInvolved) {
      const qty = quantityMap.get(foodName.toLowerCase().trim());
      if (qty) parts.push(`${Math.round(qty)}g ${foodName}`);
    }
    if (parts.length === 0) return description;
    return `${description} (${parts.join(", ")})`;
  }

  const existingGuide = await supabase.from("batch_cooking_guides").select("id").eq("meal_plan_id", plan.id).maybeSingle();

  const systemPrompt = `Tu es le moteur de guide batch cooking de l'application Heal.
La semaine commence le SAMEDI (premier jour du planning, date ${plan.week_start}) : c'est ce jour-là qu'a lieu la grosse préparation. Les déjeuners de semaine (lundi-vendredi) sont des restes des dîners — ils n'ont pas besoin de tâches dédiées, seulement d'être réchauffés/assemblés.

Génère :
1. Une liste de tâches "week-end" (le SAMEDI ${plan.week_start}, ~2h de préparation active + des cuissons longues passives lancées en parallèle) : épluchage/découpe des légumes pour toute la semaine, marinades, cuisson en grande quantité des céréales/légumineuses, bases de sauce, et les cuissons longues (mijotés) des dîners qui s'y prêtent. Si plusieurs dîners utilisent le même aliment, regroupe-le en une seule tâche avec la quantité totale.
2. Pour CHACUN des 7 dîners de la semaine (samedi ${plan.week_start} inclus), un mini guide de finition du soir (~30 min), découpé en PLUSIEURS étapes courtes et concrètes (2 à 4 tâches distinctes, pas une seule phrase fourre-tout) : sortir du frigo, cuisson courte, assemblage, dressage — dans l'ordre où elles doivent être faites. Le dîner du samedi soir doit lui aussi avoir son mini guide (task_date = ${plan.week_start}), même s'il suit de près la préparation du jour.

RÈGLE IMPORTANTE : pour CHAQUE tâche, remplis "foods_involved" avec le(s) nom(s) EXACT(S) des aliments concernés, recopiés tels quels depuis la liste des dîners fournie ci-dessous (même orthographe, même casse). Les quantités en grammes seront ajoutées automatiquement à partir de ces noms — ne les écris pas toi-même dans la description.

Catégorise chaque tâche avec l'une de ces valeurs exactes : passive_cooking, active_cooking, cutting, marinade, sauce_base, assembly.
Les tâches "passive_cooking" (ex: mijoté au four 3h) ne comptent pas dans les 2h de préparation active du week-end.
Réponds UNIQUEMENT en JSON valide respectant le schéma demandé, sans texte avant ou après.`;

  const userPrompt = `Dîners de la semaine du ${plan.week_start} :
${mealsList}`;

  const responseSchema = {
    type: "object",
    properties: {
      basile_tip: { type: "string" },
      weekend_tasks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            task_category: { type: "string", enum: TASK_CATEGORIES },
            foods_involved: { type: "array", items: { type: "string" } },
            estimated_duration_min: { type: "integer" },
          },
          required: ["description", "task_category", "foods_involved", "estimated_duration_min"],
        },
      },
      daily_tasks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            meal_date: { type: "string" },
            description: { type: "string" },
            task_category: { type: "string", enum: TASK_CATEGORIES },
            foods_involved: { type: "array", items: { type: "string" } },
            estimated_duration_min: { type: "integer" },
          },
          required: ["meal_date", "description", "task_category", "foods_involved", "estimated_duration_min"],
        },
      },
    },
    required: ["basile_tip", "weekend_tasks", "daily_tasks"],
  };

  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { responseMimeType: "application/json", responseSchema, temperature: 0.7 },
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

  let parsed: {
    basile_tip: string;
    weekend_tasks: Array<{ description: string; task_category: string; foods_involved?: string[]; estimated_duration_min: number }>;
    daily_tasks: Array<{ meal_date: string; description: string; task_category: string; foods_involved?: string[]; estimated_duration_min: number }>;
  };
  try {
    parsed = JSON.parse(rawText);
  } catch {
    console.error("PARSE_ERROR", rawText.slice(0, 1000));
    return json({ error: { code: "PARSE_ERROR", message: "Réponse Gemini invalide (JSON non parsable)." } }, 502);
  }

  const activeMin = (parsed.weekend_tasks ?? [])
    .filter((t) => t.task_category !== "passive_cooking")
    .reduce((sum, t) => sum + (t.estimated_duration_min ?? 0), 0);
  const passiveMin = (parsed.weekend_tasks ?? [])
    .filter((t) => t.task_category === "passive_cooking")
    .reduce((sum, t) => sum + (t.estimated_duration_min ?? 0), 0);

  let guideId = existingGuide.data?.id as string | undefined;
  if (guideId) {
    await supabase.from("batch_tasks").delete().eq("guide_id", guideId);
    await supabase
      .from("batch_cooking_guides")
      .update({ weekend_estimated_active_min: activeMin, weekend_estimated_passive_min: passiveMin, basile_tip: parsed.basile_tip })
      .eq("id", guideId);
  } else {
    const { data: newGuide, error: guideError } = await supabase
      .from("batch_cooking_guides")
      .insert({
        meal_plan_id: plan.id,
        weekend_estimated_active_min: activeMin,
        weekend_estimated_passive_min: passiveMin,
        basile_tip: parsed.basile_tip,
      })
      .select()
      .single();
    if (guideError || !newGuide) {
      return json({ error: { code: "GUIDE_INSERT_ERROR", message: guideError?.message ?? "Erreur d'insertion du guide." } }, 500);
    }
    guideId = newGuide.id;
  }

  const weekendPayload = (parsed.weekend_tasks ?? []).map((t, idx) => ({
    guide_id: guideId,
    guide_type: "weekend",
    task_date: null,
    task_category: t.task_category,
    description: appendQuantities(t.description, t.foods_involved, weekTotalByFood),
    foods_involved: t.foods_involved ?? [],
    estimated_duration_min: t.estimated_duration_min,
    sort_order: idx,
  }));

  const dailyPayload = (parsed.daily_tasks ?? []).map((t, idx) => ({
    guide_id: guideId,
    guide_type: "daily",
    task_date: t.meal_date,
    task_category: t.task_category,
    description: appendQuantities(t.description, t.foods_involved, perDateByFood.get(t.meal_date) ?? new Map()),
    foods_involved: t.foods_involved ?? [],
    estimated_duration_min: t.estimated_duration_min,
    sort_order: idx,
  }));

  const { error: insertTasksError } = await supabase.from("batch_tasks").insert([...weekendPayload, ...dailyPayload]);
  if (insertTasksError) {
    return json({ error: { code: "TASKS_INSERT_ERROR", message: insertTasksError.message } }, 500);
  }

  return json({ guide_id: guideId, weekend_tasks: weekendPayload.length, daily_tasks: dailyPayload.length }, 200);
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
}
