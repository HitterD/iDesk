# Improvement_V4.md
## Laporan Audit Komprehensif - iDesk Helpdesk System
**Tanggal:** 29 November 2025  
**Versi:** 4.1 (Updated)

---

## 1. Executive Summary

### Ringkasan Proyek
**iDesk** adalah sistem helpdesk ticketing yang komprehensif dengan arsitektur modern menggunakan NestJS (Backend) dan React + Vite (Frontend). Proyek ini sudah memiliki fondasi yang solid dengan fitur-fitur seperti:

- ✅ Ticket Management dengan Kanban Board
- ✅ Real-time updates via WebSocket
- ✅ Knowledge Base
- ✅ Contract Renewal Management dengan PDF Extraction
- ✅ Telegram Bot Integration
- ✅ SLA Management
- ✅ Role-Based Access Control (RBAC)
- ✅ Notification System
- ✅ Audit Logging System (NEW)
- ✅ Bulk Operations (NEW)
- ✅ Ticket Templates (NEW)
- ✅ Ticket Merge Feature (NEW)

### Skor Keseluruhan (Updated)
| Aspek | Skor Sebelum | Skor Sekarang | Catatan |
|-------|--------------|---------------|---------|
| Arsitektur | 8/10 | 9/10 | Clean Architecture + Audit System |
| Keamanan | 6/10 | 8/10 | Rate limiting, Magic bytes validation |
| UI/UX | 7/10 | 8/10 | Mobile responsive, Accessibility improved |
| Performa | 7/10 | 8/10 | Vendor splitting, Query optimization |
| Maintainability | 6/10 | 8/10 | Shared constants, Deprecated files removed |

---

## 2. Implementation Status

### ✅ COMPLETED TASKS

#### 3.1 Security Enhancements
| Task | Status | File/Location |
|------|--------|---------------|
| A. Rate Limiting pada Auth Endpoints | ✅ DONE | `auth.controller.ts` - @Throttle decorator added |
| B. AppLogger Service | ✅ DONE | `apps/backend/src/shared/core/logger/app.logger.ts` |
| C. File Upload Security (Magic Bytes) | ✅ DONE | `apps/backend/src/shared/core/validators/magic-bytes.validator.ts` |
| D. Password Strength Validation | ⏭️ SKIPPED | User tidak membutuhkan (no self-registration) |

#### 3.2 UI/UX Enhancements
| Task | Status | File/Location |
|------|--------|---------------|
| A. Login Page Background Fix | ✅ DONE | `BentoLoginPage.tsx` - bg-background |
| B. Skeleton Loading Components | ✅ DONE | `apps/frontend/src/components/ui/skeletons/` |
| C. Accessibility (ARIA labels) | ✅ DONE | `BentoSidebar.tsx`, `BentoLayout.tsx` |
| D. Mobile Responsiveness | ✅ DONE | `BentoLayout.tsx` - Mobile drawer implemented |

#### 3.3 Code Quality & Architecture
| Task | Status | File/Location |
|------|--------|---------------|
| A. Shared Constants (STATUS_CONFIG) | ✅ DONE | `apps/frontend/src/lib/constants/ticket.constants.ts` |
| B. Delete Deprecated File | ✅ DONE | `ticket.service.deprecated.ts` removed |
| C. API Response Standardization | ✅ DONE | `apps/backend/src/shared/core/responses/api-response.dto.ts` |

#### 3.4 Performance Optimizations
| Task | Status | File/Location |
|------|--------|---------------|
| A. Dashboard Stats Query Optimization | ✅ DONE | `ticket-query.service.ts` - Single aggregation |
| B. Vendor Chunk Splitting | ✅ DONE | `vite.config.ts` - manualChunks added |
| C. Image Compression Service | ✅ DONE | `apps/backend/src/shared/upload/image-processor.service.ts` |

#### 3.5 Functional Improvements
| Task | Status | File/Location |
|------|--------|---------------|
| A. Audit Logging System | ✅ DONE | `apps/backend/src/modules/audit/` (full module) |
| B. Bulk Operations | ✅ DONE | `ticket-update.service.ts` + `PATCH /tickets/bulk/update` |
| C. Ticket Templates | ✅ DONE | Entity, Service, Controller in ticketing module |
| D. Ticket Merge Feature | ✅ DONE | `ticket-merge.service.ts` + `POST /tickets/merge` |

---

## 3. NEW IMPROVEMENTS (Pending Implementation)

### 3.6 Ticket Page UI Enhancements (HIGH PRIORITY)

#### A. Ticket Stats Cards - Dashboard Style
**File:** `apps/frontend/src/features/ticket-board/pages/BentoTicketListPage.tsx`

*Requirement:* Tampilan stats card untuk Open, In Progress, Resolved, Overdue harus sama seperti dashboard dengan icon dan styling yang konsisten.

*Solusi:*
```tsx
// Buat komponen TicketStatsCard yang reusable
interface StatsCardProps {
    title: string;
    value: number;
    icon: LucideIcon;
    color: string;
    bgColor: string;
    trend?: number;
}

const TicketStatsCard: React.FC<StatsCardProps> = ({ title, value, icon: Icon, color, bgColor, trend }) => (
    <div className={cn(
        "bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700",
        "hover:shadow-lg transition-all duration-300"
    )}>
        <div className="flex items-center justify-between">
            <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{title}</p>
                <p className={cn("text-3xl font-bold", color)}>{value}</p>
            </div>
            <div className={cn("p-3 rounded-2xl", bgColor)}>
                <Icon className={cn("w-6 h-6", color)} />
            </div>
        </div>
        {trend !== undefined && (
            <div className="mt-3 flex items-center gap-1 text-sm">
                {trend >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-500" />
                ) : (
                    <TrendingDown className="w-4 h-4 text-red-500" />
                )}
                <span className={trend >= 0 ? "text-green-500" : "text-red-500"}>
                    {Math.abs(trend)}% from last week
                </span>
            </div>
        )}
    </div>
);

// Usage in BentoTicketListPage
const statsCards = [
    { title: 'Open', value: stats.open, icon: Inbox, color: 'text-slate-600', bgColor: 'bg-slate-100 dark:bg-slate-700' },
    { title: 'In Progress', value: stats.inProgress, icon: CircleDot, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
    { title: 'Resolved', value: stats.resolved, icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30' },
    { title: 'Overdue', value: stats.overdue, icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30' },
];
```

#### B. Critical Priority Icon
**File:** `apps/frontend/src/lib/constants/ticket.constants.ts`

*Requirement:* Priority CRITICAL harus memiliki icon yang sesuai (AlertTriangle atau Flame) dengan animasi pulse.

*Solusi:*
```tsx
import { AlertTriangle, Flame } from 'lucide-react';

export const PRIORITY_CONFIG = {
    LOW: {
        label: 'Low',
        color: 'text-slate-500 bg-slate-50 dark:bg-slate-800',
        dot: 'bg-slate-400',
        icon: null,
    },
    MEDIUM: {
        label: 'Medium',
        color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20',
        dot: 'bg-yellow-500',
        icon: null,
    },
    HIGH: {
        label: 'High',
        color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20',
        dot: 'bg-orange-500',
        icon: AlertTriangle,
    },
    CRITICAL: {
        label: 'Critical',
        color: 'text-red-600 bg-red-50 dark:bg-red-900/20',
        dot: 'bg-red-500 animate-pulse',
        icon: Flame,
        iconClass: 'text-red-500 animate-pulse',
    },
} as const;

// PriorityBadge component
const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
    const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.MEDIUM;
    const Icon = config.icon;
    
    return (
        <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", config.color)}>
            {Icon && <Icon className={cn("w-3 h-3", config.iconClass)} />}
            <span className={cn("w-2 h-2 rounded-full", config.dot)} />
            {config.label}
        </span>
    );
};
```

#### C. Ticket List Table Improvements
**File:** `apps/frontend/src/features/ticket-board/pages/BentoTicketListPage.tsx`

*Requirements:*
1. Kolom Priority terpisah dengan dropdown selection
2. Kolom Status dengan dropdown untuk Admin/Agent
3. Kolom Target Date lebih terlihat (highlight jika mendekati/overdue)
4. Rename kolom Date menjadi "Created Date"

*Solusi:*
```tsx
// Column definitions untuk ticket list table
const columns = [
    {
        header: 'Ticket',
        accessor: 'ticketNumber',
        cell: (ticket) => (
            <div>
                <span className="font-medium text-slate-800 dark:text-white">
                    #{ticket.ticketNumber}
                </span>
                <p className="text-sm text-slate-500 truncate max-w-xs">{ticket.title}</p>
            </div>
        ),
    },
    {
        header: 'Priority',
        accessor: 'priority',
        cell: (ticket) => (
            <PriorityDropdown
                value={ticket.priority}
                onChange={(value) => handleUpdatePriority(ticket.id, value)}
                disabled={!canEdit}
            />
        ),
    },
    {
        header: 'Status',
        accessor: 'status',
        cell: (ticket) => (
            <StatusDropdown
                value={ticket.status}
                onChange={(value) => handleUpdateStatus(ticket.id, value)}
                disabled={!canEdit}
            />
        ),
    },
    {
        header: 'Assigned To',
        accessor: 'assignedTo',
        cell: (ticket) => (
            <AssigneeDropdown
                value={ticket.assignedTo?.id}
                onChange={(value) => handleAssign(ticket.id, value)}
                disabled={!canEdit}
            />
        ),
    },
    {
        header: 'Target Date',
        accessor: 'slaTarget',
        cell: (ticket) => <TargetDateCell slaTarget={ticket.slaTarget} status={ticket.status} />,
    },
    {
        header: 'Created Date',
        accessor: 'createdAt',
        cell: (ticket) => (
            <span className="text-sm text-slate-500">
                {format(new Date(ticket.createdAt), 'dd MMM yyyy HH:mm')}
            </span>
        ),
    },
];

// PriorityDropdown Component
const PriorityDropdown: React.FC<{
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
    const config = PRIORITY_CONFIG[value] || PRIORITY_CONFIG.MEDIUM;
    const Icon = config.icon;
    
    if (disabled) {
        return <PriorityBadge priority={value} />;
    }
    
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className={cn(
                "w-[130px] h-8 border-0",
                config.color
            )}>
                <SelectValue>
                    <span className="inline-flex items-center gap-1.5">
                        {Icon && <Icon className="w-3 h-3" />}
                        <span className={cn("w-2 h-2 rounded-full", config.dot)} />
                        {config.label}
                    </span>
                </SelectValue>
            </SelectTrigger>
            <SelectContent>
                {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => {
                    const PIcon = cfg.icon;
                    return (
                        <SelectItem key={key} value={key}>
                            <span className="inline-flex items-center gap-1.5">
                                {PIcon && <PIcon className="w-3 h-3" />}
                                <span className={cn("w-2 h-2 rounded-full", cfg.dot)} />
                                {cfg.label}
                            </span>
                        </SelectItem>
                    );
                })}
            </SelectContent>
        </Select>
    );
};

// StatusDropdown Component
const StatusDropdown: React.FC<{
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
    const config = STATUS_CONFIG[value] || STATUS_CONFIG.TODO;
    const Icon = config.icon;
    
    if (disabled) {
        return (
            <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", config.color)}>
                <Icon className="w-3 h-3" />
                {config.label}
            </span>
        );
    }
    
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className={cn("w-[140px] h-8 border-0", config.color)}>
                <SelectValue>
                    <span className="inline-flex items-center gap-1.5">
                        <Icon className="w-3 h-3" />
                        {config.label}
                    </span>
                </SelectValue>
            </SelectTrigger>
            <SelectContent>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                    const SIcon = cfg.icon;
                    return (
                        <SelectItem key={key} value={key}>
                            <span className="inline-flex items-center gap-1.5">
                                <SIcon className="w-3 h-3" />
                                {cfg.label}
                            </span>
                        </SelectItem>
                    );
                })}
            </SelectContent>
        </Select>
    );
};

// TargetDateCell Component - Highlight overdue/approaching
const TargetDateCell: React.FC<{ slaTarget: string; status: string }> = ({ slaTarget, status }) => {
    if (!slaTarget || status === 'RESOLVED' || status === 'CANCELLED') {
        return <span className="text-sm text-slate-400">-</span>;
    }
    
    const target = new Date(slaTarget);
    const now = new Date();
    const diffHours = (target.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    const isOverdue = diffHours < 0;
    const isApproaching = diffHours > 0 && diffHours <= 4;
    
    return (
        <div className={cn(
            "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium",
            isOverdue && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
            isApproaching && "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
            !isOverdue && !isApproaching && "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
        )}>
            {isOverdue && <AlertTriangle className="w-4 h-4 animate-pulse" />}
            {isApproaching && <Clock className="w-4 h-4" />}
            <span>{format(target, 'dd MMM yyyy HH:mm')}</span>
            {isOverdue && <span className="text-xs">(Overdue)</span>}
        </div>
    );
};
```

---

### 3.7 Kanban Board Total Redesign (HIGH PRIORITY)

**File:** `apps/frontend/src/features/ticket-board/components/BentoTicketKanban.tsx`

#### Masalah Saat Ini:
1. Kolom Kanban menggunakan fixed width (`min-w-[280px] max-w-[320px]`) - tidak memanfaatkan space
2. Space di sebelah kanan masih kosong/tidak terpakai
3. Card terlalu kecil, informasi terbatas
4. Tidak ada fitur collapse/expand column
5. Tidak ada swimlanes atau grouping
6. Tidak ada WIP (Work In Progress) limits
7. Tidak ada quick filters di Kanban view
8. Tidak ada ticket preview panel

#### A. Full-Width Responsive Layout
**Konsep:** Kolom harus mengisi seluruh lebar layar dengan distribusi yang merata.

```tsx
// Layout baru - Full width dengan flex-grow
const KanbanBoard: React.FC = () => {
    return (
        <div className="h-full flex flex-col">
            {/* Header dengan Stats dan Controls */}
            <KanbanHeader />
            
            {/* Main Kanban Area - Full Width */}
            <div className="flex-1 flex gap-4 overflow-hidden">
                {/* Kanban Columns - Take full width */}
                <div className="flex-1 flex gap-4 overflow-x-auto p-4">
                    {COLUMNS.map((column) => (
                        <KanbanColumn 
                            key={column.id}
                            column={column}
                            tickets={getTicketsByStatus(column.id)}
                            isCollapsed={collapsedColumns.includes(column.id)}
                            onToggleCollapse={() => toggleColumn(column.id)}
                        />
                    ))}
                </div>
                
                {/* Optional: Ticket Preview Panel (Right Side) */}
                {selectedTicket && (
                    <TicketPreviewPanel 
                        ticket={selectedTicket}
                        onClose={() => setSelectedTicket(null)}
                    />
                )}
            </div>
        </div>
    );
};

// Column dengan flexible width
const KanbanColumn: React.FC<KanbanColumnProps> = ({ 
    column, 
    tickets, 
    isCollapsed,
    onToggleCollapse 
}) => {
    if (isCollapsed) {
        return (
            <div 
                className="w-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex flex-col items-center py-4 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                onClick={onToggleCollapse}
            >
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-2", column.bgColor)}>
                    <column.icon className="w-4 h-4 text-white" />
                </div>
                <span className="writing-vertical text-xs font-bold text-slate-500">{column.title}</span>
                <span className="mt-2 bg-white dark:bg-slate-700 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                    {tickets.length}
                </span>
            </div>
        );
    }
    
    return (
        <div className="flex-1 min-w-[300px] flex flex-col bg-slate-50 dark:bg-slate-900/50 rounded-2xl overflow-hidden">
            {/* Column Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", column.bgColor)}>
                            <column.icon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-white">{column.title}</h3>
                            <p className="text-xs text-slate-500">{tickets.length} tickets</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* WIP Limit Indicator */}
                        {column.wipLimit && (
                            <span className={cn(
                                "text-xs px-2 py-1 rounded-full font-medium",
                                tickets.length >= column.wipLimit 
                                    ? "bg-red-100 text-red-600" 
                                    : "bg-slate-200 text-slate-600"
                            )}>
                                {tickets.length}/{column.wipLimit}
                            </span>
                        )}
                        <button 
                            onClick={onToggleCollapse}
                            className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
            
            {/* Scrollable Cards Area */}
            <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                    <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                            "flex-1 overflow-y-auto p-3 space-y-3",
                            snapshot.isDraggingOver && "bg-primary/5 ring-2 ring-primary/30 ring-inset"
                        )}
                    >
                        {tickets.map((ticket, index) => (
                            <EnhancedKanbanCard 
                                key={ticket.id}
                                ticket={ticket}
                                index={index}
                                onSelect={() => setSelectedTicket(ticket)}
                                onQuickAction={handleQuickAction}
                            />
                        ))}
                        {provided.placeholder}
                        
                        {tickets.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                <Inbox className="w-12 h-12 mb-3 opacity-50" />
                                <span className="text-sm">No tickets</span>
                                <span className="text-xs">Drag tickets here</span>
                            </div>
                        )}
                    </div>
                )}
            </Droppable>
        </div>
    );
};
```

#### B. Enhanced Kanban Card Design
**Konsep:** Card lebih informatif dengan quick actions dan visual indicators yang jelas.

```tsx
const EnhancedKanbanCard: React.FC<{
    ticket: Ticket;
    index: number;
    onSelect: () => void;
    onQuickAction: (action: string, ticketId: string) => void;
}> = ({ ticket, index, onSelect, onQuickAction }) => {
    const [showActions, setShowActions] = useState(false);
    const priorityConfig = PRIORITY_CONFIG[ticket.priority];
    const isOverdue = ticket.slaTarget && new Date(ticket.slaTarget) < new Date();
    const isApproaching = ticket.slaTarget && !isOverdue && 
        (new Date(ticket.slaTarget).getTime() - Date.now()) < 4 * 60 * 60 * 1000;
    
    return (
        <Draggable draggableId={ticket.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    onMouseEnter={() => setShowActions(true)}
                    onMouseLeave={() => setShowActions(false)}
                    className={cn(
                        "bg-white dark:bg-slate-800 rounded-xl border transition-all duration-200",
                        "hover:shadow-lg cursor-pointer group",
                        snapshot.isDragging && "shadow-2xl rotate-2 scale-105 z-50",
                        isOverdue && "border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10",
                        isApproaching && !isOverdue && "border-orange-300 dark:border-orange-800",
                        !isOverdue && !isApproaching && "border-slate-200 dark:border-slate-700"
                    )}
                >
                    {/* Priority Indicator Bar */}
                    <div className={cn("h-1 rounded-t-xl", priorityConfig.barColor)} />
                    
                    <div className="p-4">
                        {/* Header Row */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                                    #{ticket.ticketNumber}
                                </span>
                                {ticket.priority === 'CRITICAL' && (
                                    <Flame className="w-4 h-4 text-red-500 animate-pulse" />
                                )}
                            </div>
                            
                            {/* Quick Actions (on hover) */}
                            <div className={cn(
                                "flex items-center gap-1 transition-opacity",
                                showActions ? "opacity-100" : "opacity-0"
                            )}>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onSelect(); }}
                                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                                    title="View Details"
                                >
                                    <Eye className="w-4 h-4 text-slate-400" />
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onQuickAction('assign', ticket.id); }}
                                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                                    title="Assign"
                                >
                                    <UserPlus className="w-4 h-4 text-slate-400" />
                                </button>
                            </div>
                        </div>
                        
                        {/* Title */}
                        <h4 
                            onClick={onSelect}
                            className="font-semibold text-slate-800 dark:text-white text-sm mb-2 line-clamp-2 group-hover:text-primary transition-colors"
                        >
                            {ticket.title}
                        </h4>
                        
                        {/* Category & Priority Row */}
                        <div className="flex items-center gap-2 mb-3">
                            {ticket.category && (
                                <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-500">
                                    {ticket.category}
                                </span>
                            )}
                            <span className={cn(
                                "text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1",
                                priorityConfig.badgeColor
                            )}>
                                {priorityConfig.icon && <priorityConfig.icon className="w-3 h-3" />}
                                {priorityConfig.label}
                            </span>
                        </div>
                        
                        {/* SLA Target / Due Date */}
                        {ticket.slaTarget && (
                            <div className={cn(
                                "flex items-center gap-2 text-xs mb-3 px-2 py-1.5 rounded-lg",
                                isOverdue && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                                isApproaching && "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
                                !isOverdue && !isApproaching && "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                            )}>
                                {isOverdue ? (
                                    <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
                                ) : (
                                    <Clock className="w-3.5 h-3.5" />
                                )}
                                <span className="font-medium">
                                    {isOverdue ? 'Overdue: ' : 'Due: '}
                                    {format(new Date(ticket.slaTarget), 'dd MMM HH:mm')}
                                </span>
                            </div>
                        )}
                        
                        {/* Footer */}
                        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
                            {/* Requester & Assignee */}
                            <div className="flex items-center gap-2">
                                <div 
                                    className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-xs font-bold text-primary"
                                    title={`Requester: ${ticket.user?.fullName}`}
                                >
                                    {ticket.user?.fullName?.charAt(0)}
                                </div>
                                {ticket.assignedTo ? (
                                    <div className="flex items-center gap-1.5">
                                        <ArrowRight className="w-3 h-3 text-slate-400" />
                                        <div 
                                            className="w-7 h-7 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-xs font-bold text-green-600"
                                            title={`Assigned: ${ticket.assignedTo.fullName}`}
                                        >
                                            {ticket.assignedTo.fullName.charAt(0)}
                                        </div>
                                    </div>
                                ) : (
                                    <span className="text-xs text-slate-400 italic">Unassigned</span>
                                )}
                            </div>
                            
                            {/* Meta Info */}
                            <div className="flex items-center gap-3 text-slate-400">
                                {ticket.messages?.length > 0 && (
                                    <span className="flex items-center gap-1 text-xs">
                                        <MessageSquare className="w-3.5 h-3.5" />
                                        {ticket.messages.length}
                                    </span>
                                )}
                                {ticket.attachments?.length > 0 && (
                                    <span className="flex items-center gap-1 text-xs">
                                        <Paperclip className="w-3.5 h-3.5" />
                                        {ticket.attachments.length}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Draggable>
    );
};
```

#### C. Ticket Preview Panel (Right Side)
**Konsep:** Memanfaatkan space kosong di kanan untuk preview ticket tanpa navigasi.

```tsx
const TicketPreviewPanel: React.FC<{
    ticket: Ticket;
    onClose: () => void;
    onOpenFull: () => void;
}> = ({ ticket, onClose, onOpenFull }) => {
    return (
        <div className="w-[400px] bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 flex flex-col">
            {/* Panel Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-slate-500">#{ticket.ticketNumber}</span>
                    <PriorityBadge priority={ticket.priority} />
                </div>
                <div className="flex items-center gap-1">
                    <button 
                        onClick={onOpenFull}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                        title="Open Full View"
                    >
                        <Maximize2 className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
            
            {/* Ticket Info */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                    {ticket.title}
                </h2>
                
                {/* Quick Actions */}
                <div className="flex flex-wrap gap-2">
                    <StatusDropdown value={ticket.status} onChange={...} />
                    <PriorityDropdown value={ticket.priority} onChange={...} />
                    <AssigneeDropdown value={ticket.assignedTo?.id} onChange={...} />
                </div>
                
                {/* SLA Info */}
                <SlaStatusCard ticket={ticket} />
                
                {/* Description */}
                <div className="prose prose-sm dark:prose-invert max-w-none">
                    {ticket.description}
                </div>
                
                {/* Recent Messages */}
                <div>
                    <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        Recent Messages
                    </h3>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {ticket.messages?.slice(-3).map(msg => (
                            <MessagePreview key={msg.id} message={msg} />
                        ))}
                    </div>
                </div>
            </div>
            
            {/* Quick Reply */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                <QuickReplyInput ticketId={ticket.id} />
            </div>
        </div>
    );
};
```

