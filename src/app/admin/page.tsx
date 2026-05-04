'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface UserEntry {
  id: string;
  username: string;
  role: 'admin' | 'teacher';
  createdAt: string;
}

type Modal =
  | { type: 'delete'; user: UserEntry }
  | { type: 'pin'; user: UserEntry };

function PinPad({ onConfirm, onCancel, title }: { onConfirm: (pin: string) => void; onCancel: () => void; title: string }) {
  const [pin, setPin] = useState('');
  return (
    <div>
      <p style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: '16px' }}>{title}</p>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{
            width: '18px', height: '18px', borderRadius: '50%',
            border: '2px solid var(--primary)',
            backgroundColor: i < pin.length ? 'var(--primary)' : 'transparent',
            transition: 'background-color 0.2s'
          }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', maxWidth: '240px', margin: '0 auto 16px' }}>
        {[1,2,3,4,5,6,7,8,9].map(n => (
          <button key={n} type="button"
            onClick={() => setPin(p => p.length < 6 ? p + n : p)}
            style={{ padding: '12px', fontSize: '1.3rem', fontWeight: 'bold', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
          >{n}</button>
        ))}
        <div />
        <button type="button"
          onClick={() => setPin(p => p.length < 6 ? p + '0' : p)}
          style={{ padding: '12px', fontSize: '1.3rem', fontWeight: 'bold', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)', cursor: 'pointer' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
        >0</button>
        <button type="button"
          onClick={() => setPin(p => p.slice(0, -1))}
          style={{ padding: '12px', fontSize: '1.1rem', fontWeight: 'bold', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--danger)', color: 'white', cursor: 'pointer' }}
        >⌫</button>
      </div>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <button onClick={onCancel} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)', cursor: 'pointer', fontWeight: 'bold' }}>
          Abbrechen
        </button>
        <button onClick={() => onConfirm(pin)} disabled={pin.length !== 6}
          style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: 'white', cursor: pin.length === 6 ? 'pointer' : 'not-allowed', opacity: pin.length === 6 ? 1 : 0.5, fontWeight: 'bold' }}>
          PIN setzen
        </button>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [modal, setModal] = useState<Modal | null>(null);
  const router = useRouter();

  const loadUsers = useCallback(async () => {
    const res = await fetch('/api/admin/users');
    if (res.ok) setUsers(await res.json());
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const showMsg = (msg: string) => { setMessage(msg); setError(''); };
  const showErr = (msg: string) => { setError(msg); setMessage(''); };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(''); setMessage('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role: 'teacher' }),
      });
      const data = await res.json();
      if (res.ok) {
        showMsg(`Konto "${data.user.username}" angelegt.`);
        setUsername(''); setPassword('');
        loadUsers();
      } else {
        showErr(data.error || 'Fehler beim Anlegen');
      }
    } catch { showErr('Netzwerkfehler'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (user: UserEntry) => {
    const res = await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user.username }),
    });
    const data = await res.json();
    if (res.ok) { showMsg(`Konto "${user.username}" gelöscht.`); loadUsers(); }
    else showErr(data.error || 'Fehler beim Löschen');
    setModal(null);
  };

  const handleChangePin = async (user: UserEntry, pin: string) => {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user.username, newPassword: pin }),
    });
    const data = await res.json();
    if (res.ok) showMsg(`PIN für "${user.username}" geändert.`);
    else showErr(data.error || 'Fehler beim Ändern');
    setModal(null);
  };

  const cardStyle: React.CSSProperties = { background: 'var(--surface)', padding: '30px', borderRadius: '16px', border: '1px solid var(--border)', marginBottom: '24px' };

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--background)', color: 'var(--foreground)', padding: '40px', overflowY: 'auto' }}>
      <style>{`body { overflow: auto !important; touch-action: auto !important; }`}</style>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h1 style={{ margin: 0 }}>Admin-Bereich</h1>
          <button onClick={() => router.push('/')}
            style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)', cursor: 'pointer' }}>
            Zurück zur Tafel
          </button>
        </div>

        {message && <div style={{ background: 'rgba(34,197,94,0.1)', color: '#16a34a', padding: '10px 14px', borderRadius: '8px', marginBottom: '20px' }}>{message}</div>}
        {error   && <div style={{ background: 'rgba(239,68,68,0.1)',  color: 'var(--danger)',  padding: '10px 14px', borderRadius: '8px', marginBottom: '20px' }}>{error}</div>}

        {/* User list */}
        <div style={cardStyle}>
          <h2 style={{ margin: '0 0 20px 0' }}>Konten</h2>
          {users.length === 0 ? (
            <p style={{ color: 'var(--border)' }}>Keine Konten gefunden.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {users.map(u => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--background)' }}>
                  <div>
                    <span style={{ fontWeight: 'bold' }}>{u.username}</span>
                    <span style={{ marginLeft: '10px', fontSize: '0.78rem', color: 'var(--border)', background: u.role === 'admin' ? 'rgba(59,130,246,0.1)' : 'rgba(0,0,0,0.06)', padding: '2px 8px', borderRadius: '20px' }}>
                      {u.role === 'admin' ? 'Admin' : 'Lehrkraft'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setModal({ type: 'pin', user: u })}
                      style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
                    >
                      PIN ändern
                    </button>
                    {u.role !== 'admin' && (
                      <button
                        onClick={() => setModal({ type: 'delete', user: u })}
                        style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', background: 'var(--danger)', color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
                      >
                        Löschen
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create user */}
        <div style={cardStyle}>
          <h2 style={{ margin: '0 0 20px 0' }}>Neue Lehrkraft anlegen</h2>
          <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px' }}>Benutzername</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} required
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '10px', textAlign: 'center' }}>6-stellige PIN</label>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
                {[...Array(6)].map((_, i) => (
                  <div key={i} style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid var(--primary)', backgroundColor: i < password.length ? 'var(--primary)' : 'transparent', transition: 'background-color 0.2s' }} />
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', maxWidth: '300px', margin: '0 auto' }}>
                {[1,2,3,4,5,6,7,8,9].map(n => (
                  <button key={n} type="button"
                    onClick={() => setPassword(p => p.length < 6 ? p + n : p)}
                    style={{ padding: '15px', fontSize: '1.5rem', fontWeight: 'bold', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
                  >{n}</button>
                ))}
                <div />
                <button type="button"
                  onClick={() => setPassword(p => p.length < 6 ? p + '0' : p)}
                  style={{ padding: '15px', fontSize: '1.5rem', fontWeight: 'bold', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
                >0</button>
                <button type="button"
                  onClick={() => setPassword(p => p.slice(0, -1))}
                  style={{ padding: '15px', fontSize: '1.2rem', fontWeight: 'bold', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--danger)', color: 'white', cursor: 'pointer' }}
                >⌫</button>
              </div>
            </div>
            <button type="submit" disabled={loading || password.length !== 6 || !username.trim()}
              style={{ marginTop: '10px', padding: '12px', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 'bold', cursor: (loading || password.length !== 6 || !username.trim()) ? 'not-allowed' : 'pointer', opacity: (loading || password.length !== 6 || !username.trim()) ? 0.5 : 1 }}>
              {loading ? 'Wird angelegt…' : 'Konto erstellen'}
            </button>
          </form>
        </div>
      </div>

      {/* Modal overlay */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div style={{ background: 'var(--surface)', borderRadius: '16px', padding: '30px', maxWidth: '380px', width: '90%', border: '1px solid var(--border)' }}>
            {modal.type === 'delete' ? (
              <>
                <h3 style={{ margin: '0 0 12px 0' }}>Konto löschen</h3>
                <p style={{ color: 'var(--foreground)', marginBottom: '24px' }}>
                  Konto <strong>{modal.user.username}</strong> wirklich löschen? Die Notizbücher bleiben erhalten.
                </p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setModal(null)}
                    style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)', cursor: 'pointer', fontWeight: 'bold' }}>
                    Abbrechen
                  </button>
                  <button onClick={() => handleDelete(modal.user)}
                    style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--danger)', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>
                    Löschen
                  </button>
                </div>
              </>
            ) : (
              <PinPad
                title={`Neue PIN für „${modal.user.username}"`}
                onConfirm={pin => handleChangePin(modal.user, pin)}
                onCancel={() => setModal(null)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
