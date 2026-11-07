'use client';

// German reading tools in a large panel over the board (not part of the notebook):
// Blitzlesen (flash reading) and Silbenrutsche (syllable slide).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Zap, MoveDownRight } from 'lucide-react';
import { useWhiteboardStore } from '@/store/useWhiteboardStore';
import {
  BUILT_IN_LISTS, SLIDE_CONSONANTS, SLIDE_VOWELS, parseWords, toReadingWord,
  type ReadingWord, type WordList,
} from '@/lib/wordlists';

const SYLLABLE_COLORS = ['#1d4ed8', '#dc2626']; // blue / red, as in the syllable method
const READING_FONT = 'Grundschrift, Arial, sans-serif';

const btn = (primary = false): React.CSSProperties => ({
  padding: '10px 16px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '1rem',
  border: primary ? 'none' : '1px solid var(--border)',
  background: primary ? 'var(--primary)' : 'var(--surface)', color: primary ? 'white' : 'var(--foreground)',
});
const chip = (active: boolean): React.CSSProperties => ({
  padding: '6px 12px', borderRadius: '999px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
  border: active ? '1px solid var(--primary)' : '1px solid var(--border)',
  background: active ? 'var(--primary)' : 'var(--surface)', color: active ? 'white' : 'var(--foreground)',
});
const field: React.CSSProperties = {
  padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--foreground)', fontSize: '1rem',
};

function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'de-DE';
  utterance.rate = 0.8;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

// A word in the chosen display style: plain, coloured syllables or syllable arcs
function Word({ word, style, upper, size }: { word: ReadingWord; style: 'plain' | 'colored' | 'arcs'; upper: boolean; size: string }) {
  const parts = word.syllables.length ? word.syllables : [word.text];
  const shown = (s: string) => (upper ? s.toUpperCase() : s);
  return (
    <span style={{ fontFamily: READING_FONT, fontSize: size, lineHeight: 1.3, whiteSpace: 'nowrap' }}>
      {style === 'plain'
        ? shown(word.text)
        : parts.map((s, i) => (
            <span
              key={i}
              style={style === 'colored'
                ? { color: SYLLABLE_COLORS[i % 2] }
                : { display: 'inline-block', paddingBottom: '0.08em', margin: '0 0.02em', borderBottom: '0.06em solid #1e293b', borderRadius: '0 0 50% 50% / 0 0 60% 60%' }}
            >
              {shown(s)}
            </span>
          ))}
    </span>
  );
}

// --- Word lists (built-in + own) ----------------------------------------------------------

function useWordLists() {
  const [own, setOwn] = useState<WordList[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/wordlists')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => setOwn(d.lists))
      .catch(() => setError('Eigene Wortlisten konnten nicht geladen werden.'));
  }, []);
  const save = async (lists: WordList[]) => {
    const res = await fetch('/api/wordlists', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lists }) }).catch(() => null);
    if (!res?.ok) { setError('Speichern fehlgeschlagen.'); return false; }
    setOwn((await res.json()).lists);
    setError(null);
    return true;
  };
  return { lists: [...BUILT_IN_LISTS, ...own], own, save, error };
}

const DICT = '__woerterbuch__';

// Plays the dictionary recording if there is one, otherwise the browser's speech output
function playWord(word: ReadingWord) {
  if (word.audio) {
    new Audio(word.audio).play().catch(() => speak(word.text));
  } else {
    speak(word.text);
  }
}

interface DictFilters { categories: { category: string; count: number }[]; partsOfSpeech: { part_of_speech: string; count: number }[] }

// Where the words come from: start lists, own lists or the Grundschul-Wörterbuch
function useWordSource(initialId: string) {
  const { lists, own, save, error } = useWordLists();
  const [selection, setSelection] = useState(initialId);
  const [dict, setDict] = useState<{ label: string; words: ReadingWord[] } | null>(null);
  const [filters, setFilters] = useState<DictFilters | null>(null);
  useEffect(() => {
    fetch('/api/woerterbuch/filters')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setFilters(d))
      .catch(() => undefined); // dictionary not connected: only own/start lists
  }, []);
  const list = lists.find((l) => l.id === selection) ?? BUILT_IN_LISTS[0];
  const words = useMemo(
    () => (selection === DICT ? dict?.words ?? [] : list.words.map(toReadingWord)),
    [selection, dict, list],
  );
  const applyDict = (label: string, dictWords: ReadingWord[]) => { setDict({ label, words: dictWords }); setSelection(DICT); };
  return { lists, own, save, error, selection, setSelection, dict, applyDict, filters, words };
}
type WordSource = ReturnType<typeof useWordSource>;

