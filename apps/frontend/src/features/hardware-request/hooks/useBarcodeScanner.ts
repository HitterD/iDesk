import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

type ScannerState = {
  isScanning: boolean;
  error: string | null;
  lastCode: string | null;
};

export function useBarcodeScanner(onCode: (code: string) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [state, setState] = useState<ScannerState>({
    isScanning: false,
    error: null,
    lastCode: null,
  });

  const start = async () => {
    if (!videoRef.current) return;
    setState((s) => ({ ...s, error: null }));
    try {
      readerRef.current = new BrowserMultiFormatReader();
      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      if (devices.length === 0) {
        throw new Error('Tidak ada kamera yang tersedia.');
      }
      const deviceId =
        devices.find((d) => /back|rear|environment/i.test(d.label))?.deviceId ?? devices[0].deviceId;

      setState((s) => ({ ...s, isScanning: true }));
      await readerRef.current.decodeFromVideoDevice(deviceId, videoRef.current, (result, err) => {
        if (result) {
          const text = result.getText();
          setState((s) => ({ ...s, lastCode: text }));
          onCode(text);
        }
        if (err && err.name !== 'NotFoundException') {
          setState((s) => ({ ...s, error: err.message }));
        }
      });
    } catch (err) {
      setState((s) => ({ ...s, error: (err as Error).message, isScanning: false }));
    }
  };

  const stop = () => {
    (readerRef.current as any)?.reset();
    readerRef.current = null;
    setState((s) => ({ ...s, isScanning: false }));
  };

  useEffect(() => () => stop(), []);

  return { videoRef, state, start, stop };
}