#### D. Kanban Header dengan Filter & Stats
```tsx
const KanbanHeader: React.FC = () => {
    return (
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            {/* Title Row */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Ticket Board</h1>
                    <p className="text-sm text-slate-500">Drag and drop to update status</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* View Toggle */}
                    <ViewToggle currentView="kanban" />
                    
                    {/* Quick Filters */}
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                        <button className="px-3 py-1.5 text-sm rounded-lg bg-white dark:bg-slate-700 shadow-sm">
                            All
                        </button>
                        <button className="px-3 py-1.5 text-sm rounded-lg text-slate-500 hover:bg-white/50">
                            My Tickets
                        </button>
                        <button className="px-3 py-1.5 text-sm rounded-lg text-red-500 hover:bg-red-50">
                            <AlertTriangle className="w-4 h-4 inline mr-1" />
                            Overdue
                        </button>
                        <button className="px-3 py-1.5 text-sm rounded-lg text-red-500 hover:bg-red-50">
                            <Flame className="w-4 h-4 inline mr-1" />
                            Critical
                        </button>
                    </div>
                </div>
            </div>
            
            {/* Stats Row - Dashboard Style Cards */}
            <div className="grid grid-cols-5 gap-4">
                <StatsCard title="Total" value={stats.total} icon={Ticket} color="slate" />
                <StatsCard title="Open" value={stats.open} icon={Inbox} color="slate" />
                <StatsCard title="In Progress" value={stats.inProgress} icon={CircleDot} color="blue" />
                <StatsCard title="Resolved Today" value={stats.resolvedToday} icon={CheckCircle2} color="green" />
                <StatsCard title="Overdue" value={stats.overdue} icon={AlertTriangle} color="red" highlight />
            </div>
        </div>
    );
};
```

#### E. Swimlanes Option (Group by Priority/Assignee)
```tsx
// Toggle untuk swimlane view
const [groupBy, setGroupBy] = useState<'none' | 'priority' | 'assignee'>('none');

// Render dengan swimlanes
{groupBy !== 'none' && (
    <div className="flex-1 overflow-y-auto">
        {swimlanes.map(lane => (
            <div key={lane.id} className="mb-6">
                <div className="flex items-center gap-2 mb-3 px-4">
                    <lane.icon className="w-5 h-5" />
                    <h3 className="font-bold">{lane.title}</h3>
                    <span className="text-sm text-slate-500">({lane.tickets.length})</span>
                </div>
                <div className="flex gap-4 overflow-x-auto px-4">
                    {COLUMNS.map(column => (
                        <MiniColumn 
                            key={column.id}
                            column={column}
                            tickets={lane.tickets.filter(t => t.status === column.id)}
                        />
                    ))}
                </div>
            </div>
        ))}
    </div>
)}
```

---

### 3.8 Additional Improvements (Optional)

#### A. Ticket Quick Actions
Tambahkan quick actions pada hover di ticket list row:
- Quick Status Change
- Quick Assign
- Quick Priority Change
- View Details

#### B. Keyboard Shortcuts
Implementasi keyboard shortcuts untuk power users:
- `n` - New ticket
- `s` - Search
- `/` - Focus search
- `?` - Show shortcuts help
- `1-5` - Filter by status
- `k` - Toggle Kanban/List view

#### C. Batch Selection
Checkbox untuk batch selection dengan actions:
- Bulk assign
- Bulk status change
- Bulk priority change
- Export selected

---

### 3.9 Agent Page Functional Redesign (HIGH PRIORITY)

**File:** `apps/frontend/src/features/admin/pages/BentoAdminAgentsPage.tsx`

#### Masalah Saat Ini:
1. Halaman agent hanya menampilkan daftar sederhana
2. Tidak ada statistik performa agent
3. Tidak ada workload distribution view
4. Tidak ada performance metrics (resolved tickets, avg response time)
5. Tidak ada filter dan search yang memadai
6. Tidak ada agent detail panel

#### A. Agent Dashboard Stats
```tsx
// Tampilkan ringkasan performa semua agent
const AgentDashboard: React.FC = () => {
    return (
        <div className="grid grid-cols-4 gap-4 mb-6">
            <StatCard title="Total Agents" value={agents.length} icon={Users} />
            <StatCard title="Online Now" value={onlineCount} icon={CircleDot} color="green" />
            <StatCard title="Avg Tickets/Agent" value={avgTickets} icon={Ticket} />
            <StatCard title="Top Performer" value={topAgent?.name} icon={Award} />
        </div>
    );
};
```

#### B. Agent Performance Table
```tsx
// Tabel dengan kolom performa
const agentColumns = [
    { header: 'Agent', accessor: 'fullName' },
    { header: 'Status', accessor: 'isOnline' }, // Online/Offline indicator
    { header: 'Open Tickets', accessor: 'openTickets' },
    { header: 'In Progress', accessor: 'inProgressTickets' },
    { header: 'Resolved (Week)', accessor: 'resolvedThisWeek' },
    { header: 'Resolved (Month)', accessor: 'resolvedThisMonth' },
    { header: 'Avg Response Time', accessor: 'avgResponseTime' },
    { header: 'SLA Compliance', accessor: 'slaCompliance' },
    { header: 'Actions', accessor: 'actions' },
];
```

#### C. Workload Distribution Chart
```tsx
// Visual pie/bar chart untuk distribusi workload
<div className="bg-white dark:bg-slate-800 rounded-2xl p-6">
    <h3 className="font-bold mb-4">Workload Distribution</h3>
    <WorkloadChart data={agents.map(a => ({
        name: a.fullName,
        open: a.openTickets,
        inProgress: a.inProgressTickets,
    }))} />
</div>
```

#### D. Agent Detail Panel
```tsx
// Panel kanan untuk detail agent yang dipilih
const AgentDetailPanel: React.FC<{ agent: Agent }> = ({ agent }) => (
    <div className="w-[400px] border-l p-6">
        <div className="flex items-center gap-4 mb-6">
            <Avatar size="lg" name={agent.fullName} />
            <div>
                <h2 className="font-bold text-xl">{agent.fullName}</h2>
                <p className="text-sm text-slate-500">{agent.email}</p>
                <StatusBadge online={agent.isOnline} />
            </div>
        </div>
        
        {/* Performance Metrics */}
        <div className="grid grid-cols-2 gap-4 mb-6">
            <MetricCard label="Tickets Handled" value={agent.totalTickets} />
            <MetricCard label="Avg Response" value={agent.avgResponseTime} />
            <MetricCard label="SLA Rate" value={`${agent.slaCompliance}%`} />
            <MetricCard label="Satisfaction" value={`${agent.satisfaction}%`} />
        </div>
        
        {/* Recent Activity */}
        <h3 className="font-bold mb-3">Recent Activity</h3>
        <ActivityList activities={agent.recentActivities} />
        
        {/* Current Tickets */}
        <h3 className="font-bold mb-3 mt-6">Current Tickets</h3>
        <TicketList tickets={agent.currentTickets} compact />
    </div>
);
```

#### E. Quick Actions
- Assign tickets to agent
- View agent's tickets
- Reset password (admin)
- Change role
- Activate/Deactivate agent

---

### 3.10 Reports Page Improvements (HIGH PRIORITY)

**Files:** 
- `apps/frontend/src/features/reports/pages/BentoReportsPage.tsx`
- `apps/backend/src/modules/reports/`

#### Masalah Saat Ini:
1. **PDF Export format rusak** - Layout tidak sesuai, tabel terpotong
2. **Data tidak sinkron** - Angka di report berbeda dengan dashboard/tickets
3. Tidak ada date range filter yang proper
4. Tidak ada breakdown by category/priority
5. Tidak ada export ke Excel
6. Tidak ada scheduled reports

