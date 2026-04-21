import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    Plus,
    Zap,
    Pause,
    Pencil,
    Trash2,
    Copy,
    MoreHorizontal,
    Clock,
    CheckCircle,
    XCircle,
    ChevronRight,
    Sparkles,
    Target,
    ArrowRight,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { RuleBuilder } from './RuleBuilder';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

// Trigger type labels
const TRIGGER_LABELS: Record<string, { label: string; icon: typeof Zap; color: string }> = {
    TICKET_CREATED: { label: 'Ticket Created', icon: Plus, color: 'text-green-500' },
    TICKET_UPDATED: { label: 'Ticket Updated', icon: Pencil, color: 'text-blue-500' },
    STATUS_CHANGED: { label: 'Status Changed', icon: ArrowRight, color: 'text-purple-500' },
    PRIORITY_CHANGED: { label: 'Priority Changed', icon: Target, color: 'text-orange-500' },
    ASSIGNMENT_CHANGED: { label: 'Assignment Changed', icon: Zap, color: 'text-cyan-500' },
    MESSAGE_RECEIVED: { label: 'Message Received', icon: ChevronRight, color: 'text-indigo-500' },
    SLA_BREACH_IMMINENT: { label: 'SLA Warning', icon: Clock, color: 'text-amber-500' },
    SLA_BREACHED: { label: 'SLA Breached', icon: XCircle, color: 'text-red-500' },
    TICKET_IDLE: { label: 'Ticket Idle', icon: Pause, color: 'text-slate-500' },
};

// Action type labels
const ACTION_LABELS: Record<string, string> = {
    CHANGE_STATUS: 'Change Status',
    CHANGE_PRIORITY: 'Change Priority',
    CHANGE_ASSIGNEE: 'Assign Ticket',
    ADD_INTERNAL_NOTE: 'Add Note',
    SEND_NOTIFICATION: 'Send Notification',
    SEND_WEBHOOK: 'Send Webhook',
};

interface WorkflowRule {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
    priority: number;
    trigger: { type: string; config?: any };
    conditions: any[];
    conditionLogic?: 'AND' | 'OR';
    actions: any[];
    executionCount: number;
    lastExecutedAt: string | null;
    createdBy: { id: string; fullName: string } | null;
    createdAt: string;
}

interface WorkflowTemplate {
    id: string;
    name: string;
    description: string;
    category: string;
    rule: any;
}

