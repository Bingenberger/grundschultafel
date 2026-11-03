import * as store from './file-store.cjs';
export const ready=()=>store.ready();
export function publicOrigin() {
  const value=process.env.BASE_URL||'http://localhost:3000';
  const url=new URL(value);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||url.pathname!=='/') throw new Error('BASE_URL requires an HTTP(S) origin');
  return url.origin;
}
export async function boundedBody(request:Request,limit:number):Promise<Uint8Array> {
  const chunks:Uint8Array[]=[];let size=0;
  if(!request.body) return new Uint8Array();
  const reader=request.body.getReader();
  try {
    while(true) {
      const {done,value}=await reader.read();if(done) break;
      size+=value.byteLength;if(size>limit) throw new Error('Body limit');
      chunks.push(value);
    }
  } finally {reader.releaseLock();}
  const result=new Uint8Array(size);let offset=0;
  for(const part of chunks) {result.set(part,offset);offset+=part.byteLength;}
  return result;
}
export async function boundedJson(request:Request,limit=16384) {return JSON.parse(new TextDecoder().decode(await boundedBody(request,limit)));}