function ListPicker({ source, onChange, onEdit, onDict }: { source: WordSource; onChange?: () => void; onEdit?: () => void; onDict: () => void }) {
  const { lists, selection, setSelection, dict, filters } = source;
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
      <select value={selection} onChange={(e) => { setSelection(e.target.value); onChange?.(); }} style={{ ...field, flex: 1, minWidth: '200px' }}>
        {dict && <option value={DICT}>Wörterbuch: {dict.label} ({dict.words.length})</option>}
        <optgroup label="Startlisten">
          {lists.filter((l) => l.builtIn).map((l) => <option key={l.id} value={l.id}>{l.name} ({l.words.length})</option>)}
        </optgroup>
        {lists.some((l) => !l.builtIn) && (
          <optgroup label="Eigene Listen">
            {lists.filter((l) => !l.builtIn).map((l) => <option key={l.id} value={l.id}>{l.name} ({l.words.length})</option>)}
          </optgroup>
        )}
      </select>
      {filters && <button style={btn()} onClick={onDict}>Aus dem Wörterbuch …</button>}
      {onEdit && <button style={btn()} onClick={onEdit}>Eigene Listen …</button>}
    </div>
  );
}

// Choose words from the Grundschul-Wörterbuch by category, syllables, known letters …
function DictionaryPicker({ filters, onLoaded, onCancel, minSyllables = 1 }: {
  filters: DictFilters; onLoaded: (label: string, words: ReadingWord[]) => void; onCancel: () => void; minSyllables?: number;
}) {
  const [category, setCategory] = useState('');
  const [partOfSpeech, setPartOfSpeech] = useState('');
  const [syllables, setSyllables] = useState<number | null>(minSyllables > 1 ? minSyllables : null);
  const [letters, setLetters] = useState('');
  const [contains, setContains] = useState('');
  const [withImage, setWithImage] = useState(true);
  const [count, setCount] = useState(20);
  const [state, setState] = useState<{ busy: boolean; message: string | null }>({ busy: false, message: null });

  const load = async () => {
    const params = new URLSearchParams({ anzahl: String(count), zufall: '1' });
    if (category) params.set('kategorie', category);
    if (partOfSpeech) params.set('wortart', partOfSpeech);
    if (syllables === 4) params.set('silben_min', '4');
    else if (syllables) params.set('silben', String(syllables));
    else if (minSyllables > 1) params.set('silben_min', String(minSyllables));
    if (letters.trim()) params.set('buchstaben', letters.trim());
    if (contains.trim()) params.set('enthaelt', contains.trim());
    if (withImage) params.set('mit_bild', '1');
    setState({ busy: true, message: null });
    const res = await fetch(`/api/woerterbuch/words?${params}`).catch(() => null);
    if (!res?.ok) { setState({ busy: false, message: 'Das Wörterbuch ist gerade nicht erreichbar.' }); return; }
    const data = await res.json();
    if (!data.words.length) { setState({ busy: false, message: 'Keine Wörter gefunden – lockere die Auswahl etwas.' }); return; }
    const label = [category, partOfSpeech, syllables ? (syllables === 4 ? '4+ Silben' : `${syllables} Silbe${syllables > 1 ? 'n' : ''}`) : '', letters && `nur ${letters.toUpperCase()}`, contains && `mit „${contains}“`]
      .filter(Boolean).join(', ') || 'gemischt';
    onLoaded(label, data.words);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <strong style={{ fontSize: '1.1rem' }}>Wörter aus dem Grundschul-Wörterbuch</strong>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontWeight: 700, flex: 1, minWidth: '200px' }}>
          Rechtschreibkategorie
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={field}>
            <option value="">alle</option>
            {filters.categories.map((c) => <option key={c.category} value={c.category}>{c.category} ({c.count})</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontWeight: 700, flex: 1, minWidth: '160px' }}>
          Wortart
          <select value={partOfSpeech} onChange={(e) => setPartOfSpeech(e.target.value)} style={field}>
            <option value="">alle</option>
            {filters.partsOfSpeech.map((p) => <option key={p.part_of_speech} value={p.part_of_speech}>{p.part_of_speech} ({p.count})</option>)}
          </select>
        </label>
      </div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
        <strong style={{ marginRight: '4px' }}>Silben</strong>
        {minSyllables <= 1 && <button style={chip(syllables === null)} onClick={() => setSyllables(null)}>alle</button>}
        {[1, 2, 3, 4].filter((n) => n >= minSyllables).map((n) => (
          <button key={n} style={chip(syllables === n)} onClick={() => setSyllables(n)}>{n === 4 ? '4 und mehr' : n}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontWeight: 700, flex: 2, minWidth: '220px' }}>
          Nur diese Buchstaben (schon gelernt)
          <input value={letters} onChange={(e) => setLetters(e.target.value)} placeholder="z. B. M A L O I E" style={field} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontWeight: 700, flex: 1, minWidth: '140px' }}>
          Enthält
          <input value={contains} onChange={(e) => setContains(e.target.value)} placeholder="z. B. au" style={field} />
        </label>
      </div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button style={chip(withImage)} onClick={() => setWithImage((v) => !v)}>nur Wörter mit Bild</button>
        <strong style={{ margin: '0 4px 0 12px' }}>Anzahl</strong>
        {[10, 20, 30, 50].map((n) => <button key={n} style={chip(count === n)} onClick={() => setCount(n)}>{n}</button>)}
      </div>
      {state.message && <p style={{ margin: 0, color: 'var(--danger)' }}>{state.message}</p>}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button style={btn(true)} onClick={load} disabled={state.busy}>{state.busy ? 'Wird geladen …' : 'Wörter holen'}</button>
        <button style={btn()} onClick={onCancel}>Zurück</button>
      </div>
    </div>
  );
}

