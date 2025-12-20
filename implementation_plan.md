# iDesk Major Upgrade - Implementation Plan

> **Version**: 1.0  
> **Date**: 2025-12-11  
> **Reference**: [design_plan.md](./design_plan.md)  
> **Database**: Fresh install (no migration from existing data)  
> **Phase 0**: ✅ COMPLETED (2025-12-11)  
> **Phase 1**: ✅ COMPLETED (2025-12-11)  
> **Phase 2**: ✅ COMPLETED (2025-12-11)  
> **Phase 3**: ✅ COMPLETED (2025-12-11)  
> **Phase 4**: ✅ COMPLETED (2025-12-11)

---

## 📋 Implementation Overview

| Phase | Name | Priority | Estimated Duration |
|-------|------|----------|-------------------|
| 0 | Database & Foundation | 🔴 Critical | 2-3 hours |
| 1 | Multi-Site System | 🔴 Critical | 4-6 hours |
| 2 | Ticket System Changes | 🟡 High | 6-8 hours |
| 3 | Auto-Assignment System | 🟡 High | 3-4 hours |
| 4 | Sound Notifications | 🟢 Medium | 2-3 hours |
| 5 | Synology Backup Integration | 🟢 Medium | 4-5 hours |
| 6 | Manager Dashboard & Reports | 🟡 High | 5-7 hours |
| 7 | Telegram Integration Updates | 🟢 Medium | 3-4 hours |
| 8 | Testing & Verification | 🔴 Critical | 3-4 hours |

---

# 🔴 Phase 0: Database & Foundation

## 0.1 Clean Database Setup

### Tasks
```
[ ] 0.1.1 Stop all running services (backend, frontend)
[ ] 0.1.2 Drop existing database (if any)
[ ] 0.1.3 Create fresh database
[ ] 0.1.4 Update TypeORM entities with new fields
[ ] 0.1.5 Run synchronize or migrations
[ ] 0.1.6 Seed initial data
```

### 0.1.1 Database Commands
```bash
# Stop services
cd c:\iDesk
# Ctrl+C on running terminals

# Drop and recreate database
docker exec -it idesk-postgres psql -U postgres -c "DROP DATABASE IF EXISTS idesk_db;"
docker exec -it idesk-postgres psql -U postgres -c "CREATE DATABASE idesk_db;"
```

### 0.1.2 New Entity Files to Create

| File | Location |
|------|----------|
| `site.entity.ts` | `src/modules/sites/entities/` |
| `ict-budget-request.entity.ts` | `src/modules/ict-budget/entities/` |
| `lost-item-report.entity.ts` | `src/modules/lost-item/entities/` |
| `access-type.entity.ts` | `src/modules/access-request/entities/` |
| `access-request.entity.ts` | `src/modules/access-request/entities/` |
| `priority-weight.entity.ts` | `src/modules/workload/entities/` |
| `agent-daily-workload.entity.ts` | `src/modules/workload/entities/` |
| `notification-sound.entity.ts` | `src/modules/sound/entities/` |
| `backup-configuration.entity.ts` | `src/modules/synology/entities/` |
| `backup-history.entity.ts` | `src/modules/synology/entities/` |

---

## 0.2 Update Existing Entities

### 0.2.1 User Entity Changes
**File**: `apps/backend/src/modules/users/entities/user.entity.ts`

```typescript
// ADD these fields:
@Column({ nullable: true })
siteId: string;

@ManyToOne(() => Site)
@JoinColumn({ name: 'siteId' })
site: Site;

// UPDATE role enum:
@Column({
    type: 'enum',
    enum: UserRole,  // Add MANAGER to enum
    default: UserRole.USER,
})
role: UserRole;
```

### 0.2.2 User Role Enum Update
**File**: `apps/backend/src/modules/users/enums/user-role.enum.ts`

```typescript
export enum UserRole {
    USER = 'USER',
    AGENT = 'AGENT',
    ADMIN = 'ADMIN',
    MANAGER = 'MANAGER',  // NEW
}
```

### 0.2.3 Ticket Entity Changes
**File**: `apps/backend/src/modules/ticketing/entities/ticket.entity.ts`

```typescript
// ADD these fields:
@Column({ default: 'SERVICE' })
ticketType: string;  // SERVICE, ICT_BUDGET, LOST_ITEM, ACCESS_REQUEST, HARDWARE_INSTALLATION

@Column({ nullable: true })
siteId: string;

@ManyToOne(() => Site)
@JoinColumn({ name: 'siteId' })
site: Site;

@Column({ nullable: true })
criticalReason: string;  // Required when priority = CRITICAL
```

