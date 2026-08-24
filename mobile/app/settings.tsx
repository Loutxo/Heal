import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator, Pressable, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, fonts, radii } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const DELETE_CONFIRMATION_WORD = 'SUPPRIMER';
import { Chip } from '@/components/onboarding/Chip';
import { SEX_OPTIONS, ACTIVITY_LEVELS, PATHOLOGIES, ALLERGIES, DIET_PREFERENCES } from '@/constants/onboardingOptions';

type Region = { id: number; name: string; country: string };

const ROLLOVER_OPTIONS = [
  { value: 'thursday', label: 'Jeudi minuit', description: 'Voir le planning de la semaine suivante dès jeudi' },
  { value: 'friday', label: 'Vendredi minuit', description: 'Garder le planning en cours jusqu’à vendredi' },
] as const;

export default function SettingsScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [regions, setRegions] = useState<Region[]>([]);

  const [firstName, setFirstName] = useState('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [sex, setSex] = useState<string | null>(null);
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [activityLevel, setActivityLevel] = useState<string | null>(null);
  const [regionId, setRegionId] = useState<number | null>(null);
  const [householdSize, setHouseholdSize] = useState(1);
  const [rolloverDay, setRolloverDay] = useState<'thursday' | 'friday'>('friday');
  const [notifDinner, setNotifDinner] = useState(true);
  const [notifShopping, setNotifShopping] = useState(true);
  const [notifBatchCooking, setNotifBatchCooking] = useState(true);
  const [notifWeeklyReport, setNotifWeeklyReport] = useState(true);

  const [pathologies, setPathologies] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [dietPreferences, setDietPreferences] = useState<string[]>([]);
  const [dislikedFoods, setDislikedFoods] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    if (!session) return;
    setLoading(true);

    const [{ data: regionsData }, { data: profile }, { data: health }, { data: restrictions }] = await Promise.all([
      supabase.from('regions').select('id,name,country').order('country', { ascending: true }).order('name', { ascending: true }),
      supabase.from('user_profiles').select('*').eq('id', session.user.id).single(),
      supabase.from('user_health_data').select('pathologies').eq('user_id', session.user.id).maybeSingle(),
      supabase.from('user_restrictions').select('allergies, diet_preferences, disliked_foods').eq('user_id', session.user.id).maybeSingle(),
    ]);

    setRegions(regionsData ?? []);

    if (profile) {
      setFirstName(profile.first_name ?? '');
      const [y, m, d] = (profile.birth_date ?? '').split('-');
      setYear(y ?? '');
      setMonth(m ?? '');
      setDay(d ?? '');
      setSex(profile.sex ?? null);
      setHeightCm(profile.height_cm ? String(profile.height_cm) : '');
      setWeightKg(profile.weight_kg ? String(profile.weight_kg) : '');
      setActivityLevel(profile.activity_level ?? null);
      setRegionId(profile.region_id ?? null);
      setHouseholdSize(profile.household_size ?? 1);
      setRolloverDay((profile.week_rollover_day as 'thursday' | 'friday') ?? 'friday');
      setNotifDinner(profile.notif_dinner_reminder ?? true);
      setNotifShopping(profile.notif_shopping_reminder ?? true);
      setNotifBatchCooking(profile.notif_batch_cooking_reminder ?? true);
      setNotifWeeklyReport(profile.notif_weekly_report ?? true);
    }
    setPathologies(health?.pathologies ?? []);
    setAllergies(restrictions?.allergies ?? []);
    setDietPreferences(restrictions?.diet_preferences ?? []);
    setDislikedFoods((restrictions?.disliked_foods ?? []).join(', '));

    setLoading(false);
  }

  function toggleInArray(arr: string[], value: string, setArr: (v: string[]) => void) {
    setArr(arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
  }

  const heightValid = useMemo(() => {
    const h = parseInt(heightCm, 10);
    return h >= 100 && h <= 250;
  }, [heightCm]);
  const weightValid = useMemo(() => {
    const w = parseFloat(weightKg);
    return w >= 30 && w <= 300;
  }, [weightKg]);
  const canSave = !!sex && heightValid && weightValid && !!activityLevel && !!regionId;

  async function handleSave() {
    if (!session || !canSave) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    const birthDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({
        first_name: firstName,
        region_id: regionId,
        birth_date: birthDate,
        sex,
        height_cm: parseInt(heightCm, 10),
        weight_kg: parseFloat(weightKg),
        activity_level: activityLevel,
        household_size: householdSize,
        week_rollover_day: rolloverDay,
        notif_dinner_reminder: notifDinner,
        notif_shopping_reminder: notifShopping,
        notif_batch_cooking_reminder: notifBatchCooking,
        notif_weekly_report: notifWeeklyReport,
      })
      .eq('id', session.user.id);

    const { error: healthError } = await supabase
      .from('user_health_data')
      .upsert({ user_id: session.user.id, pathologies, consent_given_at: new Date().toISOString() }, { onConflict: 'user_id' });

    const { error: restrictionsError } = await supabase.from('user_restrictions').upsert(
      {
        user_id: session.user.id,
        allergies,
        diet_preferences: dietPreferences,
        disliked_foods: dislikedFoods.split(',').map((s) => s.trim()).filter(Boolean),
      },
      { onConflict: 'user_id' }
    );

    setSaving(false);

    if (profileError || healthError || restrictionsError) {
      setError((profileError ?? healthError ?? restrictionsError)?.message ?? 'Erreur lors de l’enregistrement.');
      return;
    }
    setSaved(true);
  }

  async function handleDeleteAccount() {
    if (!session || deleteConfirmText !== DELETE_CONFIRMATION_WORD) return;
    setDeleting(true);
    setDeleteError(null);
    const { error } = await supabase.functions.invoke('delete-account', { body: {} });
    if (error) {
      setDeleting(false);
      setDeleteError('Erreur lors de la suppression. Réessayez ou contactez le support.');
      return;
    }
    await signOut();
    router.replace('/');
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Vos informations</Text>
        <Text style={styles.label}>Prénom</Text>
        <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} />

        <Text style={styles.label}>Date de naissance</Text>
        <View style={styles.row}>
          <TextInput style={[styles.input, styles.inputSmall]} placeholder="JJ" keyboardType="number-pad" maxLength={2} value={day} onChangeText={setDay} />
          <TextInput style={[styles.input, styles.inputSmall]} placeholder="MM" keyboardType="number-pad" maxLength={2} value={month} onChangeText={setMonth} />
          <TextInput style={[styles.input, styles.inputMedium]} placeholder="AAAA" keyboardType="number-pad" maxLength={4} value={year} onChangeText={setYear} />
        </View>

        <Text style={styles.label}>Sexe</Text>
        <View style={styles.chipRow}>
          {SEX_OPTIONS.map((opt) => (
            <Chip key={opt.value} label={opt.label} selected={sex === opt.value} onPress={() => setSex(opt.value)} />
          ))}
        </View>

        <Text style={styles.label}>Taille (cm)</Text>
        <TextInput style={styles.input} keyboardType="number-pad" value={heightCm} onChangeText={setHeightCm} />

        <Text style={styles.label}>Poids (kg)</Text>
        <TextInput style={styles.input} keyboardType="decimal-pad" value={weightKg} onChangeText={setWeightKg} />

        <Text style={styles.sectionTitle}>Activité</Text>
        <View style={styles.cardList}>
          {ACTIVITY_LEVELS.map((level) => (
            <Chip
              key={level.value}
              label={`${level.emoji} ${level.label} — ${level.description}`}
              selected={activityLevel === level.value}
              onPress={() => setActivityLevel(level.value)}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>Pathologies déclarées</Text>
        <View style={styles.chipRow}>
          <Chip label="Aucune" selected={pathologies.length === 0} onPress={() => setPathologies([])} />
          {PATHOLOGIES.map((p) => (
            <Chip key={p.value} label={p.label} selected={pathologies.includes(p.value)} onPress={() => toggleInArray(pathologies, p.value, setPathologies)} />
          ))}
        </View>

        <Text style={styles.sectionTitle}>Allergies & restrictions</Text>
        <Text style={styles.label}>Allergies</Text>
        <View style={styles.chipRow}>
          {ALLERGIES.map((a) => (
            <Chip key={a.value} label={a.label} selected={allergies.includes(a.value)} onPress={() => toggleInArray(allergies, a.value, setAllergies)} />
          ))}
        </View>
        <Text style={styles.label}>Préférences</Text>
        <View style={styles.chipRow}>
          {DIET_PREFERENCES.map((p) => (
            <Chip key={p.value} label={p.label} selected={dietPreferences.includes(p.value)} onPress={() => toggleInArray(dietPreferences, p.value, setDietPreferences)} />
          ))}
        </View>
        <Text style={styles.label}>Autres aliments à éviter (séparés par une virgule)</Text>
        <TextInput style={styles.input} value={dislikedFoods} onChangeText={setDislikedFoods} />

        <Text style={styles.sectionTitle}>Région</Text>
        <View style={styles.chipRow}>
          {regions.map((r) => (
            <Chip key={r.id} label={r.name} selected={regionId === r.id} onPress={() => setRegionId(r.id)} />
          ))}
        </View>

        <Text style={styles.sectionTitle}>Foyer</Text>
        <Text style={styles.label}>Pour combien de personnes cuisinez-vous ?</Text>
        <View style={styles.stepper}>
          <Pressable style={styles.stepperButton} onPress={() => setHouseholdSize((v) => Math.max(1, v - 1))}>
            <Text style={styles.stepperButtonText}>−</Text>
          </Pressable>
          <Text style={styles.stepperValue}>{householdSize}</Text>
          <Pressable style={styles.stepperButton} onPress={() => setHouseholdSize((v) => Math.min(12, v + 1))}>
            <Text style={styles.stepperButtonText}>+</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Basculement du planning</Text>
        <Text style={styles.label}>
          Quand la page « Votre semaine » doit-elle passer au planning de la semaine suivante (une fois généré) ?
        </Text>
        <View style={styles.cardList}>
          {ROLLOVER_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              label={`${opt.label} — ${opt.description}`}
              selected={rolloverDay === opt.value}
              onPress={() => setRolloverDay(opt.value)}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Rappel du dîner (19h)</Text>
          <Switch value={notifDinner} onValueChange={setNotifDinner} trackColor={{ true: colors.primary }} />
        </View>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Rappel de courses (vendredi 18h)</Text>
          <Switch value={notifShopping} onValueChange={setNotifShopping} trackColor={{ true: colors.primary }} />
        </View>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Rappel batch cooking (dimanche 10h)</Text>
          <Switch value={notifBatchCooking} onValueChange={setNotifBatchCooking} trackColor={{ true: colors.primary }} />
        </View>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Rapport hebdomadaire prêt</Text>
          <Switch value={notifWeeklyReport} onValueChange={setNotifWeeklyReport} trackColor={{ true: colors.primary }} />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {saved ? <Text style={styles.savedText}>✓ Enregistré</Text> : null}

        <Pressable style={[styles.saveButton, !canSave && styles.saveButtonDisabled]} onPress={handleSave} disabled={!canSave || saving}>
          {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveButtonText}>Enregistrer</Text>}
        </Pressable>

        <Text style={styles.dangerTitle}>Zone dangereuse</Text>
        <Text style={styles.label}>
          Supprimer définitivement votre compte et toutes vos données (planning, historique, préférences). Cette action est irréversible.
        </Text>
        <Text style={styles.label}>Tapez « {DELETE_CONFIRMATION_WORD} » pour confirmer</Text>
        <TextInput
          style={styles.input}
          value={deleteConfirmText}
          onChangeText={setDeleteConfirmText}
          autoCapitalize="characters"
          placeholder={DELETE_CONFIRMATION_WORD}
        />
        {deleteError ? <Text style={styles.errorText}>{deleteError}</Text> : null}
        <Pressable
          style={[styles.deleteButton, deleteConfirmText !== DELETE_CONFIRMATION_WORD && styles.saveButtonDisabled]}
          onPress={handleDeleteAccount}
          disabled={deleteConfirmText !== DELETE_CONFIRMATION_WORD || deleting}
        >
          {deleting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveButtonText}>Supprimer mon compte</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 60 },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.text, marginTop: 24, marginBottom: 8 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textMuted, marginBottom: 8, marginTop: 14 },
  row: { flexDirection: 'row', gap: 10 },
  input: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputSmall: { width: 60 },
  inputMedium: { width: 90 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cardList: { gap: 10 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radii.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  stepperButton: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  stepperButtonText: { color: colors.white, fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 18 },
  stepperValue: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.text, minWidth: 20, textAlign: 'center' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radii.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  toggleLabel: { fontFamily: fonts.body, fontSize: 14, color: colors.text, flex: 1, marginRight: 12 },
  errorText: { fontFamily: fonts.body, fontSize: 13, color: colors.primary, marginTop: 20 },
  savedText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.secondary, marginTop: 20 },
  saveButton: { backgroundColor: colors.primary, borderRadius: radii.pill, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { color: colors.white, fontFamily: fonts.bodyMedium, fontSize: 16 },
  dangerTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.primary, marginTop: 40, marginBottom: 8 },
  deleteButton: { backgroundColor: colors.primary, borderRadius: radii.pill, paddingVertical: 16, alignItems: 'center', marginTop: 16, marginBottom: 20 },
});
