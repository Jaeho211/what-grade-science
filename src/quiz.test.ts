import { describe, expect, it } from 'vitest';
import { correct, DOMAINS, nextQuestion, questions, result, TOTAL, type Response } from './quiz';

function play(mask: number, elapsedMs = 12000, random = () => 0.5) {
  const responses: Response[] = [];
  for (let i = 0; i < TOTAL; i++) {
    const question = nextQuestion(responses, random);
    expect(question).toBeDefined();
    responses.push({ question: question!, selected: mask & (1 << i) ? question!.answer : (question!.answer + 1) % 4, elapsedMs });
  }
  return responses;
}

describe('science question bank', () => {
  it('has 84 unique, complete, four-choice questions across all four domains', () => {
    expect(questions).toHaveLength(84);
    expect(new Set(questions.map(q => q.id)).size).toBe(84);
    expect(new Set(questions.map(q => q.prompt)).size).toBe(84);
    expect(new Set(questions.map(q => q.domain))).toEqual(new Set(DOMAINS));
    for (const q of questions) {
      expect(q.choices).toHaveLength(4);
      expect(new Set(q.choices).size).toBe(4);
      expect(q.choices[q.answer]).toBeTruthy();
      expect(q.explanation.length).toBeGreaterThan(10);
      expect(q.level).toBeGreaterThanOrEqual(3);
      expect(q.level).toBeLessThanOrEqual(9);
      expect(q.standard).toMatch(/^[469]과\d{2}-\d{2}$/);
      expect(q.curriculumBand).toBe(q.standard.startsWith('4') ? '초3~4' : q.standard.startsWith('6') ? '초5~6' : '중1~3');
      expect(q.curriculumReview).toBe('학년군 대조');
    }
    for (let level = 3; level <= 9; level++) for (const domain of DOMAINS) {
      expect(questions.filter(q => q.level === level && q.domain === domain)).toHaveLength(3);
    }
  });
  it('preserves the correct answer when shuffling', () => {
    for (const random of [() => 0, () => 0.5, () => 0.99999]) {
      const shuffled = nextQuestion([], random)!;
      const original = questions.find(q => q.id === shuffled.id)!;
      expect(shuffled.choices[shuffled.answer]).toBe(original.choices[original.answer]);
      expect(new Set(shuffled.choices)).toEqual(new Set(original.choices));
    }
  });
});

describe('ten-question game and evidence', () => {
  it('finishes every possible right/wrong sequence without duplicates or domain imbalance', () => {
    for (let mask = 0; mask < 1024; mask++) {
      const responses = play(mask);
      expect(new Set(responses.map(r => r.question.id)).size).toBe(TOTAL);
      for (const d of DOMAINS) expect(responses.filter(r => r.question.domain === d).length).toBeGreaterThanOrEqual(2);
      expect(nextQuestion(responses)).toBeUndefined();
      const summary = result(responses);
      expect(summary.score).toBe(responses.filter(correct).length);
      if (summary.grade !== null) {
        expect(summary.grade).toBeGreaterThanOrEqual(3);
        expect(summary.grade).toBeLessThanOrEqual(9);
      }
    }
  });
  it('allows both fast and slower all-correct runs to reach middle three', () => {
    expect(result(play(1023)).grade).toBe(9);
    expect(result(play(1023, 3000)).grade).toBe(9);
  });
  it('does not invent a grade for all-wrong, skipped, timed-out, or empty runs', () => {
    const missed = play(0);
    expect(result(missed).grade).toBeNull();
    expect(result([]).grade).toBeNull();
    expect(result(missed.map(r => ({ ...r, selected: null, skipped: true }))).grade).toBeNull();
    expect(result(missed.map(r => ({ ...r, selected: r.question.answer, timedOut: true }))).score).toBe(0);
  });
  it('cannot qualify using only one domain or one lucky high-level answer', () => {
    const physics = questions.filter(q => q.domain === '물리').map(question => ({ question, selected: question.answer }));
    expect(result(physics).grade).toBeNull();
    const top = questions.filter(q => q.level === 9);
    expect(result([{ question: top[0], selected: top[0].answer }]).grade).toBeNull();
    const evidence = DOMAINS.slice(0, 3).map(domain => top.find(q => q.domain === domain)!)
      .map(question => ({ question, selected: question.answer, elapsedMs: 19000 }));
    expect(result(evidence).grade).toBe(9);
    expect(result(evidence.map(r => ({ ...r, elapsedMs: 2000 }))).grade).toBe(9);
  });
  it('tolerates constant and seeded random selection', () => {
    let seed = 42;
    const seeded = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (const random of [() => 0, () => 0.99999, seeded]) {
      const responses = play(1023, 12000, random);
      expect(new Set(responses.map(r => r.question.id)).size).toBe(TOTAL);
    }
  });
  it('prioritizes fresh same-level questions and falls back to the oldest without lowering the level', () => {
    const target = questions.filter(q => q.level === 5);
    const first = nextQuestion([], () => 0)!;
    const fresh = nextQuestion([], () => 0, [first.id])!;
    expect(fresh.id).not.toBe(first.id);
    expect(fresh.level).toBe(first.level);
    const ids = target.map(q => q.id);
    const oldest = nextQuestion([], () => 0, ids)!;
    expect(oldest.id).toBe(ids[0]);
    expect(oldest.level).toBe(5);
  });
  it('does not repeat an immediate all-correct replay when fresh candidates exist', () => {
    const first = play(1023, 12000, () => 0);
    const recent = first.map(r => r.question.id);
    const replay: Response[] = [];
    for (let i = 0; i < TOTAL; i++) {
      const q = nextQuestion(replay, () => 0, recent)!;
      expect(recent).not.toContain(q.id);
      replay.push({ question: q, selected: q.answer, elapsedMs: 12000 });
    }
    expect(result(replay).grade).toBe(9);
  });
  it('finishes all answer patterns with a saturated recent history', () => {
    const recent = questions.map(q => q.id);
    for (let mask = 0; mask < 1024; mask++) {
      const responses: Response[] = [];
      for (let i = 0; i < TOTAL; i++) {
        const q = nextQuestion(responses, () => 0.99999, recent)!;
        expect(q).toBeDefined();
        responses.push({ question: q, selected: mask & (1 << i) ? q.answer : null, elapsedMs: 14000 });
      }
      expect(new Set(responses.map(r => r.question.id)).size).toBe(TOTAL);
      const levels = responses.map(r => r.question.level);
      expect(Math.min(...levels)).toBeGreaterThanOrEqual(3);
      expect(Math.max(...levels)).toBeLessThanOrEqual(9);
    }
  });
});
