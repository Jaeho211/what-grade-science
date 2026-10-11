export type SharedRecord = { grade: number | null; score: number; seconds: number };
export function parseSharedRecord(path: string): SharedRecord | null {
  const match = /^\/share\/v1\/([03-9])\/(10|[0-9])\/(0|[1-9]\d{0,2})\/?$/.exec(path);
  if (!match || Number(match[3]) > 200) return null;
  return { grade: Number(match[1]) || null, score: Number(match[2]), seconds: Number(match[3]) };
}
export const sharePath = (record: SharedRecord) => `/share/v1/${record.grade ?? 0}/${record.score}/${record.seconds}`;
export const shareLabel = (record: SharedRecord) => record.grade === null ? '확인 필요' : record.grade <= 6 ? `초등 ${record.grade}학년` : `중학교 ${record.grade - 6}학년`;
export const shareTitle = (record: SharedRecord) => record.grade === null ? '나의 과학 도전 기록' : `나의 과학 나이는 ${shareLabel(record)}!`;
export const shareDescription = (record: SharedRecord) => `10문제 중 ${record.score}개 정답 · ${record.seconds}초. 재미로 보는 과학 나이, 당신도 도전해보세요!`;
