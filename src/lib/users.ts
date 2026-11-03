import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import * as store from './file-store.cjs';

export interface User {
  id: string; username: string; passwordHash: string; role: 'admin'|'teacher'; createdAt: string;
  mustChangePassword?: boolean; bootstrapExpiresAt?: number;
}
export async function initUsersFile() { /* No account or schema creation in requests. */ }
export async function getUsers(): Promise<User[]> { return store.users(); }
export async function saveUsers(users: User[]): Promise<void> {
  await store.lock('users', async()=>store.atomic(path.join(store.dataDir(),'users.json'),users));
}
export async function mutateUsers<T>(action: (users: User[])=>Promise<T>): Promise<T> {
  return store.lock('users',async()=>{
    const users = await getUsers();
    const result=await action(users);
    store.atomic(path.join(store.dataDir(),'users.json'),users);
    return result;
  });
}
export async function getUser(username:string):Promise<User|undefined> {
  return (await getUsers()).find(u=>u.username.toLowerCase()===username.toLowerCase());
}
export async function consumeBootstrap(user:User):Promise<boolean> {
  if(user.bootstrapExpiresAt===undefined) return true;
  if(user.bootstrapExpiresAt<=Date.now()||!store.segment(user.id)) return false;
  const fs=await import('node:fs/promises');
  try {const handle=await fs.open(path.join(store.dataDir(),'bootstrap-consumed-'+user.id),'wx',0o600);await handle.close();return true;}
  catch(error){if((error as NodeJS.ErrnoException).code==='EEXIST') return false;throw error;}
}
export async function authenticate(username:string,password:string):Promise<User|null> {
  return store.lock('users',async()=>{
    const user=await getUser(username);
    if(!user || (user.bootstrapExpiresAt!==undefined&&user.bootstrapExpiresAt<=Date.now()) ||
        !await bcrypt.compare(password,user.passwordHash) || !await consumeBootstrap(user)) return null;
    return user;
  });
}
export async function deleteUser(username:string):Promise<void> {
  await mutateUsers(async users=>{
    const index=users.findIndex(u=>u.username.toLowerCase()===username.toLowerCase());
    if(index<0) throw new Error('Benutzer nicht gefunden');
    if(users[index].role==='admin'&&users.filter(u=>u.role==='admin').length===1) throw new Error('Letzter Admin bleibt erhalten');
    users.splice(index,1);
  });
}
export async function updateUserPassword(username:string,password:string):Promise<void> {
  if(!/^\d{6}$/.test(password)) throw new Error('PIN muss 6 Ziffern enthalten');
  await mutateUsers(async users=>{
    const user=users.find(u=>u.username.toLowerCase()===username.toLowerCase());
    if(!user) throw new Error('Benutzer nicht gefunden');
    user.passwordHash=await bcrypt.hash(password,10);user.mustChangePassword=false;delete user.bootstrapExpiresAt;
  });
}
export async function createUser(username:string,password:string,role:'admin'|'teacher'='teacher'):Promise<User> {
  if(typeof username!=='string'||!/^[\p{L}\p{N}_.@-]{3,80}$/u.test(username)||!/^\d{6}$/.test(password)||!['admin','teacher'].includes(role)) throw new Error('Ungültiger Benutzer oder PIN');
  return mutateUsers(async users=>{
    if(users.length>=200)throw new Error('Benutzerplätze belegt');
    if(users.some(u=>u.username.toLowerCase()===username.toLowerCase())) throw new Error('Benutzername existiert bereits');
    const user:User={id:randomUUID(),username,passwordHash:await bcrypt.hash(password,10),role,createdAt:new Date().toISOString()};
    users.push(user);return user;
  });
}
