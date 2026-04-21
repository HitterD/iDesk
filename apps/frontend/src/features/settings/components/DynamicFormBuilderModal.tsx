import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, GripVertical, Settings2, Save } from 'lucide-react';
import { toast } from 'sonner';

export interface CustomFieldConfig {
    id: string;
    label: string;
    type: 'text' | 'textarea' | 'number' | 'date';
    required: boolean;
    placeholder?: string;
}

interface DynamicFormBuilderModalProps {
    isOpen: boolean;
    onClose: () => void;
    accessType: any;
    onSave: (typeId: string, customFields: CustomFieldConfig[]) => Promise<void>;
}

export const DynamicFormBuilderModal = ({ isOpen, onClose, accessType, onSave }: DynamicFormBuilderModalProps) => {
    const [fields, setFields] = useState<CustomFieldConfig[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && accessType) {
            setFields(accessType.customFields || []);
        }
    }, [isOpen, accessType]);

    const handleAddField = () => {
        const newField: CustomFieldConfig = {
            id: `field_${Date.now()}`,
            label: 'New Field',
            type: 'text',
            required: false,
            placeholder: '',
        };
        setFields([...fields, newField]);
    };

    const handleRemoveField = (index: number) => {
        const newFields = [...fields];
        newFields.splice(index, 1);
        setFields(newFields);
    };

    const handleFieldChange = (index: number, key: keyof CustomFieldConfig, value: any) => {
        const newFields = [...fields];
        newFields[index] = { ...newFields[index], [key]: value };

        // Auto-generate ID from label if it's the default ID
        if (key === 'label' && newFields[index].id.startsWith('field_')) {
            newFields[index].id = value.toLowerCase().replace(/[^a-z0-9]/g, '_');
        }

        setFields(newFields);
    };

    const handleSave = async () => {
        // Validate
        for (const field of fields) {
            if (!field.label.trim()) {
                toast.error('Semua field harus memiliki nama/label.');
                return;
            }
            if (!field.id.trim() || /[^a-zA-Z0-9_]/.test(field.id)) {
                toast.error(`ID unik untuk "${field.label}" tidak valid (hanya huruf, angka, underscore).`);
                return;
            }
        }

        try {
            setLoading(true);
            await onSave(accessType.id, fields);
            toast.success('Form blueprint saved successfully');
            onClose();
        } catch (error) {
            console.error('Failed to save blueprint', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Settings2 className="w-5 h-5 text-primary" />
                        Form Builder: {accessType?.name}
                    </DialogTitle>
                    <DialogDescription>
                        Kustomisasi kolom input yang akan muncul saat pengguna memilih jenis akses ini.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 my-4">
                    {fields.length === 0 ? (
                        <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                            <p className="text-sm text-slate-500 mb-4">Belum ada field kustom untuk tiket tipe ini.</p>
                            <Button onClick={handleAddField} variant="outline" size="sm">
                                <Plus className="w-4 h-4 mr-2" /> Tambah Field Pertama
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {fields.map((field, index) => (
                                <div key={index} className="flex flex-col md:flex-row gap-4 p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl relative group">
                                    <div className="flex-1 space-y-3">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <Label className="text-xs">Nama Label *</Label>
                                                <Input
                                                    value={field.label}
                                                    onChange={(e) => handleFieldChange(index, 'label', e.target.value)}
                                                    placeholder="Contoh: MAC Address"
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs">Tipe Input</Label>
                                                <Select value={field.type} onValueChange={(val) => handleFieldChange(index, 'type', val)}>
                                                    <SelectTrigger className="h-8 text-sm">
                                                        <SelectValue placeholder="Pilih Tipe" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="text">Short Text</SelectItem>
                                                        <SelectItem value="textarea">Long Text (Paragraph)</SelectItem>
                                                        <SelectItem value="number">Number</SelectItem>
                                                        <SelectItem value="date">Date picker</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <Label className="text-xs text-slate-500">Unique ID (Database Key)</Label>
                                                <Input
                                                    value={field.id}
                                                    onChange={(e) => handleFieldChange(index, 'id', e.target.value)}
                                                    className="h-8 text-xs font-mono bg-slate-100 dark:bg-slate-950"
                                                />
                                            </div>
                                            <div className="flex items-center gap-4 justify-end mt-4">
                                                <div className="flex items-center gap-2">
                                                    <Switch
                                                        checked={field.required}
                                                        onCheckedChange={(val) => handleFieldChange(index, 'required', val)}
                                                    />
                                                    <Label className="text-xs cursor-pointer">Wajib Diisi (Required)</Label>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleRemoveField(index)}
                                                    className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <Button onClick={handleAddField} variant="outline" className="w-full border-dashed">
                                <Plus className="w-4 h-4 mr-2" /> Tambah Kolom Input
                            </Button>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={onClose}>Batal</Button>
                    <Button onClick={handleSave} disabled={loading} className="gap-2">
                        {loading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                        Simpan Blueprint
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
