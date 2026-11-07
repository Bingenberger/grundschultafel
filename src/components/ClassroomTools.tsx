'use client';

// Floating classroom tools over the board: draw names, build groups, roll dice and a noise
// level traffic light. Nothing here is drawn onto the canvas or stored in the notebook;
// only the class lists are saved per teacher on the server (/api/classes).
import React, { useEffect, useRef, useState } from 'react';
import { X, Users, Shuffle, Dices, Volume2 } from 'lucide-react';
import { useWhiteboardStore, type ClassroomTool } from '@/store/useWhiteboardStore';

interface ClassList { name: string; students: string[] }

const TABS: { id: ClassroomTool; label: string; icon: React.ReactNode }[] = [
  { id: 'names', label: 'Namen ziehen', icon: <Shuffle size={16} /> },
  { id: 'groups', label: 'Gruppen', icon: <Users size={16} /> },
  { id: 'dice', label: 'Würfel', icon: <Dices size={16} /> },
  { id: 'noise', label: 'Lautstärke', icon: <Volume2 size={16} /> },
];

const randomInt = (n: number) => {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] % n;
};
function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const button = (primary = false): React.CSSProperties => ({
  padding: '10px 16px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '1rem',
  border: primary ? 'none' : '1px solid var(--border)',
  background: primary ? 'var(--primary)' : 'var(--surface)', color: primary ? 'white' : 'var(--foreground)',
});

export default function ClassroomTools() {
  const tool = useWhiteboardStore((s) => s.classroomTool);
  const setTool = useWhiteboardStore((s) => s.setClassroomTool);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  if (!tool) return null;

  const onDragStart = (e: React.PointerEvent) => {
    const rect = panelRef.current?.getBoundingClientRect();
    const parent = panelRef.current?.offsetParent?.getBoundingClientRect();
    if (!rect || !parent) return;
    drag.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: React.PointerEvent) => {
    const parent = panelRef.current?.offsetParent?.getBoundingClientRect();
    if (!drag.current || !parent) return;
    setPos({ x: Math.max(0, e.clientX - parent.left - drag.current.dx), y: Math.max(0, e.clientY - parent.top - drag.current.dy) });
  };

  return (
    <div
      ref={panelRef}
      style={{
        position: 'absolute', zIndex: 150,
        ...(pos ? { left: pos.x, top: pos.y } : { top: 16, left: '50%', transform: 'translateX(-50%)' }),
        width: 'min(520px, calc(100% - 32px))', maxHeight: 'calc(100% - 120px)', display: 'flex', flexDirection: 'column',
        background: 'var(--surface)', color: 'var(--foreground)', borderRadius: '16px',
        border: '1px solid var(--border)', boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
      }}
    >
      <div
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={() => { drag.current = null; }}
        style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 48px 0 10px', cursor: 'move', touchAction: 'none', flexWrap: 'wrap' }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setTool(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '10px', cursor: 'pointer',
              border: 'none', fontWeight: 700, fontSize: '0.85rem',
              background: tool === t.id ? 'var(--primary)' : 'transparent', color: tool === t.id ? 'white' : 'var(--foreground)',
            }}
          >
            {t.icon}{t.label}
          </button>
        ))}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setTool(null)}
          title="Schließen"
          aria-label="Schließen"
          style={{ position: 'absolute', top: '8px', right: '8px', border: 'none', background: 'transparent', color: 'var(--foreground)', cursor: 'pointer', padding: '8px' }}
        >
          <X size={20} />
        </button>
      </div>
      <div style={{ padding: '14px 16px 16px', overflowY: 'auto' }}>
        {(tool === 'names' || tool === 'groups') && <ClassTools mode={tool} />}
        {tool === 'dice' && <DiceTool />}
        {tool === 'noise' && <NoiseTool />}
      </div>
    </div>
  );
}

// --- Class lists: names & groups -----------------------------------------------------

