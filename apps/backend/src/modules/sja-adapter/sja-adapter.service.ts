import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Ticket } from '../ticketing/entities/ticket.entity';
import { signSjaRequest, SJA_APP_ID_ENV, SJA_APP_SECRET_ENV } from './sja-request-signer';

const SJA_DISPATCH_TIMEOUT_MS = 3_000;

@Injectable()
export class SjaAdapterService {
  private readonly logger = new Logger(SjaAdapterService.name);

  constructor(
    @Optional() @InjectQueue('sja-outbox') private readonly outboxQueue: Queue,
    private readonly configService: ConfigService,
    @Optional() private readonly dataSource?: DataSource,
  ) {}

  async dispatchNotification(notification: any) {
    let employeeId = notification.userId;
    let siteCode = 'ALL';
    let ticketNumber = '';
    let priority = 'NORMAL';
    let ticketTitle = '';
    let ticketCategory = '';
    let requesterName = '';
    let requesterDepartment = '';

    // Resolve true employee identifier (NIK or email) and ticket metadata from DB
    try {
      if (this.dataSource && this.dataSource.isInitialized) {
        const user = await this.dataSource.getRepository(User).findOne({
          where: { id: notification.userId },
        });
        if (user) {
          employeeId = user.employeeId || user.email || user.id;
          siteCode = (user as any).siteCode || 'SPJ';
        }
        if (notification.ticketId) {
          // Relasi pelapor ikut dimuat: klien desktop perlu tahu SIAPA yang
          // melapor, bukan cuma nomor tiketnya.
          const ticket = await this.dataSource.getRepository(Ticket).findOne({
            where: { id: notification.ticketId },
            relations: { user: { department: true } },
          });
          if (ticket) {
            ticketNumber = ticket.ticketNumber || '';
            priority = (ticket.priority as string) || 'NORMAL';
            ticketTitle = ticket.title || '';
            ticketCategory = ticket.category || '';
            requesterName = ticket.user?.fullName || '';
            requesterDepartment = ticket.user?.department?.name || '';
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(`Failed to resolve notification user/ticket: ${err.message}`);
    }

    // The human ticket number only, never a slice of the ticket id: a GUID means nothing on a toast.
    const finalTicketNumber = ticketNumber || notification.ticketNumber || (notification.ticketId ? '' : '080926-GEN-0001');

    // Who the notice is from (the PIC for the requester side, the reporter for agents); the reporter otherwise.
    let replySender = notification.senderName || requesterName;
    let summaryText = notification.message || notification.title || '';
    if (notification.type === 'TICKET_REPLY') {
      if (notification.title) {
        const senderMatch = notification.title.match(/Pesan Baru dari (.+)$/);
        if (senderMatch && senderMatch[1]) {
          replySender = senderMatch[1].trim();
        }
      }
      if (notification.message) {
        const quoteMatch = notification.message.match(/^.+?:\s*"([\s\S]*)"$/);
        if (quoteMatch && quoteMatch[1]) {
          summaryText = quoteMatch[1];
        }
      }
    }

    const sjaEvent = {
      appCode: 'idesk',
      eventType: notification.type || 'TICKET_REPLY',
      employeeId,
      siteCode,
      ticketId: notification.ticketId || '',
      ticketNumber: finalTicketNumber,
      // ticketTitle HARUS judul keluhan, bukan kalimat notifikasi. Template di
      // sisi SJA menempelkan predikatnya sendiri ("… membutuhkan tindakan"),
      // jadi mengisi slot ini dengan kalimat utuh menghasilkan kalimat ganda.
      ticketTitle: ticketTitle || notification.title || '',
      ticketCategory,
      requesterName: replySender,
      requesterDepartment,
      // The person the desktop popup shows as sender instead of "iDesk System" (additive, optional).
      senderName: replySender || undefined,
      // Kalimat notifikasi asli tetap dikirim terpisah sebagai cadangan untuk
      // event yang tidak punya template khusus. Untuk TICKET_REPLY, berisi murni pesan chat.
      summary: summaryText,
      priority: priority.toUpperCase(),
      actionUrl: `https://idesk.santos.co.id${notification.link || (notification.ticketId ? `/tickets/${notification.ticketId}` : '')}`,
    };

    // 1. Direct Instant HTTP dispatch to SJA Backend (< 15ms)
    const rawSjaUrl =
      process.env.SJA_BACKEND_URL ||
      this.configService.get('SJA_BACKEND_URL') ||
      process.env.SJA_SERVER_URL ||
      this.configService.get('SJA_SERVER_URL') ||
      'http://127.0.0.1:18302';
    const sjaUrl = rawSjaUrl.replace(/\/$/, '');
    let directHttpSuccess = false;
    try {
      // Endpoint /v1/events dilindungi HmacAuthGuard di sisi SJA; body yang
      // dikirim harus byte yang sama persis dengan yang ditandatangani.
      const signed = signSjaRequest(sjaEvent, {
        appId: this.configService?.get(SJA_APP_ID_ENV),
        secret: this.configService?.get(SJA_APP_SECRET_ENV) || this.configService?.get('IDESK_APP_SECRET'),
      });
      const resp = await fetch(`${sjaUrl.replace(/\/$/, '')}/v1/events`, {
        method: 'POST',
        headers: signed.headers,
        body: signed.body,
        // Awaited on the notification path: a blackholed SJA host must not stall it for minutes.
        signal: AbortSignal.timeout(SJA_DISPATCH_TIMEOUT_MS),
      });
      if (resp.ok) {
        this.logger.log(`Instant SJA toast dispatch SUCCESS: [${sjaEvent.eventType}] for ${sjaEvent.employeeId} on #${finalTicketNumber}`);
        directHttpSuccess = true;
      }
    } catch (httpErr: any) {
      this.logger.warn(`Direct SJA HTTP dispatch failed: ${httpErr.message}`);
    }

    if (directHttpSuccess) {
      return;
    }

    // 2. Queue Fallback (only triggered when direct HTTP dispatch fails)
    const isEmpId = employeeId && employeeId !== notification.userId;
    const identityType = isEmpId ? 'idesk_employee_id' : 'idesk_uuid';

    const payload = {
      eventId: `idesk:notif:${notification.id}`,
      eventType: notification.type || 'SYSTEM_ANNOUNCEMENT',
      employeeId,
      siteCode,
      ticketNumber: finalTicketNumber,
      occurredAt: new Date().toISOString(),
      recipients: [
        {
          externalId: employeeId,
          identityType,
        },
      ],
      data: {
        title: notification.title,
        message: notification.message,
        ticketNumber: finalTicketNumber,
      },
      action: {
        url: notification.link || '/',
        label: 'Buka iDesk',
      },
    };

    if (this.outboxQueue && typeof this.outboxQueue.add === 'function') {
      try {
        await this.outboxQueue.add('send-to-sja', payload, {
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: true,
        });
      } catch (qErr: any) {
        this.logger.warn(`Queue enqueue failed: ${qErr.message}`);
      }
    }
  }
}
