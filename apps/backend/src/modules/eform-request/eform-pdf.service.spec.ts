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

  it('generates a valid PDF buffer for Flashdisk request', async () => {
    const mockRequest: Partial<EFormRequest> = {
      id: 'req-fd-003',
      formType: EFormType.FLASHDISK,
      status: EFormStatus.PENDING_MANAGER,
      requesterName: 'Bagas Pratama',
      requesterDepartment: 'IT',
      formData: {
        dariTanggal: '2026-01-23',
        sampaiTanggal: '2026-02-23',
        alasan: 'Transfer data file besar antar PC offline',
        hostname: 'PC-ACC-01',
        accessLevel: 'READ_ONLY',
        flashdiskInfo: 'SanDisk Ultra 32GB (S/N: 48921)',
      },
      signatures: [],
      createdAt: new Date('2026-01-23T08:00:00Z'),
    };

    const buffer = await service.generatePdf(mockRequest as EFormRequest);
    expect(buffer).toBeDefined();
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('generates a valid PDF buffer for Email request', async () => {
    const mockRequest: Partial<EFormRequest> = {
      id: 'req-email-004',
      formType: EFormType.EMAIL,
      status: EFormStatus.PENDING_MANAGER,
      requesterName: 'Bagas Pratama',
      requesterDepartment: 'IT',
      formData: {
        dariTanggal: '2026-09-21',
        sampaiTanggal: '',
        alasan: 'Karyawan baru membutuhkan akun email dinas resmi',
        proposedEmail: 'bagas.pratama',
        emailDomain: '@kapalapi.co.id',
        accountType: 'PERSONAL',
      },
      signatures: [],
      createdAt: new Date('2026-09-21T08:00:00Z'),
    };

    const buffer = await service.generatePdf(mockRequest as EFormRequest);
    expect(buffer).toBeDefined();
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('generates a valid PDF buffer for Synology NAS request', async () => {
    const mockRequest: Partial<EFormRequest> = {
      id: 'req-nas-005',
      formType: EFormType.SYNOLOGY_NAS,
      status: EFormStatus.CONFIRMED,
      requesterName: 'Bagas Pratama',
      requesterDepartment: 'IT',
      formData: {
        dariTanggal: '2026-09-21',
        sampaiTanggal: '',
        alasan: 'Akses shared folder dokumen kerja antar divisi',
        folderPath: '/Sharing/IT_Projects_2026',
        accessLevel: 'READ_WRITE',
        accountType: 'SHARING',
      },
      signatures: [],
      createdAt: new Date('2026-09-21T08:00:00Z'),
    };

    const buffer = await service.generatePdf(mockRequest as EFormRequest);
    expect(buffer).toBeDefined();
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('generates a valid PDF buffer for Synology NAS request with multi-server nasSelections table', async () => {
    const mockRequest: Partial<EFormRequest> = {
      id: 'req-nas-multi-006',
      formType: EFormType.SYNOLOGY_NAS,
      status: EFormStatus.CONFIRMED,
      requesterName: 'Bagas Pratama',
      requesterDepartment: 'IT',
      formData: {
        dariTanggal: '2026-09-21',
        sampaiTanggal: '',
        alasan: 'Akses shared folder dokumen kerja antar divisi',
        nasSelections: [
          { nasId: 'SPJ', nasName: 'Synology Sepanjang (SPJ)', folderPath: '/Sharing/Dept_Keuangan', accessLevel: 'READ_WRITE' },
          { nasId: 'KRW', nasName: 'Synology Karawang (KRW)', folderPath: '/Logistik/Archive_2026', accessLevel: 'READ_ONLY' },
          { nasId: 'JKT', nasName: 'Synology Jakarta (JKT)', folderPath: '/Marketing/Campaign_Assets', accessLevel: 'READ_WRITE' },
        ],
        accountType: 'SHARING',
      },
      signatures: [],
      createdAt: new Date('2026-09-21T08:00:00Z'),
    };

    const buffer = await service.generatePdf(mockRequest as EFormRequest);
    expect(buffer).toBeDefined();
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });
  // Synology goes straight to IT, so the manager block would otherwise print
  // three empty signature boxes. These two tests read the rendered text: the
  // %PDF-header checks above cannot tell a correct layout from a broken one.
  describe('manager approval block', () => {
    const pdfParse = require('pdf-parse');

    const extractText = async (formType: EFormType): Promise<string> => {
      const request: Partial<EFormRequest> = {
        id: 'req-approval-block',
        formType,
        status: EFormStatus.CONFIRMED,
        requesterName: 'Bagas Pratama',
        requesterDepartment: 'IT',
        formData: {
          dariTanggal: '2026-09-21',
          sampaiTanggal: '',
          alasan: 'Akses shared folder dokumen kerja antar divisi',
        },
        signatures: [],
        createdAt: new Date('2026-09-21T08:00:00Z'),
      };

      const buffer = await service.generatePdf(request as EFormRequest);
      const { text } = await pdfParse(buffer);
      return text.replace(/\s+/g, ' ');
    };

    it('omits the manager approval block for Synology NAS', async () => {
      const text = await extractText(EFormType.SYNOLOGY_NAS);

      expect(text).not.toContain('KADEP');
      expect(text).not.toContain('MENGETAHUI');
    });

    it('still renders the ICT section for Synology NAS', async () => {
      const text = await extractText(EFormType.SYNOLOGY_NAS);

      // Guards the approvalLineY bookkeeping: section 6 is positioned from it,
      // so a wrong value would push this off the page.
      expect(text).toContain('DIISI OLEH ICT');
    });

    it('keeps the manager approval block for types that still need one', async () => {
      const text = await extractText(EFormType.VPN);

      expect(text).toContain('KADEP');
      expect(text).toContain('DIISI OLEH ICT');
    });
  });
});