export const AutomationRulesPage = () => {
    const queryClient = useQueryClient();
    const [showTemplates, setShowTemplates] = useState(false);
    const [editingRule, setEditingRule] = useState<WorkflowRule | null>(null);
    const [showRuleBuilder, setShowRuleBuilder] = useState(false);

    // Fetch rules
    const { data: rules = [], isLoading } = useQuery<WorkflowRule[]>({
        queryKey: ['automation-rules'],
        queryFn: async () => {
            const res = await api.get('/automation/rules');
            return res.data;
        },
    });

    // Fetch templates
    const { data: templates = [] } = useQuery<WorkflowTemplate[]>({
        queryKey: ['automation-templates'],
        queryFn: async () => {
            const res = await api.get('/automation/templates');
            return res.data;
        },
    });

    // Toggle active mutation
    const toggleMutation = useMutation({
        mutationFn: async (ruleId: string) => {
            const res = await api.patch(`/automation/rules/${ruleId}/toggle`);
            return res.data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
            toast.success(`Rule ${data.isActive ? 'enabled' : 'disabled'}`);
        },
        onError: () => {
            toast.error('Failed to toggle rule');
        },
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async (ruleId: string) => {
            await api.delete(`/automation/rules/${ruleId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
            toast.success('Rule deleted');
        },
        onError: () => {
            toast.error('Failed to delete rule');
        },
    });

    // Create from template mutation
    const createFromTemplateMutation = useMutation({
        mutationFn: async (templateId: string) => {
            const res = await api.post('/automation/rules/from-template', { templateId });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
            toast.success('Rule created from template');
            setShowTemplates(false);
        },
        onError: () => {
            toast.error('Failed to create rule');
        },
    });

    const handleDelete = (rule: WorkflowRule) => {
        if (window.confirm(`Delete rule "${rule.name}"? This cannot be undone.`)) {
            deleteMutation.mutate(rule.id);
        }
    };

    const handleCreateNew = () => {
        setEditingRule(null);
        setShowRuleBuilder(true);
    };

    const handleEditRule = (rule: WorkflowRule) => {
        setEditingRule(rule);
        setShowRuleBuilder(true);
    };

    const handleCloseBuilder = () => {
        setShowRuleBuilder(false);
        setEditingRule(null);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6 animate-fade-in-up">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                        <Zap className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Automation Rules</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {rules.length} rule{rules.length !== 1 ? 's' : ''} • {rules.filter(r => r.isActive).length} active
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowTemplates(true)}
                        className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
                    >
                        <Sparkles className="w-4 h-4" />
                        Templates
                    </button>
                    <button
                        onClick={handleCreateNew}
                        className="px-4 py-2.5 bg-primary text-slate-900 rounded-xl font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-md"
                    >
                        <Plus className="w-4 h-4" />
                        Create Rule
                    </button>
                </div>
            </div>

            {/* Rules List */}
            {rules.length === 0 ? (
                <div className="glass-card p-12 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-200 dark:from-violet-900/30 dark:to-purple-800/30 mx-auto mb-4 flex items-center justify-center">
                        <Zap className="w-8 h-8 text-violet-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">No automation rules yet</h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-4">
                        Create rules to automate ticket handling
                    </p>
                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={() => setShowTemplates(true)}
                            className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            Start with Template
                        </button>
                        <button
                            onClick={handleCreateNew}
                            className="px-4 py-2 bg-primary text-slate-900 rounded-lg font-medium hover:bg-primary/90 transition-colors"
                        >
                            Create from Scratch
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    {rules.map((rule, index) => {
                        const triggerInfo = TRIGGER_LABELS[rule.trigger.type] || { label: rule.trigger.type, icon: Zap, color: 'text-slate-500' };
                        const TriggerIcon = triggerInfo.icon;

                        return (
                            <div
                                key={rule.id}
                                className={cn(
                                    "glass-card p-4 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out hover:shadow-lg cursor-pointer hover-lift",
                                    !rule.isActive && "opacity-60"
                                )}
                                onClick={() => handleEditRule(rule)}
                            >
                                <div className="flex items-center gap-4">
                                    {/* Priority number */}
                                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-sm font-medium text-slate-500">
                                        {index + 1}
                                    </div>

                                    {/* Active toggle */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleMutation.mutate(rule.id);
                                        }}
                                        disabled={toggleMutation.isPending}
                                        className={cn(
                                            "w-12 h-6 rounded-full transition-colors relative",
                                            rule.isActive
                                                ? "bg-green-500"
                                                : "bg-slate-300 dark:bg-slate-600"
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                "absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform",
                                                rule.isActive ? "left-7" : "left-1"
                                            )}
                                        />
                                    </button>

                                    {/* Rule info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-slate-800 dark:text-white truncate">
                                                {rule.name}
                                            </h3>
                                            {rule.isActive && (
                                                <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full">
                                                    Active
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 mt-1 text-sm">
                                            <div className={cn("flex items-center gap-1", triggerInfo.color)}>
                                                <TriggerIcon className="w-3.5 h-3.5" />
                                                <span>{triggerInfo.label}</span>
                                            </div>
                                            {rule.conditions.length > 0 && (
                                                <>
                                                    <span className="text-slate-400">|</span>
                                                    <span className="text-slate-500 dark:text-slate-400">
                                                        {rule.conditions.length} condition{rule.conditions.length > 1 ? 's' : ''}
                                                    </span>
                                                </>
                                            )}
                                            <span className="text-slate-400 dark:text-slate-500">→</span>
                                            <span className="text-slate-500 dark:text-slate-400">
                                                {rule.actions.map(a => ACTION_LABELS[a.type] || a.type).join(', ')}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Stats */}
                                    <div className="hidden md:flex items-center gap-6 text-sm text-slate-500 dark:text-slate-400">
                                        <div className="flex items-center gap-1">
                                            <CheckCircle className="w-4 h-4" />
                                            <span>{rule.executionCount} runs</span>
                                        </div>
                                        {rule.lastExecutedAt && (
                                            <div className="flex items-center gap-1">
                                                <Clock className="w-4 h-4" />
                                                <span>
                                                    {new Date(rule.lastExecutedAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button
                                                onClick={(e) => e.stopPropagation()}
                                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                            >
                                                <MoreHorizontal className="w-5 h-5 text-slate-500" />
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handleEditRule(rule)}>
                                                <Pencil className="w-4 h-4 mr-2" />
                                                Edit Rule
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => toast.info('Duplicate feature coming soon')}>
                                                <Copy className="w-4 h-4 mr-2" />
                                                Duplicate
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => handleDelete(rule)}
                                                className="text-red-600"
                                            >
                                                <Trash2 className="w-4 h-4 mr-2" />
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                {/* Conditions preview */}
                                {rule.conditions.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                                            <span className="font-medium text-blue-600 dark:text-blue-400">IF</span>
                                            {rule.conditions.map((c, i) => (
                                                <span key={i} className="flex items-center gap-1">
                                                    {i > 0 && (
                                                        <span className="font-medium text-blue-500">{rule.conditionLogic || 'AND'}</span>
                                                    )}
                                                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">
                                                        {c.field} {c.operator?.toLowerCase()} {c.value}
                                                    </span>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Templates Dialog */}
            <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-violet-500" />
                            Automation Templates
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-custom px-1">
                        {templates.map(template => (
                            <button
                                key={template.id}
                                onClick={() => createFromTemplateMutation.mutate(template.id)}
                                disabled={createFromTemplateMutation.isPending}
                                className="w-full p-4 text-left border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                <div className="flex items-center justify-between">
                                    <h4 className="font-medium text-slate-800 dark:text-white">{template.name}</h4>
                                    <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                                        {template.category}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                    {template.description}
                                </p>
                            </button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Rule Builder Dialog */}
            <Dialog open={showRuleBuilder} onOpenChange={handleCloseBuilder}>
                <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Zap className="w-5 h-5 text-violet-500" />
                            {editingRule?.id ? 'Edit Rule' : 'Create Automation Rule'}
                        </DialogTitle>
                    </DialogHeader>
                    <RuleBuilder
                        rule={editingRule}
                        onClose={handleCloseBuilder}
                        onSave={() => {
                            queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
                        }}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
};
