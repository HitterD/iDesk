import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    FileText,
    Download,
    Calendar,
    Building2,
    BarChart3,
    PieChart,
    TrendingUp,
    Users,
    Ticket,
    Clock,
    AlertTriangle,
} from 'lucide-react';
import { SiteSelector } from '@/components/site/SiteSelector';
import { ResHead } from '@/components/resources/ResourceParts';
import { ModernDatePicker } from '@/components/ui/ModernDatePicker';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { toast } from 'sonner';
import api from '@/lib/api';
import { REPORT_TEAMS, ReportTeam, reportTeamLabel, ALL_TEAMS_LABEL, REPORT_TEAMS_SCOPE_TITLE } from '@/features/reports/reportTeams';

type ReportType = 'consolidated' | 'per-site' | 'comparison';
type ExportFormat = 'pdf' | 'excel';
type DatePreset = 'today' | 'week' | 'month' | 'custom';

interface ReportSection {
    id: string;
    label: string;
    icon: React.ReactNode;
    description: string;
}

const REPORT_SECTIONS: ReportSection[] = [
    {
        id: 'summary',
        label: 'Executive Summary',
        icon: <BarChart3 className="w-4 h-4" />,
        description: 'Overview & key metrics',
    },
    {
        id: 'tickets',
        label: 'Ticket Statistics',
        icon: <Ticket className="w-4 h-4" />,
        description: 'Created, resolved, pending',
    },
    {
        id: 'sla',
        label: 'SLA Performance',
        icon: <Clock className="w-4 h-4" />,
        description: 'SLA compliance & breaches',
    },
    {
        id: 'agents',
        label: 'Agent Performance',
        icon: <Users className="w-4 h-4" />,
        description: 'Top performers & workload',
    },
    {
        id: 'trends',
        label: 'Trend Analysis',
        icon: <TrendingUp className="w-4 h-4" />,
        description: 'Historical comparisons',
    },
    {
        id: 'critical',
        label: 'Critical Tickets',
        icon: <AlertTriangle className="w-4 h-4" />,
        description: 'High priority items',
    },
];

