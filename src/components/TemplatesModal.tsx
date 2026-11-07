'use client';

// "Vorlagen der Schule": browse templates shared by colleagues (grouped by subject, filtered
// by grade), open an own copy, and share the current notebook as a template.
import React, { useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { X, Search, Share2, Copy, Trash2 } from 'lucide-react';
import { useWhiteboardStore } from '@/store/useWhiteboardStore';
import { SUBJECTS, GRADES, gradeLabel, type TemplateMeta, type Subject } from '@/lib/templates';
import { saveBeforeLeaving } from '@/lib/notebookSave';
import { renderThumbnail } from '@/lib/thumbnail';

interface Props {
  user: { id: string; username: string; role: string } | null;
  onClose: () => void;
}

const field: React.CSSProperties = {
  padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--foreground)', fontSize: '1rem',
};
const btn = (primary = false): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: '10px',
  cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem',
  border: primary ? 'none' : '1px solid var(--border)',
  background: primary ? 'var(--primary)' : 'var(--surface)', color: primary ? 'white' : 'var(--foreground)',
});
const chip = (active: boolean): React.CSSProperties => ({
  padding: '6px 12px', borderRadius: '999px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
  border: active ? '1px solid var(--primary)' : '1px solid var(--border)',
  background: active ? 'var(--primary)' : 'var(--surface)', color: active ? 'white' : 'var(--foreground)',
});

