import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HardwareRequestItem } from '../domain/entities/hardware-request-item.entity';
import { ItemDeliveryDto } from '../dto/item-delivery.dto';
import { HardwareEvents, ItemArrivedPayload } from '../domain/events/hardware-request.events';
import { UserRole } from '../../users/enums/user-role.enum';
import { SiteActor, assertSiteAccess } from '../../../shared/core/utils/site-scope.util';

@Injectable()
export class DeliveryTrackingService {
  constructor(
    @InjectRepository(HardwareRequestItem)
    private readonly itemRepo: Repository<HardwareRequestItem>,
    private readonly emitter: EventEmitter2,
  ) {}

  async updateDelivery(
    requestId: string,
    itemId: string,
    dto: ItemDeliveryDto,
    actor?: { id: string; siteId?: string | null; userRole?: UserRole },
  ): Promise<HardwareRequestItem> {
    const item = await this.itemRepo.findOne({
      where: { id: itemId },
      relations: ['request'],
    });
    if (!item) throw new NotFoundException('item not found');
    if (item.requestId !== requestId) {
      throw new BadRequestException('item not in request');
    }
    if (item.procurementDecision !== 'APPROVED') {
      throw new BadRequestException('cannot update non-procured item');
    }

    // Site isolation (derive from item's request)
    if (actor && actor.siteId !== undefined && actor.siteId !== null && actor.userRole) {
      const siteActor: SiteActor = { role: actor.userRole, siteId: actor.siteId };
      assertSiteAccess(siteActor, (item as any).request?.siteId ?? (item as any).siteId);
    }

    const now = new Date();
    const updated = {
      ...item,
      deliveryStatus: dto.status,
      arrivedAt: dto.status === 'ARRIVED' ? now : null,
    } as HardwareRequestItem;
    const saved = await this.itemRepo.save(updated);

    if (dto.status === 'ARRIVED') {
      const payload: ItemArrivedPayload = {
        requestId,
        itemId,
        itemName: saved.catalog?.name ?? 'Item',
        ownerId: saved.request.requesterId,
        arrivedAt: now,
      };
      this.emitter.emit(HardwareEvents.ItemArrived, payload);
    }

    return saved;
  }
}