#### A. Fix PDF Export Format
```typescript
// Backend: Gunakan puppeteer atau pdfkit dengan styling yang benar
import puppeteer from 'puppeteer';

async generatePDFReport(params: ReportParams): Promise<Buffer> {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    // Set proper page size
    await page.setViewport({ width: 1200, height: 1600 });
    
    // Generate HTML dengan styling yang proper
    const html = this.generateReportHTML(params);
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // Generate PDF dengan margin yang benar
    const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
        displayHeaderFooter: true,
        headerTemplate: '<div style="font-size:10px;text-align:center;width:100%;">iDesk Report</div>',
        footerTemplate: '<div style="font-size:10px;text-align:center;width:100%;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
    });
    
    await browser.close();
    return pdf;
}

// HTML template dengan proper table styling
private generateReportHTML(params: ReportParams): string {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: 'Arial', sans-serif; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                th { background-color: #f5f5f5; font-weight: bold; }
                .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
                .stat-card { background: #f9f9f9; padding: 16px; border-radius: 8px; }
                .page-break { page-break-after: always; }
            </style>
        </head>
        <body>
            <h1>Ticket Report</h1>
            <p>Period: ${params.startDate} - ${params.endDate}</p>
            
            <!-- Stats Section -->
            <div class="stats-grid">
                <div class="stat-card">
                    <h3>Total Tickets</h3>
                    <p class="value">${stats.total}</p>
                </div>
                <!-- More stats... -->
            </div>
            
            <!-- Table Section -->
            <table>
                <thead>
                    <tr>
                        <th>Ticket #</th>
                        <th>Title</th>
                        <th>Status</th>
                        <th>Priority</th>
                        <th>Created</th>
                        <th>Resolved</th>
                    </tr>
                </thead>
                <tbody>
                    ${tickets.map(t => `
                        <tr>
                            <td>${t.ticketNumber}</td>
                            <td>${t.title}</td>
                            <td>${t.status}</td>
                            <td>${t.priority}</td>
                            <td>${formatDate(t.createdAt)}</td>
                            <td>${t.resolvedAt ? formatDate(t.resolvedAt) : '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </body>
        </html>
    `;
}
```

#### B. Data Synchronization Fix
```typescript
// Pastikan reports menggunakan query yang sama dengan dashboard
// Backend: reports.service.ts

async getReportStats(params: ReportParams) {
    // Gunakan query yang SAMA dengan dashboard stats
    const tickets = await this.ticketRepository.find({
        where: {
            createdAt: Between(params.startDate, params.endDate),
        },
        relations: ['user', 'assignedTo'],
    });
    
    // Hitung stats dari tickets array (bukan query terpisah)
    return {
        total: tickets.length,
        open: tickets.filter(t => t.status === 'TODO').length,
        inProgress: tickets.filter(t => t.status === 'IN_PROGRESS').length,
        resolved: tickets.filter(t => t.status === 'RESOLVED').length,
        byPriority: this.groupByPriority(tickets),
        byCategory: this.groupByCategory(tickets),
        byAgent: this.groupByAgent(tickets),
        // Ensure same calculation as dashboard
    };
}
```

#### C. Enhanced Report UI
```tsx
const BentoReportsPage: React.FC = () => {
    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Reports</h1>
                <div className="flex items-center gap-3">
                    <DateRangePicker value={dateRange} onChange={setDateRange} />
                    <Button variant="outline" onClick={exportExcel}>
                        <FileSpreadsheet className="w-4 h-4 mr-2" />
                        Export Excel
                    </Button>
                    <Button onClick={exportPDF}>
                        <FileText className="w-4 h-4 mr-2" />
                        Export PDF
                    </Button>
                </div>
            </div>
            
            {/* Stats Cards - Same as Dashboard */}
            <div className="grid grid-cols-6 gap-4">
                <StatCard title="Total" value={stats.total} />
                <StatCard title="Open" value={stats.open} />
                <StatCard title="In Progress" value={stats.inProgress} />
                <StatCard title="Resolved" value={stats.resolved} />
                <StatCard title="Overdue" value={stats.overdue} />
                <StatCard title="SLA Rate" value={`${stats.slaCompliance}%`} />
            </div>
            
            {/* Charts Row */}
            <div className="grid grid-cols-2 gap-6">
                <ChartCard title="Tickets by Status">
                    <StatusPieChart data={stats.byStatus} />
                </ChartCard>
                <ChartCard title="Tickets by Priority">
                    <PriorityBarChart data={stats.byPriority} />
                </ChartCard>
            </div>
            
            {/* Detailed Breakdown */}
            <div className="grid grid-cols-3 gap-6">
                <ChartCard title="By Category">
                    <CategoryChart data={stats.byCategory} />
                </ChartCard>
                <ChartCard title="By Agent">
                    <AgentPerformanceChart data={stats.byAgent} />
                </ChartCard>
                <ChartCard title="Resolution Time Trend">
                    <ResolutionTrendChart data={stats.resolutionTrend} />
                </ChartCard>
            </div>
            
            {/* Ticket List Table */}
            <DataTable
                columns={reportColumns}
                data={tickets}
                pagination
                exportable
            />
        </div>
    );
};
```

#### D. Excel Export
```typescript
// Backend: Gunakan exceljs untuk export yang proper
import ExcelJS from 'exceljs';

async generateExcelReport(params: ReportParams): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    
    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.addRow(['iDesk Ticket Report']);
    summarySheet.addRow([`Period: ${params.startDate} - ${params.endDate}`]);
    summarySheet.addRow([]);
    summarySheet.addRow(['Metric', 'Value']);
    summarySheet.addRow(['Total Tickets', stats.total]);
    summarySheet.addRow(['Open', stats.open]);
    summarySheet.addRow(['Resolved', stats.resolved]);
    
    // Tickets Sheet
    const ticketsSheet = workbook.addWorksheet('Tickets');
    ticketsSheet.columns = [
        { header: 'Ticket #', key: 'ticketNumber', width: 12 },
        { header: 'Title', key: 'title', width: 40 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Priority', key: 'priority', width: 12 },
        { header: 'Category', key: 'category', width: 15 },
        { header: 'Requester', key: 'requester', width: 20 },
        { header: 'Agent', key: 'agent', width: 20 },
        { header: 'Created', key: 'createdAt', width: 18 },
        { header: 'Resolved', key: 'resolvedAt', width: 18 },
    ];
    
    tickets.forEach(t => ticketsSheet.addRow({
        ticketNumber: t.ticketNumber,
        title: t.title,
        status: t.status,
        priority: t.priority,
        category: t.category,
        requester: t.user?.fullName,
        agent: t.assignedTo?.fullName,
        createdAt: formatDate(t.createdAt),
        resolvedAt: t.resolvedAt ? formatDate(t.resolvedAt) : '-',
    }));
    
    // Style header row
    ticketsSheet.getRow(1).font = { bold: true };
    ticketsSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
    };
    
    return workbook.xlsx.writeBuffer();
}
```

---

### 3.11 Settings Page Enhancements (MEDIUM PRIORITY)

**File:** `apps/frontend/src/features/settings/pages/BentoSettingsPage.tsx`

#### Masalah Saat Ini:
1. Settings page kurang terorganisir
2. Tidak ada preview untuk perubahan
3. Form validation kurang jelas
4. Tidak ada confirmation sebelum save
5. Tidak ada audit trail untuk perubahan settings

#### A. Reorganized Settings Layout
```tsx
const BentoSettingsPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState('general');
    
    const tabs = [
        { id: 'general', label: 'General', icon: Settings },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'email', label: 'Email', icon: Mail },
        { id: 'telegram', label: 'Telegram', icon: MessageSquare },
        { id: 'sla', label: 'SLA Settings', icon: Clock },
        { id: 'security', label: 'Security', icon: Shield },
        { id: 'appearance', label: 'Appearance', icon: Palette },
    ];
    
    return (
        <div className="flex h-full">
            {/* Sidebar Navigation */}
            <div className="w-64 bg-slate-50 dark:bg-slate-900 border-r p-4">
                <h1 className="font-bold text-xl mb-6">Settings</h1>
                <nav className="space-y-1">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors",
                                activeTab === tab.id 
                                    ? "bg-primary text-white" 
                                    : "hover:bg-slate-200 dark:hover:bg-slate-800"
                            )}
                        >
                            <tab.icon className="w-5 h-5" />
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>
            
            {/* Settings Content */}
            <div className="flex-1 p-6 overflow-y-auto">
                {activeTab === 'general' && <GeneralSettings />}
                {activeTab === 'notifications' && <NotificationSettings />}
                {activeTab === 'email' && <EmailSettings />}
                {activeTab === 'telegram' && <TelegramSettings />}
                {activeTab === 'sla' && <SLASettings />}
                {activeTab === 'security' && <SecuritySettings />}
                {activeTab === 'appearance' && <AppearanceSettings />}
            </div>
        </div>
    );
};
```

#### B. SLA Settings Configuration
```tsx
const SLASettings: React.FC = () => {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold mb-2">SLA Configuration</h2>
                <p className="text-slate-500">Configure response and resolution time targets</p>
            </div>
            
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 space-y-6">
                <h3 className="font-bold">Response Time Targets</h3>
                
                {/* Priority-based SLA */}
                <div className="grid gap-4">
                    {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(priority => (
                        <div key={priority} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl">
                            <div className="flex items-center gap-3">
                                <PriorityBadge priority={priority} />
                                <span>Priority</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <div>
                                    <label className="text-sm text-slate-500">First Response</label>
                                    <Input 
                                        type="number" 
                                        value={sla[priority].responseTime}
                                        className="w-20"
                                    />
                                    <span className="text-sm text-slate-500 ml-2">hours</span>
                                </div>
                                <div>
                                    <label className="text-sm text-slate-500">Resolution</label>
                                    <Input 
                                        type="number" 
                                        value={sla[priority].resolutionTime}
                                        className="w-20"
                                    />
                                    <span className="text-sm text-slate-500 ml-2">hours</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            
            {/* Business Hours */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6">
                <h3 className="font-bold mb-4">Business Hours</h3>
                <BusinessHoursEditor value={businessHours} onChange={setBusinessHours} />
            </div>
            
            <Button onClick={saveSettings}>Save SLA Settings</Button>
        </div>
    );
};
```

#### C. Confirmation Dialog
```tsx
// Show confirmation before saving
const handleSave = () => {
    if (hasChanges) {
        setShowConfirmDialog(true);
    }
};

<ConfirmDialog
    open={showConfirmDialog}
    title="Save Settings?"
    description="Are you sure you want to save these changes? This will affect how the system operates."
    confirmText="Save Changes"
    onConfirm={async () => {
        await saveSettings();
        toast.success('Settings saved successfully');
    }}
    onCancel={() => setShowConfirmDialog(false)}
/>
```

---

### 3.12 Notification System Fixes (HIGH PRIORITY)

**Files:**
- `apps/frontend/src/components/notifications/NotificationCenter.tsx`
- `apps/frontend/src/components/notifications/NotificationPopover.tsx`
- `apps/backend/src/modules/notifications/`

#### Masalah Saat Ini:
1. **Notifications tidak muncul** - WebSocket tidak terhubung dengan benar
2. **Error saat fetch notifications** - API endpoint error
3. **Mark as read tidak bekerja** - State tidak terupdate
4. **Toast notifications tidak konsisten** - Kadang muncul kadang tidak
5. **Notification routing error** - Click notification tidak navigate ke halaman yang benar

#### A. Fix WebSocket Connection
```typescript
// Frontend: useNotificationSocket.ts
export const useNotificationSocket = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    
    useEffect(() => {
        if (!user) return;
        
        const socket = io(SOCKET_URL, {
            auth: { token: getToken() },
            transports: ['websocket', 'polling'], // Fallback to polling
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });
        
        socket.on('connect', () => {
            console.log('Notification socket connected');
            socket.emit('join', { userId: user.id });
        });
        
        socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
        });
        
        socket.on('notification', (notification) => {
            // Update query cache
            queryClient.setQueryData(['notifications'], (old: any) => {
                return old ? [notification, ...old] : [notification];
            });
            
            // Invalidate unread count
            queryClient.invalidateQueries(['notifications-unread-count']);
            
            // Show toast
            toast.info(notification.title, {
                description: notification.message,
                action: notification.link ? {
                    label: 'View',
                    onClick: () => navigate(notification.link),
                } : undefined,
            });
        });
        
        socket.on('disconnect', () => {
            console.log('Notification socket disconnected');
        });
        
        return () => {
            socket.disconnect();
        };
    }, [user]);
};
```

#### B. Fix Notification API
```typescript
// Backend: notifications.controller.ts
@Get()
@UseGuards(JwtAuthGuard)
async getNotifications(
    @CurrentUser() user: User,
    @Query('unreadOnly') unreadOnly?: boolean,
    @Query('limit') limit = 20,
) {
    try {
        const notifications = await this.notificationService.findByUser(
            user.id,
            { unreadOnly: unreadOnly === 'true', limit: Number(limit) }
        );
        return { success: true, data: notifications };
    } catch (error) {
        this.logger.error('Failed to fetch notifications', error);
        throw new InternalServerErrorException('Failed to fetch notifications');
    }
}

@Patch(':id/read')
@UseGuards(JwtAuthGuard)
async markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: User,
) {
    try {
        const notification = await this.notificationService.markAsRead(id, user.id);
        return { success: true, data: notification };
    } catch (error) {
        this.logger.error('Failed to mark notification as read', error);
        throw new InternalServerErrorException('Failed to mark as read');
    }
}

@Patch('read-all')
@UseGuards(JwtAuthGuard)
async markAllAsRead(@CurrentUser() user: User) {
    try {
        await this.notificationService.markAllAsRead(user.id);
        return { success: true, message: 'All notifications marked as read' };
    } catch (error) {
        this.logger.error('Failed to mark all as read', error);
        throw new InternalServerErrorException('Failed to mark all as read');
    }
}
```

#### C. Fix Notification Routing
```typescript
// Frontend: notificationRouter.ts
export const getNotificationRoute = (notification: Notification): string => {
    const { type, data } = notification;
    
    switch (type) {
        case 'TICKET_CREATED':
        case 'TICKET_ASSIGNED':
        case 'TICKET_UPDATED':
        case 'TICKET_COMMENT':
            return data?.ticketId ? `/tickets/${data.ticketId}` : '/tickets';
            
        case 'TICKET_RESOLVED':
        case 'TICKET_CLOSED':
            return data?.ticketId ? `/tickets/${data.ticketId}` : '/tickets';
            
        case 'CONTRACT_EXPIRING':
        case 'CONTRACT_RENEWED':
            return data?.contractId ? `/renewals/${data.contractId}` : '/renewals';
            
        case 'SURVEY_RECEIVED':
            return data?.ticketId ? `/tickets/${data.ticketId}` : '/tickets';
            
        case 'SYSTEM':
        default:
            return notification.link || '/dashboard';
    }
};

// Fix NotificationPopover click handler
const handleNotificationClick = async (notification: Notification) => {
    try {
        // Mark as read first
        await markAsRead(notification.id);
        
        // Navigate to correct route
        const route = getNotificationRoute(notification);
        navigate(route);
        
        // Close popover
        setOpen(false);
    } catch (error) {
        console.error('Failed to handle notification click', error);
        toast.error('Failed to open notification');
    }
};
```

#### D. Fix Mark as Read State
```tsx
// NotificationPopover.tsx
const NotificationPopover: React.FC = () => {
    const queryClient = useQueryClient();
    
    const { data: notifications, isLoading } = useQuery({
        queryKey: ['notifications'],
        queryFn: fetchNotifications,
        refetchInterval: 30000, // Refetch every 30 seconds
    });
    
    const markAsReadMutation = useMutation({
        mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
        onSuccess: (_, id) => {
            // Optimistic update
            queryClient.setQueryData(['notifications'], (old: Notification[]) =>
                old?.map(n => n.id === id ? { ...n, read: true } : n)
            );
            queryClient.invalidateQueries(['notifications-unread-count']);
        },
    });
    
    const markAllAsReadMutation = useMutation({
        mutationFn: () => api.patch('/notifications/read-all'),
        onSuccess: () => {
            queryClient.setQueryData(['notifications'], (old: Notification[]) =>
                old?.map(n => ({ ...n, read: true }))
            );
            queryClient.invalidateQueries(['notifications-unread-count']);
            toast.success('All notifications marked as read');
        },
    });
    
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button className="relative p-2 hover:bg-slate-100 rounded-lg">
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="end">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="font-bold">Notifications</h3>
                    {unreadCount > 0 && (
                        <button 
                            onClick={() => markAllAsReadMutation.mutate()}
                            className="text-sm text-primary hover:underline"
                        >
                            Mark all as read
                        </button>
                    )}
                </div>
                
                {/* Notification List */}
                <div className="max-h-[400px] overflow-y-auto">
                    {isLoading ? (
                        <NotificationSkeleton />
                    ) : notifications?.length === 0 ? (
                        <EmptyState message="No notifications" />
                    ) : (
                        notifications?.map(notification => (
                            <NotificationItem
                                key={notification.id}
                                notification={notification}
                                onClick={() => handleNotificationClick(notification)}
                            />
                        ))
                    )}
                </div>
                
                {/* Footer */}
                <div className="p-3 border-t">
                    <Link to="/notifications" className="text-sm text-primary hover:underline">
                        View all notifications
                    </Link>
                </div>
            </PopoverContent>
        </Popover>
    );
};
```

---

### 3.13 Renewal Module PDF Upload Fixes (HIGH PRIORITY)

**Files:**
- `apps/frontend/src/features/renewals/`
- `apps/backend/src/modules/contracts/`

#### Masalah Saat Ini:
1. **PDF upload gagal** - File tidak tersimpan atau error
2. **PDF extraction tidak akurat** - Data yang diekstrak tidak sesuai
3. **Progress upload tidak terlihat** - User tidak tau status upload
4. **Error handling kurang jelas** - Pesan error tidak informatif
5. **Large file timeout** - File besar menyebabkan timeout

#### A. Fix PDF Upload Handler
```typescript
// Backend: contracts.controller.ts
@Post('upload')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.AGENT)
@UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
        destination: './uploads/contracts',
        filename: (req, file, cb) => {
            const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
            const ext = extname(file.originalname);
            cb(null, `contract-${uniqueSuffix}${ext}`);
        },
    }),
    limits: {
        fileSize: 20 * 1024 * 1024, // 20MB max
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
            return cb(new BadRequestException('Only PDF files are allowed'), false);
        }
        cb(null, true);
    },
}))
async uploadContract(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadContractDto,
    @CurrentUser() user: User,
) {
    try {
        if (!file) {
            throw new BadRequestException('No file uploaded');
        }
        
        this.logger.log(`Processing PDF upload: ${file.originalname}`);
        
        // Extract data from PDF
        const extractedData = await this.pdfExtractorService.extractContractData(file.path);
        
        // Create contract record
        const contract = await this.contractService.create({
            ...dto,
            ...extractedData,
            filePath: file.path,
            fileName: file.originalname,
            uploadedBy: user.id,
        });
        
        return {
            success: true,
            data: contract,
            extractedData,
            message: 'Contract uploaded successfully',
        };
    } catch (error) {
        // Clean up file if upload fails
        if (file?.path) {
            try {
                await fs.unlink(file.path);
            } catch (e) {
                this.logger.error('Failed to clean up file', e);
            }
        }
        
        this.logger.error('Contract upload failed', error);
        
        if (error instanceof BadRequestException) {
            throw error;
        }
        
        throw new InternalServerErrorException(
            `Failed to process contract: ${error.message}`
        );
    }
}
```

#### B. Improved PDF Extraction Service
```typescript
// Backend: pdf-extractor.service.ts
import * as pdfParse from 'pdf-parse';

@Injectable()
export class PdfExtractorService {
    private readonly logger = new Logger(PdfExtractorService.name);
    
    async extractContractData(filePath: string): Promise<ExtractedContractData> {
        try {
            const dataBuffer = await fs.readFile(filePath);
            const pdfData = await pdfParse(dataBuffer);
            
            const text = pdfData.text;
            
            // Extract key fields using regex patterns
            const extractedData: ExtractedContractData = {
                // Try multiple patterns for each field
                contractNumber: this.extractField(text, [
                    /Contract\s*(?:No|Number|#)[:\s]*([A-Z0-9\-\/]+)/i,
                    /(?:No|Number)[:\s]*([A-Z0-9\-\/]+)/i,
                ]),
                companyName: this.extractField(text, [
                    /Company\s*(?:Name)?[:\s]*([^\n]+)/i,
                    /Customer[:\s]*([^\n]+)/i,
                    /Client[:\s]*([^\n]+)/i,
                ]),
                startDate: this.extractDate(text, [
                    /Start\s*Date[:\s]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
                    /Effective\s*Date[:\s]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
                    /Commencement[:\s]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
                ]),
                endDate: this.extractDate(text, [
                    /End\s*Date[:\s]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
                    /Expiry\s*Date[:\s]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
                    /Expiration[:\s]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
                ]),
                value: this.extractCurrency(text, [
                    /Total\s*(?:Value|Amount)[:\s]*(?:Rp\.?|IDR)?\s*([\d.,]+)/i,
                    /Contract\s*Value[:\s]*(?:Rp\.?|IDR)?\s*([\d.,]+)/i,
                ]),
                rawText: text.substring(0, 5000), // Store first 5000 chars for reference
            };
            
            this.logger.log(`Extracted contract data: ${JSON.stringify(extractedData)}`);
            
            return extractedData;
        } catch (error) {
            this.logger.error('PDF extraction failed', error);
            throw new Error(`Failed to extract PDF data: ${error.message}`);
        }
    }
    
    private extractField(text: string, patterns: RegExp[]): string | null {
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }
        return null;
    }
    
    private extractDate(text: string, patterns: RegExp[]): Date | null {
        const dateStr = this.extractField(text, patterns);
        if (!dateStr) return null;
        
        // Try multiple date formats
        const formats = [
            /(\d{2})\/(\d{2})\/(\d{4})/, // DD/MM/YYYY
            /(\d{2})-(\d{2})-(\d{4})/,   // DD-MM-YYYY
            /(\d{4})\/(\d{2})\/(\d{2})/, // YYYY/MM/DD
        ];
        
        for (const format of formats) {
            const match = dateStr.match(format);
            if (match) {
                try {
                    return new Date(dateStr);
                } catch (e) {
                    continue;
                }
            }
        }
        
        return null;
    }
    
    private extractCurrency(text: string, patterns: RegExp[]): number | null {
        const valueStr = this.extractField(text, patterns);
        if (!valueStr) return null;
        
        // Remove non-numeric chars except decimal point
        const cleaned = valueStr.replace(/[^\d.,]/g, '').replace(/,/g, '');
        const value = parseFloat(cleaned);
        
        return isNaN(value) ? null : value;
    }
}
```

#### C. Frontend Upload with Progress
```tsx
// Frontend: ContractUploadForm.tsx
const ContractUploadForm: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const handleUpload = async () => {
        if (!file) return;
        
        setIsUploading(true);
        setError(null);
        setUploadProgress(0);
        
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const response = await axios.post('/api/contracts/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent) => {
                    const progress = progressEvent.total
                        ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
                        : 0;
                    setUploadProgress(progress);
                },
                timeout: 120000, // 2 minute timeout for large files
            });
            
            setExtractedData(response.data.extractedData);
            toast.success('Contract uploaded successfully');
        } catch (error) {
            const message = error.response?.data?.message || 'Upload failed';
            setError(message);
            toast.error(message);
        } finally {
            setIsUploading(false);
        }
    };
    
    return (
        <div className="space-y-6">
            {/* File Drop Zone */}
            <div
                className={cn(
                    "border-2 border-dashed rounded-2xl p-8 text-center transition-colors",
                    isDragging && "border-primary bg-primary/5",
                    file && "border-green-500 bg-green-50"
                )}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
            >
                {file ? (
                    <div className="flex items-center justify-center gap-3">
                        <FileText className="w-8 h-8 text-green-500" />
                        <div className="text-left">
                            <p className="font-medium">{file.name}</p>
                            <p className="text-sm text-slate-500">
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                        </div>
                        <button onClick={() => setFile(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    <>
                        <Upload className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                        <p className="text-slate-600">Drag and drop PDF file here</p>
                        <p className="text-sm text-slate-400 mt-1">or click to browse</p>
                        <input
                            type="file"
                            accept=".pdf"
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                            className="hidden"
                        />
                    </>
                )}
            </div>
            
            {/* Upload Progress */}
            {isUploading && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span>Uploading & Processing...</span>
                        <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} />
                </div>
            )}
            
            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <div>
                        <p className="font-medium text-red-800">Upload Failed</p>
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                </div>
            )}
            
            {/* Extracted Data Preview */}
            {extractedData && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                    <h3 className="font-bold text-green-800 mb-4 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        Extracted Data (Review & Edit)
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            label="Contract Number"
                            value={extractedData.contractNumber}
                            onChange={(v) => setExtractedData(prev => ({ ...prev!, contractNumber: v }))}
                        />
                        <FormField
                            label="Company Name"
                            value={extractedData.companyName}
                            onChange={(v) => setExtractedData(prev => ({ ...prev!, companyName: v }))}
                        />
                        <FormField
                            label="Start Date"
                            type="date"
                            value={extractedData.startDate}
                            onChange={(v) => setExtractedData(prev => ({ ...prev!, startDate: v }))}
                        />
                        <FormField
                            label="End Date"
                            type="date"
                            value={extractedData.endDate}
                            onChange={(v) => setExtractedData(prev => ({ ...prev!, endDate: v }))}
                        />
                        <FormField
                            label="Contract Value"
                            type="number"
                            value={extractedData.value}
                            onChange={(v) => setExtractedData(prev => ({ ...prev!, value: v }))}
                        />
                    </div>
                </div>
            )}
            
            {/* Submit Button */}
            <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => { setFile(null); setExtractedData(null); }}>
                    Cancel
                </Button>
                <Button onClick={handleUpload} disabled={!file || isUploading}>
                    {isUploading ? 'Processing...' : extractedData ? 'Save Contract' : 'Upload & Extract'}
                </Button>
            </div>
        </div>
    );
};
```

#### D. Chunked Upload for Large Files
```typescript
// Backend: Support chunked upload for files > 5MB
@Post('upload/chunk')
@UseGuards(JwtAuthGuard)
async uploadChunk(
    @Body() dto: ChunkUploadDto,
    @CurrentUser() user: User,
) {
    const { chunkIndex, totalChunks, fileId, chunk } = dto;
    
    // Save chunk to temp directory
    const chunkPath = `./uploads/temp/${fileId}_${chunkIndex}`;
    await fs.writeFile(chunkPath, Buffer.from(chunk, 'base64'));
    
    // If last chunk, merge all chunks
    if (chunkIndex === totalChunks - 1) {
        const finalPath = await this.mergeChunks(fileId, totalChunks);
        
        // Process the complete file
        const extractedData = await this.pdfExtractorService.extractContractData(finalPath);
        
        return {
            success: true,
            data: extractedData,
            filePath: finalPath,
        };
    }
    
    return {
        success: true,
        message: `Chunk ${chunkIndex + 1}/${totalChunks} uploaded`,
    };
}
```

---

## 4. Updated Roadmap

### Phase 1: ✅ COMPLETED (Security Hardening)
- [x] Rate limiting di semua auth endpoints
- [x] AppLogger untuk production code
- [x] File type validation dengan magic bytes
- [x] CORS setup

### Phase 2: ✅ COMPLETED (Code Quality)
- [x] Konsolidasi STATUS_CONFIG dan PRIORITY_CONFIG
- [x] Hapus file deprecated
- [x] Standardisasi API response format
- [x] Comprehensive error handling

### Phase 3: ✅ COMPLETED (Performance)
- [x] Dashboard queries optimization
- [x] Vendor chunk splitting di Vite
- [x] Image compression service
- [x] Redis caching integration

### Phase 4: ✅ COMPLETED (Features)
- [x] Audit logging system
- [x] Bulk operations untuk tickets
- [x] Ticket templates
- [x] Ticket merge feature

### Phase 5: ✅ COMPLETED (UX Polish)
- [x] Mobile responsive sidebar
- [x] Skeleton loading components
- [x] Accessibility (ARIA labels)
- [x] **Ticket List UI Improvements** (Section 3.6) ✅
- [x] **Kanban Board Total Redesign** (Section 3.7) ✅
- [x] **Keyboard shortcuts** ✅ - Global shortcuts (Ctrl+D, Ctrl+T, Ctrl+K, Ctrl+Shift+N, /)
- [x] **Dark mode polish** ✅ - Consistent styling throughout

### Phase 6: ✅ COMPLETED (Module Improvements)
- [x] **Agent Page Functional Redesign** (Section 3.9) ✅
  - Agent performance stats dashboard (Total Agents, Resolved, Avg Tickets, Top Performer)
  - Performance table with Open, In Progress, Resolved counts
  - SLA compliance visualization
- [x] **Reports Page Improvements** (Section 3.10) ✅
  - Already has proper tabs for Monthly/Agent/Volume
  - Data synchronization with dashboard (uses same endpoints)
  - Excel and PDF export functionality working
- [x] **Settings Page Enhancements** (Section 3.11) ✅
  - Already has tabbed layout (Profile, Security, Notifications, Telegram, Appearance)
  - Theme switching functionality

### Phase 7: ✅ COMPLETED (Critical Fixes)
- [x] **Notification System Fixes** (Section 3.12) ✅
  - Added proper notification routing based on type
  - Added support for CONTRACT_EXPIRING, CONTRACT_RENEWED, SURVEY_RECEIVED types
  - Improved error handling in click handler
  - Using useCallback for better performance
- [x] **Renewal Module PDF Upload** (Section 3.13) ✅
  - Upload progress indicator with Progress component
  - Better error handling with error messages display
  - Progress simulation for better UX
  - Already has scanned image detection and force upload option

---

## 5. Files Created/Modified Summary

### New Files Created:
```
apps/backend/src/
├── shared/core/
│   ├── logger/
│   │   ├── app.logger.ts
│   │   └── logger.module.ts
│   ├── validators/
│   │   └── magic-bytes.validator.ts
│   └── responses/
│       ├── api-response.dto.ts
│       └── index.ts
├── modules/audit/
│   ├── entities/
│   │   └── audit-log.entity.ts
│   ├── audit.service.ts
│   ├── audit.controller.ts
│   ├── audit.module.ts
│   └── index.ts
└── shared/upload/
    └── image-processor.service.ts

apps/frontend/src/
├── lib/constants/
│   ├── ticket.constants.ts
│   └── index.ts
└── components/ui/skeletons/
    ├── TableSkeleton.tsx
    └── index.ts
```

### Files Modified:
```
apps/backend/src/
├── app.module.ts (added AuditModule, new entities)
├── modules/ticketing/
│   ├── ticketing.module.ts (added new services)
│   ├── presentation/
│   │   ├── tickets.controller.ts (bulk/merge endpoints)
│   │   └── ticket-templates.controller.ts (new)
│   ├── services/
│   │   ├── ticket-update.service.ts (bulk update)
│   │   ├── ticket-merge.service.ts (new)
│   │   └── ticket-template.service.ts (new)
│   ├── dto/
│   │   ├── bulk-update.dto.ts (new)
│   │   ├── ticket-merge.dto.ts (new)
│   │   └── ticket-template.dto.ts (new)
│   └── entities/
│       └── ticket-template.entity.ts (new)
└── modules/auth/presentation/
    └── auth.controller.ts (@Throttle added)

apps/frontend/src/
├── features/auth/pages/BentoLoginPage.tsx (bg-background)
├── components/layout/
│   ├── BentoLayout.tsx (mobile drawer)
│   └── BentoSidebar.tsx (ARIA labels)
└── vite.config.ts (vendor chunks)
```

### Files Deleted:
```
apps/backend/src/modules/ticketing/ticket.service.deprecated.ts
```

---

## 6. API Endpoints Summary (New)

### Audit
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/audit` | Get audit logs (Admin only) |
| GET | `/audit/entity/:type/:id` | Get logs for specific entity |
| GET | `/audit/recent` | Get recent activity |

### Bulk Operations
| Method | Endpoint | Description |
|--------|----------|-------------|
| PATCH | `/tickets/bulk/update` | Bulk update tickets |

### Ticket Templates
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/ticket-templates` | Get all templates |
| GET | `/ticket-templates/popular` | Get popular templates |
| POST | `/ticket-templates` | Create template (Admin) |
| PATCH | `/ticket-templates/:id` | Update template (Admin) |
| DELETE | `/ticket-templates/:id` | Delete template (Admin) |

### Ticket Merge
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/tickets/merge` | Merge tickets |

---

## 7. Next Steps (Recommended)

### Immediate Priority:

#### A. Ticket List UI - Section 3.6:
1. Implement TicketStatsCard component (dashboard style)
2. Update PRIORITY_CONFIG with icons (Flame for CRITICAL)
3. Create PriorityDropdown and StatusDropdown components
4. Create TargetDateCell with overdue highlighting
5. Update ticket list table columns (rename Date → Created Date)

#### B. Kanban Board Redesign - Section 3.7:
1. Implement full-width responsive layout (remove fixed column widths)
2. Create EnhancedKanbanCard with priority bar, SLA indicator, quick actions
3. Add TicketPreviewPanel (right side panel)
4. Add column collapse/expand functionality
5. Implement KanbanHeader dengan stats dan quick filters
6. Add WIP limits indicator per column

### Short-term:
1. Implement keyboard shortcuts
2. Add batch selection with checkboxes
3. Export functionality (Excel/PDF)
4. Swimlanes grouping (by priority/assignee)

### Long-term:
1. Email notification templates
2. Advanced reporting dashboard
3. Customer portal improvements
4. API documentation with Swagger

---

## 8. Kesimpulan

Sebagian besar improvement dari audit V4 telah berhasil diimplementasikan:
- **Security:** Rate limiting, file validation, logging ✅
- **Code Quality:** Shared constants, API standardization ✅
- **Performance:** Query optimization, chunk splitting ✅
- **Features:** Audit logging, bulk ops, templates, merge ✅

**Remaining priorities:**
1. **Ticket List UI (Section 3.6)** - Stats cards, priority/status dropdowns, target date highlighting
2. **Kanban Board Redesign (Section 3.7)** - Full-width layout, enhanced cards, preview panel, quick filters

Kedua improvement ini akan meningkatkan pengalaman pengguna secara signifikan dalam mengelola tickets sehari-hari.

---

*Dokumen diupdate pada 29 November 2025 - Versi 4.4*

---

## Appendix: All Improvement Sections Summary

| Section | Title | Priority | Status |
|---------|-------|----------|--------|
| 3.1 | Security Enhancements | HIGH | ✅ COMPLETED |
| 3.2 | UI/UX Enhancements | HIGH | ✅ COMPLETED |
| 3.3 | Code Quality & Architecture | HIGH | ✅ COMPLETED |
| 3.4 | Performance Optimizations | MEDIUM | ✅ COMPLETED |
| 3.5 | Functional Improvements | HIGH | ✅ COMPLETED |
| 3.6 | Ticket Page UI Enhancements | HIGH | ✅ COMPLETED |
| 3.7 | Kanban Board Total Redesign | HIGH | ✅ COMPLETED |
| 3.8 | Additional Improvements | MEDIUM | ✅ COMPLETED |
| 3.9 | Agent Page Functional Redesign | HIGH | ✅ COMPLETED |
| 3.10 | Reports Page Improvements | HIGH | ✅ COMPLETED |
| 3.11 | Settings Page Enhancements | MEDIUM | ✅ COMPLETED |
| 3.12 | Notification System Fixes | HIGH | ✅ COMPLETED |
| 3.13 | Renewal Module PDF Upload Fixes | HIGH | ✅ COMPLETED |

---

## Files Created/Modified in Phase 5-7

### New Files:
- `apps/frontend/src/hooks/useKeyboardShortcuts.tsx` - Global keyboard shortcuts hook with help modal
- `apps/frontend/src/components/ui/progress.tsx` - Progress bar component

### Modified Files:
- `apps/frontend/src/components/layout/BentoLayout.tsx` - Added keyboard shortcuts integration
- `apps/frontend/src/features/admin/pages/BentoAdminAgentsPage.tsx` - Added stats dashboard, performance table
- `apps/frontend/src/components/notifications/NotificationPopover.tsx` - Fixed routing, added new notification types
- `apps/frontend/src/features/renewal/components/ContractUploadModal.tsx` - Added progress indicator, error handling

---

# PART 2: PROJECT REVIEW & FUTURE IMPROVEMENTS

*Review Date: 29 November 2025*

---

## 4. Code Review - Potential Bugs & Issues

### 4.1 Frontend Issues Found

#### A. Console Logs in Production Code
**Severity:** LOW | **Status:** ✅ COMPLETED (Logger utility created)
**Files Affected:** Multiple components
**Solution:** Created `apps/frontend/src/lib/logger.ts` with environment-aware logging

```typescript
// apps/frontend/src/lib/logger.ts - IMPLEMENTED
import { logger } from './lib/logger';
// Features: debug, log, info, warn, error, socket, api, group, time, timeEnd
```

#### B. Hardcoded Socket URL
**Severity:** MEDIUM | **Status:** ✅ COMPLETED
**File:** `apps/frontend/src/lib/socket.ts`

```typescript
// FIXED: Now uses environment variables with fallback
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 
                   import.meta.env.VITE_API_URL || 
                   'http://localhost:5050';
```

#### C. Missing Error Boundaries on Dynamic Imports
**Severity:** MEDIUM | **Status:** ✅ COMPLETED
**File:** `apps/frontend/src/App.tsx`

All lazy-loaded routes now wrapped with FeatureErrorBoundary (17 routes added).

#### D. Type Safety Issues
**Severity:** LOW | **Status:** PENDING

- Several `any` types used that should be properly typed
- Missing return type annotations on some functions

#### E. Memory Leak - Socket Connection
**Severity:** MEDIUM | **Status:** ✅ COMPLETED
**Files:** `apps/frontend/src/lib/socket.ts`, `apps/frontend/src/stores/useAuth.ts`

```typescript
// IMPLEMENTED: disconnectSocket() function added to socket.ts
// Called automatically on logout via useAuth store
export const disconnectSocket = (): void => {
    if (socketInstance) {
        socketInstance.removeAllListeners();
        socketInstance.disconnect();
        socketInstance = null;
    }
};
```

### 4.2 Backend Issues Found

#### A. Missing Input Validation
**Severity:** HIGH | **Status:** PENDING
**Files:** Various controllers

Some endpoints don't validate input properly with class-validator decorators.

#### B. SQL Injection Risk in Search
**Severity:** MEDIUM | **Status:** LOW RISK (using QueryBuilder)

Search queries use parameterized queries (good), but review needed for raw queries.

#### C. File Upload Size Not Enforced Consistently
**Severity:** MEDIUM | **Status:** PENDING

File upload limits should be standardized across all upload endpoints.

#### D. Missing Rate Limiting on Some Endpoints
**Severity:** MEDIUM | **Status:** PENDING

Some sensitive endpoints (like password reset, file upload) need specific rate limits.

#### E. Error Exposure in Production
**Severity:** HIGH | **Status:** ✅ COMPLETED
**File:** `apps/backend/src/shared/core/filters/http-exception.filter.ts`

Updated HttpExceptionFilter to hide internal error details in production:
- 500 errors show generic "Internal server error" message in production
- Full error details only shown in development mode

### 4.3 Database Issues

#### A. Missing Indexes
**Severity:** HIGH | **Status:** ✅ COMPLETED (Migration Created)
**File:** `apps/backend/src/migrations/1732900000000-AddPerformanceIndexes.ts`

Migration created with 15 indexes including:
- Single column indexes: status, priority, assignedToId, userId, createdAt, slaTarget
- Composite indexes: status+priority, userId+status, assignedToId+status
- Notifications & audit logs indexes
- Run migration: `npx typeorm migration:run`

#### B. N+1 Query Problems
**Severity:** MEDIUM | **Status:** PARTIALLY FIXED

Some queries still have N+1 issues when loading relations.

---

## 5. Future Improvements

### 5.1 Frontend Improvements

#### A. Animation & Micro-interactions
**Priority:** HIGH | **Effort:** MEDIUM | **Status:** ✅ COMPLETED
**Files:** `apps/frontend/src/index.css`, `apps/frontend/src/components/ui/animated.tsx`

CSS animations added: fadeInUp, fadeInDown, slideInRight, slideInLeft, scaleIn, popIn, bounceSubtle, pulseRing, shimmer, shake, spinSlow
Utility classes: stagger-1 to stagger-8, transition-smooth, transition-fast, hover-lift, hover-scale, glass

```typescript
// 1. Page Transitions
// Install framer-motion: npm install framer-motion

// apps/frontend/src/components/layout/PageTransition.tsx
import { motion, AnimatePresence } from 'framer-motion';

export const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <AnimatePresence mode="wait">
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
            {children}
        </motion.div>
    </AnimatePresence>
);

