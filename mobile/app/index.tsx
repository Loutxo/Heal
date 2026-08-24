import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, radii } from '@/constants/theme';

const PITCH_LINES = [
  'Des menus de saison, pensés pour votre corps',
  '2h le dimanche, 30 min chaque soir — c’est tout',
  'Heal apprend à vous connaître semaine après semaine',
];

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <Image
          source={require('../assets/images/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>Heal</Text>
        <Text style={styles.tagline}>
          L&apos;harmonie dans votre assiette, et votre corps au fil des saisons
        </Text>
      </View>

      <View style={styles.pitchList}>
        {PITCH_LINES.map((line) => (
          <View key={line} style={styles.pitchRow}>
            <View style={styles.pitchDot} />
            <Text style={styles.pitchText}>{line}</Text>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <Link href="/signup" asChild>
          <Pressable style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Créer mon compte</Text>
          </Pressable>
        </Link>
        <Link href="/login" asChild>
          <Pressable style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>J&apos;ai déjà un compte</Text>
          </Pressable>
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
  },
  hero: {
    alignItems: 'center',
    marginTop: 24,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 24,
    marginBottom: 16,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 34,
    color: colors.text,
    marginBottom: 8,
  },
  tagline: {
    fontFamily: fonts.headingItalic,
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  pitchList: {
    gap: 16,
  },
  pitchRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  pitchDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.secondary,
    marginTop: 7,
  },
  pitchText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    lineHeight: 22,
  },
  actions: {
    gap: 12,
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.white,
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
  },
  secondaryButton: {
    borderRadius: radii.pill,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.text,
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
  },
});
