import { useState } from 'react';

type Props = {
  onSubmit: (code: string) => void;
  disabled?: boolean;
};

export function BarcodeInputFallback({ onSubmit, disabled }: Props) {
  const [value, setValue] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = value.trim();
        if (trimmed.length >= 3) onSubmit(trimmed);
      }}
      className="flex gap-2"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Masukkan barcode manual"
        className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        disabled={disabled}
        aria-label="Barcode input"
      />
      <button
        type="submit"
        className="px-3 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
        disabled={disabled || value.trim().length < 3}
      >
        Simpan
      </button>
    </form>
  );
}
