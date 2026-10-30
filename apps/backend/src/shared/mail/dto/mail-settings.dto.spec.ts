import { ValidationPipe } from '@nestjs/common';
import { UpdateMailSettingsDto, VerifyMailDto } from './mail-settings.dto';

/**
 * The mail settings page sends the same field set to PATCH /settings/mail and
 * POST /settings/mail/verify. The global ValidationPipe runs
 * `forbidNonWhitelisted`, so a field missing from either DTO makes the whole
 * request fail with 400 ("property envelopeFrom should not exist").
 */
describe('Mail settings DTOs — payload dari MailSettingsPage', () => {
    const pipe = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    });

    const verifyPayload = {
        host: 'mail.kapalapi.co.id',
        port: 465,
        secure: true,
        authRequired: true,
        username: 'sysadmin.sja@kapalapi.co.id',
        envelopeFrom: 'sysadmin.sja@kapalapi.co.id',
        allowSelfSignedCert: false,
    };

    it('VerifyMailDto menerima envelopeFrom', async () => {
        const result = await pipe.transform(verifyPayload, { type: 'body', metatype: VerifyMailDto });
        expect(result).toEqual(expect.objectContaining({ envelopeFrom: 'sysadmin.sja@kapalapi.co.id' }));
    });

    it('UpdateMailSettingsDto menerima envelopeFrom', async () => {
        const result = await pipe.transform(
            { ...verifyPayload, enabled: true, fromAddress: 'iDesk Support <sysadmin.sja@kapalapi.co.id>' },
            { type: 'body', metatype: UpdateMailSettingsDto },
        );
        expect(result).toEqual(expect.objectContaining({ envelopeFrom: 'sysadmin.sja@kapalapi.co.id' }));
    });
});
