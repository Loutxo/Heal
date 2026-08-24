import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { colors, fonts, radii } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { BasileFeedback, BasileFeedbackData } from '@/components/BasileFeedback';

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: 'Petit-déjeuner',
  lunch: 'Déjeuner',
  snack: 'Collation',
  dinner: 'Dîner',
};
const GLYCEMIC_LABELS: Record<string, string> = { low: 'Faible 🟢', moderate: 'Modérée 🟡', high: 'Élevée 🔴' };
const TCM_NATURE_LABELS: Record<string, string> = {
  cold: '❄️ Froide',
  cool: '🧊 Fraîche',
  neutral: '⚖️ Neutre',
  warm: '🔥 Tiède',
  hot: '🌶️ Chaude',
};

type NutrientRow = { energy_kcal: number; proteins_g: number; carbs_g: number; fat_g: number; fiber_g: number };

type Ingredient = {
  quantity_g: number;
  quantity_concrete: string | null;
  sort_order: number;
  foods: {
    name: string;
    tcm_nature: string | null;
    tcm_flavor: string[] | null;
    food_nutrients: NutrientRow | NutrientRow[] | null;
  } | null;
};

type MealDetail = {
  id: string;
  name: string;
  meal_type: string;
  meal_date: string;
  glycemic_level: string;
  estimated_glycemic_load: number;
  eating_order: string[] | null;
  meal_foods: Ingredient[];
};

