import { promises as fs } from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: 'admin' | 'teacher';
  createdAt: string;
  mustChangePassword?: boolean;
  bootstrapExpiresAt?: number;
}

// Initial administrators are provisioned exclusively through the local CLI.
export async function initUsersFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  // Do not create an account in response to an unauthenticated HTTP request.
}

export async function getUsers(): Promise<User[]> {
  await initUsersFile();
  try {
    const data = await fs.readFile(USERS_FILE, 'utf-8');
    return JSON.parse(data) as User[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

export async function saveUsers(users: User[]): Promise<void> {
  await initUsersFile();
  const temporary = `${USERS_FILE}.${randomUUID()}.tmp`;
  const handle = await fs.open(temporary, 'wx', 0o600);
  try {
    await handle.writeFile(JSON.stringify(users, null, 2), 'utf-8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rename(temporary, USERS_FILE);
}

export async function getUser(username: string): Promise<User | undefined> {
  const users = await getUsers();
  // case insensitive username check
  return users.find(u => u.username.toLowerCase() === username.toLowerCase());
}

export async function consumeBootstrap(user: User): Promise<boolean> {
  if (user.bootstrapExpiresAt === undefined) return true;
  if (user.bootstrapExpiresAt <= Date.now()) return false;
  if (!/^[a-zA-Z0-9-]+$/.test(user.id)) return false;
  try {
    const handle = await fs.open(path.join(DATA_DIR, `bootstrap-consumed-${user.id}`), 'wx', 0o600);
    await handle.close();
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw error;
  }
}

export async function deleteUser(username: string): Promise<void> {
  const users = await getUsers();
  const filtered = users.filter(u => u.username.toLowerCase() !== username.toLowerCase());
  if (filtered.length === users.length) throw new Error('Benutzer nicht gefunden');
  await saveUsers(filtered);
}

export async function updateUserPassword(username: string, newPasswordPlain: string): Promise<void> {
  const users = await getUsers();
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) throw new Error('Benutzer nicht gefunden');
  user.passwordHash = await bcrypt.hash(newPasswordPlain, 10);
  user.mustChangePassword = false;
  delete user.bootstrapExpiresAt;
  await saveUsers(users);
}

export async function createUser(username: string, passwordPlain: string, role: 'admin' | 'teacher' = 'teacher'): Promise<User> {
  const users = await getUsers();
  if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    throw new Error('Benutzername existiert bereits');
  }

  const hash = await bcrypt.hash(passwordPlain, 10);
  const newUser: User = {
    id: crypto.randomUUID(),
    username,
    passwordHash: hash,
    role,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  await saveUsers(users);
  
  // Create a separate directory for the user's notebooks
  const userDir = path.join(DATA_DIR, newUser.id);
  await fs.mkdir(userDir, { recursive: true });

  return newUser;
}
