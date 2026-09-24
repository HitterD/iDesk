import { SjaAdapterService } from './sja-adapter.service';

describe('SjaAdapterService', () => {
  let service: SjaAdapterService;
  const mockQueue = { add: jest.fn() };

  beforeEach(() => {
    mockQueue.add.mockClear();
    service = new SjaAdapterService(
      mockQueue as any,
      { get: (key: string) => (key === 'SJA_API_URL' ? 'http://localhost:3002' : 'secret') } as any,
    );
  });

  it('should transform iDesk notification to canonical event and enqueue to outbox', async () => {
    const notif = {
      id: 'notif-uuid-1',
      userId: 'user-uuid-1',
      type: 'TICKET_ASSIGNED',
      title: 'Tiket Baru',
      message: 'Tiket #2026-0001 di-assign',
      link: '/tickets/123',
    };

    await service.dispatchNotification(notif as any);

    expect(mockQueue.add).toHaveBeenCalledWith(
      'send-to-sja',
      expect.objectContaining({
        eventId: 'idesk:notif:notif-uuid-1',
        eventType: 'TICKET_ASSIGNED',
        recipients: [
          expect.objectContaining({
            externalId: 'user-uuid-1',
            identityType: 'idesk_uuid',
          }),
        ],
      }),
      expect.any(Object),
    );
  });

  describe('konteks tiket pada event ke SJA', () => {
    const ticket = {
      ticketNumber: '150926-GEN-0008',
      priority: 'HIGH',
      title: 'Printer lantai 3 tidak bisa mencetak',
      category: 'HARDWARE',
      user: { fullName: 'Budi Santoso', department: { name: 'Finance' } },
    };

    /** DataSource tiruan: satu repositori untuk User, satu untuk Ticket. */
    function buildDataSource(ticketRow: any) {
      return {
        isInitialized: true,
        getRepository: (entity: any) => ({
          findOne: async () =>
            entity?.name === 'Ticket'
              ? ticketRow
              : { employeeId: '20451', email: 'agent@santos.co.id', id: 'user-uuid-1' },
        }),
      };
    }

    /** Menangkap body JSON dan headers yang dikirim ke endpoint /v1/events. */
    async function captureDispatchedEvent(ticketRow: any, notification: any) {
      const fetchSpy = jest
        .spyOn(global, 'fetch' as any)
        .mockResolvedValue({ ok: true } as any);

      const svc = new SjaAdapterService(
        mockQueue as any,
        {
          get: (key: string) => {
            if (key === 'SJA_BACKEND_URL') return 'http://127.0.0.1:18302';
            if (key === 'SJA_APP_SECRET' || key === 'IDESK_APP_SECRET') {
              return 'test-secret-at-least-32-chars-long-abc123';
            }
            if (key === 'SJA_APP_ID') return 'idesk';
            return undefined;
          },
        } as any,
        buildDataSource(ticketRow) as any,
      );

      await svc.dispatchNotification(notification);

      const [, init] = fetchSpy.mock.calls[0] as any;
      fetchSpy.mockRestore();
      return JSON.parse(init.body);
    }

    it('should send the real ticket title, never the notification sentence', async () => {
      const sent = await captureDispatchedEvent(ticket, {
        id: 'notif-1',
        userId: 'user-uuid-1',
        type: 'TICKET_ASSIGNED',
        title: 'Tiket Ditugaskan',
        message: 'Tiket #150926-GEN-0008 ditugaskan kepada Anda secara otomatis.',
        ticketId: 'ticket-1',
        link: '/tickets/ticket-1',
      });

      // Inti bug lama: slot ticketTitle diisi kalimat notifikasi, sehingga
      // template SJA menempelkan predikat kedua ke kalimat yang sudah utuh.
      expect(sent.ticketTitle).toBe('Printer lantai 3 tidak bisa mencetak');
      expect(sent.ticketTitle).not.toContain('ditugaskan');
      expect(sent.ticketTitle).not.toContain('#150926-GEN-0008');
    });

    it('should carry requester and category so the desktop popup can explain the ticket', async () => {
      const sent = await captureDispatchedEvent(ticket, {
        id: 'notif-2',
        userId: 'user-uuid-1',
        type: 'TICKET_ASSIGNED',
        title: 'Tiket Ditugaskan',
        message: 'Tiket ditugaskan kepada Anda.',
        ticketId: 'ticket-1',
      });

      expect(sent.requesterName).toBe('Budi Santoso');
      expect(sent.requesterDepartment).toBe('Finance');
      expect(sent.ticketCategory).toBe('HARDWARE');
      expect(sent.ticketNumber).toBe('150926-GEN-0008');
      expect(sent.priority).toBe('HIGH');
    });

    it('should never emit an English assignment sentence', async () => {
      const sent = await captureDispatchedEvent(ticket, {
        id: 'notif-3',
        userId: 'user-uuid-1',
        type: 'TICKET_ASSIGNED',
        title: 'Tiket Ditugaskan',
        message: 'Tiket #150926-GEN-0008 ditugaskan kepada Anda secara otomatis.',
        ticketId: 'ticket-1',
      });

      const allText = JSON.stringify(sent);
      expect(allText).not.toContain('You have been assigned');
      expect(allText).not.toContain('by Auto-assign');
    });

    it('should fall back to the notification title when the ticket has no title', async () => {
      const sent = await captureDispatchedEvent(
        { ...ticket, title: '', user: null },
        {
          id: 'notif-4',
          userId: 'user-uuid-1',
          type: 'SYSTEM',
          title: 'Pemeliharaan Terjadwal',
          message: 'Sistem akan dimatikan sementara.',
          ticketId: 'ticket-1',
        },
      );

      expect(sent.ticketTitle).toBe('Pemeliharaan Terjadwal');
      expect(sent.requesterName).toBe('');
      expect(sent.summary).toBe('Sistem akan dimatikan sementara.');
    });

    it('should extract reply sender and pure message for TICKET_REPLY', async () => {
      const sent = await captureDispatchedEvent(ticket, {
        id: 'notif-5',
        userId: 'user-uuid-1',
        type: 'TICKET_REPLY',
        title: '[#150926-GEN-0010] Pesan Baru dari User SPJ',
        message: 'User SPJ: "pak"',
        ticketId: 'ticket-reply-1',
        link: '/tickets/ticket-reply-1',
      });

      expect(sent.requesterName).toBe('User SPJ');
      expect(sent.summary).toBe('pak');
      expect(sent.ticketTitle).toBe('Printer lantai 3 tidak bisa mencetak');
      expect(sent.ticketId).toBe('ticket-reply-1');
    });

    it('should include HMAC authentication headers on direct dispatch', async () => {
      const fetchSpy = jest
        .spyOn(global, 'fetch' as any)
        .mockResolvedValue({ ok: true } as any);

      const svc = new SjaAdapterService(
        mockQueue as any,
        {
          get: (key: string) => {
            if (key === 'SJA_BACKEND_URL') return 'http://127.0.0.1:18302';
            if (key === 'SJA_APP_SECRET') return 'test-secret-at-least-32-chars-long-abc123';
            if (key === 'SJA_APP_ID') return 'idesk';
            return undefined;
          },
        } as any,
        buildDataSource(ticket) as any,
      );

      await svc.dispatchNotification({
        id: 'notif-hmac',
        userId: 'user-uuid-1',
        type: 'TICKET_ASSIGNED',
        title: 'Tiket Baru',
        message: 'Tiket di-assign',
        ticketId: 'ticket-1',
      });

      expect(fetchSpy).toHaveBeenCalled();
      const [, init] = fetchSpy.mock.calls[0] as any;
      expect(init.headers['x-sja-app-id']).toBe('idesk');
      expect(init.headers['x-sja-timestamp']).toBeDefined();
      expect(init.headers['x-sja-signature']).toBeDefined();
      expect(init.headers['x-sja-signature'].length).toBe(64); // SHA-256 hex length
      fetchSpy.mockRestore();
    });
  });
});
