import { useEffect, useState } from 'react';
import { Text, StyleSheet, Pressable, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, fonts, radii } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

export default function HomeScreen() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  const firstName = (session?.user.user_metadata as { first_name?: string } | undefined)?.first_name;
  const [totalPoints, setTotalPoints] = useState<number | null>(null);
  const [currentStreak, setCurrentStreak] = useState<number>(0);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    if (!session) return;
    const [{ data: points }, { data: streak }] = await Promise.all([
      supabase.from('user_points').select('total_points').eq('user_id', session.user.id).maybeSingle(),
      supabase.from('user_streaks').select('current_streak').eq('user_id', session.user.id).maybeSingle(),
    ]);
    setTotalPoints(points?.total_points ?? 0);
    setCurrentStreak(streak?.current_streak ?? 0);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{firstName ? `Bonjour ${firstName} 👋` : 'Bonjour 👋'}</Text>
        <Text style={styles.subtitle}>Votre profil est complet. Générons votre planning de la semaine.</Text>

        {totalPoints !== null ? (
          <Pressable style={styles.statsRow} onPress={() => router.push('/points-history')}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{totalPoints}</Text>
              <Text style={styles.statLabel}>points</Text>
            </View>
            {currentStreak >= 2 ? (
              <View style={styles.statItem}>
                <Text style={styles.statValue}>🔥 {currentStreak}</Text>
                <Text style={styles.statLabel}>jours d'affilée</Text>
              </View>
            ) : null}
          </Pressable>
        ) : null}

        <Pressable style={styles.primaryButton} onPress={() => router.push('/available-produce')}>
          <Text style={styles.primaryButtonText}>🦡 Générer mon planning</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => router.push('/planning')}>
          <Text style={styles.secondaryButtonText}>Voir mon planning</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => router.push('/shopping-list')}>
          <Text style={styles.secondaryButtonText}>🛒 Liste de courses</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => router.push('/batch-cooking')}>
          <Text style={styles.secondaryButtonText}>🍳 Guide batch cooking</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => router.push('/calendar')}>
          <Text style={styles.secondaryButtonText}>📆 Calendrier</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => router.push('/seasonal-foods')}>
          <Text style={styles.secondaryButtonText}>🌱 Calendrier de saison</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => router.push('/badges')}>
          <Text style={styles.secondaryButtonText}>🏅 Mes badges</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => router.push('/weekly-report')}>
          <Text style={styles.secondaryButtonText}>📊 Rapport hebdomadaire</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => router.push('/settings')}>
          <Text style={styles.secondaryButtonText}>⚙️ Mon profil</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={signOut}>
          <Text style={styles.secondaryButtonText}>Se déconnecter</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 40,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 26,
    color: colors.text,
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 21,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radii.card,
    padding: 16,
    marginBottom: 20,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontFamily: fonts.heading, fontSize: 20, color: colors.text },
  statLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  errorText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.primary,
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: colors.white,
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
  },
  secondaryButton: {
    borderRadius: radii.pill,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    marginBottom: 12,
  },
  secondaryButtonText: {
    color: colors.text,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
  },
});
