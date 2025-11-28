import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketAttribute, AttributeType } from './entities/ticket-attribute.entity';

@Injectable()
export class TicketAttributesService {
    constructor(
        @InjectRepository(TicketAttribute)
        private readonly attributeRepo: Repository<TicketAttribute>,
    ) { }

    async onModuleInit() {
        // Seed default attributes if empty
        const count = await this.attributeRepo.count();
        if (count === 0) {
            const defaults = [
                { type: AttributeType.CATEGORY, value: 'General Inquiry' },
                { type: AttributeType.CATEGORY, value: 'Technical Issue' },
                { type: AttributeType.CATEGORY, value: 'Billing' },
                { type: AttributeType.CATEGORY, value: 'Feature Request' },
                { type: AttributeType.PRIORITY, value: 'Low' },
                { type: AttributeType.PRIORITY, value: 'Medium' },
                { type: AttributeType.PRIORITY, value: 'High' },
                { type: AttributeType.PRIORITY, value: 'Critical' },
                { type: AttributeType.DEVICE, value: 'Laptop' },
                { type: AttributeType.DEVICE, value: 'Desktop' },
                { type: AttributeType.DEVICE, value: 'Mobile' },
                { type: AttributeType.SOFTWARE, value: 'Windows' },
                { type: AttributeType.SOFTWARE, value: 'MacOS' },
                { type: AttributeType.SOFTWARE, value: 'Office 365' },
            ];
            await this.attributeRepo.save(defaults);
        }
    }

    async create(type: AttributeType, value: string) {
        const attribute = this.attributeRepo.create({ type, value });
        return this.attributeRepo.save(attribute);
    }

    async findAll() {
        const attributes = await this.attributeRepo.find({ where: { isEnabled: true } });
        return {
            categories: attributes.filter(a => a.type === AttributeType.CATEGORY),
            priorities: attributes.filter(a => a.type === AttributeType.PRIORITY),
            devices: attributes.filter(a => a.type === AttributeType.DEVICE),
            software: attributes.filter(a => a.type === AttributeType.SOFTWARE),
        };
    }

    async remove(id: string) {
        return this.attributeRepo.delete(id);
    }
}
