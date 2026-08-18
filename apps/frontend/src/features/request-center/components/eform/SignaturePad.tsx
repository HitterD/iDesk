import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Eraser, Check, PenLine } from 'lucide-react';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  signerName: string;
}

const CANVAS_HEIGHT = 200;

/**
 * Ink colour is fixed rather than theme-derived: the canvas is exported as a PNG
 * and archived with the request, so the stroke must stay legible on the white
 * signature sheet in the PDF regardless of the theme it was drawn in.
 */
const INK_COLOR = '#1e293b';

const applyCtxStyles = (ctx: CanvasRenderingContext2D) => {
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK_COLOR;
};

const formatToday = () =>
  new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

export const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, signerName }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = CANVAS_HEIGHT;
        // Re-apply after resize — resizing clears canvas context state
        applyCtxStyles(ctx);
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (isLocked) return;
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) ctx.beginPath();
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
    setHasSignature(true);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      applyCtxStyles(ctx);
      setHasSignature(false);
      setIsLocked(false); // Allow re-signing after clear
    }
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (canvas && hasSignature) {
      const dataUrl = canvas.toDataURL('image/png');
      onSave(dataUrl);
      setIsLocked(true);
    }
  };

  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <PenLine size={14} className="text-primary" aria-hidden="true" />
          Tanda tangan digital
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={clear}
          disabled={!hasSignature}
          className="h-8 rounded-lg text-xs font-semibold"
        >
          <Eraser size={13} className="mr-1.5" aria-hidden="true" /> Bersihkan
        </Button>
      </div>

      <div
        className={`relative h-[200px] cursor-crosshair touch-none rounded-xl border border-border bg-white ${
          isLocked ? 'pointer-events-none opacity-60' : ''
        }`}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          onMouseMove={draw}
          onTouchStart={startDrawing}
          onTouchEnd={stopDrawing}
          onTouchMove={draw}
          className="h-full w-full"
        />
        {!hasSignature && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">
            Tanda tangan di sini
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <dl className="text-sm leading-tight">
          <dt className="text-xs font-semibold text-muted-foreground">Ditandatangani oleh</dt>
          <dd className="mt-0.5 font-bold text-foreground">{signerName || '—'}</dd>
          <dd className="mt-0.5 text-xs text-muted-foreground">{formatToday()}</dd>
        </dl>

        {!isLocked ? (
          <Button
            onClick={handleSave}
            disabled={!hasSignature}
            className="h-10 rounded-xl px-4 text-sm font-bold"
          >
            <Check size={15} className="mr-2" aria-hidden="true" /> Simpan &amp; kunci
          </Button>
        ) : (
          <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            <Check size={15} aria-hidden="true" /> Terkunci
          </p>
        )}
      </div>
    </div>
  );
};
