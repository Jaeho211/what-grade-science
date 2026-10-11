import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
export function PwaControls({ hidden }: { hidden: boolean }) {
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [help, setHelp] = useState(false);
  const [error, setError] = useState('');
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, registration) { registration?.update().catch(() => {}); },
  });
  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)');
    const check = () => setInstalled(standalone.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const ready = (event: Event) => { event.preventDefault(); setInstall(event as InstallEvent); };
    const done = () => { setInstalled(true); setInstall(null); };
    check();
    standalone.addEventListener('change', check);
    window.addEventListener('beforeinstallprompt', ready);
    window.addEventListener('appinstalled', done);
    return () => {
      standalone.removeEventListener('change', check);
      window.removeEventListener('beforeinstallprompt', ready);
      window.removeEventListener('appinstalled', done);
    };
  }, []);
  async function requestInstall() {
    if (!install) { setHelp(value => !value); return; }
    try { await install.prompt(); await install.userChoice; setInstall(null); }
    catch { setHelp(true); setInstall(null); }
  }
  if (hidden) return null;
  return <aside className="pwa-controls" aria-label="앱 설치 및 업데이트" lang="ko">
    {!installed && <><button className="secondary" onClick={requestInstall}>홈 화면에 설치하기</button>
      {help && <p role="status">Android는 Chrome 메뉴의 ‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택하세요. iPhone은 Safari에서 공유 버튼 → ‘홈 화면에 추가’를 선택하세요. 설치 메뉴가 없다면 기본 브라우저에서 열어주세요.</p>}</>}
    {needRefresh && <div><p>새 버전이 준비됐어요. 업데이트하면 화면이 새로 열려요.</p><button className="secondary" onClick={() => { setError(''); void updateServiceWorker(true).catch(() => setError('업데이트하지 못했어요. 인터넷 연결을 확인하고 다시 시도해주세요.')); }}>업데이트</button></div>}
    {error && <p role="status">{error}</p>}
  </aside>;
}
