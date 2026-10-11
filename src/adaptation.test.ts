import { describe, expect, it } from 'vitest';
import { nextQuestion, result, targetGrade, TOTAL, type Response, questions } from './quiz';
function play(miss: number[], elapsedMs = 18000, random = () => 0.5, recent: string[] = []) {
  const responses: Response[] = [];
  for (let i = 0; i < TOTAL; i++) {
    const question = nextQuestion(responses, random, recent)!;
    responses.push({ question, selected: miss.includes(i) ? null : question.answer, elapsedMs });
  }
  return responses;
}
describe('checkpoint and recovery exploration', () => {
  it('offers middle-two or higher after five of six correct, regardless of miss position or speed', () => {
    for (const random of [() => 0, () => 0.5, () => 0.99999]) {
      for (const recent of [[], questions.map(q => q.id)]) {
        for (const elapsedMs of [3000, 18000]) for (let miss = 0; miss < 6; miss++) {
          const run = play([miss], elapsedMs, random, recent);
          expect(run[6].question.level).toBeGreaterThanOrEqual(8);
          expect(result(run).grade).toBeGreaterThanOrEqual(8);
        }
      }
    }
  });
  it('recovers the reported sixth-question miss instead of freezing at middle one', () => {
    const run = play([5]);
    expect(run.map(r => r.question.level)).toEqual([5,5,6,6,7,7,8,8,8,8]);
    expect(result(run).grade).toBe(8);
  });
  it('uses a middle-three checkpoint for a perfect opening even with slow answers', () => {
    const run = play([]);
    expect(run.map(r => r.question.level)).toEqual([5,5,6,6,7,7,9,9,9,9]);
    expect(result(run).grade).toBe(9);
  });
  it('does not award an advanced grade for an unsuccessful checkpoint or a lone success', () => {
    const run = play([6,7,8,9]);
    expect(run[6].question.level).toBe(9);
    expect(run[8].question.level).toBe(8);
    expect(result(run).grade).toBeLessThan(8);
    const oneHit = play([7,8,9]);
    expect(result(oneHit).grade).toBeLessThan(9);
  });
  it('does not let speed or recovery stack beyond two levels or trust invalid timing', () => {
    const run = play([0],3000);
    expect(targetGrade(run.slice(0,4))).toBe(7);
    for (const elapsedMs of [999,NaN,Infinity]) {
      const pair = play([],elapsedMs).slice(0,2);
      expect(targetGrade(pair)).toBe(6);
    }
    const pair = play([],3000).slice(0,2);
    pair[1].question = { ...pair[1].question, level: 6 };
    expect(targetGrade(pair)).toBe(6);
  });
});
