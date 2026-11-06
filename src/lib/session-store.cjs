const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const store=require('./file-store.cjs');
const digest=v=>crypto.createHash('sha256').update(v).digest('hex');
const valid=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{43}$/.test(v);
const filename=sid=>path.join(store.dataDir(),'sessions',digest(sid)+'.json');
const version=user=>digest(user.passwordHash);
async function issue(user,device) {
  if(!valid(device)) throw new Error('Invalid device cookie');
  return store.lock('sessions',async()=>{
    const directory=path.join(store.dataDir(),'sessions');
    fs.mkdirSync(directory,{recursive:true,mode:0o700});
    const files=fs.readdirSync(directory).filter(f=>/^[a-f0-9]{64}\.json$/.test(f));
    let live=0;
    const mine=[];
    for(const file of files) {
      const target=path.join(directory,file);
      let row;
      try {row=JSON.parse(fs.readFileSync(target,'utf8'));} catch {row=null;}
      // expired or unreadable records are dead weight; one corrupt file must not block logins
      if(!row||!(row.expires>Date.now())) {fs.unlinkSync(target);continue;}
      live++;
      if(row.id===user.id) mine.push({target,expires:row.expires});
    }
    if(live>=4000) throw new Error('Session slots busy');
    // Closed browsers keep their session until expiry; instead of locking the teacher out,
    // the oldest of their sessions ends when the per-user limit is reached.
    mine.sort((a,b)=>a.expires-b.expires);
    while(mine.length>=10) fs.unlinkSync(mine.shift().target);
    const sid=crypto.randomBytes(32).toString('base64url');
    store.atomic(filename(sid),{id:user.id,deviceHash:digest(device),version:version(user),expires:Date.now()+8*60*60*1000});
    return sid;
  });
}
function verify(sid,device) {
  if(!valid(sid)||!valid(device)) return null;
  try {
    const row=JSON.parse(fs.readFileSync(filename(sid),'utf8'));
    if(row.expires<=Date.now()||row.deviceHash!==digest(device)) return null;
    const user=store.users().find(u=>u.id===row.id);
    if(!user||row.version!==version(user)) return null;
    if(user.bootstrapExpiresAt!==undefined&&user.bootstrapExpiresAt<=Date.now()) return null;
    return user;
  } catch {return null;}
}
function revoke(sid) {if(valid(sid)) try {fs.unlinkSync(filename(sid));} catch(error) {if(error.code!=='ENOENT')throw error;}}
module.exports={issue,verify,revoke,digest,valid};
