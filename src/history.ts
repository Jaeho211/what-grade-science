import { questions } from './questions';

export const HISTORY_KEY = 'what-grade-science:recent:v1';
export const HISTORY_LIMIT = 60;
export type HistoryStore = Pick<Storage, 'getItem' | 'setItem'>;
const knownIds = new Set(questions.map(q => q.id));

// Oldest first; recording happens when a question is shown, including abandoned games.
export function normalizeHistory(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const valid: string[] = [];
  for (let i = value.length - 1; i >= 0 && valid.length < HISTORY_LIMIT; i--) {
    const id = value[i];
    if (typeof id === 'string' && knownIds.has(id) && !seen.has(id)) { valid.push(id); seen.add(id); }
  }
  return valid.reverse();
}

export function readHistory(storage?: HistoryStore): string[] {
  try {
    const store = storage ?? window.localStorage;
    const raw = store.getItem(HISTORY_KEY);
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1 || !('ids' in data)) return [];
    return normalizeHistory(data.ids);
  } catch { return []; }
}

export function rememberQuestion(ids: readonly string[], id: string, storage?: HistoryStore): string[] {
  const updated = normalizeHistory([...ids, id]);
  try { (storage ?? window.localStorage).setItem(HISTORY_KEY, JSON.stringify({ version: 1, ids: updated })); }
  catch { /* Private browsing / full storage: the caller keeps this history in memory. */ }
  return updated;
}
