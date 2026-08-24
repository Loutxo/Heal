import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { colors, fonts, radii } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Chip } from '@/components/onboarding/Chip';
import { ALLERGIES, DIET_PREFERENCES, PATHOLOGIES } from '@/constants/onboardingOptions';

type Member = {
  id: string;
  name: string;
  allergies: string[];
  diet_preferences: string[];
  pathologies: string[];
};

type Draft = { name: string; allergies: string[]; diet_preferences: string[]; pathologies: string[] };

const EMPTY_DRAFT: Draft = { name: '', allergies: [], diet_preferences: [], pathologies: [] };

export default function HouseholdScreen() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    if (!session) return;
    setLoading(true);
    const { data } = await supabase
      .from('household_members')
      .select('id, name, allergies, diet_preferences, pathologies')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: true });
    setMembers(data ?? []);
    setLoading(false);
  }

  function startEdit(member: Member) {
    setEditingId(member.id);
    setDraft({ name: member.name, allergies: member.allergies, diet_preferences: member.diet_preferences, pathologies: member.pathologies });
    setError(null);
  }

  function startNew() {
    setEditingId('new');
    setDraft(EMPTY_DRAFT);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
  }

  function toggleInDraft(field: 'allergies' | 'diet_preferences' | 'pathologies', value: string) {
    setDraft((prev) => ({
      ...prev,
      [field]: prev[field].includes(value) ? prev[field].filter((v) => v !== value) : [...prev[field], value],
    }));
  }

  async function handleSave() {
    if (!session || !draft.name.trim()) {
      setError('Le prénom est requis.');
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      user_id: session.user.id,
      name: draft.name.trim(),
      allergies: draft.allergies,
      diet_preferences: draft.diet_preferences,
      pathologies: draft.pathologies,
    };
    const { error: saveError } =
      editingId === 'new'
        ? await supabase.from('household_members').insert(payload)
        : await supabase.from('household_members').update(payload).eq('id', editingId);
    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    cancelEdit();
    await load();
  }

  async function handleDelete(id: string) {
    await supabase.from('household_members').delete().eq('id', id);
    if (editingId === id) cancelEdit();
    await load();
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Stack.Screen options={{ title: 'Mon foyer' }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.basileMessage}>
          🦡 Ajoutez les autres membres de votre foyer : leurs allergies et préférences seront prises en compte dans votre
          planning commun, sans qu'ils aient besoin de leur propre compte.
        </Text>

        {members.map((member) =>
          editingId === member.id ? (
            <MemberForm
              key={member.id}
              draft={draft}
              setDraft={setDraft}
              onToggle={toggleInDraft}
              onSave={handleSave}
              onCancel={cancelEdit}
              onDelete={() => handleDelete(member.id)}
              saving={saving}
              error={error}
            />
          ) : (
            <Pressable key={member.id} style={styles.memberCard} onPress={() => startEdit(member)}>
              <Text style={styles.memberName}>{member.name}</Text>
              <Text style={styles.memberSummary}>
                {[...member.allergies, ...member.diet_preferences, ...member.pathologies].length > 0
                  ? [...member.allergies, ...member.diet_preferences, ...member.pathologies].length + ' restriction(s)'
                  : 'Aucune restriction déclarée'}
              </Text>
            </Pressable>
          )
        )}

        {editingId === 'new' ? (
          <MemberForm
            draft={draft}
            setDraft={setDraft}
            onToggle={toggleInDraft}
            onSave={handleSave}
            onCancel={cancelEdit}
            saving={saving}
            error={error}
          />
        ) : (
          <Pressable style={styles.addButton} onPress={startNew}>
            <Text style={styles.addButtonText}>+ Ajouter un membre du foyer</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MemberForm({
  draft,
  setDraft,
  onToggle,
  onSave,
  onCancel,
  onDelete,
  saving,
  error,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  onToggle: (field: 'allergies' | 'diet_preferences' | 'pathologies', value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  saving: boolean;
  error: string | null;
}) {
  return (
    <View style={styles.formCard}>
      <Text style={styles.label}>Prénom</Text>
      <TextInput style={styles.input} value={draft.name} onChangeText={(v) => setDraft({ ...draft, name: v })} placeholder="Prénom" />

      <Text style={styles.label}>Allergies</Text>
      <View style={styles.chipRow}>
        {ALLERGIES.map((a) => (
          <Chip key={a.value} label={a.label} selected={draft.allergies.includes(a.value)} onPress={() => onToggle('allergies', a.value)} />
        ))}
      </View>

      <Text style={styles.label}>Préférences alimentaires</Text>
      <View style={styles.chipRow}>
        {DIET_PREFERENCES.map((d) => (
          <Chip
            key={d.value}
            label={d.label}
            selected={draft.diet_preferences.includes(d.value)}
            onPress={() => onToggle('diet_preferences', d.value)}
          />
        ))}
      </View>

      <Text style={styles.label}>Pathologies déclarées</Text>
      <View style={styles.chipRow}>
        {PATHOLOGIES.map((p) => (
          <Chip key={p.value} label={p.label} selected={draft.pathologies.includes(p.value)} onPress={() => onToggle('pathologies', p.value)} />
        ))}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.formActions}>
        <Pressable style={styles.saveButton} onPress={onSave} disabled={saving}>
          {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveButtonText}>Enregistrer</Text>}
        </Pressable>
        <Pressable style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Annuler</Text>
        </Pressable>
      </View>
      {onDelete ? (
        <Pressable style={styles.deleteLink} onPress={onDelete}>
          <Text style={styles.deleteLinkText}>Retirer ce membre</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },
  basileMessage: { fontFamily: fonts.headingItalic, fontSize: 14, color: colors.text, marginBottom: 20, lineHeight: 20 },
  memberCard: { backgroundColor: colors.backgroundSecondary, borderRadius: radii.card, padding: 16, marginBottom: 10 },
  memberName: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
  memberSummary: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  addButton: { borderRadius: radii.pill, paddingVertical: 14, alignItems: 'center', backgroundColor: colors.backgroundSecondary, marginTop: 4 },
  addButtonText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.primary },
  formCard: { backgroundColor: colors.backgroundSecondary, borderRadius: radii.card, padding: 18, marginBottom: 10 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textMuted, marginBottom: 8, marginTop: 14 },
  input: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  errorText: { fontFamily: fonts.body, fontSize: 13, color: colors.primary, marginTop: 14 },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  saveButton: { flex: 1, backgroundColor: colors.primary, borderRadius: radii.pill, paddingVertical: 13, alignItems: 'center' },
  saveButtonText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.white },
  cancelButton: { flex: 1, backgroundColor: colors.background, borderRadius: radii.pill, paddingVertical: 13, alignItems: 'center' },
  cancelButtonText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
  deleteLink: { marginTop: 12, alignItems: 'center' },
  deleteLinkText: { fontFamily: fonts.body, fontSize: 12, color: colors.primary },
});
