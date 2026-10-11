import { describe, expect, it } from 'vitest';
import { HISTORY_KEY, HISTORY_LIMIT, normalizeHistory, readHistory, rememberQuestion, type HistoryStore } from './history';
import { questions } from './questions';

function store(raw: string | null = null): HistoryStore {
  let value = raw;
  return { getItem: () => value, setItem: (_key, next) => { value = next; } };
}
describe('recent question history', () => {
  it('persists shown questions, including questions from an unfinished game', () => {
    const storage = store();
    const [a, b] = questions;
    let ids = rememberQuestion([], a.id, storage);
    ids = rememberQuestion(ids, b.id, storage);
    expect(readHistory(storage)).toEqual([a.id, b.id]);
    expect(readHistory(storage)).toEqual(ids);
    expect(JSON.parse(storage.getItem(HISTORY_KEY)!)).toMatchObject({ version: 1 });
  });
  it('moves revisited questions to the end, removes stale IDs, and caps history', () => {
    const ids = questions.map(q => q.id);
    expect(normalizeHistory(ids)).toEqual(ids.slice(-HISTORY_LIMIT));
    expect(normalizeHistory([ids[0], ids[1], 'science-01', null, 3, ids[0]])).toEqual([ids[1], ids[0]]);
    expect(normalizeHistory({ ids })).toEqual([]);
  });
  it('ignores malformed, wrong-version, and wrong-shape persisted data', () => {
    for (const raw of ['oops', 'null', '[]', '{}', '{"version":2,"ids":[]}', '{"version":1,"ids":"bad"}']) {
      expect(readHistory(store(raw))).toEqual([]);
    }
  });
  it('keeps the in-memory result usable when storage is denied or full', () => {
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('quota'); } };
    expect(readHistory(blocked)).toEqual([]);
    expect(rememberQuestion([], questions[0].id, blocked)).toEqual([questions[0].id]);
  });
});
