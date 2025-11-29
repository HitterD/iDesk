import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { MessageCircle, Link2, Copy, Check, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../../lib/api';

interface TelegramStatus {
    linked: boolean;
    telegramUsername?: string;
}

interface LinkCodeResponse {
    code: string;
    expiresIn: number;
    instruction: string;
}

export const TelegramSettingsForm: React.FC = () => {
    const [linkCode, setLinkCode] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [expiresAt, setExpiresAt] = useState<Date | null>(null);

    // Get Telegram link status
    const { data: status, isLoading, refetch } = useQuery<TelegramStatus>({
        queryKey: ['telegram-status'],
        queryFn: async () => {
            const response = await api.get('/telegram/status');
            return response.data;
        },
    });

    // Generate link code mutation
    const generateCodeMutation = useMutation({
        mutationFn: async () => {
            const response = await api.post('/telegram/generate-link-code');
            return response.data as LinkCodeResponse;
        },
        onSuccess: (data) => {
            setLinkCode(data.code);
            setExpiresAt(new Date(Date.now() + data.expiresIn * 1000));
            toast.success('Kode berhasil dibuat!');
        },
        onError: () => {
            toast.error('Gagal membuat kode');
        },
    });

    const handleCopyCode = () => {
        if (linkCode) {
            navigator.clipboard.writeText(linkCode);
            setCopied(true);
            toast.success('Kode disalin!');
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleGenerateCode = () => {
        generateCodeMutation.mutate();
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Status Card */}
            <div className={`p-6 rounded-2xl border-2 ${status?.linked
                    ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                    : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50'
                }`}>
                <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${status?.linked
                            ? 'bg-green-500 text-white'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                        }`}>
                        <MessageCircle className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">
                            {status?.linked ? 'Telegram Terhubung' : 'Telegram Belum Terhubung'}
                        </h3>
                        {status?.linked ? (
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                Terhubung dengan <span className="font-medium">@{status.telegramUsername}</span>
                            </p>
                        ) : (
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                Hubungkan akun Telegram untuk menerima notifikasi dan membuat tiket via bot
                            </p>
                        )}
                    </div>
                    <button
                        onClick={() => refetch()}
                        className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        title="Refresh status"
                    >
                        <RefreshCw className="w-4 h-4 text-slate-500" />
                    </button>
                </div>
            </div>

            {/* Link/Unlink Section */}
            {!status?.linked ? (
                <div className="space-y-4">
                    <h4 className="font-semibold text-slate-800 dark:text-white">Cara Menghubungkan:</h4>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600 dark:text-slate-400">
                        <li>Klik tombol "Generate Kode" di bawah</li>
                        <li>Buka bot <span className="font-medium text-primary">@iDeskSJA_BOT</span> di Telegram</li>
                        <li>Klik tombol "Saya punya kode" atau kirim <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">/link</code></li>
                        <li>Masukkan kode 6 digit yang muncul di bawah</li>
                    </ol>

                    {/* Generate Code Button */}
                    {!linkCode ? (
                        <button
                            onClick={handleGenerateCode}
                            disabled={generateCodeMutation.isPending}
                            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                            {generateCodeMutation.isPending ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Link2 className="w-5 h-5" />
                            )}
                            Generate Kode
                        </button>
                    ) : (
                        <div className="p-6 bg-primary/5 border-2 border-primary/20 rounded-2xl space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-600 dark:text-slate-400">Kode Link Anda:</span>
                                {expiresAt && (
                                    <span className="text-xs text-orange-600 dark:text-orange-400">
                                        Berlaku 5 menit
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex-1 text-center">
                                    <span className="text-4xl font-mono font-bold tracking-widest text-primary">
                                        {linkCode}
                                    </span>
                                </div>
                                <button
                                    onClick={handleCopyCode}
                                    className="p-3 rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors"
                                    title="Salin kode"
                                >
                                    {copied ? (
                                        <Check className="w-5 h-5" />
                                    ) : (
                                        <Copy className="w-5 h-5" />
                                    )}
                                </button>
                            </div>
                            <button
                                onClick={handleGenerateCode}
                                disabled={generateCodeMutation.isPending}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
                            >
                                <RefreshCw className={`w-4 h-4 ${generateCodeMutation.isPending ? 'animate-spin' : ''}`} />
                                Generate Kode Baru
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    <h4 className="font-semibold text-slate-800 dark:text-white">Fitur Tersedia:</h4>
                    <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                        <li className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-green-500" />
                            Terima notifikasi tiket via Telegram
                        </li>
                        <li className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-green-500" />
                            Buat tiket baru dari Telegram
                        </li>
                        <li className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-green-500" />
                            Lihat dan balas tiket dari Telegram
                        </li>
                    </ul>

                    <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                            Untuk memutuskan koneksi, kirim <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">/unlink</code> di bot Telegram.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};
