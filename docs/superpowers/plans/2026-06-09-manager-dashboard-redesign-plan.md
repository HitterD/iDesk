# Manager Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Manager Dashboard layout to follow a 60/40 asymmetric Bento UI grid, replacing rigid tables with modern, compact lists.

**Architecture:** We will reorganize `ManagerDashboard.tsx` into two main visual columns: Left (60% width) for overview metrics and trend charts, and Right (40% width) for quick action feeds (critical tickets and top agents). The changes are entirely presentational using Tailwind CSS and existing `lucide-react` / `recharts` components.

**Tech Stack:** React, Tailwind CSS, shadcn/ui, Recharts, Lucide Icons

---

### Task 1: Structural Refactoring & Header

**Files:**
- Modify: `apps/frontend/src/features/manager/pages/ManagerDashboard.tsx`

- [ ] **Step 1: Set up the main Bento Grid structure and unified header**

Replace the main return block to introduce a `grid-cols-1 lg:grid-cols-12` layout and group the header elements.

```tsx
// Inside return statement
return (
    <div className="space-y-6 p-6 animate-fade-in-up">
        {/* Header & Unified Action Bar */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-[hsl(var(--card))] p-5 rounded-xl border border-[hsl(var(--border))] shadow-sm">
            <div>
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Manager Dashboard</h1>
                <p className="text-muted-foreground text-sm mt-1">Overview semua site</p>
            </div>
            <div className="flex items-center gap-3">
                <SiteSelector
                    selectedSiteIds={selectedSites}
                    onSelectionChange={setSelectedSites}
                    mode="multi"
                />
                <Button variant="outline" onClick={fetchDashboard} className="rounded-xl border-[hsl(var(--border))] bg-white dark:bg-slate-800">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                </Button>
            </div>
        </div>

        {/* Main Asymmetric Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column will be added in Task 2 */}
            <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">
                {/* Left content placeholder */}
            </div>

            {/* Right Column will be added in Task 3 */}
            <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6">
                {/* Right content placeholder */}
            </div>
        </div>
    </div>
);
```

- [ ] **Step 2: Run linter/compiler to verify syntax**

