import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { glycemicLevelFromLoad } from "../_shared/meal-plan-logic.ts";
import { nextStreakState, qualifiesStreakDay, scoreManualValidation } from "../_shared/gamification-logic.ts";
import { fetchSubscriptionAccess } from "../_shared/subscription-logic.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CATEGORY_LEGUMES = 2;
const CATEGORY_FRUITS = 3;
const CATEGORY_FISH = 5;
const CATEGORY_LEGUMINEUSES = 7;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST uniquement" } }, 405);

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

  let body: {
    meal_id?: string;
    method?: "one_click" | "manual";
    foods?: Array<{ food_id: number; quantity_g: number }>;
    photo_path?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    // ignore
  }
  if (!body.meal_id) return json({ error: { code: "MISSING_MEAL_ID", message: "meal_id requis" } }, 400);
  const method = body.method === "manual" ? "manual" : "one_click";

  const { data: meal, error: mealError } = await supabase
    .from("meals")
    .select("id, meal_plan_id, meal_date, meal_type, name, estimated_glycemic_load, eating_order, meal_plans(user_id), meal_foods(food_id, quantity_g, foods(name, category_id, glycemic_index, tcm_nature, tcm_flavor, basile_message, basile_message_tcm, health_benefits, food_nutrients(carbs_g)))")
    .eq("id", body.meal_id)
    .single();

  const plan = (meal as any)?.meal_plans;
  if (mealError || !meal || !plan || plan.user_id !== userId) {
    return json({ error: { code: "MEAL_NOT_FOUND", message: "Repas introuvable ou non autorisé." } }, 404);
  }

  const todayISO = new Date().toISOString().slice(0, 10);
  const cutoffDate = addDays(meal.meal_date, 1);
  if (todayISO > cutoffDate) {
    return json({ error: { code: "VALIDATION_WINDOW_CLOSED", message: "Ce repas ne peut plus être validé (plus de 24h après l'horaire prévu)." } }, 422);
  }

  const { data: existingValidation } = await supabase.from("meal_validations").select("id").eq("meal_id", meal.id).maybeSingle();
  if (existingValidation) {
    return json({ error: { code: "ALREADY_VALIDATED", message: "Ce repas a déjà été validé." } }, 409);
  }

  // --- Détermination des aliments réellement mangés ---
  type EatenFood = {
    food_id: number;
    quantity_g: number;
    name: string;
    category_id: number;
    glycemic_index: number | null;
    carbs_g: number;
    tcm_nature: string | null;
    tcm_flavor: string[] | null;
    basile_message: string | null;
    basile_message_tcm: string | null;
    health_benefits: string[] | null;
  };

  let eatenFoods: EatenFood[] = [];

  if (method === "one_click") {
    eatenFoods = ((meal as any).meal_foods ?? []).map((mf: any) => ({
      food_id: mf.food_id,
      quantity_g: mf.quantity_g,
      name: mf.foods?.name ?? "?",
      category_id: mf.foods?.category_id ?? 0,
      glycemic_index: mf.foods?.glycemic_index ?? null,
      carbs_g: Array.isArray(mf.foods?.food_nutrients) ? mf.foods.food_nutrients[0]?.carbs_g ?? 0 : mf.foods?.food_nutrients?.carbs_g ?? 0,
      tcm_nature: mf.foods?.tcm_nature ?? null,
      tcm_flavor: mf.foods?.tcm_flavor ?? null,
      basile_message: mf.foods?.basile_message ?? null,
      basile_message_tcm: mf.foods?.basile_message_tcm ?? null,
      health_benefits: mf.foods?.health_benefits ?? null,
    }));
  } else {
    if (!body.foods || body.foods.length === 0) {
      return json({ error: { code: "MISSING_FOODS", message: "La validation manuelle nécessite au moins un aliment." } }, 400);
    }
    const foodIds = body.foods.map((f) => f.food_id);
    const { data: foodsData, error: foodsError } = await supabase
      .from("foods")
      .select("id, name, category_id, glycemic_index, tcm_nature, tcm_flavor, basile_message, basile_message_tcm, health_benefits, food_nutrients(carbs_g)")
      .in("id", foodIds);
    if (foodsError || !foodsData) {
      return json({ error: { code: "FOODS_ERROR", message: foodsError?.message ?? "Aliments introuvables." } }, 500);
    }
    const byId = new Map(foodsData.map((f: any) => [f.id, f]));
    eatenFoods = body.foods
      .filter((f) => byId.has(f.food_id))
      .map((f) => {
        const food = byId.get(f.food_id)!;
        const n = Array.isArray(food.food_nutrients) ? food.food_nutrients[0] : food.food_nutrients;
        return {
          food_id: f.food_id,
          quantity_g: f.quantity_g,
          name: food.name,
          category_id: food.category_id,
          glycemic_index: food.glycemic_index,
          carbs_g: n?.carbs_g ?? 0,
          tcm_nature: food.tcm_nature,
          tcm_flavor: food.tcm_flavor,
          basile_message: food.basile_message,
          basile_message_tcm: food.basile_message_tcm,
          health_benefits: food.health_benefits,
        };
      });
  }

  if (eatenFoods.length === 0) {
    return json({ error: { code: "NO_VALID_FOODS", message: "Aucun aliment valide n'a été reconnu." } }, 422);
  }

  // --- Points & score ---
  let points: number;
  let nutritionalScore: number;
  let glycemicLoadActual: number;

  if (method === "one_click") {
    points = 15;
    glycemicLoadActual = meal.estimated_glycemic_load ?? 0;
    nutritionalScore = glycemicLevelFromLoad(glycemicLoadActual) === "low" ? 90 : glycemicLevelFromLoad(glycemicLoadActual) === "moderate" ? 75 : 60;
  } else {
    const scored = scoreManualValidation(eatenFoods);
    points = scored.points;
    nutritionalScore = scored.nutritionalScore;
    glycemicLoadActual = scored.glycemicLoad;
  }

  // --- Message pédagogique de Basile : 3 angles qui tournent (nutrition occidentale par défaut,
  // ordre de consommation ~1 fois sur 3, MTC ~1 fois sur 4 comme demandé par le CdCF US-053) ---
  const roll = Math.random();
  let basileMessage: string;
  let messageLens: "nutrition" | "eating_order" | "tcm";

  const eatingOrder = (meal.eating_order ?? []) as string[];
  const canExplainOrder = eatingOrder.length >= 2;

  if (canExplainOrder && roll < 0.3) {
    messageLens = "eating_order";
    basileMessage = eatingOrderMessage(eatingOrder);
  } else if (roll < 0.55) {
    const tcmCandidates = eatenFoods.filter((f) => f.basile_message_tcm);
    if (tcmCandidates.length > 0) {
      messageLens = "tcm";
      const pick = tcmCandidates[Math.floor(Math.random() * tcmCandidates.length)];
      basileMessage = `${pick.basile_message_tcm} (${pick.name}, médecine traditionnelle chinoise)`;
    } else {
      messageLens = "nutrition";
      basileMessage = nutritionMessage(eatenFoods);
    }
  } else {
    messageLens = "nutrition";
    basileMessage = nutritionMessage(eatenFoods);
  }
  basileMessage = `${basileMessage} +${points} points !`;

  // --- Enregistrement de la validation ---
  const { data: validation, error: validationError } = await supabase
    .from("meal_validations")
    .insert({
      user_id: userId,
      meal_id: meal.id,
      validation_method: method,
      detected_foods: method === "manual" ? body.foods : null,
      photo_url: body.photo_path ?? null,
      nutritional_score: nutritionalScore,
      glycemic_load_actual: Math.round(glycemicLoadActual * 10) / 10,
      points_earned: points,
    })
    .select()
    .single();
  if (validationError || !validation) {
    return json({ error: { code: "VALIDATION_INSERT_ERROR", message: validationError?.message ?? "Erreur lors de l'enregistrement." } }, 500);
  }

  // --- Streak : ce jour compte-t-il désormais ? ---
  const { data: sameDayValidations } = await supabase
    .from("meal_validations")
    .select("meals(meal_type, meal_date)")
    .eq("user_id", userId);
  const sameDayMealTypes = (sameDayValidations ?? [])
    .map((v: any) => v.meals)
    .filter((m: any) => m && m.meal_date === meal.meal_date)
    .map((m: any) => m.meal_type);

  let streakBonus = 0;
  let streakInfo = { currentStreak: 0, maxStreak: 0 };
  if (qualifiesStreakDay(sameDayMealTypes)) {
    const { data: streakRow } = await supabase.from("user_streaks").select("*").eq("user_id", userId).maybeSingle();
    const state = {
      currentStreak: streakRow?.current_streak ?? 0,
      maxStreak: streakRow?.max_streak ?? 0,
      lastActiveDate: streakRow?.last_active_date ?? null,
    };
    const next = nextStreakState(state, meal.meal_date);
    streakBonus = next.bonusPoints;
    streakInfo = { currentStreak: next.currentStreak, maxStreak: next.maxStreak };

    await supabase.from("user_streaks").upsert(
      { user_id: userId, current_streak: next.currentStreak, max_streak: next.maxStreak, last_active_date: next.lastActiveDate },
      { onConflict: "user_id" }
    );
  } else {
    const { data: streakRow } = await supabase.from("user_streaks").select("current_streak, max_streak").eq("user_id", userId).maybeSingle();
    streakInfo = { currentStreak: streakRow?.current_streak ?? 0, maxStreak: streakRow?.max_streak ?? 0 };
  }

  const totalPointsEarned = points + streakBonus;

  // --- Points cumulés + historique ---
  const { data: pointsRow } = await supabase.from("user_points").select("total_points").eq("user_id", userId).maybeSingle();
  const newTotalPoints = (pointsRow?.total_points ?? 0) + totalPointsEarned;
  await supabase.from("user_points").upsert({ user_id: userId, total_points: newTotalPoints }, { onConflict: "user_id" });

  const historyRows = [{ user_id: userId, points, source: "meal_validation", reference_id: validation.id }];
  if (streakBonus > 0) historyRows.push({ user_id: userId, points: streakBonus, source: "streak_bonus", reference_id: validation.id });
  await supabase.from("points_history").insert(historyRows);

  // --- Badges ---
  const newBadges = await checkAndAwardBadges(supabase, userId, streakInfo.currentStreak);

  return json(
    {
      points_earned: totalPointsEarned,
      streak_bonus: streakBonus,
      total_points: newTotalPoints,
      streak: streakInfo,
      new_badges: newBadges,
      basile_message: basileMessage,
      message_lens: messageLens,
      glycemic_load_actual: Math.round(glycemicLoadActual * 10) / 10,
    },
    200
  );
});

