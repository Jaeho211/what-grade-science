# 몇 학년? · 과학

10문제, 문제당 20초로 알아보는 나의 과학 나이. 초3~중3 범위의 초기 게임이며
물리·화학·생명·지구과학을 골고루 출제한다.
[수학 앱](https://github.com/Jaeho211/what-grade)의 화면·타이머·PWA를 기반으로 제작했다.

## 현재 구현: Phase 1–2

- 직접 작성한 대표 문항 24개, 보기 무작위 배치, 한 회차 내 중복 방지
- 적응형 출제, 10문제·20초, 넘기기, 정답/오답/시간 초과 피드백
- 세 영역 이상의 정답 근거에 따른 잠정 학년 결과; 근거가 부족하면 ‘확인 필요’
- 영역별 정답 수, 연속 정답 기록, 전체 문항 정답·해설
- 결과 텍스트 공유·복사, PWA 설치·업데이트 지원

학년 배치는 아직 교육과정 대조 전의 초기 기준이다. 실제 학년이나 전체 과학 능력을 진단하지 않는다.
회차 간 최근 문제 제외, 문항 변형, 그림 문제, 공유 링크 미리보기 카드는 후속 Phase에서 구현한다.

## 실행 및 검증

Node.js 22.12 이상 또는 지원되는 최신 LTS 사용.

```sh
npm ci
npm run dev
npm test
npm run build
```

## Cloudflare 배포

Worker 이름은 `what-grade-science`. Cloudflare Git 빌드에 연결할 때 설치 `npm ci`,
빌드 `npm run build`, 배포 `npx wrangler deploy`를 사용한다.
계정과 저장소 연결·도메인 설정은 별도다. 이 저장소에 코드를 올리는 것만으로 자동 배포가 설정되지는 않는다.

```sh
npm run deploy
```

## 설계 문서

- [Phase별 구현 계획](docs/implementation-plan.md)
- [초기 개념 맵과 문항 검토 규칙](docs/curriculum-map.md)

## 주요 파일

- `src/questions.ts`: 24개 문항과 메타데이터
- `src/quiz.ts`: 출제·영역 균형·기본 학년 판정
- `src/App.tsx`: 시작·게임·결과·해설·공유
- `src/round-clock.ts`: 마감 시간 기준 타이머·중복 제출 방지
- `src/quiz.test.ts`, `src/round-clock.test.ts`: 게임·데이터·타이머 검증

브라우저 실기기 QA와 교육과정 검토는 아직 남아 있다. 응답은 서버로 전송하거나 저장하지 않는다.
