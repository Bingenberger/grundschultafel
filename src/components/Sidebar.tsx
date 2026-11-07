'use client';

import { useWhiteboardStore } from '@/store/useWhiteboardStore';
import { useState, useEffect, useRef } from 'react';
import { Save, FolderOpen, ChevronUp, ChevronDown, Plus, X, FilePlus, Pen, Trash2, LogOut, ShieldAlert, List } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { saveNotebook, saveBeforeLeaving, hasUnsavedChanges } from '@/lib/notebookSave';

export default function Sidebar() {
  const { 
    notebookId, notebookName, pages, currentPageId, 
    loadNotebookState, switchPage, addPage,
    resetNotebook, renameNotebook,
    isJournalOpen, toggleJournal
  } = useWhiteboardStore();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [notebookToDelete, setNotebookToDelete] = useState<{id: string, name: string} | null>(null);
  const [notebooks, setNotebooks] = useState<{ id: string, name: string, updatedAt: string }[]>([]);
  const saveState = useWhiteboardStore((state) => state.saveState);
  const saveMessage = useWhiteboardStore((state) => state.saveMessage);
  const setSaveMessage = useWhiteboardStore((state) => state.setSaveMessage);
  const revision = useWhiteboardStore((state) => state.revision);
  const savedRevision = useWhiteboardStore((state) => state.savedRevision);
  const lastSavedAt = useWhiteboardStore((state) => state.lastSavedAt);
  const isDirty = revision !== savedRevision;
  const dirtySince = useRef<number | null>(null);

  // Success messages fade out; errors stay until dismissed so they cannot be missed
  useEffect(() => {
    if (saveMessage?.kind !== 'ok') return;
    const timer = setTimeout(() => setSaveMessage(null), 2000);
    return () => clearTimeout(timer);
  }, [saveMessage, setSaveMessage]);

  // Autosave: 3 s after the last change, but at the latest 20 s after the first unsaved one
  // (so continuous drawing is still saved regularly).
  useEffect(() => {
    if (!isDirty) { dirtySince.current = null; return; }
    if (dirtySince.current === null) dirtySince.current = Date.now();
    const delay = Math.min(3000, Math.max(0, 20000 - (Date.now() - dirtySince.current)));
    const timer = setTimeout(() => { void saveNotebook({ auto: true }); }, delay);
    return () => clearTimeout(timer);
  }, [revision, isDirty]);

  // Save when the tab is hidden (switching apps, closing the iPad cover) and warn before
  // closing the tab while changes are still unsaved.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden' && hasUnsavedChanges()) void saveNotebook({ auto: true }); };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges()) return;
      void saveNotebook({ auto: true });
      e.preventDefault();
      e.returnValue = '';
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, []);

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

  const handleSave = () => { void saveNotebook({ auto: false }); };

  const handleLoad = async (id: string, name: string) => {
    if (!await saveBeforeLeaving()) return;
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
      if (!await saveBeforeLeaving()) return;
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

  const savedTime = lastSavedAt ? new Date(lastSavedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : null;
  const saveTitle = saveState === 'saving' ? 'Wird gespeichert …'
    : saveState === 'error' ? 'Speichern fehlgeschlagen – zum erneuten Versuch tippen'
    : isDirty ? 'Ungespeicherte Änderungen (wird automatisch gespeichert)'
    : savedTime ? `Gespeichert um ${savedTime} (automatisch)` : 'Speichern';
  // amber: changes pending, red: last save failed; nothing when everything is saved
  const saveBadge = saveState === 'error' ? 'var(--danger)' : isDirty || saveState === 'saving' ? '#f59e0b' : null;

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

  const handleNewNotebook = async () => {
    if (!window.confirm('Neues Tafelheft anfangen? Das aktuelle Heft wird vorher gespeichert.')) return;
    if (!await saveBeforeLeaving()) return;
    resetNotebook();
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
          disabled={saveState === 'saving'} 
          style={{...buttonStyle, position: 'relative', color: saveState === 'saving' ? 'var(--border)' : 'var(--primary)'}}
          title={saveTitle}
          aria-label={saveTitle}
        >
          <Save size={20} />
          {saveBadge && (
            <span aria-hidden style={{
              position: 'absolute', top: '5px', right: '5px', width: '10px', height: '10px', borderRadius: '50%',
              background: saveBadge, border: '2px solid var(--surface)'
            }} />
          )}
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

      {saveMessage && (
        <div
          role={saveMessage.kind === 'error' ? 'alert' : 'status'}
          onClick={() => setSaveMessage(null)}
          title="Schließen"
          style={{
            position: 'fixed', left: '50%', bottom: '24px', transform: 'translateX(-50%)',
            maxWidth: 'min(560px, calc(100vw - 32px))', padding: '12px 18px', borderRadius: '10px',
            background: saveMessage.kind === 'error' ? 'var(--danger)' : 'var(--primary)', color: 'white',
            fontWeight: 600, boxShadow: '0 6px 20px rgba(0,0,0,0.25)', zIndex: 10000, cursor: 'pointer'
          }}
        >
          {saveMessage.text}
        </div>
      )}
    </div>
  );
}
