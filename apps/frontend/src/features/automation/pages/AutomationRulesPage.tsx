import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    Plus, Zap, Pause, Pencil, Trash2, Copy, MoreHorizontal, Clock, ChevronRight, ArrowRight,
    TriangleAlert, User, MessageSquare, LayoutTemplate, Play, Info,
} from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { ResBub, ResEmpty, ResHead, ResSkeletonRows } from '@/components/resources/ResourceParts';
import { MgSwitch } from '@/components/management/MgmtParts';
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
const TRIGGER_LABELS: Record<string, { label: string; icon: typeof Zap; hue: string }> = {
    TICKET_CREATED: { label: 'Ticket Created', icon: Plus, hue: 'var(--dash-green)' },
    TICKET_UPDATED: { label: 'Ticket Updated', icon: Pencil, hue: 'var(--dash-blue)' },
    STATUS_CHANGED: { label: 'Status Changed', icon: ArrowRight, hue: 'var(--dash-navy)' },
    PRIORITY_CHANGED: { label: 'Priority Changed', icon: TriangleAlert, hue: 'var(--dash-orange)' },
    ASSIGNMENT_CHANGED: { label: 'Assignment Changed', icon: User, hue: 'var(--dash-teal)' },
    MESSAGE_RECEIVED: { label: 'Message Received', icon: MessageSquare, hue: 'var(--dash-blue)' },
    SLA_BREACH_IMMINENT: { label: 'SLA Warning', icon: Clock, hue: 'var(--dash-orange)' },
    SLA_BREACHED: { label: 'SLA Breached', icon: TriangleAlert, hue: 'var(--dash-red)' },
    TICKET_IDLE: { label: 'Ticket Idle', icon: Pause, hue: 'var(--dash-gray)' },
};
const RULE_GRID = { gridTemplateColumns: 'repeat(auto-fill, minmax(min(340px, 100%), 1fr))' } as const;

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
    const [ruleToDelete, setRuleToDelete] = useState<WorkflowRule | null>(null);

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

    const activeCount = rules.filter((r) => r.isActive).length;

    return (
        <div className="res-page mg-page">
            <ResHead icon={Zap} tone="orange" title="Automation Rules"
                description={isLoading ? 'Memuat rule…' : `${rules.length} rule${rules.length !== 1 ? 's' : ''} • ${activeCount} active`}
                actions={(
                    <>
                        <Button variant="soft" onClick={() => setShowTemplates(true)}><LayoutTemplate aria-hidden="true" />Templates</Button>
                        <Button variant="primary" onClick={handleCreateNew}><Plus aria-hidden="true" />Create Rule</Button>
                    </>
                )} />

            {isLoading ? (
                <div className="mg-cards" style={RULE_GRID}>
                    {Array.from({ length: 3 }, (_, i) => <div key={i} className="mg-ccard"><ResSkeletonRows rows={2} /></div>)}
                </div>
            ) : rules.length === 0 ? (
                <div className="res-table">
                    <ResEmpty icon={Zap} title="No automation rules yet"
                        cta={(
                            <div className="flex flex-wrap justify-center gap-2">
                                <Button variant="soft" onClick={() => setShowTemplates(true)}>Start with Template</Button>
                                <Button variant="primary" onClick={handleCreateNew}>Create from Scratch</Button>
                            </div>
                        )}>
                        Create rules to automate ticket handling
                    </ResEmpty>
                </div>
            ) : (
                <div className="mg-cards" style={RULE_GRID}>
                    {rules.map((rule, index) => {
                        const trig = TRIGGER_LABELS[rule.trigger.type] || { label: rule.trigger.type, icon: Zap, hue: 'var(--dash-gray)' };
                        const TriggerIcon = trig.icon;
                        const actions = rule.actions.map((a) => ACTION_LABELS[a.type] || a.type).join(', ');
                        return (
                            <article key={rule.id} className={cn('mg-ccard', rule.isActive ? 'is-lift' : 'is-off')} aria-labelledby={`rule-${rule.id}`}>
                                <div className="mg-ccard-top">
                                    <span className="mg-tile" style={{ ['--c' as string]: trig.hue }}><TriggerIcon aria-hidden="true" /></span>
                                    <div>
                                        {/* The name opens the builder; switch and menu are siblings, never nested in it. */}
                                        <button type="button" id={`rule-${rule.id}`} className="block max-w-full text-left rounded-md focus-visible:outline-none focus-visible:shadow-[var(--td-ring)]" onClick={() => handleEditRule(rule)}>
                                            <b>{rule.name}</b>
                                        </button>
                                        <small>Prioritas {index + 1}{rule.description ? ` · ${rule.description}` : ''}</small>
                                    </div>
                                    <MgSwitch checked={rule.isActive} label={`Aktifkan ${rule.name}`} disabled={toggleMutation.isPending} onChange={() => toggleMutation.mutate(rule.id)} />
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button type="button" className="res-icon-btn" aria-label={`Aksi lainnya untuk ${rule.name}`}><MoreHorizontal aria-hidden="true" /></button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handleEditRule(rule)}><Pencil className="w-4 h-4 mr-2" />Edit Rule</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => toast.info('Duplicate feature coming soon')}><Copy className="w-4 h-4 mr-2" />Duplicate</DropdownMenuItem>
                                            <DropdownMenuItem variant="destructive" onClick={() => setRuleToDelete(rule)}><Trash2 className="w-4 h-4 mr-2" />Delete</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                                <div className="mg-flow">
                                    <ResBub color={trig.hue}>{trig.label}</ResBub>
                                    {rule.conditions.length > 0 && (
                                        <>
                                            <ChevronRight aria-hidden="true" />
                                            <span className="res-tag" title={rule.conditions.map((c) => `${c.field} ${c.operator?.toLowerCase()} ${c.value}`).join(` ${rule.conditionLogic || 'AND'} `)}>
                                                {rule.conditions.length} condition{rule.conditions.length > 1 ? 's' : ''}
                                            </span>
                                        </>
                                    )}
                                    <ChevronRight aria-hidden="true" />
                                    <span>{actions || '—'}</span>
                                </div>
                                <div className="mg-foot2">
                                    <Play className="w-3 h-3" aria-hidden="true" />{rule.executionCount} runs
                                    {rule.lastExecutedAt && <><span aria-hidden="true">·</span><Clock className="w-3 h-3" aria-hidden="true" />{format(new Date(rule.lastExecutedAt), 'd MMM yyyy', { locale: idLocale })}</>}
                                    {rule.isActive && <><span className="res-spacer" /><ResBub color="var(--dash-green)" ink="var(--dash-ink-green)">Active</ResBub></>}
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

            <div className="res-note" style={{ maxWidth: 720 }}>
                <Info aria-hidden="true" />Rule dijalankan berurutan sesuai prioritas. Trigger: {Object.values(TRIGGER_LABELS).map((t) => t.label).join(', ')}.
            </div>

            <ConfirmationDialog
                isOpen={!!ruleToDelete}
                title="Delete rule?"
                description={`Delete rule "${ruleToDelete?.name ?? ''}"? This cannot be undone.`}
                confirmText="Delete"
                cancelText="Cancel"
                variant="destructive"
                isLoading={deleteMutation.isPending}
                onConfirm={() => { if (ruleToDelete) deleteMutation.mutate(ruleToDelete.id, { onSettled: () => setRuleToDelete(null) }); }}
                onCancel={() => setRuleToDelete(null)}
            />

            {/* Templates Dialog */}
            <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <LayoutTemplate className="w-5 h-5 text-[hsl(var(--idesk-sapphire))]" />
                            Automation Templates
                        </DialogTitle>
                    </DialogHeader>
                    <div className="dash-list max-h-96 overflow-y-auto px-1">
                        {templates.map(template => (
                            <button
                                key={template.id}
                                type="button"
                                onClick={() => createFromTemplateMutation.mutate(template.id)}
                                disabled={createFromTemplateMutation.isPending}
                                className="dash-li"
                            >
                                <span className="grow1">
                                    <b>{template.name}</b>
                                    <small className="!whitespace-normal">{template.description}</small>
                                </span>
                                <span className="res-tag capitalize">{template.category}</span>
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
                            <Zap className="w-5 h-5 text-[var(--dash-ink-orange)]" />
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
