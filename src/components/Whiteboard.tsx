'use client';

import React, { useRef, useEffect, useState } from 'react';
import * as fabric from 'fabric';
import { useWhiteboardStore, ToolType } from '@/store/useWhiteboardStore';
import { Play, Pause, RotateCcw, Eye, EyeOff, Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, Rows3 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface YoutubeRect {
  id: string; // The fabric object ID or reference
  youtubeId: string;
  top: number;
  left: number;
  width: number;
  height: number;
}

interface TimerRect {
  id: string;
  timerType: string;
  top: number;
  left: number;
  width: number;
  height: number;
}

interface RsSymbol {
  name: string;
  url: string;
}

const fillCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'%3E%3Cpath d='M18.6 4.1 23.9 9.4 12.1 21.2 6.8 15.9 18.6 4.1Z' fill='%232563eb' stroke='%23ffffff' stroke-width='1.2'/%3E%3Cpath d='M20.8 11.7c1.9 0 3.4 1.5 3.4 3.4 0 2.8-3.4 6.4-3.4 6.4s-3.4-3.6-3.4-6.4c0-1.9 1.5-3.4 3.4-3.4Z' fill='%230ea5e9' stroke='%23ffffff' stroke-width='1.2'/%3E%3Ccircle cx='20.8' cy='15.1' r='1.2' fill='%23ffffff'/%3E%3C/svg%3E") 6 22, copy`;

// Samples a fabric.Path into canvas-space points for eraser hit-testing.
// Uses the path's transform matrix + pathOffset to map local coords → canvas coords.
function samplePath(pathObj: fabric.Path): { x: number; y: number }[] {
  const commands = (pathObj as any).path as any[][];
  if (!commands?.length) return [];

  const matrix = pathObj.calcTransformMatrix();
  const pathOffset = ((pathObj as any).pathOffset as { x: number; y: number }) ?? { x: 0, y: 0 };

  const toCanvas = (lx: number, ly: number) =>
    fabric.util.transformPoint({ x: lx - pathOffset.x, y: ly - pathOffset.y }, matrix);

  const pts: { x: number; y: number }[] = [];
  let cx = 0, cy = 0;

  for (const cmd of commands) {
    switch (cmd[0]) {
      case 'M': cx = cmd[1]; cy = cmd[2]; pts.push(toCanvas(cx, cy)); break;
      case 'L': cx = cmd[1]; cy = cmd[2]; pts.push(toCanvas(cx, cy)); break;
      case 'Q': {
        const [, qcx, qcy, qex, qey] = cmd;
        for (let t = 0.2; t <= 1.001; t += 0.2) {
          const mt = 1 - t;
          pts.push(toCanvas(mt*mt*cx + 2*mt*t*qcx + t*t*qex, mt*mt*cy + 2*mt*t*qcy + t*t*qey));
        }
        cx = qex; cy = qey; break;
      }
      case 'C': {
        const [, c1x, c1y, c2x, c2y, cex, cey] = cmd;
        for (let t = 0.2; t <= 1.001; t += 0.2) {
          const mt = 1 - t;
          pts.push(toCanvas(
            mt*mt*mt*cx + 3*mt*mt*t*c1x + 3*mt*t*t*c2x + t*t*t*cex,
            mt*mt*mt*cy + 3*mt*mt*t*c1y + 3*mt*t*t*c2y + t*t*t*cey,
          ));
        }
        cx = cex; cy = cey; break;
      }
    }
  }
  return pts;
}

// Erases the part of a fabric.Path within `radius` of `pointer`.
// Returns an array of new sub-path objects (may be empty if fully erased),
// or null if the path was not touched at all.
function eraseFromPath(
  pathObj: fabric.Path,
  pointer: { x: number; y: number },
  radius: number,
): fabric.Path[] | null {
  const pts = samplePath(pathObj);
  const r2 = radius * radius;

  const kept = pts.map(pt => {
    const dx = pt.x - pointer.x, dy = pt.y - pointer.y;
    return dx * dx + dy * dy > r2 ? pt : null;
  });

  if (!kept.some(k => k === null)) return null; // nothing erased

  const segments: { x: number; y: number }[][] = [];
  let cur: { x: number; y: number }[] = [];
  for (const pt of kept) {
    if (pt !== null) {
      cur.push(pt);
    } else {
      if (cur.length >= 2) segments.push(cur);
      cur = [];
    }
  }
  if (cur.length >= 2) segments.push(cur);

  const strokeColor = typeof pathObj.stroke === 'string' ? pathObj.stroke : '#000000';

  return segments.map(seg => {
    const d = seg.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');
    const np = new fabric.Path(d, {
      stroke: strokeColor,
      strokeWidth: pathObj.strokeWidth,
      fill: 'transparent',
      strokeLineCap: 'round',
      strokeLineJoin: 'round',
      selectable: false,
      evented: false,
      hasControls: false,
      hasBorders: false,
      opacity: pathObj.opacity ?? 1,
    });
    (np as any).isLockedStroke = (pathObj as any).isLockedStroke ?? false;
    return np;
  });
}

function hexToRgba(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;
  return `rgba(${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)},${alpha})`;
}

function normalizeTimerType(type: string) {
  if (type === 'sand') return 'sanduhr';
  if (type === 'focus') return 'fokus';
  if (type === 'puzzle') return 'narrativ2';
  return type;
}

function createTextDeleteControl(
  onDelete: (target: fabric.Object, canvas: fabric.Canvas) => void
) {
  const deleteIcon = "data:image/svg+xml,%3C%3Fxml version='1.0' encoding='utf-8'%3F%3E%3C!DOCTYPE svg PUBLIC '-//W3C//DTD SVG 1.1//EN' 'http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd'%3E%3Csvg version='1.1' id='Ebene_1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' x='0px' y='0px' width='595.275px' height='595.275px' viewBox='200 215 230 470' xml:space='preserve'%3E%3Ccircle style='fill:%23F44336;' cx='299.76' cy='439.067' r='218.225'/%3E%3Cpath style='fill:%23FFFFFF;' d='M214.183,410.74h171.155v26.046H214.183V410.74z'/%3E%3Cpath style='fill:%23FFFFFF;' d='M266.262,404.145V369.83c0-7.382,5.989-13.371,13.373-13.371h40.252c7.382,0,13.373,5.989,13.373,13.371v34.316h13.018v-34.316c0-14.567-11.821-26.388-26.391-26.388h-40.252c-14.569,0-26.391,11.821-26.391,26.388v34.316H266.262z'/%3E%3Cpath style='fill:%23FFFFFF;' d='M363.315,583.504H236.205c-11.879,0-21.616-9.52-21.848-21.39l-11.166-218.59h193.136l-11.163,218.59l0.003,0.061C384.908,573.978,375.187,583.504,363.315,583.504z M253.94,557.458h91.641l8.526-168.324H245.414L253.94,557.458z'/%3E%3Cpath style='fill:%23FFFFFF;' d='M330.151,544.755V404.629h13.018v140.126H330.151z'/%3E%3Cpath style='fill:%23FFFFFF;' d='M256.346,544.755V404.629h13.023v140.126H256.346z'/%3E%3C/svg%3E";
  const imgEl = document.createElement('img');
  imgEl.src = deleteIcon;

  return new fabric.Control({
    x: 0.5,
    y: -0.5,
    offsetY: -16,
    offsetX: 16,
    cursorStyle: 'pointer',
    mouseUpHandler: (eventData: any, transform: any) => {
      const target = transform.target as fabric.Object;
      const canvas = target.canvas;
      if (canvas) {
        onDelete(target, canvas);
      }
      return true;
    },
    render: (ctx: any, left: number, top: number) => {
      const size = 24;
      ctx.save();
      ctx.translate(left, top);
      ctx.drawImage(imgEl, -size / 2, -size / 2, size, size);
      ctx.restore();
    }
  });
}

function isTextObject(obj: fabric.Object | null | undefined): obj is fabric.Textbox {
  return !!obj && (obj.type === 'textbox' || obj.type === 'i-text');
}

function createTextControls(onDelete: (target: fabric.Object, canvas: fabric.Canvas) => void) {
  return {
    ...fabric.controlsUtils.createObjectDefaultControls(),
    deleteControl: createTextDeleteControl(onDelete),
    tl: new fabric.Control({ visible: false }),
    tr: new fabric.Control({ visible: false }),
    bl: new fabric.Control({ visible: false }),
    br: new fabric.Control({ visible: false }),
    mt: new fabric.Control({ visible: false }),
    mb: new fabric.Control({ visible: false }),
  };
}

function TimerOverlay({ timer, activeTool, isSelected }: { timer: TimerRect, activeTool: ToolType, isSelected: boolean }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [duration, setDuration] = useState(10);
  const [restDuration, setRestDuration] = useState(3);
  const [rounds, setRounds] = useState(3);
  const [showTime, setShowTime] = useState(true);
  
  useEffect(() => {
    const handleMsg = (e: MessageEvent) => {
      if (e.data && e.data.type === 'TIMER_STATE' && e.data.timerId === timer.id) {
        setIsRunning(e.data.running);
        if (e.data.minutes !== undefined) setDuration(e.data.minutes);
        if (e.data.restMinutes !== undefined) setRestDuration(e.data.restMinutes);
        if (e.data.rounds !== undefined) setRounds(e.data.rounds);
      }
    };
    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  }, [timer.id]);
  
  const togglePlay = () => iframeRef.current?.contentWindow?.postMessage({ action: 'startOrPause' }, '*');
  const reset = () => iframeRef.current?.contentWindow?.postMessage({ action: 'reset' }, '*');
  const setMins = (e: React.ChangeEvent<HTMLInputElement>) => {
    iframeRef.current?.contentWindow?.postMessage({ action: 'setDuration', value: Number(e.target.value) }, '*');
  };
  const setRestMins = (e: React.ChangeEvent<HTMLInputElement>) => {
    iframeRef.current?.contentWindow?.postMessage({ action: 'setRestDuration', value: Number(e.target.value) }, '*');
  };
  const setRoundsCount = (e: React.ChangeEvent<HTMLInputElement>) => {
    iframeRef.current?.contentWindow?.postMessage({ action: 'setRounds', value: Number(e.target.value) }, '*');
  };
  const toggleVisibility = () => {
    const nextVal = !showTime;
    setShowTime(nextVal);
    iframeRef.current?.contentWindow?.postMessage({ action: 'toggleTime', value: nextVal }, '*');
  };

  const normalizedTimerType = normalizeTimerType(timer.timerType);
  const isInterval = normalizedTimerType === 'intervall';
  const isHourglass = normalizedTimerType === 'sanduhr';

  return (
    <div 
      style={{
        position: 'absolute',
        top: timer.top,
        left: timer.left,
        width: timer.width,
        height: timer.height,
        pointerEvents: activeTool === 'move' ? 'none' : 'auto',
        zIndex: 10
      }}
    >
      <iframe
        ref={iframeRef}
        width="100%"
        height="100%"
        src={`/timer/index.html?type=${normalizedTimerType}&id=${timer.id}&embedded=true`}
        title="Timer"
        frameBorder="0"
        style={{ borderRadius: '12px', background: 'transparent' }}
      ></iframe>
      
      {/* External Control UI placed below the Box */}
      {isSelected && (
        <div style={{
          position: 'absolute',
          bottom: isHourglass ? -42 : -50,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'var(--surface)',
          padding: isHourglass ? '6px 12px' : '6px 16px',
          borderRadius: '24px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
          border: '1px solid var(--border)',
          pointerEvents: 'auto',
          maxWidth: isHourglass ? 'calc(100% - 8px)' : 'none'
        }}>
        <button 
           onClick={togglePlay} 
           style={{ 
             cursor: 'pointer', background: isRunning ? '#f3b51c' : '#2da36a', 
             color: isRunning ? '#172033' : '#fff', border: 'none', borderRadius: '50%', 
             width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
             boxShadow: '0 2px 5px rgba(0,0,0,0.15)', transition: 'all 0.2s'
           }}
           title={isRunning ? 'Pause' : 'Start'}
         >
           {isRunning ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
        </button>
        <button 
           onClick={reset} 
           style={{ 
             cursor: 'pointer', background: 'var(--danger)', 
             color: '#fff', border: 'none', borderRadius: '50%', 
             width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
             boxShadow: '0 2px 5px rgba(0,0,0,0.15)', transition: 'all 0.2s'
           }}
           title="Zurücksetzen"
         >
           <RotateCcw size={16} />
        </button>
        <button 
           onClick={toggleVisibility} 
           style={{ 
             cursor: 'pointer', background: 'var(--surface)', 
             color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: '50%', 
             width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
             boxShadow: '0 2px 5px rgba(0,0,0,0.05)', transition: 'all 0.2s'
           }}
           title={showTime ? "Zeitangabe verbergen" : "Zeitangabe anzeigen"}
         >
           {showTime ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', marginLeft: '6px' }}>
          <input 
            type="range" 
            min="1" max="60" 
            value={duration} 
            onChange={setMins}
            disabled={isRunning}
            style={{ width: isHourglass ? '64px' : '80px', height: '4px', cursor: isRunning ? 'not-allowed' : 'pointer', accentColor: 'var(--primary)' }}
            title={isInterval ? "Arbeitszeit" : "Dauer"}
          />
          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--foreground)' }}>
            {duration} min {isInterval ? '(Arbeit)' : ''}
          </span>
        </div>

        {isInterval && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', marginLeft: '2px' }}>
              <input 
                type="range" 
                min="0" max="60" 
                value={restDuration} 
                onChange={setRestMins}
                disabled={isRunning}
                style={{ width: '50px', height: '4px', cursor: isRunning ? 'not-allowed' : 'pointer', accentColor: 'var(--accent)' }}
                title="Pausenzeit"
              />
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--foreground)' }}>
                {restDuration} min (Pause)
              </span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', marginLeft: '2px' }}>
              <input 
                type="range" 
                min="1" max="20" 
                value={rounds} 
                onChange={setRoundsCount}
                disabled={isRunning}
                style={{ width: '40px', height: '4px', cursor: isRunning ? 'not-allowed' : 'pointer', accentColor: 'var(--success)' }}
                title="Runden"
              />
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--foreground)' }}>
                {rounds}x
              </span>
            </div>
          </>
        )}
        </div>
      )}
    </div>
  );
}

