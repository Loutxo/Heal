import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, TextInput, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { colors, fonts, radii } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { pickAndAnalyzePhoto, type MatchedFood } from '@/lib/photoAnalysis';
import { BasileFeedback, BasileFeedbackData } from '@/components/BasileFeedback';

export default function ValidatePhotoScreen() {
  const { meal_id } = useLocalSearchParams<{ meal_id: string }>();
  const { session } = useAuth();
  const router = useRouter();

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [matched, setMatched] = useState<MatchedFood[]>([]);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [selected, setSelected] = useState<Record<number, string>>({}); // food_id -> quantity_g
  const [search, setSearch] = useState('');
  const [allFoods, setAllFoods] = useState<{ id: number; name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<BasileFeedbackData | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return allFoods.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 20);
  }, [allFoods, search]);

  async function ensureFoodsLoaded() {
    if (allFoods.length > 0) return;
    const { data } = await supabase.from('foods').select('id, name').eq('is_active', true).order('name', { ascending: true });
    setAllFoods(data ?? []);
  }

  async function handlePickPhoto(source: 'camera' | 'library') {
    if (!session) return;
    setError(null);
    setAnalyzing(true);
    try {
      const result = await pickAndAnalyzePhoto(session.user.id, 'meal', source);
      if (!result) return; // annulé par l'utilisateur
      setPhotoDisplay(result.local_uri);
      setPhotoPath(result.photo_path);
      setMatched(result.matched);
      setUnmatched(result.unmatched);
      const initialSelected: Record<number, string> = {};
      for (const m of result.matched) initialSelected[m.food_id] = '100';
      setSelected(initialSelected);
      await ensureFoodsLoaded();
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors de la reconnaissance photo.');
    } finally {
      setAnalyzing(false);
    }
  }

  function setPhotoDisplay(uri: string) {
    setPhotoUri(uri);
  }

  function toggleFood(id: number) {
    setSelected((prev) => {
      const next = { ...prev };
      if (id in next) delete next[id];
      else next[id] = '100';
      return next;
    });
  }

  function setQuantity(foodId: number, value: string) {
    setSelected((prev) => ({ ...prev, [foodId]: value }));
  }

  const selectedEntries = Object.entries(selected);
  const canSubmit = !!photoPath && selectedEntries.length > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit || !meal_id || !photoPath) return;
    setSubmitting(true);
    setError(null);
    const payloadFoods = selectedEntries.map(([foodId, qty]) => ({
      food_id: Number(foodId),
      quantity_g: Math.max(1, Number(qty) || 100),
    }));
    const { data, error: validateErr } = await supabase.functions.invoke('validate-meal', {
      body: { meal_id, method: 'manual', foods: payloadFoods, photo_path: photoPath },
    });
    setSubmitting(false);
    if (validateErr || data?.error) {
      setError(data?.error?.message ?? validateErr?.message ?? 'Erreur lors de la validation.');
      return;
    }
    setFeedback(data);
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Stack.Screen options={{ title: 'Valider par photo' }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.basileMessage}>
          🦡 Prenez ce repas en photo, je reconnais les aliments et vous n'avez plus qu'à confirmer.
        </Text>

        {photoUri ? <Image source={{ uri: photoUri }} style={styles.photoPreview} /> : null}

        {!photoPath ? (
          <View style={styles.pickerRow}>
            <Pressable style={styles.pickerButton} onPress={() => handlePickPhoto('camera')}>
              <Text style={styles.pickerButtonText}>📸 Prendre une photo</Text>
            </Pressable>
            <Pressable style={styles.pickerButtonSecondary} onPress={() => handlePickPhoto('library')}>
              <Text style={styles.pickerButtonSecondaryText}>🖼️ Depuis la galerie</Text>
            </Pressable>
          </View>
        ) : null}

        {analyzing ? (
          <View style={styles.analyzingBox}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.analyzingText}>Basile regarde votre photo...</Text>
          </View>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {photoPath && !analyzing ? (
          <>
            {matched.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Aliments reconnus — confirmez les quantités</Text>
                {selectedEntries.map(([foodId, qty]) => {
                  const m = matched.find((mf) => mf.food_id === Number(foodId));
                  const food = allFoods.find((f) => f.id === Number(foodId));
                  const name = m?.name ?? food?.name ?? foodId;
                  return (
                    <View key={foodId} style={styles.selectedRow}>
                      <Text style={styles.selectedName}>
                        {name}
                        {m?.confidence === 'medium' ? ' (?)' : ''}
                      </Text>
                      <TextInput
                        style={styles.qtyInput}
                        keyboardType="number-pad"
                        value={qty}
                        onChangeText={(v) => setQuantity(Number(foodId), v)}
                      />
                      <Text style={styles.qtyUnit}>g</Text>
                      <Pressable onPress={() => toggleFood(Number(foodId))} hitSlop={10}>
                        <Text style={styles.removeText}>✕</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.emptyText}>Aucun aliment du catalogue reconnu automatiquement — ajoutez-les manuellement ci-dessous.</Text>
            )}

            {unmatched.length > 0 ? (
              <Text style={styles.unmatchedText}>
                Vu sur la photo mais non répertorié : {unmatched.join(', ')}. Cherchez un équivalent proche ci-dessous si besoin.
              </Text>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ajouter ou corriger un aliment</Text>
              <TextInput style={styles.searchInput} placeholder="Rechercher un aliment..." value={search} onChangeText={setSearch} />
              {search.trim().length > 0 ? (
                <View style={styles.chipWrap}>
                  {filtered.map((f) => (
                    <Pressable key={f.id} style={[styles.chip, f.id in selected && styles.chipSelected]} onPress={() => toggleFood(f.id)}>
                      <Text style={[styles.chipText, f.id in selected && styles.chipTextSelected]}>{f.name}</Text>
                    </Pressable>
                  ))}
                  {filtered.length === 0 ? <Text style={styles.emptyText}>Aucun résultat.</Text> : null}
                </View>
              ) : null}
            </View>
          </>
        ) : null}
      </ScrollView>

      {photoPath && !analyzing ? (
        <View style={styles.footer}>
          <Pressable style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={!canSubmit}>
            {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitButtonText}>Valider ce repas</Text>}
          </Pressable>
        </View>
      ) : null}

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
  scrollContent: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 20 },
  basileMessage: { fontFamily: fonts.headingItalic, fontSize: 15, color: colors.text, marginBottom: 18, lineHeight: 21 },
  photoPreview: { width: '100%', height: 200, borderRadius: radii.card, marginBottom: 16, backgroundColor: colors.backgroundSecondary },
  pickerRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  pickerButton: { flex: 1, backgroundColor: colors.primary, borderRadius: radii.pill, paddingVertical: 16, alignItems: 'center' },
  pickerButtonText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.white },
  pickerButtonSecondary: { flex: 1, backgroundColor: colors.backgroundSecondary, borderRadius: radii.pill, paddingVertical: 16, alignItems: 'center' },
  pickerButtonSecondaryText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
  analyzingBox: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  analyzingText: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted },
  errorText: { fontFamily: fonts.body, fontSize: 13, color: colors.primary, marginBottom: 10, textAlign: 'center' },
  section: { marginTop: 20 },
  sectionTitle: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text, marginBottom: 10 },
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
  emptyText: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginTop: 8 },
  unmatchedText: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 12, lineHeight: 17, fontStyle: 'italic' },
  searchInput: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radii.pill, backgroundColor: colors.backgroundSecondary },
  chipSelected: { backgroundColor: colors.primary },
  chipText: { fontFamily: fonts.body, fontSize: 14, color: colors.text },
  chipTextSelected: { color: colors.white, fontFamily: fonts.bodyMedium },
  footer: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16, borderTopWidth: 1, borderTopColor: colors.backgroundSecondary },
  submitButton: { backgroundColor: colors.primary, borderRadius: radii.pill, paddingVertical: 16, alignItems: 'center' },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.white },
});
