import { NextResponse } from 'next/server';
import { getUsers } from '@/lib/users';

export async function GET() {
  const users = await getUsers();
  const publicUsers = users
    .map(u => ({ username: u.username, role: u.role }))
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === 'teacher' ? -1 : 1;
      return a.username.localeCompare(b.username);
    });
  return NextResponse.json({ users: publicUsers });
}
