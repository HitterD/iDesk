import React from 'react';
import { Wifi, ShieldCheck, Mail, Printer, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface QuickTopicItem {
    id: string;
    title: string;
    subtitle: string;
    category: string;
    searchKeyword?: string;
    icon: React.ElementType;
    colorClasses: {
        badge: string;
        glow: string;
        border: string;
        iconBg: string;
        iconColor: string;
    };
    popularGuides: string[];
}

const TOPIC_ITEMS: QuickTopicItem[] = [
    {
        id: 'vpn-network',
        title: 'VPN & Jaringan',
        subtitle: 'WatchGuard VPN, koneksi WiFi kantor, & shared drive server.',
        category: 'Network',
        searchKeyword: 'VPN',
        icon: Wifi,
        colorClasses: {
            badge: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20',
            glow: 'from-cyan-500/10 to-transparent',
            border: 'hover:border-cyan-500/40',
            iconBg: 'bg-cyan-500/10 border-cyan-500/20',
            iconColor: 'text-cyan-600 dark:text-cyan-300',
        },
        popularGuides: ['WatchGuard Mobile VPN', 'Folder Shared Network'],
    },
    {
        id: 'password-access',
        title: 'Akun & Keamanan',
        subtitle: 'Reset password domain, otentikasi, & permohonan hak akses.',
        category: 'Security',
        searchKeyword: 'Password',
        icon: ShieldCheck,
        colorClasses: {
            badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
            glow: 'from-amber-500/10 to-transparent',
            border: 'hover:border-amber-500/40',
            iconBg: 'bg-amber-500/10 border-amber-500/20',
            iconColor: 'text-amber-600 dark:text-amber-300',
        },
        popularGuides: ['Reset Password Portal', 'Pengajuan E-Form Hak Akses'],
    },
    {
        id: 'email-software',
        title: 'Email & Aplikasi',
        subtitle: 'Konfigurasi Outlook, Microsoft 365, Teams, & Oracle K2.',
        category: 'Email',
        searchKeyword: 'Email',
        icon: Mail,
        colorClasses: {
            badge: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20',
            glow: 'from-sky-500/10 to-transparent',
            border: 'hover:border-sky-500/40',
            iconBg: 'bg-sky-500/10 border-sky-500/20',
            iconColor: 'text-sky-600 dark:text-sky-300',
        },
        popularGuides: ['Setup Outlook Mobile/PC', 'Akses Modul Oracle K2'],
    },
    {
        id: 'hardware-printer',
        title: 'Hardware & Printer',
        subtitle: 'Instalasi printer, troubleshooting scanner, & permohonan aset.',
        category: 'Hardware',
        searchKeyword: 'Printer',
        icon: Printer,
        colorClasses: {
            badge: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
            glow: 'from-blue-500/10 to-transparent',
            border: 'hover:border-blue-500/40',
            iconBg: 'bg-blue-500/10 border-blue-500/20',
            iconColor: 'text-blue-600 dark:text-blue-300',
        },
        popularGuides: ['Setting Koneksi Printer LAN', 'Pengajuan Hardware Baru'],
    },
];

interface QuickTopicBentoProps {
    onSelectTopic: (category: string, searchKeyword?: string) => void;
    activeCategory: string;
}

export const QuickTopicBento: React.FC<QuickTopicBentoProps> = ({
    onSelectTopic,
    activeCategory,
}) => {
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Topik Populer & Solusi Mandiri
                    </h2>
                </div>
                <span className="text-[11px] text-muted-foreground hidden sm:inline">
                    Pilih topik untuk filter instan
                </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {TOPIC_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isSelected = activeCategory.toLowerCase() === item.category.toLowerCase();

                    return (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => onSelectTopic(item.category, item.searchKeyword)}
                            className={cn(
                                'group relative flex flex-col justify-between p-4 sm:p-5 rounded-[1.25rem] text-left',
                                'bg-card border transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
                                'shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98]',
                                'overflow-hidden cursor-pointer',
                                isSelected
                                    ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                                    : cn('border-border/80', item.colorClasses.border),
                            )}
                        >
                            {/* Ambient Glow */}
                            <div
                                className={cn(
                                    'pointer-events-none absolute -top-10 -right-10 h-24 w-24 rounded-full blur-xl opacity-40 transition-opacity duration-300 group-hover:opacity-100 bg-gradient-to-br',
                                    item.colorClasses.glow,
                                )}
                                aria-hidden="true"
                            />

                            <div className="relative z-10 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div
                                        className={cn(
                                            'w-9 h-9 rounded-xl flex items-center justify-center border transition-transform duration-300 group-hover:scale-110',
                                            item.colorClasses.iconBg,
                                        )}
                                    >
                                        <Icon className={cn('w-4 h-4', item.colorClasses.iconColor)} strokeWidth={1.75} />
                                    </div>

                                    <ArrowRight
                                        className="w-3.5 h-3.5 text-muted-foreground/50 transition-all duration-300 group-hover:text-primary group-hover:translate-x-0.5"
                                        strokeWidth={2}
                                    />
                                </div>

                                <div>
                                    <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                                        {item.title}
                                    </h3>
                                    <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                                        {item.subtitle}
                                    </p>
                                </div>
                            </div>

                            {/* Popular Guides Snippets */}
                            <div className="relative z-10 mt-3 pt-2.5 border-t border-border/50 flex flex-wrap gap-1">
                                {item.popularGuides.map((guide, idx) => (
                                    <span
                                        key={idx}
                                        className="inline-block text-[10px] font-medium text-muted-foreground/90 bg-muted/60 px-1.5 py-0.5 rounded-md truncate max-w-full"
                                    >
                                        • {guide}
                                    </span>
                                ))}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default QuickTopicBento;
