import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { ModernDatePicker } from '@/components/ui/ModernDatePicker';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { toast } from 'sonner';
import api from '@/lib/api';

type ReportType = 'consolidated' | 'per-site' | 'comparison' | 'custom';
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
            const response = await api.post('/manager/reports/generate', {
                reportType,
                siteIds: selectedSites,
                dateFrom: format(dateFrom, 'yyyy-MM-dd'),
                dateTo: format(dateTo, 'yyyy-MM-dd'),
                sections: selectedSections,
                format: exportFormat,
            }, {
                responseType: 'blob',
            });

            // Download the file
            const blob = new Blob([response.data], {
                type: exportFormat === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `report-${format(new Date(), 'yyyy-MM-dd')}.${exportFormat === 'pdf' ? 'pdf' : 'xlsx'}`;
            link.click();
            window.URL.revokeObjectURL(url);

            toast.success('Laporan berhasil di-generate!');
        } catch (error) {
            console.error('Failed to generate report:', error);
            toast.error('Gagal generate laporan. Silakan coba lagi.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <FileText className="w-6 h-6 text-primary" />
                        </div>
                        Manager Reports
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Generate laporan kinerja site dan agent
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
                {/* Left Column - Report Configuration */}
                <div className="col-span-2 space-y-6">
                    {/* Report Type */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <PieChart className="w-5 h-5" />
                                Jenis Laporan
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-4 gap-3">
                                {[
                                    { value: 'consolidated', label: 'Consolidated', desc: 'Gabungan semua site' },
                                    { value: 'per-site', label: 'Per Site', desc: 'Detail per lokasi' },
                                    { value: 'comparison', label: 'Comparison', desc: 'Perbandingan antar site' },
                                    { value: 'custom', label: 'Custom', desc: 'Pilih manual' },
                                ].map((type) => (
                                    <button
                                        key={type.value}
                                        onClick={() => setReportType(type.value as ReportType)}
                                        className={`p-4 rounded-xl border-2 transition-colors duration-150 text-left ${reportType === type.value
                                            ? 'border-primary bg-primary/5'
                                            : 'border-slate-200 dark:border-slate-700 hover:border-primary/50'
                                            }`}
                                    >
                                        <div className="font-semibold text-sm">{type.label}</div>
                                        <div className="text-xs text-muted-foreground mt-1">{type.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Site Selection */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Building2 className="w-5 h-5" />
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
                                <p className="text-sm text-muted-foreground mt-2">
                                    Tidak memilih site = semua site akan di-include
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Date Range */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Calendar className="w-5 h-5" />
                                Periode Laporan
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
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
                                    >
                                        {preset.label}
                                    </Button>
                                ))}
                            </div>

                            {datePreset === 'custom' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Dari Tanggal</Label>
                                        <ModernDatePicker
                                            value={dateFrom}
                                            onChange={(date) => setDateFrom(date)}
                                            placeholder="Pilih tanggal mulai"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Sampai Tanggal</Label>
                                        <ModernDatePicker
                                            value={dateTo}
                                            onChange={(date) => setDateTo(date)}
                                            placeholder="Pilih tanggal akhir"
                                        />
                                    </div>
                                </div>
                            )}

                            <p className="text-sm text-muted-foreground">
                                Periode: {format(dateFrom, 'dd MMM yyyy')} - {format(dateTo, 'dd MMM yyyy')}
                            </p>
                        </CardContent>
                    </Card>

                    {/* Report Sections */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <BarChart3 className="w-5 h-5" />
                                Bagian Laporan
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-3">
                                {REPORT_SECTIONS.map((section) => (
                                    <label
                                        key={section.id}
                                        className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-[opacity,transform,colors] duration-200 ease-out ${selectedSections.includes(section.id)
                                            ? 'border-primary bg-primary/5'
                                            : 'border-slate-200 dark:border-slate-700 hover:border-primary/50'
                                            }`}
                                    >
                                        <Checkbox
                                            checked={selectedSections.includes(section.id)}
                                            onCheckedChange={() => toggleSection(section.id)}
                                        />
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 font-semibold">
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
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Download className="w-5 h-5" />
                                Format Export
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Select value={exportFormat} onValueChange={(val) => setExportFormat(val as ExportFormat)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pdf">
                                        <div className="flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-red-500" />
                                            PDF Document
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="excel">
                                        <div className="flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-green-500" />
                                            Excel Spreadsheet
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </CardContent>
                    </Card>

                    {/* Summary */}
                    <Card className="bg-slate-50 dark:bg-slate-800/50">
                        <CardHeader>
                            <CardTitle className="text-lg">Ringkasan Laporan</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Jenis:</span>
                                <span className="font-medium capitalize">{reportType}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Site:</span>
                                <span className="font-medium">
                                    {selectedSites.length === 0 ? 'Semua' : `${selectedSites.length} site`}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Periode:</span>
                                <span className="font-medium">
                                    {format(dateFrom, 'dd/MM')} - {format(dateTo, 'dd/MM/yyyy')}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Bagian:</span>
                                <span className="font-medium">{selectedSections.length} dipilih</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Format:</span>
                                <span className="font-medium uppercase">{exportFormat}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Generate Button */}
                    <Button
                        className="w-full h-14 text-lg"
                        onClick={handleGenerateReport}
                        disabled={isGenerating || selectedSections.length === 0}
                    >
                        {isGenerating ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Download className="w-5 h-5 mr-2" />
                                Generate Report
                            </>
                        )}
                    </Button>

                    {selectedSections.length === 0 && (
                        <p className="text-sm text-red-500 text-center">
                            Pilih minimal satu bagian laporan
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ManagerReportsPage;
