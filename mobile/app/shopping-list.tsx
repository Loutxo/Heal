import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, TextInput, Share, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { colors, fonts, radii } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { getLocalProducerLink } from '@/constants/localProducerLinks';

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
  const [listId, setListId] = useState<string | null>(null);
  const [servings, setServings] = useState(1);
  const [manualName, setManualName] = useState('');
  const [manualQuantity, setManualQuantity] = useState('');
  const [manualSection, setManualSection] = useState('produce');
  const [addingManual, setAddingManual] = useState(false);
  const [producerLink, setProducerLink] = useState<{ url: string; source: string } | null>(null);

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
      .select('household_size, regions(name)')
      .eq('id', session?.user.id)
      .maybeSingle();
    const currentServings = profile?.household_size ?? 1;
    setServings(currentServings);
    const regionName = (profile as any)?.regions?.name;
    if (regionName) setProducerLink(getLocalProducerLink(regionName));

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
    setListId(list.id);

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

  async function handleAddManualItem() {
    if (!listId || !manualName.trim()) return;
    setAddingManual(true);
    const nextSortOrder = items.length ? Math.max(...items.map((i) => i.sort_order)) + 1 : 0;
    const { data: newItem, error: insertError } = await supabase
      .from('shopping_list_items')
      .insert({
        shopping_list_id: listId,
        name: manualName.trim(),
        quantity_label: manualQuantity.trim() || 'à définir',
        shopping_section: manualSection,
        is_manual: true,
        sort_order: nextSortOrder,
      })
      .select('id, name, quantity_label, shopping_section, is_checked, is_manual, sort_order')
      .single();
    setAddingManual(false);
    if (insertError || !newItem) return;
    setItems((prev) => [...prev, newItem]);
    setManualName('');
    setManualQuantity('');
  }

  async function removeManualItem(itemId: string) {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    await supabase.from('shopping_list_items').delete().eq('id', itemId);
  }

  async function handleShare() {
    const remainingItems = items.filter((i) => !i.is_checked);
    const bySection = SECTION_ORDER.map((section) => ({
      label: SECTION_LABELS[section] ?? section,
      items: remainingItems.filter((i) => i.shopping_section === section),
    })).filter((s) => s.items.length > 0);

    const text = bySection
      .map((s) => `${s.label}\n${s.items.map((i) => `- ${i.name} — ${i.quantity_label}`).join('\n')}`)
      .join('\n\n');

    await Share.share({ message: `Ma liste de courses Heal\n\n${text}` });
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
            <View style={{ flexDirection: 'row', gap: 14 }}>
              <Pressable onPress={handleShare} hitSlop={12}>
                <Text style={styles.headerLink}>📤</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/planning')} hitSlop={12}>
                <Text style={styles.headerLink}>📅</Text>
              </Pressable>
            </View>
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
              <View key={item.id} style={styles.itemRow}>
                <Pressable style={styles.itemRowTouchable} onPress={() => toggleItem(item)}>
                  <View style={[styles.checkbox, item.is_checked && styles.checkboxChecked]}>
                    {item.is_checked ? <Text style={styles.checkmark}>✓</Text> : null}
                  </View>
                  <Text style={[styles.itemText, item.is_checked && styles.itemTextChecked]}>
                    {item.name} — {item.quantity_label}
                  </Text>
                </Pressable>
                {item.is_manual ? (
                  <Pressable onPress={() => removeManualItem(item.id)} hitSlop={10}>
                    <Text style={styles.removeItemText}>✕</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        ))}

        <View style={styles.manualAddSection}>
          <Text style={styles.sectionLabel}>Ajouter un article</Text>
          <View style={styles.sectionPickerRow}>
            {SECTION_ORDER.map((section) => (
              <Pressable
                key={section}
                style={[styles.sectionPickerChip, manualSection === section && styles.sectionPickerChipSelected]}
                onPress={() => setManualSection(section)}
              >
                <Text style={[styles.sectionPickerChipText, manualSection === section && styles.sectionPickerChipTextSelected]}>
                  {SECTION_LABELS[section]}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.manualAddRow}>
            <TextInput
              style={[styles.manualInput, { flex: 2 }]}
              placeholder="Article (ex: Papier essuie-tout)"
              value={manualName}
              onChangeText={setManualName}
            />
            <TextInput
              style={[styles.manualInput, { flex: 1 }]}
              placeholder="Quantité"
              value={manualQuantity}
              onChangeText={setManualQuantity}
            />
          </View>
          <Pressable
            style={[styles.addManualButton, (!manualName.trim() || addingManual) && styles.addManualButtonDisabled]}
            onPress={handleAddManualItem}
            disabled={!manualName.trim() || addingManual}
          >
            {addingManual ? <ActivityIndicator color={colors.white} /> : <Text style={styles.addManualButtonText}>Ajouter à la liste</Text>}
          </Pressable>
        </View>

        {producerLink ? (
          <Pressable style={styles.producerLink} onPress={() => Linking.openURL(producerLink.url)}>
            <Text style={styles.producerLinkText}>🌾 Trouver un producteur près de chez vous</Text>
            <Text style={styles.producerLinkSource}>via {producerLink.source}</Text>
          </Pressable>
        ) : null}
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
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  itemRowTouchable: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, flex: 1 },
  removeItemText: { fontFamily: fonts.body, fontSize: 15, color: colors.textMuted, paddingHorizontal: 6 },
  manualAddSection: { marginTop: 28, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.backgroundSecondary },
  sectionPickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  sectionPickerChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radii.pill, backgroundColor: colors.backgroundSecondary },
  sectionPickerChipSelected: { backgroundColor: colors.primary },
  sectionPickerChipText: { fontFamily: fonts.body, fontSize: 12, color: colors.text },
  sectionPickerChipTextSelected: { color: colors.white, fontFamily: fonts.bodyMedium },
  manualAddRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  manualInput: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  addManualButton: { backgroundColor: colors.primary, borderRadius: radii.pill, paddingVertical: 14, alignItems: 'center' },
  addManualButtonDisabled: { opacity: 0.5 },
  addManualButtonText: { color: colors.white, fontFamily: fonts.bodyMedium, fontSize: 14 },
  producerLink: {
    marginTop: 24,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radii.card,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  producerLinkText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.primary },
  producerLinkSource: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 2 },
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