Run: `npx tsc --noEmit`
Expected: PASS (No new errors introduced in the file)

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/features/manager/pages/ManagerDashboard.tsx
git commit -m "refactor(manager): set up bento grid and unified header for dashboard"
```

### Task 2: Left Column (Executive Metrics & Trend Chart)

**Files:**
- Modify: `apps/frontend/src/features/manager/pages/ManagerDashboard.tsx`

- [ ] **Step 1: Implement the 2x2 Metrics Grid and Trend Chart**

Replace the left column placeholder with the 4 stat cards and the LineChart.

```tsx
{/* Inside the lg:col-span-7 xl:col-span-8 div */}
{/* 2x2 Metrics Grid */}
<div className="grid grid-cols-2 gap-4">
    <Card className="rounded-xl shadow-sm border-[hsl(var(--border))]">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Tickets</CardTitle>
            <Ticket className="h-4 w-4 text-slate-400" />
        </CardHeader>
        <CardContent>
            <div className="text-3xl font-bold text-slate-800 dark:text-white">{stats?.totalTickets || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">+{stats?.ticketsToday || 0} hari ini</p>
        </CardContent>
    </Card>

    <Card className="rounded-xl shadow-sm border-[hsl(var(--border))]">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Open Tickets</CardTitle>
            <Clock className="h-4 w-4 text-slate-400" />
        </CardHeader>
        <CardContent>
            <div className="text-3xl font-bold text-slate-800 dark:text-white">{stats?.openTickets?.total || 0}</div>
            <div className="flex gap-1.5 mt-2 flex-wrap">
                {stats?.openTickets?.bySite && Object.entries(stats.openTickets.bySite).map(([code, count]) => (
                    <Badge key={code} style={{ backgroundColor: SITE_COLORS[code] }} className="text-[10px] px-1.5 py-0.5">
                        {code}: {count}
                    </Badge>
                ))}
            </div>
        </CardContent>
    </Card>

    <Card className="rounded-xl shadow-sm border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-red-600 dark:text-red-400">Critical</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
            <div className="text-3xl font-bold text-red-600 dark:text-red-400">{stats?.criticalTickets || 0}</div>
            <p className="text-xs text-red-500/80 mt-1">Butuh perhatian segera</p>
        </CardContent>
    </Card>

    <Card className="rounded-xl shadow-sm border-orange-200 dark:border-orange-900/50 bg-orange-50/50 dark:bg-orange-900/10">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-orange-600 dark:text-orange-400">SLA Breach</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
            <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">{stats?.slaBreach || 0}</div>
            <p className="text-xs text-orange-500/80 mt-1">Sudah melewati target SLA</p>
        </CardContent>
    </Card>
</div>

{/* Trend Chart */}
<Card className="rounded-xl shadow-sm border-[hsl(var(--border))]">
    <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5 text-primary" />
            Trend 7 Hari Terakhir
        </CardTitle>
    </CardHeader>
    <CardContent>
        <ResponsiveContainer width="100%" height={320}>
            <LineChart data={getTrendChartData()} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                <YAxis tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                {stats?.siteStats?.map(site => (
                    <Line
                        key={site.siteCode}
                        type="monotone"
                        dataKey={`${site.siteCode}_created`}
                        name={`${site.siteCode} Created`}
                        stroke={SITE_COLORS[site.siteCode]}
                        strokeWidth={3}
                        dot={{ r: 4, strokeWidth: 2 }}
                        activeDot={{ r: 6 }}
                    />
                ))}
            </LineChart>
        </ResponsiveContainer>
    </CardContent>
</Card>
```

- [ ] **Step 2: Run linter/compiler to verify syntax**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/features/manager/pages/ManagerDashboard.tsx
git commit -m "feat(manager): implement 2x2 metrics grid and trend chart in left column"
```

### Task 3: Right Column (Action Center)

**Files:**
- Modify: `apps/frontend/src/features/manager/pages/ManagerDashboard.tsx`

- [ ] **Step 1: Implement Bar Chart, Critical Feed, and Top Agents List**

Replace the right column placeholder with the compact BarChart and the two lists.

```tsx
{/* Inside the lg:col-span-5 xl:col-span-4 div */}
{/* Site Distribution */}
<Card className="rounded-xl shadow-sm border-[hsl(var(--border))]">
    <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-5 w-5 text-primary" />
            Distribusi per Site
        </CardTitle>
    </CardHeader>
    <CardContent>
        <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats?.siteStats || []} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="siteCode" tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                <YAxis tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', backgroundColor: 'hsl(var(--card))' }} />
                <Bar dataKey="openTickets" name="Open" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="criticalTickets" name="Critical" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
        </ResponsiveContainer>
    </CardContent>
</Card>

{/* Recent Critical Tickets Feed */}
<Card className="rounded-xl shadow-sm border-red-200 dark:border-red-900/50">
    <CardHeader className="pb-3 border-b border-[hsl(var(--border))] bg-red-50/30 dark:bg-red-900/10 rounded-t-xl">
        <CardTitle className="flex items-center gap-2 text-base text-red-600 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" />
            Recent Critical Tickets
        </CardTitle>
    </CardHeader>
    <CardContent className="p-0">
        <div className="flex flex-col">
            {stats?.recentCritical?.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Tidak ada tiket kritis.</div>
            ) : (
                stats?.recentCritical?.slice(0, 5).map((ticket) => (
                    <div key={ticket.id} className="flex items-start gap-3 p-4 border-b border-[hsl(var(--border))] hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors last:border-0">
                        <div className="mt-1">
                            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">{ticket.ticketNumber}</span>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true, locale: idLocale })}
                                </span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-2">{ticket.title}</p>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px] bg-white dark:bg-slate-900">
                                    {ticket.site?.code || 'N/A'}
                                </Badge>
                                {getStatusBadge(ticket.status)}
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
    </CardContent>
</Card>

{/* Top Agents List */}
<Card className="rounded-xl shadow-sm border-[hsl(var(--border))]">
    <CardHeader className="pb-3 border-b border-[hsl(var(--border))]">
        <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5 text-primary" />
            Top Agents (Resolved Today)
        </CardTitle>
    </CardHeader>
    <CardContent className="p-0">
        <div className="flex flex-col">
            {stats?.topAgents?.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Belum ada agen aktif hari ini.</div>
            ) : (
                stats?.topAgents?.slice(0, 5).map((agent) => (
                    <div key={agent.agentId} className="flex items-center justify-between p-4 border-b border-[hsl(var(--border))] hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors last:border-0">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 border border-primary/20">
                                {agent.agentName?.charAt(0) || 'A'}
                            </div>
                            <div className="min-w-0">
                                <p className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate">{agent.agentName}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <Badge style={{ backgroundColor: SITE_COLORS[agent.siteCode] }} className="text-[9px] px-1 py-0 h-4">
                                        {agent.siteCode}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">{agent.avgResolutionHours}h avg</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col items-end shrink-0 ml-2">
                            <span className="text-lg font-bold text-green-600 dark:text-green-500">{agent.resolvedToday}</span>
                            <span className="text-[10px] text-muted-foreground uppercase font-medium">Resolved</span>
                        </div>
                    </div>
                ))
            )}
        </div>
    </CardContent>
</Card>
```

- [ ] **Step 2: Clean up old UI imports and elements**

Remove the `Table`, `TableHeader`, `TableRow`, `TableHead`, `TableBody`, `TableCell` imports from `lucide-react` / `@/components/ui/table` if they are no longer used anywhere in the file. Remove the old rendering code that was completely replaced.

- [ ] **Step 3: Run linter to ensure no unused variables or syntax errors**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/features/manager/pages/ManagerDashboard.tsx
git commit -m "feat(manager): replace tables with modern feed lists in action center"
```
