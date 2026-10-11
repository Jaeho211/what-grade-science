export const QUESTION_SECONDS = 20;
export function createRoundClock(startedAt = Date.now()) {
  const deadline = startedAt + QUESTION_SECONDS * 1000;
  let settled = false;
  let settledAt: number | undefined;
  return {
    remaining: (now = Date.now()) => Math.max(0, Math.ceil((deadline - (settledAt ?? now)) / 1000)),
    settle(selected: number | null, now = Date.now()) {
      if (settled) return undefined;
      settled = true;
      settledAt = now;
      const timedOut = now >= deadline;
      return { selected: timedOut ? null : selected, timedOut, elapsedMs: Math.max(0, Math.min(now - startedAt, QUESTION_SECONDS * 1000)) };
    },
  };
}
export const formatTime = (ms: number) => {
  const seconds = Math.round(ms / 1000);
  return seconds >= 60 ? `${Math.floor(seconds / 60)}분 ${seconds % 60}초` : `${seconds}초`;
};
