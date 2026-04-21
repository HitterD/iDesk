import { useState } from 'react';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { BarcodeInputFallback } from './BarcodeInputFallback';

type Props = {
  open: boolean;
  onClose: () => void;
  onCapture: (code: string) => void;
};

export function BarcodeScannerModal({ open, onClose, onCapture }: Props) {
  const [manual, setManual] = useState(false);
  const { videoRef, state, start, stop } = useBarcodeScanner((code) => {
    onCapture(code);
    stop();
    onClose();
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div role="dialog" aria-labelledby="scan-title" className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 id="scan-title" className="text-lg font-semibold text-slate-900">
            Scan Barcode Asset
          </h2>
          <button onClick={() => { stop(); onClose(); }} aria-label="Close" className="text-slate-400 hover:text-slate-600">
            ×
          </button>
        </div>

        {!manual ? (
          <>
            <div className="mt-3 aspect-video overflow-hidden rounded-md bg-slate-900">
              <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
            </div>
            {state.error && (
              <p role="alert" className="mt-2 text-xs text-rose-600">{state.error}</p>
            )}
            <div className="mt-3 flex justify-between">
              {!state.isScanning ? (
                <button onClick={start} className="px-3 py-2 text-sm rounded-md bg-indigo-600 text-white">
                  Mulai Scan
                </button>
              ) : (
                <button onClick={stop} className="px-3 py-2 text-sm rounded-md border border-slate-300">
                  Stop
                </button>
              )}
              <button
                onClick={() => { stop(); setManual(true); }}
                className="px-3 py-2 text-sm rounded-md text-indigo-600 hover:underline"
              >
                Input manual
              </button>
            </div>
          </>
        ) : (
          <div className="mt-4 space-y-2">
            <BarcodeInputFallback
              onSubmit={(code) => {
                onCapture(code);
                onClose();
              }}
            />
            <button
              onClick={() => setManual(false)}
              className="text-xs text-indigo-600 hover:underline"
            >
              ← Kembali ke kamera
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
