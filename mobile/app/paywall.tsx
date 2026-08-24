import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, fonts, radii } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { parseFunctionError } from '@/lib/functionError';

type Plan = 'monthly' | 'annual';

export default function PaywallScreen() {
  const router = useRouter();
  const { subscription, refreshSubscriptionStatus, signOut } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<Plan>('annual');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trialExpired = subscription?.status === 'trial';

  async function handleSubscribe() {
    setError(null);

    if (Platform.OS !== 'web') {
      Alert.alert(
        'Bientôt disponible',
        "L'abonnement depuis l'application mobile arrive très prochainement. En attendant, vous pouvez vous abonner depuis heal.app sur votre navigateur."
      );
      return;
    }

    setLoading(true);
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://heal.app';
    const { data, error: fnError } = await supabase.functions.invoke('create-checkout-session', {
      body: { plan: selectedPlan, success_url: `${origin}/home`, cancel_url: `${origin}/paywall` },
    });
    setLoading(false);

    if (fnError || data?.error) {
      const parsed = fnError ? await parseFunctionError(fnError) : data?.error;
      setError(parsed?.message ?? "Erreur lors de la préparation du paiement.");
      return;
    }
    if (data?.checkout_url) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = data.checkout_url;
      } else {
        Linking.openURL(data.checkout_url);
      }
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.basileEmoji}>🦡</Text>
        <Text style={styles.title}>{trialExpired ? 'Votre essai gratuit est terminé' : 'Abonnez-vous à Heal'}</Text>
        <Text style={styles.subtitle}>
          Continuez à profiter de vos plannings personnalisés, de votre liste de courses et de vos guides de préparation.
        </Text>

        <Pressable
          style={[styles.planCard, selectedPlan === 'annual' && styles.planCardSelected]}
          onPress={() => setSelectedPlan('annual')}
        >
          <View style={styles.planBadge}>
            <Text style={styles.planBadgeText}>Recommandé — économisez ~40%</Text>
          </View>
          <Text style={styles.planTitle}>Annuel</Text>
          <Text style={styles.planPrice}>49,99 € / an</Text>
          <Text style={styles.planSubprice}>soit environ 4,17 €/mois</Text>
        </Pressable>

        <Pressable
          style={[styles.planCard, selectedPlan === 'monthly' && styles.planCardSelected]}
          onPress={() => setSelectedPlan('monthly')}
        >
          <Text style={styles.planTitle}>Mensuel</Text>
          <Text style={styles.planPrice}>6,99 € / mois</Text>
        </Pressable>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable style={styles.subscribeButton} onPress={handleSubscribe} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.subscribeButtonText}>S'abonner</Text>}
        </Pressable>

        <Pressable style={styles.legalLink} onPress={() => router.push('/legal')}>
          <Text style={styles.legalLinkText}>Conditions générales de vente & mentions légales</Text>
        </Pressable>

        <Pressable style={styles.signOutLink} onPress={signOut}>
          <Text style={styles.signOutLinkText}>Se déconnecter</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40, alignItems: 'center' },
  basileEmoji: { fontSize: 48, marginBottom: 12 },
  title: { fontFamily: fonts.heading, fontSize: 24, color: colors.text, textAlign: 'center', marginBottom: 10 },
  subtitle: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  planCard: {
    width: '100%',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radii.card,
    padding: 20,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  planCardSelected: { borderColor: colors.primary },
  planBadge: { backgroundColor: colors.primary, borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 10 },
  planBadgeText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.white },
  planTitle: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text, marginBottom: 4 },
  planPrice: { fontFamily: fonts.heading, fontSize: 22, color: colors.text },
  planSubprice: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  errorText: { fontFamily: fonts.body, fontSize: 13, color: colors.primary, textAlign: 'center', marginTop: 8, marginBottom: 4 },
  subscribeButton: { width: '100%', backgroundColor: colors.primary, borderRadius: radii.pill, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  subscribeButtonText: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.white },
  legalLink: { marginTop: 20 },
  legalLinkText: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, textDecorationLine: 'underline' },
  signOutLink: { marginTop: 24 },
  signOutLinkText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textMuted },
});