export const ManagerReportsPage = () => {
    const [reportType, setReportType] = useState<ReportType>('consolidated');
    const [selectedSites, setSelectedSites] = useState<string[]>([]);
    const [team, setTeam] = useState<ReportTeam | null>(null);
    const [datePreset, setDatePreset] = useState<DatePreset>('month');
    const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(new Date()));
    const [dateTo, setDateTo] = useState<Date>(endOfMonth(new Date()));
    const [selectedSections, setSelectedSections] = useState<string[]>(['summary', 'tickets', 'sla']);
    const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf');
    const [isGenerating, setIsGenerating] = useState(false);

    const handleDatePresetChange = (preset: DatePreset) => {
        setDatePreset(preset);
        const today = new Date();

        switch (preset) {
            case 'today':
                setDateFrom(today);
                setDateTo(today);
                break;
            case 'week':
                setDateFrom(subDays(today, 7));
                setDateTo(today);
                break;
            case 'month':
                setDateFrom(startOfMonth(today));
                setDateTo(endOfMonth(today));
                break;
            case 'custom':
                // Keep existing dates
                break;
        }
    };

    const toggleSection = (sectionId: string) => {
        setSelectedSections(prev =>
            prev.includes(sectionId)
                ? prev.filter(id => id !== sectionId)
                : [...prev, sectionId]
        );
    };

    const handleGenerateReport = async () => {
        if (selectedSections.length === 0) {
            toast.error('Pilih minimal satu bagian laporan');
            return;
        }

        setIsGenerating(true);
        try {
            // Timeout 120s (Q15): report multi-site bisa jauh lebih lambat dari default 30s.
            const response = await api.post('/manager/reports/generate', {
                reportType,
                siteIds: selectedSites,
                ...(team ? { team } : {}),
                dateFrom: format(dateFrom, 'yyyy-MM-dd'),
                dateTo: format(dateTo, 'yyyy-MM-dd'),
                sections: selectedSections,
                format: exportFormat,
            }, {
                responseType: 'blob',
                timeout: 120000,
            });

            // Q13: nama file dari Content-Disposition backend — deskriptif per site/periode.
            const disposition: string = response.headers?.['content-disposition'] ?? '';
            const match = /filename="?([^";]+)"?/i.exec(disposition);
            const ext = exportFormat === 'pdf' ? 'pdf' : 'xlsx';
            const filename = match?.[1] ?? `manager-report-${format(new Date(), 'yyyy-MM-dd')}.${ext}`;

            const blob = new Blob([response.data], {
                type: exportFormat === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.click();
            window.URL.revokeObjectURL(url);

            toast.success('Laporan berhasil di-generate!');
        } catch (error) {
            console.error('Failed to generate report:', error);
            // Q14: responseType blob membungkus body error — buka agar pesan backend terbaca.
            let message = 'Gagal generate laporan. Silakan coba lagi.';
            const err = error as { response?: { data?: unknown } };
            if (err.response?.data instanceof Blob) {
                try {
                    const parsed = JSON.parse(await err.response.data.text());
                    message = parsed?.message?.[0] ?? parsed?.message ?? message;
                } catch {
                    /* body bukan JSON — pakai pesan generik */
                }
            }
            toast.error(message);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="res-page space-y-0 pb-10">
            <ResHead icon={FileText} tone="green" title="Manager Reports" description="Generate dan export laporan kinerja site, SLA compliance, dan performa agent" />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Report Configuration */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Report Type */}
                    <Card className="dash-panel !p-0 border-0">
                        <CardHeader>
                            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                                <PieChart className="w-5 h-5 text-primary" />
                                Jenis Laporan
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {[
                                    { value: 'consolidated', label: 'Consolidated', desc: 'Gabungan semua site' },
                                    { value: 'per-site', label: 'Per Site', desc: 'Detail per lokasi' },
                                    { value: 'comparison', label: 'Comparison', desc: 'Perbandingan antar site' },
                                ].map((type) => (
                                    <button
                                        key={type.value}
                                        onClick={() => setReportType(type.value as ReportType)}
                                        className={`p-3.5 rounded-xl border-2 transition-all duration-150 text-left cursor-pointer ${reportType === type.value
                                            ? 'border-primary bg-primary/10 text-primary shadow-xs'
                                            : 'border-border/80 hover:border-primary/40 bg-background hover:bg-muted/40 text-foreground'
                                            }`}
                                    >
                                        <div className="font-bold text-sm">{type.label}</div>
                                        <div className="text-xs text-muted-foreground mt-1">{type.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Team Selection */}
                    <Card className="dash-panel !p-0 border-0">
                        <CardHeader>
                            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                                <Users className="w-5 h-5 text-primary" />
                                Pilih {REPORT_TEAMS_SCOPE_TITLE}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2" role="group" aria-label="Pilih tim">
                                {[null, ...REPORT_TEAMS].map((t) => (
                                    <button
                                        key={t ?? 'ALL'}
                                        type="button"
                                        onClick={() => setTeam(t)}
                                        aria-pressed={team === t}
                                        className={`px-3 py-1.5 rounded-lg border-2 text-xs font-semibold transition-all duration-150 ${team === t
                                            ? 'border-primary bg-primary/10 text-primary'
                                            : 'border-border/80 hover:border-primary/40 bg-background text-foreground'
                                            }`}
                                    >
                                        {t ? reportTeamLabel(t) : ALL_TEAMS_LABEL}
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Site Selection */}
                    <Card className="dash-panel !p-0 border-0">
                        <CardHeader>
                            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                                <Building2 className="w-5 h-5 text-primary" />
                                Pilih Site
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <SiteSelector
                                selectedSiteIds={selectedSites}
                                onSelectionChange={setSelectedSites}
                                mode="multi"
                            />
                            {selectedSites.length === 0 && (
                                <p className="text-xs text-muted-foreground mt-2">
                                    Tidak memilih site = semua cabang site akan dimasukkan ke laporan
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Date Range */}
                    <Card className="dash-panel !p-0 border-0">
                        <CardHeader>
                            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                                <Calendar className="w-5 h-5 text-primary" />
                                Periode Laporan
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2 flex-wrap">
                                {[
                                    { value: 'today', label: 'Hari Ini' },
                                    { value: 'week', label: '7 Hari' },
                                    { value: 'month', label: 'Bulan Ini' },
                                    { value: 'custom', label: 'Custom' },
                                ].map((preset) => (
                                    <Button
                                        key={preset.value}
                                        variant={datePreset === preset.value ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => handleDatePresetChange(preset.value as DatePreset)}
                                        className="rounded-xl text-xs"
                                    >
                                        {preset.label}
                                    </Button>
                                ))}
                            </div>

                            {datePreset === 'custom' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold">Dari Tanggal</Label>
                                        <ModernDatePicker
                                            value={dateFrom}
                                            onChange={(date) => setDateFrom(date)}
                                            placeholder="Pilih tanggal mulai"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold">Sampai Tanggal</Label>
                                        <ModernDatePicker
                                            value={dateTo}
                                            onChange={(date) => setDateTo(date)}
                                            placeholder="Pilih tanggal akhir"
                                        />
                                    </div>
                                </div>
                            )}

                            <p className="text-xs text-muted-foreground">
                                Periode terpilih: <span className="font-semibold text-foreground">{format(dateFrom, 'dd MMM yyyy')} - {format(dateTo, 'dd MMM yyyy')}</span>
                            </p>
                        </CardContent>
                    </Card>

                    {/* Report Sections */}
                    <Card className="dash-panel !p-0 border-0">
                        <CardHeader>
                            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                                <BarChart3 className="w-5 h-5 text-primary" />
                                Bagian Laporan
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {REPORT_SECTIONS.map((section) => (
                                    <label
                                        key={section.id}
                                        className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all duration-150 ${selectedSections.includes(section.id)
                                            ? 'border-primary bg-primary/10 text-primary shadow-xs'
                                            : 'border-border/80 hover:border-primary/40 bg-background hover:bg-muted/40 text-foreground'
                                            }`}
                                    >
                                        <Checkbox
                                            checked={selectedSections.includes(section.id)}
                                            onCheckedChange={() => toggleSection(section.id)}
                                            className="mt-0.5"
                                        />
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 font-bold text-sm">
                                                {section.icon}
                                                {section.label}
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {section.description}
                                            </p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column - Export Options & Summary */}
                <div className="space-y-6">
                    {/* Export Format */}
                    <Card className="dash-panel !p-0 border-0">
                        <CardHeader>
                            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                                <Download className="w-5 h-5 text-primary" />
                                Format Export
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Select value={exportFormat} onValueChange={(val) => setExportFormat(val as ExportFormat)}>
                                <SelectTrigger className="h-11 rounded-xl bg-background border-border/80">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-border/80">
                                    <SelectItem value="pdf">
                                        <div className="flex items-center gap-2 font-medium">
                                            <FileText className="w-4 h-4 text-red-500" />
                                            PDF Document (.pdf)
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="excel">
                                        <div className="flex items-center gap-2 font-medium">
                                            <FileText className="w-4 h-4 text-emerald-500" />
                                            Excel Spreadsheet (.xlsx)
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </CardContent>
                    </Card>

                    {/* Summary */}
                    <Card className="dash-panel !p-0 border-0">
                        <CardHeader>
                            <CardTitle className="text-base font-bold text-foreground">Ringkasan Laporan</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex justify-between text-sm py-1 border-b border-border/40">
                                <span className="text-muted-foreground">Jenis:</span>
                                <span className="font-semibold text-foreground capitalize">{reportType}</span>
                            </div>
                            <div className="flex justify-between text-sm py-1 border-b border-border/40">
                                <span className="text-muted-foreground">Site:</span>
                                <span className="font-semibold text-foreground">
                                    {selectedSites.length === 0 ? 'Semua Cabang' : `${selectedSites.length} site`}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm py-1 border-b border-border/40">
                                <span className="text-muted-foreground">Periode:</span>
                                <span className="font-semibold text-foreground">
                                    {format(dateFrom, 'dd/MM')} - {format(dateTo, 'dd/MM/yyyy')}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm py-1 border-b border-border/40">
                                <span className="text-muted-foreground">Bagian:</span>
                                <span className="font-semibold text-foreground">{selectedSections.length} bagian dipilih</span>
                            </div>
                            <div className="flex justify-between text-sm pt-1">
                                <span className="text-muted-foreground">Format:</span>
                                <span className="font-bold text-primary uppercase">{exportFormat}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Generate Button */}
                    <Button
                        variant="primary"
                        size="lg"
                        className="w-full"
                        onClick={handleGenerateReport}
                        disabled={isGenerating || selectedSections.length === 0}
                        loading={isGenerating}
                    >
                        {isGenerating ? 'Memproses Laporan...' : <><Download aria-hidden="true" />Generate & Download Laporan</>}
                    </Button>

                    {selectedSections.length === 0 && (
                        <p className="text-xs text-red-500 text-center font-medium">
                            Pilih minimal satu bagian laporan untuk melanjutkan
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ManagerReportsPage;
