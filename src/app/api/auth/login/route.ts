import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/users';
import { createSession } from '@/lib/session';
import bcrypt from 'bcryptjs';

interface AttemptRecord {
  count: number;
  firstAttempt: number;
  lockedUntil: number;
}

const loginAttempts = new Map<string, AttemptRecord>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record) return { allowed: true };
  if (record.lockedUntil > now) {
    return { allowed: false, retryAfterSeconds: Math.ceil((record.lockedUntil - now) / 1000) };
  }
  if (now - record.firstAttempt > WINDOW_MS) {
    loginAttempts.delete(ip);
    return { allowed: true };
  }
  return { allowed: true };
}

function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now - record.firstAttempt > WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now, lockedUntil: 0 });
    return;
  }
  const newCount = record.count + 1;
  loginAttempts.set(ip, {
    ...record,
    count: newCount,
    lockedUntil: newCount >= MAX_ATTEMPTS ? now + LOCKOUT_MS : 0,
  });
}

function clearAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

export async function POST(request: NextRequest) {
  const ip = getIp(request);

  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    const minutes = Math.ceil(rateCheck.retryAfterSeconds! / 60);
    return NextResponse.json(
      { error: `Zu viele Versuche. Bitte in ${minutes} Minute(n) erneut versuchen.` },
      { status: 429 }
    );
  }

  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Benutzername und Passwort sind erforderlich' }, { status: 400 });
    }

    const user = await getUser(username);

    if (!user) {
      recordFailedAttempt(ip);
      return NextResponse.json({ error: 'Ungültige Anmeldedaten' }, { status: 401 });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      recordFailedAttempt(ip);
      return NextResponse.json({ error: 'Ungültige Anmeldedaten' }, { status: 401 });
    }

    clearAttempts(ip);

    await createSession({
      id: user.id,
      username: user.username,
      role: user.role,
      mustChangePassword: user.mustChangePassword ?? false,
    });

    const redirect = user.mustChangePassword ? '/change-password' : '/';
    return NextResponse.json({ success: true, redirect });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Ein Fehler ist aufgetreten' }, { status: 500 });
  }
}
