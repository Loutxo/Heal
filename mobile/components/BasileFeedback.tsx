import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Modal } from 'react-native';
import { colors, fonts, radii } from '@/constants/theme';

export type BasileFeedbackData = {
  basile_message: string;
  points_earned: number;
  streak_bonus: number;
  streak: { currentStreak: number; maxStreak: number };
  new_badges: { icon: string; name: string; description: string }[];
};

export function BasileFeedback({ data, onClose }: { data: BasileFeedbackData; onClose: () => void }) {
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6 }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { transform: [{ scale }], opacity }]}>
          <Text style={styles.basileEmoji}>🦡</Text>
          <Text style={styles.message}>{data.basile_message}</Text>

          {data.streak.currentStreak >= 2 ? (
            <View style={styles.streakRow}>
              <Text style={styles.streakText}>🔥 {data.streak.currentStreak} jours d'affilée</Text>
            </View>
          ) : null}

          {data.new_badges.length > 0 ? (
            <View style={styles.badgesWrap}>
              <Text style={styles.badgesTitle}>Nouveau badge débloqué !</Text>
              {data.new_badges.map((b, i) => (
                <View key={i} style={styles.badgeRow}>
                  <Text style={styles.badgeIcon}>{b.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.badgeName}>{b.name}</Text>
                    <Text style={styles.badgeDesc}>{b.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Continuer</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(74,51,39,0.55)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: {
    backgroundColor: colors.background,
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  basileEmoji: { fontSize: 44, marginBottom: 12 },
  message: { fontFamily: fonts.headingItalic, fontSize: 16, color: colors.text, textAlign: 'center', lineHeight: 23, marginBottom: 16 },
  streakRow: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 12,
  },
  streakText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
  badgesWrap: { width: '100%', marginTop: 8, marginBottom: 8 },
  badgesTitle: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.primary, marginBottom: 8, textAlign: 'center' },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radii.card,
    padding: 12,
    marginBottom: 8,
  },
  badgeIcon: { fontSize: 28 },
  badgeName: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
  badgeDesc: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  closeButton: { marginTop: 16, backgroundColor: colors.primary, borderRadius: radii.pill, paddingVertical: 14, paddingHorizontal: 40 },
  closeButtonText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.white },
});