export default function TemplatesModal({ user, onClose }: Props) {
  const [templates, setTemplates] = useState<TemplateMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState<Subject | 'Alle'>('Alle');
  const [grade, setGrade] = useState<number>(0);
  const [query, setQuery] = useState('');
  const [sharing, setSharing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => {
    setError(null);
    fetch('/api/templates')
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => setTemplates(data.templates))
      .catch(() => { setTemplates([]); setError('Vorlagen konnten nicht geladen werden.'); });
  };
  useEffect(load, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (templates ?? []).filter((t) =>
      (subject === 'Alle' || t.subject === subject) &&
      (grade === 0 || t.grades.length === 0 || t.grades.includes(grade)) &&
      (!q || `${t.name} ${t.description} ${t.ownerName}`.toLowerCase().includes(q))
    );
  }, [templates, subject, grade, query]);

  const grouped = SUBJECTS.map((s) => ({ subject: s, items: visible.filter((t) => t.subject === s) })).filter((g) => g.items.length > 0);

  const openCopy = async (t: TemplateMeta) => {
    setBusy(t.id);
    try {
      const res = await fetch(`/api/templates/${t.id}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      if (!await saveBeforeLeaving()) return;
      const store = useWhiteboardStore.getState();
      const name = `${t.name} (Kopie)`;
      store.loadNotebookState(uuidv4(), name, data.pages, data.journalImages ?? []);
      // mark the copy as changed, so autosave stores it in the teacher's own notebooks
      store.renameNotebook(name);
      onClose();
    } catch {
      setError('Die Vorlage konnte nicht geöffnet werden.');
    } finally {
      setBusy(null);
    }
  };

  const withdraw = async (t: TemplateMeta) => {
    if (!window.confirm(`Vorlage „${t.name}“ zurückziehen? Bereits geöffnete Kopien bleiben erhalten.`)) return;
    setBusy(t.id);
    const res = await fetch(`/api/templates/${t.id}`, { method: 'DELETE' }).catch(() => null);
    setBusy(null);
    if (res?.ok) setTemplates((list) => (list ?? []).filter((x) => x.id !== t.id));
    else setError('Die Vorlage konnte nicht entfernt werden.');
  };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--foreground)', borderRadius: '16px', width: 'min(960px, 100%)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '18px 20px 10px' }}>
          <h2 style={{ margin: 0, fontSize: '1.4rem', flex: 1 }}>{sharing ? 'Tafelheft als Vorlage freigeben' : 'Vorlagen der Schule'}</h2>
          {!sharing && <button style={btn(true)} onClick={() => setSharing(true)}><Share2 size={16} /> Aktuelles Heft freigeben</button>}
          <button onClick={onClose} aria-label="Schließen" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--foreground)' }}><X size={24} /></button>
        </div>

        {sharing ? (
          <ShareForm
            user={user}
            templates={templates ?? []}
            onCancel={() => setSharing(false)}
            onShared={() => { setSharing(false); load(); }}
          />
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '0 20px 12px' }}>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {(['Alle', ...SUBJECTS] as const).map((s) => (
                  <button key={s} style={chip(subject === s)} onClick={() => setSubject(s)}>{s}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                {[0, ...GRADES].map((g) => (
                  <button key={g} style={chip(grade === g)} onClick={() => setGrade(g)}>{g === 0 ? 'Alle Klassen' : `Klasse ${g}`}</button>
                ))}
                <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', ...field, padding: '4px 10px' }}>
                  <Search size={16} />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Suchen …" style={{ border: 'none', outline: 'none', background: 'transparent', color: 'inherit', fontSize: '1rem', width: '160px' }} />
                </label>
              </div>
            </div>
            <div style={{ overflowY: 'auto', padding: '0 20px 20px' }}>
              {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
              {!templates ? <p>Lade Vorlagen …</p>
                : grouped.length === 0 ? (
                  <p style={{ opacity: 0.7 }}>
                    {templates.length === 0 ? 'Noch keine Vorlagen freigegeben. Teile dein erstes Tafelheft mit „Aktuelles Heft freigeben“.' : 'Keine Vorlage passt zu dieser Auswahl.'}
                  </p>
                ) : grouped.map((group) => (
                  <section key={group.subject} style={{ marginTop: '10px' }}>
                    <h3 style={{ margin: '8px 0', fontSize: '1.05rem' }}>{group.subject} <span style={{ opacity: 0.6, fontWeight: 400 }}>({group.items.length})</span></h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '12px' }}>
                      {group.items.map((t) => {
                        const mine = t.ownerId === user?.id;
                        return (
                          <div key={t.id} style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ aspectRatio: '16/9', background: '#f8fafc', backgroundImage: t.thumbnail ? `url("${t.thumbnail}")` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', borderBottom: '1px solid var(--border)' }} />
                            <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                              <strong style={{ fontSize: '1rem' }}>{t.name}</strong>
                              <span style={{ fontSize: '0.8rem', opacity: 0.75 }}>{gradeLabel(t.grades)} · {t.pageCount} {t.pageCount === 1 ? 'Seite' : 'Seiten'}</span>
                              <span style={{ fontSize: '0.8rem', opacity: 0.75 }}>von {mine ? 'dir' : t.ownerName} · {new Date(t.updatedAt).toLocaleDateString('de-DE')}</span>
                              {t.description && <span style={{ fontSize: '0.85rem' }}>{t.description}</span>}
                              <div style={{ display: 'flex', gap: '6px', marginTop: 'auto', paddingTop: '8px' }}>
                                <button style={{ ...btn(true), flex: 1, justifyContent: 'center' }} disabled={busy === t.id} onClick={() => openCopy(t)}>
                                  <Copy size={15} /> Als Kopie öffnen
                                </button>
                                {(mine || user?.role === 'admin') && (
                                  <button style={{ ...btn(), color: 'var(--danger)' }} disabled={busy === t.id} onClick={() => withdraw(t)} title="Vorlage zurückziehen" aria-label="Vorlage zurückziehen">
                                    <Trash2 size={15} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ShareForm({ user, templates, onCancel, onShared }: {
  user: Props['user']; templates: TemplateMeta[]; onCancel: () => void; onShared: () => void;
}) {
  const notebookId = useWhiteboardStore((s) => s.notebookId);
  const notebookName = useWhiteboardStore((s) => s.notebookName);
  const existing = templates.find((t) => t.ownerId === user?.id && t.sourceNotebookId === notebookId);
  const [name, setName] = useState(existing?.name ?? notebookName ?? '');
  const [subject, setSubject] = useState<Subject>(existing?.subject ?? 'Deutsch');
  const [grades, setGrades] = useState<number[]>(existing?.grades ?? []);
  const [description, setDescription] = useState(existing?.description ?? '');
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    setState('busy');
    setMessage(null);
    const store = useWhiteboardStore.getState();
    store.canvasFlush?.(); // include what is on the board right now
    const { pages, journalImages } = useWhiteboardStore.getState();
    if (!pages.some((p) => (p.canvasData as { objects?: unknown[] } | null)?.objects?.length)) {
      setState('error');
      setMessage('Das Tafelheft ist noch leer.');
      return;
    }
    const thumbnail = await renderThumbnail(pages[0].canvasData);
    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, subject, grades, description, thumbnail, pages, journalImages, sourceNotebookId: notebookId }),
    }).catch(() => null);
    if (res?.ok) {
      onShared();
    } else {
      setState('error');
      setMessage(res?.status === 413 ? 'Das Tafelheft ist zu groß für eine Freigabe.' : 'Die Freigabe ist fehlgeschlagen. Bitte erneut versuchen.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '4px 20px 20px', overflowY: 'auto' }}>
      {existing && (
        <p style={{ margin: 0, padding: '8px 12px', borderRadius: '8px', background: 'rgba(59,130,246,0.1)' }}>
          Dieses Heft hast du schon freigegeben. Mit „Freigabe aktualisieren“ ersetzt du die Vorlage durch den aktuellen Stand.
        </p>
      )}
      <label style={{ fontWeight: 700, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        Name der Vorlage
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Einführung Zehnerübergang" style={field} maxLength={120} />
      </label>
      <div style={{ fontWeight: 700 }}>
        Fach
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
          {SUBJECTS.map((s) => <button key={s} style={chip(subject === s)} onClick={() => setSubject(s)}>{s}</button>)}
        </div>
      </div>
      <div style={{ fontWeight: 700 }}>
        Jahrgang <span style={{ fontWeight: 400, opacity: 0.7 }}>(keiner gewählt = für alle Klassen)</span>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
          {GRADES.map((g) => (
            <button key={g} style={chip(grades.includes(g))} onClick={() => setGrades((list) => (list.includes(g) ? list.filter((x) => x !== g) : [...list, g].sort()))}>
              Klasse {g}
            </button>
          ))}
        </div>
      </div>
      <label style={{ fontWeight: 700, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        Kurze Beschreibung <span style={{ fontWeight: 400, opacity: 0.7 }}>(optional)</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={500} style={{ ...field, fontFamily: 'inherit' }} />
      </label>
      <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.75 }}>
        Kolleginnen öffnen immer eine eigene Kopie – deine Vorlage bleibt unverändert. Du kannst sie jederzeit aktualisieren oder zurückziehen.
      </p>
      {message && <p style={{ margin: 0, color: 'var(--danger)' }}>{message}</p>}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button style={btn(true)} disabled={state === 'busy' || !name.trim()} onClick={submit}>
          <Share2 size={16} /> {state === 'busy' ? 'Wird freigegeben …' : existing ? 'Freigabe aktualisieren' : 'Freigeben'}
        </button>
        <button style={btn()} onClick={onCancel}>Abbrechen</button>
      </div>
    </div>
  );
}
