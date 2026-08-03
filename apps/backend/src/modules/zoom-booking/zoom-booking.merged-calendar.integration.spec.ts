import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { ZoomBookingService, MergedCalendarDay, MergedCalendarSlot } from './services/zoom-booking.service';
import {
    ZoomAccount,
    ZoomBooking,
    ZoomMeeting,
    ZoomParticipant,
    ZoomSettings,
    ZoomAuditLog,
} from './entities';
import { BookingStatus } from './enums/booking-status.enum';
import { User } from '../users/entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { ZoomApiAdapter } from './adapters/zoom-api.adapter';

const maybeDescribe = process.env.TEST_DATABASE_URL ? describe : describe.skip;

/**
 * Integration tests for ZoomBookingService.getMergedCalendar (Gabungan view).
 *
 * Verifies the three contract guarantees the frontend relies on:
 *  1. Overlap detection — bookings from different accounts at the same time
 *     slot all land in the slot's `bookings[]` array.
 *  2. My-booking priority — the current user's bookings sort to the front
 *     of `bookings[]` regardless of start time.
 *  3. Overflow count — when more than 4 bookings overlap, the extras are
 *     reflected in `bookingsOverflow` (drives the "+N lainnya" pill).
 */
maybeDescribe('ZoomBookingService.getMergedCalendar (integration)', () => {
    let app: TestingModule;
    let ds: DataSource;
    let service: ZoomBookingService;
    let accountRepo: Repository<ZoomAccount>;
    let bookingRepo: Repository<ZoomBooking>;
    let settingsRepo: Repository<ZoomSettings>;
    let userRepo: Repository<User>;

    // Stable test date — pick a Monday in the future so the working-day check
    // (Mon–Fri) passes with default settings.
    const testDate = new Date('2099-06-15T00:00:00Z');
    const testDateStr = testDate.toLocaleDateString('en-CA'); // YYYY-MM-DD

    let userAId: string;
    let userBId: string;
    let account1Id: string;
    let account2Id: string;
    let account3Id: string;
    let settingsId: string;

    beforeAll(async () => {
        app = await Test.createTestingModule({
            imports: [
                TypeOrmModule.forRoot({
                    type: 'postgres',
                    url: process.env.TEST_DATABASE_URL,
                    entities: [
                        ZoomAccount,
                        ZoomBooking,
                        ZoomMeeting,
                        ZoomParticipant,
                        ZoomSettings,
                        ZoomAuditLog,
                        User,
                    ],
                    synchronize: false,
                    dropSchema: false,
                }),
                TypeOrmModule.forFeature([
                    ZoomAccount,
                    ZoomBooking,
                    ZoomMeeting,
                    ZoomParticipant,
                    ZoomSettings,
                    ZoomAuditLog,
                ]),
            ],
            providers: [
                ZoomBookingService,
                {
                    // AuditService is not exercised by getMergedCalendar but is
                    // required by the constructor — provide a no-op stub.
                    provide: AuditService,
                    useValue: { log: jest.fn().mockResolvedValue(undefined) },
                },
                {
                    // Same story: ZoomApiAdapter is injected but unused by this
                    // method path. Stubbed so the module compiles.
                    provide: ZoomApiAdapter,
                    useValue: { createMeeting: jest.fn(), updateMeeting: jest.fn(), deleteMeeting: jest.fn() },
                },
                {
                    provide: EventEmitter2,
                    useValue: { emit: jest.fn() },
                },
            ],
        }).compile();

        ds = app.get(DataSource);
        service = app.get(ZoomBookingService);
        accountRepo = ds.getRepository(ZoomAccount);
        bookingRepo = ds.getRepository(ZoomBooking);
        settingsRepo = ds.getRepository(ZoomSettings);
        userRepo = ds.getRepository(User);

        // Use isolated test rows scoped by a unique tag so we don't collide
        // with other suites hitting the same DB.
        const tag = `merged-${Date.now()}`;

        // Two users — User A is the "current user" for my-booking priority tests.
        userAId = ((await userRepo.save(userRepo.create({
            email: `userA-${tag}@test`,
            fullName: 'User A',
        } as any))) as any).id;
        userBId = ((await userRepo.save(userRepo.create({
            email: `userB-${tag}@test`,
            fullName: 'User B',
        } as any))) as any).id;

        // Three active Zoom accounts with distinct colors.
        const acc1 = await accountRepo.save(accountRepo.create({
            name: `Zoom 1 ${tag}`,
            email: `zoom1-${tag}@company.com`,
            displayOrder: 1,
            colorHex: '#FF0000',
            isActive: true,
        }));
        const acc2 = await accountRepo.save(accountRepo.create({
            name: `Zoom 2 ${tag}`,
            email: `zoom2-${tag}@company.com`,
            displayOrder: 2,
            colorHex: '#00FF00',
            isActive: true,
        }));
        const acc3 = await accountRepo.save(accountRepo.create({
            name: `Zoom 3 ${tag}`,
            email: `zoom3-${tag}@company.com`,
            displayOrder: 3,
            colorHex: '#0000FF',
            isActive: true,
        }));
        account1Id = acc1.id;
        account2Id = acc2.id;
        account3Id = acc3.id;

        // Settings row: full business hours, every weekday, no blocked dates.
        // We update an existing settings row (the service picks the first one
        // found) or insert a fresh one if the table is empty.
        const existing = (await settingsRepo.find())[0];
        const settingsPayload = {
            defaultDurationMinutes: 60,
            advanceBookingDays: 30,
            slotStartTime: '08:00',
            slotEndTime: '18:00',
            slotIntervalMinutes: 30,
            blockedDates: [],
            workingDays: [1, 2, 3, 4, 5, 6, 0],
            requireDescription: false,
            maxBookingPerUserPerDay: 10,
            allowedDurations: [30, 60, 90, 120],
        };
        if (existing) {
            await settingsRepo.update({ id: (existing as ZoomSettings).id }, settingsPayload);
            settingsId = (existing as ZoomSettings).id;
        } else {
            const created = await settingsRepo.save(settingsRepo.create(settingsPayload as any));
            settingsId = (Array.isArray(created) ? created[0] : created).id;
        }
    });

    afterAll(async () => {
        // Clean up only the rows this suite created (scoped by tag/date).
        await bookingRepo
            .createQueryBuilder()
            .delete()
            .where('bookingDate = :d', { d: testDateStr })
            .execute();
        await accountRepo
            .createQueryBuilder()
            .delete()
            .where('id IN (:...ids)', { ids: [account1Id, account2Id, account3Id] })
            .execute();
        if (settingsId) {
            await settingsRepo.delete({ id: settingsId });
        }
        await userRepo
            .createQueryBuilder()
            .delete()
            .where('id IN (:...ids)', { ids: [userAId, userBId] })
            .execute();

        await ds.destroy();
        await app.close();
    });

    // Per-test cleanup so scenarios don't bleed into each other.
    afterEach(async () => {
        await bookingRepo
            .createQueryBuilder()
            .delete()
            .where('bookingDate = :d', { d: testDateStr })
            .execute();
    });

    /**
     * Helper — fetch the slot for a given HH:mm from a merged day.
     */
    const findSlot = (day: MergedCalendarDay, time: string): MergedCalendarSlot | undefined =>
        day.slots.find((s) => s.time === time);

    it('aggregates overlapping bookings from multiple accounts into one slot', async () => {
        // 10:00–11:00 on testDate — three bookings, one per account, same time.
        await bookingRepo.save(bookingRepo.create({
            zoomAccountId: account1Id,
            bookedByUserId: userAId,
            title: 'Account 1 sync',
            bookingDate: testDateStr as any,
            startTime: '10:00',
            endTime: '11:00',
            durationMinutes: 60,
            status: BookingStatus.CONFIRMED,
        } as any));
        await bookingRepo.save(bookingRepo.create({
            zoomAccountId: account2Id,
            bookedByUserId: userBId,
            title: 'Account 2 sync',
            bookingDate: testDateStr as any,
            startTime: '10:00',
            endTime: '11:00',
            durationMinutes: 60,
            status: BookingStatus.CONFIRMED,
        } as any));
        await bookingRepo.save(bookingRepo.create({
            zoomAccountId: account3Id,
            bookedByUserId: userBId,
            title: 'Account 3 sync',
            bookingDate: testDateStr as any,
            startTime: '10:00',
            endTime: '11:00',
            durationMinutes: 60,
            status: BookingStatus.CONFIRMED,
        } as any));

        const merged = await service.getMergedCalendar(testDate, testDate, userAId);
        expect(merged).toHaveLength(1);
        const day = merged[0];
        expect(day.date).toBe(testDateStr);

        const slot = findSlot(day, '10:00');
        expect(slot).toBeDefined();
        // All three accounts land in the same slot.
        expect(slot!.bookings).toHaveLength(3);
        expect(slot!.bookingsOverflow).toBe(0);
        expect(slot!.status).toBe('booked');

        const accountIds = slot!.bookings.map((b) => b.zoomAccountId).sort();
        expect(accountIds).toEqual([account1Id, account2Id, account3Id].sort());

        // Each booking carries the owning account's color.
        const account1Booking = slot!.bookings.find((b) => b.zoomAccountId === account1Id)!;
        expect(account1Booking.accountColorHex).toBe('#FF0000');
    });

    it('sorts current user\'s bookings first within a slot', async () => {
        // 14:00–15:00 — User B's booking created first, User A's second.
        // Service should still hoist User A to position 0.
        await bookingRepo.save(bookingRepo.create({
            zoomAccountId: account2Id,
            bookedByUserId: userBId,
            title: 'B first chronologically',
            bookingDate: testDateStr as any,
            startTime: '14:00',
            endTime: '15:00',
            durationMinutes: 60,
            status: BookingStatus.CONFIRMED,
        } as any));
        await bookingRepo.save(bookingRepo.create({
            zoomAccountId: account1Id,
            bookedByUserId: userAId,
            title: 'A second chronologically but owns slot',
            bookingDate: testDateStr as any,
            startTime: '14:00',
            endTime: '15:00',
            durationMinutes: 60,
            status: BookingStatus.CONFIRMED,
        } as any));

        const merged = await service.getMergedCalendar(testDate, testDate, userAId);
        const slot = findSlot(merged[0], '14:00');
        expect(slot).toBeDefined();
        expect(slot!.bookings).toHaveLength(2);
        expect(slot!.isMyBooking).toBe(true);

        // User A's booking (current user) is at index 0.
        expect(slot!.bookings[0].bookedBy).toBe('Saya');
        expect(slot!.bookings[0].title).toBe('A second chronologically but owns slot');
        expect(slot!.bookings[1].bookedBy).toBe('User B');
    });

    it('caps visible bookings at 4 and reports overflow count for "+N lainnya"', async () => {
        // 16:00–17:00 — six overlapping bookings across three accounts.
        // Visible cap is 4, so bookingsOverflow should be 2.
        const accountIds = [account1Id, account2Id, account3Id];
        for (let i = 0; i < 6; i++) {
            await bookingRepo.save(bookingRepo.create({
                zoomAccountId: accountIds[i % 3],
                bookedByUserId: i % 2 === 0 ? userAId : userBId,
                title: `Overlap ${i + 1}`,
                bookingDate: testDateStr as any,
                startTime: '16:00',
                endTime: '17:00',
                durationMinutes: 60,
                status: BookingStatus.CONFIRMED,
            } as any));
        }

        const merged = await service.getMergedCalendar(testDate, testDate, userAId);
        const slot = findSlot(merged[0], '16:00');
        expect(slot).toBeDefined();
        expect(slot!.bookings).toHaveLength(4);
        expect(slot!.bookingsOverflow).toBe(2);
        expect(slot!.status).toBe('booked');
    });

    it('excludes inactive accounts and cancelled bookings', async () => {
        // Inactive account — should be ignored even with a matching booking.
        const inactive = await accountRepo.save(accountRepo.create({
            name: 'Zoom Inactive',
            email: `inactive-${Date.now()}@company.com`,
            displayOrder: 99,
            colorHex: '#999999',
            isActive: false,
        }));

        try {
            // 09:00 slot: one CONFIRMED booking on account 1, one CANCELLED on
            // account 2, one CONFIRMED on the inactive account.
            await bookingRepo.save(bookingRepo.create({
                zoomAccountId: account1Id,
                bookedByUserId: userAId,
                title: 'Visible',
                bookingDate: testDateStr as any,
                startTime: '09:00',
                endTime: '10:00',
                durationMinutes: 60,
                status: BookingStatus.CONFIRMED,
            } as any));
            await bookingRepo.save(bookingRepo.create({
                zoomAccountId: account2Id,
                bookedByUserId: userBId,
                title: 'Cancelled should not show',
                bookingDate: testDateStr as any,
                startTime: '09:00',
                endTime: '10:00',
                durationMinutes: 60,
                status: BookingStatus.CANCELLED,
            } as any));
            await bookingRepo.save(bookingRepo.create({
                zoomAccountId: inactive.id,
                bookedByUserId: userBId,
                title: 'Inactive account should not show',
                bookingDate: testDateStr as any,
                startTime: '09:00',
                endTime: '10:00',
                durationMinutes: 60,
                status: BookingStatus.CONFIRMED,
            } as any));

            const merged = await service.getMergedCalendar(testDate, testDate, userAId);
            const slot = findSlot(merged[0], '09:00');
            expect(slot).toBeDefined();
            // Only the one CONFIRMED booking on an active account survives.
            expect(slot!.bookings).toHaveLength(1);
            expect(slot!.bookings[0].title).toBe('Visible');
            expect(slot!.bookings[0].zoomAccountId).toBe(account1Id);
        } finally {
            await bookingRepo.delete({ zoomAccountId: inactive.id });
            await accountRepo.delete({ id: inactive.id });
        }
    });

    it('returns one day per date in the requested range', async () => {
        const start = new Date('2099-06-15T00:00:00Z'); // Mon
        const end = new Date('2099-06-17T00:00:00Z');   // Wed (3 days)
        const merged = await service.getMergedCalendar(start, end, userAId);
        expect(merged).toHaveLength(3);
        expect(merged.map((d) => d.date)).toEqual(['2099-06-15', '2099-06-16', '2099-06-17']);
    });
});
