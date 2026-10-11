import { DOMAINS, GRADING_VERSION, result, TOTAL, type Response } from './quiz';
import { questions, type Domain, type Question } from './questions';

export const RECORDS_KEY = 'what-grade-science:plays:v1';
export const RECORD_LIMIT = 50;
export type RecordStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type AnswerRecord = {
  id: string; level: number; domain: Domain; concept: string; standard: string;
  kind: Question['kind']; prompt: string; choices: string[]; answer: number;
  selected: number | null; elapsedMs: number; timedOut: boolean; skipped: boolean;
};
export type PlayRecord = {
  id: string; completedAt: string; gradingVersion: string;
  grade: number | null; score: number; responses: AnswerRecord[];
};
const kinds = new Set(['현상 예측', '원리 적용', '자료 해석', '실험 판단']);
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 2000;
const index = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 4;
const level = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 3 && v <= 9;
export const answerCorrect = (r: AnswerRecord) => !r.skipped && !r.timedOut && r.selected === r.answer;

function validAnswer(v: unknown): v is AnswerRecord {
  if (!object(v) || !text(v.id) || !level(v.level) || !DOMAINS.includes(v.domain as Domain)
    || !text(v.concept) || !text(v.standard) || !kinds.has(v.kind as string) || !text(v.prompt)
    || !Array.isArray(v.choices) || v.choices.length !== 4 || !v.choices.every(text)
    || new Set(v.choices).size !== 4 || !index(v.answer) || !(v.selected === null || index(v.selected))
    || typeof v.elapsedMs !== 'number' || !Number.isFinite(v.elapsedMs) || v.elapsedMs < 0 || v.elapsedMs > 20000
    || typeof v.skipped !== 'boolean' || typeof v.timedOut !== 'boolean') return false;
  if (v.skipped && v.timedOut) return false;
  if ((v.skipped || v.timedOut) !== (v.selected === null)) return false;
  return true;
}

function validRecord(v: unknown): v is PlayRecord {
  return object(v) && text(v.id) && text(v.completedAt) && Number.isFinite(Date.parse(v.completedAt))
    && text(v.gradingVersion) && (v.grade === null || level(v.grade))
    && Array.isArray(v.responses) && v.responses.length === TOTAL && v.responses.every(validAnswer)
    && new Set(v.responses.map(r => r.id)).size === TOTAL
    && v.score === v.responses.filter(answerCorrect).length;
}

export function normalizeRecords(value: unknown): PlayRecord[] {
  if (!Array.isArray(value)) return [];
  const found = new Map<string, PlayRecord>();
  // Prefer the last saved copy and keep only the bounded recent history.
  for (let i = value.length - 1; i >= 0 && found.size < RECORD_LIMIT; i--) {
    const item: unknown = value[i];
    if (validRecord(item) && !found.has(item.id)) found.set(item.id, item);
  }
  return [...found.values()].reverse();
}

export function readRecords(storage?: RecordStore): PlayRecord[] {
  try {
    const raw = (storage ?? window.localStorage).getItem(RECORDS_KEY);
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    return object(data) && data.version === 1 ? normalizeRecords(data.records) : [];
  } catch { return []; }
}

export function createPlayRecord(id: string, responses: Response[], completedAt = new Date().toISOString()): PlayRecord {
  const summary = result(responses);
  const record: PlayRecord = {
    id, completedAt, gradingVersion: GRADING_VERSION, grade: summary.grade, score: summary.score,
    responses: responses.map(({ question: q, selected, elapsedMs, timedOut, skipped }) => ({
      id: q.id, level: q.level, domain: q.domain, concept: q.concept, standard: q.standard,
      kind: q.kind, prompt: q.prompt, choices: [...q.choices], answer: q.answer,
      selected, elapsedMs: elapsedMs ?? 0, timedOut: Boolean(timedOut), skipped: Boolean(skipped),
    })),
  };
  if (!validRecord(record)) throw new Error('완료한 10문제의 유효한 기록만 저장할 수 있어요.');
  return record;
}

export function saveRecord(current: readonly PlayRecord[], record: PlayRecord, storage?: RecordStore) {
  const records = normalizeRecords([...current, record]);
  let persisted = false;
  try {
    (storage ?? window.localStorage).setItem(RECORDS_KEY, JSON.stringify({ version: 1, records }));
    persisted = true;
  } catch { /* Preserve the in-memory records and export even without storage. */ }
  return { records, persisted };
}

export function clearRecords(storage?: RecordStore): boolean {
  try { (storage ?? window.localStorage).removeItem(RECORDS_KEY); return true; }
  catch { return false; }
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b), mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function questionStats(records: readonly PlayRecord[]) {
  const groups = new Map<string, AnswerRecord[]>();
  for (const record of normalizeRecords(records)) for (const answer of record.responses) {
    const group = groups.get(answer.id) ?? []; group.push(answer); groups.set(answer.id, group);
  }
  return [...groups].map(([id, samples]) => {
    const first = samples[0];
    const answered = samples.filter(r => r.selected !== null && !r.skipped && !r.timedOut);
    const correct = samples.filter(answerCorrect).length;
    // Map by answer text, never displayed index: options are shuffled each game.
    const choices = questions.find(q => q.id === id)?.choices ?? first.choices;
    return {
      id, prompt: first.prompt, level: first.level, domain: first.domain, standard: first.standard,
      attempts: samples.length, answered: answered.length, correct,
      skips: samples.filter(r => r.skipped).length, timeouts: samples.filter(r => r.timedOut).length,
      accuracy: correct / samples.length,
      answeredAccuracy: answered.length ? correct / answered.length : null,
      medianAnsweredMs: median(answered.map(r => r.elapsedMs)),
      medianCorrectMs: median(samples.filter(answerCorrect).map(r => r.elapsedMs)),
      choiceCounts: choices.map(choice => ({ choice, count: answered.filter(r => r.choices[r.selected!] === choice).length })),
      sampleStatus: samples.length < 20 ? '표본 부족' : '탐색용 표본',
    };
  });
}

export function exportRecords(records: readonly PlayRecord[], exportedAt = new Date().toISOString()) {
  const valid = normalizeRecords(records);
  return JSON.stringify({ schemaVersion: 1, app: 'what-grade-science', exportedAt,
    currentGradingVersion: GRADING_VERSION, records: valid, questionStats: questionStats(valid),
  }, null, 2);
}
