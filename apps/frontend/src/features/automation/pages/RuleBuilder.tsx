import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    Zap,
    Plus,
    Trash2,
    ChevronDown,
    AlertTriangle,
    Bell,
    ArrowRight,
    User,
    MessageSquare,
    Clock,
    X,
    Save,
    Play,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import {
    TriggerType,
    ActionType,
    ConditionOperator,
    WorkflowTrigger,
    WorkflowCondition,
    WorkflowAction,
} from './types';

// ============================================
// CONSTANTS
// ============================================

const TRIGGER_OPTIONS = [
    { value: TriggerType.TICKET_CREATED, label: 'Ticket Created', icon: Plus, color: 'text-green-500 bg-green-100 dark:bg-green-900/30' },
    { value: TriggerType.STATUS_CHANGED, label: 'Status Changed', icon: ArrowRight, color: 'text-purple-500 bg-purple-100 dark:bg-purple-900/30' },
    { value: TriggerType.PRIORITY_CHANGED, label: 'Priority Changed', icon: AlertTriangle, color: 'text-orange-500 bg-orange-100 dark:bg-orange-900/30' },
    { value: TriggerType.ASSIGNMENT_CHANGED, label: 'Assignment Changed', icon: User, color: 'text-cyan-500 bg-cyan-100 dark:bg-cyan-900/30' },
    { value: TriggerType.MESSAGE_RECEIVED, label: 'Message Received', icon: MessageSquare, color: 'text-indigo-500 bg-indigo-100 dark:bg-indigo-900/30' },
    { value: TriggerType.SLA_BREACH_IMMINENT, label: 'SLA Warning', icon: Clock, color: 'text-amber-500 bg-amber-100 dark:bg-amber-900/30' },
    { value: TriggerType.SLA_BREACHED, label: 'SLA Breached', icon: AlertTriangle, color: 'text-red-500 bg-red-100 dark:bg-red-900/30' },
];

