import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { colors, fonts, radii, seasonalAccents } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

type Report = {
  id: string;
  week_start: string;
  meals_validated: number;
  meals_total: number;
  glycemic_score: number;
  glycemic_level: 'low' | 'moderate' | 'high';
  food_diversity_score: number;
  top_meals: string[];
  basile_advice: string;
};

const LEVEL_COLORS: Record<Report['glycemic_level'], string> = {
  low: colors.secondary,
  moderate: seasonalAccents.summer,
  high: colors.primary,
};

const LEVEL_LABELS: Record<Report['glycemic_level'], string> = {
  low: 'Maîtrisée',
  moderate: 'Modérée',
  high: 'Élevée',
};

export default function WeeklyReportScreen() {
  const { report_id } = useLocalSearchParams<{ report_id?: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<Report | null>(null);
  const [topMealNames, setTopMealNames] = useState<string[]>([]);

  useEffect(() => {
    load();
  }, [report_id]);

  async function load() {
    if (!session) return;
    setLoading(true);
    let query = supabase.from('weekly_reports').select('*').eq('user_id', session.user.id);
    query = report_id ? query.eq('id', report_id) : query.order('week_start', { ascending: false }).limit(1);
    const { data } = await query.maybeSingle();
    setReport(data);

    if (data?.top_meals?.length > 0) {
      const { data: meals } = await supabase.from('meals').select('id, name').in('id', data.top_meals);
      const byId = new Map((meals ?? []).map((m) => [m.id, m.name]));
      setTopMealNames(data.top_meals.map((id: string) => byId.get(id)).filter(Boolean));
    } else {
      setTopMealNames([]);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!report) {
    return (
      <SafeAreaView style={styles.center}>
        <Stack.Screen options={{ title: 'Rapport hebdomadaire' }} />
        <Text style={styles.emptyText}>Aucun rapport disponible pour l'instant — le premier arrive à la fin de votre première semaine complète.</Text>
      </SafeAreaView>
    );
  }

  const weekLabel = new Date(report.week_start + 'T00:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  const levelColor = LEVEL_COLORS[report.glycemic_level];

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Stack.Screen options={{ title: 'Rapport hebdomadaire' }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.weekLabel}>Semaine du {weekLabel}</Text>

        <View style={styles.scoreCard}>
          <View style={[styles.scoreDot, { backgroundColor: levelColor }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.scoreTitle}>Charge glycémique {LEVEL_LABELS[report.glycemic_level].toLowerCase()}</Text>
            <Text style={styles.scoreSubtitle}>Score moyen : {report.glycemic_score}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {report.meals_validated}/{report.meals_total}
            </Text>
            <Text style={styles.statLabel}>repas validés</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{report.food_diversity_score}</Text>
            <Text style={styles.statLabel}>familles d'aliments</Text>
          </View>
        </View>

        {topMealNames.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vos meilleurs repas de la semaine</Text>
            {topMealNames.map((name, i) => (
              <View key={i} style={styles.topMealRow}>
                <Text style={styles.topMealRank}>{i + 1}</Text>
                <Text style={styles.topMealName}>{name}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.adviceCard}>
          <Text style={styles.adviceEmoji}>🦡</Text>
          <Text style={styles.adviceText}>{report.basile_advice}</Text>
        </View>

        <Pressable style={styles.historyLink} onPress={() => router.push('/report-history')}>
          <Text style={styles.historyLinkText}>Voir l'historique des rapports</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyText: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },
  weekLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textMuted, textTransform: 'capitalize', marginBottom: 16 },
  scoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radii.card,
    padding: 18,
    marginBottom: 16,
  },
  scoreDot: { width: 16, height: 16, borderRadius: 8 },
  scoreTitle: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
  scoreSubtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statBox: { flex: 1, backgroundColor: colors.backgroundSecondary, borderRadius: radii.card, padding: 16, alignItems: 'center' },
  statValue: { fontFamily: fonts.heading, fontSize: 22, color: colors.text },
  statLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 4, textAlign: 'center' },
  section: { marginBottom: 20 },
  sectionTitle: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text, marginBottom: 10 },
  topMealRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  topMealRank: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    color: colors.white,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 22,
    overflow: 'hidden',
  },
  topMealName: { fontFamily: fonts.body, fontSize: 14, color: colors.text, flex: 1 },
  adviceCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radii.card,
    padding: 18,
    marginBottom: 20,
  },
  adviceEmoji: { fontSize: 24 },
  adviceText: { fontFamily: fonts.headingItalic, fontSize: 14, color: colors.text, flex: 1, lineHeight: 20 },
  historyLink: { alignItems: 'center', paddingVertical: 10 },
  historyLinkText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textMuted },
});
