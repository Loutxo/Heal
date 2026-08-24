import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, fonts, radii } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

const MEAL_TYPE_ORDER = ['breakfast', 'lunch', 'snack', 'dinner'] as const;
const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: 'Petit-déjeuner',
  lunch: 'Déjeuner',
  snack: 'Collation',
  dinner: 'Dîner',
};
const GLYCEMIC_EMOJI: Record<string, string> = { low: '🟢', moderate: '🟡', high: '🔴' };
const WEEKDAY_HEADERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const HISTORY_MONTHS = 12;

type Meal = {
  id: string;
  meal_date: string;
  meal_type: string;
  name: string;
  glycemic_level: string;
  meal_foods: { foods: { name: string } | null }[];
};

type YearMonth = { year: number; month: number }; // month 0-11, en UTC — jamais de Date() en fuseau local ici

function todayISODate(): string {
  // Tout l'app raisonne en dates calendaires UTC pures (voir les autres écrans) : Date.now() en UTC
  // donne "aujourd'hui" indépendamment du fuseau du téléphone.
  return new Date().toISOString().slice(0, 10);
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function isoOf(year: number, month: number, day: number): string {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function weekdayOfFirst(year: number, month: number): number {
  // 0 = lundi ... 6 = dimanche
  return (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
}

function addMonths(ym: YearMonth, delta: number): YearMonth {
  const total = ym.year * 12 + ym.month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

function compareYearMonth(a: YearMonth, b: YearMonth): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}

export default function CalendarScreen() {
  const router = useRouter();
  const todayISO = useMemo(() => todayISODate(), []);
  const [todayYear, todayMonthNum, todayDay] = useMemo(() => todayISO.split('-').map(Number), [todayISO]);
  const todayYM: YearMonth = { year: todayYear, month: todayMonthNum - 1 };

  const [visibleYM, setVisibleYM] = useState<YearMonth>(todayYM);
  const [datesWithMeals, setDatesWithMeals] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<string>(todayISO);
  const [dayMeals, setDayMeals] = useState<Meal[]>([]);
  const [loadingDay, setLoadingDay] = useState(true);
  const [dayError, setDayError] = useState<string | null>(null);

  const earliestYM = useMemo(() => addMonths(todayYM, -HISTORY_MONTHS), [todayISO]);
  const latestYM = useMemo(() => addMonths(todayYM, 1), [todayISO]);

  useEffect(() => {
    loadDots();
  }, []);

  useEffect(() => {
    loadDay(selectedDate);
  }, [selectedDate]);

  async function loadDots() {
    const from = isoOf(earliestYM.year, earliestYM.month, 1);
    const toYM = addMonths(todayYM, 2);
    const to = isoOf(toYM.year, toYM.month, 1);
    const { data } = await supabase.from('meals').select('meal_date').gte('meal_date', from).lte('meal_date', to);
    setDatesWithMeals(new Set((data ?? []).map((m) => m.meal_date)));
  }

  async function loadDay(date: string) {
    setLoadingDay(true);
    setDayError(null);
    const { data, error } = await supabase
      .from('meals')
      .select('id, meal_date, meal_type, name, glycemic_level, meal_foods(foods(name))')
      .eq('meal_date', date)
      .order('meal_type', { ascending: true });

    if (error) {
      setDayError(error.message);
      setDayMeals([]);
    } else {
      const sorted = [...(data as unknown as Meal[])].sort(
        (a, b) => MEAL_TYPE_ORDER.indexOf(a.meal_type as any) - MEAL_TYPE_ORDER.indexOf(b.meal_type as any)
      );
      setDayMeals(sorted);
    }
    setLoadingDay(false);
  }

  function changeMonth(delta: number) {
    setVisibleYM((prev) => {
      const next = addMonths(prev, delta);
      if (compareYearMonth(next, earliestYM) < 0 || compareYearMonth(next, latestYM) > 0) return prev;
      return next;
    });
  }

  const weeks = useMemo(() => buildMonthGrid(visibleYM.year, visibleYM.month), [visibleYM]);
  const monthLabel = new Date(Date.UTC(visibleYM.year, visibleYM.month, 1)).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const canGoPrev = compareYearMonth(addMonths(visibleYM, -1), earliestYM) >= 0;
  const canGoNext = compareYearMonth(addMonths(visibleYM, 1), latestYM) <= 0;

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.monthHeader}>
          <Pressable onPress={() => changeMonth(-1)} disabled={!canGoPrev} hitSlop={12}>
            <Text style={[styles.monthArrow, !canGoPrev && styles.monthArrowDisabled]}>‹</Text>
          </Pressable>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <Pressable onPress={() => changeMonth(1)} disabled={!canGoNext} hitSlop={12}>
            <Text style={[styles.monthArrow, !canGoNext && styles.monthArrowDisabled]}>›</Text>
          </Pressable>
        </View>

        <View style={styles.weekdayRow}>
          {WEEKDAY_HEADERS.map((w, i) => (
            <Text key={i} style={styles.weekdayLabel}>{w}</Text>
          ))}
        </View>

        {weeks.map((week, wi) => (
          <View key={wi} style={styles.weekRow}>
            {week.map((day, ci) => {
              if (day === null) return <View key={ci} style={styles.dayCell} />;
              const iso = isoOf(visibleYM.year, visibleYM.month, day);
              const isSelected = iso === selectedDate;
              const isToday = iso === todayISO;
              const hasMeals = datesWithMeals.has(iso);
              return (
                <Pressable key={ci} style={styles.dayCell} onPress={() => setSelectedDate(iso)}>
                  <View style={[styles.dayCircle, isSelected && styles.dayCircleSelected, isToday && !isSelected && styles.dayCircleToday]}>
                    <Text style={[styles.dayNumber, isSelected && styles.dayNumberSelected]}>{day}</Text>
                  </View>
                  {hasMeals ? <View style={[styles.dot, isSelected && styles.dotSelected]} /> : null}
                </Pressable>
              );
            })}
          </View>
        ))}

        <View style={styles.daySection}>
          <Text style={styles.dayTitle}>{formatFullDate(selectedDate)}</Text>
          {loadingDay ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
          ) : dayError ? (
            <Text style={styles.emptyText}>{dayError}</Text>
          ) : dayMeals.length === 0 ? (
            <Text style={styles.emptyText}>Aucun menu généré pour ce jour-là.</Text>
          ) : (
            dayMeals.map((meal) => (
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
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function buildMonthGrid(year: number, month: number): (number | null)[][] {
  const total = daysInMonth(year, month);
  const firstWeekday = weekdayOfFirst(year, month);

  const cells: (number | null)[] = Array(firstWeekday).fill(null);
  for (let d = 1; d <= total; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 60 },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  monthArrow: { fontSize: 26, color: colors.primary, paddingHorizontal: 12 },
  monthArrowDisabled: { color: colors.textMuted, opacity: 0.4 },
  monthLabel: { fontFamily: fonts.heading, fontSize: 18, color: colors.text, textTransform: 'capitalize' },
  weekdayRow: { flexDirection: 'row', marginBottom: 6 },
  weekdayLabel: { flex: 1, textAlign: 'center', fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textMuted },
  weekRow: { flexDirection: 'row' },
  dayCell: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  dayCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dayCircleSelected: { backgroundColor: colors.primary },
  dayCircleToday: { borderWidth: 1.5, borderColor: colors.primary },
  dayNumber: { fontFamily: fonts.body, fontSize: 14, color: colors.text },
  dayNumberSelected: { color: colors.white, fontFamily: fonts.bodyMedium },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.secondary, marginTop: 2 },
  dotSelected: { backgroundColor: colors.secondary },
  daySection: { marginTop: 24 },
  dayTitle: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text, marginBottom: 12, textTransform: 'capitalize' },
  emptyText: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, marginTop: 8 },
  mealCard: { backgroundColor: colors.backgroundSecondary, borderRadius: radii.card, padding: 14, marginBottom: 10 },
  mealHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mealType: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textMuted, textTransform: 'uppercase' },
  glycemicBadge: { fontSize: 14 },
  mealName: { fontFamily: fonts.heading, fontSize: 16, color: colors.text, marginTop: 4 },
  mealIngredients: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginTop: 4 },
});
