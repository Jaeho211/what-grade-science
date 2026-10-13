import { QuestionVisual } from './QuestionVisual';
import { parseSharedRecord, sharePath, shareTitle as recordTitle, shareDescription, shareLabel } from './share';
import { PwaControls } from './PwaControls';
import { createRoundClock, formatTime, QUESTION_SECONDS } from './round-clock';
import { useCallback, useEffect, useRef, useState } from 'react';
import { correct, nextQuestion, result, streakStats, TOTAL, type Question, type Response } from './quiz';
import { normalizeHistory, readHistory, rememberQuestion } from './history';
import { clearRecords, createPlayRecord, normalizeRecords, readRecords, saveRecord } from './records';
import { RecordsPanel } from './RecordsPanel';

export default function App() {
  const [screen, setScreen] = useState<'intro' | 'quiz' | 'result'>('intro');
  const [responses, setResponses] = useState<Response[]>([]);
  const [question, setQuestion] = useState<Question>();
  const [remaining, setRemaining] = useState(QUESTION_SECONDS);
  const [feedback, setFeedback] = useState<{ selected: number | null; timedOut: boolean; right: boolean; streak: number } | null>(null);
  const clock = useRef<ReturnType<typeof createRoundClock> | null>(null);
  const activeQuestionId = useRef<string | null>(null);
  const transition = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [notice, setNotice] = useState('');
  const [cardUnavailable, setCardUnavailable] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const [initialHistory] = useState(readHistory);
  const recent = useRef<string[]>(initialHistory);
  const [records, setRecords] = useState(readRecords);
  const sessionId = useRef('');
  const [recordNotice, setRecordNotice] = useState('');
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [screen, question]);
  function start() {
    if (transition.current) clearTimeout(transition.current);
    sessionId.current = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setRecordNotice('');
    const stored = readHistory();
    recent.current = normalizeHistory([...stored, ...recent.current]);
    const first = nextQuestion([], Math.random, recent.current);
    if (first) recent.current = rememberQuestion(recent.current, first.id);
    activeQuestionId.current = first?.id ?? null;
    setCardUnavailable(false); setResponses([]); setQuestion(first); setNotice(''); setFeedback(null);
    clock.current = createRoundClock(); setRemaining(QUESTION_SECONDS); setScreen('quiz');
  }
  const submit = useCallback((answer: number | null, skip = false) => {
    if (!question || !clock.current || activeQuestionId.current !== question.id) return;
    const timing = clock.current.settle(answer);
    if (!timing) return;
    const skipped = skip && !timing.timedOut;
    const updated = [...responses, { question, ...timing, skipped }];
    const advance = () => {
      setResponses(updated); setFeedback(null);
      if (updated.length === TOTAL) {
        const saved = saveRecord(normalizeRecords([...readRecords(), ...records]), createPlayRecord(sessionId.current, updated));
        setRecords(saved.records);
        setRecordNotice(saved.persisted ? '' : '기기에 저장하지 못했어요. 이번 기록은 아래에서 내려받을 수 있어요.');
        activeQuestionId.current = null; clock.current = null; setScreen('result');
      }
      else {
        const next = nextQuestion(updated, Math.random, recent.current);
        if (next) recent.current = rememberQuestion(recent.current, next.id);
        activeQuestionId.current = next?.id ?? null;
        clock.current = createRoundClock(); setRemaining(QUESTION_SECONDS); setQuestion(next);
      }
    };
    if (skipped) { advance(); return; }
    const response = updated.at(-1)!;
    setRemaining(clock.current.remaining());
    setFeedback({ selected: timing.selected, timedOut: timing.timedOut, right: correct(response), streak: streakStats(updated).current });
    transition.current = setTimeout(advance, timing.timedOut ? 800 : 400);
  }, [question, responses, records]);
  useEffect(() => {
    if (screen !== 'quiz' || feedback) return;
    const tick = () => {
      const seconds = clock.current?.remaining() ?? 0;
      setRemaining(seconds);
      if (seconds === 0) submit(null);
    };
    const timer = setInterval(tick, 100);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    tick();
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick); window.removeEventListener('focus', tick); };
  }, [screen, question, feedback, submit]);
  useEffect(() => () => { if (transition.current) clearTimeout(transition.current); }, []);
  const summary = result(responses);
  const shared = parseSharedRecord(window.location.pathname);
  const sharedRecord = { grade: summary.grade, score: summary.score, seconds: Math.min(200, Math.round(summary.elapsedMs / 1000)) };
  const shareUrl = new URL(sharePath(sharedRecord), window.location.origin).href;
  const shareTitle = recordTitle(sharedRecord);
  const shareText = `${shareTitle} 10문제 중 ${summary.score}개 정답 · ${formatTime(summary.elapsedMs)}. 도전하기: ${shareUrl}`;
  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
      else { await navigator.clipboard.writeText(shareText); setNotice('결과를 복사했어요. 친구에게 보내보세요!'); }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setNotice('공유하지 못했어요. 아래 결과 문구를 직접 복사해주세요.');
    }
  }
  function clearPlayRecords() {
    if (!clearRecords()) return false;
    setRecords([]); setRecordNotice(''); return true;
  }
  return <div className="shell">
    <header><a className="brand" href="/" aria-label="몇 학년 홈"><span className="brand-mark">몇</span>몇 학년<span className="brand-dot">?</span></a><span className="header-tag">작은 도전, 새로운 발견</span></header>
    <main>
      {screen === 'intro' && <div className="intro">
        {shared && <aside className="shared-result"><span>친구의 과학 도전</span><strong>{shareLabel(shared)}</strong><p>{shareDescription(shared)}</p><small>공유자가 보낸 결과예요. 실제 학년이나 능력을 의미하지 않아요.</small></aside>}
        <section className="intro-copy"><span className="eyebrow">20-SECOND CHALLENGE · 과학 편</span>
          <h1 ref={heading} tabIndex={-1}>당신의 과학 나이는<br /><span>몇 학년?</span></h1>

          <p className="lead">알고 있던 과학, 20초 안에 설명할 수 있을까?<br />10문제로 나의 과학 나이를 확인해보세요.</p>
          <div className="chips"><span>✦ 초등 3학년~중3</span><span>◷ 문제마다 20초</span><span>↗ 로그인 없이</span></div>
          <button className="primary start" onClick={start}>도전 시작 <span>→</span></button>
          <p className="fine">물리 · 화학 · 생명 · 지구과학, 골고루 도전해요.<br />최근에 본 문제는 덜 나오도록 골라요.</p>
        </section>
        <section className="illustration" aria-label="과학 도전 노트"><div className="orbit one">N</div><div className="orbit two">⚗</div><div className="orbit three">☾</div><div className="notebook"><div className="note-top">TODAY’S LITTLE CHALLENGE <span>✦</span></div><div className="note-question">자석을 반으로 자르면?</div><div className="equation">N ━ S</div><div className="note-lines"><i /><i /><i /></div><div className="note-bottom"><span>N극만 남을까?</span><span>↗</span></div></div><div className="sticker">딱 10문제!</div></section>
        <section className="how"><div><b>01</b><span>빠르게 풀고</span><p>내 답에 맞춰 달라지는 문제</p></div><div><b>02</b><span>과학 나이 확인</span><p>나는 과연 몇 학년일까?</p></div><div><b>03</b><span>친구에게 도전장</span><p>친구는 몇 학년으로 나올까?</p></div></section>
      </div>}
      <span className="feedback-announcement" role="status" aria-live="polite" aria-atomic="true">{feedback ? feedback.timedOut ? '시간 끝! 다음으로 넘어가요.' : feedback.right ? feedback.streak >= 3 ? `정답! ${feedback.streak}연속 정답!` : '정답!' : '아깝다! 다음 문제에 도전해요.' : ''}</span>
      {screen === 'quiz' && question && <section className="quiz panel">
        <div className="quiz-top"><span className="eyebrow">나의 과학 나이 도전 중</span><span className="counter">{responses.length + 1} <span>/ {TOTAL}</span></span></div>
        <div className="progress" role="progressbar" aria-label="답변 완료" aria-valuenow={responses.length} aria-valuemin={0} aria-valuemax={TOTAL}><div style={{ width: `${responses.length / TOTAL * 100}%` }} /></div>
        <div className={`timer ${remaining <= 5 ? 'urgent' : ''}`}>
          <div className="timer-heading"><span>남은 시간</span><strong role="timer" aria-label={feedback?.timedOut ? '시간 끝!' : `남은 시간 ${remaining}초`}>{feedback?.timedOut ? '시간 끝!' : `${remaining}초`}</strong></div>
          <div className="timer-track"><div style={{ width: `${remaining / QUESTION_SECONDS * 100}%` }} /></div>
        </div>
        <span className="domain-tag">{question.domain} · {question.kind}</span><span className="question-label">QUESTION {String(responses.length + 1).padStart(2, '0')}</span>
        <h1 className="question" ref={heading} tabIndex={-1}>{question.prompt}</h1>
        <QuestionVisual question={question} />
        <p className="question-help" id="choice-help">보기를 누르면 답이 확정돼요.</p>
        <div className="choices" role="group" aria-label="답 선택" aria-describedby="choice-help">{question.choices.map((choice, i) => <button key={`${question.id}-${i}`} className={`choice ${feedback?.selected === i ? feedback.right ? 'answered-right' : 'answered-wrong' : ''}`} disabled={feedback !== null} onClick={() => submit(i)}><span className="choice-number">{i + 1}</span><span className="choice-text">{choice}</span>{feedback?.selected === i && <span className="answer-mark">{feedback.right ? feedback.streak >= 3 ? `✓ ${feedback.streak}연속!` : '✓ 정답!' : '아깝다!'}</span>}</button>)}</div>
        <button className="skip" disabled={feedback !== null} onClick={() => submit(null, true)}>건너뛰기</button>
        <p className="fine center">시간이 끝나면 자동으로 넘어가요. 해설은 끝나고 확인!</p>
      </section>}
      {screen === 'result' && <section className="results">
        <div className="result-hero"><span className="eyebrow">YOUR SCIENCE MOMENT</span><div className="result-icon">✦</div><h1 ref={heading} tabIndex={-1}>당신의 과학 나이는</h1><p className="grade">{summary.label}</p><p className="lead">이번 도전에서 나온 과학 나이예요.</p><span className="score">10문제 중 {summary.score}개 정답 · {formatTime(summary.elapsedMs)}</span><p className="fine">재미로 보는 과학 나이예요. 실제 학년이나 과학 능력을 의미하지 않아요.</p></div>
        <p className="fine center">다른 문제에도 도전해서 과학 나이를 높여보세요!</p>
        {summary.evidence && <p className="evidence-note">{summary.evidence.domains.length}개 영역에서 정답 근거를 확인했어요.
          {summary.grade! >= 7 && ` ${summary.label} 이상에서 ${summary.evidence.directDomains.length}개 영역을 직접 맞혔어요.`}</p>}
        <p className="best-streak">✨ 최고 연속 정답 <strong>{summary.bestStreak}회</strong></p>
        {summary.skips > 0 && <p className="fine center">건너뛴 문제 {summary.skips}개 · 정답과 해설을 확인해보세요.</p>}
        {summary.timeouts > 0 && <p className="fine center">시간 초과 {summary.timeouts}문제 · 이번엔 조금 더 빠르게!</p>}
        <div className="domain-results" aria-label="영역별 정답">{summary.domains.map(d => <div key={d.domain}><span>{d.domain}</span><strong>{d.score}<small> / {d.total}</small></strong></div>)}</div>
        <figure className="share-card">{cardUnavailable ? <p className="fine center">결과 카드는 인터넷에 연결된 서비스에서 내려받을 수 있어요.</p> : <><img onError={() => setCardUnavailable(true)} src={sharePath(sharedRecord).replace("/share/", "/share-card/") + ".png"} alt={shareTitle + " · " + shareDescription(sharedRecord)} width="800" height="420" /><figcaption><a href={sharePath(sharedRecord).replace("/share/", "/share-card/") + ".png"} download="science-result.png">결과 카드 내려받기 ↓</a></figcaption></>}</figure>
        <div className="result-actions"><button className="primary" onClick={start}>다시 도전하기 ↻</button><button className="secondary" onClick={share}>자랑하기 ↗</button></div><p className="notice" role="status">{notice}</p>
        {notice.startsWith('공유하지') && <textarea className="share-fallback" readOnly value={shareText} aria-label="복사할 결과 문구" onFocus={e => e.target.select()} />}
        <details className="review"><summary className="review-heading">정답 확인 <span>{TOTAL}문제</span></summary><div>{responses.map((response, i) => <details key={response.question.id}><summary><span className={correct(response) ? 'right' : 'wrong'}>{correct(response) ? '✓' : '−'}</span><span>{i + 1}. {response.question.prompt}</span><span className="expand">＋</span></summary><div className="explanation"><p className="review-meta">{response.question.domain} · {response.question.concept} · {response.question.kind}</p><p>내 답: {response.selected === null ? (response.timedOut ? '시간 초과' : '건너뛰기') : response.question.choices[response.selected]}</p><p><strong>정답: {response.question.choices[response.question.answer]}</strong></p><p>{response.question.explanation}</p></div></details>)}</div></details>
      </section>}
      {screen !== 'quiz' && <><p className="notice" role="status">{recordNotice}</p><RecordsPanel records={records} onClear={clearPlayRecords} /></>}
      <PwaControls hidden={screen === 'quiz'} />
    </main><footer><span>몇 학년? · 도전하는 재미</span><span>과학 편 / 초3~중3</span></footer>
  </div>;
}
