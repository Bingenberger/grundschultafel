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
 await test('gallery client speaks JSON-API v1 only, with token, limits and no redirects',async()=>{
  const http=require('node:http');
  const seen=[];
  const item=(id,extra={})=>({id,description:'Ein Apfel',tags:['apfel','obst'],style:'aquarell',width:1200,height:900,
    thumbnail_url:`/media/thumbnails/Apfel_${id}.webp`,display_url:`/media/display/Apfel_${id}.webp`,license:'CC0',...extra});
  const server=http.createServer((req,res)=>{
    seen.push({url:req.url,auth:req.headers.authorization});
    const url=new URL(req.url,'http://x');
    const json=(body,status=200,type='application/json')=>{res.writeHead(status,{'Content-Type':type});res.end(JSON.stringify(body));};
    if(url.pathname==='/api/v1/images'){
      if(url.searchParams.get('q')==='redirect'){res.writeHead(302,{Location:'http://169.254.169.254/'});return res.end();}
      if(url.searchParams.get('q')==='html')return json('<html>',200,'text/html');
      if(url.searchParams.get('q')==='huge'){res.writeHead(200,{'Content-Type':'application/json'});res.write('{"items":["');res.end('x'.repeat(3*1024*1024)+'"]}');return;}
      if(url.searchParams.get('q')==='evil')return json({items:[item(1,{display_url:'/media/display/../../db/gallery.db'}),item(2,{thumbnail_url:'http://evil.example/a.webp'}),item(3)],total:3,total_pages:1});
      return json({items:[item(7)],page:Number(url.searchParams.get('page')),per_page:Number(url.searchParams.get('per_page')),total:61,total_pages:2});
    }
    if(url.pathname==='/api/v1/tags')return json({tags:[{name:'apfel',count:7},{name:42,count:1}]});
    if(url.pathname==='/media/display/Apfel_7.webp'){res.writeHead(200,{'Content-Type':'image/webp'});return res.end(Buffer.from('RIFF0000WEBP'));}
    if(url.pathname==='/media/display/Svg_7.webp'){res.writeHead(200,{'Content-Type':'image/svg+xml'});return res.end('<svg/>');}
    if(url.pathname==='/media/display/Weiter_7.webp'){res.writeHead(301,{Location:'/media/display/Apfel_7.webp'});return res.end();}
    json({error:'no'},404);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const tokenFile=path.join(temporary,'gallery-token');fs.writeFileSync(tokenFile,'t'.repeat(43)+'\n');
  const galleryModule=require.resolve('../src/lib/gallery-client.cjs');
  const load=(env)=>{delete require.cache[galleryModule];Object.assign(process.env,env);const g=require(galleryModule);g.resetForTests();return g;};
  try {
    let gallery=load({GALLERY_ORIGIN:'',GALLERY_TOKEN_FILE:''});
    assert.equal(gallery.enabled(),false);
    await assert.rejects(gallery.search({q:'apfel'}),/unavailable/);
    gallery=load({GALLERY_ORIGIN:'http://127.0.0.1:'+server.address().port,GALLERY_TOKEN_FILE:tokenFile});
    assert.equal(gallery.enabled(),true);
    const result=await gallery.search({q:' apfel ',tags:['obst','','x'.repeat(80)],page:2,perPage:500});
    assert.equal(seen.at(-1).url,'/api/v1/images?q=apfel&tags=obst%2C'+'x'.repeat(50)+'&page=2&per_page=60');
    assert.equal(seen.at(-1).auth,'Bearer '+'t'.repeat(43));
    assert.deepEqual(result,{items:[{id:7,description:'Ein Apfel',tags:['apfel','obst'],style:'aquarell',width:1200,height:900,license:'CC0',
      thumbnailUrl:'/api/gallery/image?path=%2Fmedia%2Fthumbnails%2FApfel_7.webp',displayUrl:'/api/gallery/image?path=%2Fmedia%2Fdisplay%2FApfel_7.webp'}],
      total:61,page:2,pageSize:60,totalPages:2});
    assert.deepEqual((await gallery.search({q:'evil'})).items.map(i=>i.id),[3]);
    await assert.rejects(gallery.search({q:'redirect'}));
    await assert.rejects(gallery.search({q:'html'}),/JSON/);
    await assert.rejects(gallery.search({q:'huge'}),/too large/);
    assert.deepEqual(await gallery.tags('ap'),[{name:'apfel',count:7}]);
    const picture=await gallery.image('/media/display/Apfel_7.webp');
    assert.equal(picture.type,'image/webp');assert.equal(Buffer.from(picture.body).toString(),'RIFF0000WEBP');
    for(const bad of ['/static/display/Apfel_7.webp','/media/display/../x.webp','/media/uploads/Apfel_7.png','/media/display/a.svg',
      'http://evil.example/media/display/a.webp','//evil.example/media/display/a.webp','/media/display/%2e%2e.webp',''])
      await assert.rejects(gallery.image(bad),e=>e.status===400,bad);
    await assert.rejects(gallery.image('/media/display/Svg_7.webp'),e=>e.status===415);
    await assert.rejects(gallery.image('/media/display/Weiter_7.webp'));
    await assert.rejects(gallery.image('/media/display/Fehlt_7.webp'),e=>e.status===404);
    gallery=load({GALLERY_ORIGIN:'http://127.0.0.1:'+server.address().port,GALLERY_TOKEN_FILE:''});
    await gallery.search({});assert.equal(seen.at(-1).auth,undefined);
    gallery=load({GALLERY_ORIGIN:'http://user:pw@127.0.0.1:1/',GALLERY_TOKEN_FILE:''});
    assert.equal(gallery.enabled(),false);
  } finally {server.close();delete process.env.GALLERY_ORIGIN;delete process.env.GALLERY_TOKEN_FILE;}
 });
 console.log('PASS '+count+' file-runtime contracts');
 }finally{fs.rmSync(temporary,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
