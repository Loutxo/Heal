import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { colors, fonts, radii } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const SECTION_LABELS: Record<string, string> = {
  produce: '🥕 Légumes & Fruits',
  proteins: '🥩 Protéines',
  dairy: '🧀 Produits laitiers',
  dry_goods: '🌾 Épicerie sèche',
  herbs_spices: '🌿 Herbes & Épices',
};
const SECTION_ORDER = ['produce', 'proteins', 'dairy', 'dry_goods', 'herbs_spices'];

type Item = {
  id: string;
  name: string;
  quantity_label: string;
  shopping_section: string;
  is_checked: boolean;
  is_manual: boolean;
  sort_order: number;
};

export default function ShoppingListScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [updatingServings, setUpdatingServings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [planId, setPlanId] = useState<string | null>(null);
  const [servings, setServings] = useState(1);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);

    const { data: plan, error: planError } = await supabase
      .from('meal_plans')
      .select('id')
      .eq('status', 'active')
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (planError || !plan) {
      setError("Aucun planning trouvé — générez-en un depuis l'accueil.");
      setLoading(false);
      return;
    }
    setPlanId(plan.id);

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('household_size')
      .eq('id', session?.user.id)
      .maybeSingle();
    const currentServings = profile?.household_size ?? 1;
    setServings(currentServings);

    await refreshList(plan.id, null);
    setLoading(false);
  }

  async function refreshList(planIdArg: string, newServings: number | null) {
    const { error: rpcError } = await supabase.rpc('generate_shopping_list', {
      p_meal_plan_id: planIdArg,
      p_servings: newServings,
    });
    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    const { data: list } = await supabase.from('shopping_lists').select('id').eq('meal_plan_id', planIdArg).single();
    if (!list) {
      setError('Liste de courses introuvable.');
      return;
    }

    const { data: listItems, error: itemsError } = await supabase
      .from('shopping_list_items')
      .select('id, name, quantity_label, shopping_section, is_checked, is_manual, sort_order')
      .eq('shopping_list_id', list.id)
      .order('sort_order', { ascending: true });

    if (itemsError || !listItems) {
      setError(itemsError?.message ?? 'Impossible de charger la liste.');
      return;
    }
    setItems(listItems);
  }

  async function changeServings(delta: number) {
    if (!planId) return;
    const next = Math.max(1, Math.min(12, servings + delta));
    if (next === servings) return;
    setServings(next);
    setUpdatingServings(true);
    await refreshList(planId, next);
    setUpdatingServings(false);
  }

  async function toggleItem(item: Item) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_checked: !i.is_checked } : i)));
    await supabase.from('shopping_list_items').update({ is_checked: !item.is_checked }).eq('id', item.id);
  }

  async function uncheckAll() {
    setItems((prev) => prev.map((i) => ({ ...i, is_checked: false })));
    const ids = items.map((i) => i.id);
    await supabase.from('shopping_list_items').update({ is_checked: false }).in('id', ids);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>Retour</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const remaining = items.filter((i) => !i.is_checked).length;
  const sections = SECTION_ORDER.map((section) => ({
    key: section,
    items: items
      .filter((i) => i.shopping_section === section)
      .sort((a, b) => Number(a.is_checked) - Number(b.is_checked) || a.sort_order - b.sort_order),
  })).filter((s) => s.items.length > 0);

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push('/planning')} hitSlop={12}>
              <Text style={styles.headerLink}>📅</Text>
            </Pressable>
          ),
        }}
      />
      <View style={styles.header}>
        <Text style={styles.subtitle}>{remaining} article{remaining > 1 ? 's' : ''} restant{remaining > 1 ? 's' : ''}</Text>

        <View style={styles.servingsRow}>
          <Text style={styles.servingsLabel}>Pour combien de personnes ?</Text>
          <View style={styles.stepper}>
            <Pressable style={styles.stepperButton} onPress={() => changeServings(-1)} disabled={updatingServings || servings <= 1}>
              <Text style={styles.stepperButtonText}>−</Text>
            </Pressable>
            <Text style={styles.stepperValue}>{updatingServings ? '…' : servings}</Text>
            <Pressable style={styles.stepperButton} onPress={() => changeServings(1)} disabled={updatingServings || servings >= 12}>
              <Text style={styles.stepperButtonText}>+</Text>
            </Pressable>
          </View>
        </View>

        <Pressable style={styles.uncheckLink} onPress={uncheckAll}>
          <Text style={styles.uncheckLinkText}>Tout décocher</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {sections.map((section) => (
          <View key={section.key} style={styles.section}>
            <Text style={styles.sectionLabel}>{SECTION_LABELS[section.key] ?? section.key}</Text>
            {section.items.map((item) => (
              <Pressable key={item.id} style={styles.itemRow} onPress={() => toggleItem(item)}>
                <View style={[styles.checkbox, item.is_checked && styles.checkboxChecked]}>
                  {item.is_checked ? <Text style={styles.checkmark}>✓</Text> : null}
                </View>
                <Text style={[styles.itemText, item.is_checked && styles.itemTextChecked]}>
                  {item.name} — {item.quantity_label}
                </Text>
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  header: { paddingHorizontal: 24, paddingTop: 4, paddingBottom: 8 },
  subtitle: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted },
  headerLink: { fontSize: 20, marginRight: 4 },
  servingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radii.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  servingsLabel: { fontFamily: fonts.body, fontSize: 14, color: colors.text },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonText: { color: colors.white, fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 18 },
  stepperValue: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.text, minWidth: 20, textAlign: 'center' },
  uncheckLink: { marginTop: 10 },
  uncheckLinkText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.primary },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },
  section: { marginTop: 20 },
  sectionLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text, marginBottom: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  checkmark: { color: colors.white, fontSize: 13, fontFamily: fonts.bodyMedium },
  itemText: { fontFamily: fonts.body, fontSize: 15, color: colors.text, flexShrink: 1 },
  itemTextChecked: { color: colors.textMuted, textDecorationLine: 'line-through' },
  errorText: { fontFamily: fonts.body, fontSize: 15, color: colors.text, textAlign: 'center', marginBottom: 20 },
  backLink: { paddingVertical: 12 },
  backLinkText: { fontFamily: fonts.bodyMedium, color: colors.primary },
});
