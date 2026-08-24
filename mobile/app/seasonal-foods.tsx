import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, radii } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
const TCM_NATURE_LABELS: Record<string, string> = { cold: 'froide', cool: 'fraîche', neutral: 'neutre', warm: 'tiède', hot: 'chaude' };
const TCM_NATURE_COLORS: Record<string, string> = {
  cold: '#5B8DBE',
  cool: '#7FA8C9',
  neutral: colors.textMuted,
  warm: '#D98B4A',
  hot: colors.primary,
};

type Food = { id: number; name: string; tcm_nature: string | null; category_name: string };

export default function SeasonalFoodsScreen() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regionName, setRegionName] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getUTCMonth() + 1);
  const [foods, setFoods] = useState<Food[]>([]);

  useEffect(() => {
    load();
  }, [selectedMonth]);

  async function load() {
    if (!session) return;
    setLoading(true);
    setError(null);

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('region_id, regions(name)')
      .eq('id', session.user.id)
      .maybeSingle();

    const regionId = profile?.region_id;
    setRegionName((profile as any)?.regions?.name ?? '');

    if (!regionId) {
      setError('Aucune région définie sur votre profil.');
      setLoading(false);
      return;
    }

    const { data: seasonalRows, error: seasonalError } = await supabase
      .from('food_seasonality')
      .select('food_id')
      .eq('region_id', regionId)
      .contains('months_available', [selectedMonth]);

    if (seasonalError || !seasonalRows) {
      setError(seasonalError?.message ?? 'Impossible de charger les aliments de saison.');
      setLoading(false);
      return;
    }

    const foodIds = seasonalRows.map((r) => r.food_id);
    if (foodIds.length === 0) {
      setFoods([]);
      setLoading(false);
      return;
    }

    const { data: foodsData, error: foodsError } = await supabase
      .from('foods')
      .select('id, name, tcm_nature, food_categories(name)')
      .in('id', foodIds)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (foodsError || !foodsData) {
      setError(foodsError?.message ?? 'Impossible de charger les aliments.');
      setLoading(false);
      return;
    }

    setFoods(
      foodsData.map((f: any) => ({ id: f.id, name: f.name, tcm_nature: f.tcm_nature, category_name: f.food_categories?.name ?? 'Autre' }))
    );
    setLoading(false);
  }

  const groups = useMemo(() => {
    const byCategory: Record<string, Food[]> = {};
    for (const f of foods) {
      if (!byCategory[f.category_name]) byCategory[f.category_name] = [];
      byCategory[f.category_name].push(f);
    }
    return Object.entries(byCategory).sort((a, b) => b[1].length - a[1].length);
  }, [foods]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <View style={styles.header}>
        {regionName ? <Text style={styles.subtitle}>Aliments de saison en {regionName}</Text> : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monthRow}>
          {MONTH_LABELS.map((label, idx) => {
            const month = idx + 1;
            const isSelected = month === selectedMonth;
            return (
              <Pressable key={month} style={[styles.monthChip, isSelected && styles.monthChipSelected]} onPress={() => setSelectedMonth(month)}>
                <Text style={[styles.monthChipText, isSelected && styles.monthChipTextSelected]}>{label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {foods.length === 0 ? (
            <Text style={styles.emptyText}>Aucun aliment recensé pour ce mois dans votre région.</Text>
          ) : (
            groups.map(([category, items]) => (
              <View key={category} style={styles.section}>
                <Text style={styles.sectionTitle}>{category}</Text>
                <View style={styles.chipWrap}>
                  {items.map((f) => (
                    <View key={f.id} style={styles.foodChip}>
                      {f.tcm_nature ? <View style={[styles.natureDot, { backgroundColor: TCM_NATURE_COLORS[f.tcm_nature] ?? colors.textMuted }]} /> : null}
                      <Text style={styles.foodChipText}>{f.name}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))
          )}
          <View style={styles.legend}>
            <Text style={styles.legendTitle}>Nature MTC</Text>
            <View style={styles.chipWrap}>
              {Object.entries(TCM_NATURE_LABELS).map(([key, label]) => (
                <View key={key} style={styles.legendItem}>
                  <View style={[styles.natureDot, { backgroundColor: TCM_NATURE_COLORS[key] }]} />
                  <Text style={styles.legendText}>{label}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12 },
  subtitle: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text, marginBottom: 12 },
  monthRow: { gap: 8 },
  monthChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill, backgroundColor: colors.backgroundSecondary },
  monthChipSelected: { backgroundColor: colors.primary },
  monthChipText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
  monthChipTextSelected: { color: colors.white },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 60 },
  section: { marginTop: 20 },
  sectionTitle: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text, marginBottom: 10 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  foodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  foodChipText: { fontFamily: fonts.body, fontSize: 13, color: colors.text },
  natureDot: { width: 8, height: 8, borderRadius: 4 },
  emptyText: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, marginTop: 24, textAlign: 'center' },
  errorText: { fontFamily: fonts.body, fontSize: 14, color: colors.primary, marginTop: 40, textAlign: 'center', paddingHorizontal: 24 },
  legend: { marginTop: 32, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.backgroundSecondary },
  legendTitle: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textMuted, marginBottom: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 12 },
  legendText: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
});
