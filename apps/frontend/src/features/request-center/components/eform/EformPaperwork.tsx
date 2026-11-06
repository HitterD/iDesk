import React, { useRef, useState } from 'react';
import { Ban, Check, Download, FileCheck2, Loader2, PenLine, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDateTimeID } from '@/lib/utils/dateFormat';
import {
  downloadEformPdf, downloadGmApproval, useUpdateDocumentNumber, useUploadGmApproval, type EFormRequest,
} from '../../api/eform-request.api';
import { EFormStatus } from './eform-vocabulary';

/** Same limit the server enforces for the signed copy (FILE_SIZE_LIMITS.DOCUMENT). */
const MAX_PDF_BYTES = 10 * 1024 * 1024;
/** Mirrors DOCUMENT_NUMBER_PATTERN / MAX on the server so the agent hears about a typo before saving. */
const NUMBER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9/._-]*$/;
const NUMBER_MAX = 50;

const apiMessage = (error: unknown, fallback: string): string => {
  const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return typeof message === 'string' && message ? message : fallback;
};

export const numberError = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return 'Nomor dokumen wajib diisi';
  if (trimmed.length > NUMBER_MAX) return `Maksimal ${NUMBER_MAX} karakter`;
  if (!NUMBER_PATTERN.test(trimmed)) return 'Hanya huruf, angka, dan / . _ -';
  return null;
};

/** The running document number; ICT can correct it in place. */
export const DocumentNumberField: React.FC<{ request: EFormRequest; canEdit: boolean }> = ({ request, canEdit }) => {
  const update = useUpdateDocumentNumber();
  const [draft, setDraft] = useState<string | null>(null);
  const editing = draft !== null;
  const error = editing ? numberError(draft) : null;

  const save = async () => {
    if (draft === null || error) return;
    try {
      await update.mutateAsync({ id: request.id, documentNumber: draft.trim() });
      toast.success('Nomor dokumen diperbarui');
      setDraft(null);
    } catch (err) {
      toast.error(apiMessage(err, 'Gagal menyimpan nomor dokumen'));
    }
  };

  if (editing) {
    return (
      <dd className="mt-1">
      <form className="space-y-1" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <div className="flex items-center gap-1.5">
          <Input value={draft} onChange={(event) => setDraft(event.target.value)} autoFocus aria-label="Nomor dokumen"
            aria-invalid={Boolean(error)} maxLength={NUMBER_MAX + 10} className="h-9 font-mono text-sm"
            onKeyDown={(event) => { if (event.key === 'Escape') setDraft(null); }} />
          <Button type="submit" size="icon" variant="primary" className="h-9 w-9 shrink-0" disabled={Boolean(error)}
            loading={update.isPending} aria-label="Simpan nomor dokumen"><Check aria-hidden="true" /></Button>
          <Button type="button" size="icon" variant="subtle" className="h-9 w-9 shrink-0" onClick={() => setDraft(null)}
            disabled={update.isPending} aria-label="Batal ubah nomor"><X aria-hidden="true" /></Button>
        </div>
        {error && <p className="text-xs font-medium text-destructive" role="alert">{error}</p>}
      </form>
      </dd>
    );
  }

  return (
    <dd className="mt-1 flex items-center gap-2">
      <span className="font-mono text-sm font-bold text-foreground">{request.documentNumber || '—'}</span>
      {canEdit && (
        <button type="button" onClick={() => setDraft(request.documentNumber ?? '')}
          className="inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-xs font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label="Ubah nomor dokumen">
          <PenLine className="h-3 w-3" aria-hidden="true" />Ubah
        </button>
      )}
    </dd>
  );
};

/**
 * The GM's signature. A GM chosen in iDesk approves there; otherwise (or as a fallback) ICT prints the form, has the
 * GM sign it and uploads the scan. Afterwards everyone who can open the request can download the signed copy.
 */
