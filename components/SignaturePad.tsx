import { useRef } from 'react';
import { Platform } from 'react-native';

// Web canvas signature pad. Reports the drawn signature as a PNG data URL.

export function SignaturePad({
  onChange,
}: {
  onChange: (dataUrl: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  if (Platform.OS !== 'web') return null;

  const ctx = () => canvasRef.current?.getContext('2d') ?? null;

  const pos = (e: any) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * c.width,
      y: ((e.clientY - r.top) / r.height) * c.height,
    };
  };

  const start = (e: any) => {
    drawing.current = true;
    const g = ctx();
    if (!g) return;
    const p = pos(e);
    g.beginPath();
    g.moveTo(p.x, p.y);
  };
  const move = (e: any) => {
    if (!drawing.current) return;
    const g = ctx();
    if (!g) return;
    const p = pos(e);
    g.lineTo(p.x, p.y);
    g.strokeStyle = '#0F172A';
    g.lineWidth = 2.5;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.stroke();
    dirty.current = true;
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (dirty.current && canvasRef.current) {
      onChange(canvasRef.current.toDataURL('image/png'));
    }
  };
  const clear = () => {
    const c = canvasRef.current;
    const g = ctx();
    if (c && g) g.clearRect(0, 0, c.width, c.height);
    dirty.current = false;
    onChange(null);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={520}
        height={150}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        style={{
          width: '100%',
          maxWidth: 520,
          height: 150,
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          background: '#fff',
          touchAction: 'none',
          cursor: 'crosshair',
          display: 'block',
        }}
      />
      <button
        type="button"
        onClick={clear}
        style={{
          marginTop: 6,
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          background: '#fff',
          color: '#475569',
          fontSize: 12,
          fontWeight: 700,
          padding: '5px 12px',
          cursor: 'pointer',
        }}
      >
        Clear signature
      </button>
    </div>
  );
}
