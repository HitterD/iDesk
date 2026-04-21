import { useMemo, useState } from 'react';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { completeInstallation } from '../../api/installation.api';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
type Item = {
  id: string;
  catalogName: string;
  quantity: number;
  assetCode?: string | null;
};

type Props = {
  open: boolean;
  requestId: string;
  items: Item[];
  onClose: () => void;
};

export function CompleteInstallWizard({ open, requestId, items, onClose }: Props) {
  const qc = useQueryClient();
  const [assigned, setAssigned] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((i) => [i.id, i.assetCode ?? ''])),
  );
  const [scanFor, setScanFor] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const allScanned = useMemo(
    () => items.every((i) => (assigned[i.id] ?? '').trim().length >= 3),
    [items, assigned],
  );

  if (!open) return null;

  const submit = async () => {
    setSubmitting(true);
    try {
      await completeInstallation(requestId, {
        items: items.map((i) => ({ itemId: i.id, assetCode: assigned[i.id].trim() })),
      });
      await qc.invalidateQueries({ queryKey: ['hardware-requests', 'detail', requestId] });
      await qc.invalidateQueries({ queryKey: ['hardware-requests', 'list'] });
      toast.success('Installation completed.');
      onClose();
    } catch (err) {
      toast.error('Gagal menyelesaikan install: ' + (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4">
      <div role="dialog" aria-labelledby="complete-title" className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl">
        <h2 id="complete-title" className="text-lg font-semibold text-slate-900">
          Complete Installation
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Scan barcode untuk setiap item. Kode tersimpan sebagai asset code.
        </p>
        <ul className="mt-4 divide-y rounded-md border">
          {items.map((i) => {
            const code = assigned[i.id] ?? '';
            return (
              <li key={i.id} className="flex items-center gap-3 p-3">
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-900">{i.catalogName}</div>
                  <div className="text-xs text-slate-500">Qty {i.quantity}</div>
                </div>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setAssigned({ ...assigned, [i.id]: e.target.value })}
                  placeholder="Asset code"
                  className="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setScanFor(i.id)}
                  className="text-xs px-2 py-1 rounded-md border border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                >
                  Scan
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} disabled={submitting} className="px-3 py-2 text-sm rounded-md border">
            Batal
          </button>
          <button
            onClick={submit}
            disabled={!allScanned || submitting}
            className="px-3 py-2 text-sm rounded-md bg-emerald-600 text-white disabled:opacity-50"
          >
            {submitting ? 'Menyelesaikan…' : 'Selesaikan Installation'}
          </button>
        </div>
      </div>

      <BarcodeScannerModal
        open={scanFor !== null}
        onClose={() => setScanFor(null)}
        onCapture={(code) => {
          if (scanFor) setAssigned((a) => ({ ...a, [scanFor]: code }));
        }}
      />
    </div>
  );
}
