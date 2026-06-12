import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ModernDatePicker } from '@/components/ui/ModernDatePicker';
import { format, parseISO, addDays } from 'date-fns';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';

interface ZoomRecurringOptionsProps {
    isRecurring: boolean;
    setIsRecurring: (val: boolean) => void;
    freq: string;
    setFreq: (val: string) => void;
    interval: number;
    setInterval: (val: number) => void;
    until: string;
    setUntil: (val: string) => void;
    minDate: Date;
    maxDate: Date;
}

export function ZoomRecurringOptions({
    isRecurring,
    setIsRecurring,
    freq,
    setFreq,
    interval,
    setInterval,
    until,
    setUntil,
    minDate,
    maxDate
}: ZoomRecurringOptionsProps) {
    return (
        <div className="space-y-4 p-4 border rounded-lg bg-slate-50 dark:bg-slate-900/50">
            <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                    <Label className="text-sm font-semibold">Berulang (Recurring)</Label>
                    <p className="text-xs text-muted-foreground">Buat seri meeting reguler</p>
                </div>
                <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
            </div>

            {isRecurring && (
                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                    <div className="space-y-1.5">
                        <Label className="text-xs">Ulangi setiap</Label>
                        <Select value={freq} onValueChange={setFreq}>
                            <SelectTrigger className="h-9">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="DAILY">Hari</SelectItem>
                                <SelectItem value="WEEKLY">Minggu</SelectItem>
                                <SelectItem value="MONTHLY">Bulan</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs">Interval</Label>
                        <Input 
                            type="number" 
                            min={1} 
                            max={30} 
                            value={interval} 
                            onChange={e => setInterval(parseInt(e.target.value) || 1)}
                            className="h-9"
                        />
                    </div>

                    <div className="space-y-1.5 col-span-2">
                        <Label className="text-xs">Berakhir pada (Opsional)</Label>
                        <ModernDatePicker
                            value={until ? parseISO(until) : undefined}
                            onChange={(date) => setUntil(date ? format(date, 'yyyy-MM-dd') : '')}
                            placeholder="Pilih tanggal selesai"
                            minDate={new Date()}
                            maxDate={addDays(new Date(), 365)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