### 0.2.4 Department Entity Changes
**File**: `apps/backend/src/modules/users/entities/department.entity.ts`

```typescript
// ADD:
@Column({ nullable: true })
siteId: string;

@ManyToOne(() => Site)
@JoinColumn({ name: 'siteId' })
site: Site;
```

---

## 0.3 Seed Data

### 0.3.1 Create Seed File
**File**: `apps/backend/src/seeds/initial-seed.ts`

```typescript
// Seed order:
// 1. Sites (SPJ, SMG, KRW, JTB)
// 2. Priority Weights
// 3. Default Notification Sounds
// 4. Access Types (WiFi, VPN, Website)
// 5. Admin user (site: SPJ)
// 6. Sample departments per site
```

---

# 🔴 Phase 1: Multi-Site System

## 1.1 Sites Module (Backend)

### Tasks
```
[ ] 1.1.1 Create sites module structure
[ ] 1.1.2 Create Site entity
[ ] 1.1.3 Create SitesService
[ ] 1.1.4 Create SitesController
[ ] 1.1.5 Create SiteGuard for access control
[ ] 1.1.6 Register module in app.module.ts
```

### 1.1.1 Module Structure
```
src/modules/sites/
├── sites.module.ts
├── sites.controller.ts
├── sites.service.ts
├── entities/
│   └── site.entity.ts
├── dto/
│   ├── create-site.dto.ts
│   └── update-site.dto.ts
└── guards/
    └── site.guard.ts
```

### 1.1.2 Site Entity
**File**: `src/modules/sites/entities/site.entity.ts`

```typescript
@Entity('sites')
export class Site {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true, length: 10 })
    code: string;  // SPJ, SMG, KRW, JTB

    @Column({ length: 100 })
    name: string;

    @Column({ nullable: true })
    description: string;

    @Column({ nullable: true })
    vpnIpRange: string;

    @Column({ nullable: true })
    localGateway: string;

    @Column({ default: 'Asia/Jakarta' })
    timezone: string;

    @Column({ default: true })
    isActive: boolean;

    @Column({ default: false })
    isServerHost: boolean;

    @CreateDateColumn()
    createdAt: Date;
}
```

### 1.1.3 Site Guard Implementation
**File**: `src/modules/sites/guards/site.guard.ts`

```typescript
@Injectable()
export class SiteGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        
        // ADMIN & MANAGER bypass site isolation
        if (['ADMIN', 'MANAGER'].includes(user.role)) {
            return true;
        }
        
        // Extract requested site from params/query/body
        const requestedSiteId = 
            request.params?.siteId || 
            request.query?.siteId || 
            request.body?.siteId;
        
        // If site specified and doesn't match user's site, deny
        if (requestedSiteId && requestedSiteId !== user.siteId) {
            throw new ForbiddenException('Cannot access other site data');
        }
        
        // Auto-inject user's site into query if not ADMIN/MANAGER
        request.query.siteId = user.siteId;
        
        return true;
    }
}
```

---

## 1.2 Update Existing Services for Site Isolation

### Tasks
```
[ ] 1.2.1 Update TicketQueryService - add site filtering
[ ] 1.2.2 Update TicketCreateService - auto-assign siteId
[ ] 1.2.3 Update UsersService - add site filtering
[ ] 1.2.4 Update all controllers with @UseGuards(SiteGuard)
```

### 1.2.1 TicketQueryService Update
**File**: `src/modules/ticketing/services/ticket-query.service.ts`

```typescript
// MODIFY findAllPaginated method:
async findAllPaginated(userId: string, role: UserRole, userSiteId: string, options) {
    const qb = this.ticketRepo.createQueryBuilder('ticket');
    
    // Site isolation
    if (!['ADMIN', 'MANAGER'].includes(role)) {
        qb.andWhere('ticket.siteId = :siteId', { siteId: userSiteId });
    } else if (options.siteIds?.length) {
        qb.andWhere('ticket.siteId IN (:...siteIds)', { siteIds: options.siteIds });
    }
    
    // ... rest of query
}
```

---

## 1.3 Frontend Site Components

