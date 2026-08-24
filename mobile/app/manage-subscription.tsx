import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, fonts, radii } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { parseFunctionError } from '@/lib/functionError';

const STATUS_LABELS: Record<string, string> = {
  trial: "Période d'essai",
  active: 'Actif',
  past_due: 'Paiement en attente',
  canceled: 'Résilié (actif jusqu\'à la fin de la période)',
  expired: 'Expiré',
};

const STORE_MANAGE_URL = Platform.select({
  ios: 'https://apps.apple.com/account/subscriptions',
  android: 'https://play.google.com/store/account/subscriptions',
  default: null,
});

export default function ManageSubscriptionScreen() {
  const router = useRouter();
  const { subscription, refreshSubscriptionStatus } = useAuth();
  const [canceling, setCanceling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleCancel() {
    if (Platform.OS !== 'web') {
      if (STORE_MANAGE_URL) Linking.openURL(STORE_MANAGE_URL);
      else Alert.alert('Résiliation', "Rendez-vous dans les réglages d'abonnement de votre store (App Store / Google Play).");
      return;
    }
    setCanceling(true);
    setError(null);
    setMessage(null);
    const { data, error: fnError } = await supabase.functions.invoke('cancel-subscription', { body: {} });
    setCanceling(false);
    if (fnError || data?.error) {
      const parsed = fnError ? await parseFunctionError(fnError) : data?.error;
      setError(parsed?.message ?? 'Erreur lors de la résiliation.');
      return;
    }
    setMessage(data?.message ?? 'Abonnement résilié.');
    await refreshSubscriptionStatus();
  }

  if (!subscription) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Statut</Text>
          <Text style={styles.statusValue}>{STATUS_LABELS[subscription.status] ?? subscription.status}</Text>
          {subscription.plan ? (
            <Text style={styles.statusDetail}>
              Formule {subscription.plan === 'annual' ? 'annuelle — 49,99 €/an' : 'mensuelle — 6,99 €/mois'}
            </Text>
          ) : null}
          {subscription.status === 'trial' ? (
            <Text style={styles.statusDetail}>Fin d'essai le {subscription.trialEndsAt.slice(0, 10)}</Text>
          ) : subscription.currentPeriodEnd ? (
            <Text style={styles.statusDetail}>Prochain renouvellement le {subscription.currentPeriodEnd.slice(0, 10)}</Text>
          ) : null}
        </View>

        {subscription.status === 'trial' ? (
          <Pressable style={styles.primaryButton} onPress={() => router.push('/paywall')}>
            <Text style={styles.primaryButtonText}>Passer à l'abonnement</Text>
          </Pressable>
        ) : null}

        {(subscription.status === 'active' || subscription.status === 'past_due') && (
          <>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {message ? <Text style={styles.successText}>{message}</Text> : null}
            <Pressable style={styles.dangerButton} onPress={handleCancel} disabled={canceling}>
              {canceling ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={styles.dangerButtonText}>
                  {Platform.OS === 'web' ? 'Résilier mon abonnement' : "Gérer depuis l'App Store / Google Play"}
                </Text>
              )}
            </Pressable>
          </>
        )}

        <Pressable style={styles.legalLink} onPress={() => router.push('/legal')}>
          <Text style={styles.legalLinkText}>Conditions générales de vente & mentions légales</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  statusCard: { backgroundColor: colors.backgroundSecondary, borderRadius: radii.card, padding: 20, marginBottom: 20 },
  statusLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  statusValue: { fontFamily: fonts.heading, fontSize: 20, color: colors.text, marginBottom: 8 },
  statusDetail: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginTop: 2 },
  primaryButton: { backgroundColor: colors.primary, borderRadius: radii.pill, paddingVertical: 16, alignItems: 'center', marginBottom: 16 },
  primaryButtonText: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.white },
  errorText: { fontFamily: fonts.body, fontSize: 13, color: colors.primary, marginBottom: 10, textAlign: 'center' },
  successText: { fontFamily: fonts.body, fontSize: 13, color: colors.secondary, marginBottom: 10, textAlign: 'center' },
  dangerButton: { borderRadius: radii.pill, paddingVertical: 14, alignItems: 'center', backgroundColor: colors.backgroundSecondary },
  dangerButtonText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.primary },
  legalLink: { marginTop: 24, alignItems: 'center' },
  legalLinkText: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, textDecorationLine: 'underline' },
});
