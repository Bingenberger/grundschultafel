'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface UserEntry {
  username: string;
  role: 'admin' | 'teacher';
}

type Stage = 'select' | 'pin';

export default function LoginPage() {
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [stage, setStage] = useState<Stage>('select');
  const [selectedUser, setSelectedUser] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/users')
      .then(r => r.json())
      .then(data => setUsers(data.users ?? []))
      .catch(() => {});
  }, []);

  const handleSelect = (username: string) => {
    setSelectedUser(username);
    setPin('');
    setError('');
    setStage('pin');
  };

  const handleBack = () => {
    setStage('select');
    setSelectedUser('');
    setPin('');
    setError('');
  };

  const handleLogin = async (currentPin: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: selectedUser, password: currentPin }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push(data.redirect || '/');
      } else {
        setError(data.error || 'Login fehlgeschlagen');
        setPin('');
      }
    } catch {
      setError('Netzwerkfehler. Bitte erneut versuchen.');
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (key: string) => {
    if (loading) return;
    if (key === 'backspace') {
      setPin(p => p.slice(0, -1));
      return;
    }
    if (pin.length >= 6) return;
    const next = pin + key;
    setPin(next);
    if (next.length === 6) handleLogin(next);
  };

  return (
    <div style={{ display: 'flex', height: '100dvh', alignItems: 'center', justifyContent: 'center', background: 'var(--background)' }}>
      <div style={{
        background: 'var(--surface)',
        padding: '40px',
        borderRadius: '16px',
        width: '100%',
        maxWidth: stage === 'select' ? '560px' : '400px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
        border: '1px solid var(--border)',
      }}>
        <h1 style={{ margin: '0 0 24px 0', textAlign: 'center', fontSize: '2rem', color: 'var(--primary)' }}>
          TafelPopafel
        </h1>

        {stage === 'select' && (
          <>
            <h2 style={{ margin: '0 0 20px 0', textAlign: 'center', fontSize: '1.2rem', color: 'var(--foreground)' }}>
              Wer bist du?
            </h2>
            {users.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--foreground)', opacity: 0.5 }}>Lade Konten...</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
                {users.map(u => (
                  <button
                    key={u.username}
                    onClick={() => handleSelect(u.username)}
                    style={{
                      padding: '20px 12px',
                      borderRadius: '12px',
                      border: '2px solid var(--border)',
                      background: 'var(--background)',
                      color: 'var(--foreground)',
                      fontSize: '1.05rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'var(--primary)';
                      e.currentTarget.style.background = 'var(--surface)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.background = 'var(--background)';
                    }}
                  >
                    {u.username}
                    {u.role === 'admin' && (
                      <span style={{ display: 'block', fontSize: '0.7rem', opacity: 0.5, marginTop: '4px', fontWeight: 'normal' }}>
                        Admin
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {stage === 'pin' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <button
                onClick={handleBack}
                style={{
                  padding: '6px 12px', borderRadius: '8px',
                  border: '1px solid var(--border)', background: 'var(--background)',
                  color: 'var(--foreground)', cursor: 'pointer', fontSize: '0.9rem', flexShrink: 0,
                }}
              >
                ← Zurück
              </button>
              <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--foreground)' }}>
                Hallo, <span style={{ color: 'var(--primary)' }}>{selectedUser}</span>!
              </h2>
            </div>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', padding: '10px', borderRadius: '8px', marginBottom: '16px', textAlign: 'center' }}>
                {error}
              </div>
            )}

            <p style={{ textAlign: 'center', marginBottom: '12px', color: 'var(--foreground)', opacity: 0.7, fontSize: '0.9rem' }}>
              PIN eingeben
            </p>

            {/* PIN dots */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
              {[...Array(6)].map((_, i) => (
                <div key={i} style={{
                  width: '20px', height: '20px', borderRadius: '50%',
                  border: '2px solid var(--primary)',
                  backgroundColor: i < pin.length ? 'var(--primary)' : 'transparent',
                  transition: 'background-color 0.1s',
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
                    cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
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
                  cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
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
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                title="Löschen"
              >
                ⌫
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
