import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { colors, fonts, radii } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { BasileFeedback, BasileFeedbackData } from '@/components/BasileFeedback';
import { parseFunctionError } from '@/lib/functionError';

type Food = { id: number; name: string };

export default function ValidateManualScreen() {
  const { meal_id } = useLocalSearchParams<{ meal_id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [foods, setFoods] = useState<Food[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Record<number, string>>({}); // food_id -> quantity_g as string
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<BasileFeedbackData | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('foods').select('id, name').eq('is_active', true).order('name', { ascending: true });
    setFoods(data ?? []);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return foods.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 20);
  }, [foods, search]);

  function toggle(food: Food) {
    setSelected((prev) => {
      const next = { ...prev };
      if (food.id in next) delete next[food.id];
      else next[food.id] = '100';
      return next;
    });
  }

  function setQuantity(foodId: number, value: string) {
    setSelected((prev) => ({ ...prev, [foodId]: value }));
  }

  const selectedEntries = Object.entries(selected);
  const canSubmit = selectedEntries.length > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit || !meal_id) return;
    setSubmitting(true);
    setError(null);
    const payloadFoods = selectedEntries.map(([foodId, qty]) => ({
      food_id: Number(foodId),
      quantity_g: Math.max(1, Number(qty) || 100),
    }));
    const { data, error: validateErr } = await supabase.functions.invoke('validate-meal', {
      body: { meal_id, method: 'manual', foods: payloadFoods },
    });
    setSubmitting(false);
    if (validateErr || data?.error) {
      const parsed = validateErr ? await parseFunctionError(validateErr) : data?.error;
      setError(parsed?.message ?? 'Erreur lors de la validation.');
      return;
    }
    setFeedback(data);
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Stack.Screen options={{ title: 'Qu\'avez-vous mangé ?' }} />
      <View style={styles.header}>
        <Text style={styles.basileMessage}>🦡 Pas de souci, dites-moi ce que vous avez mangé à la place — je calculerai vos points.</Text>
        <TextInput style={styles.searchInput} placeholder="Rechercher un aliment..." value={search} onChangeText={setSearch} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {search.trim().length > 0 ? (
          <View style={styles.chipWrap}>
            {filtered.map((f) => (
              <Pressable key={f.id} style={[styles.chip, f.id in selected && styles.chipSelected]} onPress={() => toggle(f)}>
                <Text style={[styles.chipText, f.id in selected && styles.chipTextSelected]}>{f.name}</Text>
              </Pressable>
            ))}
            {filtered.length === 0 ? <Text style={styles.emptyText}>Aucun résultat.</Text> : null}
          </View>
        ) : null}

        {selectedEntries.length > 0 ? (
          <View style={styles.selectedSection}>
            <Text style={styles.selectedTitle}>Aliments sélectionnés</Text>
            {selectedEntries.map(([foodId, qty]) => {
              const food = foods.find((f) => f.id === Number(foodId));
              return (
                <View key={foodId} style={styles.selectedRow}>
                  <Text style={styles.selectedName}>{food?.name ?? foodId}</Text>
                  <TextInput
                    style={styles.qtyInput}
                    keyboardType="number-pad"
                    value={qty}
                    onChangeText={(v) => setQuantity(Number(foodId), v)}
                  />
                  <Text style={styles.qtyUnit}>g</Text>
                  <Pressable onPress={() => setSelected((prev) => { const n = { ...prev }; delete n[Number(foodId)]; return n; })} hitSlop={10}>
                    <Text style={styles.removeText}>✕</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Pressable style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={!canSubmit}>
          {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitButtonText}>Valider ce repas</Text>}
        </Pressable>
      </View>

      {feedback ? (
        <BasileFeedback
          data={feedback}
          onClose={() => {
            setFeedback(null);
            router.back();
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 },
  basileMessage: { fontFamily: fonts.headingItalic, fontSize: 14, color: colors.text, marginBottom: 14, lineHeight: 20 },
  searchInput: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 20 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radii.pill, backgroundColor: colors.backgroundSecondary },
  chipSelected: { backgroundColor: colors.primary },
  chipText: { fontFamily: fonts.body, fontSize: 14, color: colors.text },
  chipTextSelected: { color: colors.white, fontFamily: fonts.bodyMedium },
  emptyText: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  selectedSection: { marginTop: 24 },
  selectedTitle: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text, marginBottom: 10 },
  selectedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  selectedName: { fontFamily: fonts.body, fontSize: 14, color: colors.text, flex: 1 },
  qtyInput: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    width: 60,
    textAlign: 'center',
  },
  qtyUnit: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  removeText: { fontFamily: fonts.body, fontSize: 15, color: colors.textMuted, paddingHorizontal: 4 },
  footer: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16, borderTopWidth: 1, borderTopColor: colors.backgroundSecondary },
  errorText: { fontFamily: fonts.body, fontSize: 13, color: colors.primary, marginBottom: 10, textAlign: 'center' },
  submitButton: { backgroundColor: colors.primary, borderRadius: radii.pill, paddingVertical: 16, alignItems: 'center' },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.white },
});
