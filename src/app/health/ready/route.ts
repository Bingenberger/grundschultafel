import {NextResponse} from 'next/server';
import {ready} from '@/lib/platform';
export const dynamic='force-dynamic';
export async function GET(){return NextResponse.json({status:ready()?'ready':'migration-required'},{status:ready()?200:503});}