function nutritionMessage(foods: { name: string; basile_message: string | null }[]): string {
  const withMessage = foods.filter((f) => f.basile_message);
  if (withMessage.length === 0) return "Bien joué, ce repas contribue à votre équilibre alimentaire.";
  const pick = withMessage[Math.floor(Math.random() * withMessage.length)];
  return `${pick.basile_message} (${pick.name})`;
}

function eatingOrderMessage(eatingOrder: string[]): string {
  const first = eatingOrder[0];
  const last = eatingOrder[eatingOrder.length - 1];
  return `Petit rappel scientifique : en mangeant ${first} avant ${last}, vous aplatissez la courbe de glycémie — les fibres et les protéines mangées en premier ralentissent l'absorption des glucides qui arrivent ensuite. Le même repas mangé dans l'ordre inverse ferait grimper la glycémie bien plus fort, à calories égales.`;
}

// Les badges nécessitant un historique large (légumineuses 4 semaines, 30j sans hors-saison,
// 4 saisons) restent calculés ici plutôt qu'en fonction pure, trop dépendants de requêtes SQL.
async function checkAndAwardBadges(supabase: any, userId: string, currentStreak: number) {
  const { data: badges } = await supabase.from("badges").select("*").order("sort_order");
  const { data: alreadyUnlocked } = await supabase.from("user_badges").select("badge_id").eq("user_id", userId);
  const unlockedIds = new Set((alreadyUnlocked ?? []).map((b: any) => b.badge_id));
  const candidates = (badges ?? []).filter((b: any) => !unlockedIds.has(b.id));
  if (candidates.length === 0) return [];

  const { count: totalValidatedMeals } = await supabase
    .from("meal_validations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  const newlyUnlocked: any[] = [];

  for (const badge of candidates) {
    const cond = badge.unlock_condition;
    let unlocked = false;

    if (cond.type === "meal_count") {
      unlocked = (totalValidatedMeals ?? 0) >= cond.count;
    } else if (cond.type === "streak") {
      unlocked = currentStreak >= cond.days;
    } else if (cond.type === "onboarding_and_first_plan") {
      const { data: profile } = await supabase.from("user_profiles").select("onboarding_completed").eq("id", userId).maybeSingle();
      const { data: anyPlan } = await supabase.from("meal_plans").select("id").eq("user_id", userId).limit(1).maybeSingle();
      unlocked = !!profile?.onboarding_completed && !!anyPlan;
    } else if (cond.type === "vegetable_meals") {
      const { data: validations } = await supabase
        .from("meal_validations")
        .select("id, meal_id, validation_method, detected_foods, meals(meal_foods(quantity_g, foods(category_id)))")
        .eq("user_id", userId);
      const qualifying = (validations ?? []).filter((v: any) => {
        const foodsInMeal = v.meals?.meal_foods ?? [];
        const vegPortions = foodsInMeal.filter((mf: any) => mf.foods?.category_id === CATEGORY_LEGUMES).length;
        return vegPortions >= cond.min_portions;
      });
      unlocked = qualifying.length >= cond.meals;
    } else if (cond.type === "omega3_meals_week") {
      const weekAgo = addDays(new Date().toISOString().slice(0, 10), -7);
      const { data: validations } = await supabase
        .from("meal_validations")
        .select("id, validated_at, meals(meal_foods(foods(category_id, health_benefits)))")
        .eq("user_id", userId)
        .gte("validated_at", weekAgo);
      const qualifying = (validations ?? []).filter((v: any) => {
        const foodsInMeal = v.meals?.meal_foods ?? [];
        return foodsInMeal.some(
          (mf: any) => mf.foods?.category_id === CATEGORY_FISH && (mf.foods?.health_benefits ?? []).includes("omega3")
        );
      });
      unlocked = qualifying.length >= cond.meals;
    } else if (cond.type === "active_days") {
      const { data: validations } = await supabase.from("meal_validations").select("meal_id, meals(meal_date)").eq("user_id", userId);
      const distinctDays = new Set((validations ?? []).map((v: any) => v.meals?.meal_date).filter(Boolean));
      unlocked = distinctDays.size >= cond.days;
    } else if (cond.type === "perfect_week") {
      const { data: validations } = await supabase.from("meal_validations").select("meal_id, meals(meal_date)").eq("user_id", userId);
      const perDay = new Map<string, number>();
      for (const v of validations ?? []) {
        const d = (v as any).meals?.meal_date;
        if (d) perDay.set(d, (perDay.get(d) ?? 0) + 1);
      }
      const days = [...perDay.values()];
      unlocked = days.length >= 7 && days.slice(-7).every((n) => n >= 3);
    } else if (cond.type === "legumes_weeks_streak" || cond.type === "seasonal_streak_days" || cond.type === "all_seasons") {
      // Conditions à historique long — non évaluées automatiquement pour l'instant (nécessitent
      // un suivi hebdomadaire/saisonnier dédié). Laissées pour une itération future plutôt que
      // de simuler un résultat non fiable.
      unlocked = false;
    }

    if (unlocked) {
      // reference_id sur points_history est un uuid : on ne peut pas y mettre l'id entier du
      // badge (a provoqué un échec d'insertion silencieux, non vérifié, lors du premier test) —
      // on utilise l'id de la ligne user_badges qu'on vient de créer, qui est bien un uuid.
      const { data: newUserBadge, error: userBadgeError } = await supabase
        .from("user_badges")
        .insert({ user_id: userId, badge_id: badge.id })
        .select("id")
        .single();
      if (userBadgeError || !newUserBadge) continue;

      if (badge.points_reward > 0) {
        const { data: pr } = await supabase.from("user_points").select("total_points").eq("user_id", userId).maybeSingle();
        await supabase
          .from("user_points")
          .upsert({ user_id: userId, total_points: (pr?.total_points ?? 0) + badge.points_reward }, { onConflict: "user_id" });
        // le CHECK constraint sur points_history.source exige exactement 'badge_unlock'
        // (pas 'badge') — deuxième cause du même bug, trouvée après le fix du type reference_id.
        const { error: historyError } = await supabase
          .from("points_history")
          .insert({ user_id: userId, points: badge.points_reward, source: "badge_unlock", reference_id: newUserBadge.id });
        if (historyError) console.error("BADGE_POINTS_HISTORY_ERROR", historyError.message);
      }
      newlyUnlocked.push(badge);
    }
  }

  return newlyUnlocked;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
