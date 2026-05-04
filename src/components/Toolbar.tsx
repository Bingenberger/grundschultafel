import { useWhiteboardStore, ToolType } from '@/store/useWhiteboardStore';
import { MousePointer2, Pen, Eraser, Trash2, Image as ImageIcon, ImagePlus, QrCode, X, Youtube, Camera, Type, Briefcase, Shapes, Minus, PlusSquare, PaintBucket, Highlighter, Undo2, Redo2 } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';
import GalleryModal from './GalleryModal';
import YoutubeModal from './YoutubeModal';
import ToolboxModal from './ToolboxModal';
import ShapeModal from './ShapeModal';
import { QRCodeCanvas } from 'qrcode.react';
import { v4 as uuidv4 } from 'uuid';

export default function Toolbar() {
  const {
    activeTool, setActiveTool, triggerClearCanvas, triggerAddImage, triggerSetBackground, triggerAddYoutubeVideo, triggerAddTimer,
    penColor, setPenColor, penWidth, setPenWidth,
    isStraightLineMode, setStraightLineMode,
    highlighterColor, setHighlighterColor, highlighterWidth, setHighlighterWidth,
    eraserWidth, setEraserWidth,
    canUndo, triggerUndo, canRedo, triggerRedo,
  } = useWhiteboardStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const penSettingsRef = useRef<HTMLDivElement>(null);
  const highlighterSettingsRef = useRef<HTMLDivElement>(null);
  const eraserSettingsRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [backgrounds, setBackgrounds] = useState<string[]>([]);
  const [showBgSelector, setShowBgSelector] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showYoutube, setShowYoutube] = useState(false);
  const [showToolbox, setShowToolbox] = useState(false);
  const [showShapes, setShowShapes] = useState(false);
  const [showPenSettings, setShowPenSettings] = useState(false);
  const [showHighlighterSettings, setShowHighlighterSettings] = useState(false);
  const [showEraserSettings, setShowEraserSettings] = useState(false);
  const [showInsertMenu, setShowInsertMenu] = useState(false);
  const [qrToken, setQrToken] = useState<string>('');

  const closeInsertRelatedMenus = () => {
    setShowInsertMenu(false);
    setShowBgSelector(false);
    setShowGallery(false);
    setShowYoutube(false);
    setShowShapes(false);
  };

  const closeToolbarMenus = () => {
    closeInsertRelatedMenus();
    setShowToolbox(false);
    setShowPenSettings(false);
    setShowHighlighterSettings(false);
    setShowEraserSettings(false);
  };

  useEffect(() => {
    fetch('/api/backgrounds')
      .then(res => res.json())
      .then(data => {
        if (data.backgrounds) setBackgrounds(data.backgrounds);
      })
      .catch(console.error);

  }, []);

  // Polling logic when QR Modal is open
  useEffect(() => {
    if (!showQrModal || !qrToken) return;

    const interval = setInterval(() => {
      fetch(`/api/mobile-upload?token=${qrToken}`)
        .then(res => res.json())
        .then(data => {
          if (data.imageUrl) {
            // Convert to data URL so Fabric.js can load it reliably (same as local upload)
            fetch(data.imageUrl)
              .then(r => r.blob())
              .then(blob => new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              }))
              .then(dataUrl => {
                triggerAddImage(dataUrl);
                setShowQrModal(false);
              })
              .catch(err => {
                console.error('[QR-Upload] Bild konnte nicht geladen werden:', err);
                setShowQrModal(false);
              });
          }
        })
        .catch(console.error);
    }, 2000); // poll every 2 seconds

    return () => clearInterval(interval);
  }, [showQrModal, qrToken, triggerAddImage]);

  const handleOpenQr = () => {
    setQrToken(uuidv4());
    setShowQrModal(true);
    closeInsertRelatedMenus();
    setShowToolbox(false);
  };

  const handleOpenYoutube = () => {
    setShowInsertMenu(false);
    setShowYoutube(true);
    setShowBgSelector(false);
    setShowGallery(false);
    setShowQrModal(false);
    setShowToolbox(false);
    setShowShapes(false);
  };

  const handleOpenToolbox = () => {
    setShowToolbox(true);
    setShowYoutube(false);
    setShowBgSelector(false);
    setShowGallery(false);
    setShowQrModal(false);
    setShowPenSettings(false);
    setShowShapes(false);
  };

  const handleOpenShapes = () => {
    setShowInsertMenu(false);
    setShowShapes(true);
    setShowToolbox(false);
    setShowYoutube(false);
    setShowBgSelector(false);
    setShowGallery(false);
    setShowQrModal(false);
    setShowPenSettings(false);
  };

  const handleToolClick = (tool: ToolType) => {
    closeToolbarMenus();
    if (tool === 'pen') {
      if (activeTool === 'pen') {
        setShowPenSettings(!showPenSettings);
      } else {
        setActiveTool('pen');
      }
    } else if (tool === 'highlighter') {
      if (activeTool === 'highlighter') {
        setShowHighlighterSettings(!showHighlighterSettings);
      } else {
        setActiveTool('highlighter');
      }
    } else if (tool === 'eraser') {
      if (activeTool === 'eraser') {
        setShowEraserSettings(!showEraserSettings);
      } else {
        setActiveTool('eraser');
      }
    } else {
      setActiveTool(tool);
    }
  };

  useEffect(() => {
    if (activeTool !== 'pen') setShowPenSettings(false);
  }, [activeTool]);

  useEffect(() => {
    if (activeTool !== 'highlighter') setShowHighlighterSettings(false);
  }, [activeTool]);

  useEffect(() => {
    if (activeTool !== 'eraser') setShowEraserSettings(false);
  }, [activeTool]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (toolbarRef.current?.contains(target)) return;
      if (penSettingsRef.current?.contains(target)) return;
      if (highlighterSettingsRef.current?.contains(target)) return;
      if (eraserSettingsRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest('[data-gallery-modal="true"]')) return;
      if (target instanceof Element && target.closest('[data-youtube-modal="true"]')) return;
      closeToolbarMenus();
    };

    window.addEventListener('pointerdown', handlePointerDown, true);
    return () => window.removeEventListener('pointerdown', handlePointerDown, true);
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        triggerAddImage(dataUrl);
        setShowGallery(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
  };

  const handleScreenshot = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        alert("Dein Browser (z.B. Chrome auf dem iPad oder eine ältere iOS Version) unterstützt leider keine Bildschirmaufnahmen aus dieser App heraus. Bitte nutze Safari oder die native Screenshot-Funktion des iPads.");
        return;
      }

      // Keep it simple for Safari compatibility
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });

      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      
      // Wait for the video to start playing and have dimensions
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => {
          video.play().then(() => {
            // Give the video a short moment to render the first frame
            setTimeout(resolve, 300);
          });
        };
      });

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        triggerAddImage(dataUrl);
      }
      
      // Stop all tracks
      stream.getTracks().forEach(track => track.stop());

    } catch (err) {
      console.error("Fehler bei der Screenshot-Aufnahme: ", err);
    }
  };

  const PRESET_COLORS = ['#000000', '#F44336', '#4CAF50', '#2196F3', '#FFC107', '#9C27B0', '#795548', '#ffffff'];
  const HIGHLIGHTER_COLORS = ['#FFFF00', '#ADFF2F', '#00FFFF', '#FF69B4', '#FFA500', '#FF6347'];

  return (
    <>
      {/* Pen Settings Overlay */}
	      {showPenSettings && activeTool === 'pen' && (
	        <div style={{
	          position: 'absolute',
          bottom: 'calc(env(safe-area-inset-bottom, 20px) + 70px)',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--surface)',
          padding: '16px',
          borderRadius: '16px',
          boxShadow: '0 8px 25px rgba(0,0,0,0.2)',
          border: '1px solid var(--border)',
          zIndex: 99,
          display: 'flex',
          flexDirection: 'column',
	          gap: '12px',
	          width: 'max-content',
	        }}
          ref={penSettingsRef}>
          {/* Thickness Slider */}
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '8px', color: 'var(--foreground)' }}>Stiftdicke: {penWidth}px</div>
            <input 
              type="range" 
              min="1" 
              max="50" 
              value={penWidth} 
              onChange={(e) => setPenWidth(Number(e.target.value))}
              style={{ width: '200px', accentColor: 'var(--primary)', cursor: 'pointer' }} 
            />
          </div>
          
          <div style={{ width: '100%', height: '1px', background: 'var(--border)' }}></div>
          
          {/* Color Palette */}
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '8px', color: 'var(--foreground)' }}>Farbe</div>
	            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', maxWidth: '200px' }}>
	              {PRESET_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setPenColor(color)}
                  style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    backgroundColor: color, cursor: 'pointer',
                    border: penColor === color ? '3px solid var(--primary)' : '1px solid var(--border)',
                    boxShadow: penColor === color ? '0 0 0 2px var(--background)' : 'none',
                    padding: 0, transition: 'transform 0.1s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
	                  title={color}
	                />
	              ))}

                <label style={{
                  position: 'relative',
                  width: '32px', height: '32px', borderRadius: '50%',
                  cursor: 'pointer', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
                  overflow: 'hidden', padding: 0
                }}
                title="Eigene Farbe">
                  <input
                    type="color"
                    value={penColor}
                    onChange={(e) => setPenColor(e.target.value)}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      opacity: 0,
                      width: '100%',
                      height: '100%',
                      cursor: 'pointer',
                      border: 'none',
                      padding: 0
                    }}
                  />
                </label>
	            </div>
	          </div>

	          <div style={{ width: '100%', height: '1px', background: 'var(--border)' }}></div>
          
          {/* Straight Line Toggle */}
          <button
            onClick={() => setStraightLineMode(!isStraightLineMode)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '8px',
              borderRadius: '8px',
              border: isStraightLineMode ? '2px solid var(--primary)' : '1px solid var(--border)',
              background: isStraightLineMode ? 'rgba(76, 175, 80, 0.1)' : 'transparent',
              color: isStraightLineMode ? 'var(--primary)' : 'var(--foreground)',
              cursor: 'pointer',
              fontWeight: 'bold',
              transition: 'all 0.2s',
            }}
          >
            <Minus size={18} /> Gerade Linie
          </button>
        </div>
      )}

      {showHighlighterSettings && activeTool === 'highlighter' && (
        <div ref={highlighterSettingsRef} style={{
          position: 'absolute',
          bottom: 'calc(env(safe-area-inset-bottom, 20px) + 70px)',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--surface)',
          padding: '16px',
          borderRadius: '16px',
          boxShadow: '0 8px 25px rgba(0,0,0,0.2)',
          border: '1px solid var(--border)',
          zIndex: 99,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          width: 'max-content',
        }}>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '8px', color: 'var(--foreground)' }}>Breite: {highlighterWidth}px</div>
            <input
              type="range"
              min="8"
              max="60"
              value={highlighterWidth}
              onChange={(e) => setHighlighterWidth(Number(e.target.value))}
              style={{ width: '200px', accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
          </div>
          <div style={{ width: '100%', height: '1px', background: 'var(--border)' }} />
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '8px', color: 'var(--foreground)' }}>Farbe</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', maxWidth: '200px' }}>
              {HIGHLIGHTER_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setHighlighterColor(color)}
                  style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    backgroundColor: color, cursor: 'pointer',
                    border: highlighterColor === color ? '3px solid var(--primary)' : '1px solid var(--border)',
                    boxShadow: highlighterColor === color ? '0 0 0 2px var(--background)' : 'none',
                    padding: 0, opacity: 0.85,
                  }}
                  title={color}
                />
              ))}
              <label style={{
                position: 'relative',
                width: '32px', height: '32px', borderRadius: '50%',
                cursor: 'pointer', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
                overflow: 'hidden', padding: 0,
              }} title="Eigene Farbe">
                <input
                  type="color"
                  value={highlighterColor}
                  onChange={(e) => setHighlighterColor(e.target.value)}
                  style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', border: 'none', padding: 0 }}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {showEraserSettings && activeTool === 'eraser' && (
        <div ref={eraserSettingsRef} style={{
          position: 'absolute',
          bottom: 'calc(env(safe-area-inset-bottom, 20px) + 70px)',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--surface)',
          padding: '16px',
          borderRadius: '16px',
          boxShadow: '0 8px 25px rgba(0,0,0,0.2)',
          border: '1px solid var(--border)',
          zIndex: 99,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          width: 'max-content',
        }}>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '8px', color: 'var(--foreground)' }}>
              Radierer-Größe: {eraserWidth}px
            </div>
            <input
              type="range"
              min="8"
              max="80"
              value={eraserWidth}
              onChange={(e) => setEraserWidth(Number(e.target.value))}
              style={{ width: '200px', accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
          </div>
        </div>
      )}

	      <div style={{
	        position: 'absolute',
	        bottom: 'env(safe-area-inset-bottom, 20px)',
        marginBottom: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '4px',
        backgroundColor: 'var(--surface)',
        padding: '6px 12px',
        borderRadius: '20px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 100,
        border: '1px solid var(--border)',
        alignItems: 'center',
	        width: 'max-content',
	        maxWidth: '96%'
	      }}
        ref={toolbarRef}>
        <ToolButton 
          active={activeTool === 'pen'} 
          onClick={() => handleToolClick('pen')} 
          icon={<Pen size={20} />} 
          label="Stift" 
        />
        <ToolButton 
          active={activeTool === 'text'} 
          onClick={() => handleToolClick('text')} 
          icon={<Type size={20} />} 
          label="Text" 
        />
	        <ToolButton
	          active={activeTool === 'eraser'}
	          onClick={() => handleToolClick('eraser')}
	          icon={<Eraser size={20} />}
	          label="Radierer"
	        />
          <ToolButton
            active={activeTool === 'highlighter'}
            onClick={() => handleToolClick('highlighter')}
            icon={<Highlighter size={20} />}
            label="Marker"
          />
          <ToolButton
            active={activeTool === 'fill'}
            onClick={() => handleToolClick('fill')}
            icon={<PaintBucket size={20} />}
            label="Füllen"
          />
		        <ToolButton 
		          active={activeTool === 'move'} 
		          onClick={() => handleToolClick('move')} 
	          icon={<MousePointer2 size={20} />} 
	          label="Bewegen" 
	        />
	        <ToolButton
	          active={activeTool === 'rs'}
	          onClick={() => handleToolClick('rs')}
	          icon={<Pen size={20} />}
	          label="RS-Stift"
	        />
	        
	        <div style={{ width: '1px', height: '30px', backgroundColor: 'var(--border)', margin: '0 2px' }} />

	        <input 
	          type="file" 
	          accept="image/*" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={handleImageUpload} 
        />
	        <div style={{ position: 'relative' }}>
	          <ToolButton 
	            active={showInsertMenu || showGallery || showBgSelector || showYoutube || showShapes}
	            onClick={() => {
	              const next = !showInsertMenu;
	              setShowInsertMenu(next);
	              if (next) {
	                setShowBgSelector(false);
	                setShowGallery(false);
	                setShowYoutube(false);
	                setShowShapes(false);
	                setShowToolbox(false);
	                setShowQrModal(false);
	              }
	            }}
	            icon={<PlusSquare size={20} />}
	            label="Einfügen"
	          />

	          {showInsertMenu && (
	            <div style={{
	              position: 'absolute',
	              bottom: '70px',
	              left: '50%',
	              transform: 'translateX(-50%)',
	              backgroundColor: 'var(--surface)',
	              border: '1px solid var(--border)',
	              borderRadius: '16px',
	              padding: '10px',
	              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
	              display: 'grid',
	              gridTemplateColumns: 'repeat(3, minmax(84px, 1fr))',
	              gap: '8px',
	              zIndex: 101,
	              minWidth: '290px'
	            }}>
	              <InsertButton
	                icon={<ImageIcon size={18} />}
	                label="Bild"
	                onClick={() => {
	                  setShowInsertMenu(false);
	                  setShowGallery(true);
	                }}
	              />
	              <InsertButton
	                icon={<ImagePlus size={18} />}
	                label="Hintergrund"
	                onClick={() => {
	                  setShowInsertMenu(false);
	                  setShowBgSelector(true);
	                }}
	              />
	              <InsertButton
	                icon={<Camera size={18} />}
	                label="Screenshot"
	                onClick={() => {
	                  setShowInsertMenu(false);
	                  handleScreenshot();
	                }}
	              />
	              <InsertButton
	                icon={<Shapes size={18} />}
	                label="Formen"
	                onClick={handleOpenShapes}
	              />
	              <InsertButton
	                icon={<Youtube size={18} />}
	                label="Video"
	                onClick={handleOpenYoutube}
	              />
	            </div>
	          )}
	        
	          {showBgSelector && (
	            <div style={{
	              position: 'absolute',
	              bottom: '70px',
	              left: '50%',
	              transform: 'translateX(-50%)',
	              backgroundColor: 'var(--surface)',
	              border: '1px solid var(--border)',
	              borderRadius: '16px',
	              padding: '15px',
	              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
	              display: 'grid',
	              gridTemplateColumns: 'repeat(3, 1fr)',
	              gap: '15px',
	              width: '450px',
	              maxHeight: '400px',
	              overflowY: 'auto',
	              zIndex: 101
	            }}>
	              {backgrounds.length === 0 ? (
	                <div style={{ gridColumn: 'span 3', textAlign: 'center', color: 'var(--border)', fontSize: '0.8rem' }}>
	                  Keine Hintergründe in /public/assets/backgrounds
	                </div>
	              ) : (
	                backgrounds.map(bg => (
	                  <button
	                    key={bg}
	                    onClick={() => {
	                      triggerSetBackground(bg);
	                      setShowBgSelector(false);
	                    }}
	                    style={{
	                      width: '100%',
	                      aspectRatio: '4/3',
	                      backgroundImage: `url(${bg})`,
	                      backgroundSize: 'cover',
	                      backgroundPosition: 'center',
	                      border: '2px solid transparent',
	                      borderRadius: '6px',
	                      cursor: 'pointer',
	                      transition: 'border-color 0.2s',
	                    }}
	                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
	                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
	                    title="Hintergrund wählen"
	                  />
	                ))
	              )}
	              <button
	                onClick={() => {
	                  triggerSetBackground('');
	                  setShowBgSelector(false);
	                }}
	                style={{
	                  gridColumn: 'span 3',
	                  padding: '8px',
	                  marginTop: '5px',
	                  backgroundColor: 'var(--danger)',
	                  color: 'white',
	                  border: 'none',
	                  borderRadius: '6px',
	                  cursor: 'pointer',
	                  fontWeight: 'bold',
	                  fontSize: '0.8rem'
	                }}
	              >
	                Hintergrund entfernen
	              </button>
	            </div>
	          )}

            {showShapes && <ShapeModal onClose={() => setShowShapes(false)} />}
	        </div>

      <div style={{ width: '1px', height: '30px', backgroundColor: 'var(--border)', margin: '0 2px' }} />

      <button
        onClick={triggerUndo}
        disabled={!canUndo}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', cursor: canUndo ? 'pointer' : 'default',
          padding: '8px', borderRadius: '12px',
          color: canUndo ? 'var(--foreground)' : 'var(--border)',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => { if (canUndo) e.currentTarget.style.backgroundColor = 'var(--surface)'; }}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        title="Rückgängig (Strg+Z)"
      >
        <Undo2 size={20} />
        <span style={{ fontSize: '0.65rem', marginTop: '2px', fontWeight: 'bold' }}>Zurück</span>
      </button>

      <button
        onClick={triggerRedo}
        disabled={!canRedo}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', cursor: canRedo ? 'pointer' : 'default',
          padding: '8px', borderRadius: '12px',
          color: canRedo ? 'var(--foreground)' : 'var(--border)',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => { if (canRedo) e.currentTarget.style.backgroundColor = 'var(--surface)'; }}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        title="Wiederholen (Strg+Y)"
      >
        <Redo2 size={20} />
        <span style={{ fontSize: '0.65rem', marginTop: '2px', fontWeight: 'bold' }}>Vor</span>
      </button>

      <div style={{ width: '1px', height: '30px', backgroundColor: 'var(--border)', margin: '0 2px' }} />

	      <button
	        onClick={triggerClearCanvas}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '8px',
          color: 'var(--danger)',
          transition: 'all 0.2s',
          borderRadius: '12px'
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        title="Tafel löschen"
      >
        <Trash2 size={20} />
        <span style={{ fontSize: '0.65rem', marginTop: '2px', fontWeight: 'bold' }}>Löschen</span>
      </button>

	      <div style={{ width: '1px', height: '30px', backgroundColor: 'var(--border)', margin: '0 2px' }} />

      <div style={{ width: '1px', height: '30px', backgroundColor: 'var(--border)', margin: '0 2px' }} />

      {/* Toolbox Button */}
	      <div style={{ position: 'relative' }}>
	        <button
	          onClick={() => {
              closeInsertRelatedMenus();
              handleOpenToolbox();
            }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: showToolbox ? 'var(--primary)' : 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
            color: showToolbox ? 'white' : 'var(--foreground)',
            transition: 'all 0.2s',
            borderRadius: '12px'
          }}
          title="Werkzeugkoffer"
        >
          <Briefcase size={20} />
          <span style={{ fontSize: '0.65rem', marginTop: '2px', fontWeight: 'bold' }}>Werkzeuge</span>
        </button>
        {showToolbox && <ToolboxModal onClose={() => setShowToolbox(false)} />}
      </div>

      <div style={{ width: '1px', height: '30px', backgroundColor: 'var(--border)', margin: '0 2px' }} />

      {/* QR Code Button */}
	      <div style={{ position: 'relative' }}>
	        <button
	          onClick={() => {
              closeToolbarMenus();
              handleOpenQr();
            }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: showQrModal ? 'var(--primary)' : 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
            color: showQrModal ? 'white' : 'var(--foreground)',
            transition: 'all 0.2s',
            borderRadius: '12px'
          }}
          title="Mit Handy verbinden"
        >
          <QrCode size={20} />
          <span style={{ fontSize: '0.65rem', marginTop: '2px', fontWeight: 'bold' }}>Handy</span>
        </button>

        {showQrModal && (
          <div style={{
            position: 'absolute',
            bottom: '70px',
            right: 0,
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '15px',
            width: '280px',
            zIndex: 101
          }}>
            <button 
              onClick={() => setShowQrModal(false)}
              style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--border)' }}
            >
              <X size={20} />
            </button>
            <h3 style={{ margin: 0, color: 'var(--foreground)', textAlign: 'center' }}>Foto vom Handy</h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--border)', textAlign: 'center' }}>
              Scanne QR-Code mit dem Handy oder Tablet:
            </p>
            <div style={{ padding: '10px', background: 'white', borderRadius: '8px' }}>
              <QRCodeCanvas
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/upload?token=${qrToken}`}
                size={200}
                level={"M"}
                includeMargin={true}
              />
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--border)', textAlign: 'center' }}>
              Warte auf Foto...
            </p>
          </div>
        )}
      </div>
      </div>

      <GalleryModal 
        isOpen={showGallery} 
        onClose={() => setShowGallery(false)} 
        onSelectImage={(url) => triggerAddImage(url)} 
        onUploadCustom={() => {
          fileInputRef.current?.click();
          setShowGallery(false);
        }} 
      />

	      <YoutubeModal
	        isOpen={showYoutube}
	        onClose={() => setShowYoutube(false)}
	        onSelectVideo={(id) => {
	          triggerAddYoutubeVideo(id);
	          setShowYoutube(false);
	        }}
	      />
	    </>
	  );
	}

function InsertButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        padding: '10px 8px',
        borderRadius: '12px',
        border: 'none',
        background: 'transparent',
        color: 'var(--foreground)',
        cursor: 'pointer',
        transition: 'all 0.2s'
      }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--border)'}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      title={label}
    >
      {icon}
      <span style={{ fontSize: '0.72rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  );
}

function ToolButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: active ? 'var(--primary)' : 'transparent',
        color: active ? 'white' : 'var(--foreground)',
        border: 'none',
        borderRadius: '12px',
        padding: '6px 8px',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.backgroundColor = 'var(--border)';
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.backgroundColor = 'transparent';
      }}
      title={label}
    >
      {icon}
      <span style={{ fontSize: '0.65rem', marginTop: '2px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  );
}
