import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { OnboardingShell } from '@/components/onboarding/OnboardingShell';
import { Chip } from '@/components/onboarding/Chip';
import {
  SEX_OPTIONS,
  ACTIVITY_LEVELS,
  PATHOLOGIES,
  ALLERGIES,
  DIET_PREFERENCES,
} from '@/constants/onboardingOptions';

type Region = { id: number; name: string; country: string };

const TOTAL_STEPS = 6;
const CURRENT_YEAR = 2026; // Node/RN Date() sans dépendance à l'horloge système pour rester déterministe en dev

export default function OnboardingScreen() {
  const router = useRouter();
  const { session, refreshOnboardingStatus } = useAuth();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Étape 1 — Données physiologiques
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [sex, setSex] = useState<string | null>(null);
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [healthConsent, setHealthConsent] = useState(false);

  // Étape 2 — Activité
  const [activityLevel, setActivityLevel] = useState<string | null>(null);

  // Étape 3 — Pathologies
  const [pathologies, setPathologies] = useState<string[]>([]);

  // Étape 4 — Allergies & restrictions
  const [allergies, setAllergies] = useState<string[]>([]);
  const [dietPreferences, setDietPreferences] = useState<string[]>([]);
  const [dislikedFoods, setDislikedFoods] = useState('');

  // Étape 5 — Région
  const [regions, setRegions] = useState<Region[]>([]);
  const [regionId, setRegionId] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from('regions')
      .select('id,name,country')
      .order('country', { ascending: true })
      .order('name', { ascending: true })
      .then(({ data }) => setRegions(data ?? []));
  }, []);

  const birthDateValid = useMemo(() => {
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    if (!d || !m || !y) return false;
    if (d < 1 || d > 31 || m < 1 || m > 12) return false;
    const age = CURRENT_YEAR - y;
    return age >= 16 && age <= 100;
  }, [day, month, year]);

  const heightValid = useMemo(() => {
    const h = parseInt(heightCm, 10);
    return h >= 100 && h <= 250;
  }, [heightCm]);

  const weightValid = useMemo(() => {
    const w = parseFloat(weightKg);
    return w >= 30 && w <= 300;
  }, [weightKg]);

  const step1Valid = birthDateValid && !!sex && heightValid && weightValid && healthConsent;

  function toggleInArray(arr: string[], value: string, setArr: (v: string[]) => void) {
    setArr(arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
  }

  function togglePathology(value: string) {
    setPathologies((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  async function handleFinish() {
    if (!session) return;
    setSubmitting(true);
    setSubmitError(null);

    const birthDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const firstName = (session.user.user_metadata as { first_name?: string } | undefined)?.first_name ?? '';

    const { error: profileError } = await supabase.from('user_profiles').upsert({
      id: session.user.id,
      first_name: firstName,
      region_id: regionId,
      birth_date: birthDate,
      sex,
      height_cm: parseInt(heightCm, 10),
      weight_kg: parseFloat(weightKg),
      activity_level: activityLevel,
      onboarding_completed: true,
    });

    if (profileError) {
      setSubmitting(false);
      setSubmitError(profileError.message);
      return;
    }

    const { error: healthError } = await supabase.from('user_health_data').upsert(
      {
        user_id: session.user.id,
        pathologies,
        consent_given_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    const { error: restrictionsError } = await supabase.from('user_restrictions').upsert(
      {
        user_id: session.user.id,
        allergies,
        diet_preferences: dietPreferences,
        disliked_foods: dislikedFoods
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      },
      { onConflict: 'user_id' }
    );

    setSubmitting(false);

    if (healthError || restrictionsError) {
      setSubmitError((healthError ?? restrictionsError)?.message ?? 'Une erreur est survenue.');
      return;
    }

    await refreshOnboardingStatus();
    router.replace('/home');
  }

  if (step === 1) {
    return (
      <OnboardingShell
        step={1}
        totalSteps={TOTAL_STEPS}
        basileMessage="Pour commencer, parlez-moi un peu de vous !"
        title="Vos informations"
        onNext={() => setStep(2)}
        nextDisabled={!step1Valid}
      >
        <Text style={styles.label}>Date de naissance</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.inputSmall]}
            placeholder="JJ"
            keyboardType="number-pad"
            maxLength={2}
            value={day}
            onChangeText={setDay}
          />
          <TextInput
            style={[styles.input, styles.inputSmall]}
            placeholder="MM"
            keyboardType="number-pad"
            maxLength={2}
            value={month}
            onChangeText={setMonth}
          />
          <TextInput
            style={[styles.input, styles.inputMedium]}
            placeholder="AAAA"
            keyboardType="number-pad"
            maxLength={4}
            value={year}
            onChangeText={setYear}
          />
        </View>

        <Text style={styles.label}>Sexe</Text>
        <View style={styles.chipRow}>
          {SEX_OPTIONS.map((opt) => (
            <Chip key={opt.value} label={opt.label} selected={sex === opt.value} onPress={() => setSex(opt.value)} />
          ))}
        </View>

        <Text style={styles.label}>Taille (cm)</Text>
        <TextInput style={styles.input} placeholder="170" keyboardType="number-pad" value={heightCm} onChangeText={setHeightCm} />

        <Text style={styles.label}>Poids (kg)</Text>
        <TextInput style={styles.input} placeholder="70" keyboardType="decimal-pad" value={weightKg} onChangeText={setWeightKg} />

        <Chip
          label={healthConsent ? '✓ Consentement donné' : "J'accepte que ces données servent à personnaliser mes menus"}
          selected={healthConsent}
          onPress={() => setHealthConsent((v) => !v)}
        />
      </OnboardingShell>
    );
  }

  if (step === 2) {
    return (
      <OnboardingShell
        step={2}
        totalSteps={TOTAL_STEPS}
        basileMessage="Votre niveau d'activité m'aide à doser les bonnes quantités."
        title="Niveau d'activité"
        onBack={() => setStep(1)}
        onNext={() => setStep(3)}
        nextDisabled={!activityLevel}
      >
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
      </OnboardingShell>
    );
  }

  if (step === 3) {
    return (
      <OnboardingShell
        step={3}
        totalSteps={TOTAL_STEPS}
        basileMessage="Ces informations me permettent d'adapter vos menus. Elles ne remplacent pas votre médecin."
        title="Pathologies déclarées"
        onBack={() => setStep(2)}
        onNext={() => setStep(4)}
        nextDisabled={false}
      >
        {pathologies.length > 0 && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>
              Heal est un outil de bien-être. Il ne remplace pas l&apos;avis d&apos;un médecin ou d&apos;un diététicien.
            </Text>
          </View>
        )}
        <View style={styles.chipRow}>
          <Chip label="Aucune" selected={pathologies.length === 0} onPress={() => setPathologies([])} />
          {PATHOLOGIES.map((p) => (
            <Chip key={p.value} label={p.label} selected={pathologies.includes(p.value)} onPress={() => togglePathology(p.value)} />
          ))}
        </View>
      </OnboardingShell>
    );
  }

  if (step === 4) {
    return (
      <OnboardingShell
        step={4}
        totalSteps={TOTAL_STEPS}
        basileMessage="Indiquez vos allergies — je les respecterai à la lettre."
        title="Allergies & restrictions"
        onBack={() => setStep(3)}
        onNext={() => setStep(5)}
        nextDisabled={false}
      >
        <Text style={styles.label}>Allergies</Text>
        <View style={styles.chipRow}>
          {ALLERGIES.map((a) => (
            <Chip key={a.value} label={a.label} selected={allergies.includes(a.value)} onPress={() => toggleInArray(allergies, a.value, setAllergies)} />
          ))}
        </View>

        <Text style={styles.label}>Préférences</Text>
        <View style={styles.chipRow}>
          {DIET_PREFERENCES.map((p) => (
            <Chip
              key={p.value}
              label={p.label}
              selected={dietPreferences.includes(p.value)}
              onPress={() => toggleInArray(dietPreferences, p.value, setDietPreferences)}
            />
          ))}
        </View>

        <Text style={styles.label}>Autres aliments à éviter (séparés par une virgule)</Text>
        <TextInput
          style={styles.input}
          placeholder="coriandre, betterave..."
          value={dislikedFoods}
          onChangeText={setDislikedFoods}
        />
      </OnboardingShell>
    );
  }

  if (step === 5) {
    return (
      <OnboardingShell
        step={5}
        totalSteps={TOTAL_STEPS}
        basileMessage="Ma base de données saisonnière est organisée par région. Où vivez-vous ?"
        title="Votre région"
        onBack={() => setStep(4)}
        onNext={() => setStep(6)}
        nextDisabled={!regionId}
      >
        <View style={styles.chipRow}>
          {regions.map((r) => (
            <Chip key={r.id} label={r.name} selected={regionId === r.id} onPress={() => setRegionId(r.id)} />
          ))}
        </View>
      </OnboardingShell>
    );
  }

  const selectedRegion = regions.find((r) => r.id === regionId);

  return (
    <OnboardingShell
      step={6}
      totalSteps={TOTAL_STEPS}
      basileMessage="Voici votre profil — tout est bon ?"
      title="Récapitulatif"
      onBack={() => setStep(5)}
      onNext={handleFinish}
      nextLabel="C'est parti !"
      loading={submitting}
    >
      <RecapRow label="Date de naissance" value={`${day}/${month}/${year}`} />
      <RecapRow label="Sexe" value={SEX_OPTIONS.find((o) => o.value === sex)?.label ?? '—'} />
      <RecapRow label="Taille" value={`${heightCm} cm`} />
      <RecapRow label="Poids" value={`${weightKg} kg`} />
      <RecapRow label="Activité" value={ACTIVITY_LEVELS.find((a) => a.value === activityLevel)?.label ?? '—'} />
      <RecapRow label="Pathologies" value={pathologies.length ? pathologies.map((p) => PATHOLOGIES.find((x) => x.value === p)?.label).join(', ') : 'Aucune'} />
      <RecapRow label="Allergies" value={allergies.length ? allergies.map((a) => ALLERGIES.find((x) => x.value === a)?.label).join(', ') : 'Aucune'} />
      <RecapRow label="Préférences" value={dietPreferences.length ? dietPreferences.map((p) => DIET_PREFERENCES.find((x) => x.value === p)?.label).join(', ') : 'Aucune'} />
      <RecapRow label="Région" value={selectedRegion?.name ?? '—'} />
      {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}
    </OnboardingShell>
  );
}

function RecapRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.recapRow}>
      <Text style={styles.recapLabel}>{label}</Text>
      <Text style={styles.recapValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 8,
    marginTop: 16,
  },
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
  warningBanner: {
    backgroundColor: '#F0C04022',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  warningText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text,
  },
  recapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundSecondary,
  },
  recapLabel: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
  },
  recapValue: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.text,
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.primary,
    marginTop: 16,
  },
});
