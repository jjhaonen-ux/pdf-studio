'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Eraser, Undo2, X } from 'lucide-react';

interface Stroke {
  color: string;
  width: number;
  points: { x: number; y: number }[];
}

interface SignatureModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (payload: { dataUrl: string; aspectRatio: number }) => void;
}

const PEN_COLORS = [
  { hex: '#0f172a', label: 'أسود' },
  { hex: '#1d4ed8', label: 'أزرق حبر' },
  { hex: '#dc2626', label: 'أحمر' },
];

export function SignatureModal({ open, onClose, onSave }: SignatureModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [penColor, setPenColor] = useState('#0f172a');
  const [penWidth, setPenWidth] = useState(3);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const isDrawingRef = useRef(false);

  const redraw = (allStrokes: Stroke[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const stroke of allStrokes) {
      if (stroke.points.length === 0) continue;
      ctx.strokeStyle = stroke.color;
      ctx.fillStyle = stroke.color;
      ctx.lineWidth = stroke.width * 2; // مقياس دقة 2x
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (stroke.points.length === 1) {
        ctx.beginPath();
        ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.width, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length - 1; i++) {
        const midX = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
        const midY = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
        ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, midX, midY);
      }
      const last = stroke.points[stroke.points.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    }
  };

  useEffect(() => {
    if (open) {
      redraw(strokes);
    }
  }, [open, strokes]);

  if (!open) return null;

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    const pt = getCanvasPoint(e);
    currentStrokeRef.current = {
      color: penColor,
      width: penWidth,
      points: [pt],
    };
    redraw([...strokes, currentStrokeRef.current]);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    const pt = getCanvasPoint(e);
    currentStrokeRef.current.points.push(pt);
    redraw([...strokes, currentStrokeRef.current]);
  };

  const handlePointerUp = () => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    isDrawingRef.current = false;
    const finished = currentStrokeRef.current;
    currentStrokeRef.current = null;
    setStrokes((prev) => [...prev, finished]);
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas || strokes.length === 0) return;

    // قص الهوامش الشفافة الزائدة حول التوقيع للحصول على إطار محكم ونظيف
    let minX = canvas.width;
    let minY = canvas.height;
    let maxX = 0;
    let maxY = 0;

    for (const s of strokes) {
      const pad = s.width * 2 + 8;
      for (const p of s.points) {
        minX = Math.min(minX, p.x - pad);
        minY = Math.min(minY, p.y - pad);
        maxX = Math.max(maxX, p.x + pad);
        maxY = Math.max(maxY, p.y + pad);
      }
    }

    minX = Math.max(0, Math.floor(minX));
    minY = Math.max(0, Math.floor(minY));
    maxX = Math.min(canvas.width, Math.ceil(maxX));
    maxY = Math.min(canvas.height, Math.ceil(maxY));

    const cropW = Math.max(20, maxX - minX);
    const cropH = Math.max(20, maxY - minY);

    const outCanvas = document.createElement('canvas');
    outCanvas.width = cropW;
    outCanvas.height = cropH;
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) return;

    outCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
    const dataUrl = outCanvas.toDataURL('image/png');
    outCanvas.width = 0;
    outCanvas.height = 0;

    onSave({
      dataUrl,
      aspectRatio: cropW / cropH,
    });
    setStrokes([]);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="رسم التوقيع"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">إضافة توقيع</h3>
            <p className="text-xs text-slate-500">
              ارسم توقيعك بالماوس أو اللمس داخل المساحة أدناه
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* أدوات القلم */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600">اللون:</span>
            {PEN_COLORS.map((c) => (
              <button
                key={c.hex}
                type="button"
                onClick={() => setPenColor(c.hex)}
                title={c.label}
                className={`h-6 w-6 rounded-full border-2 transition ${
                  penColor === c.hex ? 'scale-110 border-blue-500' : 'border-slate-200'
                }`}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600">السماكة:</span>
            <input
              type="range"
              min={1.5}
              max={6}
              step={0.5}
              value={penWidth}
              onChange={(e) => setPenWidth(Number(e.target.value))}
              className="w-24 accent-blue-600"
            />
          </div>
        </div>

        {/* لوحة الرسم */}
        <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50">
          <canvas
            ref={canvasRef}
            width={920}
            height={400}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="h-52 w-full cursor-crosshair touch-none"
          />
          {strokes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="text-sm text-slate-400">وقّع هنا...</span>
            </div>
          )}
        </div>

        {/* أزرار التحكم */}
        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStrokes((prev) => prev.slice(0, -1))}
              disabled={strokes.length === 0}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-40"
            >
              <Undo2 className="h-3.5 w-3.5" />
              <span>تراجع</span>
            </button>
            <button
              type="button"
              onClick={() => setStrokes([])}
              disabled={strokes.length === 0}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
            >
              <Eraser className="h-3.5 w-3.5" />
              <span>مسح</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={strokes.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Check className="h-4 w-4" />
              <span>إدراج التوقيع</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
