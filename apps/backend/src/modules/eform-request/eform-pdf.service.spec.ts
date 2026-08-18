import { EFormPdfService } from './eform-pdf.service';
import { EFormRequest, EFormStatus, EFormType } from './entities';

describe('EFormPdfService', () => {
  let service: EFormPdfService;

  beforeEach(() => {
    service = new EFormPdfService();
  });

  it('generates a valid PDF buffer for VPN request matching F-ICT-04 template', async () => {
    const mockRequest: Partial<EFormRequest> = {
      id: 'req-vpn-001',
      formType: EFormType.VPN,
      status: EFormStatus.CONFIRMED,
      requesterName: 'Bagas Pratama',
      requesterDepartment: 'Information Technology',
      requesterEmail: 'bagas@kapalapi.co.id',
      requesterJobTitle: 'Software Engineer',
      formData: {
        kebutuhanAkses: 'Remote PC Kantor',
        dariTanggal: '2026-01-23',
        sampaiTanggal: '2027-01-23',
        alasan: 'Work From Home (WFH) untuk remote komputer kerja kantor',
      },
      signatures: [
        {
          id: 'sig-1',
          eformRequestId: 'req-vpn-001',
          eformRequest: null as any,
          signerId: 'user-1',
          signer: null as any,
          signerName: 'Bagas Pratama',
          signatureData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          signerRole: 'REQUESTER',
          signedAt: new Date('2026-01-23T08:00:00Z'),
        },
        {
          id: 'sig-2',
          eformRequestId: 'req-vpn-001',
          eformRequest: null as any,
          signerId: 'mgr-1',
          signer: null as any,
          signerName: 'Manager ICT',
          signatureData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          signerRole: 'MANAGER',
          signedAt: new Date('2026-01-23T09:00:00Z'),
        },
      ],
      createdAt: new Date('2026-01-23T08:00:00Z'),
      resolvedAt: new Date('2026-01-23T10:00:00Z'),
    };

    const mockCredential = {
      username: 'bagas.pratama',
      password: 'SecretPass123!',
      vpnServer: '192.168.10.1',
      provisionedByName: 'ICT Admin',
      accessCreatedAt: new Date('2026-01-23T10:00:00Z'),
      accessExpiresAt: new Date('2027-01-23T10:00:00Z'),
    };


    const buffer = await service.generatePdf(mockRequest as EFormRequest, mockCredential);

    expect(buffer).toBeDefined();
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
    // PDF Magic bytes check
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('generates a valid PDF buffer for Website request', async () => {
    const mockRequest: Partial<EFormRequest> = {
      id: 'req-web-002',
      formType: EFormType.WEBSITE,
      status: EFormStatus.PENDING_MANAGER,
      requesterName: 'Bagas Pratama',
      requesterDepartment: 'IT',
      formData: {
        dariTanggal: '2026-01-23',
        sampaiTanggal: '',
        alasan: 'Kebutuhan riset tools',
      },
      requestedWebsites: 'github.com, figma.com',
      signatures: [],
      createdAt: new Date('2026-01-23T08:00:00Z'),
    };

    const buffer = await service.generatePdf(mockRequest as EFormRequest);
    expect(buffer).toBeDefined();
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });
});
