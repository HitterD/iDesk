import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import type { ApprovalRoute } from '../domain/approval-route';
import { HARDWARE_SOURCES, type HardwareSource } from '../domain/request-kind';

export const MESSAGE_MAX = 1000;
const ROUTES: readonly ApprovalRoute[] = ['NONE', 'MANAGER', 'MANAGER_GM'];

/** IT's review: which approval the request needs, who gives it and (hardware) where the items come from. */
export class ReviewDto {
    @IsIn(ROUTES)
    route: ApprovalRoute;

    @IsOptional() @IsUUID()
    managerId?: string;

    @IsOptional() @IsUUID()
    gmId?: string;

    @IsOptional() @IsIn(HARDWARE_SOURCES)
    hardwareSource?: HardwareSource;

    @IsOptional() @IsString() @MaxLength(MESSAGE_MAX)
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    message?: string;
}
