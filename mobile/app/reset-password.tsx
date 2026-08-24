import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { colors, fonts, radii } from '@/constants/theme';
import { AuthField } from '@/components/AuthField';
import { supabase } from '@/lib/supabase';

// Le lien de réinitialisation envoyé par email ramène ici avec un token dans le fragment
// d'URL (#access_token=...&refresh_token=...&type=recovery) — detectSessionInUrl est
// désactivé côté client (lib/supabase.ts) pour rester cohérent entre web et natif,
// donc on extrait et on applique la session nous-mêmes plutôt que de compter sur le SDK.
export default function ResetPasswordScreen() {
  const router = useRouter();
  const url = Linking.useURL();
  const [status, setStatus] = useState<'checking' | 'ready' | 'invalid'>('checking');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    applySessionFromUrl();
  }, [url]);

  async function applySessionFromUrl() {
    if (!url) return;
    const hashIndex = url.indexOf('#');
    const queryIndex = url.indexOf('?');
    const paramsString = hashIndex >= 0 ? url.slice(hashIndex + 1) : queryIndex >= 0 ? url.slice(queryIndex + 1) : '';
    const params = new URLSearchParams(paramsString);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (!accessToken || !refreshToken) {
      setStatus('invalid');
      return;
    }

    const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    setStatus(sessionError ? 'invalid' : 'ready');
  }

  const passwordValid = password.length >= 8;
  const canSubmit = passwordValid && password === confirmPassword && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
  }

  if (status === 'checking') {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (status === 'invalid') {
    return (
      <SafeAreaView style={styles.center}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.title}>Lien invalide ou expiré</Text>
        <Text style={styles.subtitle}>Demandez un nouveau lien de réinitialisation depuis l'écran de connexion.</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.replace('/forgot-password')}>
          <Text style={styles.primaryButtonText}>Redemander un lien</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (done) {
    return (
      <SafeAreaView style={styles.center}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.title}>Mot de passe mis à jour</Text>
        <Text style={styles.subtitle}>Vous pouvez maintenant vous reconnecter avec votre nouveau mot de passe.</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.replace('/login')}>
          <Text style={styles.primaryButtonText}>Se connecter</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <Text style={styles.title}>Nouveau mot de passe</Text>
      <Text style={styles.subtitle}>Choisissez un mot de passe d'au moins 8 caractères.</Text>

      <View style={styles.form}>
        <AuthField label="Nouveau mot de passe" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" />
        <AuthField label="Confirmer le mot de passe" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholder="••••••••" />
      </View>

      {password.length > 0 && !passwordValid ? <Text style={styles.hintText}>8 caractères minimum.</Text> : null}
      {confirmPassword.length > 0 && password !== confirmPassword ? <Text style={styles.hintText}>Les mots de passe ne correspondent pas.</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Pressable style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]} onPress={handleSubmit} disabled={!canSubmit}>
        {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Mettre à jour</Text>}
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 28, paddingTop: 40 },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  title: { fontFamily: fonts.heading, fontSize: 26, color: colors.text, marginBottom: 6, textAlign: 'center' },
  subtitle: { fontFamily: fonts.body, fontSize: 15, color: colors.textMuted, marginBottom: 32, lineHeight: 21, textAlign: 'center' },
  form: { gap: 16, marginBottom: 16 },
  hintText: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginBottom: 8 },
  errorText: { fontFamily: fonts.body, fontSize: 13, color: colors.primary, marginBottom: 16 },
  primaryButton: { backgroundColor: colors.primary, borderRadius: radii.pill, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: colors.white, fontFamily: fonts.bodyMedium, fontSize: 16 },
});