function ListEditor({ own, save, error, onClose }: { own: WordList[]; save: (l: WordList[]) => Promise<boolean>; error: string | null; onClose: (selectId?: string) => void }) {
  const [selected, setSelected] = useState<string | null>(own[0]?.id ?? null);
  return (
    <ListForm
      key={selected ?? 'new'}
      own={own} save={save} error={error} onClose={onClose}
      current={own.find((l) => l.id === selected)}
      onSelect={setSelected}
    />
  );
}

function ListForm({ own, save, error, onClose, current, onSelect }: {
  own: WordList[]; save: (l: WordList[]) => Promise<boolean>; error: string | null; onClose: (selectId?: string) => void;
  current: WordList | undefined; onSelect: (id: string | null) => void;
}) {
  const selected = current?.id ?? null;
  const setSelected = onSelect;
  const [name, setName] = useState(current?.name ?? '');
  const [text, setText] = useState(current?.words.join('\n') ?? '');
  const words = parseWords(text);
  const preview = words.slice(0, 8).map((w) => toReadingWord(w).syllables.join('-'));

  const submit = async () => {
    const entry: WordList = { id: current?.id ?? crypto.randomUUID(), name: name.trim() || 'Wortliste', words };
    const next = current ? own.map((l) => (l.id === current.id ? entry : l)) : [...own, entry];
    if (await save(next)) onClose(entry.id);
  };
  const remove = async () => {
    if (!current || !window.confirm(`Liste „${current.name}“ löschen?`)) return;
    if (await save(own.filter((l) => l.id !== current.id))) { setSelected(null); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {own.map((l) => <button key={l.id} style={chip(l.id === selected)} onClick={() => setSelected(l.id)}>{l.name}</button>)}
        <button style={chip(selected === null)} onClick={() => setSelected(null)}>+ Neue Liste</button>
      </div>
      <label style={{ fontWeight: 700, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        Name der Liste
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Wörter mit Au" style={field} />
      </label>
      <label style={{ fontWeight: 700, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        Wörter – eins pro Zeile ({words.length})
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={9} placeholder={'Au-to\nBaum\nMau-er'} style={{ ...field, fontFamily: 'inherit' }} />
      </label>
      <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.75 }}>
        Silben werden automatisch erkannt. Wo die Trennung nicht stimmt, setze Bindestriche: <code>Fe-ri-en</code>.
        {preview.length > 0 && <> Vorschau: <strong>{preview.join(' · ')}</strong></>}
      </p>
      {error && <p style={{ margin: 0, color: 'var(--danger)' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button style={btn(true)} disabled={words.length === 0} onClick={submit}>Speichern</button>
        <button style={btn()} onClick={() => onClose()}>Zurück</button>
        {current && <button style={{ ...btn(), marginLeft: 'auto', color: 'var(--danger)' }} onClick={remove}>Liste löschen</button>}
      </div>
    </div>
  );
}

// --- Blitzlesen -------------------------------------------------------------------------------

type Phase = 'idle' | 'ready' | 'show' | 'hidden' | 'revealed' | 'done';

function Blitzlesen() {
  const source = useWordSource(BUILT_IN_LISTS[0].id);
  const { own, save, error, words: sourceWords } = source;
  const [view, setView] = useState<'settings' | 'edit' | 'dict'>('settings');
  const editing = view !== 'settings';
  const [showImage, setShowImage] = useState(true);
  const [duration, setDuration] = useState(800);
  const [auto, setAuto] = useState(false);
  const [random, setRandom] = useState(true);
  const [display, setDisplay] = useState<'plain' | 'colored' | 'arcs'>('plain');
  const [upper, setUpper] = useState(false);
  const [faster, setFaster] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [queue, setQueue] = useState<ReadingWord[]>([]);
  const [index, setIndex] = useState(0);
  const [currentDuration, setCurrentDuration] = useState(duration);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  useEffect(() => clear, []);

  const flash = (i: number, ms: number) => {
    clear();
    setIndex(i);
    setPhase('ready'); // short fixation dot
    timer.current = setTimeout(() => {
      setPhase('show');
      timer.current = setTimeout(() => {
        setPhase('hidden');
        if (auto) timer.current = setTimeout(() => setPhase('revealed'), 1800);
      }, ms);
    }, 700);
  };

  const start = () => {
    const words = sourceWords;
    const order = random ? [...words].sort(() => Math.random() - 0.5) : words;
    setQueue(order);
    setCurrentDuration(duration);
    flash(0, duration);
  };
  const next = () => {
    if (index + 1 >= queue.length) { clear(); setPhase('done'); return; }
    const ms = faster ? Math.max(150, Math.round(currentDuration * 0.9)) : currentDuration;
    setCurrentDuration(ms);
    flash(index + 1, ms);
  };
  const again = () => flash(index, currentDuration);

  // automatic mode: after revealing, continue with the next word
  useEffect(() => {
    if (!auto || phase !== 'revealed') return;
    timer.current = setTimeout(() => next(), 1600);
    return clear;
  }, [phase, auto]); // eslint-disable-line react-hooks/exhaustive-deps

  const tapStage = () => {
    if (phase === 'hidden') setPhase('revealed');
    else if (phase === 'revealed') next();
  };

  // keyboard: Space/Enter = continue, A = again
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase === 'idle' || phase === 'done' || editing) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); tapStage(); }
      if (e.key === 'a' || e.key === 'A') again();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (view === 'edit') {
    return <ListEditor own={own} save={save} error={error} onClose={(id) => { setView('settings'); if (id) source.setSelection(id); }} />;
  }
  if (view === 'dict' && source.filters) {
    return <DictionaryPicker filters={source.filters} onCancel={() => setView('settings')} onLoaded={(label, w) => { source.applyDict(label, w); setView('settings'); }} />;
  }

  if (phase === 'idle' || phase === 'done') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {phase === 'done' && <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Geschafft! {queue.length} Wörter gelesen.</p>}
        <ListPicker source={source} onEdit={() => setView('edit')} onDict={() => setView('dict')} />
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <strong>Anzeigedauer</strong>
          <input type="range" min={150} max={3000} step={50} value={duration} onChange={(e) => setDuration(Number(e.target.value))} style={{ flex: 1, minWidth: '160px' }} />
          <span style={{ minWidth: '70px', fontWeight: 700 }}>{(duration / 1000).toFixed(2).replace('.', ',')} s</span>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <strong style={{ marginRight: '4px' }}>Darstellung</strong>
          <button style={chip(display === 'plain')} onClick={() => setDisplay('plain')}>normal</button>
          <button style={chip(display === 'colored')} onClick={() => setDisplay('colored')}>Silben farbig</button>
          <button style={chip(display === 'arcs')} onClick={() => setDisplay('arcs')}>Silbenbögen</button>
          <button style={chip(upper)} onClick={() => setUpper((u) => !u)}>GROSSBUCHSTABEN</button>
          {sourceWords.some((w) => w.image) && <button style={chip(showImage)} onClick={() => setShowImage((v) => !v)}>Bild beim Auflösen</button>}
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <strong style={{ marginRight: '4px' }}>Ablauf</strong>
          <button style={chip(!auto)} onClick={() => setAuto(false)}>weiter per Tippen</button>
          <button style={chip(auto)} onClick={() => setAuto(true)}>automatisch</button>
          <button style={chip(random)} onClick={() => setRandom((r) => !r)}>zufällige Reihenfolge</button>
          <button style={chip(faster)} onClick={() => setFaster((f) => !f)}>immer schneller</button>
        </div>
        <div style={{ textAlign: 'center', padding: '10px', minHeight: '90px', borderRadius: '12px', background: 'rgba(59,130,246,0.06)' }}>
          <span style={{ fontSize: '0.8rem', opacity: 0.6, display: 'block' }}>Beispiel</span>
          <Word word={sourceWords[0] ?? toReadingWord('Ba-na-ne')} style={display} upper={upper} size="3rem" />
        </div>
        <button style={{ ...btn(true), fontSize: '1.3rem', padding: '16px' }} onClick={start} disabled={sourceWords.length === 0}>
          <Zap size={20} style={{ verticalAlign: 'middle' }} /> Blitzlesen starten
        </button>
      </div>
    );
  }

  const word = queue[index];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
      <div
        onClick={tapStage}
        style={{ flex: 1, minHeight: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '16px', background: '#ffffff', border: '2px solid var(--border)', cursor: 'pointer', color: '#0f172a', userSelect: 'none' }}
      >
        {phase === 'ready' && <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#94a3b8' }} />}
        {(phase === 'show' || phase === 'revealed') && word && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4%', justifyContent: 'center', width: '100%' }}>
            {/* picture for self-checking, only after the word was read */}
            {phase === 'revealed' && showImage && word.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={word.image} alt="" style={{ maxHeight: '220px', maxWidth: '32%', objectFit: 'contain', borderRadius: '12px' }} />
            )}
            <Word word={word} style={display} upper={upper} size="clamp(3rem, 11vw, 9rem)" />
          </div>
        )}
        {phase === 'hidden' && <span style={{ fontSize: '4rem', color: '#cbd5e1', fontWeight: 800 }}>?</span>}
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700 }}>{index + 1} / {queue.length}</span>
        <span style={{ opacity: 0.7 }}>{(currentDuration / 1000).toFixed(2).replace('.', ',')} s</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button style={btn()} onClick={again} title="Taste A">Nochmal blitzen</button>
          {phase === 'hidden' && <button style={btn()} onClick={() => setPhase('revealed')}>Auflösen</button>}
          {word && <button style={btn()} onClick={() => playWord(word)}>Vorlesen</button>}
          <button style={btn(true)} onClick={next} title="Leertaste">Weiter</button>
          <button style={btn()} onClick={() => { clear(); setPhase('idle'); }}>Beenden</button>
        </div>
      </div>
    </div>
  );
}