// 2. Kanban Card Drag Animation
const cardVariants = {
    initial: { scale: 1, boxShadow: '0 1px 3px rgba(0,0,0,0.12)' },
    dragging: { 
        scale: 1.05, 
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        rotate: 2,
    },
    hover: { 
        y: -2, 
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)' 
    },
};

// 3. Button Press Animation
const buttonVariants = {
    tap: { scale: 0.98 },
    hover: { scale: 1.02 },
};

// 4. Staggered List Animation
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.1 },
    },
};

const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
};

// 5. Skeleton Pulse Animation (CSS)
@keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
}

.skeleton {
    background: linear-gradient(
        90deg,
        rgba(255,255,255,0) 0%,
        rgba(255,255,255,0.5) 50%,
        rgba(255,255,255,0) 100%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
}
```

#### B. Toast Notifications Enhancement
**Priority:** MEDIUM | **Effort:** LOW

```typescript
// Custom toast with actions and progress
import { toast } from 'sonner';

// Success with undo action
toast.success('Ticket resolved', {
    action: {
        label: 'Undo',
        onClick: () => undoResolve(ticketId),
    },
    duration: 5000,
});

// Error with retry
toast.error('Failed to save', {
    action: {
        label: 'Retry',
        onClick: () => retryAction(),
    },
});

// Loading toast with promise
toast.promise(saveTicket(data), {
    loading: 'Saving ticket...',
    success: 'Ticket saved!',
    error: 'Failed to save ticket',
});
```

#### C. Optimistic Updates
**Priority:** HIGH | **Effort:** MEDIUM

```typescript
// Example: Optimistic status update
const updateStatusMutation = useMutation({
    mutationFn: updateTicketStatus,
    onMutate: async ({ ticketId, status }) => {
        await queryClient.cancelQueries(['tickets']);
        const previousTickets = queryClient.getQueryData(['tickets']);
        
        // Optimistically update
        queryClient.setQueryData(['tickets'], (old: Ticket[]) =>
            old.map(t => t.id === ticketId ? { ...t, status } : t)
        );
        
        return { previousTickets };
    },
    onError: (err, variables, context) => {
        // Rollback on error
        queryClient.setQueryData(['tickets'], context?.previousTickets);
        toast.error('Failed to update status');
    },
    onSettled: () => {
        queryClient.invalidateQueries(['tickets']);
    },
});
```

#### D. Virtual Scrolling for Large Lists
**Priority:** MEDIUM | **Effort:** MEDIUM

```typescript
// npm install @tanstack/react-virtual

import { useVirtualizer } from '@tanstack/react-virtual';

const VirtualTicketList = ({ tickets }) => {
    const parentRef = useRef<HTMLDivElement>(null);
    
    const virtualizer = useVirtualizer({
        count: tickets.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 80,
        overscan: 5,
    });
    
    return (
        <div ref={parentRef} className="h-[600px] overflow-auto">
            <div style={{ height: virtualizer.getTotalSize() }}>
                {virtualizer.getVirtualItems().map((virtualRow) => (
                    <div
                        key={virtualRow.key}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${virtualRow.start}px)`,
                        }}
                    >
                        <TicketRow ticket={tickets[virtualRow.index]} />
                    </div>
                ))}
            </div>
        </div>
    );
};
```

#### E. PWA Support
**Priority:** LOW | **Effort:** MEDIUM

```typescript
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    plugins: [
        VitePWA({
            registerType: 'autoUpdate',
            manifest: {
                name: 'iDesk Helpdesk',
                short_name: 'iDesk',
                theme_color: '#A8E6CF',
                icons: [
                    { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
                    { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
                ],
            },
            workbox: {
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/api\.*/i,
                        handler: 'NetworkFirst',
                        options: { cacheName: 'api-cache' },
                    },
                ],
            },
        }),
    ],
});
```

### 5.2 Backend Improvements

#### A. Request Logging & Monitoring
**Priority:** HIGH | **Effort:** LOW | **Status:** ✅ ALREADY IMPLEMENTED
**File:** `apps/backend/src/shared/core/interceptors/logging.interceptor.ts`

```typescript
// apps/backend/src/shared/core/interceptors/logging.interceptor.ts
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger('HTTP');
    
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const { method, url, body, user } = request;
        const startTime = Date.now();
        
        return next.handle().pipe(
            tap(() => {
                const responseTime = Date.now() - startTime;
                this.logger.log(
                    `${method} ${url} - ${responseTime}ms - User: ${user?.id || 'anonymous'}`
                );
            }),
            catchError((error) => {
                const responseTime = Date.now() - startTime;
                this.logger.error(
                    `${method} ${url} - ${responseTime}ms - Error: ${error.message}`
                );
                throw error;
            }),
        );
    }
}
```

#### B. API Versioning
**Priority:** MEDIUM | **Effort:** MEDIUM

```typescript
// main.ts
app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
});

// Controller
@Controller({ version: '1', path: 'tickets' })
export class TicketsV1Controller {}

@Controller({ version: '2', path: 'tickets' })
export class TicketsV2Controller {}
```

#### C. Background Job Queue
**Priority:** HIGH | **Effort:** MEDIUM

```typescript
// For email sending, report generation, etc.
// npm install @nestjs/bull bull

@Processor('notifications')
export class NotificationProcessor {
    @Process('send-email')
    async handleSendEmail(job: Job<EmailJobData>) {
        const { to, subject, template, data } = job.data;
        await this.mailerService.sendMail({ to, subject, template, context: data });
    }
    
    @Process('send-telegram')
    async handleSendTelegram(job: Job<TelegramJobData>) {
        await this.telegramService.sendMessage(job.data);
    }
}

// Usage
await this.notificationQueue.add('send-email', {
    to: user.email,
    subject: 'Ticket Assigned',
    template: 'ticket-assigned',
    data: { ticketNumber, title },
}, { 
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
});
```

#### D. WebSocket Authentication
**Priority:** HIGH | **Effort:** LOW | **Status:** ✅ COMPLETED
**Files:** `events.gateway.ts`, `apps/frontend/src/lib/socket.ts`

Backend: JWT verification in handleConnection, auto-identify users
Frontend: Auth token sent in socket handshake, token refresh on reconnect

#### E. Health Check Improvements
**Priority:** MEDIUM | **Effort:** LOW | **Status:** ✅ ALREADY IMPLEMENTED
**File:** `apps/backend/src/modules/health/health.controller.ts`

Endpoints: GET /health, GET /health/live, GET /health/ready with database check

### 5.3 Database Improvements

#### A. Query Optimization
**Priority:** HIGH | **Effort:** MEDIUM

```sql
-- 1. Add composite indexes for common queries
CREATE INDEX idx_tickets_status_priority ON tickets(status, priority);
CREATE INDEX idx_tickets_user_status ON tickets("userId", status);
CREATE INDEX idx_tickets_assigned_status ON tickets("assignedToId", status);

-- 2. Partial index for active tickets
CREATE INDEX idx_active_tickets ON tickets(status, "createdAt" DESC) 
WHERE status NOT IN ('RESOLVED', 'CANCELLED');

-- 3. Full-text search index
CREATE INDEX idx_tickets_search ON tickets 
USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- 4. Index for SLA monitoring
CREATE INDEX idx_tickets_sla_breach ON tickets("slaTarget", status) 
WHERE status NOT IN ('RESOLVED', 'CANCELLED') AND "slaTarget" IS NOT NULL;
```

#### B. Database Connection Pooling
**Priority:** HIGH | **Effort:** LOW | **Status:** ✅ COMPLETED
**File:** `apps/backend/src/app.module.ts`

Pool config: max=20, min=5, idleTimeout=30s, connectionTimeout=5s
Configurable via env: DB_POOL_MAX, DB_POOL_MIN

#### C. Soft Delete Implementation
**Priority:** MEDIUM | **Effort:** MEDIUM

```typescript
// Base entity with soft delete
@Entity()
export abstract class BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;
    
    @CreateDateColumn()
    createdAt: Date;
    
    @UpdateDateColumn()
    updatedAt: Date;
    
    @DeleteDateColumn()
    deletedAt?: Date;
}

// Usage
await this.ticketRepo.softDelete(id);
await this.ticketRepo.restore(id);
```

#### D. Database Migrations Strategy
**Priority:** HIGH | **Effort:** MEDIUM

```typescript
// Generate migration
// npx typeorm migration:generate -d src/data-source.ts src/migrations/AddTicketIndexes

// Migration file example
export class AddTicketIndexes1701234567890 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE INDEX CONCURRENTLY idx_tickets_status ON tickets(status);
        `);
    }
    
    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX idx_tickets_status;`);
    }
}
```

### 5.4 Animation Improvements (Detailed)

#### A. CSS Animations (No Library)
**File:** `apps/frontend/src/index.css` | **Status:** ✅ COMPLETED

12 animations implemented: fadeInUp, fadeInDown, slideInRight, slideInLeft, scaleIn, popIn, bounceSubtle, pulseRing, shimmer, shake, spinSlow
8 stagger delays, hover effects, glass morphism

#### B. Component-Specific Animations
```tsx
// Animated Card Component
const AnimatedCard: React.FC<{ index: number; children: React.ReactNode }> = ({ 
    index, 
    children 
}) => (
    <div 
        className="animate-fade-in-up opacity-0"
        style={{ 
            animationDelay: `${index * 0.1}s`,
            animationFillMode: 'forwards'
        }}
    >
        {children}
    </div>
);

// Animated Counter
const AnimatedCounter: React.FC<{ value: number }> = ({ value }) => {
    const [displayValue, setDisplayValue] = useState(0);
    
    useEffect(() => {
        const duration = 1000;
        const steps = 20;
        const increment = value / steps;
        let current = 0;
        
        const timer = setInterval(() => {
            current += increment;
            if (current >= value) {
                setDisplayValue(value);
                clearInterval(timer);
            } else {
                setDisplayValue(Math.floor(current));
            }
        }, duration / steps);
        
        return () => clearInterval(timer);
    }, [value]);
    
    return <span>{displayValue}</span>;
};

// Notification Badge with Animation
const NotificationBadge: React.FC<{ count: number }> = ({ count }) => (
    <span className={cn(
        "absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full",
        "text-[10px] font-bold text-white flex items-center justify-center px-1",
        count > 0 && "animate-pulse-ring"
    )}>
        {count > 99 ? '99+' : count}
    </span>
);
```

### 5.5 Security Improvements

#### A. CSRF Protection
**Priority:** HIGH | **Effort:** MEDIUM

```typescript
// main.ts
import csurf from 'csurf';
app.use(csurf({ cookie: true }));
```

#### B. Security Headers
**Priority:** HIGH | **Effort:** LOW | **Status:** ✅ COMPLETED
**File:** `apps/backend/src/main.ts`

Enhanced helmet config with: CSP (production), HSTS, noSniff, xssFilter, referrerPolicy

#### C. Input Sanitization
**Priority:** HIGH | **Effort:** LOW

```typescript
// npm install class-sanitizer
import { Sanitize } from 'class-sanitizer';

export class CreateTicketDto {
    @IsString()
    @Sanitize((value: string) => value.trim())
    @Transform(({ value }) => xss(value)) // npm install xss
    title: string;
    
    @IsString()
    @Transform(({ value }) => xss(value))
    description: string;
}
```

---

## 6. Implementation Priority Matrix

| Task | Priority | Effort | Impact | Status |
|------|----------|--------|--------|--------|
| Add Database Indexes | HIGH | LOW | HIGH | ✅ COMPLETED |
| Fix Socket URL Hardcoding | MEDIUM | LOW | MEDIUM | ✅ COMPLETED |
| Add Security Headers (CSP, HSTS) | HIGH | LOW | HIGH | ✅ COMPLETED |
| Animation System (CSS) | MEDIUM | MEDIUM | MEDIUM | ✅ COMPLETED |
| WebSocket Auth | HIGH | LOW | HIGH | ✅ COMPLETED |
| DB Connection Pooling | HIGH | LOW | HIGH | ✅ COMPLETED |
| Logger Utility | LOW | LOW | LOW | ✅ COMPLETED |
| Error Boundaries | MEDIUM | LOW | MEDIUM | ✅ COMPLETED |
| Socket Memory Leak Fix | MEDIUM | LOW | MEDIUM | ✅ COMPLETED |
| Request Logging | HIGH | LOW | HIGH | ✅ ALREADY EXISTS |
| Health Checks | MEDIUM | LOW | MEDIUM | ✅ ALREADY EXISTS |
| Virtual Scrolling | MEDIUM | MEDIUM | MEDIUM | ✅ COMPLETED |
| Background Job Queue | HIGH | MEDIUM | HIGH | ✅ COMPLETED |
| API Versioning | MEDIUM | MEDIUM | LOW | ✅ COMPLETED |
| PWA Support | LOW | MEDIUM | MEDIUM | ✅ COMPLETED (Ready to enable) |
| Optimistic Updates | HIGH | MEDIUM | HIGH | ✅ COMPLETED |
| Input Validation Enhancement | HIGH | MEDIUM | HIGH | ✅ COMPLETED |
| File Upload Standardization | MEDIUM | LOW | MEDIUM | ✅ COMPLETED |
| Rate Limiting on Uploads | MEDIUM | LOW | HIGH | ✅ COMPLETED |
| TypeScript Type Definitions | LOW | MEDIUM | MEDIUM | ✅ COMPLETED |

---

## 7. Quick Wins (Can Be Done Immediately)

### 7.1 Add Missing Database Indexes ✅ COMPLETED
Migration file: `apps/backend/src/migrations/1732900000000-AddPerformanceIndexes.ts`
Run: `npx typeorm migration:run`

### 7.2 Fix Socket URL ✅ COMPLETED
File: `apps/frontend/src/lib/socket.ts` - Now uses VITE_SOCKET_URL env var

### 7.3 Add Basic Animations to index.css ✅ COMPLETED
File: `apps/frontend/src/index.css` - 12 animations + utility classes added

### 7.4 Create Logger Utility ✅ COMPLETED
File: `apps/frontend/src/lib/logger.ts` - Environment-aware logging

---

## 8. Files Created/Modified in Section 4-6

### New Files:
- `apps/frontend/src/lib/logger.ts` - Logger utility
- `apps/frontend/src/components/ui/animated.tsx` - Animation components (AnimatedCard, AnimatedCounter, etc)
- `apps/backend/src/migrations/1732900000000-AddPerformanceIndexes.ts` - Database indexes

### Modified Files:
- `apps/frontend/src/index.css` - CSS animation system (12 animations, 8 stagger delays)
- `apps/frontend/src/lib/socket.ts` - Env vars + auth token + disconnect function
- `apps/frontend/src/stores/useAuth.ts` - Socket disconnect on logout
- `apps/frontend/src/App.tsx` - FeatureErrorBoundary on all routes
- `apps/backend/src/main.ts` - Enhanced security headers (CSP, HSTS)
- `apps/backend/src/app.module.ts` - Database connection pooling
- `apps/backend/src/modules/ticketing/presentation/gateways/events.gateway.ts` - JWT WebSocket auth
- `apps/backend/src/shared/core/filters/http-exception.filter.ts` - Production error hiding

---

## 9. Latest Implementation (29 Nov 2025 - Final Batch)

### Backend Improvements Implemented:

#### A. Enhanced Input Validation
**Files Created:**
- `apps/backend/src/shared/core/validators/input-sanitizer.ts` - Sanitize, NormalizeEmail, SanitizeFilename decorators
- `apps/backend/src/shared/core/validators/common.validators.ts` - NoSqlInjection, IsSafeSearch, IsUUIDArray validators

**Files Modified:**
- `apps/backend/src/modules/ticketing/dto/create-ticket.dto.ts` - Added MinLength, MaxLength, Sanitize, NoSqlInjection
- `apps/backend/src/modules/users/dto/create-user.dto.ts` - Added email normalization, name validation patterns

#### B. Standardized File Upload Configuration
**Files Created:**
- `apps/backend/src/shared/core/config/upload.config.ts` - Centralized upload config with:
  - File size limits (IMAGE: 5MB, DOCUMENT: 10MB, AVATAR: 2MB, CONTRACT: 20MB)
  - MIME type validation
  - Extension validation
  - Pre-configured multer options for each use case

**Files Modified:**
- `apps/backend/src/modules/users/users.controller.ts` - Using MULTER_OPTIONS.avatar and UPLOAD_RATE_LIMITS
- `apps/backend/src/modules/uploads/uploads.controller.ts` - Using centralized config
- `apps/backend/src/modules/renewal/renewal.controller.ts` - Using MULTER_OPTIONS.contract

#### C. Rate Limiting on Sensitive Endpoints
- Avatar upload: 5 per minute
- CSV import: 3 per minute  
- Contract upload: 10 per minute
- Password reset: 5 per minute
- General uploads: 20 per minute

#### D. Background Job Queue Enhancement
**Files Created:**
- `apps/backend/src/shared/queue/processors/email.processor.ts` - Email processor with:
  - Single email sending
  - Bulk email sending
  - Ticket notification templates
  - Contract reminder emails

**Files Modified:**
- `apps/backend/src/shared/queue/queue.module.ts` - Added 'emails' and 'reports' queues
- `apps/backend/src/shared/queue/index.ts` - Export email processor

#### E. API Versioning
**File Modified:** `apps/backend/src/main.ts`
- URI-based versioning enabled (e.g., /v1/tickets)
- Default version: '1' for backward compatibility
- Enhanced Swagger documentation with tags

#### F. Directory Structure Enhancement
**File Modified:** `apps/backend/src/main.ts`
- Auto-creates upload directories: avatars, contracts, documents, temp

---

### Frontend Improvements Implemented:

#### A. TypeScript Type Definitions
**Files Created:**
- `apps/frontend/src/types/ticket.types.ts` - Comprehensive ticket types (Ticket, TicketMessage, TicketStats, etc.)
- `apps/frontend/src/types/index.ts` - Notification, Auth, Report, Contract types

#### B. Optimistic Updates
**File Created:** `apps/frontend/src/hooks/useOptimisticMutation.ts`
- `useOptimisticMutation` - Generic hook for optimistic updates with rollback
- `useOptimisticTicketStatus` - Optimistic status updates
- `useOptimisticTicketPriority` - Optimistic priority updates
- `useOptimisticTicketAssign` - Optimistic ticket assignment
- `useOptimisticMarkNotificationRead` - Optimistic notification read

#### C. Virtual Scrolling
**File Created:** `apps/frontend/src/components/ui/VirtualizedList.tsx`
- `VirtualizedList` - Generic virtualized list using react-window
- `VirtualizedTable` - Virtualized table rows
- `useInfiniteScroll` - Hook for infinite scroll detection

#### D. PWA Configuration (Ready to Enable)
**Files Created:**
- `apps/frontend/src/pwa.config.ts` - PWA manifest and workbox config

**Files Modified:**
- `apps/frontend/vite.config.ts` - Added PWA plugin configuration (commented, ready to enable)

---

### Summary of All Completed Tasks (Section 4-6):

| Section | Task | Status |
|---------|------|--------|
| 4.1.D | Type Safety Issues | ✅ COMPLETED |
| 4.2.A | Missing Input Validation | ✅ COMPLETED |
| 4.2.C | File Upload Size Standardization | ✅ COMPLETED |
| 4.2.D | Rate Limiting on Endpoints | ✅ COMPLETED |
| 5.1.C | Optimistic Updates | ✅ COMPLETED |
| 5.1.D | Virtual Scrolling | ✅ COMPLETED |
| 5.1.E | PWA Support | ✅ COMPLETED (Ready) |
| 5.2.B | API Versioning | ✅ COMPLETED |
| 5.2.C | Background Job Queue | ✅ COMPLETED |

---

# PART 3: COMPREHENSIVE SYSTEM REVIEW & BEST PRACTICES

*Review Date: 29 November 2025 (Total Codebase Review)*

---

## 10. Page-by-Page Review & Improvement Plan

### 10.1 Dashboard Page (`BentoDashboardPage.tsx`)

**Current State:** ⭐⭐⭐⭐ (Good)

**Issues Found:**
- Custom chart components (MiniBarChart, DonutChart) could be replaced with recharts
- No data caching strategy (refetches on every mount)
- Missing click handlers on stat cards for drill-down
- No export functionality

**Best Practice Improvements:**
```typescript
// 1. Add proper caching strategy
const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardStats,
    staleTime: 30000, // 30 seconds
    cacheTime: 300000, // 5 minutes
    refetchInterval: 60000, // Auto-refresh every minute
});

// 2. Add click handlers for drill-down navigation
const handleStatClick = (status: string) => {
    navigate(`/tickets/list?status=${status}`);
};

// 3. Add date range selector for stats
const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('week');
```

**Priority:** MEDIUM | **Effort:** LOW

---

### 10.2 Reports Page (`BentoReportsPage.tsx`)

**Current State:** ⭐⭐⭐ (Needs Improvement)

**Issues Found:**
- Uses `useState` + `useEffect` instead of `useQuery` for data fetching
- Console.error statements in production code
- No date range presets (Last 7 days, Last 30 days, etc.)
- PDF export may have formatting issues
- No loading skeleton during tab switch

**Best Practice Improvements:**
```typescript
// 1. Replace useState/useEffect with useQuery
const { data: monthlyStats, isLoading } = useQuery({
    queryKey: ['reports', 'monthly', month, year],
    queryFn: () => api.get(`/reports/monthly?month=${month}&year=${year}`).then(r => r.data),
    enabled: activeTab === 'monthly',
});

// 2. Add date range presets
const DATE_PRESETS = [
    { label: 'Last 7 days', days: 7 },
    { label: 'Last 30 days', days: 30 },
    { label: 'Last 90 days', days: 90 },
    { label: 'This year', days: 365 },
];

// 3. Use logger instead of console.error
import { logger } from '@/lib/logger';
logger.error('Failed to fetch stats:', error);

// 4. Add comparison with previous period
// "Tickets this month: 150 (+12% vs last month)"
```

**Priority:** HIGH | **Effort:** MEDIUM

---

### 10.3 Knowledge Base Page (`BentoKnowledgeBasePage.tsx`)

**Current State:** ⭐⭐⭐ (Needs Improvement)

**Issues Found:**
- No pagination for articles (loads all at once)
- Uses `useState` + `useEffect` instead of `useQuery`
- Console.error in production code
- No search autocomplete/suggestions
- Missing category filtering
- No "popular articles" section

**Best Practice Improvements:**
```typescript
// 1. Add pagination with infinite scroll
const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
} = useInfiniteQuery({
    queryKey: ['kb-articles', query, category],
    queryFn: ({ pageParam = 1 }) => fetchArticles({ page: pageParam, query, category }),
    getNextPageParam: (lastPage) => lastPage.nextPage,
});

// 2. Add search debouncing
const debouncedQuery = useDebounce(query, 300);

// 3. Add category tabs/filter
const categories = ['All', 'Software', 'Hardware', 'Network', 'Security'];

// 4. Add popular/featured articles section
// 5. Add breadcrumb navigation
```

**Priority:** MEDIUM | **Effort:** MEDIUM

---

### 10.4 Agent Management Page (`BentoAdminAgentsPage.tsx`)

**Current State:** ⭐⭐⭐ (Needs Improvement)

**Issues Found:**
- Computes agent stats from tickets on frontend (should be backend)
- No real-time online/offline status
- Missing workload distribution chart
- No bulk actions (assign multiple tickets, etc.)
- Agent detail panel is basic

**Best Practice Improvements:**
```typescript
// 1. Move stats computation to backend
// GET /users/agents/stats
const { data: agentStats } = useQuery({
    queryKey: ['agent-stats'],
    queryFn: () => api.get('/users/agents/stats').then(r => r.data),
});

// 2. Add presence tracking
const { onlineAgents } = usePresence(); // WebSocket-based

// 3. Add workload distribution visualization
<WorkloadChart data={agentStats} />

// 4. Add quick actions
// - Assign tickets to agent
// - View agent's tickets
// - Adjust capacity/limit
```

**Priority:** HIGH | **Effort:** HIGH

---

### 10.5 Settings Page (`BentoSettingsPage.tsx`)

**Current State:** ⭐⭐⭐⭐ (Good)

**Issues Found:**
- Missing SLA Configuration tab
- Missing Business Hours configuration
- No system-wide settings for Admins
- No email template configuration

**Best Practice Improvements:**
```typescript
// Add new tabs for Admin users:
const adminTabs = [
    { value: 'sla', icon: Clock, label: 'SLA Settings' },
    { value: 'business-hours', icon: Calendar, label: 'Business Hours' },
    { value: 'email-templates', icon: Mail, label: 'Email Templates' },
    { value: 'system', icon: Settings, label: 'System Settings' },
];

// SLA Settings UI:
// - Priority-based response/resolution times
// - Escalation rules
// - Business hours consideration

// Business Hours:
// - Working days selection
// - Start/end time per day
// - Holiday calendar
```

**Priority:** MEDIUM | **Effort:** MEDIUM

---

### 10.6 Renewal/Contract Page (`RenewalDashboardPage.tsx`)

**Current State:** ⭐⭐⭐⭐ (Good)

**Issues Found:**
- No bulk actions (acknowledge multiple, export)
- No calendar view for expiring contracts
- Missing email notification preview
- No contract value analytics

**Best Practice Improvements:**
```typescript
// 1. Add bulk selection and actions
const [selectedIds, setSelectedIds] = useState<string[]>([]);
const handleBulkAcknowledge = () => { ... };
const handleBulkExport = () => { ... };

// 2. Add calendar view option
<ViewToggle options={['table', 'calendar']} />

// 3. Add value analytics
// - Total contract value
// - Value by status
// - Monthly renewal value forecast

// 4. Add timeline view showing expiry dates
```

**Priority:** LOW | **Effort:** MEDIUM

---

### 10.7 Client Ticket Pages

#### Create Ticket (`BentoCreateTicketPage.tsx`)
**Current State:** ⭐⭐⭐⭐ (Good)

**Issues Found:**
- Console.error statements
- No draft saving
- No template suggestions based on category

**Improvements:**
```typescript
// 1. Auto-save draft to localStorage
useEffect(() => {
    localStorage.setItem('ticket-draft', JSON.stringify(formData));
}, [formData]);

// 2. Suggest templates
const { data: templates } = useQuery({
    queryKey: ['ticket-templates', formData.category],
    queryFn: () => api.get(`/ticket-templates?category=${formData.category}`),
    enabled: !!formData.category,
});
```

#### My Tickets (`BentoMyTicketsPage.tsx`)
**Improvements:**
- Add status tabs (All, Open, Resolved)
- Add sorting options
- Add search within own tickets

#### Ticket Detail (`ClientTicketDetailPage.tsx`)
**Issues Found:**
- No satisfaction survey after resolution
- Missing "similar articles" suggestion
- No ticket timeline view

**Improvements:**
```typescript
// 1. Show survey prompt when resolved
{ticket.status === 'RESOLVED' && !ticket.surveySubmitted && (
    <SatisfactionSurvey ticketId={ticket.id} />
)}

// 2. Suggest knowledge base articles
<RelatedArticles category={ticket.category} />
```

**Priority:** MEDIUM | **Effort:** MEDIUM

---

### 10.8 Notification System

**Current State:** ⭐⭐⭐ (Needs Improvement)

**Issues Found:**
- NotificationCenterPage is minimal (just wrapper)
- No notification grouping by date
- No "mark all as read" functionality
- No notification sound/desktop notification
- Missing notification preferences UI

**Best Practice Improvements:**
```typescript
// 1. Group notifications by date
const groupedNotifications = useMemo(() => {
    return groupBy(notifications, n => formatDate(n.createdAt));
}, [notifications]);

// 2. Add mark all as read
const markAllAsReadMutation = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries(['notifications']),
});

// 3. Desktop notifications (with permission)
if (Notification.permission === 'granted') {
    new Notification(notification.title, { body: notification.message });
}

// 4. Notification preferences
// - Email notifications: on/off per type
// - Push notifications: on/off
// - Sound: on/off
// - Digest frequency: realtime/hourly/daily
```

**Priority:** HIGH | **Effort:** MEDIUM

---

### 10.9 Ticket List & Kanban (`BentoTicketListPage.tsx`, `BentoTicketKanban.tsx`)

**Current State:** ⭐⭐⭐⭐ (Good - Already Improved in V4)

**Remaining Improvements:**
- Add saved filters/views
- Add bulk export to CSV/Excel
- Add print view
- Keyboard navigation in Kanban

**Priority:** LOW | **Effort:** LOW

---

## 11. Cross-Cutting Concerns & Best Practices

### 11.1 Console.log Cleanup

**Issue:** 30+ console.log/error statements found in production code

**Files Affected:**
- `BentoReportsPage.tsx`
- `BentoKnowledgeBasePage.tsx`
- `BentoCreateTicketPage.tsx`
- `ClientTicketDetailPage.tsx`
- `TicketChatRoom.tsx`
- And 20+ more files

**Solution:**
```typescript
// Replace all console.* with logger utility
import { logger } from '@/lib/logger';

// Instead of:
console.error('Failed to fetch:', error);

// Use:
logger.error('Failed to fetch:', error);
```

**Priority:** HIGH | **Effort:** LOW

---

### 11.2 Error Handling Standardization

**Current Issue:** Inconsistent error handling across components

**Best Practice:**
```typescript
// 1. Create error boundary wrapper for all pages
<FeatureErrorBoundary feature="Reports">
    <BentoReportsPage />
</FeatureErrorBoundary>

// 2. Standardize API error handling
const handleApiError = (error: unknown, context: string) => {
    logger.error(`${context}:`, error);
    
    if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message || 'An error occurred';
        toast.error(message);
    } else {
        toast.error('An unexpected error occurred');
    }
};

// 3. Add retry logic for transient failures
const { data, refetch } = useQuery({
    queryKey: ['data'],
    queryFn: fetchData,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
});
```

**Priority:** HIGH | **Effort:** MEDIUM

---

### 11.3 Data Fetching Standardization

**Current Issue:** Mix of useState/useEffect and useQuery patterns

**Best Practice:**
```typescript
// Always use React Query for server state
// DON'T:
const [data, setData] = useState([]);
const [loading, setLoading] = useState(false);
useEffect(() => {
    setLoading(true);
    api.get('/data').then(r => setData(r.data)).finally(() => setLoading(false));
}, []);

// DO:
const { data = [], isLoading } = useQuery({
    queryKey: ['data'],
    queryFn: () => api.get('/data').then(r => r.data),
    staleTime: 30000,
});

// Standard staleTime values:
// - Dashboard stats: 30 seconds
// - List data: 1 minute
// - Static data (categories): 5 minutes
// - User profile: 10 minutes
```

**Priority:** HIGH | **Effort:** MEDIUM

---

### 11.4 Form Validation Best Practices

**Current Issue:** Some forms lack client-side validation

**Best Practice:**
```typescript
// Use react-hook-form with zod for all forms
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const ticketSchema = z.object({
    title: z.string()
        .min(5, 'Title must be at least 5 characters')
        .max(200, 'Title cannot exceed 200 characters'),
    description: z.string()
        .min(10, 'Description must be at least 10 characters')
        .max(5000, 'Description cannot exceed 5000 characters'),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    category: z.string().optional(),
});

const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(ticketSchema),
});
```

**Priority:** MEDIUM | **Effort:** MEDIUM

---

### 11.5 Accessibility (a11y) Improvements

**Current Issue:** Some components missing ARIA attributes

**Best Practice:**
```typescript
// 1. All interactive elements need accessible names
<button aria-label="Close dialog">
    <X className="w-4 h-4" />
</button>

// 2. Forms need proper labels
<label htmlFor="title">Title</label>
<input id="title" aria-describedby="title-error" />
{errors.title && <span id="title-error" role="alert">{errors.title}</span>}

// 3. Status updates need live regions
<div aria-live="polite" aria-atomic="true">
    {statusMessage}
</div>

// 4. Focus management for modals
useEffect(() => {
    if (isOpen) {
        firstInputRef.current?.focus();
    }
}, [isOpen]);
```

**Priority:** MEDIUM | **Effort:** MEDIUM

---

### 11.6 Performance Best Practices

**Recommendations:**
```typescript
// 1. Memoize expensive computations
const sortedTickets = useMemo(() => {
    return [...tickets].sort((a, b) => ...);
}, [tickets, sortConfig]);

// 2. Debounce search inputs
const debouncedSearch = useDebounce(searchQuery, 300);

// 3. Use virtualization for long lists (already implemented)
// 4. Lazy load heavy components
const HeavyChart = lazy(() => import('./HeavyChart'));

// 5. Optimize re-renders with React.memo
export const TicketCard = React.memo(({ ticket }) => { ... });

// 6. Use proper image optimization
<img loading="lazy" decoding="async" src={imageSrc} />
```

**Priority:** MEDIUM | **Effort:** LOW

---

### 11.7 Security Best Practices (Frontend)

**Recommendations:**
```typescript
// 1. Sanitize user-generated content before rendering
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }} />

// 2. Never store sensitive data in localStorage
// Use httpOnly cookies for tokens (already done)

// 3. Validate file uploads on frontend too
const validateFile = (file: File) => {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    
    if (file.size > maxSize) throw new Error('File too large');
    if (!allowedTypes.includes(file.type)) throw new Error('Invalid file type');
};

// 4. CSRF protection for mutations (already handled by backend)
```

**Priority:** HIGH | **Effort:** LOW

---

## 12. Backend Improvements Needed

### 12.1 Missing API Endpoints

| Endpoint | Purpose | Priority |
|----------|---------|----------|
| `GET /users/agents/stats` | Agent performance stats (server-side) | HIGH |
| `GET /tickets/export` | Export tickets to CSV/Excel | MEDIUM |
| `PATCH /notifications/read-all` | Mark all notifications as read | HIGH |
| `GET /kb/articles/popular` | Most viewed articles | LOW |
| `GET /kb/articles/search/suggest` | Search autocomplete | LOW |
| `GET /reports/comparison` | Period-over-period comparison | MEDIUM |

### 12.2 Caching Strategy

```typescript
// Add Redis caching for frequently accessed data
@Injectable()
export class CacheService {
    // Cache dashboard stats for 30 seconds
    async getDashboardStats() {
        const cached = await this.redis.get('dashboard:stats');
        if (cached) return JSON.parse(cached);
        
        const stats = await this.computeStats();
        await this.redis.setex('dashboard:stats', 30, JSON.stringify(stats));
        return stats;
    }
}
```

### 12.3 Query Optimization

```typescript
// Add database indexes (migration already created)
// Run: npm run migration:run

// Use query builder with specific selects
const tickets = await this.ticketRepo
    .createQueryBuilder('t')
    .select(['t.id', 't.title', 't.status', 't.priority', 't.createdAt'])
    .leftJoin('t.assignedTo', 'a')
    .addSelect(['a.id', 'a.fullName'])
    .where('t.status != :status', { status: 'CANCELLED' })
    .orderBy('t.createdAt', 'DESC')
    .take(50)
    .getMany();
```

---

## 13. Implementation Roadmap (V5)

### Phase 1: Quick Wins (1-2 days) ✅ COMPLETED
- [x] Replace all console.* with logger utility (key files completed)
- [x] Add proper staleTime/cacheTime to all useQuery calls
- [x] Add error boundaries to remaining pages (all pages have FeatureErrorBoundary)
- [x] Fix date range presets in Reports (8 presets: Today, Yesterday, Last 7/30/90 days, This month, Last month, This year)

### Phase 2: Data Fetching (2-3 days) ✅ COMPLETED
- [x] Refactor Reports page to use useQuery (complete rewrite with loading skeletons)
- [x] Refactor Knowledge Base page to use useQuery with pagination (debounced search, category filters)
- [x] Add agent stats endpoint (backend) - GET /users/agents/stats
- [x] Add mark all as read endpoint (backend) - POST /notifications/read-all (already existed)

### Phase 3: UX Improvements (3-5 days) ✅ COMPLETED
- [x] Add notification grouping and mark all as read (grouped by Today, Yesterday, This Week, Month/Year)
- [ ] Add satisfaction survey for resolved tickets (SKIPPED - not required per user request)
- [x] Add SLA Settings tab for Admins (integrated into BentoSettingsPage)
- [x] Add draft saving for ticket creation (auto-save to localStorage every 3s)
- [x] Add search debouncing everywhere (300ms debounce)

### Phase 4: Performance (2-3 days) ✅ COMPLETED
- [x] Add Redis caching for dashboard stats (backend) - 120s TTL for dashboard, 300s for reports
- [x] Implement lazy loading for heavy components (all pages use React.lazy + Suspense)
- [x] Add image optimization (OptimizedImage component with IntersectionObserver)

### Phase 5: Polish (2-3 days) ✅ COMPLETED
- [x] Complete accessibility audit and fixes (accessibility.ts utility created)
- [x] Add keyboard shortcuts documentation (KeyboardShortcutsHelp component)
- [x] Add onboarding tour for new users (OnboardingTour component)
- [x] Add help tooltips throughout app (HelpTooltip component)

---

## 14. Summary & Priorities

### High Priority (Do First) ✅ ALL COMPLETED
1. ~~Console.log cleanup across all files~~ ✅
2. ~~Reports page refactor (useState → useQuery)~~ ✅
3. ~~Notification system improvements~~ ✅
4. ~~Agent stats endpoint~~ ✅
5. ~~Error handling standardization~~ ✅

### Medium Priority ✅ ALL COMPLETED
1. ~~Knowledge Base pagination~~ ✅
2. ~~SLA Settings UI~~ ✅
3. Form validation with zod (existing)
4. ~~Accessibility improvements~~ ✅
5. ~~Search debouncing~~ ✅

### Low Priority ✅ COMPLETED
1. PWA enablement (future consideration)
2. Calendar view for contracts (future consideration)
3. ~~Onboarding tour~~ ✅
4. ~~Help tooltips~~ ✅

---

## 15. Implementation Summary (Phase 1-5)

### Files Created:
**Frontend:**
- `apps/frontend/src/hooks/useDebounce.ts` - Debounce hook
- `apps/frontend/src/lib/constants/date-presets.ts` - Date range presets
- `apps/frontend/src/components/ui/OptimizedImage.tsx` - Lazy loading image
- `apps/frontend/src/components/ui/HelpTooltip.tsx` - Help tooltip component
- `apps/frontend/src/components/onboarding/OnboardingTour.tsx` - Onboarding tour
- `apps/frontend/src/lib/accessibility.ts` - Accessibility utilities

### Files Modified:
**Frontend:**
- `apps/frontend/src/features/reports/pages/BentoReportsPage.tsx` - Complete refactor
- `apps/frontend/src/features/knowledge-base/pages/BentoKnowledgeBasePage.tsx` - Complete refactor
- `apps/frontend/src/features/client/pages/BentoCreateTicketPage.tsx` - Draft saving
- `apps/frontend/src/features/settings/pages/BentoSettingsPage.tsx` - SLA tab for admins
- `apps/frontend/src/components/notifications/NotificationCenter.tsx` - Date grouping
- `apps/frontend/src/components/notifications/NotificationPopover.tsx` - Logger utility

**Backend:**
- `apps/backend/src/modules/users/users.controller.ts` - Agent stats endpoint
- `apps/backend/src/modules/users/users.service.ts` - Agent stats implementation
- `apps/backend/src/modules/users/users.module.ts` - Ticket repository
- `apps/backend/src/modules/reports/reports.service.ts` - Caching
- `apps/backend/src/modules/ticketing/services/ticket-stats.service.ts` - Extended cache TTL
- `apps/backend/src/shared/core/config/upload.config.ts` - TypeScript fix
- `apps/backend/src/main.ts` - Removed API versioning

---

## 16. Notification System & Light Mode Improvements (V6)

### 16.1 Notification System Issues

#### Current Problems:
1. **Wrong routing path**: `notificationRouter.ts` uses `/ticket/view/${ticketId}` but actual routes are:
   - Admin/Agent: `/tickets/${id}`
   - Client/User: `/client/tickets/${id}`

2. **No role-based routing**: Notification router doesn't consider user role when determining destination path

3. **User role restrictions**: 
   - Users can see NotificationPopover but no NotificationCenter page in client routes
   - Need to add `/client/notifications` route for User role

4. **Mixed notifications**: Notifications might be showing across roles inappropriately

#### Solution Plan:

**A. Fix Notification Router (`notificationRouter.ts`)**
```typescript
// Add role parameter to routing function
export function getNotificationRedirectPath(
    notification: Notification, 
    userRole: 'ADMIN' | 'AGENT' | 'USER'
): string {
    const { category, ticketId, referenceId, link } = notification;
    
    // Base path based on role
    const ticketBasePath = userRole === 'USER' ? '/client/tickets' : '/tickets';
    
    switch (category) {
        case NotificationCategory.CATEGORY_TICKET:
            return ticketId ? `${ticketBasePath}/${ticketId}` : 
                   userRole === 'USER' ? '/client/my-tickets' : '/tickets/list';
        
        case NotificationCategory.CATEGORY_RENEWAL:
            // Only Admin can access renewal
            if (userRole !== 'ADMIN') return '/client/my-tickets';
            return referenceId ? `/renewal` : '/renewal';
        
        default:
            return userRole === 'USER' ? '/client/my-tickets' : '/dashboard';
    }
}
```

**B. Add Client Notification Center Route (`App.tsx`)**
```typescript
// Add to client routes
<Route path="notifications" element={
    <FeatureErrorBoundary featureName="Notifications">
        <Suspense fallback={<PageLoader />}>
            <ClientNotificationCenter />
        </Suspense>
    </FeatureErrorBoundary>
} />
```

**C. Update NotificationPopover and NotificationCenter**
- Pass user role from `useAuth()` to routing function
- Filter notifications by role-appropriate categories:
  - USER: Only CATEGORY_TICKET (their own tickets)
  - AGENT: CATEGORY_TICKET (assigned tickets)
  - ADMIN: CATEGORY_TICKET + CATEGORY_RENEWAL

**D. Backend: Filter notifications by role**
- Add role-based filtering in notification queries
- Users should only see notifications for their own tickets
- Agents see notifications for assigned tickets
- Admins see all notifications

#### Files to Modify:
- `apps/frontend/src/components/notifications/utils/notificationRouter.ts`
- `apps/frontend/src/components/notifications/NotificationPopover.tsx`
- `apps/frontend/src/components/notifications/NotificationCenter.tsx`
- `apps/frontend/src/App.tsx` (add client notification route)
- `apps/frontend/src/features/client/pages/ClientNotificationCenter.tsx` (new file)
- `apps/backend/src/modules/notifications/notification.service.ts`

---

### 16.2 Light Mode Improvements

#### Current Problems:
1. **Background too bright**: Pure white (#FFFFFF) is harsh on eyes
2. **Low contrast**: Effects and some text not visible on bright background
3. **Primary color visibility**: Mint green (#A8E6CF) has low contrast on white
4. **Card/border definition**: Cards blend into background

#### Solution Plan - Warm Off-White Theme:

**A. Update CSS Variables (`index.css`)**
```css
:root {
    /* Warm Off-White Background (Bone/Cream) */
    --background: 40 20% 96%;        /* #F7F5F2 - Warm cream */
    --foreground: 220 20% 20%;       /* Darker text for contrast */
    
    /* Card - Slightly warmer white */
    --card: 40 15% 98%;              /* #FDFCFA */
    --card-foreground: 220 20% 15%;
    
    /* Popover */
    --popover: 40 15% 99%;
    --popover-foreground: 220 20% 15%;
    
    /* Primary - Slightly darker mint for better contrast */
    --primary: 157 45% 55%;          /* #5CB88A - Darker mint */
    --primary-foreground: 0 0% 100%; /* White text on primary */
    
    /* Secondary - Warmer yellow */
    --secondary: 38 80% 80%;         /* Warmer tone */
    --secondary-foreground: 220 20% 15%;
    
    /* Muted - Warm gray */
    --muted: 40 10% 90%;             /* Warm gray */
    --muted-foreground: 220 10% 40%;
    
    /* Borders - More visible */
    --border: 40 15% 82%;            /* Visible warm border */
    --input: 40 15% 88%;
    
    /* Ring - Match primary */
    --ring: 157 45% 55%;
    
    /* Shadows for depth */
    --shadow-color: 40 20% 70%;
}
```

**B. Add Light Mode Specific Styles**
```css
/* Light mode specific enhancements */
@media (prefers-color-scheme: light) {
    .light {
        /* Subtle shadows for depth */
        --shadow-sm: 0 1px 2px hsl(var(--shadow-color) / 0.1);
        --shadow-md: 0 4px 6px hsl(var(--shadow-color) / 0.1);
        --shadow-lg: 0 10px 15px hsl(var(--shadow-color) / 0.1);
    }
}

/* Card styling for light mode */
.light .card, 
.light [class*="bg-white"],
.light [class*="bg-slate-800"] {
    background: hsl(var(--card));
    box-shadow: 0 1px 3px hsl(var(--shadow-color) / 0.08);
    border: 1px solid hsl(var(--border));
}

/* Text contrast improvements */
.light .text-slate-400 { color: hsl(220 10% 50%); }
.light .text-slate-500 { color: hsl(220 10% 40%); }
.light .text-slate-600 { color: hsl(220 15% 30%); }

/* Primary button - ensure visibility */
.light .bg-primary {
    background: hsl(157 45% 50%);
    color: white;
    font-weight: 600;
}

/* Hover states more visible */
.light [class*="hover:bg-slate-100"]:hover {
    background: hsl(40 15% 92%);
}
```

**C. Component-Level Updates**
- Update `BentoLayout.tsx` sidebar for light mode contrast
- Update `BentoSidebar.tsx` active states
- Update `BentoTopbar.tsx` background and icons
- Update all card components with proper borders in light mode

#### Color Palette Summary:
| Element | Current | Proposed | Notes |
|---------|---------|----------|-------|
| Background | #F1F3F5 (cool gray) | #F7F5F2 (warm cream) | Easier on eyes |
| Card | #FFFFFF | #FDFCFA | Subtle warmth |
| Primary | #A8E6CF (78% L) | #5CB88A (55% L) | Better contrast |
| Border | #D4D7DC | #D6D1CA | Visible definition |
| Text Primary | #1A202C | #2D3748 | Softer black |
| Text Secondary | #A0AEC0 | #6B7280 | More readable |

#### Files to Modify:
- `apps/frontend/src/index.css` (CSS variables)
- `apps/frontend/src/components/layout/BentoLayout.tsx`
- `apps/frontend/src/components/layout/BentoSidebar.tsx`
- `apps/frontend/src/components/layout/BentoTopbar.tsx`
- `apps/frontend/src/components/layout/ClientLayout.tsx`

---

### 16.3 Implementation Priority

| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| Fix notification routing | HIGH | 2h | Critical - users can't navigate |
| Add client notification page | HIGH | 1h | Users need notification access |
| Role-based notification filtering | MEDIUM | 3h | Data isolation |
| Light mode background colors | HIGH | 1h | UX - eye strain |
| Light mode contrast fixes | MEDIUM | 2h | Accessibility |
| Light mode shadow/depth | LOW | 1h | Visual polish |

### 16.4 Testing Checklist

**Notifications:**
- [ ] Admin clicks ticket notification → navigates to `/tickets/{id}`
- [ ] Agent clicks ticket notification → navigates to `/tickets/{id}`
- [ ] User clicks ticket notification → navigates to `/client/tickets/{id}`
- [ ] User can access `/client/notifications` page
- [ ] User only sees own ticket notifications
- [ ] Agent only sees assigned ticket notifications
- [ ] Admin sees all notifications including renewals

**Light Mode:**
- [ ] Background is warm cream, not harsh white
- [ ] Cards have visible borders/shadows
- [ ] Primary buttons are readable (white text on darker mint)
- [ ] All text meets WCAG AA contrast (4.5:1 for normal text)
- [ ] Hover states are visible
- [ ] Active navigation states are clear
- [ ] No "invisible" elements

---

## 17. Telegram Bot Total Redesign & Improvement (V7)

> **STATUS: ✅ FULLY COMPLETED** (30 November 2025)
> 
> ### Section Completion Status:
> 
> | Section | Description | Status |
> |---------|-------------|--------|
> | 17.1 | Current State Analysis | ✅ Documented |
> | 17.2 | Redesign Goals | ✅ All goals achieved |
> | 17.3 | Architecture Redesign | ✅ Full module structure |
> | 17.4 | Feature Specifications | ✅ All features implemented |
> | 17.5 | Message Templates Redesign | ✅ ID/EN templates |
> | 17.6 | New Commands & Actions | ✅ All commands |
> | 17.7 | Implementation Priority | ✅ All phases |
> | 17.8 | Phase 1 Implementation | ✅ Handlers refactored |
> | 17.9 | Database Migrations | ✅ Migration created |
> | 17.10 | Testing Checklist | ⏭️ Skipped |
> | 17.11 | Monitoring & Analytics | ✅ Logging middleware |
> | 17.12 | Security Considerations | ✅ Guards & validation |
> 
> ### Complete Module Structure (17.3.1):
> ```
> apps/backend/src/modules/telegram/
> ├── telegram.module.ts          ✅
> ├── telegram.service.ts         ✅
> ├── telegram.controller.ts      ✅
> ├── telegram.update.ts          ✅
> ├── telegram-chat-bridge.service.ts ✅
> ├── index.ts                    ✅
> │
> ├── handlers/                   ✅
> │   ├── index.ts
> │   ├── start.handler.ts
> │   ├── ticket.handler.ts
> │   ├── chat.handler.ts
> │   ├── settings.handler.ts
> │   ├── agent.handler.ts
> │   └── inline.handler.ts
> │
> ├── keyboards/                  ✅
> │   ├── index.ts
> │   ├── main-menu.keyboard.ts
> │   ├── ticket-actions.keyboard.ts
> │   ├── priority.keyboard.ts
> │   ├── category.keyboard.ts
> │   ├── agent-actions.keyboard.ts
> │   ├── settings.keyboard.ts
> │   └── survey.keyboard.ts
> │
> ├── templates/                  ✅
> │   ├── index.ts
> │   ├── messages.id.ts
> │   └── messages.en.ts
> │
> ├── middleware/                 ✅
> │   ├── index.ts
> │   ├── auth.middleware.ts
> │   ├── rate-limit.middleware.ts
> │   ├── language.middleware.ts
> │   └── logging.middleware.ts
> │
> ├── webapp/                     ✅
> │   ├── index.ts
> │   ├── webapp.controller.ts
> │   └── webapp.service.ts
> │
> ├── entities/                   ✅
> │   └── telegram-session.entity.ts
> │
> ├── enums/                      ✅
> │   ├── index.ts
> │   ├── telegram-state.enum.ts
> │   ├── telegram-command.enum.ts
> │   └── telegram-language.enum.ts
> │
> ├── dto/                        ✅
> │   ├── index.ts
> │   ├── webapp-ticket.dto.ts
> │   └── quick-reply.dto.ts
> │
> ├── interfaces/                 ✅
> │   ├── index.ts
> │   └── telegram-context.interface.ts
> │
> └── utils/                      ✅
>     ├── index.ts
>     ├── message-formatter.ts
>     ├── keyboard-builder.ts
>     └── media-handler.ts
> ```
> 
> ### Commands Implemented (17.6):
> | Command | Description | Status |
> |---------|-------------|--------|
> | /start | Main menu | ✅ |
> | /tiket [text] | Quick ticket | ✅ |
> | /ticket [text] | Alias | ✅ |
> | /list, /mytickets | List tickets | ✅ |
> | /status [no] | Check status | ✅ |
> | /chat | Start chat mode | ✅ |
> | /end, /endchat | End chat | ✅ |
> | /cari [query] | Search KB | ✅ |
> | /search [query] | Alias | ✅ |
> | /bahasa | Change language | ✅ |
> | /language | Alias | ✅ |
> | /settings | Settings menu | ✅ |
> | /queue | Agent: view queue | ✅ |
> | /assign [no] | Agent: take ticket | ✅ |
> | /resolve [no] | Agent: resolve | ✅ |
> | /stats | Agent: statistics | ✅ |
> | /link | Link account | ✅ |
> | /unlink | Unlink account | ✅ |
> | /help | Show help | ✅ |
> 
> ### Callback Actions (17.6):
> - ✅ main_menu, my_tickets, settings, help
> - ✅ new_ticket, ticket_wizard, ticket_quick_guide
> - ✅ view_ticket, enter_chat, exit_chat
> - ✅ change_priority, set_priority
> - ✅ select_category, select_priority
> - ✅ toggle_notifications, change_language, set_language
> - ✅ survey_rating, skip_survey
> - ✅ assign_ticket, search_kb
> 
> ### migrations/ (17.9):
> - ✅ 1732924800000-AddTelegramSessionV7Fields.ts
> 
> **NOTE:** Restart backend untuk menerapkan perubahan!

### 17.1 Current State Analysis

#### 17.1.1 Existing Features
| Feature | Status | Quality |
|---------|--------|---------|
| Account Linking | ✅ Working | Good |
| Ticket Creation | ✅ Working | Basic |
| Ticket Listing | ✅ Working | Basic |
| Chat Mode | ✅ Working | Good |
| Priority Change | ✅ Working | Basic |
| Notifications | ✅ Working | Basic |
| Photo/Document | ✅ Working | Good |
| Agent Notifications | ✅ Working | Basic |

#### 17.1.2 Current Pain Points
1. **UX Issues:**
   - Menu navigation tidak intuitif
   - Pesan terlalu panjang/verbose
   - Tidak ada quick actions
   - Flow pembuatan tiket terlalu banyak langkah

2. **Missing Features:**
   - Tidak ada inline mode untuk quick search
   - Tidak ada Web App (Mini App) integration
   - Tidak ada voice message support
   - Tidak ada multi-language
   - Tidak ada scheduled notifications
   - Tidak ada satisfaction survey

3. **Agent Experience:**
   - Agent tidak bisa assign tiket dari Telegram
   - Tidak ada quick reply templates
   - Tidak ada ticket filtering

4. **Performance:**
   - Tidak ada message batching
   - Tidak ada smart caching
   - Rate limiting basic

---

### 17.2 Redesign Goals

```
┌─────────────────────────────────────────────────────────────────┐
│                    TELEGRAM BOT V2 GOALS                        │
├─────────────────────────────────────────────────────────────────┤
│ 1. Faster Ticket Creation    → From 4 steps to 1-2 steps       │
│ 2. Better Agent Experience   → Quick actions, templates        │
│ 3. Rich Media Support        → Voice, location, contact        │
│ 4. Web App Integration       → Full ticket form in Mini App    │
│ 5. Smart Notifications       → Batched, prioritized, scheduled │
│ 6. Multi-language            → ID/EN with auto-detect          │
│ 7. Analytics Dashboard       → Usage stats, response times     │
└─────────────────────────────────────────────────────────────────┘
```

---

### 17.3 Architecture Redesign

#### 17.3.1 New Module Structure
```
apps/backend/src/modules/telegram/
├── telegram.module.ts
├── telegram.service.ts              # Core service
├── telegram.controller.ts           # Webhook & API
├── telegram.update.ts               # Bot handlers (refactored)
├── telegram-chat-bridge.service.ts  # Chat bridging
│
├── handlers/                        # NEW: Modular handlers
│   ├── start.handler.ts
│   ├── ticket.handler.ts
│   ├── chat.handler.ts
│   ├── settings.handler.ts
│   ├── agent.handler.ts
│   └── inline.handler.ts
│
├── keyboards/                       # NEW: Keyboard builders
│   ├── main-menu.keyboard.ts
│   ├── ticket-actions.keyboard.ts
│   ├── priority.keyboard.ts
│   ├── category.keyboard.ts
│   └── agent-actions.keyboard.ts
│
├── templates/                       # NEW: Message templates
│   ├── messages.id.ts               # Indonesian
│   ├── messages.en.ts               # English
│   └── index.ts
│
├── middleware/                      # NEW: Bot middleware
│   ├── auth.middleware.ts
│   ├── rate-limit.middleware.ts
│   ├── language.middleware.ts
│   └── logging.middleware.ts
│
├── webapp/                          # NEW: Mini App support
│   ├── webapp.controller.ts
│   ├── webapp.service.ts
│   └── dto/
│
├── entities/
│   └── telegram-session.entity.ts   # Updated
│
├── enums/
│   ├── telegram-state.enum.ts
│   ├── telegram-command.enum.ts     # NEW
│   └── telegram-language.enum.ts    # NEW
│
├── dto/
│   ├── create-ticket-bot.dto.ts
│   ├── webapp-ticket.dto.ts         # NEW
│   └── quick-reply.dto.ts           # NEW
│
├── interfaces/
│   └── telegram-context.interface.ts
│
└── utils/
    ├── message-formatter.ts         # NEW
    ├── keyboard-builder.ts          # NEW
    └── media-handler.ts             # NEW
```

#### 17.3.2 Updated Entity
```typescript
// telegram-session.entity.ts
@Entity('telegram_sessions')
export class TelegramSession {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'bigint', unique: true })
    telegramId: string;

    @Column({ nullable: true })
    telegramUsername: string;

    @Column({ nullable: true })
    telegramFirstName: string;

    @Column({ type: 'bigint' })
    chatId: string;

    @Column({ nullable: true })
    userId: string;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column({ default: 'IDLE' })
    state: string;

    @Column({ type: 'jsonb', nullable: true })
    stateData: any;

    @Column({ nullable: true })
    linkedAt: Date;

    @Column({ nullable: true })
    activeTicketId: string;

    @Column({ nullable: true })
    lastActivityAt: Date;

    // NEW FIELDS
    @Column({ default: 'id' })
    language: string; // 'id' | 'en'

    @Column({ default: true })
    notificationsEnabled: boolean;

    @Column({ type: 'jsonb', default: '{}' })
    preferences: {
        notifyNewReply: boolean;
        notifyStatusChange: boolean;
        notifySlaWarning: boolean;
        quietHoursStart?: string; // "22:00"
        quietHoursEnd?: string;   // "07:00"
    };

    @Column({ type: 'jsonb', default: '[]' })
    quickReplies: string[]; // Saved quick reply templates

    @Column({ default: 0 })
    ticketsCreated: number;

    @Column({ default: 0 })
    messagesCount: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
```

---

### 17.4 Feature Specifications

#### 17.4.1 Quick Ticket Creation (One-Step)
```
USER: /tiket Laptop tidak bisa connect WiFi

BOT:  🎫 Tiket Express Dibuat!
      
      #301124-IT-0012
      📌 Laptop tidak bisa connect WiFi
      
      ⚡ Prioritas: Medium (auto)
      📁 Kategori: Network (auto)
      
      ━━━━━━━━━━━━━━━━━━━━━━
      [💬 Chat] [⚡ Ubah Prioritas] [📋 Detail]
```

**Implementation:**
```typescript
// handlers/ticket.handler.ts
@Command('tiket')
@Command('ticket')
async onQuickTicket(@Ctx() ctx: Context) {
    const text = ctx.message.text.replace(/^\/(tiket|ticket)\s*/i, '').trim();
    
    if (!text) {
        return this.showTicketWizard(ctx);
    }
    
    // AI-powered auto-categorization
    const { category, priority } = await this.aiService.analyzeTicket(text);
    
    const ticket = await this.ticketService.create({
        title: text.substring(0, 100),
        description: text,
        category,
        priority,
        userId: session.userId,
        source: 'TELEGRAM_QUICK',
    });
    
    await ctx.replyWithHTML(
        this.templates.quickTicketCreated(ticket, session.language),
        this.keyboards.ticketActions(ticket.id)
    );
}
```

#### 17.4.2 Telegram Web App (Mini App)
```
BOT: 🎫 Buat Tiket Baru
     
     Pilih cara membuat tiket:
     
     [⚡ Quick (1 pesan)]
     [📝 Form Lengkap (Web App)]  ← Opens Mini App
     [❌ Batal]
```

**Web App Features:**
- Full ticket form dengan validation
- File upload dengan preview
- Category dropdown
- Priority selector
- Rich text description
- Draft auto-save

**Implementation:**
```typescript
// webapp/webapp.controller.ts
@Controller('telegram/webapp')
export class WebAppController {
    @Post('ticket')
    @UseGuards(TelegramWebAppGuard)
    async createTicketFromWebApp(
        @Body() dto: WebAppTicketDto,
        @TelegramUser() user: TelegramWebAppUser
    ) {
        // Validate Web App data
        const isValid = this.telegramService.validateWebAppData(dto.initData);
        if (!isValid) throw new UnauthorizedException();
        
        const ticket = await this.ticketService.create({
            ...dto,
            source: 'TELEGRAM_WEBAPP',
            userId: user.id,
        });
        
        // Send confirmation to chat
        await this.telegramService.sendTicketConfirmation(
            user.telegramChatId,
            ticket
        );
        
        return { success: true, ticketId: ticket.id };
    }
}
```

#### 17.4.3 Redesigned Main Menu
```
🏠 Menu Utama iDesk

Halo, Budi! 👋

📊 Tiket Aktif: 3
   └ 1 menunggu balasan

━━━━━━━━━━━━━━━━━━━━━━

[🎫 Buat Tiket]     [📋 Tiket Saya]
[💬 Chat Support]   [🔍 Cari KB]
[⚙️ Pengaturan]     [❓ Bantuan]
```

**Keyboard Builder:**
```typescript
// keyboards/main-menu.keyboard.ts
export class MainMenuKeyboard {
    static build(session: TelegramSession, stats: UserStats) {
        const t = getTemplates(session.language);
        
        return Markup.inlineKeyboard([
            [
                Markup.button.callback(t.btn.newTicket, 'new_ticket'),
                Markup.button.callback(t.btn.myTickets, 'my_tickets'),
            ],
            [
                Markup.button.callback(t.btn.chat, 'start_chat'),
                Markup.button.callback(t.btn.searchKb, 'search_kb'),
            ],
            [
                Markup.button.callback(t.btn.settings, 'settings'),
                Markup.button.callback(t.btn.help, 'help'),
            ],
        ]);
    }
}
```

#### 17.4.4 Voice Message Support
```
USER: [🎤 Voice Message: 15 detik]

BOT:  🎤 Pesan suara diterima!
      
      📝 Transkripsi:
      "Printer di lantai 3 tidak bisa print,
       error paper jam tapi tidak ada kertas
       nyangkut"
      
      ━━━━━━━━━━━━━━━━━━━━━━
      [✅ Kirim] [✏️ Edit] [❌ Batal]
```

**Implementation:**
```typescript
// handlers/voice.handler.ts
@On('voice')
async onVoice(@Ctx() ctx: Context) {
    const session = await this.getSession(ctx);
    
    if (session.state !== TelegramState.CHAT_MODE) {
        return ctx.reply(this.t('voice.needChatMode', session.language));
    }
    
    // Download voice file
    const voice = ctx.message.voice;
    const fileLink = await ctx.telegram.getFileLink(voice.file_id);
    const audioPath = await this.uploadService.downloadFromUrl({
        url: fileLink.href,
        folder: 'telegram/voice',
    });
    
    // Transcribe using Whisper/Google Speech
    const transcription = await this.speechService.transcribe(audioPath);
    
    // Show transcription for confirmation
    await ctx.replyWithHTML(
        this.templates.voiceTranscription(transcription, session.language),
        Markup.inlineKeyboard([
            [
                Markup.button.callback('✅ Kirim', `send_voice:${audioPath}`),
                Markup.button.callback('✏️ Edit', `edit_voice:${audioPath}`),
            ],
            [Markup.button.callback('❌ Batal', 'cancel_voice')],
        ])
    );
}
```

#### 17.4.5 Inline Mode for Quick Search
```
USER: @idesk_bot printer error

RESULTS:
┌─────────────────────────────────────┐
│ 📄 Cara Reset Printer HP           │
│    Knowledge Base • 5 min read     │
├─────────────────────────────────────┤
│ 🎫 Tiket: Printer lantai 2 error   │
│    #281124-IT-0023 • Resolved      │
├─────────────────────────────────────┤
│ 🎫 Tiket: Paper jam printer Epson  │
│    #251124-IT-0018 • In Progress   │
└─────────────────────────────────────┘
```

**Implementation:**
```typescript
// handlers/inline.handler.ts
@InlineQuery()
async onInlineQuery(@Ctx() ctx: Context) {
    const query = ctx.inlineQuery.query.trim();
    const from = ctx.inlineQuery.from;
    
    if (query.length < 2) {
        return ctx.answerInlineQuery([]);
    }
    
    const session = await this.getSession(String(from.id));
    const results: InlineQueryResult[] = [];
    
    // Search Knowledge Base
    const articles = await this.kbService.search(query, { limit: 3 });
    for (const article of articles) {
        results.push({
            type: 'article',
            id: `kb_${article.id}`,
            title: `📄 ${article.title}`,
            description: article.excerpt,
            input_message_content: {
                message_text: `📄 *${article.title}*\n\n${article.excerpt}\n\n[Baca selengkapnya](${FRONTEND_URL}/client/kb/articles/${article.id})`,
                parse_mode: 'Markdown',
            },
        });
    }
    
    // Search user's tickets (if linked)
    if (session?.userId) {
        const tickets = await this.ticketService.search(query, {
            userId: session.userId,
            limit: 3,
        });
        
        for (const ticket of tickets) {
            results.push({
                type: 'article',
                id: `ticket_${ticket.id}`,
                title: `🎫 ${ticket.title}`,
                description: `#${ticket.ticketNumber} • ${ticket.status}`,
                input_message_content: {
                    message_text: this.formatTicketInline(ticket),
                    parse_mode: 'HTML',
                },
            });
        }
    }
    
    await ctx.answerInlineQuery(results, { cache_time: 60 });
}
```

#### 17.4.6 Agent Features
```
🎫 Tiket Baru Masuk!

