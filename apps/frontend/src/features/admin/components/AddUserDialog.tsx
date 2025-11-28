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

const createUserSchema = z.object({
    fullName: z.string().min(1, 'Full name is required'),
    email: z.string().email('Invalid email address'),
    role: z.enum(['ADMIN', 'AGENT', 'USER']),
    departmentId: z.string().optional(),
    autoGeneratePassword: z.boolean(),
    password: z.string().optional(),
}).refine((data) => {
    if (!data.autoGeneratePassword && (!data.password || data.password.length < 6)) {
        return false;
    }
    return true;
}, {
    message: "Password must be at least 6 characters if not auto-generated",
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

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-navy-light border-white/10 text-white sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add New User</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="fullName">Full Name</Label>
                        <Input
                            id="fullName"
                            placeholder="John Doe"
                            {...register('fullName')}
                            className="bg-white/5 border-white/10 text-white"
                        />
                        {errors.fullName && <p className="text-red-500 text-xs">{errors.fullName.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="john@example.com"
                            {...register('email')}
                            className="bg-white/5 border-white/10 text-white"
                        />
                        {errors.email && <p className="text-red-500 text-xs">{errors.email.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Role</Label>
                            <Select onValueChange={(val: any) => setValue('role', val)} defaultValue="AGENT">
                                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                    <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent className="bg-navy-main border-white/10 text-white">
                                    <SelectItem value="AGENT">Agent</SelectItem>
                                    <SelectItem value="ADMIN">Admin</SelectItem>
                                    <SelectItem value="USER">User</SelectItem>
                                </SelectContent>
                            </Select>
                            {errors.role && <p className="text-red-500 text-xs">{errors.role.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label>Department</Label>
                                <button
                                    type="button"
                                    onClick={() => setIsAddingDept(!isAddingDept)}
                                    className="text-xs text-neon-green hover:underline"
                                >
                                    {isAddingDept ? 'Cancel' : '+ Add New'}
                                </button>
                            </div>
                            {isAddingDept ? (
                                <div className="space-y-2 p-2 bg-white/5 rounded-lg border border-white/10">
                                    <Input
                                        placeholder="Dept Name (e.g. IT)"
                                        value={newDeptName}
                                        onChange={(e) => setNewDeptName(e.target.value)}
                                        className="h-8 text-xs bg-black/20 border-white/10"
                                    />
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="Code (e.g. IT)"
                                            value={newDeptCode}
                                            onChange={(e) => setNewDeptCode(e.target.value)}
                                            className="h-8 text-xs bg-black/20 border-white/10"
                                        />
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={handleAddDept}
                                            disabled={createDeptMutation.isPending}
                                            className="h-8 bg-neon-green text-navy-dark hover:bg-neon-green/90"
                                        >
                                            Add
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <Select onValueChange={(val) => setValue('departmentId', val)}>
                                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                        <SelectValue placeholder="Select dept" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-navy-main border-white/10 text-white">
                                        {departments.map((dept: any) => (
                                            <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4 border-t border-white/10 pt-4">
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="autoGenerate"
                                checked={autoGeneratePassword}
                                onCheckedChange={(checked: boolean) => setValue('autoGeneratePassword', checked)}
                            />
                            <Label htmlFor="autoGenerate" className="text-sm font-normal cursor-pointer">
                                Auto-generate secure password
                            </Label>
                        </div>

                        {!autoGeneratePassword && (
                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    {...register('password')}
                                    className="bg-white/5 border-white/10 text-white"
                                />
                                {errors.password && <p className="text-red-500 text-xs">{errors.password.message}</p>}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={onClose} className="text-slate-400 hover:text-white">
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-neon-green text-navy-dark hover:bg-neon-green/90" disabled={createUserMutation.isPending}>
                            {createUserMutation.isPending ? 'Creating...' : 'Create User'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
