import { NextResponse } from 'next/server';
import os from 'os';

export async function GET() {
  try {
    const interfaces = os.networkInterfaces();
    let localIp = '127.0.0.1';
    
    // Find the first non-internal IPv4 address
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          localIp = iface.address;
          break;
        }
      }
      if (localIp !== '127.0.0.1') break;
    }

    return NextResponse.json({ ip: localIp });
  } catch (error) {
    console.error('Error fetching IP:', error);
    return NextResponse.json({ error: 'Failed to fetch IP' }, { status: 500 });
  }
}
