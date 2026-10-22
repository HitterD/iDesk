import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/stores/useAuth';
import { BarChart3, Calendar, ChartColumn, ChevronDown, Clock, Users } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { getDefaultDateRange } from '@/lib/constants/date-presets';
import type { SegmentedOption } from '@/components/ui/segmented-control';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ResHead } from '@/components/resources/ResourceParts';
import { MgPanel, MgTabs, useTabDirection } from '@/components/management/MgmtParts';
import { PDFPreviewModal, usePDFPreview } from '../components/PDFPreviewModal';
import { ScheduledReportsTab } from '../components/scheduled/ScheduledReportsTab';
import { monthRange } from '../components/ReportParts';
import { AgentTab, MonthlyTab, VolumeTab, type AgentMetrics, type MonthlyStats, type TicketVolumeData } from '../components/ReportTabs';
import { REPORT_TEAMS, ReportTeam, lockedTeamForRole, reportTeamLabel, teamQueryParam, ALL_TEAMS_LABEL, REPORT_TEAMS_SCOPE_TITLE } from '../reportTeams';

type ReportTab = 'monthly' | 'agent' | 'volume' | 'scheduled';
const TAB_ORDER: readonly ReportTab[] = ['monthly', 'agent', 'volume', 'scheduled'];
const ALL_VALUE = 'ALL';
const isTab = (v: string | null): v is ReportTab => !!v && (TAB_ORDER as readonly string[]).includes(v);