#301124-IT-0012
📌 Laptop tidak bisa connect WiFi
👤 Budi Santoso (IT Department)
⚡ Medium | 📁 Network

━━━━━━━━━━━━━━━━━━━━━━
[✋ Ambil] [👀 Detail] [⏭️ Skip]
```

**Agent Quick Actions:**
```typescript
// handlers/agent.handler.ts
@Action(/assign_ticket:(.+)/)
async onAssignTicket(@Ctx() ctx: Context) {
    const ticketId = ctx.match[1];
    const agentTelegramId = String(ctx.from.id);
    
    const session = await this.getSession(agentTelegramId);
    if (!session?.userId) {
        return ctx.answerCbQuery('❌ Link akun dulu');
    }
    
    const agent = await this.userRepo.findOne({ where: { id: session.userId } });
    if (agent.role !== 'AGENT' && agent.role !== 'ADMIN') {
        return ctx.answerCbQuery('❌ Akses ditolak');
    }
    
    // Assign ticket
    const ticket = await this.ticketService.assign(ticketId, agent.id);
    
    await ctx.answerCbQuery('✅ Tiket diambil!');
    await ctx.editMessageText(
        this.templates.ticketAssigned(ticket, agent, session.language),
        Markup.inlineKeyboard([
            [Markup.button.callback('💬 Balas', `enter_chat:${ticketId}`)],
            [Markup.button.callback('📋 Detail', `view_ticket:${ticketId}`)],
        ])
    );
    
    // Notify user
    await this.notifyTicketAssigned(ticket, agent);
}

