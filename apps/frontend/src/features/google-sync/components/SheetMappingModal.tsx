import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Table2, ArrowRightLeft, Columns, Plus, Trash2 } from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import {
    SpreadsheetConfig,
    SpreadsheetSheet,
    useCreateSheetMapping,
    useUpdateSheetMapping,
    useDiscoverSheets,
    useGetSheetHeaders,
} from '../hooks/useGoogleSync';
import { toast } from 'sonner';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    config: SpreadsheetConfig | null;
    sheet?: SpreadsheetSheet | null;
}

interface FormData {
    sheetName: string;
    dataType: 'RENEWAL' | 'VPN' | 'CUSTOM';
    syncDirection: 'PUSH' | 'PULL' | 'BOTH';
    headerRow: number;
    dataStartRow: number;
    syncIntervalSeconds: number;
    syncEnabled: boolean;
    columnMapping: Array<{
        iDeskField: string;
        sheetColumn: string;
        type: 'string' | 'number' | 'date' | 'boolean';
        required: boolean;
    }>;
}

const IDESK_FIELDS = {
    RENEWAL: [
        { field: 'id', label: 'ID', type: 'string' },
        { field: 'poNumber', label: 'PO Number', type: 'string' },
        { field: 'vendorName', label: 'Vendor Name', type: 'string' },
        { field: 'description', label: 'Description', type: 'string' },
        { field: 'category', label: 'Category', type: 'string' },
        { field: 'contractValue', label: 'Contract Value', type: 'number' },
        { field: 'startDate', label: 'Start Date', type: 'date' },
        { field: 'endDate', label: 'End Date', type: 'date' },
        { field: 'status', label: 'Status', type: 'string' },
        { field: 'isAcknowledged', label: 'Is Acknowledged', type: 'boolean' },
        { field: 'createdAt', label: 'Created At', type: 'date' },
        { field: 'updatedAt', label: 'Updated At', type: 'date' },
    ],
    VPN: [
        { field: 'id', label: 'ID', type: 'string' },
        { field: 'username', label: 'Username', type: 'string' },
        { field: 'fullName', label: 'Full Name', type: 'string' },
        { field: 'email', label: 'Email', type: 'string' },
        { field: 'department', label: 'Department', type: 'string' },
        { field: 'site', label: 'Site', type: 'string' },
        { field: 'vpnType', label: 'VPN Type', type: 'string' },
        { field: 'validFrom', label: 'Valid From', type: 'date' },
        { field: 'validUntil', label: 'Valid Until', type: 'date' },
        { field: 'status', label: 'Status', type: 'string' },
        { field: 'notes', label: 'Notes', type: 'string' },
        { field: 'createdAt', label: 'Created At', type: 'date' },
        { field: 'updatedAt', label: 'Updated At', type: 'date' },
    ],
    CUSTOM: [],
};

