import { Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, fonts, radii } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

export default function HomeScreen() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  const firstName = (session?.user.user_metadata as { first_name?: string } | undefined)?.first_name;

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>{firstName ? `Bonjour ${firstName} 👋` : 'Bonjour 👋'}</Text>
      <Text style={styles.subtitle}>Votre profil est complet. Générons votre planning de la semaine.</Text>

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

      <Pressable style={styles.secondaryButton} onPress={() => router.push('/settings')}>
        <Text style={styles.secondaryButtonText}>⚙️ Mon profil</Text>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={signOut}>
        <Text style={styles.secondaryButtonText}>Se déconnecter</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 28,
    paddingTop: 60,
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
    marginBottom: 24,
  },
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
