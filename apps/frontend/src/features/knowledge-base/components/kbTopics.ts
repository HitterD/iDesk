import { AppWindow, BookOpen, FileKey2, Mail, Monitor, Shield, Wifi } from 'lucide-react';
import type { ElementType } from 'react';

/** Mockup kb.html TOPICS: icon + hue per category; unknown categories fall back to General. */
interface TopicMeta { icon: ElementType; color: string }

const GENERAL: TopicMeta = { icon: BookOpen, color: 'var(--dash-brown)' };

export function topicMeta(category?: string): TopicMeta {
    const c = (category || '').toLowerCase();
    if (c.includes('net') || c.includes('wifi') || c.includes('vpn')) return { icon: Wifi, color: 'var(--dash-blue)' };
    if (c.includes('sec') || c.includes('pass') || c.includes('auth') || c.includes('akun')) return { icon: Shield, color: 'var(--dash-red)' };
    if (c.includes('mail') || c.includes('outlook')) return { icon: Mail, color: 'var(--dash-teal)' };
    if (c.includes('hard') || c.includes('print') || c.includes('device')) return { icon: Monitor, color: 'var(--dash-orange)' };
    if (c.includes('soft') || c.includes('app') || c.includes('office') || c.includes('oracle')) return { icon: AppWindow, color: 'var(--dash-navy)' };
    if (c.includes('form') || c.includes('access')) return { icon: FileKey2, color: 'var(--res-mint)' };
    return GENERAL;
}
