import { addDays, format, parseISO } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ModernDatePicker } from '@/components/ui/ModernDatePicker';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

interface SimpleRecurringFieldProps {
    isRecurring: boolean;
    setIsRecurring: (value: boolean) => void;
    freq: string;
    setFreq: (value: string) => void;
    interval: number;
    setInterval: (value: number) => void;
    until: string;
    setUntil: (value: string) => void;
}

export function SimpleRecurringField({
    isRecurring,
    setIsRecurring,
    freq,
    setFreq,
    interval,
    setInterval,
    until,
    setUntil,
}: SimpleRecurringFieldProps) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Berulang?</Label>
                <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
            </div>

            {isRecurring && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Setiap</span>
                    <Input
                        aria-label="Interval"
                        className="h-8 w-16"
                        max={30}
                        min={1}
                        onChange={(event) => setInterval(Math.min(30, Math.max(1, Number(event.target.value) || 1)))}
                        type="number"
                        value={interval}
                    />
                    <Select value={freq} onValueChange={setFreq}>
                        <SelectTrigger aria-label="Frekuensi" className="h-8 w-28">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="DAILY">Hari</SelectItem>
                            <SelectItem value="WEEKLY">Minggu</SelectItem>
                            <SelectItem value="MONTHLY">Bulan</SelectItem>
                        </SelectContent>
                    </Select>
                    <span className="text-muted-foreground">sampai</span>
                    <ModernDatePicker
                        maxDate={addDays(new Date(), 365)}
                        minDate={new Date()}
                        onChange={(date) => setUntil(format(date, 'yyyy-MM-dd'))}
                        placeholder="Opsional"
                        triggerClassName="h-8"
                        value={until ? parseISO(until) : undefined}
                    />
                </div>
            )}
        </div>
    );
}
