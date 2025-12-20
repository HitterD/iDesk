import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Wifi, Globe, Shield, Download, Upload, FileText, Send } from 'lucide-react';
import { toast } from 'sonner';

const accessRequestSchema = z.object({
    accessTypeId: z.string().min(1, 'Access type is required'),
    requestedAccess: z.string().optional(),
    purpose: z.string().min(10, 'Purpose must be at least 10 characters'),
    validFrom: z.string().optional(),
    validUntil: z.string().optional(),
});

type AccessRequestFormData = z.infer<typeof accessRequestSchema>;

interface AccessType {
    id: string;
    name: string;
    description: string;
    validityDays: number;
    formTemplateUrl?: string;
}

interface AccessRequestFormProps {
    onSubmit: (data: any) => Promise<void>;
    onCancel: () => void;
}

const ACCESS_TYPES_CONFIG = [
    { name: 'WiFi', icon: Wifi, color: 'bg-blue-500', description: 'Office WiFi' },
    { name: 'VPN', icon: Shield, color: 'bg-purple-500', description: 'Remote Access' },
    { name: 'Website', icon: Globe, color: 'bg-emerald-500', description: 'Unblock URL' },
];

export const AccessRequestForm = ({ onSubmit, onCancel }: AccessRequestFormProps) => {
    const [loading, setLoading] = useState(false);
    const [accessTypes, setAccessTypes] = useState<AccessType[]>([]);
    const [selectedType, setSelectedType] = useState<AccessType | null>(null);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors },
    } = useForm<AccessRequestFormData>({
        resolver: zodResolver(accessRequestSchema),
    });

    useEffect(() => {
        fetchAccessTypes();
    }, []);

    const fetchAccessTypes = async () => {
        try {
            const response = await fetch('/api/access-request/types', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                setAccessTypes(data);
            }
        } catch (error) {
            console.error('Failed to fetch access types:', error);
        }
    };

    const handleFormSubmit = async (data: AccessRequestFormData) => {
        setLoading(true);
        try {
            await onSubmit(data);
            toast.success('Access request submitted successfully');
        } catch (error) {
            toast.error('Failed to submit request');
        } finally {
            setLoading(false);
        }
    };

    const handleAccessTypeSelect = (typeId: string) => {
        const type = accessTypes.find(t => t.id === typeId);
        setSelectedType(type || null);
        setValue('accessTypeId', typeId);

        // Auto-set validity dates based on type
        if (type) {
            const today = new Date();
            const endDate = new Date();
            endDate.setDate(today.getDate() + type.validityDays);

            setValue('validFrom', today.toISOString().split('T')[0]);
            setValue('validUntil', endDate.toISOString().split('T')[0]);
        }
    };

    const getTypeConfig = (name: string) => ACCESS_TYPES_CONFIG.find(t => t.name === name) || ACCESS_TYPES_CONFIG[0];

    const handleDownloadTemplate = async () => {
        if (!selectedType?.formTemplateUrl) {
            toast.error('Tidak ada template form untuk jenis akses ini');
            return;
        }

        // Open template in new tab
        window.open(selectedType.formTemplateUrl, '_blank');
        toast.success('Template form dibuka di tab baru');
    };

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)}>
            {/* Main Form - 3 Column Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">

                {/* LEFT COLUMN - Access Type Selection (5 cols) */}
                <div className="lg:col-span-5 space-y-4">
                    {/* Access Type - Compact Buttons */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2 block">
                            Jenis Akses *
                        </label>
                        <div className="flex gap-2">
                            {accessTypes.map((type) => {
                                const config = getTypeConfig(type.name);
                                const Icon = config.icon;
                                return (
                                    <button
                                        key={type.id}
                                        type="button"
                                        onClick={() => handleAccessTypeSelect(type.id)}
                                        className={`flex-1 px-3 py-3 rounded-xl text-xs font-medium transition-all flex flex-col items-center gap-1 border-2 ${selectedType?.id === type.id
                                            ? `${config.color} text-white border-transparent`
                                            : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                            }`}
                                    >
                                        <Icon className="w-5 h-5" />
                                        <span>{type.name}</span>
                                        <span className={`text-[10px] ${selectedType?.id === type.id ? 'text-white/80' : 'text-slate-400'}`}>
                                            {type.validityDays}d
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        {errors.accessTypeId && (
                            <p className="text-[10px] text-red-500 mt-1">{errors.accessTypeId.message}</p>
                        )}
                    </div>

                    {/* Type-specific field */}
                    {selectedType && (
                        <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
                                {selectedType.name === 'WiFi' && 'Nama Device'}
                                {selectedType.name === 'VPN' && 'Alasan VPN'}
                                {selectedType.name === 'Website' && 'URL yang Diminta *'}
                            </label>
                            <Input
                                {...register('requestedAccess')}
                                placeholder={
                                    selectedType.name === 'WiFi' ? 'e.g., Laptop Pribadi' :
                                        selectedType.name === 'VPN' ? 'e.g., Remote work' :
                                            'e.g., https://example.com'
                                }
                                className="h-9 text-sm"
                            />
                        </div>
                    )}

                    {/* Purpose - Auto Expand */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
                            Tujuan/Keperluan *
                        </label>
                        <Textarea
                            {...register('purpose')}
                            placeholder="Jelaskan keperluan akses ini..."
                            className="min-h-[80px] text-sm resize-none"
                            onInput={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                target.style.height = 'auto';
                                target.style.height = Math.max(80, target.scrollHeight) + 'px';
                            }}
                        />
                        {errors.purpose && (
                            <p className="text-[10px] text-red-500 mt-0.5">{errors.purpose.message}</p>
                        )}
                    </div>
                </div>

                {/* CENTER COLUMN - Validity Period (3 cols) */}
                <div className="lg:col-span-3 space-y-4">
                    {/* Valid From */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
                            Berlaku Dari
                        </label>
                        <Input
                            type="date"
                            {...register('validFrom')}
                            className="h-9 text-sm"
                        />
                    </div>

                    {/* Valid Until */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
                            Berlaku Sampai
                        </label>
                        <Input
                            type="date"
                            {...register('validUntil')}
                            className="h-9 text-sm"
                        />
                    </div>

                    {selectedType && (
                        <div className="text-[10px] text-slate-500 p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                            <p>Default: {selectedType.validityDays} hari</p>
                            <p className="mt-0.5 text-slate-400">{selectedType.description}</p>
                        </div>
                    )}

                    {/* Download Template Button */}
                    {selectedType?.formTemplateUrl && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleDownloadTemplate}
                            className="w-full h-9 text-sm border-purple-300 text-purple-600 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-400 dark:hover:bg-purple-900/20"
                        >
                            <Download className="w-3.5 h-3.5 mr-2" />
                            Download Form Template
                        </Button>
                    )}
                </div>

                {/* RIGHT COLUMN - Process Info & Submit (4 cols) */}
                <div className="lg:col-span-4 space-y-4">
                    {/* Process Steps - Compact */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                        <h4 className="font-medium text-xs flex items-center gap-1 mb-2 text-slate-700 dark:text-slate-300">
                            <FileText className="h-3.5 w-3.5" />
                            Proses Pengajuan
                        </h4>
                        <div className="flex justify-between text-[10px] text-slate-500">
                            <div className="flex flex-col items-center">
                                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center mb-0.5">1</div>
                                <span>Submit</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center mb-0.5">
                                    <Download className="h-3 w-3" />
                                </div>
                                <span>Download</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center mb-0.5">
                                    <Upload className="h-3 w-3" />
                                </div>
                                <span>Upload</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center mb-0.5 text-green-600">✓</div>
                                <span>Done</span>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={onCancel} className="flex-1 h-10 text-sm">
                            Batal
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading || !selectedType}
                            className="flex-1 h-10 text-sm bg-purple-500 hover:bg-purple-600"
                        >
                            {loading ? 'Submitting...' : (
                                <>
                                    <Send className="w-3.5 h-3.5 mr-1" />
                                    Submit
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Tip */}
                    <p className="text-[10px] text-slate-500">
                        💡 Form persetujuan akan otomatis digenerate setelah submit
                    </p>
                </div>
            </div>
        </form>
    );
};

export default AccessRequestForm;
