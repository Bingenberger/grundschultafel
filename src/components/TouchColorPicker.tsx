'use client';

import { useEffect, useState } from 'react';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hslToHex(h: number, s: number, l: number) {
  const sat = s / 100;
  const light = l / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = light - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const toHex = (channel: number) =>
    Math.round((channel + m) * 255)
      .toString(16)
      .padStart(2, '0');

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHsl(hex: string) {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized;

  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;

  let hue = 0;
  let saturation = 0;

  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));

    switch (max) {
      case r:
        hue = 60 * (((g - b) / delta) % 6);
        break;
      case g:
        hue = 60 * ((b - r) / delta + 2);
        break;
      default:
        hue = 60 * ((r - g) / delta + 4);
        break;
    }
  }

  return {
    h: (hue + 360) % 360,
    s: Math.round(saturation * 100),
    l: Math.round(lightness * 100),
  };
}

export default function TouchColorPicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (color: string) => void;
  label?: string;
}) {
  const [hue, setHue] = useState(0);
  const [lightness, setLightness] = useState(50);

  useEffect(() => {
    const hsl = hexToHsl(value);
    setHue(Math.round(hsl.h));
    setLightness(clamp(hsl.l, 12, 88));
  }, [value]);

  const updateColor = (nextHue: number, nextLightness: number) => {
    onChange(hslToHex(nextHue, 100, nextLightness));
  };

  return (
    <div style={{ display: 'grid', gap: '10px' }}>
      {label ? (
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--foreground)' }}>{label}</div>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '999px',
            background: value,
            border: '2px solid var(--border)',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.35)',
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, display: 'grid', gap: '8px' }}>
          <input
            type="range"
            min="0"
            max="360"
            value={hue}
            onChange={(e) => {
              const nextHue = Number(e.target.value);
              setHue(nextHue);
              updateColor(nextHue, lightness);
            }}
            style={{
              width: '100%',
              accentColor: hslToHex(hue, 100, 50),
              cursor: 'pointer',
            }}
            title="Farbton"
          />
          <input
            type="range"
            min="12"
            max="88"
            value={lightness}
            onChange={(e) => {
              const nextLightness = Number(e.target.value);
              setLightness(nextLightness);
              updateColor(hue, nextLightness);
            }}
            style={{
              width: '100%',
              accentColor: value,
              cursor: 'pointer',
            }}
            title="Helligkeit"
          />
        </div>
      </div>
    </div>
  );
}
