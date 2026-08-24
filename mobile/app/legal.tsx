import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { colors, fonts, radii } from '@/constants/theme';

export default function LegalScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Stack.Screen options={{ title: 'Conditions & mentions' }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.draftNotice}>
          <Text style={styles.draftNoticeText}>
            Version provisoire en attente de validation juridique — ce texte n'a pas encore été relu par un professionnel du droit.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Tarifs</Text>
        <Text style={styles.paragraph}>
          Abonnement mensuel : 6,99 € / mois. Abonnement annuel : 49,99 € / an. Essai gratuit de 30 jours à l'inscription, sans
          engagement.
        </Text>

        <Text style={styles.sectionTitle}>Résiliation</Text>
        <Text style={styles.paragraph}>
          Résiliable à tout moment depuis l'application. L'accès reste actif jusqu'à la fin de la période déjà payée — aucun
          remboursement au prorata n'est effectué.
        </Text>

        <Text style={styles.sectionTitle}>Données personnelles</Text>
        <Text style={styles.paragraph}>
          Vos données de santé et de profil sont utilisées uniquement pour générer vos recommandations personnalisées. Vous
          pouvez demander la suppression complète de votre compte et de vos données depuis Mon profil.
        </Text>

        <Text style={styles.sectionTitle}>Contact</Text>
        <Text style={styles.paragraph}>Pour toute question, contactez-nous depuis la fiche de l'application sur votre store.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },
  draftNotice: { backgroundColor: colors.backgroundSecondary, borderRadius: radii.card, padding: 14, marginBottom: 24 },
  draftNoticeText: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, lineHeight: 17, fontStyle: 'italic' },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 16, color: colors.text, marginTop: 16, marginBottom: 8 },
  paragraph: { fontFamily: fonts.body, fontSize: 14, color: colors.text, lineHeight: 21 },
});
