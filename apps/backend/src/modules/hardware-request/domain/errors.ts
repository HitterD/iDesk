// apps/backend/src/modules/hardware-request/domain/errors.ts
import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import { RequestStatus } from './enums/request-status.enum';

export class InvalidStateTransitionError extends ConflictException {
    constructor(from: RequestStatus, to: RequestStatus) {
        super({
            code: 'HR_INVALID_TRANSITION',
            message: `Cannot transition from ${from} to ${to}`,
            from,
            to,
        });
    }
}

export class PermissionDeniedError extends ForbiddenException {
    constructor(action: string) {
        super({
            code: 'HR_PERMISSION_DENIED',
            message: `You are not allowed to ${action}`,
        });
    }
}

export class CatalogItemInactiveError extends BadRequestException {
    constructor(catalogId: string) {
        super({
            code: 'HR_CATALOG_INACTIVE',
            message: `Catalog item ${catalogId} is inactive or does not exist`,
        });
    }
}

export class OptimisticLockError extends ConflictException {
    constructor() {
        super({
            code: 'HR_OPTIMISTIC_LOCK',
            message: 'Resource was modified by another transaction; refresh and retry',
        });
    }
}

export class HardwareRequestNotFoundError extends NotFoundException {
    constructor(id: string) {
        super({
            code: 'HR_NOT_FOUND',
            message: `Hardware request ${id} not found`,
        });
    }
}
