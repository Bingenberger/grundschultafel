'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role: 'teacher' }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage(`Benutzer "${data.user.username}" erfolgreich angelegt!`);
        setUsername('');
        setPassword('');
      } else {
        setError(data.error || 'Fehler beim Anlegen');
      }
    } catch (err) {
      setError('Netzwerkfehler');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--background)', color: 'var(--foreground)', padding: '40px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h1 style={{ margin: 0 }}>Admin-Bereich</h1>
          <button 
            onClick={() => router.push('/')}
            style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)', cursor: 'pointer' }}
          >
            Zurück zur Tafel
          </button>
        </div>

        <div style={{ background: 'var(--surface)', padding: '30px', borderRadius: '16px', border: '1px solid var(--border)' }}>
          <h2 style={{ margin: '0 0 20px 0' }}>Neue Lehrkraft anlegen</h2>
          
          {message && <div style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a', padding: '10px', borderRadius: '8px', marginBottom: '20px' }}>{message}</div>}
          {error && <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '10px', borderRadius: '8px', marginBottom: '20px' }}>{error}</div>}

          <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px' }}>Benutzername</label>
              <input 
                type="text" 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
                required
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '10px', textAlign: 'center' }}>6-stellige PIN</label>
              
              {/* PIN Display */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
                {[...Array(6)].map((_, i) => (
                  <div 
                    key={i} 
                    style={{ 
                      width: '20px', height: '20px', borderRadius: '50%', 
                      border: '2px solid var(--primary)',
                      backgroundColor: i < password.length ? 'var(--primary)' : 'transparent',
                      transition: 'background-color 0.2s'
                    }} 
                  />
                ))}
              </div>

              {/* Numeric Keypad */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', maxWidth: '300px', margin: '0 auto' }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setPassword(prev => prev.length < 6 ? prev + num : prev)}
                    style={{
                      padding: '15px', fontSize: '1.5rem', fontWeight: 'bold',
                      borderRadius: '12px', border: '1px solid var(--border)',
                      background: 'var(--surface)', color: 'var(--foreground)',
                      cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--border)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--surface)'}
                  >
                    {num}
                  </button>
                ))}
                <div />
                <button
                  type="button"
                  onClick={() => setPassword(prev => prev.length < 6 ? prev + '0' : prev)}
                  style={{
                    padding: '15px', fontSize: '1.5rem', fontWeight: 'bold',
                    borderRadius: '12px', border: '1px solid var(--border)',
                    background: 'var(--surface)', color: 'var(--foreground)',
                    cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--border)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--surface)'}
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => setPassword(prev => prev.slice(0, -1))}
                  style={{
                    padding: '15px', fontSize: '1.2rem', fontWeight: 'bold',
                    borderRadius: '12px', border: '1px solid var(--border)',
                    background: 'var(--danger)', color: 'white',
                    cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                  title="Löschen"
                >
                  ⌫
                </button>
              </div>
            </div>
            <button 
              type="submit" 
              disabled={loading || password.length !== 6 || username.trim().length === 0}
              style={{ 
                marginTop: '10px', padding: '12px', borderRadius: '8px', border: 'none', 
                background: 'var(--primary)', color: 'white', fontWeight: 'bold', 
                cursor: (loading || password.length !== 6 || username.trim().length === 0) ? 'not-allowed' : 'pointer',
                opacity: (loading || password.length !== 6 || username.trim().length === 0) ? 0.5 : 1
              }}
            >
              {loading ? 'Wird angelegt...' : 'Konto erstellen'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
