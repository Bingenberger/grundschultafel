import {NextResponse} from 'next/server';
import {getSession} from '@/lib/session';
import {publicOrigin} from '@/lib/platform';
import * as mobile from '@/lib/mobile-store.cjs';
export async function POST() {
  const session=await getSession();
  if(!session) return NextResponse.json({error:'Unauthorized'},{status:401});
  try {
    const token=await mobile.issue(session.id);
    return NextResponse.json({token,url:publicOrigin()+'/upload?token='+token,expiresIn:900});
  } catch {return NextResponse.json({error:'Upload derzeit belegt'},{status:429});}
}
