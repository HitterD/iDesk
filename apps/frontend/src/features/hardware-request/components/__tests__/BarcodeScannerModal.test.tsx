import { test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BarcodeScannerModal } from '../barcode/BarcodeScannerModal';
import { vi } from 'vitest';

vi.mock('../../hooks/useBarcodeScanner', () => ({
  useBarcodeScanner: (onCode: (c: string) => void) => ({
    videoRef: { current: null },
    state: { isScanning: false, error: null, lastCode: null },
    start: vi.fn(),
    stop: vi.fn(),
  }),
}));

test('fallback input submits code and calls onCapture', () => {
  const onCapture = vi.fn();
  render(
    <BarcodeScannerModal open={true} onClose={() => {}} onCapture={onCapture} />,
  );
  fireEvent.click(screen.getByRole('button', { name: /input manual/i }));
  fireEvent.change(screen.getByLabelText(/barcode input/i), { target: { value: 'ASSET-123' } });
  fireEvent.click(screen.getByRole('button', { name: /simpan/i }));
  expect(onCapture).toHaveBeenCalledWith('ASSET-123');
});
