export const BAD_HABIT_PRESETS = [
  'Skip workouts',
  'Smoke cigarettes',
  'Sleep late',
  'Binge watch',
  'Scroll all night',
  'Skip meals',
  'Procrastinate',
  'Skip assignments',
] as const;

const BAD_HABIT_PATTERNS = [
  { label: 'smoking', pattern: /(smoke|smoking|vape|nicotine|cigarette)/i, reason: 'This looks like a bad habit because it includes smoking or nicotine use.' },
  { label: 'sleep debt', pattern: /(sleep late|stay up late|all[- ]nighter|sleeping late|oversleep|not enough sleep|late night)/i, reason: 'This looks like a bad habit because it keeps your sleep schedule unhealthy.' },
  { label: 'skipping exercise', pattern: /(skip workout|skip exercise|avoid workout|no workout|never exercise|skip training)/i, reason: 'This looks like a bad habit because it repeatedly skips physical activity.' },
  { label: 'binge habits', pattern: /(doomscroll|scroll all night|binge watch|video games all day|binge eat|junk food|skip meals|procrastinate|skip assignments|skip class|delay study)/i, reason: 'This looks like a bad habit because it promotes unhealthy routines and avoidance.' },
] as const;

export type HabitRiskAssessment = {
  isBadHabit: boolean;
  reason: string;
  confidence: number;
  normalized: string;
};

export function detectBadHabit(input: string): HabitRiskAssessment {
  const normalized = (input ?? '').trim();
  if (!normalized) {
    return { isBadHabit: false, reason: 'No habit input yet.', confidence: 0, normalized: '' };
  }

  const text = normalized.toLowerCase();
  const matches = BAD_HABIT_PATTERNS.filter(({ pattern }) => pattern.test(text));

  if (!matches.length) {
    return { isBadHabit: false, reason: 'This looks like a healthy or neutral habit.', confidence: 0.7, normalized };
  }

  const [{ reason }] = matches;
  return {
    isBadHabit: true,
    reason: `${reason} Try replacing it with a healthier habit such as exercise, sleep hygiene, or a focused routine.`,
    confidence: Math.min(0.96, 0.65 + Math.min(matches.length * 0.15, 0.3)),
    normalized,
  };
}
