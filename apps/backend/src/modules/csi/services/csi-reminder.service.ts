import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Repository } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { Notification, NotificationType } from '../../notifications/entities/notification.entity';
import { NotificationService } from '../../notifications/notification.service';
import { CsiPeriodPublishStatus, CsiRespondentMode } from '../csi.constants';
import { CsiPeriodRater } from '../entities/csi-period-rater.entity';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiResponse } from '../entities/csi-response.entity';
import { computeStatus } from './csi-period.service';
import { assertPeriodInScope } from './csi-scope.util';

/** Same window NotificationService.create uses to drop a repeat (userId + type + referenceId). */
export const CSI_REMINDER_DEDUP_MS = 24 * 60 * 60 * 1000;
/** createdAt comes from the DB clock; tolerate this much app/DB drift before calling a returned row "older". */
const CLOCK_SKEW_MS = 30_000;
const REMINDER_TITLE = 'Pengingat survei CSI';
const LISTED_ONLY_MESSAGE = 'Pengingat hanya untuk survei dengan penilai terpilih';
const NOT_PUBLISHED_MESSAGE = 'Pengingat hanya untuk survei yang sudah dipublikasikan';
const NOT_ACTIVE_MESSAGE = 'Pengingat hanya untuk survei yang sedang berjalan';
const NOT_RATER_MESSAGE = 'Pengguna bukan penilai survei ini';
const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export type CsiReminderResult = { sent: number; skipped: number };

/** 'YYYY-MM-DD' -> 'd MMM yyyy' with Indonesian short months (e.g. '31 Okt 2026'). */
export function formatReminderDate(date: string): string {
    const [year, month, day] = date.split('-').map(Number);
    return `${day} ${MONTHS_ID[month - 1]} ${year}`;
}

export const reminderReferenceId = (periodId: string, userId: string) => `${periodId}:${userId}`;

/** In-app (+ Web Push) reminders for LISTED raters who have not answered; at most one per person per 24 hours. */
@Injectable()
export class CsiReminderService {
    constructor(
        @InjectRepository(CsiPeriod) private readonly periods: Repository<CsiPeriod>,
        @InjectRepository(CsiPeriodRater) private readonly periodRaters: Repository<CsiPeriodRater>,
        @InjectRepository(CsiResponse) private readonly responses: Repository<CsiResponse>,
        @InjectRepository(Notification) private readonly notificationRepo: Repository<Notification>,
        private readonly notifications: NotificationService,
    ) { }

    /** `userIds` empty/omitted = every rater who has not answered; given ids must be raters of the period. */
    async send(scope: ServiceScope, periodId: string, userIds?: string[], now: Date = new Date()): Promise<CsiReminderResult> {
        const period = assertPeriodInScope(await this.periods.findOne({ where: { id: periodId } }), scope);
        assertRemindable(period, now);
        const raterIds = (await this.periodRaters.find({ where: { periodId } })).map((rater) => rater.userId);
        const targets = userIds?.length ? [...new Set(userIds)] : raterIds;
        if (targets.some((id) => !raterIds.includes(id))) throw new BadRequestException(NOT_RATER_MESSAGE);
        if (!targets.length) return { sent: 0, skipped: 0 };
        const answered = new Set((await this.responses.find({ where: { periodId, respondentId: In(targets) } })).map((row) => row.respondentId));
        const reminded = await this.recentlyReminded(periodId, targets, now);
        let sent = 0;
        for (const userId of targets) {
            if (answered.has(userId) || reminded.has(userId)) continue;
            if (await this.notify(period, userId, now)) sent += 1;
        }
        return { sent, skipped: targets.length - sent };
    }

    /** Users with a reminder for this period inside the dedup window (the same rule NotificationService applies). */
    private async recentlyReminded(periodId: string, userIds: string[], now: Date): Promise<Set<string>> {
        const rows = await this.notificationRepo.find({
            where: {
                userId: In(userIds), type: NotificationType.CSI_REMINDER,
                referenceId: In(userIds.map((userId) => reminderReferenceId(periodId, userId))),
                createdAt: MoreThan(new Date(now.getTime() - CSI_REMINDER_DEDUP_MS)),
            },
            select: { userId: true, createdAt: true },
        });
        return new Set(rows.map((row) => row.userId));
    }

    /**
     * True when a new notification was stored. The pre-check already filters reminded users, so create() only
     * deduplicates on a race; it then hands back the existing row, created before this call started.
     */
    private async notify(period: CsiPeriod, userId: string, startedAt: Date): Promise<boolean> {
        const notification = await this.notifications.create({
            userId, type: NotificationType.CSI_REMINDER, title: REMINDER_TITLE,
            message: `Mohon isi "${period.title}" sebelum ${formatReminderDate(period.endDate)}.`,
            referenceId: reminderReferenceId(period.id, userId), link: `/csi/${period.id}`,
        });
        return Boolean(notification) && new Date(notification.createdAt).getTime() >= startedAt.getTime() - CLOCK_SKEW_MS;
    }
}

function assertRemindable(period: CsiPeriod, now: Date) {
    if (period.respondentMode !== CsiRespondentMode.LISTED) throw new BadRequestException(LISTED_ONLY_MESSAGE);
    if (period.publishStatus !== CsiPeriodPublishStatus.PUBLISHED) throw new BadRequestException(NOT_PUBLISHED_MESSAGE);
    if (computeStatus(period, now) !== 'ACTIVE') throw new BadRequestException(NOT_ACTIVE_MESSAGE);
}