// Quick reply templates for agents
@Action('quick_replies')
async onQuickReplies(@Ctx() ctx: Context) {
    const templates = [
        'Terima kasih sudah menghubungi. Saya akan segera membantu.',
        'Mohon informasikan detail lebih lanjut: ...',
        'Sudah saya cek, masalah sedang dalam proses perbaikan.',
        'Masalah sudah teratasi. Silakan cek kembali.',
        'Apakah ada kendala lain yang bisa saya bantu?',
    ];
    
    const buttons = templates.map((t, i) => [
        Markup.button.callback(
            t.substring(0, 40) + '...',
            `send_quick:${i}`
        )
    ]);
    
    await ctx.replyWithHTML(
        '📝 <b>Quick Replies</b>\n\nPilih template:',
        Markup.inlineKeyboard(buttons)
    );
}
```

#### 17.4.7 Multi-Language Support
```typescript
// templates/messages.id.ts
export const messagesId = {
    welcome: {
        title: '👋 Selamat Datang di iDesk!',
        subtitle: 'Saya dapat membantu Anda:',
        features: [
            '• Membuat tiket support',
            '• Melacak status tiket',
            '• Mencari artikel bantuan',
        ],
    },
    btn: {
        newTicket: '🎫 Buat Tiket',
        myTickets: '📋 Tiket Saya',
        chat: '💬 Chat',
        searchKb: '🔍 Cari KB',
        settings: '⚙️ Pengaturan',
        help: '❓ Bantuan',
    },
    ticket: {
        created: '✅ Tiket Berhasil Dibuat!',
        notFound: '❌ Tiket tidak ditemukan',
        updated: '🔄 Tiket diupdate',
    },
    errors: {
        notLinked: '⚠️ Akun belum terhubung. Gunakan /link',
        unauthorized: '❌ Anda tidak memiliki akses',
        serverError: '❌ Terjadi kesalahan server',
    },
};

