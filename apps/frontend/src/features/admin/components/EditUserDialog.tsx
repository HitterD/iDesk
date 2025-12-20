import React, { useState, useEffect } from 'react';
import { X, User, Mail, Building, Shield, Phone, Briefcase, Save, ToggleLeft, ToggleRight, MapPin, Key, Sparkles } from 'lucide-react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { usePermissionPresets } from '@/hooks/usePermissions';

const SITES = [
    { id: 'SPJ', code: 'SPJ', name: 'Sepanjang' },
    { id: 'SMG', code: 'SMG', name: 'Semarang' },
    { id: 'KRW', code: 'KRW', name: 'Karawang' },
    { id: 'JTB', code: 'JTB', name: 'Jatibaru' },
];

interface EditUserDialogProps {
    isOpen: boolean;
    onClose: () => void;
    user: {
        id: string;
        fullName: string;
        email: string;
        role: 'ADMIN' | 'MANAGER' | 'AGENT' | 'USER';
        department?: { id: string; name: string };
        site?: { id: string; code: string; name: string };
        siteId?: string;
        employeeId?: string;
        jobTitle?: string;
        phoneNumber?: string;
        isActive?: boolean;
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
        role: 'AGENT' as 'ADMIN' | 'MANAGER' | 'AGENT' | 'USER',
        departmentId: '',
        siteId: '',
        employeeId: '',
        jobTitle: '',
        phoneNumber: '',
        isActive: true,
    });
    const [selectedPresetId, setSelectedPresetId] = useState<string>('');

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
            return res.data;
        },
        onSuccess: () => {
            toast.success('Permission preset applied successfully');
            queryClient.invalidateQueries({ queryKey: ['user-permissions', user?.id] });
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <User className="w-5 h-5 text-primary" />
                        Edit User
                    </h2>
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
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none transition-all"
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
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none transition-all"
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
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none transition-all appearance-none"
                                >
                                    <option value="ADMIN">Admin</option>
                                    <option value="AGENT">Agent</option>
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
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none transition-all appearance-none"
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
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none transition-all appearance-none"
                            >
                                <option value="">No Site Assigned</option>
                                {SITES.map((site) => (
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
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none transition-all"
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
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                                    placeholder="+62..."
                                />
                            </div>
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
                            <div className="flex items-center gap-2 mb-3">
                                <Key className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                                <p className="font-medium text-slate-800 dark:text-white">Permission Preset</p>
                            </div>
                            <div className="flex gap-2">
                                <select
                                    value={selectedPresetId}
                                    onChange={(e) => setSelectedPresetId(e.target.value)}
                                    className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-violet-200 dark:border-violet-700 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 outline-none"
                                >
                                    <option value="">Select a preset...</option>
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
