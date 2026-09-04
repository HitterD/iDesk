import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../../users/users.service';
import { AuditService } from '../../audit/audit.service';
import * as bcrypt from 'bcrypt';
import { HrisGatewayAdapter } from '../../hris-gateway/hris-gateway.adapter';
import { HrisSyncService } from '../../hris-gateway/hris-sync.service';
import { UserRole } from '../../users/enums/user-role.enum';
import { ValidatedUser } from './auth-user.types';
import { IssuedTokens, TokenService } from './token.service';
import { SessionService } from './session.service';
import { CredentialValidatorService } from './credential-validator.service';
import { HrisProvisioningService } from './hris-provisioning.service';
import { RefreshTokenClaims } from './refresh-session.types';
import { User } from '../../users/entities/user.entity';
import { AuthEventPublisher } from './auth-events';


// Mock bcrypt
jest.mock('bcrypt');

describe('AuthService', () => {
    let service: AuthService;
    let usersService: jest.Mocked<UsersService>;
    let tokenService: jest.Mocked<TokenService>;
    let sessionService: jest.Mocked<SessionService>;
    let auditService: jest.Mocked<AuditService>;
    let authEvents: { emit: jest.Mock };

    const issuedTokens: IssuedTokens = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        tokenId: 'token-id',
        familyId: 'family-id',
        expiresIn: '1h',
        refreshExpiresIn: '7d',
        refreshExpiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };

    const mockUser: ValidatedUser = {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
        role: UserRole.USER,
        isActive: true,
        mustChangePassword: false,
    };

    const persistedUser = {
        ...mockUser,
        password: 'hashed-password',
    } as User;

    const refreshClaims: RefreshTokenClaims = {
        sub: mockUser.id,
        tokenId: 'old-token-id',
        familyId: 'old-family-id',
        type: 'refresh',
        rememberMe: true,
        iat: 1,
        exp: 2,
    };

    const issueTokens = (overrides: Partial<IssuedTokens> = {}): IssuedTokens => ({
        ...issuedTokens,
        ...overrides,
    });

    const mockPersistenceUser = (user: ValidatedUser = mockUser): User => ({
        ...user,
        password: 'hashed-password',
    } as User);

    const mockSession = () => {
        tokenService.issueRefreshToken.mockReturnValue(issueTokens());
        sessionService.persist.mockResolvedValue(undefined);
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
                        removeRefreshToken: jest.fn(),
                        getUserIfRefreshTokenMatches: jest.fn(),
                    },
                },
                {
                    provide: TokenService,
                    useValue: {
                        issueRefreshToken: jest.fn(),
                        verifyRefreshToken: jest.fn(),
                    },
                },
                {
                    provide: SessionService,
                    useValue: {
                        persist: jest.fn(),
                        rotate: jest.fn(),
                        invalidateUser: jest.fn(),
                    },
                },
                CredentialValidatorService,
                {
                    provide: AuthEventPublisher,
                    useValue: { emit: jest.fn() },
                },
                {
                    provide: HrisProvisioningService,
                    useValue: { provision: jest.fn() },
                },
                {
                    provide: AuditService,
                    useValue: {
                        log: jest.fn().mockResolvedValue({}),
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
        tokenService = module.get(TokenService);
        sessionService = module.get(SessionService);
        auditService = module.get(AuditService);
        authEvents = module.get(AuthEventPublisher);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('validateUserWithDetails', () => {
        it('records current timing gap for missing email users', async () => {
            usersService.findByEmail.mockResolvedValue(null as any);
            (bcrypt.compare as jest.Mock).mockClear();

            const result = await service.validateUserWithDetails(' NotFound@Example.com ', 'password');

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('USER_NOT_FOUND');
            expect(bcrypt.compare).toHaveBeenCalledTimes(1);
            expect(bcrypt.compare).toHaveBeenCalledWith('password', expect.any(String));
            expect(usersService.findByEmail).toHaveBeenCalledWith('notfound@example.com');
            expect(auditService.logAsync).toHaveBeenCalledWith(expect.objectContaining({
                newValue: { email: 'n***@e***', reason: 'USER_NOT_FOUND' },
            }));
        });

        it('records password verification for existing email users', async () => {
            usersService.findByEmail.mockResolvedValue(mockUser as any);
            (bcrypt.compare as jest.Mock).mockResolvedValue(false);
            (bcrypt.compare as jest.Mock).mockClear();

            const result = await service.validateUserWithDetails('test@example.com', 'password');

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('WRONG_PASSWORD');
            expect(bcrypt.compare).toHaveBeenCalledTimes(1);
        });

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
            expect(bcrypt.compare).toHaveBeenCalledTimes(1);
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
            expect(result.user).toEqual(expect.objectContaining({ email: 'test@example.com' }));
            expect(result.user).not.toHaveProperty('password'); // Password should be stripped
        });
    });

    describe('login', () => {
        it('login meneruskan mustChangePassword ke response', async () => {
            mockSession();
            usersService.update.mockResolvedValue({} as any);

            const result = await service.login({
                id: 'u1', email: 'a@b.com', role: 'USER', fullName: 'A', mustChangePassword: true,
            } as any);

            expect(result.user.mustChangePassword).toBe(true);
        });

        it('should generate JWT token with correct payload', async () => {
            const mockToken = 'mock.jwt.token';
            mockSession();
            tokenService.issueRefreshToken.mockReturnValue(issueTokens({ access_token: mockToken }));
            usersService.update.mockResolvedValue(mockUser as any);

            const result = await service.login(mockUser);

            expect(tokenService.issueRefreshToken).toHaveBeenCalledWith(mockUser, undefined, undefined, false);
            expect(result.access_token).toBe(mockToken);
            expect(result.user).toBe(mockUser);
        });

        it.each(['ADMIN', 'AGENT', 'AGENT_OPERATIONAL_SUPPORT', 'AGENT_ORACLE', 'MANAGER'])(
            'should set 8h expiration for %s users',
            async (role) => {
                const staffUser: ValidatedUser = { ...mockUser, role: role as UserRole };
                mockSession();
                tokenService.issueRefreshToken.mockReturnValue(issueTokens({ expiresIn: '8h' }));
                usersService.update.mockResolvedValue(staffUser as any);

                const result = await service.login(staffUser);

                expect(result.expiresIn).toBe('8h');
            },
        );

        it('should set 1h expiration for USER role', async () => {
            mockSession();
            usersService.update.mockResolvedValue(mockUser as any);

            const result = await service.login(mockUser);

            expect(result.expiresIn).toBe('1h');
        });

        it('should update lastActiveAt on login', async () => {
            mockSession();
            usersService.update.mockResolvedValue(mockUser as any);

            await service.login(mockUser);

            expect(usersService.update).toHaveBeenCalledWith(
                mockUser.id,
                expect.objectContaining({ lastActiveAt: expect.any(Date) })
            );
        });

        it('should log audit for successful login', async () => {
            mockSession();
            usersService.update.mockResolvedValue(mockUser as any);

            await service.login(mockUser);

            expect(auditService.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: mockUser.id,
                    action: 'USER_LOGIN',
                    entityType: 'auth',
                })
            );
        });

        describe('rememberMe', () => {
            it('defaults refreshExpiresIn to 7d when rememberMe is not passed', async () => {
                mockSession();
                usersService.update.mockResolvedValue(mockUser as any);

                const result = await service.login(mockUser);

                expect(result.refreshExpiresIn).toBe('7d');
            });

            it('sets refreshExpiresIn to 90d when rememberMe is true', async () => {
                mockSession();
                tokenService.issueRefreshToken.mockReturnValue(issueTokens({ refreshExpiresIn: '90d' }));
                usersService.update.mockResolvedValue(mockUser as any);

                const result = await service.login(mockUser, undefined, true);

                expect(result.refreshExpiresIn).toBe('90d');
            });

            it('passes rememberMe to token issuance', async () => {
                mockSession();
                usersService.update.mockResolvedValue(mockUser as any);

                await service.login(mockUser, undefined, true);

                expect(tokenService.issueRefreshToken).toHaveBeenCalledWith(mockUser, undefined, undefined, true);
            });

            it('preserves rememberMe across refresh token rotation', async () => {
                tokenService.verifyRefreshToken.mockReturnValue(refreshClaims);
                sessionService.rotate.mockResolvedValue(persistedUser);
                mockSession();
                tokenService.issueRefreshToken.mockReturnValue(issueTokens({ refreshExpiresIn: '90d' }));
                usersService.update.mockResolvedValue(mockUser as any);

                const result = await service.refreshToken('old-refresh-token');

                expect(sessionService.rotate).toHaveBeenCalledWith('old-refresh-token', refreshClaims);
                expect(result.refreshExpiresIn).toBe('90d');
            });
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
                    newPassword: 'New-password7!',
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
                newPassword: 'New-password7!',
            });

            expect(bcrypt.hash).toHaveBeenCalledWith('New-password7!', expect.any(Number));
            expect(usersService.updatePassword).toHaveBeenCalledWith(mockUser.id, 'newHashedPassword');
            expect(result.message).toBe('Password updated successfully');
        });

        it('should clear mustChangePassword flag after successful change', async () => {
            usersService.findById.mockResolvedValue(mockUser as any);
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);
            (bcrypt.hash as jest.Mock).mockResolvedValue('newHashedPassword');
            usersService.updatePassword.mockResolvedValue(undefined);

            await service.changePassword(mockUser.id, {
                currentPassword: 'correctpassword',
                newPassword: 'New-password7!',
            });

            expect(usersService.update).toHaveBeenCalledWith(mockUser.id, { mustChangePassword: false });
        });
    });

    describe('validateUser', () => {
        it('should return user without password when valid', async () => {
            usersService.findByEmail.mockResolvedValue(mockUser as any);
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);

            const result = await service.validateUser('test@example.com', 'password');

            expect(result).toBeDefined();
            expect(result).not.toBeNull();
            expect(result?.email).toBe(mockUser.email);
            expect(result).not.toHaveProperty('password');
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

    describe('register', () => {
        const registerPayload = {
            email: 'new@example.com',
            password: 'Password123!',
            fullName: 'New User',
        };

        it('always creates the account as USER', async () => {
            usersService.createUser.mockResolvedValue(persistedUser);

            await service.register(registerPayload as any);

            expect(usersService.createUser).toHaveBeenCalledWith(
                expect.objectContaining({ role: UserRole.USER }),
            );
        });

        it('ignores a caller-supplied role (no privilege escalation via public register)', async () => {
            usersService.createUser.mockResolvedValue(persistedUser);

            await service.register({ ...registerPayload, role: UserRole.ADMIN } as any);

            expect(usersService.createUser).toHaveBeenCalledWith(
                expect.objectContaining({ role: UserRole.USER }),
            );
            expect(usersService.createUser).not.toHaveBeenCalledWith(
                expect.objectContaining({ role: UserRole.ADMIN }),
            );
        });
    });
});
