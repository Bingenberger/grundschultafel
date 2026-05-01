'use client';

import dynamic from 'next/dynamic';
import Toolbar from '@/components/Toolbar';
import Sidebar from '@/components/Sidebar';
import JournalSidebar from '@/components/JournalSidebar';

const Whiteboard = dynamic(() => import('@/components/Whiteboard'), {
  ssr: false,
  loading: () => (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      Lade Tafel...
    </div>
  )
});

export default function Home() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', width: '100vw' }}>
      <main style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        <Sidebar />
        <JournalSidebar />
        <div style={{ flex: 1, position: 'relative' }}>
          <Whiteboard />
          <Toolbar />
        </div>
      </main>
    </div>
  );
}
