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
// --- Known devices -----------------------------------------------------------------
// After a successful login the browser keeps a signed, long-lived cookie naming the
// accounts that have logged in on it. Login failures from such a device are counted
// separately, so strangers guessing PINs for a (publicly listed) name cannot lock the
// teacher out of their own board. Shared classroom boards can remember several accounts.
const KNOWN_DEVICE_COOKIE='tafel_known';
const KNOWN_DEVICE_MAX_USERS=50;
export interface KnownDevice {nonce:string;users:string[]}
export async function knownDevice():Promise<KnownDevice|null> {
  try {
    const jar=await cookies();
    const value=jar.get(KNOWN_DEVICE_COOKIE)?.value;
    if(!value) return null;
    const {payload}=await jwtVerify(value,getKey(),{algorithms:['HS256']});
    if(payload.typ!=='known-device'||typeof payload.nonce!=='string'||!Array.isArray(payload.users)) return null;
    return {nonce:payload.nonce,users:payload.users.filter((u):u is string=>typeof u==='string')};
  } catch {return null;}
}
export async function rememberDevice(userId:string) {
  const current=await knownDevice();
  const users=[userId,...(current?.users??[]).filter(u=>u!==userId)].slice(0,KNOWN_DEVICE_MAX_USERS);
  const nonce=current?.nonce??randomBytes(16).toString('base64url');
  const token=await new SignJWT({typ:'known-device',nonce,users}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('365d').sign(getKey());
  const jar=await cookies();
  jar.set(KNOWN_DEVICE_COOKIE,token,{httpOnly:true,secure:(process.env.BASE_URL||'').startsWith('https://'),sameSite:'strict',path:'/',maxAge:365*24*60*60});
}
export async function clearSession() {
  const jar=await cookies();
  const claims=await decrypt(jar.get('session')?.value||'');
  if(claims?.sid) records.revoke(claims.sid);
  jar.delete('session');jar.delete('tafel_device');
}
