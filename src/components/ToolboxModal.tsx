import { useState } from 'react';
import { useWhiteboardStore } from '@/store/useWhiteboardStore';
import { Timer, Ruler } from 'lucide-react';

interface ToolboxModalProps {
  onClose: () => void;
}

export default function ToolboxModal({ onClose }: ToolboxModalProps) {
  const triggerAddTimer = useWhiteboardStore((state) => state.triggerAddTimer);
  const triggerAddRuler = useWhiteboardStore((state) => state.triggerAddRuler);
  const [view, setView] = useState<'main' | 'timer'>('main');

  const addRuler = () => {
    triggerAddRuler();
    onClose();
  };

  const addTimer = (type: string) => {
    triggerAddTimer(type);
    onClose();
  };

  return (
    <div style={{
      position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
      marginBottom: '10px', background: 'var(--surface)', borderRadius: '16px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.15)', border: '1px solid var(--border)',
      padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px',
      zIndex: 100
    }}>
      {view === 'main' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(84px, 1fr))', gap: '8px', minWidth: '220px' }}>
          <MenuButton
            icon={<Timer size={18} />}
            label="Timer"
            onClick={() => setView('timer')}
          />
          <MenuButton
            icon={<Ruler size={18} />}
            label="Lineal"
            onClick={addRuler}
          />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(110px, 1fr))', gap: '8px', minWidth: '260px' }}>
          <TimerButton onClick={() => addTimer('ampel')} label="Ampel-Countdown" />
          <TimerButton onClick={() => addTimer('fokus')} label="Fokus" />
          <TimerButton onClick={() => addTimer('intervall')} label="Intervalltimer" />
          <TimerButton onClick={() => addTimer('sanduhr')} label="Sanduhr" />
          <TimerButton onClick={() => addTimer('narrativ2')} label="Puzzle-Timer" />
          <TimerButton onClick={() => addTimer('atmo')} label="Atmospharisch" />
          <TimerButton onClick={() => setView('main')} label="Zurück" subtle />
        </div>
      )}
    </div>
  );
}

function MenuButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        padding: '10px 8px',
        borderRadius: '12px',
        border: 'none',
        background: 'transparent',
        color: 'var(--foreground)',
        cursor: 'pointer',
        transition: 'all 0.2s'
      }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--border)'}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      title={label}
    >
      {icon}
      <span style={{ fontSize: '0.72rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  );
}

const TimerButton = ({ onClick, label, subtle = false }: { onClick: () => void; label: string; subtle?: boolean }) => (
  <button
    onClick={onClick}
    style={{
      padding: '10px 12px',
      background: subtle ? 'transparent' : 'var(--primary)',
      color: subtle ? 'var(--foreground)' : 'white',
      border: subtle ? '1px solid var(--border)' : 'none',
      borderRadius: '10px',
      cursor: 'pointer',
      fontWeight: 'bold',
      transition: 'all 0.2s',
      fontSize: '0.82rem'
    }}
    onMouseEnter={(e) => {
      if (subtle) e.currentTarget.style.background = 'var(--border)';
      else e.currentTarget.style.filter = 'brightness(1.08)';
    }}
    onMouseLeave={(e) => {
      if (subtle) e.currentTarget.style.background = 'transparent';
      else e.currentTarget.style.filter = 'brightness(1)';
    }}
  >
    {label}
  </button>
);
