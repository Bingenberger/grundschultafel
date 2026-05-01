import { NextResponse } from 'next/server';
import { clearSession } from '@/lib/session';

export async function POST() {
  try {
    await clearSession();
    return NextResponse.json({ success: true, redirect: '/login' });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Fehler beim Abmelden' }, { status: 500 });
  }
}
