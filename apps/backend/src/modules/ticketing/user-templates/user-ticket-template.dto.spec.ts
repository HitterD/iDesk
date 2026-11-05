import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateUserTicketTemplateDto, UpdateUserTicketTemplateDto } from './user-ticket-template.dto';

const base = { ticketType: 'service', label: 'VPN', title: 'Reset akun VPN', description: 'Mohon reset', priority: 'MEDIUM' };
const errorsOf = async (cls: any, body: object) => (await validate(plainToInstance(cls, body) as object)).map((e) => e.property);

describe('user ticket template DTOs', () => {
    it('accepts a valid template and turns empty optional fields into null', async () => {
        const dto = plainToInstance(CreateUserTicketTemplateDto, { ...base, device: '', category: ' NETWORK ' });
        expect(await validate(dto)).toEqual([]);
        expect(dto.device).toBeNull();
        expect(dto.category).toBe('NETWORK');
    });

    it.each([
        ['ticketType', { ticketType: 'zoom' }],
        ['priority', { priority: 'HARDWARE_INSTALLATION' }],
        ['label', { label: 'x' }],
        ['title', { title: 'abc' }],
    ])('rejects an invalid %s', async (property, patch) => {
        expect(await errorsOf(CreateUserTicketTemplateDto, { ...base, ...patch })).toContain(property);
    });

    it('update allows partial bodies but not moving the template to another form', async () => {
        expect(await errorsOf(UpdateUserTicketTemplateDto, { label: 'Baru' })).toEqual([]);
        // Same options as the global ValidationPipe (main.ts).
        const errors = await validate(plainToInstance(UpdateUserTicketTemplateDto, { ticketType: 'oracle-request' }) as object,
            { whitelist: true, forbidNonWhitelisted: true });
        expect(errors.map((e) => e.property)).toEqual(['ticketType']);
    });
});
