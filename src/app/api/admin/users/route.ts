import { NextRequest, NextResponse } from 'next/server';
import { createUser, deleteUser, getUsers, updateUserPassword } from '@/lib/users';
import { getSession } from '@/lib/session';

export async function GET() {
  const users = await getUsers();
  return NextResponse.json(
    users.map(u => ({ id: u.id, username: u.username, role: u.role, createdAt: u.createdAt }))
  );
}

export async function POST(request: NextRequest) {
  try {
    const { username, password, role } = await request.json();
    if (!username || !password) {
      return NextResponse.json({ error: 'Benutzername und Passwort sind erforderlich' }, { status: 400 });
    }
    const newUser = await createUser(username, password, role || 'teacher');
    return NextResponse.json({ success: true, user: { id: newUser.id, username: newUser.username, role: newUser.role } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Fehler beim Erstellen des Nutzers' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { username, newPassword } = await request.json();
    if (!username || !newPassword) {
      return NextResponse.json({ error: 'Benutzername und neue PIN erforderlich' }, { status: 400 });
    }
    if (newPassword.length !== 6) {
      return NextResponse.json({ error: 'PIN muss 6 Stellen haben' }, { status: 400 });
    }
    await updateUserPassword(username, newPassword);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Fehler beim Ändern der PIN' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { username } = await request.json();
    if (!username) {
      return NextResponse.json({ error: 'Benutzername erforderlich' }, { status: 400 });
    }
    // Prevent deleting the admin account
    if (username.toLowerCase() === 'admin') {
      return NextResponse.json({ error: 'Das Admin-Konto kann nicht gelöscht werden' }, { status: 400 });
    }
    // Prevent deleting the currently logged-in user
    const session = await getSession();
    if (session?.username?.toLowerCase() === username.toLowerCase()) {
      return NextResponse.json({ error: 'Das eigene Konto kann nicht gelöscht werden' }, { status: 400 });
    }
    await deleteUser(username);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Fehler beim Löschen' }, { status: 500 });
  }
}
