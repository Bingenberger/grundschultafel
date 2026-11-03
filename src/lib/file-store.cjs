// Shared local file primitives for the server and console jobs.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
process.umask(0o077);
const dataDir = () => path.resolve(process.env.TAFEL_DATA_DIR || path.join(process.cwd(), 'data'));
const assetDir = () => path.resolve(process.env.TAFEL_ASSET_DIR || path.join(dataDir(), 'assets'));
const segment = value => typeof value === 'string' && /^[\p{L}\p{N}][\p{L}\p{N}_. -]{0,127}$/u.test(value);
function atomic(file, value) {
  fs.mkdirSync(path.dirname(file), {recursive:true,mode:0o700});
  const temporary = file + '.' + crypto.randomUUID() + '.tmp';
  const fd = fs.openSync(temporary, 'wx', 0o600);
  try { fs.writeFileSync(fd, typeof value === 'string' ? value : JSON.stringify(value)); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  try { fs.renameSync(temporary,file); const dir = fs.openSync(path.dirname(file),'r'); try {fs.fsyncSync(dir);} finally {fs.closeSync(dir);} }
  finally {if (fs.existsSync(temporary)) fs.unlinkSync(temporary);}
}
async function lock(name, action) {
  if (!/^[a-zA-Z0-9-]+$/.test(name)) throw new Error('Invalid operation lock');
  fs.mkdirSync(dataDir(),{recursive:true,mode:0o700});
  const dir = path.join(dataDir(),'.lock-'+name);
  const deadline = Date.now()+5000;
  while (true) {
    try {
      fs.mkdirSync(dir,{mode:0o700});
      fs.writeFileSync(path.join(dir,'pid'),String(process.pid),{mode:0o600,flag:'wx'});
      break;
    } catch(error) {
      if (error.code !== 'EEXIST') throw error;
      try {
        const owner = Number(fs.readFileSync(path.join(dir,'pid'),'utf8'));
        let alive = true;
        try {process.kill(owner,0);} catch(e) {if(e.code === 'ESRCH') alive=false;}
        if (!alive) {fs.unlinkSync(path.join(dir,'pid'));fs.rmdirSync(dir);continue;}
      } catch(e) {
        if (e.code === 'ENOENT' && fs.existsSync(dir) && Date.now()-fs.statSync(dir).mtimeMs>2000) {
          try {fs.rmdirSync(dir);} catch {}
        }
      }
      if (Date.now()>deadline) throw new Error('Store busy');
      await new Promise(resolve=>setTimeout(resolve,10));
    }
  }
  try {return await action();}
  finally {fs.unlinkSync(path.join(dir,'pid'));fs.rmdirSync(dir);}
}
function users() {
  try {
    if(fs.statSync(path.join(dataDir(),'users.json')).size>4*1024*1024)throw new Error('User store limit');
    const rows = JSON.parse(fs.readFileSync(path.join(dataDir(),'users.json'),'utf8'));
    if (!Array.isArray(rows) || rows.some(u=>!segment(u.id)||typeof u.username!=='string'||typeof u.passwordHash!=='string'||!['admin','teacher'].includes(u.role))) throw new Error('Invalid user store');
    if(new Set(rows.map(u=>u.id)).size!==rows.length||new Set(rows.map(u=>u.username.toLowerCase())).size!==rows.length)throw new Error('Duplicate identity');
    return rows;
  } catch(error) {if(error.code==='ENOENT') return [];throw error;}
}
function ready() {
  try {return JSON.parse(fs.readFileSync(path.join(dataDir(),'schema.json'),'utf8')).version===1 && Array.isArray(users());}
  catch {return false;}
}
module.exports = {dataDir,assetDir,segment,atomic,lock,users,ready};
