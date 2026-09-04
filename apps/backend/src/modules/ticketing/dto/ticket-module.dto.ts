import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsInt, IsArray, IsUUID, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HandlingTeam, TicketType } from '../entities/ticket.entity';
import { UserRole } from '../../users/enums/user-role.enum';

export class CreateTicketModuleDto {
    @ApiProperty({ description: 'Display name of the module', example: 'Network & Infrastructure' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ description: 'Unique URL slug for the module', example: 'network-infra' })
    @IsString()
    @IsNotEmpty()
    @Matches(/^[a-z0-9-]+$/, { message: 'Slug can only contain lowercase letters, numbers, and hyphens' })
    slug: string;

    @ApiPropertyOptional({ description: 'Description of the module' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiPropertyOptional({ description: 'Lucide icon name', example: 'Network' })
    @IsString()
    @IsOptional()
    icon?: string;

    @ApiPropertyOptional({ description: 'Color theme for badge & accent', example: 'amber' })
    @IsString()
    @IsOptional()
    color?: string;

    @ApiPropertyOptional({ description: 'Display sort order in sidebar', example: 5 })
    @IsInt()
    @IsOptional()
    sortOrder?: number;

    @ApiPropertyOptional({ description: 'Active status', default: true })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;

    @ApiPropertyOptional({ description: 'Target handling teams', enum: HandlingTeam, isArray: true })
    @IsArray()
    @IsOptional()
    handlingTeams?: HandlingTeam[];

    @ApiPropertyOptional({ description: 'Target categories', type: [String] })
    @IsArray()
    @IsOptional()
    categories?: string[];

    @ApiPropertyOptional({ description: 'Target ticket types', enum: TicketType, isArray: true })
    @IsArray()
    @IsOptional()
    ticketTypes?: TicketType[];

    @ApiPropertyOptional({ description: 'Roles allowed to view/access this module', enum: UserRole, isArray: true })
    @IsArray()
    @IsOptional()
    allowedRoles?: UserRole[];

    @ApiPropertyOptional({ description: 'Roles eligible to be assigned tickets in this module', enum: UserRole, isArray: true })
    @IsArray()
    @IsOptional()
    assigneeRoles?: UserRole[];

    @ApiPropertyOptional({
        description: 'Explicit assignee user IDs. When non-empty this list wins over assigneeRoles.',
        type: [String],
    })
    @IsArray()
    @IsUUID('4', { each: true })
    @IsOptional()
    assigneeUserIds?: string[];

    @ApiPropertyOptional({ description: 'Enable workload-based auto-assignment for this module' })
    @IsBoolean()
    @IsOptional()
    autoAssignEnabled?: boolean;
}

export class UpdateTicketModuleDto {
    @ApiPropertyOptional({ description: 'Display name of the module' })
    @IsString()
    @IsOptional()
    name?: string;

    @ApiPropertyOptional({ description: 'Unique URL slug for the module' })
    @IsString()
    @IsOptional()
    @Matches(/^[a-z0-9-]+$/, { message: 'Slug can only contain lowercase letters, numbers, and hyphens' })
    slug?: string;

    @ApiPropertyOptional({ description: 'Description of the module' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiPropertyOptional({ description: 'Lucide icon name' })
    @IsString()
    @IsOptional()
    icon?: string;

    @ApiPropertyOptional({ description: 'Color theme for badge & accent' })
    @IsString()
    @IsOptional()
    color?: string;

    @ApiPropertyOptional({ description: 'Display sort order in sidebar' })
    @IsInt()
    @IsOptional()
    sortOrder?: number;

    @ApiPropertyOptional({ description: 'Active status' })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;

    @ApiPropertyOptional({ description: 'Target handling teams' })
    @IsArray()
    @IsOptional()
    handlingTeams?: HandlingTeam[];

    @ApiPropertyOptional({ description: 'Target categories' })
    @IsArray()
    @IsOptional()
    categories?: string[];

    @ApiPropertyOptional({ description: 'Target ticket types' })
    @IsArray()
    @IsOptional()
    ticketTypes?: TicketType[];

    @ApiPropertyOptional({ description: 'Roles allowed to view/access this module' })
    @IsArray()
    @IsOptional()
    allowedRoles?: UserRole[];

    @ApiPropertyOptional({ description: 'Roles eligible to be assigned tickets in this module' })
    @IsArray()
    @IsOptional()
    assigneeRoles?: UserRole[];

    @ApiPropertyOptional({
        description: 'Explicit assignee user IDs. When non-empty this list wins over assigneeRoles.',
        type: [String],
    })
    @IsArray()
    @IsUUID('4', { each: true })
    @IsOptional()
    assigneeUserIds?: string[];

    @ApiPropertyOptional({ description: 'Enable workload-based auto-assignment for this module' })
    @IsBoolean()
    @IsOptional()
    autoAssignEnabled?: boolean;
}

export class ReorderTicketModulesDto {
    @ApiProperty({ description: 'Ordered list of module IDs', type: [String] })
    @IsArray()
    @IsNotEmpty()
    orderedIds: string[];
}
