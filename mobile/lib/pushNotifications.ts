import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// N'enregistre un token que sur un vrai appareil natif — le web n'a pas de jeton Expo utilisable
// sans configuration push web séparée (hors scope v1), et le simulateur n'a pas de vrai token.
// Nécessite aussi un projet EAS (app.json → extra.eas.projectId) : tant qu'il n'est pas créé
// (`eas init`, généralement fait au moment de la soumission aux stores), getExpoPushTokenAsync()
// échoue — on l'avale silencieusement plutôt que de crasher l'app pour une fonctionnalité annexe.
export async function registerForPushNotifications(userId: string): Promise<void> {
  if (Platform.OS === 'web' || !Device.isDevice) return;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenResponse = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);

    await supabase
      .from('push_tokens')
      .upsert({ user_id: userId, expo_push_token: tokenResponse.data }, { onConflict: 'expo_push_token' });
  } catch (e) {
    console.warn('Push notification registration skipped:', e);
  }
}
