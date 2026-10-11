import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseSharedRecord, sharePath } from './share';
import { QuestionVisual } from './QuestionVisual';
import { questions } from './questions';
import worker from '../worker';
const env = { ASSETS: { fetch: async () => new Response('<html><head><title>science</title><meta name="description" content="science"></head><body></body></html>') } };
describe('science sharing', () => {
  it('round trips supported and insufficient results', () => {
    for (const grade of [null,3,6,7,9]) {
      const record = { grade, score: 10, seconds: 200 };
      expect(parseSharedRecord(sharePath(record))).toEqual(record);
    }
  });
  it('rejects malformed or out of range links', () => {
    for (const path of ['/share/v1/1/5/20','/share/v1/9/11/20','/share/v1/3/5/201','/share/v1/0/5/01','/share/v1/3/5/20/injected']) expect(parseSharedRecord(path)).toBeNull();
  });
  it('serves social metadata for a shared result and HEAD without a body', async () => {
    const url = 'https://science.example/share/v1/0/4/123';
    const response = await worker.fetch(new Request(url), env);
    const html = await response.text();
    expect(html).toContain('나의 과학 도전 기록');
    expect(html).toContain('https://science.example/share-card/v1/0/4/123.png');
    expect(html).toContain('summary_large_image');
    expect(await (await worker.fetch(new Request(url, { method: 'HEAD' }), env)).text()).toBe('');
  });
  it('produces 800 by 420 PNG cards including insufficient results', async () => {
    for (const grade of [0,9]) {
      const response = await worker.fetch(new Request(`https://science.example/share-card/v1/${grade}/10/200.png`), env);
      expect(response.headers.get('Content-Type')).toBe('image/png');
      const png = new Uint8Array(await response.arrayBuffer());
      expect([...png.slice(0,8)]).toEqual([137,80,78,71,13,10,26,10]);
      const view = new DataView(png.buffer);
      expect(view.getUint32(16)).toBe(800); expect(view.getUint32(20)).toBe(420);
      expect(png.length).toBeGreaterThan(3000);
    }
  });
  it('rejects invalid cards and unsupported methods', async () => {
    for (const path of ['/share/v1/2/4/20','/share-card/v1/3/5/20.svg']) expect((await worker.fetch(new Request('https://science.example'+path),env)).status).toBe(404);
    expect((await worker.fetch(new Request('https://science.example/share/v1/3/5/20',{method:'POST'}),env)).status).toBe(405);
  });
});
describe('question visuals', () => {
  it('renders five accessible, self-contained visuals without changing the bank', () => {
    const rendered = questions.map(question => renderToStaticMarkup(<QuestionVisual question={question} />)).filter(Boolean);
    expect(rendered).toHaveLength(5);
    for (const svg of rendered) { expect(svg).toContain('role="img"'); expect(svg).toContain('aria-label='); expect(svg).not.toContain('정답'); }
    expect(rendered.join('')).toContain('80cm');
    expect(rendered.join('')).toContain('왼쪽 5N');
  });
});
