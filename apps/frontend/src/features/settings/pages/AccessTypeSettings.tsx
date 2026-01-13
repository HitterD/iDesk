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
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface AccessType {
    id: string;
    name: string;
    description: string;
    validityDays: number;
    formTemplateUrl: string | null;
    requiresSuperiorSignature: boolean;
    requiresUserSignature: boolean;
    isActive: boolean;
}

const getTypeIcon = (name: string) => {
    switch (name) {
        case 'WiFi': return Wifi;
        case 'VPN': return Shield;
        case 'Website': return Globe;
        default: return FileText;
    }
};

const getTypeColor = (name: string) => {
    switch (name) {
        case 'WiFi': return 'bg-blue-500';
        case 'VPN': return 'bg-purple-500';
        case 'Website': return 'bg-emerald-500';
        default: return 'bg-slate-500';
    }
};

export const AccessTypeSettings = () => {
    const [accessTypes, setAccessTypes] = useState<AccessType[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState<string | null>(null);
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
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to upload template');
        } finally {
            setUploading(null);
        }
    };

    const handleViewTemplate = (formTemplateUrl: string) => {
        window.open(formTemplateUrl, '_blank');
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Access Request Form Templates
                </CardTitle>
                <p className="text-sm text-slate-500">
                    Upload form templates untuk setiap jenis akses. User akan dapat mendownload template ini saat mengajukan access request.
                </p>
            </CardHeader>
            <CardContent>
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
                            const color = getTypeColor(type.name);

                            return (
                                <TableRow key={type.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
                                                <Icon className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                                <div className="font-medium">{type.name}</div>
                                                <div className="text-xs text-slate-500">
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
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>

                <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <h4 className="font-medium text-sm mb-2">📝 Catatan:</h4>
                    <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                        <li>• Upload form template dalam format <strong>PDF</strong></li>
                        <li>• Template akan tersedia untuk didownload user saat mengajukan access request</li>
                        <li>• Pastikan template sudah include kolom tanda tangan yang diperlukan</li>
                    </ul>
                </div>
            </CardContent>
        </Card>
    );
};

export default AccessTypeSettings;
