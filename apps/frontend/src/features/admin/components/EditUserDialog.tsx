import React, { useState, useEffect } from 'react';
import { X, User, Mail, Building, Shield, Phone, Briefcase, Save, ToggleLeft, ToggleRight, MapPin, Key, Sparkles, CheckCircle, Hash } from 'lucide-react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { usePermissionPresets } from '@/hooks/usePermissions';

const AVATAR_COLORS = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-amber-500',
    'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500'
];
const getAvatarColor = (name: string) => {
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

interface EditUserDialogProps {
    isOpen: boolean;
    onClose: () => void;
    user: {
        id: string;
        fullName: string;
        email: string;
        role: 'ADMIN' | 'MANAGER' | 'AGENT' | 'USER' | 'AGENT_ORACLE' | 'AGENT_ADMIN' | 'AGENT_OPERATIONAL_SUPPORT';
        department?: { id: string; name: string };
        site?: { id: string; code: string; name: string };
        siteId?: string;
        employeeId?: string;
        jobTitle?: string;
        phoneNumber?: string;
        isActive?: boolean;
        appliedPresetId?: string | null;
        appliedPresetName?: string | null;
    } | null;
}

interface Department {
    id: string;
    name: string;
}

export const EditUserDialog: React.FC<EditUserDialogProps> = ({ isOpen, onClose, user }) => {
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        role: 'AGENT' as 'ADMIN' | 'MANAGER' | 'AGENT' | 'USER' | 'AGENT_ORACLE' | 'AGENT_ADMIN' | 'AGENT_OPERATIONAL_SUPPORT',
        departmentId: '',
        siteId: '',
        employeeId: '',
        jobTitle: '',
        phoneNumber: '',
        isActive: true,
    });
    const [selectedPresetId, setSelectedPresetId] = useState<string>('');

    // Fetch sites from API (dynamic, not hardcoded)
    const { data: sitesData = [] } = useQuery<{ id: string; code: string; name: string }[]>({
        queryKey: ['sites-active'],
        queryFn: async () => {
            const res = await api.get('/sites/active');
            return res.data;
        },
        staleTime: 5 * 60 * 1000,
        enabled: isOpen,
    });

    // Fetch departments
    const { data: departments = [] } = useQuery<Department[]>({
        queryKey: ['departments'],
        queryFn: async () => {
            const res = await api.get('/departments');
            return res.data;
        },
    });

    // H4: Fetch permission presets
    const { data: presets = [] } = usePermissionPresets();

    // Fetch user's current applied preset
    const { data: userPermissionData } = useQuery<{
        appliedPreset: { presetId: string | null; presetName: string | null };
    }>({
        queryKey: ['user-permissions', user?.id],
        queryFn: async () => {
            const res = await api.get(`/permissions/users/${user?.id}`);
            return res.data;
        },
        enabled: !!user?.id && isOpen,
    });

    // Track current applied preset name (from API or after applying)
    const [currentPresetName, setCurrentPresetName] = useState<string | null>(null);

    // STEP 1: Reset all preset state immediately when user changes (prevents stale state)
    useEffect(() => {
        // Reset to user's known preset (instant, from user object)
        setCurrentPresetName(user?.appliedPresetName || null);
        // Pre-select dropdown with current preset ID so user can see it selected
        setSelectedPresetId(user?.appliedPresetId || '');
    }, [user?.id]); // Only re-run when user ID changes, not every render

    // STEP 1b: Fallback — if appliedPresetName is null but appliedPresetId exists,
    // lookup name from presets list (handles old DB records before appliedPresetName column was added)
    useEffect(() => {
        if (user?.appliedPresetId && !currentPresetName && presets.length > 0) {
            const found = presets.find(p => p.id === user.appliedPresetId);
            if (found) setCurrentPresetName(found.name);
        }
    }, [user?.appliedPresetId, presets, currentPresetName]);

    // STEP 2: Override with fresh data from /permissions/users/:id API
    useEffect(() => {
        if (!userPermissionData) return;
        const preset = userPermissionData.appliedPreset;
        if (preset?.presetName) {
            setCurrentPresetName(preset.presetName);
        } else {
            setCurrentPresetName(null);
        }
    }, [userPermissionData]);

    useEffect(() => {
        if (user) {
            setFormData({
                fullName: user.fullName || '',
                email: user.email || '',
                role: user.role || 'AGENT',
                departmentId: user.department?.id || '',
                siteId: user.site?.id || user.siteId || '',
                employeeId: user.employeeId || '',
                jobTitle: user.jobTitle || '',
                phoneNumber: user.phoneNumber || '',
                isActive: user.isActive !== false,
            });
        }
    }, [user]);

    const updateMutation = useMutation({
        mutationFn: async (data: typeof formData) => {
            const res = await api.patch(`/users/${user?.id}`, data);
            return res.data;
        },
        onSuccess: () => {
            toast.success('User updated successfully');
            queryClient.invalidateQueries({ queryKey: ['users'] });
            onClose();
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to update user');
        },
    });

    // H4: Apply permission preset mutation
    const applyPresetMutation = useMutation({
        mutationFn: async (presetId: string) => {
            const res = await api.post(`/permissions/users/${user?.id}/preset/${presetId}`);
            return res.data as { applied: boolean; presetName: string };
        },
        onSuccess: (data, variables) => {
            const presetId = variables;

            // Get preset name: first try backend response, then local lookup
            let presetName = data?.presetName;
            if (!presetName) {
                const foundPreset = presets.find(p => p.id === presetId);
                presetName = foundPreset?.name || 'Unknown Preset';
            }

            setCurrentPresetName(presetName);
            toast.success(`Preset "${presetName}" applied successfully`);

            // Invalidate queries to refetch updated data
            queryClient.invalidateQueries({ queryKey: ['user-permissions', user?.id] });
            queryClient.invalidateQueries({ queryKey: ['my-permissions'] });
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setSelectedPresetId('');
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to apply preset');
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateMutation.mutate(formData);
    };

    if (!isOpen || !user) return null;

    const avatarColor = getAvatarColor(formData.fullName || user.fullName);
    const initial = (formData.fullName || user.fullName).charAt(0).toUpperCase();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header with Avatar Preview */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg text-white flex-shrink-0",
                            avatarColor
                        )}>
                            {initial}
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 dark:text-white">Edit User</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Full Name */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Full Name</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={formData.fullName}
                                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none transition-colors duration-150"
                                required
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none transition-colors duration-150"
                                required
                            />
                        </div>
                    </div>

                    {/* Role & Department */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Role</label>
                            <div className="relative">
                                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none transition-colors duration-150 appearance-none"
                                >
                                    <option value="ADMIN">Admin</option>
                                    <option value="MANAGER">Manager</option>
                                    <option value="AGENT">Agent</option>
                                    <option value="AGENT_ADMIN">Agent Admin</option>
                                    <option value="AGENT_ORACLE">Agent Oracle</option>
                                    <option value="AGENT_OPERATIONAL_SUPPORT">Agent Ops Support</option>
                                    <option value="USER">User</option>
                                </select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Department</label>
                            <div className="relative">
                                <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <select
                                    value={formData.departmentId}
                                    onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none transition-colors duration-150 appearance-none"
                                >
                                    <option value="">No Department</option>
                                    {departments.map((dept) => (
                                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Site */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Site</label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <select
                                value={formData.siteId}
                                onChange={(e) => setFormData({ ...formData, siteId: e.target.value })}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none transition-colors duration-150 appearance-none"
                            >
                                <option value="">No Site Assigned</option>
                                {sitesData.map((site) => (
                                    <option key={site.id} value={site.id}>{site.code} - {site.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Job Title & Employee ID */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Job Title</label>
                            <div className="relative">
                                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    value={formData.jobTitle}
                                    onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none transition-colors duration-150"
                                    placeholder="e.g. Support Agent"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Phone</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="tel"
                                    value={formData.phoneNumber}
                                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none transition-colors duration-150"
                                    placeholder="+62..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Employee ID */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Employee ID</label>
                        <div className="relative">
                            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={formData.employeeId}
                                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none transition-colors duration-150"
                                placeholder="e.g. EMP001"
                            />
                        </div>
                    </div>

                    {/* Active Status Toggle */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div>
                            <p className="font-medium text-slate-800 dark:text-white">Account Status</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {formData.isActive ? 'User can login' : 'User cannot login'}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors",
                                formData.isActive
                                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            )}
                        >
                            {formData.isActive ? (
                                <><ToggleRight className="w-5 h-5" /> Active</>
                            ) : (
                                <><ToggleLeft className="w-5 h-5" /> Inactive</>
                            )}
                        </button>
                    </div>

                    {/* H4: Permission Preset Selector */}
                    {formData.role !== 'ADMIN' && (
                        <div className="p-4 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 rounded-xl border border-violet-200 dark:border-violet-800">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Key className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                                    <p className="font-medium text-slate-800 dark:text-white">Permission Preset</p>
                                </div>
                                {/* Current Applied Preset Badge - always visible */}
                                {currentPresetName ? (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg text-xs font-medium">
                                        <CheckCircle className="w-3.5 h-3.5" />
                                        <span>{currentPresetName}</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-lg text-xs font-medium">
                                        <span>No Preset</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <select
                                    value={selectedPresetId}
                                    onChange={(e) => setSelectedPresetId(e.target.value)}
                                    className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-violet-200 dark:border-violet-700 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 outline-none"
                                >
                                    <option value="">{currentPresetName ? 'Change preset...' : 'Select a preset...'}</option>
                                    {presets.map((preset) => (
                                        <option key={preset.id} value={preset.id}>
                                            {preset.name} {preset.isDefault && '(Default)'}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={() => selectedPresetId && applyPresetMutation.mutate(selectedPresetId)}
                                    disabled={!selectedPresetId || applyPresetMutation.isPending}
                                    className="px-4 py-2 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                                >
                                    {applyPresetMutation.isPending ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <Sparkles className="w-4 h-4" />
                                    )}
                                    Apply
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                                Presets define what features this user can access
                            </p>
                        </div>
                    )}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={updateMutation.isPending}
                            className="flex-1 px-4 py-3 bg-primary text-slate-900 font-bold rounded-xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {updateMutation.isPending ? (
                                <div className="w-5 h-5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                            ) : (
                                <><Save className="w-4 h-4" /> Save Changes</>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
