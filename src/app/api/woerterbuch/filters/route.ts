export const dynamic='force-dynamic';
import {NextResponse} from 'next/server';
import {getSession} from '@/lib/session';
import {WOERTERBUCH_ORIGIN,woerterbuchUrl,fetchWoerterbuch} from '@/lib/woerterbuch';

// Spelling categories and parts of speech of the dictionary (for the filter menus)
export async function GET(){
  const session=await getSession();
  if(!session)return NextResponse.json({error:'Unauthorized'},{status:401});
  if(!WOERTERBUCH_ORIGIN)return NextResponse.json({error:'Wörterbuch nicht angebunden'},{status:503});
  try {
    const {body}=await fetchWoerterbuch(woerterbuchUrl('/api/word-filters'),256*1024);
    const data=JSON.parse(new TextDecoder().decode(body));
    return NextResponse.json({
      categories:Array.isArray(data.categories)?data.categories:[],
      partsOfSpeech:Array.isArray(data.parts_of_speech)?data.parts_of_speech:[],
    });
  }catch{
    return NextResponse.json({error:'Wörterbuch derzeit nicht erreichbar'},{status:502});
  }
}
