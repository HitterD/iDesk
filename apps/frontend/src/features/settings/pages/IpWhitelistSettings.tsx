import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Plus, Trash2, Edit2, Globe, X, Check, AlertTriangle, Loader2, Server, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
interface IpWhitelistEntry {
    id: string;
    name: string;
    ipAddress: string;
    type: 'SINGLE' | 'RANGE' | 'CIDR';
    scope: 'GLOBAL' | 'ADMIN_ONLY' | 'API';
    description?: string;
    isActive: boolean;
    hitCount: number;
    lastHitAt?: string;
    expiresAt?: string;
    createdAt: string;
    createdBy?: { fullName: string };
}

interface IpWhitelistStats {
    total: number;
    active: number;
    expired: number;
    topHits: { name: string; hitCount: number }[];
}

type IpType = 'SINGLE' | 'RANGE' | 'CIDR';
type IpScope = 'GLOBAL' | 'ADMIN_ONLY' | 'API';

const TYPE_CONFIG: Record<IpType, { label: string; example: string }> = {
    SINGLE: { label: 'Single IP', example: '192.168.1.100' },
    RANGE: { label: 'IP Range', example: '192.168.1.1-192.168.1.255' },
    CIDR: { label: 'CIDR Block', example: '192.168.1.0/24' },
};

const SCOPE_CONFIG: Record<IpScope, { label: string; color: string }> = {
    GLOBAL: { label: 'Global', color: 'bg-brand/15 text-brand' },
    ADMIN_ONLY: { label: 'Admin Only', color: 'bg-warn/15 text-warn-ink' },
    API: { label: 'API Access', color: 'bg-ok/15 text-ok-ink' },
};

