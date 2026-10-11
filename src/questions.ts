import { questionRows } from './question-data';
export const DOMAINS = ['물리', '화학', '생명', '지구과학'] as const;
export type Domain = typeof DOMAINS[number];
export type Question = {
  id: string; level: number; domain: Domain; concept: string;
  curriculumBand: '초3~4' | '초5~6' | '중1~3';
  standard: string; curriculumReview: '학년군 대조';
  difficulty: '기초' | '적용' | '추론';
  kind: '현상 예측' | '원리 적용' | '자료 해석' | '실험 판단';
  expectedMs: number; prompt: string; choices: string[]; answer: number; explanation: string;
};
export type QuestionRow = [number, Domain, string, Question['kind'], string, string, string[], number, string];
function questionId(content: string) {
  let hash = 2166136261;
  for (const char of content) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `science-v2-${(hash >>> 0).toString(16)}`;
}
// Stable content IDs retain history across reordering but separate revisions of
// prompts, options, answers, levels, or standards in both history and analytics.
// Standards identify official learning bands; levels split those bands for this game.
export const questions: Question[] = questionRows.map(([level, domain, concept, kind, standard, prompt, choices, answer, explanation]) => ({
  id: questionId(JSON.stringify([prompt, [...choices].sort(), choices[answer], level, standard])), level, domain, concept, kind, standard,
  curriculumBand: standard.startsWith('4') ? '초3~4' : standard.startsWith('6') ? '초5~6' : '중1~3',
  curriculumReview: '학년군 대조',
  difficulty: kind === '실험 판단' || kind === '자료 해석' ? '추론' : kind === '현상 예측' ? '적용' : '기초',
  expectedMs: kind === '자료 해석' || kind === '실험 판단' ? 17000 : 12000,
  prompt, choices, answer, explanation,
}));