### Tasks
```
[ ] 1.3.1 Create SiteSelector component
[ ] 1.3.2 Create SiteBadge component
[ ] 1.3.3 Update useAuth store with siteId
[ ] 1.3.4 Update API calls to include site filtering
[ ] 1.3.5 Conditionally show/hide site column in tables
```

### 1.3.1 SiteSelector Component
**File**: `src/features/manager/components/SiteSelector.tsx`

```tsx
// Multi-select dropdown for ADMIN/MANAGER
// Shows checkboxes for SPJ, SMG, KRW, JTB
// Emits onChange with selected site IDs
```

---

# 🟡 Phase 2: Ticket System Changes

## 2.1 ICT Budget Module

### Tasks
```
[ ] 2.1.1 Create ict-budget module structure
[ ] 2.1.2 Create IctBudgetRequest entity
[ ] 2.1.3 Create DTOs (create, update, approve)
[ ] 2.1.4 Create IctBudgetService with workflow logic
[ ] 2.1.5 Create IctBudgetController
[ ] 2.1.6 Create Frontend IctBudgetForm component
[ ] 2.1.7 Integrate with notification system
[ ] 2.1.8 Add auto-create Hardware Installation ticket
```

### 2.1.1 Module Structure
```
src/modules/ict-budget/
├── ict-budget.module.ts
├── ict-budget.controller.ts
├── ict-budget.service.ts
├── entities/
│   └── ict-budget-request.entity.ts
└── dto/
    ├── create-ict-budget.dto.ts
    ├── approve-ict-budget.dto.ts
    └── realize-ict-budget.dto.ts
```

### 2.1.2 IctBudgetRequest Entity
```typescript
@Entity('ict_budget_requests')
export class IctBudgetRequest {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    ticketId: string;

    @ManyToOne(() => Ticket)
    @JoinColumn({ name: 'ticketId' })
    ticket: Ticket;

    @Column()
    requestType: string;  // PURCHASE, RENEWAL, LICENSE

    @Column()
    budgetCategory: string;

    @Column()
    itemName: string;

    @Column({ nullable: true })
    vendor: string;

    @Column('decimal', { precision: 15, scale: 2 })
    estimatedAmount: number;

    @Column({ default: 1 })
    quantity: number;

    @Column({ nullable: true })
    renewalPeriodMonths: number;

    @Column({ nullable: true })
    currentExpiryDate: Date;

    @Column('text')
    justification: string;

    @Column({ default: 'NORMAL' })
    urgencyLevel: string;

    // Approval
    @Column({ nullable: true })
    superiorId: string;

    @Column({ nullable: true })
    superiorApprovedAt: Date;

    @Column({ nullable: true })
    superiorNotes: string;

    // Realization
    @Column({ default: 'PENDING' })
    realizationStatus: string;

    @Column({ nullable: true })
    realizedById: string;

    @Column({ nullable: true })
    realizedAt: Date;

    @Column({ nullable: true })
    realizationNotes: string;

    @Column({ nullable: true })
    purchaseOrderNumber: string;

    @Column({ nullable: true })
    invoiceNumber: string;

    // Hardware installation link
    @Column({ default: false })
    requiresInstallation: boolean;

    @Column({ nullable: true })
    linkedHwTicketId: string;

    @CreateDateColumn()
    createdAt: Date;
}
```

### 2.1.3 Frontend Form
**File**: `src/features/ticket-board/components/IctBudgetForm.tsx`

```tsx
// Form sections:
// 1. Request Type selector (Purchase/Renewal/License)
// 2. Category dropdown (dynamic based on type)
// 3. Item details (name, quantity, vendor)
// 4. For Renewal: current expiry date, renewal period
// 5. Financial: estimated amount
// 6. Justification textarea
// 7. Urgency level
// 8. Checkbox: Requires Installation?
```

---

## 2.2 Lost Item Report Module

### Tasks
```
[ ] 2.2.1 Create lost-item module structure
[ ] 2.2.2 Create LostItemReport entity
[ ] 2.2.3 Create DTOs
[ ] 2.2.4 Create LostItemService
[ ] 2.2.5 Create LostItemController
[ ] 2.2.6 Create Frontend LostItemForm component
```

### 2.2.1 Module Structure
```
src/modules/lost-item/
├── lost-item.module.ts
├── lost-item.controller.ts
├── lost-item.service.ts
├── entities/
│   └── lost-item-report.entity.ts
└── dto/
    ├── create-lost-item.dto.ts
    └── update-lost-item.dto.ts
```

---

