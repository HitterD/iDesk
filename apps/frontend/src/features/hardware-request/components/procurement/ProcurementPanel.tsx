import { useState } from 'react';
import { ItemDecisionList } from './ItemDecisionList';
import { useProcurementDecision } from '../../hooks/useProcurementDecision';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { SectionCard } from '../common/SectionCard';
import { RejectDialog } from '../detail/RejectDialog';
import { toast } from 'sonner';
import type { HardwareRequest, ItemProcurementDecision } from '../../types';

interface ProcurementPanelProps { request: HardwareRequest }

export function ProcurementPanel({ request }: ProcurementPanelProps) {
  const { decide, complete, isDeciding, isCompleting } = useProcurementDecision(request.id);
  const [decisions, setDecisions] = useState<Record<string, ItemProcurementDecision | null>>(
    Object.fromEntries(request.items.map((i) => [i.id, i.procurementDecision ?? null])),
  );
  const [note, setNote] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);

  const allDecided = request.items.every((i) => decisions[i.id] != null);
  const allRejected = request.items.every((i) => decisions[i.id] === 'REJECTED');

  const handleSaveDraft = async () => {
    const items = request.items
      .filter((i) => decisions[i.id] != null)
      .map((i) => ({ itemId: i.id, decision: decisions[i.id]! }));
    if (items.length === 0) {
      toast.info('Belum ada keputusan untuk disimpan');
      return;
    }
    await decide({ decisions: items, note: note || undefined });
  };

  const handleComplete = async () => {
    if (!allDecided) {
      const undecidedCount = request.items.filter((i) => decisions[i.id] == null).length;
      toast.error(`${undecidedCount} item belum diputuskan`);
      return;
    }
    await handleSaveDraft();
    if (allRejected) {
      setRejectOpen(true);
      return;
    }
    await complete({});
  };

  const handleRejectConfirm = async (reason: string) => {
    await complete({ rejectReason: reason });
    setRejectOpen(false);
  };

  return (
    <SectionCard title="Keputusan SPP / Procurement">
      <ItemDecisionList
        items={request.items}
        decisions={decisions}
        onChange={(id, d) => setDecisions((prev) => ({ ...prev, [id]: d }))}
        disabled={isDeciding || isCompleting}
      />
      <div className="mt-6 space-y-3">
        <Textarea
          placeholder="Catatan procurement (opsional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleSaveDraft} disabled={isDeciding}>
            Simpan Draft
          </Button>
          <Button onClick={handleComplete} disabled={!allDecided || isCompleting}>
            Selesaikan Procurement
          </Button>
        </div>
      </div>

      <RejectDialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onConfirm={handleRejectConfirm}
      />
    </SectionCard>
  );
}
