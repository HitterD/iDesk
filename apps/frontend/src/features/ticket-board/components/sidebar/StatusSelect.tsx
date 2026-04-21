import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';


interface StatusSelectProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

export const StatusSelect = ({ value, onChange, disabled }: StatusSelectProps) => {


    return (
        <Select value={value} onValueChange={onChange} disabled={disabled}>
            <SelectTrigger className="w-full bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="Select Status" />
            </SelectTrigger>
            <SelectContent className="bg-navy-light border-white/10 text-white">
                <SelectItem value="TODO">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-slate-500" />
                        To Do
                    </div>
                </SelectItem>
                <SelectItem value="IN_PROGRESS">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        In Progress
                    </div>
                </SelectItem>
                <SelectItem value="WAITING_VENDOR">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-orange-500" />
                        Waiting Vendor
                    </div>
                </SelectItem>
                <SelectItem value="RESOLVED">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        Resolved
                    </div>
                </SelectItem>
            </SelectContent>
        </Select>
    );
};