// --- Silbenrutsche --------------------------------------------------------------------------

function Silbenrutsche() {
  const [mode, setMode] = useState<'anlaut' | 'woerter'>('anlaut');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
      <div style={{ display: 'flex', gap: '6px' }}>
        <button style={chip(mode === 'anlaut')} onClick={() => setMode('anlaut')}>Laut rutscht zum Vokal</button>
        <button style={chip(mode === 'woerter')} onClick={() => setMode('woerter')}>Silben rutschen zum Wort</button>
      </div>
      {mode === 'anlaut' ? <AnlautRutsche /> : <WortRutsche />}
    </div>
  );
}

// A consonant slides down to a vowel and both merge into a syllable (M + a → Ma)
function AnlautRutsche() {
  const [consonant, setConsonant] = useState('M');
  const [target, setTarget] = useState<number | null>(null);
  const [landed, setLanded] = useState(false);
  const [moving, setMoving] = useState(false); // letter on its way down the slide
  const [voice, setVoice] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const H = 420;
  const rowH = H / SLIDE_VOWELS.length;
  const slide = (i: number) => {
    if (timer.current) clearTimeout(timer.current);
    setTarget(null);
    setLanded(false);
    setMoving(false);
    // restart the animation from the top
    requestAnimationFrame(() => requestAnimationFrame(() => {
      setTarget(i);
      setMoving(true);
      timer.current = setTimeout(() => {
        setLanded(true);
        setMoving(false); // the letter is back at the top, ready for the next ride
        if (voice) speak((consonant + SLIDE_VOWELS[i]).toLowerCase());
      }, 900);
    }));
  };
  const syllable = target !== null ? consonant + SLIDE_VOWELS[target] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
        {SLIDE_CONSONANTS.map((c) => (
          <button key={c} style={{ ...chip(c === consonant), fontFamily: READING_FONT, fontSize: '1.1rem' }} onClick={() => { setConsonant(c); setTarget(null); setLanded(false); }}>{c}</button>
        ))}
        <button style={{ ...chip(voice), marginLeft: 'auto' }} onClick={() => setVoice((v) => !v)}>🔊 Vorlesen</button>
      </div>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'stretch' }}>
        <div style={{ position: 'relative', flex: 1, height: H, borderRadius: '16px', background: '#ffffff', border: '2px solid var(--border)', overflow: 'hidden', color: '#0f172a' }}>
          {/* the slide: rails from the top left to every vowel */}
          <svg width="100%" height={H} viewBox={`0 0 600 ${H}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
            {SLIDE_VOWELS.map((_, i) => (
              <path key={i} d={`M 90 50 C 260 50, 330 ${i * rowH + rowH / 2}, 470 ${i * rowH + rowH / 2}`} fill="none"
                stroke={target === i ? '#f59e0b' : '#e2e8f0'} strokeWidth={target === i ? 14 : 8} strokeLinecap="round" />
            ))}
          </svg>
          <button
            onClick={() => slide(Math.floor(Math.random() * SLIDE_VOWELS.length))}
            title="Zufällig rutschen"
            style={{
              position: 'absolute', zIndex: 2, width: 90, height: 72, borderRadius: '14px', border: '3px solid #1d4ed8', background: '#dbeafe',
              fontFamily: READING_FONT, fontSize: '2.6rem', color: '#1d4ed8', cursor: 'pointer',
              left: moving && target !== null ? '64%' : '4%',
              top: moving && target !== null ? target * rowH + rowH / 2 - 36 : 14,
              transition: moving ? 'left 0.9s cubic-bezier(.55,0,.9,.6), top 0.9s cubic-bezier(.2,.6,.4,1)' : 'none',
            }}
          >
            {consonant}
          </button>
          {SLIDE_VOWELS.map((v, i) => (
            <button
              key={v}
              onClick={() => slide(i)}
              style={{
                position: 'absolute', right: '4%', top: i * rowH + 4, height: rowH - 8, minWidth: 120, borderRadius: '12px', cursor: 'pointer',
                border: target === i && landed ? '3px solid #dc2626' : '2px solid #fecaca', background: target === i && landed ? '#fee2e2' : '#fff7f7',
                fontFamily: READING_FONT, fontSize: 'clamp(1.4rem, 3vw, 2.2rem)', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '0 10px',
              }}
            >
              {target === i && landed && <span style={{ color: '#1d4ed8' }}>{consonant}</span>}
              <span style={{ color: '#dc2626' }}>{v}</span>
            </button>
          ))}
        </div>
        <div style={{ width: '32%', minWidth: 170, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: '16px', background: 'rgba(59,130,246,0.06)' }}>
          <span style={{ opacity: 0.6 }}>Silbe</span>
          <span style={{ fontFamily: READING_FONT, fontSize: 'clamp(3rem, 8vw, 6rem)', minHeight: '1.3em' }}>
            {syllable && landed && <><span style={{ color: '#1d4ed8' }}>{consonant}</span><span style={{ color: '#dc2626' }}>{SLIDE_VOWELS[target!]}</span></>}
          </span>
          <button style={btn(true)} onClick={() => slide(Math.floor(Math.random() * SLIDE_VOWELS.length))}>Zufällig rutschen</button>
        </div>
      </div>
    </div>
  );
}

// The syllables of a word slide together and form the word (Ba · na · ne → Banane)
function WortRutsche() {
  const source = useWordSource(BUILT_IN_LISTS[1].id);
  const words = useMemo(() => source.words.filter((w) => w.syllables.length > 1), [source.words]);
  const [index, setIndex] = useState(0);
  const [joined, setJoined] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const word = words[index % Math.max(1, words.length)];
  const restart = () => { setIndex(0); setJoined(false); };

  if (choosing && source.filters) {
    return <DictionaryPicker filters={source.filters} minSyllables={2} onCancel={() => setChoosing(false)} onLoaded={(label, w) => { source.applyDict(label, w); restart(); setChoosing(false); }} />;
  }
  const picker = <ListPicker source={source} onChange={restart} onDict={() => setChoosing(true)} />;
  if (!word) return <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>{picker}<p>Diese Liste enthält keine mehrsilbigen Wörter.</p></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {picker}
      <div style={{ minHeight: 280, borderRadius: '16px', background: '#ffffff', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f172a', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: joined ? 0 : '1.2em', transition: 'gap 0.9s cubic-bezier(.3,.7,.2,1)' }}>
          {word.syllables.map((s, i) => (
            <span
              key={`${index}-${i}`}
              style={{
                fontFamily: READING_FONT, fontSize: 'clamp(3rem, 9vw, 7rem)', color: SYLLABLE_COLORS[i % 2],
                display: 'inline-block', transform: joined ? 'translateY(0)' : `translateY(${-30 + i * 22}px)`,
                transition: 'transform 0.9s cubic-bezier(.3,.7,.2,1)',
              }}
            >
              {s}
            </span>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700 }}>{(index % words.length) + 1} / {words.length}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          {!joined
            ? <button style={btn(true)} onClick={() => setJoined(true)}><MoveDownRight size={16} style={{ verticalAlign: 'middle' }} /> Zusammenrutschen</button>
            : <button style={btn()} onClick={() => playWord(word)}>Vorlesen</button>}
          <button style={btn()} onClick={() => { setJoined(false); setIndex((i) => (i + 1) % words.length); }}>Nächstes Wort</button>
        </div>
      </div>
    </div>
  );
}

// --- Panel ----------------------------------------------------------------------------------

export default function DeutschTools() {
  const tool = useWhiteboardStore((s) => s.deutschTool);
  const setTool = useWhiteboardStore((s) => s.setDeutschTool);
  if (!tool) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 16px 96px', background: 'rgba(15,23,42,0.25)' }}>
      <div style={{ width: 'min(1100px, 100%)', maxHeight: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', background: 'var(--surface)', color: 'var(--foreground)', borderRadius: '18px', boxShadow: '0 16px 50px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 14px 6px' }}>
          <button style={chip(tool === 'blitz')} onClick={() => setTool('blitz')}><Zap size={15} style={{ verticalAlign: 'middle' }} /> Blitzlesen</button>
          <button style={chip(tool === 'rutsche')} onClick={() => setTool('rutsche')}>Silbenrutsche</button>
          <button onClick={() => setTool(null)} aria-label="Schließen" style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--foreground)' }}><X size={24} /></button>
        </div>
        <div style={{ padding: '8px 18px 18px', flex: 1 }}>
          {tool === 'blitz' ? <Blitzlesen /> : <Silbenrutsche />}
        </div>
      </div>
    </div>
  );
}