## 2.3 Access Request Module

### Tasks
```
[ ] 2.3.1 Create access-request module structure
[ ] 2.3.2 Create AccessType entity
[ ] 2.3.3 Create AccessRequest entity
[ ] 2.3.4 Create DTOs
[ ] 2.3.5 Create AccessRequestService with workflow
[ ] 2.3.6 Create AccessRequestController
[ ] 2.3.7 Create Frontend AccessRequestForm component
[ ] 2.3.8 Implement form download/upload functionality
```

### 2.3.1 Module Structure
```
src/modules/access-request/
├── access-request.module.ts
├── access-request.controller.ts
├── access-request.service.ts
├── access-type.controller.ts
├── entities/
│   ├── access-type.entity.ts
│   └── access-request.entity.ts
└── dto/
    ├── create-access-request.dto.ts
    └── verify-access-request.dto.ts
```

---

## 2.4 Priority & Critical Reason Updates

### Tasks
```
[ ] 2.4.1 Update CreateTicketDto - add criticalReason
[ ] 2.4.2 Update ticket validation - require criticalReason when CRITICAL
[ ] 2.4.3 Update Frontend CreateTicketDialog - hide SLA, add critical reason field
[ ] 2.4.4 Update BentoCreateTicketPage - same changes
```

### 2.4.1 DTO Update
**File**: `src/modules/ticketing/dto/create-ticket.dto.ts`

```typescript
// ADD:
@IsOptional()
@IsString()
@ValidateIf(o => o.priority === 'CRITICAL')
@IsNotEmpty({ message: 'Critical reason is required for CRITICAL priority' })
criticalReason?: string;
```

### 2.4.2 Frontend Changes
**Files to modify**:
- `src/features/ticket-board/components/CreateTicketDialog.tsx`
- `src/features/client/pages/BentoCreateTicketPage.tsx`

```tsx
// REMOVE: SLA hours display next to priority options
// ADD: Conditional field for critical reason
{priority === 'CRITICAL' && (
    <div className="space-y-2">
        <Label>Alasan Kritikalitas *</Label>
        <Textarea
            placeholder="Jelaskan mengapa kendala ini harus segera ditangani..."
            {...register('criticalReason', { required: true })}
        />
    </div>
)}
```

---

# 🟡 Phase 3: Auto-Assignment System

## 3.1 Workload Module

### Tasks
```
[ ] 3.1.1 Create workload module structure
[ ] 3.1.2 Create PriorityWeight entity
[ ] 3.1.3 Create AgentDailyWorkload entity
[ ] 3.1.4 Create WorkloadService
[ ] 3.1.5 Create AutoAssignmentService
[ ] 3.1.6 Integrate with TicketCreateService
[ ] 3.1.7 Create scheduled job to reset daily workload
```

### 3.1.1 Module Structure
```
src/modules/workload/
├── workload.module.ts
├── workload.service.ts
├── auto-assignment.service.ts
├── workload.controller.ts (for admin to view/configure)
├── entities/
│   ├── priority-weight.entity.ts
│   └── agent-daily-workload.entity.ts
└── dto/
    └── update-priority-weight.dto.ts
```

### 3.1.2 AutoAssignmentService
```typescript
@Injectable()
export class AutoAssignmentService {
    async autoAssignTicket(ticket: Ticket): Promise<User | null> {
        const siteId = ticket.siteId;
        const today = new Date().toISOString().split('T')[0];
        
        // Get priority weight
        const priorityWeight = await this.getWeight(ticket.priority);
        
        // Get all active agents for this site
        const agents = await this.usersService.findAgentsBySite(siteId);
        
        if (agents.length === 0) return null;
        
        // Get current workloads
        const workloads = await this.workloadRepo.find({
            where: { 
                agentId: In(agents.map(a => a.id)),
                siteId,
                workDate: today 
            }
        });
        
        // Calculate and sort by total points (ascending)
        const agentPoints = agents.map(agent => {
            const workload = workloads.find(w => w.agentId === agent.id);
            return {
                agent,
                points: workload?.totalPoints || 0
            };
        }).sort((a, b) => a.points - b.points);
        
        const assignedAgent = agentPoints[0].agent;
        
        // Update workload
        await this.updateWorkload(assignedAgent.id, siteId, priorityWeight);
        
        return assignedAgent;
    }
    
    private async updateWorkload(agentId: string, siteId: string, points: number) {
        const today = new Date().toISOString().split('T')[0];
        
        let workload = await this.workloadRepo.findOne({
            where: { agentId, siteId, workDate: today }
        });
        
        if (!workload) {
            workload = this.workloadRepo.create({
                agentId,
                siteId,
                workDate: today,
                totalPoints: 0,
                activeTickets: 0
            });
        }
        
        workload.totalPoints += points;
        workload.activeTickets += 1;
        workload.lastAssignedAt = new Date();
        
        await this.workloadRepo.save(workload);
    }
}
```

