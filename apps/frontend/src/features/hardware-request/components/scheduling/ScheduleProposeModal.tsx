import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, CalendarClock, Clock } from 'lucide-react';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useScheduleSelection } from '../../hooks/useScheduleSelection';
import { toast } from 'sonner';
import { TechnicianFilter } from '../calendar/TechnicianFilter';
import type { HardwareRequestItem, SlotProposal } from '../../types';
import { cn } from '@/lib/utils';

interface ScheduleProposeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  arrivedItems: HardwareRequestItem[];
  defaultTechnicianId?: string;
}

const MAX_SLOTS = 3;
const TIME_CHIPS = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];

interface UIDraftSlot {
  date: string;
  time: string;
  durationHours: number;
}

export function ScheduleProposeModal({
  open, onOpenChange, requestId, arrivedItems, defaultTechnicianId,
}: ScheduleProposeModalProps) {
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>(
    arrivedItems.map((i) => i.id),
  );
  const [technicianId, setTechnicianId] = useState(defaultTechnicianId ?? '');
  
  // Initialize with one empty draft slot (today, no time)
  const todayStr = new Date().toISOString().split('T')[0];
  const [slots, setSlots] = useState<UIDraftSlot[]>([{ date: todayStr, time: '', durationHours: 1 }]);
  
  const [note, setNote] = useState('');
  const { propose, isProposing } = useScheduleSelection(requestId);

  const handleSubmit = async () => {
    if (selectedItemIds.length === 0) return toast.error('Pilih minimal 1 item');
    if (!technicianId) return toast.error('Pilih teknisi');
    if (slots.length === 0) return toast.error('Tambah minimal 1 slot');
    
    const finalSlots: SlotProposal[] = [];
    
    for (const s of slots) {
      if (!s.date || !s.time) return toast.error('Lengkapi tanggal dan waktu untuk semua slot');
      
      const startDateTime = new Date(`${s.date}T${s.time}:00`);
      const endDateTime = new Date(startDateTime.getTime() + s.durationHours * 60 * 60 * 1000);
      
      finalSlots.push({
        start: startDateTime.toISOString(),
        end: endDateTime.toISOString(),
      });
    }

    await propose({
      itemIds: selectedItemIds,
      technicianId,
      slots: finalSlots,
      note: note || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <DialogHeader className="px-6 pt-6 pb-4 bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800">
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-slate-800 dark:text-slate-100">
            <CalendarClock className="w-5 h-5 text-primary" />
            Jadwalkan Instalasi
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 space-y-6 max-h-[65vh] overflow-y-auto">
          {/* Section: Items */}
          <section className="space-y-3">
            <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Item yang dijadwalkan</Label>
            <div className="bg-white dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200 dark:border-slate-700 shadow-sm space-y-2">
              {arrivedItems.map((item) => (
                <label key={item.id} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
                  <Checkbox
                    checked={selectedItemIds.includes(item.id)}
                    onCheckedChange={(c) => setSelectedItemIds((prev) =>
                      c ? [...prev, item.id] : prev.filter((id) => id !== item.id))}
                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {item.name || item.categorySnapshot?.name}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">Qty: {item.quantity || (item as any).qty}</span>
                  </div>
                </label>
              ))}
            </div>
          </section>

          {/* Section: Technician */}
          <section className="space-y-3">
            <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Teknisi</Label>
            <div className="bg-white dark:bg-slate-800/50 rounded-xl p-1 border border-slate-200 dark:border-slate-700 shadow-sm">
              <TechnicianFilter selectedIds={technicianId ? [technicianId] : []} onChange={(ids) => setTechnicianId(ids[0] || '')} />
            </div>
          </section>

          {/* Section: Slots */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Usulkan Slot Waktu (Max {MAX_SLOTS})
              </Label>
              {slots.length < MAX_SLOTS && (
                <Button
                  size="sm" variant="ghost"
                  className="h-8 text-primary hover:text-primary hover:bg-primary/10"
                  onClick={() => setSlots((prev) => [...prev, { date: todayStr, time: '', durationHours: 1 }])}
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Tambah Alternatif
                </Button>
              )}
            </div>
            
            <div className="space-y-4">
              <AnimatePresence>
                {slots.map((slot, idx) => (
                  <motion.div
                    key={idx}
                    layout
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95, height: 0 }}
                    className="relative bg-white dark:bg-slate-800/80 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 text-xs font-bold text-slate-500 dark:text-slate-300">
                          {idx + 1}
                        </span>
                        Slot Alternatif {idx + 1}
                      </h4>
                      {slots.length > 1 && (
                        <Button
                          size="icon" variant="ghost"
                          className="h-7 w-7 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          onClick={() => setSlots((prev) => prev.filter((_, i) => i !== idx))}
                          aria-label="hapus slot"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-[1fr_120px] gap-4">
                      <div className="space-y-3">
                        <Input
                          type="date"
                          value={slot.date}
                          min={todayStr}
                          className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                          onChange={(e) => {
                            const next = [...slots];
                            next[idx] = { ...next[idx], date: e.target.value };
                            setSlots(next);
                          }}
                        />
                        <div className="flex flex-wrap gap-2">
                          {TIME_CHIPS.map(time => (
                            <button
                              key={time}
                              onClick={() => {
                                const next = [...slots];
                                next[idx] = { ...next[idx], time };
                                setSlots(next);
                              }}
                              className={cn(
                                "px-3 py-1.5 text-xs font-medium rounded-lg border transition-all",
                                slot.time === time 
                                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary/50 hover:bg-primary/5"
                              )}
                            >
                              {time}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="space-y-2 border-l border-slate-100 dark:border-slate-700/50 pl-4">
                        <Label className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" /> Durasi
                        </Label>
                        <select 
                          className="w-full text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-primary/20 outline-none"
                          value={slot.durationHours}
                          onChange={(e) => {
                            const next = [...slots];
                            next[idx] = { ...next[idx], durationHours: Number(e.target.value) };
                            setSlots(next);
                          }}
                        >
                          <option value={1}>1 Jam</option>
                          <option value={2}>2 Jam</option>
                          <option value={3}>3 Jam</option>
                          <option value={4}>4 Jam</option>
                        </select>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </section>

          {/* Section: Note */}
          <section className="space-y-3">
            <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Catatan Tambahan (Opsional)</Label>
            <Textarea 
              value={note} 
              onChange={(e) => setNote(e.target.value)} 
              rows={2} 
              placeholder="Tambahkan pesan untuk user (misal: mohon siapkan akses meja...)"
              className="resize-none bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
            />
          </section>
        </div>

        <DialogFooter className="px-6 py-4 bg-slate-100/50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
          <Button variant="outline" className="dark:border-slate-700" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleSubmit} disabled={isProposing} className="gap-2 shadow-md">
            Usulkan ke User
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
