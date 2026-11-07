import { useState } from 'react';
import { useWhiteboardStore } from '@/store/useWhiteboardStore';
import { Timer, Ruler, Shuffle, Users, Dices, Volume2, Calculator } from 'lucide-react';
import { MATH_MENU } from '@/lib/mathManipulatives';

interface ToolboxModalProps {
  onClose: () => void;
}

export default function ToolboxModal({ onClose }: ToolboxModalProps) {
  const triggerAddTimer = useWhiteboardStore((state) => state.triggerAddTimer);
  const triggerAddRuler = useWhiteboardStore((state) => state.triggerAddRuler);
  const setClassroomTool = useWhiteboardStore((state) => state.setClassroomTool);
  const openTool = (tool: 'names' | 'groups' | 'dice' | 'noise') => {
    setClassroomTool(tool);
    onClose();
  };
  const [view, setView] = useState<'main' | 'timer' | 'math'>('main');
  const triggerAddMath = useWhiteboardStore((state) => state.triggerAddMath);

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
          <MenuButton icon={<Calculator size={18} />} label="Mathe" onClick={() => setView('math')} />
          <MenuButton
            icon={<Ruler size={18} />}
            label="Lineal"
            onClick={addRuler}
          />
          <MenuButton icon={<Shuffle size={18} />} label="Namen ziehen" onClick={() => openTool('names')} />
          <MenuButton icon={<Users size={18} />} label="Gruppen" onClick={() => openTool('groups')} />
          <MenuButton icon={<Dices size={18} />} label="Würfel" onClick={() => openTool('dice')} />
          <MenuButton icon={<Volume2 size={18} />} label="Lautstärke" onClick={() => openTool('noise')} />
        </div>
      ) : view === 'math' ? (
        // Stays open so several pieces can be added in a row
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: 'min(460px, calc(100vw - 32px))', maxHeight: '60vh', overflowY: 'auto' }}>
          {MATH_MENU.map((section) => (
            <div key={section.title}>
              <div style={{ fontSize: '0.8rem', fontWeight: 'bold', opacity: 0.7, marginBottom: '6px' }}>{section.title}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {section.items.map((item) => (
                  <TimerButton key={item.id} onClick={() => triggerAddMath(item.id)} label={item.label} />
                ))}
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: '8px' }}>
            <TimerButton onClick={() => setView('main')} label="Zurück" subtle />
            <TimerButton onClick={onClose} label="Fertig" subtle />
          </div>
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
