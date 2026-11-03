export const dynamic='force-dynamic';
import {NextResponse} from 'next/server';
import {createUser,deleteUser,getUsers,updateUserPassword} from '@/lib/users';
import {getSession} from '@/lib/session';
import {boundedJson} from '@/lib/platform';
async function allowed(){return (await getSession())?.role==='admin';}
const denied=()=>NextResponse.json({error:'Forbidden'},{status:403});
export async function GET(){
  if(!await allowed())return denied();
  return NextResponse.json((await getUsers()).map(u=>({id:u.id,username:u.username,role:u.role,createdAt:u.createdAt})));
}
export async function POST(request:Request){
  if(!await allowed())return denied();
  try{
    const {username,password,role}=await boundedJson(request);
    const user=await createUser(username,password,role||'teacher');
    return NextResponse.json({success:true,user:{id:user.id,username:user.username,role:user.role}});
  }catch{return NextResponse.json({error:'Benutzer konnte nicht angelegt werden'},{status:400});}
}
export async function PATCH(request:Request){
  if(!await allowed())return denied();
  try{
    const {username,newPassword}=await boundedJson(request);
    await updateUserPassword(username,newPassword);
    return NextResponse.json({success:true});
  }catch{return NextResponse.json({error:'PIN konnte nicht geändert werden'},{status:400});}
}
export async function DELETE(request:Request){
  const session=await getSession();
  if(session?.role!=='admin')return denied();
  try{
    const {username}=await boundedJson(request);
    if(typeof username!=='string'||username.toLowerCase()===session.username.toLowerCase())return NextResponse.json({error:'Eigenes Konto bleibt erhalten'},{status:400});
    await deleteUser(username);return NextResponse.json({success:true});
  }catch{return NextResponse.json({error:'Konto konnte nicht entfernt werden'},{status:400});}
}
