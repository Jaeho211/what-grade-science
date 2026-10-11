import { describe, expect, it } from 'vitest';
import { applicationQuestion, DOMAINS, levelEvidence, nextQuestion, questions, result, TOTAL, type Response } from './quiz';

const hit = (question: typeof questions[number]): Response => ({ question, selected: question.answer, elapsedMs: 15000 });
describe('cross-domain confirmation', () => {
  it('does not promote two high-level domains using only lower-level evidence from a third', () => {
    const responses = [
      hit(questions.find(q => q.level === 9 && q.domain === '물리')!),
      hit(questions.find(q => q.level === 9 && q.domain === '화학')!),
      hit(questions.find(q => q.level === 8 && q.domain === '생명')!),
    ];
    expect(levelEvidence(responses, 9).qualified).toBe(false);
    expect(result(responses).grade).not.toBe(9);
  });
  it('requires application successes and independent standards, and cannot multiply copied answers', () => {
    const factual = DOMAINS.slice(0, 3).map(domain => ({
      ...questions.find(q => q.level === 9 && q.domain === domain)!, kind: '원리 적용' as const, concept: '용어 확인',
    }));
    expect(result(factual.map(hit)).grade).toBeLessThan(7);
    const valid = DOMAINS.slice(0, 3).map(domain => questions.find(q => q.level === 9 && q.domain === domain)!);
    expect(levelEvidence(valid.map(hit), 9).qualified).toBe(true);
    const repeated = [hit(valid[0]), hit(valid[0]), hit(valid[0]), hit(valid[1])];
    expect(levelEvidence(repeated, 9).qualified).toBe(false);
    const sameStandard = valid.map(q => ({ ...q, standard: '9과19-03' }));
    expect(levelEvidence(sameStandard.map(hit), 9).qualified).toBe(false);
  });
  it('still reaches middle three across different selection paths and memory states', () => {
    let seed = 29;
    const seeded = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (const rng of [() => 0, () => 0.5, () => 0.99999, seeded]) {
      for (const elapsedMs of [3000, 18000]) for (const recent of [[], questions.map(q => q.id)]) {
        const responses: Response[] = [];
        for (let i = 0; i < TOTAL; i++) {
          const q = nextQuestion(responses, rng, recent)!;
          responses.push({ ...hit(q), elapsedMs });
        }
        expect(result(responses).grade).toBe(9);
        expect(levelEvidence(responses, 9).directDomains.length).toBeGreaterThanOrEqual(3);
        expect(levelEvidence(responses, 9).applications).toBeGreaterThanOrEqual(2);
      }
    }
  });
  it('selects a missing confirmation domain and application task without breaking balance', () => {
    const responses: Response[] = [];
    for (let i = 0; i < 6; i++) responses.push(hit(nextQuestion(responses, () => 0.5)!));
    const q = nextQuestion(responses, () => 0.99999)!;
    const counts = DOMAINS.map(d => responses.filter(r => r.question.domain === d).length);
    expect(responses.filter(r => r.question.domain === q.domain).length).toBe(Math.min(...counts));
    expect(applicationQuestion(q)).toBe(true);
    expect(q.level).toBe(9);
  });
});
