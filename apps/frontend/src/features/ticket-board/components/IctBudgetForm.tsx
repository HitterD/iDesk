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
import { DollarSign, Package, Calendar, AlertCircle, ArrowLeft, Send } from 'lucide-react';
import { toast } from 'sonner';

const ictBudgetSchema = z.object({
    requestType: z.enum(['PURCHASE', 'RENEWAL', 'LICENSE']),
    budgetCategory: z.string().min(1, 'Category is required'),
    itemName: z.string().min(3, 'Item name must be at least 3 characters'),
    vendor: z.string().optional(),
    estimatedAmount: z.coerce.number().min(1, 'Amount must be greater than 0'),
    quantity: z.coerce.number().min(1).default(1),
    renewalPeriodMonths: z.coerce.number().optional(),
    currentExpiryDate: z.string().optional(),
    justification: z.string().min(10, 'Justification must be at least 10 characters'),
    urgencyLevel: z.enum(['NORMAL', 'URGENT']).default('NORMAL'),
    requiresInstallation: z.boolean().default(false),
});

type IctBudgetFormData = z.infer<typeof ictBudgetSchema>;

interface IctBudgetFormProps {
    onSubmit: (data: any) => Promise<void>;
    onCancel: () => void;
}

const REQUEST_TYPES = [
    { value: 'PURCHASE', label: 'Pembelian', icon: Package, color: 'bg-blue-500' },
    { value: 'RENEWAL', label: 'Renewal', icon: Calendar, color: 'bg-amber-500' },
    { value: 'LICENSE', label: 'Lisensi', icon: DollarSign, color: 'bg-emerald-500' },
];

const BUDGET_CATEGORIES = {
    PURCHASE: ['Hardware', 'Software', 'Networking', 'Peripheral', 'Lainnya'],
    RENEWAL: ['Domain', 'Hosting', 'SSL Certificate', 'Software License', 'Support Contract', 'Lainnya'],
    LICENSE: ['Microsoft', 'Adobe', 'Antivirus', 'Database', 'Cloud Service', 'Lainnya'],
};

