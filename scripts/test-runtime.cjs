const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'tafel-contract-'));
process.env.TAFEL_DATA_DIR=path.join(temporary,'data');
process.env.TAFEL_ASSET_DIR=path.join(temporary,'assets');
const store=require('../src/lib/file-store.cjs');
const sessions=require('../src/lib/session-store.cjs');
const mobile=require('../src/lib/mobile-store.cjs');
const device=()=>crypto.randomBytes(32).toString('base64url');
const command=(args,ok=true)=>{
 const result=cp.spawnSync(process.execPath,args,{cwd:root,env:process.env,encoding:'utf8'});
 assert.equal(result.status===0,ok,result.stderr);
 return result;
};
let count=0;
async function test(name,fn){await fn();console.log('PASS '+name);count++;}
(async()=>{
 try {
 await test('read does not initialize accounts or schema',async()=>{
  assert.deepEqual(store.users(),[]);assert.equal(store.ready(),false);
  assert.equal(fs.existsSync(store.dataDir()),false);
 });
 await test('explicit migration preserves IDs and notebook bytes, is idempotent and rejects future schema',async()=>{
  store.atomic(path.join(store.dataDir(),'users.json'),[{id:'teacher-1',username:'Teacher',passwordHash:'fixture-hash',role:'teacher'}]);
  store.atomic(path.join(store.dataDir(),'teacher-1','notebook.json'),{fixture:'preserved'});
  const before=fs.readFileSync(path.join(store.dataDir(),'teacher-1','notebook.json'));
  command(['scripts/migrate.mjs']);assert.equal(store.ready(),true);
  command(['scripts/migrate.mjs']);assert.equal(store.users()[0].id,'teacher-1');
  assert.deepEqual(fs.readFileSync(path.join(store.dataDir(),'teacher-1','notebook.json')),before);
  store.atomic(path.join(store.dataDir(),'schema.json'),{version:2});
  command(['scripts/migrate.mjs'],false);assert.equal(store.ready(),false);
  store.atomic(path.join(store.dataDir(),'schema.json'),{version:1});
 });
 await test('migration imports owned assets without overwrite and rejects links',async()=>{
  const source=path.join(temporary,'legacy');fs.mkdirSync(source);
  fs.writeFileSync(path.join(source,'fixture.txt'),'preserved');
  command(['scripts/migrate.mjs','--import-assets',source]);
  command(['scripts/migrate.mjs','--import-assets',source]);
  fs.writeFileSync(path.join(source,'fixture.txt'),'changed');
  command(['scripts/migrate.mjs','--import-assets',source],false);
  assert.equal(fs.readFileSync(path.join(store.assetDir(),'fixture.txt'),'utf8'),'preserved');
  fs.unlinkSync(path.join(source,'fixture.txt'));fs.symlinkSync('/etc/passwd',path.join(source,'link'));
  command(['scripts/migrate.mjs','--import-assets',source],false);
 });
 await test('separate processes serialize full read-modify-write without lost updates',async()=>{
  const program="const s=require('./src/lib/file-store.cjs');s.lock('users',async()=>{const u=s.users();await new Promise(r=>setTimeout(r,30));u.push({id:'worker-'+process.argv[1],username:'worker-'+process.argv[1],passwordHash:'fixture',role:'teacher'});s.atomic(require('node:path').join(s.dataDir(),'users.json'),u)}).catch(()=>process.exitCode=1)";
  await Promise.all(Array.from({length:8},(_,i)=>new Promise((resolve,reject)=>{
   const child=cp.spawn(process.execPath,['-e',program,String(i)],{cwd:root,env:process.env,stdio:'ignore'});
   child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error('Child lock failed')));
  })));
  assert.equal(store.users().length,9);
  assert.equal(fs.statSync(path.join(store.dataDir(),'users.json')).mode&0o777,0o600);
  assert.equal(fs.readdirSync(store.dataDir()).some(x=>x.startsWith('.lock-')),false);
 });
 await test('session device binding, expiry, credential reset, deletion and explicit revocation',async()=>{
  const user=store.users()[0],key=device(),sid=await sessions.issue(user,key);
  assert.equal(sessions.verify(sid,key).id,user.id);
  assert.equal(sessions.verify(sid,device()),null);assert.equal(sessions.verify(sid,''),null);
  const file=path.join(store.dataDir(),'sessions',sessions.digest(sid)+'.json');
  const raw=fs.readFileSync(file,'utf8');assert.equal(raw.includes(sid),false);assert.equal(raw.includes(key),false);
  let rows=store.users();rows[0].passwordHash='changed';store.atomic(path.join(store.dataDir(),'users.json'),rows);
  assert.equal(sessions.verify(sid,key),null);
  const fresh=await sessions.issue(rows[0],key);sessions.revoke(fresh);assert.equal(sessions.verify(fresh,key),null);
  const expiry=await sessions.issue(rows[0],key),expiryfile=path.join(store.dataDir(),'sessions',sessions.digest(expiry)+'.json');
  const metadata=JSON.parse(fs.readFileSync(expiryfile));metadata.expires=0;store.atomic(expiryfile,metadata);assert.equal(sessions.verify(expiry,key),null);
  const deleted=await sessions.issue(rows[0],key);store.atomic(path.join(store.dataDir(),'users.json'),rows.slice(1));assert.equal(sessions.verify(deleted,key),null);
 });
 await test('stale locks of a crashed earlier incarnation are taken over',async()=>{
  // simulate a crash: lock dir left behind with this PID but another incarnation
  const dir=path.join(store.dataDir(),'.lock-users');fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir,'pid'),JSON.stringify({pid:process.pid,instance:'crashed'}));
  await store.lock('users',async()=>{});
  fs.mkdirSync(dir);fs.writeFileSync(path.join(dir,'pid'),String(process.pid)); // legacy format
  await store.lock('users',async()=>{});
  assert.equal(fs.existsSync(dir),false);
 });
 await test('per-user session limit ends the oldest session instead of refusing login',async()=>{
  const user=store.users()[0],key=device();
  const sids=[];for(let i=0;i<12;i++)sids.push(await sessions.issue(user,key));
  assert.equal(sids.filter(sid=>sessions.verify(sid,key)).length,10);
  assert.equal(sessions.verify(sids[11],key).id,user.id);
  fs.writeFileSync(path.join(store.dataDir(),'sessions','0'.repeat(64)+'.json'),'{corrupt');
  assert.ok(await sessions.issue(user,key));
  for(const sid of sids)sessions.revoke(sid);
 });
 await test('mobile tickets reject arbitrary, expired, foreign and repeated use',async()=>{
  const bytes=Buffer.from('89504e470d0a1a0a00000000','hex'),ticket=await mobile.issue('worker-1');
  await assert.rejects(mobile.upload(device(),bytes));
  const url=await mobile.upload(ticket,bytes);assert.match(url,/^\/assets\/uploads\/worker-1\/[a-f0-9-]+\.png$/);
  await assert.rejects(mobile.upload(ticket,bytes));await assert.rejects(mobile.poll(ticket,'worker-2'));
  const file=path.join(store.assetDir(),url.slice('/assets/'.length));assert.equal(fs.statSync(file).mode&0o777,0o600);
  assert.equal(await mobile.poll(ticket,'worker-1'),'data:image/png;base64,'+bytes.toString('base64'));
  assert.equal(fs.existsSync(file),false,'picked-up upload is deleted');
  assert.equal(await mobile.poll(ticket,'worker-1'),null);
  const expired=await mobile.issue('worker-1',Date.now()-16*60*1000);await assert.rejects(mobile.upload(expired,bytes));
  const pending=await mobile.issue('worker-1');await assert.rejects(mobile.upload(pending,Buffer.from('<script>')));await assert.rejects(mobile.upload(pending,Buffer.alloc(5*1024*1024+1)));
 });
 await test('mobile outstanding ticket quota is finite',async()=>{
  for(let i=0;i<20;i++)await mobile.issue('quota-user');
  await assert.rejects(mobile.issue('quota-user'),/slots busy/);
  await assert.rejects(mobile.issue('../invalid'));
 });
 await test('bootstrap refuses account overwrite and headless token disclosure',async()=>{
  command(['scripts/bootstrap.mjs'],false);
  const result=command(['--input-type=module','-e',"import {bootstrap} from './scripts/bootstrap.mjs';try{await bootstrap('fixture-admin');process.exitCode=3}catch{console.log('Existing accounts refused')}"]);
  assert.match(result.stdout,/Existing accounts refused/);
  assert.equal(result.stdout.includes('password'),false);
 });
 console.log('PASS '+count+' file-runtime contracts');
 }finally{fs.rmSync(temporary,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