export default function Whiteboard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const eraserCursorRef = useRef<HTMLDivElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<fabric.Canvas | null>(null);

  // --- Undo / Redo history (per page, keyed by pageId) ---
  const CANVAS_JSON_KEYS = ['id', 'youtubeId', 'timerType', 'isRuler', 'isLockedStroke'];
  const MAX_HISTORY = 50;
  const historyRef = useRef<Record<string, { stack: any[]; index: number }>>({});
  const isHistoryLocked = useRef(false);
  const currentPageIdRef = useRef('');
  const historyDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getPageHistory = (pageId: string) => {
    if (!historyRef.current[pageId]) {
      historyRef.current[pageId] = { stack: [], index: -1 };
    }
    return historyRef.current[pageId];
  };

  const pushToHistory = (pageId: string, json: any) => {
    const hist = getPageHistory(pageId);
    if (hist.index < hist.stack.length - 1) {
      hist.stack = hist.stack.slice(0, hist.index + 1);
    }
    hist.stack.push(json);
    if (hist.stack.length > MAX_HISTORY) hist.stack.shift();
    hist.index = hist.stack.length - 1;
    const store = useWhiteboardStore.getState();
    store.setCanUndo(hist.index > 0);
    store.setCanRedo(false);
  };
  const [youtubeVideos, setYoutubeVideos] = useState<YoutubeRect[]>([]);
  const [timers, setTimers] = useState<TimerRect[]>([]);
  const [selectedTimerId, setSelectedTimerId] = useState<string | null>(null);
  const [rsSymbols, setRsSymbols] = useState<RsSymbol[]>([]);
  const [rsPicker, setRsPicker] = useState<{ left: number; top: number } | null>(null);
  const [selectedTextParams, setSelectedTextParams] = useState<{
    obj: fabric.Textbox | null;
    top: number;
    left: number;
    isBold: boolean;
    isItalic: boolean;
    isUnderline: boolean;
    isLinethrough: boolean;
    fontSize: number;
    textAlign: 'left' | 'center' | 'right' | 'justify';
    lineHeight: number;
    isEditing: boolean;
  } | null>(null);

  const activeTool = useWhiteboardStore((state) => state.activeTool);
  const penColor = useWhiteboardStore((state) => state.penColor);
  const penWidth = useWhiteboardStore((state) => state.penWidth);
  const isStraightLineMode = useWhiteboardStore((state) => state.isStraightLineMode);
  const clearCanvasSignal = useWhiteboardStore((state) => state.clearCanvasSignal);
  const highlighterColor = useWhiteboardStore((state) => state.highlighterColor);
  const highlighterWidth = useWhiteboardStore((state) => state.highlighterWidth);
  const eraserWidth = useWhiteboardStore((state) => state.eraserWidth);
  const undoSignal = useWhiteboardStore((state) => state.undoSignal);
  const redoSignal = useWhiteboardStore((state) => state.redoSignal);
  const currentPageId = useWhiteboardStore((state) => state.currentPageId);
  const pages = useWhiteboardStore((state) => state.pages);
  const updatePageData = useWhiteboardStore((state) => state.updatePageData);
  const notebookLoadSignal = useWhiteboardStore((state) => state.notebookLoadSignal);

  const createSmallDeleteControl = (onDelete: (target: fabric.Object, canvas: fabric.Canvas) => void) => new fabric.Control({
    x: 0.5,
    y: -0.5,
    offsetY: -12,
    offsetX: 12,
    cursorStyle: 'pointer',
    mouseUpHandler: (eventData: any, transform: any) => {
      const target = transform.target as fabric.Object;
      const canvas = target.canvas;
      if (canvas) {
        onDelete(target, canvas);
      }
      return true;
    },
    render: (ctx: CanvasRenderingContext2D, left: number, top: number) => {
      const radius = 10;
      ctx.save();
      ctx.translate(left, top);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-4, -4);
      ctx.lineTo(4, 4);
      ctx.moveTo(4, -4);
      ctx.lineTo(-4, 4);
      ctx.stroke();
      ctx.restore();
    }
  });

  const createRotationControl = () => new fabric.Control({
    x: 0,
    y: -0.5,
    offsetY: -26,
    cursorStyleHandler: fabric.controlsUtils.rotationStyleHandler,
    actionHandler: fabric.controlsUtils.rotationWithSnapping,
    actionName: 'rotate',
    render: (ctx: CanvasRenderingContext2D, left: number, top: number) => {
      const radius = 9;
      ctx.save();
      ctx.translate(left, top);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#3b82f6';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 4, Math.PI * 0.2, Math.PI * 1.6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(3, -5);
      ctx.lineTo(6, -2);
      ctx.lineTo(2, -1);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();
    }
  });

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    
    // Initialize fabric canvas
    const canvas = new fabric.Canvas(canvasRef.current, {
      isDrawingMode: true,
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      backgroundColor: 'transparent' // Let the container background show through if needed
    });
    
    const brush = new fabric.PencilBrush(canvas);
    brush.color = useWhiteboardStore.getState().penColor;
    brush.width = useWhiteboardStore.getState().penWidth;
    canvas.freeDrawingBrush = brush;

    setFabricCanvas(canvas);

    const handleResize = () => {
      if (containerRef.current) {
        // Re-check selection coords on resize
        const activeObj = canvas.getActiveObject();
        if (isTextObject(activeObj) && selectedTextParams) {
           setSelectedTextParams(prev => prev ? {
             ...prev, 
             top: (activeObj.top || 0) - 60,
             left: (activeObj.left || 0) + ((activeObj.width || 0) / 2)
           } : null);
        }

        canvas.setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
        canvas.renderAll();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.dispose();
    };
  }, []);

  // Handle Tool Changes
  useEffect(() => {
    if (!fabricCanvas) return;

    if (activeTool === 'pen') {
      fabricCanvas.isDrawingMode = !isStraightLineMode;
      fabricCanvas.defaultCursor = 'crosshair';
      if (fabricCanvas.freeDrawingBrush) {
        const brush = new fabric.PencilBrush(fabricCanvas);
        brush.color = penColor;
        brush.width = penWidth;
        fabricCanvas.freeDrawingBrush = brush;
      }
    } else if (activeTool === 'text') {
      fabricCanvas.isDrawingMode = false;
      fabricCanvas.defaultCursor = 'text';
    } else if (activeTool === 'eraser') {
      fabricCanvas.isDrawingMode = false;
      fabricCanvas.defaultCursor = 'none';
    } else if (activeTool === 'fill') {
      fabricCanvas.isDrawingMode = false;
      fabricCanvas.defaultCursor = fillCursor;
      fabricCanvas.hoverCursor = fillCursor;
    } else if (activeTool === 'move') {
      fabricCanvas.isDrawingMode = false;
      fabricCanvas.defaultCursor = 'default';
    } else if (activeTool === 'rs') {
      fabricCanvas.isDrawingMode = false;
      fabricCanvas.defaultCursor = 'crosshair';
    } else if (activeTool === 'highlighter') {
      fabricCanvas.isDrawingMode = true;
      fabricCanvas.defaultCursor = 'crosshair';
      const brush = new fabric.PencilBrush(fabricCanvas);
      brush.color = hexToRgba(highlighterColor, 0.5);
      brush.width = highlighterWidth;
      fabricCanvas.freeDrawingBrush = brush;
    }

    if (activeTool !== 'fill') {
      fabricCanvas.hoverCursor = activeTool === 'move' || activeTool === 'rs' ? 'move' : fabricCanvas.defaultCursor;
    }
    
    // Enable selection for move and RS so symbols can be positioned precisely.
    fabricCanvas.selection = activeTool === 'move' || activeTool === 'rs';
    fabricCanvas.getObjects().forEach(obj => {
      const isLockedStroke = !!(obj as any).isLockedStroke;
      obj.selectable = (activeTool === 'move' || activeTool === 'rs') && !isLockedStroke;
      obj.evented = (activeTool === 'move' || activeTool === 'rs' || activeTool === 'fill') && !isLockedStroke;
    });

    if (activeTool === 'fill') {
      fabricCanvas.discardActiveObject();
    }
    
    fabricCanvas.renderAll();
  }, [activeTool, fabricCanvas, penColor, penWidth, isStraightLineMode, highlighterColor, highlighterWidth, eraserWidth]);

  useEffect(() => {
    if (!fabricCanvas) return;

    const onMouseMove = (e: any) => {
      const cursor = eraserCursorRef.current;
      const container = containerRef.current;
      if (!cursor || !container || activeTool !== 'eraser') return;
      const rect = container.getBoundingClientRect();
      const x = e.e.clientX - rect.left;
      const y = e.e.clientY - rect.top;
      const size = useWhiteboardStore.getState().eraserWidth;
      cursor.style.left = (x - size / 2) + 'px';
      cursor.style.top = (y - size / 2) + 'px';
      cursor.style.width = size + 'px';
      cursor.style.height = size + 'px';
      cursor.style.display = 'block';
    };

    const onMouseOut = () => {
      if (eraserCursorRef.current) eraserCursorRef.current.style.display = 'none';
    };

    fabricCanvas.on('mouse:move', onMouseMove);
    fabricCanvas.on('mouse:out', onMouseOut);

    return () => {
      fabricCanvas.off('mouse:move', onMouseMove);
      fabricCanvas.off('mouse:out', onMouseOut);
      if (eraserCursorRef.current) eraserCursorRef.current.style.display = 'none';
    };
  }, [fabricCanvas, activeTool]);

  // Set baseline history entry for the initial page when the canvas first becomes available.
  // The page-switch effect never runs for the very first page because prevPageId already
  // equals currentPageId at startup, so we initialise here instead.
  useEffect(() => {
    if (!fabricCanvas) return;
    const hist = getPageHistory(currentPageId);
    if (hist.index === -1) {
      const json = (fabricCanvas as any).toJSON(CANVAS_JSON_KEYS);
      hist.stack = [json];
      hist.index = 0;
    }
  }, [fabricCanvas]); // intentionally omits currentPageId — only needs to run once on mount

  // Keep currentPageIdRef in sync so debounce callbacks always have the current page
  useEffect(() => {
    currentPageIdRef.current = currentPageId;
  }, [currentPageId]);

  // Listen to Fabric events and push canvas snapshots into the history stack
  useEffect(() => {
    if (!fabricCanvas) return;

    const schedulePush = () => {
      if (historyDebounceTimer.current) clearTimeout(historyDebounceTimer.current);
      historyDebounceTimer.current = setTimeout(() => {
        historyDebounceTimer.current = null;
        if (isHistoryLocked.current || !fabricCanvas) return;
        const json = (fabricCanvas as any).toJSON(CANVAS_JSON_KEYS);
        pushToHistory(currentPageIdRef.current, json);
      }, 80);
    };

    const onPathCreated = () => {
      if (isHistoryLocked.current) return;
      const json = (fabricCanvas as any).toJSON(CANVAS_JSON_KEYS);
      pushToHistory(currentPageIdRef.current, json);
    };

    const onObjectModified = () => {
      if (isHistoryLocked.current) return;
      const json = (fabricCanvas as any).toJSON(CANVAS_JSON_KEYS);
      pushToHistory(currentPageIdRef.current, json);
    };

    const onObjectAdded = (e: any) => {
      if (isHistoryLocked.current) return;
      if (e.target?.type === 'path') return; // path:created handles this
      schedulePush();
    };

    const onObjectRemoved = () => {
      if (isHistoryLocked.current) return;
      schedulePush();
    };

    fabricCanvas.on('path:created', onPathCreated);
    fabricCanvas.on('object:modified', onObjectModified);
    fabricCanvas.on('object:added', onObjectAdded);
    fabricCanvas.on('object:removed', onObjectRemoved);

    return () => {
      fabricCanvas.off('path:created', onPathCreated);
      fabricCanvas.off('object:modified', onObjectModified);
      fabricCanvas.off('object:added', onObjectAdded);
      fabricCanvas.off('object:removed', onObjectRemoved);
    };
  }, [fabricCanvas]);

  // Keyboard shortcuts: Ctrl+Z = Undo, Ctrl+Y / Ctrl+Shift+Z = Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === 'z' || e.key === 'Z') {
        if (e.shiftKey) {
          useWhiteboardStore.getState().triggerRedo();
        } else {
          useWhiteboardStore.getState().triggerUndo();
        }
        e.preventDefault();
      } else if (e.key === 'y' || e.key === 'Y') {
        useWhiteboardStore.getState().triggerRedo();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Undo: restore previous history entry
  useEffect(() => {
    if (!fabricCanvas || undoSignal === 0) return;
    const hist = getPageHistory(currentPageId);
    if (hist.index <= 0) return;
    hist.index--;
    const json = hist.stack[hist.index];
    isHistoryLocked.current = true;
    void (fabricCanvas as any).loadFromJSON(json).then(() => {
      fabricCanvas.requestRenderAll();
      useWhiteboardStore.getState().updatePageData(currentPageId, json);
      isHistoryLocked.current = false;
      const store = useWhiteboardStore.getState();
      store.setCanUndo(hist.index > 0);
      store.setCanRedo(hist.index < hist.stack.length - 1);
    });
  }, [undoSignal, fabricCanvas, currentPageId]);

  // Redo: restore next history entry
  useEffect(() => {
    if (!fabricCanvas || redoSignal === 0) return;
    const hist = getPageHistory(currentPageId);
    if (hist.index >= hist.stack.length - 1) return;
    hist.index++;
    const json = hist.stack[hist.index];
    isHistoryLocked.current = true;
    void (fabricCanvas as any).loadFromJSON(json).then(() => {
      fabricCanvas.requestRenderAll();
      useWhiteboardStore.getState().updatePageData(currentPageId, json);
      isHistoryLocked.current = false;
      const store = useWhiteboardStore.getState();
      store.setCanUndo(hist.index > 0);
      store.setCanRedo(hist.index < hist.stack.length - 1);
    });
  }, [redoSignal, fabricCanvas, currentPageId]);

  useEffect(() => {
    if (activeTool !== 'rs' || rsSymbols.length > 0) return;

    fetch('/api/rs')
      .then((res) => res.json())
      .then((data) => {
        if (data.images) {
          setRsSymbols(data.images);
        }
      })
      .catch(console.error);
  }, [activeTool, rsSymbols.length]);

  useEffect(() => {
    if (activeTool !== 'rs') {
      setRsPicker(null);
    }
  }, [activeTool]);

  // Handle Canvas Clicking for Text Tool
  useEffect(() => {
    if (!fabricCanvas) return;

    const handleMouseDown = (options: any) => {
      const { activeTool, fillColor, setActiveTool } = useWhiteboardStore.getState();

      if (activeTool === 'fill') {
        const target = options.target as fabric.Object | undefined;
        if (target && ((target as any).isRuler || (target as any).timerType || (target as any).youtubeId || (target as any).isLockedStroke)) return;

        const pointer = options.scenePoint || options.pointer || { x: 0, y: 0 };

        // Draw the physical canvas into a CSS-sized temporary canvas to eliminate DPR issues.
        // BFS then runs entirely in scene/CSS coordinate space.
        const physicalEl = (fabricCanvas as any).lowerCanvasEl as HTMLCanvasElement | null;
        if (!physicalEl) return;
        const cw = fabricCanvas.width as number;
        const ch = fabricCanvas.height as number;
        if (!cw || !ch) return;

        const tempEl = document.createElement('canvas');
        tempEl.width = cw;
        tempEl.height = ch;
        const tempCtx = tempEl.getContext('2d', { willReadFrequently: true })!;
        tempCtx.drawImage(physicalEl, 0, 0, cw, ch);
        const pixels = tempCtx.getImageData(0, 0, cw, ch).data;

        const vpt = (fabricCanvas.viewportTransform as number[]) || [1, 0, 0, 1, 0, 0];
        const zoom = vpt[0];
        // Scene → CSS pixel (for BFS canvas which is in CSS pixel space)
        const px = Math.floor(pointer.x * zoom + vpt[4]);
        const py = Math.floor(pointer.y * zoom + vpt[5]);
        if (px <= 0 || px >= cw - 1 || py <= 0 || py >= ch - 1) return;

        const si = (py * cw + px) * 4;
        const tr = pixels[si], tg = pixels[si + 1], tb = pixels[si + 2], ta = pixels[si + 3];

        const hex = fillColor.replace('#', '');
        const fr = parseInt(hex.slice(0, 2), 16);
        const fg = parseInt(hex.slice(2, 4), 16);
        const fb = parseInt(hex.slice(4, 6), 16);
        if (tr === fr && tg === fg && tb === fb && ta === 255) return;

        // Alpha must also match — distinguishes transparent bg (a=0) from opaque black strokes (a=255)
        const RGB_TOL = 30, A_TOL = 30;
        const matches = (i: number) =>
          Math.abs(pixels[i + 3] - ta) <= A_TOL &&
          Math.abs(pixels[i] - tr) + Math.abs(pixels[i + 1] - tg) + Math.abs(pixels[i + 2] - tb) <= RGB_TOL;

        const totalPixels = cw * ch;
        const visited = new Uint8Array(totalPixels);
        const stack: number[] = [py * cw + px];
        visited[py * cw + px] = 1;
        let count = 0;
        let minX = px, maxX = px, minY = py, maxY = py;
        let escaped = false;

        while (stack.length > 0 && !escaped && count < totalPixels >> 1) {
          count++;
          const pos = stack.pop()!;
          const x = pos % cw;
          const y = Math.floor(pos / cw);
          if (x < minX) minX = x; else if (x > maxX) maxX = x;
          if (y < minY) minY = y; else if (y > maxY) maxY = y;

          if (x === 0 || x === cw - 1 || y === 0 || y === ch - 1) { escaped = true; break; }
          const l = pos - 1, r = pos + 1, u = pos - cw, d = pos + cw;
          if (!visited[l] && matches(l * 4)) { visited[l] = 1; stack.push(l); }
          if (!visited[r] && matches(r * 4)) { visited[r] = 1; stack.push(r); }
          if (!visited[u] && matches(u * 4)) { visited[u] = 1; stack.push(u); }
          if (!visited[d] && matches(d * 4)) { visited[d] = 1; stack.push(d); }
        }

        if (escaped || count >= totalPixels >> 1) return;

        // Build cropped fill image in CSS pixel space
        const fw = maxX - minX + 1;
        const fh = maxY - minY + 1;
        const fillEl = document.createElement('canvas');
        fillEl.width = fw;
        fillEl.height = fh;
        const fillCtx = fillEl.getContext('2d')!;
        const fillImg = fillCtx.createImageData(fw, fh);
        const fd = fillImg.data;
        for (let fy = minY; fy <= maxY; fy++) {
          for (let fx = minX; fx <= maxX; fx++) {
            if (visited[fy * cw + fx]) {
              const i = ((fy - minY) * fw + (fx - minX)) * 4;
              fd[i] = fr; fd[i + 1] = fg; fd[i + 2] = fb; fd[i + 3] = 255;
            }
          }
        }
        fillCtx.putImageData(fillImg, 0, 0);

        // Place image: minX/minY are in CSS pixels = scene units (for zoom=1, pan=0)
        fabric.Image.fromURL(fillEl.toDataURL('image/png')).then(img => {
          img.set({
            left: (minX - vpt[4]) / zoom,
            top:  (minY - vpt[5]) / zoom,
            scaleX: 1 / zoom,
            scaleY: 1 / zoom,
            originX: 'left',
            originY: 'top',
            selectable: false,
            evented: false,
          });
          (img as any).id = uuidv4();
          (img as any).isFill = true;
          fabricCanvas.add(img);
          fabricCanvas.sendObjectToBack(img);
          fabricCanvas.requestRenderAll();
          const { updatePageData, currentPageId } = useWhiteboardStore.getState();
          updatePageData(currentPageId, (fabricCanvas as any).toJSON(['id', 'youtubeId', 'timerType', 'isRuler', 'isLockedStroke', 'isFill']));
        });
      } else if (activeTool === 'text') {
        const pointer = options.scenePoint || options.pointer || { x: 100, y: 100 };
        const onDeleteText = (target: fabric.Object, canvas: fabric.Canvas) => {
          canvas.remove(target);
          canvas.requestRenderAll();
          const { updatePageData, currentPageId } = useWhiteboardStore.getState();
          updatePageData(currentPageId, canvas.toJSON());
          setSelectedTextParams(null);
        };

        const textObject = new fabric.Textbox('Text...', {
          left: pointer.x,
          top: pointer.y - 20, // offset slightly to center the click
          width: 320,
          fontFamily: 'Grundschrift, sans-serif',
          fontSize: 40,
          fill: penColor, // Spawn with current pen color
          transparentCorners: false,
          cornerColor: 'var(--primary)',
          borderColor: 'var(--primary)',
          lockScalingFlip: true,
          minWidth: 120,
        });
        
        textObject.controls = createTextControls(onDeleteText);

        fabricCanvas.add(textObject);
        fabricCanvas.setActiveObject(textObject);
        fabricCanvas.requestRenderAll();

        requestAnimationFrame(() => {
          fabricCanvas.setActiveObject(textObject);
          textObject.enterEditing();
          textObject.hiddenTextarea?.focus();
          textObject.selectAll();
          const boundingRect = textObject.getBoundingRect();
          setSelectedTextParams({
            obj: textObject,
            top: boundingRect.top - 60,
            left: boundingRect.left + (boundingRect.width / 2),
            isBold: textObject.fontWeight === 'bold',
            isItalic: textObject.fontStyle === 'italic',
            isUnderline: !!textObject.underline,
            isLinethrough: !!textObject.linethrough,
            fontSize: textObject.fontSize || 40,
            textAlign: (textObject.textAlign as 'left' | 'center' | 'right' | 'justify') || 'left',
            lineHeight: textObject.lineHeight || 1.16,
            isEditing: true
          });
          fabricCanvas.requestRenderAll();
        });

        const handleEditingExited = (event: any) => {
          if (event.target !== textObject) return;
          fabricCanvas.off('text:editing:exited', handleEditingExited);
          const { updatePageData, currentPageId } = useWhiteboardStore.getState();
          updatePageData(currentPageId, (fabricCanvas as any).toJSON(['id', 'youtubeId', 'timerType', 'isRuler', 'isLockedStroke']));
          setActiveTool('move');
        };

        fabricCanvas.on('text:editing:exited', handleEditingExited);
      }
    };

    const updateTextToolbarPosition = (obj: fabric.Textbox) => {
      const boundingRect = obj.getBoundingRect();
        setSelectedTextParams({
          obj,
          top: boundingRect.top - 60, // Above the text
          left: boundingRect.left + (boundingRect.width / 2), // Centered above
        isBold: obj.fontWeight === 'bold',
        isItalic: obj.fontStyle === 'italic',
          isUnderline: !!obj.underline,
          isLinethrough: !!obj.linethrough,
          fontSize: obj.fontSize || 40,
          textAlign: (obj.textAlign as 'left' | 'center' | 'right' | 'justify') || 'left',
          lineHeight: obj.lineHeight || 1.16,
          isEditing: !!obj.isEditing
        });
    };

    const handleSelectionCreated = (e: any) => {
      if (e.selected && e.selected.length === 1 && isTextObject(e.selected[0])) {
        updateTextToolbarPosition(e.selected[0]);
      } else {
        setSelectedTextParams(null);
      }
    };

    const handleSelectionUpdated = (e: any) => {
      if (e.selected && e.selected.length === 1 && isTextObject(e.selected[0])) {
        updateTextToolbarPosition(e.selected[0]);
      } else {
        setSelectedTextParams(null);
      }
    };

    const handleSelectionCleared = () => {
      setSelectedTextParams(null);
    };

    const handleObjectModified = (e: any) => {
      if (isTextObject(e.target)) {
        if (e.target.scaleX && e.target.scaleX !== 1) {
          const nextWidth = Math.max((e.target.width || 320) * e.target.scaleX, e.target.minWidth || 120);
          e.target.set({ width: nextWidth, scaleX: 1, scaleY: 1 });
          e.target.setCoords();
        }
        updateTextToolbarPosition(e.target);
      }
    };

    fabricCanvas.on('mouse:down', handleMouseDown);
    fabricCanvas.on('selection:created', handleSelectionCreated);
    fabricCanvas.on('selection:updated', handleSelectionUpdated);
    fabricCanvas.on('selection:cleared', handleSelectionCleared);
    fabricCanvas.on('object:modified', handleObjectModified);
    fabricCanvas.on('object:moving', handleObjectModified);
    fabricCanvas.on('object:scaling', handleObjectModified);

    return () => {
      fabricCanvas.off('mouse:down', handleMouseDown);
      fabricCanvas.off('selection:created', handleSelectionCreated);
      fabricCanvas.off('selection:updated', handleSelectionUpdated);
      fabricCanvas.off('selection:cleared', handleSelectionCleared);
      fabricCanvas.off('object:modified', handleObjectModified);
      fabricCanvas.off('object:moving', handleObjectModified);
      fabricCanvas.off('object:scaling', handleObjectModified);
    };
  }, [fabricCanvas]);

  useEffect(() => {
    if (!fabricCanvas) return;

    const updateSelectedTimer = (options?: any) => {
      const activeObject = options?.selected?.[0] || options?.target || fabricCanvas.getActiveObject();
      if (activeObject && (activeObject as any).timerType && (activeObject as any).id) {
        setSelectedTimerId((activeObject as any).id);
      } else {
        setSelectedTimerId(null);
      }
    };

    const clearSelectedTimer = () => {
      setSelectedTimerId(null);
    };

    fabricCanvas.on('selection:created', updateSelectedTimer);
    fabricCanvas.on('selection:updated', updateSelectedTimer);
    fabricCanvas.on('selection:cleared', clearSelectedTimer);

    return () => {
      fabricCanvas.off('selection:created', updateSelectedTimer);
      fabricCanvas.off('selection:updated', updateSelectedTimer);
      fabricCanvas.off('selection:cleared', clearSelectedTimer);
    };
  }, [fabricCanvas]);

  // Handle Clear Canvas
  useEffect(() => {
    if (fabricCanvas && clearCanvasSignal > 0) {
      fabricCanvas.clear();
      fabricCanvas.backgroundColor = '#ffffff';
      fabricCanvas.renderAll();
    }
  }, [clearCanvasSignal, fabricCanvas]);

  const newImage = useWhiteboardStore((state) => state.newImage);
  const consumeNewImage = useWhiteboardStore((state) => state.consumeNewImage);

  // Handle Add Image
  useEffect(() => {
    if (fabricCanvas && newImage) {
      console.log('[Whiteboard] Lade Bild in Canvas, URL-Prefix:', newImage.url.substring(0, 40));
      fabric.Image.fromURL(newImage.url).then((img) => {
        console.log('[Whiteboard] Bild geladen, Größe:', img.width, 'x', img.height);
        // Center image and scale if too big
        const canvasWidth = fabricCanvas.width || 800;
        const canvasHeight = fabricCanvas.height || 600;
        
        let scale = 1;
        if (img.width! > canvasWidth * 0.8 || img.height! > canvasHeight * 0.8) {
          scale = Math.min((canvasWidth * 0.8) / img.width!, (canvasHeight * 0.8) / img.height!);
        }

        // Build default controls
        if (!img.controls || Object.keys(img.controls).length === 0) {
          img.controls = { ...fabric.controlsUtils.createObjectDefaultControls() };
        }

        const deleteIcon = "data:image/svg+xml,%3C%3Fxml version='1.0' encoding='utf-8'%3F%3E%3C!DOCTYPE svg PUBLIC '-//W3C//DTD SVG 1.1//EN' 'http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd'%3E%3Csvg version='1.1' id='Ebene_1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' x='0px' y='0px' width='595.275px' height='595.275px' viewBox='200 215 230 470' xml:space='preserve'%3E%3Ccircle style='fill:%23F44336;' cx='299.76' cy='439.067' r='218.225'/%3E%3Cpath style='fill:%23FFFFFF;' d='M214.183,410.74h171.155v26.046H214.183V410.74z'/%3E%3Cpath style='fill:%23FFFFFF;' d='M266.262,404.145V369.83c0-7.382,5.989-13.371,13.373-13.371h40.252c7.382,0,13.373,5.989,13.373,13.371v34.316h13.018v-34.316c0-14.567-11.821-26.388-26.391-26.388h-40.252c-14.569,0-26.391,11.821-26.391,26.388v34.316H266.262z'/%3E%3Cpath style='fill:%23FFFFFF;' d='M363.315,583.504H236.205c-11.879,0-21.616-9.52-21.848-21.39l-11.166-218.59h193.136l-11.163,218.59l0.003,0.061C384.908,573.978,375.187,583.504,363.315,583.504z M253.94,557.458h91.641l8.526-168.324H245.414L253.94,557.458z'/%3E%3Cpath style='fill:%23FFFFFF;' d='M330.151,544.755V404.629h13.018v140.126H330.151z'/%3E%3Cpath style='fill:%23FFFFFF;' d='M256.346,544.755V404.629h13.023v140.126H256.346z'/%3E%3C/svg%3E";
        const imgEl = document.createElement('img');
        imgEl.src = deleteIcon;
          
        img.controls.deleteControl = new fabric.Control({
          x: 0.5,
          y: -0.5,
          offsetY: -16,
          offsetX: 16,
          cursorStyle: 'pointer',
          mouseUpHandler: (eventData: any, transform: any) => {
            const target = transform.target;
            const canvas = target.canvas;
            if (canvas) {
              canvas.remove(target);
              canvas.requestRenderAll();
              const { updatePageData, currentPageId } = useWhiteboardStore.getState();
              updatePageData(currentPageId, canvas.toJSON());
            }
            return true;
          },
          render: (ctx: any, left: number, top: number, styleOverride: any, fabricObject: any) => {
            const size = 24;
            ctx.save();
            ctx.translate(left, top);
            ctx.drawImage(imgEl, -size/2, -size/2, size, size);
            ctx.restore();
          }
        });

        const targetLeft = newImage.left ?? canvasWidth / 2;
        const targetTop = newImage.top ?? canvasHeight / 2;
        const isRsImageInsertion = useWhiteboardStore.getState().activeTool === 'rs' && newImage.left !== undefined && newImage.top !== undefined;
        const rsTargetSize = 36;

        if (isRsImageInsertion) {
          scale = Math.min(rsTargetSize / img.width!, rsTargetSize / img.height!);
        }

        img.set({
          left: targetLeft - (img.width! * scale) / 2,
          top: targetTop - (img.height! * scale) / 2,
          scaleX: scale,
          scaleY: scale,
          cornerStyle: 'circle',
          cornerColor: 'var(--primary)',
          borderColor: 'var(--primary)',
          transparentCorners: false,
          padding: 10
        });

        fabricCanvas.add(img);
        if (!isRsImageInsertion) {
          fabricCanvas.setActiveObject(img);
        }
        fabricCanvas.renderAll();
        const { updatePageData: upd, currentPageId: pid } = useWhiteboardStore.getState();
        upd(pid, (fabricCanvas as any).toJSON(CANVAS_JSON_KEYS));
        consumeNewImage();

        if (!isRsImageInsertion) {
          useWhiteboardStore.getState().setActiveTool('move');
        }
      }).catch((err) => {
        console.error('[Whiteboard] fabric.Image.fromURL fehlgeschlagen:', err);
        consumeNewImage();
      });
    }
  }, [newImage, fabricCanvas, consumeNewImage]);

  const newBackgroundUrl = useWhiteboardStore((state) => state.newBackgroundUrl);
  const consumeNewBackground = useWhiteboardStore((state) => state.consumeNewBackground);

  // Handle Add Youtube Video
  const newYoutubeId = useWhiteboardStore((state) => state.newYoutubeId);
  const consumeNewYoutubeVideo = useWhiteboardStore((state) => state.consumeNewYoutubeVideo);

  useEffect(() => {
    if (fabricCanvas && newYoutubeId) {
      const videoWidth = 560;
      const videoHeight = 315;
      const canvasWidth = fabricCanvas.width || 800;
      const canvasHeight = fabricCanvas.height || 600;

      const rect = new fabric.Rect({
        left: canvasWidth / 2 - 280,
        top: canvasHeight / 2 - 157.5,
        width: 560,
        height: 315,
        fill: 'transparent',
        stroke: 'var(--primary)',
        strokeWidth: 4,
        lockRotation: true,
        lockScalingFlip: true,
        lockUniScaling: true,
        cornerStyle: 'circle',
        transparentCorners: false,
        padding: 5
      });
      
      // Inject custom properties
      (rect as any).id = uuidv4();
      (rect as any).youtubeId = newYoutubeId;

      // Add delete control
      if (!rect.controls || Object.keys(rect.controls).length === 0) {
        rect.controls = { ...fabric.controlsUtils.createObjectDefaultControls() };
      }

      const deleteIcon = "data:image/svg+xml,%3C%3Fxml version='1.0' encoding='utf-8'%3F%3E%3C!DOCTYPE svg PUBLIC '-//W3C//DTD SVG 1.1//EN' 'http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd'%3E%3Csvg version='1.1' id='Ebene_1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' x='0px' y='0px' width='595.275px' height='595.275px' viewBox='200 215 230 470' xml:space='preserve'%3E%3Ccircle style='fill:%23F44336;' cx='299.76' cy='439.067' r='218.225'/%3E%3Cpath style='fill:%23FFFFFF;' d='M214.183,410.74h171.155v26.046H214.183V410.74z'/%3E%3Cpath style='fill:%23FFFFFF;' d='M266.262,404.145V369.83c0-7.382,5.989-13.371,13.373-13.371h40.252c7.382,0,13.373,5.989,13.373,13.371v34.316h13.018v-34.316c0-14.567-11.821-26.388-26.391-26.388h-40.252c-14.569,0-26.391,11.821-26.391,26.388v34.316H266.262z'/%3E%3Cpath style='fill:%23FFFFFF;' d='M363.315,583.504H236.205c-11.879,0-21.616-9.52-21.848-21.39l-11.166-218.59h193.136l-11.163,218.59l0.003,0.061C384.908,573.978,375.187,583.504,363.315,583.504z M253.94,557.458h91.641l8.526-168.324H245.414L253.94,557.458z'/%3E%3Cpath style='fill:%23FFFFFF;' d='M330.151,544.755V404.629h13.018v140.126H330.151z'/%3E%3Cpath style='fill:%23FFFFFF;' d='M256.346,544.755V404.629h13.023v140.126H256.346z'/%3E%3C/svg%3E";
      const imgEl = document.createElement('img');
      imgEl.src = deleteIcon;
        
      rect.controls.deleteControl = new fabric.Control({
        x: 0.5,
        y: -0.5,
        offsetY: -16,
        offsetX: 16,
        cursorStyle: 'pointer',
        mouseUpHandler: (eventData: any, transform: any) => {
          const target = transform.target;
          const canvas = target.canvas;
          if (canvas) {
            canvas.remove(target);
            canvas.requestRenderAll();
            const { updatePageData, currentPageId } = useWhiteboardStore.getState();
            updatePageData(currentPageId, canvas.toJSON(['id', 'youtubeId', 'timerType', 'url', 'isLockedStroke']));
          }
          return true;
        },
        render: (ctx: any, left: number, top: number, styleOverride: any, fabricObject: any) => {
          const size = 24;
          ctx.save();
          ctx.translate(left, top);
          ctx.drawImage(imgEl, -size/2, -size/2, size, size);
          ctx.restore();
        }
      });

      fabricCanvas.add(rect);
      fabricCanvas.setActiveObject(rect);
      fabricCanvas.renderAll();
      consumeNewYoutubeVideo();

      useWhiteboardStore.getState().setActiveTool('move');
    }
  }, [newYoutubeId, fabricCanvas, consumeNewYoutubeVideo]);

  // Handle Add Timer
  const newTimerType = useWhiteboardStore((state) => state.newTimerType);
  const consumeNewTimer = useWhiteboardStore((state) => state.consumeNewTimer);

  useEffect(() => {
    if (fabricCanvas && newTimerType) {
      const normalizedTimerType = normalizeTimerType(newTimerType);

      // Set appropriate aspect ratios based on timer format
      let timerWidth = 320;
      let timerHeight = 320; // Default to square for standard circular timers
      
      if (normalizedTimerType === 'sanduhr') {
        timerWidth = 220;
        timerHeight = 360; // Closer to the embedded hourglass proportions
      } else if (normalizedTimerType === 'atmo' || normalizedTimerType === 'narrativ2') {
        timerWidth = 460;
        timerHeight = 320; // Wide rectangle for boards
      } else if (normalizedTimerType === 'intervall') {
        timerWidth = 360;
        timerHeight = 360;
      }

      const canvasWidth = fabricCanvas.width || 800;
      const canvasHeight = fabricCanvas.height || 600;

      const rect = new fabric.Rect({
        left: canvasWidth / 2 - timerWidth / 2,
        top: canvasHeight / 2 - timerHeight / 2,
        width: timerWidth,
        height: timerHeight,
        fill: 'transparent',
        stroke: 'var(--accent)',
        strokeWidth: 4,
        lockRotation: true,
        lockScalingFlip: true,
        lockUniScaling: true,
        cornerStyle: 'circle',
        transparentCorners: false,
        padding: 5
      });
      
      // Inject custom properties
      (rect as any).id = uuidv4();
      (rect as any).timerType = newTimerType;

      // Add delete control
      if (!rect.controls || Object.keys(rect.controls).length === 0) {
        rect.controls = { ...fabric.controlsUtils.createObjectDefaultControls() };
      }

      const deleteIcon = "data:image/svg+xml,%3C%3Fxml version='1.0' encoding='utf-8'%3F%3E%3C!DOCTYPE svg PUBLIC '-//W3C//DTD SVG 1.1//EN' 'http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd'%3E%3Csvg version='1.1' id='Ebene_1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' x='0px' y='0px' width='595.275px' height='595.275px' viewBox='200 215 230 470' xml:space='preserve'%3E%3Ccircle style='fill:%23F44336;' cx='299.76' cy='439.067' r='218.225'/%3E%3Cpath style='fill:%23FFFFFF;' d='M214.183,410.74h171.155v26.046H214.183V410.74z'/%3E%3Cpath style='fill:%23FFFFFF;' d='M266.262,404.145V369.83c0-7.382,5.989-13.371,13.373-13.371h40.252c7.382,0,13.373,5.989,13.373,13.371v34.316h13.018v-34.316c0-14.567-11.821-26.388-26.391-26.388h-40.252c-14.569,0-26.391,11.821-26.391,26.388v34.316H266.262z'/%3E%3Cpath style='fill:%23FFFFFF;' d='M363.315,583.504H236.205c-11.879,0-21.616-9.52-21.848-21.39l-11.166-218.59h193.136l-11.163,218.59l0.003,0.061C384.908,573.978,375.187,583.504,363.315,583.504z M253.94,557.458h91.641l8.526-168.324H245.414L253.94,557.458z'/%3E%3Cpath style='fill:%23FFFFFF;' d='M330.151,544.755V404.629h13.018v140.126H330.151z'/%3E%3Cpath style='fill:%23FFFFFF;' d='M256.346,544.755V404.629h13.023v140.126H256.346z'/%3E%3C/svg%3E";
      const imgEl = document.createElement('img');
      imgEl.src = deleteIcon;
        
      rect.controls.deleteControl = new fabric.Control({
        x: 0.5,
        y: -0.5,
        offsetY: -16,
        offsetX: 16,
        cursorStyle: 'pointer',
        mouseUpHandler: (eventData: any, transform: any) => {
          const target = transform.target;
          const canvas = target.canvas;
          if (canvas) {
            canvas.remove(target);
            canvas.requestRenderAll();
            const { updatePageData, currentPageId } = useWhiteboardStore.getState();
            updatePageData(currentPageId, canvas.toJSON(['id', 'youtubeId', 'timerType', 'url', 'isLockedStroke']));
          }
          return true;
        },
        render: (ctx: any, left: number, top: number, styleOverride: any, fabricObject: any) => {
          const size = 24;
          ctx.save();
          ctx.translate(left, top);
          ctx.drawImage(imgEl, -size/2, -size/2, size, size);
          ctx.restore();
        }
      });

      fabricCanvas.add(rect);
      fabricCanvas.setActiveObject(rect);
      fabricCanvas.renderAll();
      consumeNewTimer();

      useWhiteboardStore.getState().setActiveTool('move');
    }
  }, [newTimerType, fabricCanvas, consumeNewTimer]);

  // Handle Add Shape
  const newShape = useWhiteboardStore((state) => state.newShape);
  const consumeNewShape = useWhiteboardStore((state) => state.consumeNewShape);

  useEffect(() => {
    if (fabricCanvas && newShape) {
      const canvasWidth = fabricCanvas.width || 800;
      const canvasHeight = fabricCanvas.height || 600;
      const { shapeStrokeColor, shapeFillColor, shapeFilled } = useWhiteboardStore.getState();
      
      let shapeObj: fabric.Object | null = null;
      const commonProps = {
        left: canvasWidth / 2 - 50,
        top: canvasHeight / 2 - 50,
        fill: shapeFilled ? shapeFillColor : 'transparent',
        stroke: shapeStrokeColor,
        strokeWidth: 4,
        cornerStyle: 'circle' as const,
        transparentCorners: false
      };

      if (newShape === 'rect') {
        shapeObj = new fabric.Rect({ ...commonProps, width: 100, height: 100 });
      } else if (newShape === 'circle') {
        shapeObj = new fabric.Circle({ ...commonProps, radius: 50 });
      } else if (newShape === 'triangle') {
        shapeObj = new fabric.Triangle({ ...commonProps, width: 100, height: 100 });
      } else if (newShape === 'line') {
        shapeObj = new fabric.Line([0, 0, 150, 150], {
          left: canvasWidth / 2 - 75,
          top: canvasHeight / 2 - 75,
          stroke: shapeStrokeColor,
          strokeWidth: 4,
          cornerStyle: 'circle',
          transparentCorners: false
        });
      }

      if (shapeObj) {
        // --- Add Delete Control ---
        const deleteIconStr = "data:image/svg+xml,%3C%3Fxml version='1.0' encoding='utf-8'%3F%3E%3C!DOCTYPE svg PUBLIC '-//W3C//DTD SVG 1.1//EN' 'http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd'%3E%3Csvg version='1.1' id='Ebene_1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' x='0px' y='0px' width='595.275px' height='595.275px' viewBox='200 215 230 470' xml:space='preserve'%3E%3Ccircle style='fill:%23F44336;' cx='299.76' cy='439.067' r='218.225'/%3E%3Cpath style='fill:%23FFFFFF;' d='M214.183,410.74h171.155v26.046H214.183V410.74z'/%3E%3Cpath style='fill:%23FFFFFF;' d='M266.262,404.145V369.83c0-7.382,5.989-13.371,13.373-13.371h40.252c7.382,0,13.373,5.989,13.373,13.371v34.316h13.018v-34.316c0-14.567-11.821-26.388-26.391-26.388h-40.252c-14.569,0-26.391,11.821-26.391,26.388v34.316H266.262z'/%3E%3Cpath style='fill:%23FFFFFF;' d='M363.315,583.504H236.205c-11.879,0-21.616-9.52-21.848-21.39l-11.166-218.59h193.136l-11.163,218.59l0.003,0.061C384.908,573.978,375.187,583.504,363.315,583.504z M253.94,557.458h91.641l8.526-168.324H245.414L253.94,557.458z'/%3E%3Cpath style='fill:%23FFFFFF;' d='M330.151,544.755V404.629h13.018v140.126H330.151z'/%3E%3Cpath style='fill:%23FFFFFF;' d='M256.346,544.755V404.629h13.023v140.126H256.346z'/%3E%3C/svg%3E";
        const imgEl = document.createElement('img');
        imgEl.src = deleteIconStr;

        const deleteObject = (eventData: any, transform: fabric.Transform, x: number, y: number) => {
          const target = transform.target;
          const canvas = target.canvas;
          if (canvas) {
            canvas.remove(target);
            canvas.requestRenderAll();
            const { updatePageData, currentPageId } = useWhiteboardStore.getState();
            updatePageData(currentPageId, (canvas as any).toJSON(['id', 'youtubeId', 'timerType', 'isRuler', 'isLockedStroke']));
          }
          return true;
        };

        const renderIcon = (ctx: CanvasRenderingContext2D, left: number, top: number, styleOverride: any, fabricObject: fabric.Object) => {
          const size = 24;
          ctx.save();
          ctx.translate(left, top);
          ctx.rotate(fabric.util.degreesToRadians(fabricObject.angle || 0));
          ctx.drawImage(imgEl, -size/2, -size/2, size, size);
          ctx.restore();
        };

        const deleteControl = new fabric.Control({
          x: 0.5,
          y: -0.5,
          offsetY: -16,
          offsetX: 16,
          cursorStyle: 'pointer',
          mouseUpHandler: deleteObject,
          render: renderIcon
        });

        shapeObj.controls = {
          ...fabric.controlsUtils.createObjectDefaultControls(),
          deleteControl
        };
        // --- End Delete Control ---

        fabricCanvas.add(shapeObj);
        fabricCanvas.setActiveObject(shapeObj);
        fabricCanvas.renderAll();
        
        // Save state immediately
        const { updatePageData, currentPageId } = useWhiteboardStore.getState();
        updatePageData(currentPageId, (fabricCanvas as any).toJSON(['id', 'youtubeId', 'timerType', 'isRuler', 'isLockedStroke']));
      }

      consumeNewShape();
      useWhiteboardStore.getState().setActiveTool('move');
    }
  }, [newShape, fabricCanvas, consumeNewShape]);

  // Handle Add Ruler
  const newRuler = useWhiteboardStore((state) => state.newRuler);
  const consumeNewRuler = useWhiteboardStore((state) => state.consumeNewRuler);

  useEffect(() => {
    if (fabricCanvas && newRuler) {
      const canvasWidth = fabricCanvas.width || 800;
      const canvasHeight = fabricCanvas.height || 600;
      
      const rulerLength = 600;
      const rulerWidth = 60;
      
      const frame = new fabric.Rect({
        width: rulerLength,
        height: rulerWidth,
        fill: 'rgba(255, 235, 150, 0.8)', // semi-transparent yellow wooden color
        stroke: '#888',
        strokeWidth: 2,
        originX: 'center',
        originY: 'center',
        rx: 5,
        ry: 5
      });

      // Create centimeter markings (approx 30 "cm" across the 600px length, so 20px per cm)
      const lines = [];
      const numCms = 30;
      const pxPerCm = rulerLength / numCms;
      const startX = -rulerLength / 2;
      const startY = -rulerWidth / 2;

      for (let i = 0; i <= numCms; i++) {
        const x = startX + i * pxPerCm;
        const isHalf = i % 5 !== 0;
        const lineLen = isHalf ? 10 : 20;
        
        lines.push(new fabric.Line([x, startY, x, startY + lineLen], {
          stroke: '#333',
          strokeWidth: isHalf ? 1 : 2,
          originX: 'center',
          originY: 'center'
        }));

        if (!isHalf) {
          lines.push(new fabric.Text(i.toString(), {
            left: x,
            top: startY + lineLen + 5,
            fontSize: 12,
            fontFamily: 'Arial',
            fill: '#333',
            originX: 'center',
            originY: 'top'
          }));
        }
      }

      const rulerGroup = new fabric.Group([frame, ...lines], {
        left: canvasWidth / 2,
        top: canvasHeight / 2,
        originX: 'center',
        originY: 'center',
        transparentCorners: false,
        cornerStyle: 'circle',
        padding: 5
      });

      (rulerGroup as any).isRuler = true;
      (rulerGroup as any).id = uuidv4();

      // --- Add Delete Control ---
      rulerGroup.lockScalingX = true;
      rulerGroup.lockScalingY = true;
      rulerGroup.hasBorders = false;
      rulerGroup.borderColor = 'transparent';
      rulerGroup.cornerColor = 'transparent';
      rulerGroup.cornerStrokeColor = 'transparent';
      rulerGroup.controls = {
        rotationControl: createRotationControl(),
        deleteControl: createSmallDeleteControl((target, canvas) => {
          canvas.remove(target);
          canvas.requestRenderAll();
          const { updatePageData, currentPageId } = useWhiteboardStore.getState();
          updatePageData(currentPageId, (canvas as any).toJSON(['id', 'youtubeId', 'timerType', 'isRuler', 'isLockedStroke']));
        })
      };
      // --- End Delete Control ---

      fabricCanvas.add(rulerGroup);
      fabricCanvas.setActiveObject(rulerGroup);
      fabricCanvas.renderAll();
      
      const { updatePageData, currentPageId } = useWhiteboardStore.getState();
      updatePageData(currentPageId, (fabricCanvas as any).toJSON(['id', 'youtubeId', 'timerType', 'isRuler', 'isLockedStroke']));

      consumeNewRuler();
      useWhiteboardStore.getState().setActiveTool('move');
    }
  }, [newRuler, fabricCanvas, consumeNewRuler]);

  // Handle Add Background
  useEffect(() => {
    if (fabricCanvas && newBackgroundUrl) {
      fabric.Image.fromURL(newBackgroundUrl).then((img) => {
        const canvasWidth = fabricCanvas.width || 800;
        const canvasHeight = fabricCanvas.height || 600;
        const scale = Math.max(canvasWidth / img.width!, canvasHeight / img.height!);

        img.set({
          scaleX: scale,
          scaleY: scale,
          originX: 'left',
          originY: 'top'
        });
        
        fabricCanvas.backgroundImage = img;
        fabricCanvas.renderAll();
        
        consumeNewBackground();
      });
    }
  }, [newBackgroundUrl, fabricCanvas, consumeNewBackground]);

  const prevPageId = useRef(currentPageId);
  const prevNotebookLoadSignal = useRef(notebookLoadSignal);

  // Sync Canvas with Page State
  useEffect(() => {
    if (!fabricCanvas) return;

    const pageChanged = prevPageId.current !== currentPageId;
    const notebookLoaded = prevNotebookLoadSignal.current !== notebookLoadSignal;

    if (!pageChanged && !notebookLoaded) return;

    // Reset full history when a new notebook is loaded
    if (notebookLoaded) {
      historyRef.current = {};
      useWhiteboardStore.getState().setCanUndo(false);
      useWhiteboardStore.getState().setCanRedo(false);
    }

    // Save old page state only when switching pages within the same notebook
    if (pageChanged) {
      const oldJson: any = (fabricCanvas as any).toJSON(['id', 'youtubeId', 'timerType', 'isRuler', 'isLockedStroke']);
      updatePageData(prevPageId.current, oldJson);
    }

    const newPage = pages.find(p => p.id === currentPageId);
    if (newPage?.canvasData) {
      isHistoryLocked.current = true;
      void fabricCanvas
        .loadFromJSON(newPage.canvasData)
        .then(() => {
          fabricCanvas.getObjects().forEach((obj) => {
            if (isTextObject(obj)) {
              obj.controls = createTextControls((target, canvas) => {
                canvas.remove(target);
                canvas.requestRenderAll();
                const { updatePageData, currentPageId } = useWhiteboardStore.getState();
                updatePageData(currentPageId, canvas.toJSON());
                setSelectedTextParams(null);
              });
              obj.set({
                lockScalingFlip: true,
                minWidth: obj.minWidth || 120,
              });
            }
          });
          fabricCanvas.requestRenderAll();
          isHistoryLocked.current = false;
          // Baseline entry so the user can undo back to the loaded state
          const hist = getPageHistory(currentPageId);
          if (hist.index === -1) {
            const json = (fabricCanvas as any).toJSON(CANVAS_JSON_KEYS);
            hist.stack = [json];
            hist.index = 0;
            useWhiteboardStore.getState().setCanUndo(false);
            useWhiteboardStore.getState().setCanRedo(false);
          }
        })
        .catch((error) => {
          isHistoryLocked.current = false;
          console.error('Fehler beim Laden des Canvas-JSON:', error);
        });
    } else {
      fabricCanvas.clear();
      fabricCanvas.backgroundColor = '#ffffff';
      fabricCanvas.renderAll();
      // Baseline: empty canvas
      const hist = getPageHistory(currentPageId);
      if (hist.index === -1) {
        const json = (fabricCanvas as any).toJSON(CANVAS_JSON_KEYS);
        hist.stack = [json];
        hist.index = 0;
        useWhiteboardStore.getState().setCanUndo(false);
        useWhiteboardStore.getState().setCanRedo(false);
      }
    }

    prevPageId.current = currentPageId;
    prevNotebookLoadSignal.current = notebookLoadSignal;
  }, [currentPageId, notebookLoadSignal, fabricCanvas, pages, updatePageData]);

  // Save changes continually when objects modify or draw ends, so that we don't lose data if we leave the app
  // Debouncing could be better here, but for now we'll do it on path:created and object:modified
  useEffect(() => {
    if (!fabricCanvas) return;
    
    let isErasing = false;
    let erasureRafPending = false;
    let lastErasureEvent: any = null;
    let isSnapping = false;
    let isDrawingStraight = false;
    let isDrawingRs = false;
    let rsMoved = false;
    let snapLine: fabric.Line | null = null;
    let activeRuler: fabric.Object | null = null;
    let rsStartPoint: { x: number; y: number } | null = null;
    let rsPointerDownOnObject = false;

    // Snap against the actual transformed top edge of the ruler group.
    const getRulerTopEdgeProjection = (pointer: {x: number, y: number}, ruler: fabric.Object) => {
      const coords = ruler.getCoords();
      if (!coords || coords.length < 4) {
        return null;
      }

      const topLeft = coords[0];
      const topRight = coords[1];
      const edgeX = topRight.x - topLeft.x;
      const edgeY = topRight.y - topLeft.y;
      const edgeLengthSquared = edgeX * edgeX + edgeY * edgeY;

      if (edgeLengthSquared === 0) {
        return null;
      }

      const pointerVecX = pointer.x - topLeft.x;
      const pointerVecY = pointer.y - topLeft.y;
      const rawT = (pointerVecX * edgeX + pointerVecY * edgeY) / edgeLengthSquared;
      const clampedT = Math.max(0, Math.min(1, rawT));

      const projX = topLeft.x + clampedT * edgeX;
      const projY = topLeft.y + clampedT * edgeY;
      const dist = Math.hypot(pointer.x - projX, pointer.y - projY);

      return { projX, projY, dist };
    };

    const performErasure = (e: any) => {
      if (!isErasing) return;

      const pointer = fabricCanvas.getScenePoint(e.e);
      const radius = useWhiteboardStore.getState().eraserWidth / 2;
      const r2 = radius * radius;

      const toRemove: fabric.Object[] = [];
      const toAdd: fabric.Path[] = [];

      for (const obj of fabricCanvas.getObjects()) {
        if ((obj as any).isRuler || (obj as any).timerType || (obj as any).youtubeId) continue;

        const bounds = obj.getBoundingRect();
        if (
          pointer.x < bounds.left - radius || pointer.x > bounds.left + bounds.width + radius ||
          pointer.y < bounds.top - radius  || pointer.y > bounds.top + bounds.height + radius
        ) continue;

        if (obj.type === 'path') {
          const result = eraseFromPath(obj as fabric.Path, pointer, radius);
          if (result !== null) {
            toRemove.push(obj);
            toAdd.push(...result);
          }
        } else if (
          obj.type === 'line' || obj.type === 'circle' ||
          obj.type === 'rect' || obj.type === 'triangle'
        ) {
          // For simple shapes: check center distance for a quick hit test
          const cx = bounds.left + bounds.width / 2;
          const cy = bounds.top + bounds.height / 2;
          const dx = pointer.x - cx, dy = pointer.y - cy;
          if (dx * dx + dy * dy <= (Math.max(bounds.width, bounds.height) / 2 + radius) ** 2) {
            toRemove.push(obj);
          }
        }
      }

      if (toRemove.length > 0 || toAdd.length > 0) {
        toRemove.forEach(o => fabricCanvas.remove(o));
        toAdd.forEach(p => fabricCanvas.add(p));
        fabricCanvas.renderAll();
      }
    };

    const onMouseDown = (e: any) => {
      if (activeTool === 'eraser') {
        isErasing = true;
        performErasure(e);
      } else if (activeTool === 'rs') {
        const pointer = fabricCanvas.getScenePoint(e.e);
        rsPointerDownOnObject = !!e.target;
        rsStartPoint = pointer;
        rsMoved = false;
        if (!rsPointerDownOnObject) {
          setRsPicker(null);
          isDrawingRs = true;
          fabricCanvas.selection = false;
          snapLine = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
            stroke: 'rgba(220, 255, 0, 0.45)',
            strokeWidth: 22,
            strokeLineCap: 'round',
            originX: 'center',
            originY: 'center',
            selectable: false,
            evented: false,
            hasControls: false,
            hasBorders: false
          });
          (snapLine as any).isLockedStroke = true;
          fabricCanvas.add(snapLine);
        }
      } else if (activeTool === 'pen') {
        const ruler = fabricCanvas.getObjects().find(o => (o as any).isRuler);
        let snappingToRuler = false;
        if (ruler) {
          const pointer = fabricCanvas.getScenePoint(e.e);
          const snapResult = getRulerTopEdgeProjection(pointer, ruler);
          
          if (snapResult && snapResult.dist < 28) {
            isSnapping = true;
            snappingToRuler = true;
            activeRuler = ruler;
            fabricCanvas.isDrawingMode = false; // Disable freehand
            
            const state = useWhiteboardStore.getState();
            snapLine = new fabric.Line([snapResult.projX, snapResult.projY, snapResult.projX, snapResult.projY], {
              stroke: state.penColor,
              strokeWidth: state.penWidth,
              strokeLineCap: 'round',
              originX: 'center',
              originY: 'center',
              selectable: false,
              evented: false,
              hasControls: false,
              hasBorders: false
            });
            (snapLine as any).isLockedStroke = true;
            fabricCanvas.add(snapLine);
          }
        }

        if (!snappingToRuler && useWhiteboardStore.getState().isStraightLineMode) {
          isDrawingStraight = true;
          fabricCanvas.isDrawingMode = false;
          const pointer = fabricCanvas.getScenePoint(e.e);
          const state = useWhiteboardStore.getState();
          snapLine = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
            stroke: state.penColor,
            strokeWidth: state.penWidth,
            strokeLineCap: 'round',
            originX: 'center',
            originY: 'center',
            selectable: false,
            evented: false
          });
          fabricCanvas.add(snapLine);
        }
      }
    };

    const onMouseMove = (e: any) => {
      if (isErasing) {
        lastErasureEvent = e;
        if (!erasureRafPending) {
          erasureRafPending = true;
          requestAnimationFrame(() => {
            erasureRafPending = false;
            if (isErasing && lastErasureEvent) performErasure(lastErasureEvent);
          });
        }
      } else if (activeTool === 'rs' && rsStartPoint) {
        const pointer = fabricCanvas.getScenePoint(e.e);
        if (Math.abs(pointer.x - rsStartPoint.x) > 6 || Math.abs(pointer.y - rsStartPoint.y) > 6) {
          rsMoved = true;
        }
        if (isDrawingRs && snapLine) {
          snapLine.set({ x2: pointer.x, y2: rsStartPoint.y });
          fabricCanvas.requestRenderAll();
        }
      } else if (isSnapping && snapLine && activeRuler) {
        const pointer = fabricCanvas.getScenePoint(e.e);
        const snapResult = getRulerTopEdgeProjection(pointer, activeRuler);
        if (snapResult) {
          snapLine.set({ x2: snapResult.projX, y2: snapResult.projY });
          fabricCanvas.requestRenderAll();
        }
      } else if (isDrawingStraight && snapLine) {
        const pointer = fabricCanvas.getScenePoint(e.e);
        snapLine.set({ x2: pointer.x, y2: pointer.y });
        fabricCanvas.requestRenderAll();
      }
    };

    const finishCurrentStroke = () => {
      if (isErasing) {
        isErasing = false;
        // Save state after we're done erasing
        const json: any = (fabricCanvas as any).toJSON(['id', 'youtubeId', 'timerType', 'isRuler', 'isLockedStroke']);
        updatePageData(currentPageId, json);
      } else if (activeTool === 'rs' && rsStartPoint) {
        if (!rsPointerDownOnObject && !rsMoved) {
          if (snapLine) {
            fabricCanvas.remove(snapLine);
          }
          setRsPicker({ left: rsStartPoint.x, top: rsStartPoint.y });
        } else if (!rsPointerDownOnObject && isDrawingRs && snapLine) {
          snapLine.setCoords();
          const json: any = (fabricCanvas as any).toJSON(['id', 'youtubeId', 'timerType', 'isRuler', 'isLockedStroke']);
          updatePageData(currentPageId, json);
        } else if (rsPointerDownOnObject && rsMoved) {
          const json: any = (fabricCanvas as any).toJSON(['id', 'youtubeId', 'timerType', 'isRuler', 'isLockedStroke']);
          updatePageData(currentPageId, json);
        }
        snapLine = null;
        isDrawingRs = false;
        rsStartPoint = null;
        rsPointerDownOnObject = false;
        rsMoved = false;
        fabricCanvas.selection = true;
      } else if (isSnapping) {
        isSnapping = false;
        if (snapLine) snapLine.setCoords();
        snapLine = null;
        activeRuler = null;
        // Only restore freehand if not in straight line mode
        fabricCanvas.isDrawingMode = !useWhiteboardStore.getState().isStraightLineMode;
        
        const json: any = (fabricCanvas as any).toJSON(['id', 'youtubeId', 'timerType', 'isRuler', 'isLockedStroke']);
        updatePageData(currentPageId, json);
      } else if (isDrawingStraight) {
        isDrawingStraight = false;
        if (snapLine) snapLine.setCoords();
        snapLine = null;
        activeRuler = null;
        
        const json: any = (fabricCanvas as any).toJSON(['id', 'youtubeId', 'timerType', 'isRuler', 'isLockedStroke']);
        updatePageData(currentPageId, json);
      }
    };

    const onMouseUp = () => {
      finishCurrentStroke();
    };

    const onPointerReleasedOutsideCanvas = () => {
      finishCurrentStroke();
    };

    const saveStateForPath = () => {
      if ((activeTool === 'pen' || activeTool === 'rs') && !isSnapping && !isDrawingStraight && !isDrawingRs) {
        const json: any = (fabricCanvas as any).toJSON(['id', 'youtubeId', 'timerType', 'isRuler', 'isLockedStroke']);
        updatePageData(currentPageId, json);
      }
    };

    const saveStateForModified = () => {
      const json: any = (fabricCanvas as any).toJSON(['id', 'youtubeId', 'timerType', 'isRuler', 'isLockedStroke']);
      updatePageData(currentPageId, json);
    };

    fabricCanvas.on('mouse:down', onMouseDown);
    fabricCanvas.on('mouse:move', onMouseMove);
    fabricCanvas.on('mouse:up', onMouseUp);
    fabricCanvas.on('path:created', saveStateForPath);
    fabricCanvas.on('object:modified', saveStateForModified);
    window.addEventListener('pointerup', onPointerReleasedOutsideCanvas);
    window.addEventListener('pointercancel', onPointerReleasedOutsideCanvas);
    window.addEventListener('mouseup', onPointerReleasedOutsideCanvas);
    window.addEventListener('touchend', onPointerReleasedOutsideCanvas);
    
    return () => {
      fabricCanvas.off('mouse:down', onMouseDown);
      fabricCanvas.off('mouse:move', onMouseMove);
      fabricCanvas.off('mouse:up', onMouseUp);
      fabricCanvas.off('path:created', saveStateForPath);
      fabricCanvas.off('object:modified', saveStateForModified);
      window.removeEventListener('pointerup', onPointerReleasedOutsideCanvas);
      window.removeEventListener('pointercancel', onPointerReleasedOutsideCanvas);
      window.removeEventListener('mouseup', onPointerReleasedOutsideCanvas);
      window.removeEventListener('touchend', onPointerReleasedOutsideCanvas);
    };
  }, [fabricCanvas, currentPageId, updatePageData, activeTool]);

  // Update Overlay positions
  useEffect(() => {
    if (!fabricCanvas) return;

    const updateOverlays = () => {
      const objects = fabricCanvas.getObjects();
      const videos: YoutubeRect[] = [];
      const newTimers: TimerRect[] = [];

      objects.forEach(obj => {
        const bound = obj.getBoundingRect();
        
        if ((obj as any).youtubeId) {
          if (!(obj as any).id) (obj as any).id = uuidv4();
          videos.push({
            id: (obj as any).id,
            youtubeId: (obj as any).youtubeId,
            top: bound.top,
            left: bound.left,
            width: bound.width,
            height: bound.height
          });
        } else if ((obj as any).timerType) {
          if (!(obj as any).id) (obj as any).id = uuidv4();
          newTimers.push({
            id: (obj as any).id,
            timerType: (obj as any).timerType,
            top: bound.top,
            left: bound.left,
            width: bound.width,
            height: bound.height
          });
        }
      });

      setYoutubeVideos(videos);
      setTimers(newTimers);
    };

    fabricCanvas.on('after:render', updateOverlays);
    // Initial call
    updateOverlays();

    return () => {
      fabricCanvas.off('after:render', updateOverlays);
    };
  }, [fabricCanvas]);

  // Handle text object selection for formatting toolbar
  useEffect(() => {
    if (!fabricCanvas) return;

    const handleSelection = (options: any) => {
      const activeObject = options.selected?.[0] || options.target;
      if (isTextObject(activeObject)) {
        const textObj = activeObject as fabric.Textbox;
        
        // Fabric 6 uses getBoundingRect
        const boundingRect = textObj.getBoundingRect();

        const effectiveFontSize = Math.round(textObj.fontSize || 40);

        setSelectedTextParams({
          obj: textObj,
          top: boundingRect.top - 60, // Position above the text
          left: boundingRect.left + (boundingRect.width / 2),
          isBold: textObj.fontWeight === 'bold', // For mixed styles this might not be fully accurate at the root level, but serves as default
          isItalic: textObj.fontStyle === 'italic',
          isUnderline: !!textObj.underline,
          isLinethrough: !!textObj.linethrough,
          fontSize: effectiveFontSize,
          textAlign: (textObj.textAlign as 'left' | 'center' | 'right' | 'justify') || 'left',
          lineHeight: textObj.lineHeight || 1.16,
          isEditing: !!textObj.isEditing,
        });
      } else {
        setSelectedTextParams(null);
      }
    };

    const handleSelectionCleared = () => {
      setSelectedTextParams(null);
    };

    const handleEditingAction = (options: any) => {
      handleSelection({ target: options.target });
    };

    fabricCanvas.on('selection:created', handleSelection);
    fabricCanvas.on('selection:updated', handleSelection);
    fabricCanvas.on('selection:cleared', handleSelectionCleared);
    fabricCanvas.on('object:modified', handleSelection); // Update params if text object is modified
    fabricCanvas.on('text:editing:entered', handleEditingAction);
    fabricCanvas.on('text:editing:exited', handleEditingAction);

    return () => {
      fabricCanvas.off('selection:created', handleSelection);
      fabricCanvas.off('selection:updated', handleSelection);
      fabricCanvas.off('selection:cleared', handleSelectionCleared);
      fabricCanvas.off('object:modified', handleSelection);
      fabricCanvas.off('text:editing:entered', handleEditingAction);
      fabricCanvas.off('text:editing:exited', handleEditingAction);
    };
  }, [fabricCanvas]);


  // Formatting functions
  const toggleBold = () => {
    if (!selectedTextParams?.obj) return;
    const textObj = selectedTextParams.obj;
    const isEditing = textObj.isEditing;
    const isSelection = isEditing && textObj.selectionStart !== textObj.selectionEnd;
    
    // Check current state based on selection or whole object
    let currentIsBold = false;
    if (isSelection) {
      const style = textObj.getSelectionStyles(textObj.selectionStart!)[0];
      currentIsBold = style ? style.fontWeight === 'bold' : textObj.fontWeight === 'bold';
    } else {
      currentIsBold = textObj.fontWeight === 'bold';
    }

    const nextWeight = currentIsBold ? 'normal' : 'bold';

    if (isSelection) {
      textObj.setSelectionStyles({ fontWeight: nextWeight });
    } else {
      textObj.set({ fontWeight: nextWeight });
    }
    
    fabricCanvas?.renderAll();
    setSelectedTextParams({ ...selectedTextParams, isBold: !currentIsBold });
  };

  const toggleItalic = () => {
    if (!selectedTextParams?.obj) return;
    const textObj = selectedTextParams.obj;
    const isEditing = textObj.isEditing;
    const isSelection = isEditing && textObj.selectionStart !== textObj.selectionEnd;
    
    let currentIsItalic = false;
    if (isSelection) {
      const style = textObj.getSelectionStyles(textObj.selectionStart!)[0];
      currentIsItalic = style ? style.fontStyle === 'italic' : textObj.fontStyle === 'italic';
    } else {
      currentIsItalic = textObj.fontStyle === 'italic';
    }

    const nextStyle = currentIsItalic ? 'normal' : 'italic';

    if (isSelection) {
      textObj.setSelectionStyles({ fontStyle: nextStyle });
    } else {
      textObj.set({ fontStyle: nextStyle });
    }

    fabricCanvas?.renderAll();
    setSelectedTextParams({ ...selectedTextParams, isItalic: !currentIsItalic });
  };

  const toggleUnderline = () => {
    if (!selectedTextParams?.obj) return;
    const textObj = selectedTextParams.obj;
    const isEditing = textObj.isEditing;
    const isSelection = isEditing && textObj.selectionStart !== textObj.selectionEnd;
    
    let currentIsUnderline = false;
    if (isSelection) {
      const style = textObj.getSelectionStyles(textObj.selectionStart!)[0];
      currentIsUnderline = style ? !!style.underline : !!textObj.underline;
    } else {
      currentIsUnderline = !!textObj.underline;
    }

    if (isSelection) {
      textObj.setSelectionStyles({ underline: !currentIsUnderline });
    } else {
      textObj.set({ underline: !currentIsUnderline });
    }

    fabricCanvas?.renderAll();
    setSelectedTextParams({ ...selectedTextParams, isUnderline: !currentIsUnderline });
  };

  const toggleLinethrough = () => {
    if (!selectedTextParams?.obj) return;
    const textObj = selectedTextParams.obj;
    const isEditing = textObj.isEditing;
    const isSelection = isEditing && textObj.selectionStart !== textObj.selectionEnd;
    
    let currentIsLinethrough = false;
    if (isSelection) {
      const style = textObj.getSelectionStyles(textObj.selectionStart!)[0];
      currentIsLinethrough = style ? !!style.linethrough : !!textObj.linethrough;
    } else {
      currentIsLinethrough = !!textObj.linethrough;
    }

    if (isSelection) {
      textObj.setSelectionStyles({ linethrough: !currentIsLinethrough });
    } else {
      textObj.set({ linethrough: !currentIsLinethrough });
    }

    fabricCanvas?.renderAll();
    setSelectedTextParams({ ...selectedTextParams, isLinethrough: !currentIsLinethrough });
  };

  const changeFontSize = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!selectedTextParams?.obj) return;
    const newSize = parseInt(e.target.value, 10);
    const textObj = selectedTextParams.obj;
    const isEditing = textObj.isEditing;
    const isSelection = isEditing && textObj.selectionStart !== textObj.selectionEnd;

    if (isSelection) {
      textObj.setSelectionStyles({ fontSize: newSize });
    } else {
      // If we change the font size for the whole object, 
      // we need to reset the scaling factors to 1 so the perceived size matches the numeric value
      textObj.set({ fontSize: newSize, scaleX: 1, scaleY: 1 });
      
      // Also override any inline selection styles that might conflict
      if (textObj.styles) {
        for (const lineObj of Object.values(textObj.styles)) {
          for (const charObj of Object.values(lineObj)) {
            if (charObj.fontSize) charObj.fontSize = newSize;
          }
        }
      }
    }
    
    // We explicitly call initDimensions because we messed with scale
    textObj.initDimensions();

    fabricCanvas?.renderAll();
    setSelectedTextParams({ ...selectedTextParams, fontSize: newSize });
  };

  const changeTextAlign = (alignment: 'left' | 'center' | 'right') => {
    if (!selectedTextParams?.obj) return;
    selectedTextParams.obj.set({ textAlign: alignment });
    selectedTextParams.obj.initDimensions();
    fabricCanvas?.renderAll();
    setSelectedTextParams({ ...selectedTextParams, textAlign: alignment });
  };

  const changeLineHeight = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!selectedTextParams?.obj) return;
    const nextLineHeight = Number(e.target.value);
    selectedTextParams.obj.set({ lineHeight: nextLineHeight });
    selectedTextParams.obj.initDimensions();
    fabricCanvas?.renderAll();
    setSelectedTextParams({ ...selectedTextParams, lineHeight: nextLineHeight });
  };
  return (
    <div 
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'relative', backgroundColor: '#ffffff' }}
    >
      <canvas ref={canvasRef} />

      <div
        ref={eraserCursorRef}
        style={{
          display: 'none',
          position: 'absolute',
          pointerEvents: 'none',
          borderRadius: '50%',
          border: '2px dashed rgba(0,0,0,0.75)',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.8)',
          zIndex: 200,
        }}
      />

      {rsPicker && activeTool === 'rs' && (
        <div
          style={{
            position: 'absolute',
            left: rsPicker.left,
            top: rsPicker.top,
            width: 0,
            height: 0,
            zIndex: 120,
            pointerEvents: 'none'
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: -20,
              top: -20,
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(220,255,0,0.9) 0%, rgba(220,255,0,0.28) 55%, rgba(220,255,0,0) 100%)',
              boxShadow: '0 0 0 8px rgba(220,255,0,0.08)',
            }}
          />
          {rsSymbols.map((symbol, index) => {
            const radius = 56;
            const angle = (-Math.PI / 2) + (index / rsSymbols.length) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            return (
              <button
                key={symbol.url}
                onClick={() => {
                  useWhiteboardStore.getState().triggerAddImage(symbol.url, rsPicker.left, rsPicker.top);
                  setRsPicker(null);
                }}
                style={{
                  position: 'absolute',
                  left: x - 22,
                  top: y - 22,
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  border: '1px solid rgba(148, 163, 184, 0.3)',
                  background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
                  boxShadow: '0 8px 18px rgba(15, 23, 42, 0.14)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  pointerEvents: 'auto',
                  transition: 'transform 0.14s ease, box-shadow 0.14s ease, border-color 0.14s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.12)';
                  e.currentTarget.style.boxShadow = '0 12px 24px rgba(15, 23, 42, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.45)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 8px 18px rgba(15, 23, 42, 0.14)';
                  e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.3)';
                }}
                title={symbol.name}
              >
                <img
                  src={symbol.url}
                  alt={symbol.name}
                  style={{ maxWidth: '62%', maxHeight: '62%', objectFit: 'contain' }}
                  draggable={false}
                />
              </button>
            );
          })}
        </div>
      )}
	      
      {/* YouTube Video Overlays */}
      {youtubeVideos.map((video, index) => (
        <div 
          key={`${video.youtubeId}-${index}`}
          style={{
            position: 'absolute',
            top: video.top,
            left: video.left,
            width: video.width,
            height: video.height,
            pointerEvents: activeTool === 'move' ? 'none' : 'auto',
            zIndex: 10
          }}
        >
          <iframe
            width="100%"
            height="100%"
            src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}`}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ pointerEvents: activeTool === 'move' ? 'none' : 'auto' }}
          ></iframe>
        </div>
      ))}

      {/* Timer Overlays */}
      {timers.map((timer, index) => (
        <TimerOverlay
          key={`${timer.timerType}-${index}`}
          timer={timer}
          activeTool={activeTool}
          isSelected={selectedTimerId === timer.id}
        />
      ))}

      {/* Floating Text Formatting Toolbar */}
      {selectedTextParams && selectedTextParams.isEditing && (activeTool === 'move' || activeTool === 'text') && (
        <div style={{
          position: 'absolute',
          top: Math.max(10, selectedTextParams.top), 
          left: Math.max(10, selectedTextParams.left),
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'var(--surface)',
          padding: '8px 12px',
          borderRadius: '12px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
          border: '1px solid var(--border)',
          zIndex: 100,
          pointerEvents: 'auto'
        }}>
          <button 
            onClick={toggleBold} 
            style={{ ...formatBtnStyle, background: selectedTextParams.isBold ? 'var(--border)' : 'transparent' }} 
            title="Fett"
          >
            <Bold size={16} />
          </button>
          <button 
            onClick={toggleItalic} 
            style={{ ...formatBtnStyle, background: selectedTextParams.isItalic ? 'var(--border)' : 'transparent' }} 
            title="Kursiv"
          >
            <Italic size={16} />
          </button>
          <button 
            onClick={toggleUnderline} 
            style={{ ...formatBtnStyle, background: selectedTextParams.isUnderline ? 'var(--border)' : 'transparent' }} 
            title="Unterstrichen"
          >
            <Underline size={16} />
          </button>
          <button 
            onClick={toggleLinethrough} 
            style={{ ...formatBtnStyle, background: selectedTextParams.isLinethrough ? 'var(--border)' : 'transparent' }} 
            title="Durchgestrichen"
          >
            <Strikethrough size={16} />
          </button>

          <div style={{ width: '1px', height: '24px', background: 'var(--border)', margin: '0 4px' }} />

          <button
            onClick={() => changeTextAlign('left')}
            style={{ ...formatBtnStyle, background: selectedTextParams.textAlign === 'left' ? 'var(--border)' : 'transparent' }}
            title="Linksbündig"
          >
            <AlignLeft size={16} />
          </button>
          <button
            onClick={() => changeTextAlign('center')}
            style={{ ...formatBtnStyle, background: selectedTextParams.textAlign === 'center' ? 'var(--border)' : 'transparent' }}
            title="Zentriert"
          >
            <AlignCenter size={16} />
          </button>
          <button
            onClick={() => changeTextAlign('right')}
            style={{ ...formatBtnStyle, background: selectedTextParams.textAlign === 'right' ? 'var(--border)' : 'transparent' }}
            title="Rechtsbündig"
          >
            <AlignRight size={16} />
          </button>
          
          <div style={{ width: '1px', height: '24px', background: 'var(--border)', margin: '0 4px' }} />
          
          <select 
            value={selectedTextParams.fontSize}
            onChange={changeFontSize}
            style={{
              padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '6px',
              background: 'var(--background)', color: 'var(--foreground)', fontSize: '0.9rem',
              cursor: 'pointer'
            }}
          >
            {[16, 20, 24, 32, 40, 48, 64, 80, 100, 120].map(size => (
              <option key={size} value={size}>{size}px</option>
            ))}
          </select>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Rows3 size={14} color="var(--foreground)" />
            <select
              value={selectedTextParams.lineHeight}
              onChange={changeLineHeight}
              style={{
                padding: '4px 8px',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                background: 'var(--background)',
                color: 'var(--foreground)',
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
              title="Zeilenabstand"
            >
              {[1, 1.1, 1.2, 1.35, 1.5, 1.8, 2].map(value => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

const formatBtnStyle: React.CSSProperties = {
  border: 'none', 
  borderRadius: '6px', 
  width: '32px', 
  height: '32px', 
  display: 'flex', 
  alignItems: 'center', 
  justifyContent: 'center',
  cursor: 'pointer',
  color: 'var(--foreground)',
  transition: 'background-color 0.1s'
};
