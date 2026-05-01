import React from 'react';
import { X, Clock, Target, ArrowDownUp, Hourglass, Puzzle, Lightbulb } from 'lucide-react';

interface TimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTimer: (type: string) => void;
}

const timers = [
  { id: 'ampel', name: 'Ampel-Countdown', icon: Clock, desc: 'Grün, gelb, rot je nach Restzeit.' },
  { id: 'fokus', name: 'Fokus-Countdown', icon: Target, desc: 'Ruhige große Anzeige.' },
  { id: 'intervall', name: 'Intervalltimer', icon: ArrowDownUp, desc: 'Arbeits- und Pausenphasen.' },
  { id: 'sanduhr', name: 'Sanduhr', icon: Hourglass, desc: 'Klassische Sanduhr.' },
  { id: 'narrativ2', name: 'Puzzle-Timer', icon: Puzzle, desc: 'Teile werden nach und nach sichtbar.' },
  { id: 'atmo', name: 'Atmosphärischer Timer', icon: Lightbulb, desc: 'Sanfte LED-Linien für ruhiges Arbeiten.' }
];

export default function TimerModal({ isOpen, onClose, onSelectTimer }: TimerModalProps) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'var(--background)',
        width: '90%',
        maxWidth: '800px',
        maxHeight: '80vh',
        borderRadius: '24px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 20px 50px rgba(0,0,0,0.2)'
      }}>
        {/* Header */}
        <div style={{ 
          padding: '20px 30px', 
          borderBottom: '1px solid var(--border)', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          background: 'var(--surface)'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--foreground)' }}>Timer hinzufügen</h2>
          <button 
            onClick={onClose}
            style={{ 
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--muted)', padding: '5px' 
            }}
          >
            <X size={28} />
          </button>
        </div>

        {/* Content */}
        <div style={{ 
          padding: '30px', 
          overflowY: 'auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px'
        }}>
          {timers.map((timer) => {
            const Icon = timer.icon;
            return (
              <button
                key={timer.id}
                onClick={() => onSelectTimer(timer.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '15px',
                  padding: '20px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '16px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.boxShadow = '0 8px 15px rgba(0,0,0,0.1)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)';
                }}
              >
                <div style={{
                  background: 'rgba(15, 158, 153, 0.1)',
                  color: 'var(--primary)',
                  padding: '12px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Icon size={24} />
                </div>
                <div>
                  <h3 style={{ margin: '0 0 5px 0', fontSize: '1.1rem', color: 'var(--foreground)' }}>{timer.name}</h3>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--muted)' }}>{timer.desc}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  );
}
