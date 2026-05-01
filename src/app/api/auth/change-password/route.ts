import { NextRequest, NextResponse } from 'next/server';
import { getSession, createSession } from '@/lib/session';
import { getUsers, saveUsers } from '@/lib/users';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  }

  const { currentPassword, newPassword } = await request.json();

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Aktuelle und neue PIN sind erforderlich' }, { status: 400 });
  }

  if (!/^\d{6}$/.test(newPassword)) {
    return NextResponse.json({ error: 'Die neue PIN muss genau 6 Ziffern enthalten' }, { status: 400 });
  }

  const users = await getUsers();
  const userIndex = users.findIndex(u => u.id === session.id);
  if (userIndex === -1) {
    return NextResponse.json({ error: 'Benutzer nicht gefunden' }, { status: 404 });
  }

  const user = users[userIndex];
  const currentMatches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!currentMatches) {
    return NextResponse.json({ error: 'Aktuelle PIN ist falsch' }, { status: 401 });
  }

  users[userIndex] = {
    ...user,
    passwordHash: await bcrypt.hash(newPassword, 10),
    mustChangePassword: false,
  };
  await saveUsers(users);

  await createSession({
    id: session.id,
    username: session.username,
    role: session.role,
    mustChangePassword: false,
  });

  return NextResponse.json({ success: true });
}
