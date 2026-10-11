import { DOMAINS, questions, type Question } from './questions';
export { questions, DOMAINS, type Question };
export type Response = { question: Question; selected: number | null; elapsedMs?: number; timedOut?: boolean; skipped?: boolean };
export const TOTAL = 10;
export const START_LEVEL = 5;
export const MIN_LEVEL = 3;
export const MAX_LEVEL = 9;
export const correct = (r: Response) => !r.timedOut && !r.skipped && r.selected === r.question.answer;
export const levelLabel = (level: number) => level <= 6 ? `초등 ${level}학년` : `중학교 ${level - 6}학년`;

export function targetGrade(responses: Response[]): number {
  let level = START_LEVEL;
  for (let i = 1; i < Math.min(responses.length, 6); i += 2) {
    const pair = responses.slice(i - 1, i + 1);
    const fast = pair.every(r => correct(r) && (r.elapsedMs ?? Infinity) >= 1000 && r.elapsedMs! <= r.question.expectedMs / 2);
    if (pair.every(correct)) level = Math.min(MAX_LEVEL, level + (fast ? 2 : 1));
    else if (pair.every(r => !correct(r))) level = Math.max(MIN_LEVEL, level - 1);
  }
  // Last four questions verify the reached level; a strong opening unlocks a challenge.
  if (responses.length >= 6) {
    if (responses.slice(3, 6).every(correct)) level = Math.min(MAX_LEVEL, level + 1);
    for (let i = 7; i < responses.length; i += 2) {
      if (responses.slice(i - 1, i + 1).every(r => !correct(r))) level = Math.max(MIN_LEVEL, level - 1);
    }
  }
  return level;
}

export function nextQuestion(responses: Response[], random = Math.random, recentIds: readonly string[] = []): Question | undefined {
  if (responses.length >= TOTAL) return undefined;
  const used = new Set(responses.map(r => r.question.id));
  const remaining = questions.filter(q => !used.has(q.id));
  const count = (domain: string) => responses.filter(r => r.question.domain === domain).length;
  const minimum = Math.min(...DOMAINS.map(count));
  // Domain balance comes first: every domain appears twice in the first eight questions.
  const balanced = remaining.filter(q => count(q.domain) === minimum);
  const target = targetGrade(responses);
  const distance = Math.min(...balanced.map(q => Math.abs(q.level - target)));
  const atLevel = balanced.filter(q => Math.abs(q.level - target) === distance);
  const recent = new Map(recentIds.map((id, i) => [id, i]));
  const fresh = atLevel.filter(q => !recent.has(q.id));
  // Never trade the target difficulty or domain balance for novelty.
  const oldest = fresh.length ? -1 : Math.min(...atLevel.map(q => recent.get(q.id) ?? -1));
  const eligible = fresh.length ? fresh : atLevel.filter(q => (recent.get(q.id) ?? -1) === oldest);
  const attempts = (q: Question) => responses.filter(r => r.question.concept === q.concept).length;
  const leastAttempts = Math.min(...eligible.map(attempts));
  const pool = eligible.filter(q => attempts(q) === leastAttempts);
  const q = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
  if (!q) return undefined;
  const order = q.choices.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { ...q, choices: order.map(i => q.choices[i]), answer: order.indexOf(q.answer) };
}

export function streakStats(responses: Response[]) {
  let current = 0, best = 0;
  for (const r of responses) { current = correct(r) ? current + 1 : 0; best = Math.max(best, current); }
  return { current, best };
}

export function result(responses: Response[]) {
  let grade: number | null = null;
  for (let level = MAX_LEVEL; level >= MIN_LEVEL; level--) {
    const evidence = responses.filter(r => r.question.level >= Math.max(MIN_LEVEL, level - 1)
      && (r.question.level <= level || correct(r)));
    const passed = evidence.filter(correct);
    const direct = passed.filter(r => r.question.level >= level);
    if (passed.length >= 3 && new Set(passed.map(r => r.question.domain)).size >= 3
      && direct.length >= 2 && passed.length / evidence.length >= 0.75) { grade = level; break; }
  }
  return {
    grade, label: grade === null ? '확인 필요' : levelLabel(grade),
    supported: grade !== null, score: responses.filter(correct).length,
    elapsedMs: responses.reduce((sum, r) => sum + (r.elapsedMs ?? 0), 0),
    skips: responses.filter(r => r.skipped).length, timeouts: responses.filter(r => r.timedOut).length,
    bestStreak: streakStats(responses).best,
    domains: DOMAINS.map(domain => ({ domain, score: responses.filter(r => r.question.domain === domain && correct(r)).length,
      total: responses.filter(r => r.question.domain === domain).length })),
  };
}
