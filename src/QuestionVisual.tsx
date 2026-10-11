import type { Question } from './questions';
const descriptions: Record<string, string> = {
  '지층과 시간': '변형되지 않은 지층: 아래부터 A, B, C.',
  '힘의 합력': '물체에 왼쪽 5N, 오른쪽 8N의 힘이 작용한다.',
  '속력 비교': '같은 거리 60m: A는 10초, B는 15초.',
  '그림자와 태양 높이': '그림자 길이: 9시 80cm, 12시 30cm, 15시 70cm.',
  '속력 그래프 해석': '속력: 0초 2m/s, 1초 4m/s, 2초 6m/s, 3초 8m/s.',
};
export function QuestionVisual({ question }: { question: Question }) {
  // This diagram describes the original opposite-direction force scenario only.
  if (question.concept === '힘의 합력' && !question.prompt.includes('오른쪽 8N, 왼쪽 5N')) return null;
  const description = descriptions[question.concept];
  if (!description) return null;
  return <figure className="question-visual"><svg viewBox="0 0 360 170" role="img" aria-label={description}>
    {question.concept === '지층과 시간' && ['C', 'B', 'A'].map((label, i) => <g key={label}><rect x="45" y={15 + i * 48} width="270" height="46" rx="4" fill={['#dce9df','#d6dfed','#ecdac2'][i]} /><text x="180" y={45 + i * 48}>{label}</text></g>)}
    {question.concept === '힘의 합력' && <><rect x="140" y="60" width="80" height="65" rx="8" fill="#dce9df" /><path d="M140 90H50L65 80M50 90L65 100 M220 90H320L305 80M320 90L305 100" fill="none" stroke="#285943" strokeWidth="4" /><text x="90" y="55">5N</text><text x="270" y="55">8N</text></>}
    {question.concept === '속력 비교' && ['A', 'B'].map((label, i) => <g key={label}><text x="30" y={48 + i * 65}>{label}</text><path d={`M55 ${42+i*65} H310`} stroke="#285943" strokeWidth="3" /><text x="180" y={32 + i * 65}>60m</text><text x="180" y={65 + i * 65}>{i ? 15 : 10}초</text></g>)}
    {question.concept === '그림자와 태양 높이' && <><text x="180" y="20">그림자 길이 (cm)</text>{[80, 30, 70].map((n, i) => <g key={i}><rect x={65+i*100} y={125-n} width="40" height={n} rx="3" fill="#62977b" /><text x={85+i*100} y={117-n}>{n}</text><text x={85+i*100} y="150">{[9,12,15][i]}시</text></g>)}</>}
    {question.concept === '속력 그래프 해석' && <><text x="80" y="20">속력 (m/s)</text><path d="M55 30V135H325" fill="none" stroke="#657062" strokeWidth="2" />{[2,4,6,8].map((n, i) => <g key={n}><text x="35" y={139-n*12}>{n}</text><text x={70+i*75} y="155">{i}초</text><circle cx={70+i*75} cy={135-n*12} r="5" fill="#285943" /></g>)}<path d="M70 111L145 87L220 63L295 39" fill="none" stroke="#285943" strokeWidth="3" /></>}
  </svg><figcaption>문제의 조건을 나타낸 자료</figcaption></figure>;
}
