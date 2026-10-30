import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { ConfigService } from '@nestjs/config';
import { signSjaRequest, SJA_APP_ID_ENV, SJA_APP_SECRET_ENV } from './sja-request-signer';

@Processor('sja-outbox')
export class SjaOutboxProcessor {
  private readonly logger = new Logger(SjaOutboxProcessor.name);

  constructor(private readonly configService: ConfigService) {}

  @Process('send-to-sja')
  async handleSendToSja(job: Job<any>) {
    const rawUrl =
      this.configService.get<string>('SJA_BACKEND_URL') ||
      this.configService.get<string>('SJA_SERVER_URL') ||
      this.configService.get<string>('SJA_API_URL') ||
      'http://127.0.0.1:18302';
    const sjaUrl = rawUrl.replace(/\/$/, '');

    // Fail-closed: secret hanya boleh datang dari environment. Nilai bawaan yang
    // tertulis di kode membuat seluruh sistem berjalan dengan secret publik.
    const signed = signSjaRequest(job.data, {
      appId: this.configService.get<string>(SJA_APP_ID_ENV),
      secret: this.configService.get<string>(SJA_APP_SECRET_ENV),
    });

    const response = await fetch(`${sjaUrl}/v1/events`, {
      method: 'POST',
      headers: {
        ...signed.headers,
        'x-idempotency-key': job.data.eventId,
      },
      body: signed.body,
    });

    if (!response.ok) {
      throw new Error(`SJA Ingest API returned HTTP ${response.status}`);
    }

    this.logger.log(`Successfully delivered event [${job.data.eventId}] to SJA Notification Center`);
  }
}
