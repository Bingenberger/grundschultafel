import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import store from '../src/lib/file-store.cjs';
export async function bootstrap(username) {
  if(!/^[\p{L}\p{N}_.@-]{3,80}$/u.test(username)||!store.ready())throw new Error('Personal name and migrated store required');
  return store.lock('users',async()=>{
    if(store.users().length)throw new Error('Existing users cannot be replaced');
    const token=crypto.randomBytes(24).toString('base64url');
    const user={id:crypto.randomUUID(),username,role:'admin',passwordHash:await bcrypt.hash(token,10),
      createdAt:new Date().toISOString(),mustChangePassword:true,bootstrapExpiresAt:Date.now()+900000};
    store.atomic(path.join(store.dataDir(),'users.json'),[user]);
    return token;
  });
}
if(process.argv[1]===new URL(import.meta.url).pathname) {
  try{
    const tty=fs.openSync('/dev/tty','w');
    const token=await bootstrap(process.argv[2]);
    fs.writeSync(tty,'Einmaliger Erstzugang, 15 Minuten gültig:\n'+token+'\nDanach persönliche PIN setzen.\n');fs.closeSync(tty);
  }catch{process.exitCode=1;console.error('Lokaler Erstzugang fehlgeschlagen; Terminal, Migration und vorhandene Konten prüfen.');}
}
