import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationPreference } from './entities/notification-preference.entity';
import { NotificationType } from './entities/notification.entity';
import { CacheService } from '../../shared/core/cache/cache.service';

export type PreferenceChannel = 'in_app' | 'email' | 'push';

/** Notices that must reach people whatever their settings say: they block work or report a breach. */
const ALWAYS_DELIVERED: ReadonlySet<string> = new Set([NotificationType.SLA_BREACHED]);
const CACHE_TTL_SECONDS = 60;

type GatePrefs = Pick<NotificationPreference,
    'inAppEnabled' | 'emailEnabled' | 'pushEnabled' | 'typeSettings' | 'quietHoursEnabled' | 'quietHoursStart' | 'quietHoursEnd' | 'timezone'>;

/**
 * One place that answers "may this notification go to this person over this channel now?" from their settings:
 * the global channel switch, the per-type switch, and quiet hours (push and email wait; in-app is silent anyway).
 * Critical notices (acknowledge required, SLA breach) always go through. No settings row = defaults (all on).
 */
@Injectable()
export class NotificationPreferenceGate {
    constructor(
        @InjectRepository(NotificationPreference)
        private readonly prefRepo: Repository<NotificationPreference>,
        @Optional() private readonly cache?: CacheService,
    ) { }

    async allows(userId: string, channel: PreferenceChannel, type: string, options: { critical?: boolean; at?: Date } = {}): Promise<boolean> {
        if (options.critical || ALWAYS_DELIVERED.has(type)) return true;
        const prefs = await this.load(userId);
        if (!prefs) return true;
        const globalOn = channel === 'in_app' ? prefs.inAppEnabled : channel === 'email' ? prefs.emailEnabled : prefs.pushEnabled;
        if (globalOn === false) return false;
        if (prefs.typeSettings?.[type]?.[channel] === false) return false;
        if (channel !== 'in_app' && isInQuietHours(prefs, options.at ?? new Date())) return false;
        return true;
    }

    /** Forget a user's cached settings after they change them. */
    async forget(userId: string): Promise<void> {
        await this.cache?.delAsync(cacheKey(userId));
    }

    private async load(userId: string): Promise<GatePrefs | null> {
        const read = () => this.prefRepo.findOne({ where: { userId } }) as Promise<GatePrefs | null>;
        if (!this.cache) return read();
        const cached = await this.cache.getAsync<GatePrefs | 'none'>(cacheKey(userId));
        if (cached) return cached === 'none' ? null : cached;
        const prefs = await read();
        await this.cache.setAsync(cacheKey(userId), prefs ?? 'none', CACHE_TTL_SECONDS);
        return prefs;
    }
}

const cacheKey = (userId: string) => `notif:prefs:${userId}`;

/** True when `at` falls in the user's quiet hours (overnight ranges such as 22:00-07:00 included). */
export function isInQuietHours(prefs: Pick<GatePrefs, 'quietHoursEnabled' | 'quietHoursStart' | 'quietHoursEnd' | 'timezone'>, at: Date): boolean {
    if (!prefs.quietHoursEnabled || !prefs.quietHoursStart || !prefs.quietHoursEnd) return false;
    const toMinutes = (hhmm: string) => {
        const [h, m] = hhmm.split(':').map(Number);
        return h * 60 + m;
    };
    let current: number;
    try {
        const parts = new Intl.DateTimeFormat('en-GB', { timeZone: prefs.timezone || 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }).format(at);
        current = toMinutes(parts) % (24 * 60);
    } catch {
        return false;
    }
    const start = toMinutes(prefs.quietHoursStart);
    const end = toMinutes(prefs.quietHoursEnd);
    return start > end ? current >= start || current < end : current >= start && current < end;
}