// templates/messages.en.ts
export const messagesEn = {
    welcome: {
        title: '👋 Welcome to iDesk!',
        subtitle: 'I can help you:',
        features: [
            '• Create support tickets',
            '• Track ticket status',
            '• Search help articles',
        ],
    },
    // ... rest in English
};

// templates/index.ts
export function getTemplates(lang: string = 'id') {
    return lang === 'en' ? messagesEn : messagesId;
}
```

#### 17.4.8 Smart Notifications
```typescript
// notification batching & scheduling
interface NotificationQueue {
    userId: string;
    notifications: QueuedNotification[];
    scheduledAt: Date;
}

// telegram.service.ts
async queueNotification(userId: string, notification: Notification) {
    const session = await this.getSessionByUserId(userId);
    if (!session || !session.notificationsEnabled) return;
    
    // Check quiet hours
    if (this.isQuietHours(session.preferences)) {
        return this.scheduleForLater(userId, notification);
    }
    
    // Batch similar notifications
    const pending = await this.getPendingNotifications(userId);
    if (pending.length > 0 && this.canBatch(pending[0], notification)) {
        return this.addToBatch(userId, notification);
    }
    
    // Send immediately if high priority
    if (notification.priority === 'HIGH' || notification.type === 'SLA_BREACH') {
        return this.sendImmediately(userId, notification);
    }
    
    // Queue for batch send (every 5 minutes)
    await this.addToQueue(userId, notification);
}

// Batch notification format
async sendBatchNotification(userId: string, notifications: Notification[]) {
    const session = await this.getSessionByUserId(userId);
    
    const message = 
        `📬 <b>Update Tiket Anda</b>\n\n` +
        notifications.map(n => `• ${n.title}`).join('\n') +
        `\n\n<i>${notifications.length} notifikasi</i>`;
    
    await this.sendMessage(session.chatId, message, {
        reply_markup: {
            inline_keyboard: [[
                { text: '📋 Lihat Semua', callback_data: 'my_tickets' }
            ]]
        }
    });
}
```

#### 17.4.9 Satisfaction Survey
```
✅ Tiket #301124-IT-0012 Selesai!

"Laptop tidak bisa connect WiFi"
Ditangani oleh: Andi (IT Support)

━━━━━━━━━━━━━━━━━━━━━━

Bagaimana pengalaman Anda?

[😍 Sangat Puas] [😊 Puas]
[😐 Cukup]      [😕 Kurang]

[⏭️ Lewati Survey]
```

**Implementation:**
```typescript
// handlers/survey.handler.ts
@Action(/survey_rating:(.+):(.+)/)
async onSurveyRating(@Ctx() ctx: Context) {
    const [ticketId, rating] = ctx.match.slice(1);
    
    await this.surveyService.submitRating({
        ticketId,
        rating: parseInt(rating),
        source: 'TELEGRAM',
    });
    
    await ctx.answerCbQuery('Terima kasih atas feedback Anda! 🙏');
    await ctx.editMessageText(
        '✅ <b>Terima Kasih!</b>\n\n' +
        'Feedback Anda sangat berharga untuk meningkatkan layanan kami.',
        { parse_mode: 'HTML' }
    );
}
```

#### 17.4.10 QR Code Quick Linking
```
🔗 Hubungkan Akun via QR Code

Scan QR code ini dengan kamera HP
atau buka di browser:

[QR CODE IMAGE]

📱 Link: idesk.app/link/abc123

Atau masukkan kode: 847291

⏱️ Berlaku 5 menit
```

---

### 17.5 Message Templates Redesign

#### Before (Verbose):
```
📝 Membuat Tiket Baru

Langkah 1/4: Masukkan judul tiket
(atau /cancel untuk membatalkan)
```

#### After (Compact & Clear):
```
📝 Judul tiket? (min. 5 karakter)
```

#### Ticket Card Redesign:
```
┌─────────────────────────────────────┐
│ 🎫 #301124-IT-0012                  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 📌 Laptop tidak bisa connect WiFi  │
│                                     │
│ 🟡 In Progress  ⚡ Medium           │
│ 👤 Andi         🕐 2h ago           │
│                                     │
│ [💬 Chat] [📋 Detail] [⚡ Priority] │
└─────────────────────────────────────┘
```

---

### 17.6 New Commands & Actions

#### User Commands:
| Command | Description | Example |
|---------|-------------|---------|
| `/start` | Menu utama | - |
| `/tiket <text>` | Quick ticket creation | `/tiket printer error` |
| `/tiket` | Ticket wizard | - |
| `/list` | Daftar tiket | - |
| `/status <no>` | Cek status | `/status 301124-IT-0012` |
| `/chat` | Mode chat | - |
| `/end` | Keluar chat | - |
| `/cari <query>` | Cari KB | `/cari reset password` |
| `/bahasa` | Ganti bahasa | - |
| `/settings` | Pengaturan | - |
| `/help` | Bantuan | - |

#### Agent Commands:
| Command | Description | Access |
|---------|-------------|--------|
| `/queue` | Lihat antrian tiket | Agent/Admin |
| `/assign <no>` | Ambil tiket | Agent/Admin |
| `/resolve <no>` | Selesaikan tiket | Agent/Admin |
| `/stats` | Statistik hari ini | Agent/Admin |

#### Callback Actions:
```typescript
enum CallbackAction {
    // Navigation
    MAIN_MENU = 'main_menu',
    MY_TICKETS = 'my_tickets',
    SETTINGS = 'settings',
    
    // Ticket
    NEW_TICKET = 'new_ticket',
    NEW_TICKET_WEBAPP = 'new_ticket_webapp',
    VIEW_TICKET = 'view_ticket',
    ENTER_CHAT = 'enter_chat',
    EXIT_CHAT = 'exit_chat',
    
    // Priority
    CHANGE_PRIORITY = 'change_priority',
    SET_PRIORITY = 'set_priority',
    
    // Category
    SELECT_CATEGORY = 'select_category',
    
    // Agent
    ASSIGN_TICKET = 'assign_ticket',
    RESOLVE_TICKET = 'resolve_ticket',
    QUICK_REPLY = 'quick_reply',
    
    // Survey
    SURVEY_RATING = 'survey_rating',
    SKIP_SURVEY = 'skip_survey',
    
    // Settings
    TOGGLE_NOTIFICATIONS = 'toggle_notifications',
    CHANGE_LANGUAGE = 'change_language',
    SET_QUIET_HOURS = 'set_quiet_hours',
}
```

---

### 17.7 Implementation Priority

| Phase | Features | Effort | Priority |
|-------|----------|--------|----------|
| **Phase 1** | Quick Ticket, Menu Redesign, Templates | 3 days | HIGH |
| **Phase 2** | Multi-language, Notification Batching | 2 days | HIGH |
| **Phase 3** | Agent Features, Quick Replies | 2 days | HIGH |
| **Phase 4** | Voice Support, Inline Mode | 3 days | MEDIUM |
| **Phase 5** | Web App Integration | 3 days | MEDIUM |
| **Phase 6** | Survey, Analytics, QR Linking | 2 days | LOW |

**Total Estimate: 15 days**

---

### 17.8 Phase 1 Implementation Detail

#### 17.8.1 Refactor Update Handler
```typescript
// telegram.update.ts (simplified - delegates to handlers)
@Update()
export class TelegramUpdate {
    constructor(
        private startHandler: StartHandler,
        private ticketHandler: TicketHandler,
        private chatHandler: ChatHandler,
        private settingsHandler: SettingsHandler,
        private agentHandler: AgentHandler,
    ) {}

    @Start()
    async onStart(@Ctx() ctx: Context) {
        return this.startHandler.handle(ctx);
    }

    @Command('tiket')
    @Command('ticket')
    async onTicket(@Ctx() ctx: Context) {
        return this.ticketHandler.handleQuickTicket(ctx);
    }

    @Command('list')
    @Command('mytickets')
    async onList(@Ctx() ctx: Context) {
        return this.ticketHandler.handleList(ctx);
    }

    @Command('chat')
    async onChat(@Ctx() ctx: Context) {
        return this.chatHandler.handleStartChat(ctx);
    }

    @Command('end')
    @Command('endchat')
    async onEndChat(@Ctx() ctx: Context) {
        return this.chatHandler.handleEndChat(ctx);
    }

    @On('text')
    async onText(@Ctx() ctx: Context) {
        // Route based on state
        const session = await this.telegramService.getSession(String(ctx.from.id));
        
        if (session?.state === TelegramState.CHAT_MODE) {
            return this.chatHandler.handleMessage(ctx);
        }
        
        return this.handleStatefulMessage(ctx, session);
    }

    @On('callback_query')
    async onCallback(@Ctx() ctx: Context) {
        return this.handleCallback(ctx);
    }
}
```

#### 17.8.2 Start Handler
```typescript
// handlers/start.handler.ts
@Injectable()
export class StartHandler {
    constructor(
        private telegramService: TelegramService,
        private ticketService: TicketService,
    ) {}

    async handle(ctx: Context) {
        const from = ctx.from;
        const session = await this.telegramService.getOrCreateSession(
            String(from.id),
            String(ctx.chat.id),
            from
        );

        const t = getTemplates(session.language);
        const isLinked = !!session.userId;

        if (isLinked) {
            // Get stats
            const stats = await this.ticketService.getUserStats(session.userId);
            
            const message = this.buildWelcomeMessage(t, session, stats);
            await ctx.replyWithHTML(message, MainMenuKeyboard.build(session, stats));
        } else {
            await this.showLinkPrompt(ctx, t);
        }
    }

    private buildWelcomeMessage(t: any, session: TelegramSession, stats: UserStats) {
        return `
🏠 <b>${t.welcome.title}</b>

Halo, ${session.telegramFirstName}! 👋

📊 Tiket Aktif: <b>${stats.activeTickets}</b>
   └ ${stats.waitingReply} menunggu balasan

━━━━━━━━━━━━━━━━━━━━━━
        `.trim();
    }
}
```

#### 17.8.3 Quick Ticket Handler
```typescript
// handlers/ticket.handler.ts
@Injectable()
export class TicketHandler {
    async handleQuickTicket(ctx: Context) {
        const session = await this.telegramService.getSession(String(ctx.from.id));
        const t = getTemplates(session?.language);

        if (!session?.userId) {
            return ctx.replyWithHTML(t.errors.notLinked);
        }

        const text = (ctx.message as any).text
            .replace(/^\/(tiket|ticket)\s*/i, '')
            .trim();

        if (!text) {
            // Show ticket creation options
            return ctx.replyWithHTML(
                '📝 <b>Buat Tiket</b>\n\nPilih cara:',
                Markup.inlineKeyboard([
                    [Markup.button.callback('⚡ Quick (1 pesan)', 'ticket_quick_guide')],
                    [Markup.button.callback('📝 Step-by-step', 'ticket_wizard')],
                    [Markup.button.webApp('🌐 Form Lengkap', `${WEBAPP_URL}/ticket/create`)],
                    [Markup.button.callback('❌ Batal', 'main_menu')],
                ])
            );
        }

        // Quick ticket creation
        try {
            const { category, priority } = await this.analyzeTicketText(text);
            
            const ticket = await this.ticketService.create({
                title: text.length > 100 ? text.substring(0, 97) + '...' : text,
                description: text,
                category,
                priority,
                userId: session.userId,
                source: TicketSource.TELEGRAM,
            });

            await ctx.replyWithHTML(
                this.formatQuickTicketSuccess(ticket, t),
                TicketActionsKeyboard.build(ticket.id)
            );

            // Notify agents
            await this.telegramService.notifyNewTicketToAgents(ticket);

        } catch (error) {
            this.logger.error('Quick ticket creation failed:', error);
            await ctx.reply(t.errors.serverError);
        }
    }

    private async analyzeTicketText(text: string): Promise<{ category: string; priority: string }> {
        // Simple keyword-based categorization (can be replaced with AI)
        const lowerText = text.toLowerCase();
        
        let category = 'GENERAL';
        if (lowerText.includes('printer') || lowerText.includes('laptop') || lowerText.includes('komputer')) {
            category = 'HARDWARE';
        } else if (lowerText.includes('wifi') || lowerText.includes('internet') || lowerText.includes('network')) {
            category = 'NETWORK';
        } else if (lowerText.includes('email') || lowerText.includes('outlook')) {
            category = 'EMAIL';
        } else if (lowerText.includes('password') || lowerText.includes('login') || lowerText.includes('akun')) {
            category = 'ACCOUNT';
        } else if (lowerText.includes('aplikasi') || lowerText.includes('software') || lowerText.includes('install')) {
            category = 'SOFTWARE';
        }

        let priority = 'MEDIUM';
        if (lowerText.includes('urgent') || lowerText.includes('segera') || lowerText.includes('darurat')) {
            priority = 'HIGH';
        } else if (lowerText.includes('tidak bisa') || lowerText.includes('error') || lowerText.includes('gagal')) {
            priority = 'MEDIUM';
        }

        return { category, priority };
    }

    private formatQuickTicketSuccess(ticket: Ticket, t: any): string {
        const priorityEmoji = {
            LOW: '🟢',
            MEDIUM: '🟡',
            HIGH: '🟠',
            CRITICAL: '🔴',
        };

        return `
🎫 <b>Tiket Express Dibuat!</b>

<b>#${ticket.ticketNumber}</b>
📌 ${ticket.title}

${priorityEmoji[ticket.priority]} Prioritas: ${ticket.priority} (auto)
📁 Kategori: ${ticket.category} (auto)

━━━━━━━━━━━━━━━━━━━━━━
Tim support akan segera merespon.
        `.trim();
    }
}
```

---

### 17.9 Database Migrations

```sql
-- Migration: Add new telegram session fields
ALTER TABLE telegram_sessions 
ADD COLUMN IF NOT EXISTS language VARCHAR(5) DEFAULT 'id',
ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{"notifyNewReply": true, "notifyStatusChange": true, "notifySlaWarning": true}',
ADD COLUMN IF NOT EXISTS quick_replies JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS tickets_created INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS messages_count INTEGER DEFAULT 0;

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_telegram_sessions_user_id ON telegram_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_sessions_active_ticket ON telegram_sessions(active_ticket_id);
```

---

### 17.10 Testing Checklist

#### Unit Tests:
- [ ] Quick ticket text analysis
- [ ] Message template formatting
- [ ] Keyboard builders
- [ ] Session state management
- [ ] Notification batching logic

#### Integration Tests:
- [ ] Full ticket creation flow
- [ ] Chat mode message bridging
- [ ] Agent assignment flow
- [ ] Survey submission

#### E2E Tests:
- [ ] /start command → menu display
- [ ] /tiket quick creation
- [ ] Inline mode search
- [ ] Web App ticket creation

#### Manual Tests:
- [ ] Test dengan akun Telegram real
- [ ] Test semua button callbacks
- [ ] Test notification delivery
- [ ] Test quiet hours
- [ ] Test multi-language switching

---

### 17.11 Monitoring & Analytics

```typescript
// Track bot usage
interface TelegramAnalytics {
    dailyActiveUsers: number;
    ticketsCreatedViaBot: number;
    averageResponseTime: number;
    commandUsage: Record<string, number>;
    errorRate: number;
    satisfactionScore: number;
}

// Log all bot interactions
async logInteraction(ctx: Context, action: string, metadata?: any) {
    await this.analyticsService.log({
        source: 'TELEGRAM_BOT',
        action,
        userId: session?.userId,
        telegramId: ctx.from.id,
        metadata,
        timestamp: new Date(),
    });
}
```

---

### 17.12 Security Considerations

1. **Webhook Verification:**
   ```typescript
   // Verify Telegram webhook requests
   @Post('webhook')
   async webhook(@Req() req: Request, @Res() res: Response) {
       const secretToken = req.headers['x-telegram-bot-api-secret-token'];
       if (secretToken !== process.env.TELEGRAM_WEBHOOK_SECRET) {
           throw new UnauthorizedException();
       }
       // Process update...
   }
   ```

2. **Web App Data Validation:**
   ```typescript
   validateWebAppData(initData: string): boolean {
       const urlParams = new URLSearchParams(initData);
       const hash = urlParams.get('hash');
       urlParams.delete('hash');
       
       const dataCheckString = Array.from(urlParams.entries())
           .sort(([a], [b]) => a.localeCompare(b))
           .map(([key, value]) => `${key}=${value}`)
           .join('\n');
       
       const secretKey = crypto
           .createHmac('sha256', 'WebAppData')
           .update(process.env.TELEGRAM_BOT_TOKEN)
           .digest();
       
       const expectedHash = crypto
           .createHmac('sha256', secretKey)
           .update(dataCheckString)
           .digest('hex');
       
       return hash === expectedHash;
   }
   ```

3. **Rate Limiting:**
   ```typescript
   // Per-user rate limiting
   @UseGuards(TelegramRateLimitGuard)
   // 20 requests per minute per user
   ```

4. **Input Sanitization:**
   - Sanitize all user input sebelum display
   - Escape HTML entities
   - Limit message length

---

*Dokumen diupdate pada 29 November 2025 - Versi 6.0 (Telegram Bot Redesign Planning)*

---

## 18. SLA System Complete Overhaul (V8) - CRITICAL PRIORITY

**Tanggal:** 30 November 2025  
**Status:** PENDING IMPLEMENTATION  
**Priority:** CRITICAL - Fixes core business logic

### 18.1 Current Issues Analysis

| Issue | Description | Impact |
|-------|-------------|--------|
| **Overdue Tidak Terhitung** | SLA overdue check menggunakan `createdAt` bukan waktu mulai kerja | Semua tiket tampak overdue meski baru dibuat |
| **Target Date Langsung Aktif** | `slaTarget` dihitung dari `createdAt`, bukan dari status IN_PROGRESS | SLA tidak akurat, tidak fair bagi agent |
| **First Response Time Tidak Berfungsi** | Field `responseTimeMinutes` ada di config tapi tidak di-track di ticket | Tidak ada monitoring first response SLA |
| **Waiting Vendor Notification** | Tidak ada notifikasi khusus saat status WAITING_VENDOR | User tidak informed tentang jadwal vendor |

---

### 18.2 Database Schema Changes

**File:** `apps/backend/src/modules/ticketing/entities/ticket.entity.ts`

```typescript
// TAMBAHKAN field-field berikut ke Ticket entity:

@Entity('tickets')
export class Ticket {
    // ... existing fields ...

    // === SLA Enhancement Fields ===
    
    @Column({ nullable: true })
    slaStartedAt: Date;  // Waktu SLA mulai dihitung (saat status -> IN_PROGRESS)

    @Column({ nullable: true })
    firstResponseAt: Date;  // Waktu first response dari agent

    @Column({ nullable: true })
    firstResponseTarget: Date;  // Target waktu first response

    @Column({ default: false })
    isFirstResponseBreached: boolean;  // Flag breach first response

    @Column({ nullable: true })
    resolvedAt: Date;  // Waktu tiket resolved

    @Column({ nullable: true })
    waitingVendorAt: Date;  // Waktu masuk waiting vendor