export default function MealDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meal, setMeal] = useState<MealDetail | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [isValidated, setIsValidated] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<BasileFeedbackData | null>(null);
  const [showOrderInfo, setShowOrderInfo] = useState(false);
  const [showTcmInfo, setShowTcmInfo] = useState(false);

  useEffect(() => {
    load();
  }, [id]);

  async function handleSwap() {
    if (!id || swapping || isValidated) return;
    setSwapping(true);
    setSwapError(null);
    const { data, error: swapErr } = await supabase.functions.invoke('swap-meal', { body: { meal_id: id } });
    if (swapErr || data?.error) {
      setSwapError(data?.error?.message ?? swapErr?.message ?? 'Erreur lors du remplacement.');
      setSwapping(false);
      return;
    }
    await load();
    setSwapping(false);
  }

  async function handleValidate() {
    if (!id || validating || isValidated) return;
    setValidating(true);
    setValidationError(null);
    const { data, error: validateErr } = await supabase.functions.invoke('validate-meal', {
      body: { meal_id: id, method: 'one_click' },
    });
    setValidating(false);
    if (validateErr || data?.error) {
      setValidationError(data?.error?.message ?? validateErr?.message ?? 'Erreur lors de la validation.');
      return;
    }
    setIsValidated(true);
    setFeedback(data);
  }

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error: mealError } = await supabase
      .from('meals')
      .select(
        'id, name, meal_type, meal_date, glycemic_level, estimated_glycemic_load, eating_order, meal_foods(quantity_g, quantity_concrete, sort_order, foods(name, tcm_nature, tcm_flavor, food_nutrients(energy_kcal, proteins_g, carbs_g, fat_g, fiber_g)))'
      )
      .eq('id', id)
      .single();

    if (mealError || !data) {
      setError(mealError?.message ?? 'Repas introuvable.');
      setLoading(false);
      return;
    }
    setMeal(data as unknown as MealDetail);

    const { data: existingValidation } = await supabase.from('meal_validations').select('id').eq('meal_id', id).maybeSingle();
    setIsValidated(!!existingValidation);

    setLoading(false);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (error || !meal) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>{error ?? 'Repas introuvable.'}</Text>
      </SafeAreaView>
    );
  }

  const ingredients = [...meal.meal_foods].sort((a, b) => a.sort_order - b.sort_order);
  const totals = ingredients.reduce(
    (acc, ing) => {
      const n = nutrientsOf(ing.foods?.food_nutrients ?? null);
      const factor = ing.quantity_g / 100;
      acc.kcal += n.energy_kcal * factor;
      acc.protein += n.proteins_g * factor;
      acc.carbs += n.carbs_g * factor;
      acc.fat += n.fat_g * factor;
      acc.fiber += n.fiber_g * factor;
      return acc;
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  );

  const dominantNature = mostCommon(ingredients.map((i) => i.foods?.tcm_nature).filter(Boolean) as string[]);
  const dominantFlavors = [...new Set(ingredients.flatMap((i) => i.foods?.tcm_flavor ?? []))];

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Stack.Screen options={{ title: MEAL_TYPE_LABELS[meal.meal_type] ?? 'Détail du repas' }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.mealName}>{meal.name}</Text>

        <View style={styles.badgeRow}>
          <Text style={styles.badgeText}>Charge glycémique : {GLYCEMIC_LABELS[meal.glycemic_level] ?? meal.glycemic_level}</Text>
          {dominantNature ? (
            <Text style={styles.badgeText}>· Nature MTC : {TCM_NATURE_LABELS[dominantNature] ?? dominantNature}</Text>
          ) : null}
          {isValidated ? <Text style={styles.validatedBadge}>✓ Validé</Text> : null}
        </View>

        <Text style={styles.sectionTitle}>Ingrédients & quantités</Text>
        {ingredients.map((ing, idx) => (
          <View key={idx} style={styles.ingredientRow}>
            <Text style={styles.ingredientName}>{ing.foods?.name ?? '—'}</Text>
            <Text style={styles.ingredientQty}>{Math.round(ing.quantity_g)} g</Text>
          </View>
        ))}

        {meal.eating_order && meal.eating_order.length > 0 ? (
          <>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Ordre de consommation conseillé</Text>
              <Pressable onPress={() => setShowOrderInfo((v) => !v)} hitSlop={10}>
                <Text style={styles.infoToggle}>{showOrderInfo ? 'Masquer' : 'Pourquoi ? 🦡'}</Text>
              </Pressable>
            </View>
            {meal.eating_order.map((name, idx) => (
              <Text key={idx} style={styles.orderItem}>
                {idx + 1}️⃣ {name}
              </Text>
            ))}
            {showOrderInfo ? (
              <View style={styles.pedagogyBox}>
                <Text style={styles.pedagogyText}>
                  L'ordre dans lequel vous mangez change vraiment la réponse de votre corps : commencer par les légumes et les
                  protéines, et terminer par les féculents, ralentit l'arrivée du sucre dans le sang. Résultat : un pic de
                  glycémie bien plus faible qu'en mangeant les mêmes aliments dans l'ordre inverse — à quantité et calories
                  strictement égales. C'est une astuce validée par plusieurs études de recherche clinique, pas juste une habitude
                  traditionnelle.
                </Text>
              </View>
            ) : null}
          </>
        ) : null}

        {dominantNature ? (
          <>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Éclairage médecine chinoise</Text>
              <Pressable onPress={() => setShowTcmInfo((v) => !v)} hitSlop={10}>
                <Text style={styles.infoToggle}>{showTcmInfo ? 'Masquer' : 'En savoir plus 🦡'}</Text>
              </Pressable>
            </View>
            <Text style={styles.orderItem}>
              {TCM_NATURE_LABELS[dominantNature] ?? dominantNature}
              {dominantFlavors.length > 0 ? ` · saveur ${dominantFlavors.join('/')}` : ''}
            </Text>
            {showTcmInfo ? (
              <View style={styles.pedagogyBox}>
                <Text style={styles.pedagogyText}>{tcmExplanation(dominantNature)}</Text>
                <Text style={[styles.pedagogyText, { marginTop: 8, fontStyle: 'italic' }]}>
                  Rappel : ceci enrichit la lecture nutritionnelle occidentale, elle ne la remplace jamais — les règles de
                  glycémie et vos restrictions médicales restent toujours prioritaires.
                </Text>
              </View>
            ) : null}
          </>
        ) : null}

        <Text style={styles.sectionTitle}>Valeurs nutritionnelles (repas complet)</Text>
        <View style={styles.nutritionGrid}>
          <NutritionCell label="Énergie" value={`${Math.round(totals.kcal)} kcal`} />
          <NutritionCell label="Protéines" value={`${Math.round(totals.protein)} g`} />
          <NutritionCell label="Glucides" value={`${Math.round(totals.carbs)} g`} />
          <NutritionCell label="Lipides" value={`${Math.round(totals.fat)} g`} />
          <NutritionCell label="Fibres" value={`${Math.round(totals.fiber)} g`} />
        </View>

        {validationError ? <Text style={styles.errorText}>{validationError}</Text> : null}
        {isValidated ? (
          <View style={styles.validatedNotice}>
            <Text style={styles.validatedNoticeText}>✓ Ce repas a été validé.</Text>
          </View>
        ) : (
          <>
            <Pressable style={styles.validateButton} onPress={handleValidate} disabled={validating}>
              {validating ? <ActivityIndicator color={colors.white} /> : <Text style={styles.validateButtonText}>✓ J'ai mangé ça</Text>}
            </Pressable>
            <Pressable style={styles.manualValidateLink} onPress={() => router.push(`/validate-manual?meal_id=${id}`)}>
              <Text style={styles.manualValidateLinkText}>J'ai mangé autre chose</Text>
            </Pressable>
            <Pressable style={styles.manualValidateLink} onPress={() => router.push(`/validate-photo?meal_id=${id}`)}>
              <Text style={styles.manualValidateLinkText}>📷 Valider avec une photo</Text>
            </Pressable>
          </>
        )}

        {swapError ? <Text style={styles.errorText}>{swapError}</Text> : null}
        {!isValidated ? (
          <Pressable style={[styles.swapButton, swapping && styles.swapButtonDisabled]} onPress={handleSwap} disabled={swapping}>
            {swapping ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.swapButtonText}>🔄 Remplacer ce repas</Text>}
          </Pressable>
        ) : null}
      </ScrollView>

      {feedback ? <BasileFeedback data={feedback} onClose={() => setFeedback(null)} /> : null}
    </SafeAreaView>
  );
}

function NutritionCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.nutritionCell}>
      <Text style={styles.nutritionValue}>{value}</Text>
      <Text style={styles.nutritionLabel}>{label}</Text>
    </View>
  );
}

function nutrientsOf(fn: NutrientRow | NutrientRow[] | null): NutrientRow {
  const empty: NutrientRow = { energy_kcal: 0, proteins_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };
  if (!fn) return empty;
  if (Array.isArray(fn)) return fn[0] ?? empty;
  return fn;
}

function mostCommon(values: string[]): string | null {
  if (values.length === 0) return null;
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function tcmExplanation(nature: string): string {
  switch (nature) {
    case 'cold':
    case 'cool':
      return "Un repas à dominante fraîche/froide rafraîchit l'organisme selon la diététique chinoise — idéal en été ou en cas de chaleur interne, mais à consommer avec plus de modération en hiver ou si vous avez tendance à avoir froid.";
    case 'warm':
    case 'hot':
      return "Un repas à dominante tiède/chaude réchauffe l'organisme selon la diététique chinoise — particulièrement adapté en automne et en hiver, ou si vous êtes frileux(se). Idéal après une baisse de température.";
    default:
      return "Un repas à nature neutre convient à tout le monde, toute l'année, sans effet réchauffant ou rafraîchissant marqué selon la diététique chinoise — une base équilibrée sur laquelle s'appuyer.";
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },
  mealName: { fontFamily: fonts.heading, fontSize: 22, color: colors.text, marginBottom: 8 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 20, alignItems: 'center' },
  badgeText: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  validatedBadge: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.secondary },
  sectionTitle: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text, marginTop: 20, marginBottom: 10 },
  sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoToggle: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.primary, marginTop: 20 },
  pedagogyBox: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radii.card,
    padding: 14,
    marginTop: 4,
    marginBottom: 8,
  },
  pedagogyText: { fontFamily: fonts.body, fontSize: 13.5, color: colors.text, lineHeight: 20 },
  ingredientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundSecondary,
  },
  ingredientName: { fontFamily: fonts.body, fontSize: 15, color: colors.text },
  ingredientQty: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
  orderItem: { fontFamily: fonts.body, fontSize: 15, color: colors.text, marginBottom: 6 },
  nutritionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  nutritionCell: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radii.card,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minWidth: 90,
    alignItems: 'center',
  },
  nutritionValue: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
  nutritionLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  errorText: { fontFamily: fonts.body, fontSize: 15, color: colors.text, textAlign: 'center', marginTop: 16 },
  validateButton: {
    marginTop: 28,
    borderRadius: radii.pill,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  validateButtonText: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.white },
  manualValidateLink: { marginTop: 12, alignItems: 'center' },
  manualValidateLinkText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textMuted },
  validatedNotice: {
    marginTop: 28,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radii.card,
    paddingVertical: 14,
    alignItems: 'center',
  },
  validatedNoticeText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.secondary },
  swapButton: {
    marginTop: 12,
    borderRadius: radii.pill,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
  },
  swapButtonDisabled: { opacity: 0.6 },
  swapButtonText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.primary },
});
