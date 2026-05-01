import { promises as fs } from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: 'admin' | 'teacher';
  createdAt: string;
  mustChangePassword?: boolean;
}

// Ensure the data directory and users.json exist, and seed the default admin if empty
export async function initUsersFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(USERS_FILE);
  } catch {
    // If it doesn't exist, create it with a default admin
    const defaultAdminPassword = await bcrypt.hash('123456', 10);
    const initialAdmin: User = {
      id: 'admin',
      username: 'admin',
      passwordHash: defaultAdminPassword,
      role: 'admin',
      createdAt: new Date().toISOString(),
      mustChangePassword: true,
    };
    await fs.writeFile(USERS_FILE, JSON.stringify([initialAdmin], null, 2), 'utf-8');
    console.log('Created default admin (admin / 123456). Please change the password later!');
  }
}

export async function getUsers(): Promise<User[]> {
  await initUsersFile();
  try {
    const data = await fs.readFile(USERS_FILE, 'utf-8');
    return JSON.parse(data) as User[];
  } catch (error) {
    console.error('Error reading users.json', error);
    return [];
  }
}

export async function saveUsers(users: User[]): Promise<void> {
  await initUsersFile();
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

export async function getUser(username: string): Promise<User | undefined> {
  const users = await getUsers();
  // case insensitive username check
  return users.find(u => u.username.toLowerCase() === username.toLowerCase());
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
