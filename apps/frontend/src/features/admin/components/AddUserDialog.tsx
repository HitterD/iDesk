import React, { useEffect } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { PASSWORD_POLICY, getPasswordRequirements, validatePasswordLocal, passwordPolicyMessage } from '@/lib/passwordPolicy';



const createUserSchema = z.object({
    fullName: z.string().min(1, 'Full name is required'),
    email: z.string().email('Invalid email address'),
    role: z.enum(['ADMIN', 'MANAGER', 'AGENT', 'USER', 'AGENT_ORACLE', 'AGENT_ADMIN', 'AGENT_OPERATIONAL_SUPPORT']),
    departmentId: z.string().optional(),
    siteId: z.string().optional(),
    presetId: z.string().optional(), // P2: Permission preset
    autoGeneratePassword: z.boolean(),
    password: z.string().optional(),
}).refine((data) => {
    if (!data.autoGeneratePassword) {
        const r = validatePasswordLocal(data.password || '');
        if (!r.valid) return false;
    }
    return true;
}, {
    message: `Password minimal ${PASSWORD_POLICY.minLength} karakter — wajib huruf besar, huruf kecil, dan angka.`,
    path: ["password"],
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;

interface AddUserDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export const AddUserDialog: React.FC<AddUserDialogProps> = ({ isOpen, onClose }) => {
    const queryClient = useQueryClient();
    const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<CreateUserFormValues>({
        resolver: zodResolver(createUserSchema),
        defaultValues: {
            role: 'AGENT',
            autoGeneratePassword: true,
        },
    });

    const [isAddingDept, setIsAddingDept] = React.useState(false);
    const [newDeptName, setNewDeptName] = React.useState('');
    const [newDeptCode, setNewDeptCode] = React.useState('');

    const autoGeneratePassword = watch('autoGeneratePassword');

    const { data: departments = [] } = useQuery({
        queryKey: ['departments'],
        queryFn: async () => {
            const res = await api.get('/departments');
            return res.data;
        },
        enabled: isOpen,
    });

    // P2: Fetch permission presets for dropdown
    const { data: presets = [] } = useQuery({
        queryKey: ['permission-presets'],
        queryFn: async () => {
            const res = await api.get('/permissions/presets');
            return res.data;
        },
        enabled: isOpen,
    });

    // P3: Fetch sites for dropdown
    const { data: sites = [] } = useQuery({
        queryKey: ['sites-active'],
        queryFn: async () => {
            const res = await api.get('/sites/active');
            return res.data;
        },
        enabled: isOpen,
    });

    const createDeptMutation = useMutation({
        mutationFn: async (data: { name: string; code: string }) => {
            const res = await api.post('/departments', data);
            return res.data;
        },
        onSuccess: (newDept) => {
            toast.success('Department added successfully');
            queryClient.invalidateQueries({ queryKey: ['departments'] });
            setValue('departmentId', newDept.id);
            setIsAddingDept(false);
            setNewDeptName('');
            setNewDeptCode('');
        },
        onError: () => {
            toast.error('Failed to add department');
        }
    });

    const handleAddDept = () => {
        if (!newDeptName || !newDeptCode) return;
        createDeptMutation.mutate({ name: newDeptName, code: newDeptCode });
    };

    const createUserMutation = useMutation({
        mutationFn: async (data: CreateUserFormValues) => {
            await api.post('/users', data);
        },
        onSuccess: () => {
            toast.success('User created successfully');
            queryClient.invalidateQueries({ queryKey: ['users'] });
            onClose();
            reset();
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to create user');
        },
    });

    const onSubmit: SubmitHandler<CreateUserFormValues> = (data) => {
        createUserMutation.mutate(data);
    };

    useEffect(() => {
        if (isOpen) {
            reset();
        }
    }, [isOpen, reset]);

    // Auto-select preset matching selected role
    const watchedRole = watch('role');
    const watchedPresetId = watch('presetId');

    useEffect(() => {
        if (!watchedRole || !presets.length) return;
        const presetTargetRole = watchedRole?.startsWith('AGENT_') ? 'AGENT' : watchedRole;
        const match = presets.find((preset: any) =>
            watchedRole === 'AGENT_ORACLE' ? preset.name === 'Agent Oracle'
                : watchedRole === 'AGENT_OPERATIONAL_SUPPORT' ? preset.name === 'Agent Operational Support'
                : preset.targetRole === presetTargetRole,
        );
        if (match) {
            setValue('presetId', match.id);
        }
    }, [watchedRole, presets, setValue]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-[hsl(var(--card))] border-[hsl(var(--border))] text-slate-800 dark:text-white sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>Add New User</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="fullName" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Full Name</Label>
                        <Input
                            id="fullName"
                            placeholder="John Doe"
                            {...register('fullName')}
                            className="bg-slate-50 dark:bg-slate-800/50 border-[hsl(var(--border))] text-slate-800 dark:text-white placeholder:text-slate-400 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none"
                        />
                        {errors.fullName && <p className="text-red-500 text-xs">{errors.fullName.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="john@example.com"
                            {...register('email')}
                            className="bg-slate-50 dark:bg-slate-800/50 border-[hsl(var(--border))] text-slate-800 dark:text-white placeholder:text-slate-400 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none"
                        />
                        {errors.email && <p className="text-red-500 text-xs">{errors.email.message}</p>}
                    </div>

                    {/* P2-1: Stacked layout instead of cramped side-by-side */}
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Role <span className="text-red-400">*</span></Label>
                        <Select onValueChange={(val: any) => setValue('role', val)} defaultValue="AGENT">
                            <SelectTrigger className="bg-slate-50 dark:bg-slate-800/50 border-[hsl(var(--border))] text-slate-800 dark:text-white rounded-xl focus:ring-2 focus:ring-primary/50 outline-none">
                                <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent className="bg-[hsl(var(--card))] border-[hsl(var(--border))] text-slate-800 dark:text-white">
                                <SelectItem value="ADMIN">Admin</SelectItem>
                                <SelectItem value="MANAGER">Manager</SelectItem>
                                <SelectItem value="AGENT">Agent</SelectItem>
                                <SelectItem value="AGENT_ADMIN">Agent Admin</SelectItem>
                                <SelectItem value="AGENT_ORACLE">Agent Oracle</SelectItem>
                                <SelectItem value="AGENT_OPERATIONAL_SUPPORT">Agent Ops Support</SelectItem>
                                <SelectItem value="USER">User</SelectItem>
                            </SelectContent>
                        </Select>
                        {errors.role && <p className="text-red-500 text-xs">{errors.role.message}</p>}
                    </div>

                    {/* P2: Permission Preset Dropdown */}
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Permission Preset</Label>
                        <Select value={watchedPresetId || ''} onValueChange={(val) => setValue('presetId', val)}>
                            <SelectTrigger className="bg-slate-50 dark:bg-slate-800/50 border-[hsl(var(--border))] text-slate-800 dark:text-white rounded-xl focus:ring-2 focus:ring-primary/50 outline-none">
                                <SelectValue placeholder="Select preset (optional)" />
                            </SelectTrigger>
                            <SelectContent className="bg-[hsl(var(--card))] border-[hsl(var(--border))] text-slate-800 dark:text-white">
                                {presets.map((preset: any) => (
                                    <SelectItem key={preset.id} value={preset.id}>
                                        {preset.name} ({preset.targetRole || 'Any'})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-slate-500">Determines which pages user can access</p>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Department</Label>
                            <button
                                type="button"
                                onClick={() => setIsAddingDept(!isAddingDept)}
                                className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                                {isAddingDept ? 'Cancel' : '+ Add New'}
                            </button>
                        </div>
                        {isAddingDept ? (
                            <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-[hsl(var(--border))]">
                                <Input
                                    placeholder="Department Name (e.g. IT Support)"
                                    value={newDeptName}
                                    onChange={(e) => setNewDeptName(e.target.value)}
                                    className="bg-white dark:bg-slate-900 border-[hsl(var(--border))] rounded-lg"
                                />
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Code (e.g. IT)"
                                        value={newDeptCode}
                                        onChange={(e) => setNewDeptCode(e.target.value)}
                                        className="bg-white dark:bg-slate-900 border-[hsl(var(--border))] rounded-lg"
                                    />
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={handleAddDept}
                                        disabled={createDeptMutation.isPending}
                                        className="bg-primary text-white hover:bg-primary/90"
                                    >
                                        {createDeptMutation.isPending ? 'Adding...' : 'Add'}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <Select onValueChange={(val) => setValue('departmentId', val)}>
                                <SelectTrigger className="bg-slate-50 dark:bg-slate-800/50 border-[hsl(var(--border))] text-slate-800 dark:text-white rounded-xl focus:ring-2 focus:ring-primary/50 outline-none">
                                    <SelectValue placeholder="Select department" />
                                </SelectTrigger>
                                <SelectContent className="bg-[hsl(var(--card))] border-[hsl(var(--border))] text-slate-800 dark:text-white">
                                    {departments.map((dept: any) => (
                                        <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    {/* Site Selector */}
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Site</Label>
                        <Select onValueChange={(val) => setValue('siteId', val)}>
                            <SelectTrigger className="bg-slate-50 dark:bg-slate-800/50 border-[hsl(var(--border))] text-slate-800 dark:text-white rounded-xl focus:ring-2 focus:ring-primary/50 outline-none">
                                <SelectValue placeholder="Select site" />
                            </SelectTrigger>
                            <SelectContent className="bg-[hsl(var(--card))] border-[hsl(var(--border))] text-slate-800 dark:text-white">
                                {sites.map((site: any) => (
                                    <SelectItem key={site.id} value={site.id}>{site.code} - {site.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-4 border-t border-[hsl(var(--border))] pt-4">
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="autoGenerate"
                                checked={autoGeneratePassword}
                                onCheckedChange={(checked: boolean) => setValue('autoGeneratePassword', checked)}
                            />
                            <Label htmlFor="autoGenerate" className="text-sm font-normal cursor-pointer text-slate-700 dark:text-slate-300">
                                Auto-generate secure password
                            </Label>
                        </div>

                        {!autoGeneratePassword && (
                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    {...register('password')}
                                    className="bg-slate-50 dark:bg-slate-800/50 border-[hsl(var(--border))] text-slate-800 dark:text-white placeholder:text-slate-400 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none"
                                />
                                {errors.password && <p className="text-red-500 text-xs">{errors.password.message}</p>}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={onClose} className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white">
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-primary text-white hover:bg-primary/90" disabled={createUserMutation.isPending}>
                            {createUserMutation.isPending ? 'Creating...' : 'Create User'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
