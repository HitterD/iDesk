import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { Ticket, TicketStatus } from '../entities/ticket.entity';
import { TicketMessage } from '../entities/ticket-message.entity';
import { TicketReminder } from '../entities/ticket-reminder.entity';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { EventsGateway } from '../presentation/gateways/events.gateway';
import { CacheInvalidationService } from '../../../shared/core/cache';
import { validateTicketAccess } from '../utils/oracle-ticket-access.util';
import { validateTicketSiteAccess } from '../utils/site-access.util';
import { systemEvent } from '../utils/ticket-activity.util';

const WIB = 'Asia/Jakarta';
const WIB_OFFSET_HOURS = 7;
const DEFAULT_VISIT_WEEKDAY = 4; // Thursday, the vendors' usual visit day
const DEFAULT_VISIT_HOUR_WIB = 9;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_VISIT_DAYS_AHEAD = 90;
/** The PIC is reminded this long before the appointment (through the ticket reminder scheduler). */
export const VENDOR_VISIT_REMIND_BEFORE_MS = 30 * 60 * 1000;

const WIB_VISIT_FMT = new Intl.DateTimeFormat('id-ID', {
    timeZone: WIB, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export const formatVendorVisit = (date: Date): string => `${WIB_VISIT_FMT.format(date)} WIB`;

/** Trimmed vendor note, or null when empty. */
export const normalizeVendorNote = (note?: string | null): string | null => note?.trim() || null;

/** Next Thursday 09:00 WIB (never today), computed in WIB whatever the server's own timezone is. */
export function defaultVendorVisit(now: Date = new Date()): Date {
    const wibNow = new Date(now.getTime() + WIB_OFFSET_HOURS * 60 * 60 * 1000);
    const daysAhead = ((DEFAULT_VISIT_WEEKDAY - wibNow.getUTCDay() + 7) % 7) || 7;
    return new Date(Date.UTC(
        wibNow.getUTCFullYear(), wibNow.getUTCMonth(), wibNow.getUTCDate() + daysAhead,
        DEFAULT_VISIT_HOUR_WIB - WIB_OFFSET_HOURS, 0, 0, 0,
    ));
}

/**
 * The vendor appointment of a WAITING_VENDOR ticket: when the vendor is expected, plus the PIC reminder
 * that goes with it. The reminder is an ordinary ticket reminder, so the existing scheduler emails the PIC
 * and logs it on the ticket; its id is kept on the ticket so a reschedule or a status change can cancel it.
 */
@Injectable()
export class TicketVendorVisitService {
    constructor(
        @InjectDataSource() private readonly dataSource: DataSource,
        private readonly eventsGateway: EventsGateway,
        private readonly cacheInvalidationService: CacheInvalidationService,
    ) {}

    /** Parses and bounds a requested appointment; undefined falls back to the default visit day. */
    resolveVisit(requested?: string | Date | null, now: Date = new Date()): Date {
        if (!requested) return defaultVendorVisit(now);
        const visitAt = new Date(requested);
        if (Number.isNaN(visitAt.getTime())) throw new BadRequestException('Jadwal kunjungan vendor tidak valid');
        if (visitAt.getTime() <= now.getTime()) throw new BadRequestException('Jadwal kunjungan vendor harus di masa mendatang');
        if (visitAt.getTime() > now.getTime() + MAX_VISIT_DAYS_AHEAD * DAY_MS) {
            throw new BadRequestException(`Jadwal kunjungan vendor maksimal ${MAX_VISIT_DAYS_AHEAD} hari ke depan`);
        }
        return visitAt;
    }

    /** Sets the appointment on a ticket the caller saves in the same transaction. */
    async schedule(manager: EntityManager, ticket: Ticket, visitAt: Date, actorId: string): Promise<void> {
        await this.cancelReminder(manager, ticket);
        ticket.vendorVisitAt = visitAt;
        ticket.vendorVisitReminderId = null;
        const remindAt = new Date(visitAt.getTime() - VENDOR_VISIT_REMIND_BEFORE_MS);
        if (remindAt.getTime() <= Date.now()) return;
        const reminder = await manager.save(TicketReminder, manager.create(TicketReminder, {
            ticketId: ticket.id,
            remindAt,
            note: `Janji kunjungan vendor: ${formatVendorVisit(visitAt)}`,
            createdById: actorId,
            isSent: false,
        }));
        ticket.vendorVisitReminderId = reminder.id;
    }

    /** Leaving WAITING_VENDOR: the appointment and its pending reminder no longer apply. */
    async clear(manager: EntityManager, ticket: Ticket): Promise<void> {
        await this.cancelReminder(manager, ticket);
        ticket.vendorVisitAt = null;
        ticket.vendorVisitReminderId = null;
    }

    /** System note posted when the ticket starts waiting, or when the appointment moves. */
    note(visitAt: Date, actorName: string, rescheduled = false, vendorNote?: string | null): string {
        return [
            rescheduled ? '📆 Jadwal kunjungan vendor diubah' : '⏳ Status tiket diubah ke Waiting Vendor',
            '',
            ...(vendorNote ? [`📝 Keterangan: ${vendorNote}`] : []),
            `📅 Janji vendor: ${formatVendorVisit(visitAt)}`,
            '🔔 PIC diingatkan 30 menit sebelumnya.',
            `👤 Oleh: ${actorName}`,
            ...(rescheduled ? [] : ['', 'SLA dijeda selama menunggu vendor.']),
        ].join('\n');
    }

    /** PATCH /tickets/:id/vendor-visit: move the appointment of a ticket that is waiting on a vendor. */
    async reschedule(ticketId: string, requested: string, actorId: string, vendorNote?: string): Promise<Ticket> {
        const { ticket, message } = await this.dataSource.transaction(async (manager) => {
            const ticket = await manager.findOne(Ticket, { where: { id: ticketId }, relations: ['participants'] });
            if (!ticket) throw new NotFoundException('Ticket not found');
            const actor = await manager.findOne(User, { where: { id: actorId } });
            if (!actor) throw new NotFoundException('User not found');
            validateTicketAccess(actor, ticket);
            const isParticipant = ticket.participants?.some((p) => p.userId === actorId);
            if (ticket.userId !== actorId && !isParticipant) {
                validateTicketSiteAccess(actor.role as UserRole, (actor as any).siteId ?? null, (ticket as any).siteId ?? null);
            }
            if (ticket.status !== TicketStatus.WAITING_VENDOR) {
                throw new BadRequestException('Jadwal vendor hanya bisa diubah saat tiket berstatus Waiting Vendor');
            }
            const visitAt = this.resolveVisit(requested);
            const previous = ticket.vendorVisitAt ? new Date(ticket.vendorVisitAt).toISOString() : null;
            const previousNote = ticket.vendorNote ?? null;
            await this.schedule(manager, ticket, visitAt, actorId);
            // Omitted note keeps the current one; an empty string is not a valid note.
            if (vendorNote !== undefined) ticket.vendorNote = normalizeVendorNote(vendorNote) ?? previousNote;
            const saved = await manager.save(Ticket, ticket);
            const message = await manager.save(TicketMessage, manager.create(TicketMessage, {
                content: this.note(visitAt, actor.fullName, true, saved.vendorNote),
                ticket: saved,
                senderId: actorId,
                isSystemMessage: true,
                systemEvent: systemEvent(actor, [
                    { field: 'vendorVisit', from: previous, to: visitAt.toISOString() },
                    ...(previousNote !== saved.vendorNote ? [{ field: 'vendorNote' as const, from: previousNote, to: saved.vendorNote }] : []),
                ]),
            }));
            return { ticket: saved, message };
        });

        await this.cacheInvalidationService.onTicketChange(ticket.id);
        this.eventsGateway.notifyNewMessage(ticket.id, message);
        this.eventsGateway.notifyTicketUpdate(ticket.id, { vendorVisitAt: ticket.vendorVisitAt, vendorNote: ticket.vendorNote }, (ticket as any).siteId ?? null);
        return ticket;
    }

    private async cancelReminder(manager: EntityManager, ticket: Ticket): Promise<void> {
        if (ticket.vendorVisitReminderId) {
            await manager.delete(TicketReminder, { id: ticket.vendorVisitReminderId, isSent: false });
        }
    }
}
