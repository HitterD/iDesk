import React, { useState } from 'react';
import { Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useSetGmStep, type EFormRequest } from '../../api/eform-request.api';
import { EFormStatus } from './eform-vocabulary';
import { ManagerSelector } from './ManagerSelector';

/** Where ICT may still change the GM step; mirrors GM_EDITABLE_STATES on the server. */
const EDITABLE: readonly string[] = [EFormStatus.PENDING_MANAGER, EFormStatus.PENDING_GM, EFormStatus.PENDING_ICT];

const apiMessage = (error: unknown, fallback: string): string => {
  const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return typeof message === 'string' && message ? message : fallback;
};

/**
 * ICT decides per request whether the GM must approve and who. A GM picked here approves in iDesk; leaving the GM
 * open keeps the paper route (ICT uploads the signed form).
 */
export const GmStepSettings: React.FC<{ request: EFormRequest }> = ({ request }) => {
  const setGmStep = useSetGmStep();
  const [requiresGm, setRequiresGm] = useState(Boolean(request.requiresGm));
  const [gmApproverId, setGmApproverId] = useState(request.gmApproverId ?? '');

  // Synology has no approvals; a GM who already approved cannot be changed.
  const gmDone = Boolean(request.gmApprovedAt) && request.status !== EFormStatus.PENDING_GM;
  if (request.formType === 'SYNOLOGY_NAS' || !EDITABLE.includes(request.status) || gmDone) return null;

  const dirty = requiresGm !== Boolean(request.requiresGm) || (requiresGm && gmApproverId !== (request.gmApproverId ?? ''));

  const save = async () => {
    try {
      await setGmStep.mutateAsync({ id: request.id, requiresGm, gmApproverId: requiresGm && gmApproverId ? gmApproverId : null });
      toast.success(requiresGm ? 'Persetujuan GM diperbarui' : 'Pengajuan ini tidak memerlukan GM');
    } catch (err) {
      toast.error(apiMessage(err, 'Gagal menyimpan pengaturan GM'));
    }
  };

  return (
    <section aria-label="Pengaturan persetujuan GM" className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Settings2 size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-foreground">Persetujuan GM</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Default: hanya VPN yang perlu GM. Pilih GM agar beliau menyetujui di iDesk, atau kosongkan untuk mengunggah form bertanda tangan GM.
          </p>
        </div>
        <Switch checked={requiresGm} onCheckedChange={setRequiresGm} aria-label="Perlu persetujuan GM" />
      </div>

      {requiresGm && (
        <ManagerSelector
          idPrefix="ict-gm-selector"
          label="GM yang menyetujui"
          placeholder="Belum dipilih (unggah form bertanda tangan GM)"
          required={false}
          clearLabel="Tanpa GM di iDesk (unggah form bertanda tangan)"
          selectedId={gmApproverId}
          onSelect={setGmApproverId}
          currentUserId={request.requesterId}
        />
      )}

      {dirty && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" className="rounded-xl"
            onClick={() => { setRequiresGm(Boolean(request.requiresGm)); setGmApproverId(request.gmApproverId ?? ''); }}>
            Batal
          </Button>
          <Button size="sm" className="rounded-xl font-bold" onClick={() => void save()} loading={setGmStep.isPending}>
            Simpan
          </Button>
        </div>
      )}
    </section>
  );
};