const CONDITION_FIELDS = [
    { value: 'status', label: 'Status', type: 'select', options: ['TODO', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CANCELLED'] },
    { value: 'priority', label: 'Priority', type: 'select', options: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
    { value: 'category', label: 'Category', type: 'select', options: ['HARDWARE', 'SOFTWARE', 'NETWORK', 'SECURITY', 'OTHER'] },
    { value: 'title', label: 'Title', type: 'text' },
    { value: 'description', label: 'Description', type: 'text' },
    { value: 'assignedToId', label: 'Has Assignee', type: 'boolean' },
];

const CONDITION_OPERATORS = [
    { value: ConditionOperator.EQUALS, label: 'equals' },
    { value: ConditionOperator.NOT_EQUALS, label: 'not equals' },
    { value: ConditionOperator.CONTAINS, label: 'contains' },
    { value: ConditionOperator.NOT_CONTAINS, label: 'not contains' },
    { value: ConditionOperator.IS_EMPTY, label: 'is empty' },
    { value: ConditionOperator.IS_NOT_EMPTY, label: 'is not empty' },
];

const ACTION_OPTIONS = [
    { value: ActionType.CHANGE_STATUS, label: 'Change Status', icon: ArrowRight },
    { value: ActionType.CHANGE_PRIORITY, label: 'Change Priority', icon: AlertTriangle },
    { value: ActionType.CHANGE_ASSIGNEE, label: 'Assign Ticket', icon: User },
    { value: ActionType.SEND_NOTIFICATION, label: 'Send Notification', icon: Bell },
    { value: ActionType.ADD_INTERNAL_NOTE, label: 'Add Internal Note', icon: MessageSquare },
];

const STATUS_OPTIONS = ['TODO', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED'];
const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

// ============================================
// TYPES
// ============================================

interface RuleBuilderProps {
    rule?: any;
    onClose: () => void;
    onSave: () => void;
}

// ============================================
// MAIN COMPONENT
// ============================================

export const RuleBuilder = ({ rule, onClose, onSave }: RuleBuilderProps) => {
    const queryClient = useQueryClient();
    const isEditing = !!rule?.id;

    // State
    const [name, setName] = useState(rule?.name || '');
    const [description, setDescription] = useState(rule?.description || '');
    const [trigger, setTrigger] = useState<WorkflowTrigger>(
        rule?.trigger || { type: TriggerType.TICKET_CREATED }
    );
    const [conditions, setConditions] = useState<WorkflowCondition[]>(
        rule?.conditions || []
    );
    const [conditionLogic, setConditionLogic] = useState<'AND' | 'OR'>(
        rule?.conditionLogic || 'AND'
    );
    const [actions, setActions] = useState<WorkflowAction[]>(
        rule?.actions || []
    );

    // Fetch agents for assignee selection
    const { data: agents = [] } = useQuery<any[]>({
        queryKey: ['agents-list'],
        queryFn: async () => {
            const res = await api.get('/users?role=AGENT&role=ADMIN');
            return res.data?.users || res.data || [];
        },
    });

    // Create/Update mutation
    const saveMutation = useMutation({
        mutationFn: async (data: any) => {
            if (isEditing) {
                return api.put(`/automation/rules/${rule.id}`, data);
            } else {
                return api.post('/automation/rules', data);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
            toast.success(isEditing ? 'Rule updated' : 'Rule created');
            onSave();
            onClose();
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Failed to save rule');
        },
    });

    const handleSave = () => {
        if (!name.trim()) {
            toast.error('Please enter a rule name');
            return;
        }
        if (actions.length === 0) {
            toast.error('Please add at least one action');
            return;
        }

        saveMutation.mutate({
            name,
            description,
            trigger,
            conditions,
            conditionLogic,
            actions,
            isActive: rule?.isActive ?? true,
        });
    };

    // ============================================
    // CONDITION HANDLERS
    // ============================================

    const addCondition = () => {
        setConditions([
            ...conditions,
            { field: 'status', operator: ConditionOperator.EQUALS, value: '' },
        ]);
    };

    const updateCondition = (index: number, updates: Partial<WorkflowCondition>) => {
        const newConditions = [...conditions];
        newConditions[index] = { ...newConditions[index], ...updates };
        setConditions(newConditions);
    };

    const removeCondition = (index: number) => {
        setConditions(conditions.filter((_, i) => i !== index));
    };

    // ============================================
    // ACTION HANDLERS
    // ============================================

    const addAction = () => {
        setActions([
            ...actions,
            { type: ActionType.CHANGE_STATUS, config: {} },
        ]);
    };

    const updateAction = (index: number, updates: Partial<WorkflowAction>) => {
        const newActions = [...actions];
        newActions[index] = { ...newActions[index], ...updates };
        setActions(newActions);
    };

    const removeAction = (index: number) => {
        setActions(actions.filter((_, i) => i !== index));
    };

    // ============================================
    // RENDER
    // ============================================

    return (
        <div className="space-y-6 max-h-[70vh] overflow-y-auto scrollbar-custom px-1">
            {/* Rule Name */}
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Rule Name *
                </label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Auto-assign high priority tickets"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                />
            </div>

            {/* Description */}
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Description
                </label>
                <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional description..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                />
            </div>

            {/* WHEN - Trigger Section */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold">1</div>
                    <span className="font-semibold text-green-700 dark:text-green-400">WHEN</span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">(Trigger)</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {TRIGGER_OPTIONS.map((opt) => {
                        const Icon = opt.icon;
                        const isSelected = trigger.type === opt.value;
                        return (
                            <button
                                key={opt.value}
                                onClick={() => setTrigger({ type: opt.value })}
                                className={cn(
                                    "flex items-center gap-2 p-3 rounded-xl border-2 transition-colors duration-150 text-left",
                                    isSelected
                                        ? "border-green-500 bg-white dark:bg-slate-800 shadow-md"
                                        : "border-transparent bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800"
                                )}
                            >
                                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", opt.color)}>
                                    <Icon className="w-4 h-4" />
                                </div>
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{opt.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* IF - Conditions Section */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">2</div>
                        <span className="font-semibold text-blue-700 dark:text-blue-400">IF</span>
                        <span className="text-sm text-slate-500 dark:text-slate-400">(Conditions - Optional)</span>
                    </div>
                    {conditions.length > 1 && (
                        <select
                            value={conditionLogic}
                            onChange={(e) => setConditionLogic(e.target.value as 'AND' | 'OR')}
                            className="px-3 py-1 text-sm rounded-lg border border-blue-200 dark:border-blue-700 bg-white dark:bg-slate-800"
                        >
                            <option value="AND">Match ALL</option>
                            <option value="OR">Match ANY</option>
                        </select>
                    )}
                </div>

                <div className="space-y-2">
                    {conditions.map((cond, index) => (
                        <ConditionRow
                            key={index}
                            condition={cond}
                            onChange={(updates) => updateCondition(index, updates)}
                            onRemove={() => removeCondition(index)}
                        />
                    ))}
                </div>

                <button
                    onClick={addCondition}
                    className="mt-3 flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 text-sm font-medium"
                >
                    <Plus className="w-4 h-4" />
                    Add Condition
                </button>

                {conditions.length === 0 && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 italic">
                        No conditions = rule runs for all triggers
                    </p>
                )}
            </div>

            {/* THEN - Actions Section */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold">3</div>
                    <span className="font-semibold text-purple-700 dark:text-purple-400">THEN</span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">(Actions)</span>
                </div>

                <div className="space-y-3">
                    {actions.map((action, index) => (
                        <ActionRow
                            key={index}
                            action={action}
                            agents={agents}
                            onChange={(updates) => updateAction(index, updates)}
                            onRemove={() => removeAction(index)}
                        />
                    ))}
                </div>

                <button
                    onClick={addAction}
                    className="mt-3 flex items-center gap-2 text-purple-600 dark:text-purple-400 hover:text-purple-700 text-sm font-medium"
                >
                    <Plus className="w-4 h-4" />
                    Add Action
                </button>

                {actions.length === 0 && (
                    <p className="text-sm text-red-500 mt-2">
                        ⚠️ At least one action is required
                    </p>
                )}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                    onClick={onClose}
                    className="px-4 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={saveMutation.isPending || !name.trim() || actions.length === 0}
                    className="px-6 py-2.5 bg-primary text-slate-900 rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    <Save className="w-4 h-4" />
                    {saveMutation.isPending ? 'Saving...' : isEditing ? 'Update Rule' : 'Create Rule'}
                </button>
            </div>
        </div>
    );
};

// ============================================
// CONDITION ROW COMPONENT
// ============================================

const ConditionRow = ({
    condition,
    onChange,
    onRemove,
}: {
    condition: WorkflowCondition;
    onChange: (updates: Partial<WorkflowCondition>) => void;
    onRemove: () => void;
}) => {
    const field = CONDITION_FIELDS.find((f) => f.value === condition.field);

    return (
        <div className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded-lg">
            {/* Field Select */}
            <select
                value={condition.field}
                onChange={(e) => onChange({ field: e.target.value, value: '' })}
                className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-1"
            >
                {CONDITION_FIELDS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                ))}
            </select>

            {/* Operator Select */}
            <select
                value={condition.operator}
                onChange={(e) => onChange({ operator: e.target.value as ConditionOperator })}
                className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            >
                {CONDITION_OPERATORS.map((op) => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                ))}
            </select>

            {/* Value Input */}
            {condition.operator !== ConditionOperator.IS_EMPTY &&
                condition.operator !== ConditionOperator.IS_NOT_EMPTY && (
                    <>
                        {field?.type === 'select' ? (
                            <select
                                value={condition.value || ''}
                                onChange={(e) => onChange({ value: e.target.value })}
                                className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-1"
                            >
                                <option value="">Select...</option>
                                {field.options?.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        ) : (
                            <input
                                type="text"
                                value={condition.value || ''}
                                onChange={(e) => onChange({ value: e.target.value })}
                                placeholder="Value..."
                                className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-1"
                            />
                        )}
                    </>
                )}

            {/* Remove Button */}
            <button
                onClick={onRemove}
                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};

// ============================================
// ACTION ROW COMPONENT
// ============================================

const ActionRow = ({
    action,
    agents,
    onChange,
    onRemove,
}: {
    action: WorkflowAction;
    agents: any[];
    onChange: (updates: Partial<WorkflowAction>) => void;
    onRemove: () => void;
}) => {
    const renderActionConfig = () => {
        switch (action.type) {
            case ActionType.CHANGE_STATUS:
                return (
                    <select
                        value={action.config.status || ''}
                        onChange={(e) => onChange({ config: { ...action.config, status: e.target.value } })}
                        className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-1"
                    >
                        <option value="">Select status...</option>
                        {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                );

            case ActionType.CHANGE_PRIORITY:
                return (
                    <select
                        value={action.config.priority || ''}
                        onChange={(e) => onChange({ config: { ...action.config, priority: e.target.value } })}
                        className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-1"
                    >
                        <option value="">Select priority...</option>
                        {PRIORITY_OPTIONS.map((p) => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </select>
                );

            case ActionType.CHANGE_ASSIGNEE:
                return (
                    <div className="flex gap-2 flex-1">
                        <select
                            value={action.config.assignmentType || 'SPECIFIC_USER'}
                            onChange={(e) => onChange({ config: { ...action.config, assignmentType: e.target.value as any } })}
                            className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                        >
                            <option value="SPECIFIC_USER">Specific User</option>
                            <option value="ROUND_ROBIN">Round Robin</option>
                            <option value="LEAST_BUSY">Least Busy</option>
                        </select>
                        {action.config.assignmentType === 'SPECIFIC_USER' && (
                            <select
                                value={action.config.assigneeId || ''}
                                onChange={(e) => onChange({ config: { ...action.config, assigneeId: e.target.value } })}
                                className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-1"
                            >
                                <option value="">Select agent...</option>
                                {agents.map((agent) => (
                                    <option key={agent.id} value={agent.id}>{agent.fullName}</option>
                                ))}
                            </select>
                        )}
                    </div>
                );

            case ActionType.SEND_NOTIFICATION:
                return (
                    <div className="flex flex-col gap-2 flex-1">
                        <div className="flex gap-2">
                            <select
                                value={action.config.recipientType || 'ASSIGNEE'}
                                onChange={(e) => onChange({ config: { ...action.config, recipientType: e.target.value as any } })}
                                className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                            >
                                <option value="ASSIGNEE">Assignee</option>
                                <option value="TICKET_OWNER">Ticket Owner</option>
                                <option value="ALL_AGENTS">All Agents</option>
                            </select>
                        </div>
                        <input
                            type="text"
                            value={action.config.message || ''}
                            onChange={(e) => onChange({ config: { ...action.config, message: e.target.value } })}
                            placeholder="Notification message... (use {{ticket.title}} for variables)"
                            className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-1"
                        />
                    </div>
                );

            case ActionType.ADD_INTERNAL_NOTE:
                return (
                    <input
                        type="text"
                        value={action.config.noteContent || ''}
                        onChange={(e) => onChange({ config: { ...action.config, noteContent: e.target.value } })}
                        placeholder="Note content..."
                        className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-1"
                    />
                );

            default:
                return null;
        }
    };

    const actionInfo = ACTION_OPTIONS.find((a) => a.value === action.type);
    const ActionIcon = actionInfo?.icon || Zap;

    return (
        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-purple-100 dark:border-purple-800">
            <div className="flex items-start gap-3">
                {/* Action Type Icon */}
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                    <ActionIcon className="w-5 h-5" />
                </div>

                <div className="flex-1 space-y-2">
                    {/* Action Type Select */}
                    <select
                        value={action.type}
                        onChange={(e) => onChange({ type: e.target.value as ActionType, config: {} })}
                        className="w-full px-3 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    >
                        {ACTION_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>

                    {/* Action Config */}
                    {renderActionConfig()}
                </div>

                {/* Remove Button */}
                <button
                    onClick={onRemove}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shrink-0"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};
