import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SavedRepliesService, DEFAULT_SAVED_REPLIES } from '../saved-replies.service';
import { SavedRepliesController } from '../presentation/saved-replies.controller';
import { SavedReply } from '../entities/saved-reply.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('SavedReplies Module', () => {
  let service: SavedRepliesService;
  let controller: SavedRepliesController;
  let mockRepo: any;

  const mockUserAgent = { userId: 'agent-123', role: UserRole.AGENT };
  const mockUserAdmin = { userId: 'admin-999', role: UserRole.ADMIN };

  beforeEach(async () => {
    mockRepo = {
      create: jest.fn((data) => ({ id: 'reply-1', createdAt: new Date(), ...data })),
      save: jest.fn((data) => Promise.resolve(data)),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn((data) => Promise.resolve(data)),
      delete: jest.fn(() => Promise.resolve({ affected: 1 })),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SavedRepliesController],
      providers: [
        SavedRepliesService,
        {
          provide: getRepositoryToken(SavedReply),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<SavedRepliesService>(SavedRepliesService);
    controller = module.get<SavedRepliesController>(SavedRepliesController);
  });

  describe('Auto-seeding and Isolation', () => {
    it('auto-seeds default templates if agent has no saved replies yet', async () => {
      mockRepo.find.mockResolvedValueOnce([]); // No existing replies

      const result = await service.findAll('agent-123');

      expect(mockRepo.create).toHaveBeenCalled();
      expect(mockRepo.save).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });

    it('returns agent-specific replies without auto-seeding if already exists', async () => {
      const existing = [
        { id: '1', title: 'Custom Greeting', shortcut: '/hi', userId: 'agent-123' },
      ];
      mockRepo.find.mockResolvedValueOnce(existing);

      const result = await service.findAll('agent-123');
      expect(result).toEqual(existing);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('CRUD Operations', () => {
    it('creates custom template with normalized shortcut', async () => {
      const dto = {
        title: 'Greeting',
        content: 'Halo {user_name}',
        shortcut: 'hi', // without leading slash
        category: 'General',
      };

      await service.create('agent-123', dto);

      expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Greeting',
        shortcut: '/hi',
        userId: 'agent-123',
      }));
    });

    it('allows owner to update their own template', async () => {
      const existing = {
        id: 'reply-1',
        title: 'Old Title',
        content: 'Old Content',
        shortcut: '/old',
        userId: 'agent-123',
      };
      mockRepo.findOne.mockResolvedValueOnce(existing);

      const result = await service.update('agent-123', 'reply-1', {
        title: 'New Title',
        shortcut: '/new',
      });

      expect(mockRepo.save).toHaveBeenCalled();
      expect(result.title).toBe('New Title');
      expect(result.shortcut).toBe('/new');
    });

    it('blocks other agents from editing another agent profile template', async () => {
      const existing = {
        id: 'reply-1',
        title: 'Private Title',
        userId: 'agent-OTHER',
      };
      mockRepo.findOne.mockResolvedValueOnce(existing);

      await expect(
        service.update('agent-123', 'reply-1', { title: 'Hacked' }, false)
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows owner to delete their own template', async () => {
      const existing = {
        id: 'reply-1',
        title: 'To Delete',
        userId: 'agent-123',
      };
      mockRepo.findOne.mockResolvedValueOnce(existing);

      const result = await service.delete('agent-123', 'reply-1');
      expect(result).toEqual({ success: true });
      expect(mockRepo.remove).toHaveBeenCalledWith(existing);
    });

    it('resets agent templates to default', async () => {
      const result = await service.resetDefaults('agent-123');
      expect(mockRepo.delete).toHaveBeenCalledWith({ userId: 'agent-123' });
      expect(mockRepo.save).toHaveBeenCalled();
    });
  });

  describe('Controller Endpoints', () => {
    it('controller delegates findAll with request user id', async () => {
      mockRepo.find.mockResolvedValueOnce([]);
      const req = { user: mockUserAgent };

      await controller.findAll(req);
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { userId: 'agent-123' },
        order: { createdAt: 'ASC' },
      });
    });
  });
});
