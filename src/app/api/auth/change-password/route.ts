import {NextResponse} from 'next/server';
import {getSession,createSession} from '@/lib/session';
import {mutateUsers} from '@/lib/users';
import {boundedJson} from '@/lib/platform';
import bcrypt from 'bcryptjs';
export async function POST(request:Request) {
  const session=await getSession();
  if(!session) return NextResponse.json({error:'Unauthorized'},{status:401});
  try {
    const {currentPassword,newPassword}=await boundedJson(request);
    if(typeof currentPassword!=='string'||typeof newPassword!=='string'||!/^\d{6}$/.test(newPassword)) return NextResponse.json({error:'Neue PIN muss 6 Ziffern enthalten'},{status:400});
    const changed=await mutateUsers(async users=>{
      const user=users.find(u=>u.id===session.id);
      if(!user||(user.bootstrapExpiresAt!==undefined&&user.bootstrapExpiresAt<=Date.now())||!await bcrypt.compare(currentPassword,user.passwordHash)) throw new Error('Credential mismatch');
      user.passwordHash=await bcrypt.hash(newPassword,10);user.mustChangePassword=false;delete user.bootstrapExpiresAt;
      return user;
    });
    await createSession({...session,mustChangePassword:false},changed.passwordHash);
    return NextResponse.json({success:true});
  } catch {return NextResponse.json({error:'PIN-Wechsel fehlgeschlagen'},{status:400});}
}
