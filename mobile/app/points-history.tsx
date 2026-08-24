import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, radii } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const SOURCE_LABELS: Record<string, string> = {
  meal_validation: 'Repas validé',
  streak_bonus: '🔥 Bonus streak',
  badge: '🏅 Badge débloqué',
};

type Entry = { id: string; points: number; source: string; earned_at: string };

export default function PointsHistoryScreen() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    if (!session) return;
    setLoading(true);
    const { data } = await supabase
      .from('points_history')
      .select('id, points, source, earned_at')
      .eq('user_id', session.user.id)
      .order('earned_at', { ascending: false })
      .limit(200);
    setEntries(data ?? []);
    setLoading(false);
  }

  const weeks = useMemo(() => {
    const groups: Record<string, Entry[]> = {};
    for (const e of entries) {
      const weekKey = isoWeekLabel(e.earned_at);
      if (!groups[weekKey]) groups[weekKey] = [];
      groups[weekKey].push(e);
    }
    return Object.entries(groups);
  }, [entries]);

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
        {weeks.length === 0 ? (
          <Text style={styles.emptyText}>Aucun point gagné pour l'instant — validez votre premier repas !</Text>
        ) : (
          weeks.map(([week, weekEntries]) => (
            <View key={week} style={styles.weekSection}>
              <View style={styles.weekHeader}>
                <Text style={styles.weekLabel}>{week}</Text>
                <Text style={styles.weekTotal}>+{weekEntries.reduce((s, e) => s + e.points, 0)} points</Text>
              </View>
              {weekEntries.map((e) => (
                <View key={e.id} style={styles.entryRow}>
                  <Text style={styles.entrySource}>{SOURCE_LABELS[e.source] ?? e.source}</Text>
                  <Text style={styles.entryPoints}>+{e.points}</Text>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function isoWeekLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const start = new Date(d);
  const day = (start.getDay() + 6) % 7; // 0 = lundi
  start.setDate(start.getDate() - day);
  return `Semaine du ${start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },
  emptyText: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  weekSection: { marginBottom: 24 },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  weekLabel: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text, textTransform: 'capitalize' },
  weekTotal: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.primary },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radii.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 6,
  },
  entrySource: { fontFamily: fonts.body, fontSize: 14, color: colors.text },
  entryPoints: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.secondary },
});
