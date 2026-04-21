import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Eraser, Download, Check, PenLine } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  signerName: string;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, signerName }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = 200;
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initial styles
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#2D4A8C'; // Deep Sapphire

    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
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
      setHasSignature(false);
    }
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (canvas && hasSignature) {
      const dataUrl = canvas.toDataURL('image/png');
      onSave(dataUrl);
    }
  };

  return (
    <Card className="p-4 border-2 border-dashed border-primary/20 bg-card/50 overflow-hidden relative group">
      <div className="flex items-center justify-between mb-2">
        <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60 flex items-center gap-2">
          <PenLine size={12} className="text-primary" />
          Tanda Tangan Digital
        </label>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={clear} className="h-7 text-[10px] uppercase font-bold tracking-tighter opacity-60 hover:opacity-100">
            <Eraser size={12} className="mr-1" /> Bersihkan
          </Button>
        </div>
      </div>

      <div className="relative bg-white rounded-lg border border-border/50 h-[200px] cursor-crosshair touch-none">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          onMouseMove={draw}
          onTouchStart={startDrawing}
          onTouchEnd={stopDrawing}
          onTouchMove={draw}
          className="w-full h-full"
        />
        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20 italic text-sm">
            Tanda tangan di sini...
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-[10px] leading-tight opacity-60">
          <p className="font-bold text-foreground">Disetujui Oleh:</p>
          <p className="uppercase tracking-wider">{signerName}</p>
          <p>{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        
        <Button 
          onClick={handleSave} 
          disabled={!hasSignature}
          className="rounded-xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-colors duration-150 h-9 px-4 text-xs font-bold"
        >
          <Check size={14} className="mr-2" /> Simpan & Kunci
        </Button>
      </div>
    </Card>
  );
};
