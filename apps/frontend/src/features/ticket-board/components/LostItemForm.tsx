import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, MapPin, Clock, Send, PackageSearch, CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { PhotoUploader } from '@/features/request-center/components/PhotoUploader';
import { ModernDatePicker } from '@/components/ui/ModernDatePicker';

const lostItemSchema = z.object({
    itemType: z.string().min(1, 'Item type is required'),
    itemName: z.string().min(2, 'Item name must be at least 2 characters'),
    serialNumber: z.string().optional(),
    assetTag: z.string().optional(),
    lastSeenLocation: z.string().min(3, 'Location must be at least 3 characters'),
    lastSeenDate: z.date({
        error: 'Date is required',
    }),
    lastSeenTime: z.string().min(1, 'Time is required'),
    circumstances: z.string().min(10, 'Please describe how the item was lost'),
    witnessContact: z.string().optional(),
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
    const [files, setFiles] = useState<File[]>([]);

    const {
        register,
        handleSubmit,
        setValue,
        control,
        formState: { errors },
    } = useForm<LostItemFormData>({
        resolver: zodResolver(lostItemSchema),
    });

    const onFormSubmit = async (data: LostItemFormData) => {
        setLoading(true);
        try {
            const formData = new FormData();
            
            // Combine date and time
            const dateStr = format(data.lastSeenDate, 'yyyy-MM-dd');
            const datetimeStr = `${dateStr}T${data.lastSeenTime}`;
            
            const payload: any = { ...data, lastSeenDatetime: datetimeStr };
            delete payload.lastSeenDate;
            delete payload.lastSeenTime;

            Object.keys(payload).forEach(key => {
                if (payload[key] !== undefined && payload[key] !== null) {
                    formData.append(key, String(payload[key]));
                }
            });
            
            files.forEach(file => {
                formData.append('photos', file);
            });
            
            await onSubmit(formData);
            toast.success('Lost item report submitted successfully');
        } catch (error) {
            toast.error('Failed to submit report');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
            {/* Warning Banner */}
            <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200/50 dark:border-amber-800/50 text-amber-800 dark:text-amber-400">
                <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                <p className="text-sm font-medium">
                    Semakin cepat dilaporkan, semakin besar kemungkinan barang Anda ditemukan.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* LEFT COLUMN - Item Info */}
                <div className="space-y-5">
                    <div>
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                            <PackageSearch className="w-4 h-4 text-primary" />
                            Detail Barang
                        </h3>
                        
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
                                        Jenis Barang <span className="text-red-500">*</span>
                                    </label>
                                    <Select onValueChange={(val) => setValue('itemType', val)}>
                                        <SelectTrigger className="h-10 text-sm bg-white dark:bg-slate-900">
                                            <SelectValue placeholder="Pilih jenis" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ITEM_TYPES.map((type) => (
                                                <SelectItem key={type} value={type}>{type}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {errors.itemType && (
                                        <p className="text-[10px] text-red-500 mt-1">{errors.itemType.message}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
                                        Nama Barang <span className="text-red-500">*</span>
                                    </label>
                                    <Input
                                        {...register('itemName')}
                                        placeholder="e.g., Laptop Dell Latitude"
                                        className="h-10 text-sm bg-white dark:bg-slate-900"
                                    />
                                    {errors.itemName && (
                                        <p className="text-[10px] text-red-500 mt-1">{errors.itemName.message}</p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
                                        Serial Number
                                    </label>
                                    <Input
                                        {...register('serialNumber')}
                                        placeholder="S/N (Opsional)"
                                        className="h-10 text-sm bg-white dark:bg-slate-900"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
                                        Asset Tag
                                    </label>
                                    <Input
                                        {...register('assetTag')}
                                        placeholder="Kode inventaris (Opsional)"
                                        className="h-10 text-sm bg-white dark:bg-slate-900"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
                                    Kronologi Kehilangan <span className="text-red-500">*</span>
                                </label>
                                <Textarea
                                    {...register('circumstances')}
                                    placeholder="Ceritakan dengan detail kapan dan bagaimana barang tersebut bisa hilang..."
                                    className="min-h-[100px] text-sm resize-none bg-white dark:bg-slate-900"
                                />
                                {errors.circumstances && (
                                    <p className="text-[10px] text-red-500 mt-1">{errors.circumstances.message}</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN - Time & Location */}
                <div className="space-y-5">
                    <div>
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-red-500" />
                            Lokasi & Waktu
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
                                    Lokasi Terakhir Dilihat <span className="text-red-500">*</span>
                                </label>
                                <Input
                                    {...register('lastSeenLocation')}
                                    placeholder="e.g., Pantry Lantai 3, Ruang Meeting A"
                                    className="h-10 text-sm bg-white dark:bg-slate-900"
                                />
                                {errors.lastSeenLocation && (
                                    <p className="text-[10px] text-red-500 mt-1">{errors.lastSeenLocation.message}</p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
                                        Tanggal <span className="text-red-500">*</span>
                                    </label>
                                    <Controller
                                        name="lastSeenDate"
                                        control={control}
                                        render={({ field }) => (
                                            <ModernDatePicker
                                                value={field.value}
                                                onChange={field.onChange}
                                                placeholder="Pilih tanggal"
                                                maxDate={new Date()}
                                                triggerClassName="h-10"
                                            />
                                        )}
                                    />
                                    {errors.lastSeenDate && (
                                        <p className="text-[10px] text-red-500 mt-1">{errors.lastSeenDate?.message}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
                                        Waktu (Perkiraan) <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <Input
                                            type="time"
                                            {...register('lastSeenTime')}
                                            className="h-10 text-sm bg-white dark:bg-slate-900 pl-9"
                                        />
                                        <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                                    </div>
                                    {errors.lastSeenTime && (
                                        <p className="text-[10px] text-red-500 mt-1">{errors.lastSeenTime.message}</p>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
                                    Kontak Saksi (Bila Ada)
                                </label>
                                <Input
                                    {...register('witnessContact')}
                                    placeholder="Nama atau No. HP orang yang mungkin melihat"
                                    className="h-10 text-sm bg-white dark:bg-slate-900"
                                />
                            </div>
                            
                            <div className="pt-2">
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2 block">
                                    Foto Barang (Maks 5)
                                </label>
                                <PhotoUploader 
                                    files={files} 
                                    onChange={setFiles} 
                                    maxFiles={5} 
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={onCancel} className="px-6">
                    Batal
                </Button>
                <Button type="submit" disabled={loading} className="px-6 bg-red-500 hover:bg-red-600 text-white shadow-md">
                    {loading ? 'Submitting...' : (
                        <>
                            <Send className="w-4 h-4 mr-2" />
                            Kirim Laporan
                        </>
                    )}
                </Button>
            </div>
        </form>
    );
};

export default LostItemForm;
