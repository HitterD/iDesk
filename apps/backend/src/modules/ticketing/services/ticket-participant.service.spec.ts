import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TicketParticipantService } from './ticket-participant.service';
import { Ticket, TicketType, HandlingTeam } from '../entities/ticket.entity';
import { TicketParticipant } from '../entities/ticket-participant.entity';
import { TicketMessage } from '../entities/ticket-message.entity';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { EventsGateway } from '../presentation/gateways/events.gateway';
import { NotificationService } from '../../notifications/notification.service';

describe('TicketParticipantService', () => {
    let service: TicketParticipantService;
    let ticketRepo: any;
    let participantRepo: any;
    let messageRepo: any;
    let userRepo: any;
    let dataSource: any;
    let eventsGateway: any;
    let notificationService: any;

    const mockTicket: Partial<Ticket> = {
        id: 'ticket-1',
        ticketNumber: 'TICK-1001',
        title: 'Printer Rusak',
        category: 'HARDWARE',
        ticketType: TicketType.SERVICE,
        userId: 'creator-user-id',
        assignedToId: 'agent-id',
    };

    beforeEach(async () => {
        ticketRepo = {
            findOne: jest.fn(),
        };
        participantRepo = {
            find: jest.fn(),
            findOne: jest.fn(),
        };
        messageRepo = {
            create: jest.fn(),
            save: jest.fn(),
        };
        userRepo = {
            findOne: jest.fn(),
            find: jest.fn(),
        };
        dataSource = {
            transaction: jest.fn(async (callback) => {
                const manager = {
                    create: jest.fn((entity, data) => ({ ...data, id: 'gen-id' })),
                    save: jest.fn((entity, data) => Promise.resolve({ ...data, id: data.id || 'gen-id' })),
                    delete: jest.fn().mockResolvedValue({ affected: 1 }),
                };
                return callback(manager);
            }),
        };
        eventsGateway = {
            notifyNewMessage: jest.fn(),
            server: {
                emit: jest.fn(),
                to: jest.fn().mockReturnValue({
                    emit: jest.fn(),
                }),
            },
        };
        notificationService = {
            create: jest.fn().mockResolvedValue({}),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TicketParticipantService,
                { provide: getRepositoryToken(Ticket), useValue: ticketRepo },
                { provide: getRepositoryToken(TicketParticipant), useValue: participantRepo },
                { provide: getRepositoryToken(TicketMessage), useValue: messageRepo },
                { provide: getRepositoryToken(User), useValue: userRepo },
                { provide: DataSource, useValue: dataSource },
                { provide: EventsGateway, useValue: eventsGateway },
                { provide: NotificationService, useValue: notificationService },
            ],
        }).compile();

        service = module.get<TicketParticipantService>(TicketParticipantService);
    });

    describe('addParticipants', () => {
        it('should allow ticket creator to add participants to IT Support ticket', async () => {
            ticketRepo.findOne.mockResolvedValue(mockTicket);
            userRepo.findOne.mockResolvedValue({ id: 'creator-user-id', fullName: 'Budi Creator' });
            userRepo.find.mockResolvedValue([
                { id: 'colleague-id', fullName: 'Siti Rekan', isActive: true, email: 'siti@test.com' },
            ]);
            participantRepo.find.mockResolvedValue([]);
            participantRepo.findOne.mockResolvedValue(null);

            await service.addParticipants(
                'ticket-1',
                ['colleague-id'],
                'creator-user-id',
                UserRole.USER,
            );

            expect(dataSource.transaction).toHaveBeenCalled();
            expect(notificationService.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: 'colleague-id',
                    title: 'Anda Ditambahkan ke Tiket IT Support',
                }),
            );
        });

        it('should allow IT Support agent to add participants', async () => {
            ticketRepo.findOne.mockResolvedValue(mockTicket);
            userRepo.findOne.mockResolvedValue({ id: 'agent-2-id', fullName: 'Agent Support' });
            userRepo.find.mockResolvedValue([
                { id: 'tech-2-id', fullName: 'Teknisi 2', isActive: true, email: 'tech2@test.com' },
            ]);
            participantRepo.find.mockResolvedValue([]);
            participantRepo.findOne.mockResolvedValue(null);

            await service.addParticipants(
                'ticket-1',
                ['tech-2-id'],
                'agent-2-id',
                UserRole.AGENT,
            );

            expect(dataSource.transaction).toHaveBeenCalled();
            expect(notificationService.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Anda Ditambahkan ke Tiket IT Support',
                }),
            );
        });

        it('should throw ForbiddenException if an unrelated user tries to add participant', async () => {
            ticketRepo.findOne.mockResolvedValue(mockTicket);
            participantRepo.findOne.mockResolvedValue(null);

            await expect(
                service.addParticipants(
                    'ticket-1',
                    ['random-user'],
                    'unrelated-user-id',
                    UserRole.USER,
                ),
            ).rejects.toThrow(ForbiddenException);
        });
    });

    describe('removeParticipant', () => {
        it('should allow IT Support Agent to remove a participant', async () => {
            ticketRepo.findOne.mockResolvedValue(mockTicket);
            participantRepo.findOne.mockResolvedValue({
                id: 'part-1',
                ticketId: 'ticket-1',
                userId: 'colleague-id',
                user: { fullName: 'Siti Rekan' },
            });
            userRepo.findOne.mockResolvedValue({ id: 'agent-id', fullName: 'Agent Utama' });

            const result = await service.removeParticipant(
                'ticket-1',
                'colleague-id',
                'agent-id',
                UserRole.AGENT,
            );

            expect(result.success).toBe(true);
            expect(dataSource.transaction).toHaveBeenCalled();
        });

        it('should throw ForbiddenException if regular user / creator tries to remove a participant', async () => {
            ticketRepo.findOne.mockResolvedValue(mockTicket);

            await expect(
                service.removeParticipant(
                    'ticket-1',
                    'colleague-id',
                    'creator-user-id',
                    UserRole.USER,
                ),
            ).rejects.toThrow(ForbiddenException);
        });

        it('should throw BadRequestException if trying to remove the ticket creator', async () => {
            ticketRepo.findOne.mockResolvedValue(mockTicket);

            await expect(
                service.removeParticipant(
                    'ticket-1',
                    'creator-user-id',
                    'admin-id',
                    UserRole.ADMIN,
                ),
            ).rejects.toThrow(BadRequestException);
        });
    });
});
