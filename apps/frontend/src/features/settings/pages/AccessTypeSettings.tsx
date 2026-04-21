import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Wifi,
    Shield,
    Globe,
    Upload,
    FileText,
    Check,
    X,
    Loader2,
    ExternalLink,
    Settings2,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import { PDFPreviewModal, usePDFPreview } from '@/features/reports/components/PDFPreviewModal';
import { DynamicFormBuilderModal, CustomFieldConfig } from '../components/DynamicFormBuilderModal';

interface AccessType {
    id: string;
    name: string;
    description: string;
    validityDays: number;
    formTemplateUrl: string | null;
    requiresSuperiorSignature: boolean;
    requiresUserSignature: boolean;
    isActive: boolean;
    customFields?: CustomFieldConfig[];
}

const getTypeIcon = (name: string) => {
    switch (name) {
        case 'WiFi': return Wifi;
        case 'VPN': return Shield;
        case 'Website': return Globe;
        default: return FileText;
    }
};

const getTypeGradient = (name: string) => {
    switch (name) {
        case 'WiFi': return 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/20';
        case 'VPN': return 'bg-gradient-to-br from-purple-500 to-fuchsia-600 shadow-purple-500/20';
        case 'Website': return 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/20';
        default: return 'bg-gradient-to-br from-slate-500 to-slate-600 shadow-slate-500/20';
    }
};