### 3.1.3 Priority Weights Seed
```typescript
const priorityWeights = [
    { priority: 'LOW', points: 1 },
    { priority: 'MEDIUM', points: 2 },
    { priority: 'HIGH', points: 4 },
    { priority: 'CRITICAL', points: 8 },
    { priority: 'HARDWARE_INSTALLATION', points: 3 },
];
```

---

# 🟢 Phase 4: Sound Notifications

## 4.1 Sound Module (Backend)

### Tasks
```
[ ] 4.1.1 Create sound module structure
[ ] 4.1.2 Create NotificationSound entity
[ ] 4.1.3 Create SoundService
[ ] 4.1.4 Create SoundController (upload, list, set active)
[ ] 4.1.5 Add sound file upload endpoint
[ ] 4.1.6 Seed default sounds
```

### 4.1.1 Module Structure
```
src/modules/sound/
├── sound.module.ts
├── sound.controller.ts
├── sound.service.ts
├── entities/
│   └── notification-sound.entity.ts
└── dto/
    └── upload-sound.dto.ts
```

---

## 4.2 Sound Frontend

### Tasks
```
[ ] 4.2.1 Create useSoundNotification hook
[ ] 4.2.2 Create SoundSettingsPage for admin
[ ] 4.2.3 Integrate sounds with socket events
[ ] 4.2.4 Add user preference for enable/disable
[ ] 4.2.5 Add default sound files to public folder
```

### 4.2.1 useSoundNotification Hook
**File**: `src/hooks/useSoundNotification.ts`

```typescript
export const useSoundNotification = () => {
    const [enabled, setEnabled] = useState(true);
    const [volume, setVolume] = useState(0.5);
    
    const playSound = useCallback(async (eventType: string) => {
        if (!enabled) return;
        
        // Get sound URL from API or cache
        const soundUrl = await getSoundUrl(eventType);
        
        const audio = new Audio(soundUrl);
        audio.volume = volume;
        
        try {
            await audio.play();
        } catch (error) {
            console.warn('Sound playback failed:', error);
        }
    }, [enabled, volume]);
    
    return { playSound, enabled, setEnabled, volume, setVolume };
};
```

### 4.2.2 Default Sound Files
```
public/sounds/default/
├── new-ticket.mp3
├── assigned.mp3
├── resolved.mp3
├── critical-alert.mp3
└── message.mp3
```

---

# 🟢 Phase 5: Synology Backup Integration

## 5.1 Synology Module (Backend)

### Tasks
```
[ ] 5.1.1 Create synology module structure
[ ] 5.1.2 Create BackupConfiguration entity
[ ] 5.1.3 Create BackupHistory entity
[ ] 5.1.4 Create SynologyApiService (DSM 7.x)
[ ] 5.1.5 Create BackupService
[ ] 5.1.6 Create BackupController
[ ] 5.1.7 Create scheduled backup job
[ ] 5.1.8 Implement pg_dump for database backup
```

### 5.1.1 Module Structure
```
src/modules/synology/
├── synology.module.ts
├── synology-api.service.ts
├── backup.service.ts
├── backup.controller.ts
├── entities/
│   ├── backup-configuration.entity.ts
│   └── backup-history.entity.ts
├── dto/
│   ├── create-backup-config.dto.ts
│   └── test-connection.dto.ts
└── jobs/
    └── backup.job.ts
```

