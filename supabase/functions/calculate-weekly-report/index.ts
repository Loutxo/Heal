import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { glycemicLevelFromLoad } from "../_shared/meal-plan-logic.ts";
import { averageGlycemicLoad, basileAdviceForReport, foodDiversityScore, mostRecentSaturday, pickTopMeals } from "../_shared/weekly-report-logic.ts";
import { buildPushMessages, sendExpoPushBatch } from "../_shared/push-logic.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Déclenchée par pg_cron (verify_jwt désactivé, cf. migration schedule_weekly_report_cron) —
// pas de JWT utilisateur ici, on tourne en batch pour tous les comptes via le client service_role.
// Body optionnel { week_start } pour forcer une semaine précise lors de tests manuels.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST uniquement" } }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let body: { week_start?: string } = {};
  try {
    body = await req.json();
  } catch {
    // ignore, body optionnel
  }

  const todayISO = new Date().toISOString().slice(0, 10);
  const weekStart = body.week_start ?? mostRecentSaturday(todayISO);

  const { data: plans, error: plansError } = await admin.from("meal_plans").select("id, user_id, week_start").eq("week_start", weekStart);
  if (plansError) {
    return json({ error: { code: "PLANS_ERROR", message: plansError.message } }, 500);
  }
  let created = 0;
  let skipped = 0;

  for (const plan of plans ?? []) {
    const { data: existing } = await admin
      .from("weekly_reports")
      .select("id")
      .eq("user_id", plan.user_id)
      .eq("week_start", weekStart)
      .maybeSingle();
    if (existing) {
      skipped++;
      continue;
    }

    const { data: meals } = await admin
      .from("meals")
      .select("id, name, estimated_glycemic_load, meal_foods(foods(category_id))")
      .eq("meal_plan_id", plan.id);

    const mealIds = (meals ?? []).map((m: any) => m.id);
    const { data: validations } = await admin
      .from("meal_validations")
      .select("meal_id, nutritional_score, glycemic_load_actual")
      .in("meal_id", mealIds.length > 0 ? mealIds : ["00000000-0000-0000-0000-000000000000"]);

    const mealsTotal = meals?.length ?? 0;
    const mealsValidated = validations?.length ?? 0;

    const validatedMealIds = new Set((validations ?? []).map((v: any) => v.meal_id));
    const actualLoads = (validations ?? []).map((v: any) => v.glycemic_load_actual ?? 0);
    const plannedLoads = (meals ?? []).map((m: any) => m.estimated_glycemic_load ?? 0);
    const glycemicScore = averageGlycemicLoad(actualLoads.length > 0 ? actualLoads : plannedLoads);
    const glycemicLevel = glycemicLevelFromLoad(glycemicScore);

    const validatedMeals = (meals ?? []).filter((m: any) => validatedMealIds.has(m.id));
    const categoryIds = validatedMeals.flatMap((m: any) => (m.meal_foods ?? []).map((mf: any) => mf.foods?.category_id).filter(Boolean));
    const foodDiversity = foodDiversityScore(categoryIds);

    const scoredMeals = (validations ?? []).map((v: any) => ({ id: v.meal_id as string, score: v.nutritional_score ?? 0 }));
    const topMeals = pickTopMeals(scoredMeals, 3);

    const basileAdvice = basileAdviceForReport({ mealsValidated, mealsTotal, glycemicLevel, foodDiversity });

    const { error: insertError } = await admin.from("weekly_reports").insert({
      user_id: plan.user_id,
      meal_plan_id: plan.id,
      week_start: weekStart,
      meals_validated: mealsValidated,
      meals_total: mealsTotal,
      glycemic_score: Math.round(glycemicScore * 10) / 10,
      glycemic_level: glycemicLevel,
      food_diversity_score: foodDiversity,
      top_meals: topMeals,
      basile_advice: basileAdvice,
    });
    if (insertError) {
      console.error("WEEKLY_REPORT_INSERT_ERROR", plan.user_id, insertError.message);
      continue;
    }
    created++;

    const { data: profile } = await admin.from("user_profiles").select("notif_weekly_report").eq("id", plan.user_id).maybeSingle();
    if (profile?.notif_weekly_report) {
      const { data: tokens } = await admin.from("push_tokens").select("expo_push_token").eq("user_id", plan.user_id);
      const messages = buildPushMessages(
        (tokens ?? []).map((t: any) => t.expo_push_token),
        "🦡 Votre rapport de la semaine est prêt",
        basileAdvice,
        { screen: "weekly-report" }
      );
      if (messages.length > 0) await sendExpoPushBatch(messages);
    }
  }

  return json({ week_start: weekStart, created, skipped }, 200);
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
}
