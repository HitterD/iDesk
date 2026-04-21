import { useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarClock, Check, Clock } from 'lucide-react';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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

export function SlotPickerModal({ open, onOpenChange, requestId, schedule }: SlotPickerModalProps) {
  const [picked, setPicked] = useState<number | null>(null);
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
        <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <DialogHeader className="px-6 pt-6 pb-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800">
            <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-slate-800 dark:text-slate-100">
              <CalendarClock className="w-5 h-5 text-primary" />
              Pilih Waktu Instalasi
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 py-5 space-y-4">
            <div className="bg-primary/5 dark:bg-primary/10 border border-primary/10 rounded-lg p-3 text-sm text-slate-700 dark:text-slate-300">
              <span className="font-semibold block mb-1 text-primary">Informasi Teknisi:</span>
              <span>{schedule.technician?.fullName ?? schedule.technicianId} siap membantu instalasi Anda. Silakan pilih salah satu jadwal di bawah ini.</span>
            </div>

            <ul className="space-y-3 mt-4">
              {slots.map((slot, idx) => (
                <motion.li
                  key={idx}
                  layout
                  whileHover={{ scale: 1.01, y: -2 }}
                  whileTap={{ scale: 0.99 }}
                  className={cn(
                    'group relative overflow-hidden flex items-center justify-between rounded-xl border p-4 cursor-pointer transition-all duration-200 shadow-sm',
                    picked === idx 
                      ? 'border-primary bg-primary/5 dark:bg-primary/10 ring-2 ring-primary/20 shadow-primary/10' 
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-primary/40 hover:shadow-md'
                  )}
                  onClick={() => setPicked(idx)}
                  role="radio"
                  aria-checked={picked === idx}
                >
                  <div className="relative z-10 flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <CalendarClock className={cn("w-4 h-4", picked === idx ? "text-primary" : "text-slate-400 dark:text-slate-500")} />
                      <p className={cn("font-medium text-[15px]", picked === idx ? "text-primary" : "text-slate-800 dark:text-slate-200")}>
                        {new Date(slot.start).toLocaleString('id-ID', {
                          weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pl-6">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        {new Date(slot.start).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        {' – '}
                        {new Date(slot.end).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  
                  {picked === idx && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }} 
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      className="relative z-10 flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white shadow-sm"
                    >
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </motion.div>
                  )}
                  
                  {/* Subtle background glow effect when selected */}
                  {picked === idx && (
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none" />
                  )}
                </motion.li>
              ))}
            </ul>
          </div>

          <DialogFooter className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex-wrap gap-3 items-center justify-between sm:justify-between">
            <Button 
              variant="ghost" 
              className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              onClick={() => setRescheduleOpen(true)}
            >
              Waktu tidak cocok?
            </Button>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" className="flex-1 sm:flex-none dark:border-slate-700" onClick={() => onOpenChange(false)}>Tutup</Button>
              <Button 
                className="flex-1 sm:flex-none gap-2 shadow-md"
                onClick={handleConfirm} 
                disabled={picked == null || isSelecting}
              >
                {isSelecting ? 'Memproses...' : 'Konfirmasi Pilihan'}
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