### 5.1.2 SynologyApiService (RS1221 / DSM 7.x)
```typescript
@Injectable()
export class SynologyApiService {
    private sid: string;  // Session ID
    
    async login(config: SynologyConfig): Promise<string> {
        const url = `${config.protocol}://${config.host}:${config.port}/webapi/auth.cgi`;
        const response = await axios.get(url, {
            params: {
                api: 'SYNO.API.Auth',
                version: 3,
                method: 'login',
                account: config.username,
                passwd: config.password,
                session: 'iDesk',
                format: 'sid'
            }
        });
        
        if (response.data.success) {
            this.sid = response.data.data.sid;
            return this.sid;
        }
        throw new Error('Synology login failed');
    }
    
    async listSharedFolders(): Promise<SharedFolder[]> {
        const response = await this.call('SYNO.FileStation.List', 'list_share', {});
        return response.data.shares;
    }
    
    async uploadFile(localPath: string, destFolder: string): Promise<void> {
        const formData = new FormData();
        formData.append('api', 'SYNO.FileStation.Upload');
        formData.append('version', '2');
        formData.append('method', 'upload');
        formData.append('path', destFolder);
        formData.append('create_parents', 'true');
        formData.append('overwrite', 'true');
        formData.append('file', fs.createReadStream(localPath));
        
        await axios.post(this.getUrl('entry.cgi'), formData, {
            params: { _sid: this.sid }
        });
    }
    
    async getStorageInfo(): Promise<VolumeInfo[]> {
        const response = await this.call('SYNO.Storage.CGI.Storage', 'load_info', {});
        return response.data.volumes;
    }
}
```

### 5.1.3 Backup Job
```typescript
@Injectable()
export class BackupJob {
    @Cron(CronExpression.EVERY_DAY_AT_2AM)
    async runScheduledBackups() {
        const configs = await this.backupService.getActiveConfigs();
        
        for (const config of configs) {
            await this.executeBackup(config);
        }
    }
    
    async executeBackup(config: BackupConfiguration) {
        const history = await this.createHistoryEntry(config);
        
        try {
            // Generate backup file
            let localFile: string;
            
            if (config.backupType === 'DATABASE') {
                localFile = await this.dumpDatabase();
            } else if (config.backupType === 'FILES') {
                localFile = await this.archiveUploads();
            } else {
                localFile = await this.fullBackup();
            }
            
            // Upload to Synology
            const api = new SynologyApiService();
            await api.login(config);
            await api.uploadFile(localFile, config.destinationFolder);
            
            // Update history
            history.status = 'SUCCESS';
            history.completedAt = new Date();
            history.fileSizeBytes = fs.statSync(localFile).size;
            
            // Cleanup old backups
            await this.cleanupOldBackups(config);
            
        } catch (error) {
            history.status = 'FAILED';
            history.errorMessage = error.message;
        }
        
        await this.backupHistoryRepo.save(history);
    }
}
```

---

## 5.2 Storage Settings Frontend

### Tasks
```
[ ] 5.2.1 Create/Update StorageSettingsPage
[ ] 5.2.2 Add Synology connection form
[ ] 5.2.3 Add folder browser component
[ ] 5.2.4 Add schedule configuration UI
[ ] 5.2.5 Add backup history view
[ ] 5.2.6 Add manual backup trigger button
```

**File**: `src/features/settings/pages/StorageSettingsPage.tsx`

```tsx
// Sections:
// 1. Connection - Host, Port, Username, Password, Test Connection
// 2. Destination - Volume selector, Folder browser, Create folder
// 3. Schedule - Backup type, Frequency, Time, Retention
// 4. History - List of past backups with status
// 5. Actions - Manual backup, Restore options
```

---

# 🟡 Phase 6: Manager Dashboard & Reports

## 6.1 Manager Module (Backend)

### Tasks
```
[ ] 6.1.1 Create manager module structure
[ ] 6.1.2 Create ManagerDashboardService
[ ] 6.1.3 Create ManagerReportsService
[ ] 6.1.4 Create ManagerController
[ ] 6.1.5 Add multi-site statistics aggregation
[ ] 6.1.6 Add site comparison endpoints
```

### 6.1.1 Module Structure
```
src/modules/manager/
├── manager.module.ts
├── manager-dashboard.service.ts
├── manager-reports.service.ts
├── manager.controller.ts
└── dto/
    ├── dashboard-query.dto.ts
    └── report-query.dto.ts