function ClassTools({ mode }: { mode: 'names' | 'groups' }) {
  const [classes, setClasses] = useState<ClassList[] | null>(null);
  const [selected, setSelected] = useState(0);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/classes')
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => {
        setClasses(data.classes);
        if (data.classes.length === 0) setEditing(true);
      })
      .catch(() => { setClasses([]); setError('Klassenlisten konnten nicht geladen werden.'); });
  }, []);

  const save = async (next: ClassList[]) => {
    setError(null);
    try {
      const res = await fetch('/api/classes', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ classes: next }) });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setClasses(data.classes);
      return true;
    } catch {
      setError('Speichern fehlgeschlagen. Bitte erneut versuchen.');
      return false;
    }
  };

  if (!classes) return <p>Lade Klassenlisten …</p>;
  const current = classes[selected];

  if (editing || !current) {
    return (
      <ClassEditor
        initial={current}
        canCancel={!!current}
        canDelete={!!current}
        error={error}
        onCancel={() => setEditing(false)}
        onDelete={async () => {
          if (!window.confirm(`Klasse „${current?.name}“ wirklich löschen?`)) return;
          if (await save(classes.filter((_, i) => i !== selected))) { setSelected(0); setEditing(classes.length <= 1); }
        }}
        onSave={async (entry) => {
          const next = current ? classes.map((c, i) => (i === selected ? entry : c)) : [...classes, entry];
          if (await save(next)) { setSelected(current ? selected : next.length - 1); setEditing(false); }
        }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={selected}
          onChange={(e) => setSelected(Number(e.target.value))}
          style={{ flex: 1, minWidth: '140px', padding: '8px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)', fontSize: '1rem' }}
        >
          {classes.map((c, i) => <option key={i} value={i}>{c.name} ({c.students.length})</option>)}
        </select>
        <button style={button()} onClick={() => setEditing(true)}>Bearbeiten</button>
        <button style={button()} onClick={() => { setSelected(classes.length); setEditing(true); }}>+ Klasse</button>
      </div>
      {error && <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>}
      {current.students.length === 0
        ? <p>Diese Klasse hat noch keine Namen. Tippe auf „Bearbeiten“.</p>
        : mode === 'names' ? <NamePicker key={selected} students={current.students} /> : <GroupBuilder key={selected} students={current.students} />}
    </div>
  );
}

function ClassEditor({ initial, canCancel, canDelete, error, onCancel, onDelete, onSave }: {
  initial?: ClassList; canCancel: boolean; canDelete: boolean; error: string | null;
  onCancel: () => void; onDelete: () => void; onSave: (entry: ClassList) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [text, setText] = useState(initial?.students.join('\n') ?? '');
  const students = text.split('\n').map((s) => s.trim()).filter(Boolean);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <label style={{ fontWeight: 700 }}>
        Name der Klasse
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z. B. 2b"
          style={{ display: 'block', width: '100%', marginTop: '4px', padding: '8px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', background: 'var(--surface)', color: 'var(--foreground)' }}
        />
      </label>
      <label style={{ fontWeight: 700 }}>
        Kinder – ein Name pro Zeile ({students.length})
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder={'Ali\nBerta\nCem\n…'}
          style={{ display: 'block', width: '100%', marginTop: '4px', padding: '8px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--foreground)' }}
        />
      </label>
      <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>Tipp: Vornamen genügen. Die Liste ist nur für dich sichtbar.</p>
      {error && <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button style={button(true)} disabled={students.length === 0} onClick={() => onSave({ name: name.trim() || 'Klasse', students })}>Speichern</button>
        {canCancel && <button style={button()} onClick={onCancel}>Abbrechen</button>}
        {canDelete && <button style={{ ...button(), marginLeft: 'auto', color: 'var(--danger)' }} onClick={onDelete}>Klasse löschen</button>}
      </div>
    </div>
  );
}

function NamePicker({ students }: { students: string[] }) {
  const [once, setOnce] = useState(true);
  const [drawn, setDrawn] = useState<string[]>([]);
  const [shown, setShown] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);
  const remaining = students.filter((s) => !drawn.includes(s));

  const draw = () => {
    const pool = once ? remaining : students;
    if (pool.length === 0 || rolling) return;
    const winner = pool[randomInt(pool.length)];
    setRolling(true);
    let ticks = 0;
    const timer = setInterval(() => {
      ticks++;
      setShown(students[randomInt(students.length)]);
      if (ticks >= 14) {
        clearInterval(timer);
        setShown(winner);
        setRolling(false);
        if (once) setDrawn((d) => [...d, winner]);
      }
    }, 70);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
      <div style={{
        width: '100%', minHeight: '110px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        fontSize: 'clamp(2rem, 6vw, 3.5rem)', fontWeight: 800, borderRadius: '14px', background: 'rgba(59,130,246,0.1)',
        color: rolling ? 'var(--foreground)' : 'var(--primary)', fontFamily: 'Grundschrift, sans-serif',
      }}>
        {shown ?? '?'}
      </div>
      <button style={{ ...button(true), fontSize: '1.2rem', padding: '14px 28px' }} onClick={draw} disabled={rolling || (once && remaining.length === 0)}>
        Name ziehen
      </button>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
        <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input type="checkbox" checked={once} onChange={(e) => { setOnce(e.target.checked); setDrawn([]); }} />
          Jedes Kind nur einmal
        </label>
        {once && (
          <>
            <span style={{ opacity: 0.7 }}>noch {remaining.length} von {students.length}</span>
            <button style={button()} onClick={() => { setDrawn([]); setShown(null); }}>Von vorn</button>
          </>
        )}
      </div>
    </div>
  );
}

function GroupBuilder({ students }: { students: string[] }) {
  const [mode, setMode] = useState<'size' | 'count'>('size');
  const [value, setValue] = useState(4);
  const [absent, setAbsent] = useState<string[]>([]);
  const [groups, setGroups] = useState<string[][] | null>(null);
  const present = students.filter((s) => !absent.includes(s));

  const build = () => {
    const mixed = shuffle(present);
    const count = Math.max(1, Math.min(mixed.length, mode === 'count' ? value : Math.round(mixed.length / value) || 1));
    const result: string[][] = Array.from({ length: count }, () => []);
    mixed.forEach((name, i) => result[i % count].push(name));
    setGroups(result);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={mode} onChange={(e) => setMode(e.target.value as 'size' | 'count')}
          style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', background: 'var(--surface)', color: 'var(--foreground)' }}>
          <option value="size">Kinder pro Gruppe</option>
          <option value="count">Anzahl Gruppen</option>
        </select>
        <button style={button()} onClick={() => setValue((v) => Math.max(2, v - 1))} aria-label="weniger">−</button>
        <span style={{ fontSize: '1.4rem', fontWeight: 800, minWidth: '2ch', textAlign: 'center' }}>{value}</span>
        <button style={button()} onClick={() => setValue((v) => Math.min(12, v + 1))} aria-label="mehr">+</button>
        <button style={{ ...button(true), marginLeft: 'auto' }} onClick={build} disabled={present.length === 0}>Gruppen bilden</button>
      </div>
      <details>
        <summary style={{ cursor: 'pointer' }}>Wer fehlt heute? ({absent.length})</summary>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
          {students.map((s) => {
            const away = absent.includes(s);
            return (
              <button key={s} onClick={() => setAbsent((a) => (away ? a.filter((x) => x !== s) : [...a, s]))}
                style={{ ...button(), padding: '6px 10px', fontSize: '0.9rem', textDecoration: away ? 'line-through' : 'none', opacity: away ? 0.5 : 1 }}>
                {s}
              </button>
            );
          })}
        </div>
      </details>
      {groups && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
          {groups.map((g, i) => (
            <div key={i} style={{ border: '2px solid var(--primary)', borderRadius: '12px', padding: '8px 10px' }}>
              <div style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: '4px' }}>Gruppe {i + 1}</div>
              {g.map((name) => <div key={name} style={{ fontSize: '1.05rem', fontFamily: 'Grundschrift, sans-serif' }}>{name}</div>)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Dice ------------------------------------------------------------------------------

const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]], 6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

function DiceTool() {
  const [count, setCount] = useState(1);
  const [sides, setSides] = useState(6);
  const [values, setValues] = useState<number[]>([6]);
  const [rolling, setRolling] = useState(false);

  const roll = () => {
    if (rolling) return;
    setRolling(true);
    let ticks = 0;
    const timer = setInterval(() => {
      ticks++;
      setValues(Array.from({ length: count }, () => randomInt(sides) + 1));
      if (ticks >= 10) { clearInterval(timer); setRolling(false); }
    }, 60);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {[1, 2, 3].map((n) => (
          <button key={n} style={{ ...button(count === n), padding: '8px 12px' }} onClick={() => { setCount(n); setValues(Array.from({ length: n }, () => sides)); }}>
            {n} Würfel
          </button>
        ))}
        {[6, 10, 20].map((n) => (
          <button key={n} style={{ ...button(sides === n), padding: '8px 12px' }} onClick={() => { setSides(n); setValues(Array.from({ length: count }, () => n)); }}>
            1–{n}
          </button>
        ))}
      </div>
      <button onClick={roll} title="Würfeln" style={{ display: 'flex', gap: '16px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        {values.map((v, i) => <Die key={i} value={v} sides={sides} rolling={rolling} />)}
      </button>
      <button style={{ ...button(true), fontSize: '1.2rem', padding: '14px 28px' }} onClick={roll} disabled={rolling}>Würfeln</button>
      {count > 1 && !rolling && <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>Summe: {values.reduce((a, b) => a + b, 0)}</div>}
    </div>
  );
}

function Die({ value, sides, rolling }: { value: number; sides: number; rolling: boolean }) {
  const size = 110;
  return (
    <div style={{
      width: size, height: size, borderRadius: '20px', background: 'white', border: '3px solid #1e293b',
      boxShadow: '0 6px 14px rgba(0,0,0,0.2)', position: 'relative', color: '#1e293b',
      transform: rolling ? `rotate(${(value * 37) % 30 - 15}deg)` : 'none', transition: 'transform 0.06s',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3.2rem', fontWeight: 800,
    }}>
      {sides === 6
        ? PIPS[value]?.map(([r, c], i) => (
            <span key={i} style={{ position: 'absolute', width: 20, height: 20, borderRadius: '50%', background: '#1e293b', top: 14 + r * 31, left: 14 + c * 31 }} />
          ))
        : value}
    </div>
  );
}

// --- Noise level traffic light ------------------------------------------------------------

function NoiseTool() {
  const [level, setLevel] = useState(0);
  const [sensitivity, setSensitivity] = useState(50);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const cleanup = useRef<(() => void) | null>(null);

  const start = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Das Mikrofon ist hier nicht verfügbar. Es funktioniert nur über eine sichere Verbindung (https).');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      context.createMediaStreamSource(stream).connect(analyser);
      const data = new Float32Array(analyser.fftSize);
      let smooth = 0;
      let frame = 0;
      const tick = () => {
        analyser.getFloatTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += v * v;
        const rms = Math.sqrt(sum / data.length);
        // map roughly -60 dBFS..-10 dBFS to 0..100
        const db = 20 * Math.log10(Math.max(rms, 1e-5));
        const value = Math.min(100, Math.max(0, ((db + 60) / 50) * 100));
        smooth = smooth * 0.85 + value * 0.15;
        setLevel(smooth);
        frame = requestAnimationFrame(tick);
      };
      tick();
      cleanup.current = () => {
        cancelAnimationFrame(frame);
        stream.getTracks().forEach((t) => t.stop());
        void context.close();
      };
      setRunning(true);
    } catch {
      setError('Kein Zugriff auf das Mikrofon. Bitte im Browser erlauben.');
    }
  };
  const stop = () => { cleanup.current?.(); cleanup.current = null; setRunning(false); setLevel(0); };
  useEffect(() => () => cleanup.current?.(), []); // release the microphone when closing

  // Higher sensitivity → lights switch earlier
  const yellowAt = 75 - sensitivity * 0.45;
  const redAt = yellowAt + 18;
  const state = !running ? 'off' : level >= redAt ? 'red' : level >= yellowAt ? 'yellow' : 'green';
  const lamp = (color: string, on: boolean) => (
    <div style={{ width: 84, height: 84, borderRadius: '50%', background: on ? color : '#334155', opacity: on ? 1 : 0.35, boxShadow: on ? `0 0 30px ${color}` : 'none', transition: 'all 0.2s' }} />
  );

  return (
    <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px', background: '#0f172a', borderRadius: '20px' }}>
        {lamp('#ef4444', state === 'red')}
        {lamp('#facc15', state === 'yellow')}
        {lamp('#22c55e', state === 'green')}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '200px', flex: 1 }}>
        {running
          ? <button style={button()} onClick={stop}>Mikrofon aus</button>
          : <button style={button(true)} onClick={start}>Mikrofon an</button>}
        <div style={{ height: '14px', borderRadius: '7px', background: 'var(--border)', overflow: 'hidden' }}>
          <div style={{ width: `${level}%`, height: '100%', background: state === 'red' ? '#ef4444' : state === 'yellow' ? '#facc15' : '#22c55e', transition: 'width 0.1s' }} />
        </div>
        <label>
          Empfindlichkeit
          <input type="range" min={0} max={100} value={sensitivity} onChange={(e) => setSensitivity(Number(e.target.value))} style={{ width: '100%' }} />
        </label>
        <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>Es wird nichts aufgenommen oder gespeichert – nur die aktuelle Lautstärke angezeigt.</p>
        {error && <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>}
      </div>
    </div>
  );
}
