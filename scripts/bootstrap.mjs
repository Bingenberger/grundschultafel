// Run locally: node scripts/bootstrap.mjs PERSONAL_USERNAME
// Refuses existing installations. Secret is written only to the controlling TTY.
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import bcrypt from 'bcryptjs';

const username = process.argv[2];
if (!username || !/^[\p{L}\p{N}_.@-]{3,80}$/u.test(username)) {
  throw new Error('Specify a personal username (3–80 characters).');
}
const tty = fs.openSync('/dev/tty', 'w');
const directory = path.join(process.cwd(), 'data');
fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
const token = crypto.randomBytes(24).toString('base64url');
const user = { id: crypto.randomUUID(), username, role: 'admin',
  passwordHash: await bcrypt.hash(token, 10), createdAt: new Date().toISOString(),
  mustChangePassword: true, bootstrapExpiresAt: Date.now() + 15 * 60 * 1000 };
const destination = path.join(directory, 'users.json');
const temporary = `${destination}.${crypto.randomUUID()}.tmp`;
fs.writeFileSync(temporary, JSON.stringify([user]), { mode: 0o600, flag: 'wx' });
try { fs.linkSync(temporary, destination); } finally { fs.unlinkSync(temporary); }
fs.writeSync(tty, `Initial login for ${username}; valid for 15 minutes:\n${token}\nChange it immediately after login.\n`);
fs.closeSync(tty);