export const IpWhitelistSettings: React.FC = () => {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState<IpWhitelistEntry | null>(null);
    const [testIp, setTestIp] = useState('');
    const [testResult, setTestResult] = useState<{ allowed: boolean; matchedRule?: string } | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        ipAddress: '',
        type: 'SINGLE' as IpType,
        scope: 'GLOBAL' as IpScope,
        description: '',
        isActive: true,
        expiresAt: '',
    });

    // Fetch entries
    const { data: entries = [], isLoading, refetch } = useQuery<IpWhitelistEntry[]>({
        queryKey: ['ip-whitelist'],
        queryFn: async () => {
            const res = await api.get('/ip-whitelist?includeInactive=true');
            return res.data;
        },
    });

    // Fetch stats
    const { data: stats } = useQuery<IpWhitelistStats>({
        queryKey: ['ip-whitelist-stats'],
        queryFn: async () => {
            const res = await api.get('/ip-whitelist/stats');
            return res.data;
        },
    });

    // Create mutation
    const createMutation = useMutation({
        mutationFn: async (data: typeof formData) => {
            const res = await api.post('/ip-whitelist', {
                ...data,
                expiresAt: data.expiresAt || null,
            });
            return res.data;
        },
        onSuccess: () => {
            toast.success('IP whitelist entry created');
            queryClient.invalidateQueries({ queryKey: ['ip-whitelist'] });
            queryClient.invalidateQueries({ queryKey: ['ip-whitelist-stats'] });
            closeModal();
        },
        onError: () => toast.error('Failed to create entry'),
    });

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
            const res = await api.patch(`/ip-whitelist/${id}`, {
                ...data,
                expiresAt: data.expiresAt || null,
            });
            return res.data;
        },
        onSuccess: () => {
            toast.success('Entry updated');
            queryClient.invalidateQueries({ queryKey: ['ip-whitelist'] });
            closeModal();
        },
        onError: () => toast.error('Failed to update entry'),
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/ip-whitelist/${id}`);
        },
        onSuccess: () => {
            toast.success('Entry deleted');
            queryClient.invalidateQueries({ queryKey: ['ip-whitelist'] });
            queryClient.invalidateQueries({ queryKey: ['ip-whitelist-stats'] });
        },
        onError: () => toast.error('Failed to delete entry'),
    });

    // Toggle active mutation
    const toggleMutation = useMutation({
        mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
            await api.patch(`/ip-whitelist/${id}`, { isActive });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ip-whitelist'] });
        },
    });

    // Test IP
    const handleTestIp = async () => {
        if (!testIp) return;
        try {
            const res = await api.get(`/ip-whitelist/test?ip=${testIp}`);
            setTestResult(res.data);
        } catch {
            toast.error('Failed to test IP');
        }
    };

    const openModal = (entry?: IpWhitelistEntry) => {
        if (entry) {
            setEditingEntry(entry);
            setFormData({
                name: entry.name,
                ipAddress: entry.ipAddress,
                type: entry.type,
                scope: entry.scope,
                description: entry.description || '',
                isActive: entry.isActive,
                expiresAt: entry.expiresAt ? entry.expiresAt.split('T')[0] : '',
            });
        } else {
            setEditingEntry(null);
            setFormData({
                name: '',
                ipAddress: '',
                type: 'SINGLE',
                scope: 'GLOBAL',
                description: '',
                isActive: true,
                expiresAt: '',
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingEntry(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingEntry) {
            updateMutation.mutate({ id: editingEntry.id, data: formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="min-w-0">
                    <h2 className="set-title">IP Whitelist</h2>
                    <p className="set-sub">Batasi akses agent/admin ke jaringan tertentu.</p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="idesk-btn is-primary"
                >
                    <Plus className="w-4 h-4" />
                    Add Rule
                </button>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="glass-card p-4 rounded-2xl">
                        <div className="text-sm text-ink-2 mb-1">Total Rules</div>
                        <div className="text-2xl font-bold text-ink">{stats.total}</div>
                    </div>
                    <div className="glass-card p-4 rounded-2xl">
                        <div className="text-sm text-ink-2 mb-1">Active</div>
                        <div className="text-2xl font-bold text-ok-ink">{stats.active}</div>
                    </div>
                    <div className="glass-card p-4 rounded-2xl">
                        <div className="text-sm text-ink-2 mb-1">Expired</div>
                        <div className="text-2xl font-bold text-bad">{stats.expired}</div>
                    </div>
                    <div className="glass-card p-4 rounded-2xl">
                        <div className="text-sm text-ink-2 mb-1">Mode</div>
                        <div className="text-lg font-bold text-ink">
                            {stats.total === 0 ? 'Open (Allow All)' : 'Whitelist'}
                        </div>
                    </div>
                </div>
            )}

            {/* IP Tester */}
            <div className="glass-card p-4 rounded-2xl">
                <h3 className="font-medium text-ink mb-3">Test IP Address</h3>
                <div className="flex gap-3">
                    <input
                        type="text"
                        placeholder="Enter IP to test (e.g., 192.168.1.100)"
                        value={testIp}
                        onChange={(e) => setTestIp(e.target.value)}
                        className="flex-1 px-4 py-2 bg-surface border border-line rounded-xl text-ink"
                    />
                    <button
                        onClick={handleTestIp}
                        className="idesk-btn is-soft"
                    >
                        Test
                    </button>
                </div>
                {testResult && (
                    <div className={cn(
                        "mt-3 p-3 rounded-xl flex items-center gap-2",
                        testResult.allowed ? "bg-ok/15 text-ok-ink" : "bg-bad/15 text-bad-ink"
                    )}>
                        {testResult.allowed ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                        <span>{testResult.allowed ? `Allowed: ${testResult.matchedRule}` : 'Not in whitelist'}</span>
                    </div>
                )}
            </div>

            {/* Entries Table */}
            <div className="glass-card rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-line flex items-center justify-between">
                    <h3 className="font-bold text-ink">Whitelist Rules</h3>
                    <button
                        onClick={() => refetch()}
                        className="p-2 hover:bg-fill rounded-lg transition-colors"
                    >
                        <RefreshCw className="w-4 h-4 text-ink-2" />
                    </button>
                </div>

                {isLoading ? (
                    <div className="p-8 text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                    </div>
                ) : entries.length === 0 ? (
                    <div className="p-8 text-center">
                        <Globe className="w-12 h-12 text-ink-3 mx-auto mb-3" />
                        <p className="text-ink-2 mb-2">No whitelist rules configured</p>
                        <p className="text-sm text-ink-3">All IP addresses are currently allowed</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-fill">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-ink-2 uppercase">Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-ink-2 uppercase">IP / Range</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-ink-2 uppercase">Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-ink-2 uppercase">Scope</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-ink-2 uppercase">Hits</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-ink-2 uppercase">Status</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-ink-2 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {entries.map((entry) => (
                                    <tr key={entry.id} className="hover:bg-fill">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-ink">{entry.name}</div>
                                            {entry.description && (
                                                <div className="text-xs text-ink-2 truncate max-w-[200px]">{entry.description}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <code className="px-2 py-1 bg-fill rounded text-sm font-mono text-ink">
                                                {entry.ipAddress}
                                            </code>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-ink-2">
                                            {TYPE_CONFIG[entry.type].label}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={cn("px-2 py-1 rounded-full text-xs font-medium", SCOPE_CONFIG[entry.scope].color)}>
                                                {SCOPE_CONFIG[entry.scope].label}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-ink-2">
                                            {entry.hitCount.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => toggleMutation.mutate({ id: entry.id, isActive: !entry.isActive })}
                                                className={cn(
                                                    "w-10 h-5 rounded-full transition-colors relative",
                                                    entry.isActive ? "bg-ok" : "bg-ink-3"
                                                )}
                                            >
                                                <div className={cn(
                                                    "w-4 h-4 bg-surface rounded-full absolute top-0.5 transition-transform",
                                                    entry.isActive ? "translate-x-5" : "translate-x-0.5"
                                                )} />
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => openModal(entry)}
                                                    className="p-1.5 hover:bg-fill rounded-lg transition-colors"
                                                >
                                                    <Edit2 className="w-4 h-4 text-ink-2" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (confirm('Delete this rule?')) {
                                                            deleteMutation.mutate(entry.id);
                                                        }
                                                    }}
                                                    className="p-1.5 hover:bg-bad/15 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4 text-bad" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Info Box */}
            <div className="bg-brand/10 border border-brand/30 rounded-2xl p-4">
                <div className="flex gap-3">
                    <Server className="w-5 h-5 text-brand shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-medium text-brand mb-1">How IP Whitelist Works</h4>
                        <ul className="text-sm text-brand space-y-1">
                            <li>• When no rules exist, all IPs are allowed (open mode)</li>
                            <li>• Add rules to restrict access to specific IPs only</li>
                            <li>• Supports single IPs, IP ranges, and CIDR notation</li>
                            <li>• Hit count tracks how many times each rule was matched</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-surface rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                        <div className="px-6 py-4 border-b border-line flex items-center justify-between">
                            <h3 className="font-bold text-ink">
                                {editingEntry ? 'Edit Rule' : 'Add Whitelist Rule'}
                            </h3>
                            <button onClick={closeModal} className="p-1 hover:bg-fill rounded-lg">
                                <X className="w-5 h-5 text-ink-2" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-ink mb-1">
                                    Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g., Office Network"
                                    className="w-full px-4 py-2 bg-surface border border-line rounded-xl"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-ink mb-1">
                                    Type
                                </label>
                                <select
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value as IpType })}
                                    className="w-full px-4 py-2 bg-surface border border-line rounded-xl"
                                >
                                    {Object.entries(TYPE_CONFIG).map(([key, config]) => (
                                        <option key={key} value={key}>{config.label} ({config.example})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-ink mb-1">
                                    IP Address *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.ipAddress}
                                    onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                                    placeholder={TYPE_CONFIG[formData.type].example}
                                    className="w-full px-4 py-2 bg-surface border border-line rounded-xl font-mono"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-ink mb-1">
                                    Scope
                                </label>
                                <select
                                    value={formData.scope}
                                    onChange={(e) => setFormData({ ...formData, scope: e.target.value as IpScope })}
                                    className="w-full px-4 py-2 bg-surface border border-line rounded-xl"
                                >
                                    {Object.entries(SCOPE_CONFIG).map(([key, config]) => (
                                        <option key={key} value={key}>{config.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-ink mb-1">
                                    Description
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Optional description..."
                                    rows={2}
                                    className="w-full px-4 py-2 bg-surface border border-line rounded-xl resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-ink mb-1">
                                    Expires At (optional)
                                </label>
                                <input
                                    type="date"
                                    value={formData.expiresAt}
                                    onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                                    className="w-full px-4 py-2 bg-surface border border-line rounded-xl"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    checked={formData.isActive}
                                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                    className="w-4 h-4 rounded border-line-strong"
                                />
                                <label htmlFor="isActive" className="text-sm text-ink">
                                    Enable this rule
                                </label>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="idesk-btn is-soft flex-1"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={createMutation.isPending || updateMutation.isPending}
                                    className="idesk-btn is-primary flex-1 disabled:opacity-50"
                                >
                                    {(createMutation.isPending || updateMutation.isPending) && (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    )}
                                    {editingEntry ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IpWhitelistSettings;
