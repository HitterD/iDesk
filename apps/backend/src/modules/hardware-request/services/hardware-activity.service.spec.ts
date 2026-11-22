import { HardwareRole } from '../domain/enums/hardware-role.enum';
import { HardwareActivityService } from './hardware-activity.service';

describe('HardwareActivityService.listForRequest', () => {
    const rows = [
        { id: 'a1', action: 'CREATED', metadata: { signature: 'data:image/png;base64,AAAA', requestNumber: 'HR-1' } },
        { id: 'a2', action: 'REVIEWED', metadata: { note: 'ok' } },
    ];
    const service = new HardwareActivityService(
        { find: jest.fn(async () => rows) } as never,
        { findOne: jest.fn(async () => ({ id: 'hr-1', requesterId: 'u-1' })) } as never,
    );

    it('replaces the signature image with hasSignature and keeps the rest', async () => {
        const result = await service.listForRequest({ id: 'u-1', role: HardwareRole.USER } as never, 'hr-1');
        expect(result[0].metadata).toEqual({ requestNumber: 'HR-1', hasSignature: true });
        expect(JSON.stringify(result)).not.toContain('base64');
        expect(result[1].metadata).toEqual({ note: 'ok' });
    });
});
