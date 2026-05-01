import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession } from './lib/session';

// Define public routes
const publicRoutes = ['/login', '/api/auth/login', '/api/auth/users', '/upload', '/api/mobile-upload'];
const adminRoutes = ['/admin', '/api/admin'];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isPublicRoute = publicRoutes.some(r => path.startsWith(r));
  const isAdminRoute = adminRoutes.some(r => path.startsWith(r));

  // Bypass next internal files and assets
  if (path.startsWith('/_next') || path.startsWith('/favicon.ico')) {
    return NextResponse.next();
  }

  const session = await getSession();

  // Redirect to login if unauthenticated and not on a public route
  if (!session && !isPublicRoute) {
    // Return 401 for API routes instead of redirect
    if (path.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.nextUrl));
  }

  // Redirect to dashboard if logged in but trying to access login
  if (session && path === '/login') {
    return NextResponse.redirect(new URL('/', req.nextUrl));
  }

  // Force password change for users who must set a new password
  const changePasswordPaths = ['/change-password', '/api/auth/change-password', '/api/auth/logout'];
  if (session?.mustChangePassword && !changePasswordPaths.some(p => path.startsWith(p))) {
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: 'Passwortänderung erforderlich' }, { status: 403 });
    }
    return NextResponse.redirect(new URL('/change-password', req.nextUrl));
  }

  // Restrict admin routes to actual admins
  if (session && isAdminRoute && session.role !== 'admin') {
    if (path.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.redirect(new URL('/', req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
