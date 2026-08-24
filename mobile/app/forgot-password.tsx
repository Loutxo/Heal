import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import * as Linking from 'expo-linking';
import { colors, fonts, radii } from '@/constants/theme';
import { AuthField } from '@/components/AuthField';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && !loading;

  async function handleSubmit() {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    const redirectTo = Linking.createURL('reset-password');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <Text style={styles.title}>Mot de passe oublié</Text>
      <Text style={styles.subtitle}>
        {sent
          ? 'Si un compte existe avec cet email, un lien de réinitialisation vient de vous être envoyé.'
          : 'Indiquez votre email, nous vous enverrons un lien pour choisir un nouveau mot de passe.'}
      </Text>

      {!sent ? (
        <>
          <View style={styles.form}>
            <AuthField
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="vous@exemple.com"
            />
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Pressable style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]} onPress={handleSubmit} disabled={!canSubmit}>
            {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Envoyer le lien</Text>}
          </Pressable>
        </>
      ) : null}

      <Pressable style={styles.backLink} onPress={() => router.replace('/login')}>
        <Text style={styles.backLinkText}>Retour à la connexion</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 28, paddingTop: 40 },
  title: { fontFamily: fonts.heading, fontSize: 26, color: colors.text, marginBottom: 6 },
  subtitle: { fontFamily: fonts.body, fontSize: 15, color: colors.textMuted, marginBottom: 32, lineHeight: 21 },
  form: { gap: 16, marginBottom: 16 },
  errorText: { fontFamily: fonts.body, fontSize: 13, color: colors.primary, marginBottom: 16 },
  primaryButton: { backgroundColor: colors.primary, borderRadius: radii.pill, paddingVertical: 16, alignItems: 'center' },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: colors.white, fontFamily: fonts.bodyMedium, fontSize: 16 },
  backLink: { marginTop: 24, alignItems: 'center' },
  backLinkText: { fontFamily: fonts.bodyMedium, color: colors.primary },
});