export const IctBudgetForm = ({ onSubmit, onCancel }: IctBudgetFormProps) => {
    const [loading, setLoading] = useState(false);
    const [requestType, setRequestType] = useState<'PURCHASE' | 'RENEWAL' | 'LICENSE'>('PURCHASE');

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors },
    }: any = useForm({
        resolver: zodResolver(ictBudgetSchema),
        defaultValues: {
            requestType: 'PURCHASE',
            quantity: 1,
            urgencyLevel: 'NORMAL',
            requiresInstallation: false,
        },
    });

    const watchRequiresInstallation = watch('requiresInstallation');

    const onFormSubmit = async (data: any) => {
        setLoading(true);
        try {
            await onSubmit(data);
            toast.success('ICT Budget request submitted successfully');
        } catch (error) {
            toast.error('Failed to submit request');
        } finally {
            setLoading(false);
        }
    };

    const handleRequestTypeChange = (value: 'PURCHASE' | 'RENEWAL' | 'LICENSE') => {
        setRequestType(value);
        setValue('requestType', value);
        setValue('budgetCategory', '');
    };

    return (
        <form onSubmit={handleSubmit(onFormSubmit)}>
            {/* Main Form - 3 Column Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">

                {/* LEFT COLUMN - Request Type + Item Details (5 cols) */}
                <div className="lg:col-span-5 space-y-4">
                    {/* Request Type - Compact Buttons */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2 block">
                            Jenis Request *
                        </label>
                        <div className="flex gap-1.5">
                            {REQUEST_TYPES.map((type) => (
                                <button
                                    key={type.value}
                                    type="button"
                                    onClick={() => handleRequestTypeChange(type.value as any)}
                                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors duration-150 flex items-center justify-center gap-1 ${requestType === type.value
                                        ? `${type.color} text-white`
                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                                        }`}
                                >
                                    <type.icon className="w-3.5 h-3.5" />
                                    {type.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Item Name */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
                            Nama Item *
                        </label>
                        <Input
                            {...register('itemName')}
                            placeholder="e.g., Laptop Dell XPS 15"
                            className="h-9 text-sm"
                        />
                        {errors.itemName && (
                            <p className="text-[10px] text-red-500 mt-0.5">{errors.itemName.message}</p>
                        )}
                    </div>

                    {/* Justification - Auto Expand */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
                            Justifikasi/Alasan *
                        </label>
                        <Textarea
                            {...register('justification')}
                            placeholder="Jelaskan kebutuhan dan alasan pengajuan..."
                            className="min-h-[80px] text-sm resize-none"
                            onInput={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                target.style.height = 'auto';
                                target.style.height = Math.max(80, target.scrollHeight) + 'px';
                            }}
                        />
                        {errors.justification && (
                            <p className="text-[10px] text-red-500 mt-0.5">{errors.justification.message}</p>
                        )}
                    </div>
                </div>

                {/* CENTER COLUMN - Category, Vendor, Quantity (3 cols) */}
                <div className="lg:col-span-3 space-y-4">
                    {/* Category */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
                            Kategori *
                        </label>
                        <Select onValueChange={(val) => setValue('budgetCategory', val)}>
                            <SelectTrigger className="h-9 text-sm">
                                <SelectValue placeholder="Pilih kategori" />
                            </SelectTrigger>
                            <SelectContent>
                                {BUDGET_CATEGORIES[requestType].map((cat) => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.budgetCategory && (
                            <p className="text-[10px] text-red-500 mt-0.5">{errors.budgetCategory.message}</p>
                        )}
                    </div>

                    {/* Vendor */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
                            Vendor
                        </label>
                        <Input
                            {...register('vendor')}
                            placeholder="e.g., Bhinneka"
                            className="h-9 text-sm"
                        />
                    </div>

                    {/* Quantity */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
                            Quantity
                        </label>
                        <Input
                            type="number"
                            {...register('quantity')}
                            min={1}
                            className="h-9 text-sm"
                        />
                    </div>

                    {/* Renewal specific */}
                    {requestType === 'RENEWAL' && (
                        <>
                            <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
                                    Expired Date
                                </label>
                                <Input
                                    type="date"
                                    {...register('currentExpiryDate')}
                                    className="h-9 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
                                    Periode (bulan)
                                </label>
                                <Input
                                    type="number"
                                    {...register('renewalPeriodMonths')}
                                    placeholder="12"
                                    className="h-9 text-sm"
                                />
                            </div>
                        </>
                    )}
                </div>

                {/* RIGHT COLUMN - Amount, Urgency, Submit (4 cols) */}
                <div className="lg:col-span-4 space-y-4">
                    {/* Estimated Amount */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block flex items-center gap-1">
                            <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                            Estimasi Biaya (Rp) *
                        </label>
                        <Input
                            type="number"
                            {...register('estimatedAmount')}
                            placeholder="15000000"
                            className="h-9 text-sm"
                        />
                        {errors.estimatedAmount && (
                            <p className="text-[10px] text-red-500 mt-0.5">{errors.estimatedAmount.message}</p>
                        )}
                    </div>

                    {/* Urgency */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
                            Urgensi
                        </label>
                        <Select onValueChange={(val) => setValue('urgencyLevel', val as any)} defaultValue="NORMAL">
                            <SelectTrigger className="h-9 text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="NORMAL">Normal</SelectItem>
                                <SelectItem value="URGENT">Urgent</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Requires Installation */}
                    <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                        <Checkbox
                            id="requiresInstallation"
                            checked={watchRequiresInstallation}
                            onCheckedChange={(checked) => setValue('requiresInstallation', !!checked)}
                        />
                        <Label htmlFor="requiresInstallation" className="text-xs cursor-pointer">
                            Perlu instalasi hardware
                        </Label>
                    </div>

                    {watchRequiresInstallation && (
                        <div className="flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-950 rounded-lg">
                            <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                            <p className="text-[10px] text-blue-600 dark:text-blue-300">
                                Tiket Hardware Installation akan otomatis dibuat setelah pengadaan.
                            </p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={onCancel} className="flex-1 h-9 text-sm">
                            Batal
                        </Button>
                        <Button type="submit" disabled={loading} className="flex-1 h-9 text-sm">
                            {loading ? 'Submitting...' : (
                                <>
                                    <Send className="w-3.5 h-3.5 mr-1" />
                                    Submit
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </form>
    );
};

export default IctBudgetForm;
