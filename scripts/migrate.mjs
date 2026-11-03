// Explicit local file-schema job, optionally importing an owned legacy asset tree.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import store from '../src/lib/file-store.cjs';
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function copy(source,target){
  const stat=fs.lstatSync(source);
  if(stat.isSymbolicLink()||(!stat.isDirectory()&&!stat.isFile()))throw new Error('Only regular owned files/directories may be imported');
  if(stat.isDirectory()){
    fs.mkdirSync(target,{recursive:true,mode:0o700});
    for(const name of fs.readdirSync(source))copy(path.join(source,name),path.join(target,name));
  }else{
    if(fs.existsSync(target)){if(hash(source)!==hash(target))throw new Error('Existing asset differs; refusing replacement');return;}
    const descriptor=fs.openSync(target,'wx',0o600);
    try{fs.writeFileSync(descriptor,fs.readFileSync(source));fs.fsyncSync(descriptor);}finally{fs.closeSync(descriptor);}
  }
}
await store.lock('migration',async()=>{
  const metadata=path.join(store.dataDir(),'schema.json');
  if(fs.existsSync(metadata)&&JSON.parse(fs.readFileSync(metadata,'utf8')).version!==1)throw new Error('Unsupported file schema');
  store.users();
  fs.mkdirSync(store.assetDir(),{recursive:true,mode:0o700});
  const index=process.argv.indexOf('--import-assets');
  if(index!==-1){
    const source=process.argv[index+1];if(!source)throw new Error('Explicit legacy asset path required');
    copy(path.resolve(source),store.assetDir());
  }
  for(const name of ['backgrounds','journal','rs','gallery','uploads'])fs.mkdirSync(path.join(store.assetDir(),name),{recursive:true,mode:0o700});
  fs.mkdirSync(path.join(store.dataDir(),'sessions'),{recursive:true,mode:0o700});
  if(!fs.existsSync(metadata))store.atomic(metadata,{version:1});
});
console.log('File schema verified; existing accounts and identifiers preserved.');
