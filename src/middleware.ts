import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { sessionFor } from './lib/session';
import { ready,publicOrigin } from './lib/platform';

const publicRoute=(path:string)=>['/login','/api/auth/login','/api/auth/users','/upload','/api/mobile-upload'].includes(path);
async function access(req:NextRequest) {
  const path=req.nextUrl.pathname;
  if(path==='/health/live'||path==='/health/ready') return NextResponse.next();
  if(!ready()) return NextResponse.json({error:'Einrichtung noch nicht abgeschlossen'},{status:503});
  if(!['GET','HEAD','OPTIONS'].includes(req.method)) {
    const origin=req.headers.get('origin');
    if(origin&&origin!==publicOrigin()) return NextResponse.json({error:'Unzulässiger Ursprung'},{status:403});
  }
  // browser tab / home screen icons must also show on the login page
  if(path.startsWith('/_next/')||['/favicon.ico','/icon.svg','/apple-icon.png'].includes(path)) return NextResponse.next();
  const session=await sessionFor(req.cookies.get('session')?.value,req.cookies.get('tafel_device')?.value);
  if(!session&&!publicRoute(path)) {
    if(path.startsWith('/api/')||path.startsWith('/assets/')) return NextResponse.json({error:'Unauthorized'},{status:401});
    return NextResponse.redirect(new URL('/login',publicOrigin()));
  }
  if(session&&path==='/login') return NextResponse.redirect(new URL('/',publicOrigin()));
  const change=['/change-password','/api/auth/change-password','/api/auth/logout'];
  if(session?.mustChangePassword&&!change.includes(path)) {
    if(path.startsWith('/api/')) return NextResponse.json({error:'PIN-Wechsel erforderlich'},{status:403});
    return NextResponse.redirect(new URL('/change-password',publicOrigin()));
  }
  if(session&&(path==='/admin'||path.startsWith('/api/admin/'))&&session.role!=='admin') {
    return NextResponse.json({error:'Forbidden'},{status:403});
  }
  return NextResponse.next();
}
export async function middleware(req:NextRequest){
  const response=await access(req);
  response.headers.set('Cache-Control','private, no-store');
  response.headers.set('Referrer-Policy','no-referrer');
  response.headers.set('X-Content-Type-Options','nosniff');
  return response;
}
export const config={runtime:'nodejs',matcher:['/((?!_next/static|_next/image|favicon.ico).*)']};