```

### 6.1.2 Dashboard Statistics
```typescript
interface ManagerDashboardStats {
    totalTickets: number;
    ticketsToday: number;
    openTickets: {
        total: number;
        bySite: { [siteCode: string]: number };
    };
    criticalTickets: number;
    slaBreach: number;
    ticketDistribution: { site: string; count: number }[];
    topAgents: { agent: string; site: string; count: number }[];
    topUsers: { department: string; site: string; count: number }[];
    trend: { date: string; site: string; count: number }[];
    recentCritical: Ticket[];
}
```

---

## 6.2 Manager Frontend

### Tasks
```
[ ] 6.2.1 Create ManagerDashboard page
[ ] 6.2.2 Create SiteStatsCard component
[ ] 6.2.3 Create MultiSiteChart component
[ ] 6.2.4 Create TopAgentsCard component
[ ] 6.2.5 Create CriticalTicketsTable component
[ ] 6.2.6 Create ManagerReportsPage
[ ] 6.2.7 Add site filter to existing ticket list
[ ] 6.2.8 Add routing for manager pages
```

### 6.2.1 Manager Dashboard
**File**: `src/features/manager/pages/ManagerDashboard.tsx`

```tsx
// Layout from design_plan.md section 3.4
// Components:
// - SiteSelector (top right)
// - 4 stat cards (Total, Open per site, Critical, SLA Breach)
// - Ticket Distribution chart (bar)
// - Top Agents list
// - Top Users list
// - Trend chart (line per site)
// - Recent Critical Tickets table
```

### 6.2.2 Manager Reports
**File**: `src/features/manager/pages/ManagerReportsPage.tsx`

```tsx
// Report options:
// - Type: Consolidated / Per Site / Custom / Comparison
// - Sites: Multi-select checkboxes
// - Period: Monthly/Weekly/Custom date range
// - Include sections: Ticket Stats, Agent Performance, SLA, User Stats, Trends
// - Format: PDF / Excel / Both
// - Generate button
```

---

# 🟢 Phase 7: Telegram Integration Updates

## 7.1 Manager Telegram Menu

### Tasks
```
[ ] 7.1.1 Add MANAGER role detection in TelegramUpdate
[ ] 7.1.2 Create showManagerMenu function
[ ] 7.1.3 Add /dashboard command for managers
[ ] 7.1.4 Add /site [code] command
[ ] 7.1.5 Add site-specific critical alerts
[ ] 7.1.6 Update notification preferences for managers
```

### 7.1.1 Manager Menu
**File**: `src/modules/telegram/telegram.update.ts`

```typescript
// ADD new handler:
@Action('manager_menu')
async onManagerMenu(@Ctx() ctx: Context) {
    await ctx.editMessageText(
        '🏢 *MANAGER MENU*\n\n' +
        'Pilih menu:\n\n' +
        '📊 Dashboard Overview\n' +
        '📋 Quick Site View\n' +
        '🔔 Alert Settings\n' +
        '📈 Quick Reports',
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📊 Dashboard', callback_data: 'manager_dashboard' }],
                    [
                        { text: '🏭 SPJ', callback_data: 'site_view_SPJ' },
                        { text: '🏭 SMG', callback_data: 'site_view_SMG' },
                    ],
                    [
                        { text: '🏭 KRW', callback_data: 'site_view_KRW' },
                        { text: '🏭 JTB', callback_data: 'site_view_JTB' },
                    ],
                    [{ text: '📈 Daily Report', callback_data: 'manager_daily_report' }],
                    [{ text: '🔙 Main Menu', callback_data: 'main_menu' }],
                ]
            }
        }
    );
}
```

---

# 🔴 Phase 8: Testing & Verification

## 8.1 Unit Tests

### Tasks
```
[ ] 8.1.1 Test SiteGuard isolation logic
[ ] 8.1.2 Test AutoAssignmentService
[ ] 8.1.3 Test IctBudgetService workflow
[ ] 8.1.4 Test SynologyApiService
[ ] 8.1.5 Test BackupService
```

### Test Commands
```bash
cd apps/backend
npm run test -- --grep "SiteGuard"
npm run test -- --grep "AutoAssignment"
npm run test -- --grep "IctBudget"
```

---

## 8.2 Integration Tests

### Tasks
```
[ ] 8.2.1 Test site isolation end-to-end
[ ] 8.2.2 Test ticket creation with auto-assignment
[ ] 8.2.3 Test ICT Budget approval workflow
[ ] 8.2.4 Test manager cross-site access
```

---

## 8.3 Manual Testing Checklist

### Site Isolation
```
[ ] Login sebagai User SPJ → Verify hanya lihat ticket SPJ
[ ] Login sebagai Agent SMG → Verify hanya lihat ticket SMG
[ ] Login sebagai Admin → Verify bisa lihat semua site
[ ] Login sebagai Manager → Verify bisa lihat semua site + dashboard
[ ] User SPJ coba akses /tickets?siteId=SMG → Verify 403 Forbidden
```

### ICT Budget Flow
```
[ ] Create ICT Budget request (Purchase type)
[ ] Create ICT Budget request (Renewal type)
[ ] Superior approve request → Verify notification ke agent
[ ] Agent realize request → Verify status update
[ ] Check "Requires Installation" → Verify auto-create HW ticket
```

### Lost Item Report
```
[ ] Create Lost Item report dengan semua field
[ ] Upload foto barang
[ ] Update status ke FOUND
[ ] Verify timeline di ticket detail
```

### Access Request Flow
```
[ ] Admin upload form template untuk WiFi
[ ] User request WiFi access
[ ] User download form → Verify file downloads
[ ] User upload signed form → Verify file stored
[ ] Agent verify → Verify status update
[ ] Agent create access → Verify credentials saved
```

### Auto-Assignment
```
[ ] Create ticket priority LOW → Check agent assigned
[ ] Create ticket priority CRITICAL → Check agent with lowest points assigned
[ ] Create multiple tickets → Verify load balancing
[ ] Reset daily workload → Verify counts reset
```

### Sound Notifications
```
[ ] Enable sound notifications
[ ] Create ticket → Verify sound plays
[ ] Assign ticket → Verify sound plays
[ ] Resolve ticket → Verify sound plays
[ ] Upload custom sound → Verify it works
[ ] Disable sounds → Verify no sound plays
```

### Synology Backup
```
[ ] Test connection to RS1221
[ ] Browse shared folders
[ ] Create backup destination folder
[ ] Run manual database backup → Verify file on Synology
[ ] Run manual full backup → Verify file on Synology
[ ] Check backup history shows entry
```

### Manager Dashboard
```
[ ] Login sebagai Manager
[ ] View dashboard → Verify all sites data shown
[ ] Select specific sites → Verify filter works
[ ] View top agents → Verify shows all sites
[ ] View critical tickets → Verify shows all sites
[ ] Generate consolidated report
[ ] Generate per-site report
```

### Telegram
```
[ ] Login as Manager via Telegram
[ ] Verify manager menu appears
[ ] /dashboard → Verify cross-site summary
[ ] /site SPJ → Verify site-specific data
[ ] Receive critical alert from any site
```

---

## 8.4 Run Application

### Start Commands
```bash
# Terminal 1: Database
cd c:\iDesk
docker-compose -f docker-compose.db.yml up -d

