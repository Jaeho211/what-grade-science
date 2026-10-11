import { DOMAINS, questions, type Question } from './questions';
export { questions, DOMAINS, type Question };
export type Response = { question: Question; selected: number | null; elapsedMs?: number; timedOut?: boolean; skipped?: boolean };
export const TOTAL = 10;
export const START_LEVEL = 5;
export const MIN_LEVEL = 3;
export const MAX_LEVEL = 9;
export const GRADING_VERSION = 'science-evidence-v3';
export const correct = (r: Response) => !r.timedOut && !r.skipped && r.selected === r.question.answer;
export const levelLabel = (level: number) => level <= 6 ? `초등 ${level}학년` : `중학교 ${level - 6}학년`;

// Timing accelerates exploration, never the final evidence-based grade.
const fastCorrect = (r: Response) => correct(r) && r.elapsedMs !== undefined
  && Number.isFinite(r.elapsedMs) && r.elapsedMs >= 1000 && r.elapsedMs <= r.question.expectedMs / 2;
export function targetGrade(responses: Response[]): number {
  let level = START_LEVEL, streak = 0, hadMiss = false, recoveryUsed = false;
  for (let i = 0; i < Math.min(responses.length, 6); i++) {
    if (correct(responses[i])) streak++;
    else { streak = 0; hadMiss = true; }
    if (i % 2 === 0) continue;
    const pair = responses.slice(i - 1, i + 1);
    const accelerated = pair[0].question.level === pair[1].question.level && pair.every(fastCorrect);
    if (pair.every(correct)) level = Math.min(MAX_LEVEL, level + (accelerated ? 2 : 1));
    else if (pair.every(r => !correct(r))) level = Math.max(MIN_LEVEL, level - 1);
    if (hadMiss && !recoveryUsed && streak >= 3) {
      if (!accelerated) level = Math.min(MAX_LEVEL, level + 1);
      recoveryUsed = true;
    }
  }
  // Question seven is a checkpoint: one opening miss must not lock a strong
  // player at middle one. This offers a challenge; it is not a grade award.
  if (responses.length >= 6) {
    const openingHits = responses.slice(0, 6).filter(correct).length;
    if (openingHits >= 5) level = Math.max(level, openingHits === 6 ? MAX_LEVEL : 8);
  }
  if (responses.length <= 6) return level;
  const checkpoint = responses[6];
  let confirmation = checkpoint.question.level;
  if (confirmation >= 8 && correct(checkpoint) && responses.slice(4, 7).every(correct)) {
    confirmation = Math.min(MAX_LEVEL, confirmation + 1);
  }
  // Preserve the checkpoint opportunity even after one miss. Two misses at
  // the confirmation level lower it; successes then supply direct evidence.
  for (let i = 7; i < responses.length; i++) {
    const pair = responses.slice(i - 1, i + 1);
    if (pair.every(r => r.question.level === confirmation && !correct(r))) {
      confirmation = Math.max(MIN_LEVEL, confirmation - 1);
    }
  }
  return confirmation;
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
  let atLevel = balanced.filter(q => Math.abs(q.level - target) === distance);
  if (responses.length >= 6) {
    const directDomains = new Set(responses.filter(r => correct(r) && r.question.level >= target).map(r => r.question.domain));
    const needsEvidence = atLevel.filter(q => !directDomains.has(q.domain));
    if (needsEvidence.length) atLevel = needsEvidence;
    const applied = atLevel.filter(q => applicationQuestion(q));
    const appliedPasses = responses.filter(r => correct(r) && r.question.level >= target && applicationQuestion(r.question));
    if (target >= 7 && appliedPasses.length < 2 && applied.length) atLevel = applied;
  }
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

// Explicit fact-recall concepts do not count as application evidence, even if their
// broad authoring type says "원리 적용". Other prediction/data/experiment tasks do.
const recallConcepts = new Set(['세포의 기능', '구성 단계', '암석의 생성', '이온', '혼합물 분리', '수권의 분포', '별의 색과 온도']);
export const applicationQuestion = (q: Question) => !recallConcepts.has(q.concept)
  && (q.kind !== '원리 적용' || ['힘의 합력', '빛의 반사'].includes(q.concept));

export function levelEvidence(responses: Response[], level: number) {
  // Duplicate copies of a response never count as independent evidence.
  const unique = [...new Map(responses.map(r => [r.question.id, r])).values()];
  const attempts = unique.filter(r => r.question.level >= Math.max(MIN_LEVEL, level - 1)
    && (r.question.level <= level || correct(r)));
  const passed = attempts.filter(correct);
  const direct = passed.filter(r => r.question.level >= level);
  const domains = new Set(passed.map(r => r.question.domain));
  const directDomains = new Set(direct.map(r => r.question.domain));
  const standards = new Set(passed.map(r => r.question.standard));
  const applied = direct.filter(r => applicationQuestion(r.question));
  const accuracy = attempts.length ? passed.length / attempts.length : 0;
  const qualified = passed.length >= 3 && domains.size >= 3 && standards.size >= 3 && accuracy >= 0.75
    && (level >= 7 ? directDomains.size >= 3 && applied.length >= 2 : direct.length >= 2);
  return { attempts: attempts.length, passes: passed.length, direct: direct.length,
    domains: [...domains], directDomains: [...directDomains], standards: standards.size,
    applications: applied.length, accuracy, qualified };
}

export function result(responses: Response[]) {
  let grade: number | null = null;
  for (let level = MAX_LEVEL; level >= MIN_LEVEL; level--) {
    if (levelEvidence(responses, level).qualified) { grade = level; break; }
  }
  return {
    grade, label: grade === null ? '확인 필요' : levelLabel(grade),
    supported: grade !== null, score: responses.filter(correct).length,
    evidence: grade === null ? null : levelEvidence(responses, grade),
    elapsedMs: responses.reduce((sum, r) => sum + (r.elapsedMs ?? 0), 0),
    skips: responses.filter(r => r.skipped).length, timeouts: responses.filter(r => r.timedOut).length,
    bestStreak: streakStats(responses).best,
    domains: DOMAINS.map(domain => ({ domain, score: responses.filter(r => r.question.domain === domain && correct(r)).length,
      total: responses.filter(r => r.question.domain === domain).length })),
  };
}