export function SheetMappingModal({ isOpen, onClose, config, sheet }: Props) {
    const [selectedSheetName, setSelectedSheetName] = useState('');
    const createMapping = useCreateSheetMapping();
    const updateMapping = useUpdateSheetMapping();

    const { data: discoveredSheets } = useDiscoverSheets(config?.spreadsheetId || '');
    const { data: headers = [] } = useGetSheetHeaders(
        config?.spreadsheetId || '',
        selectedSheetName,
    );

    const { register, control, handleSubmit, watch, reset, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
        defaultValues: {
            dataType: 'RENEWAL',
            syncDirection: 'BOTH',
            headerRow: 1,
            dataStartRow: 2,
            syncIntervalSeconds: 30,
            syncEnabled: true,
            columnMapping: [],
        },
    });

    const { fields: mappingFields, append: appendMapping, remove: removeMapping } = useFieldArray({
        control,
        name: 'columnMapping',
    });

    const dataType = watch('dataType');
    const sheetName = watch('sheetName');

    useEffect(() => {
        if (sheetName) {
            setSelectedSheetName(sheetName);
        }
    }, [sheetName]);

    useEffect(() => {
        if (sheet) {
            reset({
                sheetName: sheet.sheetName,
                dataType: sheet.dataType as any,
                syncDirection: sheet.syncDirection as any,
                headerRow: sheet.headerRow,
                dataStartRow: sheet.dataStartRow,
                syncIntervalSeconds: sheet.syncIntervalSeconds,
                syncEnabled: sheet.syncEnabled,
                columnMapping: sheet.columnMapping || [],
            });
            setSelectedSheetName(sheet.sheetName);
        } else {
            reset({
                sheetName: '',
                dataType: 'RENEWAL',
                syncDirection: 'BOTH',
                headerRow: 1,
                dataStartRow: 2,
                syncIntervalSeconds: 30,
                syncEnabled: true,
                columnMapping: [],
            });
        }
    }, [sheet, reset]);

    const availableFields = IDESK_FIELDS[dataType] || [];

    // Switch to manual input if no sheets discovered
    const hasDiscoveredSheets = discoveredSheets?.sheets?.some((s: any) => s?.properties?.title);
    const [useManualInput, setUseManualInput] = useState(false);

    const addMapping = () => {
        appendMapping({
            iDeskField: '',
            sheetColumn: '',
            type: 'string',
            required: false,
        });
    };

    // Auto-fill default mapping based on data type
    const addDefaultMapping = () => {
        // Clear existing mappings
        while (mappingFields.length > 0) {
            removeMapping(0);
        }

        // Default column names that match the CSV template
        const defaultMappings = dataType === 'VPN' ? [
            { iDeskField: 'id', sheetColumn: 'id', type: 'string' as const, required: false },
            { iDeskField: 'username', sheetColumn: 'Username', type: 'string' as const, required: true },
            { iDeskField: 'fullName', sheetColumn: 'Full Name', type: 'string' as const, required: true },
            { iDeskField: 'email', sheetColumn: 'Email', type: 'string' as const, required: false },
            { iDeskField: 'vpnType', sheetColumn: 'VPN Type', type: 'string' as const, required: true },
            { iDeskField: 'validFrom', sheetColumn: 'Valid From', type: 'date' as const, required: true },
            { iDeskField: 'validUntil', sheetColumn: 'Valid Until', type: 'date' as const, required: true },
            { iDeskField: 'status', sheetColumn: 'Status', type: 'string' as const, required: false },
            { iDeskField: 'site', sheetColumn: 'Site', type: 'string' as const, required: false },
            { iDeskField: 'notes', sheetColumn: 'Notes', type: 'string' as const, required: false },
        ] : [
            { iDeskField: 'id', sheetColumn: 'id', type: 'string' as const, required: false },
            { iDeskField: 'poNumber', sheetColumn: 'PO Number', type: 'string' as const, required: true },
            { iDeskField: 'vendorName', sheetColumn: 'Vendor Name', type: 'string' as const, required: true },
            { iDeskField: 'description', sheetColumn: 'Description', type: 'string' as const, required: false },
            { iDeskField: 'category', sheetColumn: 'Category', type: 'string' as const, required: false },
            { iDeskField: 'contractValue', sheetColumn: 'Contract Value (IDR)', type: 'number' as const, required: false },
            { iDeskField: 'startDate', sheetColumn: 'Start Date', type: 'date' as const, required: false },
            { iDeskField: 'endDate', sheetColumn: 'End Date', type: 'date' as const, required: true },
            { iDeskField: 'status', sheetColumn: 'Status', type: 'string' as const, required: false },
        ];

        defaultMappings.forEach(m => appendMapping(m));
        toast.success('Default mapping ditambahkan');
    };

    const onSubmit = async (data: FormData) => {
        if (!config) return;

        try {
            if (sheet) {
                await updateMapping.mutateAsync({
                    id: sheet.id,
                    data: { ...data, configId: config.id },
                });
                toast.success('Sheet mapping berhasil diupdate');
            } else {
                await createMapping.mutateAsync({
                    ...data,
                    configId: config.id,
                });
                toast.success('Sheet mapping berhasil ditambahkan');
            }
            onClose();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Terjadi kesalahan');
        }
    };

    if (!config) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-3xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-green-500/10 to-cyan-500/10">
                            <div className="flex items-center gap-3">
                                <Table2 className="w-6 h-6 text-cyan-400" />
                                <h2 className="text-xl font-semibold text-white">
                                    {sheet ? 'Edit Sheet Mapping' : 'Tambah Sheet Mapping'}
                                </h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                            {/* Sheet Selection & Data Type */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Sheet Name *
                                    </label>
                                    {(hasDiscoveredSheets && !useManualInput) ? (
                                        <select
                                            {...register('sheetName', { required: 'Sheet wajib dipilih' })}
                                            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer"
                                        >
                                            <option value="">Pilih Sheet</option>
                                            {discoveredSheets?.sheets?.filter((s: any) => s?.properties?.title)?.map((s: any) => (
                                                <option key={s.properties.sheetId || s.properties.title} value={s.properties.title}>
                                                    {s.properties.title}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            {...register('sheetName', { required: 'Sheet name wajib diisi' })}
                                            type="text"
                                            placeholder="Contoh: VPN Access"
                                            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50"
                                        />
                                    )}
                                    <div className="flex items-center gap-2 mt-2">
                                        <button
                                            type="button"
                                            onClick={() => setUseManualInput(!useManualInput)}
                                            className="text-xs text-cyan-400 hover:text-cyan-300"
                                        >
                                            {useManualInput ? '← Pilih dari list' : 'Ketik manual →'}
                                        </button>
                                    </div>
                                    {errors.sheetName && <p className="text-red-400 text-sm mt-1">{errors.sheetName.message}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Data Type *
                                    </label>
                                    <select
                                        {...register('dataType', { required: true })}
                                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer"
                                    >
                                        <option value="RENEWAL">Renewal Contract</option>
                                        <option value="VPN">VPN Access</option>
                                        <option value="CUSTOM">Custom</option>
                                    </select>
                                    <button
                                        type="button"
                                        onClick={addDefaultMapping}
                                        className="mt-2 text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                                    >
                                        ⚡ Auto-fill Default Mapping
                                    </button>
                                </div>
                            </div>

                            {/* Sync Direction & Interval */}
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        <ArrowRightLeft className="w-4 h-4 inline mr-1" />
                                        Sync Direction
                                    </label>
                                    <select
                                        {...register('syncDirection')}
                                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer"
                                    >
                                        <option value="BOTH">Two-Way (Both)</option>
                                        <option value="PUSH">Push to Sheet</option>
                                        <option value="PULL">Pull from Sheet</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Header Row
                                    </label>
                                    <input
                                        {...register('headerRow', { valueAsNumber: true })}
                                        type="number"
                                        min={1}
                                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Data Start Row
                                    </label>
                                    <input
                                        {...register('dataStartRow', { valueAsNumber: true })}
                                        type="number"
                                        min={1}
                                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50"
                                    />
                                </div>
                            </div>

                            {/* Sync Interval & Enabled */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Sync Interval (seconds)
                                    </label>
                                    <input
                                        {...register('syncIntervalSeconds', { valueAsNumber: true })}
                                        type="number"
                                        min={10}
                                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50"
                                    />
                                </div>
                                <div className="flex items-end">
                                    <label className="flex items-center gap-3 py-2.5 cursor-pointer">
                                        <input
                                            {...register('syncEnabled')}
                                            type="checkbox"
                                            className="w-5 h-5 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/50"
                                        />
                                        <span className="text-white">Enable Auto Sync</span>
                                    </label>
                                </div>
                            </div>

                            {/* Column Mapping */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <label className="block text-sm font-medium text-slate-300">
                                        <Columns className="w-4 h-4 inline mr-1" />
                                        Column Mapping
                                    </label>
                                    <button
                                        type="button"
                                        onClick={addMapping}
                                        className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Add Mapping
                                    </button>
                                </div>

                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {mappingFields.map((field, idx) => (
                                        <div key={field.id} className="flex items-center gap-2 p-3 bg-white/5 rounded-xl">
                                            <select
                                                {...register(`columnMapping.${idx}.iDeskField`)}
                                                className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none"
                                            >
                                                <option value="">iDesk Field</option>
                                                {availableFields.map(f => (
                                                    <option key={f.field} value={f.field}>{f.label}</option>
                                                ))}
                                            </select>
                                            <ArrowRightLeft className="w-4 h-4 text-slate-500" />
                                            <select
                                                {...register(`columnMapping.${idx}.sheetColumn`)}
                                                className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none"
                                            >
                                                <option value="">Sheet Column</option>
                                                {headers.map(h => (
                                                    <option key={h} value={h}>{h}</option>
                                                ))}
                                            </select>
                                            <select
                                                {...register(`columnMapping.${idx}.type`)}
                                                className="w-24 px-2 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none"
                                            >
                                                <option value="string">String</option>
                                                <option value="number">Number</option>
                                                <option value="date">Date</option>
                                                <option value="boolean">Boolean</option>
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => removeMapping(idx)}
                                                className="p-2 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}

                                    {mappingFields.length === 0 && (
                                        <p className="text-center py-4 text-slate-400 text-sm">
                                            Belum ada mapping. Klik "Add Mapping" untuk menambahkan.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </form>

                        {/* Footer */}
                        <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10 bg-white/5">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-5 py-2.5 text-slate-300 hover:bg-white/10 rounded-xl transition-colors"
                            >
                                Batal
                            </button>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                type="submit"
                                disabled={isSubmitting}
                                onClick={handleSubmit(onSubmit)}
                                className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-medium shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-shadow disabled:opacity-50"
                            >
                                {isSubmitting ? 'Menyimpan...' : sheet ? 'Update' : 'Simpan'}
                            </motion.button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
