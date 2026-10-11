import { parseSharedRecord, shareDescription, sharePath, shareTitle } from '../src/share';
import { shareImage } from './share-image';
export type Env = { ASSETS: { fetch(request: Request): Promise<Response> } };
const escape = (text: string) => text.replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export default {
  async fetch(request: Request,env: Env): Promise<Response> {
    const url=new URL(request.url);
    if(!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed',{status:405});
    const imagePath=url.pathname.replace(/^\/share-card\//,'/share/').replace(/\.png$/,'');
    const isImage=url.pathname.startsWith('/share-card/');
    const record=parseSharedRecord(isImage ? imagePath : url.pathname);
    if(isImage && (!url.pathname.endsWith('.png') || !record)) return new Response('Not found',{status:404});
    if(record && isImage) {
      const png=await shareImage(record);
      return new Response(request.method==='HEAD' ? null : png,{headers:{'Content-Type':'image/png','Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'}});
    }
    if(url.pathname.startsWith('/share/') && !record) return new Response('Not found',{status:404});
    if(!record) return env.ASSETS.fetch(request);
    const asset=await env.ASSETS.fetch(new Request(new URL('/index.html',url),{method:'GET'}));
    if(!asset.ok) return asset;
    const title=shareTitle(record), description=shareDescription(record);
    const canonical=new URL(sharePath(record),url).href;
    const image=new URL(sharePath(record).replace('/share/','/share-card/')+'.png',url).href;
    const metadata=[['og:type','website'],['og:site_name','몇 학년?'],['og:title',title],['og:description',description],['og:url',canonical],['og:image',image],['og:image:secure_url',image],['og:image:type','image/png'],['og:image:width','800'],['og:image:height','420'],['og:image:alt',`${title} ${description}`]]
      .map(([property,content])=>`<meta property="${property}" content="${escape(content)}" />`).join('');
    const html=(await asset.text()).replace(/<title>[\s\S]*?<\/title>/,`<title>${escape(title)}</title>`)
      .replace(/<meta name="description"[^>]*>/,`<meta name="description" content="${escape(description)}" />`)
      .replace('</head>',`${metadata}<meta name="twitter:card" content="summary_large_image" /><meta name="twitter:title" content="${escape(title)}" /><meta name="twitter:description" content="${escape(description)}" /><meta name="twitter:image" content="${escape(image)}" /><meta name="robots" content="noindex" /><link rel="canonical" href="${escape(canonical)}" /></head>`);
    return new Response(request.method==='HEAD' ? null : html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=3600'}});
  },
};
