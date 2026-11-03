import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
process.umask(0o077);
const directory=path.resolve('.private');
fs.mkdirSync(directory,{mode:0o700});
fs.writeFileSync(path.join(directory,'session-key'),crypto.randomBytes(48).toString('base64url'),{mode:0o444,flag:'wx'});
console.log('Private key file created. Set TAFEL_SECRET_FILE to its absolute path.');
