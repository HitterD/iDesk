import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarClock,
  Plus,
  Trash2,
  Clock,
  Check,
  UserCheck,
  Calendar,
  Sparkles,
  Layers,
  FileText,
  User,
  Shield,
  Search,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ModernDatePicker } from '@/components/ui/ModernDatePicker';
import { fetchTechnicians, type TechnicianItem } from '../../api/installation.api';
import { useScheduleSelection } from '../../hooks/useScheduleSelection';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { HardwareRequestItem, SlotProposal } from '../../types';

interface ScheduleProposeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  arrivedItems: HardwareRequestItem[];
  defaultTechnicianId?: string;
  siteName?: string;
}

const MAX_SLOTS = 3;
const TIME_CHIPS = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];

interface UIDraftSlot {
  date: Date;
  time: string;
  durationHours: number;
}

const formatRoleBadge = (role?: string) => {
  if (!role) return { label: 'Agent', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20' };
  switch (role) {
    case 'AGENT_OPERATIONAL_SUPPORT':
      return { label: 'Ops Support', color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' };
    case 'AGENT_ADMIN':
      return { label: 'Agent Admin', color: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30' };
    case 'ADMIN':
      return { label: 'Admin', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30' };
    case 'MANAGER':
      return { label: 'Manager', color: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30' };
    case 'AGENT_ORACLE':
      return { label: 'Oracle', color: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30' };
    default:
      return { label: 'Agent', color: 'bg-primary/10 text-primary border-primary/20' };
  }
};

export function ScheduleProposeModal({
  open,
  onOpenChange,
  requestId,
  arrivedItems,
  defaultTechnicianId,
  siteName,
}: ScheduleProposeModalProps) {
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>(
    arrivedItems.map((i) => i.id),
  );
  const [technicianId, setTechnicianId] = useState(defaultTechnicianId ?? '');
  const [agentSearch, setAgentSearch] = useState('');

  // Fetch all available technicians
  const { data: technicians = [], isLoading: isLoadingTechs } = useQuery<TechnicianItem[]>({
    queryKey: ['hardware-requests', 'technicians'],
    queryFn: () => fetchTechnicians(),
    staleTime: 5 * 60_000,
  });

  // Sync default technician if available in the ops support list
  useEffect(() => {
    if (technicians.length > 0) {
      const isDefaultInList = technicians.some((t) => t.id === defaultTechnicianId);
      const isCurrentInList = technicians.some((t) => t.id === technicianId);

      if (isDefaultInList && (!technicianId || !isCurrentInList)) {
        setTechnicianId(defaultTechnicianId!);
      } else if (!isCurrentInList) {
        setTechnicianId(technicians[0].id);
      }
    }
  }, [technicians, defaultTechnicianId, technicianId]);

  // Sync selected arrived items
  useEffect(() => {
    if (arrivedItems.length > 0 && selectedItemIds.length === 0) {
      setSelectedItemIds(arrivedItems.map((i) => i.id));
    }
  }, [arrivedItems, selectedItemIds.length]);

  // Initialize with one empty draft slot (tomorrow)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [slots, setSlots] = useState<UIDraftSlot[]>([
    { date: tomorrow, time: '09:00', durationHours: 1 },
  ]);

  const [note, setNote] = useState('');
  const { propose, isProposing } = useScheduleSelection(requestId);

  const setQuickDatePreset = (idx: number, daysToAdd: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysToAdd);
    const next = [...slots];
    next[idx] = { ...next[idx], date: d };
    setSlots(next);
  };

  const calculateEndTime = (timeStr: string, durationHours: number) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const endH = (h + durationHours).toString().padStart(2, '0');
    return `${endH}:${m.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async () => {
    if (selectedItemIds.length === 0) return toast.error('Pilih minimal 1 item yang akan dipasang');
    if (!technicianId) return toast.error('Pilih Agent / Teknisi pelaksana instalasi');
    if (slots.length === 0) return toast.error('Tambah minimal 1 opsi jadwal');

    const finalSlots: SlotProposal[] = [];

    for (const s of slots) {
      if (!s.date || !s.time) {
        return toast.error('Lengkapi tanggal dan jam untuk semua slot jadwal');
      }

      const dateStr = s.date.toISOString().split('T')[0];
      const startDateTime = new Date(`${dateStr}T${s.time}:00`);
      const endDateTime = new Date(startDateTime.getTime() + s.durationHours * 60 * 60 * 1000);

      if (startDateTime <= new Date()) {
        return toast.error('Jadwal instalasi harus di waktu masa mendatang');
      }

      finalSlots.push({
        start: startDateTime.toISOString(),
        end: endDateTime.toISOString(),
      });
    }

    await propose({
      itemIds: selectedItemIds,
      technicianId,
      slots: finalSlots,
      note: note.trim() || undefined,
    });
    onOpenChange(false);
  };

  const selectedAgent = technicians.find((t) => t.id === technicianId);

  const filteredTechnicians = technicians.filter((t) =>
    (t.fullName || '').toLowerCase().includes(agentSearch.toLowerCase()) ||
    (t.role || '').toLowerCase().includes(agentSearch.toLowerCase()) ||
    (t.email || '').toLowerCase().includes(agentSearch.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden bg-background border-border shadow-2xl rounded-3xl">
        {/* Modal Header */}
        <DialogHeader className="px-6 pt-6 pb-4 bg-card border-b border-border/80">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2.5 text-lg sm:text-xl font-extrabold text-foreground">
              <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <CalendarClock className="size-4.5" />
              </div>
              <span>Jadwalkan Instalasi Hardware</span>
            </DialogTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Usulkan alternatif slot waktu pemasangan kepada pemohon. Tiket instalasi otomatis dibuat untuk Agent pelaksana setelah user mengonfirmasi jadwal.
          </p>
        </DialogHeader>

        {/* Modal Body */}
        <div className="px-6 py-5 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* Section: Items */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Layers className="size-3.5 text-primary" />
                <span>Item Perangkat yang Dipasang</span>
              </Label>
              <span className="text-[11px] font-semibold text-primary">
                {selectedItemIds.length} dari {arrivedItems.length} item dipilih
              </span>
            </div>

            <div className="bg-card rounded-2xl p-3 border border-border/80 shadow-2xs space-y-1.5">
              {arrivedItems.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2 text-center">
                  Belum ada item yang berstatus tiba (ARRIVED).
                </p>
              ) : (
                arrivedItems.map((item) => {
                  const checked = selectedItemIds.includes(item.id);
                  return (
                    <label
                      key={item.id}
                      className={cn(
                        'flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer',
                        checked
                          ? 'border-primary/40 bg-primary/5 text-foreground'
                          : 'border-transparent hover:bg-muted/40 text-muted-foreground'
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) =>
                            setSelectedItemIds((prev) =>
                              c ? [...prev, item.id] : prev.filter((id) => id !== item.id)
                            )
                          }
                          className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                        <div className="min-w-0">
                          <span className="text-xs sm:text-sm font-bold text-foreground block truncate">
                            {item.name || item.categorySnapshot?.name || 'Perangkat'}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            Kategori: {item.categorySnapshot?.category || 'Hardware'}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-muted text-foreground shrink-0">
                        Qty: {item.quantity || (item as any).qty || 1}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </section>

          {/* Section: Modern Technician / Agent Selector Dropdown & Quick Chips */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <UserCheck className="size-3.5 text-primary" />
                <span>Teknisi / Agent Pelaksana {siteName ? `(Site: ${siteName})` : ''}</span>
              </Label>
              {selectedAgent && (
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Check className="size-3" />
                  <span>Agent Terpilih: {selectedAgent.fullName}</span>
                </span>
              )}
            </div>

            {/* Radix UI Modern Select Dropdown */}
            <div className="space-y-2.5">
              <Select
                value={technicianId}
                onValueChange={(val) => setTechnicianId(val)}
              >
                <SelectTrigger className="w-full bg-card border-border h-11 rounded-2xl text-xs font-semibold px-3.5 shadow-2xs">
                  <SelectValue placeholder="Pilih Agent / Teknisi Pelaksana..." />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border rounded-2xl shadow-2xl max-h-72">
                  {isLoadingTechs ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">
                      Memuat daftar agent...
                    </div>
                  ) : technicians.length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">
                      Tidak ada teknisi atau agent ditemukan.
                    </div>
                  ) : (
                    technicians.map((t) => {
                      const badge = formatRoleBadge(t.role);
                      return (
                        <SelectItem
                          key={t.id}
                          value={t.id}
                          className="py-2.5 px-3 cursor-pointer"
                        >
                          <div className="flex items-center justify-between w-full gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="size-6 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">
                                {t.fullName.slice(0, 2).toUpperCase()}
                              </span>
                              <span className="font-bold text-xs text-foreground truncate">
                                {t.fullName}
                              </span>
                            </div>
                            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded border shrink-0', badge.color)}>
                              {badge.label}
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>

              {/* Quick Select Chips Grid */}
              {technicians.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Pilihan Cepat Agent:
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto custom-scrollbar p-1">
                    {technicians.map((t) => {
                      const active = technicianId === t.id;
                      const badge = formatRoleBadge(t.role);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTechnicianId(t.id)}
                          className={cn(
                            'inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all duration-150 cursor-pointer shadow-2xs active:scale-[0.98]',
                            active
                              ? 'bg-primary text-primary-foreground border-primary shadow-xs ring-1 ring-primary/40'
                              : 'bg-card text-foreground hover:bg-muted/60 border-border/80'
                          )}
                        >
                          <span
                            className={cn(
                              'size-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0',
                              active ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-foreground'
                            )}
                          >
                            {active ? <Check className="size-2.5" /> : t.fullName.slice(0, 1)}
                          </span>
                          <span className="truncate max-w-[140px]">{t.fullName}</span>
                          <span
                            className={cn(
                              'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border',
                              active
                                ? 'bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30'
                                : badge.color
                            )}
                          >
                            {badge.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Section: Slots Builder */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Calendar className="size-3.5 text-primary" />
                <span>Usulkan Slot Waktu (Maksimal {MAX_SLOTS})</span>
              </Label>
              {slots.length < MAX_SLOTS && (
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  className="h-7 text-xs font-bold gap-1 rounded-lg border-primary/30 text-primary hover:bg-primary/10 cursor-pointer"
                  onClick={() => {
                    const nextDate = new Date();
                    nextDate.setDate(nextDate.getDate() + slots.length + 1);
                    setSlots((prev) => [
                      ...prev,
                      { date: nextDate, time: '10:00', durationHours: 1 },
                    ]);
                  }}
                >
                  <Plus className="size-3.5" />
                  <span>Tambah Alternatif Slot</span>
                </Button>
              )}
            </div>

            <div className="space-y-3.5">
              <AnimatePresence>
                {slots.map((slot, idx) => {
                  const today = new Date();
                  const isToday = slot.date.toDateString() === today.toDateString();
                  const tomorrowD = new Date();
                  tomorrowD.setDate(tomorrowD.getDate() + 1);
                  const isTomorrow = slot.date.toDateString() === tomorrowD.toDateString();
                  const nextTomorrowD = new Date();
                  nextTomorrowD.setDate(nextTomorrowD.getDate() + 2);
                  const isNextTomorrow = slot.date.toDateString() === nextTomorrowD.toDateString();

                  const endTime = calculateEndTime(slot.time, slot.durationHours);

                  return (
                    <motion.div
                      key={idx}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      className="relative bg-card rounded-2xl p-4 border border-border shadow-2xs space-y-3.5"
                    >
                      {/* Slot Header */}
                      <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="size-5 rounded-full bg-primary/10 text-primary text-xs font-black flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-bold text-foreground">
                            Slot Alternatif #{idx + 1}
                          </span>
                          {slot.time && (
                            <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                              {slot.time} – {endTime} ({slot.durationHours} Jam)
                            </span>
                          )}
                        </div>

                        {slots.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setSlots((prev) => prev.filter((_, i) => i !== idx))}
                            className="size-7 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-colors cursor-pointer"
                            title="Hapus slot ini"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Date Presets & Custom Picker */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            Pilih Tanggal:
                          </span>
                          {/* Quick Presets */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setQuickDatePreset(idx, 0)}
                              className={cn(
                                'px-2 py-0.5 text-[11px] font-semibold rounded-md border transition-all cursor-pointer',
                                isToday
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-muted/40 hover:bg-muted text-muted-foreground border-border/80'
                              )}
                            >
                              Hari Ini
                            </button>
                            <button
                              type="button"
                              onClick={() => setQuickDatePreset(idx, 1)}
                              className={cn(
                                'px-2 py-0.5 text-[11px] font-semibold rounded-md border transition-all cursor-pointer',
                                isTomorrow
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-muted/40 hover:bg-muted text-muted-foreground border-border/80'
                              )}
                            >
                              Besok
                            </button>
                            <button
                              type="button"
                              onClick={() => setQuickDatePreset(idx, 2)}
                              className={cn(
                                'px-2 py-0.5 text-[11px] font-semibold rounded-md border transition-all cursor-pointer',
                                isNextTomorrow
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-muted/40 hover:bg-muted text-muted-foreground border-border/80'
                              )}
                            >
                              Lusa
                            </button>
                          </div>
                        </div>

                        <ModernDatePicker
                          value={slot.date}
                          minDate={new Date()}
                          placeholder="Pilih tanggal pemasangan"
                          onChange={(d) => {
                            const next = [...slots];
                            next[idx] = { ...next[idx], date: d };
                            setSlots(next);
                          }}
                        />
                      </div>

                      {/* Time Slot Chips & Duration */}
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_130px] gap-3 pt-1">
                        {/* Time Chips */}
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                            Jam Mulai (WIB):
                          </span>
                          <div className="grid grid-cols-4 gap-1.5">
                            {TIME_CHIPS.map((t) => {
                              const active = slot.time === t;
                              return (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() => {
                                    const next = [...slots];
                                    next[idx] = { ...next[idx], time: t };
                                    setSlots(next);
                                  }}
                                  className={cn(
                                    'py-1.5 text-xs font-mono font-bold rounded-lg border transition-all cursor-pointer text-center',
                                    active
                                      ? 'bg-primary text-primary-foreground border-primary shadow-xs ring-1 ring-primary/40'
                                      : 'bg-background hover:bg-muted/60 border-border text-foreground'
                                  )}
                                >
                                  {t}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Duration Dropdown via Radix UI Select */}
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                            <Clock className="size-3 text-primary" />
                            <span>Durasi:</span>
                          </span>
                          <Select
                            value={String(slot.durationHours)}
                            onValueChange={(val) => {
                              const next = [...slots];
                              next[idx] = { ...next[idx], durationHours: Number(val) };
                              setSlots(next);
                            }}
                          >
                            <SelectTrigger className="w-full bg-background border-border text-xs font-semibold h-9 rounded-xl">
                              <SelectValue placeholder="Pilih durasi" />
                            </SelectTrigger>
                            <SelectContent className="bg-popover border-border rounded-xl shadow-xl">
                              <SelectItem value="1">1 Jam</SelectItem>
                              <SelectItem value="2">2 Jam</SelectItem>
                              <SelectItem value="3">3 Jam</SelectItem>
                              <SelectItem value="4">4 Jam</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </section>

          {/* Section: Additional Notes */}
          <section className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <FileText className="size-3.5 text-primary" />
              <span>Catatan Tambahan untuk Pemohon (Opsional)</span>
            </Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Contoh: Mohon siapkan akses meja kerja dan colokan listrik saat teknisi tiba..."
              className="resize-none bg-card border-border text-xs sm:text-sm rounded-xl placeholder:text-muted-foreground/60"
            />
          </section>
        </div>

        {/* Modal Footer */}
        <DialogFooter className="px-6 py-4 bg-muted/20 border-t border-border/80 flex items-center justify-end gap-2.5">
          <Button
            variant="outline"
            className="rounded-xl text-xs font-bold"
            onClick={() => onOpenChange(false)}
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isProposing}
            className="gap-2 rounded-xl text-xs font-bold shadow-xs active:scale-[0.98]"
          >
            <CalendarClock className="size-4" />
            <span>{isProposing ? 'Mengirimkan Usulan...' : 'Usulkan ke Pemohon'}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