export const GmApprovalPanel: React.FC<{ request: EFormRequest; isICT: boolean; isRequester?: boolean; onReject: () => void }> = ({ request, isICT, isRequester = false, onReject }) => {
  const upload = useUploadGmApproval();
  const input = useRef<HTMLInputElement>(null);
  const waiting = request.status === EFormStatus.PENDING_GM;
  // The requester may carry the paper to the GM themselves, but only when no GM approves in iDesk.
  const canUpload = isICT || (isRequester && !request.gmApproverId && !request.gmApproverName);
  const canReplace = canUpload && request.status === EFormStatus.PENDING_ICT;
  if (!waiting && !request.gmApprovalFileName && !request.gmApprovedAt) return null;
  // Approved in iDesk with no paper copy: the signature shows with the others, nothing to download here.
  if (!waiting && !request.gmApprovalFileName) {
    return (
      <section aria-label="Persetujuan GM" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
          <FileCheck2 size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground">Disetujui GM{request.gmApproverName ? `: ${request.gmApproverName}` : ''}</p>
          {request.gmApprovedAt && <p className="text-xs text-muted-foreground">{formatDateTimeID(request.gmApprovedAt)}</p>}
        </div>
      </section>
    );
  }

  const pick = async (file: File | undefined) => {
    if (input.current) input.current.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Unggah berkas PDF hasil pindai form yang sudah ditandatangani GM');
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      toast.error('Ukuran PDF maksimal 10 MB');
      return;
    }
    try {
      await upload.mutateAsync({ id: request.id, file });
      toast.success(waiting ? 'TTD GM tersimpan. Pengajuan siap diproses ICT.' : 'Berkas TTD GM diganti');
    } catch (err) {
      toast.error(apiMessage(err, 'Gagal mengunggah berkas TTD GM'));
    }
  };

  const fileInput = (
    <input ref={input} type="file" accept="application/pdf,.pdf" className="sr-only" tabIndex={-1} aria-hidden="true"
      onChange={(event) => void pick(event.target.files?.[0])} />
  );

  if (waiting) {
    return (
      <section aria-label="Tanda tangan GM" className="rounded-2xl border border-amber-300/60 bg-amber-50/70 p-4 sm:p-5 dark:border-amber-700/50 dark:bg-amber-950/30">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
            <PenLine size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-foreground">
              {request.gmApproverName ? `Menunggu persetujuan GM: ${request.gmApproverName}` : 'Menunggu tanda tangan GM'}
            </h3>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {request.gmApproverName
                ? isICT
                  ? 'GM menyetujui langsung di iDesk. Bila GM menandatangani di kertas, unggah hasil pindainya (PDF) sebagai gantinya.'
                  : 'Atasan sudah menyetujui. Permintaan menunggu persetujuan GM di iDesk.'
                : 'Atasan sudah menyetujui. Cetak form, mintakan tanda tangan GM, lalu unggah hasil pindainya (PDF) agar akses bisa diproses.'}
            </p>
          </div>
        </div>
        {canUpload && (
          <div className={`mt-4 grid grid-cols-1 gap-2 ${isICT ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
            <Button variant="outline" className="rounded-xl font-semibold" onClick={() => void downloadEformPdf(request.id, `${request.documentNumber ?? 'EForm'}.pdf`.replace(/\//g, '-'))}>
              <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />Unduh form untuk GM
            </Button>
            <Button className="rounded-xl font-bold" onClick={() => input.current?.click()} loading={upload.isPending}>
              <Upload className="mr-1.5 h-4 w-4" aria-hidden="true" />Unggah PDF TTD GM
            </Button>
            {isICT && (
              <Button variant="outline" onClick={onReject}
                className="rounded-xl border-destructive/40 font-semibold text-destructive hover:bg-destructive/5">
                <Ban className="mr-1.5 h-4 w-4" aria-hidden="true" />GM tidak menyetujui
              </Button>
            )}
            {fileInput}
          </div>
        )}
      </section>
    );
  }

  return (
    <section aria-label="Berkas tanda tangan GM" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
        <FileCheck2 size={18} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-foreground">Ditandatangani GM</p>
        <p className="truncate text-xs text-muted-foreground" title={request.gmApprovalFileName ?? undefined}>
          {request.gmApprovalFileName}{request.gmApprovedAt ? ` · ${formatDateTimeID(request.gmApprovedAt)}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        {canReplace && (
          <Button variant="subtle" size="sm" className="rounded-xl" onClick={() => input.current?.click()} disabled={upload.isPending}>
            {upload.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Upload className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />}
            Ganti
          </Button>
        )}
        <Button variant="outline" size="sm" className="rounded-xl font-semibold"
          onClick={() => void downloadGmApproval(request.id, request.gmApprovalFileName).catch(() => toast.error('Gagal mengunduh berkas TTD GM'))}>
          <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />Unduh
        </Button>
        {canReplace && fileInput}
      </div>
    </section>
  );
};
