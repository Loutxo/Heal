import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Lora_400Regular, Lora_400Regular_Italic, Lora_600SemiBold } from '@expo-google-fonts/lora';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { View, ActivityIndicator } from 'react-native';
import { colors, fonts } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/context/AuthContext';

const PUBLIC_ROUTES = ['login', 'signup', 'index'];

function RootNavigator() {
  const { session, initializing, onboardingCompleted } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (initializing) return;
    if (session && onboardingCompleted === null) return; // profil pas encore vérifié

    const currentRoute = segments[0] ?? 'index';
    const onPublicRoute = PUBLIC_ROUTES.includes(currentRoute);

    if (!session && !onPublicRoute) {
      router.replace('/');
      return;
    }
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
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="home" options={{ headerShown: false }} />
      <Stack.Screen name="planning" options={{ title: 'Votre semaine' }} />
      <Stack.Screen name="shopping-list" options={{ title: 'Liste de courses' }} />
      <Stack.Screen name="meal/[id]" options={{ title: 'Détail du repas' }} />
      <Stack.Screen name="batch-cooking" options={{ title: 'Batch cooking' }} />
      <Stack.Screen name="calendar" options={{ title: 'Calendrier' }} />
      <Stack.Screen name="settings" options={{ title: 'Mon profil' }} />
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
