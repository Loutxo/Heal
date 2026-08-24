import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { colors, fonts, radii } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { parseFunctionError } from '@/lib/functionError';

const CATEGORY_ICONS: Record<string, string> = {
  passive_cooking: '⏱️',
  active_cooking: '🔥',
  cutting: '🔪',
  marinade: '🧂',
  sauce_base: '🍯',
  assembly: '🍽️',
};

type Task = {
  id: string;
  guide_type: string;
  task_date: string | null;
  task_category: string;
  description: string;
  estimated_duration_min: number | null;
  is_completed: boolean;
  sort_order: number;
};

type Guide = {
  id: string;
  weekend_estimated_active_min: number | null;
  weekend_estimated_passive_min: number | null;
  basile_tip: string | null;
};

export default function BatchCookingScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guide, setGuide] = useState<Guide | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [planId, setPlanId] = useState<string | null>(null);

  useEffect(() => {
    load(false);
  }, []);

  async function load(forceRegenerate: boolean) {
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

    const { data: existingGuide } = await supabase
      .from('batch_cooking_guides')
      .select('id, weekend_estimated_active_min, weekend_estimated_passive_min, basile_tip')
      .eq('meal_plan_id', plan.id)
      .maybeSingle();

    if (!existingGuide || forceRegenerate) {
      setGenerating(true);
      const { data, error: fnError } = await supabase.functions.invoke('generate-batch-cooking-guide', {
        body: { meal_plan_id: plan.id },
      });
      setGenerating(false);
      if (fnError || data?.error) {
        const parsed = fnError ? await parseFunctionError(fnError) : data?.error;
        setError(parsed?.message ?? 'Erreur lors de la génération du guide.');
        setLoading(false);
        return;
      }
    }

    const { data: guideRow } = await supabase
      .from('batch_cooking_guides')
      .select('id, weekend_estimated_active_min, weekend_estimated_passive_min, basile_tip')
      .eq('meal_plan_id', plan.id)
      .single();

    if (!guideRow) {
      setError('Guide introuvable.');
      setLoading(false);
      return;
    }
    setGuide(guideRow);

    const { data: taskRows, error: tasksError } = await supabase
      .from('batch_tasks')
      .select('id, guide_type, task_date, task_category, description, estimated_duration_min, is_completed, sort_order')
      .eq('guide_id', guideRow.id)
      .order('sort_order', { ascending: true });

    if (tasksError || !taskRows) {
      setError(tasksError?.message ?? 'Impossible de charger les tâches.');
      setLoading(false);
      return;
    }
    setTasks(taskRows);
    setLoading(false);
  }

  async function toggleTask(task: Task) {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, is_completed: !t.is_completed } : t)));
    await supabase.from('batch_tasks').update({ is_completed: !task.is_completed }).eq('id', task.id);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} />
        {generating ? <Text style={styles.generatingText}>Basile prépare votre guide de la semaine…</Text> : null}
      </SafeAreaView>
    );
  }

  if (error || !guide) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>{error ?? 'Guide introuvable.'}</Text>
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>Retour</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const weekendTasks = tasks.filter((t) => t.guide_type === 'weekend').sort((a, b) => a.sort_order - b.sort_order);
  const dailyDates = [...new Set(tasks.filter((t) => t.guide_type === 'daily').map((t) => t.task_date))].sort() as string[];

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => load(true)} hitSlop={12} disabled={generating}>
              <Text style={styles.headerLink}>🔄</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {guide.basile_tip ? <Text style={styles.basileTip}>🦡 {guide.basile_tip}</Text> : null}

        <Text style={styles.sectionTitle}>
          Week-end{' '}
          <Text style={styles.sectionMeta}>
            (~{guide.weekend_estimated_active_min ?? 0} min actives
            {guide.weekend_estimated_passive_min ? ` + ${guide.weekend_estimated_passive_min} min passives` : ''})
          </Text>
        </Text>
        {weekendTasks.map((task) => (
          <TaskRow key={task.id} task={task} onToggle={() => toggleTask(task)} />
        ))}

        {dailyDates.map((date) => (
          <View key={date}>
            <Text style={styles.sectionTitle}>{formatWeekday(date)} soir</Text>
            {tasks
              .filter((t) => t.guide_type === 'daily' && t.task_date === date)
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((task) => (
                <TaskRow key={task.id} task={task} onToggle={() => toggleTask(task)} />
              ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function TaskRow({ task, onToggle }: { task: Task; onToggle: () => void }) {
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function startTimer() {
    if (!task.estimated_duration_min) return;
    setRemainingSec(task.estimated_duration_min * 60);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setRemainingSec((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          Alert.alert('Basile vous prévient 🦡', `Minuteur terminé : ${task.description}`);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function stopTimer() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRemainingSec(null);
  }

  return (
    <View style={styles.taskRow}>
      <Pressable style={styles.taskRowTouchable} onPress={onToggle}>
        <View style={[styles.checkbox, task.is_completed && styles.checkboxChecked]}>
          {task.is_completed ? <Text style={styles.checkmark}>✓</Text> : null}
        </View>
        <View style={styles.taskTextWrap}>
          <Text style={[styles.taskText, task.is_completed && styles.taskTextChecked]}>
            {CATEGORY_ICONS[task.task_category] ?? ''} {task.description}
          </Text>
          {task.estimated_duration_min ? (
            <Text style={styles.taskDuration}>{remainingSec !== null ? formatCountdown(remainingSec) : `${task.estimated_duration_min} min`}</Text>
          ) : null}
        </View>
      </Pressable>
      {task.estimated_duration_min ? (
        <Pressable style={styles.timerButton} onPress={remainingSec !== null ? stopTimer : startTimer} hitSlop={10}>
          <Text style={styles.timerButtonText}>{remainingSec !== null ? '⏹' : '▶'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatWeekday(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  generatingText: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, marginTop: 16, textAlign: 'center' },
  headerLink: { fontSize: 18, marginRight: 4 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  basileTip: {
    fontFamily: fonts.headingItalic,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.backgroundSecondary,
    padding: 14,
    borderRadius: radii.card,
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: colors.text,
    marginTop: 20,
    marginBottom: 10,
    textTransform: 'capitalize',
  },
  sectionMeta: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  taskRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  taskRowTouchable: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8, flex: 1 },
  timerButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  timerButtonText: { fontSize: 13, color: colors.primary },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  checkmark: { color: colors.white, fontSize: 13, fontFamily: fonts.bodyMedium },
  taskTextWrap: { flex: 1 },
  taskText: { fontFamily: fonts.body, fontSize: 15, color: colors.text },
  taskTextChecked: { color: colors.textMuted, textDecorationLine: 'line-through' },
  taskDuration: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  errorText: { fontFamily: fonts.body, fontSize: 15, color: colors.text, textAlign: 'center', marginBottom: 20 },
  backLink: { paddingVertical: 12 },
  backLinkText: { fontFamily: fonts.bodyMedium, color: colors.primary },
});
