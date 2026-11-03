import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
import * as records from './session-store.cjs';
import { getUsers } from './users';

function getKey():Uint8Array {
  const value=process.env.SESSION_SECRET;
  if(!value||value.length<32) throw new Error('Private SESSION_SECRET required');
  return new TextEncoder().encode(value);
}
export interface SessionPayload {id:string;username:string;role:'admin'|'teacher';mustChangePassword?:boolean;sid?:string}
export async function encrypt(payload:SessionPayload) {
  return new SignJWT(payload as any).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('8h').sign(getKey());
}
export async function decrypt(input:string):Promise<SessionPayload|null> {
  try {
    const {payload}=await jwtVerify(input,getKey(),{algorithms:['HS256']});
    if(!records.valid(payload.sid)) return null;
    return payload as unknown as SessionPayload;
  } catch {return null;}
}
export async function sessionFor(token:string|undefined,device:string|undefined):Promise<SessionPayload|null> {
  if(!token||!device) return null;
  const claims=await decrypt(token);
  if(!claims) return null;
  const user=records.verify(claims.sid,device);
  if(!user||user.id!==claims.id) return null;
  return {id:user.id,username:user.username,role:user.role,mustChangePassword:user.mustChangePassword??false};
}
export async function getSession() {
  const jar=await cookies();
  return sessionFor(jar.get('session')?.value,jar.get('tafel_device')?.value);
}
export async function createSession(payload:SessionPayload,credentialHash?:string) {
  const user=(await getUsers()).find(u=>u.id===payload.id);
  if(!user || (credentialHash && credentialHash!==user.passwordHash)) throw new Error('Credential changed');
  const jar=await cookies();
  const previous=await decrypt(jar.get('session')?.value||'');
  if(previous?.sid) records.revoke(previous.sid);
  const device=randomBytes(32).toString('base64url');
  const sid=await records.issue(user,device);
  const options={httpOnly:true,secure:(process.env.BASE_URL||'').startsWith('https://'),sameSite:'strict' as const,path:'/',maxAge:8*60*60};
  jar.set('tafel_device',device,options);
  jar.set('session',await encrypt({...payload,sid}),options);
}
export async function clearSession() {
  const jar=await cookies();
  const claims=await decrypt(jar.get('session')?.value||'');
  if(claims?.sid) records.revoke(claims.sid);
  jar.delete('session');jar.delete('tafel_device');
}
