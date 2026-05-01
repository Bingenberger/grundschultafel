import { NextRequest, NextResponse } from 'next/server';
import { createUser } from '@/lib/users';

export async function POST(request: NextRequest) {
  try {
    const { username, password, role } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Benutzername und Passwort sind erforderlich' }, { status: 400 });
    }

    const newUser = await createUser(username, password, role || 'teacher');

    return NextResponse.json({ 
      success: true, 
      user: { id: newUser.id, username: newUser.username, role: newUser.role } 
    });

  } catch (error: any) {
    console.error('Admin create user error:', error);
    return NextResponse.json({ error: error.message || 'Fehler beim Erstellen des Nutzers' }, { status: 500 });
  }
}
