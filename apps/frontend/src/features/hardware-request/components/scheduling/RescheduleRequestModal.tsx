import { useState } from 'react';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useScheduleSelection } from '../../hooks/useScheduleSelection';
import { toast } from 'sonner';

interface RescheduleRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  scheduleId: string;
  onDone?: () => void;
}

export function RescheduleRequestModal({
  open, onOpenChange, requestId, scheduleId, onDone,
}: RescheduleRequestModalProps) {
  const [reason, setReason] = useState('');
  const { reschedule, isRescheduling } = useScheduleSelection(requestId);

  const handleSubmit = async () => {
    if (reason.trim().length < 5) return toast.error('Alasan minimal 5 karakter');
    await reschedule({ scheduleId, input: { reason: reason.trim() } });
    setReason('');
    onOpenChange(false);
    onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Minta Reschedule</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Label>Alasan</Label>
          <Textarea
            value={reason} onChange={(e) => setReason(e.target.value)}
            rows={3} placeholder="Jelaskan alasan reschedule..."
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleSubmit} disabled={isRescheduling}>Kirim</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
