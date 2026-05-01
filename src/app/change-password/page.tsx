'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Stage = 'current' | 'new' | 'confirm';

const stageLabels: Record<Stage, string> = {
  current: 'Aktuelle PIN eingeben',
  new: 'Neue PIN eingeben',
  confirm: 'Neue PIN bestätigen',
};

const stageOrder: Stage[] = ['current', 'new', 'confirm'];

export default function ChangePasswordPage() {
  const [stage, setStage] = useState<Stage>('current');
  const [pins, setPins] = useState({ current: '', new: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const activePin = pins[stage];

  const submitChange = async (current: string, newPin: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: newPin }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push('/');
      } else {
        setError(data.error || 'Fehler beim Ändern der PIN');
        setPins({ current: '', new: '', confirm: '' });
        setStage('current');
      }
    } catch {
      setError('Netzwerkfehler. Bitte erneut versuchen.');
      setPins({ current: '', new: '', confirm: '' });
      setStage('current');
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (key: string) => {
    if (loading) return;

    if (key === 'backspace') {
      setPins(prev => ({ ...prev, [stage]: prev[stage].slice(0, -1) }));
      return;
    }

    if (activePin.length >= 6) return;
    const next = activePin + key;
    setPins(prev => ({ ...prev, [stage]: next }));

    if (next.length < 6) return;

    if (stage === 'current') {
      setStage('new');
    } else if (stage === 'new') {
      setStage('confirm');
    } else {
      const currentPin = pins.current;
      const newPin = pins.new;
      const confirmPin = next;
      if (newPin !== confirmPin) {
        setError('Die neuen PINs stimmen nicht überein');
        setPins(prev => ({ ...prev, new: '', confirm: '' }));
        setStage('new');
        return;
      }
      submitChange(currentPin, newPin);
    }
  };

  const stageIndex = stageOrder.indexOf(stage);

  return (
    <div style={{ display: 'flex', height: '100dvh', alignItems: 'center', justifyContent: 'center', background: 'var(--background)' }}>
      <div style={{
        background: 'var(--surface)', padding: '40px', borderRadius: '16px',
        width: '100%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
        border: '1px solid var(--border)'
      }}>
        <h1 style={{ margin: '0 0 8px 0', textAlign: 'center', fontSize: '2rem', color: 'var(--primary)' }}>TafelPopafel</h1>
        <h2 style={{ margin: '0 0 20px 0', textAlign: 'center', fontSize: '1.1rem', color: 'var(--foreground)' }}>PIN ändern</h2>

        {/* Stage indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '20px' }}>
          {stageOrder.map((s, i) => (
            <div key={s} style={{
              width: '10px', height: '10px', borderRadius: '50%',
              backgroundColor: i <= stageIndex ? 'var(--primary)' : 'var(--border)',
              transition: 'background-color 0.2s'
            }} />
          ))}
        </div>

        <p style={{ textAlign: 'center', marginBottom: '16px', color: 'var(--foreground)', fontSize: '0.95rem' }}>
          {stageLabels[stage]}
        </p>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '10px', borderRadius: '8px', marginBottom: '16px', textAlign: 'center' }}>
            {error}
          </div>
        )}

        {/* PIN display */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{
              width: '20px', height: '20px', borderRadius: '50%',
              border: '2px solid var(--primary)',
              backgroundColor: i < activePin.length ? 'var(--primary)' : 'transparent',
              transition: 'background-color 0.2s'
            }} />
          ))}
        </div>

        {/* Keypad */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', maxWidth: '300px', margin: '0 auto' }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              type="button"
              onClick={() => handleKey(num.toString())}
              style={{
                padding: '15px', fontSize: '1.5rem', fontWeight: 'bold',
                borderRadius: '12px', border: '1px solid var(--border)',
                background: 'var(--surface)', color: 'var(--foreground)',
                cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--border)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--surface)')}
            >
              {num}
            </button>
          ))}
          <div />
          <button
            type="button"
            onClick={() => handleKey('0')}
            style={{
              padding: '15px', fontSize: '1.5rem', fontWeight: 'bold',
              borderRadius: '12px', border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--foreground)',
              cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--border)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--surface)')}
          >
            0
          </button>
          <button
            type="button"
            onClick={() => handleKey('backspace')}
            style={{
              padding: '15px', fontSize: '1.2rem', fontWeight: 'bold',
              borderRadius: '12px', border: '1px solid var(--border)',
              background: 'var(--danger)', color: 'white',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
            title="Löschen"
          >
            ⌫
          </button>
        </div>

        {loading && (
          <p style={{ textAlign: 'center', marginTop: '20px', color: 'var(--foreground)', opacity: 0.6 }}>
            Wird gespeichert...
          </p>
        )}
      </div>
    </div>
  );
}
