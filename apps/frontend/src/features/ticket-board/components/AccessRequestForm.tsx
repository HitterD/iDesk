import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Wifi, Globe, Shield, Download, Upload, FileText, Send, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { PDFPreviewModal, usePDFPreview } from '@/features/reports/components/PDFPreviewModal';

const accessRequestSchema = z.object({
    accessTypeId: z.string().min(1, 'Access type is required'),
    requestedAccess: z.string().optional(),
    purpose: z.string().min(3, 'Tujuan/Keperluan harus diisi dengan jelas (min 3 karakter)'),
    validFrom: z.string().optional(),
    validUntil: z.string().optional(),
    customFormData: z.record(z.string(), z.any()).optional(),
});

type AccessRequestFormData = z.infer<typeof accessRequestSchema>;

interface AccessType {
    id: string;
    name: string;
    description: string;
    validityDays: number;
    formTemplateUrl?: string;
    customFields?: any[];
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

    const pdfPreview = usePDFPreview();

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
            const response = await api.get('/access-request/types');
            setAccessTypes(response.data);
        } catch (error) {
            console.error('Failed to fetch access types:', error);
            toast.error('Gagal memuat daftar tipe akses dari server.');
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

        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5050';
        const url = selectedType.formTemplateUrl;
        const absoluteUrl = `${apiUrl}${url.startsWith('/') ? '' : '/'}${url}`;
        const filename = url.split('/').pop() || 'template.pdf';

        pdfPreview.openPreview(absoluteUrl, filename, `Template Form: ${selectedType.name}`);
    };

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)}>
            {/* Main Form - Modern 2 Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">

                {/* LEFT COLUMN - Primary Information (8 cols) */}
                <div className="lg:col-span-8 space-y-6">
                    {/* Access Type - Grid Buttons */}
                    <div className="bg-white/50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
                        <label className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3 block flex items-center gap-2">
                            <Wifi className="w-4 h-4 text-purple-500" />
                            Pilih Jenis Akses *
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {accessTypes.map((type) => {
                                const config = getTypeConfig(type.name);
                                const Icon = config.icon;
                                const isSelected = selectedType?.id === type.id;
                                return (
                                    <button
                                        key={type.id}
                                        type="button"
                                        onClick={() => handleAccessTypeSelect(type.id)}
                                        className={`px-4 py-4 rounded-xl text-sm font-medium transition-colors duration-150 flex flex-col items-center justify-center gap-2 border-2 ${isSelected
                                            ? `border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 shadow-md`
                                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200/70 dark:border-slate-700/70 hover:border-purple-300 dark:hover:border-purple-700'
                                            }`}
                                    >
                                        <div className={`p-2 rounded-lg ${isSelected ? 'bg-purple-500 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <span className={isSelected ? 'font-bold' : ''}>{type.name}</span>
                                        <Badge className={`mt-1 font-normal text-[10px] ${isSelected ? 'bg-purple-200 text-purple-700 hover:bg-purple-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-100'}`} variant="secondary">
                                            Berlaku {type.validityDays} hari
                                        </Badge>
                                    </button>
                                );
                            })}
                        </div>
                        {errors.accessTypeId && (
                            <p className="text-xs text-red-500 mt-2 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.accessTypeId.message}</p>
                        )}
                    </div>

                    {/* Render Dynamic Custom Fields */}
                    {selectedType && selectedType.customFields && selectedType.customFields.length > 0 && (
                        <div className="bg-white/50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm space-y-4">
                            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1 border-b border-slate-100 dark:border-slate-800 pb-2">
                                Informasi Tambahan ({selectedType.name})
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                {selectedType.customFields.map((field: any) => (
                                    <div key={field.id} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
                                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 block">
                                            {field.label} {field.required && <span className="text-red-500">*</span>}
                                        </label>
                                        {field.type === 'textarea' ? (
                                            <Textarea
                                                {...register(`customFormData.${field.id}`, { required: field.required ? `${field.label} wajib diisi` : false })}
                                                placeholder={field.placeholder || ''}
                                                className="min-h-[80px] text-sm resize-none bg-white dark:bg-slate-800 focus:ring-purple-500 border-slate-200/70"
                                            />
                                        ) : (
                                            <Input
                                                type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                                                {...register(`customFormData.${field.id}`, { required: field.required ? `${field.label} wajib diisi` : false })}
                                                placeholder={field.placeholder || ''}
                                                className="h-10 text-sm bg-white dark:bg-slate-800 focus:ring-purple-500 border-slate-200/70"
                                            />
                                        )}
                                        {errors?.customFormData?.[field.id] && (
                                            <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.customFormData[field.id]?.message as string}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Purpose - Auto Expand */}
                    <div className="bg-white/50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
                        <label className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2 block flex items-center gap-2">
                            <FileText className="w-4 h-4 text-purple-500" />
                            Tujuan / Keperluan *
                        </label>
                        <Textarea
                            {...register('purpose')}
                            placeholder="Jelaskan keperluan akses IT secara detail. Contoh: Akses Server Oracle Production untuk Data Analyst, dll."
                            className={`min-h-[100px] text-sm resize-none bg-white dark:bg-slate-800 border-slate-200/70 focus:ring-purple-500 ${errors.purpose ? 'border-red-300 focus:ring-red-500' : ''}`}
                            onInput={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                target.style.height = 'auto';
                                target.style.height = Math.max(100, target.scrollHeight) + 'px';
                            }}
                        />
                        {errors.purpose && (
                            <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1 font-medium"><AlertCircle className="w-3.5 h-3.5" /> {errors.purpose.message}</p>
                        )}
                    </div>
                </div>

                {/* RIGHT COLUMN - Process Info & Settings (4 cols) */}
                <div className="lg:col-span-4 space-y-5">

                    {/* Dates Configuration */}
                    <div className="bg-white/50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 mb-2 text-slate-800 dark:text-slate-200">
                            <div className="p-1.5 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-600">
                                <Upload className="w-4 h-4" />
                            </div>
                            <h4 className="font-semibold text-sm">Durasi Akses</h4>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Mulai Pada</label>
                                <Input
                                    type="date"
                                    {...register('validFrom')}
                                    className="h-9 text-xs"
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Berakhir Pada</label>
                                <Input
                                    type="date"
                                    {...register('validUntil')}
                                    className="h-9 text-xs"
                                />
                            </div>
                        </div>
                        {selectedType && (
                            <p className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg leading-relaxed">
                                {selectedType.description} (Ketetapan Admin: Maks {selectedType.validityDays} hari)
                            </p>
                        )}
                    </div>

                    {/* Template Card Action */}
                    {selectedType && (
                        <div className="bg-gradient-to-br from-purple-50/80 to-indigo-50/80 dark:from-purple-900/20 dark:to-indigo-900/20 p-5 rounded-2xl border border-purple-100 dark:border-purple-800/30">
                            <h4 className="font-semibold text-sm text-purple-800 dark:text-purple-300 flex items-center gap-2 mb-2">
                                <FileText className="w-4 h-4" /> Form Persetujuan
                            </h4>
                            <p className="text-xs text-purple-600 dark:text-purple-400 mb-4 leading-relaxed">
                                Bukti persetujuan dari atasan diperlukan untuk akses jenis ini. Unduh format, isi dan tanda tangani, kemudian *Attach* pada kolom File setelah Tiket dibuat.
                            </p>
                            {selectedType.formTemplateUrl ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleDownloadTemplate}
                                    className="w-full text-sm bg-white dark:bg-slate-800 border-purple-200 dark:border-purple-700/50 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/40 hover:border-purple-300 shadow-sm"
                                >
                                    <Download className="w-4 h-4 mr-2" />
                                    Lihat / Download Form Template
                                </Button>
                            ) : (
                                <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-md border border-amber-200 dark:border-amber-800/30 text-center">
                                    Template formulir belum diunggah instruktur TI.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Submit Area Container */}
                    <div className="bg-white/50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm mt-auto space-y-4">
                        <div className="flex gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onCancel}
                                className="flex-1 h-11 text-sm bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700"
                            >
                                Batal
                            </Button>
                            <Button
                                type="submit"
                                disabled={loading || !selectedType}
                                className="flex-[2] h-11 text-sm bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md shadow-purple-500/20 border-0"
                            >
                                {loading ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Memproses...</span>
                                    </div>
                                ) : (
                                    <>
                                        <span>Kirim Permintaan</span>
                                        <Send className="w-4 h-4 ml-2" />
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <PDFPreviewModal
                isOpen={pdfPreview.isOpen}
                onClose={pdfPreview.closePreview}
                pdfUrl={pdfPreview.previewConfig?.url || ''}
                filename={pdfPreview.previewConfig?.filename || ''}
                title={pdfPreview.previewConfig?.title || ''}
            />
        </form>
    );
};

export default AccessRequestForm;
