import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketModule } from '../../ticketing/entities/ticket-module.entity';
import { AttributeType, TicketAttribute } from '../../ticketing/entities/ticket-attribute.entity';
import { TicketPriority, TicketType } from '../../ticketing/entities/ticket.entity';

export const HARDWARE_INSTALLATION_CATEGORY = 'HARDWARE_INSTALLATION';
/** Built-in IT Support categories, as offered by the web create form. */
const IT_SUPPORT_BASE_CATEGORIES = ['GENERAL', 'HARDWARE', 'SOFTWARE', 'NETWORK'];
/** Priorities a requester may pick (HARDWARE_INSTALLATION is set by the category). */
const SELECTABLE_PRIORITIES = [TicketPriority.LOW, TicketPriority.MEDIUM, TicketPriority.HIGH, TicketPriority.CRITICAL];

/**
 * Developer modules take one fixed request type, exactly like the web form: the module,
 * not the category text, decides the queue (Oracle/K2, Web Dev, Mobile Dev).
 */
const DEV_MODULE_TYPES: Readonly<Record<string, TicketType>> = {
    'oracle-k2': TicketType.ORACLE_REQUEST,
    'web-developer': TicketType.WEB_DEV_REQUEST,
    'mobile-developer': TicketType.MOBILE_DEV_REQUEST,
};
const IT_SUPPORT_SLUG = 'it-support';

export interface IpopModuleInfo {
    slug: string;
    name: string;
    description: string | null;
    categories: string[];
    /** Category used when the caller sends none (dev modules), else null = required. */
    defaultCategory: string | null;
    priorities: TicketPriority[];
    supportsHardwareInstallation: boolean;
}

/** Where a ticket goes and what it is: resolved from the module the user picked in iPop. */
export interface IpopRoute {
    module: TicketModule;
    category: string;
    ticketType: TicketType;
    isHardwareInstallation: boolean;
}

@Injectable()
export class IpopCatalogService {
    constructor(
        @InjectRepository(TicketModule) private readonly moduleRepo: Repository<TicketModule>,
        @InjectRepository(TicketAttribute) private readonly attributeRepo: Repository<TicketAttribute>,
    ) {}

    /** Active ticket modules iPop may file into, with their selectable categories. */
    async listModules(): Promise<IpopModuleInfo[]> {
        const modules = await this.supportedModules();
        const itCategories = await this.itSupportCategories();
        return modules.map((m) => {
            const devType = DEV_MODULE_TYPES[m.slug];
            return {
                slug: m.slug,
                name: m.name,
                description: m.description ?? null,
                categories: devType ? [devType] : itCategories,
                defaultCategory: devType ?? null,
                priorities: SELECTABLE_PRIORITIES,
                supportsHardwareInstallation: !devType,
            };
        });
    }

    /** Validates module + category and returns the queue the ticket must land in. */
    async resolveRoute(slug: string, category: string | undefined): Promise<IpopRoute> {
        const module = (await this.supportedModules()).find((m) => m.slug === slug);
        if (!module) {
            throw new BadRequestException(`Unknown or inactive module "${slug}". See GET /integrations/ipop/modules.`);
        }

        const devType = DEV_MODULE_TYPES[slug];
        if (devType) {
            if (category && category !== devType) {
                throw new BadRequestException(`Module "${slug}" only accepts category "${devType}".`);
            }
            return { module, category: devType, ticketType: devType, isHardwareInstallation: false };
        }

        if (!category) {
            throw new BadRequestException(`category is required for module "${slug}".`);
        }
        const allowed = await this.itSupportCategories();
        if (!allowed.includes(category)) {
            throw new BadRequestException(`Category "${category}" is not valid for module "${slug}". Allowed: ${allowed.join(', ')}.`);
        }
        const isHardwareInstallation = category === HARDWARE_INSTALLATION_CATEGORY;
        return {
            module,
            category,
            ticketType: isHardwareInstallation ? TicketType.HARDWARE_INSTALLATION : TicketType.SERVICE,
            isHardwareInstallation,
        };
    }

    private async supportedModules(): Promise<TicketModule[]> {
        const modules = await this.moduleRepo.find({ where: { isActive: true }, order: { sortOrder: 'ASC' } });
        return modules.filter((m) => m.slug === IT_SUPPORT_SLUG || m.slug in DEV_MODULE_TYPES);
    }

    private async itSupportCategories(): Promise<string[]> {
        const extra = await this.attributeRepo.find({ where: { type: AttributeType.CATEGORY, isEnabled: true } });
        const values = [...IT_SUPPORT_BASE_CATEGORIES, ...extra.map((a) => a.value), HARDWARE_INSTALLATION_CATEGORY];
        return [...new Set(values)];
    }
}
