import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { colors, fonts, radii } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { Chip } from '@/components/onboarding/Chip';

type Food = { id: number; name: string; category_id: number };

export default function AvailableProduceScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [foods, setFoods] = useState<Food[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    // Catégories 2 = Légumes, 3 = Fruits
    const { data } = await supabase
      .from('foods')
      .select('id, name, category_id')
      .in('category_id', [2, 3])
      .eq('is_active', true)
      .order('name', { ascending: true });
    setFoods(data ?? []);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return foods;
    return foods.filter((f) => f.name.toLowerCase().includes(q));
  }, [foods, search]);

  function toggle(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    const { data, error: fnError } = await supabase.functions.invoke('generate-meal-plan', {
      body: { available_foods: selected },
    });
    setGenerating(false);

    if (fnError || data?.error) {
      const code = data?.error?.code;
      if (code === 'PLAN_ALREADY_EXISTS') {
        router.push('/planning');
        return;
      }
      setError(data?.error?.message ?? fnError?.message ?? 'Erreur inconnue lors de la génération.');
      return;
    }
    router.push('/planning');
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Stack.Screen options={{ title: 'Ce que vous avez déjà' }} />
      <View style={styles.header}>
        <Text style={styles.basileMessage}>
          🦡 Avant de préparer votre semaine, avez-vous déjà des légumes ou des fruits à la maison qu'on devrait intégrer au planning ?
        </Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un légume ou un fruit..."
          value={search}
          onChangeText={setSearch}
        />
        {selected.length > 0 ? (
          <Text style={styles.selectedCount}>
            {selected.length} aliment{selected.length > 1 ? 's' : ''} sélectionné{selected.length > 1 ? 's' : ''}
          </Text>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.chipWrap}>
            {filtered.map((f) => (
              <Chip key={f.id} label={f.name} selected={selected.includes(f.id)} onPress={() => toggle(f.id)} />
            ))}
          </View>
          {filtered.length === 0 ? <Text style={styles.emptyText}>Aucun résultat pour "{search}".</Text> : null}
        </ScrollView>
      )}

      <View style={styles.footer}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Pressable style={styles.primaryButton} onPress={handleGenerate} disabled={generating}>
          {generating ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryButtonText}>
              {selected.length > 0
                ? `Générer avec ce${selected.length > 1 ? 's' : 't'} ${selected.length} aliment${selected.length > 1 ? 's' : ''}`
                : 'Générer mon planning'}
            </Text>
          )}
        </Pressable>
        {selected.length > 0 ? (
          <Pressable style={styles.skipLink} onPress={() => setSelected([])}>
            <Text style={styles.skipLinkText}>Tout désélectionner</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 },
  basileMessage: { fontFamily: fonts.headingItalic, fontSize: 15, color: colors.text, marginBottom: 16, lineHeight: 21 },
  searchInput: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  selectedCount: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.primary, marginTop: 10 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 20 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  emptyText: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, marginTop: 20, textAlign: 'center' },
  footer: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16, borderTopWidth: 1, borderTopColor: colors.backgroundSecondary },
  errorText: { fontFamily: fonts.body, fontSize: 13, color: colors.primary, marginBottom: 10, textAlign: 'center' },
  primaryButton: { backgroundColor: colors.primary, borderRadius: radii.pill, paddingVertical: 16, alignItems: 'center' },
  primaryButtonText: { color: colors.white, fontFamily: fonts.bodyMedium, fontSize: 16 },
  skipLink: { marginTop: 12, alignItems: 'center' },
  skipLinkText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textMuted },
});
