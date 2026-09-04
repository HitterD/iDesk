import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useScheduleSelection } from '../../hooks/useScheduleSelection';
import { toast } from 'sonner';
import { RotateCcw, Send, AlertCircle } from 'lucide-react';

interface RescheduleRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  scheduleId: string;
  onDone?: () => void;
}

export function RescheduleRequestModal({
  open,
  onOpenChange,
  requestId,
  scheduleId,
  onDone,
}: RescheduleRequestModalProps) {
  const [reason, setReason] = useState('');
  const { reschedule, isRescheduling } = useScheduleSelection(requestId);

  const handleSubmit = async () => {
    if (reason.trim().length < 5) return toast.error('Mohon jelaskan alasan minimal 5 karakter');
    await reschedule({ scheduleId, input: { reason: reason.trim() } });
    setReason('');
    onOpenChange(false);
    onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-background border-border shadow-2xl rounded-3xl">
        <DialogHeader className="px-6 pt-6 pb-4 bg-card border-b border-border/80">
          <DialogTitle className="flex items-center gap-2.5 text-lg font-extrabold text-foreground">
            <div className="size-8 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <RotateCcw className="size-4.5" />
            </div>
            <span>Ajukan Jadwal Ulang</span>
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Beri tahu tim teknisi ICT alasan atau perkiraan waktu ketersediaan Anda agar dapat disiapkan slot jadwal alternatif baru.
          </p>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="reschedule-reason" className="text-xs font-bold text-foreground">
                Alasan / Preferensi Waktu Anda
              </Label>
              <span className="text-[11px] text-muted-foreground font-medium">
                Min. 5 karakter
              </span>
            </div>
            <Textarea
              id="reschedule-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder="Contoh: Tanggal tersebut ada meeting luar kantor. Mohon dijadwalkan ulang pada hari Selasa / Rabu jam 10.00 WIB."
              className="rounded-xl resize-none text-xs sm:text-sm bg-card border-border focus-visible:ring-primary leading-relaxed"
            />
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/40 border border-border text-[11px] text-muted-foreground leading-relaxed">
            <AlertCircle className="size-4 text-primary shrink-0 mt-0.5" />
            <span>
              Permintaan ini akan langsung diteruskan ke Agent/Teknisi yang ditugaskan untuk mengusulkan opsi jadwal baru.
            </span>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 bg-muted/20 border-t border-border/80 flex items-center justify-end gap-2">
          <Button
            variant="outline"
            className="rounded-xl text-xs font-bold"
            onClick={() => onOpenChange(false)}
            disabled={isRescheduling}
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isRescheduling || reason.trim().length < 5}
            className="gap-2 rounded-xl text-xs font-bold shadow-xs active:scale-[0.98]"
          >
            <Send className="size-3.5" />
            <span>{isRescheduling ? 'Mengirim...' : 'Kirim Permintaan'}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
