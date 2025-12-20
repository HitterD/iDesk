import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { PackageX, AlertTriangle, MapPin, Clock, DollarSign, Send } from 'lucide-react';
import { toast } from 'sonner';

const lostItemSchema = z.object({
    itemType: z.string().min(1, 'Item type is required'),
    itemName: z.string().min(2, 'Item name must be at least 2 characters'),
    serialNumber: z.string().optional(),
    assetTag: z.string().optional(),
    lastSeenLocation: z.string().min(3, 'Location must be at least 3 characters'),
    lastSeenDatetime: z.string().min(1, 'Date/time is required'),
    circumstances: z.string().min(10, 'Please describe how the item was lost'),
    witnessContact: z.string().optional(),
    hasPoliceReport: z.boolean().optional().default(false),
    policeReportNumber: z.string().optional(),
    estimatedValue: z.coerce.number().optional(),
    finderRewardOffered: z.boolean().optional().default(false),
});

type LostItemFormData = z.infer<typeof lostItemSchema>;

interface LostItemFormProps {
    onSubmit: (data: any) => Promise<void>;
    onCancel: () => void;
}

const ITEM_TYPES = [
    'Laptop',
    'HP/Smartphone',
    'ID Card/Badge',
    'Kunci',
    'Tas/Backpack',
    'Dompet',
    'Charger/Adapter',
    'Flashdisk/HDD',
    'Lainnya',
];

export const LostItemForm = ({ onSubmit, onCancel }: LostItemFormProps) => {
    const [loading, setLoading] = useState(false);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors },
    }: any = useForm({
        resolver: zodResolver(lostItemSchema),
        defaultValues: {
            hasPoliceReport: false,
            finderRewardOffered: false,
        },
    });

    const watchHasPoliceReport = watch('hasPoliceReport');
    const watchFinderReward = watch('finderRewardOffered');

    const onFormSubmit = async (data: any) => {
        setLoading(true);
        try {
            await onSubmit(data);
            toast.success('Lost item report submitted successfully');
        } catch (error) {
            toast.error('Failed to submit report');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit(onFormSubmit)}>
            {/* Warning Banner - Compact */}
            <div className="flex items-center gap-2 p-2 mb-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                    Semakin cepat dilaporkan, semakin besar kemungkinan ditemukan.
                </p>
            </div>

            {/* Main Form - 3 Column Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">

                {/* LEFT COLUMN - Item Details (5 cols) */}
                <div className="lg:col-span-5 space-y-4">
                    {/* Item Type & Name */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
                                Jenis Barang *
                            </label>
                            <Select onValueChange={(val) => setValue('itemType', val)}>
                                <SelectTrigger className="h-9 text-sm">
                                    <SelectValue placeholder="Pilih jenis" />
                                </SelectTrigger>
                                <SelectContent>
                                    {ITEM_TYPES.map((type) => (
                                        <SelectItem key={type} value={type}>{type}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.itemType && (
                                <p className="text-[10px] text-red-500 mt-0.5">{errors.itemType.message}</p>
                            )}
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
                                Nama Barang *
                            </label>
                            <Input
                                {...register('itemName')}
                                placeholder="e.g., Laptop Dell"
                                className="h-9 text-sm"
                            />
                            {errors.itemName && (
                                <p className="text-[10px] text-red-500 mt-0.5">{errors.itemName.message}</p>
                            )}
                        </div>
                    </div>

                    {/* Circumstances - Auto Expand */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
                            Kronologi Kehilangan *
                        </label>
                        <Textarea
                            {...register('circumstances')}
                            placeholder="Jelaskan bagaimana barang tersebut hilang..."
                            className="min-h-[80px] text-sm resize-none"
                            onInput={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                target.style.height = 'auto';
                                target.style.height = Math.max(80, target.scrollHeight) + 'px';
                            }}
                        />
                        {errors.circumstances && (
                            <p className="text-[10px] text-red-500 mt-0.5">{errors.circumstances.message}</p>
                        )}
                    </div>

                    {/* Serial & Asset Tag */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
                                Serial Number
                            </label>
                            <Input
                                {...register('serialNumber')}
                                placeholder="S/N"
                                className="h-9 text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
                                Asset Tag
                            </label>
                            <Input
                                {...register('assetTag')}
                                placeholder="Kode inventaris"
                                className="h-9 text-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* CENTER COLUMN - Location & Time (3 cols) */}
                <div className="lg:col-span-3 space-y-4">
                    {/* Location */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-red-500" />
                            Lokasi Terakhir *
                        </label>
                        <Input
                            {...register('lastSeenLocation')}
                            placeholder="e.g., Ruang meeting Lt.2"
                            className="h-9 text-sm"
                        />
                        {errors.lastSeenLocation && (
                            <p className="text-[10px] text-red-500 mt-0.5">{errors.lastSeenLocation.message}</p>
                        )}
                    </div>

                    {/* DateTime */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-blue-500" />
                            Waktu Terakhir *
                        </label>
                        <Input
                            type="datetime-local"
                            {...register('lastSeenDatetime')}
                            className="h-9 text-sm"
                        />
                        {errors.lastSeenDatetime && (
                            <p className="text-[10px] text-red-500 mt-0.5">{errors.lastSeenDatetime.message}</p>
                        )}
                    </div>

                    {/* Witness */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
                            Kontak Saksi
                        </label>
                        <Input
                            {...register('witnessContact')}
                            placeholder="Nama & HP saksi"
                            className="h-9 text-sm"
                        />
                    </div>
                </div>

                {/* RIGHT COLUMN - Value & Options & Submit (4 cols) */}
                <div className="lg:col-span-4 space-y-4">
                    {/* Estimated Value */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                            <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                            Estimasi Nilai (Rp)
                        </label>
                        <Input
                            type="number"
                            {...register('estimatedValue')}
                            placeholder="5000000"
                            className="h-9 text-sm"
                        />
                    </div>

                    {/* Options */}
                    <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="finderReward"
                                checked={watchFinderReward}
                                onCheckedChange={(checked) => setValue('finderRewardOffered', !!checked)}
                            />
                            <Label htmlFor="finderReward" className="text-xs cursor-pointer">
                                Bersedia beri imbalan penemuan
                            </Label>
                        </div>

                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="policeReport"
                                checked={watchHasPoliceReport}
                                onCheckedChange={(checked) => setValue('hasPoliceReport', !!checked)}
                            />
                            <Label htmlFor="policeReport" className="text-xs cursor-pointer">
                                Sudah lapor polisi
                            </Label>
                        </div>

                        {watchHasPoliceReport && (
                            <div className="pt-2">
                                <label className="text-xs text-slate-500 mb-1 block">No. Laporan Polisi</label>
                                <Input
                                    {...register('policeReportNumber')}
                                    placeholder="LP/xxx/xxx/xxx"
                                    className="h-8 text-xs"
                                />
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={onCancel} className="flex-1 h-9 text-sm">
                            Batal
                        </Button>
                        <Button type="submit" disabled={loading} className="flex-1 h-9 text-sm bg-red-500 hover:bg-red-600">
                            {loading ? 'Submitting...' : (
                                <>
                                    <PackageX className="w-3.5 h-3.5 mr-1" />
                                    Report Lost
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </form>
    );
};

export default LostItemForm;
