import { describe, expect, it } from 'vitest';
import { questions } from './questions';
import { GRADING_VERSION, type Response } from './quiz';
import { clearRecords, createPlayRecord, exportRecords, normalizeRecords, questionStats,
  readRecords, RECORD_LIMIT, RECORDS_KEY, saveRecord, type PlayRecord, type RecordStore } from './records';

function storage(raw: string | null = null): RecordStore {
  let value = raw;
  return { getItem: () => value, setItem: (_key, next) => { value = next; }, removeItem: () => { value = null; } };
}
function responses(): Response[] {
  return questions.slice(0, 10).map(question => ({ question, selected: question.answer, elapsedMs: 4000 }));
}
const make = (id = 'run-1') => createPlayRecord(id, responses(), '2026-10-11T11:00:00.000Z');

describe('local play records', () => {
  it('stores a completed game once, with enough snapshot data to review later', () => {
    const store = storage(), record = make();
    const first = saveRecord([], record, store);
    expect(first.persisted).toBe(true);
    const again = saveRecord(first.records, record, store);
    expect(again.records).toHaveLength(1);
    expect(readRecords(store)).toEqual([record]);
    expect(record.gradingVersion).toBe(GRADING_VERSION);
    expect(record.responses[0]).toMatchObject({ id: questions[0].id, prompt: questions[0].prompt,
      choices: questions[0].choices, answer: questions[0].answer, elapsedMs: 4000 });
  });
  it('keeps the last 50 completed games', () => {
    const records = Array.from({ length: RECORD_LIMIT + 5 }, (_, i) => make(`run-${i}`));
    const valid = normalizeRecords(records);
    expect(valid).toHaveLength(RECORD_LIMIT);
    expect(valid[0].id).toBe('run-5');
    expect(valid.at(-1)?.id).toBe('run-54');
  });
  it('rejects unfinished, duplicate-question, and inconsistent response records', () => {
    expect(() => createPlayRecord('partial', responses().slice(0, 9))).toThrow();
    const duplicate = responses(); duplicate[9] = duplicate[0];
    expect(() => createPlayRecord('duplicate', duplicate)).toThrow();
    const record = make();
    const invalid = [null, {}, { ...record, score: 9 }, { ...record, completedAt: 'bad' },
      { ...record, responses: [{ ...record.responses[0], elapsedMs: Infinity }, ...record.responses.slice(1)] },
      { ...record, responses: [{ ...record.responses[0], selected: 4 }, ...record.responses.slice(1)] },
      { ...record, responses: [{ ...record.responses[0], skipped: true }, ...record.responses.slice(1)] }];
    expect(normalizeRecords(invalid)).toEqual([]);
  });
  it('handles malformed storage and preserves export when storage is blocked', () => {
    for (const raw of ['bad', 'null', '{}', '{"version":2,"records":[]}']) expect(readRecords(storage(raw))).toEqual([]);
    const blocked = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); }, removeItem: () => { throw new Error('denied'); } };
    expect(readRecords(blocked)).toEqual([]);
    const saved = saveRecord([], make(), blocked);
    expect(saved.persisted).toBe(false);
    expect(saved.records).toHaveLength(1);
    expect(JSON.parse(exportRecords(saved.records)).records).toHaveLength(1);
    expect(clearRecords(blocked)).toBe(false);
  });
  it('clears play records without clearing the separate recent-question history', () => {
    const values = new Map<string, string>([['recent', 'keep']]);
    const store = { getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
    saveRecord([], make(), store);
    expect(values.has(RECORDS_KEY)).toBe(true);
    expect(clearRecords(store)).toBe(true);
    expect(readRecords(store)).toEqual([]);
    expect(values.get('recent')).toBe('keep');
  });
});

describe('question-level analysis', () => {
  it('tracks selected option texts correctly despite shuffling and separates non-answers', () => {
    const q = questions[0], base = responses();
    const order = [2, 0, 3, 1];
    const shuffled = { ...q, choices: order.map(i => q.choices[i]), answer: order.indexOf(q.answer) };
    const runs: PlayRecord[] = [
      createPlayRecord('correct-a', base),
      createPlayRecord('correct-b', [{ question: shuffled, selected: shuffled.answer, elapsedMs: 6000 }, ...base.slice(1)]),
      createPlayRecord('wrong', [{ question: shuffled, selected: order.indexOf(1), elapsedMs: 8000 }, ...base.slice(1)]),
      createPlayRecord('skip', [{ question: q, selected: null, skipped: true, elapsedMs: 2000 }, ...base.slice(1)]),
      createPlayRecord('timeout', [{ question: q, selected: null, timedOut: true, elapsedMs: 20000 }, ...base.slice(1)]),
    ];
    const stats = questionStats(runs).find(s => s.id === q.id)!;
    expect(stats).toMatchObject({ attempts: 5, answered: 3, correct: 2, skips: 1, timeouts: 1,
      accuracy: 0.4, answeredAccuracy: 2 / 3, medianAnsweredMs: 6000, medianCorrectMs: 5000, sampleStatus: '표본 부족' });
    expect(stats.choiceCounts.find(c => c.choice === q.choices[q.answer])?.count).toBe(2);
    expect(stats.choiceCounts.find(c => c.choice === q.choices[1])?.count).toBe(1);
  });
  it('exports valid JSON with schema, scoring version, raw responses, and statistics', () => {
    const exported = JSON.parse(exportRecords([make()], '2026-10-11T12:00:00.000Z'));
    expect(exported).toMatchObject({ schemaVersion: 1, app: 'what-grade-science', currentGradingVersion: GRADING_VERSION });
    expect(exported.records[0].responses).toHaveLength(10);
    expect(exported.questionStats).toHaveLength(10);
    expect(exported.questionStats[0].medianAnsweredMs).toBe(4000);
  });
  it('has no answered timing or accuracy for all skipped attempts', () => {
    const skipped = responses().map(r => ({ ...r, selected: null, skipped: true }));
    const stats = questionStats([createPlayRecord('all-skip', skipped)])[0];
    expect(stats.answeredAccuracy).toBeNull();
    expect(stats.medianAnsweredMs).toBeNull();
    expect(stats.medianCorrectMs).toBeNull();
  });
});
