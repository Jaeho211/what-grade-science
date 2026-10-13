import { useState } from 'react';
import { levelLabel } from './quiz';
import { exportRecords, questionStats, type PlayRecord } from './records';

export function RecordsPanel({ records, onClear }: { records: PlayRecord[]; onClear: () => boolean }) {
  const [notice, setNotice] = useState('');
  function download() {
    try {
      const blob = new Blob([exportRecords(records)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url;
      link.download = `science-play-records-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('기록 파일을 내려받았어요.');
    } catch { setNotice('파일을 내려받지 못했어요. 다시 시도해주세요.'); }
  }
  const stats = questionStats(records);
  return <details className="records-panel">
    <summary className="review-heading">내 도전 기록 <span>{records.length}회</span></summary>
    <p className="fine">최근 50회가 이 기기에 저장돼요. 기록 파일을 보내주면 문제 난이도와 판정을 함께 살펴볼 수 있어요.</p>
    {records.length ? <>
      <ol className="recent-plays">{records.slice(-5).reverse().map(record => <li key={record.id}>
        <time dateTime={record.completedAt}>{new Date(record.completedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>
        <strong>{levelLabel(record.grade ?? 3)}</strong><span>{record.score} / 10</span>
      </li>)}</ol>
      <div className="record-actions"><button className="secondary" onClick={download}>기록 내려받기</button>
        <button className="skip" onClick={() => setNotice(onClear() ? '도전 기록을 지웠어요.' : '기록을 지우지 못했어요. 다시 시도해주세요.')}>도전 기록 지우기</button></div>
      <details className="record-stats"><summary>문제별 기록 살펴보기 <span>{stats.length}문항</span></summary>
        <p className="fine">이 기기의 기록만 모은 값이에요. 적응형 출제와 재도전의 영향을 받으며, 정답률만으로 학년을 바꾸지는 않아요.</p>
        <div className="stats-scroll"><table><thead><tr><th>문제</th><th>정답 / 출제</th><th>답한 시간<br />(중앙값)</th></tr></thead>
          <tbody>{stats.map(stat => <tr key={stat.id}><td>{stat.prompt}<small>{stat.domain} · {stat.sampleStatus}</small></td>
            <td>{stat.correct} / {stat.attempts}<small>넘김 {stat.skips} · 시간 초과 {stat.timeouts}</small></td>
            <td>{stat.medianAnsweredMs === null ? '—' : `${(stat.medianAnsweredMs / 1000).toFixed(1)}초`}</td></tr>)}</tbody></table></div>
      </details>
    </> : <p className="fine">10문제 도전을 끝내면 기록이 남아요.</p>}
    <p className="notice" role="status">{notice}</p>
  </details>;
}
