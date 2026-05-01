import { useWhiteboardStore } from '@/store/useWhiteboardStore';
import { Square, Circle, Triangle, Slash } from 'lucide-react';

interface ShapeModalProps {
  onClose: () => void;
}

export default function ShapeModal({ onClose }: ShapeModalProps) {
  const triggerAddShape = useWhiteboardStore((state) => state.triggerAddShape);
  const shapeStrokeColor = useWhiteboardStore((state) => state.shapeStrokeColor);
  const setShapeStrokeColor = useWhiteboardStore((state) => state.setShapeStrokeColor);
  const shapeFillColor = useWhiteboardStore((state) => state.shapeFillColor);
  const setShapeFillColor = useWhiteboardStore((state) => state.setShapeFillColor);
  const shapeFilled = useWhiteboardStore((state) => state.shapeFilled);
  const setShapeFilled = useWhiteboardStore((state) => state.setShapeFilled);
  const PRESET_COLORS = ['#000000', '#F44336', '#4CAF50', '#2196F3', '#FFC107', '#9C27B0', '#FFFBEB'];

  const addShape = (type: string) => {
    triggerAddShape(type);
    onClose();
  };

  return (
    <div style={{
      position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
      marginBottom: '10px', background: 'var(--surface)', borderRadius: '16px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.15)', border: '1px solid var(--border)',
      padding: '16px', width: '320px', display: 'flex', flexDirection: 'column', gap: '16px',
      zIndex: 100
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--foreground)' }}>Formen</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--foreground)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={shapeFilled}
            onChange={(e) => setShapeFilled(e.target.checked)}
            style={{ accentColor: 'var(--primary)' }}
          />
          Gefüllt
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
        <button onClick={() => addShape('rect')} style={shapeBtnStyle} title="Rechteck">
          <Square size={32} />
        </button>
        <button onClick={() => addShape('circle')} style={shapeBtnStyle} title="Kreis">
          <Circle size={32} />
        </button>
        <button onClick={() => addShape('triangle')} style={shapeBtnStyle} title="Dreieck">
          <Triangle size={32} />
        </button>
        <button onClick={() => addShape('line')} style={shapeBtnStyle} title="Linie">
          <Slash size={32} />
        </button>
      </div>

      <div style={{ display: 'grid', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '8px', color: 'var(--foreground)' }}>Rahmenfarbe</div>
	          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
	            {PRESET_COLORS.map((color) => (
              <button
                key={`stroke-${color}`}
                onClick={() => setShapeStrokeColor(color)}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: color,
                  border: shapeStrokeColor === color ? '3px solid var(--primary)' : '1px solid var(--border)',
                  cursor: 'pointer'
                }}
	                title={color}
	              />
	            ))}
            <label style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              cursor: 'pointer',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
              overflow: 'hidden',
              padding: 0
            }} title="Eigene Rahmenfarbe">
              <input
                type="color"
                value={shapeStrokeColor}
                onChange={(e) => setShapeStrokeColor(e.target.value)}
                style={{ opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
              />
            </label>
	          </div>
	        </div>

        <div style={{ opacity: shapeFilled ? 1 : 0.55 }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '8px', color: 'var(--foreground)' }}>Füllfarbe</div>
	          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
	            {PRESET_COLORS.map((color) => (
              <button
                key={`fill-${color}`}
                onClick={() => setShapeFillColor(color)}
                disabled={!shapeFilled}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: color,
                  border: shapeFillColor === color ? '3px solid var(--primary)' : '1px solid var(--border)',
                  cursor: shapeFilled ? 'pointer' : 'not-allowed'
                }}
	                title={color}
	              />
	            ))}
            <label style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              cursor: shapeFilled ? 'pointer' : 'not-allowed',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
              overflow: 'hidden',
              padding: 0
            }} title="Eigene Füllfarbe">
              <input
                type="color"
                value={shapeFillColor}
                disabled={!shapeFilled}
                onChange={(e) => setShapeFillColor(e.target.value)}
                style={{ opacity: 0, width: '100%', height: '100%', cursor: shapeFilled ? 'pointer' : 'not-allowed' }}
              />
            </label>
	          </div>
	        </div>
      </div>
    </div>
  );
}

const shapeBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--background)', border: '2px solid var(--border)', borderRadius: '12px',
  padding: '15px', cursor: 'pointer', color: 'var(--foreground)', transition: 'all 0.2s',
};
