import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { colors, fonts, radii } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const MEAL_TYPE_ORDER = ['breakfast', 'lunch', 'snack', 'dinner'] as const;
const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: 'Petit-déjeuner',
  lunch: 'Déjeuner',
  snack: 'Collation',
  dinner: 'Dîner',
};
const GLYCEMIC_EMOJI: Record<string, string> = { low: '🟢', moderate: '🟡', high: '🔴' };

type MealFood = { quantity_concrete: string | null; quantity_g: number; foods: { name: string } | null };
type Meal = {
  id: string;
  meal_date: string;
  meal_type: string;
  name: string;
  glycemic_level: string;
  estimated_glycemic_load: number;
  eating_order: string[] | null;
  meal_foods: MealFood[];
};

export default function PlanningScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [mealsByDate, setMealsByDate] = useState<Record<string, Meal[]>>({});

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);

    const { data: rolloverProfile } = await supabase
      .from('user_profiles')
      .select('week_rollover_day')
      .eq('id', session?.user.id)
      .maybeSingle();
    const rolloverDay = rolloverProfile?.week_rollover_day ?? 'friday';

    const { data: plans, error: plansError } = await supabase
      .from('meal_plans')
      .select('id, week_start')
      .eq('status', 'active')
      .order('week_start', { ascending: false })
      .limit(2);

    if (plansError || !plans || plans.length === 0) {
      setError('Aucun planning trouvé — générez-en un depuis l\'accueil.');
      setLoading(false);
      return;
    }

    // La page ne bascule sur un planning plus récent qu'à partir du jeudi ou vendredi
    // (au choix de l'utilisateur) précédant son premier jour — sinon on reste sur le planning en cours.
    const todayISO = new Date().toISOString().slice(0, 10);
    const revealOffsetDays = rolloverDay === 'thursday' ? 2 : 1;
    const plan =
      plans.find((p) => {
        const reveal = addDaysISO(p.week_start, -revealOffsetDays);
        return todayISO >= reveal;
      }) ?? plans[plans.length - 1];

    setWeekStart(plan.week_start);

    const { data: meals, error: mealsError } = await supabase
      .from('meals')
      .select('id, meal_date, meal_type, name, glycemic_level, estimated_glycemic_load, eating_order, meal_foods(quantity_concrete, quantity_g, foods(name))')
      .eq('meal_plan_id', plan.id)
      .order('meal_date', { ascending: true });

    if (mealsError || !meals) {
      setError(mealsError?.message ?? 'Impossible de charger les repas.');
      setLoading(false);
      return;
    }

    const grouped: Record<string, Meal[]> = {};
    for (const m of meals as unknown as Meal[]) {
      if (!grouped[m.meal_date]) grouped[m.meal_date] = [];
      grouped[m.meal_date].push(m);
    }
    for (const date of Object.keys(grouped)) {
      grouped[date].sort((a, b) => MEAL_TYPE_ORDER.indexOf(a.meal_type as any) - MEAL_TYPE_ORDER.indexOf(b.meal_type as any));
    }
    setMealsByDate(grouped);
    setLoading(false);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>Retour</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const dates = Object.keys(mealsByDate).sort();

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 14 }}>
              <Pressable onPress={() => router.push('/calendar')} hitSlop={12}>
                <Text style={styles.headerLink}>📆</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/shopping-list')} hitSlop={12}>
                <Text style={styles.headerLink}>🛒</Text>
              </Pressable>
            </View>
          ),
        }}
      />
      <View style={styles.header}>
        <Text style={styles.subtitle}>Semaine du {formatDate(weekStart)}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {dates.map((date) => (
          <View key={date} style={styles.daySection}>
            <Text style={styles.dayLabel}>{formatWeekday(date)} — {formatDate(date)}</Text>
            {mealsByDate[date].map((meal) => (
              <Pressable key={meal.id} style={styles.mealCard} onPress={() => router.push(`/meal/${meal.id}`)}>
                <View style={styles.mealHeaderRow}>
                  <Text style={styles.mealType}>{MEAL_TYPE_LABELS[meal.meal_type] ?? meal.meal_type}</Text>
                  <Text style={styles.glycemicBadge}>{GLYCEMIC_EMOJI[meal.glycemic_level] ?? ''}</Text>
                </View>
                <Text style={styles.mealName}>{meal.name}</Text>
                <Text style={styles.mealIngredients}>
                  {meal.meal_foods.map((mf) => mf.foods?.name).filter(Boolean).join(' · ')}
                </Text>
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function addDaysISO(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
}

function formatWeekday(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('fr-FR', { weekday: 'long', timeZone: 'UTC' });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  header: { paddingHorizontal: 24, paddingTop: 4, paddingBottom: 8 },
  subtitle: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted },
  headerLink: { fontSize: 20, marginRight: 4 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },
  daySection: { marginTop: 20 },
  dayLabel: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.textMuted, marginBottom: 8, textTransform: 'capitalize' },
  mealCard: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radii.card,
    padding: 14,
    marginBottom: 10,
  },
  mealHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mealType: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textMuted, textTransform: 'uppercase' },
  glycemicBadge: { fontSize: 14 },
  mealName: { fontFamily: fonts.heading, fontSize: 16, color: colors.text, marginTop: 4 },
  mealIngredients: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginTop: 4 },
  errorText: { fontFamily: fonts.body, fontSize: 15, color: colors.text, textAlign: 'center', marginBottom: 20 },
  backLink: { paddingVertical: 12 },
  backLinkText: { fontFamily: fonts.bodyMedium, color: colors.primary },
});
