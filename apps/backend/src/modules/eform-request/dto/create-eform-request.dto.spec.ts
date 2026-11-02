import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateEFormRequestDto } from './create-eform-request.dto';

const synology = {
    formType: 'SYNOLOGY_NAS',
    formData: { alasan: 'akses folder', nasSelections: [] },
    termsAccepted: true,
    signatureData: 'data:image/png;base64,AA',
};

const errorsOf = async (body: object) =>
    (await validate(plainToInstance(CreateEFormRequestDto, body), { whitelist: true, forbidNonWhitelisted: true }))
        .map((e) => e.property);

describe('CreateEFormRequestDto', () => {
    it('accepts Synology without a manager or GM', async () => {
        expect(await errorsOf(synology)).toEqual([]);
    });

    // The form used to send managerId: '' for Synology, which is not a UUID and failed with 400.
    it('refuses an empty manager id, so the form must leave it out', async () => {
        expect(await errorsOf({ ...synology, managerId: '' })).toContain('managerId');
    });

    it('accepts an optional GM', async () => {
        expect(await errorsOf({ ...synology, formType: 'VPN', managerId: '6f0c1a8e-2b3d-4c5e-8f90-1a2b3c4d5e6f', gmApproverId: '0b6d3c4e-1111-4222-8333-444455556666' })).toEqual([]);
    });
});
