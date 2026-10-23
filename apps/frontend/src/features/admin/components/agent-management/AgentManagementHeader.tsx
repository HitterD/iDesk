import { CheckSquare, ChevronDown, Shield, MapPin, BarChart3, Trash2, Download, Upload, Layers, UserPlus, Sparkles, RefreshCw, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResHead } from '@/components/resources/ResourceParts';
import '@/components/management/management.css';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';

interface AgentManagementHeaderProps {
    selectedCount: number;
    onBulkRoleChange: () => void;
    onBulkSiteChange: () => void;
    onBulkPreset: () => void;
    onCompare: () => void;
    onBulkDelete: () => void;
    onExport: () => void;
    onImport: () => void;
    onSyncSjatr?: () => void;
    isSyncing?: boolean;
    onManagePresets: () => void;
    onAddUser: () => void;
}

export function AgentManagementHeader({
    selectedCount,
    onBulkRoleChange,
    onBulkSiteChange,
    onBulkPreset,
    onCompare,
    onBulkDelete,
    onExport,
    onImport,
    onSyncSjatr,
    isSyncing = false,
    onManagePresets,
    onAddUser,
}: AgentManagementHeaderProps) {
    return (
        <ResHead icon={Users} tone="navy" title="Agent Management" description="Kelola tim support berdasarkan site dan role"
            actions={(
                <>
                    {/* Bulk actions appear only when users are selected */}
                    {selectedCount > 0 && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="primary" aria-label={`Bulk actions for ${selectedCount} selected ${selectedCount === 1 ? 'user' : 'users'}`}>
                                    <CheckSquare aria-hidden="true" />
                                    {selectedCount} Selected
                                    <ChevronDown aria-hidden="true" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={onBulkRoleChange}><Shield className="w-4 h-4" aria-hidden="true" />Change Role</DropdownMenuItem>
                                <DropdownMenuItem onClick={onBulkSiteChange}><MapPin className="w-4 h-4" aria-hidden="true" />Change Site</DropdownMenuItem>
                                <DropdownMenuItem onClick={onBulkPreset}><Sparkles className="w-4 h-4" aria-hidden="true" />Apply Preset</DropdownMenuItem>
                                {selectedCount === 2 && (
                                    <DropdownMenuItem onClick={onCompare}><BarChart3 className="w-4 h-4" aria-hidden="true" />Compare Agents</DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={onBulkDelete} variant="destructive"><Trash2 className="w-4 h-4" aria-hidden="true" />Delete Selected</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                    {onSyncSjatr && (
                        <Button variant="soft" onClick={onSyncSjatr} loading={isSyncing} aria-label="Sinkronisasi data user dari SJATR">
                            {!isSyncing && <RefreshCw aria-hidden="true" />}<span className="mg-hide-sm">Sync SJATR</span>
                        </Button>
                    )}
                    <Button variant="soft" onClick={onManagePresets} title="Manage Permission Presets" aria-label="Manage Permission Presets">
                        <Layers aria-hidden="true" /><span className="mg-hide-sm">Manage Presets</span>
                    </Button>
                    <Button variant="soft" onClick={onImport} aria-label="Import users"><Upload aria-hidden="true" /><span className="mg-hide-sm">Import</span></Button>
                    <Button variant="soft" onClick={onExport} aria-label="Export users"><Download aria-hidden="true" /><span className="mg-hide-sm">Export</span></Button>
                    <Button variant="primary" onClick={onAddUser}><UserPlus aria-hidden="true" />Add User</Button>
                </>
            )} />
    );
}
