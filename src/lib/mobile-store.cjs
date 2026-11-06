const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const store=require('./file-store.cjs');
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
const valid=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{43}$/.test(x);
const folder=()=>path.join(store.dataDir(),'mobile-tickets');
const file=token=>path.join(folder(),digest(token)+'.json');
const read=token=>JSON.parse(fs.readFileSync(file(token),'utf8'));
async function issue(owner,now=Date.now()) {
  if(!store.segment(owner)) throw new Error('Invalid owner');
  return store.lock('mobile',async()=>{
    fs.mkdirSync(folder(),{recursive:true,mode:0o700});
    let total=0,mine=0;
    for(const name of fs.readdirSync(folder())) {
      if(!/^[a-f0-9]{64}\.json$/.test(name)) continue;
      const target=path.join(folder(),name);
      const row=JSON.parse(fs.readFileSync(target,'utf8'));
      if(row.expires<=now) {fs.unlinkSync(target);continue;}
      if(row.state!=='consumed') {total++;if(row.owner===owner)mine++;}
    }
    if(total>=2000||mine>=20) throw new Error('Upload slots busy');
    const token=crypto.randomBytes(32).toString('base64url');
    store.atomic(file(token),{owner,expires:now+15*60*1000,state:'waiting'});
    return token;
  });
}
function format(bytes) {
  if(bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))) return {ext:'png',mime:'image/png'};
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255) return {ext:'jpg',mime:'image/jpeg'};
  if(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP') return {ext:'webp',mime:'image/webp'};
  throw new Error('Unsupported image');
}
async function upload(token,bytes,now=Date.now()) {
  if(!valid(token)||!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>5*1024*1024) throw new Error('Invalid upload');
  const type=format(bytes);
  return store.lock('mobile',async()=>{
    const row=read(token);
    if(row.expires<=now||row.state!=='waiting') throw new Error('Upload ticket expired or used');
    const directory=path.join(store.assetDir(),'uploads',row.owner);
    fs.mkdirSync(directory,{recursive:true,mode:0o700});
    // Uploads are only a hand-over to the board (tickets live 15 minutes); anything older
    // than a day was never picked up and only blocks the quota.
    for(const name of fs.readdirSync(directory)){
      const target=path.join(directory,name);
      if(now-fs.statSync(target).mtimeMs>24*60*60*1000)fs.unlinkSync(target);
    }
    const existing=fs.readdirSync(directory);
    const size=existing.reduce((n,name)=>n+fs.statSync(path.join(directory,name)).size,0);
    if(existing.length>=200||size+bytes.length>100*1024*1024) throw new Error('Upload storage busy');
    const name=crypto.randomUUID()+'.'+type.ext;
    fs.writeFileSync(path.join(directory,name),bytes,{mode:0o600,flag:'wx'});
    row.name=name;row.mime=type.mime;row.state='available';
    store.atomic(file(token),row);
    return '/assets/uploads/'+row.owner+'/'+name;
  });
}
async function poll(token,owner,now=Date.now()) {
  if(!valid(token)) throw new Error('Invalid upload ticket');
  return store.lock('mobile',async()=>{
    const row=read(token);
    if(row.owner!==owner||row.expires<=now) throw new Error('Upload ticket unavailable');
    if(row.state!=='available') return null;
    const upload=path.join(store.assetDir(),'uploads',owner,row.name);
    const bytes=fs.readFileSync(upload);
    row.state='consumed';store.atomic(file(token),row);
    // The board stores the image inline as a data URL; the file is no longer needed
    fs.unlinkSync(upload);
    return 'data:'+row.mime+';base64,'+bytes.toString('base64');
  });
}
module.exports={issue,upload,poll,format,valid};
