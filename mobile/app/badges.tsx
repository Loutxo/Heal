import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, radii } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

type Badge = {
  id: number;
  name: string;
  description: string;
  icon: string;
  points_reward: number;
  unlocked_at: string | null;
};

export default function BadgesScreen() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [badges, setBadges] = useState<Badge[]>([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    if (!session) return;
    setLoading(true);
    const [{ data: allBadges }, { data: unlocked }] = await Promise.all([
      supabase.from('badges').select('id, name, description, icon, points_reward').order('sort_order'),
      supabase.from('user_badges').select('badge_id, unlocked_at').eq('user_id', session.user.id),
    ]);
    const unlockedMap = new Map((unlocked ?? []).map((u) => [u.badge_id, u.unlocked_at]));
    setBadges((allBadges ?? []).map((b) => ({ ...b, unlocked_at: unlockedMap.get(b.id) ?? null })));
    setLoading(false);
  }

  const unlockedCount = badges.filter((b) => b.unlocked_at).length;

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
        <Text style={styles.subtitle}>
          {unlockedCount} / {badges.length} badges débloqués
        </Text>
        <View style={styles.grid}>
          {badges.map((b) => {
            const unlocked = !!b.unlocked_at;
            return (
              <View key={b.id} style={[styles.badgeCard, !unlocked && styles.badgeCardLocked]}>
                <Text style={[styles.badgeIcon, !unlocked && styles.badgeIconLocked]}>{b.icon}</Text>
                <Text style={[styles.badgeName, !unlocked && styles.badgeNameLocked]}>{b.name}</Text>
                <Text style={styles.badgeDesc}>{b.description}</Text>
                {unlocked ? (
                  <Text style={styles.unlockedText}>Débloqué ✓</Text>
                ) : (
                  <Text style={styles.lockedText}>+{b.points_reward} points quand débloqué</Text>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },
  subtitle: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text, marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  badgeCard: {
    width: '47%',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radii.card,
    padding: 16,
    alignItems: 'center',
  },
  badgeCardLocked: { opacity: 0.55 },
  badgeIcon: { fontSize: 36, marginBottom: 8 },
  badgeIconLocked: { opacity: 0.5 },
  badgeName: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text, textAlign: 'center', marginBottom: 4 },
  badgeNameLocked: { color: colors.textMuted },
  badgeDesc: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, textAlign: 'center', marginBottom: 8, lineHeight: 15 },
  unlockedText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.secondary },
  lockedText: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, textAlign: 'center' },
});
