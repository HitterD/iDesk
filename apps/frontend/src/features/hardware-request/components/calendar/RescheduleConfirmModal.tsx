import { useState } from 'react';
import { format, parseISO } from 'date-fns';

type Props = {
  open: boolean; from: string; to: string; requestNumber: string;
  onConfirm: (reason: string) => void; onCancel: () => void; isSubmitting?: boolean;
};

export function RescheduleConfirmModal({ open, from, to, requestNumber, onConfirm, onCancel, isSubmitting }: Props) {
  const [reason, setReason] = useState('');
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div role="dialog" aria-labelledby="resched-title" className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-lg">📅</div>
          <div>
            <h2 id="resched-title" className="text-sm font-bold text-slate-900">Konfirmasi Reschedule</h2>
            <p className="text-xs text-slate-500 font-mono">{requestNumber}</p>
          </div>
        </div>
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 mb-4 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Dari:</span>
            <span className="font-semibold line-through text-slate-400">{format(parseISO(from), 'dd MMM yyyy · HH:mm')}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Ke:</span>
            <span className="font-semibold text-green-600">{format(parseISO(to), 'dd MMM yyyy · HH:mm')}</span>
          </div>
        </div>
        <label className="block mb-4">
          <span className="text-xs font-semibold text-slate-700">Alasan reschedule <span className="text-red-500">*</span></span>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            placeholder="Mis. teknisi tidak tersedia pada tanggal tersebut"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="button" onClick={onCancel} disabled={isSubmitting}
            className="flex-1 rounded-lg border border-slate-200 bg-slate-50 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button" onClick={() => onConfirm(reason.trim())}
            disabled={isSubmitting || reason.trim().length < 5}
            className="flex-1 rounded-lg bg-blue-500 py-2 text-xs font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {isSubmitting ? 'Memproses…' : '✓ Konfirmasi Reschedule'}
          </button>
        </div>
      </div>
    </div>
  );
}