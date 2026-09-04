import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarClock, Check, Clock, Sparkles, User, Calendar } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useScheduleSelection } from '../../hooks/useScheduleSelection';
import { RescheduleRequestModal } from './RescheduleRequestModal';
import { cn } from '@/lib/utils';
import type { InstallationSchedule } from '../../types';

interface SlotPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  schedule: InstallationSchedule;
}

export function SlotPickerModal({
  open,
  onOpenChange,
  requestId,
  schedule,
}: SlotPickerModalProps) {
  const [picked, setPicked] = useState<number | null>(0);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const { select, isSelecting } = useScheduleSelection(requestId);

  const handleConfirm = async () => {
    if (picked == null) return;
    await select({ scheduleId: schedule.id, input: { slotIndex: picked } });
    onOpenChange(false);
  };

  const slots = schedule.proposedSlots ?? [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-background border-border shadow-2xl rounded-3xl">
          <DialogHeader className="px-6 pt-6 pb-4 bg-card border-b border-border/80">
            <DialogTitle className="flex items-center gap-2.5 text-lg font-extrabold text-foreground">
              <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <CalendarClock className="size-4.5" />
              </div>
              <span>Konfirmasi Jadwal Pemasangan</span>
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Pilih satu waktu yang paling sesuai dengan jadwal Anda. Tiket instalasi otomatis dibuat untuk Agent pelaksana.
            </p>
          </DialogHeader>

          <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto custom-scrollbar">
            {/* Agent Info Banner */}
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-muted/40 border border-border/80">
              <UserAvatar user={schedule.technician} size="sm" />
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Agent / Teknisi Pelaksana
                </span>
                <p className="text-xs sm:text-sm font-bold text-foreground truncate">
                  {schedule.technician?.fullName || 'Agent ICT Support'}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {schedule.technician?.email || 'Siap membantu instalasi di lokasi Anda'}
                </p>
              </div>
            </div>

            {/* Slots Options */}
            <div className="space-y-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Calendar className="size-3.5 text-primary" />
                <span>Pilih Salah Satu Slot Waktu:</span>
              </span>

              <div className="space-y-2.5">
                {slots.map((slot, idx) => {
                  const s = new Date(slot.start);
                  const e = new Date(slot.end);
                  const active = picked === idx;

                  return (
                    <motion.div
                      key={idx}
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => setPicked(idx)}
                      role="radio"
                      aria-checked={active}
                      className={cn(
                        'relative overflow-hidden flex items-center justify-between rounded-2xl border p-4 cursor-pointer transition-all duration-200 shadow-2xs',
                        active
                          ? 'border-primary bg-primary/10 ring-2 ring-primary/30 text-foreground'
                          : 'border-border bg-card hover:border-border/80 hover:bg-muted/30 text-muted-foreground'
                      )}
                    >
                      <div className="relative z-10 flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md',
                            active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                          )}>
                            Opsi #{idx + 1}
                          </span>
                          <p className={cn('font-bold text-xs sm:text-sm', active ? 'text-foreground' : 'text-foreground')}>
                            {s.toLocaleDateString('id-ID', {
                              weekday: 'long',
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground pl-1">
                          <Clock className="size-3.5 text-primary" />
                          <span>
                            pk {s.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} – {e.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                          </span>
                        </div>
                      </div>

                      {active ? (
                        <motion.div
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="size-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-xs"
                        >
                          <Check className="size-4" strokeWidth={3} />
                        </motion.div>
                      ) : (
                        <div className="size-6 rounded-full border border-border shrink-0" />
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 bg-muted/20 border-t border-border/80 flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <button
              type="button"
              className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              onClick={() => setRescheduleOpen(true)}
            >
              Waktu tidak cocok? Minta Reschedule
            </button>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                className="flex-1 sm:flex-none rounded-xl text-xs font-bold"
                onClick={() => onOpenChange(false)}
              >
                Tutup
              </Button>
              <Button
                className="flex-1 sm:flex-none gap-2 rounded-xl text-xs font-bold shadow-xs active:scale-[0.98]"
                onClick={handleConfirm}
                disabled={picked == null || isSelecting}
              >
                <Check className="size-4" />
                <span>{isSelecting ? 'Memproses...' : 'Konfirmasi Jadwal'}</span>
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RescheduleRequestModal
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        requestId={requestId}
        scheduleId={schedule.id}
        onDone={() => onOpenChange(false)}
      />
    </>
  );
}
