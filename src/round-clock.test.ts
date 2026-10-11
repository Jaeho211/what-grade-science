import { describe, expect, it } from 'vitest';
import { createRoundClock, formatTime } from './round-clock';
import { nextQuestion, result, targetGrade, TOTAL, type Response } from './quiz';

describe('20-second round clock', () => {
  it('uses the deadline even when no timer ticks occurred in the background', () => {
    const clock = createRoundClock(1000);
    expect(clock.remaining(1000)).toBe(20);
    expect(clock.remaining(16000)).toBe(5);
    expect(clock.remaining(99999)).toBe(0);
    expect(clock.settle(2, 99999)).toEqual({ selected: null, timedOut: true, elapsedMs: 20000 });
  });
  it('accepts an answer before the deadline and settles only once', () => {
    const clock = createRoundClock(1000);
    expect(clock.settle(2, 20999)).toEqual({ selected: 2, timedOut: false, elapsedMs: 19999 });
    expect(clock.settle(null, 21000)).toBeUndefined();
    expect(clock.settle(1, 21001)).toBeUndefined();
  });
  it('counts an answer at the deadline as a timeout and ignores a competing timeout', () => {
    const clock = createRoundClock(0);
    expect(clock.settle(0, 20000)?.timedOut).toBe(true);
    expect(clock.settle(null, 20000)).toBeUndefined();
  });
  it('resets for a new round or retry', () => {
    const old = createRoundClock(0);
    old.settle(null, 20000);
    const fresh = createRoundClock(50000);
    expect(fresh.remaining(50000)).toBe(20);
    expect(fresh.settle(1, 51000)?.elapsedMs).toBe(1000);
  });
  it('finishes ten timeouts, lowers the grade and reports capped playing time', () => {
    const responses: Response[] = [];
    for (let i = 0; i < TOTAL; i++) {
      const question = nextQuestion(responses, () => 0)!;
      responses.push({ question, ...createRoundClock(0).settle(null, 25000)! });
    }
    expect(nextQuestion(responses)).toBeUndefined();
    expect(targetGrade(responses)).toBe(3);
    expect(result(responses)).toMatchObject({ grade: null, timeouts: 10, elapsedMs: 200000, score: 0 });
    expect(formatTime(84000)).toBe('1분 24초');
  });
});
