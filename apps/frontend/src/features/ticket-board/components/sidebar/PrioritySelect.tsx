import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { AlertCircle, ArrowDown, ArrowUp, Minus } from 'lucide-react';

interface PrioritySelectProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

export const PrioritySelect = ({ value, onChange, disabled }: PrioritySelectProps) => {
    return (
        <Select value={value} onValueChange={onChange} disabled={disabled}>
            <SelectTrigger className="w-full bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="Select Priority" />
            </SelectTrigger>
            <SelectContent className="bg-navy-light border-white/10 text-white">
                <SelectItem value="LOW">
                    <div className="flex items-center gap-2 text-blue-400">
                        <ArrowDown className="w-4 h-4" />
                        Low
                    </div>
                </SelectItem>
                <SelectItem value="MEDIUM">
                    <div className="flex items-center gap-2 text-yellow-400">
                        <Minus className="w-4 h-4" />
                        Medium
                    </div>
                </SelectItem>
                <SelectItem value="HIGH">
                    <div className="flex items-center gap-2 text-orange-500">
                        <ArrowUp className="w-4 h-4" />
                        High
                    </div>
                </SelectItem>
                <SelectItem value="CRITICAL">
                    <div className="flex items-center gap-2 text-red-500">
                        <AlertCircle className="w-4 h-4" />
                        Critical
                    </div>
                </SelectItem>
            </SelectContent>
        </Select>
    );
};
