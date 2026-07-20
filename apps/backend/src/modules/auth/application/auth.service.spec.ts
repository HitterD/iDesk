import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../../users/users.service';
import { AuditService } from '../../audit/audit.service';
import * as bcrypt from 'bcrypt';
import { HrisGatewayAdapter } from '../../hris-gateway/hris-gateway.adapter';
import { HrisSyncService } from '../../hris-gateway/hris-sync.service';

// Mock bcrypt
jest.mock('bcrypt');

describe('AuthService', () => {
    let service: AuthService;
    let usersService: jest.Mocked<UsersService>;
    let jwtService: jest.Mocked<JwtService>;
    let auditService: jest.Mocked<AuditService>;

    const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password: 'hashedPassword123',
        fullName: 'Test User',
        role: 'USER',
        isActive: true,
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: UsersService,
                    useValue: {
                        findByEmail: jest.fn(),
                        findById: jest.fn(),
                        updatePassword: jest.fn(),
                        update: jest.fn(),
                        createUser: jest.fn(),
                        setCurrentRefreshToken: jest.fn(),
                    },
                },
                {
                    provide: JwtService,
                    useValue: {
                        sign: jest.fn(),
                    },
                },
                {
                    provide: AuditService,
                    useValue: {
                        logAsync: jest.fn(),
                    },
                },
                {
                    provide: HrisGatewayAdapter,
                    useValue: { verifyPassword: jest.fn(), getEmployee: jest.fn() },
                },
                {
                    provide: HrisSyncService,
                    useValue: { provisionEmployee: jest.fn() },
                },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
        usersService = module.get(UsersService);
        jwtService = module.get(JwtService);
        auditService = module.get(AuditService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('validateUserWithDetails', () => {
        it('should return USER_NOT_FOUND when user does not exist', async () => {
            usersService.findByEmail.mockResolvedValue(null as any);

            const result = await service.validateUserWithDetails('notfound@example.com', 'password');

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('USER_NOT_FOUND');
            expect(auditService.logAsync).toHaveBeenCalled();
        });

        it('should return ACCOUNT_DISABLED when user is inactive', async () => {
            usersService.findByEmail.mockResolvedValue({
                ...mockUser,
                isActive: false,
            } as any);

            const result = await service.validateUserWithDetails('test@example.com', 'password');

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('ACCOUNT_DISABLED');
        });

        it('should return WRONG_PASSWORD when password is incorrect', async () => {
            usersService.findByEmail.mockResolvedValue(mockUser as any);
            (bcrypt.compare as jest.Mock).mockResolvedValue(false);

            const result = await service.validateUserWithDetails('test@example.com', 'wrongpassword');

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('WRONG_PASSWORD');
        });

        it('should return success with user when credentials are valid', async () => {
            usersService.findByEmail.mockResolvedValue(mockUser as any);
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);

            const result = await service.validateUserWithDetails('test@example.com', 'correctpassword');

            expect(result.success).toBe(true);
            expect(result.user).toBeDefined();
            expect(result.user.email).toBe('test@example.com');
            expect(result.user.password).toBeUndefined(); // Password should be stripped
        });
    });

    describe('login', () => {
        it('should generate JWT token with correct payload', async () => {
            const mockToken = 'mock.jwt.token';
            jwtService.sign.mockReturnValue(mockToken);
            usersService.update.mockResolvedValue(mockUser as any);

            const result = await service.login(mockUser);

            expect(jwtService.sign).toHaveBeenCalledWith(
                {
                    username: mockUser.email,
                    sub: mockUser.id,
                    role: mockUser.role,
                    type: 'access',
                    fullName: mockUser.fullName,
                },
                expect.any(Object)
            );
            expect(result.access_token).toBe(mockToken);
            expect(result.user).toBe(mockUser);
        });

        it('should set 15m expiration for ADMIN users', async () => {
            const adminUser = { ...mockUser, role: 'ADMIN' };
            jwtService.sign.mockReturnValue('token');
            usersService.update.mockResolvedValue(adminUser as any);

            const result = await service.login(adminUser);

            expect(result.expiresIn).toBe('15m');
        });

        it('should set 15m expiration for AGENT users', async () => {
            const agentUser = { ...mockUser, role: 'AGENT' };
            jwtService.sign.mockReturnValue('token');
            usersService.update.mockResolvedValue(agentUser as any);

            const result = await service.login(agentUser);

            expect(result.expiresIn).toBe('15m');
        });

        it('should set 15m expiration for USER role', async () => {
            jwtService.sign.mockReturnValue('token');
            usersService.update.mockResolvedValue(mockUser as any);

            const result = await service.login(mockUser);

            expect(result.expiresIn).toBe('15m');
        });

        it('should update lastActiveAt on login', async () => {
            jwtService.sign.mockReturnValue('token');
            usersService.update.mockResolvedValue(mockUser as any);

            await service.login(mockUser);

            expect(usersService.update).toHaveBeenCalledWith(
                mockUser.id,
                expect.objectContaining({ lastActiveAt: expect.any(Date) })
            );
        });

        it('should log audit for successful login', async () => {
            jwtService.sign.mockReturnValue('token');
            usersService.update.mockResolvedValue(mockUser as any);

            await service.login(mockUser);

            expect(auditService.logAsync).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: mockUser.id,
                    action: 'USER_LOGIN',
                    entityType: 'auth',
                })
            );
        });
    });

    describe('changePassword', () => {
        it('should throw UnauthorizedException when user not found', async () => {
            usersService.findById.mockResolvedValue(null as any);

            await expect(
                service.changePassword('nonexistent', {
                    currentPassword: 'old',
                    newPassword: 'new',
                })
            ).rejects.toThrow('User not found');
        });

        it('should throw BadRequestException when current password is wrong', async () => {
            usersService.findById.mockResolvedValue(mockUser as any);
            (bcrypt.compare as jest.Mock).mockResolvedValue(false);

            await expect(
                service.changePassword(mockUser.id, {
                    currentPassword: 'wrongpassword',
                    newPassword: 'newpassword',
                })
            ).rejects.toThrow('Current password is incorrect');
        });

        it('should update password when current password is correct', async () => {
            usersService.findById.mockResolvedValue(mockUser as any);
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);
            (bcrypt.hash as jest.Mock).mockResolvedValue('newHashedPassword');
            usersService.updatePassword.mockResolvedValue(undefined);

            const result = await service.changePassword(mockUser.id, {
                currentPassword: 'correctpassword',
                newPassword: 'newpassword',
            });

            expect(bcrypt.hash).toHaveBeenCalledWith('newpassword', expect.any(Number));
            expect(usersService.updatePassword).toHaveBeenCalledWith(mockUser.id, 'newHashedPassword');
            expect(result.message).toBe('Password updated successfully');
        });
    });

    describe('validateUser', () => {
        it('should return user without password when valid', async () => {
            usersService.findByEmail.mockResolvedValue(mockUser as any);
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);

            const result = await service.validateUser('test@example.com', 'password');

            expect(result).toBeDefined();
            expect(result.email).toBe(mockUser.email);
            expect(result.password).toBeUndefined();
        });

        it('should return null when user not found', async () => {
            usersService.findByEmail.mockResolvedValue(null as any);

            const result = await service.validateUser('notfound@example.com', 'password');

            expect(result).toBeNull();
        });

        it('should return null when password is wrong', async () => {
            usersService.findByEmail.mockResolvedValue(mockUser as any);
            (bcrypt.compare as jest.Mock).mockResolvedValue(false);

            const result = await service.validateUser('test@example.com', 'wrongpassword');

            expect(result).toBeNull();
        });
    });
});
