export const dynamic='force-dynamic';
import {NextRequest,NextResponse} from 'next/server';
import {getSession} from '@/lib/session';
import {WOERTERBUCH_ORIGIN,WORD_QUERY_KEYS,woerterbuchUrl,fetchWoerterbuch,mediaProxyUrl} from '@/lib/woerterbuch';

interface DictWord {lemma:string;syllables:string[];part_of_speech:string;spelling_categories:string[];image:string|null;audio:string|null}

// Word list from the dictionary, e.g. /api/woerterbuch/words?kategorie=Mitsprechwort&silben=2
export async function GET(request:NextRequest){
  const session=await getSession();
  if(!session)return NextResponse.json({error:'Unauthorized'},{status:401});
  if(!WOERTERBUCH_ORIGIN)return NextResponse.json({error:'Wörterbuch nicht angebunden'},{status:503});
  try {
    const params=new URLSearchParams();
    for(const key of WORD_QUERY_KEYS)for(const value of request.nextUrl.searchParams.getAll(key))params.append(key,value.slice(0,80));
    const {body}=await fetchWoerterbuch(woerterbuchUrl('/api/words',params),4*1024*1024);
    const data=JSON.parse(new TextDecoder().decode(body)) as {total:number;words:DictWord[]};
    const words=(Array.isArray(data.words)?data.words:[]).filter(w=>typeof w?.lemma==='string').map(w=>({
      text:w.lemma,
      syllables:Array.isArray(w.syllables)&&w.syllables.length?w.syllables.filter(s=>typeof s==='string'):[w.lemma],
      partOfSpeech:w.part_of_speech,
      categories:Array.isArray(w.spelling_categories)?w.spelling_categories:[],
      image:mediaProxyUrl(w.image),
      audio:mediaProxyUrl(w.audio),
    }));
    return NextResponse.json({total:Number(data.total)||words.length,words});
  }catch{
    return NextResponse.json({error:'Wörterbuch derzeit nicht erreichbar'},{status:502});
  }
}
