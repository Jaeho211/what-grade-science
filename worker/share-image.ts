import { glyphs } from './share-glyphs';
import type { SharedRecord } from '../src/share';
const W = 800, H = 420;
type GlyphKey = keyof typeof glyphs;
const decoded = new Map<string, Promise<Uint8Array>>();
function mask(key: GlyphKey) {
  if (!decoded.has(key)) {
    const encoded = Uint8Array.from(atob(glyphs[key].data), c => c.charCodeAt(0));
    decoded.set(key, new Response(new Blob([encoded]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer().then(b => new Uint8Array(b)));
  }
  return decoded.get(key)!;
}
function crc(bytes: Uint8Array) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let i=0;i<8;i++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}
function chunk(name: string, data: Uint8Array) {
  const result = new Uint8Array(data.length + 12);
  const view = new DataView(result.buffer);
  view.setUint32(0, data.length);
  result.set(new TextEncoder().encode(name),4); result.set(data,8);
  view.setUint32(data.length+8,crc(result.subarray(4,data.length+8)));
  return result;
}
export async function shareImage(record: SharedRecord): Promise<Uint8Array<ArrayBuffer>> {
  const pixels = new Uint8Array(W * H * 3);
  function rectangle(x: number,y: number,w: number,h: number,color: number[]) {
    const strip = new Uint8Array(w * 3);
    for(let col=0;col<w;col++) strip.set(color,col*3);
    for(let row=y;row<y+h;row++) pixels.set(strip,(row*W+x)*3);
  }
  rectangle(0,0,W,H,[250,248,244]);
  rectangle(70,226,300,102,[233,237,223]);
  rectangle(430,226,300,102,[233,237,223]);
  async function draw(key: GlyphKey, x: number, y: number, color: number[]) {
    const glyph=glyphs[key], bytes=await mask(key);
    for(let row=0;row<glyph.h;row++) for(let col=0;col<glyph.w;col++) {
      const alpha=bytes[row*glyph.w+col];
      if(!alpha) continue;
      const index=((y+row)*W+x+col)*3;
      for(let c=0;c<3;c++) pixels[index+c]=Math.round((pixels[index+c]*(255-alpha)+color[c]*alpha)/255);
    }
  }
  async function centered(key: GlyphKey, center: number,y: number,color=[40,89,67]) {
    await draw(key,Math.round(center-glyphs[key].w/2),y,color);
  }
  async function digits(text: string,center: number,y: number) {
    const keys=Array.from(text,c => `digit${c}` as GlyphKey);
    const width=keys.reduce((n,key)=>n+glyphs[key].w,0);
    let x=Math.round(center-width/2);
    for(const key of keys) { await draw(key,x,y,[40,89,67]); x+=glyphs[key].w; }
  }
  await centered('brand',400,22,[101,112,98]);
  await centered('title',400,70);
  await centered(`grade${record.grade ?? 3}` as GlyphKey,400,122);
  await centered('scoreLabel',220,238,[101,112,98]);
  await centered('timeLabel',580,238,[101,112,98]);
  await digits(`${record.score} / 10`,220,271);
  await digits(`${record.seconds}초`,580,271);
  await centered('footer',400,355,[101,112,98]);
  const rows=new Uint8Array((W*3+1)*H);
  for(let y=0;y<H;y++) rows.set(pixels.subarray(y*W*3,(y+1)*W*3),y*(W*3+1)+1);
  const compressed=new Uint8Array(await new Response(new Blob([rows]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
  const header=new Uint8Array(13), view=new DataView(header.buffer);
  view.setUint32(0,W); view.setUint32(4,H); header[8]=8; header[9]=2;
  const parts=[new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',compressed),chunk('IEND',new Uint8Array())];
  const png=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));
  let offset=0; for(const part of parts) { png.set(part,offset); offset+=part.length; }
  return png;
}
