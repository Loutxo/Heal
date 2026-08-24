import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, radii } from '@/constants/theme';

type Props = {
  step: number;
  totalSteps: number;
  basileMessage: string;
  title: string;
  children: React.ReactNode;
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  loading?: boolean;
};

export function OnboardingShell({
  step,
  totalSteps,
  basileMessage,
  title,
  children,
  onBack,
  onNext,
  nextLabel = 'Suivant',
  nextDisabled = false,
  loading = false,
}: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${(step / totalSteps) * 100}%` }]} />
      </View>
      <Text style={styles.stepLabel}>Étape {step} / {totalSteps}</Text>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.basileMessage}>🦡 {basileMessage}</Text>
        <Text style={styles.title}>{title}</Text>
        {children}
      </ScrollView>

      <View style={styles.actions}>
        {onBack ? (
          <Pressable style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>Retour</Text>
          </Pressable>
        ) : (
          <View style={styles.backButton} />
        )}
        <Pressable
          style={[styles.nextButton, nextDisabled && styles.nextButtonDisabled]}
          onPress={onNext}
          disabled={nextDisabled || loading}
        >
          {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.nextButtonText}>{nextLabel}</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  progressTrack: {
    height: 4,
    backgroundColor: colors.backgroundSecondary,
    marginHorizontal: 24,
    marginTop: 12,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  stepLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    marginHorizontal: 24,
    marginTop: 6,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
  basileMessage: {
    fontFamily: fonts.headingItalic,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.backgroundSecondary,
    padding: 14,
    borderRadius: 16,
    marginBottom: 20,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 22,
    color: colors.text,
    marginBottom: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 20,
    paddingTop: 12,
  },
  backButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  backButtonText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.textMuted,
  },
  nextButton: {
    flex: 2,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    opacity: 0.4,
  },
  nextButtonText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: colors.white,
  },
});
