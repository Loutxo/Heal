import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Link, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { colors, fonts, radii } from '@/constants/theme';
import { AuthField } from '@/components/AuthField';
import { useAuth } from '@/context/AuthContext';

export default function SignupScreen() {
  const { signUp } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedGdpr, setAcceptedGdpr] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const validationMessage = (() => {
    if (firstName.trim().length === 0) return null; // pas encore commencé à remplir, pas la peine d'alarmer
    if (email.trim().length === 0) return null;
    if (password.length === 0) return null;
    if (password.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères.';
    if (confirmPassword.length > 0 && password !== confirmPassword) return 'Les mots de passe ne correspondent pas.';
    if (password === confirmPassword && !acceptedGdpr) return 'Merci d’accepter les CGU et la politique de confidentialité.';
    return null;
  })();

  const canSubmit =
    firstName.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= 8 &&
    password === confirmPassword &&
    acceptedGdpr &&
    !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    const { error: signUpError, needsEmailConfirmation } = await signUp({
      firstName: firstName.trim(),
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (signUpError) {
      setError(signUpError);
      return;
    }
    if (needsEmailConfirmation) {
      setConfirmationSent(true);
      // Sinon, la redirection vers /home est gérée par app/_layout.tsx (écoute de session)
    }
  };

  if (confirmationSent) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.title}>Vérifiez vos emails</Text>
        <Text style={styles.subtitle}>
          Un email de confirmation a été envoyé à {email.trim()}. Cliquez sur le lien pour activer votre compte.
        </Text>
        <Link href="/login" replace>
          <Text style={styles.footerLink}>Retour à la connexion</Text>
        </Link>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <Text style={styles.title}>Bienvenue</Text>
      <Text style={styles.subtitle}>Créez votre compte pour démarrer</Text>

      <View style={styles.form}>
        <AuthField label="Prénom" value={firstName} onChangeText={setFirstName} placeholder="Marie" />
        <AuthField
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="vous@exemple.com"
        />
        <AuthField label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" />
        <AuthField
          label="Confirmer le mot de passe"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          placeholder="••••••••"
        />
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {!error && validationMessage ? <Text style={styles.hintText}>{validationMessage}</Text> : null}

      <Pressable style={styles.checkboxRow} onPress={() => setAcceptedGdpr((v) => !v)}>
        <View style={[styles.checkbox, acceptedGdpr && styles.checkboxChecked]} />
        <Text style={styles.checkboxLabel}>
          J&apos;accepte les CGU et la politique de confidentialité
        </Text>
      </Pressable>

      <Pressable style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]} onPress={handleSubmit} disabled={!canSubmit}>
        {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Créer mon compte</Text>}
      </Pressable>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Déjà un compte ?</Text>
        <Link href="/login" replace>
          <Text style={styles.footerLink}> Se connecter</Text>
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
    paddingTop: 40,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 26,
    color: colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textMuted,
    marginBottom: 28,
  },
  form: { gap: 14, marginBottom: 12 },
  errorText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.primary,
    marginBottom: 12,
  },
  hintText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
  },
  checkboxChecked: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  checkboxLabel: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    color: colors.white,
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 'auto',
    marginBottom: 24,
  },
  footerText: {
    fontFamily: fonts.body,
    color: colors.textMuted,
  },
  footerLink: {
    fontFamily: fonts.bodyMedium,
    color: colors.primary,
  },
});