# Terminal 2: Backend
cd c:\iDesk\apps\backend
npm run start:dev

# Terminal 3: Frontend
cd c:\iDesk\apps\frontend
npm run dev
```

### Test URLs
- Frontend: http://localhost:4050
- Backend API: http://localhost:5050
- Swagger: http://localhost:5050/api/docs

### Default Test Accounts (after seed)
| Role | Email | Password | Site |
|------|-------|----------|------|
| ADMIN | admin@idesk.com | admin123 | SPJ |
| MANAGER | manager@idesk.com | manager123 | ALL |
| AGENT | agent.spj@idesk.com | agent123 | SPJ |
| AGENT | agent.smg@idesk.com | agent123 | SMG |
| USER | user.spj@idesk.com | user123 | SPJ |
| USER | user.smg@idesk.com | user123 | SMG |

---

## Summary Checklist

```
Phase 0: Database & Foundation
[ ] Clean database setup
[ ] Create new entities
[ ] Update existing entities
[ ] Seed initial data

Phase 1: Multi-Site System
[ ] Sites module backend
[ ] Site isolation guards
[ ] Frontend site components

Phase 2: Ticket System Changes
[ ] ICT Budget module
[ ] Lost Item module
[ ] Access Request module
[ ] Priority/Critical reason updates

Phase 3: Auto-Assignment
[ ] Workload module
[ ] Auto-assignment service
[ ] Integration with ticket creation

Phase 4: Sound Notifications
[ ] Sound module backend
[ ] Frontend sound hook
[ ] Sound settings page

Phase 5: Synology Backup
[ ] Synology API service
[ ] Backup service & job
[ ] Storage settings page

Phase 6: Manager Dashboard
[ ] Manager backend endpoints
[ ] Manager dashboard page
[ ] Manager reports page

Phase 7: Telegram Updates
[ ] Manager menu
[ ] Cross-site commands

Phase 8: Testing
[ ] Unit tests
[ ] Integration tests
[ ] Manual testing
```

