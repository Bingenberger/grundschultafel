// Saving the open notebook: shared by the "Speichern" button and the automatic save.
import { v4 as uuidv4 } from 'uuid';
import { useWhiteboardStore, type Page } from '@/store/useWhiteboardStore';

export type SaveResult = 'saved' | 'skipped' | 'failed';

const store = () => useWhiteboardStore.getState();

export function hasUnsavedChanges() {
  const s = store();
  return s.revision !== s.savedRevision || s.saveState === 'saving';
}

function defaultName() {
  const now = new Date();
  return `Tafelheft ${now.toLocaleDateString('de-DE')} ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
}

function pageHasContent(page: Page) {
  const data = page.canvasData as { objects?: unknown[]; backgroundImage?: unknown } | null;
  return !!data && ((data.objects?.length ?? 0) > 0 || !!data.backgroundImage);
}

function errorText(status: number) {
  if (status === 401 || status === 403) {
    return 'Nicht gespeichert: Deine Anmeldung ist abgelaufen. Bitte in einem neuen Tab anmelden (diesen Tab offen lassen!) – danach wird automatisch weitergespeichert.';
  }
  if (status === 413) {
    return 'Nicht gespeichert: Das Heft ist zu groß (zu viele oder zu große Bilder). Bitte Bilder entfernen oder auf mehrere Hefte verteilen.';
  }
  return `Nicht gespeichert (Fehler ${status}). Es wird bei der nächsten Änderung erneut versucht.`;
}

async function runSave(auto: boolean): Promise<SaveResult> {
  // Bring the live canvas into the store first (pending changes, text being edited)
  store().canvasFlush?.();
  let s = store();
  if (auto && s.revision === s.savedRevision) return 'skipped';

  // An untouched new notebook (e.g. right after "Neues Tafelheft") is not worth creating
  if (!s.notebookId && !s.pages.some(pageHasContent) && s.journalImages.length === 0) {
    s.markSaved(s.revision, s.notebookGeneration);
    if (!auto) s.setSaveMessage({ kind: 'ok', text: 'Das Tafelheft ist noch leer – nichts zu speichern' });
    return 'skipped';
  }

  if (!s.notebookId || !s.notebookName) {
    s.setNotebook(s.notebookId || uuidv4(), s.notebookName || defaultName());
    s = store();
  }

  const { notebookId, notebookName, pages, journalImages, revision, notebookGeneration } = s;
  s.setSaveState('saving');
  try {
    const res = await fetch(`/api/notebooks/${notebookId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: notebookName, pages, journalImages }),
    });
    if (!res.ok) {
      store().setSaveState('error');
      store().setSaveMessage({ kind: 'error', text: errorText(res.status) });
      return 'failed';
    }
    store().markSaved(revision, notebookGeneration);
    store().setSaveState('idle');
    const previous = store().saveMessage;
    if (!auto) store().setSaveMessage({ kind: 'ok', text: 'Gespeichert' });
    else if (previous?.kind === 'error') store().setSaveMessage(null); // problem solved
    return 'saved';
  } catch (error) {
    console.error('Fehler beim Speichern!', error);
    store().setSaveState('error');
    store().setSaveMessage({ kind: 'error', text: 'Nicht gespeichert: Der Server ist nicht erreichbar. Es wird bei der nächsten Änderung erneut versucht.' });
    return 'failed';
  }
}

// Saves run strictly one after another, so an older request can never overwrite a newer one.
let queue: Promise<unknown> = Promise.resolve();
export function saveNotebook({ auto }: { auto: boolean }): Promise<SaveResult> {
  const run = queue.then(() => runSave(auto));
  queue = run.catch(() => undefined);
  return run;
}

// Before leaving the notebook (open another, new notebook, logout): save if needed.
// Returns true when it is safe to continue.
export async function saveBeforeLeaving(): Promise<boolean> {
  store().canvasFlush?.();
  if (!hasUnsavedChanges()) return true;
  const result = await saveNotebook({ auto: true });
  if (result !== 'failed') return true;
  return window.confirm('Das Tafelheft konnte nicht gespeichert werden. Trotzdem fortfahren? Die letzten Änderungen gehen dann verloren.');
}
