import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, fonts, radii, seasonalAccents } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

type ReportSummary = {
  id: string;
  week_start: string;
  meals_validated: number;
  meals_total: number;
  glycemic_level: 'low' | 'moderate' | 'high';
  food_diversity_score: number;
};

const LEVEL_COLORS: Record<ReportSummary['glycemic_level'], string> = {
  low: colors.secondary,
  moderate: seasonalAccents.summer,
  high: colors.primary,
};

export default function ReportHistoryScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ReportSummary[]>([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    if (!session) return;
    setLoading(true);
    // 12 semaines conservées (US-070) — la BDD n'implémente pas encore de purge automatique
    // au-delà, cette limite ne fait que borner l'affichage pour l'instant.
    const { data } = await supabase
      .from('weekly_reports')
      .select('id, week_start, meals_validated, meals_total, glycemic_level, food_diversity_score')
      .eq('user_id', session.user.id)
      .order('week_start', { ascending: false })
      .limit(12);
    setReports(data ?? []);
    setLoading(false);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {reports.length === 0 ? (
          <Text style={styles.emptyText}>Aucun rapport pour l'instant.</Text>
        ) : (
          reports.map((r) => {
            const weekLabel = new Date(r.week_start + 'T00:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
            return (
              <Pressable key={r.id} style={styles.card} onPress={() => router.push(`/weekly-report?report_id=${r.id}`)}>
                <View style={[styles.dot, { backgroundColor: LEVEL_COLORS[r.glycemic_level] }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardWeek}>Semaine du {weekLabel}</Text>
                  <Text style={styles.cardStats}>
                    {r.meals_validated}/{r.meals_total} repas · {r.food_diversity_score} familles d'aliments
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },
  emptyText: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radii.card,
    padding: 16,
    marginBottom: 10,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  cardWeek: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text, textTransform: 'capitalize' },
  cardStats: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  chevron: { fontFamily: fonts.body, fontSize: 20, color: colors.textMuted },
});
