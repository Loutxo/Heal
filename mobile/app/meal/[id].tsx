import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';
import { colors, fonts, radii } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meal, setMeal] = useState<MealDetail | null>(null);

  useEffect(() => {
    load();
  }, [id]);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error: mealError } = await supabase
      .from('meals')
      .select(
        'id, name, meal_type, meal_date, glycemic_level, estimated_glycemic_load, eating_order, meal_foods(quantity_g, quantity_concrete, sort_order, foods(name, tcm_nature, food_nutrients(energy_kcal, proteins_g, carbs_g, fat_g, fiber_g)))'
      )
      .eq('id', id)
      .single();

    if (mealError || !data) {
      setError(mealError?.message ?? 'Repas introuvable.');
      setLoading(false);
      return;
    }
    setMeal(data as unknown as MealDetail);
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
            <Text style={styles.sectionTitle}>Ordre de consommation conseillé</Text>
            {meal.eating_order.map((name, idx) => (
              <Text key={idx} style={styles.orderItem}>
                {idx + 1}️⃣ {name}
              </Text>
            ))}
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
      </ScrollView>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },
  mealName: { fontFamily: fonts.heading, fontSize: 22, color: colors.text, marginBottom: 8 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 20 },
  badgeText: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  sectionTitle: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text, marginTop: 20, marginBottom: 10 },
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
  errorText: { fontFamily: fonts.body, fontSize: 15, color: colors.text, textAlign: 'center' },
});
