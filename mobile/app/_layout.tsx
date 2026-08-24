import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Lora_400Regular, Lora_400Regular_Italic, Lora_600SemiBold } from '@expo-google-fonts/lora';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { View, ActivityIndicator } from 'react-native';
import { colors, fonts } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/context/AuthContext';

// Accessibles sans session, ET redirigent vers /home si déjà connecté (écrans d'entrée).
const PUBLIC_ROUTES = ['login', 'signup', 'index'];
// Accessibles sans session mais ne redirigent JAMAIS vers /home même si une session existe —
// reset-password en particulier crée une session via le lien de récupération avant que
// l'utilisateur ait pu saisir son nouveau mot de passe, une redirection y serait un vrai bug.
const ALWAYS_ACCESSIBLE_ROUTES = ['forgot-password', 'reset-password'];

function RootNavigator() {
  const { session, initializing, onboardingCompleted } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (initializing) return;
    if (session && onboardingCompleted === null) return; // profil pas encore vérifié

    const currentRoute = segments[0] ?? 'index';
    const onPublicRoute = PUBLIC_ROUTES.includes(currentRoute);
    const onAlwaysAccessibleRoute = ALWAYS_ACCESSIBLE_ROUTES.includes(currentRoute);

    if (!session && !onPublicRoute && !onAlwaysAccessibleRoute) {
      router.replace('/');
      return;
    }
    if (onAlwaysAccessibleRoute) return;
    if (session && onboardingCompleted === false && currentRoute !== 'onboarding') {
      router.replace('/onboarding');
      return;
    }
    if (session && onboardingCompleted && onPublicRoute) {
      router.replace('/home');
    }
  }, [session, initializing, onboardingCompleted, segments, router]);

  if (initializing || (session && onboardingCompleted === null)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerTitleStyle: { fontFamily: fonts.bodyMedium, color: colors.text, fontSize: 16 },
        headerBackTitle: 'Retour',
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="signup" options={{ headerShown: false }} />
      <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
      <Stack.Screen name="reset-password" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="home" options={{ headerShown: false }} />
      <Stack.Screen name="planning" options={{ title: 'Votre semaine' }} />
      <Stack.Screen name="shopping-list" options={{ title: 'Liste de courses' }} />
      <Stack.Screen name="meal/[id]" options={{ title: 'Détail du repas' }} />
      <Stack.Screen name="batch-cooking" options={{ title: 'Batch cooking' }} />
      <Stack.Screen name="calendar" options={{ title: 'Calendrier' }} />
      <Stack.Screen name="settings" options={{ title: 'Mon profil' }} />
      <Stack.Screen name="seasonal-foods" options={{ title: 'Calendrier de saison' }} />
      <Stack.Screen name="available-produce" options={{ title: 'Ce que vous avez déjà' }} />
      <Stack.Screen name="badges" options={{ title: 'Mes badges' }} />
      <Stack.Screen name="points-history" options={{ title: 'Historique des points' }} />
      <Stack.Screen name="validate-manual" options={{ title: 'Valider un repas' }} />
      <Stack.Screen name="validate-photo" options={{ title: 'Valider par photo' }} />
      <Stack.Screen name="weekly-report" options={{ title: 'Rapport hebdomadaire' }} />
      <Stack.Screen name="report-history" options={{ title: 'Historique des rapports' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Lora_400Regular,
    Lora_400Regular_Italic,
    Lora_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </AuthProvider>
  );
}
