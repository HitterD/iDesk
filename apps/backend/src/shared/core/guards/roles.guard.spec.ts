import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { UserRole } from '../../../modules/users/enums/user-role.enum';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

describe('RolesGuard', () => {
    let guard: RolesGuard;
    let reflector: Reflector;

    beforeEach(() => {
        reflector = new Reflector();
        guard = new RolesGuard(reflector);
    });

    const createMockContext = (user?: any): ExecutionContext => ({
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
            getRequest: () => ({ user }),
        }),
    } as any);

    it('should allow access if route is marked as @Public() even if class has roles', () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
            if (key === IS_PUBLIC_KEY) return true;
            if (key === 'roles') return [UserRole.ADMIN];
            return undefined;
        });

        const context = createMockContext(undefined);
        expect(guard.canActivate(context)).toBe(true);
    });

    it('should deny access if not public, class requires admin, but user is undefined', () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
            if (key === IS_PUBLIC_KEY) return false;
            if (key === 'roles') return [UserRole.ADMIN];
            return undefined;
        });

        const context = createMockContext(undefined);
        expect(guard.canActivate(context)).toBe(false);
    });

    it('should allow access if user has required role', () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
            if (key === IS_PUBLIC_KEY) return false;
            if (key === 'roles') return [UserRole.ADMIN];
            return undefined;
        });

        const context = createMockContext({ role: UserRole.ADMIN });
        expect(guard.canActivate(context)).toBe(true);
    });

    it('should deny access if user has wrong role', () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
            if (key === IS_PUBLIC_KEY) return false;
            if (key === 'roles') return [UserRole.ADMIN];
            return undefined;
        });

        const context = createMockContext({ role: UserRole.USER });
        expect(guard.canActivate(context)).toBe(false);
    });
});
