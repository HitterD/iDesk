import React, { useState, useMemo, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import {
  format,
  differenceInCalendarDays,
  startOfDay,
  addMonths,
  subMonths,
  addYears,
  subYears,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
} from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import {
  Calendar as CalendarIcon,
  Clock,
  AlertTriangle,
  CheckCircle2,
  CalendarDays,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  Repeat,
  ShieldCheck,
  Globe,
  Wifi,
  Usb,
  X,
  User,
  Info,
  Search,
  Layers,
  MapPin,
  Building2,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { EFormRequest } from '../../api/eform-request.api';
import {
  EformTypeBadge,
  EformStatusBadge,
  getTypeConfig,
  EFORM_TYPES,
} from './eform-vocabulary';

export function extractSite(req: EFormRequest): string {
  if (req.formData?.site) return String(req.formData.site).toUpperCase();
  if ((req as any).site?.code) return String((req as any).site.code).toUpperCase();
  const text = `${req.requesterName} ${req.requesterDepartment || ''}`.toUpperCase();
  if (text.includes('SPJ') || text.includes('SEPANJANG')) return 'SPJ';
  if (text.includes('SMG') || text.includes('SEMARANG')) return 'SMG';
  if (text.includes('KRW') || text.includes('KARAWANG')) return 'KRW';
  if (text.includes('JTB') || text.includes('JATAKE')) return 'JTB';
  if (text.includes('SKD') || text.includes('SUKODONO')) return 'SKD';
  return 'SPJ';
}

export const SITE_BADGE_COLORS: Record<string, string> = {
  SPJ: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  SMG: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  KRW: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  JTB: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  SKD: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
};

const KNOWN_SITES = [
  { code: 'ALL', label: 'Semua Site' },
  { code: 'SPJ', label: 'SPJ (Sepanjang)' },
  { code: 'SMG', label: 'SMG (Semarang)' },
  { code: 'KRW', label: 'KRW (Karawang)' },
  { code: 'JTB', label: 'JTB (Jatake)' },
  { code: 'SKD', label: 'SKD (Sukodono)' },
];

const TYPE_THEMES: Record<string, { bg: string; border: string; text: string; badge: string; dot: string }> = {
  VPN: {
    bg: 'rgba(59, 130, 246, 0.15)',
    border: '#3b82f6',
    text: '#1d4ed8',
    badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25',
    dot: 'bg-blue-500',
  },
  WEBSITE: {
    bg: 'rgba(139, 92, 246, 0.15)',
    border: '#8b5cf6',
    text: '#6b21a8',
    badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25',
    dot: 'bg-purple-500',
  },
  NETWORK: {
    bg: 'rgba(6, 182, 212, 0.15)',
    border: '#06b6d4',
    text: '#0e7490',
    badge: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/25',
    dot: 'bg-cyan-500',
  },
  FLASHDISK: {
    bg: 'rgba(245, 158, 11, 0.15)',
    border: '#f59e0b',
    text: '#b45309',
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
    dot: 'bg-amber-500',
  },
  EMAIL: {
    bg: 'rgba(16, 185, 129, 0.15)',
    border: '#10b981',
    text: '#047857',
    badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
    dot: 'bg-emerald-500',
  },
  SYNOLOGY_NAS: {
    bg: 'rgba(59, 130, 246, 0.15)',
    border: '#3b82f6',
    text: '#1d4ed8',
    badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25',
    dot: 'bg-blue-500',
  },
};

export interface ExpirationStatus {
  label: string;
  days: number | null;
  badgeClass: string;
  isExpired?: boolean;
  isToday?: boolean;
  isExpiringSoon?: boolean;
  isSafe?: boolean;
  isPermanent?: boolean;
  isPending?: boolean;
}

export function calculateExpirationStatus(sampaiTanggal?: string, status?: string): ExpirationStatus {
  if (status !== 'CONFIRMED') {
    return {
      label: 'Menunggu Persetujuan',
      days: null,
      badgeClass: 'bg-muted text-muted-foreground border-border',
      isPending: true,
    };
  }

  if (!sampaiTanggal) {
    return {
      label: 'Permanen',
      days: null,
      badgeClass: 'bg-muted/60 text-muted-foreground border-border/80',
      isPermanent: true,
    };
  }

  const now = startOfDay(new Date());
  const [y, m, d] = sampaiTanggal.split('-').map(Number);
  if (!y || !m || !d) {
    return {
      label: sampaiTanggal,
      days: null,
      badgeClass: 'bg-muted text-muted-foreground border-border',
    };
  }

  const end = startOfDay(new Date(y, m - 1, d));
  const days = differenceInCalendarDays(end, now);

  if (days < 0) {
    return {
      label: 'Kedaluwarsa',
      days,
      badgeClass: 'bg-destructive/10 text-destructive border-destructive/25 font-bold',
      isExpired: true,
    };
  }

  if (days === 0) {
    return {
      label: 'Berakhir Hari Ini',
      days: 0,
      badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 font-bold animate-pulse',
      isToday: true,
    };
  }

  if (days <= 7) {
    return {
      label: `Sisa ${days} hari`,
      days,
      badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 font-bold',
      isExpiringSoon: true,
    };
  }

  return {
    label: `Sisa ${days} hari`,
    days,
    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-medium',
    isSafe: true,
  };
}

interface EformAccessCalendarProps {
  requests: EFormRequest[];
  isLoading?: boolean;
  basePath?: string;
  onOpenDetail?: (id: string) => void;
}

export const EformAccessCalendar: React.FC<EformAccessCalendarProps> = ({
  requests,
  isLoading = false,
  basePath = '',
  onOpenDetail,
}) => {
  const navigate = useNavigate();

  // Primary sub-mode: 'deadline' (Kalender Fokus Tenggat) vs 'gantt' (Timeline Gantt)
  const [subMode, setSubMode] = useState<'deadline' | 'gantt'>('deadline');

  // Filter states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedSite, setSelectedSite] = useState<string>('ALL');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');

  // Sidebar agenda tab
  const [activeSidebarTab, setActiveSidebarTab] = useState<'expiring' | 'expired' | 'active'>('expiring');

  // Slide-over drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerDate, setDrawerDate] = useState<string | null>(null);
  const [drawerSpecificRequest, setDrawerSpecificRequest] = useState<EFormRequest | null>(null);
  const [drawerSearch, setDrawerSearch] = useState<string>('');

  // Gantt specific states
  const [ganttScale, setGanttScale] = useState<'month' | 'quarter' | 'year'>('quarter');
  const [ganttRefDate, setGanttRefDate] = useState<Date>(new Date());
  const [ganttPage, setGanttPage] = useState<number>(1);
  const GANTT_PAGE_SIZE = 15;

  // Extract unique departments for dropdown
  const uniqueDepartments = useMemo(() => {
    const depts = new Set<string>();
    requests.forEach(r => {
      if (r.requesterDepartment && r.requesterDepartment.trim()) {
        depts.add(r.requesterDepartment.trim());
      }
    });
    return Array.from(depts).sort();
  }, [requests]);

  // Master filter applied to requests
  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      // Type filter
      if (selectedType !== 'ALL' && req.formType !== selectedType) return false;

      // Site filter
      if (selectedSite !== 'ALL') {
        const site = extractSite(req);
        if (site !== selectedSite) return false;
      }

      // Department filter
      if (selectedDept !== 'ALL') {
        if (req.requesterDepartment !== selectedDept) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = (req.requesterName || '').toLowerCase().includes(q);
        const matchesId = req.id.toLowerCase().includes(q);
        const matchesDept = (req.requesterDepartment || '').toLowerCase().includes(q);
        if (!matchesName && !matchesId && !matchesDept) return false;
      }

      return true;
    });
  }, [requests, selectedType, selectedSite, selectedDept, searchQuery]);

  // Reset Gantt page when filters change
  useEffect(() => {
    setGanttPage(1);
  }, [selectedType, selectedSite, selectedDept, searchQuery]);

  // Grouped lists for the sidebar agenda (monitoring tenggat)
  const { expiringSoonList, expiredList, activeList } = useMemo(() => {
    const expiringSoon: Array<{ req: EFormRequest; exp: ExpirationStatus }> = [];
    const expired: Array<{ req: EFormRequest; exp: ExpirationStatus }> = [];
    const active: Array<{ req: EFormRequest; exp: ExpirationStatus }> = [];

    filteredRequests.forEach(req => {
      const exp = calculateExpirationStatus(req.formData?.sampaiTanggal, req.status);
      if (req.status === 'CONFIRMED') {
        if (exp.isExpiringSoon || exp.isToday) {
          expiringSoon.push({ req, exp });
        } else if (exp.isExpired) {
          expired.push({ req, exp });
        } else {
          active.push({ req, exp });
        }
      }
    });

    expiringSoon.sort((a, b) => (a.exp.days ?? 999) - (b.exp.days ?? 999));
    expired.sort((a, b) => (b.exp.days ?? -999) - (a.exp.days ?? -999));

    return {
      expiringSoonList: expiringSoon,
      expiredList: expired,
      activeList: active,
    };
  }, [filteredRequests]);

  // ==========================================
  // MODE A: FullCalendar Events (Deadline Markers)
  // Instead of long horizontal bars, we create 1 chip per active formType on each expiration date!
  // ==========================================
  const deadlineCalendarEvents = useMemo(() => {
    const dateMap = new Map<string, Map<string, number>>();

    filteredRequests.forEach(req => {
      const sampai = req.formData?.sampaiTanggal;
      if (!sampai || req.status !== 'CONFIRMED') return;

      if (!dateMap.has(sampai)) {
        dateMap.set(sampai, new Map<string, number>());
      }
      const typeCounts = dateMap.get(sampai)!;
      typeCounts.set(req.formType, (typeCounts.get(req.formType) || 0) + 1);
    });

    const events: Array<any> = [];

    dateMap.forEach((typeCounts, dateStr) => {
      typeCounts.forEach((count, formType) => {
        const typeConfig = getTypeConfig(formType);
        const theme = TYPE_THEMES[formType] || TYPE_THEMES.VPN;

        events.push({
          id: `deadline-${dateStr}-${formType}`,
          title: `${count} ${typeConfig.label.replace('Akses ', '')}`,
          start: dateStr,
          allDay: true,
          backgroundColor: theme.bg,
          borderColor: theme.border,
          textColor: theme.text,
          extendedProps: {
            date: dateStr,
            formType,
            count,
          },
        });
      });
    });

    return events;
  }, [filteredRequests]);

  // Drawer handlers
  const openDrawerForDate = (dateStr: string) => {
    setDrawerDate(dateStr);
    setDrawerSpecificRequest(null);
    setDrawerSearch('');
    setDrawerOpen(true);
  };

  const openDrawerForRequest = (req: EFormRequest) => {
    setDrawerSpecificRequest(req);
    setDrawerDate(req.formData?.sampaiTanggal || null);
    setDrawerSearch('');
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setDrawerDate(null);
    setDrawerSpecificRequest(null);
  };

  // Drawer filtered requests
  const drawerRequests = useMemo(() => {
    if (drawerSpecificRequest) {
      return [drawerSpecificRequest];
    }
    if (!drawerDate) return [];

    let list = filteredRequests.filter(req => req.formData?.sampaiTanggal === drawerDate);
    if (drawerSearch.trim()) {
      const q = drawerSearch.toLowerCase().trim();
      list = list.filter(
        r =>
          (r.requesterName || '').toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q) ||
          (r.requesterDepartment || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [filteredRequests, drawerDate, drawerSpecificRequest, drawerSearch]);

  const handleRenewClick = (id: string) => {
    closeDrawer();
    navigate(`${basePath}/eform-access/new?renewFrom=${id}`);
  };

  const handleOpenDetailClick = (id: string) => {
    closeDrawer();
    if (onOpenDetail) {
      onOpenDetail(id);
    } else {
      navigate(`${basePath}/eform-access/${id}`);
    }
  };

  // ==========================================
  // MODE B: Timeline Horizontal Gantt Calculations
  // ==========================================
  const ganttTimeRange = useMemo(() => {
    let start: Date;
    let end: Date;

    if (ganttScale === 'month') {
      start = startOfMonth(ganttRefDate);
      end = endOfMonth(ganttRefDate);
    } else if (ganttScale === 'quarter') {
      start = startOfQuarter(ganttRefDate);
      end = endOfQuarter(ganttRefDate);
    } else {
      start = startOfYear(ganttRefDate);
      end = endOfYear(ganttRefDate);
    }

    return { start, end };
  }, [ganttScale, ganttRefDate]);

  const ganttPeriodTitle = useMemo(() => {
    if (ganttScale === 'month') {
      return format(ganttRefDate, 'MMMM yyyy', { locale: idLocale });
    }
    if (ganttScale === 'quarter') {
      const quarter = Math.floor(ganttRefDate.getMonth() / 3) + 1;
      const startM = format(ganttTimeRange.start, 'MMM', { locale: idLocale });
      const endM = format(ganttTimeRange.end, 'MMM yyyy', { locale: idLocale });
      return `Kuartal ${quarter} (${startM} – ${endM})`;
    }
    return `Tahun ${format(ganttRefDate, 'yyyy')}`;
  }, [ganttScale, ganttRefDate, ganttTimeRange]);

  const handleGanttPrev = () => {
    if (ganttScale === 'month') setGanttRefDate(prev => subMonths(prev, 1));
    else if (ganttScale === 'quarter') setGanttRefDate(prev => subMonths(prev, 3));
    else setGanttRefDate(prev => subYears(prev, 1));
  };

  const handleGanttNext = () => {
    if (ganttScale === 'month') setGanttRefDate(prev => addMonths(prev, 1));
    else if (ganttScale === 'quarter') setGanttRefDate(prev => addMonths(prev, 3));
    else setGanttRefDate(prev => addYears(prev, 1));
  };

  const handleGanttToday = () => {
    setGanttRefDate(new Date());
  };

  // Gantt Pagination
  const totalGanttItems = filteredRequests.length;
  const totalGanttPages = Math.max(1, Math.ceil(totalGanttItems / GANTT_PAGE_SIZE));
  const paginatedGanttRequests = useMemo(() => {
    const startIndex = (ganttPage - 1) * GANTT_PAGE_SIZE;
    return filteredRequests.slice(startIndex, startIndex + GANTT_PAGE_SIZE);
  }, [filteredRequests, ganttPage]);

  // Gantt header ticks
  const ganttTicks = useMemo(() => {
    const ticks: Array<{ label: string; leftPercent: number }> = [];
    const totalDays = Math.max(1, differenceInCalendarDays(ganttTimeRange.end, ganttTimeRange.start) + 1);

    if (ganttScale === 'month') {
      const daysCount = totalDays;
      for (let day = 1; day <= daysCount; day += 5) {
        const percent = ((day - 1) / daysCount) * 100;
        ticks.push({ label: `Tgl ${day}`, leftPercent: percent });
      }
    } else if (ganttScale === 'quarter') {
      for (let m = 0; m < 3; m++) {
        const mDate = addMonths(ganttTimeRange.start, m);
        const diff = differenceInCalendarDays(mDate, ganttTimeRange.start);
        const percent = (diff / totalDays) * 100;
        ticks.push({ label: format(mDate, 'MMMM', { locale: idLocale }), leftPercent: percent });
      }
    } else {
      for (let m = 0; m < 12; m++) {
        const mDate = addMonths(ganttTimeRange.start, m);
        const diff = differenceInCalendarDays(mDate, ganttTimeRange.start);
        const percent = (diff / totalDays) * 100;
        ticks.push({ label: format(mDate, 'MMM', { locale: idLocale }), leftPercent: percent });
      }
    }

    return ticks;
  }, [ganttScale, ganttTimeRange]);

  // Today indicator percent on Gantt
  const todayPercent = useMemo(() => {
    const now = startOfDay(new Date());
    if (now < ganttTimeRange.start || now > ganttTimeRange.end) return null;
    const totalDays = differenceInCalendarDays(ganttTimeRange.end, ganttTimeRange.start) + 1;
    const passed = differenceInCalendarDays(now, ganttTimeRange.start);
    return Math.max(0, Math.min(100, (passed / totalDays) * 100));
  }, [ganttTimeRange]);

  return (
    <div className="space-y-4">
      {/* Top Controls Bar: Search, Site, Dept, and View Mode Switcher */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              aria-label="Cari pemohon di kalender"
              placeholder="Cari pemohon, departemen, atau ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-4 text-xs font-medium text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns: Site & Departemen */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Site Filter */}
            <div className="flex items-center gap-1.5 min-w-[140px]">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <select
                aria-label="Saring Site"
                value={selectedSite}
                onChange={e => setSelectedSite(e.target.value)}
                className="h-10 w-full cursor-pointer rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {KNOWN_SITES.map(s => (
                  <option key={s.code} value={s.code}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Department Filter */}
            <div className="flex items-center gap-1.5 min-w-[150px]">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <select
                aria-label="Saring Departemen"
                value={selectedDept}
                onChange={e => setSelectedDept(e.target.value)}
                className="h-10 w-full cursor-pointer rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring truncate"
              >
                <option value="ALL">Semua Departemen</option>
                {uniqueDepartments.map(dept => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            {/* Sub-mode switcher: Kalender Tenggat vs Timeline Gantt */}
            <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/60 p-1 shrink-0">
              <button
                type="button"
                onClick={() => setSubMode('deadline')}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer',
                  subMode === 'deadline'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Kalender Tenggat</span>
              </button>
              <button
                type="button"
                onClick={() => setSubMode('gantt')}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer',
                  subMode === 'gantt'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Timeline Gantt</span>
              </button>
            </div>
          </div>
        </div>

        {/* Type Filter Pills & Legend Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/60">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setSelectedType('ALL')}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer',
                selectedType === 'ALL'
                  ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                  : 'bg-background border-border text-muted-foreground hover:border-border/80 hover:text-foreground'
              )}
            >
              Semua ({requests.length})
            </button>
            {EFORM_TYPES.map(({ id, label, icon: Icon }) => {
              const isSelected = selectedType === id;
              const count = requests.filter(r => r.formType === id).length;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedType(id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer',
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                      : 'bg-background border-border text-muted-foreground hover:border-border/80 hover:text-foreground'
                  )}
                >
                  <Icon size={14} />
                  <span>{label}</span>
                  <span className={cn('text-[10px] px-1 rounded-full', isSelected ? 'bg-primary-foreground/20' : 'bg-muted')}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground font-medium">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" /> VPN
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" /> Website
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 shrink-0" /> Jaringan
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" /> Flashdisk
            </span>
          </div>
        </div>
      </div>

      {/* Main Container: FullCalendar Deadline View or Timeline Gantt */}
      {subMode === 'deadline' ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
          {/* FullCalendar Surface (Left 3 cols) */}
          <div className="lg:col-span-3 rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-2xs overflow-hidden">
            <style>{`
              .eform-calendar {
                --fc-border-color: hsl(var(--border) / 0.7);
                --fc-today-bg-color: hsl(var(--primary) / 0.06);
                --fc-page-bg-color: transparent;
                --fc-neutral-bg-color: hsl(var(--muted) / 0.4);
              }
              .eform-calendar .fc-scrollgrid {
                border-radius: 0.875rem;
                overflow: hidden;
                border-color: hsl(var(--border) / 0.7) !important;
              }
              .eform-calendar .fc-col-header-cell {
                background-color: hsl(var(--muted) / 0.45);
              }
              .eform-calendar .fc-col-header-cell-cushion {
                font-size: 0.75rem;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                color: hsl(var(--muted-foreground));
                padding: 9px 4px;
              }
              .eform-calendar .fc-daygrid-day-top {
                padding: 4px 6px;
              }
              .eform-calendar .fc-daygrid-day-number {
                font-size: 0.8rem;
                font-weight: 700;
                color: hsl(var(--foreground));
                padding: 2px 6px;
                border-radius: 0.375rem;
              }
              .eform-calendar .fc-day-today .fc-daygrid-day-number {
                background-color: hsl(var(--primary));
                color: hsl(var(--primary-foreground));
              }
              .eform-calendar .fc-button-primary {
                background-color: hsl(var(--card)) !important;
                border-color: hsl(var(--border)) !important;
                color: hsl(var(--foreground)) !important;
                border-radius: 0.75rem !important;
                font-weight: 700 !important;
                font-size: 0.8rem !important;
                padding: 0.4rem 0.8rem !important;
                box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.04) !important;
                transition: all 0.15s ease !important;
                cursor: pointer !important;
              }
              .eform-calendar .fc-button-primary:hover {
                background-color: hsl(var(--muted)) !important;
                border-color: hsl(var(--border)) !important;
                color: hsl(var(--foreground)) !important;
              }
              .eform-calendar .fc-button-primary:not(:disabled).fc-button-active {
                background-color: hsl(var(--primary)) !important;
                border-color: hsl(var(--primary)) !important;
                color: hsl(var(--primary-foreground)) !important;
              }
              .eform-calendar .fc-toolbar-title {
                font-size: 1.15rem !important;
                font-weight: 800 !important;
                letter-spacing: -0.02em !important;
                color: hsl(var(--foreground)) !important;
              }
              .eform-calendar .fc-event {
                border-radius: 0.375rem !important;
                padding: 2px 5px !important;
                cursor: pointer !important;
                font-size: 0.72rem !important;
                font-weight: 700 !important;
                transition: transform 0.1s ease, box-shadow 0.1s ease !important;
              }
              .eform-calendar .fc-event:hover {
                transform: translateY(-1px);
                box-shadow: 0 2px 6px rgba(0,0,0,0.1);
              }
              .eform-calendar .fc-daygrid-day-frame {
                cursor: pointer;
                transition: background-color 0.15s ease;
              }
              .eform-calendar .fc-daygrid-day-frame:hover {
                background-color: hsl(var(--muted) / 0.25);
              }
            `}</style>

            <div className="eform-calendar min-h-[580px]">
              <FullCalendar
                plugins={[dayGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: 'dayGridMonth,dayGridWeek',
                }}
                locale="id"
                buttonText={{
                  today: 'Hari Ini',
                  month: 'Bulan',
                  week: 'Minggu',
                }}
                events={deadlineCalendarEvents}
                dateClick={info => openDrawerForDate(info.dateStr)}
                eventClick={info => {
                  const dateStr = info.event.extendedProps?.date || info.event.startStr;
                  if (dateStr) openDrawerForDate(dateStr);
                }}
                dayMaxEvents={4}
                height="auto"
              />
            </div>
          </div>

          {/* Sidebar Agenda & Expiring Watchlist (Right 1 col) */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xs">
              {/* Agenda Header & Switcher Tabs */}
              <div className="p-3 border-b border-border bg-muted/25">
                <div className="flex items-center gap-2 mb-2.5">
                  <Clock className="w-4 h-4 text-primary" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Monitoring Tenggat
                  </h3>
                </div>

                <div className="grid grid-cols-3 gap-1 p-1 bg-muted/60 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setActiveSidebarTab('expiring')}
                    className={cn(
                      'py-1 px-1.5 text-[11px] font-bold rounded-lg transition-all text-center cursor-pointer',
                      activeSidebarTab === 'expiring'
                        ? 'bg-card text-amber-600 dark:text-amber-400 shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Segera ({expiringSoonList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSidebarTab('expired')}
                    className={cn(
                      'py-1 px-1.5 text-[11px] font-bold rounded-lg transition-all text-center cursor-pointer',
                      activeSidebarTab === 'expired'
                        ? 'bg-card text-destructive shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Habis ({expiredList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSidebarTab('active')}
                    className={cn(
                      'py-1 px-1.5 text-[11px] font-bold rounded-lg transition-all text-center cursor-pointer',
                      activeSidebarTab === 'active'
                        ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Aktif ({activeList.length})
                  </button>
                </div>
              </div>

              {/* List Content */}
              <div className="p-3 max-h-[480px] overflow-y-auto custom-scrollbar space-y-2">
                {activeSidebarTab === 'expiring' &&
                  (expiringSoonList.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      <CheckCircle2 className="w-6 h-6 mx-auto mb-1.5 text-emerald-500 opacity-80" />
                      Tidak ada akses yang mendekati kedaluwarsa (&le; 7 hari).
                    </div>
                  ) : (
                    expiringSoonList.map(({ req, exp }) => (
                      <AgendaCard
                        key={req.id}
                        request={req}
                        expiration={exp}
                        onClick={() => openDrawerForRequest(req)}
                      />
                    ))
                  ))}

                {activeSidebarTab === 'expired' &&
                  (expiredList.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      <CheckCircle2 className="w-6 h-6 mx-auto mb-1.5 text-emerald-500 opacity-80" />
                      Tidak ada akses yang telah kedaluwarsa.
                    </div>
                  ) : (
                    expiredList.map(({ req, exp }) => (
                      <AgendaCard
                        key={req.id}
                        request={req}
                        expiration={exp}
                        onClick={() => openDrawerForRequest(req)}
                      />
                    ))
                  ))}

                {activeSidebarTab === 'active' &&
                  (activeList.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      Belum ada akses aktif.
                    </div>
                  ) : (
                    activeList.map(({ req, exp }) => (
                      <AgendaCard
                        key={req.id}
                        request={req}
                        expiration={exp}
                        onClick={() => openDrawerForRequest(req)}
                      />
                    ))
                  ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* MODE B: Timeline Horizontal Gantt (1 Baris per Orang dengan Pagination) */
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xs space-y-4 p-5">
          {/* Gantt Scale Switcher & Navigation Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-border/70">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGanttPrev}
                className="h-8 w-8 p-0 rounded-lg cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGanttToday}
                className="h-8 px-2.5 text-xs font-bold rounded-lg cursor-pointer"
              >
                Hari Ini
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGanttNext}
                className="h-8 w-8 p-0 rounded-lg cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <span className="text-sm font-extrabold text-foreground ml-2">
                {ganttPeriodTitle}
              </span>
            </div>

            {/* Scale Options: Bulan / Kuartal / Tahun */}
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setGanttScale('month')}
                className={cn(
                  'px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer',
                  ganttScale === 'month'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                1 Bulan
              </button>
              <button
                type="button"
                onClick={() => setGanttScale('quarter')}
                className={cn(
                  'px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer',
                  ganttScale === 'quarter'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                3 Bulan (Kuartal)
              </button>
              <button
                type="button"
                onClick={() => setGanttScale('year')}
                className={cn(
                  'px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer',
                  ganttScale === 'year'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                1 Tahun
              </button>
            </div>
          </div>

          {/* Gantt Table Canvas */}
          <div className="border border-border/80 rounded-xl overflow-hidden bg-background">
            {/* Table Header */}
            <div className="grid grid-cols-12 bg-muted/40 border-b border-border/70 text-xs font-bold text-muted-foreground uppercase tracking-wider py-2.5 px-4">
              <div className="col-span-12 sm:col-span-4">Pemohon &amp; Akses</div>
              <div className="hidden sm:block sm:col-span-8 relative">
                <div className="flex justify-between text-[11px] font-semibold text-muted-foreground">
                  {ganttTicks.map((t, idx) => (
                    <span key={idx}>{t.label}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Table Body (1 Row per Person) */}
            <div className="divide-y divide-border/50">
              {paginatedGanttRequests.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  Tidak ada data permintaan akses yang cocok dengan filter yang dipilih.
                </div>
              ) : (
                paginatedGanttRequests.map(req => {
                  const type = getTypeConfig(req.formType);
                  const TypeIcon = type.icon;
                  const theme = TYPE_THEMES[req.formType] || TYPE_THEMES.VPN;
                  const siteCode = extractSite(req);
                  const siteColor = SITE_BADGE_COLORS[siteCode] || SITE_BADGE_COLORS.SPJ;
                  const exp = calculateExpirationStatus(req.formData?.sampaiTanggal, req.status);

                  // Calculate Bar Position % relative to current gantt range
                  const totalRangeDays = Math.max(
                    1,
                    differenceInCalendarDays(ganttTimeRange.end, ganttTimeRange.start) + 1
                  );

                  let leftPercent = 0;
                  let widthPercent = 100;
                  const dariStr = req.formData?.dariTanggal;
                  const sampaiStr = req.formData?.sampaiTanggal;

                  if (dariStr) {
                    const [y1, m1, d1] = dariStr.split('-').map(Number);
                    const startDate = startOfDay(new Date(y1, m1 - 1, d1));

                    let endDate = ganttTimeRange.end;
                    if (sampaiStr) {
                      const [y2, m2, d2] = sampaiStr.split('-').map(Number);
                      endDate = startOfDay(new Date(y2, m2 - 1, d2));
                    }

                    const clampedStart = startDate < ganttTimeRange.start ? ganttTimeRange.start : startDate;
                    const clampedEnd = endDate > ganttTimeRange.end ? ganttTimeRange.end : endDate;

                    const offsetDays = differenceInCalendarDays(clampedStart, ganttTimeRange.start);
                    const durationDays = Math.max(1, differenceInCalendarDays(clampedEnd, clampedStart) + 1);

                    leftPercent = Math.max(0, Math.min(100, (offsetDays / totalRangeDays) * 100));
                    widthPercent = Math.max(3, Math.min(100 - leftPercent, (durationDays / totalRangeDays) * 100));
                  }

                  return (
                    <div
                      key={req.id}
                      onClick={() => openDrawerForRequest(req)}
                      className="grid grid-cols-12 items-center py-3 px-4 hover:bg-muted/30 transition-colors cursor-pointer group"
                    >
                      {/* Left Column: User, Dept, Site, FormType */}
                      <div className="col-span-12 sm:col-span-4 flex items-center gap-2.5 min-w-0 pr-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                          {req.requesterName.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-extrabold text-foreground truncate group-hover:text-primary transition-colors">
                              {req.requesterName}
                            </p>
                            <span className={cn('text-[9px] font-bold px-1.5 py-0.2 rounded border shrink-0', siteColor)}>
                              {siteCode}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate mt-0.5">
                            <TypeIcon className="w-3 h-3 text-primary shrink-0" />
                            <span className="font-semibold text-foreground/80">{type.label.replace('Akses ', '')}</span>
                            <span>•</span>
                            <span className="truncate">{req.requesterDepartment || 'Dept'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Timeline Duration Bar */}
                      <div className="hidden sm:block sm:col-span-8 relative h-7 bg-muted/20 rounded-lg overflow-hidden border border-border/40">
                        {/* Today Marker */}
                        {todayPercent !== null && (
                          <div
                            style={{ left: `${todayPercent}%` }}
                            className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-10 opacity-70 pointer-events-none"
                            title="Hari Ini"
                          />
                        )}

                        {/* Interactive Duration Bar */}
                        <div
                          style={{
                            left: `${leftPercent}%`,
                            width: `${widthPercent}%`,
                            backgroundColor: theme.bg,
                            borderColor: theme.border,
                            color: theme.text,
                          }}
                          className="absolute top-1 bottom-1 rounded-md border flex items-center justify-between px-2 text-[10px] font-bold shadow-2xs truncate transition-transform hover:scale-[1.01]"
                          title={`${req.requesterName} (${type.label}): ${dariStr || '—'} s/d ${sampaiStr || 'Permanen'} (${exp.label})`}
                        >
                          <span className="truncate">
                            {dariStr} &rarr; {sampaiStr || 'Permanen'}
                          </span>
                          <span className={cn('text-[9px] px-1 rounded font-bold shrink-0 ml-1', exp.badgeClass)}>
                            {exp.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Gantt Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-muted-foreground">
            <div>
              Menampilkan{' '}
              <span className="font-bold text-foreground">
                {totalGanttItems === 0 ? 0 : (ganttPage - 1) * GANTT_PAGE_SIZE + 1}
              </span>
              –
              <span className="font-bold text-foreground">
                {Math.min(ganttPage * GANTT_PAGE_SIZE, totalGanttItems)}
              </span>{' '}
              dari <span className="font-bold text-foreground">{totalGanttItems}</span> pemohon
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={ganttPage <= 1}
                onClick={() => setGanttPage(1)}
                className="h-8 w-8 p-0 rounded-lg cursor-pointer"
                title="Halaman Pertama"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={ganttPage <= 1}
                onClick={() => setGanttPage(prev => Math.max(1, prev - 1))}
                className="h-8 px-2 rounded-lg cursor-pointer text-xs font-bold"
              >
                Sebelumnya
              </Button>

              <span className="px-3 py-1 font-bold text-foreground">
                Hal {ganttPage} / {totalGanttPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                disabled={ganttPage >= totalGanttPages}
                onClick={() => setGanttPage(prev => Math.min(totalGanttPages, prev + 1))}
                className="h-8 px-2 rounded-lg cursor-pointer text-xs font-bold"
              >
                Berikutnya
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={ganttPage >= totalGanttPages}
                onClick={() => setGanttPage(totalGanttPages)}
                className="h-8 w-8 p-0 rounded-lg cursor-pointer"
                title="Halaman Terakhir"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* Slide-over Drawer Interaktif dari Sisi Kanan */}
      {/* ========================================== */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-200">
          {/* Backdrop Overlay */}
          <div
            onClick={closeDrawer}
            className="fixed inset-0 bg-background/80 backdrop-blur-xs transition-opacity cursor-pointer"
          />

          {/* Drawer Panel */}
          <div className="relative w-full sm:max-w-md md:max-w-lg bg-card h-full shadow-2xl border-l border-border flex flex-col z-50 animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 border-b border-border bg-muted/20 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Detail Tenggat Akses
                  </span>
                </div>
                <h2 className="text-base font-extrabold text-foreground mt-1">
                  {drawerDate
                    ? (() => {
                        const [y, m, d] = drawerDate.split('-').map(Number);
                        return format(new Date(y, m - 1, d), 'EEEE, d MMMM yyyy', { locale: idLocale });
                      })()
                    : drawerSpecificRequest?.requesterName || 'Detail Permintaan'}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {drawerRequests.length} permintaan akses tercatat pada tenggat ini.
                </p>
              </div>

              <button
                type="button"
                onClick={closeDrawer}
                className="p-1.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Filter Search inside Drawer (if more than 2 items) */}
            {drawerRequests.length > 2 && (
              <div className="p-3 border-b border-border/70 bg-background">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="search"
                    placeholder="Cari nama pemohon pada tanggal ini..."
                    value={drawerSearch}
                    onChange={e => setDrawerSearch(e.target.value)}
                    className="h-8 w-full rounded-lg border border-border bg-muted/40 pl-8 pr-3 text-xs font-medium text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              </div>
            )}

            {/* Drawer Request Cards List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
              {drawerRequests.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  Tidak ada permintaan akses yang berakhir pada tanggal ini.
                </div>
              ) : (
                drawerRequests.map(req => {
                  const type = getTypeConfig(req.formType);
                  const TypeIcon = type.icon;
                  const siteCode = extractSite(req);
                  const siteColor = SITE_BADGE_COLORS[siteCode] || SITE_BADGE_COLORS.SPJ;
                  const exp = calculateExpirationStatus(req.formData?.sampaiTanggal, req.status);

                  return (
                    <div
                      key={req.id}
                      className="rounded-xl border border-border bg-background p-4 shadow-2xs space-y-3 hover:border-primary/40 transition-all"
                    >
                      {/* Top Row: Type, ID, Site, Status */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-xs font-bold text-primary">
                            #{req.id.slice(0, 8).toUpperCase()}
                          </span>
                          <span className={cn('text-[10px] font-bold px-1.5 py-0.2 rounded border', siteColor)}>
                            {siteCode}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-foreground">
                            <TypeIcon className="w-3.5 h-3.5 text-primary" />
                            {type.label.replace('Akses ', '')}
                          </span>
                        </div>
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-bold', exp.badgeClass)}>
                          {exp.label}
                        </span>
                      </div>

                      {/* Requester Info */}
                      <div className="text-xs space-y-0.5">
                        <p className="font-extrabold text-foreground">{req.requesterName}</p>
                        <p className="text-muted-foreground text-[11px]">{req.requesterDepartment || 'Departemen —'}</p>
                      </div>

                      {/* Validity Period */}
                      <div className="rounded-lg bg-muted/40 p-2.5 text-xs flex items-center justify-between">
                        <span className="text-muted-foreground font-medium">Masa Berlaku:</span>
                        <span className="font-bold text-foreground">
                          {req.formData?.dariTanggal || '—'} &rarr; {req.formData?.sampaiTanggal || 'Permanen'}
                        </span>
                      </div>

                      {/* Specific Field Info */}
                      {req.formType === 'VPN' && req.formData?.kebutuhanAkses && (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-semibold">Kebutuhan: </span>
                          <span className="text-foreground">{req.formData.kebutuhanAkses}</span>
                        </div>
                      )}
                      {req.formType === 'FLASHDISK' && req.formData?.hostname && (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-semibold">Hostname PC: </span>
                          <span className="font-mono font-bold text-foreground">{req.formData.hostname}</span>
                        </div>
                      )}
                      {req.formType === 'WEBSITE' && req.requestedWebsites && (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-semibold">Website: </span>
                          <span className="font-mono text-foreground">{req.requestedWebsites}</span>
                        </div>
                      )}
                      {req.formType === 'NETWORK' && req.networkPurpose && (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-semibold">Tujuan: </span>
                          <span className="text-foreground">{req.networkPurpose}</span>
                        </div>
                      )}
                      {req.formType === 'EMAIL' && req.formData?.proposedEmail && (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-semibold">Usulan Email: </span>
                          <span className="font-mono text-foreground">
                            {req.formData.proposedEmail.includes('@')
                              ? req.formData.proposedEmail
                              : `${req.formData.proposedEmail}${req.formData?.emailDomain || '@kapalapi.co.id'}`}
                          </span>
                        </div>
                      )}
                      {req.formType === 'SYNOLOGY_NAS' && req.formData?.folderPath && (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-semibold">Folder NAS: </span>
                          <span className="font-mono text-foreground">{req.formData.folderPath}</span>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRenewClick(req.id)}
                          className="h-8 rounded-lg font-bold text-xs cursor-pointer"
                        >
                          <Repeat className="w-3.5 h-3.5 mr-1" />
                          Ajukan Perpanjangan
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleOpenDetailClick(req.id)}
                          className="h-8 rounded-lg font-bold text-xs cursor-pointer shadow-xs"
                        >
                          <ExternalLink className="w-3.5 h-3.5 mr-1" />
                          Buka Detail
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-3 border-t border-border bg-muted/20 text-right">
              <Button variant="ghost" size="sm" onClick={closeDrawer} className="text-xs font-bold rounded-lg cursor-pointer">
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface AgendaCardProps {
  request: EFormRequest;
  expiration: ExpirationStatus;
  onClick: () => void;
}

const AgendaCard: React.FC<AgendaCardProps> = ({ request, expiration, onClick }) => {
  const type = getTypeConfig(request.formType);
  const Icon = type.icon;
  const siteCode = extractSite(request);
  const siteColor = SITE_BADGE_COLORS[siteCode] || SITE_BADGE_COLORS.SPJ;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="group p-2.5 rounded-xl border border-border bg-background hover:border-primary/40 hover:bg-muted/30 transition-all cursor-pointer text-left space-y-1.5 shadow-2xs"
    >
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-xs font-bold text-foreground truncate">{request.requesterName}</span>
          <span className={cn('text-[9px] font-bold px-1 rounded border shrink-0', siteColor)}>
            {siteCode}
          </span>
        </div>
        <span className={cn('text-[10px] px-2 py-0.2 rounded-full border shrink-0', expiration.badgeClass)}>
          {expiration.label}
        </span>
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="font-mono text-[10px]">#{request.id.slice(0, 8).toUpperCase()}</span>
        <span>s/d {request.formData?.sampaiTanggal || 'Permanen'}</span>
      </div>
    </div>
  );
};
