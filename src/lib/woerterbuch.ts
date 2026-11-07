// Connection to the Grundschul-Wörterbuch (gswb) of the school platform. The board fetches
// word lists, pictures and recordings server-side, so pupils' browsers never contact
// another host. Disabled (503) unless WOERTERBUCH_ORIGIN is configured.
import {boundedBody} from './platform';

export const WOERTERBUCH_ORIGIN=(process.env.WOERTERBUCH_ORIGIN||'').trim();

// Query parameters passed on to /api/words (everything else is dropped)
export const WORD_QUERY_KEYS=['kategorie','wortart','silben','silben_min','silben_max','buchstaben','enthaelt','max_laenge','mit_bild','mit_ton','anzahl','zufall'] as const;

export function woerterbuchUrl(pathname:string,params?:URLSearchParams){
  if(!WOERTERBUCH_ORIGIN)throw new Error('Wörterbuch nicht konfiguriert');
  const origin=new URL(WOERTERBUCH_ORIGIN);
  if(!['http:','https:'].includes(origin.protocol)||origin.username||origin.password)throw new Error('Ungültige Wörterbuch-Adresse');
  const url=new URL(pathname,origin.origin);
  if(params)url.search=params.toString();
  return url;
}

export async function fetchWoerterbuch(url:URL,limit:number){
  const res=await fetch(url.toString(),{headers:{'User-Agent':'Grundschultafel/1.0'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(6000)});
  if(!res.ok)throw new Error(`Wörterbuch antwortet mit ${res.status}`);
  return {res,body:await boundedBody(res as any,limit)};
}

// Media paths of the dictionary are served through /api/woerterbuch/media
// No encoded or dotted segments: URL parsing would resolve %2e%2e and .. to other paths
export const MEDIA_PATH=/^\/static\/(images|audio)\/(?!\.)[^/?#%\\]+$/;
export const mediaProxyUrl=(path:string|null|undefined)=>path&&MEDIA_PATH.test(path)?`/api/woerterbuch/media?path=${encodeURIComponent(path)}`:null;