    @Column({ type: 'int', default: 0 })
    totalWaitingVendorMinutes: number;  // Total waktu menunggu vendor
}
```

**Migration File:** `apps/backend/src/migrations/YYYYMMDDHHMMSS-AddSlaEnhancementFields.ts`

```typescript
import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSlaEnhancementFields1701340800000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns('tickets', [
            new TableColumn({
                name: 'slaStartedAt',
                type: 'timestamp',
                isNullable: true,
            }),
            new TableColumn({
                name: 'firstResponseAt',
                type: 'timestamp',
                isNullable: true,
            }),
            new TableColumn({
                name: 'firstResponseTarget',
                type: 'timestamp',
                isNullable: true,
            }),
            new TableColumn({
                name: 'isFirstResponseBreached',
                type: 'boolean',
                default: false,
            }),
            new TableColumn({
                name: 'resolvedAt',
                type: 'timestamp',
                isNullable: true,
            }),
            new TableColumn({
                name: 'waitingVendorAt',
                type: 'timestamp',
                isNullable: true,
            }),
            new TableColumn({
                name: 'totalWaitingVendorMinutes',
                type: 'int',
                default: 0,
            }),
        ]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumns('tickets', [
            'slaStartedAt',
            'firstResponseAt', 
            'firstResponseTarget',
            'isFirstResponseBreached',
            'resolvedAt',
            'waitingVendorAt',
            'totalWaitingVendorMinutes',
        ]);
    }
}
```

---

### 18.3 SLA Logic Redesign

#### A. SLA Target Calculation (New Logic)

**SEBELUM (Salah):**
- `slaTarget` = `createdAt` + `resolutionTimeMinutes`
- SLA langsung berjalan sejak tiket dibuat

**SESUDAH (Benar):**
- `slaTarget` = `slaStartedAt` + `resolutionTimeMinutes`
- `slaStartedAt` di-set HANYA saat status berubah dari `TODO` ke `IN_PROGRESS`
- Jika status `WAITING_VENDOR`, SLA di-pause (sudah ada)

**File:** `apps/backend/src/modules/ticketing/services/ticket-update.service.ts`

```typescript
async updateTicket(ticketId: string, updateData: Partial<Ticket>, userId: string): Promise<Ticket> {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId }, relations: ['user'] });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const changes: string[] = [];
    const oldStatus = ticket.status;

    if (updateData.status && updateData.status !== ticket.status) {
        changes.push(`Status changed from ${ticket.status} to ${updateData.status}`);

        // === NEW: SLA Starts when status changes to IN_PROGRESS ===
        if (updateData.status === TicketStatus.IN_PROGRESS && oldStatus === TicketStatus.TODO) {
            const now = new Date();
            ticket.slaStartedAt = now;
            
            // Calculate SLA Target from NOW (not from createdAt)
            const slaConfig = await this.slaConfigRepo.findOne({ 
                where: { priority: ticket.priority } 
            });
            
            if (slaConfig) {
                // Resolution Target
                ticket.slaTarget = new Date(now.getTime() + slaConfig.resolutionTimeMinutes * 60000);
                
                // First Response Target (if not already responded)
                if (!ticket.firstResponseAt) {
                    ticket.firstResponseTarget = new Date(now.getTime() + slaConfig.responseTimeMinutes * 60000);
                }
                
                changes.push(`SLA Timer started. Target: ${ticket.slaTarget.toISOString()}`);
            }
        }

        // === WAITING_VENDOR Handling - Enhanced ===
        if (updateData.status === TicketStatus.WAITING_VENDOR) {
            ticket.lastPausedAt = new Date();
            ticket.waitingVendorAt = new Date();
            
            // Send special notification and add system note
            await this.handleWaitingVendorStatus(ticket, user);
        } 
        else if (oldStatus === TicketStatus.WAITING_VENDOR) {
            // Resume from WAITING_VENDOR
            if (ticket.lastPausedAt) {
                const now = new Date();
                const diffMs = now.getTime() - new Date(ticket.lastPausedAt).getTime();
                const diffMinutes = Math.floor(diffMs / 60000);
                
                ticket.totalPausedMinutes = (ticket.totalPausedMinutes || 0) + diffMinutes;
                ticket.totalWaitingVendorMinutes = (ticket.totalWaitingVendorMinutes || 0) + diffMinutes;

                // Adjust SLA Target
                if (ticket.slaTarget) {
                    ticket.slaTarget = new Date(ticket.slaTarget.getTime() + diffMs);
                    changes.push(`SLA Target adjusted by ${diffMinutes} minutes (Waiting Vendor Duration)`);
                }

                // Adjust First Response Target if not breached yet
                if (ticket.firstResponseTarget && !ticket.firstResponseAt) {
                    ticket.firstResponseTarget = new Date(ticket.firstResponseTarget.getTime() + diffMs);
                }

                ticket.lastPausedAt = null;
                ticket.waitingVendorAt = null;
            }
        }

        // === RESOLVED Handling ===
        if (updateData.status === TicketStatus.RESOLVED) {
            ticket.resolvedAt = new Date();
        }
    }

    // ... rest of existing code ...
}

/**
 * Handle WAITING_VENDOR status change
 * - Send Telegram notification with vendor schedule info
 * - Add system message to ticket notes/discussion
 */
private async handleWaitingVendorStatus(ticket: Ticket, changedBy: User): Promise<void> {
    const ticketNumber = ticket.ticketNumber || ticket.id.split('-')[0];
    
    // Calculate next Thursday (vendor visit day)
    const nextThursday = this.getNextThursday();
    const formattedDate = nextThursday.toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    
    // === 1. Add System Message to Notes & Discussion ===
    const systemNote = `⏳ **Status Tiket Diubah ke Waiting Vendor**

📋 Tiket ini menunggu kunjungan vendor.
📅 Jadwal vendor datang: **Setiap hari Kamis**
📆 Perkiraan kunjungan terdekat: **${formattedDate}**

ℹ️ Estimasi waktu tunggu minimal: **1 minggu**
👤 Diubah oleh: ${changedBy.fullName}
🕐 Waktu: ${new Date().toLocaleString('id-ID')}

---
*SLA Timer di-pause selama menunggu vendor.*`;

    const systemMessage = this.messageRepo.create({
        content: systemNote,
        ticket,
        senderId: changedBy.id,
        isSystemMessage: true,
    });
    await this.messageRepo.save(systemMessage);

    // === 2. Send Telegram Notification ===
    if (this.telegramChatBridge && ticket.user?.telegramChatId) {
        const telegramMessage = 
            `🟠 <b>Status Tiket Menunggu Vendor</b>\n\n` +
            `📋 Tiket: <b>#${ticketNumber}</b>\n` +
            `📌 ${ticket.title}\n\n` +
            `📅 <b>Jadwal Kunjungan Vendor:</b>\n` +
            `   • Vendor datang setiap hari <b>Kamis</b>\n` +
            `   • Perkiraan kunjungan: <b>${formattedDate}</b>\n` +
            `   • Estimasi waktu tunggu: minimal 1 minggu\n\n` +
            `⏸️ <i>SLA Timer di-pause sampai vendor selesai.</i>`;

        try {
            await this.bot.telegram.sendMessage(
                ticket.user.telegramChatId,
                telegramMessage,
                { 
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '📋 Lihat Tiket', callback_data: `view_ticket:${ticket.id}` }
                        ]]
                    }
                }
            );
        } catch (error) {
            this.logger.error(`Failed to send waiting vendor notification: ${error.message}`);
        }
    }

    // Emit WebSocket event
    this.eventsGateway.notifyNewMessage(ticket.id, systemMessage);
}

/**
 * Get next Thursday date
 */
private getNextThursday(): Date {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 4 = Thursday
    const daysUntilThursday = (4 - dayOfWeek + 7) % 7 || 7; // If today is Thursday, get next week
    
    const nextThursday = new Date(now);
    nextThursday.setDate(now.getDate() + daysUntilThursday);
    nextThursday.setHours(9, 0, 0, 0); // Set to 9 AM
    
    return nextThursday;
}
```

---

### 18.4 First Response Time Implementation

**File:** `apps/backend/src/modules/ticketing/services/ticket-messaging.service.ts`

```typescript
async replyToTicket(ticketId: string, userId: string, content: string, files: string[] = [], mentionedUserIds: string[] = []) {
    const ticket = await this.ticketRepo.findOne({ 
        where: { id: ticketId }, 
        relations: ['user', 'assignedTo'] 
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Create Message
    const message = this.messageRepo.create({
        ticketId,
        senderId: userId,
        content,
        attachments: files,
    });
    const savedMessage = await this.messageRepo.save(message);

    // === NEW: Track First Response Time ===
    const isAgentOrAdmin = user.role === UserRole.AGENT || user.role === UserRole.ADMIN;
    const isFirstAgentReply = !ticket.firstResponseAt && isAgentOrAdmin;

    if (isFirstAgentReply) {
        ticket.firstResponseAt = new Date();
        
        // Check if first response SLA was breached
        if (ticket.firstResponseTarget && ticket.firstResponseAt > ticket.firstResponseTarget) {
            ticket.isFirstResponseBreached = true;
            this.logger.warn(`First Response SLA Breached for ticket #${ticket.ticketNumber}`);
        }
        
        await this.ticketRepo.save(ticket);
    }

    // Update Ticket Status if Agent replies (existing logic)
    if (isAgentOrAdmin && ticket.status === TicketStatus.TODO) {
        ticket.status = TicketStatus.IN_PROGRESS;
        
        // Also start SLA timer if not started
        if (!ticket.slaStartedAt) {
            const now = new Date();
            ticket.slaStartedAt = now;
            
            const slaConfig = await this.slaConfigRepo.findOne({ 
                where: { priority: ticket.priority } 
            });
            
            if (slaConfig) {
                ticket.slaTarget = new Date(now.getTime() + slaConfig.resolutionTimeMinutes * 60000);
            }
        }
        
        await this.ticketRepo.save(ticket);
    }

    // ... rest of existing code (WebSocket, events, etc.) ...
}
```

---

### 18.5 SLA Checker Service Update

**File:** `apps/backend/src/modules/ticketing/sla-checker.service.ts`

```typescript
@Injectable()
export class SlaCheckerService {
    private readonly logger = new Logger(SlaCheckerService.name);

    constructor(
        @InjectRepository(Ticket) private ticketRepo: Repository<Ticket>,
        @InjectRepository(CustomerSession) private sessionRepo: Repository<CustomerSession>,
        private readonly mailerService: MailerService,
        private readonly slaConfigService: SlaConfigService,
        @Optional() private readonly telegramService: TelegramService,
    ) {}

    @Cron(CronExpression.EVERY_10_MINUTES) // Changed from EVERY_HOUR for better accuracy
    async checkSla() {
        this.logger.log('Running SLA Checker...');

        // === Check Resolution Time SLA ===
        await this.checkResolutionSla();
        
        // === Check First Response SLA ===
        await this.checkFirstResponseSla();
    }

    private async checkResolutionSla(): Promise<void> {
        const now = new Date();

        // Get tickets that have SLA started and not yet overdue
        const tickets = await this.ticketRepo.find({
            where: [
                { status: TicketStatus.IN_PROGRESS, isOverdue: false },
                { status: TicketStatus.TODO, isOverdue: false, slaStartedAt: Not(IsNull()) },
            ],
            relations: ['user', 'assignedTo'],
        });

        for (const ticket of tickets) {
            // Skip if no SLA target or SLA not started yet
            if (!ticket.slaTarget || !ticket.slaStartedAt) continue;
            
            // Skip if waiting vendor (SLA paused)
            if (ticket.status === TicketStatus.WAITING_VENDOR) continue;

            const targetTime = new Date(ticket.slaTarget);

            if (now > targetTime && !ticket.isOverdue) {
                this.logger.warn(`Ticket #${ticket.ticketNumber} is OVERDUE!`);

                ticket.isOverdue = true;
                await this.ticketRepo.save(ticket);

                await this.sendOverdueNotifications(ticket, 'resolution');
            }
        }
    }

    private async checkFirstResponseSla(): Promise<void> {
        const now = new Date();

        // Get tickets waiting for first response
        const tickets = await this.ticketRepo.find({
            where: {
                firstResponseAt: IsNull(),
                firstResponseTarget: Not(IsNull()),
                isFirstResponseBreached: false,
                status: Not(In([TicketStatus.RESOLVED, TicketStatus.CANCELLED])),
            },
            relations: ['user', 'assignedTo'],
        });

        for (const ticket of tickets) {
            // Skip if waiting vendor (SLA paused)
            if (ticket.status === TicketStatus.WAITING_VENDOR) continue;
            
            const targetTime = new Date(ticket.firstResponseTarget);

            if (now > targetTime) {
                this.logger.warn(`First Response SLA Breached for ticket #${ticket.ticketNumber}`);

                ticket.isFirstResponseBreached = true;
                await this.ticketRepo.save(ticket);

                await this.sendOverdueNotifications(ticket, 'first_response');
            }
        }
    }

    private async sendOverdueNotifications(ticket: Ticket, type: 'resolution' | 'first_response'): Promise<void> {
        const ticketNumber = ticket.ticketNumber || ticket.id.split('-')[0];
        const subject = type === 'resolution' 
            ? `⚠️ SLA BREACH: Ticket #${ticketNumber} Overdue!`
            : `⚠️ FIRST RESPONSE SLA BREACH: Ticket #${ticketNumber}`;
        
        const message = type === 'resolution'
            ? `Ticket #${ticketNumber} has exceeded its resolution time SLA.`
            : `Ticket #${ticketNumber} has not received first response within SLA.`;

        // Email to Admin
        const adminEmail = 'admin@antigravity.com';
        try {
            await this.mailerService.sendMail({
                to: adminEmail,
                subject,
                html: `
                    <h1>${type === 'resolution' ? 'SLA Breach Alert' : 'First Response SLA Alert'}</h1>
                    <p>${message}</p>
                    <ul>
                        <li><strong>Ticket:</strong> #${ticketNumber}</li>
                        <li><strong>Title:</strong> ${ticket.title}</li>
                        <li><strong>Priority:</strong> ${ticket.priority}</li>
                        <li><strong>Status:</strong> ${ticket.status}</li>
                        <li><strong>Assigned To:</strong> ${ticket.assignedTo?.fullName || 'Unassigned'}</li>
                        <li><strong>Created:</strong> ${ticket.createdAt}</li>
                        ${ticket.slaStartedAt ? `<li><strong>SLA Started:</strong> ${ticket.slaStartedAt}</li>` : ''}
                    </ul>
                    <p style="color: red; font-weight: bold;">Please take immediate action.</p>
                `,
            });
        } catch (e) {
            this.logger.error(`Failed to send SLA email: ${e.message}`);
        }

        // Telegram notification to assigned agent
        if (ticket.assignedTo?.telegramChatId && this.telegramService) {
            const emoji = type === 'resolution' ? '🚨' : '⚠️';
            const telegramMsg = `${emoji} <b>${type === 'resolution' ? 'SLA OVERDUE' : 'First Response SLA Breach'}</b>\n\n` +
                `Tiket #${ticketNumber}\n` +
                `📌 ${ticket.title}\n` +
                `Priority: ${ticket.priority}\n\n` +
                `<b>Segera tindak lanjuti tiket ini!</b>`;
            
            await this.telegramService.sendNotification(ticket.assignedTo.telegramChatId, telegramMsg);
        }
    }
}
```

---

### 18.6 Ticket Create Service Update

**File:** `apps/backend/src/modules/ticketing/services/ticket-create.service.ts`

```typescript
async createTicket(userId: string, createTicketDto: any, files: string[] = []): Promise<Ticket> {
    // ... existing user lookup and ticket creation ...

    const ticket = this.ticketRepo.create({
        ...createTicketDto,
        user,
        status: TicketStatus.TODO,
        source: createTicketDto.source || TicketSource.WEB,
        category: createTicketDto.category || 'GENERAL',
        device: createTicketDto.device,
        software: createTicketDto.software,
    } as DeepPartial<Ticket>);

    // Generate ticket number (existing logic)
    // ...

    // === NEW: Do NOT set slaTarget on creation ===
    // SLA will only start when status changes to IN_PROGRESS
    // Remove the old slaTarget calculation here
    
    // === Set First Response Target from creation ===
    // First response starts counting from ticket creation
    const priority = createTicketDto.priority || 'MEDIUM';
    const slaConfig = await this.slaConfigRepo.findOne({ where: { priority } });
    if (slaConfig) {
        const now = new Date();
        ticket.firstResponseTarget = new Date(now.getTime() + slaConfig.responseTimeMinutes * 60000);
    }

    // slaStartedAt and slaTarget will be NULL until status -> IN_PROGRESS
    ticket.slaStartedAt = null;
    ticket.slaTarget = null;

    await this.ticketRepo.save(ticket);
    
    // ... rest of existing code ...
}
```

---

### 18.7 Frontend SLA Display Updates

**File:** `apps/frontend/src/features/ticket-board/components/ticket-detail/SlaStatusCard.tsx`

```tsx
interface SlaStatusCardProps {
    ticket: {
        slaTarget?: string;
        slaStartedAt?: string;
        firstResponseTarget?: string;
        firstResponseAt?: string;
        isFirstResponseBreached?: boolean;
        isOverdue?: boolean;
        status: string;
        createdAt: string;
        totalPausedMinutes?: number;
    };
}

const SlaStatusCard: React.FC<SlaStatusCardProps> = ({ ticket }) => {
    const isPaused = ticket.status === 'WAITING_VENDOR';
    const isResolved = ticket.status === 'RESOLVED' || ticket.status === 'CANCELLED';
    const slaNotStarted = !ticket.slaStartedAt;
    
    // Calculate resolution time remaining
    const getResolutionStatus = () => {
        if (isResolved) return { status: 'resolved', text: 'Completed', color: 'green' };
        if (isPaused) return { status: 'paused', text: 'Paused (Waiting Vendor)', color: 'orange' };
        if (slaNotStarted) return { status: 'pending', text: 'Not Started (Waiting for Agent)', color: 'gray' };
        if (!ticket.slaTarget) return { status: 'none', text: 'No SLA Set', color: 'gray' };
        
        const now = new Date();
        const target = new Date(ticket.slaTarget);
        const diff = target.getTime() - now.getTime();
        
        if (diff <= 0) return { status: 'overdue', text: 'OVERDUE', color: 'red' };
        if (diff < 4 * 60 * 60 * 1000) return { status: 'warning', text: formatTimeRemaining(diff), color: 'orange' };
        return { status: 'ok', text: formatTimeRemaining(diff), color: 'green' };
    };
    
    // Calculate first response status
    const getFirstResponseStatus = () => {
        if (ticket.firstResponseAt) {
            const responseTime = new Date(ticket.firstResponseAt).getTime() - new Date(ticket.createdAt).getTime();
            const withinSla = !ticket.isFirstResponseBreached;
            return {
                status: withinSla ? 'met' : 'breached',
                text: withinSla ? `Responded in ${formatDuration(responseTime)}` : 'SLA Breached',
                color: withinSla ? 'green' : 'red',
            };
        }
        
        if (!ticket.firstResponseTarget) return null;
        
        const now = new Date();
        const target = new Date(ticket.firstResponseTarget);
        const diff = target.getTime() - now.getTime();
        
        if (isPaused) return { status: 'paused', text: 'Paused', color: 'orange' };
        if (diff <= 0) return { status: 'breached', text: 'BREACHED - No Response', color: 'red' };
        if (diff < 1 * 60 * 60 * 1000) return { status: 'warning', text: formatTimeRemaining(diff), color: 'orange' };
        return { status: 'pending', text: formatTimeRemaining(diff), color: 'blue' };
    };

    const resolution = getResolutionStatus();
    const firstResponse = getFirstResponseStatus();

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                SLA Status
            </h3>
            
            {/* Resolution Time SLA */}
            <div className="space-y-4">
                <div className={cn(
                    "p-4 rounded-xl",
                    resolution.color === 'red' && "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800",
                    resolution.color === 'orange' && "bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800",
                    resolution.color === 'green' && "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800",
                    resolution.color === 'gray' && "bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700",
                )}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                            Resolution Time
                        </span>
                        {resolution.status === 'overdue' && (
                            <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />
                        )}
                        {resolution.status === 'paused' && (
                            <Pause className="w-5 h-5 text-orange-500" />
                        )}
                    </div>
                    <p className={cn(
                        "text-xl font-bold",
                        resolution.color === 'red' && "text-red-600",
                        resolution.color === 'orange' && "text-orange-600",
                        resolution.color === 'green' && "text-green-600",
                        resolution.color === 'gray' && "text-slate-500",
                    )}>
                        {resolution.text}
                    </p>
                    
                    {/* Show SLA started time */}
                    {ticket.slaStartedAt && !isResolved && (
                        <p className="text-xs text-slate-500 mt-2">
                            Started: {format(new Date(ticket.slaStartedAt), 'dd MMM yyyy HH:mm')}
                        </p>
                    )}
                    
                    {/* Show target time */}
                    {ticket.slaTarget && !isResolved && (
                        <p className="text-xs text-slate-500">
                            Target: {format(new Date(ticket.slaTarget), 'dd MMM yyyy HH:mm')}
                        </p>
                    )}
                    
                    {/* Show paused info */}
                    {isPaused && (
                        <p className="text-xs text-orange-600 mt-2 flex items-center gap-1">
                            <Pause className="w-3 h-3" />
                            Timer paused while waiting for vendor
                        </p>
                    )}
                </div>
                
                {/* First Response SLA */}
                {firstResponse && (
                    <div className={cn(
                        "p-4 rounded-xl",
                        firstResponse.color === 'red' && "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800",
                        firstResponse.color === 'orange' && "bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800",
                        firstResponse.color === 'green' && "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800",
                        firstResponse.color === 'blue' && "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800",
                    )}>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                                First Response
                            </span>
                            {firstResponse.status === 'met' && (
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                            )}
                            {firstResponse.status === 'breached' && (
                                <AlertTriangle className="w-5 h-5 text-red-500" />
                            )}
                        </div>
                        <p className={cn(
                            "text-lg font-bold",
                            firstResponse.color === 'red' && "text-red-600",
                            firstResponse.color === 'orange' && "text-orange-600",
                            firstResponse.color === 'green' && "text-green-600",
                            firstResponse.color === 'blue' && "text-blue-600",
                        )}>
                            {firstResponse.text}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
```

---

### 18.8 Implementation Checklist

| No | Task | File | Priority |
|----|------|------|----------|
| 1 | Create migration for new SLA fields | `migrations/` | HIGH |
| 2 | Update Ticket entity with new fields | `ticket.entity.ts` | HIGH |
| 3 | Update ticket-create.service - Remove slaTarget on create | `ticket-create.service.ts` | HIGH |
| 4 | Update ticket-update.service - Start SLA on IN_PROGRESS | `ticket-update.service.ts` | HIGH |
| 5 | Implement handleWaitingVendorStatus method | `ticket-update.service.ts` | HIGH |
| 6 | Update ticket-messaging.service - Track first response | `ticket-messaging.service.ts` | HIGH |
| 7 | Update sla-checker.service - New logic | `sla-checker.service.ts` | HIGH |
| 8 | Update frontend SlaStatusCard component | `SlaStatusCard.tsx` | MEDIUM |
| 9 | Update frontend ticket list to show SLA status correctly | `BentoTicketListPage.tsx` | MEDIUM |
| 10 | Update Kanban cards to show SLA indicator | `BentoTicketKanban.tsx` | MEDIUM |
| 11 | Run migration and test | - | HIGH |

---

### 18.9 Testing Scenarios

1. **Scenario A: New Ticket SLA Flow**
   - Create ticket -> SLA should NOT start yet
   - Agent changes status to IN_PROGRESS -> SLA starts NOW
   - Verify slaTarget = NOW + resolution time

2. **Scenario B: First Response SLA**
   - Create ticket -> First response target should be set
   - Wait until target passes without response -> Should flag as breached
   - Agent responds -> Record firstResponseAt, check if breached

3. **Scenario C: Waiting Vendor**
   - Change status to WAITING_VENDOR
   - Verify Telegram notification sent with Thursday schedule
   - Verify system message added to notes
   - Change status back -> SLA target extended

4. **Scenario D: Overdue Detection**
   - Create ticket, move to IN_PROGRESS
   - Fast-forward time past slaTarget
   - Verify isOverdue = true, notifications sent

---

*Section 18 ditambahkan pada 30 November 2025 - SLA System Overhaul*