export const BentoReportsPage: React.FC = () => {
    const [params] = useSearchParams();
    const initialTab: ReportTab = isTab(params.get('tab')) ? (params.get('tab') as ReportTab) : 'monthly';
    const [activeTab, setActiveTab] = useState<ReportTab>(initialTab);
    const tabDir = useTabDirection(TAB_ORDER, activeTab);
    const [month, setMonth] = useState<string>((new Date().getMonth() + 1).toString());
    const [year, setYear] = useState<string>(new Date().getFullYear().toString());

    const defaultDateRange = useMemo(() => getDefaultDateRange(), []);
    const [startDate, setStartDate] = useState<string>(defaultDateRange.startDate);
    const [endDate, setEndDate] = useState<string>(defaultDateRange.endDate);
    const [exporting, setExporting] = useState(false);

    // PDF Preview hook
    const pdfPreview = usePDFPreview();

    // Dynamic year range: current year ± 3 years
    const currentYear = new Date().getFullYear();
    const yearOptions = useMemo(() =>
        Array.from({ length: 7 }, (_, i) => currentYear - 3 + i),
        [currentYear]
    );

    // Team scope — applies to every tab and export. Agents are locked to their
    // own team (enforced server-side too); ADMIN/MANAGER may pick any team.
    const { user: authUser } = useAuth();
    const lockedTeam = lockedTeamForRole(authUser?.role);
    const [selectedTeam, setSelectedTeam] = useState<ReportTeam | null>(null);
    const team = lockedTeam ?? selectedTeam;
    const teamParam = teamQueryParam(team);

    // Monthly Stats Query
    const {
        data: monthlyStats,
        isLoading: monthlyLoading,
        error: monthlyError,
    } = useQuery<MonthlyStats>({
        queryKey: ['reports', 'monthly', month, year, team],
        queryFn: async () => {
            const response = await api.get(`/reports/monthly?month=${month}&year=${year}${teamParam}`);
            return response.data;
        },
        enabled: activeTab === 'monthly',
        staleTime: 60000, // 1 minute
        retry: 2,
    });

    // Agent Performance Query
    const {
        data: agentMetricsData,
        isLoading: agentLoading,
        error: agentError,
    } = useQuery<{ data: AgentMetrics[] }>({
        queryKey: ['reports', 'agent-performance', startDate, endDate, team],
        queryFn: async () => {
            const response = await api.get(`/reports/agent-performance?startDate=${startDate}&endDate=${endDate}${teamParam}`);
            return response.data;
        },
        enabled: activeTab === 'agent',
        staleTime: 60000,
        retry: 2,
    });

    const agentMetrics = agentMetricsData?.data || [];

    // Ticket Volume Query
    const {
        data: volumeDataResponse,
        isLoading: volumeLoading,
        error: volumeError,
    } = useQuery<{ data: TicketVolumeData }>({
        queryKey: ['reports', 'ticket-volume', startDate, endDate, team],
        queryFn: async () => {
            const response = await api.get(`/reports/ticket-volume?startDate=${startDate}&endDate=${endDate}${teamParam}`);
            return response.data;
        },
        enabled: activeTab === 'volume',
        staleTime: 60000,
        retry: 2,
    });

    const volumeData = volumeDataResponse?.data || null;

    // Monthly breakdown (daily trend, status, priority) from the same ticket-volume endpoint over the month range.
    const monthBounds = useMemo(() => monthRange(Number(month), Number(year)), [month, year]);
    const { data: monthVolumeResponse, isLoading: monthVolumeLoading } = useQuery<{ data: TicketVolumeData }>({
        queryKey: ['reports', 'ticket-volume', monthBounds.startDate, monthBounds.endDate, team],
        queryFn: async () => {
            const response = await api.get(`/reports/ticket-volume?startDate=${monthBounds.startDate}&endDate=${monthBounds.endDate}${teamParam}`);
            return response.data;
        },
        enabled: activeTab === 'monthly',
        staleTime: 60000,
        retry: 2,
    });
    const monthVolume = monthVolumeResponse?.data || null;

    const canManageScheduled = ['ADMIN', 'MANAGER'].includes(authUser?.role || '');

    // Download handler with progress indicator
    const downloadFile = async (url: string, filename: string, reportType: string = 'Report') => {
        setExporting(true);
        const toastId = toast.loading(`Preparing ${reportType}...`, {
            description: 'Generating your report, please wait.',
        });

        try {
            const response = await api.get(url, { responseType: 'blob' });
            const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = blobUrl;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(blobUrl);

            toast.success(`${reportType} downloaded!`, {
                id: toastId,
                description: filename,
            });
        } catch (error) {
            logger.error('Failed to download report:', error);
            toast.error('Failed to download report', {
                id: toastId,
                description: 'Please try again later.',
            });
        } finally {
            setExporting(false);
        }
    };

    const handleExportMonthlyExcel = () => {
        downloadFile(`/reports/export/excel?month=${month}&year=${year}${teamParam}`, `monthly-report-${month}-${year}.xlsx`, 'Monthly Excel Report');
    };

    const handleExportMonthlyPDF = () => {
        downloadFile(`/reports/export/pdf/monthly?month=${month}&year=${year}${teamParam}`, `monthly-report-${month}-${year}.pdf`, 'Monthly PDF Report');
    };

    const handlePreviewMonthlyPDF = () => {
        pdfPreview.openPreview(
            `/reports/export/pdf/monthly?month=${month}&year=${year}${teamParam}`,
            `monthly-report-${month}-${year}.pdf`,
            'Monthly Summary Report'
        );
    };

    const handleExportAgentPDF = () => {
        downloadFile(`/reports/export/pdf/agent-performance?startDate=${startDate}&endDate=${endDate}${teamParam}`, `agent-performance-${startDate}-to-${endDate}.pdf`, 'Agent Performance PDF');
    };

    const handlePreviewAgentPDF = () => {
        pdfPreview.openPreview(
            `/reports/export/pdf/agent-performance?startDate=${startDate}&endDate=${endDate}${teamParam}`,
            `agent-performance-${startDate}-to-${endDate}.pdf`,
            'Agent Performance Report'
        );
    };

    const handleExportVolumePDF = () => {
        downloadFile(`/reports/export/pdf/ticket-volume?startDate=${startDate}&endDate=${endDate}${teamParam}`, `ticket-volume-${startDate}-to-${endDate}.pdf`, 'Ticket Volume PDF');
    };

    const handlePreviewVolumePDF = () => {
        pdfPreview.openPreview(
            `/reports/export/pdf/ticket-volume?startDate=${startDate}&endDate=${endDate}${teamParam}`,
            `ticket-volume-${startDate}-to-${endDate}.pdf`,
            'Ticket Volume Report'
        );
    };

    const handleExportCustomExcel = () => {
        downloadFile(`/reports/export/excel/custom?startDate=${startDate}&endDate=${endDate}${teamParam}`, `comprehensive-report-${startDate}-to-${endDate}.xlsx`, 'Comprehensive Excel Report');
    };

    // Show error if any query failed
    const currentError = activeTab === 'monthly' ? monthlyError : activeTab === 'agent' ? agentError : volumeError;
    if (currentError) {
        logger.error('Report fetch error:', currentError);
    }

    const tabs: SegmentedOption<ReportTab>[] = [
        { value: 'monthly', label: 'Monthly Summary', icon: Calendar },
        { value: 'agent', label: 'Agent Performance', icon: Users },
        { value: 'volume', label: 'Ticket Volume', icon: BarChart3 },
        { value: 'scheduled', label: 'Scheduled Reports', icon: Clock },
    ];
    const onRange = (s: string, e: string) => { setStartDate(s); setEndDate(e); };

    return (
        <>
            <div className="res-page mg-page">
                <ResHead icon={ChartColumn} tone="green" title="Reports & Analytics" description="Analisis performa, pantau metrik, dan ekspor data"
                    actions={lockedTeam ? (
                        <span className="queue-pop" aria-label={`${REPORT_TEAMS_SCOPE_TITLE}: ${reportTeamLabel(lockedTeam)}`}>
                            <span className="queue-pop-k">{REPORT_TEAMS_SCOPE_TITLE}</span><span className="queue-pop-v">{reportTeamLabel(lockedTeam)}</span>
                        </span>
                    ) : (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button type="button" className="queue-pop" aria-label="Pilih tim">
                                    <span className="queue-pop-k">{REPORT_TEAMS_SCOPE_TITLE}</span>
                                    <span className="queue-pop-v">{selectedTeam ? reportTeamLabel(selectedTeam) : ALL_TEAMS_LABEL}</span>
                                    <ChevronDown aria-hidden="true" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" variant="compact" className="res-pop-menu" aria-label="Pilih tim">
                                <DropdownMenuRadioGroup value={selectedTeam ?? ALL_VALUE} onValueChange={(v) => setSelectedTeam(v === ALL_VALUE ? null : (v as ReportTeam))}>
                                    <DropdownMenuRadioItem value={ALL_VALUE}>{ALL_TEAMS_LABEL}</DropdownMenuRadioItem>
                                    {REPORT_TEAMS.map((t) => <DropdownMenuRadioItem key={t} value={t}>{reportTeamLabel(t)}</DropdownMenuRadioItem>)}
                                </DropdownMenuRadioGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )} />

                <div className="mb-4"><MgTabs label="Jenis laporan" options={tabs} value={activeTab} onChange={setActiveTab} /></div>

                <MgPanel key={activeTab} dir={tabDir} label={String(tabs.find((t) => t.value === activeTab)?.label ?? '')}>
                    {activeTab === 'monthly' && (
                        <MonthlyTab month={Number(month)} year={Number(year)} years={yearOptions}
                            onMonth={(m, y) => { setMonth(String(m)); setYear(String(y)); }}
                            stats={monthlyStats} loading={monthlyLoading} volume={monthVolume} volumeLoading={monthVolumeLoading}
                            disabled={exporting || monthlyLoading} onPreview={handlePreviewMonthlyPDF} onPdf={handleExportMonthlyPDF} onExcel={handleExportMonthlyExcel} />
                    )}
                    {activeTab === 'agent' && (
                        <AgentTab agents={agentMetrics} loading={agentLoading} startDate={startDate} endDate={endDate} onRange={onRange}
                            disabled={exporting || agentLoading} onPreview={handlePreviewAgentPDF} onPdf={handleExportAgentPDF} onExcel={handleExportCustomExcel} />
                    )}
                    {activeTab === 'volume' && (
                        <VolumeTab volume={volumeData} loading={volumeLoading} startDate={startDate} endDate={endDate} onRange={onRange}
                            disabled={exporting || volumeLoading} onPreview={handlePreviewVolumePDF} onPdf={handleExportVolumePDF} onExcel={handleExportCustomExcel} />
                    )}
                    {activeTab === 'scheduled' && (
                        <ScheduledReportsTab canManage={canManageScheduled} currentSiteId={authUser?.siteId} />
                    )}
                </MgPanel>
            </div>

            {/* PDF Preview Modal */}
            {pdfPreview.previewConfig && (
                <PDFPreviewModal
                    isOpen={pdfPreview.isOpen}
                    onClose={pdfPreview.closePreview}
                    pdfUrl={pdfPreview.previewConfig.url}
                    filename={pdfPreview.previewConfig.filename}
                    title={pdfPreview.previewConfig.title}
                />
            )}
        </>
    );
};

export default BentoReportsPage;
