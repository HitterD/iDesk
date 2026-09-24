import React, { useState, useEffect } from 'react';
import { 
    Terminal, 
    Send, 
    Check, 
    Copy, 
    Download, 
    Radio, 
    Sparkles, 
    ExternalLink, 
    Layers, 
    FileText, 
    AlertCircle, 
    Laptop, 
    CheckCircle2, 
    RefreshCw,
    Code2,
    Sliders
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type DisplayMode = 'both' | 'toast' | 'popup';
type PriorityLevel = 'normal' | 'high' | 'urgent';

interface PresetTemplate {
    id: string;
    label: string;
    app: string;
    from: string;
    to: string;
    subject: string;
    title: string;
    message: string;
    priority: PriorityLevel;
    display: DisplayMode;
    url: string;
    attachments: Array<{ name: string; size: string; url: string }>;
}

const PRESET_TEMPLATES: PresetTemplate[] = [
    {
        id: 'whatsapp_style',
        label: '💬 Chat Mas Yudi (WhatsApp Style)',
        app: 'iDesk Support',
        from: 'Mas Yudi Yudi - ICT SPJ',
        to: 'Tim IT Support',
        subject: 'Permintaan Bantuan Printer',
        title: 'Mas Yudi Yudi - ICT SPJ',
        message: 'hai, mohon bantuannya untuk perbaikan printer SPJ lantai 2 yaa.',
        priority: 'normal',
        display: 'both',
        url: 'https://idesk.santos.co.id/tickets/1042',
        attachments: []
    },
    {
        id: 'pat_email',
        label: '📋 Form Tambahan PAT 2026 (Popup Display)',
        app: 'Web Kertas Kerja',
        from: 'Yudi Arta Trirensila - ICT SPJ',
        to: 'Lia Lestari.Users; Febiola Kartika.Users',
        subject: 'tambahan PAT 2026',
        title: 'Pengajuan Tambahan Item PAT 2026',
        message: 'Dear bu lia dan bu ola,\n\nBerikut saya tambahkan list untuk yg akan dilakukan PAT. Mohon reviewnya ya bu.\n\nTerima kasih,\nArta',
        priority: 'high',
        display: 'popup',
        url: 'https://idesk.santos.co.id/pat/2026',
        attachments: [
            { name: 'tambahan.xlsx', size: '142 KB', url: 'https://idesk.santos.co.id/files/tambahan.xlsx' }
        ]
    },
    {
        id: 'erp_po',
        label: '⚡ Approval PO Santos ERP (Urgent)',
        app: 'Santos ERP',
        from: 'Sistem Pengadaan ERP',
        to: 'Manager Operational',
        subject: 'Approval PO #2026-8891',
        title: 'PO #2026-8891 Menunggu Otorisasi',
        message: 'Purchase Order suku cadang mesin roaster pabrik telah di-submit. Membutuhkan persetujuan segera sebelum pukul 16:00 WIB.',
        priority: 'urgent',
        display: 'both',
        url: 'https://erp.santos.co.id/po/2026-8891',
        attachments: [
            { name: 'rincian_po_roaster.pdf', size: '890 KB', url: 'https://erp.santos.co.id/docs/po.pdf' }
        ]
    }
];

export const WebhookIntegrationHub: React.FC = () => {
    // Health status of desktop app
    const [isLocalActive, setIsLocalActive] = useState<boolean | null>(null);
    const [localHealthData, setLocalHealthData] = useState<any>(null);
    const [isCheckingHealth, setIsCheckingHealth] = useState(false);

    // Form state
    const [selectedTemplate, setSelectedTemplate] = useState<string>('whatsapp_style');
    const [app, setApp] = useState('iDesk Support');
    const [from, setFrom] = useState('Mas Yudi Yudi - ICT SPJ');
    const [to, setTo] = useState('Tim IT Support');
    const [subject, setSubject] = useState('Permintaan Bantuan Printer');
    const [title, setTitle] = useState('Mas Yudi Yudi - ICT SPJ');
    const [message, setMessage] = useState('hai, mohon bantuannya untuk perbaikan printer SPJ lantai 2 yaa.');
    const [priority, setPriority] = useState<PriorityLevel>('normal');
    const [display, setDisplay] = useState<DisplayMode>('both');
    const [targetUrl, setTargetUrl] = useState('https://idesk.santos.co.id/tickets/1042');
    const [hasAttachment, setHasAttachment] = useState(false);

    // Code generator language
    const [codeLang, setCodeLang] = useState<'fetch' | 'curl' | 'php' | 'csharp' | 'python'>('fetch');
    const [copied, setCopied] = useState(false);
    const [isSending, setIsSending] = useState(false);

    const downloadUrl = `${import.meta.env.VITE_API_URL || ''}/v1/notifications/desktop-app/download`;

    const checkLocalStatus = async () => {
        setIsCheckingHealth(true);
        try {
            const res = await fetch('http://127.0.0.1:19876/health', {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                signal: AbortSignal.timeout(2000)
            });
            if (res.ok) {
                const data = await res.json();
                setIsLocalActive(true);
                setLocalHealthData(data);
                toast.success('SJA Notifier terhubung di PC Anda', {
                    description: `Port: 19876 • Versi: ${data.version || '1.0.0'}`
                });
            } else {
                setIsLocalActive(false);
            }
        } catch {
            setIsLocalActive(false);
        } finally {
            setIsCheckingHealth(false);
        }
    };

    useEffect(() => {
        checkLocalStatus();
    }, []);

    const applyTemplate = (tpl: PresetTemplate) => {
        setSelectedTemplate(tpl.id);
        setApp(tpl.app);
        setFrom(tpl.from);
        setTo(tpl.to);
        setSubject(tpl.subject);
        setTitle(tpl.title);
        setMessage(tpl.message);
        setPriority(tpl.priority);
        setDisplay(tpl.display);
        setTargetUrl(tpl.url);
        setHasAttachment(tpl.attachments.length > 0);
    };

    // Construct Payload
    const currentPayload = {
        app,
        title,
        message,
        url: targetUrl,
        priority,
        display,
        metadata: {
            from,
            to,
            subject,
            category: app
        },
        attachments: hasAttachment ? [
            { name: 'tambahan.xlsx', size: '142 KB', url: targetUrl }
        ] : []
    };

    const handleSendTestWebhook = async () => {
        setIsSending(true);
        try {
            const res = await fetch('http://127.0.0.1:19876/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentPayload),
                signal: AbortSignal.timeout(4000)
            });

            if (res.ok) {
                setIsLocalActive(true);
                toast.success('Notifikasi Berhasil Dikirim ke Desktop!', {
                    description: display === 'both' 
                        ? 'Toast WhatsApp & Popup Display Window sedang tampil di layar Anda.' 
                        : display === 'popup' 
                        ? 'Jendela Popup Display Window sedang tampil di layar Anda.' 
                        : 'Toast WhatsApp sedang tampil di pojok kanan bawah desktop Anda.'
                });
            } else {
                throw new Error(`HTTP ${res.status}`);
            }
        } catch {
            setIsLocalActive(false);
            toast.error('Gagal mengirim ke SJA Notifier', {
                description: 'Pastikan aplikasi SJA Notifier sudah berjalan di Windows tray Anda.'
            });
        } finally {
            setIsSending(false);
        }
    };

    const getGeneratedCode = () => {
        const jsonStr = JSON.stringify(currentPayload, null, 2);

        switch (codeLang) {
            case 'curl':
                return `curl -X POST "http://127.0.0.1:19876/notify" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(currentPayload)}'`;

            case 'php':
                return `<?php
$payload = ${varExport(currentPayload)};

$ch = curl_init('http://127.0.0.1:19876/notify');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));

$response = curl_exec($ch);
curl_close($ch);
echo $response;
?>`;

            case 'csharp':
                return `using System.Net.Http;
using System.Text;
using System.Text.Json;

var client = new HttpClient();
var payload = ${jsonStr};

var content = new StringContent(
    JsonSerializer.Serialize(payload),
    Encoding.UTF8,
    "application/json"
);

var response = await client.PostAsync("http://127.0.0.1:19876/notify", content);
Console.WriteLine(await response.Content.ReadAsStringAsync());`;

            case 'python':
                return `import requests

payload = ${JSON.stringify(currentPayload, null, 4)}

response = requests.post(
    "http://127.0.0.1:19876/notify",
    json=payload,
    timeout=5
)
print(response.json())`;

            case 'fetch':
            default:
                return `// JavaScript (Web Browser / Node.js):
await fetch('http://127.0.0.1:19876/notify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(${jsonStr})
});`;
        }
    };

    const varExport = (obj: any): string => {
        return JSON.stringify(obj, null, 2)
            .replace(/{/g, '[')
            .replace(/}/g, ']')
            .replace(/:/g, ' =>');
    };

    const handleCopyCode = () => {
        navigator.clipboard.writeText(getGeneratedCode());
        setCopied(true);
        toast.success('Kode integrasi berhasil disalin ke clipboard');
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* 1. Header Banner */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border border-blue-900/50 p-6 text-white shadow-xl">
                <div className="pointer-events-none absolute -right-8 -top-8 h-48 w-48 rounded-full bg-blue-600/20 blur-3xl" />
                
                <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-300 border border-blue-400/30">
                                <Sparkles className="h-3.5 w-3.5" /> SJA Desktop Suite
                            </span>
                            <span className="text-xs text-slate-400">Port 19876</span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                            Desktop Notifier & Webhook Integration Hub
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                            Pusat konfigurasi dan integrasi notifikasi desktop Windows native (WhatsApp Toast & Modern Popup Display). 
                            Kirim notifikasi instan dari web portal internal Santos (ERP, Kertas Kerja, Intranet) langsung ke layar komputer staf.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={checkLocalStatus}
                            disabled={isCheckingHealth}
                            className="bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700 text-xs h-10 px-3.5"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 mr-2 ${isCheckingHealth ? 'animate-spin' : ''}`} />
                            Cek Koneksi Notifier
                        </Button>

                        <a
                            href={downloadUrl}
                            download="SJANotifier-Setup.zip"
                            className="inline-flex items-center justify-center font-medium rounded-xl text-xs h-10 px-4 bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
                        >
                            <Download className="h-4 w-4 mr-2" />
                            Unduh Installer (.zip)
                        </a>
                    </div>
                </div>

                {/* Status Bar */}
                <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                        <span className="text-slate-400">Status Notifier di Komputer Ini:</span>
                        {isLocalActive === true ? (
                            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-400">
                                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
                                🟢 Terhubung (Port 19876 Aktif)
                            </span>
                        ) : isLocalActive === false ? (
                            <span className="font-semibold text-amber-400 flex items-center gap-1">
                                ⚪ Belum Aktif di Komputer Ini
                            </span>
                        ) : (
                            <span className="text-slate-400">Memeriksa...</span>
                        )}
                    </div>

                    <div className="flex items-center gap-3 text-slate-400">
                        <span>Model Display: <strong>Toast WhatsApp & Popup Modern</strong></span>
                        <span>•</span>
                        <span>CORS: <strong>Enabled (*)</strong></span>
                    </div>
                </div>
            </div>

            {/* 2. Interactive Webhook Playground & Live Tester */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left: Form Builder (7 cols) */}
                <div className="lg:col-span-7 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-5">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700/80">
                        <div className="flex items-center gap-2">
                            <Sliders className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                                Webhook Payload Builder & Tester
                            </h3>
                        </div>
                        <span className="text-[11px] text-slate-400">Uji langsung ke desktop</span>
                    </div>

                    {/* Template Presets */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                            Pilih Template Preset:
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {PRESET_TEMPLATES.map((tpl) => (
                                <button
                                    key={tpl.id}
                                    type="button"
                                    onClick={() => applyTemplate(tpl)}
                                    className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                                        selectedTemplate === tpl.id
                                            ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold shadow-sm'
                                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                                    }`}
                                >
                                    {tpl.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Input Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1.5">
                            <label className="font-semibold text-slate-700 dark:text-slate-300">Nama Aplikasi (App):</label>
                            <input
                                type="text"
                                value={app}
                                onChange={(e) => setApp(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200"
                                placeholder="Santos ERP / iDesk"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="font-semibold text-slate-700 dark:text-slate-300">Pengirim (From):</label>
                            <input
                                type="text"
                                value={from}
                                onChange={(e) => setFrom(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200"
                                placeholder="Nama & Departemen"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="font-semibold text-slate-700 dark:text-slate-300">Penerima (To):</label>
                            <input
                                type="text"
                                value={to}
                                onChange={(e) => setTo(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200"
                                placeholder="Penerima / Tim"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="font-semibold text-slate-700 dark:text-slate-300">Subjek / Topik:</label>
                            <input
                                type="text"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200"
                                placeholder="Judul Topik"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="font-semibold text-slate-700 dark:text-slate-300">Model Tampilan (Display Mode):</label>
                            <select
                                value={display}
                                onChange={(e) => setDisplay(e.target.value as DisplayMode)}
                                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200 font-medium"
                            >
                                <option value="both">Both (Toast WhatsApp + Popup Display)</option>
                                <option value="toast">Toast Saja (Pojok Kanan Bawah)</option>
                                <option value="popup">Popup Saja (Jendela Display Tengah)</option>
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="font-semibold text-slate-700 dark:text-slate-300">Tingkat Prioritas (Priority):</label>
                            <select
                                value={priority}
                                onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200 font-medium"
                            >
                                <option value="normal">Normal (Informasi Biasa)</option>
                                <option value="high">High (Perlu Perhatian)</option>
                                <option value="urgent">Urgent (Alarm Kritis / Reminder)</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-1.5 text-xs">
                        <label className="font-semibold text-slate-700 dark:text-slate-300">Target URL (Redirect saat diklik):</label>
                        <input
                            type="text"
                            value={targetUrl}
                            onChange={(e) => setTargetUrl(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200"
                            placeholder="https://..."
                        />
                    </div>

                    <div className="space-y-1.5 text-xs">
                        <label className="font-semibold text-slate-700 dark:text-slate-300">Isi Pesan (Message Body):</label>
                        <textarea
                            rows={3}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 text-slate-800 dark:text-slate-200 leading-relaxed font-sans"
                            placeholder="Tulis pesan lengkap..."
                        />
                    </div>

                    <div className="flex items-center justify-between pt-2">
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                            <input
                                type="checkbox"
                                checked={hasAttachment}
                                onChange={(e) => setHasAttachment(e.target.checked)}
                                className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                            />
                            Sertakan Contoh Lampiran File (tambahan.xlsx)
                        </label>

                        <Button
                            onClick={handleSendTestWebhook}
                            disabled={isSending}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-10 px-5 rounded-xl shadow-md shadow-blue-500/20"
                        >
                            <Send className={`h-3.5 w-3.5 mr-2 ${isSending ? 'animate-spin' : ''}`} />
                            {isSending ? 'Mengirim...' : '🚀 Kirim ke SJA Notifier'}
                        </Button>
                    </div>
                </div>

                {/* Right: Code Generator (5 cols) */}
                <div className="lg:col-span-5 bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-sm flex flex-col justify-between text-slate-200">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                            <div className="flex items-center gap-2">
                                <Code2 className="h-4 w-4 text-blue-400" />
                                <h3 className="font-bold text-sm text-white">
                                    Snippet Integrasi Web
                                </h3>
                            </div>
                            <button
                                onClick={handleCopyCode}
                                className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                            >
                                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                                {copied ? 'Tersalin' : 'Salin'}
                            </button>
                        </div>

                        {/* Language Selector Pills */}
                        <div className="flex flex-wrap gap-1.5 text-[11px]">
                            {[
                                { key: 'fetch', label: 'JS Fetch' },
                                { key: 'curl', label: 'cURL' },
                                { key: 'php', label: 'PHP' },
                                { key: 'csharp', label: 'C# .NET' },
                                { key: 'python', label: 'Python' },
                            ].map((tab) => (
                                <button
                                    key={tab.key}
                                    onClick={() => setCodeLang(tab.key as any)}
                                    className={`px-2.5 py-1 rounded-lg transition-colors ${
                                        codeLang === tab.key
                                            ? 'bg-blue-600 text-white font-bold'
                                            : 'bg-slate-800 text-slate-400 hover:text-white'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Code Display */}
                        <div className="relative rounded-xl bg-slate-950 p-4 font-mono text-[11px] leading-relaxed text-slate-300 overflow-x-auto max-h-[340px] border border-slate-800/80">
                            <pre>{getGeneratedCode()}</pre>
                        </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                        <span>Endpoint: <code>POST /notify</code></span>
                        <span>CORS: <code>* (Allowed)</code></span>
                    </div>
                </div>
            </div>

            {/* 3. Specification Table */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-5 space-y-4">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    Spesifikasi Parameter Webhook (Payload JSON Reference)
                </h4>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="py-2.5 px-3">Field</th>
                                <th className="py-2.5 px-3">Tipe</th>
                                <th className="py-2.5 px-3">Wajib</th>
                                <th className="py-2.5 px-3">Keterangan</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                            <tr>
                                <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">app</td>
                                <td className="py-2.5 px-3 font-mono">string</td>
                                <td className="py-2.5 px-3">Ya</td>
                                <td className="py-2.5 px-3">Nama aplikasi pengirim (contoh: "Santos ERP", "Web Kertas Kerja", "iDesk").</td>
                            </tr>
                            <tr>
                                <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">title</td>
                                <td className="py-2.5 px-3 font-mono">string</td>
                                <td className="py-2.5 px-3">Ya</td>
                                <td className="py-2.5 px-3">Judul notifikasi atau nama pengirim yang tampil tebal (mirip WhatsApp).</td>
                            </tr>
                            <tr>
                                <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">message</td>
                                <td className="py-2.5 px-3 font-mono">string</td>
                                <td className="py-2.5 px-3">Ya</td>
                                <td className="py-2.5 px-3">Isi pesan atau ringkasan kendala/permohonan.</td>
                            </tr>
                            <tr>
                                <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">url</td>
                                <td className="py-2.5 px-3 font-mono">string</td>
                                <td className="py-2.5 px-3">Opsional</td>
                                <td className="py-2.5 px-3">Link web yang langsung dibuka browser saat notifikasi atau tombol aksi diklik.</td>
                            </tr>
                            <tr>
                                <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">display</td>
                                <td className="py-2.5 px-3 font-mono">string</td>
                                <td className="py-2.5 px-3">Opsional</td>
                                <td className="py-2.5 px-3">Pilihan tampilan: <code>"both"</code> (Toast + Popup), <code>"toast"</code>, atau <code>"popup"</code>.</td>
                            </tr>
                            <tr>
                                <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">priority</td>
                                <td className="py-2.5 px-3 font-mono">string</td>
                                <td className="py-2.5 px-3">Opsional</td>
                                <td className="py-2.5 px-3"><code>"normal"</code>, <code>"high"</code>, atau <code>"urgent"</code>.</td>
                            </tr>
                            <tr>
                                <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">metadata</td>
                                <td className="py-2.5 px-3 font-mono">object</td>
                                <td className="py-2.5 px-3">Opsional</td>
                                <td className="py-2.5 px-3">Objek berisi <code>from</code>, <code>to</code>, <code>subject</code>, <code>category</code> untuk tabel informasi di Jendela Popup Display.</td>
                            </tr>
                            <tr>
                                <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">attachments</td>
                                <td className="py-2.5 px-3 font-mono">array</td>
                                <td className="py-2.5 px-3">Opsional</td>
                                <td className="py-2.5 px-3">Array file lampiran <code>[ &#123; name, size, url &#125; ]</code> yang dapat diunduh langsung dari jendela popup.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default WebhookIntegrationHub;
