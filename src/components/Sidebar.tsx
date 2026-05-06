'use client';

import { useWhiteboardStore } from '@/store/useWhiteboardStore';
import { useState, useEffect } from 'react';
import { Save, FolderOpen, ChevronUp, ChevronDown, Plus, X, FilePlus, Pen, Trash2, LogOut, ShieldAlert, List } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useRouter } from 'next/navigation';

export default function Sidebar() {
  const { 
    notebookId, notebookName, pages, currentPageId, 
    setNotebook, loadNotebookState, switchPage, addPage,
    resetNotebook, renameNotebook,
    isJournalOpen, toggleJournal, journalImages
  } = useWhiteboardStore();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [notebookToDelete, setNotebookToDelete] = useState<{id: string, name: string} | null>(null);
  const [notebooks, setNotebooks] = useState<{ id: string, name: string, updatedAt: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<{username: string, role: string} | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.user) setUser(data.user);
      })
      .catch(err => console.error(err));
  }, []);

  const fetchNotebooks = async () => {
    try {
      const res = await fetch('/api/notebooks');
      const data = await res.json();
      if (data.notebooks) {
        setNotebooks(data.notebooks);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    let id = notebookId;
    let name = notebookName;

    if (!id) {
      id = uuidv4();
      if (!name) {
        const now = new Date();
        name = `Tafelheft ${now.toLocaleDateString('de-DE')} ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
      }
      setNotebook(id, name);
    } else if (!name) {
      const now = new Date();
      name = `Tafelheft ${now.toLocaleDateString('de-DE')} ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
      setNotebook(id, name);
    }

    try {
      const payload = { name, pages, journalImages };
      console.log('[Save] Speichere Heft, Seiten:', pages.length, '– Objekte pro Seite:', pages.map(p => (p.canvasData as any)?.objects?.length ?? 'kein canvasData'));
      const res = await fetch(`/api/notebooks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      console.log('[Save] Server-Antwort:', res.status, res.ok ? 'OK' : 'FEHLER');
    } catch (e) {
      console.error('Fehler beim Speichern!', e);
    } finally {
      setSaving(false);
    }
  };

  const handleLoad = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/notebooks/${id}`);
      const data = await res.json();
      if (data.pages) {
        console.log('[Load] Geladene Seiten:', data.pages.length, '– Objekte pro Seite:', data.pages.map((p: any) => p.canvasData?.objects?.length ?? 'kein canvasData'));
        loadNotebookState(id, name, data.pages, data.journalImages || []);
        setIsModalOpen(false);
      }
    } catch (e) {
      console.error('Fehler beim Laden!', e);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation(); // Verhindere, dass handleClick vom Container aufgerufen wird (was das Heft laden würde)
    setNotebookToDelete({ id, name });
  };

  const confirmDelete = async () => {
    if (!notebookToDelete) return;
    
    try {
      const res = await fetch(`/api/notebooks/${notebookToDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        // Heft aus lokaler Liste entfernen, damit die UI sofort updatet
        setNotebooks(prev => prev.filter(nb => nb.id !== notebookToDelete.id));
        
        // Wenn das gelöschte Heft gerade offen ist, ein neues leeres Heft anfangen
        if (notebookId === notebookToDelete.id) {
            resetNotebook();
        }
      }
    } catch (e) {
      console.error('Fehler beim Löschen!', e);
    } finally {
      setNotebookToDelete(null);
    }
  };

  const handleLogout = async () => {
    if (window.confirm('Möchtest du dich wirklich abmelden?')) {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    }
  };

  // Pagination logic
  const currentIndex = pages.findIndex(p => p.id === currentPageId);
  const isFirstPage = currentIndex <= 0;
  const isLastPage = currentIndex === pages.length - 1;

  const handlePrevPage = () => {
    if (!isFirstPage) {
      switchPage(pages[currentIndex - 1].id);
    }
  };

  const handleNextPage = () => {
    if (!isLastPage) {
      switchPage(pages[currentIndex + 1].id);
    }
  };

  // Sidebar styling
  const buttonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--foreground)',
    background: 'var(--surface)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    transition: 'all 0.2s'
  };

  const disabledStyle: React.CSSProperties = {
    ...buttonStyle,
    opacity: 0.3,
    cursor: 'not-allowed',
    boxShadow: 'none'
  };

  const currentDisplayName = notebookName || 'Unbenanntes Tafelheft';

  const handleRenameClick = () => {
    setRenameInput(currentDisplayName);
    setIsRenameOpen(true);
  };

  const submitRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (renameInput.trim().length > 0) {
      renameNotebook(renameInput.trim());
      setIsRenameOpen(false);
    }
  };

  const handleNewNotebook = () => {
    if (window.confirm('Willst du wirklich ein neues Tafelheft anfangen? (Nicht gespeicherte Änderungen gehen verloren!)')) {
      resetNotebook();
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '64px',
      height: '100%',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      padding: '15px 0',
      alignItems: 'center',
      zIndex: 100,
      flexShrink: 0
    }}>
      {/* Floating Notebook Title (now integrated in sidebar or just a hover tooltip for the notebook) */}
      <div 
        onClick={handleRenameClick}
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: '44px',
          height: '44px',
          borderRadius: '12px',
          background: 'var(--primary)',
          color: 'white',
          cursor: 'pointer',
          marginBottom: '20px',
          boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
        }}
        title={`Tafelheft: ${currentDisplayName} (Klicken zum Umbenennen)`}
      >
        <Pen size={20} />
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        flex: 1,
        alignItems: 'center',
      }}>
        {/* Toggle Journal Sidebar */}
        <button 
          onClick={toggleJournal} 
          style={{...buttonStyle, color: isJournalOpen ? 'var(--primary)' : 'var(--foreground)'}}
          title="Tagesablauf / Journal umschalten"
        >
          <List size={20} />
        </button>

        <div style={{ height: '2px', width: '32px', backgroundColor: 'var(--border)', borderRadius: '2px', marginBottom: '8px' }} />
        
        {/* New Notebook */}
        <button 
          onClick={handleNewNotebook} 
          style={{...buttonStyle, color: 'var(--foreground)'}}
          title="Neues Tafelheft anlegen"
        >
          <FilePlus size={20} />
        </button>

        <div style={{ height: '2px', width: '32px', backgroundColor: 'var(--border)', borderRadius: '2px' }} />

        {/* Save */}
        <button 
          onClick={handleSave} 
          disabled={saving} 
          style={{...buttonStyle, color: saving ? 'var(--border)' : 'var(--primary)'}}
          title="Speichern"
        >
          <Save size={20} />
        </button>

        {/* Load */}
        <button 
          onClick={() => { setIsModalOpen(true); fetchNotebooks(); }} 
          style={buttonStyle}
          title="Öffnen"
        >
          <FolderOpen size={20} />
        </button>

        <div style={{ height: '2px', width: '32px', backgroundColor: 'var(--border)', borderRadius: '2px' }} />

        {/* Previous Page */}
        <button 
          onClick={handlePrevPage} 
          disabled={isFirstPage} 
          style={isFirstPage ? disabledStyle : buttonStyle}
          title="Vorheriges Blatt"
        >
          <ChevronUp size={24} />
        </button>

        {/* Next Page */}
        <button 
          onClick={handleNextPage} 
          disabled={isLastPage} 
          style={isLastPage ? disabledStyle : buttonStyle}
          title="Nächstes Blatt"
        >
          <ChevronDown size={24} />
        </button>

        {/* Add Page (Enabled only on last page) */}
        <button 
          onClick={addPage} 
          disabled={!isLastPage}
          style={!isLastPage ? {...disabledStyle, marginTop: '5px'} : {...buttonStyle, background: 'var(--primary)', color: 'white', marginTop: '5px'}}
          title="Neues Blatt"
        >
          <Plus size={24} />
        </button>
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
        marginTop: 'auto',
      }}>
        <div style={{ width: '32px', height: '2px', backgroundColor: 'var(--border)', borderRadius: '2px', marginBottom: '5px' }} />
        
        {user && user.role === 'admin' && (
          <button 
            onClick={() => router.push('/admin')}
            style={{...buttonStyle, background: 'var(--border)'}}
            title="Admin-Bereich"
          >
            <ShieldAlert size={20} />
          </button>
        )}
        
        <div style={{ fontSize: '0.65rem', fontWeight: 'bold', color: 'var(--foreground)', textAlign: 'center', wordBreak: 'break-all', padding: '0 5px', width: '100%' }} title={`Angemeldet als ${user?.username}`}>
          {user?.username}
        </div>
        
        <button 
          onClick={handleLogout}
          style={{...buttonStyle, color: 'var(--danger)'}}
          title="Abmelden"
        >
          <LogOut size={20} />
        </button>
      </div>

      {/* Notebook Modal (Kept from NotebookActions) */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--surface)', padding: '20px', borderRadius: '16px',
            width: '90%', maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: 'var(--foreground)' }}>Gespeicherte Tafelhefte</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--foreground)' }}
              >
                <X size={24} />
              </button>
            </div>
            
            {notebooks.length === 0 ? (
              <p style={{ color: 'var(--border)' }}>Noch keine Tafelhefte gespeichert.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {notebooks.map(nb => (
                  <div
                    key={nb.id}
                    onClick={() => handleLoad(nb.id, nb.name)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 15px', borderRadius: '10px',
                      background: 'var(--background)', border: '1px solid var(--border)',
                      cursor: 'pointer', textAlign: 'left',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--border)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--background)'}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--foreground)' }}>{nb.name}</span>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {new Date(nb.updatedAt).toLocaleDateString('de-DE')}
                      </span>
                    </div>
                    
                    <button
                      onClick={(e) => handleDeleteClick(e, nb.id, nb.name)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--danger)', padding: '10px',
                        borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      title="Löschen"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {isRenameOpen && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--surface)', padding: '24px', borderRadius: '16px',
            width: '90%', maxWidth: '400px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h2 style={{ margin: 0, color: 'var(--foreground)', fontSize: '1.25rem' }}>Tafelheft umbenennen</h2>
              <button 
                onClick={() => setIsRenameOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--border)' }}
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={submitRename}>
              <input
                type="text"
                autoFocus
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                style={{
                  width: '100%', padding: '12px 15px', borderRadius: '8px',
                  border: '1px solid var(--border)', background: 'var(--background)',
                  color: 'var(--foreground)', fontSize: '1rem', outline: 'none',
                  boxSizing: 'border-box', marginBottom: '20px'
                }}
                onFocus={(e) => e.target.select()}
              />
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setIsRenameOpen(false)}
                  style={{
                    padding: '10px 15px', borderRadius: '8px', border: '1px solid var(--border)',
                    background: 'transparent', color: 'var(--foreground)', cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={renameInput.trim().length === 0}
                  style={{
                    padding: '10px 15px', borderRadius: '8px', border: 'none',
                    background: 'var(--primary)', color: 'white', cursor: renameInput.trim().length === 0 ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold', opacity: renameInput.trim().length === 0 ? 0.5 : 1
                  }}
                >
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {notebookToDelete && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1100,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--surface)', padding: '24px', borderRadius: '16px',
            width: '90%', maxWidth: '400px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            display: 'flex', flexDirection: 'column', gap: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '15px' }}>
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)',
                padding: '12px', borderRadius: '50%', flexShrink: 0
              }}>
                <Trash2 size={32} />
              </div>
              <div>
                <h3 style={{ margin: '0 0 10px 0', color: 'var(--foreground)', fontSize: '1.25rem' }}>
                  Tafelheft löschen?
                </h3>
                <p style={{ margin: 0, color: 'var(--border)', lineHeight: '1.5' }}>
                  Bist du sicher, dass du das Tafelheft <strong>"{notebookToDelete.name}"</strong> unwiderruflich löschen möchtest?
                </p>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button
                onClick={() => setNotebookToDelete(null)}
                style={{
                  padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)',
                  background: 'transparent', color: 'var(--foreground)', cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Abbrechen
              </button>
              <button
                onClick={confirmDelete}
                style={{
                  padding: '10px 20px', borderRadius: '8px', border: 'none',
                  background: 'var(--danger)', color: 'white', cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