export const AccessTypeSettings = () => {
    const [accessTypes, setAccessTypes] = useState<AccessType[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState<string | null>(null);
    const [selectedForBuilder, setSelectedForBuilder] = useState<any | null>(null);

    const pdfPreview = usePDFPreview();
    const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    useEffect(() => {
        fetchAccessTypes();
    }, []);

    const fetchAccessTypes = async () => {
        try {
            setLoading(true);
            const response = await api.get('/access-request/types');
            setAccessTypes(response.data);
        } catch (error) {
            toast.error('Failed to load access types');
            console.error('Failed to fetch access types:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUploadClick = (typeId: string) => {
        fileInputRefs.current[typeId]?.click();
    };

    const handleFileChange = async (typeId: string, file: File | undefined) => {
        if (!file) return;

        if (file.type !== 'application/pdf') {
            toast.error('Only PDF files are allowed');
            return;
        }

        setUploading(typeId);
        try {
            const formData = new FormData();
            formData.append('template', file);

            await api.post(`/access-request/types/${typeId}/upload-template`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            toast.success('Template uploaded successfully');
            fetchAccessTypes();
        } catch (error) {
            const err = error as any;
            toast.error(err.response?.data?.message || 'Failed to upload template');
        } finally {
            setUploading(null);
        }
    };

    const handleViewTemplate = (formTemplateUrl: string) => {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5050';
        const absoluteUrl = `${apiUrl}${formTemplateUrl.startsWith('/') ? '' : '/'}${formTemplateUrl}`;
        const filename = formTemplateUrl.split('/').pop() || 'template.pdf';
        pdfPreview.openPreview(absoluteUrl, filename, 'Form Template Preview');
    };

    const handleSaveBlueprint = async (typeId: string, customFields: CustomFieldConfig[]) => {
        await api.patch(`/access-request/types/${typeId}`, { customFields });
        fetchAccessTypes(); // Refresh table
    };

    if (loading) {
        return (
            <Card className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-white/50 dark:border-slate-800/50 shadow-sm">
                <CardContent className="flex flex-col items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                    <p className="text-sm text-slate-500">Loading access types configuration...</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-white/50 dark:border-slate-800/50 shadow-sm overflow-hidden">
            <CardHeader className="bg-white/40 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800/50 pb-6">
                <CardTitle className="flex items-center gap-2 text-xl">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-primary" />
                    </div>
                    Access Request Blueprint
                </CardTitle>
                <p className="text-sm text-slate-500 mt-2 max-w-2xl">
                    Konfigurasi template PDF yang wajib diunggah pengguna, serta bangun *custom fields* spesifik untuk setiap jenis layanan akses di organisasi Anda.
                </p>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Jenis Akses</TableHead>
                                <TableHead>Validity</TableHead>
                                <TableHead>Signatures Required</TableHead>
                                <TableHead>Template</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {accessTypes.map((type) => {
                                const Icon = getTypeIcon(type.name);
                                const gradient = getTypeGradient(type.name);

                                return (
                                    <TableRow key={type.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
                                        <TableCell className="py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl ${gradient} shadow-md flex items-center justify-center transform group-hover:scale-105 transition-transform`}>
                                                    <Icon className="w-5 h-5 text-white" />
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-slate-800 dark:text-slate-100">{type.name}</div>
                                                    <div className="text-xs text-slate-500 max-w-[200px] truncate">
                                                        {type.description || 'No description'}
                                                    </div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">
                                                {type.validityDays} hari
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-2">
                                                <Badge variant={type.requiresUserSignature ? 'default' : 'secondary'}>
                                                    {type.requiresUserSignature ? <Check className="w-3 h-3 mr-1" /> : <X className="w-3 h-3 mr-1" />}
                                                    User
                                                </Badge>
                                                <Badge variant={type.requiresSuperiorSignature ? 'default' : 'secondary'}>
                                                    {type.requiresSuperiorSignature ? <Check className="w-3 h-3 mr-1" /> : <X className="w-3 h-3 mr-1" />}
                                                    Atasan
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {type.formTemplateUrl ? (
                                                <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
                                                    <Check className="w-3 h-3 mr-1" />
                                                    Uploaded
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                                                    <X className="w-3 h-3 mr-1" />
                                                    No Template
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {type.formTemplateUrl && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleViewTemplate(type.formTemplateUrl!)}
                                                    >
                                                        <ExternalLink className="w-4 h-4 mr-1" />
                                                        View
                                                    </Button>
                                                )}
                                                <input
                                                    type="file"
                                                    accept=".pdf"
                                                    className="hidden"
                                                    ref={(el) => { fileInputRefs.current[type.id] = el; }}
                                                    onChange={(e) => handleFileChange(type.id, e.target.files?.[0])}
                                                />
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleUploadClick(type.id)}
                                                    disabled={uploading === type.id}
                                                >
                                                    {uploading === type.id ? (
                                                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                                    ) : (
                                                        <Upload className="w-4 h-4 mr-1" />
                                                    )}
                                                    {type.formTemplateUrl ? 'Replace' : 'Upload'}
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="border-primary/30 text-primary hover:bg-primary/5"
                                                    onClick={() => setSelectedForBuilder(type)}
                                                >
                                                    <Settings2 className="w-4 h-4 mr-1" />
                                                    Fields
                                                    {type.customFields && type.customFields.length > 0 && (
                                                        <Badge variant="secondary" className="ml-2 h-5 px-1">{type.customFields.length}</Badge>
                                                    )}
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>

                <div className="mt-6 p-4 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-xl flex gap-3">
                    <div className="text-blue-500 mt-0.5"><Settings2 className="w-5 h-5" /></div>
                    <div>
                        <h4 className="font-semibold text-sm text-blue-800 dark:text-blue-300 mb-1">Membangun Formulir Dinamis</h4>
                        <p className="text-xs text-blue-600/80 dark:text-blue-400/80 leading-relaxed md:max-w-[80%]">
                            Gunakan tombol <strong>Fields</strong> untuk merancang pertanyaan kustom saat pembuatan tiket. Pengguna juga akan diminta mengunduh <strong>Template PDF</strong> jika Anda mengunggahnya pada tombol Replace/Upload.
                        </p>
                    </div>
                </div>
            </CardContent>

            <DynamicFormBuilderModal
                isOpen={!!selectedForBuilder}
                onClose={() => setSelectedForBuilder(null)}
                accessType={selectedForBuilder}
                onSave={handleSaveBlueprint}
            />

            <PDFPreviewModal
                isOpen={pdfPreview.isOpen}
                onClose={pdfPreview.closePreview}
                pdfUrl={pdfPreview.previewConfig?.url || ''}
                filename={pdfPreview.previewConfig?.filename || ''}
                title={pdfPreview.previewConfig?.title || ''}
            />
        </Card>
    );
};

export default AccessTypeSettings;
